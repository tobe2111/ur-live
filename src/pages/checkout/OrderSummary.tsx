/**
 * 🛡️ 2026-05-01: TD-018 분할 — CheckoutPage 결제 예정 금액 요약 섹션.
 *
 * 상품금액 / 배송비 / 쿠폰 할인 / 공동구매 할인 / 딜 포인트 / 총 결제 금액 / VAT / 적립 예정.
 */
import { formatNumber } from '@/utils/format'

interface Props {
  subtotal: number
  totalShippingFee: number
  couponDiscount: number
  totalGroupBuyDiscount: number
  dealToUse: number
  totalAmount: number
}

export default function OrderSummary({
  subtotal,
  totalShippingFee,
  couponDiscount,
  totalGroupBuyDiscount,
  dealToUse,
  totalAmount,
}: Props) {
  const finalAmount = Math.max(0, totalAmount)
  const vat = Math.round(finalAmount - Math.floor(finalAmount / 1.1))
  const dealsToEarn = Math.round(finalAmount * 0.03)

  return (
    <div>
      <div className="h-[6px] bg-gray-100 dark:bg-[#1A1A1A]" />
      <section className="bg-white dark:bg-[#0A0A0A] px-5 py-5">
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">결제 예정금액</h2>

        <div className="mt-5 flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-gray-400 dark:text-gray-500">상품금액</span>
            <span className="text-[14px] text-gray-900 dark:text-white">{formatNumber(subtotal)}원</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[14px] text-gray-400 dark:text-gray-500">배송비</span>
            <span className="text-[14px] text-gray-900 dark:text-white">
              {totalShippingFee === 0 ? (
                <span className="font-medium text-blue-600">무료</span>
              ) : (
                `${formatNumber(totalShippingFee)}원`
              )}
            </span>
          </div>

          {couponDiscount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-gray-400 dark:text-gray-500">쿠폰 할인</span>
              <span className="text-[14px] font-medium text-red-500">
                -{formatNumber(couponDiscount)}원
              </span>
            </div>
          )}
          {totalGroupBuyDiscount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-gray-400 dark:text-gray-500">🎁 공동구매 할인</span>
              <span className="text-[14px] font-medium text-gray-900 dark:text-white">
                -{formatNumber(totalGroupBuyDiscount)}원
              </span>
            </div>
          )}
          {dealToUse > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-gray-400 dark:text-gray-500">딜 포인트</span>
              <span className="text-[14px] font-medium text-pink-500">-{formatNumber(dealToUse)}딜</span>
            </div>
          )}
        </div>

        <div className="flex items-end justify-between pt-3 mt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
          <span className="text-[14px] font-extrabold text-gray-900 dark:text-white">총 결제 금액</span>
          <span className="text-[20px] font-black text-red-500" style={{ letterSpacing: '-0.03em' }}>
            {finalAmount}원
          </span>
        </div>
        {finalAmount > 0 && (
          <>
            <div className="flex justify-end mt-0.5">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">부가세 포함 (10% · {vat}원)</span>
            </div>
            <div className="flex justify-end mt-1">
              <span className="rounded-md px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold">
                결제 시 {dealsToEarn}딜 적립 예정
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
