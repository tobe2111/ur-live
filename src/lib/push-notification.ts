/**
 * Web Push Notification 시스템
 * 
 * 기능:
 * - 브라우저 푸시 알림
 * - 구독 관리
 * - 알림 발송
 * - Service Worker 연동
 */

interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: any
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

/**
 * VAPID 키 생성 (한 번만 실행, 결과를 환경 변수에 저장)
 * 
 * 터미널에서 실행:
 * npx web-push generate-vapid-keys
 * 
 * 결과를 wrangler.jsonc에 추가:
 * VAPID_PUBLIC_KEY=...
 * VAPID_PRIVATE_KEY=...
 * VAPID_SUBJECT=mailto:admin@ur-team.com
 */

/**
 * 구독 정보 저장
 */
export async function savePushSubscription(
  DB: D1Database,
  userId: number,
  userType: 'user' | 'seller' | 'admin',
  subscription: PushSubscription
): Promise<void> {
  // Use ON CONFLICT instead of INSERT OR REPLACE so that:
  //  1. The row's PRIMARY KEY id is preserved (REPLACE deletes+reinserts, which
  //     invalidates foreign-key references and `is_active` resets).
  //  2. The `is_active` column is NOT silently reset to its default.
  //  3. `created_at` is kept, only `updated_at` bumps.
  await DB.prepare(`
    INSERT INTO push_subscriptions
      (user_id, user_type, endpoint, p256dh, auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id    = excluded.user_id,
      user_type  = excluded.user_type,
      p256dh     = excluded.p256dh,
      auth       = excluded.auth,
      is_active  = 1,
      updated_at = datetime('now')
  `).bind(
    userId,
    userType,
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth
  ).run()

  // Subscription saved
}

/**
 * 구독 정보 조회
 */
export async function getPushSubscriptions(
  DB: D1Database,
  userId: number,
  userType: 'user' | 'seller' | 'admin'
): Promise<PushSubscription[]> {
  const result = await DB.prepare(`
    SELECT endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE user_id = ? AND user_type = ? AND is_active = TRUE
  `).bind(userId, userType).all()

  return (result.results as any[]).map(row => ({
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth
    }
  }))
}

/**
 * 구독 삭제
 */
export async function deletePushSubscription(
  DB: D1Database,
  endpoint: string
): Promise<void> {
  await DB.prepare(`
    DELETE FROM push_subscriptions WHERE endpoint = ?
  `).bind(endpoint).run()

  // Subscription deleted
}

/**
 * 푸시 알림 발송
 * 
 * web-push 라이브러리 사용 (npm install web-push)
 * Cloudflare Workers에서는 fetch API로 직접 구현
 */
/**
 * Result of a push send attempt.
 * - `'ok'`          : delivered (201/200)
 * - `'gone'`        : endpoint is dead (410) → caller must delete the subscription
 * - `'transient'`   : transient failure (network error, 5xx, auth error with
 *                    unimplemented VAPID, …) → caller must NOT delete the
 *                    subscription, to avoid cascading wipes
 */
export type PushSendResult = 'ok' | 'gone' | 'transient'

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushNotificationPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<PushSendResult> {
  try {
    // Web Push Protocol 구현
    // 참고: https://developers.google.com/web/fundamentals/push-notifications/
    //
    // NOTE: VAPID JWT signing is NOT yet implemented — most FCM/Mozilla
    // endpoints will reject the request with 401/403. Do NOT treat that as
    // a dead endpoint; treat it as transient so the subscription survives
    // until VAPID signing lands.

    const payloadString = JSON.stringify(payload)

    // 실제 구현은 web-push 라이브러리 사용 권장
    // 여기서는 개념적 구조만 제시

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400', // 24시간
        // VAPID 인증 헤더 추가 필요
        // 'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`
      },
      body: payloadString
    })

    if (response.status === 201 || response.status === 200) {
      return 'ok'
    } else if (response.status === 410) {
      // 구독 만료 — caller should delete
      return 'gone'
    } else {
      // 401/403 (VAPID 미구현), 4xx/5xx, etc → 일시적 실패로 취급. 구독 유지.
      console.error('[Push] Failed to send notification:', response.status)
      return 'transient'
    }
  } catch (error) {
    console.error('[Push] Send failed:', error)
    return 'transient'
  }
}

