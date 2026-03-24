# UR Live 최적화 방안 검토 (2026-03-02)

## 📋 제안된 최적화 항목

1. ✅ Firebase 채팅 메시지 제한 (limitToLast 50) + 페이징
2. ⏳ Service Worker + PWA
3. ⏳ IndexedDB로 장바구니·배송지 오프라인 저장
4. ⏳ React Query 도입
5. ⏳ 채팅 메시지 TTL 24시간 삭제

---

## 🔍 현재 상태 분석

### 1. Firebase 채팅 메시지 제한 ✅ **이미 구현됨**

**현재 코드 (`src/hooks/useFirebaseChat.ts` Line 142):**
```typescript
query(
  chatRef,
  orderByChild('timestamp'),
  limitToLast(50)  // ✅ 이미 적용됨
)
```

**현황:**
- ✅ 최근 50개 메시지만 로드
- ✅ 실시간 업데이트 (Firebase onValue)
- ❌ 무한 스크롤 (페이징) 미구현
- ❌ 오래된 메시지 조회 불가

**비용 절감 효과:**
- 10,000 MAU 기준: **Firebase 비용 $290/월 → $87/월 (70% 절감)** 
- 이미 `OPERATING_COSTS_REVISED.md`에 반영됨
- Phase 1 최적화 완료 상태

**추가 개선 여부:**
- 🟡 **무한 스크롤 구현 필요성: 낮음**
  - 라이브 채팅 특성상 최근 메시지만 보는 경우가 대부분
  - 과거 메시지 조회 요구사항 없음
  - 구현 공수 대비 효과 미미
- 🟢 **현재 상태 유지 권장**

---

### 2. Service Worker + PWA ⏳ **미구현 (높은 우선순위)**

**현재 상태:**
- ❌ PWA 설정 없음
- ❌ Service Worker 없음
- ❌ 오프라인 지원 없음
- ❌ 앱 설치 프롬프트 없음

**사용자 불편 사항:**
1. **모바일 네트워크 끊김 시**: "인터넷 연결을 확인하세요" 백화면
2. **반복 방문 시**: 매번 전체 리소스 다시 다운로드
3. **앱 느낌 없음**: 브라우저 UI 노출, 홈 화면 추가 불가

**구현 방안:**

#### A. vite-plugin-pwa (추천) - 2일 소요

```bash
npm install -D vite-plugin-pwa
```

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'UR Live',
        short_name: 'UR Live',
        description: '라이브 커머스 플랫폼',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/live\.ur-team\.com\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60 // 5분
              }
            }
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30일
              }
            }
          }
        ]
      }
    })
  ]
})
```

**예상 효과:**
- 🚀 **첫 로딩 후 재방문 속도**: 3초 → **0.5초 (83% 개선)**
- 📱 **오프라인 페이지 진입 가능**: 캐시된 화면 표시
- 💾 **대역폭 절약**: 평균 70% 리소스 캐시 사용
- 🏠 **홈 화면 추가**: 네이티브 앱처럼 사용 가능
- 📈 **전환율 향상 예상**: 5-10%

**비용 영향:**
- Cloudflare Workers 요청 감소: ~30% (캐시 히트율 기준)
- 10,000 MAU 기준: **$43.50/월 → $30/월 (약 ₩18,000 절감)**

**구현 우선순위: 🔴 높음**
- 공수: 2일 (설정 1일 + 테스트 1일)
- 효과: 사용자 경험 대폭 개선 + 비용 절감
- 리스크: 낮음 (vite-plugin-pwa는 검증된 라이브러리)

---

### 3. IndexedDB로 장바구니·배송지 오프라인 저장 ⏳ **미구현 (중간 우선순위)**

**현재 상태:**
- ❌ IndexedDB 사용 없음
- ❌ Dexie.js 설치 안 됨
- ✅ localStorage 사용 중 (user_id, user_type 등)

**사용자 불편 사항:**
1. **네트워크 끊김 시**: 장바구니 정보 조회 불가
2. **앱 재시작 시**: 장바구니 카운트 깜빡임 (API 재호출 필요)
3. **배송지 선택 시**: 매번 API 호출 (느림)

**현재 API 호출 패턴 분석:**

```typescript
// 발견된 반복 호출 (5개 파일에서 중복)
const cartResponse = await api.get('/api/cart')              // 장바구니 조회
const addressResponse = await api.get('/api/shipping-addresses')  // 배송지 목록
const productResponse = await axios.get(`/api/streams/${streamId}/current-product`)
```

**구현 방안:**

#### A. Dexie.js (추천) - 2일 소요

```bash
npm install dexie
```

```typescript
// src/lib/db.ts
import Dexie, { Table } from 'dexie'

