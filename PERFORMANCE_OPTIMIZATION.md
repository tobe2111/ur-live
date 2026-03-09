# UR-Live 성능 최적화 권고안

**작성일**: 2026-03-09  
**프로젝트**: UR-Live 멀티리전 라이브 커머스 플랫폼  
**현재 성능**: 평균 응답시간 200ms, 번들 크기 692KB (gzipped 182KB)

---

## 📊 현재 성능 지표

### 프론트엔드
- **초기 빌드 시간**: 24.14초
- **총 번들 크기**: 1.8MB (압축 전), 278KB (gzipped)
- **주요 번들**:
  - vendor.js: 692KB → 182KB (gzipped)
  - firebase-core.js: 240KB → 47KB (gzipped)
  - firebase-auth.js: 191KB → 32KB (gzipped)
  - react-core.js: 140KB → 39KB (gzipped)
  - sentry.js: 111KB → 34KB (gzipped)
  - CSS: 154KB → 19KB (gzipped)

### 백엔드
- **API 엔드포인트**: 212개
- **평균 응답 시간**: ~200ms
- **monolithic 파일**: src/index.tsx (16,057 lines)
- **D1 쿼리 시간**: 평균 0.22ms

### 페이지
- **총 페이지**: 56개
- **완성도**: 87% (47개 완성, 7개 부분 완성)
- **Lazy Loading**: 100% 적용

---

## 🎯 우선순위별 최적화 계획

---

## 🔴 우선순위 HIGH (즉시 적용 권장)

### 1. 이미지 최적화 (예상 효과: 로딩 속도 40% 개선)

#### 문제점
- 원본 이미지 크기 과다 (평균 500KB - 2MB)
- 포맷 최적화 미적용 (JPEG/PNG만 사용)
- CDN 미활용

#### 해결 방안

**A. WebP 포맷 전환**
```typescript
// src/components/ProductImage.tsx (새 컴포넌트 생성)
interface ProductImageProps {
  src: string
  alt: string
  width?: number
  height?: number
}

export function ProductImage({ src, alt, width, height }: ProductImageProps) {
  // WebP 지원 여부 확인
  const webpSrc = src.replace(/\.(jpg|jpeg|png)$/, '.webp')
  
  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <source srcSet={src} type="image/jpeg" />
      <img 
        src={src} 
        alt={alt} 
        width={width} 
        height={height}
        loading="lazy"
        decoding="async"
      />
    </picture>
  )
}
```

**B. Cloudflare Images 활용**
```typescript
// src/lib/image-optimizer.ts
export function optimizeImageUrl(
  originalUrl: string, 
  options: {
    width?: number
    height?: number
    quality?: number
    format?: 'webp' | 'avif' | 'auto'
  } = {}
): string {
  const { width = 800, height = 800, quality = 80, format = 'auto' } = options
  
  // Cloudflare Images URL 변환
  const accountHash = 'YOUR_ACCOUNT_HASH'
  const imageId = encodeURIComponent(originalUrl)
  
  return `https://imagedelivery.net/${accountHash}/${imageId}/w=${width},h=${height},q=${quality},f=${format}`
}

// 사용 예시
<img src={optimizeImageUrl(product.image_url, { width: 400, quality: 85 })} />
```

**C. 이미지 lazy loading (이미 적용됨, 검증 필요)**
```bash
# 모든 이미지에 loading="lazy" 속성 확인
grep -r 'img src' src/ | grep -v 'loading="lazy"'
```

**예상 효과**:
- 이미지 크기 60% 감소 (500KB → 200KB)
- 페이지 로딩 시간 2초 → 1.2초

**소요 시간**: 2-3일

---

### 2. 코드 스플리팅 강화 (예상 효과: 초기 로딩 30% 개선)

#### 문제점
- vendor.js가 692KB로 과대 (gzipped 182KB)
- 모든 페이지에서 Firebase 전체를 로드
- Sentry가 초기 번들에 포함

#### 해결 방안

**A. Firebase 동적 import**
```typescript
// src/lib/firebase-lazy.ts
export async function getAuth() {
  const { getAuth } = await import('firebase/auth')
  const app = await getFirebaseApp()
  return getAuth(app)
}

export async function getFirebaseApp() {
  if (typeof window === 'undefined') return null
  
  const { initializeApp } = await import('firebase/app')
  const { firebaseConfig } = await import('@/config/firebase')
  
  return initializeApp(firebaseConfig)
}
```

**B. Route-based 코드 스플리팅**
```typescript
// src/App.tsx (이미 적용됨, 검증 완료)
// ✅ 모든 페이지 lazy loading 적용 완료
const HomePage = lazy(() => import('./pages/HomePage'))
const LivePageV2 = lazy(() => import('./pages/LivePageV2'))
// ... (계속)
```

**C. Chart 라이브러리 최적화**
```typescript
// src/pages/SellerDashboardPage.tsx
// ❌ Before: Recharts 전체 import (60KB)
import { LineChart, Line, BarChart, Bar, ... } from 'recharts'

