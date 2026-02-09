import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AlertCircle, Package } from 'lucide-react'

interface CartItem {
  id: number
  product_id: number
  product_name: string
  image_url: string
  quantity: number
  price_snapshot: number
  option_value?: string
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const SHIPPING_FEE = 3000

  useEffect(() => {
    loadCart()
  }, [])

  async function loadCart() {
    try {
      const userId = localStorage.getItem('userId')
      
      if (!userId) {
        setError('로그인이 필요합니다.')
        setLoading(false)
        return
      }

      const response = await axios.get(`/api/cart/${userId}`)
      
      if (response.data.success) {
        setCartItems(response.data.data || [])
      } else {
        setError('장바구니를 불러올 수 없습니다.')
      }
    } catch (err: any) {
      console.error('Failed to load cart:', err)
      setError('장바구니를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price_snapshot * item.quantity,
    0
  )
  const totalAmount = subtotal + SHIPPING_FEE

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007aff]"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">오류가 발생했습니다</h2>
          <p className="text-[#6e6e73] mb-6">{error}</p>
          <Button onClick={() => navigate('/')}>메인으로 돌아가기</Button>
        </div>
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <Package className="h-16 w-16 text-[#6e6e73] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">장바구니가 비어있습니다</h2>
          <p className="text-[#6e6e73] mb-6">상품을 담아주세요</p>
          <Button onClick={() => navigate('/')}>쇼핑 계속하기</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#d2d2d7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <Link to="/" className="flex items-center space-x-2 text-[#007aff] hover:text-[#0051d5] transition-colors">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base font-medium">뒤로</span>
            </Link>
            <h1 className="text-base sm:text-lg font-semibold text-[#1d1d1f]">주문 확인</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* 결제 서비스 준비중 안내 */}
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-yellow-900 mb-1">결제 기능 준비중</h3>
              <p className="text-sm text-yellow-800">
                현재 결제 서비스를 준비하고 있습니다. 주문은 고객센터(0507-0177-0432)로 문의해주세요.
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* 주문 상품 목록 */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold text-[#1d1d1f] mb-4">주문 상품</h2>
            
            {cartItems.map((item) => (
              <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex gap-4">
                  <img
                    src={item.image_url || 'https://via.placeholder.com/100x100/f5f5f7/6e6e73?text=Product'}
                    alt={item.product_name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-[#1d1d1f] mb-1">{item.product_name}</h3>
                    {item.option_value && (
                      <p className="text-sm text-[#6e6e73] mb-2">옵션: {item.option_value}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6e6e73]">수량: {item.quantity}개</span>
                      <span className="font-semibold text-[#1d1d1f]">
                        {(item.price_snapshot * item.quantity).toLocaleString()}원
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 결제 금액 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 shadow-sm sticky top-24">
              <h2 className="text-lg font-semibold text-[#1d1d1f] mb-4">결제 금액</h2>
              
              <div className="space-y-3 mb-4 pb-4 border-b border-[#d2d2d7]">
                <div className="flex justify-between text-sm">
                  <span className="text-[#6e6e73]">상품 금액</span>
                  <span className="text-[#1d1d1f]">{subtotal.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6e6e73]">배송비</span>
                  <span className="text-[#1d1d1f]">
                    {SHIPPING_FEE.toLocaleString()}원
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center mb-6">
                <span className="text-lg font-semibold text-[#1d1d1f]">총 결제금액</span>
                <span className="text-2xl font-bold text-[#007aff]">
                  {totalAmount.toLocaleString()}원
                </span>
              </div>

              <Button
                onClick={() => alert('결제 서비스 준비 중입니다.\n고객센터(0507-0177-0432)로 문의해주세요.')}
                className="w-full bg-[#007aff] hover:bg-[#0051d5] text-white h-12 rounded-lg text-base font-semibold"
              >
                주문 문의하기
              </Button>

              <p className="text-xs text-[#6e6e73] text-center mt-4">
                고객센터: 0507-0177-0432
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
