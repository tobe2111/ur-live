/**
 * 🔐 2026-11-09 — "이 서명된 토큰은 **로그인 토큰**인가" 의 단일 판정.
 *
 * 같은 JWT_SECRET 으로 서명되지만 로그인이 아닌 토큰이 셋 있었다:
 *   ① 용도 토큰(`purpose` — PIN 확인·카카오 재인증)  ② `token_use: 'refresh'` 클레임이 붙은 재발급 토큰
 *   ③ 2026-11-09 이전에 발급된 재발급 토큰 — 로그인 토큰과 클레임이 같고 **수명만 길다**(관리자 30일 · 셀러 90일).
 * ③ 은 클레임으로는 못 가르므로 수명으로 가른다: 로그인 토큰의 최대 수명(관리자 1일 · 셀러 30일)을 넘으면 로그인이 아니다.
 * (새 재발급 토큰은 다른 키로 서명돼 애초에 서명 확인을 못 통과한다 — `refresh-token-key.ts`.)
 */
import { verify as honoVerify } from 'hono/jwt'

const DAY = 24 * 60 * 60
/** 종류별 로그인 토큰 최대 수명(+여유). 이보다 길면 옛 재발급 토큰이다. */
const MAX_LOGIN_LIFETIME: Record<string, number> = { admin: 2 * DAY, seller: 31 * DAY }

export function isNonLoginToken(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return true
  const p = payload as Record<string, unknown>
  if (p.purpose != null) return true
  if (p.token_use === 'refresh') return true
  const max = typeof p.type === 'string' ? MAX_LOGIN_LIFETIME[p.type] : undefined
  if (max && typeof p.exp === 'number' && typeof p.iat === 'number' && p.exp - p.iat > max) return true
  return false
}

/**
 * `hono/jwt` 의 `verify` 와 같은 모양 — 로그인이 아닌 토큰이면 서명이 맞아도 **던진다**(호출부의 기존 catch 가 "무효 토큰" 으로 처리).
 * Bearer 로그인 토큰을 직접 확인하는 곳은 `import { verify } from 'hono/jwt'` 대신 이것을 쓴다.
 */
export async function verifyLogin(token: string, secret: string, alg: 'HS256' = 'HS256'): Promise<Record<string, unknown>> {
  const payload = (await honoVerify(token, secret, alg)) as Record<string, unknown>
  if (isNonLoginToken(payload)) throw new Error('not a login token')
  return payload
}
