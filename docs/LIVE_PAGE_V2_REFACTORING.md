# LivePageV2 리팩터링 가이드

## 📊 현재 상태 (2026-03-07 최종)

### 복잡도 분석
```
파일: src/pages/LivePageV2.tsx
라인 수: 1,914 줄 (유지)
useState: 28개
useEffect: 14개
Firebase 훅: useFirebaseChat, useFirebaseStream (이미 최적화됨)
실시간 기능: Firebase Chat, YouTube Player
```

### ✅ 완료된 작업 (Phase 2 완료 - 컴포넌트 라이브러리)
- **5개 재사용 가능한 컴포넌트 생성 완료**
  - `src/components/live/LiveStreamPlayer.tsx` (88줄)
  - `src/components/live/LiveStreamInfo.tsx` (86줄)
  - `src/components/live/LiveProductCard.tsx` (138줄)
  - `src/components/live/LiveProductList.tsx` (96줄)
  - `src/components/live/LiveChatPanel.tsx` (185줄)
- **테스트 작성 완료**
  - 유닛 테스트: LiveProductCard.test.tsx (8개 테스트)
  - 총 테스트 수: 56개 (모두 통과 ✅)
- **문서화 완료**
  - `docs/LIVE_PAGE_COMPONENT_USAGE.md` (사용 가이드)

### 주요 결론
1. **LivePageV2는 너무 복잡함** (1,914줄을 500줄로 줄이는 것은 비현실적)
2. **Firebase는 이미 최적화됨** (useFirebaseChat, useFirebaseStream 사용 중)
3. **실용적 접근: 재사용 가능한 컴포넌트 라이브러리 구축** ✅
4. **전체 리팩터링은 다음 대규모 스프린트(1주일+)로 연기**
5. **현재 코드는 안정적이며 빌드·테스트 모두 통과**

---

## 🎯 리팩터링 목표

| 항목 | 현재 | 목표 | 효과 |
|---|---|---|---|
| **코드 라인** | 1,914 줄 | 500 줄 | -74% |
| **useState** | 28개 | 8개 | -71% |
| **useEffect** | 14개 | 3개 | -79% |
| **컴포넌트** | 1개 | 10개 | +900% |
| **API 호출** | 순차 5 s | 병렬 1 s | -80% |
| **번들 크기** | 37 KB | 20 KB | -46% |
| **테스트 커버리지** | 0% | 70%+ | +∞ |

---

## 🚀 3단계 리팩터링 계획

### Phase 1: 커스텀 훅 분리 (1-2시간) ⭐ 최우선

이미 생성된 훅:
- ✅ `src/hooks/useLiveStream.ts` - 스트림 데이터 관리
- ✅ `src/hooks/useLiveStreamActions.ts` - 장바구니, 상품 변경
- ✅ `src/hooks/useLiveStreamUI.ts` - UI 상태 관리

**적용 방법:**
```typescript
// LivePageV2.tsx에 적용
import { useLiveStream, useStreamProducts } from '@/hooks/useLiveStream'
import { useAddToCart } from '@/hooks/useLiveStreamActions'
import { useLiveStreamUI } from '@/hooks/useLiveStreamUI'

export default function LivePageV2() {
  const { streamId } = useParams()
  
  // ✅ React Query로 자동 캐싱 및 리패칭
  const { data: stream, isLoading: streamLoading } = useLiveStream(streamId!)
  const { data: products, isLoading: productsLoading } = useStreamProducts(streamId!)
  const addToCartMutation = useAddToCart()
  const { showChat, toggleChat } = useLiveStreamUI()
  
  // ... 나머지 로직
}
```

---

### Phase 2: 컴포넌트 분리 (2-3시간)

#### 2.1. 디렉토리 구조
```
src/components/live/
├── LiveStreamPlayer.tsx       (← YouTube/비디오 플레이어)
├── LiveStreamInfo.tsx         (← 스트림 제목, 판매자 정보)
├── LiveProductCard.tsx        (← 현재 상품 카드)
├── LiveProductList.tsx        (← 상품 목록)
├── LiveChatPanel.tsx          (← 채팅 패널)
├── LiveChatMessage.tsx        (← 개별 채팅 메시지)
├── LiveControlPanel.tsx       (← 판매자 컨트롤)
└── LiveViewerCounter.tsx      (← 시청자 카운터)
```

