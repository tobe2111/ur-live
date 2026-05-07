/**
 * 🛡️ 2026-04-28: 시스템 알림톡 helper.
 *
 * 셀러/에이전시 가입·승인, 새 주문 등 시스템 트리거 시 카카오 알림톡 발송.
 * Aligo senderKey/API key 미설정 시 silent skip — production 영향 0.
 *
 * 사용:
 *   await sendSystemAlimtalk(env, recipient_phone, 'seller_registered',
 *     '[유어딜] 셀러 가입 신청이 접수되었어요. 1~3일 내 검토 후 안내드립니다.')
 *
 * 템플릿 등록 (Aligo 콘솔):
 *   - seller_registered, seller_approved, seller_rejected
 *   - agency_registered, agency_approved
 *   - new_order, gift_received, gift_refunded, settlement_completed
 */

// 🛡️ Bindings 가 다양한 형태(Env / 직접 type) 라 unknown 으로 받고 안전 캐스팅
export async function sendSystemAlimtalk(
  env: unknown,
  phone: string,
  templateCode: string,
  message: string,
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  // 환경변수 미설정 시 silent skip (개발/스테이징 환경 호환)
  const e = env as Record<string, string | undefined>;
  const apiKey = e?.ALIGO_API_KEY;
  const userId = e?.ALIGO_USER_ID;
  const senderKey = e?.ALIGO_SENDER_KEY;
  if (!apiKey || !userId || !senderKey) {
    return { success: false, skipped: true };
  }

  // 전화번호 정규화 (한국 휴대폰)
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (!/^01\d{8,9}$/.test(cleaned)) {
    return { success: false, error: 'invalid phone' };
  }

  try {
    const { sendAlimtalk } = await import('./aligo');
    const result = await sendAlimtalk(
      { ALIGO_API_KEY: apiKey, ALIGO_USER_ID: userId },
      {
        senderKey,
        templateCode,
        to: cleaned,
        message,
      }
    );

    // 🛡️ 2026-05-07: 발송 실패 시 retry queue 에 영구 기록 — cron 이 재시도.
    //   원인: silent fail 시 critical 알림 (정산/주문/선물) 사용자에게 영원히 안 감.
    //   처리: alimtalk_failures 테이블 INSERT → retry-alimtalk cron 이 5분 주기로 retry (최대 3회).
    if (!result.success) {
      const db = (e as Record<string, D1Database | undefined>).DB;
      if (db) {
        try {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS alimtalk_failures (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              phone TEXT NOT NULL, template_code TEXT NOT NULL, message TEXT NOT NULL,
              error TEXT, retry_count INTEGER DEFAULT 0, max_retries INTEGER DEFAULT 3,
              next_retry_at DATETIME DEFAULT (datetime('now', '+5 minutes')),
              resolved INTEGER DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `).run();
          await db.prepare(`
            INSERT INTO alimtalk_failures (phone, template_code, message, error)
            VALUES (?, ?, ?, ?)
          `).bind(cleaned, templateCode, message.slice(0, 1000), result.error?.slice(0, 500) || 'unknown').run();
        } catch { /* 큐 INSERT 실패해도 원본 결과 반환 */ }
      }
    }

    return result;
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