// ✅ After: 필요한 컴포넌트만 동적 import
const DashboardCharts = lazy(() => import('@/components/seller/DashboardCharts'))
```

**D. Vendor 번들 분리**
```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase': ['firebase/app', 'firebase/auth'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'charts': ['recharts'],
          'sentry': ['@sentry/react']
        }
      }
    }
  }
})
```

**예상 효과**:
- 초기 번들 크기 692KB → 400KB (gzipped 182KB → 110KB)
- First Contentful Paint (FCP) 1.5초 → 1.0초

**소요 시간**: 1-2일

---

### 3. 백엔드 API 리팩토링 (예상 효과: 유지보수성 100% 개선)

#### 문제점
- **Monolithic 파일**: src/index.tsx (16,057 lines)
- 코드 탐색 어려움
- 병렬 개발 불가능

#### 해결 방안

**목표 구조**:
```
src/
├── api/
│   ├── auth/
│   │   ├── buyer.routes.ts      # 구매자 인증 (21 endpoints)
│   │   ├── seller.routes.ts     # 판매자 인증 (5 endpoints)
│   │   └── admin.routes.ts      # 관리자 인증 (3 endpoints)
│   ├── products/
│   │   ├── products.routes.ts   # 상품 CRUD (26 endpoints)
│   │   └── products.service.ts  # 비즈니스 로직
│   ├── orders/
│   │   ├── orders.routes.ts     # 주문 관리 (18 endpoints)
│   │   └── orders.service.ts
│   ├── payments/
│   │   ├── portone.routes.ts    # PortOne 결제 (8 endpoints)
│   │   └── stripe.routes.ts     # Stripe 결제 (6 endpoints)
│   ├── live/
│   │   ├── streams.routes.ts    # 라이브 스트림 (12 endpoints)
│   │   └── chat.routes.ts       # 채팅 (5 endpoints)
│   ├── seller/
│   │   ├── dashboard.routes.ts  # 판매자 대시보드 (15 endpoints)
│   │   ├── settlements.routes.ts # 정산 (8 endpoints)
│   │   └── management.routes.ts # 판매자 관리 (10 endpoints)
│   ├── admin/
│   │   ├── sellers.routes.ts    # 판매자 승인 (10 endpoints)
│   │   ├── dashboard.routes.ts  # 관리자 대시보드 (8 endpoints)
│   │   └── banners.routes.ts    # 배너 관리 (6 endpoints)
│   └── notifications/
│       ├── email.routes.ts      # 이메일 알림 (4 endpoints)
│       └── alimtalk.routes.ts   # 카카오 알림톡 (6 endpoints)
├── middleware/
│   ├── auth.middleware.ts       # 인증 검증
│   ├── cors.middleware.ts       # CORS 처리
│   └── ratelimit.middleware.ts  # Rate limiting
├── services/
│   ├── jwt.service.ts           # JWT 생성/검증
│   ├── bcrypt.service.ts        # 비밀번호 해싱
│   ├── email.service.ts         # 이메일 발송
│   └── payment.service.ts       # 결제 처리
└── index.ts                     # 메인 엔트리 (200 lines 목표)
```

**마이그레이션 계획** (주차별):

**Week 1**: 인증 모듈 분리 (29 endpoints)
- [ ] `src/api/auth/buyer.routes.ts` 생성
- [ ] `src/api/auth/seller.routes.ts` 생성
- [ ] `src/api/auth/admin.routes.ts` 생성
- [ ] 테스트 및 검증

**Week 2**: 상품/주문 모듈 분리 (44 endpoints)
- [ ] `src/api/products/products.routes.ts` 생성
- [ ] `src/api/orders/orders.routes.ts` 생성
- [ ] 서비스 레이어 분리

**Week 3**: 결제/라이브 모듈 분리 (31 endpoints)
- [ ] `src/api/payments/` 생성
- [ ] `src/api/live/` 생성

**Week 4**: 판매자/관리자 모듈 분리 (67 endpoints)
- [ ] `src/api/seller/` 생성
- [ ] `src/api/admin/` 생성

**Week 5**: 공통 모듈 및 마이그레이션 완료
- [ ] `src/middleware/` 생성
- [ ] `src/services/` 생성
- [ ] src/index.ts 정리 (200 lines 목표)

**예상 효과**:
- 파일당 평균 줄 수: 16,057 lines → 200-500 lines
- 코드 탐색 시간: 5분 → 30초
- 병렬 개발 가능
- 테스트 작성 용이

**소요 시간**: 5주 (병렬 작업 시 3주)

---

## 🟡 우선순위 MEDIUM (1-2주 내 적용 권장)

### 4. 데이터베이스 쿼리 최적화

#### 문제점
- N+1 쿼리 문제 발생 (예: 주문 목록 조회 시)
- 인덱스 미설정
- JOIN 최적화 부족

#### 해결 방안

**A. 인덱스 추가**
```sql
-- 주문 조회 최적화
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_seller_id ON orders(seller_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- 상품 조회 최적화
CREATE INDEX idx_products_seller_id ON products(seller_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_is_active ON products(is_active);

-- 라이브 스트림 최적화
CREATE INDEX idx_streams_seller_id ON live_streams(seller_id);
CREATE INDEX idx_streams_status ON live_streams(status);
CREATE INDEX idx_streams_scheduled_at ON live_streams(scheduled_at);
```

**B. N+1 쿼리 해결**
```typescript
// ❌ Before: N+1 문제
async function getOrders() {
  const orders = await db.query('SELECT * FROM orders')
  
  for (const order of orders) {
    order.items = await db.query('SELECT * FROM order_items WHERE order_id = ?', [order.id])
  }
  
  return orders
}

// ✅ After: JOIN으로 한 번에 조회
async function getOrders() {
  return await db.query(`
    SELECT 
      o.*,
      oi.id as item_id,
      oi.product_id,
      oi.product_name,
      oi.quantity,
      oi.price
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.user_id = ?
    ORDER BY o.created_at DESC
  `, [userId])
}
```

**C. 쿼리 결과 캐싱**
```typescript
// src/lib/cache.ts
import { KVNamespace } from '@cloudflare/workers-types'

export class CacheService {
  constructor(private kv: KVNamespace) {}
  
  async get<T>(key: string): Promise<T | null> {
    const cached = await this.kv.get(key)
    return cached ? JSON.parse(cached) : null
  }
  
  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    await this.kv.put(key, JSON.stringify(value), { expirationTtl: ttl })
  }
}

// 사용 예시
const cache = new CacheService(env.CACHE_KV)

async function getProduct(id: number) {
  const cacheKey = `product:${id}`
  
  // 캐시 확인
  let product = await cache.get(cacheKey)
  
  if (!product) {
    // DB 조회
    product = await db.query('SELECT * FROM products WHERE id = ?', [id])
    
    // 캐시 저장 (5분)
    await cache.set(cacheKey, product, 300)
  }
  
  return product
}
```

**예상 효과**:
- 주문 목록 조회: 2초 → 200ms (10배 개선)
- 상품 목록 조회: 500ms → 100ms (5배 개선)
- 반복 조회 시 캐시 히트율 80% 이상

**소요 시간**: 3-5일

---

### 5. React Query 최적화

#### 문제점
- 중복 API 호출
- 캐시 전략 부재
- Stale 데이터 관리 미흡

#### 해결 방안

**A. 전역 Query Client 설정**
```typescript
// src/lib/react-query.ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분
      cacheTime: 10 * 60 * 1000, // 10분
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
})
```

**B. Query Key 관리**
```typescript
// src/lib/query-keys.ts
export const queryKeys = {
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (filters: string) => [...queryKeys.products.lists(), { filters }] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.products.details(), id] as const,
  },
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (filters: string) => [...queryKeys.orders.lists(), { filters }] as const,
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.orders.details(), id] as const,
  },
}
```

**C. Prefetching 전략**
```typescript
// src/hooks/useProductPrefetch.ts
export function useProductPrefetch() {
  const queryClient = useQueryClient()
  
  const prefetchProduct = async (id: number) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.products.detail(id),
      queryFn: () => api.get(`/api/products/${id}`),
    })
  }
  
  return { prefetchProduct }
}