interface CartItem {
  id: number
  product_id: number
  quantity: number
  price: number
  updated_at: number
}

interface ShippingAddress {
  id: number
  name: string
  phone: string
  address: string
  is_default: boolean
  updated_at: number
}

class URLiveDB extends Dexie {
  cart!: Table<CartItem, number>
  addresses!: Table<ShippingAddress, number>

  constructor() {
    super('URLiveDB')
    this.version(1).stores({
      cart: 'id, product_id, updated_at',
      addresses: 'id, is_default, updated_at'
    })
  }
}

export const db = new URLiveDB()
```

```typescript
// src/hooks/useCart.ts
import { db } from '@/lib/db'
import api from '@/lib/api'

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([])
  
  // 1️⃣ IndexedDB에서 먼저 로드 (즉시 표시)
  useEffect(() => {
    db.cart.toArray().then(setCart)
  }, [])
  
  // 2️⃣ 백그라운드에서 API 동기화
  useEffect(() => {
    api.get('/api/cart').then(async (res) => {
      const serverCart = res.data.data
      await db.cart.clear()
      await db.cart.bulkPut(serverCart)
      setCart(serverCart)
    })
  }, [])
  
  const addToCart = async (item: CartItem) => {
    // IndexedDB 즉시 업데이트 (낙관적 업데이트)
    await db.cart.put(item)
    setCart(await db.cart.toArray())
    
    // 백그라운드 API 동기화
    api.post('/api/cart', item).catch((err) => {
      // 실패 시 롤백
      db.cart.delete(item.id)
    })
  }
  
  return { cart, addToCart }
}
```

**예상 효과:**
- ⚡ **장바구니 로딩 시간**: 300ms → **10ms (97% 개선)**
- 📱 **오프라인 모드**: 장바구니 유지 (재접속 시 동기화)
- 🔄 **API 요청 감소**: 50% (중복 호출 제거)
- 💾 **네트워크 비용 절감**: Cloudflare Workers 요청 ~20% 감소

**비용 영향:**
- 10,000 MAU 기준: **$43.50/월 → $35/월 (약 ₩11,000 절감)**

**구현 우선순위: 🟡 중간**
- 공수: 2일 (구현 1일 + 동기화 로직 1일)
- 효과: UX 개선 + API 호출 감소
- 리스크: 중간 (동기화 충돌 처리 필요)

**📝 주의사항:**
- 서버-클라이언트 데이터 불일치 처리 필요
- 로그아웃 시 IndexedDB 초기화 필수
- 멀티탭 동기화 (BroadcastChannel)

---

### 4. React Query 도입 ⏳ **미구현 (높은 우선순위)**

**현재 상태:**
- ❌ React Query 설치 안 됨
- ✅ Axios 직접 호출 (10+ 곳에서 중복)
- ❌ API 캐시 없음 (매번 서버 요청)
- ❌ 백그라운드 리프레시 없음

**반복 API 호출 현황:**

| API | 호출 위치 | 호출 빈도 | 문제점 |
|-----|----------|----------|--------|
| `/api/cart` | 3곳 | 페이지 진입마다 | 중복 네트워크 요청 |
| `/api/shipping-addresses` | 3곳 | 페이지 진입마다 | 중복 네트워크 요청 |
| `/api/products/:id` | 여러 곳 | 상품 카드마다 | N+1 문제 |
| `/api/streams/:id/viewer-count` | 1곳 | 10초마다 | 폴링 (개선 가능) |

**구현 방안:**

#### A. TanStack Query v5 (추천) - 1-2일 소요

```bash
npm install @tanstack/react-query
```

```typescript
// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5분
      gcTime: 1000 * 60 * 10,   // 10분
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

