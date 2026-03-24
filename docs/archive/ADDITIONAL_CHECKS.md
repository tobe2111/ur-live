# 🔍 토스페이먼츠 추가 점검 사항

## ✅ **이미 확인된 사항 (모두 정상)**

### **1. SDK & 초기화**
- ✅ SDK URL: `https://js.tosspayments.com/v1/payment-widget`
- ✅ 초기화: `PaymentWidget(clientKey, customerKey)` (함수 호출)
- ✅ 클라이언트 키: `test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN`
- ✅ 시크릿 키: `test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY`

### **2. 렌더링**
- ✅ `renderPaymentMethods()` 반환값 저장
- ✅ `on('ready')` 이벤트 사용
- ✅ `paymentMethodWidget.updateAmount()` 사용
- ✅ 동기 메서드 처리

### **3. 결제 요청**
- ✅ `requestPayment()` - await 없음
- ✅ successUrl/failUrl 설정
- ✅ 리다이렉트 방식

### **4. 백엔드**
- ✅ API 버전: `2022-11-16` (결제위젯 전용)
- ✅ amount: `Number(amount)` 변환
- ✅ Authorization 헤더: Basic 인증
- ✅ 요청 body: orderId, amount, paymentKey

---

## 🔍 **추가 확인 필요 사항**

### **1. 테스트 키 유효성** ⚠️

**문제 가능성**: 
- 클라이언트 키와 시크릿 키가 **서로 다른 상점(MID)**에 발급된 경우
- 키가 **만료**되었거나 **비활성화**된 경우

**확인 방법**:
```bash
# 시크릿 키로 API 호출 테스트
curl -X POST https://api.tosspayments.com/v1/payments/confirm \
  -H "Authorization: Basic $(echo -n 'test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY:' | base64)" \
  -H "Content-Type: application/json" \
  -H "TossPayments-API-Version: 2022-11-16" \
  -d '{
    "paymentKey": "test_key",
    "orderId": "test_order",
    "amount": 1000
  }'
```

**예상 응답**:
- ❌ `INVALID_API_KEY`: 키가 잘못됨 또는 매칭 안됨
- ❌ `NOT_FOUND_PAYMENT_SESSION`: 키는 정상, 결제 세션 없음 (정상)
- ✅ 다른 에러: 키는 정상

---

### **2. MID (상점 ID) 확인** ⚠️

**문제 가능성**:
- 토스 개발자센터에서 **결제 UI 설정**을 하지 않음
- **MID 매칭**이 안되어 있음

**확인 방법**:
1. https://developers.tosspayments.com/ 로그인
2. **상점 선택** (MID 확인)
3. **결제 UI 설정** → DEFAULT variantKey 확인
4. **MID 매칭** 여부 확인

**참고**: 테스트 키는 MID와 상관없이 작동해야 하지만, 특정 경우 문제 발생 가능

---

### **3. 브라우저 콘솔 에러 확인** ⚠️

**확인 항목**:
- ✅ SDK 로드: `window.PaymentWidget` 존재 여부
- ✅ 초기화 성공: `[TossPayments] ✅ PaymentWidget 인스턴스 생성 완료`
- ✅ DOM 요소: `#payment-method`, `#agreement` 발견
- ✅ 렌더링 성공: `[TossPayments] ✅ Step 2 완료`
- ✅ ready 이벤트: `[TossPayments] ✅ UI 렌더링 준비됨`
- ❌ **에러 발생 시점 확인**

---

### **4. 모바일 특수 상황** ⚠️

**확인 항목**:
1. **WebView 환경인가?**
   - 앱 내 WebView: `appScheme` 필요 (현재 없음)
   - 모바일 브라우저: 문제 없음

2. **iOS Safari 제약사항**:
   - Popup 차단
   - Third-party cookie 차단
   - Cross-origin 제약

3. **Android Chrome 제약사항**:
   - Intent URL 처리
   - 카드사 앱 자동 실행

---

### **5. HTTPS 필수** ✅

**현재 상태**:
- ✅ Production: `https://live.ur-team.com`
- ✅ Preview: `https://...pages.dev`

**확인**: HTTP에서는 결제 위젯 작동 안함

---

### **6. CORS 설정** ✅

**확인 완료**:
```typescript
app.use('/api/*', cors())
```

---

### **7. 금액 불일치** ⚠️

