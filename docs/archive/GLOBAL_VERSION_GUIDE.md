# 🌍 UR LIVE 해외 버전 제작 가이드

## 📋 개요
- **목표**: 한국어 버전을 영어/다국어 버전으로 변환
- **방법**: 새 젠스파크 프로젝트에서 진행
- **소요 시간**: 약 2-3시간 (번역 + 테스트)

---

## 🎯 작업 프로세스

### STEP 1: 새 젠스파크 프로젝트 생성 (5분)

1️⃣ **젠스파크 AI Developer** 탭 클릭

2️⃣ **"Create New Project"** 클릭

3️⃣ 프로젝트 이름: `ur-live-global` 또는 `ur-live-international`

4️⃣ 터미널에서 GitHub clone:
```bash
cd /home/user
git clone https://github.com/tobe2111/ur-live.git ur-live-global
cd ur-live-global
npm install
```

---

### STEP 2: 국제화(i18n) 설정 (30분)

#### 2-1. 다국어 라이브러리 설치
```bash
npm install react-i18next i18next
```

#### 2-2. 언어 파일 생성
```
ur-live-global/
├── src/
│   └── locales/
│       ├── ko.json    (한국어 - 기본)
│       ├── en.json    (영어)
│       ├── ja.json    (일본어 - 선택)
│       └── zh.json    (중국어 - 선택)
```

#### 2-3. i18n 설정 파일
```typescript
// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ko: { translation: ko },
      en: { translation: en }
    },
    lng: 'en', // 기본 언어 영어
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
```

---

### STEP 3: 주요 번역 영역 (1-2시간)

#### 우선순위 높음 (필수)

**1. 네비게이션 & 버튼**
```json
// ko.json → en.json
{
  "nav.home": "홈" → "Home",
  "nav.live": "라이브" → "Live",
  "nav.cart": "장바구니" → "Cart",
  "nav.mypage": "마이페이지" → "My Page",
  
  "btn.buy": "구매하기" → "Buy Now",
  "btn.addCart": "장바구니 담기" → "Add to Cart",
  "btn.checkout": "결제하기" → "Checkout",
  "btn.login": "로그인" → "Login"
}
```

**2. 페이지 타이틀**
```json
{
  "page.home": "홈" → "Home",
  "page.product": "상품 상세" → "Product Detail",
  "page.checkout": "주문/결제" → "Checkout",
  "page.orders": "주문 내역" → "Order History"
}
```

**3. 폼 라벨**
```json
{
  "form.email": "이메일" → "Email",
  "form.password": "비밀번호" → "Password",
  "form.name": "이름" → "Name",
  "form.phone": "전화번호" → "Phone",
  "form.address": "주소" → "Address"
}
```

**4. 메시지**
```json
{
  "msg.loginSuccess": "로그인 성공" → "Login successful",
  "msg.addCartSuccess": "장바구니에 담았습니다" → "Added to cart",
  "msg.orderSuccess": "주문이 완료되었습니다" → "Order completed",
  "error.required": "필수 항목입니다" → "This field is required"
}
```

---

### STEP 4: 결제 시스템 변경 (1시간)

#### 한국 vs 해외

| 항목 | 한국 버전 | 해외 버전 |
|------|----------|----------|
| 결제 PG | 토스페이먼츠 | Stripe / PayPal |
| 통화 | KRW (원) | USD / EUR / JPY |
| 배송 | 국내 배송 | 국제 배송 |
| 세금 | 부가세 10% | VAT (국가별) |
| 알림 | 알림톡 | Email / SMS |

#### 결제 시스템 교체

**Stripe 통합** (추천):
```bash
npm install @stripe/stripe-js
```

```typescript
// src/lib/stripe.ts
import { loadStripe } from '@stripe/stripe-js';

export const stripePromise = loadStripe(
  process.env.VITE_STRIPE_PUBLIC_KEY
);
```

**통화 변환**:
```typescript
// src/utils/currency.ts
export function formatPrice(amount: number, currency: 'USD' | 'EUR' | 'JPY') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}
```

---

### STEP 5: 지역별 설정 (30분)

#### 5-1. 시간대 설정
```typescript
// UTC 기준으로 변경
const date = new Date().toISOString();
```

#### 5-2. 날짜 형식
```typescript
// 한국: 2026년 2월 26일
// 영어: February 26, 2026
const formatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});
```

#### 5-3. 전화번호 형식
```typescript
// 한국: 010-1234-5678
// 국제: +82-10-1234-5678 or +1-555-123-4567
```

---

### STEP 6: 법적 요구사항 (30분)

#### 약관 페이지 번역
- `/terms` (Terms of Service)
- `/privacy` (Privacy Policy)
- `/refund` (Refund Policy)

#### GDPR 준수 (유럽)
- 쿠키 동의 팝업
- 개인정보 수집 동의
- 데이터 삭제 요청 기능

#### 배송 정책
```json
{
  "shipping.domestic": "국내 배송 (2-3일)",
  "shipping.international": "International Shipping (7-14 days)"
}
```

---

## 📂 프로젝트 구조 (해외 버전)

