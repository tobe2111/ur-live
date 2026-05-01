/**
 * Safe internal path validator — open-redirect / 자기참조 무한루프 방어.
 *
 * 카카오 OAuth / returnUrl / redirect 핸들링이 LoginPage·RouteGuards·
 * kakao.routes.ts·KakaoCallbackPage 4곳에서 미묘하게 다른 규칙으로 분산
 * → 가장 약한 검증(safeRedirect in kakao.routes.ts)이 자기참조 path 통과시켜
 * 잠재적 OAuth hop 루프 가능. 이 모듈로 단일화.
 *
 * 2026-04-29 도입.
 */

const FORBIDDEN_PREFIXES = [
  '/login',
  '/seller/login',
  '/admin/login',
  '/agency/login',
  '/auth/',
  '/oauth/',
] as const

/**
 * 외부 입력 (returnUrl, state, redirect 파라미터) 이 안전한 내부 path 인지 검증.
 *
 * 차단:
 *  - 빈 값 / 비문자열
 *  - `/` 로 시작하지 않음 (외부 URL · 상대 path)
 *  - `//` 로 시작 (protocol-relative URL → 외부 호스트)
 *  - `\\` 포함 (path traversal)
 *  - 제어문자 (`\n`, `\t`, `\r`, `\0`)
 *  - 인증/콜백 path (자기참조 루프 방지) — `/login`, `/auth/*` 등
 */
export function isSafeInternalPath(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length === 0) return false
  if (!raw.startsWith('/')) return false
  if (raw.startsWith('//')) return false
  if (raw.includes('\\')) return false
  if (/[\n\t\r\0]/.test(raw)) return false
  for (const prefix of FORBIDDEN_PREFIXES) {
    // trailing-slash prefix (`/auth/`, `/oauth/`) → startsWith 만 검사
    // path-segment prefix (`/login`, `/seller/login` 등) → 정확 일치 또는 `?`/`#`/`/` 로 이어지는 경우 차단
    if (prefix.endsWith('/')) {
      if (raw.startsWith(prefix)) return false
    } else {
      if (raw === prefix || raw.startsWith(prefix + '?') || raw.startsWith(prefix + '/') || raw.startsWith(prefix + '#')) {
        return false
      }
    }
  }
  return true
}

/**
 * 안전한 내부 path 만 통과시키고, 그 외엔 fallback (기본 '/').
 * URL 디코딩 자동 시도 (실패 시 raw 그대로 검사).
 *
 * 🛡️ 2026-05-01: query / hash 제거 — 사용자 신고된 에러 URL 누적
 *   (?error=...?error=...) 차단. `/user/profile?error=database_error` 같은 path 가
 *   returnUrl 로 들어오면 `/user/profile` 만 추출.
 */
export function safeInternalPath(raw: unknown, fallback: string = '/'): string {
  if (typeof raw !== 'string') return fallback
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    decoded = raw
  }
  // query / hash 분리 → pathname only
  const queryIdx = decoded.search(/[?#]/)
  if (queryIdx >= 0) decoded = decoded.slice(0, queryIdx)
  return isSafeInternalPath(decoded) ? decoded : fallback
}
