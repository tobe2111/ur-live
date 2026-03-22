# LivePageV2 아키텍처 정의 문서

## 📋 현재 상황 파악

### 사용 중인 페이지
- **LivePageV2.tsx**: 유일하게 사용 중인 라이브 페이지 (`/live/:streamId`)
- **LivePage.tsx**: 더 이상 사용하지 않음 (제거 예정)

### 라우팅 구조
```typescript
// src/App.tsx
<Route path="/live/:streamId" element={<LivePageV2 />} />
```

## 🎯 LivePageV2의 정의

### 1. **페이지 타입: 세로 스크롤 Reels 스타일**

LivePageV2는 **TikTok/Instagram Reels 스타일의 세로 스크롤 페이지**입니다:

```typescript
// 핵심 구조 (라인 1677-1695)
<div className="h-dvh w-full overflow-y-scroll snap-y snap-mandatory">
  {reels.map((reel, index) => (
    <div className="h-dvh w-full snap-start snap-always">
      <ReelCard reel={reel} isActive={activeIndex === index} />
    </div>
  ))}
</div>
```

**특징:**
- ✅ **세로 스크롤** (`overflow-y-scroll`)
- ✅ **스냅 스크롤** (`snap-y snap-mandatory`)
- ✅ **전체 화면 Reels** (각 reel이 `h-dvh` - 100dvh 높이)
- ✅ **위아래 스와이프**로 다음/이전 상품 영상으로 이동

### 2. **데이터 구조: Stream + Products = Reels**

```typescript
interface ReelData {
  stream: Stream      // 하나의 라이브 방송
  product: Product    // 방송에서 판매하는 상품
}

// 예시: streamId=20 라이브 방송
// ┌─────────────────────────────────┐
// │ Stream #20 (라이브 방송)         │
// │ - 판매자: 홍길동                 │
// │ - YouTube Video ID: abc123       │
// │ - 상품 목록:                     │
// │   ├─ Product A (상품1)           │
// │   ├─ Product B (상품2)           │  ← 각 상품이 하나의 Reel이 됨
// │   └─ Product C (상품3)           │
// └─────────────────────────────────┘
```

**로직 흐름:**
```typescript
// 1. URL에서 streamId 가져오기
const { streamId } = useParams()  // 예: /live/20 → streamId = "20"

// 2. 해당 스트림 로드
const stream = await axios.get(`/api/streams/${streamId}`)

// 3. 해당 스트림의 상품들 로드
const products = await axios.get(`/api/streams/${stream.id}/products`)

// 4. Stream + Products → Reels 배열 생성
const reels = products.map(product => ({
  stream: stream,
  product: product
}))

// 결과: [
//   { stream: Stream#20, product: ProductA },  ← Reel 1 (위아래 스크롤 가능)
//   { stream: Stream#20, product: ProductB },  ← Reel 2
//   { stream: Stream#20, product: ProductC },  ← Reel 3
// ]
```

### 3. **실제 동작 방식**

#### URL 예시: `/live/20`

1. **페이지 진입**
   - `streamId = 20` 추출
   - `/api/streams/20` 호출 → Stream 정보 로드
   - `/api/streams/20/products` 호출 → 상품 목록 로드

2. **Reels 생성**
   ```
   Stream #20 + Product 1 = Reel 1
   Stream #20 + Product 2 = Reel 2
   Stream #20 + Product 3 = Reel 3
   ```

3. **화면 표시**
   ```
   ┌───────────────────────┐
   │  [YouTube 영상]       │  ← 동일한 YouTube 영상 (Stream #20)
   │                       │
   │  Product 1 정보        │  ← 첫 번째 상품 (Reel 1)
   │  - 이름: 헤드폰        │
   │  - 가격: $89.99       │
   │  [담기] [결제]        │
   └───────────────────────┘
   
   ↓ (아래로 스크롤)
   
   ┌───────────────────────┐
   │  [YouTube 영상]       │  ← 동일한 YouTube 영상 (Stream #20)
   │                       │
   │  Product 2 정보        │  ← 두 번째 상품 (Reel 2)
   │  - 이름: 주얼리        │
   │  - 가격: $45.00       │
   │  [담기] [결제]        │
   └───────────────────────┘
   ```

### 4. **현재 문제 상황**

사용자 보고:
> "라이브 영상 DB가 2개 정도는 없어진 상황이야."

**원인 분석:**
```typescript
// LivePageV2.tsx 라인 1415-1431
const streamResponse = await axios.get(`/api/streams/${streamId}`)
if (streamResponse.data.success && streamResponse.data.data) {
  stream = streamResponse.data.data
} else {
  // Fallback to demo data
  stream = demoStreams[streamIndex]
}
```

**가능한 문제:**
1. **DB에서 Stream 데이터 삭제/비활성화됨**
   - `/api/streams/20` 호출 시 404 또는 빈 데이터 반환
   - Fallback으로 demo data 사용 중 (잘못된 데이터)

2. **Products가 없거나 적음**
   - `/api/streams/20/products` 호출 시 빈 배열 반환
   - Reels 배열이 비어있거나 적음
   - 화면에 표시할 내용 없음

