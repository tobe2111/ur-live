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
  const formatNumber = (n: number): string => {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  }

  return (
    <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-200">
      {/* 체크박스 */}
      <Checkbox 
        checked={isSelected}
        onCheckedChange={() => onToggleSelect(item.id)}
        className="mt-1"
      />
      
      {/* 상품 이미지 */}
      <img 
        src={item.image_url || '/placeholder.png'} 
        alt={item.product_name}
        className="w-20 h-20 object-cover rounded-md"
      />
      
      {/* 상품 정보 */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 mb-1 truncate">
          {item.product_name}
        </h3>
        
        {/* 옵션 */}
        {item.option_value && (
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm text-gray-600">{item.option_value}</p>
            <button
              onClick={() => onOpenOption(item)}
              className="text-gray-400 hover:text-gray-600"
              disabled={isUpdating}
            >
              <Settings size={14} />
            </button>
          </div>
        )}
        
        {/* 수량 조절 */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => onUpdateQuantity(item.id, -1)}
            disabled={item.quantity <= 1 || isUpdating}
            className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Minus size={14} />
          </button>
          <span className="w-10 text-center text-sm font-medium">
            {item.quantity}
          </span>
          <button
            onClick={() => onUpdateQuantity(item.id, 1)}
            disabled={isUpdating}
            className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
          </button>
        </div>
        
        {/* 가격 */}
        <p className="text-lg font-bold text-gray-900">
          {formatNumber(item.price_snapshot * item.quantity)}원
        </p>
      </div>
      
      {/* 삭제 버튼 */}
      <button
        onClick={() => onRemove(item.id)}
        disabled={isUpdating}
        className="text-gray-400 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <X size={20} />
      </button>
    </div>
  )
}, (prevProps, nextProps) => {
  // 커스텀 비교 함수로 불필요한 리렌더 방지
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.quantity === nextProps.item.quantity &&
    prevProps.item.option_value === nextProps.item.option_value &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isUpdating === nextProps.isUpdating
  )
})
