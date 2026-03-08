# UR Live 지역별 차이점 관리 전략

> **목적**: KR vs GLOBAL 버전의 로그인/결제/언어 차이 관리 방안  
> **작성일**: 2026-03-05

---

## 🌍 지역별 차이점 정리

### 현재 차이점

| 구분 | KR (live.ur-team.com) | GLOBAL (world.ur-team.com) |
|------|----------------------|----------------------------|
| **로그인** | Kakao OAuth | Google OAuth |
| **결제 PG** | TossPayments | Stripe |
| **기본 언어** | 한국어 (ko) | 영어 (en) |
| **통화** | KRW (₩) | USD ($) |
| **주소 시스템** | 한국 우편번호 (Daum API) | 국제 주소 |
| **전화번호** | 010-XXXX-XXXX | +1-XXX-XXX-XXXX |
| **법적 문서** | 한국 약관 | 글로벌 약관 |

---

## ❌ 잘못된 접근 방법

### Anti-Pattern 1: 하드코딩 분기
```typescript
// ❌ 나쁜 예: 하드코딩된 지역 체크
function LoginButton() {
  if (window.location.hostname === 'live.ur-team.com') {
    return <KakaoLoginButton />
  } else {
    return <GoogleLoginButton />
  }
}

// 문제점:
// - 도메인 변경 시 코드 수정 필요
// - 로컬 개발 시 동작 안함
// - 테스트 어려움
// - 확장성 없음 (일본 추가 시?)
```

### Anti-Pattern 2: 환경 변수로 모든 것 제어
```typescript
// ❌ 나쁜 예: 환경 변수 남용
const isKorea = import.meta.env.VITE_REGION === 'KR'
const isGlobal = import.meta.env.VITE_REGION === 'GLOBAL'

function App() {
  if (isKorea) {
    return <KoreaApp />
  } else {
    return <GlobalApp />
  }
}

// 문제점:
// - 코드 중복 발생
// - 공통 로직 재사용 어려움
// - 조건문 폭발
// - 유지보수 지옥
```

### Anti-Pattern 3: 별도 컴포넌트로 완전 분리
```typescript
// ❌ 나쁜 예: 완전 분리
src/
  ├─ components-kr/
  │   ├─ LoginButton.tsx (Kakao 전용)
  │   ├─ PaymentForm.tsx (Toss 전용)
  │   └─ ...
  └─ components-global/
      ├─ LoginButton.tsx (Google 전용)
      ├─ PaymentForm.tsx (Stripe 전용)
      └─ ...

// 문제점:
// - 코드 중복 대량 발생
// - 공통 버그 수정 2번 필요
// - 동기화 지옥
```

---

## ✅ 올바른 접근 방법

### 전략: **추상화 계층 + 지역별 구현체 주입**

```
공통 인터페이스 (추상화)
    ↓
지역별 구현체 (DI)
    ↓
통합 컴포넌트
```

---

## 🏗️ 아키텍처 설계

### 1. 인증 (로그인) 관리

#### 1.1 추상화 계층

```typescript
// src/features/auth/types/auth-provider.types.ts

export interface AuthProvider {
  // 공통 인터페이스
  name: string
  login(): Promise<AuthResult>
  logout(): Promise<void>
  getUser(): Promise<User | null>
  refreshToken(): Promise<string | null>
}

export interface AuthResult {
  success: boolean
  user?: User
  error?: string
}

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  provider: 'kakao' | 'google'
}
```

#### 1.2 지역별 구현체

