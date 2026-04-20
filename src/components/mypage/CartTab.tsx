import { Link } from 'react-router-dom'
import { ShoppingCart, Minus, Plus, Trash2 } from 'lucide-react'

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
        <div className="bg-[#121212] rounded-2xl border border-[#2A2A2A] p-12 text-center">
          <div className="w-24 h-24 bg-[#1A1A1A] rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingCart className="h-12 w-12 text-gray-500" />
          </div>
          <h2 className="text-[22px] font-semibold text-white mb-4">
            장바구니가 비어있습니다
          </h2>
          <p className="text-[15px] text-gray-400 mb-8">
            라이브를 시청하며 상품을 담아보세요
          </p>
          <Link to="/" className="inline-block px-6 py-3 bg-white text-[#020202] font-medium rounded-xl hover:bg-gray-200 transition-colors">
            라이브 보러가기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Cart Items */}
      <div className="bg-[#121212] rounded-2xl border border-[#2A2A2A] divide-y divide-[#1A1A1A]">
        {cartItems.map(item => (
          <div key={item.id} className="p-4 flex gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-semibold text-white mb-1 line-clamp-2">
                {item.product_name}
              </h3>
              {item.option_value && (
                <p className="text-[13px] text-gray-500 mb-2">
                  옵션: {item.option_value}
                </p>
              )}
              <p className="text-[19px] font-bold text-white mb-3">
                {(item.price_snapshot * item.quantity).toLocaleString()}원
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="w-10 h-10 rounded-full bg-[#1A1A1A] flex items-center justify-center hover:bg-[#2A2A2A] transition-colors disabled:opacity-30"
                  >
                    <Minus className="h-4 w-4 text-white" />
                  </button>
                  <span className="text-[15px] font-medium text-white w-10 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    className="w-10 h-10 rounded-full bg-[#1A1A1A] flex items-center justify-center hover:bg-[#2A2A2A] transition-colors"
                  >
                    <Plus className="h-4 w-4 text-white" />
                  </button>
                </div>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="text-red-400 text-[14px] font-medium hover:opacity-60 transition-opacity flex items-center"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  삭제
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cart Summary */}
      <div className="bg-[#121212] rounded-2xl border border-[#2A2A2A] p-6">
        <div className="space-y-4 pb-6 border-b border-[#1A1A1A]">
          <div className="flex justify-between">
            <span className="text-[15px] text-gray-400">상품 금액</span>
            <span className="text-[17px] font-medium text-white">
              {totalAmount.toLocaleString()}원
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[15px] text-gray-400">배송비</span>
            <span className="text-[17px] font-medium text-white">무료</span>
          </div>
        </div>

        <div className="pt-6 flex justify-between items-baseline">
          <span className="text-[19px] font-bold text-white">총 결제금액</span>
          <div className="text-right">
            <span className="text-[28px] font-bold text-pink-400">
              {totalAmount.toLocaleString()}
            </span>
            <span className="text-[17px] font-medium text-gray-400">원</span>
          </div>
        </div>

        <button
          onClick={onCheckout}
          className="w-full py-4 mt-6 bg-white text-[#020202] font-bold rounded-xl hover:bg-gray-200 transition-colors"
        >
          주문하기 ({cartItems.length}개)
        </button>
      </div>
    </div>
  )
}
