/**
 * 🔑 2026-10-01 (대표 신고 — *"로그인이 안된 상태에서 해당 링크를 보고, 로그인을 하면 그 링크로
 *   돌아가야 하는데 메인페이지로 돌아가고 있어"*)
 *
 * ## 무엇이 틀렸나 — **쓰는 사람만 있고 읽는 사람이 없었다**
 *
 * 로그인 벽을 치는 화면들은 돌아갈 곳을 `localStorage.loginReturnUrl` 에 적어 두고 `/login` 으로
 * 보낸다(이용권 상세·상품 상세·교환권 상세·찜·쿠폰 수령·401 인터셉터 등 **10곳 남짓**).
 * 그런데 `LoginPage` 는 그 값을 **한 번도 읽지 않았다** — 쿼리 `?returnUrl=` 과 `sessionStorage`
 * 만 보고 없으면 `'/'` 로 떨어졌다. 그리고 그 `'/'` 가 `/auth/kakao/start?redirect=/` 로 실려 나가
 * 콜백에서 **저장된 값을 이기기까지 했다**(`safeInternalPath(state, stored)` — state 가 우선).
 *
 * ```
 * /pass/2916 → localStorage.loginReturnUrl='/pass/2916' → navigate('/login')   ← 쿼리 없음
 *            → LoginPage: 쿼리✗ 세션✗ → '/'  → ?redirect=/  → 콜백 state='/' 이 이김
 *            → 홈                                              ← 대표가 본 그 증상
 * ```
 *
 * 에러도 로그도 없다. 그래서 화면마다 "로그인하면 돌아온다" 고 믿고 코드를 쓴 세션이 열 번 있었는데
 * **열 번 다 아무 일도 안 했다.**
 *
 * ## 이 파일이 하는 일
 *
 * 복귀 주소를 **한 곳에서** 고른다. 읽는 쪽을 고치면 기존 writer 전부가 한 번에 살아난다 —
 * 화면 열 곳을 각각 고치는 길은 다음에 생길 열한 번째를 못 막는다.
 *
 * 우선순위: **쿼리 `?returnUrl=` → `sessionStorage.returnUrl` → `localStorage.loginReturnUrl` → `/`**
 * (명시적으로 URL 에 실어 보낸 것이 가장 세고, 화면이 몰래 적어 둔 것이 가장 약하다.)
 *
 * ⚠️ 판정은 `safeInternalPath` 가 한다(2026-04-29 SSOT) — 외부 URL·`//`·역슬래시·`/login`·`/auth/*`
 *   자기참조 차단. **이 파일은 그 규칙을 한 글자도 바꾸지 않는다**(고르기만 한다).
 * ⚠️ `safeInternalPath` 는 **쿼리를 버린다**. writer 들이 `window.location.pathname` 만 적어 두므로
 *   오늘은 손해가 없지만, 쿼리까지 돌아가야 하는 화면이 생기면 그 화면이 `?returnUrl=` 로 **명시**해야
 *   한다(결제 콜백이 2026-09-13 에 `safePaymentReturnPath` 로 따로 간 것과 같은 이유).
 */
import { safeInternalPath } from './safe-internal-path'

/** 화면들이 돌아갈 곳을 적어 두는 키 — writer 와 reader 가 같은 문자열을 쓰게 한다. */
export const LOGIN_RETURN_KEY = 'loginReturnUrl'

function readStore(get: () => string | null): string | null {
  try { return get() } catch { return null }
}

/**
 * 로그인 후 돌아갈 내부 경로를 고른다.
 * @param queryValue `searchParams.get('returnUrl')` 값(없으면 null)
 */
export function resolveLoginReturnUrl(queryValue: string | null): string {
  const candidates = [
    queryValue,
    readStore(() => sessionStorage.getItem('returnUrl')),
    readStore(() => localStorage.getItem(LOGIN_RETURN_KEY)),
  ]
  for (const raw of candidates) {
    if (!raw) continue
    const safe = safeInternalPath(raw, '/')
    if (safe !== '/') return safe   // '/' 는 "못 골랐다" 와 구분이 안 되므로 다음 후보로
  }
  return '/'
}

/** 복귀가 끝났으면 지운다 — 안 지우면 다음 로그인이 엉뚱한 옛 주소로 간다. */
export function clearLoginReturnUrl(): void {
  try { localStorage.removeItem(LOGIN_RETURN_KEY) } catch { /* private mode */ }
  try { sessionStorage.removeItem('returnUrl') } catch { /* private mode */ }
}

/**
 * 🧭 **공식: 로그인으로 보낼 때는 돌아올 곳을 같이 보낸다.**
 *
 * 지금 보고 있는 화면으로 돌아오는 로그인 주소를 만든다. 복귀 주소를 **URL 에 명시**하므로
 * `localStorage` 가 막힌 브라우저(사생활 보호 모드)에서도, 다른 탭에서 로그인해도 성립한다.
 *
 * 쓰는 법: `navigate(loginPathFromHere())` — `navigate('/login')` 대신.
 * (전수 가드: `src/tests/unit/login-return-everywhere-2026-10-01.test.ts`)
 *
 * @param from 돌아갈 곳(생략하면 현재 주소). 경로+쿼리를 그대로 넘겨도 된다.
 */
export function loginPathFromHere(from?: string): string {
  let raw = from
  if (!raw) {
    try { raw = window.location.pathname + window.location.search } catch { raw = '/' }
  }
  const safe = safeInternalPath(raw, '/')
  // '/' 로 떨어졌으면(외부 URL·/login 자기참조 등) 복귀를 붙이지 않는다 — 붙이면 홈이 복귀 주소가 되어
  // 저장된 값을 이기는, 바로 그 결함을 다시 만든다.
  return safe === '/' ? '/login' : `/login?returnUrl=${encodeURIComponent(safe)}`
}
