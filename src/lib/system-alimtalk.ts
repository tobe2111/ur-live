/**
 * 🛡️ 2026-04-28: 시스템 알림톡 helper.
 *
 * 셀러/에이전시 가입·승인, 새 주문 등 시스템 트리거 시 카카오 알림톡 발송.
 * 네이버 클라우드 SENS 키(NCP_*) 미설정 시 silent skip — production 영향 0. (2026-10-12 알리고 → SENS)
 *
 * 사용:
 *   await sendSystemAlimtalk(env, recipient_phone, 'seller_registered',
 *     '[유어딜] 셀러 가입 신청이 접수되었어요. 1~3일 내 검토 후 안내드립니다.')
 *
 * 템플릿 등록: 네이버 클라우드 SENS 콘솔 — 코드는 영문·숫자만(우리 이름에서 밑줄을 뺀 것), 목록 `docs/alimtalk-register-list.md`.
 *   - seller_registered, seller_approved, seller_rejected
 *   - agency_registered, agency_approved
 *   - new_order, gift_received, gift_refunded, settlement_completed
 */
import { sensConfigured } from './ncp-sens';

// 🛡️ 2026-05-12: dedup/rate-limit/budget cap 테이블 생성 (1회).
//   - alimtalk_dispatch_log: 최근 발송 기록 (idempotency + per-user rate limit)
//   - alimtalk_budget: 일별 발송 건수 누계 (전역 cost cap)
async function ensureGuardTables(db: D1Database) {
  if (_done_ensureGuardTables.has(db)) return
  _done_ensureGuardTables.add(db)
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS alimtalk_dispatch_log (
      phone_hash TEXT NOT NULL,
      template_code TEXT NOT NULL,
      message_hash TEXT NOT NULL,
      sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (phone_hash, template_code, sent_at)
    )`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_alimtalk_dispatch_log_recent
      ON alimtalk_dispatch_log(phone_hash, template_code, sent_at)`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS alimtalk_budget (
      day TEXT PRIMARY KEY,
      sent_count INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
  } catch { /* exists */ }
}

// 🛡️ 개인정보 마스킹 — phone 을 평문으로 dedup 키에 저장하지 않기 위해 SHA-256 prefix.
async function hashShort(input: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    const arr = Array.from(new Uint8Array(buf));
    return arr.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // crypto unavailable (test env) — 길이 폴백
    return `len${input.length}_${input.slice(-4)}`;
  }
}

// 일일 알림톡 발송 한도 (8원/건 가정 → 기본 50,000건 = 400,000원/일).
// env.ALIMTALK_DAILY_CAP override 가능.
const DEFAULT_DAILY_CAP = 50_000;
// 같은 (phone, templateCode) 1시간 내 재발송 차단 (idempotency + spam guard).
const DEDUP_WINDOW_SEC = 3600;

