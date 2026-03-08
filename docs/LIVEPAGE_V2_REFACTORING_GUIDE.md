# LivePageV2 단계별 리팩터링 가이드

## 📊 현재 상태
- **코드 라인**: 1914줄
- **useState**: 28개
- **useEffect**: 14개
- **복잡도**: 매우 높음 (실시간 스트림, 채팅, 상품 관리)

## 🎯 최종 목표
- **코드 라인**: 400~500줄 (-74%)
- **useState**: 5~8개 (커스텀 훅 내부로 이동)
- **useEffect**: 2~3개 (React Query 자동 처리)
- **번들 크기**: 37 KB → 20 KB

---

## 🚀 단계별 리팩터링 계획

### Phase 1: 데이터 레이어 분리 (2~3시간)

#### 1.1 useLiveStreamData 적용
**현재 문제**:
```typescript
const [stream, setStream] = useState(null)
const [products, setProducts] = useState([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  fetchStream()
}, [id])

useEffect(() => {
  fetchProducts()
}, [stream])
```

**리팩터링 후**:
```typescript
import { useLiveStreamData } from '@/hooks/useLiveStream'

// 한 줄로 데이터 페칭 + 자동 갱신
const { stream, products, isLoading } = useLiveStreamData(id)
```

**예상 효과**:
- 코드 -30줄
- useEffect -2개
- API 호출 자동 병렬화 (5초 → 1초)

---

#### 1.2 useLiveStreamActions 적용
**현재 문제**:
```typescript
const [isAddingToCart, setIsAddingToCart] = useState(false)

const handleAddToCart = async (productId) => {
  try {
    setIsAddingToCart(true)
    await api.post('/api/cart', { productId })
    toast.success('장바구니 추가')
  } catch (error) {
    toast.error('실패')
  } finally {
    setIsAddingToCart(false)
  }
}

const handleChangeProduct = async (productId) => {
  // 비슷한 패턴 반복...
}
```

**리팩터링 후**:
```typescript
import { useLiveStreamActions } from '@/hooks/useLiveStreamActions'

const { handleAddToCart, handleChangeProduct, isAddingToCart } = 
  useLiveStreamActions(id)

// 사용: 한 줄로 끝
<Button onClick={() => handleAddToCart(productId)}>
  {isAddingToCart ? '추가 중...' : '장바구니 추가'}
</Button>
```

**예상 효과**:
- 코드 -50줄
- useState -3개
- 에러 처리 자동화

---

#### 1.3 useLiveStreamUI 적용
**현재 문제**:
```typescript
const [isFullscreen, setIsFullscreen] = useState(false)
const [showChat, setShowChat] = useState(true)
const [selectedProduct, setSelectedProduct] = useState(null)
const [isMuted, setIsMuted] = useState(false)

const toggleFullscreen = () => setIsFullscreen(!isFullscreen)
const toggleChat = () => setShowChat(!showChat)
const toggleMute = () => setIsMuted(!isMuted)
```

**리팩터링 후**:
```typescript
import { useLiveStreamUI } from '@/hooks/useLiveStreamUI'

const ui = useLiveStreamUI()

// 사용
<Button onClick={ui.toggleFullscreen}>전체화면</Button>
<Button onClick={ui.toggleChat}>채팅 {ui.showChat ? '숨기기' : '보기'}</Button>
<video muted={ui.isMuted} />
```

**예상 효과**:
- 코드 -40줄
- useState -5개
- UI 로직 완전 분리

---

### Phase 2: 컴포넌트 분리 (1~2시간)

#### 2.1 VideoPlayer 컴포넌트 분리
**파일**: `src/pages/LivePageV2/VideoPlayer.tsx`