```typescript
// src/hooks/useCart.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useCart() {
  const queryClient = useQueryClient()
  
  // 장바구니 조회 (자동 캐시)
  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: async () => {
      const res = await api.get('/api/cart')
      return res.data.data
    },
    staleTime: 1000 * 60 * 5 // 5분간 캐시 유효
  })
  
  // 장바구니 추가 (Optimistic Update)
  const addToCart = useMutation({
    mutationFn: (item: CartItem) => api.post('/api/cart', item),
    onMutate: async (newItem) => {
      // 낙관적 업데이트
      await queryClient.cancelQueries({ queryKey: ['cart'] })
      const previous = queryClient.getQueryData(['cart'])
      queryClient.setQueryData(['cart'], (old: any) => [...old, newItem])
      return { previous }
    },
    onError: (err, newItem, context) => {
      // 실패 시 롤백
      queryClient.setQueryData(['cart'], context?.previous)
    },
    onSettled: () => {
      // 완료 후 서버 데이터와 동기화
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    }
  })
  
  return { cart, isLoading, addToCart }
}
```

**예상 효과:**

| 지표 | Before | After | 개선율 |
|------|--------|-------|--------|
| API 중복 호출 | 3회 | 1회 (캐시) | **67% 감소** |
| 장바구니 로딩 | 300ms | 0ms (캐시) | **즉시 표시** |
| 네트워크 요청 | 매번 | 5분마다 | **50% 감소** |
| UX (낙관적 업데이트) | 느림 | 즉시 반응 | **사용자 만족도 ↑** |

**비용 영향:**
- Cloudflare Workers 요청 감소: ~50%
- 10,000 MAU 기준: **$43.50/월 → $22/월 (약 ₩29,000 절감)**

**추가 기능:**
- ✅ 자동 백그라운드 리프레시
- ✅ 윈도우 포커스 시 재검증 (옵션)
- ✅ 에러 재시도 (자동)
- ✅ 무한 스크롤 지원 (`useInfiniteQuery`)
- ✅ DevTools로 캐시 상태 확인

**구현 우선순위: 🔴 높음**
- 공수: 1-2일 (설정 0.5일 + 주요 API 마이그레이션 1일)
- 효과: API 호출 50% 감소 + UX 대폭 개선
- 리스크: 낮음 (React 생태계 표준)

---

### 5. 채팅 메시지 TTL 24시간 삭제 ⏳ **미구현 (낮은 우선순위)**

**현재 상태:**
- ❌ 자동 삭제 없음
- ✅ `limitToLast(50)` 으로 로드 제한
- 📊 Firebase 데이터베이스 누적 증가 중

**문제점:**
1. **오래된 채팅 메시지 누적**: 1년 뒤 수백만 건
2. **Firebase Storage 비용 증가**: 장기적으로 문제
3. **데이터베이스 쿼리 속도 저하**: 인덱스 크기 증가

**구현 방안:**

#### A. Firebase Cloud Functions (서버리스)

```typescript
// functions/index.ts
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

// 매일 오전 4시 실행 (한국 시간 기준)
export const cleanupOldChats = functions
  .region('asia-northeast1')
  .pubsub.schedule('0 4 * * *')
  .timeZone('Asia/Seoul')
  .onRun(async (context) => {
    const db = admin.database()
    const now = Date.now()
    const oneDayAgo = now - (24 * 60 * 60 * 1000)
    
    // 모든 스트림의 채팅 순회
    const chatsRef = db.ref('chats')
    const snapshot = await chatsRef.once('value')
    
    let deletedCount = 0
    const promises: Promise<void>[] = []
    
    snapshot.forEach((streamSnapshot) => {
      streamSnapshot.forEach((messageSnapshot) => {
        const message = messageSnapshot.val()
        
        if (message.timestamp < oneDayAgo) {
          promises.push(messageSnapshot.ref.remove())
          deletedCount++
        }
      })
    })
    
    await Promise.all(promises)
    
    console.log(`✅ Deleted ${deletedCount} old chat messages`)
    return null
  })
```

**배포:**
```bash
npm install -g firebase-tools
firebase init functions
firebase deploy --only functions
```

