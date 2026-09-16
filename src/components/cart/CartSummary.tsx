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
  /** 고른 것들이 어느 레일인지. */
  cartKind?: CartKind
  /** 💸 정가 대비 아낀 금액. 0 이면 줄을 안 그린다. */
  savedAmount?: number
  /**
   * 섞였을 때 **왜 나뉘고 무엇이 남는지**. `cart-cta.ts` 가 만든다 —
   * 버튼이 고른 것과 한 문장에서 나오지 않으면 둘이 다른 말을 하는 날이 온다.
   */
  mixedHint?: string | null
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
  savedAmount = 0,
  mixedHint = null,
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
        {/* 💸 아낀 돈 — 할인이 실제로 있을 때만. "0원 아꼈어요" 는 소음이다. */}
        {savedAmount > 0 && (
          <div className="flex justify-between text-[13px]">
            <span className="text-gray-500 dark:text-gray-400">할인</span>
            <span className="font-semibold text-brand-text tabular-nums">−{fmt(savedAmount)}{won}</span>
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
          🔴 섞였으면 합계를 말하지 않는다 — **이번에 결제할 금액은 버튼이 말한다**
             (`이용권 3개 먼저 결제 · 74,500원`). 여기에 또 큰 숫자를 띄우면 둘 중 뭐가 청구되는지 흐려진다. */}
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

      {/* 🔴 섞였으면 **누르기 전에** 말한다 — 다만 이제는 "네가 골라라" 가 아니라
          "이만큼 먼저 결제하고 나머지는 남겨 둔다" 로 말한다(버튼이 이미 그렇게 동작한다).
          색 상자를 쓰지 않는다(표면 규칙 ⑥). */}
      {mixed && mixedHint && (
        <p className="mt-3 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">{mixedHint}</p>
      )}
    </div>
  )
})
