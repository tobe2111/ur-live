"use client"

interface MobilePayBarProps {
  totalPrice?: number
  onPayment?: () => void
  isProcessing?: boolean
}

function formatPrice(price: number) {
  return price.toLocaleString("ko-KR")
}

export function MobilePayBar({
  totalPrice = 54500,
  onPayment,
  isProcessing = false,
}: MobilePayBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-card px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 lg:hidden">
      <button
        type="button"
        onClick={onPayment}
        disabled={isProcessing}
        className="flex w-full items-center justify-center rounded-2xl bg-primary py-[18px] text-[16px] font-bold text-primary-foreground transition-all hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isProcessing ? (
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            <span>처리중</span>
          </div>
        ) : (
          <span>{formatPrice(totalPrice)}원 결제하기</span>
        )}
      </button>
    </div>
  )
}