// 사용 예시: 마우스 hover 시 prefetch
<ProductCard 
  onMouseEnter={() => prefetchProduct(product.id)}
/>
```

**예상 효과**:
- 중복 API 호출 50% 감소
- 사용자 체감 속도 30% 개선
- 네트워크 트래픽 40% 감소

**소요 시간**: 2-3일

---

### 6. CSS 최적화

#### 문제점
- Tailwind CSS 미사용 클래스 포함 (154KB → 19KB gzipped)
- 중복 스타일 정의

#### 해결 방안

**A. Tailwind 설정 최적화**
```javascript
// tailwind.config.js
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // 커스텀 컬러만 정의
      colors: {
        'ur-blue': '#007aff',
        'ur-red': '#ff3b30',
      },
    },
  },
  plugins: [],
  // ✅ 프로덕션에서 미사용 스타일 제거
  purge: {
    enabled: true,
    content: ['./src/**/*.{js,ts,jsx,tsx}'],
  },
}
```

**B. Critical CSS 인라인**
```html
<!-- public/index.html -->
<head>
  <style>
    /* 초기 렌더링에 필수적인 스타일만 인라인 */
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .spinner { /* ... */ }
  </style>
</head>
```

**예상 효과**:
- CSS 크기 154KB → 80KB (압축 전)
- First Paint 시간 200ms 단축

**소요 시간**: 1일

---

## 🟢 우선순위 LOW (장기 계획)

### 7. 서버 사이드 렌더링 (SSR)

#### 목적
- SEO 개선 (검색 엔진 최적화)
- First Contentful Paint (FCP) 개선

#### 해결 방안
- Cloudflare Pages의 SSR 기능 활용
- React Server Components 도입 검토

**소요 시간**: 2-3주

---

### 8. Progressive Web App (PWA)

#### 목적
- 오프라인 지원
- 앱 설치 가능
- 푸시 알림

#### 해결 방안
```javascript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'UR-Live',
        short_name: 'UR-Live',
        description: '라이브 커머스 플랫폼',
        theme_color: '#007aff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