```typescript
// src/features/auth/providers/kakao-auth-provider.ts

import { AuthProvider, AuthResult, User } from '../types/auth-provider.types'

export class KakaoAuthProvider implements AuthProvider {
  name = 'kakao'
  
  async login(): Promise<AuthResult> {
    try {
      // Kakao SDK 사용
      const kakaoUser = await window.Kakao.Auth.login()
      
      return {
        success: true,
        user: {
          id: kakaoUser.id,
          email: kakaoUser.kakao_account.email,
          name: kakaoUser.properties.nickname,
          avatar: kakaoUser.properties.profile_image,
          provider: 'kakao'
        }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
  
  async logout(): Promise<void> {
    await window.Kakao.Auth.logout()
  }
  
  async getUser(): Promise<User | null> {
    // Kakao API로 사용자 정보 가져오기
    const kakaoUser = await window.Kakao.API.request({
      url: '/v2/user/me'
    })
    
    if (!kakaoUser) return null
    
    return {
      id: kakaoUser.id,
      email: kakaoUser.kakao_account.email,
      name: kakaoUser.properties.nickname,
      avatar: kakaoUser.properties.profile_image,
      provider: 'kakao'
    }
  }
  
  async refreshToken(): Promise<string | null> {
    // Kakao 토큰 갱신
    return await window.Kakao.Auth.refreshAccessToken()
  }
}
```

```typescript
// src/features/auth/providers/google-auth-provider.ts

import { AuthProvider, AuthResult, User } from '../types/auth-provider.types'

export class GoogleAuthProvider implements AuthProvider {
  name = 'google'
  
  async login(): Promise<AuthResult> {
    try {
      // Google SDK 사용
      const googleUser = await window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: 'email profile'
      })
      
      return {
        success: true,
        user: {
          id: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name,
          avatar: googleUser.picture,
          provider: 'google'
        }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
  
  async logout(): Promise<void> {
    await window.google.accounts.id.disableAutoSelect()
  }
  
  async getUser(): Promise<User | null> {
    // Google API로 사용자 정보 가져오기
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    
    if (!response.ok) return null
    
    const googleUser = await response.json()
    
    return {
      id: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      avatar: googleUser.picture,
      provider: 'google'
    }
  }
  
  async refreshToken(): Promise<string | null> {
    // Google 토큰 갱신
    return await refreshGoogleToken()
  }
}
```

#### 1.3 Provider Factory (DI)

```typescript
// src/features/auth/providers/auth-provider-factory.ts

import { AuthProvider } from '../types/auth-provider.types'
import { KakaoAuthProvider } from './kakao-auth-provider'
import { GoogleAuthProvider } from './google-auth-provider'

export function createAuthProvider(): AuthProvider {
  const region = import.meta.env.VITE_REGION
  
  switch (region) {
    case 'KR':
      return new KakaoAuthProvider()
    case 'GLOBAL':
      return new GoogleAuthProvider()
    default:
      throw new Error(`Unsupported region: ${region}`)
  }
}

// 싱글톤 인스턴스
export const authProvider = createAuthProvider()
```

#### 1.4 통합 컴포넌트

```typescript
// src/features/auth/components/LoginButton.tsx

import { authProvider } from '../providers/auth-provider-factory'
import { useAuthStore } from '../stores/auth-store'

export function LoginButton() {
  const { setUser } = useAuthStore()
  const [loading, setLoading] = useState(false)
  
  const handleLogin = async () => {
    setLoading(true)
    
    // ✅ 통합 인터페이스 사용 (지역 구분 불필요!)
    const result = await authProvider.login()
    
    if (result.success) {
      setUser(result.user)
    } else {
      alert(`Login failed: ${result.error}`)
    }
    
    setLoading(false)
  }
  
  return (
    <button onClick={handleLogin} disabled={loading}>
      {loading ? 'Loading...' : 'Login'}
    </button>
  )
}

// ✅ 장점:
// - 지역별 분기 없음
// - 컴포넌트는 AuthProvider 인터페이스만 알면 됨
// - Kakao/Google 교체해도 컴포넌트 수정 불필요
// - 테스트 시 Mock Provider 주입 가능
```

---

### 2. 결제 PG 관리

#### 2.1 추상화 계층

