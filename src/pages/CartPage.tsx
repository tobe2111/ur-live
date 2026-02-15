import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Trash2, ShoppingBag, ArrowLeft, Minus, Plus, X, AlertCircle, CheckCircle } from 'lucide-react'
import { requireLogin, getUserId, isLoggedIn } from '@/utils/auth'
import MobileFooter from '@/components/MobileFooter'

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

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void
  title?: string
  message: string
  type?: 'alert' | 'confirm' | 'error' | 'success'
}

function CustomModal({ isOpen, onClose, onConfirm, title, message, type = 'alert' }: ModalProps) {
  if (!isOpen) return null

  const isConfirm = type === 'confirm'
  const isError = type === 'error'
  const isSuccess = type === 'success'

  const getIcon = () => {
    if (isSuccess) return <CheckCircle className="w-12 h-12 text-green-500" strokeWidth={1.5} />
    if (isError) return <AlertCircle className="w-12 h-12 text-red-500" strokeWidth={1.5} />
    return <AlertCircle className="w-12 h-12 text-gray-400" strokeWidth={1.5} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          {getIcon()}
        </div>

        {/* Title */}
        {title && (
          <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
            {title}
          </h3>
        )}

        {/* Message */}
        <p className="text-sm text-gray-600 text-center mb-6 leading-relaxed">
          {message}
        </p>

        {/* Buttons */}
        <div className={`flex gap-3 ${isConfirm ? 'flex-row' : 'flex-col'}`}>
          {isConfirm ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-full hover:bg-gray-200 transition-colors text-sm"
              >
                취소
              </button>
              <button
                onClick={() => {
                  onConfirm?.()
                  onClose()
                }}
                className="flex-1 py-3 px-4 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors text-sm"
              >
                확인
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors text-sm"
            >
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CartPage() {
  const navigate = useNavigate()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  // Modal states
  const [modal, setModal] = useState<{
    isOpen: boolean
    title?: string
    message: string
    type?: 'alert' | 'confirm' | 'error' | 'success'
    onConfirm?: () => void
  }>({
    isOpen: false,
    message: '',
  })

  const showAlert = (message: string, type: 'alert' | 'error' | 'success' = 'alert', title?: string) => {
    setModal({
      isOpen: true,
      title,
      message,
      type,
    })
  }

  const showConfirm = (message: string, onConfirm: () => void, title?: string) => {
    setModal({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      onConfirm,
    })
  }

  const closeModal = () => {
    setModal({
      isOpen: false,
      message: '',
    })
  }

  useEffect(() => {
    loadCart()
  }, [])

  async function loadCart() {
    try {
      // 통합 인증 체크
      if (!isLoggedIn()) {
        requireLogin(navigate, '장바구니를 보려면 로그인이 필요합니다.')
        return
      }
      
      const userId = getUserId()
      if (!userId) {
        requireLogin(navigate, '장바구니를 보려면 로그인이 필요합니다.')
        return
      }

      const response = await api.get(`/api/cart/${userId}`)
      const items = response.data?.data || []
      setCartItems(items)
      
      // Update hasCartItems flag
      localStorage.setItem('hasCartItems', items.length > 0 ? 'true' : 'false')
    } catch (error) {
      console.error('Failed to load cart:', error)
      showAlert('장바구니를 불러오는데 실패했습니다.', 'error', '오류')
    } finally {
      setLoading(false)
    }
  }

  async function updateQuantity(cartItemId: number, newQuantity: number) {
    if (newQuantity < 1) return
    if (updating) return

    setUpdating(true)
    try {
      await api.put(`/api/cart/${cartItemId}`, { quantity: newQuantity })
      await loadCart()
    } catch (error: any) {
      console.error('Failed to update quantity:', error)
      showAlert(
        error.response?.data?.error || '수량 변경에 실패했습니다.',
        'error',
        '수량 변경 실패'
      )
    } finally {
      setUpdating(false)
    }
  }

  async function removeItem(cartItemId: number) {
    if (updating) return

    showConfirm(
      '이 상품을 장바구니에서 삭제하시겠습니까?',
      async () => {
        setUpdating(true)
        try {
          await api.delete(`/api/cart/${cartItemId}`)
          await loadCart()
          showAlert('상품이 삭제되었습니다.', 'success')
        } catch (error: any) {
          console.error('Failed to remove item:', error)
          showAlert(
            error.response?.data?.error || '상품 삭제에 실패했습니다.',
            'error',
            '삭제 실패'
          )
        } finally {
          setUpdating(false)
        }
      },
      '상품 삭제'
    )
  }

  function handleCheckout() {
    if (cartItems.length === 0) {
      showAlert('장바구니가 비어있습니다.', 'alert', '장바구니 비어있음')
      return
    }
    navigate('/checkout')
  }

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price_snapshot * item.quantity, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400 text-sm">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Custom Modal */}
      <CustomModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      {/* Header - 미니멀 스타일 (반응형) */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="p-1 hover:opacity-60 transition-opacity"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" strokeWidth={1.5} />
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-gray-900 tracking-tight">
            장바구니
          </h1>
          <div className="w-6"></div> {/* Spacer for center alignment */}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex-1 overflow-y-auto pb-32">
        {cartItems.length === 0 ? (
          <div className="text-center py-24">
            <ShoppingBag className="w-16 h-16 sm:w-20 sm:h-20 text-gray-200 mx-auto mb-4 sm:mb-6" strokeWidth={1.5} />
            <p className="text-gray-400 text-sm sm:text-base mb-6 sm:mb-8">장바구니가 비어있습니다.</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 sm:px-8 sm:py-3.5 bg-gray-900 text-white text-sm sm:text-base font-medium rounded-full hover:bg-gray-800 transition-colors"
            >
              쇼핑 계속하기
            </button>
          </div>
        ) : (
          <>
            {/* Cart Items - 트렌디한 카드 디자인 */}
            <div className="space-y-4 mb-8">
              {cartItems.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-[#F9F9F9] rounded-2xl p-4 sm:p-5 flex flex-col gap-3 sm:gap-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Product Info - 썸네일 제거 */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 mb-2 text-sm sm:text-base leading-tight">
                        {item.product_name}
                      </h3>
                      {item.option_value && (
                        <p className="text-xs text-gray-500 mb-3 bg-white px-3 py-1.5 rounded-full inline-block">
                          {item.option_value}
                        </p>
                      )}
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={updating}
                      className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 p-1"
                    >
                      <Trash2 className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                  </div>

                  {/* Price & Quantity - 나란히 배치 */}
                  <div className="flex items-center justify-between">
                    {/* Price */}
                    <div>
                      <p className="text-lg sm:text-xl font-bold text-gray-900">
                        {(item.price_snapshot * item.quantity).toLocaleString()}
                        <span className="text-sm font-normal ml-0.5">원</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        개당 {item.price_snapshot.toLocaleString()}원
                      </p>
                    </div>

                    {/* Quantity Controller - 원형 미니멀 스타일 */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={updating || item.quantity <= 1}
                        className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                      >
                        <Minus className="w-3.5 h-3.5 text-gray-700" strokeWidth={2} />
                      </button>
                      <span className="w-6 text-center font-semibold text-gray-900 text-sm">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={updating}
                        className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-gray-900 flex items-center justify-center hover:bg-gray-800 disabled:opacity-50 transition-all shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Fixed Bottom Section - 결제 섹션 */}
            <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20 mt-auto">
              <div className="px-4 sm:px-6 py-4 sm:py-5">
                {/* Total Summary */}
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">
                      총 {cartItems.length}개 상품
                    </p>
                    <p className="text-xs text-gray-500">
                      최종 결제금액
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                      {totalAmount.toLocaleString()}
                      <span className="text-base font-normal ml-1">원</span>
                    </p>
                  </div>
                </div>

                {/* Checkout Button */}
                <button
                  onClick={handleCheckout}
                  disabled={updating}
                  className="w-full py-3 sm:py-4 bg-gray-900 text-white text-sm sm:text-base font-semibold rounded-full hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {updating ? '처리중...' : '주문하기'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add animations to global CSS */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>

      {/* Mobile Footer */}
      <MobileFooter />
    </div>
  )
}
