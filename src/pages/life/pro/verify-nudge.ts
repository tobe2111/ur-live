/**
 * 🪪 첫 견적을 보낸 미인증 업체에게 **한 번만** — 사업자등록증을 올리면 `사업자 인증` 표시가 붙는다(2026-10-25 대표 "다음 단계 2가지 다 해줘").
 * 가입은 쉽게 두고(심사 전에도 견적), 신뢰는 표시로 끌어올린다. 막지 않고 권한다 — "나중에" 가 언제나 있다.
 * 기기마다 한 번(localStorage). 저장소가 막혀 있으면 묻지 않는다(매번 뜨는 쪽이 더 나쁘다).
 */
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { sellerEntryPath } from '@/lib/seller-deep-link'

export const VERIFY_NUDGE_KEY = 'ur_life_verify_nudge_v1'

export async function nudgeVerify(navigate: (to: string) => void): Promise<void> {
  try {
    if (localStorage.getItem(VERIFY_NUDGE_KEY)) return
    localStorage.setItem(VERIFY_NUDGE_KEY, '1')
  } catch { return }
  const go = await confirmDialog({
    title: '사업자 인증을 받아 보세요',
    message: '사업자등록증을 올리면 견적 카드에 \'사업자 인증\' 표시가 붙어요. 손님이 업체를 고를 때 가장 먼저 보는 표시예요.',
    confirmText: '등록증 올리기',
    cancelText: '나중에',
  })
  if (go) navigate(sellerEntryPath('/seller/business-info'))
}
