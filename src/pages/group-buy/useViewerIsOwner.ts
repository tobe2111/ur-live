/**
 * 👤 2026-10-18 — 보는 사람이 이 이용권의 주인인가.
 *
 * 종전 판정은 `localStorage.seller_id === detail.seller_id` 였다. 그 값은 **셀러 대시보드를 그 기기에서
 * 연 적이 있을 때만** 있어서, 카카오로만 로그인한 사장님은 자기 이용권에서 "30,000원 구매하기" 를 보고
 * 누른 뒤에야 서버에게 "본인 상품은 참여할 수 없습니다" 를 들었다(대표 신고 스크린샷).
 *
 * 판정은 서버가 한다 — 구매를 막는 바로 그 함수(`isSelfOwnedGroupBuy`)라 버튼과 차단이 갈릴 수 없다.
 * 비로그인이면 묻지 않는다(주인일 수가 없다). 모르는 동안은 `false` = 종전 화면 그대로다.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useViewerIsOwner(productId: number, loggedIn: boolean): boolean {
  const q = useQuery({
    queryKey: ['gbViewerOwner', productId],
    enabled: loggedIn && Number.isInteger(productId) && productId > 0,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const r = await api.get(`/api/group-buy/viewer/${productId}`)
      return r.data?.data?.is_owner === true
    },
  })
  return q.data === true
}
