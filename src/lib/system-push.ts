/**
 * 🛡️ 2026-04-28: 시스템 Web Push 발송 helper.
 *
 * push_subscriptions 테이블에서 (user_id, user_type) 의 endpoint 조회 후
 * Web Push 프로토콜로 발송. VAPID 환경변수 미설정 시 silent skip.
 *
 * 환경변수: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:contact@)
 *
 * NOTE: Cloudflare Worker 는 Node.js web-push 라이브러리 미지원.
 * Web Push 발송은 별도 endpoint (/api/push/notify) 또는 Push Service URL 직접 호출 필요.
 * 이 helper 는 *DB 에서 endpoint 조회만* 수행 — 실제 발송은 후속 PR.
 *
 * Phase 1 (현재): subscription 조회 + 로깅
 * Phase 2 (후속): VAPID JWT 생성 + Push Service POST
 */

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;       // 클릭 시 이동
  icon?: string;
  tag?: string;       // 같은 tag 면 중복 알림 X
}

export async function sendSystemPush(
  env: unknown,
  userType: 'user' | 'seller' | 'admin' | 'agency',
  userId: string | number,
  payload: PushPayload,
): Promise<{ success: boolean; skipped?: boolean; subscription_count?: number; error?: string }> {
  const e = env as { DB?: D1Database; VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string };
  const db = e?.DB;
  if (!db) return { success: false, skipped: true };
  if (!e?.VAPID_PUBLIC_KEY || !e?.VAPID_PRIVATE_KEY) {
    return { success: false, skipped: true };
  }

  try {
    const { results } = await db.prepare(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_type = ? AND user_id = ?'
    ).bind(userType, String(userId)).all<PushSubscriptionRow>();

    const subs = results || [];
    if (subs.length === 0) return { success: false, skipped: true };

    // Phase 1: log only (worker 환경에서 web-push 라이브러리 미지원 → 후속)
    if (typeof console !== 'undefined') {
      console.log('[Push] would send to', subs.length, 'subscriptions:', payload.title);
    }

    // TODO Phase 2: VAPID JWT + fetch(endpoint) — 별도 worker (Node 환경) 또는 Cloudflare Queue
    return { success: true, subscription_count: subs.length };
  } catch (err) {
    if ((err as Error).message?.includes('no such table')) {
      return { success: false, skipped: true };
    }
    return { success: false, error: (err as Error).message };
  }
}
