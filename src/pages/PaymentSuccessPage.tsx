import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { CheckCircle, Package, AlertCircle } from 'lucide-react'
import { getUserId } from '@/utils/auth'

export default function PaymentSuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orderInfo, setOrderInfo] = useState<any>(null)

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

    // 백엔드에 결제 승인 요청
    confirmPayment()
  }, [paymentKey, orderId, amount])

  async function confirmPayment() {
    try {
      console.log('[PaymentSuccess] 결제 승인 프로세스 시작')
      
      // 1️⃣ 사용자 정보 확인
      const userId = getUserId()
      if (!userId) {
        setError('사용자 정보를 찾을 수 없습니다.')
        return
      }

      // 2️⃣ 장바구니에서 주문 정보 가져오기
      console.log('[PaymentSuccess] 장바구니 조회 중...')
      const cartResponse = await axios.get(`/api/cart/${userId}`)
      const cartItems = cartResponse.data?.data || []

      if (cartItems.length === 0) {
        console.warn('[PaymentSuccess] 장바구니가 비어있습니다.')
        setError('장바구니가 비어있습니다. 결제를 진행할 수 없습니다.')
        return
      }

      // 3️⃣ 주문 생성 요청 (결제 승인 전에 먼저!)
      const orderItems = cartItems.map((item: any) => ({
        productId: item.product_id,
        quantity: item.quantity,
        price: item.price_snapshot,  // ✅ price로 전송 (API가 기대하는 필드명)
        optionValue: item.option_value || null
      }))

      // 배송지 정보는 CheckoutPage에서 localStorage에 저장
      const shippingAddress = localStorage.getItem('checkoutShippingAddress') || ''
      const recipientName = localStorage.getItem('checkoutRecipientName') || ''
      const recipientPhone = localStorage.getItem('checkoutRecipientPhone') || ''

      console.log('[PaymentSuccess] 주문 생성 중...', { orderId, userId })
      
      try {
        await axios.post('/api/orders', {
          userId,
          orderNo: orderId,
          items: orderItems,
          totalAmount: parseInt(amount || '0'),
          shippingAddress: shippingAddress,
          recipientName: recipientName,
          recipientPhone: recipientPhone,
          status: 'pending'  // 결제 승인 전이므로 pending 상태
        })

        console.log('[PaymentSuccess] ✅ 주문 생성 완료:', orderId)
      } catch (orderErr: any) {
        console.error('[PaymentSuccess] ❌ 주문 생성 실패:', orderErr)
        setError(orderErr.response?.data?.error || '주문 생성에 실패했습니다.')
        return  // 주문 생성 실패 시 결제 승인하지 않음
      }

      // 4️⃣ 결제 승인 요청 (주문 생성 후!)
      console.log('[PaymentSuccess] 결제 승인 요청 중...')
      const response = await axios.post('/api/payments/confirm', {
        paymentKey,
        orderId,
        amount: parseInt(amount || '0')
      })

      if (!response.data.success) {
        setError(response.data.error || '결제 승인에 실패했습니다.')
        return
      }

      const paymentData = response.data.data
      setOrderInfo(paymentData)
      console.log('[PaymentSuccess] ✅ 결제 승인 완료:', paymentData)
      
      // 5️⃣ 장바구니 비우기
      console.log('[PaymentSuccess] 장바구니 비우기 중...')
      try {
        await axios.delete(`/api/cart/clear/${userId}`)
        localStorage.removeItem('hasCartItems')
        console.log('[PaymentSuccess] ✅ 장바구니 비우기 완료')
      } catch (cartErr) {
        console.error('[PaymentSuccess] ⚠️ 장바구니 비우기 실패:', cartErr)
        // 장바구니 비우기 실패해도 결제/주문은 성공했으므로 에러는 표시하지 않음
      }

      // 배송지 정보 localStorage 정리
      localStorage.removeItem('checkoutShippingAddress')
      localStorage.removeItem('checkoutRecipientName')
      localStorage.removeItem('checkoutRecipientPhone')

    } catch (err: any) {
      console.error('[PaymentSuccess] ❌ 결제 승인 실패:', err)
      setError(err.response?.data?.error || '결제 승인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
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
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-900">
                  🎉 주문이 접수되었습니다. 배송은 영업일 기준 3~5일 소요됩니다.
                </p>
              </div>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="mt-8 flex gap-3">
            <Button
              onClick={() => navigate('/orders')}
              className="flex-1 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] h-12"
            >
              주문 내역 보기
            </Button>
            <Button
              onClick={() => navigate('/')}
              className="flex-1 bg-gradient-to-r from-[#007aff] to-[#0051d5] hover:from-[#0051d5] hover:to-[#003d99] text-white h-12"
            >
              쇼핑 계속하기
            </Button>
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
