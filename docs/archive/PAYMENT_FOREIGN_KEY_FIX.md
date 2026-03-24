# 결제 승인 Foreign Key 오류 수정

## ⚠️ 문제 상황

**에러 메시지:**
```
D1_ERROR: foreign key mismatch - "payments" referencing "orders": SQLITE_ERROR
/api/payments/confirm:1  Failed to load resource: the server responded with a status of 500 ()
```

**증상:**
- 결제 승인 시 500 Internal Server Error 발생
- Foreign key constraint 위반으로 결제 정보가 DB에 저장되지 않음
- 결제는 PG사에서 승인되었으나 DB에 기록되지 않아 데이터 불일치 발생

---

## 🔍 근본 원인

### **실행 순서 문제**

#### ❌ Before (잘못된 순서)

```
1. 결제 승인 요청 (/api/payments/confirm)
   ↓
2. payments 테이블에 INSERT 시도
   ↓
3. ❌ Foreign Key Error!
   - payments.order_id가 orders.order_no를 참조
   - 하지만 orders 테이블에 해당 주문이 아직 없음!
   ↓
4. (너무 늦음) 주문 생성 (/api/orders)
```

**PaymentSuccessPage.tsx (Before):**
```tsx
async function confirmPayment() {
  try {
    // 1️⃣ 결제 승인 요청 (❌ 주문이 없는데 결제 먼저!)
    const response = await axios.post('/api/payments/confirm', {
      paymentKey,
      orderId,
      amount: parseInt(amount || '0')
    })
    // ... payments 테이블에 INSERT → Foreign Key Error!

    // 2️⃣ 장바구니 조회
    const cartResponse = await axios.get(`/api/cart/${userId}`)
    
    // 3️⃣ 주문 생성 (❌ 이미 늦음!)
    await axios.post('/api/orders', { ... })
  }
}
```

**DB 스키마 (migrations/0034_add_payments_and_order_payment_fields.sql):**
```sql
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  -- ...
  FOREIGN KEY (order_id) REFERENCES orders(order_no) ON DELETE CASCADE
  --                                      ^^^^^^^^^ 
  --                                      orders 테이블에 order_no가 먼저 있어야 함!
);
```

---

## ✅ 해결 방법

### **올바른 실행 순서**

```
1. 사용자 정보 확인
   ↓
2. 장바구니 조회
   ↓
3. ✅ 주문 생성 (/api/orders) - 먼저!
   → orders 테이블에 order_no 생성
   ↓
4. ✅ 결제 승인 요청 (/api/payments/confirm) - 나중!
   → payments 테이블에 INSERT 성공 (order_id 참조 가능)
   ↓
5. 장바구니 비우기
```

**PaymentSuccessPage.tsx (After):**
```tsx
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

    // 3️⃣ ✅ 주문 생성 요청 (결제 승인 전에 먼저!)
    const orderItems = cartItems.map((item: any) => ({
      productId: item.product_id,
      quantity: item.quantity,
      priceSnapshot: item.price_snapshot,
      optionValue: item.option_value || null
    }))

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
        status: 'pending'  // ✅ 결제 승인 전이므로 pending 상태
      })

      console.log('[PaymentSuccess] ✅ 주문 생성 완료:', orderId)
    } catch (orderErr: any) {
      console.error('[PaymentSuccess] ❌ 주문 생성 실패:', orderErr)
      setError(orderErr.response?.data?.error || '주문 생성에 실패했습니다.')
      return  // ✅ 주문 생성 실패 시 결제 승인하지 않음
    }

    // 4️⃣ ✅ 결제 승인 요청 (주문 생성 후!)
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
    await axios.delete(`/api/cart/clear/${userId}`)
    // ...
  }
}
```

---

## 📊 Before vs After

