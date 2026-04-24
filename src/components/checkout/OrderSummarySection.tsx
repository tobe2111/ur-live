interface OrderSummarySectionProps {
  subtotal: number
  totalShippingFee: number
  couponDiscount: number
  totalGroupBuyDiscount: number
  dealToUse: number
  totalAmount: number
}

export function OrderSummarySection({
  subtotal,
  totalShippingFee,
  couponDiscount,
  totalGroupBuyDiscount,
  dealToUse,
  totalAmount,
}: OrderSummarySectionProps) {
  return (
    <div>
      <div className="h-[6px] bg-gray-100" />
      <section className="bg-white px-5 py-5">
        <h2 className="text-[15px] font-bold text-gray-900">결제 예정금액</h2>

        <div className="mt-5 flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-gray-400">상품금액</span>
            <span className="text-[14px] text-gray-900">
              {subtotal.toLocaleString()}원
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[14px] text-gray-400">배송비</span>
            <span className="text-[14px] text-gray-900">
              {totalShippingFee === 0 ? (
                <span className="font-medium text-blue-600">무료</span>
              ) : (
                `${totalShippingFee.toLocaleString()}원`
              )}
            </span>
          </div>

          {couponDiscount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-gray-400">쿠폰 할인</span>
              <span className="text-[14px] font-medium text-red-500">
                -{couponDiscount.toLocaleString()}원
              </span>
            </div>
          )}
          {totalGroupBuyDiscount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-gray-400">🎁 공동구매 할인</span>
              <span className="text-[14px] font-medium text-gray-900">-{totalGroupBuyDiscount.toLocaleString()}원</span>
            </div>
          )}
          {dealToUse > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-gray-400">딜 포인트</span>
              <span className="text-[14px] font-medium text-pink-500">-{dealToUse.toLocaleString()}딜</span>
            </div>
          )}
        </div>

        <div className="flex items-end justify-between pt-3 mt-3 border-t border-gray-100">
          <span className="text-[14px] font-extrabold text-gray-900">총 결제 금액</span>
          <span className="text-[20px] font-black text-red-500" style={{ letterSpacing: '-0.03em' }}>
            {Math.max(0, totalAmount).toLocaleString()}원
          </span>
        </div>
        {/* 🛡️ 2026-04-22 배치 113: VAT 포함 표시 (한국 부가세 포함 공시 의무) */}
        {totalAmount > 0 && (
          <div className="flex justify-end mt-0.5">
            <span className="text-[11px] text-gray-500">
              부가세 포함 (10% · {Math.round(Math.max(0, totalAmount) - Math.floor(Math.max(0, totalAmount) / 1.1)).toLocaleString()}원)
            </span>
          </div>
        )}
        {totalAmount > 0 && (
          <div className="flex justify-end mt-1">
            <span className="rounded-md px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold">
              결제 시 {Math.round(Math.max(0, totalAmount) * 0.03).toLocaleString()}딜 적립 예정
            </span>
          </div>
        )}
      </section>
    </div>
  )
}
