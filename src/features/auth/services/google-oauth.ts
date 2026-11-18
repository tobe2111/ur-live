/**
 * 🌏 구글 로그인(외국인 손님 전용) — 토큰 교환 · id_token 클레임 확인 · 계정 찾기/만들기 (2026-11-18 대표 지시).
 *
 * 화면 쪽 조건(기기 언어가 한국어가 아닐 때만 버튼)은 `pages/login/GoogleLoginButton.tsx`, 라우트는
 * `features/auth/api/google.routes.ts`. 이 파일은 순수 로직이라 단위 시험이 실제 함수를 부른다.
 *
 * 🔒 Firebase 와 무관하다 — 2026-07-28 에 닫은 문(`check-no-firebase-auth.mjs`)은 *브라우저가 낸 Firebase ID 토큰을
 *   받아 계정을 발급하던* 경로였다. 여기는 서버가 구글 토큰 엔드포인트에서 code 를 직접 바꾼다(브라우저가 토큰을
 *   내밀 길이 없다). id_token 은 그 TLS 응답에서 직접 받으므로 OIDC Core §3.1.3.7 에 따라 서명 대신 클레임을 본다.
 *
 * 🧱 계정 연결 규칙(카카오 `EMAIL_ALREADY_LINKED_TO_OTHER_METHOD` 와 같은 원칙): 같은 이메일의 회원이 이미 있으면
 *   **자동으로 잇지 않는다** — 남의 카카오 계정을 구글 계정 하나로 가져가는 길이 된다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { generateUniqueHandle } from '../../../worker/utils/handle-generator'

export const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'] as const

/** 두 값이 모두 있어야 켜진다 — 하나라도 없으면 버튼도 라우트도 없다. */
export function isGoogleLoginConfigured(env: { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string }): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID.trim() && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CLIENT_SECRET.trim())
}

export interface GoogleClaims {
  sub: string
  email: string
  name: string
  picture: string | null
}

/** JWT 페이로드(가운데 조각)만 읽는다. 모양이 틀리면 null. */
export function decodeJwtPayload(token: unknown): Record<string, unknown> | null {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')
    const bin = atob(padded)
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
    const obj = JSON.parse(new TextDecoder().decode(bytes))
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj as Record<string, unknown> : null
  } catch {
    return null
  }
}

/**
 * id_token 클레임 확인 — aud(우리 클라이언트) · iss(구글) · exp(미래) · email_verified(참) · sub·email 존재.
 * 하나라도 어긋나면 null. `nowSec` 는 시험용.
 */
export function validateGoogleIdTokenClaims(
  payload: Record<string, unknown> | null,
  clientId: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): GoogleClaims | null {
  if (!payload || !clientId) return null
  const aud = payload.aud
  const audOk = Array.isArray(aud) ? aud.includes(clientId) : aud === clientId
  if (!audOk) return null
  if (typeof payload.iss !== 'string' || !(GOOGLE_ISSUERS as readonly string[]).includes(payload.iss)) return null
  const exp = typeof payload.exp === 'number' ? payload.exp : Number(payload.exp)
  if (!Number.isFinite(exp) || exp <= nowSec) return null
  // 구글은 boolean 을 주지만 옛 문서엔 "true" 문자열 예시가 있다 — 둘 다 참으로, 그 밖은 거짓.
  if (!(payload.email_verified === true || payload.email_verified === 'true')) return null
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : ''
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  if (!sub || sub.length > 255 || !email || email.length > 320 || !email.includes('@')) return null
  const rawName = typeof payload.name === 'string' ? payload.name.trim() : ''
  const name = (rawName || email.split('@')[0]).slice(0, 50)
  const picture = typeof payload.picture === 'string' && /^https:\/\//.test(payload.picture) ? payload.picture.slice(0, 1000) : null
  return { sub, email, name, picture }
}

/** 서버 → 구글 토큰 엔드포인트. 클라이언트 시크릿은 여기서만 쓴다. 실패는 throw(메시지에 시크릿·원문 없음). */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
  env: { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ id_token?: string }> {
  const res = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: env.GOOGLE_CLIENT_ID || '',
      client_secret: env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirectUri,
    }).toString(),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`google_token_exchange_${res.status}`)
  return await res.json() as { id_token?: string }
}