```typescript
// src/features/payment/types/payment-provider.types.ts

export interface PaymentProvider {
  name: string
  initialize(config: PaymentConfig): Promise<void>
  requestPayment(request: PaymentRequest): Promise<PaymentResult>
  verifyPayment(orderId: string): Promise<boolean>
}

export interface PaymentConfig {
  clientKey: string
  customerKey?: string
}

export interface PaymentRequest {
  orderId: string
  orderName: string
  amount: number
  currency: string
  customerEmail: string
  customerName: string
  successUrl: string
  failUrl: string
}

export interface PaymentResult {
  success: boolean
  orderId: string
  paymentKey?: string
  error?: string
}
```

#### 2.2 지역별 구현체

```typescript
// src/features/payment/providers/toss-payment-provider.ts

export class TossPaymentProvider implements PaymentProvider {
  name = 'toss'
  private widget: any
  
  async initialize(config: PaymentConfig): Promise<void> {
    this.widget = await loadTossPayments(config.clientKey)
  }
  
  async requestPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      await this.widget.requestPayment({
        method: 'CARD',
        amount: { value: request.amount, currency: 'KRW' },
        orderId: request.orderId,
        orderName: request.orderName,
        successUrl: request.successUrl,
        failUrl: request.failUrl,
        customerEmail: request.customerEmail,
        customerName: request.customerName
      })
      
      return {
        success: true,
        orderId: request.orderId
      }
    } catch (error) {
      return {
        success: false,
        orderId: request.orderId,
        error: error.message
      }
    }
  }
  
  async verifyPayment(orderId: string): Promise<boolean> {
    // Toss 서버에서 검증
    const response = await fetch(`/api/payment/verify`, {
      method: 'POST',
      body: JSON.stringify({ orderId, provider: 'toss' })
    })
    return response.ok
  }
}
```

```typescript
// src/features/payment/providers/stripe-payment-provider.ts

export class StripePaymentProvider implements PaymentProvider {
  name = 'stripe'
  private stripe: any
  
  async initialize(config: PaymentConfig): Promise<void> {
    this.stripe = await loadStripe(config.clientKey)
  }
  
  async requestPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      const { error } = await this.stripe.redirectToCheckout({
        lineItems: [{
          price_data: {
            currency: 'usd',
            product_data: { name: request.orderName },
            unit_amount: request.amount * 100 // cents
          },
          quantity: 1
        }],
        mode: 'payment',
        successUrl: request.successUrl,
        cancelUrl: request.failUrl,
        customerEmail: request.customerEmail
      })
      
      if (error) {
        return {
          success: false,
          orderId: request.orderId,
          error: error.message
        }
      }
      
      return {
        success: true,
        orderId: request.orderId
      }
    } catch (error) {
      return {
        success: false,
        orderId: request.orderId,
        error: error.message
      }
    }
  }
  
  async verifyPayment(orderId: string): Promise<boolean> {
    // Stripe 서버에서 검증
    const response = await fetch(`/api/payment/verify`, {
      method: 'POST',
      body: JSON.stringify({ orderId, provider: 'stripe' })
    })
    return response.ok
  }
}
```

#### 2.3 Provider Factory

```typescript
// src/features/payment/providers/payment-provider-factory.ts

export function createPaymentProvider(): PaymentProvider {
  const region = import.meta.env.VITE_REGION
  
  switch (region) {
    case 'KR':
      return new TossPaymentProvider()
    case 'GLOBAL':
      return new StripePaymentProvider()
    default:
      throw new Error(`Unsupported region: ${region}`)
  }
}

export const paymentProvider = createPaymentProvider()
```

#### 2.4 통합 컴포넌트

```typescript
// src/features/payment/components/CheckoutButton.tsx

import { paymentProvider } from '../providers/payment-provider-factory'

export function CheckoutButton({ order }) {
  const handlePayment = async () => {
    // ✅ 통합 인터페이스 사용
    const result = await paymentProvider.requestPayment({
      orderId: order.id,
      orderName: order.name,
      amount: order.amount,
      currency: order.currency,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      successUrl: '/payment/success',
      failUrl: '/payment/fail'
    })
    
    if (result.success) {
      // 성공 처리
    } else {
      alert(`Payment failed: ${result.error}`)
    }
  }
  
  return (
    <button onClick={handlePayment}>
      Checkout
    </button>
  )
}

// ✅ 장점: 지역 구분 없이 동일한 로직!
```

