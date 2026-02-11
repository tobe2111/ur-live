# 토스페이먼츠 결제 연동 가이드 🚀

## 📅 작성 일시
- 2026-02-11

## ✅ 준비 완료 사항

### 1. 환경 변수 설정 완료
**`.env` (프론트엔드):**
```bash
VITE_TOSS_CLIENT_KEY=test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm
```

**`.dev.vars` (백엔드 - 로컬):**
```bash
TOSS_SECRET_KEY=test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6
```

**Cloudflare Pages 환경변수 (프로덕션):**
```bash
# 배포 시 설정 필요
wrangler secret put TOSS_SECRET_KEY
# 실제 시크릿 키 입력: test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6
```

### 2. 테스트 키 vs 실제 키
| 환경 | 클라이언트 키 | 시크릿 키 | 설명 |
|------|--------------|-----------|------|
| 테스트 | `test_gck_docs_...` | `test_gsk_docs_...` | 실제 결제 없음 |
| 실제 | `live_gck_...` | `live_gsk_...` | 실제 결제 발생 |

**⚠️ 주의:** 현재는 테스트 키로 설정되어 있습니다. 실제 서비스 시작 전에 토스페이먼츠와 계약 후 실제 키로 변경해야 합니다.

---

## 🎯 구현 방식: 결제위젯 SDK (권장)

토스페이먼츠는 3가지 결제 제품을 제공합니다:
1. **결제위젯** ✅ - 가장 쉽고 빠름 (권장)
2. 통합결제창 - 커스터마이징 제한적
3. 자체창 결제 - 고도화 가능하지만 복잡

### 결제위젯을 선택한 이유:
- ✅ **노코드 커스터마이징** - 어드민에서 UI 수정 가능
- ✅ **자동 업데이트** - 새 결제수단 자동 추가
- ✅ **최적화된 UI** - 토스페이먼츠가 데이터 기반으로 설계
- ✅ **간편한 연동** - JavaScript SDK만 추가하면 끝

---

## 📦 구현 단계

### Phase 1: 프론트엔드 (CheckoutPage)

#### 1-1. 토스페이먼츠 SDK 추가
**`index.html`에 스크립트 추가:**
```html
<head>
  <!-- 기존 코드 -->
  
  <!-- Toss Payments SDK -->
  <script src="https://js.tosspayments.com/v2/standard"></script>
</head>
```

#### 1-2. CheckoutPage에 결제위젯 렌더링
**`src/pages/CheckoutPage.tsx` 수정:**

