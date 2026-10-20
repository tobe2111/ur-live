# 체크아웃 페이지 오류 디버깅 가이드

## 🔍 오류 메시지: "결제 화면을 불러올 수 없습니다"

이 가이드는 체크아웃 페이지에서 "결제 화면을 불러올 수 없습니다" 오류가 발생할 때 문제를 진단하고 해결하는 방법을 설명합니다.

---

## 📋 목차
1. [일반적인 원인](#일반적인-원인)
2. [단계별 디버깅](#단계별-디버깅)
3. [체크리스트](#체크리스트)
4. [해결 방법](#해결-방법)

---

## 1. 일반적인 원인

### ❌ 원인 1: 로그인하지 않음
**증상**: 체크아웃 페이지 접속 시 로그인 페이지로 리다이렉트됨

**이유**: CheckoutPage는 로그인 필수 페이지입니다.

**해결**:
```
1. https://live.ur-team.com/login 접속
2. 테스트 계정 로그인:
   - 이메일: user@example.com
   - 비밀번호: user123
3. https://live.ur-team.com/checkout 재접속
```

### ❌ 원인 2: 장바구니가 비어있음
**증상**: 
- 결제 준비 중... 상태에서 멈춤
- totalAmount가 0원

**이유**: 장바구니에 상품이 없으면 결제 금액이 0원이 되어 Toss SDK가 초기화되지 않습니다.

**확인 방법**:
```javascript
// F12 → Console에서 확인
console.log('[CheckoutPage] totalAmount:', totalAmount)  // 0이면 문제
```

**해결**:
```
1. https://live.ur-team.com/live 접속
2. 상품 목록에서 "장바구니 담기" 클릭
3. https://live.ur-team.com/checkout 재접속
```

### ❌ 원인 3: DOM 요소가 준비되지 않음
**증상**:
- Console 로그: "결제 위젯 DOM 요소를 찾을 수 없습니다"
- `#payment-widget` 또는 `#agreement` 요소가 없음

**이유**: React 렌더링이 완료되기 전에 Toss SDK가 실행되었습니다.

**확인 방법**:
```javascript
// F12 → Console에서 확인
console.log('[CheckoutPage] DOM 요소 확인:', {
  hasPaymentElement: !!document.querySelector('#payment-widget'),
  hasAgreementElement: !!document.querySelector('#agreement')
})
```

**해결**: (이미 적용됨)
- Step 2 실행 전 100ms 지연 추가
- DOM 요소 존재 확인 로직 추가

### ❌ 원인 4: Toss SDK 로드 실패
**증상**:
- Console 로그: "[CheckoutPage] ❌ Step 1 실패"
- 네트워크 오류 또는 CORS 오류

**이유**: 
- 네트워크 연결 문제
- Toss Payments 서버 장애
- 방화벽 또는 광고 차단기

**확인 방법**:
```javascript
// F12 → Console에서 확인
// 정상: [CheckoutPage] ✅ Step 1 완료
// 오류: [CheckoutPage] ❌ Step 1 실패
```

**해결**:
- 페이지 새로고침 (Ctrl + Shift + R)
- 광고 차단기 비활성화
- 다른 브라우저로 시도

### ❌ 원인 5: 환경 변수 누락
**증상**:
- Console 로그: "clientKey가 설정되지 않았습니다"
- clientKey가 undefined

**이유**: `VITE_TOSS_CLIENT_KEY` 환경 변수가 설정되지 않음

**확인 방법**:
```javascript
// CheckoutPage.tsx Line 13
const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN'

// F12 → Console에서 확인
console.log('clientKey:', clientKey)
```

**해결**: (이미 기본값 설정됨)
```env
# .env
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
```

---

## 2. 단계별 디버깅

### Step 1: F12 콘솔 열기
```
1. Chrome/Edge: F12 또는 Ctrl + Shift + I
2. Console 탭 클릭
3. 기존 로그 지우기 (Clear console)
```

### Step 2: 체크아웃 페이지 접속
```
https://live.ur-team.com/checkout
```

### Step 3: 콘솔 로그 확인

#### ✅ 정상 로그 (성공)
```javascript
[CheckoutPage] userId: 1
[CheckoutPage] cartItems.length: 2
[CheckoutPage] totalAmount: 153000

[CheckoutPage] Step 1 시작: loadTossPayments 호출... {clientKey: "test_gck_P9BRQmyarYPA5lOO6OX..."}
[CheckoutPage] loadTossPayments 완료
[CheckoutPage] widgets() 호출... {customerKey: "ANONYMOUS"}
[CheckoutPage] widgets() 완료
[CheckoutPage] ✅ Step 1 완료: TossPayments widgets 초기화 성공

[CheckoutPage] Step 2 실행 조건 체크: {hasWidgets: true, totalAmount: 153000}
[CheckoutPage] DOM 요소 확인: {hasPaymentElement: true, hasAgreementElement: true}
[CheckoutPage] Step 2 시작: setAmount 호출... {currency: "KRW", value: 153000}
[CheckoutPage] setAmount 완료
[CheckoutPage] renderPaymentMethods & renderAgreement 호출...
[CheckoutPage] UI 렌더링 완료
[CheckoutPage] ✅ Step 2 완료: 결제 UI 렌더링 성공
```

#### ❌ 오류 로그 (실패)

**Case 1: 로그인 안함**
```javascript
// 로그 없음 (로그인 페이지로 리다이렉트)
```

**Case 2: 장바구니 비어있음**
```javascript
[CheckoutPage] userId: 1
[CheckoutPage] cartItems.length: 0  // ← 문제!
[CheckoutPage] totalAmount: 0  // ← 문제!

[CheckoutPage] Step 2 실행 조건 체크: {hasWidgets: true, totalAmount: 0}
[CheckoutPage] Step 2 건너뜀: totalAmount가 0
```

**Case 3: DOM 요소 없음**
```javascript
[CheckoutPage] DOM 요소 확인: {hasPaymentElement: false, hasAgreementElement: false}
[CheckoutPage] ❌ Step 2 실패: 결제 UI 렌더링 오류: Error: 결제 위젯 DOM 요소를 찾을 수 없습니다.
```

**Case 4: SDK 로드 실패**
```javascript
[CheckoutPage] Step 1 시작: loadTossPayments 호출...
[CheckoutPage] ❌ Step 1 실패: TossPayments 초기화 오류: Error: ...
```

### Step 4: 네트워크 탭 확인
```
1. F12 → Network 탭
2. 필터: JS
3. 다음 파일들이 로드되었는지 확인:
   - tosspayments-sdk (Status: 200)
```

### Step 5: Elements 탭 확인
```
1. F12 → Elements 탭
2. Ctrl + F로 검색: "payment-widget"
3. <div id="payment-widget"> 요소가 존재하는지 확인
4. <div id="agreement"> 요소가 존재하는지 확인
```

---

## 3. 체크리스트

### 사전 준비
- [ ] 로그인 완료 (`user@example.com` / `user123`)
- [ ] 장바구니에 상품 1개 이상 추가
- [ ] 배송지 1개 이상 등록
- [ ] F12 콘솔 열기

### 페이지 로드 시
- [ ] 로그인 페이지로 리다이렉트되지 않음
- [ ] "결제 준비 중..." → "결제하기" 버튼으로 변경
- [ ] 결제 위젯 UI가 표시됨 (카드, 계좌이체, 가상계좌 등)
- [ ] 이용약관 체크박스가 표시됨
- [ ] 총 결제 금액이 정상적으로 표시됨

### 콘솔 로그
- [ ] `[CheckoutPage] ✅ Step 1 완료` 표시
- [ ] `[CheckoutPage] ✅ Step 2 완료` 표시
- [ ] ❌ 로그 없음

### DOM 요소
- [ ] `#payment-widget` 존재
- [ ] `#agreement` 존재

### 네트워크
- [ ] tosspayments-sdk 로드 성공 (Status: 200)
- [ ] CORS 오류 없음

---

## 4. 해결 방법

### 해결책 1: 기본 흐름 따라하기 ✅
```
1. 로그인: https://live.ur-team.com/login
   계정: user@example.com / user123

2. 상품 담기: https://live.ur-team.com/live
   → 상품 목록에서 "장바구니 담기"

3. 장바구니: https://live.ur-team.com/cart
   → "구매하기" 버튼 클릭

4. 체크아웃: https://live.ur-team.com/checkout
   → 결제 위젯이 정상 표시됨
```

### 해결책 2: 페이지 새로고침
```
Ctrl + Shift + R (강력 새로고침)
또는
Ctrl + F5
```

### 해결책 3: 캐시 삭제
```
Chrome:
1. Ctrl + Shift + Delete
2. "캐시된 이미지 및 파일" 체크
3. "인터넷 사용 기록 삭제" 클릭
```

### 해결책 4: 시크릿 모드 시도
```
Ctrl + Shift + N (Chrome)
Ctrl + Shift + P (Firefox/Edge)
```

### 해결책 5: 다른 브라우저 시도
```
Chrome → Edge → Firefox
```

### 해결책 6: 개발자 도구 확인
```
1. F12 → Console
2. 모든 로그 복사
3. 개발자에게 전달
```

---

## 5. 최신 수정 사항

### 2025-02-11: DOM 요소 체크 추가
```typescript
// 렌더링 전 100ms 대기
await new Promise(resolve => setTimeout(resolve, 100))

// DOM 요소 존재 확인
const paymentElement = document.querySelector('#payment-widget')
const agreementElement = document.querySelector('#agreement')

if (!paymentElement || !agreementElement) {
  throw new Error('결제 위젯 DOM 요소를 찾을 수 없습니다.')
}
```

**효과**: DOM이 준비되기 전에 Toss SDK가 실행되는 문제 해결

---

## 6. 관련 문서

- [체크아웃 테스트 가이드](./CHECKOUT_TEST_GUIDE.md)
- [공식 SDK 마이그레이션 가이드](./OFFICIAL_SDK_MIGRATION.md)
- [결제 위젯 디버그 가이드](./PAYMENT_DEBUG_GUIDE.md)
- [Toss Payments 공식 문서](https://docs.tosspayments.com/guides/v2/payment-widget/integration?frontend=react)

---

## 7. 지원

### 배포 URL
- **Preview**: https://b66ed331.toss-live-commerce.pages.dev
- **Production**: https://live.ur-team.com

### 연락처
- **Toss Payments**: 1544-7772
- **이메일**: support@tosspayments.com

---

## ✅ 요약

### 오류 발생 시 체크리스트:

1. ✅ **로그인했는가?**
   - 아니오 → https://live.ur-team.com/login

2. ✅ **장바구니에 상품이 있는가?**
   - 아니오 → https://live.ur-team.com/live에서 상품 담기

3. ✅ **F12 콘솔에 오류가 있는가?**
   - 예 → 위의 오류 로그 참고

4. ✅ **페이지 새로고침 시도했는가?**
   - 아니오 → Ctrl + Shift + R

5. ✅ **모두 시도했지만 여전히 안 되는가?**
   - 콘솔 로그를 복사해서 개발자에게 전달

---

## 🎯 최종 확인 사항

현재 배포된 버전에는 다음 수정사항이 적용되어 있습니다:

- ✅ 공식 Toss SDK 사용 (`@tosspayments/tosspayments-sdk`)
- ✅ DOM 요소 존재 확인 로직
- ✅ 100ms 지연으로 렌더링 타이밍 최적화
- ✅ 상세한 콘솔 로깅
- ✅ 셀러별 배송비 계산

**대부분의 경우 "로그인" + "장바구니에 상품 추가"로 해결됩니다!** 🎉
