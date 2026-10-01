/**
 * 💬 인스타 자동 DM — "인스타로 로그인해서 연결" (Business Login for Instagram).
 *
 * 사장님·중개사는 토큰을 보지도 만지지도 않는다:
 *   [인스타 연결] → instagram.com 로그인·허용 → 우리 콜백으로 code → 서버가 장기 토큰으로 바꿔 암호화 저장.
 *
 * docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
 *
 * state 는 서버 비밀(JWT_SECRET)로 서명한다 — 누구의(어느 매장의) 연결인지가 여기 실려 있어서,
 * 서명 없이 믿으면 남의 매장에 내 인스타를 붙이거나 그 반대가 된다.
 */

export const IG_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_comments',
  'instagram_business_manage_messages',
] as const

/** 연결 뒤 돌아갈 수 있는 곳 — 이 둘 말고는 받지 않는다(오픈 리다이렉트 차단). */
export const OAUTH_RETURN_PATHS = ['/seller/instagram-dm', '/admin/instagram-autodm'] as const
export type OAuthReturnPath = (typeof OAUTH_RETURN_PATHS)[number]

export function safeReturnPath(p: unknown): OAuthReturnPath {
  return (OAUTH_RETURN_PATHS as readonly string[]).includes(String(p)) ? (p as OAuthReturnPath) : '/seller/instagram-dm'
}

export interface OAuthState {
  /** 'platform' | 'seller:{id}' */
  o: string
  /** 매장 id(공식 계정이면 null) */
  s: number | null
  /** 연결을 누른 사람(유저 id) — 기록용 */
  u: number | null
  r: OAuthReturnPath
  /** 마이에서 시작했나 — 돌아올 때 "마이로 돌아가기" 띠를 붙인다(lib/seller-return 의 from=my) */
  m?: boolean
  /** 만료(ms) */
  e: number
  n: string
}

export const STATE_TTL_MS = 10 * 60 * 1000

const enc = new TextEncoder()
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), ch => ch.charCodeAt(0))

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))))
}

export async function signState(secret: string, s: Omit<OAuthState, 'e' | 'n'>, now = Date.now()): Promise<string> {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(9)))
  const body = b64url(enc.encode(JSON.stringify({ ...s, e: now + STATE_TTL_MS, n: nonce })))
  return `${body}.${await hmac(secret, body)}`
}

export async function verifyState(secret: string, token: string | null | undefined, now = Date.now()): Promise<OAuthState | null> {
  if (!secret || !token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = await hmac(secret, body)
  if (expected.length !== sig.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  if (diff !== 0) return null
  try {
    const st = JSON.parse(new TextDecoder().decode(fromB64url(body))) as OAuthState
    if (typeof st.e !== 'number' || st.e < now) return null
    if (typeof st.o !== 'string' || !/^(platform|seller:\d+)$/.test(st.o)) return null
    return { ...st, r: safeReturnPath(st.r) }
  } catch {
    return null
  }
}

export function authorizeUrl(appId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: IG_SCOPES.join(','),
    state,
    enable_fb_login: '0',
    force_reauth: 'true',
  })
  return `https://www.instagram.com/oauth/authorize?${q.toString()}`
}

export interface ExchangeResult {
  ok: boolean
  access_token?: string
  user_id?: string
  expires_in?: number
  error?: string
}

/** code → 단기 토큰 → 장기 토큰(60일). 둘 중 하나라도 실패하면 이유를 돌려준다(throw 하지 않는다). */
export async function exchangeCode(appId: string, appSecret: string, redirectUri: string, code: string): Promise<ExchangeResult> {
  try {
    const form = new URLSearchParams({
      client_id: appId, client_secret: appSecret, grant_type: 'authorization_code',
      redirect_uri: redirectUri, code: code.replace(/#_$/, ''),
    })
    const r1 = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString(),
    })
    const b1 = (await r1.json().catch(() => ({}))) as Record<string, unknown>
    // 응답이 { data: [ {...} ] } 로 오기도 하고 평평하게 오기도 한다.
    const short = (Array.isArray(b1.data) ? b1.data[0] : b1) as { access_token?: string; user_id?: string | number; error_message?: string }
    if (!r1.ok || !short?.access_token) {
      return { ok: false, error: `코드 교환 실패: ${short?.error_message || (b1.error as { message?: string })?.message || r1.status}`.slice(0, 300) }
    }
    const q = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: appSecret, access_token: short.access_token })
    const r2 = await fetch(`https://graph.instagram.com/access_token?${q.toString()}`)
    const b2 = (await r2.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: { message?: string } }
    if (!r2.ok || !b2.access_token) {
      return { ok: false, error: `장기 토큰 교환 실패: ${b2.error?.message || r2.status}`.slice(0, 300) }
    }
    return { ok: true, access_token: b2.access_token, user_id: short.user_id != null ? String(short.user_id) : undefined, expires_in: b2.expires_in }
  } catch (e) {
    return { ok: false, error: `네트워크 오류: ${(e as Error).message}`.slice(0, 300) }
  }
}

export function expiresAtFrom(expiresIn: number | undefined, now = Date.now()): string | null {
  if (!expiresIn) return null
  return new Date(now + expiresIn * 1000).toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * 메타가 보내는 signed_request(연결 해제·데이터 삭제 요청) 검증.
 * 형식: base64url(서명).base64url(JSON) — 서명 = HMAC-SHA256(앱 시크릿, JSON 부분 그대로).
 * docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */
export async function parseSignedRequest(signedRequest: string | null | undefined, appSecret: string): Promise<{ user_id?: string } | null> {
  if (!signedRequest || !appSecret) return null
  const [sig, body] = signedRequest.split('.')
  if (!sig || !body) return null
  const expected = await hmac(appSecret, body)
  if (expected.length !== sig.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  if (diff !== 0) return null
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as { user_id?: string | number; algorithm?: string }
    if (p.algorithm && p.algorithm.toUpperCase() !== 'HMAC-SHA256') return null
    return { user_id: p.user_id != null ? String(p.user_id) : undefined }
  } catch {
    return null
  }
}