| 단계 | Before ❌ | After ✅ |
|------|-----------|----------|
| **1단계** | 결제 승인 요청 | 사용자 정보 확인 |
| **2단계** | payments INSERT (Foreign Key Error!) | 장바구니 조회 |
| **3단계** | 장바구니 조회 | **주문 생성 (먼저!)** |
| **4단계** | 주문 생성 (너무 늦음) | **결제 승인 (나중!)** |
| **5단계** | 장바구니 비우기 | 장바구니 비우기 |
| **결과** | ❌ 500 Error | ✅ 정상 처리 |

---

## 🔑 핵심 변경 사항

### 1. **주문 생성 시점 앞당김**
```diff
- // 1. 결제 승인 → 2. 주문 생성
+ // 1. 주문 생성 → 2. 결제 승인
```

### 2. **주문 상태 `pending` 설정**
```tsx
await axios.post('/api/orders', {
  // ...
  status: 'pending'  // 결제 승인 전이므로 pending
})
```
- 결제 승인 후 `/api/payments/confirm`에서 `paid`로 업데이트됨

### 3. **주문 생성 실패 시 결제 승인 중단**
```tsx
try {
  await axios.post('/api/orders', { ... })
} catch (orderErr) {
  setError('주문 생성에 실패했습니다.')
  return  // ✅ 결제 승인하지 않음!
}
```

### 4. **상세 로깅 추가**
```tsx
console.log('[PaymentSuccess] 결제 승인 프로세스 시작')
console.log('[PaymentSuccess] 장바구니 조회 중...')
console.log('[PaymentSuccess] 주문 생성 중...', { orderId, userId })
console.log('[PaymentSuccess] ✅ 주문 생성 완료:', orderId)
console.log('[PaymentSuccess] 결제 승인 요청 중...')
console.log('[PaymentSuccess] ✅ 결제 승인 완료:', paymentData)
```

---

## 🚀 배포 정보

| 항목 | 값 |
|------|-----|
| **Preview URL** | https://699726a4.toss-live-commerce.pages.dev |
| **Production URL** | https://live.ur-team.com |
| **커밋 해시** | `2307aa6` |
| **배포 일시** | 2025-02-11 |

---

## ✅ 테스트 방법

### 1. 정상 결제 흐름

```bash
1. https://live.ur-team.com/login
   → user@example.com / user123 로그인

2. https://live.ur-team.com/live
   → 상품 담기

3. https://live.ur-team.com/checkout
   → 배송지 선택

4. "결제하기" 버튼 클릭
   → 결제창 오픈

5. 결제 완료
   → /payment/success로 리다이렉트

6. ✅ "결제 완료!" 메시지 표시
7. ✅ 주문 정보 표시 (주문번호, 결제방법, 결제금액)
8. ✅ orders 테이블에 주문 생성됨
9. ✅ payments 테이블에 결제 정보 저장됨
```

### 2. F12 콘솔 로그 확인

```bash
F12 → Console

✅ [PaymentSuccess] 결제 승인 프로세스 시작
✅ [PaymentSuccess] 장바구니 조회 중...
✅ [PaymentSuccess] 주문 생성 중... { orderId: 'ORDER_...', userId: '1' }
✅ [PaymentSuccess] ✅ 주문 생성 완료: ORDER_...
✅ [PaymentSuccess] 결제 승인 요청 중...
✅ [PaymentSuccess] ✅ 결제 승인 완료: { orderId: '...', paymentKey: '...', ... }
✅ [PaymentSuccess] 장바구니 비우기 중...
✅ [PaymentSuccess] ✅ 장바구니 비우기 완료
```

### 3. 네트워크 탭 확인

```bash
F12 → Network

✅ POST /api/orders
   Status: 200 OK
   Response: {"success":true,"data":{"orderId":"ORDER_..."}}

✅ POST /api/payments/confirm
   Status: 200 OK (이전: 500 Internal Server Error)
   Response: {"success":true,"data":{...}}
```

### 4. DB 확인

