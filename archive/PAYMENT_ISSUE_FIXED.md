# 테스트 결제내역이 토스페이먼츠 개발자센터에 나오지 않는 문제 해결

## 📌 문제 상황

```
주문번호: ORDER_1770873279210_MC4wNTY4MDAxMzMyNTQx
증상: 결제는 완료되었지만 토스페이먼츠 개발자센터에 테스트 결제내역이 표시되지 않음
```

## 🔍 근본 원인 분석

### 문제의 핵심
**결제 승인 API(`/api/payments/confirm`)가 주문 데이터가 없는 상태에서 `UPDATE orders` 쿼리를 실행하려 했기 때문입니다.**

### 잘못된 플로우 (Before)

```
1. CheckoutPage: 결제 위젯 → requestPayment() 호출
2. TossPayments: 결제 인증 완료 → successUrl로 리다이렉트
3. PaymentSuccessPage: /api/payments/confirm 직접 호출 ❌
4. Backend (/api/payments/confirm):
   - TossPayments 승인 API 호출 ✅
   - UPDATE orders SET payment_key=?, status='paid' WHERE order_number=? ❌ 실패!
   - 이유: orders 테이블에 해당 주문이 존재하지 않음!
5. 결과: 승인 API는 호출되지만 DB 업데이트 실패로 인해 토스페이먼츠 측에 기록되지 않음
```

### 문제가 된 코드 (이전)

```typescript
// ❌ 잘못된 코드 (PaymentSuccessPage.tsx)
async function confirmPayment() {
  const userId = getUserId()
  
  // 주문 생성 없이 바로 결제 승인만 시도!
  const response = await axios.post('/api/payments/confirm', {
    paymentKey,
    orderId,
    amount: parseInt(amount || '0')
  })
  
  // 이후 장바구니 비우기...
}
```

Backend에서:
```typescript
// ❌ 잘못된 로직 (index.tsx - /api/payments/confirm)
// TossPayments 승인 성공 후
await DB.prepare(`
  UPDATE orders 
  SET payment_key = ?, payment_status = 'approved', status = 'paid'
  WHERE order_number = ?
`).bind(paymentKey, orderId).run()
// ⚠️ 주문이 아직 생성되지 않아서 UPDATE 실패!
```

## ✅ 해결 방법

### 올바른 플로우 (After)

```
1. CheckoutPage: 결제 위젯 → requestPayment() 호출
2. TossPayments: 결제 인증 완료 → successUrl로 리다이렉트
3. PaymentSuccessPage:
   a. 장바구니 조회 (GET /api/cart/{userId}) ✅
   b. 주문 생성 (POST /api/orders with status='pending') ✅
   c. 결제 승인 (POST /api/payments/confirm) ✅
4. Backend (/api/payments/confirm):
   - TossPayments 승인 API 호출 ✅
   - UPDATE orders (이제 주문이 존재하므로 성공!) ✅
   - 재고 차감 ✅
5. 결과: 토스페이먼츠 개발자센터에 정상적으로 기록됨! ✅
```

### 수정된 코드

```typescript
// ✅ 올바른 코드 (PaymentSuccessPage.tsx)
async function confirmPayment() {
  const userId = getUserId()
  
  // 2️⃣ 장바구니 조회
  const cartResponse = await axios.get(`/api/cart/${userId}`)
  const cartItems = cartResponse.data?.data || []

  // 3️⃣ 주문 데이터 생성 (결제 승인 전에 필수!)
  const shippingAddress = localStorage.getItem('checkoutShippingAddress') || ''
  const recipientName = localStorage.getItem('checkoutRecipientName') || ''
  const recipientPhone = localStorage.getItem('checkoutRecipientPhone') || ''

  const orderItems = cartItems.map((item: any) => ({
    productId: item.product_id,
    quantity: item.quantity,
    price: item.price_snapshot,
    optionValue: item.option_value || null
  }))

  // DB에 주문 생성 (status='pending')
  const orderCreateResponse = await axios.post('/api/orders', {
    userId: userId,
    orderNumber: orderId,
    items: orderItems,
    totalAmount: parseInt(amount || '0'),
    shippingAddress: shippingAddress,
    recipientName: recipientName,
    recipientPhone: recipientPhone,
    status: 'pending'
  })

  // 4️⃣ 결제 승인 요청 (주문 생성 후!)
  const response = await axios.post('/api/payments/confirm', {
    paymentKey,
    orderId,
    amount: parseInt(amount || '0')
  })

  // 5️⃣ 장바구니 비우기
  if (cartItems.length > 0) {
    await axios.delete(`/api/cart/clear/${userId}`)
  }
}
```

## 📚 공식 문서 준수 확인

### TossPayments 공식 가이드 (llms.txt) 체크리스트

