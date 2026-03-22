# 🛡️ Sentry 실전 설정 가이드

**목적**: 프로덕션 에러 자동 추적 + 실시간 알림 + 성능 모니터링

---

## 📋 **준비 사항**

- [ ] Sentry 계정 (https://sentry.io)
- [ ] Sentry 프로젝트 생성 (React 선택)
- [ ] DSN 키 확보
- [ ] Cloudflare Pages 환경 변수 접근 권한

---

## 1️⃣ **Sentry 설치**

### **Step 1: 패키지 설치**

```bash
cd /home/user/webapp
npm install @sentry/react @sentry/tracing
```

**패키지 설명**:
- `@sentry/react`: React 통합, 에러 바운더리
- `@sentry/tracing`: 성능 모니터링, 트랜잭션 추적

---

## 2️⃣ **Sentry 초기화 코드**

### **Step 2: src/lib/sentry.ts 생성**

```typescript
import * as Sentry from '@sentry/react'
import { BrowserTracing } from '@sentry/tracing'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN
const ENVIRONMENT = import.meta.env.MODE // 'kr' or 'production'
const IS_PRODUCTION = ENVIRONMENT === 'kr' || ENVIRONMENT === 'production'

export function initSentry() {
  // ✅ Production only
  if (!IS_PRODUCTION || !SENTRY_DSN) {
    console.log('[Sentry] Disabled in development or missing DSN')
    return
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    
    // ✅ Performance Monitoring
    integrations: [
      new BrowserTracing({
        // React Router 통합
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          // React Router history 객체 주입 (optional)
        ),
      }),
    ],

    // ✅ Sampling Rates
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0, // 10% in prod, 100% in dev
    
    // ✅ Error Filtering
    beforeSend(event, hint) {
      // 1. Development 에러 무시
      if (!IS_PRODUCTION) return null

      // 2. 알려진 에러 필터링
      const error = hint.originalException as Error
      
      // Kakao SDK 에러 무시 (외부 라이브러리)
      if (error?.message?.includes('Kakao is not defined')) {
        return null
      }
      
      // Network timeout 무시 (사용자 환경 문제)
      if (error?.message?.includes('Network Error')) {
        return null
      }

      // 3. 민감한 정보 제거
      if (event.request?.cookies) {
        delete event.request.cookies
      }
      
      if (event.request?.headers) {
        delete event.request.headers['Authorization']
      }

      return event
    },

    // ✅ Ignore specific errors
    ignoreErrors: [
      // 브라우저 확장 프로그램 에러
      'top.GLOBALS',
      'chrome-extension',
      // ResizeObserver 에러 (무해)
      'ResizeObserver loop limit exceeded',
      // 취소된 요청
      'Request aborted',
      'AbortError',
    ],

    // ✅ Denylisting URLs
    denyUrls: [
      // 외부 스크립트
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
      // Google Analytics
      /google-analytics\.com/i,
    ],
  })

  console.log('[Sentry] ✅ Initialized for', ENVIRONMENT)
}

// ✅ Custom Event Tracking
export function trackAuthEvent(
  type: 'login_success' | 'login_failure' | 'logout',
  method: 'kakao' | 'email' | 'google' | 'seller' | 'admin',
  metadata?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: `${type} via ${method}`,
    level: type.includes('failure') ? 'error' : 'info',
    data: metadata,
  })

  // 실패 시 에러로 기록
  if (type === 'login_failure') {
    Sentry.captureException(new Error(`Login failed: ${method}`), {
      tags: { auth_method: method },
      contexts: { metadata },
    })
  }
}

export function trackCheckoutEvent(
  stage: 'start' | 'address' | 'payment' | 'success' | 'failure',
  amount?: number,
  error?: string
) {
  Sentry.addBreadcrumb({
    category: 'checkout',
    message: `Checkout ${stage}`,
    level: stage === 'failure' ? 'error' : 'info',
    data: { amount, error },
  })

  if (stage === 'failure') {
    Sentry.captureException(new Error(`Checkout failed: ${error}`), {
      tags: { checkout_stage: stage },
      contexts: { checkout: { amount, error } },
    })
  }
}

export function setUserContext(userId: string, email?: string, role?: string) {
  Sentry.setUser({
    id: userId,
    email,
    role,
  })
}

export function clearUserContext() {
  Sentry.setUser(null)
}
```

---

### **Step 3: src/index.tsx 통합**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { initSentry } from './lib/sentry'
import App from './App'

// ✅ Sentry 초기화 (최우선)
initSentry()

// ✅ Error Boundary로 앱 감싸기
const SentryApp = Sentry.withProfiler(App)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              앗! 오류가 발생했습니다
            </h1>
            <p className="text-gray-600 mb-4">
              문제가 자동으로 보고되었습니다. 잠시 후 다시 시도해주세요.
            </p>
            <details className="mb-4">
              <summary className="cursor-pointer text-sm text-gray-500">
                기술 세부사항
              </summary>
              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                {error.toString()}
              </pre>
            </details>
            <button
              onClick={() => {
                resetError()
                window.location.href = '/'
              }}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      )}
      showDialog
    >
      <SentryApp />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
)
```

---

## 3️⃣ **Auth 이벤트 트래킹**

### **Step 4: LoginPage.tsx 통합**

```typescript
import { trackAuthEvent, setUserContext } from '@/lib/sentry'

