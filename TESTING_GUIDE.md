# 🧪 Multi-Region E-Commerce Testing Guide

## 📋 목차
1. [로컬 테스트 환경 설정](#1-로컬-테스트-환경-설정)
2. [한국 버전 테스트 (KR)](#2-한국-버전-테스트-kr)
3. [글로벌 버전 테스트 (GLOBAL)](#3-글로벌-버전-테스트-global)
4. [결제 테스트](#4-결제-테스트)
5. [언어 전환 테스트](#5-언어-전환-테스트)
6. [트러블슈팅](#6-트러블슈팅)

---

## 1. 로컬 테스트 환경 설정

### 1.1 Prerequisites
```bash
# Node.js 18+ 필수
node -v  # v18.0.0 이상

# 패키지 설치 확인
npm install
```

### 1.2 환경 변수 확인
```bash
# .env.kr 파일 확인
cat .env.kr

# .env.global 파일 확인
cat .env.global
```

---

## 2. 한국 버전 테스트 (KR)

### 2.1 빌드 & 실행
```bash
# 한국 버전 빌드
npm run build:kr

# 미리보기 실행
npm run preview

# 브라우저에서 열기
# http://localhost:4173
```

### 2.2 테스트 체크리스트

#### ✅ **로그인 테스트**
- [ ] **카카오 로그인 버튼** 표시 확인
- [ ] 카카오 로그인 버튼 클릭 시 Kakao OAuth 페이지로 이동
- [ ] 로그인 후 returnUrl로 리다이렉트
- [ ] 이메일 로그인도 정상 작동

**테스트 계정**:
- Email: `tobe2111@naver.com`
- Password: `358533aa!!`

#### ✅ **UI 언어 테스트**
- [ ] 기본 언어가 **한국어**로 표시
- [ ] 헤더에 언어 전환 드롭다운 표시 (한국어 ↔ 영어)
- [ ] 로그인 버튼: "로그인"
- [ ] 회원가입 버튼: "회원가입"

#### ✅ **결제 테스트 (Toss Payments)**
1. 상품을 장바구니에 추가
2. 장바구니에서 "결제하기" 클릭
3. CheckoutPage에서 **Toss Payment Widget** 로드 확인
4. 배송지 입력
5. 결제 수단 선택 (카드, 계좌이체 등)
6. "결제하기" 버튼 클릭
7. Toss Payments 결제창 표시 확인

**Toss 테스트 카드**:
```
카드번호: 5570****0001****
만료일: 01/25
CVC: 123
```

---

## 3. 글로벌 버전 테스트 (GLOBAL)

### 3.1 빌드 & 실행
```bash
# 글로벌 버전 빌드
npm run build:global

# 미리보기 실행
npm run preview

# 브라우저에서 열기
# http://localhost:4173
```

### 3.2 테스트 체크리스트

#### ✅ **로그인 테스트**
- [ ] **Google 로그인 버튼** 표시 확인 (4색 Google 로고)
- [ ] Google 로그인 버튼 클릭 시 Firebase Google OAuth 팝업
- [ ] 로그인 후 returnUrl로 리다이렉트
- [ ] 이메일 로그인도 정상 작동

**⚠️ 주의**: Google 로그인 사용 전 Firebase Console에서 Google Authentication 활성화 필요!

#### ✅ **UI 언어 테스트**
- [ ] 기본 언어가 **English**로 표시
- [ ] 헤더에 언어 전환 드롭다운 표시 (English ↔ Korean)
- [ ] 로그인 버튼: "Login"
- [ ] 회원가입 버튼: "Sign Up"

#### ✅ **결제 테스트 (Stripe)**
1. 상품을 장바구니에 추가
2. 장바구니에서 "Proceed to Checkout" 클릭
3. CheckoutPage에서 **Stripe Payment Element** 로드 확인
4. 배송지 입력
5. 카드 정보 입력

**Stripe 테스트 카드**:
```
카드번호: 4242 4242 4242 4242
만료일: 12/34 (미래 날짜)
CVC: 123
ZIP: 12345
```

6. "Pay" 버튼 클릭
7. 결제 성공 페이지로 이동 확인

**추가 테스트 카드**:
| 카드 번호 | 설명 |
|-----------|------|
| 4000 0025 0000 3155 | 3D Secure 인증 필요 |
| 4000 0000 0000 9995 | 결제 거절 (insufficient funds) |
| 4000 0000 0000 0069 | 카드 만료 에러 |

---

## 4. 결제 테스트

### 4.1 한국 버전 - Toss Payments

#### Payment Flow
```
1. 장바구니 → 2. CheckoutPage → 3. TossPaymentWidget 로드
→ 4. 결제 수단 선택 → 5. 결제하기 → 6. Toss 결제창
→ 7. PaymentSuccessPage
```

#### 확인 사항
- [ ] `isKorea()` → `<TossPaymentWidget/>` 렌더링
- [ ] Toss SDK 정상 로드 (console에서 `[TossPayments]` 로그 확인)
- [ ] Payment Method UI 정상 표시
- [ ] 약관 동의 UI 표시
- [ ] 결제 금액 정확함 (상품금액 + 배송비)

### 4.2 글로벌 버전 - Stripe

#### Payment Flow
```
1. Cart → 2. CheckoutPage → 3. StripeCheckout 로드
→ 4. Payment Intent 생성 → 5. Stripe Elements 표시
→ 6. 카드 정보 입력 → 7. Pay 버튼 → 8. PaymentSuccessPage
```

#### 확인 사항
- [ ] `isGlobal()` → `<StripeCheckout/>` 렌더링
- [ ] `/api/payment/stripe/create-intent` API 호출 성공
- [ ] `clientSecret` 정상 수신
- [ ] Stripe Payment Element 정상 표시
- [ ] 카드 입력 validation 작동
- [ ] 결제 금액 정확함 (cents 단위로 변환)

### 4.3 결제 API 디버깅

#### Backend Logs 확인
```bash
# Cloudflare Wrangler tail
wrangler pages deployment tail

# 또는 로컬 개발 서버
npm run dev
# → http://localhost:5173 에서 테스트
```

#### Expected API Responses

**✅ Stripe Payment Intent 성공**:
```json
{
  "success": true,
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

**❌ Stripe 에러 (Secret Key 없음)**:
```json
{
  "success": false,
  "error": "Stripe is not configured. Please contact support."
}
```

---

## 5. 언어 전환 테스트

### 5.1 LanguageSwitcher 동작 확인
1. 헤더 우측 상단의 언어 드롭다운 클릭
2. 언어 전환 (한국어 ↔ English)
3. 페이지 전체 UI가 즉시 변경되는지 확인

### 5.2 번역 키 확인
```bash
# 한국어 번역 파일
cat public/locales/ko/translation.json

# 영어 번역 파일
cat public/locales/en/translation.json
```

#### 테스트할 UI 요소
- [ ] 네비게이션 (Home, Shop, Cart, etc.)
- [ ] 로그인 페이지 (Login, Sign Up, Forgot Password)
- [ ] 장바구니 (Cart, Quantity, Total)
- [ ] 결제 페이지 (Payment Method, Pay, Processing)
- [ ] 에러 메시지

---

## 6. 트러블슈팅

### 6.1 Kakao 로그인 실패

**문제**: 카카오 로그인 버튼 클릭 시 에러
**해결**:
1. Kakao SDK가 로드되었는지 확인:
   ```javascript
   console.log(window.Kakao)
   ```
2. `.env.kr`의 `VITE_KAKAO_APP_KEY` 확인
3. Kakao Developers Console에서 Redirect URI 설정:
   - `https://live.ur-team.com/auth/kakao/sync/callback`

### 6.2 Google 로그인 실패

**문제**: Google 로그인 버튼 클릭 시 에러
**해결**:
1. Firebase Console → Authentication → Sign-in method → Google 활성화
2. `.env.global`의 `VITE_GOOGLE_CLIENT_ID` 설정
3. Firebase 프로젝트 설정에서 승인된 도메인 추가:
   - `localhost` (개발)
   - `global.ur-team.com` (프로덕션)

### 6.3 Stripe Payment Intent 생성 실패

**문제**: "Stripe is not configured" 에러
**해결**:
1. Cloudflare Dashboard → Workers & Pages → ur-live-global → Settings → Environment Variables
2. `STRIPE_SECRET_KEY` 추가:
   ```
   sk_test_YOUR_STRIPE_SECRET_KEY
   ```
3. 배포 후 재시도

### 6.4 Toss Payment Widget이 로드되지 않음

**문제**: 결제 UI가 표시되지 않음
**해결**:
1. `index.html`에 Toss SDK 스크립트 확인:
   ```html
   <script src="https://js.tosspayments.com/v1/payment-widget"></script>
   ```
2. Console에서 `window.PaymentWidget` 존재 여부 확인
3. `.env.kr`의 `VITE_TOSS_CLIENT_KEY` 확인

### 6.5 Region 분기가 작동하지 않음

**문제**: 한국 버전에서 Google 로그인이 표시됨
**해결**:
1. 빌드 시 올바른 명령어 사용:
   ```bash
   npm run build:kr  # 한국 버전
   npm run build:global  # 글로벌 버전
   ```
2. `src/config/region.ts`의 `REGION` 값 확인:
   ```javascript
   console.log(import.meta.env.VITE_REGION)
   // KR 또는 GLOBAL 출력되어야 함
   ```

---

## 🎯 테스트 완료 체크리스트

### 한국 버전 (KR)
- [ ] 카카오 로그인 성공
- [ ] 한국어 UI 표시
- [ ] Toss Payment Widget 로드
- [ ] 테스트 결제 성공

### 글로벌 버전 (GLOBAL)
- [ ] Google 로그인 성공
- [ ] English UI 표시
- [ ] Stripe Payment Element 로드
- [ ] 테스트 결제 성공 (4242 카드)

### 공통
- [ ] 언어 전환 정상 작동
- [ ] Seller/Admin JWT 로그인 정상
- [ ] 모바일 반응형 정상
- [ ] 에러 핸들링 정상

---

## 📞 Support

문제가 발생하면:
1. Browser Console 확인 (F12)
2. Network 탭에서 API 요청 확인
3. `wrangler pages deployment tail` 로그 확인
4. GitHub Issues에 리포트

---

**테스트 완료 후**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) 참고하여 배포 진행!
