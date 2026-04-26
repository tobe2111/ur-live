"use client"

interface OrderSummaryProps {
  productTotal?: number
  shippingFee?: number
  discount?: number
  onPayment?: () => void
  isProcessing?: boolean
}

function formatPrice(price: number) {
  return price.toLocaleString("ko-KR")
}

export function OrderSummary({
  productTotal = 69700,
  shippingFee = 0,
  discount = 15200,
  onPayment,
  isProcessing = false,
}: OrderSummaryProps) {
  const totalPrice = productTotal - discount + shippingFee

  return (
    <section className="bg-card px-5 py-6">
      <h2 className="text-[17px] font-bold text-foreground">결제 금액</h2>

      <div className="mt-5 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-muted-foreground">상품금액</span>
          <span className="text-[14px] text-foreground">
            {formatPrice(productTotal)}원
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[14px] text-muted-foreground">배송비</span>
          <span className="text-[14px] text-foreground">
            {shippingFee === 0 ? (
              <span className="font-medium text-primary">무료</span>
            ) : (
              `${formatPrice(shippingFee)}원`
            )}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[14px] text-muted-foreground">할인</span>
          <span className="text-[14px] font-medium text-destructive">
            -{formatPrice(discount)}원
          </span>
        </div>
      </div>

      <div className="my-5 h-px bg-border" />

      <div className="flex items-end justify-between">
        <span className="text-[15px] font-semibold text-foreground">총 결제금액</span>
        <div className="flex items-baseline gap-0.5">
          <span className="text-[26px] font-bold tracking-tight text-foreground">
            {formatPrice(totalPrice)}
          </span>
          <span className="text-[15px] font-semibold text-foreground">원</span>
        </div>
      </div>

      {/* Desktop payment button */}
      <div className="mt-6 hidden lg:block">
        <button
          type="button"
          onClick={onPayment}
          disabled={isProcessing}
          className="flex w-full items-center justify-center rounded-2xl bg-primary py-[18px] text-[16px] font-bold text-primary-foreground transition-all hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isProcessing ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              <span>결제 처리중</span>
            </div>
          ) : (
            <span>{formatPrice(totalPrice)}원 결제하기</span>
          )}
        </button>
      </div>
    </section>
  )
}
