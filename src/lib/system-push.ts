/**
 * 🛡️ 2026-04-28 Phase 2: 시스템 Web Push 실제 발송.
 *
 * push_subscriptions 테이블에서 endpoint 조회 → VAPID JWT (ES256) 서명 →
 * Push Service 에 POST → "tickle" 알림 (empty body) 발송.
 * 410 Gone 응답 시 만료된 구독 자동 삭제.
 *
 * 환경변수: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:contact@)
 * 미설정 시 silent skip (sendPushNotification 가 'transient' 반환 → 구독 유지).
 *
 * agency 는 Web Push 구독 미지원 (DB user_type CHECK: user/seller/admin).
 * dispatcher 가 agency push 호출 시 silent skip.
 */

import { getPushSubscriptions, sendPushNotification, deletePushSubscription } from './push-notification';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;       // 클릭 시 이동
  icon?: string;
  tag?: string;       // 같은 tag 면 중복 알림 X
}

interface PushEnv {
  DB?: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  DATA_ENCRYPTION_KEY?: string;
}

export async function sendSystemPush(
  env: unknown,
  userType: 'user' | 'seller' | 'admin' | 'agency',
  userId: string | number,
  payload: PushPayload,
): Promise<{
  success: boolean;
  skipped?: boolean;
  subscription_count?: number;
  delivered?: number;
  expired?: number;
  error?: string;
}> {
  const e = env as PushEnv;
  const db = e?.DB;
  if (!db) return { success: false, skipped: true };

  // VAPID 키 미설정 → silent skip (구독 유지)
  if (!e.VAPID_PUBLIC_KEY || !e.VAPID_PRIVATE_KEY || !e.VAPID_SUBJECT) {
    return { success: false, skipped: true };
  }

  // agency 는 push_subscriptions CHECK 제약에서 미지원
  if (userType === 'agency') return { success: false, skipped: true };

  try {
    const numId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (!Number.isFinite(numId)) return { success: false, skipped: true };

    const subs = await getPushSubscriptions(db, numId, userType, e.DATA_ENCRYPTION_KEY);
    if (subs.length === 0) return { success: false, skipped: true };

    let delivered = 0;
    let expired = 0;

    for (const sub of subs) {
      const result = await sendPushNotification(
        sub,
        {
          title: payload.title,
          body: payload.body,
          data: payload.url ? { url: payload.url } : undefined,
        },
        e.VAPID_PUBLIC_KEY,
        e.VAPID_PRIVATE_KEY,
        e.VAPID_SUBJECT,
      );
      if (result === 'ok') delivered++;
      else if (result === 'gone') {
        expired++;
        await deletePushSubscription(db, sub.endpoint);
      }
    }

    return {
      success: delivered > 0,
      subscription_count: subs.length,
      delivered,
      expired,
    };
  } catch (err) {
    if ((err as Error).message?.includes('no such table')) {
      return { success: false, skipped: true };
    }
    return { success: false, error: (err as Error).message };
  }
}
