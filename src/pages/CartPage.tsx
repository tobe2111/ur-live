import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Trash2, ShoppingBag, ArrowLeft, Minus, Plus } from 'lucide-react'

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

export default function CartPage() {
  const navigate = useNavigate()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    loadCart()
  }, [])

  async function loadCart() {
    try {
      const userId = localStorage.getItem('user_id')
      if (!userId) {
        alert('로그인이 필요합니다.')
        navigate('/')
        return
      }

      const response = await axios.get(`/api/cart/${userId}`)
      const items = response.data?.data || []
      setCartItems(items)
      
      // Update hasCartItems flag
      localStorage.setItem('hasCartItems', items.length > 0 ? 'true' : 'false')
    } catch (error) {
      console.error('Failed to load cart:', error)
      alert('장바구니를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function updateQuantity(cartItemId: number, newQuantity: number) {
    if (newQuantity < 1) return
    if (updating) return

    setUpdating(true)
    try {
      await axios.put(`/api/cart/${cartItemId}`, { quantity: newQuantity })
      await loadCart()
    } catch (error: any) {
      console.error('Failed to update quantity:', error)
      alert(error.response?.data?.error || '수량 변경에 실패했습니다.')
    } finally {
      setUpdating(false)
    }
  }

  async function removeItem(cartItemId: number) {
    if (!confirm('이 상품을 장바구니에서 삭제하시겠습니까?')) return
    if (updating) return

    setUpdating(true)
    try {
      await axios.delete(`/api/cart/${cartItemId}`)
      await loadCart()
    } catch (error: any) {
      console.error('Failed to remove item:', error)
      alert(error.response?.data?.error || '상품 삭제에 실패했습니다.')
    } finally {
      setUpdating(false)
    }
  }

  function handleCheckout() {
    if (cartItems.length === 0) {
      alert('장바구니가 비어있습니다.')
      return
    }
    navigate('/checkout')
  }

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price_snapshot * item.quantity, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            장바구니
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {cartItems.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-6">장바구니가 비어있습니다.</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              쇼핑 계속하기
            </button>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="space-y-4 mb-6">
              {cartItems.map((item) => (
                <div key={item.id} className="bg-white rounded-lg shadow-sm p-4 flex gap-4">
                  {/* Product Image */}
                  <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.product_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/80?text=No+Image'
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        이미지 없음
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 mb-1 truncate">{item.product_name}</h3>
                    {item.option_value && (
                      <p className="text-sm text-gray-500 mb-2">옵션: {item.option_value}</p>
                    )}
                    <p className="text-lg font-bold text-gray-900">
                      {(item.price_snapshot * item.quantity).toLocaleString()}원
                    </p>
                  </div>

                  {/* Quantity & Remove */}
                  <div className="flex flex-col items-end justify-between">
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={updating}
                      className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2 border rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={updating || item.quantity <= 1}
                        className="p-2 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={updating}
                        className="p-2 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total & Checkout */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600">총 {cartItems.length}개 상품</span>
                <div className="text-right">
                  <p className="text-sm text-gray-500 mb-1">총 결제금액</p>
                  <p className="text-2xl font-bold text-gray-900">{totalAmount.toLocaleString()}원</p>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={updating}
                className="w-full py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? '처리중...' : '주문하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
