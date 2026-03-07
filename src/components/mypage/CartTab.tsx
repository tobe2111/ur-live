import { Link } from 'react-router-dom'
import { ShoppingCart, Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
        <div className="apple-card p-12 text-center">
          <div className="w-24 h-24 bg-[#f5f5f7] rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingCart className="h-12 w-12 text-[#6e6e73]" />
          </div>
          <h2 className="text-[28px] font-semibold text-[#1d1d1f] mb-4">
            장바구니가 비어있습니다
          </h2>
          <p className="text-[17px] text-[#6e6e73] mb-8">
            라이브를 시청하며 상품을 담아보세요
          </p>
          <Button className="apple-button" asChild>
            <Link to="/">라이브 보러가기</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cart Items */}
      <div className="apple-card divide-y divide-[#e5e5ea]">
        {cartItems.map(item => (
          <div key={item.id} className="p-4 sm:p-6 flex gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] sm:text-[17px] font-semibold text-[#1d1d1f] mb-1 line-clamp-2">
                {item.product_name}
              </h3>
              {item.option_value && (
                <p className="text-[13px] text-[#6e6e73] mb-2">
                  옵션: {item.option_value}
                </p>
              )}
              <p className="text-[19px] sm:text-[21px] font-bold text-[#1d1d1f] mb-3">
                {(item.price_snapshot * item.quantity).toLocaleString()}원
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="w-10 h-10 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e5e5ea] transition-colors disabled:opacity-30"
                  >
                    <Minus className="h-4 w-4 text-[#1d1d1f]" />
                  </button>
                  <span className="text-[15px] font-medium text-[#1d1d1f] w-10 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    className="w-10 h-10 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e5e5ea] transition-colors"
                  >
                    <Plus className="h-4 w-4 text-[#1d1d1f]" />
                  </button>
                </div>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="text-[#ff3b30] text-[14px] font-medium hover:opacity-60 transition-opacity flex items-center"
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
      <div className="apple-card p-6">
        <div className="space-y-4 pb-6 border-b border-[#e5e5ea]">
          <div className="flex justify-between">
            <span className="text-[15px] text-[#6e6e73]">상품 금액</span>
            <span className="text-[17px] font-medium text-[#1d1d1f]">
              {totalAmount.toLocaleString()}원
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[15px] text-[#6e6e73]">배송비</span>
            <span className="text-[17px] font-medium text-[#1d1d1f]">무료</span>
          </div>
        </div>

        <div className="pt-6 flex justify-between items-baseline">
          <span className="text-[19px] font-bold text-[#1d1d1f]">총 결제금액</span>
          <div className="text-right">
            <span className="text-[28px] font-bold text-[#007aff]">
              {totalAmount.toLocaleString()}
            </span>
            <span className="text-[17px] font-medium text-[#6e6e73]">원</span>
          </div>
        </div>

        <button
          onClick={onCheckout}
          className="apple-button w-full py-4 mt-6"
        >
          주문하기 ({cartItems.length}개)
        </button>
      </div>
    </div>
  )
}
