# 🏗️ UR-Live E-Commerce Platform Architecture

## 📁 프로젝트 구조 (Feature-Based Architecture)

```
src/
├── 📱 App.tsx                          # Root component, Router setup
├── 🔐 auth-utils.ts                   # Authentication utilities
│
├── 📦 components/                      # Presentational Components (UI)
│   ├── auth/                          # Authentication UI components
│   ├── browse/                        # Product browsing components
│   ├── cart/                          # Shopping cart UI
│   │   ├── CartHeader.tsx
│   │   ├── CartItem.tsx
│   │   ├── CartSummary.tsx
│   │   └── EmptyCart.tsx
│   ├── charts/                        # Dashboard charts
│   ├── home/                          # Landing page sections
│   ├── live/                          # Live streaming components
│   ├── main/                          # Main layout (Nav, Footer, etc.)
│   ├── my-page/                       # User profile components
│   ├── payments/                      # Payment widgets (Toss, Stripe)
│   ├── product/                       # Product detail components
│   ├── search/                        # Search UI
│   ├── seller-public/                 # Public seller pages
│   └── ui/                            # Reusable UI primitives
│
├── 🎯 features/                        # Feature Modules (Business Logic)
│   ├── account/                       # User account management
│   │   ├── api/                       # Account API calls
│   │   └── types/                     # Account types
│   │
│   ├── auth/                          # Authentication & Authorization
│   │   ├── api/                       # Auth API calls
│   │   ├── services/                  # Auth services (Firebase, Kakao, Google)
│   │   │   ├── FirebaseAuthService.ts
│   │   │   ├── GoogleAuthService.ts
│   │   │   ├── KakaoAuthService.ts
│   │   │   └── login-flow.service.ts
│   │   └── types/                     # Auth types
│   │
│   ├── cart/                          # Shopping Cart
│   │   └── api/                       # Cart API calls
│   │
│   ├── orders/                        # Order Management
│   │   ├── api/                       # Order API calls
│   │   ├── repositories/              # Order data access
│   │   ├── services/                  # Order business logic
│   │   └── types/                     # Order types
│   │
│   ├── payments/                      # Payment Processing
│   │   └── api/                       # Payment API calls
│   │
│   ├── products/                      # Product Catalog
│   │   ├── api/                       # Product API calls
│   │   ├── repositories/              # Product data access
│   │   ├── services/                  # Product business logic
│   │   └── types/                     # Product types
│   │
│   ├── seller/                        # Seller Dashboard
│   │   └── api/                       # Seller API calls
│   │
│   └── shipping/                      # Shipping & Delivery
│       └── api/                       # Shipping API calls
│
├── 🎣 hooks/                           # Custom React Hooks
│   ├── useCart.ts                     # Cart state & mutations (React Query)
│   ├── useAuth.ts                     # Auth state
│   ├── useProducts.ts                 # Product queries
│   └── ...
│
├── 📚 lib/                             # External Libraries Integration
│   ├── api.ts                         # Axios instance with interceptors
│   ├── firebase.ts                    # Firebase config
│   ├── firebase-auth.ts               # Firebase Auth lazy loading
│   ├── firebase-admin.ts              # Firebase Admin SDK
│   ├── firebase-config.ts             # Firebase configuration
│   └── ...
│
├── 🛡️ middleware/                      # Request/Response Middleware
│
├── 📄 pages/                           # Page Components (Routes)
│   ├── HomePage.tsx
│   ├── CartPage.tsx
│   ├── CheckoutPage.tsx
│   ├── ProductDetailPage.tsx
│   ├── UserProfilePage.tsx
│   ├── admin/                         # Admin dashboard pages
│   └── seller/                        # Seller dashboard pages
│
├── 🔧 services/                        # Shared Services
│   └── payment/                       # Payment service integrations
│
├── 🗄️ shared/                          # Shared Resources
│   ├── config/                        # App configuration
│   ├── db/                            # Database utilities
│   ├── repositories/                  # Shared data access patterns
│   └── stores/                        # Global State (Zustand)
│       ├── useAuthKR.ts               # Korean auth store
│       ├── useAuthWorld.ts            # Global auth store
│       └── useAuthUI.ts               # Auth UI state
│
├── 🎨 styles/                          # Global styles
│
├── 🧪 tests/                           # Test files
│
├── 📝 types/                           # Global TypeScript types
│
├── 🛠️ utils/                           # Utility functions
│
└── 👷 worker/                          # Cloudflare Worker (SSR/API)
    ├── middleware/                    # Worker middleware
    ├── services/                      # Worker services
    └── utils/                         # Worker utilities
```

