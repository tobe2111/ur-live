# 토스페이먼츠 키 타입 완벽 가이드

## 🎯 핵심 요약

**CheckoutPage는 `widgets()` 메서드를 사용하므로 `test_gck_` 키가 필요합니다!**

---

## 📋 TossPayments SDK v2 키 타입

### 1️⃣ 결제위젯 키 (Payment Widget Keys)

```
Client Key: test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
Secret Key: test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY
```

**사용 코드:**
```javascript
const tossPayments = TossPayments(clientKey)
const widgets = tossPayments.widgets({ customerKey })  // ← widgets() 메서드
await widgets.renderPaymentMethods(...)
await widgets.renderAgreement(...)
await widgets.requestPayment(...)
```

**사용처:**
- ✅ CheckoutPage (우리 프로젝트)
- 결제 UI를 직접 렌더링하는 경우

**특징:**
- MID 통합 관리 (모든 MID에서 사용 가능)
- 코드 없이 어드민에서 결제수단 추가/변경 가능

---

### 2️⃣ 결제창 키 (Payment Window Keys)

```
Client Key: test_ck_KNbdOvk5rk5lGyQnAq0o3n07xlzm (MID: urteamizy1)
Secret Key: test_sk_ORzdMaqN3wOGnjevbpZD35AkYXQG (MID: urteamizy1)
```

**사용 코드:**
```javascript
const tossPayments = TossPayments(clientKey)
await tossPayments.requestPayment({  // ← 직접 requestPayment() 호출
  method: 'CARD',
  amount: 15000,
  orderId: '...',
  orderName: '...',
  successUrl: '...',
  failUrl: '...'
})
```

**사용처:**
- ❌ CheckoutPage에서 미사용
- 결제창을 바로 띄우는 경우 (UI 렌더링 없음)

**특징:**
- MID별 개별 관리 (MID마다 다른 키)
- 결제수단을 코드로 직접 지정

---

## ⚠️ 발생한 문제

### 문제 상황
```javascript
// CheckoutPage.tsx
const clientKey = 'test_ck_KNbdOvk5rk5lGyQnAq0o3n07xlzm' // ❌ 결제창 키
const widgets = tossPayments.widgets({ customerKey })    // widgets() 메서드 사용
```

**결과:**
```
GET https://api.tosspayments.com/v1/payment-widget/widget-groups/keys?variantKey=DEFAULT
404 Not Found
```

**원인:**
- `widgets()` 메서드는 `test_gck_` 키가 필요
- `test_ck_` 키는 `requestPayment()` 직접 호출용

---

## ✅ 해결 방법

### CheckoutPage (widgets 사용)
```javascript
// ✅ 올바른 키
const clientKey = 'test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN'

const tossPayments = TossPayments(clientKey)
const widgets = tossPayments.widgets({ customerKey })
```

### Backend (Confirm API)
```javascript
// Secret Key는 결제위젯 Secret Key 사용
const TOSS_SECRET_KEY = 'test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY'

fetch('https://api.tosspayments.com/v1/payments/confirm', {
  method: 'POST',
  headers: {
    Authorization: 'Basic ' + btoa(TOSS_SECRET_KEY + ':'),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ paymentKey, orderId, amount })
})
```

---

## 📊 키 사용 매트릭스

| 기능 | Client Key | Secret Key | 코드 패턴 |
|------|-----------|-----------|----------|
| **결제위젯 (CheckoutPage)** | `test_gck_...` | `test_gsk_...` | `widgets()` |
| **결제창 (미사용)** | `test_ck_...` | `test_sk_...` | `requestPayment()` |
| **결제 승인 (Backend)** | - | `test_gsk_...` | API 호출 |

---

## 🔍 키 확인 체크리스트

### Frontend (CheckoutPage)
- [x] `test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN` 사용
- [x] `tossPayments.widgets()` 메서드 사용
- [x] `renderPaymentMethods()` 정상 작동

### Backend (Hono)
- [x] `TOSS_SECRET_KEY=test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY`
- [x] Confirm API 호출 성공
- [x] DB payment_key 업데이트

### 테스트 확인
- [x] `/checkout` 페이지 로드
- [x] 결제 UI 렌더링 (카드/간편결제)
- [x] 이용약관 동의 UI 렌더링
- [x] "결제하기" 버튼 클릭 가능
- [x] 결제 완료 후 Confirm API 호출
- [x] 토스 개발자센터에 결제 내역 표시

---

## 🎯 결론

**우리 프로젝트는 결제위젯(Payment Widget) 방식을 사용합니다.**

따라서:
- Frontend: `test_gck_...` 키 필수
- Backend: `test_gsk_...` 키 필수
- `test_ck_...`, `test_sk_...` 키는 사용하지 않음

**절대 키 타입을 혼용하지 마세요!**
