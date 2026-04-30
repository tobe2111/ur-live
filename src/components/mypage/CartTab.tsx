import { Link } from 'react-router-dom'
import { ShoppingCart, Minus, Plus, Trash2 } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface CartItem {
  id: number
  product_id: number
  product_name: string
  quantity: number
  price_snapshot: number
  option_value?: string
}

interface CartTabProps {
  cartItems: CartItem[]
  onUpdateQuantity: (itemId: number, newQuantity: number) => void
  onRemoveItem: (itemId: number) => void
  onCheckout: () => void
}

export function CartTab({ cartItems, onUpdateQuantity, onRemoveItem, onCheckout }: CartTabProps) {
  const totalAmount = cartItems.reduce((sum, item) => sum + item.price_snapshot * item.quantity, 0)

  if (cartItems.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <ShoppingCart className="h-10 w-10 text-gray-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-[18px] font-bold text-gray-900 mb-2">
            장바구니가 비어있습니다
          </h2>
          <p className="text-[14px] text-gray-500 mb-6">
            라이브를 시청하며 상품을 담아보세요
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-gray-900 text-white text-[14px] font-semibold rounded-full hover:bg-gray-800 active:bg-gray-700 transition-colors"
          >
            라이브 보러가기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-28">
      {/* Cart Items */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
        {cartItems.map(item => (
          <div key={item.id} className="p-4">
            <div className="mb-3">
              <h3 className="text-[15px] font-semibold text-gray-900 line-clamp-2 leading-snug">
                {item.product_name}
              </h3>
              {item.option_value && (
                <p className="text-[12px] text-gray-500 mt-1">
                  옵션 · {item.option_value}
                </p>
              )}
              <p className="text-[18px] font-bold text-gray-900 mt-2">
                {formatNumber(item.price_snapshot * item.quantity)}
                <span className="text-[14px] font-semibold text-gray-600 ml-0.5">원</span>
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="inline-flex items-center rounded-full border border-gray-200 overflow-hidden">
                <button
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  aria-label="수량 감소"
                  className="w-9 h-9 flex items-center justify-center text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="text-[14px] font-semibold text-gray-900 w-10 text-center select-none">
                  {item.quantity}
                </span>
                <button
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                  aria-label="수량 증가"
                  className="w-9 h-9 flex items-center justify-center text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                onClick={() => onRemoveItem(item.id)}
                className="flex items-center gap-1 text-[13px] font-medium text-gray-500 hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Cart Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="space-y-3 pb-4 border-b border-gray-100">
          <div className="flex justify-between">
            <span className="text-[13px] text-gray-500">상품 금액</span>
            <span className="text-[14px] font-semibold text-gray-900">
              {formatNumber(totalAmount)}원
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[13px] text-gray-500">배송비</span>
            <span className="text-[14px] font-semibold text-gray-900">무료</span>
          </div>
        </div>

        <div className="pt-4 flex justify-between items-baseline">
          <span className="text-[15px] font-bold text-gray-900">총 결제금액</span>
          <div className="text-right">
            <span className="text-[24px] font-extrabold text-pink-500">
              {formatNumber(totalAmount)}
            </span>
            <span className="text-[14px] font-semibold text-gray-600 ml-1">원</span>
          </div>
        </div>
      </div>

      {/* Fixed bottom CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 z-40 safe-bottom"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={onCheckout}
          className="w-full py-3.5 bg-gray-900 text-white text-[15px] font-bold rounded-full hover:bg-gray-800 active:bg-gray-700 transition-colors shadow-sm"
        >
          {cartItems.length}개 주문하기 · {formatNumber(totalAmount)}원
        </button>
      </div>
    </div>
  )
}