## 🏛️ 아키텍처 패턴

### 1. **Feature-Based Architecture** (핵심 패턴)

```
feature/
├── api/           # API 호출 레이어
├── services/      # 비즈니스 로직 레이어
├── repositories/  # 데이터 접근 레이어
└── types/         # 타입 정의
```

**장점:**
- ✅ 기능별 코드 응집도 증가
- ✅ 팀 단위 개발 용이
- ✅ 독립적 테스트 가능
- ✅ 수평 확장 가능

---

### 2. **Layered Architecture** (계층화)

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│   (Pages + Components)                  │
│   - UI 렌더링                            │
│   - 사용자 인터랙션                       │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Business Logic Layer            │
│   (Hooks + Services)                    │
│   - React Query (캐시/상태)              │
│   - 비즈니스 룰                          │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Data Access Layer               │
│   (API + Repositories)                  │
│   - HTTP 요청                            │
│   - 데이터 변환                          │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Infrastructure Layer            │
│   (lib + worker)                        │
│   - Firebase, Axios 설정                 │
│   - Cloudflare Worker                   │
└─────────────────────────────────────────┘
```

---

### 3. **React Query Architecture** (데이터 페칭)

```typescript
// 🎣 Custom Hook (Business Logic)
export function useCart() {
  return useQuery({
    queryKey: ['cart'],
    queryFn: async () => {
      const response = await api.get('/api/cart')
      return parseCartResponse(response.data)
    },
    staleTime: 0,
    refetchOnMount: 'always'
  })
}

// 📄 Page Component (Presentation)
function CartPage() {
  const { data: cartData, isLoading } = useCart()
  
  if (isLoading) return <Loading />
  
  return <CartUI items={cartData?.items} />
}
```

**장점:**
- ✅ 자동 캐시 관리
- ✅ 낙관적 업데이트
- ✅ 백그라운드 새로고침
- ✅ 중복 요청 제거

---

### 4. **Zustand State Management** (전역 상태)

```typescript
// 🗄️ Auth Store
export const useAuthKR = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        isLoading: true,
        isAuthReady: false,
        
        // Actions
        loginWithEmail: async (email, password) => { ... },
        loginWithKakao: () => { ... },
        logout: async () => { ... },
        initializeAuth: async () => { ... }
      }),
      { name: 'auth-kr-storage' }
    )
  )
)
```

**사용:**
- 🔐 Authentication state
- 🌍 Multi-region support (KR vs World)
- 💾 LocalStorage persistence
- 🔄 Real-time sync

---

## 🔄 데이터 흐름 (Data Flow)

### 예시: 장바구니 → 결제 흐름

```
┌─────────────────┐
│  ProductDetail  │ 상품 상세
└────────┬────────┘
         │ addToCart()
         ▼
┌─────────────────┐
│   useAddToCart  │ React Query Mutation
└────────┬────────┘
         │ api.post('/api/cart')
         ▼
┌─────────────────┐
│  Backend API    │ Cloudflare Worker
│  /api/cart      │
└────────┬────────┘
         │ DB Insert
         ▼
┌─────────────────┐
│   Database      │ PostgreSQL
└────────┬────────┘
         │ Success Response
         ▼
┌─────────────────┐
│  Query Invalid  │ React Query Cache
└────────┬────────┘
         │ Auto Refetch
         ▼
┌─────────────────┐
│    CartPage     │ 장바구니 페이지
└────────┬────────┘
         │ navigate('/checkout')
         ▼
┌─────────────────┐
│  CheckoutPage   │ 결제 페이지
└────────┬────────┘
         │ TossPayments.requestPayment()
         ▼
