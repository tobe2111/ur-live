/**
 * 🔐 OAuth state 서명·검증 — 카카오·구글 로그인이 같은 한 벌을 쓴다 (2026-11-18 구글 로그인 추가 때 카카오에서 꺼냈다).
 *
 * 왜 서명하나(2026-06-20 카카오 사고): iOS Safari/WebKit 이 OAuth 왕복에서 state 쿠키를 콜백에 안 돌려주는
 *   경우가 있다. state 파라미터 자체를 JWT_SECRET 으로 서명해 redirect·nonce·만료를 담으면 쿠키가 없어도
 *   서명 검증으로 CSRF 를 막고 복귀 주소를 되찾는다. 서명(HS256)이라 JWT_SECRET 없이 위조할 수 없다.
 *
 * 용도(purpose) 클레임 `p` 로 서로 섞이지 않게 한다 — 카카오 state 를 구글 콜백에 넣어도 통과하지 않는다.
 * ⚠️ 로그인 토큰이 아니다 — 이 파일의 verify 는 OAuth state 만 확인한다(로그인 토큰 확인은 verifyLogin).
 */
import { sign as jwtSign, verify as jwtVerify } from 'hono/jwt'

/** purpose 와 클레임을 담은 서명 state. 기본 30분 만료. */
export async function signPurposeState(
  purpose: string,
  claims: Record<string, string>,
  secret: string,
  ttlSec = 1800,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return jwtSign({ p: purpose, ...claims, iat: now, exp: now + ttlSec }, secret)
}

/** 서명·만료·purpose 가 맞으면 페이로드, 아니면 null. JWT 모양(점 2개)이 아니면 검증하지 않는다(레거시 opaque state). */
export async function verifyPurposeState(
  token: string | null | undefined,
  purpose: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  if (!token || !secret) return null
  if (token.split('.').length !== 3) return null
  try {
    const payload = await jwtVerify(token, secret, 'HS256') as Record<string, unknown>
    if (!payload || payload.p !== purpose) return null
    return payload
  } catch {
    return null // 만료·서명 불일치 — hono/jwt verify 가 throw
  }
}
