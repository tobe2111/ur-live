import { useEffect, useState } from 'react'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { useTranslation } from 'react-i18next'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import { formatNumber } from '@/utils/format'

// 공식 샌드박스 키 (테스트용)
// 실제 운영 시에는 MID urteamizy1의 클라이언트 키로 변경 필요
const clientKey = 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm'

function generateRandomString() {
  return window.btoa(Math.random().toString()).slice(0, 20)
}

export default function PaymentDemoPage() {
  const { t } = useTranslation()
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
        
        const tossPayments = await loadTossPayments(clientKey)
        
        // 데모용 customerKey
        const customerKey = generateRandomString()
        
        const widgetsInstance = tossPayments.widgets({ customerKey })
        
        setWidgets(widgetsInstance)
      } catch (err: unknown) {
        const err_ = err as { message?: string }
        setError(t('payment.demo.sdkInitFailed', { defaultValue: 'SDK 초기화 실패: {{message}}', message: err_.message }))
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
        
        // DOM 대기
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const paymentMethodEl = document.getElementById('payment-method')
        const agreementEl = document.getElementById('agreement')
        
        if (!paymentMethodEl) {
          setError(t('payment.demo.uiContainerNotFound', { defaultValue: '결제 UI 컨테이너를 찾을 수 없습니다.' }))
          return
        }

        if (!agreementEl) {
          setError(t('payment.demo.agreementContainerNotFound', { defaultValue: '약관 UI 컨테이너를 찾을 수 없습니다.' }))
          return
        }
        
        // 금액 설정
        await widgets.setAmount(amount)
        
        // 결제 수단 렌더링 (variantKey 'DEFAULT' 사용)
        await widgets.renderPaymentMethods({
          selector: '#payment-method',
          variantKey: 'widgetA'
        })
        
        // 이용약관 렌더링
        await widgets.renderAgreement({
          selector: '#agreement',
          variantKey: 'AGREEMENT'
        })
        
        setReady(true)
      } catch (err: unknown) {
        const err_ = err as { message?: string }
        setError(t('payment.demo.renderFailed', { defaultValue: 'UI 렌더링 실패: {{message}}', message: err_.message }))
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
        await widgets.setAmount(amount)
      } catch (err: unknown) {
      }
    }

    updateAmount()
  }, [amount, widgets, ready])

  // 결제하기
  const handlePayment = async () => {
    if (!widgets || !ready) {
      toast.info(t('payment.demo.loadingSystem', { defaultValue: '결제 시스템을 불러오는 중입니다.' }))
      return
    }

    try {
      const orderId = `ORDER_${Date.now()}_${generateRandomString()}`
      
      
      await widgets.requestPayment({
        orderId,
        orderName: t('payment.demo.testProduct', { defaultValue: '테스트 상품' }),
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: 'test@example.com',
        customerName: t('payment.demo.testCustomerName', { defaultValue: '테스트' }),
        customerMobilePhone: '01012341234'
      })
    } catch (err: unknown) {
      const err_ = err as { message?: string; code?: string }
      if (err_.code === 'USER_CANCEL') {
        toast.info(t('payment.demo.paymentCancelled', { defaultValue: '결제가 취소되었습니다.' }))
      } else {
        toast.error(t('payment.demo.paymentError', { defaultValue: '결제 오류: {{message}}', message: err_.message }))
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
      <SEO title={t('payment.demo.seoTitle', { defaultValue: '결제 데모' })} description={t('payment.demo.seoDesc', { defaultValue: '토스페이먼츠 결제 데모 페이지' })} url="/payment/demo" noindex />
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '20px' }}>
        {t('payment.demo.heading', { defaultValue: '토스페이먼츠 결제 데모' })}
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
          <strong>{t('payment.demo.errorLabel', { defaultValue: '⚠️ 오류:' })}</strong> {error}
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
          {t('payment.demo.infoHeading', { defaultValue: '결제 정보' })}
        </h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>{t('payment.demo.productNameLabel', { defaultValue: '상품명:' })}</span>
          <strong>{t('payment.demo.testProduct', { defaultValue: '테스트 상품' })}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>{t('payment.demo.amountLabel', { defaultValue: '결제 금액:' })}</span>
          <strong style={{ color: '#0066ff', fontSize: '20px' }}>
            {formatNumber(amount.value)}{t('payment.demo.wonSuffix', { defaultValue: '원' })}
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
            <span>{t('payment.demo.applyCoupon', { defaultValue: '5,000원 쿠폰 적용' })}</span>
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
          {t('payment.demo.methodHeading', { defaultValue: '결제 수단 선택' })}
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
        {ready ? t('payment.demo.pay', { defaultValue: '결제하기' }) : t('payment.demo.preparing', { defaultValue: '결제 준비 중...' })}
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
          {t('payment.demo.debugHeading', { defaultValue: '디버그 정보' })}
        </h3>
        <div>Client Key: {clientKey}</div>
        <div>SDK Loaded: {widgets ? '✅ Yes' : '❌ No'}</div>
        <div>UI Ready: {ready ? '✅ Yes' : '❌ No'}</div>
        <div>Amount: {formatNumber(amount.value)}{t('payment.demo.wonSuffix', { defaultValue: '원' })}</div>
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
          {t('payment.demo.testCardHeading', { defaultValue: '💳 테스트 카드 정보' })}
        </h3>
        <div style={{ marginBottom: '8px' }}>
          <strong>{t('payment.demo.cardNumberLabel', { defaultValue: '카드번호:' })}</strong> 4000-0000-0000-0008
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>{t('payment.demo.expiryLabel', { defaultValue: '유효기간:' })}</strong> 12/25
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>{t('payment.demo.cvcLabel', { defaultValue: 'CVC:' })}</strong> 123
        </div>
        <div>
          <strong>비밀번호:</strong> 12
        </div>
      </div>
    </div>
  )
}