**주의사항**:
- Frontend에서 보내는 금액
- Backend에서 저장하는 금액
- Toss API로 보내는 금액
- **모두 일치해야 함**

**현재 코드 확인**:
```typescript
// CheckoutPage: totalAmount 계산
const totalAmount = subtotal + totalShippingFee

// PaymentSuccessPage: amount 파라미터
amount: Number(amount)

// Backend: Number 변환
amount: Number(amount)
```

✅ **모두 Number 타입으로 변환 중**

---

### **8. 세션 만료 시간** ⚠️

**토스페이먼츠 정책**:
- 결제 요청 후 **30분 이내** 승인 필요
- 30분 초과 시 `NOT_FOUND_PAYMENT_SESSION` 에러

**해결책**:
- 테스트 시 빠르게 진행
- 재테스트 필요 시 새로 결제 요청

---

### **9. 네트워크 환경** ⚠️

**확인 항목**:
- ✅ Cloudflare Pages: 정상
- ⚠️ 사용자 네트워크: VPN, 방화벽, 프록시 확인
- ⚠️ 모바일 데이터: 통신사 차단 여부

---

### **10. 로그 확인** 🔍

**확인할 로그**:

**Frontend (브라우저 콘솔)**:
```
[TossPayments] Step 1: SDK 초기화 시작
[TossPayments] ✅ PaymentWidget 인스턴스 생성 완료
[TossPayments] ✅ DOM 요소 발견!
[TossPayments] ✅ Step 2 완료: UI 렌더링 준비됨 (ready 이벤트)
[Payment] requestPayment 호출
```

**Backend (Cloudflare 로그)**:
```
[Payment] 🚀 결제 승인 API 호출됨
[Payment] ✅ 필수 파라미터 검증 통과
[Payment] ✅ TOSS_SECRET_KEY 확인됨
[Payment] 🌐 토스페이먼츠 API 호출 시작
[Payment] 📡 토스페이먼츠 API 응답
```

---

## 🧪 **추가 테스트 방법**

### **Test 1: 키 유효성 직접 확인**
```bash
cd /home/user/webapp
echo -n "test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY:" | base64
# 결과를 사용해 curl 테스트
```

### **Test 2: 브라우저 개발자 도구**
1. Network 탭 열기
2. 결제 시도
3. `/api/payments/confirm` 요청 확인
4. Request/Response 확인

### **Test 3: 간단한 테스트 페이지**
```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://js.tosspayments.com/v1/payment-widget"></script>
</head>
<body>
    <button onclick="test()">결제 테스트</button>
    <script>
        function test() {
            const widget = PaymentWidget('test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN', 'test_customer');
            console.log('Widget created:', widget);
        }
    </script>
</body>
</html>
```

---

## 📋 **최종 체크리스트**

### **즉시 확인 가능**
- [ ] 브라우저 콘솔에서 SDK 로드 확인
- [ ] ready 이벤트 발생 확인
- [ ] 결제 버튼 활성화 확인

### **테스트 필요**
- [ ] PC 브라우저 테스트
- [ ] 모바일 Safari 테스트
- [ ] 모바일 Chrome 테스트
- [ ] 시크릿 모드 테스트

### **개발자센터 확인**
- [ ] 로그인 및 상점 확인
- [ ] 결제 UI 설정 확인
- [ ] MID 매칭 확인
- [ ] 테스트 결제 내역 확인

---

## 🎯 **현재 상태 요약**

### **✅ 완료된 사항 (100%)**
1. 공식 V1 샘플 코드 완벽 동기화
2. 초기화, 렌더링, 업데이트, 결제 요청 모두 정상
3. 백엔드 API 정상
4. 키 설정 정상

### **⚠️ 추가 확인 필요**
1. 실제 키 유효성 (API 호출 테스트)
2. 토스 개발자센터 설정
3. 모바일 환경 특수 상황
4. 브라우저 콘솔 실제 에러 메시지

---

## 💡 **다음 단계**

1. **브라우저 콘솔 확인**: 실제 에러 메시지 캡처
2. **네트워크 탭 확인**: API 요청/응답 확인
3. **토스 개발자센터 확인**: 설정 및 로그 확인
4. **curl 테스트**: 키 유효성 직접 확인

**위 4가지 확인 후 정확한 문제를 특정할 수 있습니다!**
