/**
 * 🛡️ 2026-05-01: TD-018 분할 — CheckoutPage 의 주문 상품 목록 추출.
 *
 * 셀러별 그룹 + 각 상품 + 배송비 표시. read-only.
 */
import { Package } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/utils/format'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import type { SellerGroup } from './types'

interface Props {
  sellerGroups: Record<number, SellerGroup>
  totalItemCount: number
}

export default function OrderItemsList({ sellerGroups, totalItemCount }: Props) {
  const { t } = useTranslation()
  return (
    <section className="bg-white dark:bg-[#11141C] px-5 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">{t('checkout.items.title', { defaultValue: '주문 상품' })}</h2>
        <span className="text-[13px] text-gray-400 dark:text-gray-500">{t('checkout.items.count', { defaultValue: '{{count}}개', count: totalItemCount })}</span>
      </div>

      <div className="mt-5 flex flex-col gap-5">
        {Object.values(sellerGroups).map((group) => (
          <div key={group.seller_id} className="border border-gray-200 dark:border-[#2C2F35] rounded-2xl p-4">
            <p className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 mb-3">
              {group.seller_name}
            </p>

            {group.items.map((item) => (
              <div key={item.id} className="flex gap-4 py-3 border-t border-gray-200 dark:border-[#2C2F35] first:border-t-0">
                <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-gray-50 dark:bg-[#1D1F29]">
                  {item.image_url ? (
                    <img
                      src={cfImage(item.image_url, { width: 200, quality: 82, format: 'auto' }) || item.image_url}
                      alt={item.product_name}
                      className="object-cover w-full h-full" loading="lazy" decoding="async"
                      onError={(e) => cfImageOnError(e.currentTarget, item.image_url)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-7 w-7 text-gray-400 dark:text-gray-500" />
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                  <p className="truncate text-[14px] leading-snug text-gray-900 dark:text-white">
                    {item.product_name}
                  </p>
                  {item.option_value && (
                    <p className="text-[13px] text-gray-400 dark:text-gray-500">
                      {t('checkout.items.optionLine', { defaultValue: '{{option}} / {{count}}개', option: item.option_value, count: item.quantity })}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-bold text-gray-900 dark:text-white">
                      {formatNumber((item.price_snapshot ?? 0) * item.quantity)}{t('checkout.summary.wonSuffix', { defaultValue: '원' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* 배송비 정보 — 📦 2026-09-01: 비배송(이용권·교환권) 그룹엔 이 줄이 없다.
                바로 위에서 "배송지 입력이 필요 없어요" 라고 해 놓고 아래에 배송비 3,000원을
                찍고 있었다(그리고 합계엔 안 들어갔다). 한 화면이 스스로와 어긋나 있었다. */}
            {!group.no_shipping && (<>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#2C2F35] flex justify-between text-[13px]">
              <span className="text-gray-400 dark:text-gray-500">{t('checkout.summary.shippingFee', { defaultValue: '배송비' })}</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold
                  ? <span className="text-blue-600 font-medium">{t('checkout.summary.free', { defaultValue: '무료' })}</span>
                  : `${formatNumber(group.shipping_fee)}${t('checkout.summary.wonSuffix', { defaultValue: '원' })}`}
              </span>
            </div>
            {group.free_shipping_threshold > 0 && group.subtotal < group.free_shipping_threshold && (
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
                {t('checkout.items.addForFreeShipping', { defaultValue: '{{amount}}원 추가 시 무료배송', amount: formatNumber(group.free_shipping_threshold - group.subtotal) })}
              </p>
            )}
            </>)}
          </div>
        ))}
      </div>
    </section>
  )
}
