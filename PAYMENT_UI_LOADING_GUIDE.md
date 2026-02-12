# 🔍 결제 UI 로드 문제 해결 가이드

## 📌 문제 상황

`https://live.ur-team.com/checkout` 페이지에서 "결제 UI를 불러올 수 없습니다" 에러 발생

---

## ✅ 원인 분석

### 1️⃣ CheckoutPage 접근 조건

CheckoutPage는 다음 조건을 **모두** 만족해야 결제 UI가 표시됩니다:

```typescript
// 1. 로그인 필수
if (!isLoggedIn()) {
  requireLogin()  // 로그인 페이지로 리다이렉트
  return
}

// 2. 장바구니에 상품 필수
if (cartItems.length === 0) {
  setError('장바구니가 비어있습니다.')
  setTimeout(() => navigate('/cart'), 2000)
  return
}

// 3. userId 필수
if (!userId) {
  setError('사용자 정보를 확인할 수 없습니다.')
  return
}
```

### 2️⃣ 결제 UI 렌더링 조건

```typescript
// Step 1: SDK 초기화
if (!userId || cartItems.length === 0) {
  return  // widgets 인스턴스 생성 안 됨
}

// Step 2: UI 렌더링
if (widgets == null) {
  return  // 렌더링 안 됨
}
```

---

## 🛠️ 해결 방법

### 방법 1: 정상 플로우로 테스트 (권장)

```bash
# 1. 로그인
https://live.ur-team.com/login

# 2. 상품 추가
상품 페이지에서 장바구니에 추가

# 3. 장바구니 확인
https://live.ur-team.com/cart

# 4. 주문/결제
https://live.ur-team.com/checkout
```

### 방법 2: 데모 페이지 사용 (로그인 없이 테스트)

**✅ 새로 추가된 데모 페이지:**
```
https://live.ur-team.com/payment/demo
또는
https://1d929f80.toss-live-commerce.pages.dev/payment/demo
```

**특징:**
- ✅ 로그인 불필요
- ✅ 장바구니 불필요
- ✅ 즉시 결제 UI 테스트 가능
- ✅ 테스트 카드 정보 표시
- ✅ 5,000원 쿠폰 적용 테스트
- ✅ 디버그 정보 표시

---

## 🧪 데모 페이지 기능

### 표시 내용

1. **결제 정보**
   - 상품명: 테스트 상품
   - 결제 금액: 50,000원
   - 쿠폰 적용 옵션 (5,000원 할인)

2. **결제 수단 선택**
   - 카드
   - 계좌이체
   - 가상계좌
   - 휴대폰

3. **테스트 카드 정보**
   ```
   카드번호: 4000-0000-0000-0008
   유효기간: 12/25
   CVC: 123
   비밀번호: 12
   ```

4. **디버그 정보**
   - Client Key 확인
   - SDK 로드 상태
   - UI 준비 상태
   - 현재 금액

### 테스트 시나리오

**1. 정상 결제 흐름**
```
1. /payment/demo 접속
2. 결제 수단 선택 (카드)
3. 테스트 카드 입력
4. 결제하기 버튼 클릭
5. 결제 성공 확인
```

**2. 쿠폰 적용 테스트**
```
1. 쿠폰 체크박스 선택
2. 금액이 45,000원으로 변경되는지 확인
3. 결제하기 진행
```

**3. 에러 확인**
```
브라우저 개발자 도구 > 콘솔 탭
- [Demo] Step 1: SDK 초기화 시작
- [Demo] ✅ Step 1 완료
- [Demo] Step 2: 결제 UI 렌더링 시작
- [Demo] ✅ Step 2 완료
```

---

## 🔑 환경 변수 확인

### 프론트엔드 (Vite)

```bash
# .env 파일
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
```

### Cloudflare Pages

**중요:** Cloudflare Pages Dashboard에서 환경 변수 설정

```
Settings > Environment variables > Production

Name: VITE_TOSS_CLIENT_KEY
Value: test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
```

**주의:** 환경 변수 변경 후 **재배포** 필요!

---

## 🐛 디버깅 방법

### 1️⃣ 브라우저 콘솔 확인

```javascript
// 개발자 도구 > 콘솔
// 다음 로그를 확인:

[TossPayments] Step 1: SDK 초기화 시작
[TossPayments] ✅ Step 1 완료
[TossPayments] Step 2: 결제 UI 렌더링 시작
[TossPayments] ✅ Step 2 완료
```

### 2️⃣ 에러 패턴별 해결

**"로그인이 필요합니다"**
```
원인: isLoggedIn() === false
해결: /login으로 이동하여 로그인
```

**"장바구니가 비어있습니다"**
```
원인: cartItems.length === 0
해결: 상품을 장바구니에 추가
```

**"결제 UI를 불러올 수 없습니다"**
```
원인 1: userId 또는 cartItems 없음
원인 2: SDK 로드 실패 (clientKey 오류)
원인 3: DOM 요소 (#payment-method, #agreement) 없음

해결: 데모 페이지(/payment/demo)에서 테스트
```

---

## 📊 CheckoutPage vs DemoPage 비교

| 항목 | CheckoutPage | DemoPage |
|------|-------------|----------|
| URL | `/checkout` | `/payment/demo` |
| 로그인 | ✅ 필수 | ❌ 불필요 |
| 장바구니 | ✅ 필수 | ❌ 불필요 |
| 배송지 | ✅ 필수 | ❌ 불필요 |
| 실제 결제 | ✅ 가능 | ✅ 가능 |
| 테스트 용도 | 실제 플로우 | UI 테스트 |

---

## 🚀 테스트 순서 (권장)

### 1단계: 데모 페이지로 UI 확인
```
1. https://live.ur-team.com/payment/demo 접속
2. 결제 수단이 모두 표시되는지 확인
   - 카드
   - 계좌이체
   - 가상계좌
   - 휴대폰
3. 테스트 카드로 결제 테스트
```

### 2단계: 실제 플로우 테스트
```
1. 로그인
2. 상품 추가
3. 장바구니 확인
4. 배송지 선택
5. 결제하기
```

---

## 🔗 유용한 링크

- **토스페이먼츠 Sandbox:** https://developers.tosspayments.com/sandbox
- **공식 문서:** https://docs.tosspayments.com/guides/v2/payment-widget/integration
- **테스트 카드:** https://docs.tosspayments.com/guides/v2/payment-widget/integration#테스트-카드

---

## 📝 결론

### 정상 작동 확인 방법

1. **데모 페이지 접속**
   ```
   https://live.ur-team.com/payment/demo
   ```

2. **결제 수단 확인**
   - 카드, 계좌이체, 가상계좌, 휴대폰 모두 표시되어야 함

3. **디버그 정보 확인**
   ```
   SDK Loaded: ✅ Yes
   UI Ready: ✅ Yes
   ```

4. **테스트 결제**
   - 테스트 카드로 실제 결제 진행
   - 결제 성공 페이지 확인

---

**작성일:** 2025-02-12  
**작성자:** Claude (AI Developer)  
**배포 URL:** 
- Production: https://live.ur-team.com/payment/demo
- Preview: https://1d929f80.toss-live-commerce.pages.dev/payment/demo
