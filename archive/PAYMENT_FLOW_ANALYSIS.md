# 라이브 커머스 결제 플로우 분석

## ✅ 현재 구현 상태

### 1. **상품 전환 → 구매 연동 플로우** (완료)

```
셀러가 상품 전환
    ↓
POST /api/seller/streams/:streamId/change-product
    ↓
live_streams.current_product_id 업데이트
    ↓
시청자 화면에서 3초마다 GET /api/streams/:streamId/current-product
    ↓
현재 상품 정보 자동 갱신 ✅
    ↓
[담기] 또는 [지금 구매] 버튼 활성화 ✅
```

### 2. **구매 플로우** (API 완료, PG 연동 대기)

#### 2-1. 장바구니 담기
```javascript
// LivePage.tsx - handleAddToCart()
POST /api/cart
{
  userId: "user_id",
  productId: 16,           // 현재 노출 중인 상품
  quantity: 1,
  priceSnapshot: 29000,
  liveStreamId: 15
}
→ 장바구니에 추가 ✅
→ Firebase 채팅에 "○○○님이 상품을 담았습니다!" 표시 ✅
```

#### 2-2. 장바구니 → 주문
```javascript
// LivePage.tsx - handleCheckout()
GET /api/cart/:userId
→ 장바구니 확인
→ navigate('/cart')
```

#### 2-3. 주문 생성 (API 완료)
```javascript
// CheckoutPage.tsx → /api/orders
POST /api/orders
{
  userId: "user_id",
  items: [{
    productId: 16,
    quantity: 1,
    price: 29000
  }],
  shippingAddress: "서울시 강남구",
  recipientName: "홍길동",
  recipientPhone: "010-1234-5678",
  totalAmount: 29000
}
→ orders 테이블에 저장 ✅
→ 재고 자동 차감 ✅
→ order_number 자동 생성 (ORDER_timestamp_random) ✅
```

---

## ⚠️ 미완성 부분: 결제(Payment) 처리

### 현재 상태
```javascript
// CheckoutPage.tsx
<button onClick={() => 
  alert('결제 서비스 준비 중입니다.\n고객센터(0507-0177-0432)로 문의해주세요.')
}>
  {totalAmount.toLocaleString()}원 결제하기
</button>
```

### 필요한 작업

#### 1. **PG사 선택**
- ✅ 추천: 토스페이먼츠 (간편 연동, 합리적 수수료)
- PortOne (구 아임포트)
- 나이스페이
- KG이니시스

#### 2. **PG 연동 프로세스**

```
1. PG사 가입 및 계약
   - 사업자 등록증
   - 정산 계좌 정보
   - 상품/서비스 설명
   ↓
2. 가맹점 ID/SecretKey 발급
   - MID (Merchant ID)
   - API Key
   ↓
3. 환경변수 설정
   - .env.local (개발)
   - wrangler.jsonc (프로덕션)
   ↓
4. 결제 SDK 연동
   - 토스페이먼츠: @tosspayments/payment-sdk
   - PortOne: @portone/browser-sdk
   ↓
5. 백엔드 결제 승인 API 구현
   - POST /api/payments/approve
   - 결제 검증
   - 주문 상태 업데이트
```

---

## 🔧 PG 연동 후 필요한 코드 수정

### 1. CheckoutPage.tsx 수정

```typescript
// Before (현재)
<button onClick={() => alert('결제 서비스 준비 중...')}>
  결제하기
</button>

// After (PG 연동 후)
import { loadTossPayments } from '@tosspayments/payment-sdk'

async function handlePayment() {
  const tossPayments = await loadTossPayments(clientKey)
  
  // 주문 생성
  const orderRes = await axios.post('/api/orders', {
    userId, items, shippingInfo, totalAmount
  })
  
  const orderId = orderRes.data.orderId
  const orderNumber = orderRes.data.orderNumber
  
  // 토스페이먼츠 결제창 호출
  tossPayments.requestPayment('카드', {
    amount: totalAmount,
    orderId: orderNumber,
    orderName: `${items[0].name} 외 ${items.length - 1}건`,
    successUrl: `${window.location.origin}/payment/success`,
    failUrl: `${window.location.origin}/payment/fail`,
    customerName: recipientName,
    customerMobilePhone: recipientPhone
  })
}
```

### 2. 결제 승인 API (백엔드)

