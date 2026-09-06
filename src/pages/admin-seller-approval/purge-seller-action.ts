/**
 * 🗑️ 어드민 — 빈 매장 완전 삭제 액션 (2026-09-04 대표 "매장 홍대돈가스 말고는 다 삭제해")
 *
 * 🧱 `AdminSellerApprovalPage.tsx` 에서 분리(file-size 래칫 — 그 페이지가 605줄로 자랐다).
 *   로직 byte-불변. 파괴적 경로라 **확인이 두 번**이다: 먼저 cascade 없이 시도하고,
 *   409 가 상품·운영자·유저연결 때문일 때만 다시 물어본 뒤 `?cascade=1` 로 재시도한다.
 *   돈이 오간 흔적(주문·이용권·정산·원장)은 서버가 cascade 로도 막는다.
 */
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'

interface PurgeTarget { id: number; name?: string | null; email?: string | null }

export function makePurgeSeller(opts: {
  h: Record<string, unknown>
  setActingId: (id: number | null) => void
  load: () => void
}) {
  const { h, setActingId, load } = opts
  // 🗑️ 2026-09-04 (대표 "매장 홍대돈가스 말고는 다 삭제해"): 빈 매장 **완전 삭제**.
  //    정지(suspend)는 목록에 계속 남아 "어느 게 진짜 매장인가"를 흐린다. 되돌릴 수 없으므로
  //    서버가 상품·주문·운영자·원장·정산 0 을 **직접 확인**하고, 하나라도 있으면 409 로 막는다.
  return async function purgeSeller(s: PurgeTarget) {
    if (!(await confirmDialog(
      `${s.name || s.email} 매장을 완전히 삭제할까요?\n\n되돌릴 수 없습니다. 주문·이용권·정산 이력이 있으면 서버가 거부합니다.`,
    ))) return
    setActingId(s.id)
    const call = (cascade: boolean) =>
      api.delete(`/api/admin/sellers/${s.id}/purge${cascade ? '?cascade=1' : ''}`, h)
    try {
      await call(false)
      toast.success('매장 삭제 완료'); load()
    } catch (e: unknown) {
      const ax = e as { response?: { status?: number; data?: { error?: string; data?: { blockers?: string[] } } } }
      const blockers = ax.response?.data?.data?.blockers || []
      // 409 + 막은 것이 상품·운영자·유저연결뿐이면 **한 번 더 물어보고** cascade 로 재시도한다.
      //   돈이 오간 흔적(주문/이용권/정산/원장)은 cascade 로도 못 지우므로 여기 해당 없음.
      const onlySoft = ax.response?.status === 409 && blockers.length > 0
        && blockers.every(b => /상품|운영자|연결된 유저 계정/.test(b))
      if (onlySoft && await confirmDialog(
        `${blockers.join(' · ')} 이(가) 남아 있습니다.\n\n상품과 그 리뷰·위시리스트까지 **함께 삭제**할까요? 되돌릴 수 없습니다.`,
      )) {
        try {
          const r = await call(true)
          const n = r.data?.data?.products_deleted ?? 0
          toast.success(n > 0 ? `매장 삭제 완료 (상품 ${n}건 함께 삭제)` : '매장 삭제 완료'); load()
        } catch (e2: unknown) {
          const ax2 = e2 as { response?: { data?: { error?: string } } }
          toast.error(ax2.response?.data?.error || '삭제 실패')
        }
      } else {
        toast.error(ax.response?.data?.error || '삭제 실패')
      }
    } finally { setActingId(null) }
  }
}
