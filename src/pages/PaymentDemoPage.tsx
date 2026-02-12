import { useEffect, useState } from 'react'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'

// 공식 샌드박스 키 (테스트용)
// 실제 운영 시에는 MID urteamizy1의 클라이언트 키로 변경 필요
const clientKey = 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm'

function generateRandomString() {
  return window.btoa(Math.random().toString()).slice(0, 20)
}

export default function PaymentDemoPage() {
  const [amount, setAmount] = useState({
    currency: 'KRW',
    value: 50000
  })
  const [ready, setReady] = useState(false)
  const [widgets, setWidgets] = useState<any>(null)
  const [error, setError] = useState('')

  // Step 1: SDK 초기화
  useEffect(() => {
    async function fetchPaymentWidgets() {
      try {
        console.log('[Demo] Step 1: SDK 초기화 시작')
        console.log('[Demo] clientKey:', clientKey)
        
        const tossPayments = await loadTossPayments(clientKey)
        
        // 데모용 customerKey
        const customerKey = generateRandomString()
        console.log('[Demo] customerKey:', customerKey)
        
        const widgetsInstance = tossPayments.widgets({ customerKey })
        
        setWidgets(widgetsInstance)
        console.log('[Demo] ✅ Step 1 완료')
      } catch (err: any) {
        console.error('[Demo] ❌ Step 1 실패:', err)
        setError(`SDK 초기화 실패: ${err.message}`)
      }
    }

    fetchPaymentWidgets()
  }, [])

  // Step 2: 결제 UI 렌더링
  useEffect(() => {
    async function renderPaymentWidgets() {
      if (widgets == null) {
        return
      }

      try {
        console.log('[Demo] Step 2: 결제 UI 렌더링 시작')
        
        // DOM 대기
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const paymentMethodEl = document.getElementById('payment-method')
        const agreementEl = document.getElementById('agreement')
        
        if (!paymentMethodEl) {
          console.error('[Demo] ❌ #payment-method 요소를 찾을 수 없음')
          setError('결제 UI 컨테이너를 찾을 수 없습니다.')
          return
        }
        
        if (!agreementEl) {
          console.error('[Demo] ❌ #agreement 요소를 찾을 수 없음')
          setError('약관 UI 컨테이너를 찾을 수 없습니다.')
          return
        }
        
        // 금액 설정
        console.log('[Demo] 금액 설정:', amount)
        await widgets.setAmount(amount)
        
        // 결제 수단 렌더링 (MID urteamizy1의 variantKey: Test1)
        console.log('[Demo] 결제 수단 렌더링...')
        await widgets.renderPaymentMethods({
          selector: '#payment-method',
          variantKey: 'Test1'
        })
        
        // 이용약관 렌더링
        console.log('[Demo] 이용약관 렌더링...')
        await widgets.renderAgreement({
          selector: '#agreement',
          variantKey: 'AGREEMENT'
        })
        
        setReady(true)
        console.log('[Demo] ✅ Step 2 완료')
      } catch (err: any) {
        console.error('[Demo] ❌ Step 2 실패:', err)
        setError(`UI 렌더링 실패: ${err.message}`)
      }
    }

    renderPaymentWidgets()
  }, [widgets, amount])

  // Step 3: 금액 변경
  useEffect(() => {
    if (widgets == null || !ready) {
      return
    }

    async function updateAmount() {
      try {
        console.log('[Demo] Step 3: 금액 업데이트', amount)
        await widgets.setAmount(amount)
      } catch (err: any) {
        console.error('[Demo] ❌ Step 3 실패:', err)
      }
    }

    updateAmount()
  }, [amount, widgets, ready])

  // 결제하기
  const handlePayment = async () => {
    if (!widgets || !ready) {
      alert('결제 시스템을 불러오는 중입니다.')
      return
    }

    try {
      const orderId = `ORDER_${Date.now()}_${generateRandomString()}`
      
      console.log('[Demo] 결제 요청:', { orderId, amount: amount.value })
      
      await widgets.requestPayment({
        orderId,
        orderName: '테스트 상품',
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: 'test@example.com',
        customerName: '테스트',
        customerMobilePhone: '01012341234'
      })
    } catch (err: any) {
      console.error('[Demo] ❌ 결제 요청 실패:', err)
      if (err.code === 'USER_CANCEL') {
        alert('결제가 취소되었습니다.')
      } else {
        alert(`결제 오류: ${err.message}`)
      }
    }
  }

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '40px 20px',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '20px' }}>
        토스페이먼츠 결제 데모
      </h1>
      
      {error && (
        <div style={{
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
          color: '#c00'
        }}>
          <strong>⚠️ 오류:</strong> {error}
        </div>
      )}

      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
          결제 정보
        </h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>상품명:</span>
          <strong>테스트 상품</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>결제 금액:</span>
          <strong style={{ color: '#0066ff', fontSize: '20px' }}>
            {amount.value.toLocaleString()}원
          </strong>
        </div>
        
        {/* 쿠폰 적용 */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #dee2e6' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              disabled={!ready}
              onChange={(e) => {
                setAmount({
                  currency: 'KRW',
                  value: e.target.checked ? 45000 : 50000
                })
              }}
              style={{ marginRight: '8px' }}
            />
            <span>5,000원 쿠폰 적용</span>
          </label>
        </div>
      </div>

      {/* 결제 수단 */}
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
          결제 수단 선택
        </h2>
        <div id="payment-method"></div>
        <div id="agreement" style={{ marginTop: '16px' }}></div>
      </div>

      {/* 결제하기 버튼 */}
      <button
        onClick={handlePayment}
        disabled={!ready}
        style={{
          width: '100%',
          padding: '16px',
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#fff',
          backgroundColor: ready ? '#0066ff' : '#ccc',
          border: 'none',
          borderRadius: '8px',
          cursor: ready ? 'pointer' : 'not-allowed'
        }}
      >
        {ready ? '결제하기' : '결제 준비 중...'}
      </button>

      {/* 디버그 정보 */}
      <div style={{
        marginTop: '40px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#666'
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>
          디버그 정보
        </h3>
        <div>Client Key: {clientKey}</div>
        <div>SDK Loaded: {widgets ? '✅ Yes' : '❌ No'}</div>
        <div>UI Ready: {ready ? '✅ Yes' : '❌ No'}</div>
        <div>Amount: {amount.value.toLocaleString()}원</div>
      </div>

      {/* 테스트 카드 정보 */}
      <div style={{
        marginTop: '20px',
        padding: '20px',
        backgroundColor: '#e7f3ff',
        borderRadius: '8px',
        fontSize: '14px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
          💳 테스트 카드 정보
        </h3>
        <div style={{ marginBottom: '8px' }}>
          <strong>카드번호:</strong> 4000-0000-0000-0008
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>유효기간:</strong> 12/25
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>CVC:</strong> 123
        </div>
        <div>
          <strong>비밀번호:</strong> 12
        </div>
      </div>
    </div>
  )
}
