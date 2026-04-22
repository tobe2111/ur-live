/**
 * Web Push Notification 시스템
 *
 * 기능:
 * - 브라우저 푸시 알림
 * - 구독 관리
 * - 알림 발송
 * - Service Worker 연동
 *
 * 🛡️ 2026-04-22: p256dh / auth 는 DB 저장 시 encryptAtRest (AES-GCM).
 *    DATA_ENCRYPTION_KEY env 미설정 시 legacy plaintext 호환.
 */

import { encryptAtRest, decryptAtRest } from '../worker/utils/data-crypto'

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
  subscription: PushSubscription,
  kek?: string,
): Promise<void> {
  // Use ON CONFLICT instead of INSERT OR REPLACE so that:
  //  1. The row's PRIMARY KEY id is preserved (REPLACE deletes+reinserts, which
  //     invalidates foreign-key references and `is_active` resets).
  //  2. The `is_active` column is NOT silently reset to its default.
  //  3. `created_at` is kept, only `updated_at` bumps.
  const encP256dh = await encryptAtRest(subscription.keys.p256dh, kek)
  const encAuth = await encryptAtRest(subscription.keys.auth, kek)
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
    encP256dh,
    encAuth
  ).run()

  // Subscription saved
}

/**
 * 구독 정보 조회
 */
export async function getPushSubscriptions(
  DB: D1Database,
  userId: number,
  userType: 'user' | 'seller' | 'admin',
  kek?: string,
): Promise<PushSubscription[]> {
  const result = await DB.prepare(`
    SELECT endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE user_id = ? AND user_type = ? AND is_active = TRUE
  `).bind(userId, userType).all()

  const subs: PushSubscription[] = []
  for (const row of result.results as any[]) {
    try {
      subs.push({
        endpoint: row.endpoint,
        keys: {
          p256dh: await decryptAtRest(row.p256dh, kek),
          auth: await decryptAtRest(row.auth, kek),
        },
      })
    } catch {
      // 복호화 실패 (KEK rotation 실수 등) — 해당 구독만 건너뜀
    }
  }
  return subs
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

// ──────────────────────────────────────────────────────────────────────────
// VAPID JWT signing (ES256 / P-256 ECDSA)
//   Workers runtime supports WebCrypto, so we can sign without a library.
//   Private key is expected as base64url (32-byte raw d scalar) — the format
//   produced by `npx web-push generate-vapid-keys` after stripping PEM.
// ──────────────────────────────────────────────────────────────────────────

function base64UrlEncode(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input)
  } else if (input instanceof Uint8Array) {
    bytes = input
  } else {
    bytes = new Uint8Array(input)
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/**
 * Build a VAPID Authorization header value (vapid scheme, RFC 8292).
 * @param audience   Origin of the push endpoint (e.g. "https://fcm.googleapis.com")
 * @param vapidPrivateKey  base64url-encoded P-256 private key (raw 32-byte d scalar)
 * @param vapidPublicKey   base64url-encoded P-256 public key (uncompressed 65 bytes)
 * @param subject    "mailto:..." or "https://..." per RFC 8292
 */
async function buildVapidAuthHeader(
  audience: string,
  vapidPrivateKey: string,
  vapidPublicKey: string,
  subject: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = {
    aud: audience,
    exp: now + 12 * 3600, // 12 hours (RFC 8292 recommends ≤ 24h)
    sub: subject,
  }
  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const signInput = `${headerB64}.${payloadB64}`

  // Import raw P-256 private key as a JWK (WebCrypto can't import raw 32-byte d directly)
  // We derive the JWK (d, x, y) from the provided private+public keys.
  const d = vapidPrivateKey
  const pub = base64UrlDecode(vapidPublicKey)
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error('VAPID public key must be uncompressed P-256 (65 bytes, 0x04-prefix)')
  }
  const x = base64UrlEncode(pub.slice(1, 33))
  const y = base64UrlEncode(pub.slice(33, 65))

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d, x, y, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signInput)
  )
  const sigB64 = base64UrlEncode(new Uint8Array(signature))

  // RFC 8292: `vapid t=<jwt>, k=<public key>`
  return `vapid t=${signInput}.${sigB64}, k=${vapidPublicKey}`
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushNotificationPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<PushSendResult> {
  // `payload` is unused because RFC 8291 aes128gcm encryption is not yet
  // implemented — we only send the auth tickle. Kept in the signature so
  // callers don't have to change when encryption lands.
  void payload;
  try {
    // VAPID is required by FCM/Mozilla push endpoints. Without correctly
    // signed creds the push provider returns 401/403 — treat that as transient
    // so we don't wipe subscriptions on a bad deploy.
    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      if (typeof console !== 'undefined') {
        console.warn('[Push] VAPID keys missing — skipping send (subscription preserved)')
      }
      return 'transient'
    }

    let audience: string
    try {
      audience = new URL(subscription.endpoint).origin
    } catch {
      return 'transient'
    }

    let authHeader: string
    try {
      authHeader = await buildVapidAuthHeader(
        audience,
        vapidPrivateKey,
        vapidPublicKey,
        vapidSubject.startsWith('mailto:') || vapidSubject.startsWith('https:')
          ? vapidSubject
          : `mailto:${vapidSubject}`
      )
    } catch (signErr) {
      console.error('[Push] VAPID signing failed:', signErr)
      return 'transient'
    }

    // NOTE: Payload encryption (aes128gcm per RFC 8291) is NOT implemented
    // here. For a richer payload pipeline, prefer a mature library. We send
    // an empty body so providers still deliver a "tickle" notification.
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'TTL': '86400', // 24시간
      },
      body: null,
    })

    if (response.status === 201 || response.status === 200 || response.status === 202) {
      return 'ok'
    } else if (response.status === 410 || response.status === 404) {
      // 구독 만료/삭제 — caller should delete
      return 'gone'
    } else {
      // 401/403 (auth issue), 4xx/5xx → 일시적 실패로 취급. 구독 유지.
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
  env: { VAPID_PUBLIC_KEY: string; VAPID_PRIVATE_KEY: string; VAPID_SUBJECT: string; DATA_ENCRYPTION_KEY?: string }
): Promise<void> {
  const subscriptions = await getPushSubscriptions(DB, userId, userType, env.DATA_ENCRYPTION_KEY)

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
