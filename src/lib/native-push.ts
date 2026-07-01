/**
 * 🔔 2026-07-01: 네이티브 푸시(FCM HTTP v1) — Capacitor 앱(iOS/Android) 대상.
 *
 * 배경: `native_push_tokens` 는 앱(POST /api/push/register)에서 토큰만 저장하고 **읽어서
 *   발송하는 코드가 없어**(write-only dead feature) 앱 사용자는 푸시를 0건 받았음. 이 모듈이
 *   서비스계정 OAuth(firebase.messaging scope)로 FCM v1 messages:send 를 호출해 실제 발송한다.
 *
 * 설계:
 *  - FIREBASE_PROJECT_ID / FIREBASE_PRIVATE_KEY / FIREBASE_CLIENT_EMAIL 미설정 → silent no-op
 *    (웹푸시 VAPID 미설정과 동일 fail-safe).
 *  - 웹푸시(push-notification.ts)와 **완전 독립 경로** — 실패해도 웹푸시에 영향 0.
 *  - FCM 이 UNREGISTERED/NOT_FOUND 로 응답한 토큰만 삭제(다른 4xx 는 보존 — iOS APNs 토큰을
 *    잘못 지우지 않도록 보수적).
 *  - 서비스계정 access token 은 per-isolate 캐시(만료 1분 전까지 재사용).
 *
 * ⚠️ iOS: 앱이 Firebase Messaging(FCM 등록토큰)을 쓰면 그대로 동작. 순수 APNs 토큰만 저장하는
 *    구성이면 FCM v1 이 거부할 수 있음 — 그 경우 앱이 FCM SDK 를 쓰도록 하거나 별도 APNs 발송
 *    필요(코드 레벨 무영향 — no-op 로 안전).
 */

interface FcmEnv {
  DB?: D1Database
  FIREBASE_PROJECT_ID?: string
  FIREBASE_PRIVATE_KEY?: string
  FIREBASE_CLIENT_EMAIL?: string
}

interface NativePushPayload {
  title: string
  body: string
  url?: string
}

// per-isolate access token 캐시
let _fcmToken: { value: string; exp: number } | null = null

function base64Url(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64UrlJson(obj: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(obj)))
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const bin = atob(body)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function getFcmAccessToken(e: FcmEnv): Promise<string | null> {
  if (_fcmToken && Date.now() < _fcmToken.exp - 60000) return _fcmToken.value
  const clientEmail = e.FIREBASE_CLIENT_EMAIL
  const privateKeyRaw = e.FIREBASE_PRIVATE_KEY
  if (!clientEmail || !privateKeyRaw) return null
  try {
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'RS256', typ: 'JWT' }
    const payload = {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }
    const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`
    const der = pemToDer(privateKeyRaw.replace(/\\n/g, '\n'))
    const key = await crypto.subtle.importKey(
      'pkcs8', der as BufferSource,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
    )
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput))
    const jwt = `${signingInput}.${base64Url(new Uint8Array(sig))}`
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    })
    if (!res.ok) {
      if (typeof console !== 'undefined') console.warn('[native-push] token exchange failed:', res.status)
      return null
    }
    const data = await res.json() as { access_token: string; expires_in: number }
    _fcmToken = { value: data.access_token, exp: Date.now() + data.expires_in * 1000 }
    return data.access_token
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('[native-push] token error:', err)
    return null
  }
}

/**
 * 사용자의 네이티브 토큰(들)로 FCM 푸시 발송. 자격/토큰 없으면 skip.
 */
export async function sendNativePush(
  env: unknown,
  userType: 'user' | 'seller' | 'admin' | 'agency',
  userId: string | number,
  payload: NativePushPayload,
): Promise<{ success: boolean; skipped?: boolean; delivered?: number; expired?: number }> {
  const e = env as FcmEnv
  const db = e?.DB
  if (!db) return { success: false, skipped: true }
  if (!e.FIREBASE_PROJECT_ID || !e.FIREBASE_PRIVATE_KEY || !e.FIREBASE_CLIENT_EMAIL) {
    return { success: false, skipped: true }
  }

  let tokens: { token: string }[] = []
  try {
    const { results } = await db.prepare(
      'SELECT token FROM native_push_tokens WHERE user_id = ? AND user_type = ?'
    ).bind(String(userId), userType).all<{ token: string }>()
    tokens = results ?? []
  } catch {
    return { success: false, skipped: true } // 테이블 없음 등
  }
  if (!tokens.length) return { success: false, skipped: true }

  const accessToken = await getFcmAccessToken(e)
  if (!accessToken) return { success: false, skipped: true }

  const url = `https://fcm.googleapis.com/v1/projects/${e.FIREBASE_PROJECT_ID}/messages:send`
  let delivered = 0
  let expired = 0
  for (const t of tokens) {
    try {
      const message: Record<string, unknown> = {
        token: t.token,
        notification: { title: payload.title, body: payload.body },
      }
      if (payload.url) message.data = { url: payload.url }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (res.ok) { delivered++; continue }
      // UNREGISTERED / NOT_FOUND 만 삭제(다른 4xx 는 토큰 보존 — APNs 토큰 오삭제 방지).
      if (res.status === 404) {
        let bodyText = ''
        try { bodyText = await res.text() } catch { /* */ }
        if (/UNREGISTERED|NOT_FOUND/i.test(bodyText)) {
          expired++
          await db.prepare('DELETE FROM native_push_tokens WHERE token = ?').bind(t.token).run().catch(() => {})
        }
      }
    } catch { /* transient — 토큰 보존 */ }
  }
  return { success: delivered > 0, delivered, expired }
}