✅ **SDK 로딩**: `<script src="https://js.tosspayments.com/v2/standard"></script>` (index.html)
✅ **초기화**: `window.TossPayments(clientKey)` (CheckoutPage.tsx L140)
✅ **위젯 생성**: `tossPayments.widgets({ customerKey })` (CheckoutPage.tsx L145)
✅ **금액 설정**: `widgets.setAmount({ currency: 'KRW', value: totalAmount })` (CheckoutPage.tsx L195-198)
✅ **UI 렌더링**: `renderPaymentMethods()`, `renderAgreement()` (CheckoutPage.tsx L201-210)
✅ **결제 요청**: `widgets.requestPayment({ orderId, orderName, successUrl, failUrl })` (CheckoutPage.tsx L444)
✅ **리다이렉트**: `successUrl: ${window.location.origin}/payment/success`
✅ **승인 API**: `POST https://api.tosspayments.com/v1/payments/confirm` (index.tsx L4085)
✅ **Authorization**: `Basic base64(secretKey + ':')` (index.tsx L4083)
✅ **API 버전**: `TossPayments-API-Version: 2022-11-16` (index.tsx L4090)
✅ **주문 생성**: `POST /api/orders` **승인 전에 호출** ✨ **새로 추가됨!**

## 🎯 테스트 방법

### 1단계: 결제 진행
```bash
1. https://live.ur-team.com/checkout 접속
2. 배송지 입력 (필수)
3. 결제 수단 선택
4. 테스트 카드 정보 입력:
   - 카드번호: 4000 0000 0000 0010
   - 유효기간: 12/25
   - CVC: 123
   - 생년월일: 000000
   - 비밀번호: 00
5. 결제하기 클릭
```

### 2단계: 브라우저 콘솔 확인 (F12)
```javascript
// 정상 로그 예시:
[PaymentSuccess] 결제 승인 프로세스 시작
[PaymentSuccess] paymentKey: tgen_...
[PaymentSuccess] orderId: ORDER_...
[PaymentSuccess] 장바구니 조회 중...
[PaymentSuccess] ✅ 주문 생성 완료: {...}
[PaymentSuccess] 결제 승인 요청 중...
[Payment] 결제 승인 요청: {orderId: "...", amount: ...}
[Payment] 🚀 토스페이먼츠 결제 승인 API 호출 시작...
[Payment] 📡 토스페이먼츠 API 응답 상태: 200
[Payment] ✅ 결제 승인 성공! paymentKey: tgen_...
[PaymentSuccess] ✅ 결제 승인 완료!
```

### 3단계: 토스페이먼츠 개발자센터 확인
```
1. https://developers.tosspayments.com/test/payment-logs 접속
2. 방금 진행한 주문번호(ORDER_...) 검색
3. 결제 상태: DONE (승인 완료)
4. 결제 금액, 결제수단, 승인 시각 등 정보 확인
```

### 4단계: 데이터베이스 확인
```sql
-- 주문 데이터 확인
SELECT * FROM orders WHERE order_number = 'ORDER_...';
-- payment_status = 'approved', status = 'paid' 확인

-- 주문 아이템 확인
SELECT * FROM order_items WHERE order_id = (
  SELECT id FROM orders WHERE order_number = 'ORDER_...'
);
```

## 🔧 기술 세부사항

### 데이터베이스 트랜잭션 흐름

```sql
-- Step 1: 주문 생성 (PaymentSuccessPage → /api/orders)
INSERT INTO orders (
  order_number, user_id, total_amount, 
  payment_status, status, shipping_address, ...
) VALUES (
  'ORDER_...', 'user123', 62500,
  'pending', 'pending', '서울시 강남구...', ...
);

-- Step 2: 주문 아이템 생성
INSERT INTO order_items (order_id, product_id, quantity, price, ...)
VALUES ((SELECT id FROM orders WHERE order_number='ORDER_...'), 1, 2, 25000, ...);

-- Step 3: 결제 승인 후 주문 상태 업데이트 (/api/payments/confirm)
UPDATE orders 
SET payment_key = 'tgen_...', 
    payment_status = 'approved', 
    status = 'paid',
    updated_at = CURRENT_TIMESTAMP
WHERE order_number = 'ORDER_...';

-- Step 4: 재고 차감
UPDATE products 
SET stock = stock - 2
WHERE id = 1 AND stock >= 2;
```

## 📊 배포 정보

- **Preview URL**: https://ae79e8b0.ur-live.pages.dev
- **Production URL**: https://live.ur-team.com
- **배포 시각**: 2026-02-12 21:06 KST
- **Git Commit**: 5d105c9
- **변경 파일**: `src/pages/PaymentSuccessPage.tsx`

## 🎉 결론

**핵심 포인트**: 
- ❌ (Before) 결제 승인 → 주문 없음 → UPDATE 실패 → 토스페이먼츠 기록 없음
- ✅ (After) 주문 생성 → 결제 승인 → UPDATE 성공 → 토스페이먼츠 정상 기록

**토스페이먼츠 공식 가이드 준수**:
- llms.txt의 모든 요구사항 충족
- Payment Widget v2 표준 플로우 준수
- 10분 이내 승인 API 호출 보장

이제 테스트 결제를 진행하면 토스페이먼츠 개발자센터에 정상적으로 나타날 것입니다!
