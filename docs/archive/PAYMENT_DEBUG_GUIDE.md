# Toss Payments 결제 위젯 디버깅 가이드

## 🔍 현재 상황

**증상**: "/checkout에서 '오류가 발생했어요. 결제 화면을 불러올 수 없습니다' 메시지"

**배포 버전**: https://5728dec9.toss-live-commerce.pages.dev

---

## 🧪 디버깅 방법

### 1단계: 브라우저 콘솔 확인

```bash
1. https://live.ur-team.com/login 접속
2. 로그인: user@example.com / user123
3. 장바구니에 상품 추가
4. /checkout 이동
5. F12 → Console 탭 열기
6. 로그 확인
```

### 2단계: 로그 분석

#### ✅ 정상 로그 (예상)
```javascript
[CheckoutPage] Step 1 실행 조건 체크: {userId: "1", cartItemsLength: 3}
[CheckoutPage] Step 1 시작: loadTossPayments 호출... {clientKey: "test_gck_P9BRQmyarY..."}
[CheckoutPage] loadTossPayments 완료
[CheckoutPage] widgets() 호출... {customerKey: "ANONYMOUS"}
[CheckoutPage] widgets() 완료
[CheckoutPage] ✅ Step 1 완료: TossPayments widgets 초기화 성공

[CheckoutPage] Step 2 실행 조건 체크: {hasWidgets: true, totalAmount: 412000}
[CheckoutPage] Step 2 시작: setAmount 호출... {currency: "KRW", value: 412000}
[CheckoutPage] setAmount 완료
[CheckoutPage] renderPaymentMethods & renderAgreement 호출...
[CheckoutPage] UI 렌더링 완료
[CheckoutPage] ✅ Step 2 완료: 결제 UI 렌더링 성공
```

#### ❌ 오류 로그 (확인 필요)

**경우 1: Step 1에서 실패**
```javascript
[CheckoutPage] Step 1 시작: loadTossPayments 호출...
[CheckoutPage] ❌ Step 1 실패: TossPayments 초기화 오류: Error: ...
Error details: {
  name: "TypeError",
  message: "Cannot read property 'widgets' of undefined",
  stack: "..."
}
```
→ **원인**: `loadTossPayments()` 실패 또는 clientKey 문제

**경우 2: Step 2에서 실패**
```javascript
[CheckoutPage] ✅ Step 1 완료: TossPayments widgets 초기화 성공
[CheckoutPage] Step 2 실행 조건 체크: {hasWidgets: true, totalAmount: 412000}
[CheckoutPage] Step 2 시작: setAmount 호출...
[CheckoutPage] ❌ Step 2 실패: 결제 UI 렌더링 오류: Error: ...
Error details: {
  name: "TossPaymentsError",
  message: "INVALID_CLIENT_KEY",
  stack: "..."
}
```
→ **원인**: clientKey가 유효하지 않음

**경우 3: Step 1 실행 안 됨**
```javascript
[CheckoutPage] Step 1 건너뜀: userId 또는 cartItems 없음
```
→ **원인**: 로그인되지 않았거나 장바구니가 비어있음

**경우 4: Step 2 실행 안 됨**
```javascript
[CheckoutPage] ✅ Step 1 완료
[CheckoutPage] Step 2 건너뜀: widgets가 null
```
→ **원인**: widgets 상태 업데이트 실패

---

## 🔧 문제별 해결 방법

### 문제 1: clientKey 오류
```javascript
// Error: INVALID_CLIENT_KEY
```

**해결**:
1. Cloudflare Pages 환경변수 확인
   - Settings → Environment variables
   - `VITE_TOSS_CLIENT_KEY` 확인
2. 올바른 키 형식: `test_gck_xxx` (결제위젯 연동 키)
3. 재배포 필요 (환경변수 변경 시)

### 문제 2: 장바구니 비어있음
```javascript
// Step 1 건너뜀: cartItems 없음
```