// ✅ 로그인 성공 시
async function handleKakaoLogin() {
  try {
    // ... existing login logic
    const user = await loginWithKakao()
    
    // Sentry에 사용자 컨텍스트 설정
    setUserContext(user.uid, user.email, 'user')
    
    // 로그인 성공 이벤트 추적
    trackAuthEvent('login_success', 'kakao', {
      timestamp: new Date().toISOString()
    })
    
    navigate('/')
  } catch (error) {
    // 로그인 실패 이벤트 추적
    trackAuthEvent('login_failure', 'kakao', {
      error: error.message,
      code: error.code
    })
    
    setError('카카오 로그인에 실패했습니다.')
  }
}

// ✅ Email 로그인도 동일하게
async function handleEmailLogin() {
  try {
    const user = await loginWithEmail(email, password)
    setUserContext(user.uid, user.email, 'user')
    trackAuthEvent('login_success', 'email')
    navigate('/')
  } catch (error) {
    trackAuthEvent('login_failure', 'email', { error: error.message })
    setError('이메일 로그인에 실패했습니다.')
  }
}
```

---

### **Step 5: SellerLoginPage.tsx JWT 트래킹**

```typescript
import { trackAuthEvent, setUserContext } from '@/lib/sentry'

async function handleSubmit(e: React.FormEvent) {
  try {
    const response = await api.post('/api/seller/login', formData)
    const { token, seller } = response.data.data
    
    // Seller 컨텍스트 설정
    setUserContext(seller.id.toString(), seller.email, 'seller')
    trackAuthEvent('login_success', 'seller', { seller_id: seller.id })
    
    navigate('/seller')
  } catch (error) {
    trackAuthEvent('login_failure', 'seller', { 
      error: error.response?.data?.error 
    })
    setError('판매자 로그인에 실패했습니다.')
  }
}
```

---

## 4️⃣ **Cloudflare 환경 변수 설정**

### **Step 6: Sentry DSN 추가**

**Cloudflare Dashboard 접속**:
1. https://dash.cloudflare.com
2. Pages → `ur-live` 프로젝트 선택
3. Settings → Environment variables

**추가할 변수**:

```bash
# Production
VITE_SENTRY_DSN=https://your-dsn@o123456.ingest.sentry.io/7891011

# (Optional) 환경별 DSN
VITE_SENTRY_DSN_KR=https://your-kr-dsn@o123456.ingest.sentry.io/7891012
```

**Sentry DSN 획득 방법**:
1. Sentry Dashboard → Settings → Projects
2. 프로젝트 선택 → Client Keys (DSN)
3. DSN 복사

---

### **Step 7: .env.kr 파일에도 추가** (로컬 테스트용)

```bash
# .env.kr
VITE_SENTRY_DSN=https://your-dev-dsn@o123456.ingest.sentry.io/7891013
```

**주의**: `.env` 파일은 git에 커밋하지 않음 (.gitignore 확인)

---

## 5️⃣ **성능 모니터링 (Optional)**

### **Step 8: 주요 페이지 트랜잭션 추적**

```typescript
// src/pages/CheckoutPage.tsx
import * as Sentry from '@sentry/react'
import { trackCheckoutEvent } from '@/lib/sentry'

function CheckoutPage() {
  useEffect(() => {
    const transaction = Sentry.startTransaction({
      name: 'CheckoutPage',
      op: 'pageload',
    })
    
    Sentry.getCurrentHub().configureScope(scope => 
      scope.setSpan(transaction)
    )

    return () => {
      transaction.finish()
    }
  }, [])

  async function handlePayment() {
    trackCheckoutEvent('start', totalAmount)
    
    try {
      // ... payment logic
      trackCheckoutEvent('success', totalAmount)
    } catch (error) {
      trackCheckoutEvent('failure', totalAmount, error.message)
      throw error
    }
  }
}
```

---

## 6️⃣ **빌드 & 배포**

```bash
# 1. 패키지 설치 확인
npm install

# 2. 빌드 (환경 변수 자동 주입)
npm run build:kr

# 3. 배포
# Cloudflare가 자동으로 VITE_SENTRY_DSN 환경 변수 주입

# 4. 배포 후 확인
curl https://live.ur-team.com/login
# Console에서 "[Sentry] ✅ Initialized" 확인
```

---

## 7️⃣ **테스트**

### **로컬에서 Sentry 테스트**:

```typescript
// 임시로 에러 발생시켜 Sentry 테스트
import * as Sentry from '@sentry/react'

function TestButton() {
  return (
    <button onClick={() => {
      Sentry.captureException(new Error('Test error from UR Live'))
    }}>
      Test Sentry
    </button>
  )
}
```

**Sentry Dashboard 확인**:
1. Issues → "Test error from UR Live" 나타남
2. Error details 확인 (스택 트레이스, 브레드크럼, 사용자 정보)

---

## 📊 **Sentry 대시보드 설정**

### **Alerts 설정**:
1. Alerts → Create Alert Rule
2. Conditions:
   - When: Error count ≥ 10 in 1 hour
   - Filter: environment:production
3. Actions:
   - Send notification to: Slack / Email
   - Assign to: Team Lead

### **성능 임계값**:
1. Performance → Transaction Summary
2. Set threshold:
   - LoginPage: < 2s
   - CheckoutPage: < 3s
   - API calls: < 500ms

---

## ✅ **체크리스트**

- [ ] `@sentry/react` 설치 완료
- [ ] `src/lib/sentry.ts` 생성 완료
- [ ] `src/index.tsx` 통합 완료
- [ ] Auth 이벤트 트래킹 추가
- [ ] Cloudflare 환경 변수 설정
- [ ] 빌드 & 배포 성공
- [ ] Sentry Dashboard에서 에러 확인 가능
- [ ] Alert 설정 완료

---

**다음 단계**: 48시간 모니터링 포인트 정의 📊