#### B. Cloudflare Workers Cron (대안)

```typescript
// src/index.tsx
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // 매일 오전 4시 실행
    if (event.cron === '0 4 * * *') {
      const firebaseAdmin = await import('./lib/firebase-admin')
      const db = firebaseAdmin.getDatabase()
      const chatsRef = db.ref('chats')
      
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
      
      // 각 스트림의 오래된 메시지 삭제
      const snapshot = await chatsRef.once('value')
      const deletePromises: Promise<void>[] = []
      
      snapshot.forEach((streamSnapshot: any) => {
        const streamMessages = streamSnapshot.val()
        
        Object.keys(streamMessages).forEach((msgKey) => {
          const message = streamMessages[msgKey]
          if (message.timestamp < oneDayAgo) {
            deletePromises.push(
              db.ref(`chats/${streamSnapshot.key}/${msgKey}`).remove()
            )
          }
        })
      })
      
      await Promise.all(deletePromises)
      console.log(`✅ Cleaned up old chat messages`)
    }
  }
}
```

**wrangler.toml에 Cron 추가:**
```toml
[triggers]
crons = ["0 4 * * *"]  # 매일 오전 4시
```

**예상 효과:**
- 📉 **Firebase Storage 사용량**: 안정화 (누적 방지)
- 💰 **장기 비용 절감**: 1년 후 ~30% 절감 예상
- ⚡ **쿼리 성능 유지**: 데이터 크기 일정 유지

**비용 영향:**
- 단기: 미미 (이미 `limitToLast(50)`)
- 장기 (1년 후): **Firebase 비용 ~30% 절감**

**구현 우선순위: 🟢 낮음**
- 공수: 0.5일 (Firebase Functions 또는 Workers Cron)
- 효과: 장기 비용 안정화
- 리스크: 낮음
- 시급성: 낮음 (현재 `limitToLast`로 로드 제한 중)

---

## 📊 최적화 우선순위 및 로드맵

### Phase 1 (즉시 진행 권장) - 3-4일

| 순위 | 항목 | 공수 | 비용 절감 | UX 개선 | 리스크 |
|------|------|------|----------|---------|--------|
| 🔴 1위 | **React Query 도입** | 1-2일 | ₩29k/월 | ⭐⭐⭐⭐⭐ | 낮음 |
| 🔴 2위 | **Service Worker + PWA** | 2일 | ₩18k/월 | ⭐⭐⭐⭐⭐ | 낮음 |

**합계:**
- 공수: 3-4일
- 월 비용 절감: **₩47,000** (10,000 MAU 기준)
- 연 비용 절감: **₩564,000**
- UX 개선: 로딩 속도 80% 향상 + 오프라인 지원

### Phase 2 (1-2개월 후) - 2.5일

| 순위 | 항목 | 공수 | 비용 절감 | UX 개선 | 리스크 |
|------|------|------|----------|---------|--------|
| 🟡 3위 | **IndexedDB 장바구니** | 2일 | ₩11k/월 | ⭐⭐⭐⭐ | 중간 |
| 🟢 4위 | **채팅 TTL 24시간** | 0.5일 | 장기 30% | ⭐ | 낮음 |

**합계:**
- 공수: 2.5일
- 월 비용 절감: **₩11,000** (즉시) + 장기 안정화
- 동기화 로직 주의 필요

---

## 💰 총 예상 비용 절감 (10,000 MAU 기준)

### Before (현재 Phase 1 최적화 후)
- 월 인프라 비용: **₩267,000**
  - Cloudflare Workers: $43.50 (₩57,700)
  - Firebase Realtime DB: $87 (₩115,400) ← 이미 70% 절감됨
  - Sentry: $29 (₩38,500)
  - 기타: $50 (₩66,300)

### After (Phase 1 + Phase 2 완료 후)
- 월 인프라 비용: **₩209,000** (22% 추가 절감)
  - Cloudflare Workers: $22 (₩29,200) ← React Query로 50% 감소
  - Firebase Realtime DB: $87 (₩115,400) ← 유지
  - Sentry: $29 (₩38,500) ← 유지
  - 기타: $20 (₩26,500) ← IndexedDB로 감소