#### 2.2. LiveStreamPlayer 컴포넌트
```typescript
// src/components/live/LiveStreamPlayer.tsx
import YouTube from 'react-youtube'

interface LiveStreamPlayerProps {
  youtubeVideoId?: string
  tiktokUsername?: string
  isFullscreen: boolean
}

export function LiveStreamPlayer({ 
  youtubeVideoId, 
  tiktokUsername,
  isFullscreen
}: LiveStreamPlayerProps) {
  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      controls: 1,
      rel: 0,
      modestbranding: 1,
    },
  }
  
  if (youtubeVideoId) {
    return (
      <div className="live-player-container">
        <YouTube videoId={youtubeVideoId} opts={opts} />
      </div>
    )
  }
  
  if (tiktokUsername) {
    return (
      <iframe
        src={`https://www.tiktok.com/@${tiktokUsername}/live`}
        className="live-tiktok-player"
        allowFullScreen
      />
    )
  }
  
  return <div className="live-player-placeholder">스트림을 불러오는 중...</div>
}
```

#### 2.3. LiveProductCard 컴포넌트
```typescript
// src/components/live/LiveProductCard.tsx
import { ShoppingCart } from 'lucide-react'

interface LiveProductCardProps {
  product: {
    id: string
    name: string
    price: number
    originalPrice?: number
    image: string
    discountRate?: number
  }
  onAddToCart: (productId: string) => void
  isLoading?: boolean
}

export function LiveProductCard({ product, onAddToCart, isLoading }: LiveProductCardProps) {
  return (
    <div className="live-product-card">
      <img src={product.image} alt={product.name} />
      
      <div className="live-product-info">
        <h3>{product.name}</h3>
        
        <div className="live-product-price">
          {product.discountRate && (
            <span className="discount-badge">{product.discountRate}%</span>
          )}
          {product.originalPrice && (
            <span className="original-price">{product.originalPrice.toLocaleString()}원</span>
          )}
          <span className="current-price">{product.price.toLocaleString()}원</span>
        </div>
        
        <button 
          className="add-to-cart-btn"
          onClick={() => onAddToCart(product.id)}
          disabled={isLoading}
        >
          <ShoppingCart size={20} />
          {isLoading ? '추가 중...' : '장바구니'}
        </button>
      </div>
    </div>
  )
}
```

---

### Phase 3: 리팩터링된 LivePageV2 (최종 형태)

```typescript
// src/pages/LivePageV2.tsx (리팩터링 후 ~500 줄)
import { useLiveStream, useStreamProducts } from '@/hooks/useLiveStream'
import { useAddToCart, useChangeCurrentProduct } from '@/hooks/useLiveStreamActions'
import { useLiveStreamUI } from '@/hooks/useLiveStreamUI'
import { LiveStreamPlayer } from '@/components/live/LiveStreamPlayer'
import { LiveProductCard } from '@/components/live/LiveProductCard'
import { LiveChatPanel } from '@/components/live/LiveChatPanel'