```tsx
import { useEffect, useState, useRef } from 'react'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'

export default function CheckoutPage() {
  const [tossPayments, setTossPayments] = useState(null)
  const [ready, setReady] = useState(false)
  const paymentMethodsRef = useRef(null)
  const agreementsRef = useRef(null)
  
  // ... 기존 state들 ...
  
  // 토스페이먼츠 초기화
  useEffect(() => {
    async function initializeTossPayments() {
      try {
        const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY
        const tossPaymentsInstance = await loadTossPayments(clientKey)
        
        // Payment UI 렌더링
        const paymentMethods = tossPaymentsInstance.payment({
          amount: totalAmount,
          orderId: generateOrderId(), // 주문 ID 생성
          orderName: `${cartItems[0]?.product_name} 외 ${cartItems.length - 1}건`,
          customerName: selectedAddress?.recipient_name || '구매자',
          customerEmail: user?.email || undefined,
        })
        
        paymentMethods.render(paymentMethodsRef.current)
        
        // 약관 동의 UI 렌더링
        const agreements = tossPaymentsInstance.agreement()
        agreements.render(agreementsRef.current)
        
        setTossPayments(tossPaymentsInstance)
        setReady(true)
      } catch (error) {
        console.error('Toss Payments 초기화 실패:', error)
      }
    }
    
    if (cartItems.length > 0 && selectedAddress) {
      initializeTossPayments()
    }
  }, [cartItems, selectedAddress, totalAmount])
  
  // 결제 요청
  async function handlePayment() {
    if (!tossPayments || !ready) {
      alert('결제 준비 중입니다. 잠시만 기다려주세요.')
      return
    }
    
    try {
      await tossPayments.requestPayment({
        method: 'CARD', // 또는 사용자가 선택한 결제수단
        amount: totalAmount,
        orderId: generateOrderId(),
        orderName: `${cartItems[0]?.product_name} 외 ${cartItems.length - 1}건`,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerName: selectedAddress?.recipient_name,
        customerEmail: user?.email,
      })
    } catch (error) {
      console.error('결제 요청 실패:', error)
      alert('결제 요청에 실패했습니다. 다시 시도해주세요.')
    }
  }
  
  // 주문 ID 생성 (고유해야 함)
  function generateOrderId() {
    return `order_${Date.now()}_${userId}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  return (
    <div>
      {/* 기존 배송지 섹션 */}
      
      {/* 기존 상품 목록 */}
      
      {/* 결제 수단 선택 영역 */}
      <div className="bg-white rounded-xl p-6 mb-4">
        <h2 className="text-lg font-semibold mb-4">결제 수단</h2>
        <div ref={paymentMethodsRef} />
      </div>
      
      {/* 약관 동의 영역 */}
      <div className="bg-white rounded-xl p-6 mb-4">
        <div ref={agreementsRef} />
      </div>
      
      {/* 결제 금액 & 버튼 */}
      <div className="bg-white rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">결제 금액</h2>
        {/* 기존 금액 표시 */}
        
        <Button
          onClick={handlePayment}
          disabled={!ready || !selectedAddress || cartItems.length === 0}
          className="w-full"
        >
          {ready ? '결제하기' : '결제 준비 중...'}
        </Button>
      </div>
    </div>
  )
}
```

#### 1-3. 결제 결과 페이지 생성

**`src/pages/PaymentSuccessPage.tsx` (성공):**
```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { CheckCircle, Loader2 } from 'lucide-react'

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [verifying, setVerifying] = useState(true)
  const [error, setError] = useState('')
  
  useEffect(() => {
    async function verifyPayment() {
      const orderId = searchParams.get('orderId')
      const paymentKey = searchParams.get('paymentKey')
      const amount = searchParams.get('amount')
      
      if (!orderId || !paymentKey || !amount) {
        setError('잘못된 결제 정보입니다.')
        setVerifying(false)
        return
      }
      
      try {
        // 백엔드로 결제 승인 요청
        const response = await axios.post('/api/payments/confirm', {
          orderId,
          paymentKey,
          amount: parseInt(amount)
        })
        
        if (response.data.success) {
          // 결제 승인 성공
          setTimeout(() => {
            navigate(`/orders/${response.data.data.orderId}`)
          }, 2000)
        } else {
          setError(response.data.error || '결제 승인에 실패했습니다.')
        }
      } catch (err: any) {
        console.error('결제 승인 실패:', err)
        setError(err.response?.data?.error || '결제 승인 중 오류가 발생했습니다.')
      } finally {
        setVerifying(false)
      }
    }
    
    verifyPayment()
  }, [searchParams, navigate])
  
  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#007aff] mx-auto mb-4" />
          <p className="text-lg font-medium">결제를 확인하고 있습니다...</p>
          <p className="text-sm text-[#6e6e73] mt-2">잠시만 기다려주세요</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 shadow-lg max-w-md w-full text-center">
          <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">❌</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">결제 실패</h1>
          <p className="text-[#6e6e73] mb-6">{error}</p>
          <button
            onClick={() => navigate('/checkout')}
            className="w-full bg-[#007aff] text-white py-3 rounded-lg font-semibold"
          >
            다시 시도하기
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-8 shadow-lg max-w-md w-full text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">결제 완료!</h1>
        <p className="text-[#6e6e73] mb-6">
          주문이 성공적으로 완료되었습니다.<br />
          주문 내역 페이지로 이동합니다...
        </p>
      </div>
    </div>
  )
}
```

**`src/pages/PaymentFailPage.tsx` (실패):**
```tsx
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'