```
ur-live-global/
├── src/
│   ├── locales/
│   │   ├── ko.json        (한국어 - 참고용)
│   │   ├── en.json        (영어 - 메인)
│   │   ├── ja.json        (일본어 - 선택)
│   │   └── zh.json        (중국어 - 선택)
│   ├── lib/
│   │   ├── stripe.ts      (Stripe 통합)
│   │   └── currency.ts    (통화 변환)
│   └── i18n.ts            (i18n 설정)
├── wrangler.toml          (ur-live-global)
└── .dev.vars
    ├── STRIPE_PUBLIC_KEY
    ├── STRIPE_SECRET_KEY
    └── DEFAULT_CURRENCY=USD
```

---

## 🌍 타겟 국가별 커스터마이징

### 미국 (US)
- 결제: Stripe
- 통화: USD
- 언어: English
- 배송: USPS, FedEx

### 일본 (JP)
- 결제: Stripe (엔화 지원)
- 통화: JPY
- 언어: 日本語
- 배송: Japan Post

### 유럽 (EU)
- 결제: Stripe (SEPA)
- 통화: EUR
- 언어: English, Deutsch, Français
- 배송: DHL, UPS
- 법규: GDPR 준수 필수

---

## 🎨 UI/UX 차이점

### 한국 버전
- 짧고 직관적인 텍스트
- 이모지 많이 사용 💰🎉✨
- 밝고 화려한 색상
- 빠른 구매 프로세스

### 해외 버전
- 자세한 설명 텍스트
- 이모지 최소화
- 차분한 색상 (신뢰감)
- 명확한 정보 제공
- 리뷰/평점 강조

---

## 🔧 환경변수 (.dev.vars)

```env
# 결제
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
PAYPAL_CLIENT_ID=...

# 통화
DEFAULT_CURRENCY=USD
SUPPORTED_CURRENCIES=USD,EUR,GBP,JPY

# 언어
DEFAULT_LANGUAGE=en
SUPPORTED_LANGUAGES=en,ja,zh

# 배송
SHIPPING_API_KEY=...
```

---

## 📊 예상 작업량

| 작업 | 시간 | 난이도 |
|------|------|--------|
| i18n 설정 | 30분 | 쉬움 |
| 텍스트 번역 | 2-3시간 | 중간 |
| 결제 시스템 교체 | 2-3시간 | 어려움 |
| 통화/날짜 변환 | 1시간 | 중간 |
| 법적 요구사항 | 1시간 | 중간 |
| 테스트 | 2시간 | 중간 |
| **총 시간** | **8-12시간** | |

---

## 🚀 빠른 시작 (최소 버전)

**핵심만 번역하고 먼저 런칭**:

### Phase 1: 영어 버전 (4시간)
1. ✅ 주요 UI 텍스트 번역 (1시간)
2. ✅ Stripe 통합 (2시간)
3. ✅ 통화를 USD로 변경 (30분)
4. ✅ 약관 번역 (30분)

### Phase 2: 다국어 지원 (추가 4시간)
1. ✅ i18n 완전 적용
2. ✅ 일본어, 중국어 추가
3. ✅ 언어 선택 UI

### Phase 3: 최적화 (추가 4시간)
1. ✅ 국가별 최적화
2. ✅ 법적 요구사항 완료
3. ✅ 배송 시스템 통합

---

## 💡 자동 번역 도구

### 1. 코드에서 한글 추출
```bash
# 모든 한글 텍스트 찾기
grep -r "[\uAC00-\uD7A3]" src/ | grep -v node_modules > korean-texts.txt
```

### 2. ChatGPT/Claude로 일괄 번역
```
한글 텍스트들을 영어로 번역해주세요:
- 홈 → Home
- 장바구니 → Cart
- ...
```

### 3. 번역 파일 자동 생성
```bash
# 번역된 내용을 JSON으로 변환
```

---

## 📝 체크리스트

### 필수 작업
- [ ] 새 젠스파크 프로젝트 생성
- [ ] GitHub에서 clone
- [ ] i18n 라이브러리 설치
- [ ] 영어 번역 파일 생성
- [ ] Stripe 통합
- [ ] 통화를 USD로 변경
- [ ] 약관 페이지 번역
- [ ] 테스트 (결제, 주문, 배송)

### 선택 작업
- [ ] 일본어/중국어 추가
- [ ] GDPR 준수 (유럽)
- [ ] 국제 배송 통합
- [ ] 다중 통화 지원

---

## 🎯 추천 시작 방법

### 지금 당장 시작
1. **새 젠스파크 프로젝트** 만들기
2. **프로젝트 이름**: `ur-live-global`
3. **GitHub clone**:
   ```bash
   git clone https://github.com/tobe2111/ur-live.git ur-live-global
   cd ur-live-global
   npm install
   ```

### 나중에 시작
- GitHub에 백업되어 있으니 언제든 시작 가능
- 이 가이드(`GLOBAL_VERSION_GUIDE.md`) 참고

---

**해외 버전 작업을 지금 시작하시겠어요?**

1. **"지금 시작해줘"** → 새 프로젝트 생성부터 도와드림
2. **"나중에 할게"** → 이 가이드 저장
3. **"번역만 먼저 해줘"** → 주요 텍스트 영어 번역

어떻게 하시겠어요? 😊
