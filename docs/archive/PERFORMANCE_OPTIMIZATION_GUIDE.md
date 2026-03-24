# 🚀 페이지 로딩 속도 분석 및 최적화 가이드

## 📊 현재 상태 분석

### ✅ 양호한 점
- **모든 페이지 번들**: 50KB 이하로 "Excellent" 등급
- **ProductDetailPage**: 17.88KB (🟢 Excellent)
- **페이지 번들 합계**: 528.41KB
- **코드 스플리팅**: 잘 적용됨

### ⚠️ 문제점

#### 1. **벤더 번들 (Critical 🔴)**
```
vendor-BkPhQiNL.js:    1,127KB  ← 가장 큰 문제
firebase-D_8YzbRP.js:    412KB
```

#### 2. **무거운 페이지 (의존성 과다)**
```
1. LivePageV2          - 54점 (14 useEffect, 5 API)
2. AdminPage           - 40점 (2 useEffect, 9 API)
3. CheckoutPage        - 37점 (8 useEffect, 3 API)
4. SellerLiveControl   - 37점 (5 useEffect, 7 API)
5. HomePage            - 29점 (3 useEffect, 4 API)
```

#### 3. **API 호출 최적화 부족**
- 캐싱 없음 (React Query/SWR 미사용)
- 매번 서버 요청
- 로딩 상태 중복

---

## 🎯 최적화 전략

### 우선순위 1: 벤더 번들 최적화 (1.5MB → ~500KB)

**현재 문제:**
- React, React-Router, Firebase 등 모든 라이브러리가 한 번들에
- Tree shaking 미흡
- Dynamic import 부족

**해결책:**

#### 1.1 Firebase 지연 로딩
```typescript
// ❌ 기존 (모든 페이지에서 로드)
import { getAuth } from 'firebase/auth'

// ✅ 개선 (필요시에만 로드)
const loadFirebase = async () => {
  const { getAuth } = await import('firebase/auth')
  return getAuth()
}
```

#### 1.2 Lucide Icons 최적화
```typescript
// ❌ 기존
import { Heart, Share, ShoppingCart } from 'lucide-react'

// ✅ 개선 (개별 import)
import Heart from 'lucide-react/dist/esm/icons/heart'
import Share from 'lucide-react/dist/esm/icons/share'
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart'
```

#### 1.3 Vite 설정 개선 (vite.config.ts)
```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React 코어
          'react-core': ['react', 'react-dom', 'react-router-dom'],
          
          // Firebase 분리
          'firebase-auth': ['firebase/auth'],
          'firebase-firestore': ['firebase/firestore'],
          
          // UI 라이브러리
          'ui-libs': ['lucide-react', '@radix-ui/react-checkbox'],
          
          // Zustand & 상태관리
          'state': ['zustand', 'zustand/middleware'],
        }
      }
    },
    chunkSizeWarningLimit: 500, // 500KB 경고
  }
})
```

---

### 우선순위 2: React Query 도입 (API 캐싱)

**현재 ProductDetailPage 문제:**
```typescript
// ❌ 매번 API 호출, 캐싱 없음
async function loadProduct() {
  const response = await api.get(`/api/products/${id}`)
  setProduct(response.data.data.product)
}
```

**개선 방안:**

#### 2.1 React Query 설치
```bash
npm install @tanstack/react-query
```

#### 2.2 QueryProvider 설정
```typescript
// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5분
      cacheTime: 1000 * 60 * 10, // 10분
      refetchOnWindowFocus: false,
    }
  }
})

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

#### 2.3 ProductDetailPage 리팩토링
```typescript
// src/hooks/useProduct.ts
export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/api/products/${id}`),
    staleTime: 1000 * 60 * 5, // 5분 캐싱
  })
}

// src/pages/ProductDetailPage.tsx
const { data: product, isLoading, error } = useProduct(id)
```

**효과:**
- 같은 상품 재방문 시 즉시 로드 (캐시)
- 백그라운드 자동 갱신
- 로딩 상태 자동 관리

---

### 우선순위 3: 이미지 최적화

**현재 문제:**
```typescript
<img src={src} loading="lazy" />  // 기본 lazy loading만
```

**개선 방안:**

#### 3.1 이미지 CDN & 리사이징
```typescript
// src/utils/image.ts
export function optimizeImage(url: string, options = {}) {
  const { width = 800, quality = 80 } = options
  
  // Cloudflare Images 또는 Imgix 사용
  if (url.includes('cloudflare')) {
    return `${url}/w=${width},q=${quality}`
  }
  
  return url
}

// 사용
<img 
  src={optimizeImage(product.image_url, { width: 400 })} 
  srcSet={`
    ${optimizeImage(product.image_url, { width: 400 })} 400w,
    ${optimizeImage(product.image_url, { width: 800 })} 800w
  `}
  sizes="(max-width: 768px) 100vw, 50vw"
  loading="lazy"
/>
```

