/**
 * 💰 **판매가가 바뀌면 한 번 더 묻는다** (2026-10-06 · 결재 §잃은 것 ②).
 *
 * 철거된 손수 시트엔 그 단계가 있었고 원본엔 없었다 ⇒ 한 손 실수가 **손님이 보는 값**을 그대로 바꾼다.
 * 상품 수정 폼은 가격 말고도 열한 칸을 함께 저장하므로 "저장" 한 번의 무게가 다르다.
 *
 * 🔒 **금액을 계산하지 않는다** — 바뀐다는 사실만 보여 주고 보낼 값은 그대로다(서버 무접촉).
 * ⚠️ **안 바뀌면 묻지 않는다.** 저장마다 뜨면 사람이 눌러 넘기는 습관이 생겨 진짜 변경에서도 안 읽는다.
 */
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { formatWon } from '@/utils/format'

type T = (key: string, opts?: { defaultValue?: string }) => string

/**
 * 가격이 바뀌면 확인을 받는다. **진행해도 되면 `true`** —
 * 안 바뀐 경우에도 `true`(그땐 창이 아예 안 뜬다).
 */
export async function confirmPriceChange(
  t: T,
  basePriceRaw: unknown,
  nextPriceRaw: unknown,
): Promise<boolean> {
  const basePrice = Number(basePriceRaw)
  const nextPrice = Number(nextPriceRaw)
  if (!Number.isFinite(basePrice) || !Number.isFinite(nextPrice)) return true
  if (nextPrice === basePrice) return true
  return confirmDialog({
    title: t('seller.priceChangeTitle', { defaultValue: '판매가를 바꿉니다' }),
    message: `${formatWon(basePrice)} → ${formatWon(nextPrice)}\n\n${t('seller.priceChangeWarn', { defaultValue: '손님에게 보이는 값이 바로 바뀝니다.' })}`,
    confirmText: t('seller.priceChangeConfirm', { defaultValue: '바꾸고 저장' }),
    danger: true,
  })
}