**해결**:
1. 메인 페이지 → 라이브 스트림 → 상품 추가
2. 장바구니 확인
3. 체크아웃 다시 시도

### 문제 3: loadTossPayments() 실패
```javascript
// Step 1 실패: TossPayments 초기화 오류
```

**가능한 원인**:
1. SDK 로드 실패 (네트워크)
2. clientKey undefined
3. Toss Payments 서버 오류

**해결**:
```bash
# 1. 네트워크 탭 확인
F12 → Network → Filter: tosspayments
# SDK 파일이 200 OK로 로드되는지 확인

# 2. clientKey 확인
console.log(import.meta.env.VITE_TOSS_CLIENT_KEY)
# 값이 출력되는지 확인
```

### 문제 4: renderPaymentMethods() 실패
```javascript
// Step 2 실패: 결제 UI 렌더링 오류
```

**가능한 원인**:
1. DOM selector 없음 (#payment-widget, #agreement)
2. 금액이 0원
3. Toss Payments SDK 버그

**해결**:
```bash
# DOM 확인
document.querySelector('#payment-widget')
document.querySelector('#agreement')
# null이 아니어야 함

# 금액 확인
console.log(totalAmount)
# 0보다 커야 함
```

---

## 📝 로그 예시 (실제 오류 케이스)

### 케이스 A: API 가이드 문제
```javascript
[CheckoutPage] ✅ Step 1 완료
[CheckoutPage] Step 2 시작: setAmount 호출...
[CheckoutPage] ❌ Step 2 실패: Error: widgets.setAmount is not a function
```
→ **판단**: SDK API 변경 또는 문서 불일치

### 케이스 B: 내부 코드 문제
```javascript
[CheckoutPage] Step 1 실행 조건 체크: {userId: undefined, cartItemsLength: 0}
[CheckoutPage] Step 1 건너뜀: userId 또는 cartItems 없음
```
→ **판단**: 로그인 상태 체크 또는 장바구니 로드 문제

### 케이스 C: Toss Payments 서버 문제
```javascript
[CheckoutPage] Step 1 시작: loadTossPayments 호출...
[CheckoutPage] ❌ Step 1 실패: Error: Network request failed
```
→ **판단**: Toss Payments CDN 또는 서버 장애

---

## 🎯 다음 단계

### 로그를 확인한 후:

1. **정상 로그가 보이면** → 성공! 결제 진행
2. **Step 1 실패** → clientKey 또는 네트워크 문제
3. **Step 2 실패** → SDK API 문제 또는 DOM 문제
4. **실행 안 됨** → 로그인 또는 장바구니 문제

### 로그를 보내주시면:
```
스크린샷 또는 텍스트로 콘솔 로그 전체를 공유해주세요.
특히 "❌" 마크가 있는 부분과 Error details를 확인하겠습니다.
```

---

## 🔑 핵심 체크리스트

- [ ] 로그인 되어 있나요?
- [ ] 장바구니에 상품이 있나요?
- [ ] F12 콘솔에서 Step 1 로그가 보이나요?
- [ ] Step 1이 성공(✅)했나요?
- [ ] Step 2 로그가 보이나요?
- [ ] Step 2가 성공(✅)했나요?
- [ ] 에러 메시지가 있다면 무엇인가요?

---

## 📚 참고

### 테스트 계정
- 이메일: user@example.com
- 비밀번호: user123

### URL
- Production: https://live.ur-team.com/checkout
- Preview: https://5728dec9.toss-live-commerce.pages.dev/checkout

### 관련 파일
- `src/pages/CheckoutPage.tsx` - 결제 페이지 (디버그 로그 추가됨)
- `src/index.tsx` - 백엔드 API

---

**작성일**: 2026-02-11  
**버전**: v1.0 (Enhanced Logging)  
**커밋**: `b32f307`

**콘솔 로그를 확인하고 공유해주세요!** 🔍
