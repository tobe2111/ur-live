import React from 'react'
import { formatNumber } from '@/utils/format'
import { useTranslation } from 'react-i18next'

interface CartSummaryProps {
  totalItems: number
  subtotal: number
  shippingFee: number
  total: number
}

export const CartSummary = React.memo(function CartSummary({
  totalItems,
  subtotal,
  shippingFee,
  total
}: CartSummaryProps) {
  const { t } = useTranslation()
  const fmt = (n: number) => formatNumber(n)

  return (
    <div>
      {/* Subtotal / shipping / discount rows */}
      <div className="space-y-2.5">
        <div className="flex justify-between text-[13px]">
          <span className="text-gray-500 dark:text-gray-400">{t('cart.subtotal', { count: totalItems, defaultValue: '상품금액 ({{count}}개)' })}</span>
          <span className="text-gray-900 dark:text-white font-medium">{fmt(subtotal)}{t('common.won', { defaultValue: '원' })}</span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-gray-500 dark:text-gray-400">{t('cart.shippingFee', { defaultValue: '배송비' })}</span>
          <span className="text-gray-900 dark:text-white font-medium">
            {shippingFee === 0 ? (
              <span className="text-pink-500 font-semibold">{t('cart.free', { defaultValue: '무료' })}</span>
            ) : (
              `+${fmt(shippingFee)}${t('common.won', { defaultValue: '원' })}`
            )}
          </span>
        </div>
      </div>

      {/* Dashed border divider */}
      <div className="my-3 border-t border-dashed border-gray-200 dark:border-[#2A2A2A]" />

      {/* v4 결제예정금액 (18px bold) */}
      <div className="flex justify-between items-baseline">
        <span className="text-[14px] font-bold text-gray-900 dark:text-white">{t('cart.paymentAmount', { defaultValue: '결제예정금액' })}</span>
        <span className="text-[18px] font-bold text-gray-900 dark:text-white">{fmt(total)}{t('common.won', { defaultValue: '원' })}</span>
      </div>
      {/* 🛡️ 2026-04-22 배치 113: VAT 포함 표시 */}
      {total > 0 && (
        <div className="flex justify-end mt-0.5">
          <span className="text-[10.5px] text-gray-400 dark:text-gray-500">{t('cart.vatIncluded', { defaultValue: '부가세 포함 (VAT 10%)' })}</span>
        </div>
      )}
    </div>
  )
})
