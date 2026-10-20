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
const PRESERVED_QUERY_PARAMS = ['ref', 'aff', 'invite', 'code', 'auto'] as const
const PRESERVED_VALUE_RE = /^[A-Za-z0-9_-]{1,64}$/
/**
 * 🔑 2026-09-20: 매장 코드 입구(`/store/find?code=` · `/i/join/:code?auto=1`)가 로그인 왕복에서
 *   코드를 잃어 사장님이 코드를 손으로 다시 넣어야 했다(E4 판정에서 발견). `code` 는 **매장 코드
 *   모양(8자, 선택적 하이픈)만** 보존한다 — OAuth 인가 코드(수십 자)는 이 모양이 아니라 통과 못 한다.
 *   `auto` 는 `1` 만. 나머지 키는 종전 규칙 그대로.
 */
const PRESERVED_VALUE_RE_BY_KEY: Partial<Record<(typeof PRESERVED_QUERY_PARAMS)[number], RegExp>> = {
  code: /^(?:[A-Za-z0-9]{8}|[A-Za-z0-9]{4}-[A-Za-z0-9]{4})$/,
  auto: /^1$/,
}

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
      if (v && (PRESERVED_VALUE_RE_BY_KEY[key] ?? PRESERVED_VALUE_RE).test(v)) kept.set(key, v)
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

/**
 * 💳 **결제 콜백 전용 — 경로는 막고, 쿼리는 남긴다.**
 *
 * 🩸 2026-09-13 (대표 신고 *"결제가 안되네"* — 재현 확인): `TossWidgetPayPage` 가 결제 성공
 *   주소를 위의 `safeInternalPath()` 에 통과시키고 있었는데, **그 함수는 쿼리를 통째로 지운다.**
 *   그 삭제는 2026-05-01 에 *카카오 로그인 returnUrl* 의 `?error=...?error=...` 누적을 막으려고
 *   넣은 것이다 — **OAuth 복귀 주소의 규칙**이지 결제 콜백의 규칙이 아니었다.
 *
 *   결제 콜백에서는 쿼리가 장식이 아니라 **데이터**다. 토스는 우리가 준 주소에 `paymentKey`·
 *   `orderId`·`amount` 만 붙여 돌려보내므로, 그 밖의 것(어느 상품인가·몇 개인가·어느 주문인가)은
 *   **우리가 그 주소에 실어 보낸 쿼리로만** 돌아온다. 지워지면 돌아올 방법이 없다.
 *
 *   실제로 세 흐름이 조용히 깨져 있었다 — 에러 로그도, 실패 알림도 없이 마지막 화면만 틀렸다:
 *     · 이용권 카드 결제 `?productId=&qty=`  → productId 0 → "결제 정보가 올바르지 않습니다"
 *     · 숙소 예약      `?order_id=`          → `STAY-{id}` 역산 폴백에 의존
 *     · 알림톡 충전    `?charge=success&orderId=` → 충전 결과 화면이 안 뜸
 *
 * ## 무엇이 같고 무엇이 다른가
 * **오픈 리다이렉트 방어는 한 글자도 안 약해진다** — 경로 판정은 위의 `isSafeInternalPath()`
 * **같은 함수**를 그대로 쓴다(외부 URL·`//`·역슬래시·제어문자·인증 경로 전부 차단). 달라지는 건
 * 검증을 통과한 뒤 **쿼리를 붙여 돌려주는 것** 하나뿐이다.
 *
 * ## 🔒 그래도 쿼리를 그대로 믿지는 않는다
 * ① `#` 이하는 버린다 — 조각(fragment)은 서버 리다이렉트에서 살아남지 못하고, 남겨 두면
 *    "왔겠거니" 하는 코드를 부른다. ② `URLSearchParams` 왕복으로 **재인코딩**한다 — 이상한
 *    바이트가 그대로 주소에 박히지 않게. ③ 길이를 제한한다.
 *
 * ⚠️ **금액·상품의 진실은 여전히 서버다.** 이 쿼리는 화면이 어느 주문을 확인할지 고르는
 *   손잡이일 뿐이고, 실제 청구액은 `/confirm` 이 토스 응답과 서버 계산을 대조해 재검증한다.
 *   그러니 여기서 쿼리를 살려도 **금액을 위조할 수 있는 자리가 생기지 않는다.**
 */
const RETURN_PATH_MAX = 1024

export function safePaymentReturnPath(raw: unknown, fallback: string = '/'): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > RETURN_PATH_MAX) return fallback
  // 제어문자·역슬래시는 쪼개기 전에 통째로 거른다(경로든 쿼리든 들어올 자리가 없다).
  if (raw.includes('\\') || /[\n\t\r\0]/.test(raw)) return fallback

  // 조각(#)은 버리고, 첫 '?' 에서 경로와 쿼리를 가른다.
  const hashIdx = raw.indexOf('#')
  const noHash = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw
  const qIdx = noHash.indexOf('?')
  const rawPath = qIdx >= 0 ? noHash.slice(0, qIdx) : noHash
  const rawQuery = qIdx >= 0 ? noHash.slice(qIdx + 1) : ''

  // 경로 판정은 위의 SSOT 그대로 — 여기서 규칙을 다시 쓰지 않는다(다시 쓰면 언젠가 갈린다).
  let path: string
  try {
    path = decodeURIComponent(rawPath)
  } catch {
    path = rawPath
  }
  if (!isSafeInternalPath(path)) return fallback

  if (!rawQuery) return path
  let query: string
  try {
    query = new URLSearchParams(rawQuery).toString()
  } catch {
    return path   // 쿼리를 못 읽겠으면 경로만 — 이상한 값을 주소에 싣느니 없는 편이 낫다.
  }
  const out = query ? `${path}?${query}` : path
  return out.length > RETURN_PATH_MAX ? path : out
}