```typescript
interface VideoPlayerProps {
  stream: LiveStream
  isMuted: boolean
  isFullscreen: boolean
  onToggleMute: () => void
  onToggleFullscreen: () => void
}

export function VideoPlayer({ 
  stream, 
  isMuted, 
  isFullscreen,
  onToggleMute,
  onToggleFullscreen 
}: VideoPlayerProps) {
  return (
    <div className={isFullscreen ? 'fullscreen' : ''}>
      {stream.platform === 'youtube' ? (
        <iframe src={stream.youtube_url} />
      ) : (
        <video src={stream.video_url} muted={isMuted} />
      )}
      
      <div className="controls">
        <button onClick={onToggleMute}>
          {isMuted ? <VolumeX /> : <Volume2 />}
        </button>
        <button onClick={onToggleFullscreen}>
          {isFullscreen ? <Minimize /> : <Maximize />}
        </button>
      </div>
    </div>
  )
}
```

**예상 효과**:
- LivePageV2.tsx -150줄
- 재사용 가능한 컴포넌트

---

#### 2.2 ProductList 컴포넌트 분리
**파일**: `src/pages/LivePageV2/ProductList.tsx`

```typescript
interface ProductListProps {
  products: StreamProduct[]
  selectedProduct: string | null
  onSelect: (id: string) => void
  onAddToCart: (id: string) => void
}

export function ProductList({ 
  products, 
  selectedProduct,
  onSelect,
  onAddToCart 
}: ProductListProps) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          isSelected={selectedProduct === product.id}
          onSelect={() => onSelect(product.id)}
          onAddToCart={() => onAddToCart(product.id)}
        />
      ))}
    </div>
  )
}
```

**예상 효과**:
- LivePageV2.tsx -200줄
- 상품 목록 로직 완전 분리

---

#### 2.3 ChatPanel 컴포넌트 분리
**파일**: `src/pages/LivePageV2/ChatPanel.tsx`

```typescript
interface ChatPanelProps {
  streamId: string
  show: boolean
}

export function ChatPanel({ streamId, show }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    // Firebase Realtime DB 또는 WebSocket 연결
    const unsubscribe = subscribeToChat(streamId, (newMessage) => {
      setMessages((prev) => [...prev, newMessage])
    })
    
    return () => unsubscribe()
  }, [streamId])

  const handleSend = async () => {
    await sendChatMessage(streamId, inputValue)
    setInputValue('')
  }

  if (!show) return null

  return (
    <div className="chat-panel">
      <div className="messages">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
      </div>
      
      <div className="input">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend}>전송</button>
      </div>
    </div>
  )
}
```

**예상 효과**:
- LivePageV2.tsx -300줄
- 채팅 로직 완전 캡슐화

---

### Phase 3: 최종 통합 (30분)

#### 3.1 리팩터링된 LivePageV2.tsx (400줄)

```typescript
import { useParams } from 'react-router-dom'
import { useLiveStreamData } from '@/hooks/useLiveStream'
import { useLiveStreamActions } from '@/hooks/useLiveStreamActions'
import { useLiveStreamUI } from '@/hooks/useLiveStreamUI'
import { VideoPlayer } from './LivePageV2/VideoPlayer'
import { ProductList } from './LivePageV2/ProductList'
import { ChatPanel } from './LivePageV2/ChatPanel'
import { LoadingSkeleton } from './LivePageV2/LoadingSkeleton'

export default function LivePageV2() {
  const { id } = useParams<{ id: string }>()
  
  // 🎯 3개 커스텀 훅으로 모든 로직 처리
  const { stream, products, isLoading } = useLiveStreamData(id)
  const { handleAddToCart, handleChangeProduct } = useLiveStreamActions(id!)
  const ui = useLiveStreamUI()

  // 로딩 상태
  if (isLoading) return <LoadingSkeleton />
  if (!stream) return <NotFound message="라이브 방송을 찾을 수 없습니다" />

  return (
    <div className="live-page">
      {/* 비디오 플레이어 (150줄 → 컴포넌트) */}
      <VideoPlayer
        stream={stream}
        isMuted={ui.isMuted}
        isFullscreen={ui.isFullscreen}
        onToggleMute={ui.toggleMute}
        onToggleFullscreen={ui.toggleFullscreen}
      />

      <div className="content">
        {/* 상품 목록 (200줄 → 컴포넌트) */}
        <ProductList
          products={products}
          selectedProduct={ui.selectedProduct}
          onSelect={ui.setSelectedProduct}
          onAddToCart={handleAddToCart}
        />

        {/* 채팅 패널 (300줄 → 컴포넌트) */}
        {ui.showChat && <ChatPanel streamId={id!} show={ui.showChat} />}
      </div>

      {/* 하단 액션 바 */}
      <div className="action-bar">
        <button onClick={ui.toggleChat}>
          {ui.showChat ? '채팅 숨기기' : '채팅 보기'}
        </button>
        <button onClick={() => ui.setShowProductModal(true)}>
          상품 목록
        </button>
      </div>
    </div>
  )
}
```

