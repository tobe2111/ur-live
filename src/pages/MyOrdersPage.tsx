import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  Package, 
  ShoppingCart,
  MapPin,
  CreditCard,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  User,
  Settings,
  LogOut,
  Plus,
  Minus,
  Trash2
} from 'lucide-react'

interface CartItem {
  id: number
  product_id: number
  product_name: string
  image_url: string
  quantity: number
  price_snapshot: number
  option_value?: string
}

interface Order {
  id: number
  order_number: string
  total_amount: number
  status: string
  shipping_address: string
  shipping_name: string
  shipping_phone: string
  created_at: string
  updated_at: string
}

type TabType = 'cart' | 'orders' | 'profile'

export default function MyOrdersPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('cart')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  // Get user info from localStorage
  const userName = localStorage.getItem('user_name') || '게스트'
  const userEmail = localStorage.getItem('user_email') || ''
  const userProfileImage = localStorage.getItem('user_profile_image') || ''

  useEffect(() => {
    loadData()
  }, [activeTab])

  async function loadData() {
    setLoading(true)
    try {
      const userId = localStorage.getItem('user_id') || '1'
      
      if (activeTab === 'cart') {
        const response = await axios.get(`/api/cart/${userId}`)
        if (response.data.success) {
          setCartItems(response.data.data || [])
        }
      } else if (activeTab === 'orders') {
        // TODO: Implement orders API
        // const response = await axios.get(`/api/orders/${userId}`)
        // if (response.data.success) {
        //   setOrders(response.data.data || [])
        // }
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateQuantity(itemId: number, newQuantity: number) {
    if (newQuantity < 1) return

    try {
      const response = await axios.put(`/api/cart/${itemId}`, { quantity: newQuantity })
      if (response.data.success) {
        loadData()
      }
    } catch (error) {
      console.error('Failed to update quantity:', error)
      alert('수량 변경에 실패했습니다.')
    }
  }

  async function handleRemoveItem(itemId: number) {
    if (!confirm('장바구니에서 삭제하시겠습니까?')) return

    try {
      const response = await axios.delete(`/api/cart/${itemId}`)
      if (response.data.success) {
        loadData()
      }
    } catch (error) {
      console.error('Failed to remove item:', error)
      alert('삭제에 실패했습니다.')
    }
  }

  function handleCheckout() {
    if (cartItems.length === 0) {
      alert('장바구니가 비어있습니다.')
      return
    }
    navigate('/checkout')
  }

  function handleLogout() {
    if (confirm('로그아웃 하시겠습니까?')) {
      localStorage.removeItem('user_session_token')
      localStorage.removeItem('user_id')
      localStorage.removeItem('user_name')
      localStorage.removeItem('user_email')
      localStorage.removeItem('user_profile_image')
      navigate('/')
    }
  }

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price_snapshot * item.quantity, 0)

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      {/* Header */}
      <header className="apple-glass sticky top-0 z-50 border-b border-[#e5e5ea]">
        <div className="max-w-[980px] mx-auto px-4 sm:px-6">
          <div className="flex h-[52px] items-center justify-between">
            <Link 
              to="/"
              className="flex items-center space-x-2 text-[#1d1d1f] hover:opacity-60 transition-opacity"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-[14px] font-normal hidden sm:inline">홈으로</span>
            </Link>
            <h1 className="text-[17px] font-semibold text-[#1d1d1f]">
              마이페이지
            </h1>
            <div className="w-16"></div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-[#e5e5ea]">
        <div className="max-w-[980px] mx-auto px-4 sm:px-6">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('cart')}
              className={`
                flex-1 py-3 px-4 text-[15px] font-medium transition-all relative
                ${activeTab === 'cart' 
                  ? 'text-[#007aff]' 
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }
              `}
            >
              <ShoppingCart className="h-4 w-4 inline mr-2" />
              장바구니
              {activeTab === 'cart' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007aff]"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`
                flex-1 py-3 px-4 text-[15px] font-medium transition-all relative
                ${activeTab === 'orders' 
                  ? 'text-[#007aff]' 
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }
              `}
            >
              <Package className="h-4 w-4 inline mr-2" />
              주문내역
              {activeTab === 'orders' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007aff]"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`
                flex-1 py-3 px-4 text-[15px] font-medium transition-all relative
                ${activeTab === 'profile' 
                  ? 'text-[#007aff]' 
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }
              `}
            >
              <User className="h-4 w-4 inline mr-2" />
              프로필
              {activeTab === 'profile' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007aff]"></div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-[980px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007aff] mx-auto mb-4"></div>
              <p className="text-[17px] text-[#6e6e73]">로딩 중...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Cart Tab */}
            {activeTab === 'cart' && (
              <div className="space-y-6">
                {cartItems.length === 0 ? (
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
                ) : (
                  <>
                    <div className="apple-card divide-y divide-[#e5e5ea]">
                      {cartItems.map(item => (
                        <div key={item.id} className="p-4 sm:p-6 flex gap-4">
                          <img
                            src={item.image_url || 'https://via.placeholder.com/100'}
                            alt={item.product_name}
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100'
                            }}
                          />
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
                                  onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                  className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e5e5ea] transition-colors disabled:opacity-30"
                                >
                                  <Minus className="h-4 w-4 text-[#1d1d1f]" />
                                </button>
                                <span className="text-[15px] font-medium text-[#1d1d1f] w-8 text-center">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                  className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e5e5ea] transition-colors"
                                >
                                  <Plus className="h-4 w-4 text-[#1d1d1f]" />
                                </button>
                              </div>
                              <button
                                onClick={() => handleRemoveItem(item.id)}
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
                          <span className="text-[15px] font-medium text-[#1d1d1f]">
                            {totalAmount.toLocaleString()}원
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[15px] text-[#6e6e73]">배송비</span>
                          <span className="text-[15px] font-medium text-[#1d1d1f]">
                            {totalAmount >= 30000 ? '무료' : '3,000원'}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-baseline pt-6 mb-6">
                        <span className="text-[17px] font-semibold text-[#1d1d1f]">
                          총 결제 금액
                        </span>
                        <div className="text-right">
                          <span className="text-[28px] font-bold text-[#1d1d1f]">
                            {(totalAmount + (totalAmount >= 30000 ? 0 : 3000)).toLocaleString()}
                          </span>
                          <span className="text-[17px] font-medium text-[#6e6e73]">원</span>
                        </div>
                      </div>

                      <button
                        onClick={handleCheckout}
                        className="apple-button w-full py-4"
                      >
                        주문하기 ({cartItems.length}개)
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                {orders.length === 0 ? (
                  <div className="apple-card p-12 text-center">
                    <div className="w-24 h-24 bg-[#f5f5f7] rounded-full flex items-center justify-center mx-auto mb-6">
                      <Package className="h-12 w-12 text-[#6e6e73]" />
                    </div>
                    <h2 className="text-[28px] font-semibold text-[#1d1d1f] mb-4">
                      주문 내역이 없습니다
                    </h2>
                    <p className="text-[17px] text-[#6e6e73] mb-8">
                      라이브에서 마음에 드는 상품을 구매해보세요
                    </p>
                    <Button className="apple-button" asChild>
                      <Link to="/">라이브 보러가기</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map(order => (
                      <div key={order.id} className="apple-card p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <p className="text-[13px] text-[#6e6e73] mb-1">
                              {new Date(order.created_at).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            <p className="text-[15px] font-semibold text-[#1d1d1f]">
                              주문번호: {order.order_number}
                            </p>
                          </div>
                          <Badge 
                            className={`
                              border-0 px-3 py-1
                              ${order.status === 'delivered' 
                                ? 'bg-[#34c759] text-white' 
                                : order.status === 'shipping'
                                ? 'bg-[#007aff] text-white'
                                : 'bg-[#ff9500] text-white'
                              }
                            `}
                          >
                            {order.status === 'delivered' 
                              ? '배송완료' 
                              : order.status === 'shipping'
                              ? '배송중'
                              : '준비중'
                            }
                          </Badge>
                        </div>

                        <div className="p-4 bg-[#f5f5f7] rounded-xl mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-[#6e6e73]" />
                            <span className="text-[14px] font-medium text-[#1d1d1f]">
                              {order.shipping_name}
                            </span>
                          </div>
                          <p className="text-[14px] text-[#6e6e73] ml-6">
                            {order.shipping_address}
                          </p>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[19px] font-bold text-[#1d1d1f]">
                            {order.total_amount.toLocaleString()}원
                          </span>
                          <button className="flex items-center text-[15px] text-[#007aff] font-medium hover:opacity-60 transition-opacity">
                            상세보기
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                {/* Profile Card */}
                <div className="apple-card p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <img
                      src={userProfileImage || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName)}
                      alt={userName}
                      className="w-20 h-20 rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName)
                      }}
                    />
                    <div>
                      <h2 className="text-[21px] font-semibold text-[#1d1d1f] mb-1">
                        {userName}
                      </h2>
                      {userEmail && (
                        <p className="text-[15px] text-[#6e6e73]">
                          {userEmail}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-[#f5f5f7] transition-colors">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-[#6e6e73]" />
                        <span className="text-[15px] font-medium text-[#1d1d1f]">
                          배송지 관리
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-[#6e6e73]" />
                    </button>

                    <button className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-[#f5f5f7] transition-colors">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-[#6e6e73]" />
                        <span className="text-[15px] font-medium text-[#1d1d1f]">
                          결제 수단
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-[#6e6e73]" />
                    </button>

                    <button className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-[#f5f5f7] transition-colors">
                      <div className="flex items-center gap-3">
                        <Settings className="h-5 w-5 text-[#6e6e73]" />
                        <span className="text-[15px] font-medium text-[#1d1d1f]">
                          설정
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-[#6e6e73]" />
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="apple-card overflow-hidden">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-4 hover:bg-[#f5f5f7] transition-colors text-[#ff3b30]"
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="text-[15px] font-medium">
                      로그아웃
                    </span>
                  </button>
                </div>

                {/* App Info */}
                <div className="text-center pt-4">
                  <p className="text-[13px] text-[#8e8e93]">
                    유어 라이브 커머스 v2.1.0
                  </p>
                  <p className="text-[13px] text-[#8e8e93] mt-1">
                    © 2026 Your Live Commerce
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