export default function LivePageV2() {
  const { streamId } = useParams()
  
  // 🎯 데이터 관리 (React Query로 통합)
  const { data: stream, isLoading: streamLoading, error } = useLiveStream(streamId!)
  const { data: products, isLoading: productsLoading } = useStreamProducts(streamId!)
  const addToCartMutation = useAddToCart()
  const { showChat, showProducts, toggleChat, toggleProducts } = useLiveStreamUI()
  
  // 🎯 에러 처리
  if (error) {
    return <ErrorView error={error} />
  }
  
  // 🎯 로딩 처리
  if (streamLoading || productsLoading) {
    return <LoadingView />
  }
  
  const currentProduct = products?.[0]
  
  // 🎯 메인 렌더링
  return (
    <div className="live-page">
      {/* 비디오 플레이어 */}
      <LiveStreamPlayer
        youtubeVideoId={stream?.youtube_video_id}
        tiktokUsername={stream?.tiktok_username}
        isFullscreen={false}
      />
      
      {/* 스트림 정보 */}
      <LiveStreamInfo
        title={stream?.title}
        sellerName={stream?.seller_name}
        viewerCount={stream?.viewer_count}
      />
      
      {/* 현재 상품 */}
      {currentProduct && (
        <LiveProductCard
          product={currentProduct}
          onAddToCart={(id) => addToCartMutation.mutate({ product_id: id, quantity: 1 })}
          isLoading={addToCartMutation.isPending}
        />
      )}
      
      {/* 상품 목록 */}
      {showProducts && (
        <LiveProductList products={products || []} />
      )}
      
      {/* 채팅 패널 */}
      <LiveChatPanel
        streamId={streamId!}
        isVisible={showChat}
        onToggle={toggleChat}
      />
    </div>
  )
}
```

**코드 감소**: 1,914 줄 → **약 500 줄** (-74%)

---

## 📋 작업 체크리스트

### Phase 1: 커스텀 훅 적용 (30분)
- [x] useLiveStream.ts 작성 완료
- [x] useLiveStreamActions.ts 작성 완료
- [x] useLiveStreamUI.ts 작성 완료
- [ ] LivePageV2에 실제 적용
- [ ] 기존 API 호출 제거
- [ ] 빌드 테스트

### Phase 2: 컴포넌트 분리 (2-3시간)
- [ ] LiveStreamPlayer.tsx 작성
- [ ] LiveStreamInfo.tsx 작성
- [ ] LiveProductCard.tsx 작성
- [ ] LiveProductList.tsx 작성
- [ ] LiveChatPanel.tsx 작성
- [ ] LiveChatMessage.tsx 작성
- [ ] LiveControlPanel.tsx 작성 (판매자 전용)
- [ ] LiveViewerCounter.tsx 작성

### Phase 3: 통합 및 테스트 (1시간)
- [ ] LivePageV2.tsx 리팩터링 (500줄로 축소)
- [ ] TypeScript 타입 에러 수정
- [ ] 빌드 성공 확인
- [ ] 기능 테스트 (장바구니, 채팅, 상품 변경)
- [ ] 성능 측정 (Lighthouse)

### Phase 4: 최적화 및 문서화 (1시간)
- [ ] React.memo 적용
- [ ] useCallback 최적화
- [ ] 번들 크기 측정
- [ ] 단위 테스트 작성
- [ ] E2E 테스트 작성 (live-shopping.cy.ts)

---

## 🎯 예상 성능 개선

| 메트릭 | 개선 전 | 개선 후 | 효과 |
|---|---|---|---|
| **초기 로딩** | 2.5 s | 1.0 s | -60% |
| **API 병렬화** | 5 s | 1 s | -80% |
| **번들 크기** | 37 KB | 20 KB | -46% |
| **렌더링 최적화** | 없음 | React.memo | +50% |
| **캐시 적중률** | 0% | 90% | +∞ |
| **유지보수성** | 매우 낮음 | 높음 | +300% |

---

## 💡 주의사항

1. **Firebase 실시간 채팅**: `useFirebaseChat` 훅은 이미 최적화됨
2. **YouTube Player**: `react-youtube` 라이브러리 사용
3. **TikTok Embed**: iframe 사용, CORS 문제 가능성
4. **판매자 권한**: `stream.is_seller` 플래그로 판별
5. **실시간 업데이트**: 10초마다 `refetchInterval`로 자동 갱신

---

## 🚨 Breaking Changes

이 리팩터링은 **대규모 변경**이므로:
1. 별도 브랜치에서 작업 (`feature/refactor-live-page-v2`)
2. 단계별 PR 생성 (Phase 1, 2, 3 각각)
3. QA 팀 리뷰 필수
4. Staging 환경 테스트 후 배포
5. 롤백 계획 준비

---

## 📚 참고 자료

- [React Query - Parallel Queries](https://tanstack.com/query/latest/docs/react/guides/parallel-queries)
- [Component Composition](https://kentcdodds.com/blog/compound-components-with-react-hooks)
- [YouTube API - React](https://github.com/tjallingt/react-youtube)
- [Firebase Realtime Database](https://firebase.google.com/docs/database)

---

## 🎉 완료 후 기대 효과

1. **개발 속도 향상**: 새 기능 추가 시 50% 빠름
2. **버그 감소**: 단위 테스트로 90% 버그 사전 방지
3. **성능 개선**: 사용자 체감 로딩 시간 60% 단축
4. **유지보수성**: 신규 개발자 온보딩 70% 단축
5. **확장성**: 라이브 커머스 v3 기능 추가 용이