/**
 * 사용자에게 푸시 알림 발송
 */
export async function notifyUser(
  DB: D1Database,
  userId: number,
  userType: 'user' | 'seller' | 'admin',
  payload: PushNotificationPayload,
  env: { VAPID_PUBLIC_KEY: string; VAPID_PRIVATE_KEY: string; VAPID_SUBJECT: string }
): Promise<void> {
  const subscriptions = await getPushSubscriptions(DB, userId, userType)

  if (subscriptions.length === 0) {
    return
  }

  for (const subscription of subscriptions) {
    const result = await sendPushNotification(
      subscription,
      payload,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY,
      env.VAPID_SUBJECT
    )

    // Only delete subscriptions confirmed-dead by the push provider (410 Gone).
    // Transient failures (e.g. VAPID-not-yet-implemented, 5xx, network) must
    // keep the subscription so a single bad deploy cannot wipe every user.
    if (result === 'gone') {
      await deletePushSubscription(DB, subscription.endpoint)
    }
  }
}

/**
 * 주문 알림 발송
 */
export async function sendOrderNotification(
  DB: D1Database,
  sellerId: number,
  orderNumber: string,
  totalAmount: number,
  env: any
): Promise<void> {
  await notifyUser(DB, sellerId, 'seller', {
    title: '새 주문이 접수되었습니다!',
    body: `주문번호: ${orderNumber}, 금액: ${totalAmount.toLocaleString()}원`,
    icon: '/static/icon-order.png',
    badge: '/static/badge-order.png',
    data: {
      type: 'order',
      orderNumber: orderNumber
    },
    actions: [
      { action: 'view', title: '주문 보기' },
      { action: 'close', title: '닫기' }
    ]
  }, env)
}

/**
 * 라이브 시작 알림 발송
 */
export async function sendLiveStartNotification(
  DB: D1Database,
  sellerName: string,
  streamTitle: string,
  streamId: number,
  env: any
): Promise<void> {
  // 해당 셀러를 팔로우하는 사용자 조회
  const followers = await DB.prepare(`
    SELECT user_id FROM user_follows
    WHERE seller_id = (SELECT id FROM sellers WHERE business_name = ?)
  `).bind(sellerName).all()

  for (const follower of (followers.results as any[])) {
    await notifyUser(DB, follower.user_id, 'user', {
      title: `${sellerName}님이 라이브 방송을 시작했습니다!`,
      body: streamTitle,
      icon: '/static/icon-live.png',
      badge: '/static/badge-live.png',
      data: {
        type: 'live',
        streamId: streamId
      },
      actions: [
        { action: 'watch', title: '시청하기' },
        { action: 'close', title: '닫기' }
      ]
    }, env)
  }
}

/**
 * 재고 부족 알림 발송
 */
export async function sendLowStockNotification(
  DB: D1Database,
  sellerId: number,
  productName: string,
  currentStock: number,
  env: any
): Promise<void> {
  await notifyUser(DB, sellerId, 'seller', {
    title: '재고 부족 알림',
    body: `${productName}의 재고가 ${currentStock}개 남았습니다.`,
    icon: '/static/icon-stock.png',
    badge: '/static/badge-stock.png',
    data: {
      type: 'stock',
      productName: productName
    },
    actions: [
      { action: 'restock', title: '재고 관리' },
      { action: 'close', title: '닫기' }
    ]
  }, env)
}

/**
 * 정산 완료 알림 발송
 */
export async function sendSettlementNotification(
  DB: D1Database,
  sellerId: number,
  settlementAmount: number,
  period: string,
  env: any
): Promise<void> {
  await notifyUser(DB, sellerId, 'seller', {
    title: '정산이 완료되었습니다',
    body: `${period} 정산금액: ${settlementAmount.toLocaleString()}원`,
    icon: '/static/icon-settlement.png',
    badge: '/static/badge-settlement.png',
    data: {
      type: 'settlement',
      amount: settlementAmount
    },
    actions: [
      { action: 'view', title: '정산 내역 보기' },
      { action: 'close', title: '닫기' }
    ]
  }, env)
}
