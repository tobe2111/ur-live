/**
 * 🧾 환불 **사유를 받는 한 걸음** (2026-10-06 · 결재 `2026-09-28-my-stage2-sheet-teardown.md` §잃은 것 ①).
 *
 * 철거된 손수 시트는 [고르고 → 사유 → 확인] 두 단계였고 원본엔 확인 창만 있고 **칸이 없었다**
 * ⇒ 되돌릴 수 없는 일에 이유가 안 남았다(분쟁의 유일한 근거).
 *
 * 여기로 뺀 이유는 둘이다: ① `SellerOrdersPage` 가 600줄 래칫에 닿았다 ② 사유의 **계약**
 * (선택 · 빈 칸이면 기본값 · 취소는 `null`)을 한 자리에 두면 가드가 그 계약만 보면 된다.
 *
 * 🔒 **서버 무접촉**: `seller-orders.routes.ts` 가 이미 `reason` 을 읽어 200자로 자른다.
 *   환불 금액·경로(`refundOrderFully`)는 한 글자도 안 바뀐다.
 * ⚠️ **사유는 선택이다** — 철거된 사본과 같은 계약. 필수로 바꾸면 "복원" 이 아니라 **환불을 막는
 *   새 규칙**이고, 그건 대표가 정할 자리다.
 */
import { promptDialog } from '@/components/ui/confirm-dialog'

/** 사유를 못 받았을 때 서버에 남길 값(철거된 사본과 동일). */
export const REFUND_REASON_FALLBACK = '판매자 주문 취소'

type T = (key: string, opts?: { defaultValue?: string }) => string

/** 취소하면 `null` — 호출부는 그때 **아무것도 보내지 않는다**. */
export async function askRefundReason(t: T): Promise<string | null> {
  return promptDialog({
    title: t('seller.refundTitle', { defaultValue: '주문 취소·환불' }),
    message: t('seller.confirmRefund', { defaultValue: '이 주문을 취소하고 결제를 환불할까요? 되돌릴 수 없습니다.' }),
    danger: true,
    confirmText: t('seller.refundConfirmText', { defaultValue: '환불' }),
    prompt: {
      placeholder: t('seller.refundReasonHint', { defaultValue: '사유 (기록에 남습니다 · 예: 재고 부족, 손님 요청)' }),
      multiline: true,
    },
  })
}