// ── 신원 표(users 에 컬럼을 더하지 않는다 — 공급자별 신원은 곁표) ──────────────────────
const _identitiesReady = new WeakSet<object>()
export async function ensureUserIdentities(DB: D1Database): Promise<void> {
  if (_identitiesReady.has(DB)) return
  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS user_identities (
      provider TEXT NOT NULL,
      subject TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      email TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (provider, subject)
    )`,
  ).run()
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities(user_id)').run()
  _identitiesReady.add(DB)
}

export interface GoogleLoginUser {
  id: number
  name: string
  email: string | null
  profile_image: string | null
}

export type GoogleUserResult =
  | { kind: 'existing'; user: GoogleLoginUser }
  | { kind: 'created'; user: GoogleLoginUser }
  /** 같은 이메일의 회원이 이미 있다 — 잇지 않는다. via = 그 회원이 쓰는 방법. */
  | { kind: 'email_in_use'; via: 'kakao' | 'other' }

type UserRow = { id: number; name: string | null; email: string | null; profile_image: string | null; kakao_id: string | null }

function toLoginUser(r: UserRow): GoogleLoginUser {
  return { id: r.id, name: r.name || '', email: r.email, profile_image: r.profile_image }
}

/** 탈퇴 처리된 행(이메일이 익명화됨) — 그 신원으로는 다시 들어가지 않는다. */
function isDeletedRow(r: UserRow): boolean {
  return (r.email || '').endsWith('@deleted.invalid') || (r.kakao_id || '').startsWith('deleted_')
}

/** 순서: (google, sub) 신원 → 회원 · 없으면 같은 이메일 회원 확인(있으면 잇지 않음) · 없으면 새 회원 + 신원. */
export async function findOrCreateGoogleUser(DB: D1Database, claims: GoogleClaims): Promise<GoogleUserResult> {
  await ensureUserIdentities(DB)

  const ident = await DB.prepare('SELECT user_id FROM user_identities WHERE provider = ? AND subject = ?')
    .bind('google', claims.sub).first<{ user_id: number }>()
  if (ident) {
    const row = await DB.prepare('SELECT id, name, email, profile_image, kakao_id FROM users WHERE id = ?')
      .bind(ident.user_id).first<UserRow>()
    if (row && !isDeletedRow(row)) {
      await DB.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).bind(row.id).run().catch(() => null)
      return { kind: 'existing', user: toLoginUser(row) }
    }
    // 회원이 사라졌거나 탈퇴했다 — 낡은 신원을 걷고 새로 가입하게 한다.
    await DB.prepare('DELETE FROM user_identities WHERE provider = ? AND subject = ?').bind('google', claims.sub).run()
  }

  const owner = await DB.prepare(
    'SELECT id, name, email, profile_image, kakao_id FROM users WHERE LOWER(email) = ? AND email IS NOT NULL LIMIT 1',
  ).bind(claims.email).first<UserRow>()
  if (owner && !isDeletedRow(owner)) {
    return { kind: 'email_in_use', via: owner.kakao_id ? 'kakao' : 'other' }
  }

  const ins = await DB.prepare(
    `INSERT INTO users (name, email, profile_image, created_at, last_login_at, updated_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now')) RETURNING id`,
  ).bind(claims.name, claims.email, claims.picture).first<{ id: number }>()
  if (!ins?.id) throw new Error('google_user_insert_failed')
  const userId = Number(ins.id)

  // 멱등 — 같은 sub 가 동시에 두 번 들어와도 신원은 한 줄. 진 쪽은 먼저 들어간 회원으로 로그인한다.
  const link = await DB.prepare(
    `INSERT OR IGNORE INTO user_identities (provider, subject, user_id, email, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
  ).bind('google', claims.sub, userId, claims.email).run()
  if (!link.meta?.changes) {
    const winner = await DB.prepare('SELECT user_id FROM user_identities WHERE provider = ? AND subject = ?')
      .bind('google', claims.sub).first<{ user_id: number }>()
    const row = winner ? await DB.prepare('SELECT id, name, email, profile_image, kakao_id FROM users WHERE id = ?')
      .bind(winner.user_id).first<UserRow>() : null
    if (row) {
      // 방금 이 요청이 만든 빈 행(아무 데이터도 없다)만 걷는다 — 같은 이메일 행이 둘 남지 않게.
      await DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run().catch(() => null)
      return { kind: 'existing', user: toLoginUser(row) }
    }
  }

  // 부가 작업은 실패해도 로그인을 막지 않는다(카카오 신규 경로와 같다).
  try { await DB.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').bind(userId).run() } catch { /* 컬럼 없음 */ }
  try {
    const handle = await generateUniqueHandle(DB, claims.name, undefined, userId)
    await DB.prepare(`UPDATE users SET handle = ? WHERE id = ? AND (handle IS NULL OR handle = '')`).bind(handle, userId).run()
  } catch { /* lazy backfill 이 채운다 */ }

  return { kind: 'created', user: { id: userId, name: claims.name, email: claims.email, profile_image: claims.picture } }
}
