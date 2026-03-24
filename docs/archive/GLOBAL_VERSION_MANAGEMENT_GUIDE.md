# 🌍 글로벌 버전 관리 가이드 (Global Version Management Guide)

**작성일**: 2026-03-05  
**핵심 전략**: Single Build + Runtime Detection  
**목표**: 국내에 올인하되, 글로벌은 항상 준비된 상태 유지

---

## 📋 목차

1. [핵심 개념](#핵심-개념)
2. [현재 상태 (KR 단독 운영)](#현재-상태-kr-단독-운영)
3. [글로벌 버전 활성화 (6개월 후)](#글로벌-버전-활성화-6개월-후)
4. [개발자 워크플로우](#개발자-워크플로우)
5. [도메인 관리](#도메인-관리)
6. [환경 변수 관리](#환경-변수-관리)
7. [코드 작성 가이드](#코드-작성-가이드)
8. [배포 프로세스](#배포-프로세스)
9. [테스트 가이드](#테스트-가이드)
10. [FAQ](#faq)

---

## 🎯 핵심 개념

### Runtime Detection이란?

**빌드는 1번**, **Region은 도메인으로 자동 감지**하는 방식입니다.

```javascript
// src/shared/config/region.ts
export function getRegion() {
  const hostname = window.location.hostname
  
  if (hostname === 'world.ur-team.com') return 'GLOBAL'
  if (hostname === 'live.ur-team.com') return 'KR'
  
  return 'KR'  // 기본값
}
```

### ✅ 장점

| 항목 | Before (빌드 타임 분기) | After (Runtime Detection) |
|------|------------------------|---------------------------|
| 빌드 횟수 | 2번 (KR + GLOBAL) | **1번** |
| 빌드 시간 | ≈50초 (25초 × 2) | **≈25초** |
| 배포 복잡도 | 2개 프로젝트 관리 | **1개** |
| 확장성 | JP/SEA 추가 시 빌드 3번, 4번... | **여전히 1번** |
| 개발자 경험 | 모드 선택 고민 (`npm run build:kr` vs `:global`) | **고민 불필요** (`npm run build`) |
| 글로벌 런칭 | 코드 수정 + 새 빌드 + 새 배포 | **도메인만 추가** (5분) |

---

## 📊 현재 상태 (KR 단독 운영)

### 1. 단일 빌드 (Universal Build)

```bash
npm run build  # KR + GLOBAL 모두 지원하는 빌드
```

### 2. 배포

```bash
npm run deploy  # Cloudflare Pages (ur-live 프로젝트)
```

### 3. 도메인

- **운영 중**: https://live.ur-team.com (KR 전용)
- **준비 완료**: https://world.ur-team.com (미설정, GLOBAL용)

### 4. 환경 변수

**Cloudflare Pages → Settings → Environment variables**:

```bash
# KR 전용 (현재 설정됨)
VITE_KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN

# GLOBAL 전용 (아직 미설정)
# VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
# VITE_GOOGLE_CLIENT_SECRET=GOCSPX-xxx
# VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
# VITE_STRIPE_SECRET_KEY=sk_test_xxx

# 공통
VITE_API_BASE_URL=https://live.ur-team.com
VITE_SENTRY_DSN=https://08caf64e8e7955f09acc2b0551fdb049@...
VITE_SENTRY_ENVIRONMENT=production
```

---

## 🚀 글로벌 버전 활성화 (6개월 후)

### 준비물 체크리스트 (≈1-2주)

- [ ] **번역 완료** - `public/locales/en/translation.json` (500줄 예상)
- [ ] **Google OAuth 앱 생성** - Google Cloud Console
- [ ] **Stripe 계정 생성** - https://dashboard.stripe.com/
- [ ] **테스트 카드 준비** - `4242 4242 4242 4242`
- [ ] **이미지 로컬라이징** - 영문 배너/프로모션

### Step 1: 도메인 추가 (5분)

#### Cloudflare Dashboard

1. **Pages → ur-live → Settings → Custom domains**
2. **Add custom domain**: `world.ur-team.com`
3. **DNS 설정** (Cloudflare Dashboard → DNS):
   ```
   CNAME world ur-live.pages.dev
   ```
4. **SSL/TLS**: Automatic (Cloudflare 자동 처리)
5. **확인**: `curl -I https://world.ur-team.com` → `HTTP/2 200`

### Step 2: 환경 변수 추가 (10분)

#### Cloudflare Pages → Environment variables

```bash
# Google OAuth (GLOBAL 전용)
VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=GOCSPX-abcdefg1234567890

# Stripe (GLOBAL 전용)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51ABCabc...
VITE_STRIPE_SECRET_KEY=sk_test_51ABCxyz...

# Worker 환경 변수 (Wrangler Secrets)
wrangler secret put GOOGLE_CLIENT_SECRET  # Worker용
wrangler secret put STRIPE_SECRET_KEY
```

### Step 3: 재배포 (3분)

```bash
# Cloudflare Pages → Deployments → Retry deployment
# 또는
npm run deploy
```

### Step 4: 테스트 (30분)

#### 4-1. Google 로그인 테스트

```bash
# 브라우저 시크릿 모드
https://world.ur-team.com/login

# 예상 화면:
- "Sign in with Google" 버튼 표시 (Kakao 버튼 숨김)
- 클릭 → Google OAuth 팝업
- 로그인 성공 → /user/profile 리다이렉트
```

#### 4-2. Stripe 결제 테스트

```bash
# 장바구니 추가 → Checkout
https://world.ur-team.com/checkout

# 예상 화면:
- Stripe Payment Element 표시 (Toss Widget 숨김)
- 테스트 카드: 4242 4242 4242 4242
- 결제 성공 → /orders 리다이렉트
```

#### 4-3. Region 확인

```javascript
// 브라우저 Console (F12)
// world.ur-team.com에서 실행
import { getRegion } from '@/config/region'
console.log(getRegion())  // "GLOBAL"

// live.ur-team.com에서 실행
console.log(getRegion())  // "KR"
```

### Step 5: 모니터링 (48시간)

#### Sentry Dashboard

```bash
# Region별 에러 필터링
https://o4510992097935360.sentry.io/issues/

# 태그 필터:
- region: GLOBAL
- environment: production
- hostname: world.ur-team.com
```

#### Cloudflare Analytics

```bash
# Region별 트래픽 확인
- live.ur-team.com: KR 사용자
- world.ur-team.com: GLOBAL 사용자
```

---

## 💻 개발자 워크플로우

### 로컬 개발

#### KR 버전 개발

```bash
npm run dev  # localhost:5173

# 브라우저:
http://localhost:5173

# Region 확인:
console.log(getRegion())  # "KR" (localhost는 KR 기본값)
```

#### GLOBAL 버전 개발

**Option 1: hosts 파일 수정**

```bash
# /etc/hosts (Linux/Mac) 또는 C:\Windows\System32\drivers\etc\hosts (Windows)
127.0.0.1 world.ur-team.local

# 브라우저:
http://world.ur-team.local:5173

# Region 확인:
console.log(getRegion())  # "GLOBAL"
```

**Option 2: 코드에서 강제 설정 (디버깅용)**

```javascript
// src/shared/config/region.ts (디버깅용, 커밋 금지!)
export function getRegion(): Region {
  // 🔥 임시 강제 설정 (디버깅 후 삭제!)
  return 'GLOBAL'
  
  // const hostname = window.location.hostname
  // ...
}
```

### 코드 작성 패턴

#### ✅ Good: Lazy Import로 Tree-shaking 보장

```tsx
// CheckoutPage.tsx
import { isKorea, isGlobal } from '@/config/region'

function CheckoutPage() {
  const [PaymentWidget, setPaymentWidget] = useState(null)
  
  useEffect(() => {
    async function loadPaymentProvider() {
      if (isKorea()) {
        // KR: Toss Payment (lazy import)
        const toss = await import('@/components/payments/TossPaymentWidget')
        setPaymentWidget(() => toss.default)
      }
      
      if (isGlobal()) {
        // GLOBAL: Stripe (lazy import)
        const stripe = await import('@/components/payments/StripeCheckout')
        setPaymentWidget(() => stripe.default)
      }
    }
    
    loadPaymentProvider()
  }, [])
  
  if (!PaymentWidget) return <LoadingSpinner />
  
  return <PaymentWidget />
}
```

#### ❌ Bad: Static Import (Tree-shaking 안 됨)

```tsx
// ❌ 이렇게 하지 마세요!
import TossPaymentWidget from '@/components/payments/TossPaymentWidget'
import StripeCheckout from '@/components/payments/StripeCheckout'

function CheckoutPage() {
  if (isKorea()) {
    return <TossPaymentWidget />  // ❌ Stripe도 번들에 포함됨
  }
  
  return <StripeCheckout />  // ❌ Toss도 번들에 포함됨
}
```

#### ✅ Good: 조건부 UI 렌더링

```tsx
// LoginPage.tsx
import { isKorea, isGlobal } from '@/config/region'

function LoginPage() {
  return (
    <div>
      {isKorea() && (
        <Button onClick={handleKakaoLogin}>
          카카오로 시작하기
        </Button>
      )}
      
      {isGlobal() && (
        <Button onClick={handleGoogleLogin}>
          Sign in with Google
        </Button>
      )}
      
      <Button onClick={() => setShowEmailLogin(true)}>
        이메일로 로그인 / Email Login
      </Button>
    </div>
  )
}
```

---

## 🌐 도메인 관리

### 도메인 구조

```
ur-team.com                   # 회사 홈페이지 (마케팅)
├── live.ur-team.com          # KR 라이브 커머스
├── world.ur-team.com         # GLOBAL 라이브 커머스
├── kr.ur-team.com            # (예비) KR 전용
├── us.ur-team.com            # (미래) 미국 전용
├── jp.ur-team.com            # (미래) 일본 전용
└── sea.ur-team.com           # (미래) 동남아시아 전용
```

### region.ts 도메인 패턴

```typescript
// src/shared/config/region.ts
const REGION_CONFIG_MAP: Record<Region, RegionConfig> = {
  KR: {
    domainPatterns: [
      'live.ur-team.com',
      'kr.ur-team.com',
      'localhost:5173',
      'localhost:4173'
    ]
  },
  GLOBAL: {
    domainPatterns: [
      'world.ur-team.com',
      'global.ur-team.com',
      'localhost:5174'
    ]
  }
}
```

### 새 Region 추가 (예: JP - 일본)

#### 1. region.ts 수정 (5분)

```typescript
// src/shared/config/region.ts
export type Region = 'KR' | 'GLOBAL' | 'JP'

const REGION_CONFIG_MAP: Record<Region, RegionConfig> = {
  // ... KR, GLOBAL
  JP: {
    code: 'JP',
    name: '日本',
    language: 'ja',
    currency: 'JPY',
    paymentProvider: 'stripe',  // 또는 일본 로컬 PG (예: PayPay)
    authProviders: ['google'],   // 또는 Line Login
    domainPatterns: ['jp.ur-team.com', 'localhost:5175']
  }
}
```

#### 2. 도메인 추가 (5분)

```bash
# Cloudflare Pages → Custom domains
jp.ur-team.com

# DNS 설정
CNAME jp ur-live.pages.dev
```

#### 3. 환경 변수 추가 (10분)

```bash
# Cloudflare Pages → Environment variables
# (JP 전용 결제/인증 API keys 추가)
```

#### 4. 번역 추가 (1주)

```bash
public/locales/ja/translation.json
```

#### 5. 재배포 (3분)

```bash
npm run deploy
```

**완료! JP 버전 런칭** 🎉

---

## 🔐 환경 변수 관리

### 환경 변수 구조

#### 클라이언트 환경 변수 (Cloudflare Pages)

| 변수명 | Region | 필수 | 예시 |
|-------|--------|------|------|
| `VITE_API_BASE_URL` | 공통 | ✅ | `https://live.ur-team.com` |
| `VITE_KAKAO_REST_API_KEY` | KR | ✅ | `5dd74bccb797640b0efd070467f3bafd` |
| `VITE_TOSS_CLIENT_KEY` | KR | ✅ | `test_gck_...` |
| `VITE_GOOGLE_CLIENT_ID` | GLOBAL | ✅ | `123-abc.apps.googleusercontent.com` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | GLOBAL | ✅ | `pk_test_...` |
| `VITE_SENTRY_DSN` | 공통 | ⚠️ | `https://08caf64e8e79...` |

#### Worker 환경 변수 (Wrangler Secrets)

```bash
# KR 전용
wrangler secret put KAKAO_REST_API_KEY
wrangler secret put TOSS_SECRET_KEY

# GLOBAL 전용
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put STRIPE_SECRET_KEY

# 공통
wrangler secret put JWT_SECRET
wrangler secret put FIREBASE_ADMIN_SDK_JSON
```

### 환경 변수 검증

#### 빌드 타임 (vite.config.ts)

```typescript
// src/shared/config/env-validator.ts
export function validateEnvForBuild(mode: string): void {
  console.log('🔍 Runtime Detection Mode - Skipping strict validation')
  // Runtime에서 hostname 기반으로 필요한 변수만 체크
}
```

#### 런타임 (main.tsx)

```typescript
// src/main.tsx
import { getRegion } from '@/config/region'
import { validateEnvForRuntime } from '@/shared/config/env-validator'

const region = getRegion()
validateEnvForRuntime(region)

// Region별 필요한 환경 변수만 체크
// KR: VITE_KAKAO_REST_API_KEY, VITE_TOSS_CLIENT_KEY
// GLOBAL: VITE_GOOGLE_CLIENT_ID, VITE_STRIPE_PUBLISHABLE_KEY
```

---

## 📦 배포 프로세스

### 1. 로컬 빌드 & 테스트

```bash
npm run build     # Universal build (≈25초)
npm run preview   # Local preview (http://localhost:3000)
```

### 2. Git 커밋 & Push

```bash
git add .
git commit -m "feat: Add global payment support"
git push origin main
```

### 3. Cloudflare 자동 배포

```bash
# GitHub → Cloudflare Pages 자동 트리거
# 빌드 완료 (≈2-3분) → 배포 완료
```

### 4. 배포 확인

```bash
# KR 버전 확인
curl -I https://live.ur-team.com  # HTTP/2 200

# GLOBAL 버전 확인 (활성화된 경우)
curl -I https://world.ur-team.com  # HTTP/2 200
```

### 5. Sentry 모니터링

```bash
# Sentry Dashboard
https://o4510992097935360.sentry.io/issues/

# Region별 필터:
- region: KR
- region: GLOBAL
- hostname: live.ur-team.com
- hostname: world.ur-team.com
```

---

## 🧪 테스트 가이드

### Unit Test (Jest)

```typescript
// src/shared/config/region.test.ts
import { getRegion, isKorea, isGlobal } from './region'

describe('Region Detection', () => {
  it('should detect KR region from hostname', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'live.ur-team.com' }
    })
    expect(getRegion()).toBe('KR')
    expect(isKorea()).toBe(true)
    expect(isGlobal()).toBe(false)
  })
  
  it('should detect GLOBAL region from hostname', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'world.ur-team.com' }
    })
    expect(getRegion()).toBe('GLOBAL')
    expect(isKorea()).toBe(false)
    expect(isGlobal()).toBe(true)
  })
})
```

### E2E Test (Playwright)

```typescript
// tests/e2e/region-detection.spec.ts
import { test, expect } from '@playwright/test'

test('KR region - should show Kakao login', async ({ page }) => {
  await page.goto('https://live.ur-team.com/login')
  
  // Kakao 버튼 표시 확인
  const kakaoBtn = await page.locator('button:has-text("카카오로 시작하기")')
  await expect(kakaoBtn).toBeVisible()
  
  // Google 버튼 숨김 확인
  const googleBtn = page.locator('button:has-text("Sign in with Google")')
  await expect(googleBtn).toBeHidden()
})

test('GLOBAL region - should show Google login', async ({ page }) => {
  await page.goto('https://world.ur-team.com/login')
  
  // Google 버튼 표시 확인
  const googleBtn = await page.locator('button:has-text("Sign in with Google")')
  await expect(googleBtn).toBeVisible()
  
  // Kakao 버튼 숨김 확인
  const kakaoBtn = page.locator('button:has-text("카카오로 시작하기")')
  await expect(kakaoBtn).toBeHidden()
})
```

---

## ❓ FAQ

### Q1: 빌드 시간이 늘어나지 않나요?

**A**: 아니요. 오히려 줄어듭니다.

- **Before**: KR 빌드 (25초) + GLOBAL 빌드 (25초) = **50초**
- **After**: Universal 빌드 (25초) = **25초** ✅

번들 크기는 약간 증가하지만 (lazy import 사용 시 최소화), 빌드는 1번만 합니다.

### Q2: KR 사용자가 GLOBAL 코드를 다운로드하나요?

**A**: Lazy import를 사용하면 **다운로드하지 않습니다**.

```tsx
// ✅ Good: Lazy import
if (isKorea()) {
  const toss = await import('@/components/payments/TossPaymentWidget')
  // Stripe 코드는 다운로드되지 않음
}

// ❌ Bad: Static import
import TossWidget from './TossWidget'  // Stripe도 함께 번들에 포함
```

### Q3: 로컬 개발 시 GLOBAL 버전을 어떻게 테스트하나요?

**A**: 3가지 방법

1. **hosts 파일** 수정 (`127.0.0.1 world.ur-team.local`)
2. **코드 강제 설정** (`return 'GLOBAL'` - 디버깅 후 삭제)
3. **Cloudflare Preview** 사용 (PR마다 자동 생성)

### Q4: JP, SEA 등 새 Region 추가는?

**A**: 5분 작업

1. `region.ts`에 JP 추가
2. Cloudflare에 `jp.ur-team.com` 도메인 추가
3. 환경 변수 추가 (일본 결제 API keys)
4. 재배포 (`npm run deploy`)

### Q5: 빌드 시 GLOBAL 환경 변수가 없으면 에러 나나요?

**A**: 아니요. Runtime Detection에서는 **빌드 타임 검증을 스킵**합니다.

```typescript
// src/shared/config/env-validator.ts
export function validateEnvForBuild(mode: string): void {
  console.log('Runtime Detection Mode - Skipping strict validation')
  // 런타임에 hostname 기반으로 필요한 변수만 체크
}
```

### Q6: Sentry에서 Region별 에러를 어떻게 구분하나요?

**A**: 태그 필터링

```typescript
// src/lib/sentry.ts
Sentry.init({
  beforeSend(event) {
    event.tags = {
      ...event.tags,
      region: getRegion(),
      hostname: window.location.hostname
    }
    return event
  }
})

// Sentry Dashboard에서 필터:
// region: KR
// region: GLOBAL
```

### Q7: 배포 실패 시 롤백은?

**A**: Cloudflare Pages는 자동 롤백 지원

```bash
# Cloudflare Dashboard → Deployments
# 이전 배포 클릭 → "Rollback to this deployment"

# 또는 Git revert
git revert HEAD
git push origin main
```

### Q8: 글로벌 버전 비활성화하려면?

**A**: 도메인만 제거

```bash
# Cloudflare Pages → Custom domains
# world.ur-team.com 삭제

# 코드 변경 불필요!
```

---

## 📚 참고 문서

| 문서 | 파일명 | 용도 |
|------|--------|------|
| **Runtime Detection 가이드** | `GLOBAL_VERSION_MANAGEMENT_GUIDE.md` | 👈 현재 문서 |
| **프로덕션 테스트** | `PRODUCTION_TEST_CHECKLIST.md` | 8개 시나리오 테스트 |
| **즉시 실행 가이드** | `TODO_NOW.md` | 배포 후 해야 할 일 |
| **Cloudflare 환경 설정** | `CLOUDFLARE_ENV_MANUAL_SETUP.md` | 환경 변수 설정 |
| **48시간 모니터링** | `48H_MONITORING_GUIDE.md` | 배포 후 모니터링 |

---

## 🔗 중요 링크

| 항목 | URL |
|------|-----|
| **KR Production** | https://live.ur-team.com |
| **GLOBAL Production** | https://world.ur-team.com (미설정) |
| **GitHub Repo** | https://github.com/tobe2111/ur-live |
| **Cloudflare Dashboard** | https://dash.cloudflare.com |
| **Sentry Dashboard** | https://o4510992097935360.sentry.io/ |
| **Firebase Console** | https://console.firebase.google.com/ |
| **Google Cloud Console** | https://console.cloud.google.com/ |
| **Stripe Dashboard** | https://dashboard.stripe.com/ |

---

## 🎉 요약

### 핵심 메시지

**"국내에 올인하되, 글로벌은 항상 준비된 상태"**

### 현재 (KR 단독 운영)

✅ `npm run build` 1번  
✅ KR 안정 운영 (`live.ur-team.com`)  
✅ GLOBAL 코드 포함 (lazy import로 bundle 최소화)  
✅ 개발자 빌드 모드 고민 불필요  

### 6개월 후 (GLOBAL 런칭)

✅ 도메인만 추가 (`world.ur-team.com`)  
✅ 환경 변수 추가 (Google OAuth, Stripe)  
✅ 재배포 (`npm run deploy`)  
✅ 5분 만에 GLOBAL 런칭 완료 🚀  

### 확장성

✅ JP, SEA, US 추가도 동일한 방식  
✅ 코드 변경 최소화 (region.ts 1줄 추가)  
✅ 빌드는 여전히 1번  
✅ 배포 프로세스 단순화  

---

**작성일**: 2026-03-05  
**작성자**: UR Live Development Team  
**버전**: v1.0  
**마지막 업데이트**: 2026-03-05 15:10 KST
