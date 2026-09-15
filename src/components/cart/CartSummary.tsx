import React from 'react'
import { formatNumber } from '@/utils/format'
import { useTranslation } from 'react-i18next'
import type { CartKind } from '@/pages/cart/voucher-checkout'

interface CartSummaryProps {
  totalItems: number
  /** 카드로 낼 상품 금액. **딜은 안 들어간다**(통화가 다르다). */
  subtotal: number
  shippingFee: number
  /** 카드 청구 예정액 = subtotal + shippingFee */
  total: number
  /** 딜로 낼 금액(교환권). 0 이면 줄이 안 뜬다. */
  dealAmount?: number
  /** 고른 것들이 어느 레일인지 — 'mixed' 면 결제가 안 열린다. */
  cartKind?: CartKind
  /**
   * 📦 2026-09-01: 배송이라는 개념 자체가 없는 장바구니(이용권·교환권)인가.
   * 배송비 줄에 '무료'라고 쓰면 원래 있었어야 할 비용을 깎아 준 것처럼 읽힌다 — 그 줄을 아예 뺀다.
   */
  noShipping?: boolean
}

/**
 * 🧾 장바구니 요약.
 *
 * 🩸 2026-09-15: 종전엔 **딜과 원을 한 숫자로 더했다** — 74,500원짜리 이용권과 13,500딜짜리 교환권을
 *    고르면 "88,000원" 이라는, 어느 쪽으로도 청구되지 않는 금액이 떴다. 통화가 둘이면 줄도 둘이다.
 */
export const CartSummary = React.memo(function CartSummary({
  totalItems,
  subtotal,
  shippingFee,
  total,
  dealAmount = 0,
  cartKind,
  noShipping = false,
}: CartSummaryProps) {
  const { t } = useTranslation()
  const fmt = (n: number) => formatNumber(n)
  const won = t('common.won', { defaultValue: '원' })
  const dealOnly = cartKind === 'deal'
  const mixed = cartKind === 'mixed'

  return (
    <div>
      {/* Subtotal / shipping / discount rows */}
      <div className="space-y-2.5">
        {/* 카드로 낼 상품 — 교환권만 담겼으면 이 줄은 0 이라 뜨지 않는다. */}
        {!dealOnly && (
          <div className="flex justify-between text-[13px]">
            <span className="text-gray-500 dark:text-gray-400">{t('cart.subtotal', { count: totalItems, defaultValue: '상품금액 ({{count}}개)' })}</span>
            <span className="text-gray-900 dark:text-white font-medium tabular-nums">{fmt(subtotal)}{won}</span>
          </div>
        )}
        {/* 🏷️ 딜로 낼 것(교환권)은 **따로** 센다 — 원과 더하면 없는 금액이 된다. */}
        {dealAmount > 0 && (
          <div className="flex justify-between text-[13px]">
            <span className="text-gray-500 dark:text-gray-400">교환권 (딜 결제)</span>
            <span className="text-gray-900 dark:text-white font-medium tabular-nums">{fmt(dealAmount)}딜</span>
          </div>
        )}
        {!noShipping && !dealOnly && (
        <div className="flex justify-between text-[13px]">
          <span className="text-gray-500 dark:text-gray-400">{t('cart.shippingFee', { defaultValue: '배송비' })}</span>
          <span className="text-gray-900 dark:text-white font-medium tabular-nums">
            {shippingFee === 0 ? (
              <span className="text-brand-text font-semibold">{t('cart.free', { defaultValue: '무료' })}</span>
            ) : (
              `+${fmt(shippingFee)}${won}`
            )}
          </span>
        </div>
        )}
      </div>

      {/* Dashed border divider */}
      <div className="my-3 border-t border-dashed border-line" />

      {/* v4 결제예정금액 (18px bold) — 청구되는 통화 하나만 크게 말한다.
          🔴 섞였으면 **결제 자체가 안 열리므로 합계를 말하지 않는다** — 위 두 줄이 이미 각각의 금액을
             말했고, 여기에 한쪽 통화만 큰 글씨로 띄우면 그게 청구될 것처럼 읽힌다. */}
      {!mixed && (
        <>
          <div className="flex justify-between items-baseline">
            <span className="text-[14px] font-bold text-gray-900 dark:text-white">{t('cart.paymentAmount', { defaultValue: '결제예정금액' })}</span>
            <span className="text-[18px] font-bold text-gray-900 dark:text-white tabular-nums">
              {dealOnly ? `${fmt(dealAmount)}딜` : `${fmt(total)}${won}`}
            </span>
          </div>
          {/* 🛡️ 2026-04-22 배치 113: VAT 포함 표시 */}
          {!dealOnly && total > 0 && (
            <div className="flex justify-end mt-0.5">
              <span className="text-[10.5px] text-gray-400 dark:text-gray-500">{t('cart.vatIncluded', { defaultValue: '부가세 포함 (VAT 10%)' })}</span>
            </div>
          )}
        </>
      )}

      {/* 🔴 섞였으면 **누르기 전에** 말한다. 색 상자를 쓰지 않는다(표면 규칙 ⑥) — 문장으로 말하고
          결제 수단이라는 낱말만 강조한다. */}
      {mixed && (
        <p className="mt-3 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
          <span className="font-bold text-brand-text">교환권·이용권·배송 상품</span>은 결제 수단과 받는 방식이 달라
          한 번에 결제할 수 없어요. 하나씩 골라서 주문해주세요.
        </p>
      )}
    </div>
  )
})
