/**
 * 🚪 마이 주소의 `?tool=<셀러 주소>` 를 받아 그 화면을 시트로 연다 (2026-10-12, 셀러 대시보드 제거 3단계).
 *   대시보드 껍데기가 카카오 사장님을 이리로 보낸다 — 판정은 `@/lib/seller-deep-link`.
 *
 * ## 규칙 셋
 * 1. **좌석이 맞을 때만 연다.** 마이를 여는 것만으로 토큰을 새로 발급하지 않는다(`SellerSection` 의 `store` 머리말 —
 *    남의 대시보드 세션을 끊을 수 있다). 좌석이 안 맞으면 **대시보드로 되돌린다**(`dash=1` — 다시 안 온다).
 *    그 화면은 종전처럼 열리므로 사장님 입장에서 잃는 것이 없다.
 * 2. **한 번만 쓴다.** 열고 나면 주소에서 지운다 — 새로고침·뒤로가기가 시트를 또 열지 않게.
 * 4. **라우터에 기대지 않는다.** 주소는 `window.location` 에서 읽고 `history.replaceState` 로 지운다 —
 *    판매 구역은 라우터 밖에서도 렌더되는 부품이라(시험·미리보기) `useLocation` 을 쓰면 거기서 터진다.
 *    지우는 것은 쿼리 한 개뿐이라 라우터가 몰라도 해가 없다(다음 이동에서 라우터가 자기 주소를 쓴다).
 * 3. **판매 구역이 못 뜨면 되돌린다.** 가게 목록 실패·0곳이면 `SellerSection` 자체가 마운트되지 않는다 —
 *    그래서 그 경우는 페이지(`UserProfilePage`)가 `useToolDeepLinkFallback` 으로 받는다. 안 받으면
 *    알림톡 링크를 누른 사장님이 **아무 화면도 없는 마이**에 떨어진다(에러 0).
 */
import { useEffect, useRef } from 'react'
import { TOOL_PARAM, dashboardFallback, readToolParam } from '@/lib/seller-deep-link'

/** 주소에서 `?tool=` 만 지운 경로(다른 쿼리는 남긴다). */
function withoutTool(pathname: string, search: string): string {
  const q = new URLSearchParams(search)
  q.delete(TOOL_PARAM)
  const rest = q.toString()
  return rest ? `${pathname}?${rest}` : pathname
}

/**
 * @param ready  가게가 정해졌다(`store` 가 있고 로딩이 끝났다)
 * @param seated 그 가게에 좌석이 맞다
 * @param open   시트를 연다 — 머리 이름은 비워 넘긴다(시트가 나브 색인에서 찾는다)
 */
export function useToolDeepLink({ ready, seated, open }: {
  ready: boolean
  seated: boolean
  open: (path: string) => void
}) {
  const done = useRef(false)
  useEffect(() => {
    if (done.current || !ready) return
    const { pathname, search } = window.location
    const path = readToolParam(search)
    if (!path) return
    done.current = true
    if (!seated) { window.location.replace(dashboardFallback(path)); return }
    try { window.history.replaceState(window.history.state, '', withoutTool(pathname, search)) } catch { /* 무해 */ }
    open(path)
  }, [ready, seated, open])
}

/** 판매 구역이 아예 못 뜰 때(가게 목록 실패·0곳) — 대시보드로 되돌린다. */
export function useToolDeepLinkFallback({ loading, failed, storeCount }: {
  loading: boolean
  failed: boolean
  storeCount: number
}) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current || loading) return
    if (!failed && storeCount > 0) return
    const path = readToolParam(window.location.search)
    if (!path) return
    fired.current = true
    window.location.replace(dashboardFallback(path))
  }, [loading, failed, storeCount])
}