┌─────────────────┐
│  Payment APIs   │ Toss/Stripe
└─────────────────┘
```

---

## 🔐 인증 흐름 (Authentication Flow)

### Firebase + Kakao/Google OAuth

```
┌──────────────┐
│   User       │
└──────┬───────┘
       │ Click "Login with Kakao"
       ▼
┌──────────────────┐
│ KakaoAuthService │
└──────┬───────────┘
       │ Redirect to Kakao
       ▼
┌──────────────────┐
│   Kakao OAuth    │
└──────┬───────────┘
       │ accessToken
       ▼
┌──────────────────┐
│  Backend API     │
│  /auth/kakao     │
└──────┬───────────┘
       │ Firebase Custom Token
       ▼
┌──────────────────┐
│ FirebaseAuthSvc  │
│ signInWithToken  │
└──────┬───────────┘
       │ onAuthStateChanged
       ▼
┌──────────────────┐
│   useAuthKR      │ Zustand Store
└──────┬───────────┘
       │ setUser()
       ▼
┌──────────────────┐
│  App Components  │ Auto Re-render
└──────────────────┘
```

---

## 📦 핵심 모듈 상세

### 1. **Cart Module** (장바구니)

```
features/cart/
└── api/
    └── cartApi.ts          # API 함수

hooks/
└── useCart.ts              # React Query 훅
    ├── useCart()           # GET /api/cart
    ├── useAddToCart()      # POST /api/cart
    ├── useUpdateQuantity() # PATCH /api/cart/:id
    └── useRemoveFromCart() # DELETE /api/cart/:id

pages/
└── CartPage.tsx            # UI 컴포넌트

components/cart/
├── CartHeader.tsx
├── CartItem.tsx
├── CartSummary.tsx
└── EmptyCart.tsx
```

**특징:**
- ✅ 낙관적 업데이트 (Optimistic Updates)
- ✅ 자동 캐시 무효화
- ✅ 에러 롤백 (Error Rollback)

---

### 2. **Auth Module** (인증)

```
features/auth/
├── services/
│   ├── FirebaseAuthService.ts    # Firebase 인증
│   ├── KakaoAuthService.ts       # 카카오 로그인
│   ├── GoogleAuthService.ts      # 구글 로그인
│   └── login-flow.service.ts     # 통합 로그인 플로우
├── api/
│   └── authApi.ts                # 인증 API
└── types/
    └── auth.types.ts             # 인증 타입

lib/
├── firebase-auth.ts              # Firebase Lazy Loading
└── firebase-config.ts            # Firebase 설정

shared/stores/
├── useAuthKR.ts                  # 한국 인증 스토어
├── useAuthWorld.ts               # 글로벌 인증 스토어
└── useAuthUI.ts                  # 인증 UI 상태
```

**특징:**
- ✅ Multi-provider (Kakao, Google, Email)
- ✅ Firebase Custom Token
- ✅ Lazy Loading (성능 최적화)
- ✅ Multi-region support

---

### 3. **Payment Module** (결제)

```
features/payments/
└── api/
    └── paymentApi.ts

components/payments/
├── TossPaymentWidget.tsx         # 토스페이먼츠
└── StripeCheckout.tsx            # Stripe (글로벌)

pages/
├── CheckoutPage.tsx              # 결제 페이지
├── PaymentSuccessPage.tsx        # 결제 성공
└── PaymentFailPage.tsx           # 결제 실패

