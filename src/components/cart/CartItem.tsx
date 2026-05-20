import React from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { useTranslation } from 'react-i18next'

interface CartItem {
  id: number
  product_id: number
  product_name: string
  image_url?: string
  quantity: number
  price_snapshot: number
  option_id?: number
  option_value?: string
  product_stock?: number
  // 🛡️ 2026-05-19: KT Alpha 교환권 (deal_only=1) 은 '딜' 단위로 표시.
  deal_only?: number
  // 🛡️ 2026-05-19: 판매 종료 (is_active=0) 상품도 카트에 표시 (데이터 보존).
  //   값 = 0/undefined → "판매 종료" 배지 + 선택 차단.
  product_is_active?: number
}

interface CartItemProps {
  item: CartItem
  isSelected: boolean
  onToggleSelect: (id: number) => void
  onUpdateQuantity: (id: number, delta: number) => void
  onRemove: (id: number) => void
  onOpenOption: (item: CartItem) => void
  isUpdating?: boolean
}

export const CartItemComponent = React.memo(function CartItemComponent({
  item,
  isSelected,
  onToggleSelect,
  onUpdateQuantity,
  onRemove,
  onOpenOption,
  isUpdating = false
}: CartItemProps) {
  const { t } = useTranslation()
  const fmt = (n: number) => formatNumber(n)

  const stock = item.product_stock
  const isOutOfStock = stock !== undefined && stock === 0
  const isAtStockLimit = stock !== undefined && item.quantity >= stock
  const isLowStock = stock !== undefined && stock > 0 && stock <= 5
  // 🛡️ 2026-05-19: 판매 종료 상품 (is_active=0) — 결제 차단 + 선택 불가.
  const isInactive = item.product_is_active !== undefined && Number(item.product_is_active) !== 1
  const isUnavailable = isOutOfStock || isInactive

  return (
    <div className={`flex gap-3 ${isUnavailable ? 'opacity-50' : ''}`}>
      {/* v4 pink checkbox */}
      <span
        onClick={() => !isUnavailable && onToggleSelect(item.id)}
        className={`mt-1 w-5 h-5 rounded-md flex items-center justify-center border-2 shrink-0 cursor-pointer transition-colors ${
          isSelected
            ? 'bg-pink-500 border-pink-500'
            : 'bg-white dark:bg-[#0A0A0A] border-gray-300 dark:border-[#3A3A3A]'
        } ${isUnavailable ? 'cursor-not-allowed' : ''}`}
      >
        {isSelected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>

      {/* v4: 72x72 rounded-lg image */}
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.product_name}
          className="w-[72px] h-[72px] rounded-lg object-cover bg-gray-100 dark:bg-[#1A1A1A] shrink-0" loading="lazy" decoding="async" />
      ) : (
        <div className="w-[72px] h-[72px] rounded-lg bg-gray-100 dark:bg-[#1A1A1A] shrink-0 flex items-center justify-center">
          <span className="text-gray-300 dark:text-gray-600 text-[10px]">No img</span>
        </div>
      )}

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`text-[14px] font-medium leading-tight line-clamp-2 ${isOutOfStock ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
            {item.product_name}
          </h3>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            disabled={isUpdating}
            aria-label={t('cart.removeItemAria', { name: item.product_name, defaultValue: '{{name}} 장바구니에서 삭제' })}
            className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:text-gray-400 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* v4: option pill button */}
        {item.option_value && (
          <button
            onClick={() => onOpenOption(item)}
            disabled={isUpdating}
            className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#2A2A2A] px-2.5 py-1 rounded-full hover:bg-gray-50 dark:bg-[#121212] transition-colors"
          >
            {item.option_value}
            <svg className="w-3 h-3 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Price row */}
        <div className="mt-2">
          <p className={`text-[15px] font-bold ${isOutOfStock ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
            {fmt(item.price_snapshot * item.quantity)}{Number(item.deal_only) === 1 ? ' 딜' : t('common.won', { defaultValue: '원' })}
          </p>
        </div>

        {/* v4: quantity +/- buttons (border rounded-lg) */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center border border-gray-200 dark:border-[#2A2A2A] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => onUpdateQuantity(item.id, -1)}
              disabled={item.quantity <= 1 || isUpdating || isUnavailable}
              aria-label={t('cart.decreaseQty', { defaultValue: '수량 줄이기' })}
              className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-50 dark:bg-[#121212] transition-colors"
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <span aria-live="polite" aria-label={t('cart.qtyLabel', { qty: item.quantity, defaultValue: '수량 {{qty}}' })} className="w-8 text-center text-[13px] font-semibold text-gray-900 dark:text-white border-x border-gray-200 dark:border-[#2A2A2A]">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(item.id, 1)}
              disabled={isUpdating || isUnavailable || isAtStockLimit}
              aria-label={t('cart.increaseQty', { defaultValue: '수량 늘리기' })}
              className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:bg-gray-50 dark:bg-[#121212] transition-colors"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>

          {/* Stock warnings — 🛡️ 2026-05-19: 판매 종료 상품 (is_active=0) 도 별도 표시. */}
          <div className="text-right">
            {isInactive && <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{t('cart.inactive', { defaultValue: '판매 종료' })}</p>}
            {!isInactive && isOutOfStock && <p className="text-[11px] text-red-500 font-medium">{t('cart.soldOut', { defaultValue: '품절' })}</p>}
            {!isUnavailable && isAtStockLimit && <p className="text-[11px] text-orange-500">{t('cart.maxQty', { stock, defaultValue: '최대 수량 ({{stock}}개)' })}</p>}
            {!isUnavailable && !isAtStockLimit && isLowStock && <p className="text-[11px] text-orange-400">{t('cart.lowStock', { stock, defaultValue: '재고 {{stock}}개' })}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.quantity === nextProps.item.quantity &&
    prevProps.item.option_value === nextProps.item.option_value &&
    prevProps.item.product_stock === nextProps.item.product_stock &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isUpdating === nextProps.isUpdating
  )
})
