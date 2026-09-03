/**
 * 💰 딜 결제 실패의 UX 매핑 — `GroupBuyDetailPage.handleJoin` 의 딜 경로에서 쓴다.
 *
 * 요청/성공 경로는 페이지에 그대로 두고 **에러 → 안내**만 여기로 모았다. 세 갈래다:
 *  1. `DEAL_PAYMENT_NOT_ALLOWED` — 서버 게이트가 꺼져 있고 클라 플래그와 갈린 상태. 카드로 유도.
 *  2. `INSUFFICIENT_POINTS` — 딜 부족. 충전이 종료된 뒤(`TOPUP_DISABLED`, 2026-07-18 대표
 *     "충전 자체를 빼자")로는 충전 유도 대신 **딜 모으는 법**을 알려 준다.
 *  3. 그 외 — 서버 문구 그대로.
 */
import { toast } from '@/hooks/useToast'
import { TOPUP_DISABLED } from '@/shared/feature-flags'

type DealJoinError = { response?: { data?: { error?: string; code?: string } } }

export async function handleDealJoinError(err: unknown, nav: {
  confirmDialog: (msg: string) => Promise<boolean>
  navigate: (to: string) => void
}) {
  const e = err as DealJoinError
  const code = e?.response?.data?.code
  if (code === 'DEAL_PAYMENT_NOT_ALLOWED') {
    toast.error('지금은 이 상품을 카드로만 결제할 수 있어요.')
    return
  }
  if (code === 'INSUFFICIENT_POINTS') {
    if (TOPUP_DISABLED) {
      toast.error('딜이 부족해요. 딜은 친구 초대·유어샵 추천으로 모을 수 있어요.')
      return
    }
    if (await nav.confirmDialog('딜이 부족합니다. 충전 페이지로 이동할까요?')) {
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      nav.navigate('/points/charge')
    }
    return
  }
  toast.error(e?.response?.data?.error || '교환 실패')
}