export default function PaymentFailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const code = searchParams.get('code')
  const message = searchParams.get('message')
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-8 shadow-lg max-w-md w-full text-center">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">결제 실패</h1>
        <p className="text-[#6e6e73] mb-2">{decodeURIComponent(message || '결제에 실패했습니다.')}</p>
        {code && (
          <p className="text-sm text-[#86868b] mb-6">오류 코드: {code}</p>
        )}
        <button
          onClick={() => navigate('/checkout')}
          className="w-full bg-[#007aff] text-white py-3 rounded-lg font-semibold"
        >
          다시 시도하기
        </button>
      </div>
    </div>
  )
}
```

#### 1-4. 라우터에 페이지 추가
**`src/App.tsx`:**
```tsx
import PaymentSuccessPage from './pages/PaymentSuccessPage'
import PaymentFailPage from './pages/PaymentFailPage'

// 라우터 설정
<Routes>
  {/* 기존 라우트들 */}
  <Route path="/payment/success" element={<PaymentSuccessPage />} />
  <Route path="/payment/fail" element={<PaymentFailPage />} />
</Routes>
```

---

### Phase 2: 백엔드 (결제 승인 API)

#### 2-1. 결제 승인 API
**`src/index.tsx`에 추가:**

```tsx
// 결제 승인 API
app.post('/api/payments/confirm', async (c) => {
  const { DB } = c.env
  const { orderId, paymentKey, amount } = await c.req.json()
  
  // 환경변수에서 시크릿 키 가져오기
  const secretKey = c.env.TOSS_SECRET_KEY || 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6'
  
  try {
    // 1. 토스페이먼츠 결제 승인 요청
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(secretKey + ':')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orderId,
        paymentKey,
        amount
      })
    })
    
    const paymentData = await response.json()
    
    if (!response.ok) {
      return c.json({
        success: false,
        error: paymentData.message || '결제 승인에 실패했습니다.'
      }, 400)
    }
    
    // 2. 주문 정보를 DB에 저장
    // orders 테이블에 주문 생성
    const orderResult = await DB.prepare(`
      INSERT INTO orders (
        user_id, 
        order_id, 
        payment_key,
        total_amount, 
        shipping_fee,
        status,
        payment_method,
        payment_status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      paymentData.customerId || 'guest',
      orderId,
      paymentKey,
      amount,
      3000, // 배송비
      'pending',
      paymentData.method,
      'paid'
    ).run()
    
    // 3. 장바구니 아이템을 주문 아이템으로 이동
    // (실제 구현에서는 장바구니에서 주문 아이템으로 복사)
    
    // 4. 장바구니 비우기
    // await DB.prepare('DELETE FROM cart_items WHERE user_id = ?').bind(userId).run()
    
    return c.json({
      success: true,
      data: {
        orderId,
        paymentKey,
        amount,
        status: paymentData.status
      }
    })
  } catch (err) {
    console.error('결제 승인 오류:', err)
    return c.json({
      success: false,
      error: (err as Error).message
    }, 500)
  }
})
```

#### 2-2. 주문 조회 API
```tsx
// 주문 조회 API
app.get('/api/orders/:orderId', async (c) => {
  const { DB } = c.env
  const orderId = c.req.param('orderId')
  const userId = c.req.header('X-User-Id') // 인증 필요
  
  try {
    const order = await DB.prepare(`
      SELECT * FROM orders WHERE order_id = ? AND user_id = ?
    `).bind(orderId, userId).first()
    
    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404)
    }
    
    // 주문 아이템 조회
    const orderItems = await DB.prepare(`
      SELECT * FROM order_items WHERE order_id = ?
    `).bind(order.id).all()
    
    return c.json({
      success: true,
      data: {
        ...order,
        items: orderItems.results
      }
    })
  } catch (err) {
    return c.json({
      success: false,
      error: (err as Error).message
    }, 500)
  }
})
```

---

### Phase 3: 웹훅 (가상계좌 입금 알림)

가상계좌 결제는 즉시 승인되지 않고, 고객이 입금하면 토스페이먼츠가 웹훅으로 알림을 보냅니다.

#### 3-1. 웹훅 엔드포인트
```tsx
// 웹훅 엔드포인트
app.post('/api/payments/webhook', async (c) => {
  const { DB } = c.env
  const webhookData = await c.req.json()
  
  console.log('[Webhook] Received:', webhookData)
  
  // 웹훅 이벤트 타입 확인
  if (webhookData.eventType === 'PAYMENT_STATUS_CHANGED') {
    const { orderId, status } = webhookData.data
    
    try {
      // 주문 상태 업데이트
      await DB.prepare(`
        UPDATE orders 
        SET payment_status = ?, updated_at = datetime('now')
        WHERE order_id = ?
      `).bind(status, orderId).run()
      
      // 입금 완료 시 이메일 발송 등 추가 로직
      if (status === 'DONE') {
        // TODO: 입금 완료 이메일 발송
        console.log(`[Webhook] Payment confirmed for order: ${orderId}`)
      }
      
      return c.json({ success: true })
    } catch (err) {
      console.error('[Webhook] Error:', err)
      return c.json({ success: false }, 500)
    }
  }
  
  return c.json({ success: true })
})
```

#### 3-2. 웹훅 URL 등록
- 토스페이먼츠 어드민에서 설정
- URL: `https://live.ur-team.com/api/payments/webhook`

---

## 🗄️ 데이터베이스 마이그레이션

### orders 테이블 (이미 존재하면 스킵)
```sql
-- migrations/0008_add_payment_fields.sql
ALTER TABLE orders ADD COLUMN payment_key TEXT;
ALTER TABLE orders ADD COLUMN payment_method TEXT;
ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending';
```

실행:
```bash
npx wrangler d1 migrations create toss-live-commerce-db add_payment_fields
# 위 SQL 붙여넣기
npx wrangler d1 migrations apply toss-live-commerce-db --local
npx wrangler d1 migrations apply toss-live-commerce-db --remote
```

---

## 🧪 테스트 방법

### 1. 로컬 테스트
```bash
# 1. 빌드
npm run build

# 2. 로컬 서버 시작
pm2 start ecosystem.config.cjs

# 3. 브라우저에서 테스트
http://localhost:3000/checkout
```

### 2. 테스트 카드 정보
토스페이먼츠 테스트 환경에서 사용 가능한 카드:
- **카드 번호:** 아무 16자리 숫자 (예: 1234-5678-9012-3456)
- **유효기간:** 미래 날짜 (예: 12/25)
- **CVC:** 아무 3자리 (예: 123)
- **비밀번호 앞 2자리:** 아무 2자리 (예: 12)

### 3. 성공/실패 시나리오
- **성공:** 정상적으로 결제 완료 → `/payment/success`로 리다이렉트
- **실패:** 결제 취소 또는 오류 → `/payment/fail`로 리다이렉트

---

## 🚀 프로덕션 배포

### 1. Cloudflare Pages 환경변수 설정
```bash
# 시크릿 키 설정 (프로덕션)
npx wrangler pages secret put TOSS_SECRET_KEY --project-name toss-live-commerce

# 실제 키 입력 (토스페이먼츠와 계약 후 발급받은 키)
# live_gsk_...
```

### 2. 프론트엔드 환경변수
Cloudflare Pages 대시보드에서 설정:
- **변수명:** `VITE_TOSS_CLIENT_KEY`
- **값:** `live_gck_...` (실제 클라이언트 키)

### 3. 배포
```bash
npm run build
npx wrangler pages deploy dist --project-name toss-live-commerce
```

---

## ⚠️ PG사 변경 대비

만약 토스페이먼츠가 안 되거나 다른 PG사로 변경해야 한다면:

### 1. 인터페이스 추상화
```tsx
// src/services/payment/interface.ts
export interface PaymentGateway {
  initialize(clientKey: string): Promise<void>
  requestPayment(params: PaymentParams): Promise<void>
  confirmPayment(params: ConfirmParams): Promise<PaymentResult>
}

// src/services/payment/toss.ts
export class TossPaymentsGateway implements PaymentGateway {
  async initialize(clientKey: string) {
    // 토스페이먼츠 초기화
  }
  
  async requestPayment(params: PaymentParams) {
    // 토스페이먼츠 결제 요청
  }
  
  async confirmPayment(params: ConfirmParams) {
    // 토스페이먼츠 결제 승인
  }
}

// src/services/payment/index.ts
export function getPaymentGateway(): PaymentGateway {
  const provider = import.meta.env.VITE_PG_PROVIDER || 'toss'
  
  switch (provider) {
    case 'toss':
      return new TossPaymentsGateway()
    case 'nice':
      return new NicePaymentsGateway() // 추후 구현
    case 'inicis':
      return new InicisGateway() // 추후 구현
    default:
      return new TossPaymentsGateway()
  }
}
```

### 2. 환경변수로 PG사 선택
```bash
# .env
VITE_PG_PROVIDER=toss  # 또는 nice, inicis 등
```

---

## 📝 체크리스트

### 구현 전
- [x] 환경변수 설정 (테스트 키)
- [ ] CheckoutPage 수정
- [ ] PaymentSuccessPage 생성
- [ ] PaymentFailPage 생성
- [ ] 백엔드 결제 승인 API 구현
- [ ] 웹훅 엔드포인트 구현
- [ ] 라우터 설정
- [ ] DB 마이그레이션

### 테스트
- [ ] 로컬 환경 테스트
- [ ] 테스트 카드로 결제 성공 시나리오
- [ ] 결제 취소 시나리오
- [ ] 웹훅 동작 확인 (가상계좌)

### 배포
- [ ] 토스페이먼츠 계약 완료
- [ ] 실제 키 발급 받기
- [ ] Cloudflare Pages 환경변수 설정
- [ ] 프로덕션 배포
- [ ] 웹훅 URL 등록

---

## 🎯 다음 단계

1. **즉시 구현 가능:**
   - CheckoutPage에 결제위젯 추가
   - 결제 승인 API 구현
   - 결제 결과 페이지 생성

2. **토스페이먼츠 계약 후:**
   - 실제 키로 변경
   - 웹훅 URL 등록
   - 실제 결제 테스트

3. **향후 확장:**
   - 정기결제 (빌링) 추가
   - 다양한 결제수단 지원
   - 포인트/쿠폰 연동

---

## 📚 참고 문서

- [토스페이먼츠 공식 문서](https://docs.tosspayments.com)
- [결제위젯 연동 가이드](https://docs.tosspayments.com/guides/v2/payment-widget)
- [LLM 가이드](https://docs.tosspayments.com/guides/v2/get-started/llms-guide)
- [API 레퍼런스](https://docs.tosspayments.com/reference)

---

## 🎉 완료 후 기대 효과

1. ✅ **실제 결제 가능** - 카드, 계좌이체, 가상계좌 등
2. ✅ **간편결제 지원** - 토스페이, 카카오페이, 네이버페이 등
3. ✅ **자동 업데이트** - 새 결제수단 자동 추가
4. ✅ **안전한 결제** - 토스페이먼츠의 보안 시스템
5. ✅ **쉬운 관리** - 어드민에서 노코드로 커스터마이징

이제 실제 결제가 가능한 커머스 플랫폼이 완성됩니다! 🚀