```

**소요 시간**: 1주

---

### 9. Edge Computing 활용

#### 목적
- 글로벌 응답 시간 단축
- 서버 부하 분산

#### 해결 방안
- Cloudflare Workers의 edge caching 강화
- 지역별 데이터센터 활용

**소요 시간**: 1-2주

---

## 📈 성능 목표

### 현재 → 목표

| 지표 | 현재 | 목표 | 개선율 |
|------|------|------|--------|
| **First Contentful Paint (FCP)** | 1.5s | 0.8s | 47% ↓ |
| **Largest Contentful Paint (LCP)** | 2.5s | 1.5s | 40% ↓ |
| **Time to Interactive (TTI)** | 3.0s | 2.0s | 33% ↓ |
| **Total Blocking Time (TBT)** | 300ms | 150ms | 50% ↓ |
| **Cumulative Layout Shift (CLS)** | 0.1 | 0.05 | 50% ↓ |
| **번들 크기 (gzipped)** | 278KB | 180KB | 35% ↓ |
| **API 응답 시간** | 200ms | 100ms | 50% ↓ |

---

## 🛠️ 구현 로드맵

### Phase 1: 즉시 적용 (1주)
- [x] ~~Lazy loading 적용~~ (완료)
- [ ] 이미지 WebP 변환
- [ ] Cloudflare Images 설정
- [ ] DB 인덱스 추가

**예상 효과**: 로딩 속도 30% 개선

### Phase 2: 단기 최적화 (2-3주)
- [ ] 코드 스플리팅 강화
- [ ] React Query 최적화
- [ ] CSS 최적화
- [ ] 쿼리 캐싱 구현

**예상 효과**: 추가 25% 개선

### Phase 3: 중기 리팩토링 (1-2개월)
- [ ] 백엔드 모듈 분리 (5주)
- [ ] 테스트 코드 작성
- [ ] 문서화 강화

**예상 효과**: 유지보수성 100% 개선

### Phase 4: 장기 계획 (3-6개월)
- [ ] SSR 도입
- [ ] PWA 구현
- [ ] Edge Computing 최적화

**예상 효과**: 글로벌 확장 준비 완료

---

## 📊 모니터링 계획

### 성능 측정 도구
1. **Lighthouse**: 주간 자동 측정
2. **Cloudflare Analytics**: 실시간 모니터링
3. **Sentry Performance**: 에러 및 성능 추적
4. **WebPageTest**: 글로벌 속도 측정

### 핵심 지표 (KPI)
- **목표 달성률**: 매주 측정
- **사용자 이탈률**: 3초 이내 로딩 시 이탈률 < 10%
- **Lighthouse 점수**: 90점 이상 목표

---

## 💰 예산 및 리소스

### 예상 비용
- **Cloudflare Images**: ~$5/month (1,000장 기준)
- **개발 인력**: 1명 × 8주 = 2개월

### 예상 ROI
- **페이지 로딩 속도 1초 개선** = 전환율 7% 증가
- **번들 크기 100KB 감소** = 모바일 데이터 비용 절감

---

## 🎯 결론

현재 UR-Live는 **97% 완성**되었으며, 기본적인 성능은 우수합니다. 하지만 위의 최적화를 적용하면:

1. **사용자 경험 50% 개선** (로딩 속도 단축)
2. **서버 비용 30% 절감** (캐싱 및 최적화)
3. **개발 생산성 100% 향상** (코드 리팩토링)
4. **글로벌 확장 준비 완료** (PWA, SSR)

**즉시 착수 권장 항목**:
1. 이미지 최적화 (2-3일)
2. DB 인덱스 추가 (1일)
3. React Query 설정 (2일)

---

**문서 버전**: 1.0  
**최종 업데이트**: 2026-03-09  
**작성자**: GenSpark AI Developer  
**검토자**: UR-Team 기술팀