---

### 3. 다국어 (i18n) 관리

#### 3.1 기존 구조 (이미 있을 것으로 추정)

```typescript
// src/lib/i18n/index.ts

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// 번역 파일
import koTranslation from './locales/ko.json'
import enTranslation from './locales/en.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ko: { translation: koTranslation },
      en: { translation: enTranslation }
    },
    lng: import.meta.env.VITE_REGION === 'KR' ? 'ko' : 'en', // ✅ 지역별 기본 언어
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  })

export default i18n
```

#### 3.2 지역별 기본 언어 설정

```typescript
// src/lib/i18n/region-config.ts

export const REGION_CONFIG = {
  KR: {
    defaultLanguage: 'ko',
    supportedLanguages: ['ko', 'en'],
    currency: 'KRW',
    currencySymbol: '₩',
    dateFormat: 'YYYY년 MM월 DD일',
    phoneFormat: '010-XXXX-XXXX'
  },
  GLOBAL: {
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'ko', 'ja', 'zh'],
    currency: 'USD',
    currencySymbol: '$',
    dateFormat: 'MM/DD/YYYY',
    phoneFormat: '+1-XXX-XXX-XXXX'
  }
} as const

export function getRegionConfig() {
  const region = import.meta.env.VITE_REGION as 'KR' | 'GLOBAL'
  return REGION_CONFIG[region]
}
```

#### 3.3 컴포넌트에서 사용

```typescript
// src/features/checkout/components/PriceDisplay.tsx

import { useTranslation } from 'react-i18next'
import { getRegionConfig } from '@/lib/i18n/region-config'

export function PriceDisplay({ amount }: { amount: number }) {
  const { t } = useTranslation()
  const config = getRegionConfig()
  
  return (
    <div>
      <span>{t('price')}: </span>
      <span>{config.currencySymbol}{amount.toLocaleString()}</span>
    </div>
  )
}

// KR: 가격: ₩10,000
// GLOBAL: Price: $100
```

---

## 📁 최종 디렉토리 구조

```
src/
├─ features/
│   ├─ auth/
│   │   ├─ types/
│   │   │   └─ auth-provider.types.ts         # 인터페이스
│   │   ├─ providers/
│   │   │   ├─ auth-provider-factory.ts       # Factory (DI)
│   │   │   ├─ kakao-auth-provider.ts         # KR 구현체
│   │   │   └─ google-auth-provider.ts        # GLOBAL 구현체
│   │   ├─ components/
│   │   │   └─ LoginButton.tsx                # 통합 컴포넌트
│   │   └─ stores/
│   │       └─ auth-store.ts                  # Zustand store
│   │
│   ├─ payment/
│   │   ├─ types/
│   │   │   └─ payment-provider.types.ts      # 인터페이스
│   │   ├─ providers/
│   │   │   ├─ payment-provider-factory.ts    # Factory (DI)
│   │   │   ├─ toss-payment-provider.ts       # KR 구현체
│   │   │   └─ stripe-payment-provider.ts     # GLOBAL 구현체
│   │   └─ components/
│   │       └─ CheckoutButton.tsx             # 통합 컴포넌트
│   │
│   └─ ... (기타 features)
│
├─ lib/
│   └─ i18n/
│       ├─ index.ts                           # i18n 초기화
│       ├─ region-config.ts                   # 지역별 설정
│       └─ locales/
│           ├─ ko.json                        # 한국어
│           └─ en.json                        # 영어
│
└─ shared/
    └─ config/
        └─ env-validator.ts                   # 환경 변수 검증
```

---

## 🎯 핵심 원칙

### 1. **추상화 우선**
```
✅ 공통 인터페이스 정의
✅ 지역별 구현체는 인터페이스 구현
✅ 컴포넌트는 인터페이스만 의존
```

