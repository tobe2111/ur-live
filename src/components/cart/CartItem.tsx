import React from 'react'
import { Minus, Plus, X, Settings } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

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
  const fmt = (n: number) => n.toLocaleString()

  const stock = item.product_stock
  const isOutOfStock = stock !== undefined && stock === 0
  const isAtStockLimit = stock !== undefined && item.quantity >= stock
  const isLowStock = stock !== undefined && stock > 0 && stock <= 5

  return (
    <div className={`flex gap-3 p-4 bg-white rounded-xl border ${isOutOfStock ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggleSelect(item.id)}
        className="mt-0.5 shrink-0"
        disabled={isOutOfStock}
      />

      {item.image_url && (
        <img src={item.image_url} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-100 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`text-[14px] font-medium leading-tight line-clamp-2 ${isOutOfStock ? 'text-gray-400' : 'text-gray-900'}`}>
            {item.product_name}
          </h3>
          <button
            onClick={() => onRemove(item.id)}
            disabled={isUpdating}
            className="text-gray-300 hover:text-gray-500 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {item.option_value && (
          <button
            onClick={() => onOpenOption(item)}
            disabled={isUpdating}
            className="mt-1 text-[12px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded"
          >
            {item.option_value} ›
          </button>
        )}

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onUpdateQuantity(item.id, -1)}
              disabled={item.quantity <= 1 || isUpdating || isOutOfStock}
              className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 disabled:opacity-30"
            >
              <Minus size={12} />
            </button>
            <span className="w-7 text-center text-[13px] font-semibold text-gray-900">
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(item.id, 1)}
              disabled={isUpdating || isOutOfStock || isAtStockLimit}
              className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 disabled:opacity-30"
            >
              <Plus size={12} />
            </button>
          </div>
          <p className={`text-[15px] font-bold ${isOutOfStock ? 'text-gray-400' : 'text-gray-900'}`}>
            {fmt(item.price_snapshot * item.quantity)}원
          </p>
        </div>

        {isOutOfStock && <p className="text-[11px] text-red-500 mt-1">품절</p>}
        {!isOutOfStock && isAtStockLimit && <p className="text-[11px] text-orange-500 mt-1">최대 수량 (재고 {stock}개)</p>}
        {!isOutOfStock && !isAtStockLimit && isLowStock && <p className="text-[11px] text-orange-400 mt-1">재고 {stock}개 남음</p>}
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
