/**
 * 🆕 2026-07-21 유어애즈 아웃리치 자동 감지 + 팔로업 리마인더.
 *   ⚖️ [LEGAL] 수집 ≠ 발송 원칙 유지 — 이 파일은 *이미 보낸* 메일의 결과 이벤트만 소비(신규 발송 0).
 *
 *   ① Resend 웹훅 이벤트 → 공용 풀(account_id=0) 리드 자동 반영:
 *      · email.bounced   → email_status='bounced'  (죽은 주소 — 이후 발송 skip 은 email_suppressions 가 담당)
 *      · email.complained→ email_status='complained' + status='rejected' (스팸신고 = 명시적 수신거부, 반드시 존중)
 *      · email.opened    → opened_at 기록(참여 신호) — status 는 유지
 *      · email.delivered → email_status='delivered' (아직 미개봉)
 *      · 인바운드 응답    → status='interested' + replied_at (사람이 회신 = 관심) ※ Resend Inbound(MX) 설정 필요
 *   ② 팔로업 리마인더: 무응답·회신대기 리드를 매일 1회 Discord 다이제스트로(cron). 0건이면 무발송.
 *
 *   🔒 서비스 분리: 이 코드는 ad_influencer_leads(ad_*) 한 테이블만 만진다. 유어딜/도매 무접촉.
 *   웹훅 자체(서명검증·email_suppressions)는 메인 워커 resend-webhook.routes.ts 소유 — 여기선 위임만 받음.
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '@/worker/types/env'
import { sendDiscordAlert } from '@/worker/utils/discord-alert'

const POOL = 0 // 공용 풀 sentinel(자동수집·인바운드 전부 account_id=0)

// 스키마 보강 — influencer-discovery.ts(베이스라인 동결)를 안 건드리려고 아웃리치 추적 컬럼은 여기서 소유.
//   전부 멱등(ALTER 실패=이미 존재 → catch). 인-플라이트 Promise 캐시로 동시성 안전(ensureInfluencerSchema 패턴).
const _colPromise = new WeakMap<object, Promise<void>>()
export function ensureOutreachColumns(DB: D1Database): Promise<void> {
  const cached = _colPromise.get(DB)
  if (cached) return cached
  const p = (async () => {
    await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN email_status TEXT').run().catch(() => null)
    await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN opened_at DATETIME').run().catch(() => null)
    await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN replied_at DATETIME').run().catch(() => null)
    await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN last_event_at DATETIME').run().catch(() => null)
  })()
  _colPromise.set(DB, p)
  return p
}

/** Resend 배달 이벤트(발신)를 풀 리드에 반영. email = 수신자 주소. 반환: 매칭·갱신된 행 수. */
export async function applyResendEventToPool(
  DB: D1Database, type: string, email: string,
): Promise<number> {
  const addr = String(email || '').trim().toLowerCase()
  if (!addr || !addr.includes('@')) return 0
  await ensureOutreachColumns(DB)
  // 같은 이메일이 여러 리드(동일인 유튜브+블로그)에 있을 수 있어 전부 갱신. 미매칭이면 changes=0.
  let sql: string | null = null
  if (type === 'email.bounced') {
    // 죽은 주소 표시(발송 skip 은 email_suppressions 가 강제 — 여기선 운영자 가시성만).
    sql = `UPDATE ad_influencer_leads SET email_status='bounced', last_event_at=datetime('now')
      WHERE account_id=? AND email IS NOT NULL AND LOWER(email)=?`
  } else if (type === 'email.complained') {
    // ⚖️ 스팸신고 = 명시적 수신거부 → rejected(계약 완료건은 강등 안 함).
    sql = `UPDATE ad_influencer_leads SET email_status='complained', last_event_at=datetime('now'),
      status=CASE WHEN status='contracted' THEN status ELSE 'rejected' END
      WHERE account_id=? AND email IS NOT NULL AND LOWER(email)=?`
  } else if (type === 'email.opened') {
    // 참여 신호 — 최초 개봉 시점 기록. bounced/complained 는 email_status 유지(악화 금지).
    sql = `UPDATE ad_influencer_leads SET opened_at=COALESCE(opened_at, datetime('now')), last_event_at=datetime('now'),
      email_status=CASE WHEN email_status IN ('bounced','complained') THEN email_status ELSE 'opened' END
      WHERE account_id=? AND email IS NOT NULL AND LOWER(email)=?`
  } else if (type === 'email.delivered') {
    sql = `UPDATE ad_influencer_leads SET last_event_at=datetime('now'),
      email_status=CASE WHEN email_status IS NULL THEN 'delivered' ELSE email_status END
      WHERE account_id=? AND email IS NOT NULL AND LOWER(email)=?`
  }
  if (!sql) return 0
  const r = await DB.prepare(sql).bind(POOL, addr).run().catch(() => null)
  return r?.meta?.changes || 0
}

/** ⚖️ 수신거부 의사 감지 — 우리가 안내하는 수신거부 수단이 '회신'(OPT_OUT_LINE)이라, 회신 본문에서 거부를 감지해야
 *  법적 의무가 완성됨. 이전엔 내용 무관 전부 interested 로 승격돼 "보내지 마세요" 회신이 '관심 리드 + 즉시 대응 필요'
 *  Discord 알림으로 뒤집혔음(2026-07-23 전수조사). 보수적 패턴 — 명확한 거부 표현만. */
