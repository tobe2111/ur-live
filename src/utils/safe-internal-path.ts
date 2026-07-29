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
 * 🧭 2026-07-11 (감사 §R2 어트리뷰션 생존성): query 제거 시에도 보존하는 파라미터 화이트리스트.
 *   ?ref=(인플 추천) · ?aff=(큐레이터 핀) · ?invite=(초대) 가 카카오 로그인 왕복(returnUrl)에서
 *   통째로 제거돼 콜백 후 재캡처 불가였음. 이 셋만 값 검증([A-Za-z0-9_-]{1,64}) 후 재부착 —
 *   나머지 query/hash(에러 누적 ?error=... 등)와 open-redirect 방어는 기존 그대로.
 * ⚠️ worker 측 safeRedirect(kakao.routes.ts)와 동일 화이트리스트 — 양쪽 같이 갱신할 것.
 */
const PRESERVED_QUERY_PARAMS = ['ref', 'aff', 'invite'] as const
const PRESERVED_VALUE_RE = /^[A-Za-z0-9_-]{1,64}$/

/** query(+hash) 부분에서 화이트리스트 파라미터만 추출 — 안전값만, 없으면 '' */
function extractPreservedQuery(rawQueryAndHash: string): string {
  if (!rawQueryAndHash.startsWith('?')) return ''
  const hashIdx = rawQueryAndHash.indexOf('#')
  const queryOnly = hashIdx >= 0 ? rawQueryAndHash.slice(1, hashIdx) : rawQueryAndHash.slice(1)
  try {
    const params = new URLSearchParams(queryOnly)
    const kept = new URLSearchParams()
    for (const key of PRESERVED_QUERY_PARAMS) {
      const v = params.get(key)
      if (v && PRESERVED_VALUE_RE.test(v)) kept.set(key, v)
    }
    const s = kept.toString()
    return s ? `?${s}` : ''
  } catch {
    return ''
  }
}

/**
 * 안전한 내부 path 만 통과시키고, 그 외엔 fallback (기본 '/').
 * URL 디코딩 자동 시도 (실패 시 raw 그대로 검사).
 *
 * 🛡️ 2026-05-01: query / hash 제거 — 사용자 신고된 에러 URL 누적
 *   (?error=...?error=...) 차단. `/user/profile?error=database_error` 같은 path 가
 *   returnUrl 로 들어오면 `/user/profile` 만 추출.
 * 🧭 2026-07-11: 단, ref/aff/invite 화이트리스트 파라미터만 검증 후 보존 (§R2).
 */
export function safeInternalPath(raw: unknown, fallback: string = '/'): string {
  if (typeof raw !== 'string') return fallback
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    decoded = raw
  }
  // query / hash 분리 → pathname + 화이트리스트 query 만 보존
  const queryIdx = decoded.search(/[?#]/)
  let preserved = ''
  if (queryIdx >= 0) {
    preserved = extractPreservedQuery(decoded.slice(queryIdx))
    decoded = decoded.slice(0, queryIdx)
  }
  return isSafeInternalPath(decoded) ? decoded + preserved : fallback
}
