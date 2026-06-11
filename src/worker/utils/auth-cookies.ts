/**
 * 🔐 2026-06-11 SSR Phase 2 (docs/SSR_PHASE2_AUTH.md §3): 인증 토큰 httpOnly 쿠키 dual-write 헬퍼.
 *   - 쿠키 값 = 기존 JWT 그대로 (새 토큰 포맷 발명 금지 — 검증 경로 단일 유지)
 *   - Domain=.ur-team.com 은 호스트가 ur-team.com 계열일 때만 (pages.dev 등에선 host-only 쿠키)
 *   - 읽기(GET/HEAD) 전용 검증과 짝 — 쓰기는 계속 Bearer 전용 (CSRF 표면 0)
 */

const THIRTY_DAYS = 30 * 24 * 3600

function domainAttr(host: string | null | undefined): string {
  return host && (host === 'ur-team.com' || host.endsWith('.ur-team.com')) ? '; Domain=.ur-team.com' : ''
}

/** 로그인 응답용 Set-Cookie 값 (기존 응답 바디/localStorage 흐름 불변 — 추가 발급만). */
export function authTokenSetCookie(name: 'ud_seller_token' | 'ud_agency_token', jwt: string, host: string | null | undefined, maxAgeSec: number = THIRTY_DAYS): string {
  return `${name}=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${domainAttr(host)}`
}

/** 로그아웃용 즉시 만료 쿠키. */
export function authTokenClearCookie(name: 'ud_seller_token' | 'ud_agency_token', host: string | null | undefined): string {
  return `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0${domainAttr(host)}`
}

/** Cookie 헤더에서 ud_* 토큰 추출 (미들웨어 3순위 fallback 용). */
export function readAuthTokenCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null
  const m = cookieHeader.match(/(?:^|;\s*)ud_(?:seller|agency)_token=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}