```typescript
// src/index.tsx
app.post('/api/payments/approve', async (c) => {
  const { orderId, paymentKey, amount } = await c.req.json()
  
  // 1. 토스페이먼츠 서버에 결제 승인 요청
  const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ orderId, amount, paymentKey })
  })
  
  if (response.ok) {
    // 2. 주문 상태 업데이트
    await DB.prepare(`
      UPDATE orders 
      SET payment_status = 'completed',
          payment_key = ?,
          paid_at = datetime('now')
      WHERE order_number = ?
    `).bind(paymentKey, orderId).run()
    
    return c.json({ success: true })
  } else {
    return c.json({ success: false, error: '결제 승인 실패' }, 400)
  }
})
```

### 3. 결제 성공/실패 페이지

```typescript
// src/pages/PaymentSuccessPage.tsx
export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  const paymentKey = searchParams.get('paymentKey')
  const amount = searchParams.get('amount')
  
  useEffect(() => {
    // 결제 승인 API 호출
    axios.post('/api/payments/approve', {
      orderId, paymentKey, amount: Number(amount)
    }).then(() => {
      // 승인 완료 → 주문 완료 페이지로 이동
      navigate(`/orders/${orderId}`)
    })
  }, [])
  
  return <div>결제 처리 중...</div>
}
```

---

## 📊 데이터베이스 스키마 확인

### orders 테이블 (이미 구현됨)
```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  user_id INTEGER,
  total_amount REAL NOT NULL,
  payment_status TEXT DEFAULT 'pending',  -- pending, completed, failed, refunded
  payment_key TEXT,                        -- PG사 결제 키
  paid_at DATETIME,
  shipping_address TEXT,
  shipping_name TEXT,
  shipping_phone TEXT,
  shipping_memo TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### order_items 테이블 (이미 구현됨)
```sql
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

---

## ✅ 이미 완성된 기능들

1. **라이브 상품 실시간 전환** ✅
   - 셀러가 상품 변경 → 3초마다 자동 갱신
   
2. **장바구니 시스템** ✅
   - POST /api/cart (추가)
   - GET /api/cart/:userId (조회)
   - DELETE /api/cart/:id (삭제)

3. **주문 생성 API** ✅
   - POST /api/orders
   - 재고 자동 차감
   - 주문번호 자동 생성

4. **주문 조회** ✅
   - GET /api/orders/:userId (사용자)
   - GET /api/seller/orders (판매자)

5. **배송 관리** ✅
   - 배송 정보 입력
   - 배송 메모

---

## ⏳ PG 연동 전 테스트 방법

### 시나리오: 무료 테스트 결제
```javascript
// CheckoutPage.tsx - 임시 테스트 코드
async function handleTestPayment() {
  // 1. 주문 생성
  const orderRes = await axios.post('/api/orders', {
    userId, items, shippingInfo, totalAmount: 0  // 0원으로 테스트
  })
  
  // 2. 주문 상태를 바로 'completed'로 변경 (테스트용)
  await axios.post('/api/orders/test-complete', {
    orderId: orderRes.data.orderId
  })
  
  // 3. 주문 완료 페이지로 이동
  navigate(`/orders/${orderRes.data.orderId}`)
}
```

---

## 📝 요약

### 질문: "변경할 때마다 알맞게 결제까지 연동이 되게끔 설정이 되어있어?"

**답변:**
✅ **YES** - 상품 전환 → 구매 플로우는 완벽하게 연동되어 있습니다!

**작동 방식:**
1. 셀러가 라이브 컨트롤에서 상품 변경
2. 시청자 화면에 3초마다 자동으로 현재 상품 표시
3. [담기] 또는 [지금 구매] 클릭 → 장바구니 추가
4. 장바구니 → 주문 생성 (재고 자동 차감)
5. **⚠️ 결제 처리만 PG 연동 대기 중**

**PG 연동 전까지:**
- 주문은 생성되지만 `payment_status = 'pending'` 상태
- 고객센터 전화로 수동 처리 필요
- 또는 테스트용 무료 결제로 플로우 테스트 가능

**PG 연동 후:**
- 실제 카드/계좌이체 결제 가능
- 자동 결제 승인 및 주문 완료
- 전자세금계산서 자동 발행 (홈택스 연동 필요)

---

## 다음 단계

1. **PG사 선택 및 계약** (토스페이먼츠 추천)
2. **가맹점 ID/API Key 발급**
3. **결제 SDK 연동 코드 추가**
4. **결제 승인 API 구현**
5. **결제 성공/실패 페이지 추가**
6. **실제 결제 테스트**

현재 구조는 PG만 연동하면 바로 운영 가능한 상태입니다! 🎉
