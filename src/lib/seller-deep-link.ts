/**
 * 🚪 **대시보드 주소로 들어온 사장님을 마이로 — 그 화면은 시트로 바로 연다** (2026-10-12, 셀러 대시보드 제거 3단계)
 *   대표: *"셀러 대시보드를 없애는 것을 목표로 하고 마이에서 모두 다 할 수 있게"*
 *
 * ## 왜 필요한가
 * 2026-10-11 에 `/seller` **첫 화면**만 마이로 보냈다(`SellerPage`). 그런데 사장님이 대시보드에 들어오는
 * 길은 대부분 첫 화면이 아니라 **깊은 링크**다 — 알림톡·메일·외부 콜백이 `/seller/orders` 같은 하위 주소를
 * 가리킨다. 그 길로 오면 여전히 사이드바 달린 대시보드가 떴다. 대시보드를 지우려면 그 문부터 마이로 돌려야 한다.
 *
 * ## 무엇을 하나
 * 대시보드 껍데기(`SellerLayout`)가 단독으로 뜨려는 순간, 카카오로 들어온 사장님이면
 * `/user/profile?tool=<원래 주소>` 로 보낸다. 마이의 판매 구역이 그 주소를 시트(`ToolPageSheet`)로 연다.
 * 화면은 **같은 파일**이다(시트가 실제 라우트 표를 렌더한다) — 보이는 내용은 그대로이고 바깥 틀만 마이가 된다.
 *
 * ## 누가 대시보드에 남나 (보내지 않는다)
 * - 에이전시 직원 좌석 — 이메일 로그인이라 마이가 없다(2단계에서 에이전시 콘솔로 옮긴다).
 * - 마이가 없는 옛 셀러 계정(카카오 소비자 계정 없음).
 * - 마이에서 일부러 전체화면으로 보낸 경우(`?from=my` · 세션 표시) — 큰 폼은 시트가 아니라 전체화면이 설계다.
 * - 전체화면 전용 화면(`FULL_SCREEN_ONLY`)과 외부 OAuth 복귀 주소.
 * - `?dash=1` — 마이가 그 화면을 못 열 때(좌석이 안 맞음 · 가게 목록 실패) 되돌려 보내는 표시. **무한 왕복 방지.**
 *
 * ⚠️ 이 파일은 **판정만** 한다. 토큰을 발급하거나 좌석을 바꾸지 않는다.
 */
import { isAgencySeatToken } from '@/shared/agency-seat-token'
import { FROM_MY_PARAM, FROM_MY_VALUE, MY_PATH, shouldOfferMyReturn } from '@/lib/seller-return'

/** 마이가 읽는 쿼리 이름 — 열 화면의 주소. */
export const TOOL_PARAM = 'tool'
/** 마이가 못 열어 대시보드로 되돌릴 때 붙이는 표시. 이게 있으면 다시 보내지 않는다. */
export const DASH_PARAM = 'dash'

/**
 * 시트가 아니라 **마이 첫 화면** 자체가 답인 주소. 대시보드 홈·더보기는 마이의 판매 구역·'전체 도구'가 같은 일을 한다.
 * (`/seller/more` 를 시트로 열면 '전체 도구' 시트와 같은 목록이 두 벌 뜬다.)
 */
const HOME_LIKE = new Set(['/seller', '/seller/dashboard', '/seller/more'])

/**
 * 대시보드에 그대로 둔다 — 시트로 열면 안 되는 주소.
 * - `/seller/scan` · `/seller/meal-voucher/new`: 마이에 **전용 길**이 이미 있다(`tool-pages.ts` `FULL_SCREEN_ONLY` 와 같은 둘).
 * - `/seller/youtube/callback`: 외부 OAuth 복귀 — 쿼리(code·state)를 그 화면이 직접 읽어야 한다.
 */
export const STAY_ON_DASHBOARD = new Set(['/seller/scan', '/seller/meal-voucher/new', '/seller/youtube/callback'])

/** 카카오로 들어온 사장님인가(= 마이가 있고, 에이전시 좌석이 아니다). 시트 안이면 언제나 false. */
export function shouldSendOwnerToMy(embedded: boolean): boolean {
  if (embedded) return false
  try {
    if (!localStorage.getItem('user_id')) return false
    if (isAgencySeatToken(localStorage.getItem('seller_token'))) return false
    return true
  } catch { return false }
}

/**
 * 이 대시보드 주소로 왔을 때 어디로 보낼까. 보내지 않으면 `null`.
 * @param pathname 지금 주소의 경로
 * @param search   지금 주소의 쿼리(`?…` 포함 가능)
 */
export function myRedirectFor(pathname: string, search: string): string | null {
  if (!pathname.startsWith('/seller')) return null
  const q = new URLSearchParams(search)
  if (q.get(DASH_PARAM) === '1') return null
  if (q.get(FROM_MY_PARAM) === FROM_MY_VALUE || shouldOfferMyReturn()) return null
  if (STAY_ON_DASHBOARD.has(pathname)) return null
  if (HOME_LIKE.has(pathname)) return MY_PATH
  const target = pathname + (search && search !== '?' ? (search.startsWith('?') ? search : `?${search}`) : '')
  return `${MY_PATH}?${TOOL_PARAM}=${encodeURIComponent(target)}`
}

/**
 * 마이 주소의 `?tool=` 을 읽는다. 셀러 화면 주소가 아니면 `null` — **외부 주소·`//`·역슬래시는 버린다**
 * (이 값은 시트의 메모리 라우터로만 가지만, 실패 시 대시보드로 되돌릴 때 `location` 에 들어가므로 열린 리다이렉트를 막는다).
 */
export function readToolParam(search: string): string | null {
  const raw = new URLSearchParams(search).get(TOOL_PARAM)
  if (!raw) return null
  if (!raw.startsWith('/seller/') || raw.startsWith('//') || raw.includes('\\')) return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(raw)) return null
  return raw
}

/** 마이가 그 화면을 못 열었다 — 대시보드로 되돌리는 주소(다시 오지 않게 `dash=1`). */
export function dashboardFallback(toolPath: string): string {
  const [base, hash] = toolPath.split('#')
  const sep = base.includes('?') ? '&' : '?'
  const marked = `${base}${sep}${DASH_PARAM}=1`
  return hash ? `${marked}#${hash}` : marked
}
