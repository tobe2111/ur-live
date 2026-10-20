/**
 * 🚪 마이 주소의 `?tool=<셀러 주소>` 를 받아 그 화면을 시트로 연다 (2026-10-12, 셀러 대시보드 제거).
 *   `/seller/*` 주소(알림톡·메일·옛 북마크)로 온 사장님을 이리로 보낸다 — 판정은 `@/lib/seller-deep-link`.
 *
 * ## 규칙 셋
 * 1. **좌석이 맞을 때만 연다.** 마이를 여는 것만으로 토큰을 새로 발급하지 않는다(`SellerSection` 의 `store` 머리말 —
 *    남의 좌석 세션을 끊을 수 있다). 좌석이 안 맞으면 주소에서 지우고 **가게를 고르라고 말한다** — 2026-10-12 까지는
 *    대시보드로 되돌렸는데(`dash=1`) 대시보드는 지웠다. 판매 구역에서 가게를 고른 뒤 같은 도구를 열면 된다.
 * 2. **한 번만 쓴다.** 열고 나면 주소에서 지운다 — 새로고침·뒤로가기가 시트를 또 열지 않게.
 * 4. **라우터에 기대지 않는다.** 주소는 `window.location` 에서 읽고 `history.replaceState` 로 지운다 —
 *    판매 구역은 라우터 밖에서도 렌더되는 부품이라(시험·미리보기) `useLocation` 을 쓰면 거기서 터진다.
 *    지우는 것은 쿼리 한 개뿐이라 라우터가 몰라도 해가 없다(다음 이동에서 라우터가 자기 주소를 쓴다).
 * 3. **판매 구역이 못 뜨면 말한다.** 가게 목록 실패·0곳이면 `SellerSection` 자체가 마운트되지 않는다 —
 *    그래서 그 경우는 페이지(`UserProfilePage`)가 `useToolDeepLinkFallback` 으로 받는다. 안 받으면
 *    알림톡 링크를 누른 사장님이 **아무 말 없는 마이**에 떨어진다(에러 0).
 */
import { useEffect, useRef } from 'react'
import { TOOL_PARAM, ownPathFor, readToolParam, type OwnPath } from '@/lib/seller-deep-link'
import { toast } from '@/hooks/useToast'

/** 주소에서 `?tool=` 만 지운 경로(다른 쿼리는 남긴다). */
function withoutTool(pathname: string, search: string): string {
  const q = new URLSearchParams(search)
  q.delete(TOOL_PARAM)
  const rest = q.toString()
  return rest ? `${pathname}?${rest}` : pathname
}

/** `?tool=` 을 지운다 — 새로고침·뒤로가기가 같은 일을 또 하지 않게. */
function dropTool(): void {
  try {
    const { pathname, search } = window.location
    window.history.replaceState(window.history.state, '', withoutTool(pathname, search))
  } catch { /* 무해 */ }
}

/**
 * @param ready  가게가 정해졌다(`store` 가 있고 로딩이 끝났다)
 * @param seated 그 가게에 좌석이 맞다
 * @param open   시트를 연다 — 머리 이름은 비워 넘긴다(시트가 나브 색인에서 찾는다).
 *               `own` 은 그 주소의 전용 길(`OWN_PATH` — 이용권 등록이면 `VoucherNewSheet`)이다(2026-10-12).
 */
export function useToolDeepLink({ ready, seated, open }: {
  ready: boolean
  seated: boolean
  open: (path: string, own: OwnPath | null) => void
}) {
  const done = useRef(false)
  useEffect(() => {
    if (done.current || !ready) return
    const path = readToolParam(window.location.search)
    if (!path) return
    done.current = true
    dropTool()
    if (!seated) { toast.error('알림 속 화면을 열 가게가 선택돼 있지 않아요. 가게를 고른 뒤 다시 열어 주세요.'); return }
    open(path, ownPathFor(path))
  }, [ready, seated, open])
}

/** 판매 구역이 아예 못 뜰 때(가게 목록 실패·0곳) — 주소를 지우고 왜 못 여는지 말한다. */
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
    dropTool()
    toast.error(failed
      ? '가게 목록을 불러오지 못해 화면을 열지 못했어요. 잠시 후 다시 열어 주세요.'
      : '이 계정에 연결된 가게가 없어요. 가게를 등록하거나 가게를 연결한 카카오 계정으로 들어와 주세요.')
  }, [loading, failed, storeCount])
}