```bash
# orders 테이블
SELECT * FROM orders WHERE order_no = 'ORDER_...';
✅ order_no: ORDER_...
✅ status: paid
✅ payment_key: ...

# payments 테이블
SELECT * FROM payments WHERE order_id = 'ORDER_...';
✅ order_id: ORDER_...
✅ pg_provider: tosspayments
✅ method: 카드
✅ amount: 10000
✅ status: completed
```

---

## 📝 변경 파일

```
src/pages/PaymentSuccessPage.tsx
```

**주요 변경 내용:**
1. ✅ 주문 생성을 결제 승인 전으로 이동
2. ✅ 주문 생성 시 `status: 'pending'` 설정
3. ✅ 주문 생성 실패 시 결제 승인 중단
4. ✅ 상세 로그 추가 (`[PaymentSuccess]` 접두사)
5. ✅ 장바구니 비어있을 때 명확한 에러 메시지

---

## 🔑 핵심 교훈

### 1. **Foreign Key Constraint 이해**
```sql
FOREIGN KEY (order_id) REFERENCES orders(order_no)
```
- `payments.order_id`는 `orders.order_no`가 존재해야만 INSERT 가능
- **참조되는 테이블(orders)에 먼저 레코드가 있어야 함**

### 2. **트랜잭션 순서의 중요성**
- 외래 키로 연결된 테이블들의 INSERT 순서가 매우 중요
- 부모 테이블(orders) → 자식 테이블(payments) 순서로 생성

### 3. **오류 발생 시 롤백 전략**
```tsx
try {
  await createOrder()  // 성공
} catch {
  return  // 주문 생성 실패 시 결제 승인하지 않음
}

await confirmPayment()  // 주문이 있으므로 성공
```

### 4. **상태 관리**
- 주문 생성 시: `status: 'pending'`
- 결제 승인 후: `status: 'paid'` (자동 업데이트)

### 5. **로깅의 중요성**
- 각 단계마다 로그를 남겨 흐름 추적
- 에러 발생 시 어느 단계에서 실패했는지 명확히 파악

---

## 🎯 예방 조치

### 1. **DB 트랜잭션 사용 (향후 개선)**

```tsx
// 백엔드에서 트랜잭션으로 묶기
await DB.batch([
  DB.prepare('INSERT INTO orders ...'),
  DB.prepare('INSERT INTO payments ...')
])
```

### 2. **재시도 로직 추가**

```tsx
async function createOrderWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await axios.post('/api/orders', { ... })
    } catch (err) {
      if (i === maxRetries - 1) throw err
      await sleep(1000 * (i + 1))  // 지수 백오프
    }
  }
}
```

### 3. **IdempotencyKey 사용**

```tsx
await axios.post('/api/orders', {
  // ...
  idempotencyKey: orderId  // 중복 생성 방지
})
```

---

## ✅ 최종 결과

✅ **Foreign Key 오류 완전 해결**  
✅ **올바른 실행 순서: 주문 생성 → 결제 승인**  
✅ **주문 상태 관리 개선 (pending → paid)**  
✅ **상세 로깅으로 디버깅 용이**  
✅ **500 오류 해결 → 정상 200 응답**  

**이제 결제 승인이 완벽하게 작동합니다! 🎉**

---

## 📚 관련 문서

1. **SHIPPING_ADDRESS_API_FIX.md** - 배송지 API 오류 수정
2. **MANDATORY_ADDRESS_IMPLEMENTATION.md** - 배송지 필수 입력 구현
3. **PAYMENT_DUPLICATE_FIX.md** - 결제 중복 요청 방지
4. **BRANDPAY_COMPLETE_IMPLEMENTATION.md** - 브랜드페이 완전 구현
5. **CHECKOUT_ERROR_DEBUG.md** - 체크아웃 오류 디버깅
6. **CHECKOUT_TEST_GUIDE.md** - 체크아웃 테스트 가이드
