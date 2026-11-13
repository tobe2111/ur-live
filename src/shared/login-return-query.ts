/**
 * 🧭 로그인 왕복에서 **살려 보내는 주소 꼬리(query)** — 프론트(`utils/safe-internal-path.ts`)와
 *    워커(`features/auth/api/kakao.routes.ts safeRedirect`)가 **이 파일 하나**를 쓴다 (2026-11-13 대표 *"영구적으로 해결해"*).
 *
 * ## 왜 한 파일인가
 * 두 곳이 같은 화이트리스트를 "양쪽 같이 갱신할 것" 주석으로만 묶어 각자 들고 있었다. 한쪽만 고치면 **이메일 로그인은 되고
 * 카카오 로그인만 값을 잃는다** — 에러가 없어 아무도 신고하지 않는다. 실제로 2026-09-20(매장 코드)과 2026-11-13(구매 수량)
 * 두 번 같은 일을 겪었다. 워커가 `@/` 를 못 쓴다는 이유로 복사했는데, 상대 경로 import 는 된다.
 * ⚠️ 이 파일은 아무것도 import 하지 않는다(워커·프론트 양쪽 번들에 그대로 들어간다).
 *
 * ## 규칙
 * - 나머지 query/hash(예: 누적되던 `?error=...`)는 버린다 — 주소 꼬리는 기본적으로 지운다.
 * - 아래 키만, 아래 값 모양일 때만 남긴다.
 *   - `ref`·`aff`·`invite`: 소개·초대(2026-07-11) — `[A-Za-z0-9_-]{1,64}`
 *   - `code`: 매장 코드 8자(선택적 하이픈) — OAuth 인가 코드(수십 자)는 통과 못 한다(2026-09-20) · `auto`: `1`
 *   - `via`: `login` · `qty`: 1~100 — 이용권 구매 중 로그인 → 돌아오면 그 수량으로 구매 창(2026-11-13).
 *     `qty` 는 `via=login` 과 **함께일 때만** — 결제 결과 주소(`?productId=&qty=`)의 qty 는 종전대로 버린다.
 */
/** 로그인 뒤 돌아갈 곳으로 **못** 쓰는 경로 — 자기참조 OAuth 왕복 루프 방지(2026-04-29). */
export const FORBIDDEN_RETURN_PREFIXES = ['/login', '/seller/login', '/admin/login', '/agency/login', '/auth/', '/oauth/'] as const

/**
 * 안전한 내부 경로인가 — `/` 로 시작 · `//`(다른 도메인) 아님 · `\` 없음 · 제어문자 없음 · 로그인/OAuth 경로 아님.
 * 프론트 `isSafeInternalPath` 와 워커 `safeRedirect` 가 이 함수 하나를 쓴다.
 */
export function isSafeInternalPathname(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length === 0) return false
  if (!raw.startsWith('/')) return false
  if (raw.startsWith('//')) return false
  if (raw.includes('\\')) return false
  if (/[\n\t\r\0]/.test(raw)) return false
  for (const prefix of FORBIDDEN_RETURN_PREFIXES) {
    if (prefix.endsWith('/')) {
      if (raw.startsWith(prefix)) return false
    } else if (raw === prefix || raw.startsWith(prefix + '?') || raw.startsWith(prefix + '/') || raw.startsWith(prefix + '#')) {
      return false
    }
  }
  return true
}

export const PRESERVED_QUERY_PARAMS = ['ref', 'aff', 'invite', 'code', 'auto', 'via', 'qty'] as const
export type PreservedQueryKey = (typeof PRESERVED_QUERY_PARAMS)[number]

const DEFAULT_VALUE_RE = /^[A-Za-z0-9_-]{1,64}$/
export const PRESERVED_VALUE_RE_BY_KEY: Partial<Record<PreservedQueryKey, RegExp>> = {
  code: /^(?:[A-Za-z0-9]{8}|[A-Za-z0-9]{4}-[A-Za-z0-9]{4})$/,
  auto: /^1$/,
  via: /^login$/,
  qty: /^(?:[1-9]\d?|100)$/,
}

/** query(+hash) 부분에서 화이트리스트 파라미터만 추출 — 안전값만, 없으면 ''. */
export function extractPreservedQuery(rawQueryAndHash: string): string {
  if (!rawQueryAndHash.startsWith('?')) return ''
  const hashIdx = rawQueryAndHash.indexOf('#')
  const queryOnly = hashIdx >= 0 ? rawQueryAndHash.slice(1, hashIdx) : rawQueryAndHash.slice(1)
  try {
    const params = new URLSearchParams(queryOnly)
    const kept = new URLSearchParams()
    for (const key of PRESERVED_QUERY_PARAMS) {
      const v = params.get(key)
      if (key === 'qty' && params.get('via') !== 'login') continue
      if (v && (PRESERVED_VALUE_RE_BY_KEY[key] ?? DEFAULT_VALUE_RE).test(v)) kept.set(key, v)
    }
    const s = kept.toString()
    return s ? `?${s}` : ''
  } catch {
    return ''
  }
}
