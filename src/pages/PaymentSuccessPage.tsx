import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { CheckCircle, Package, AlertCircle } from 'lucide-react'
import { getUserId } from '@/utils/auth'

export default function PaymentSuccessPage() {
  console.log('🚀🚀🚀 PaymentSuccessPage 컴포넌트 로드됨!')
  console.log('🚀🚀🚀 URL:', window.location.href)
  
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
  
  console.log('🚀🚀🚀 URL 파라미터:', { paymentKey, orderId, amount })

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      setError('결제 정보가 유효하지 않습니다.')
      setLoading(false)
      return
    }

    // 🔒 중복 호출 방지: 이미 처리 중이면 무시
    if (isProcessing) {
      console.log('[PaymentSuccess] ⚠️ 이미 처리 중 - 중복 호출 무시')
      return
    }

    // 백엔드에 결제 승인 요청
    confirmPayment()
  }, [paymentKey, orderId, amount])

  async function confirmPayment() {
    // 🔒 중복 호출 방지
    setIsProcessing(true)
    
    try {
      console.log('========================================')
      console.log('[PaymentSuccess] 🚀 결제 승인 프로세스 시작')
      console.log('========================================')
      console.log('[PaymentSuccess] 📋 URL 파라미터:')
      console.log('  - paymentKey:', paymentKey)
      console.log('  - orderId:', orderId)
      console.log('  - amount:', amount)
      console.log('  - timestamp:', new Date().toISOString())
      
      // 1️⃣ 사용자 정보 확인
      console.log('[PaymentSuccess] 1️⃣ 사용자 정보 확인 중...')
      const userId = getUserId()
      console.log('[PaymentSuccess] getUserId() 결과:', userId)
      
      // 🎯 데모 모드 감지: userId가 없으면 데모 결제로 간주
      if (!userId) {
        console.log('[PaymentSuccess] ⚠️ userId가 없음!')
        console.log('[PaymentSuccess] 🎭 데모 모드 - 간단한 성공 메시지만 표시')
        console.log('[PaymentSuccess] ❌ 토스페이먼츠에 결제 승인 요청하지 않음')
        console.log('[PaymentSuccess] ❌ 따라서 개발자센터에 결제 내역이 표시되지 않음')
        setOrderInfo({
          orderId: orderId,
          method: '테스트',
          status: 'demo'
        })
        setLoading(false)
        return
      }

      console.log('[PaymentSuccess] ✅ userId 확인:', userId)

      // 2️⃣ 장바구니 조회 (주문 데이터 생성을 위해 필수)
      console.log('[PaymentSuccess] 2️⃣ 장바구니 조회 중...')
      console.log('[PaymentSuccess] API 호출: GET /api/cart/' + userId)
      const cartResponse = await axios.get(`/api/cart/${userId}`)
      console.log('[PaymentSuccess] 장바구니 API 응답:', cartResponse.data)
      let cartItems = cartResponse.data?.data || []
      console.log('[PaymentSuccess] 장바구니 아이템 개수:', cartItems.length)
      
      // 💾 장바구니가 비어있으면 localStorage 백업에서 복원
      if (cartItems.length === 0) {
        console.log('[PaymentSuccess] ⚠️ 장바구니가 비어있음 - localStorage 백업 확인 중...')
        const cartBackup = localStorage.getItem('checkoutCartBackup')
        console.log('[PaymentSuccess] localStorage.getItem("checkoutCartBackup"):', cartBackup ? '데이터 있음' : '데이터 없음')
        
        if (cartBackup) {
          try {
            cartItems = JSON.parse(cartBackup)
            console.log('[PaymentSuccess] ✅ localStorage 백업에서 복원 성공!')
            console.log('[PaymentSuccess] 복원된 상품 개수:', cartItems.length)
            console.log('[PaymentSuccess] 복원된 데이터:', cartItems)
          } catch (e) {
            console.error('[PaymentSuccess] ❌ 백업 파싱 실패:', e)
          }
        } else {
          console.error('[PaymentSuccess] ❌ localStorage에 백업 데이터 없음!')
        }
        
        // 여전히 비어있으면 에러
        if (cartItems.length === 0) {
          console.error('[PaymentSuccess] ❌❌❌ 심각: 주문 데이터를 찾을 수 없음!')
          console.error('[PaymentSuccess] 장바구니도 비어있고, localStorage 백업도 없음')
          console.error('[PaymentSuccess] 결제 승인을 중단합니다.')
          setError('주문 정보를 찾을 수 없습니다. 다시 시도해주세요.')
          return
        }
      } else {
        console.log('[PaymentSuccess] ✅ 장바구니에 상품 있음:', cartItems.length, '개')
      }

      // 3️⃣ 주문 데이터 생성 (결제 승인 전에 필수!)
      console.log('[PaymentSuccess] 3️⃣ 주문 데이터 생성 중...')
      
      // localStorage에서 배송지 정보 가져오기
      const shippingAddress = localStorage.getItem('checkoutShippingAddress') || ''
      const recipientName = localStorage.getItem('checkoutRecipientName') || ''
      const recipientPhone = localStorage.getItem('checkoutRecipientPhone') || ''
      
      console.log('[PaymentSuccess] 배송지 정보:')
      console.log('  - shippingAddress:', shippingAddress)
      console.log('  - recipientName:', recipientName)
      console.log('  - recipientPhone:', recipientPhone)

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

      console.log('[PaymentSuccess] 주문 생성 요청 데이터:', orderData)
      console.log('[PaymentSuccess] API 호출: POST /api/orders')

      // DB에 주문 생성
      const orderCreateResponse = await axios.post('/api/orders', orderData)
      console.log('[PaymentSuccess] 주문 생성 API 응답:', orderCreateResponse.data)

      if (!orderCreateResponse.data.success) {
        console.error('[PaymentSuccess] ❌ 주문 생성 실패!')
        console.error('[PaymentSuccess] 에러 상세:', orderCreateResponse.data)
        setError('주문 생성에 실패했습니다.')
        return
      }

      console.log('[PaymentSuccess] ✅ 주문 생성 완료!')
      console.log('[PaymentSuccess] 생성된 주문 ID:', orderCreateResponse.data.data?.orderId)

      // 4️⃣ 결제 승인 요청 (주문 생성 후!)
      console.log('[PaymentSuccess] 4️⃣ 결제 승인 요청 중...')
      console.log('[PaymentSuccess] 🔑 중요: 이제 토스페이먼츠 API를 호출합니다!')
      console.log('[PaymentSuccess] API 호출: POST /api/payments/confirm')
      
      const confirmData = {
        paymentKey,
        orderId,
        amount: Number(amount) // ✅ 명시적으로 Number 타입으로 변환
      }
      console.log('[PaymentSuccess] 결제 승인 요청 데이터:', confirmData)
      console.log('[PaymentSuccess] 📊 amount 타입:', typeof confirmData.amount)
      console.log('[PaymentSuccess] 📊 amount 값:', confirmData.amount)
      
      const response = await axios.post('/api/payments/confirm', confirmData)

      console.log('[PaymentSuccess] 결제 승인 API 응답:', response.data)

      if (!response.data.success) {
        console.error('[PaymentSuccess] ❌ 결제 승인 실패!')
        console.error('[PaymentSuccess] 에러 상세:', response.data.error)
        setError(response.data.error || '결제 승인에 실패했습니다.')
        return
      }

      const paymentData = response.data.data
      setOrderInfo(paymentData)
      console.log('[PaymentSuccess] ✅✅✅ 결제 승인 완료!')
      console.log('[PaymentSuccess] 결제 데이터:', paymentData)
      console.log('[PaymentSuccess] 🎉 토스페이먼츠 개발자센터에 결제 내역이 표시됩니다!')
      
      // 5️⃣ 장바구니 비우기 및 백업 삭제
      console.log('[PaymentSuccess] 5️⃣ 장바구니 비우기 시도 중...')
      try {
        if (cartItems.length > 0) {
          console.log('[PaymentSuccess] API 호출: DELETE /api/cart/clear/' + userId)
          await axios.delete(`/api/cart/clear/${userId}`)
          console.log('[PaymentSuccess] ✅ 장바구니 비우기 완료')
        }
        localStorage.removeItem('hasCartItems')
        localStorage.removeItem('checkoutCartBackup')  // 백업 삭제
        console.log('[PaymentSuccess] ✅ 백업 데이터 삭제 완료')
      } catch (cartErr) {
        console.error('[PaymentSuccess] ⚠️ 장바구니 처리 실패:', cartErr)
      }

      // 6️⃣ 배송지 정보 localStorage 정리
      localStorage.removeItem('checkoutShippingAddress')
      localStorage.removeItem('checkoutRecipientName')
      localStorage.removeItem('checkoutRecipientPhone')

    } catch (err: any) {
      console.error('[PaymentSuccess] ❌ 결제 승인 실패:', err)
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
    <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#e5e5e7]">
          {/* 성공 아이콘 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-[#1d1d1f] mb-2">결제 완료!</h1>
            <p className="text-[#6e6e73]">주문이 성공적으로 완료되었습니다.</p>
          </div>

          {/* 주문 정보 */}
          {orderInfo && (
            <div className="space-y-6">
              <div className="bg-[#f5f5f7] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-[#1d1d1f] mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-[#007aff]" />
                  주문 정보
                </h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#6e6e73]">주문번호</span>
                    <span className="text-sm font-semibold text-[#1d1d1f] font-mono">
                      {orderInfo.orderId || orderId}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#6e6e73]">결제 방법</span>
                    <span className="text-sm font-semibold text-[#1d1d1f]">
                      {orderInfo.method || '카드'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-[#d2d2d7]">
                    <span className="text-base font-medium text-[#1d1d1f]">결제 금액</span>
                    <span className="text-2xl font-bold text-[#007aff]">
                      {parseInt(amount || '0').toLocaleString()}원
                    </span>
                  </div>
                </div>
              </div>

              {/* 안내 메시지 */}
              {orderInfo?.status === 'demo' ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-sm text-yellow-900">
                    🎭 <strong>데모 모드</strong>: 실제 결제가 진행되지 않았습니다. 테스트 목적으로만 사용하세요.
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-900">
                    🎉 주문이 접수되었습니다. 배송은 영업일 기준 3~5일 소요됩니다.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="mt-8 flex gap-3">
            {orderInfo?.status === 'demo' ? (
              <>
                <Button
                  onClick={() => navigate('/payment/demo')}
                  className="flex-1 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] h-12"
                >
                  다시 테스트하기
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  className="flex-1 bg-gradient-to-r from-[#007aff] to-[#0051d5] hover:from-[#0051d5] hover:to-[#003d99] text-white h-12"
                >
                  메인으로
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => navigate('/my-orders')}
                  className="flex-1 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] h-12"
                >
                  주문 내역 보기
                </Button>
                <Button
                  onClick={() => {
                    // 마지막으로 본 라이브 페이지로 복귀
                    const lastLiveId = localStorage.getItem('lastViewedLiveId')
                    if (lastLiveId) {
                      navigate(`/live/${lastLiveId}`)
                    } else {
                      navigate('/')
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-[#007aff] to-[#0051d5] hover:from-[#0051d5] hover:to-[#003d99] text-white h-12"
                >
                  쇼핑 계속하기
                </Button>
              </>
            )}
          </div>

          {/* 고객센터 정보 */}
          <div className="mt-6 text-center">
            <p className="text-xs text-[#86868b] mb-1">
              궁금한 점이 있으신가요?
            </p>
            <p className="text-sm font-semibold text-[#1d1d1f]">
              📞 고객센터: 0507-0177-0432
            </p>
            <p className="text-xs text-[#86868b] mt-1">
              평일 09:00 - 18:00
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