**총 절감:**
- 월: **₩58,000 절감**
- 연: **₩696,000 절감**
- 비율: **22% 추가 절감**

**Phase 0 (최적화 전) 대비:**
- 최초 월 비용: ₩537,000
- 현재 Phase 1: ₩267,000 (50% 절감)
- 최종 Phase 2: ₩209,000 (61% 절감)

---

## 🎯 권장 실행 계획

### ✅ 즉시 실행 (이번 주)
1. **React Query 도입** (1-2일)
   - 주요 API (장바구니, 배송지, 상품 상세) 마이그레이션
   - Optimistic Update 적용
   - DevTools 설치

2. **Service Worker + PWA** (2일)
   - vite-plugin-pwa 설정
   - 오프라인 페이지 추가
   - 홈 화면 추가 프롬프트

### ⏳ 다음 달 실행
3. **IndexedDB 장바구니** (2일)
   - Dexie.js 설정
   - 장바구니·배송지 오프라인 저장
   - 동기화 로직 구현

4. **채팅 TTL 삭제** (0.5일)
   - Firebase Cloud Function 또는 Workers Cron
   - 24시간 이전 메시지 자동 삭제
   - 로그 모니터링

---

## 📝 주의사항 및 리스크

### React Query
- ⚠️ **staleTime 설정 중요**: 너무 길면 최신 데이터 표시 안 됨
- ⚠️ **장바구니 카운트**: 여러 컴포넌트에서 사용 → `useQueryClient` 주의
- ✅ **마이그레이션 점진적**: 한 번에 모든 API 변경하지 말고 단계적으로

### Service Worker
- ⚠️ **캐시 버전 관리**: 새 배포 시 캐시 무효화 전략 필요
- ⚠️ **HTTPS 필수**: localhost 외 모든 환경에서 HTTPS 필수
- ⚠️ **개발 모드**: Service Worker 비활성화 옵션 제공

### IndexedDB
- ⚠️ **동기화 충돌**: 서버-클라이언트 데이터 불일치 시 우선순위 정의
- ⚠️ **로그아웃 시 삭제**: 개인정보 보호 (다른 사용자 로그인 시)
- ⚠️ **멀티탭 동기화**: BroadcastChannel API 사용 고려

### 채팅 TTL
- ⚠️ **중요 메시지 보존**: 시스템 알림, 공지사항 예외 처리
- ⚠️ **Firebase Functions 비용**: 실행당 $0.0000004 (무시 가능)
- ✅ **Cron 실행 모니터링**: Sentry로 실패 알림 설정

---

## 🎓 학습 리소스

### React Query
- 공식 문서: https://tanstack.com/query/latest
- 튜토리얼: https://ui.dev/react-query-tutorial
- 예제: Optimistic Updates, Infinite Scroll

### Service Worker + PWA
- vite-plugin-pwa: https://vite-pwa-org.netlify.app/
- Workbox 전략: https://developer.chrome.com/docs/workbox/
- PWA 체크리스트: https://web.dev/pwa-checklist/

### IndexedDB
- Dexie.js: https://dexie.org/
- IndexedDB 가이드: https://web.dev/indexeddb/
- 동기화 패턴: https://rxdb.info/offline-first.html

---

## 🔍 결론

### ✅ 이미 완료됨
- Firebase 채팅 `limitToLast(50)` ✅
- Phase 1 최적화 (비용 50% 절감) ✅

### 🔴 즉시 권장
1. **React Query** - API 호출 50% 감소 + UX 개선
2. **Service Worker + PWA** - 오프라인 지원 + 로딩 속도 80% 향상

### 🟡 다음 단계
3. IndexedDB 장바구니 - 오프라인 장바구니 유지
4. 채팅 TTL 삭제 - 장기 비용 안정화

**총 효과 (Phase 2 완료 시):**
- 📉 비용: 최초 대비 **61% 절감** (₩537k → ₩209k)
- ⚡ 속도: 로딩 시간 **80% 개선**
- 📱 UX: 오프라인 지원 + 앱 느낌
- 🎯 전환율: **5-10% 향상 예상**

---

**작성일**: 2026-03-02  
**작성자**: AI Assistant  
**버전**: 1.0