export function isOptOutMessage(text: string): boolean {
  return /수신\s*거부|거부\s*합니다|보내지\s*마|그만\s*보내|발송\s*중단|중단해\s*주|삭제해\s*주|명단에서\s*(빼|제외)|unsubscribe|opt[\s-]?out|remove\s+me|stop\s+(sending|emailing|contacting)/i.test(text || '')
}

/** 인바운드 회신(리드가 답장) → 관심 리드로 승격. fromEmail = 보낸사람. ※ Resend Inbound(MX) 설정 시 도달.
 *  content(제목+본문, 있으면)에 거부 표현이 감지되면 **rejected + 발송 억제**로 처리(재컨택 차단 — 계약 완료건만 예외). */
export async function applyInboundReplyToPool(DB: D1Database, fromEmail: string, content?: string): Promise<number> {
  const addr = String(fromEmail || '').trim().toLowerCase()
  if (!addr || !addr.includes('@')) return 0
  await ensureOutreachColumns(DB)
  if (isOptOutMessage(content || '')) {
    // ⚖️ 명시적 수신거부 — status=rejected + email_status=opt_out + 자동발송 억제 목록 등재(sendEmail 이 발송 전 조회).
    await DB.prepare(`CREATE TABLE IF NOT EXISTS email_suppressions (email TEXT PRIMARY KEY, reason TEXT, suppressed_at DATETIME DEFAULT (datetime('now')))`).run().catch(() => null)
    await DB.prepare('INSERT OR IGNORE INTO email_suppressions (email, reason) VALUES (?, ?)').bind(addr, 'opt_out_reply').run().catch(() => null)
    const r = await DB.prepare(
      `UPDATE ad_influencer_leads SET replied_at=COALESCE(replied_at, datetime('now')), last_event_at=datetime('now'),
         email_status='opt_out',
         status=CASE WHEN status='contracted' THEN status ELSE 'rejected' END
       WHERE account_id=? AND email IS NOT NULL AND LOWER(email)=?`,
    ).bind(POOL, addr).run().catch(() => null)
    return r?.meta?.changes || 0
  }
  const r = await DB.prepare(
    `UPDATE ad_influencer_leads SET replied_at=COALESCE(replied_at, datetime('now')), last_event_at=datetime('now'),
       contacted_at=COALESCE(contacted_at, datetime('now')),
       status=CASE WHEN status IN ('rejected','contracted') THEN status ELSE 'interested' END
     WHERE account_id=? AND email IS NOT NULL AND LOWER(email)=?`,
  ).bind(POOL, addr).run().catch(() => null)
  return r?.meta?.changes || 0
}

/**
 * 팔로업 리마인더 다이제스트 — 매일 1회 cron. 무응답(팔로업 예정일 도래 / 컨택 후 5일 무응답) +
 *   회신 도착(interested, 사람이 답장 → 즉시 대응 필요)을 Discord 로 요약. 0건이면 무발송(no-op).
 */
export async function runFollowupReminder(env: Env): Promise<{ need: number; interested: number; sent: boolean }> {
  const DB = env.DB
  await ensureOutreachColumns(DB)
  // 무응답 팔로업 대상(어드민 needFollowup 조건과 동일 SSOT).
  const NEED_COND = `((follow_up_at IS NOT NULL AND follow_up_at <= date('now'))
      OR (status='contacted' AND contacted_at IS NOT NULL AND contacted_at <= datetime('now','-5 days')))`
  const agg = await DB.prepare(
    `SELECT
       SUM(CASE WHEN ${NEED_COND} THEN 1 ELSE 0 END) AS need,
       SUM(CASE WHEN status='interested' THEN 1 ELSE 0 END) AS interested
     FROM ad_influencer_leads WHERE account_id=?`,
  ).bind(POOL).first<{ need: number | null; interested: number | null }>().catch(() => null)
  const need = Number(agg?.need) || 0
  const interested = Number(agg?.interested) || 0
  if (need === 0 && interested === 0) return { need: 0, interested: 0, sent: false }

  // 상위 몇 건 미리보기(이름 위주 — 연락처는 노출 최소화).
  const previewRows = (await DB.prepare(
    `SELECT name, platform, status, email_status FROM ad_influencer_leads
     WHERE account_id=? AND (${NEED_COND} OR status='interested')
     ORDER BY (status='interested') DESC, follow_up_at ASC, contacted_at ASC LIMIT 8`,
  ).bind(POOL).all<{ name: string; platform: string; status: string; email_status: string | null }>().catch(() => null))?.results || []
  const preview = previewRows.map(r => `· ${r.name} (${r.platform}, ${r.status}${r.email_status ? `/${r.email_status}` : ''})`).join('\n')

  const lines = [
    interested ? `📨 **회신 도착 ${interested}명** — 즉시 대응 필요(관심 표명).` : '',
    need ? `⏰ 팔로업 대상 ${need}명 — 무응답(예정일 도래 또는 컨택 후 5일+).` : '',
    '',
    preview,
    '',
    '👉 https://urdeal.kr/admin/influencer-pool (팔로업 필터)',
  ].filter(s => s !== undefined).join('\n')

  if (env.DISCORD_WEBHOOK_URL) {
    await sendDiscordAlert(env.DISCORD_WEBHOOK_URL, '유어애즈 팔로업 리마인더', lines, interested ? 'warn' : 'info')
  }
  return { need, interested, sent: !!env.DISCORD_WEBHOOK_URL }
}
