# LivePageV2 컴포넌트 통합 가이드

## 📦 생성된 컴포넌트 (5개)

### 1. LiveStreamPlayer
YouTube 플레이어 컴포넌트
```tsx
import { LiveStreamPlayer } from '@/components/live/LiveStreamPlayer'

<LiveStreamPlayer
  youtubeVideoId="dQw4w9WgXcQ"
  isFullscreen={false}
  onPlayerReady={(event) => console.log('Player ready', event)}
/>
```

### 2. LiveStreamInfo
스트림 정보 (제목, 스트리머, 시청자 수)
```tsx
import { LiveStreamInfo } from '@/components/live/LiveStreamInfo'

<LiveStreamInfo
  title="🔥 특가 세일 라이브!"
  streamerName="판매왕"
  streamerAvatar="/avatar.jpg"
  viewerCount={1234}
  onShare={() => console.log('Share clicked')}
/>
```

### 3. LiveProductCard
개별 상품 카드
```tsx
import { LiveProductCard } from '@/components/live/LiveProductCard'

<LiveProductCard
  product={{
    id: 1,
    name: "상품명",
    price: 29900,
    originalPrice: 39900,
    image: "/product.jpg",
    rating: 4.5,
    sold: 1234,
    stock: 50
  }}
  onAddToCart={(id) => console.log('Add to cart', id)}
  isAddingToCart={false}
/>
```

### 4. LiveProductList
상품 목록 (그리드)
```tsx
import { LiveProductList } from '@/components/live/LiveProductList'

<LiveProductList
  products={products}
  currentProductId={1}
  onAddToCart={(id) => console.log('Add to cart', id)}
  onSelectProduct={(id) => console.log('Select product', id)}
  isAddingToCart={false}
/>
```

### 5. LiveChatPanel
실시간 채팅 패널
```tsx
import { LiveChatPanel } from '@/components/live/LiveChatPanel'

<LiveChatPanel
  streamId="stream-123"
  messages={[
    { id: '1', username: '유저1', message: '안녕하세요!', timestamp: Date.now() }
  ]}
  onSendMessage={(msg) => console.log('Send', msg)}
  isVisible={true}
  onToggle={() => setShowChat(!showChat)}
  currentUsername="내이름"
/>
```

---

## 🎯 LivePageV2 통합 예시

```tsx
// src/pages/LivePageV2.tsx (리팩터링 후)
import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useFirebaseChat } from '@/hooks/useFirebaseChat'
import { useFirebaseStream, useFirebaseProduct } from '@/hooks/useFirebaseStream'
import { LiveStreamPlayer } from '@/components/live/LiveStreamPlayer'
import { LiveStreamInfo } from '@/components/live/LiveStreamInfo'
import { LiveProductCard } from '@/components/live/LiveProductCard'
import { LiveProductList } from '@/components/live/LiveProductList'
import { LiveChatPanel } from '@/components/live/LiveChatPanel'

export default function LivePageV2() {
  const { streamId } = useParams<{ streamId: string }>()
  const [showChat, setShowChat] = useState(true)
  const [showProductList, setShowProductList] = useState(false)
  
  // 🔥 Firebase 실시간 데이터
  const stream = useFirebaseStream(streamId!)
  const currentProduct = useFirebaseProduct(streamId!)
  const { messages, sendMessage } = useFirebaseChat(streamId!)
  
  // 장바구니 추가
  const handleAddToCart = async (productId: number) => {
    try {
      await api.post('/api/cart', { 
        product_id: productId, 
        quantity: 1 
      })
      alert('장바구니에 추가되었습니다!')
    } catch (error) {
      console.error('Add to cart failed:', error)
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 1. 비디오 플레이어 */}
      <LiveStreamPlayer
        youtubeVideoId={stream?.youtube_video_id}
        className="w-full"
      />
      
      {/* 2. 스트림 정보 */}
      <LiveStreamInfo
        title={stream?.title || '로딩 중...'}
        streamerName={stream?.streamerName || ''}
        streamerAvatar={stream?.streamerAvatar}
        viewerCount={stream?.viewerCount || 0}
        onShare={() => navigator.share?.({ url: window.location.href })}
      />
      
      {/* 3. 현재 상품 */}
      {currentProduct && (
        <div className="p-4">
          <h2 className="text-lg font-bold mb-3">지금 판매 중인 상품</h2>
          <LiveProductCard
            product={currentProduct}
            onAddToCart={handleAddToCart}
          />
        </div>
      )}
      
      {/* 4. 상품 목록 토글 버튼 */}
      <div className="p-4">
        <button
          onClick={() => setShowProductList(!showProductList)}
          className="w-full py-3 bg-white border border-gray-300 rounded-lg font-medium"
        >
          {showProductList ? '상품 목록 숨기기' : '전체 상품 보기'}
        </button>
      </div>
      
      {/* 5. 전체 상품 목록 */}
      {showProductList && (
        <LiveProductList
          products={stream?.products || []}
          currentProductId={currentProduct?.id}
          onAddToCart={handleAddToCart}
          onSelectProduct={(id) => console.log('Select', id)}
        />
      )}
      
      {/* 6. 채팅 패널 (플로팅) */}
      <div className="fixed bottom-4 right-4 w-80">
        <LiveChatPanel
          streamId={streamId!}
          messages={messages}
          onSendMessage={sendMessage}
          isVisible={showChat}
          onToggle={() => setShowChat(!showChat)}
          currentUsername="사용자"
        />
      </div>
    </div>
  )
}
```

---

## 📊 리팩터링 효과

| 항목 | 기존 | 리팩터링 후 | 개선율 |
|---|---|---|---|
| **코드 라인** | 1,914줄 | ~400줄 | **-79%** |
| **컴포넌트** | 1개 | 6개 | **+500%** |
| **useState** | 28개 | ~8개 | **-71%** |
| **useEffect** | 14개 | ~3개 | **-79%** |
| **재사용성** | 없음 | 매우 높음 | **+∞** |
| **테스트 가능** | 불가능 | 가능 | **+∞** |

---

## 💡 다음 단계

### 즉시 작업 가능
1. ✅ **컴포넌트 생성 완료** (5개)
2. ⏳ **LivePageV2 실제 적용** (별도 브랜치 권장)
3. ⏳ **단위 테스트 작성**
4. ⏳ **Storybook 추가** (컴포넌트 문서화)

### 별도 브랜치 작업 권장
```bash
git checkout -b feature/refactor-live-page-v2
# LivePageV2 전체 리팩터링 진행
# 테스트 완료 후 main에 병합
```

---

## 🚨 주의사항

1. **Firebase 훅 유지**: `useFirebaseChat`, `useFirebaseStream`은 이미 최적화됨
2. **점진적 적용**: 한 번에 모든 코드를 변경하지 말고 단계별로 진행
3. **테스트 필수**: 각 컴포넌트 변경 후 반드시 테스트
4. **백업**: 기존 LivePageV2.tsx를 LivePageV2.backup.tsx로 백업

---

## 📚 참고 자료

- **컴포넌트 위치**: `src/components/live/`
- **사용 예시**: 위 코드 참조
- **전체 가이드**: `docs/LIVE_PAGE_V2_REFACTORING.md`