3. **YouTube video_id 없음**
   - Stream 데이터에 `youtube_video_id` 필드 누락
   - 검은 화면 또는 Package 아이콘만 표시

## 🔍 현재 문제 진단 방법

### 1. 콘솔 로그 확인
```javascript
// 브라우저 콘솔에서 확인:
[LivePageV2] Loaded stream: { id: 20, youtube_video_id: "...", ... }
[LivePageV2] Loaded products: 3
```

### 2. API 응답 확인
```bash
# Stream 데이터 확인
curl https://live.ur-team.com/api/streams/20

# Products 데이터 확인
curl https://live.ur-team.com/api/streams/20/products
```

### 3. 예상되는 문제 시나리오

#### 시나리오 A: Stream이 DB에서 삭제됨
```json
// GET /api/streams/20
{
  "success": false,
  "error": "Stream not found"
}
```
**결과**: Demo stream 사용 → 잘못된 YouTube 영상 표시

#### 시나리오 B: Products가 없음
```json
// GET /api/streams/20/products
{
  "success": true,
  "data": []
}
```
**결과**: Reels 배열 비어있음 → "No reels available" 표시

#### 시나리오 C: YouTube video_id 없음
```json
// GET /api/streams/20
{
  "success": true,
  "data": {
    "id": 20,
    "title": "라이브 방송",
    "youtube_video_id": null  // ← 문제!
  }
}
```
**결과**: YouTube player 초기화 실패 → 검은 화면

## 🎯 정상 동작 구조

### 올바른 Stream 데이터
```json
{
  "success": true,
  "data": {
    "id": 20,
    "title": "프리미엄 상품 라이브",
    "seller_name": "홍길동",
    "youtube_video_id": "dQw4w9WgXcQ",  // ✅ 필수!
    "status": "live",
    "viewer_count": 1234,
    "seller_id": 5,
    "current_product_id": 101
  }
}
```

### 올바른 Products 데이터
```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "name": "프리미엄 헤드폰",
      "price": 89.99,
      "originalPrice": 149.99,
      "image": "https://...",
      "description": "...",
      "rating": 4.8,
      "sold": 2340
    },
    {
      "id": 102,
      "name": "무선 이어폰",
      "price": 59.99,
      "originalPrice": 99.99,
      "image": "https://...",
      "description": "...",
      "rating": 4.6,
      "sold": 1560
    }
  ]
}
```

### 예상 결과
```
Reels: [
  { stream: Stream#20, product: Product#101 },  ← Reel 1
  { stream: Stream#20, product: Product#102 },  ← Reel 2
]

→ 세로 스크롤로 2개의 Reel 탐색 가능
→ 각 Reel에서 동일한 YouTube 영상 재생
→ 각 Reel에서 다른 상품 정보 표시
```

## 📊 LivePageV2 핵심 특징 요약

| 특징 | 설명 |
|------|------|
| **페이지 타입** | TikTok/Reels 스타일 세로 스크롤 |
| **스크롤 방식** | `snap-y snap-mandatory` (스냅 스크롤) |
| **Reel 구성** | 1 Stream + 1 Product = 1 Reel |
| **YouTube 영상** | 모든 Reel에서 동일한 영상 재생 (같은 streamId) |
| **상품 전환** | 위아래 스크롤로 같은 라이브의 다른 상품 보기 |
| **URL 구조** | `/live/:streamId` (예: `/live/20`) |
| **데이터 소스** | `/api/streams/:id` + `/api/streams/:id/products` |

## 🛠️ 문제 해결 방안

### 1. DB 데이터 확인 필요
- Stream #20이 DB에 존재하는지?
- Stream #20의 `youtube_video_id`가 유효한지?
- Stream #20의 Products가 존재하는지?

### 2. API 응답 검증
- 백엔드 API가 올바른 데이터 반환하는지?
- 삭제된 Stream은 404 반환해야 함 (demo fallback 말고)

### 3. Fallback 로직 개선
- Demo data 대신 사용자에게 명확한 메시지 표시
- "이 라이브 방송을 찾을 수 없습니다" 등

## 🎬 정상 사용 흐름

1. 사용자가 `/live/20` 접속
2. Stream #20 정보 로드 (YouTube video_id 포함)
3. Stream #20의 상품 목록 로드 (Products)
4. Reels 배열 생성 (Stream + Products)
5. 첫 번째 Reel 표시 (YouTube 영상 + 첫 상품)
6. 사용자가 아래로 스크롤 → 다음 Reel (같은 영상 + 다음 상품)
7. 상품 담기/결제 가능

## 💡 핵심 개념

**LivePageV2는 "하나의 라이브 방송에서 여러 상품을 세로 스크롤로 탐색하는 Reels 스타일 페이지"입니다.**

- **같은 YouTube 영상** (Stream의 youtube_video_id)
- **다른 상품 정보** (각 Product)
- **TikTok처럼 위아래 스크롤**
- **각 화면이 전체 화면** (100dvh)

---

**작성일**: 2026-02-19  
**버전**: LivePageV2 (최종 버전)  
**상태**: LivePage.tsx 제거 예정, LivePageV2.tsx만 사용