// 🛡️ Bindings 가 다양한 형태(Env / 직접 type) 라 unknown 으로 받고 안전 캐스팅
export async function sendSystemAlimtalk(
  env: unknown,
  phone: string,
  templateCode: string,
  message: string,
  /** 🔘 사장님 버튼의 매장 번호 — 버튼은 `alimtalk-buttons.ts` 표에서 템플릿 이름으로 꺼낸다. */
  opts?: {
    sellerId?: unknown
    /**
     * 🔁 중복 차단 단위를 좁힌다(2026-10-24 생활 견적). 기본은 (번호, 템플릿) 1시간 1통이라, 한 사장님에게
     *   새 요청이 한 시간에 둘 오면 둘째가 조용히 막힌다. 요청·견적마다 따로 보내야 하는 알림은 그 번호를 넘긴다.
     */
    dedupKey?: string
  },
): Promise<{ success: boolean; skipped?: boolean; error?: string; reason?: string }> {
  // 환경변수 미설정 시 silent skip (개발/스테이징 환경 호환)
  const e = env as Record<string, string | undefined>;
  // 🟢 2026-10-12 — 발송처는 네이버 클라우드 SENS 하나(알리고 제거). 키가 없으면 조용히 건너뛴다.
  if (!sensConfigured(e as Record<string, unknown>)) {
    return { success: false, skipped: true };
  }

  // 전화번호 정규화 (한국 휴대폰)
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (!/^01\d{8,9}$/.test(cleaned)) {
    return { success: false, error: 'invalid phone' };
  }

  const db = (e as Record<string, D1Database | undefined>).DB;

  // 🛡️ 2026-05-12: dedup + rate-limit + 일일 비용 cap (DB 가용 시).
  if (db) {
    try {
      await ensureGuardTables(db);
      const phoneHash = await hashShort(cleaned);
      const messageHash = await hashShort(message);
      const logTemplate = opts?.dedupKey ? `${templateCode}:${opts.dedupKey}` : templateCode;

      // 1) Idempotency / Rate limit: 같은 phone+template 1시간 내 재발송 차단.
      const recent = await db.prepare(`
        SELECT message_hash FROM alimtalk_dispatch_log
        WHERE phone_hash = ? AND template_code = ?
          AND sent_at > datetime('now', '-' || ? || ' seconds')
        ORDER BY sent_at DESC LIMIT 1
      `).bind(phoneHash, logTemplate, DEDUP_WINDOW_SEC).first<{ message_hash: string }>();
      if (recent) {
        return {
          success: false,
          skipped: true,
          reason: recent.message_hash === messageHash ? 'duplicate' : 'rate_limited',
        };
      }

      // 2) 일일 비용 cap (전역).
      const today = new Date().toISOString().slice(0, 10);
      const cap = Number(e?.ALIMTALK_DAILY_CAP) || DEFAULT_DAILY_CAP;
      const budget = await db.prepare(
        `SELECT sent_count FROM alimtalk_budget WHERE day = ?`
      ).bind(today).first<{ sent_count: number }>();
      if (budget && budget.sent_count >= cap) {
        return { success: false, skipped: true, reason: 'budget_exceeded' };
      }
    } catch { /* guard 실패해도 발송은 진행 (fail-open) */ }
  }

  try {
    // 🔧 2026-10-11: 실제 발송은 `text-notice` 한 곳 — 템플릿이 카카오 검수를 통과했으면 알림톡
    //   (실패 시 문자로 대체), 아니면 문자. 종전엔 틀린 주소로 알림톡만 시도해 **성공 0건**이었다.
    //   실패 기록도 그쪽이 남긴다(재시도 큐는 알림톡 템플릿으로 다시 보내므로 여기서 태우지 않는다).
    const { sendTextNotice } = await import('./text-notice');
    const sent = await sendTextNotice(e, cleaned, { tpl: templateCode, title: '유어딜 알림', text: message, sellerId: opts?.sellerId });
    const result: { success: boolean; error?: string } = sent.ok
      ? { success: true }
      : { success: false, error: 'error' in sent ? sent.error : sent.skipped };

    // 🛡️ 2026-05-12: 성공 시 dispatch_log + 일일 budget 카운트 (dedup/rate-limit/cost cap).
    if (result.success && db) {
      try {
        const phoneHash = await hashShort(cleaned);
        const messageHash = await hashShort(message);
        await db.prepare(`
          INSERT OR IGNORE INTO alimtalk_dispatch_log (phone_hash, template_code, message_hash)
          VALUES (?, ?, ?)
        `).bind(phoneHash, opts?.dedupKey ? `${templateCode}:${opts.dedupKey}` : templateCode, messageHash).run();
        const today = new Date().toISOString().slice(0, 10);
        await db.prepare(`
          INSERT INTO alimtalk_budget (day, sent_count) VALUES (?, 1)
          ON CONFLICT(day) DO UPDATE SET sent_count = sent_count + 1, updated_at = CURRENT_TIMESTAMP
        `).bind(today).run();
      } catch { /* 카운트 실패해도 발송 결과 반환 */ }
    }

    return result;
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureGuardTables = new WeakSet<object>()