### 2. **의존성 주입 (DI)**
```
✅ Factory 패턴으로 Provider 생성
✅ 환경 변수 기반 자동 선택
✅ 테스트 시 Mock 주입 가능
```

### 3. **조건문 최소화**
```
❌ if (region === 'KR') { ... } // 나쁨
✅ authProvider.login() // 좋음
```

### 4. **Tree-shaking 최적화**
```
// vite.config.ts에서 이미 처리됨
external: isKR 
  ? ['@stripe/stripe-js']  // Stripe 제외
  : ['toss-payments']       // Toss 제외

→ 번들 크기 최적화 자동
```

---

## 📊 비교표

| 방식 | 코드 중복 | 유지보수 | 확장성 | Tree-shaking |
|------|----------|----------|--------|--------------|
| **❌ 하드코딩 분기** | 많음 | 어려움 | 불가능 | ❌ |
| **❌ 별도 컴포넌트** | 매우 많음 | 지옥 | 불가능 | ✅ |
| **✅ 추상화 + DI** | 없음 | 쉬움 | 매우 좋음 | ✅ |

---

## 🚀 확장 시나리오 (일본 추가)

### 새로운 요구사항
```
- 로그인: LINE OAuth
- 결제: PayPay
- 언어: 일본어
- 도메인: jp.ur-team.com
```

### 추가 작업 (약 2시간)

```typescript
// 1. LINE Auth Provider 추가
export class LineAuthProvider implements AuthProvider {
  // AuthProvider 인터페이스 구현
  async login() { /* LINE SDK */ }
  async logout() { /* LINE SDK */ }
  // ...
}

// 2. PayPay Payment Provider 추가
export class PayPayPaymentProvider implements PaymentProvider {
  // PaymentProvider 인터페이스 구현
  async requestPayment() { /* PayPay SDK */ }
  // ...
}

// 3. Factory 수정
export function createAuthProvider() {
  const region = import.meta.env.VITE_REGION
  
  switch (region) {
    case 'KR': return new KakaoAuthProvider()
    case 'GLOBAL': return new GoogleAuthProvider()
    case 'JP': return new LineAuthProvider() // ✅ 추가
    default: throw new Error(`Unsupported region: ${region}`)
  }
}

// 4. i18n 언어 추가
import jaTranslation from './locales/ja.json'

i18n.init({
  resources: {
    ko: { translation: koTranslation },
    en: { translation: enTranslation },
    ja: { translation: jaTranslation } // ✅ 추가
  }
})

// 5. Cloudflare Pages 프로젝트 생성
// - 이름: ur-live-jp
// - Build: npm run build:jp
// - Domain: jp.ur-team.com

// ✅ 완료! 기존 코드 수정 불필요!
```

---

## ✅ 결론

### 핵심 전략
```
1. 추상화 계층 (Interface)
   ↓
2. 지역별 구현체 (Implementation)
   ↓
3. Factory 패턴 (DI)
   ↓
4. 통합 컴포넌트 (지역 구분 없음!)
```

### 장점
```
✅ 코드 중복 제거
✅ 조건문 최소화
✅ 테스트 용이
✅ 확장 쉬움 (일본, 중국 등)
✅ Tree-shaking 자동
✅ 유지보수 간단
```

### 구현 상태
```
✅ 빌드 시스템: 이미 구현됨 (npm run build:kr, build:global)
✅ Tree-shaking: vite.config.ts에서 처리 중
✅ i18n: 이미 구현되어 있을 가능성 높음
⏳ Auth Provider: 구현 필요
⏳ Payment Provider: 구현 필요
```

---

**다음 단계**: 
1. 현재 코드에서 인증/결제 부분 확인
2. Provider 패턴 적용 여부 확인
3. 필요시 리팩토링 진행

필요하시면 현재 코드를 분석해서 리팩토링 가이드를 작성해드릴 수 있습니다! 🚀
