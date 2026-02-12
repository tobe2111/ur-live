# 토스페이먼츠 결제위젯 완벽 분석

## 📋 우리 서비스 현황 분석

### 사용 중인 키
- **Client Key (Widget)**: `test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN`
- **Client Key (API)**: `test_ck_KNbdOvk5rk5lGyQnAq0o3n07xlzm` ✅ 현재 사용 중
- **Secret Key**: `test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY`
- **MID**: `urteamizy1`

### 키 타입 구분
1. **결제위젯용 (Widget Keys)**
   - Client: `test_gck_...`
   - Secret: `test_gsk_...`
   - 특징: MID 통합 관리

2. **API 개별 연동용 (API Keys)** ✅ 우리가 사용하는 방식
   - Client: `test_ck_...`
   - Secret: `test_sk_...`
   - 특징: MID별 개별 관리

---

## 🔄 토스페이먼츠 결제 플로우

### 1단계: SDK 로드 (index.html)
```html
<script src="https://js.tosspayments.com/v2/standard"></script>
```

### 2단계: TossPayments 인스턴스 생성 (CheckoutPage)
```javascript
const tossPayments = TossPayments(clientKey)
```

### 3단계: Widgets 인스턴스 생성
```javascript
const widgets = tossPayments.widgets({
  customerKey: `customer_${userId}`
})
```

### 4단계: 결제 UI 렌더링
```javascript
await widgets.renderPaymentMethods({
  selector: '#payment-method',
  variantKey: 'DEFAULT'
})

await widgets.renderAgreement({
  selector: '#agreement',
  variantKey: 'DEFAULT'
})
```

### 5단계: 결제 요청
```javascript
await widgets.requestPayment({
  orderId: generateRandomString(),
  orderName: '주문명',
  amount: totalAmount,
  successUrl: window.location.origin + '/payment/success',
  failUrl: window.location.origin + '/payment/fail'
})
```

### 6단계: 결제 승인 (PaymentSuccessPage)
```javascript
// URL 파라미터로 받은 정보
const { paymentKey, orderId, amount } = searchParams

// 백엔드 API 호출
POST /api/payments/confirm
Body: {
  paymentKey,
  orderId,
  amount
}
```

### 7단계: 백엔드에서 토스 API 호출
```javascript
// Backend (Hono)
POST https://api.tosspayments.com/v1/payments/confirm
Headers: {
  Authorization: 'Basic ' + base64(secretKey + ':'),
  Content-Type: 'application/json'
}
Body: {
  paymentKey,
  orderId,
  amount
}
```

---

## ⚠️ 발견된 문제점들

### 1. CheckoutPage가 마운트되지 않음
**원인**: lazy loading 실패
**해결**: CheckoutPage를 즉시 로드로 변경

### 2. 브라우저 캐시 문제
**원인**: 
- Vite 빌드 시 `drop_console: true` 설정으로 디버그 로그 제거
- Cloudflare Pages 캐시 정책 없음
**해결**:
- `drop_console: false` 변경
- `_headers` 파일로 캐시 제어
- HTML meta 태그로 no-cache 강제

### 3. 키 타입 혼용
**원인**: 
- 초기에 `test_gck_docs_...` (문서 예시 키) 사용
- Widget 키와 API 키 혼동
**해결**: `test_ck_...` (API 키)로 통일

### 4. 중복 API 호출
**원인**: React useEffect가 두 번 실행
**해결**: `isProcessing` 플래그 추가

---

## ✅ 올바른 구현 체크리스트

### Frontend (CheckoutPage)
- [x] TossPayments SDK v2 로드
- [x] 올바른 Client Key 사용 (`test_ck_...`)
- [x] customerKey 생성 (`customer_${userId}`)
- [x] widgets 인스턴스 생성
- [x] Payment Methods UI 렌더링
- [x] Agreement UI 렌더링
- [x] requestPayment() 호출
- [x] successUrl/failUrl 설정

### Frontend (PaymentSuccessPage)
- [x] URL 파라미터 파싱 (paymentKey, orderId, amount)
- [x] Backend API 호출 (/api/payments/confirm)
- [x] 중복 호출 방지
- [x] 에러 처리

### Backend (Hono)
- [x] POST /api/payments/confirm 엔드포인트
- [x] TossPayments Confirm API 호출
- [x] Authorization Header (Basic Auth)
- [x] Secret Key 환경변수 관리
- [x] DB 업데이트 (payment_key, payment_status)
- [x] 에러 처리

---

## 🎯 최종 권장 사항

### 1. 캐시 정책
- HTML: no-cache (항상 최신 버전)
- JS/CSS: 1시간 캐시 + 해시 기반 파일명
- 이미지: 1일 캐시

### 2. 에러 추적
- Console.log 보존 (프로덕션에서도)
- 주요 단계마다 로그 출력
- Sentry 에러 모니터링

### 3. 결제 테스트
- 토스 개발자센터에서 테스트 결제 내역 확인
- API 로그에서 Confirm 요청 확인
- DB에서 order, payment 데이터 확인