services/payment/
└── tossPaymentsService.ts        # 토스 통합
```

**특징:**
- ✅ 토스페이먼츠 (한국)
- ✅ Stripe (글로벌)
- ✅ 셀러별 배송비 계산
- ✅ 주문 백업 (localStorage)

---

## 🚀 성능 최적화

### 1. **Code Splitting**

```typescript
// Lazy Loading Pages
const CartPage = lazy(() => import('./pages/CartPage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))

// Lazy Loading Libraries
const getFirebaseAuth = async () => {
  const { getAuth } = await import('firebase/auth')
  return getAuth(app)
}
```

### 2. **React Query Caching**

```typescript
{
  staleTime: 0,              // 항상 최신
  gcTime: 5 * 60 * 1000,     // 5분 후 GC
  refetchOnMount: 'always',  // 마운트 시 새로고침
  refetchOnWindowFocus: true // 포커스 시 새로고침
}
```

### 3. **Image Optimization**

```typescript
<OptimizedImage
  src={product.image}
  alt={product.name}
  loading="lazy"
  width={300}
  height={300}
/>
```

---

## 🛡️ 에러 처리

### 1. **API 레벨**

```typescript
// lib/api.ts - Axios Interceptor
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Token refresh
      const newToken = await refreshToken()
      error.config.headers.Authorization = `Bearer ${newToken}`
      return api.request(error.config)
    }
    return Promise.reject(error)
  }
)
```

### 2. **React Query 레벨**

```typescript
useMutation({
  mutationFn: addToCart,
  onMutate: async (newItem) => {
    // 낙관적 업데이트
    const previousCart = queryClient.getQueryData(['cart'])
    queryClient.setQueryData(['cart'], old => [...old, newItem])
    return { previousCart }
  },
  onError: (err, variables, context) => {
    // 롤백
    queryClient.setQueryData(['cart'], context.previousCart)
  }
})
```

### 3. **UI 레벨**

```typescript
<ErrorBoundary>
  <Suspense fallback={<Loading />}>
    <Routes />
  </Suspense>
</ErrorBoundary>
```

---

## 📊 모니터링

### Sentry Integration

```typescript
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ]
})
```

---

## 🌍 Multi-Region Support

```typescript
// Region Detection
const isKorea = region === 'KR'

// Region-specific Auth Store
const useAuth = isKorea ? useAuthKR : useAuthWorld

// Region-specific Payment
const PaymentWidget = isKorea ? TossPaymentWidget : StripeCheckout
```

---

## 🔧 Development Tools

- **TypeScript**: Type safety
- **Vite**: Fast dev server & build
- **React Query**: Data fetching & caching
- **Zustand**: Global state management
- **Tailwind CSS**: Utility-first styling
- **Sentry**: Error tracking
- **ESLint + Prettier**: Code quality

---

## 📝 핵심 설계 원칙

1. **Separation of Concerns** (관심사 분리)
   - UI ↔ Business Logic ↔ Data Access 명확히 분리

2. **Single Responsibility** (단일 책임)
   - 각 모듈/함수는 하나의 책임만

3. **DRY (Don't Repeat Yourself)** (반복 금지)
   - 재사용 가능한 훅/유틸 활용

4. **Composition over Inheritance** (상속보다 조합)
   - React 컴포넌트 합성 패턴

5. **API-First Design** (API 우선 설계)
   - 백엔드 API 구조가 프론트엔드 구조 결정

---

## 📈 확장성 고려사항

1. **Horizontal Scaling** (수평 확장)
   - Feature 단위로 팀 분할 가능
   - 독립적인 모듈 개발

2. **Vertical Scaling** (수직 확장)
   - Layer 단위로 최적화 가능
   - Caching, CDN, SSR 적용

3. **Multi-tenancy** (멀티 테넌시)
   - 셀러별 독립적인 상품/주문 관리
   - Region별 다른 인증/결제

---

## 🎯 최근 개선 사항 (2026-03-09)

### 1. 배송비 계산 통일
- CartPage ↔ CheckoutPage 로직 일치
- 셀러별 배송비 정확히 계산

### 2. API 응답 파싱 개선
- 일관된 파싱 로직 (`{success: true, data: ...}`)
- React Query 캐시 최적화

### 3. 인증 안정화
- Firebase persistence 강제 적용
- 전역 onAuthStateChanged 리스너
- lastLoginUid 즉시 복원

### 4. 에러 처리 개선
- useAuthKR unsubscribe null 체크
- Sentry 에러 완전 제거

---

## 🔮 향후 개선 계획

1. **E2E Testing** (Playwright/Cypress)
2. **Performance Monitoring** (Web Vitals)
3. **A/B Testing** (LaunchDarkly)
4. **GraphQL** (REST → GraphQL 마이그레이션)
5. **Micro-frontends** (대규모 팀 확장 시)

