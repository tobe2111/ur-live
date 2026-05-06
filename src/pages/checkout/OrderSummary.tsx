/**
 * 🛡️ 2026-05-01: TD-018 분할 — CheckoutPage 결제 예정 금액 요약 섹션.
 *
 * 상품금액 / 배송비 / 쿠폰 할인 / 공동구매 할인 / 딜 포인트 / 총 결제 금액 / VAT / 적립 예정.
 */
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const finalAmount = Math.max(0, totalAmount)
  const vat = Math.round(finalAmount - Math.floor(finalAmount / 1.1))
  const dealsToEarn = Math.round(finalAmount * 0.03)

  return (
    <div>
      <div className="h-[6px] bg-gray-100 dark:bg-[#1A1A1A]" />
      <section className="bg-white dark:bg-[#0A0A0A] px-5 py-5">
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">{t('checkout.summary.title', { defaultValue: '결제 예정금액' })}</h2>

        <div className="mt-5 flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-gray-400 dark:text-gray-500">{t('checkout.summary.subtotal', { defaultValue: '상품금액' })}</span>
            <span className="text-[14px] text-gray-900 dark:text-white">{t('checkout.summary.amountWon', { defaultValue: '{{amount}}원', amount: formatNumber(subtotal) })}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[14px] text-gray-400 dark:text-gray-500">{t('checkout.summary.shippingFee', { defaultValue: '배송비' })}</span>
            <span className="text-[14px] text-gray-900 dark:text-white">
              {totalShippingFee === 0 ? (
                <span className="font-medium text-blue-600">{t('checkout.summary.free', { defaultValue: '무료' })}</span>
              ) : (
                t('checkout.summary.amountWon', { defaultValue: '{{amount}}원', amount: formatNumber(totalShippingFee) })
              )}
            </span>
          </div>

          {couponDiscount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-gray-400 dark:text-gray-500">{t('checkout.summary.couponDiscount', { defaultValue: '쿠폰 할인' })}</span>
              <span className="text-[14px] font-medium text-red-500">
                -{formatNumber(couponDiscount)}{t('checkout.summary.wonSuffix', { defaultValue: '원' })}
              </span>
            </div>
          )}
          {totalGroupBuyDiscount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-gray-400 dark:text-gray-500">{t('checkout.summary.groupBuyDiscount', { defaultValue: '🎁 공동구매 할인' })}</span>
              <span className="text-[14px] font-medium text-gray-900 dark:text-white">
                -{formatNumber(totalGroupBuyDiscount)}{t('checkout.summary.wonSuffix', { defaultValue: '원' })}
              </span>
            </div>
          )}
          {dealToUse > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-gray-400 dark:text-gray-500">{t('checkout.summary.dealPoints', { defaultValue: '딜 포인트' })}</span>
              <span className="text-[14px] font-medium text-pink-500">-{formatNumber(dealToUse)}{t('checkout.summary.dealSuffix', { defaultValue: '딜' })}</span>
            </div>
          )}
        </div>

        <div className="flex items-end justify-between pt-3 mt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
          <span className="text-[14px] font-extrabold text-gray-900 dark:text-white">{t('checkout.summary.totalAmount', { defaultValue: '총 결제 금액' })}</span>
          <span className="text-[20px] font-black text-red-500" style={{ letterSpacing: '-0.03em' }}>
            {finalAmount}{t('checkout.summary.wonSuffix', { defaultValue: '원' })}
          </span>
        </div>
        {finalAmount > 0 && (
          <>
            <div className="flex justify-end mt-0.5">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">{t('checkout.summary.vatIncluded', { defaultValue: '부가세 포함 (10% · {{vat}}원)', vat })}</span>
            </div>
            <div className="flex justify-end mt-1">
              <span className="rounded-md px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold">
                {t('checkout.summary.dealsToEarn', { defaultValue: '결제 시 {{count}}딜 적립 예정', count: dealsToEarn })}
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