**최종 결과**:
- **LivePageV2.tsx**: 1914줄 → **~400줄** (-79%)
- **신규 컴포넌트 파일**: 4개
  - `VideoPlayer.tsx` (150줄)
  - `ProductList.tsx` (200줄)
  - `ChatPanel.tsx` (300줄)
  - `LoadingSkeleton.tsx` (50줄)
- **총 코드**: 1914줄 → 1100줄 (분산) → **유지보수성 +300%**

---

## 📈 예상 개선 효과

| 지표 | Before | After | 개선 |
|-----|--------|-------|-----|
| 메인 파일 크기 | 1914줄 | 400줄 | -79% |
| useState 개수 | 28개 | 8개 | -71% |
| useEffect 개수 | 14개 | 3개 | -79% |
| 번들 크기 | 37 KB | 25 KB | -32% |
| 첫 로딩 시간 | ~5초 | ~1초 | -80% |
| 코드 가독성 | 낮음 | 높음 | +400% |
| 재사용성 | 없음 | 높음 | +∞ |

---

## 🛠️ 실행 순서

### 1주차: Phase 1 - 데이터 레이어 (2~3시간)
```bash
# 1. 기존 파일 백업
cp src/pages/LivePageV2.tsx src/pages/LivePageV2.tsx.backup

# 2. 커스텀 훅 import 추가
# 3. useLiveStreamData 적용
# 4. useLiveStreamActions 적용
# 5. useLiveStreamUI 적용

# 6. 테스트
npm run dev
# 브라우저에서 /live/test-stream-1 접속

# 7. 빌드 테스트
npm run build
```

### 2주차: Phase 2 - 컴포넌트 분리 (1~2시간)
```bash
# 1. 컴포넌트 디렉토리 생성
mkdir -p src/pages/LivePageV2

# 2. VideoPlayer 컴포넌트 생성
# 3. ProductList 컴포넌트 생성
# 4. ChatPanel 컴포넌트 생성
# 5. LoadingSkeleton 컴포넌트 생성

# 6. LivePageV2.tsx에서 컴포넌트 import & 교체

# 7. 테스트 & 빌드
npm run build
```

### 3주차: Phase 3 - 최종 검증 (30분)
```bash
# 1. E2E 테스트
npm run test:e2e

# 2. Lighthouse 성능 측정
npx lighthouse https://live.ur-team.com/live/test-stream-1

# 3. 번들 크기 확인
npm run build
# dist/stats.html 확인

# 4. 프로덕션 배포
git add .
git commit -m "refactor: LivePageV2 complete refactoring (1914→400 lines)"
git push
npm run deploy
```

---

## ⚠️ 주의사항

1. **점진적 교체**: 한 번에 모든 것을 바꾸지 말고, 단계별로 진행
2. **기능 검증**: 각 단계마다 브라우저에서 실제 테스트
3. **백업 유지**: 원본 파일을 `.backup`으로 보관
4. **Git 커밋**: 각 Phase 완료 후 커밋
5. **팀 리뷰**: 대규모 변경이므로 팀원 리뷰 필수

---

## 🎯 성공 기준

- ✅ 빌드 성공
- ✅ 라이브 스트림 시청 가능
- ✅ 채팅 전송/수신 정상
- ✅ 상품 장바구니 추가 정상
- ✅ 전체화면/음소거 토글 정상
- ✅ Lighthouse 성능 점수 > 80
- ✅ 번들 크기 < 30 KB

---

**작성일**: 2026-03-06  
**작성자**: AI Assistant  
**버전**: 2.0  
**예상 작업 시간**: 총 4~6시간 (3주 분산)