#### 3.2 Progressive Loading (Blur-up)
```typescript
import { useState } from 'react'

export function ProgressiveImage({ src, placeholder }) {
  const [isLoaded, setIsLoaded] = useState(false)
  
  return (
    <div className="relative">
      {/* Blur placeholder */}
      {!isLoaded && (
        <img 
          src={placeholder} 
          className="absolute inset-0 blur-sm"
          aria-hidden="true"
        />
      )}
      
      {/* 실제 이미지 */}
      <img 
        src={src}
        onLoad={() => setIsLoaded(true)}
        className={`transition-opacity ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
      />
    </div>
  )
}
```

---

### 우선순위 4: LivePageV2 최적화 (54점 → 20점 이하)

**현재 문제:**
- 14개 useEffect (너무 많음)
- 5개 API 동시 호출
- 실시간 업데이트 로직 복잡

**해결책:**

#### 4.1 Custom Hook으로 분리
```typescript
// src/hooks/useLiveStream.ts
export function useLiveStream(streamId) {
  const [stream, setStream] = useState(null)
  const [messages, setMessages] = useState([])
  
  useEffect(() => {
    // 스트림 데이터 로드
    loadStream()
    
    // WebSocket 연결
    const ws = connectWebSocket(streamId)
    
    return () => ws.close()
  }, [streamId])
  
  return { stream, messages, sendMessage }
}

// LivePageV2.tsx - 간결해짐
const { stream, messages, sendMessage } = useLiveStream(id)
```

#### 4.2 API 호출 병렬 처리
```typescript
// ❌ 순차 호출 (느림)
const stream = await api.get('/stream')
const products = await api.get('/products')
const seller = await api.get('/seller')

// ✅ 병렬 호출 (빠름)
const [stream, products, seller] = await Promise.all([
  api.get('/stream'),
  api.get('/products'),
  api.get('/seller')
])
```

---

### 우선순위 5: 컴포넌트 지연 로딩

**ProductDetailPage 개선:**

```typescript
// ❌ 기존 (모든 컴포넌트 즉시 로드)
import { ProductImageCarousel } from '@/components/product/product-image-carousel'
import { ProductHeader } from '@/components/product/product-header'
import { FloatingActionBar } from '@/components/product/floating-action-bar'

// ✅ 개선 (필요시에만 로드)
const ProductImageCarousel = lazy(() => 
  import('@/components/product/product-image-carousel')
)
const FloatingActionBar = lazy(() => 
  import('@/components/product/floating-action-bar')
)

// 사용
<Suspense fallback={<Skeleton />}>
  <ProductImageCarousel images={allImages} />
</Suspense>
```

---

## 📈 예상 개선 효과

| 항목 | 현재 | 목표 | 개선율 |
|------|------|------|--------|
| **초기 번들** | 1.5MB | 500KB | 66% ↓ |
| **ProductDetail 로딩** | 800ms | 200ms | 75% ↓ |
| **API 재요청** | 매번 | 캐시 활용 | 90% ↓ |
| **이미지 로딩** | 2-3초 | 500ms | 80% ↓ |
| **LivePage 복잡도** | 54점 | 20점 | 63% ↓ |

---

## 🛠️ 즉시 적용 가능한 Quick Wins

### 1. **.env 환경변수로 디버그 로그 제거**
```typescript
// src/pages/ProductDetailPage.tsx
- console.log('[ProductDetail] 🛒 담기 버튼 클릭')
+ if (import.meta.env.DEV) {
+   console.log('[ProductDetail] 🛒 담기 버튼 클릭')
+ }
```

### 2. **API 응답 압축 (Cloudflare Worker)**
```typescript
// src/worker/index.ts
app.use('*', compress()) // ✅ 이미 적용됨!
```

### 3. **브라우저 캐싱 활성화**
```typescript
// public/_headers
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/api/*
  Cache-Control: private, max-age=0, must-revalidate
```

---

## 🔍 모니터링

### Lighthouse 점수 목표
```
Performance:    90+  (현재: 70-80 예상)
Accessibility:  95+
Best Practices: 95+
SEO:           100
```

### Web Vitals 목표
```
LCP (Largest Contentful Paint):   < 2.5초
FID (First Input Delay):          < 100ms
CLS (Cumulative Layout Shift):    < 0.1
```

---

## ✅ 구현 우선순위 요약

1. **🔴 긴급**: 벤더 번들 분리 (1.5MB → 500KB)
2. **🟠 높음**: React Query 도입 (API 캐싱)
3. **🟡 중간**: 이미지 최적화 (CDN, lazy loading)
4. **🟢 낮음**: 컴포넌트 lazy loading
5. **🔵 향후**: LivePageV2 리팩토링

**예상 작업 시간:** 4-6 시간
**예상 성능 개선:** 70-80% 로딩 속도 향상
