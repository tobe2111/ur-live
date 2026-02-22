import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { CheckCircle, Package, AlertCircle } from 'lucide-react'
import { getUserId } from '@/utils/auth'

export default function PaymentSuccessPage() {
  
  // 🔥 디버그: 페이지 타이틀로 로드 확인
  document.title = '🚀 PaymentSuccess LOADED - ' + new Date().toISOString()
  
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orderInfo, setOrderInfo] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false) // 중복 호출 방지

  // URL 파라미터에서 결제 정보 추출
  const paymentKey = searchParams.get('paymentKey')
  const orderId = searchParams.get('orderId')
  const amount = searchParams.get('amount')
  

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      setError('결제 정보가 유효하지 않습니다.')
      setLoading(false)
      return
    }

    // 🔒 중복 호출 방지: 이미 처리 중이면 무시
    if (isProcessing) {
      return
    }

    // 백엔드에 결제 승인 요청
    confirmPayment()
  }, [paymentKey, orderId, amount])

  async function confirmPayment() {
    // 🔒 중복 호출 방지
    setIsProcessing(true)
    
    try {
      
      // 1️⃣ 사용자 정보 확인
      const userId = getUserId()
      
      // 🎯 데모 모드 감지: userId가 없으면 데모 결제로 간주
      if (!userId) {
        setOrderInfo({
          orderId: orderId,
          method: '테스트',
          status: 'demo'
        })
        setLoading(false)
        return
      }


      // 2️⃣ 장바구니 조회 (주문 데이터 생성을 위해 필수)
      const cartResponse = await api.get('/api/cart')
      let cartItems = cartResponse.data?.data || []
      
      // 💾 장바구니가 비어있으면 localStorage 백업에서 복원
      if (cartItems.length === 0) {
        const cartBackup = localStorage.getItem('checkoutCartBackup')
        
        if (cartBackup) {
          try {
            cartItems = JSON.parse(cartBackup)
          } catch (e) {
          }
        } else {
        }
        
        // 여전히 비어있으면 에러
        if (cartItems.length === 0) {
          setError('주문 정보를 찾을 수 없습니다. 다시 시도해주세요.')
          return
        }
      } else {
      }

      // 3️⃣ 주문 데이터 생성 (결제 승인 전에 필수!)
      
      // localStorage에서 배송지 정보 가져오기
      const shippingAddress = localStorage.getItem('checkoutShippingAddress') || ''
      const recipientName = localStorage.getItem('checkoutRecipientName') || ''
      const recipientPhone = localStorage.getItem('checkoutRecipientPhone') || ''
      

      // 주문 아이템 매핑
      const orderItems = cartItems.map((item: any) => ({
        productId: item.product_id,
        quantity: item.quantity,
        price: item.price_snapshot,
        optionValue: item.option_value || null
      }))

      const orderData = {
        userId: userId,
        orderNumber: orderId,
        items: orderItems,
        totalAmount: parseInt(amount || '0'),
        shippingAddress: shippingAddress,
        recipientName: recipientName,
        recipientPhone: recipientPhone,
        status: 'pending'
      }


      // DB에 주문 생성
      const orderCreateResponse = await api.post('/api/orders', orderData)

      if (!orderCreateResponse.data.success) {
        setError('주문 생성에 실패했습니다.')
        return
      }


      // 4️⃣ 결제 승인 요청 (주문 생성 후!)
      
      const confirmData = {
        paymentKey,
        orderId,
        amount: Number(amount) // ✅ 명시적으로 Number 타입으로 변환
      }
      
      const response = await api.post('/api/payments/confirm', confirmData)


      if (!response.data.success) {
        setError(response.data.error || '결제 승인에 실패했습니다.')
        return
      }

      const paymentData = response.data.data
      setOrderInfo(paymentData)
      
      // 5️⃣ 장바구니 비우기 및 백업 삭제
      try {
        if (cartItems.length > 0) {
          await api.delete('/api/cart/clear')
        }
        localStorage.removeItem('hasCartItems')
        localStorage.removeItem('checkoutCartBackup')  // 백업 삭제
      } catch (cartErr) {
      }

      // 6️⃣ 배송지 정보 localStorage 정리
      localStorage.removeItem('checkoutShippingAddress')
      localStorage.removeItem('checkoutRecipientName')
      localStorage.removeItem('checkoutRecipientPhone')

    } catch (err: any) {
      setError(err.response?.data?.error || '결제 승인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      setIsProcessing(false) // 처리 완료
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#007aff] mx-auto mb-4"></div>
          <p className="text-[#6e6e73] font-medium">결제를 승인하는 중입니다...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="h-20 w-20 text-red-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-[#1d1d1f] mb-4">결제 승인 실패</h1>
          <p className="text-[#6e6e73] mb-8">{error}</p>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate('/checkout')}
              className="flex-1 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f]"
            >
              다시 시도
            </Button>
            <Button
              onClick={() => navigate('/')}
              className="flex-1 bg-[#007aff] hover:bg-[#0051d5] text-white"
            >
              메인으로
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center px-4 py-6 sm:p-6 lg:p-8">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-xl sm:rounded-2xl p-5 sm:p-6 lg:p-8 shadow-lg border border-[#e5e5e7]">
          {/* 성공 아이콘 */}
          <div className="text-center mb-5 sm:mb-6 lg:mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-green-100 mb-3 sm:mb-4">
              <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-green-600" />
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#1d1d1f] mb-1 sm:mb-2">결제 완료!</h1>
            <p className="text-xs sm:text-sm lg:text-base text-[#6e6e73]">주문이 성공적으로 완료되었습니다.</p>
          </div>

          {/* 주문 정보 */}
          {orderInfo && (
            <div className="space-y-3 sm:space-y-4 lg:space-y-6">
              <div className="bg-[#f5f5f7] rounded-lg sm:rounded-xl p-4 sm:p-5 lg:p-6">
                <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-[#1d1d1f] mb-3 sm:mb-4 flex items-center gap-2">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-[#007aff]" />
                  주문 정보
                </h2>
                
                <div className="space-y-2.5 sm:space-y-3">
                  {/* 주문번호 - 모바일에서 세로 배치, 데스크톱에서 가로 배치 */}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2">
                    <span className="text-xs sm:text-sm text-[#6e6e73] font-medium">주문번호</span>
                    <span className="text-xs sm:text-sm lg:text-base font-semibold text-[#007aff] font-mono tracking-tight">
                      {orderInfo.orderId || orderId}
                    </span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-[#6e6e73] font-medium">결제 방법</span>
                    <span className="text-xs sm:text-sm lg:text-base font-semibold text-[#1d1d1f]">
                      {orderInfo.method || '테스트'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2.5 sm:pt-3 mt-1 border-t border-[#d2d2d7]">
                    <span className="text-sm sm:text-base lg:text-lg font-medium text-[#1d1d1f]">결제 금액</span>
                    <span className="text-lg sm:text-xl lg:text-2xl font-bold text-[#007aff]">
                      {parseInt(amount || '0').toLocaleString()}원
                    </span>
                  </div>
                </div>
              </div>

              {/* 안내 메시지 */}
              {orderInfo?.status === 'demo' ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-xs sm:text-sm lg:text-base text-yellow-900 leading-relaxed">
                    🎭 <strong>데모 모드</strong>: 실제 결제가 진행되지 않았습니다. 테스트 목적으로만 사용하세요.
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-xs sm:text-sm lg:text-base text-blue-900 leading-relaxed">
                    🎉 <strong>데모 모드</strong>: 실제 결제가 진행되지 않았습니다. 테스트 목적으로만 사용하세요.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="mt-5 sm:mt-6 lg:mt-8 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            {orderInfo?.status === 'demo' ? (
              <>
                <Button
                  onClick={() => navigate('/payment/demo')}
                  className="w-full sm:flex-1 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] h-11 sm:h-12 lg:h-14 text-sm sm:text-base font-medium transition-colors"
                >
                  다시 테스트하기
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  className="w-full sm:flex-1 bg-gradient-to-r from-[#007aff] to-[#0051d5] hover:from-[#0051d5] hover:to-[#003d99] text-white h-11 sm:h-12 lg:h-14 text-sm sm:text-base font-medium transition-all"
                >
                  메인으로
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => navigate('/my-orders')}
                  className="w-full sm:flex-1 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] h-11 sm:h-12 lg:h-14 text-sm sm:text-base font-medium transition-colors"
                >
                  주문 내역 보기
                </Button>
                <Button
                  onClick={() => {
                    const lastLiveId = localStorage.getItem('lastViewedLiveId')
                    if (lastLiveId) {
                      navigate(`/live/${lastLiveId}`)
                    } else {
                      navigate('/')
                    }
                  }}
                  className="w-full sm:flex-1 bg-gradient-to-r from-[#007aff] to-[#0051d5] hover:from-[#0051d5] hover:to-[#003d99] text-white h-11 sm:h-12 lg:h-14 text-sm sm:text-base font-medium transition-all"
                >
                  쇼핑 계속하기
                </Button>
              </>
            )}
          </div>

          {/* 고객센터 정보 */}
          <div className="mt-5 sm:mt-6 lg:mt-8 pt-5 sm:pt-6 border-t border-[#e5e5e7] text-center">
            <p className="text-xs sm:text-sm text-[#86868b] mb-2">
              궁금한 점이 있으신가요?
            </p>
            <p className="text-sm sm:text-base lg:text-lg font-semibold text-[#1d1d1f] mb-1.5">
              📞 고객센터: 0507-0177-0432
            </p>
            <p className="text-xs sm:text-sm text-[#86868b]">
              평일 09:00 - 18:00
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
