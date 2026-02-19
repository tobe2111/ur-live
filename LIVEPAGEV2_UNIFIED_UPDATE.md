# LivePageV2 통합 업데이트

## 📋 변경 사항 요약

### 1. ✅ "지금 추천!" 배지 제거
- **위치**: 현재 선택된 상품 위에 표시되던 보라색 배지
- **제거된 코드**: `<span className="text-xs font-bold text-white">지금 추천!</span>`
- **결과**: 더 깔끔한 UI

### 2. 🔄 모든 라이브 방송을 하나의 페이지에서 스크롤 가능

#### 이전 구조 (변경 전)
```
URL: /live/20
  ↓ 스크롤
[Stream #20 + Product 1]
  ↓ 스크롤  
[Stream #20 + Product 2]
  ↓ 스크롤
[Stream #20 + Product 3]

→ 하나의 Stream의 여러 Products를 스크롤
```

#### 새로운 구조 (변경 후)
```
URL: /live/20 (시작점)
  ↓ 아래로 스크롤
[Stream #20 + 첫 번째 Product]
  ↓ 아래로 스크롤 (자동 URL 업데이트)
[Stream #21 + 첫 번째 Product]
  ↓ 아래로 스크롤 (자동 URL 업데이트)
[Stream #22 + 첫 번째 Product]

→ 여러 Streams를 스크롤 (TikTok 스타일)
```

## 🎯 핵심 변경 내용

### 1. 데이터 로딩 방식 변경

#### Before (변경 전)
```typescript
// 하나의 Stream만 로드
const streamResponse = await axios.get(`/api/streams/${streamId}`)
const productsResponse = await axios.get(`/api/streams/${stream.id}/products`)

// 결과: Stream 1개 × Products N개 = Reels N개
```

#### After (변경 후)
```typescript
// 모든 Streams 로드
const streamsResponse = await axios.get('/api/streams')

// 각 Stream의 첫 번째 Product로 Reel 생성
// 결과: Streams N개 = Reels N개 (각 Stream당 1 Reel)
```

### 2. URL 자동 업데이트

스크롤로 다른 Stream으로 이동하면 URL이 자동으로 변경됩니다:

```typescript
// activeIndex 변경 시 URL 업데이트
useEffect(() => {
  const activeStreamId = reels[activeIndex].stream.id
  window.history.replaceState(null, '', `/live/${activeStreamId}`)
}, [activeIndex, reels])
```

**동작 예시:**
```
사용자가 /live/20 진입
  ↓ 아래로 스크롤
URL 자동 변경: /live/21
  ↓ 아래로 스크롤
URL 자동 변경: /live/22
```

### 3. currentStream 자동 업데이트

스크롤로 Stream이 변경되면 `currentStream` 상태도 업데이트됩니다:

```typescript
// activeIndex 변경 시 currentStream 업데이트
if (currentStream?.id !== activeStreamId) {
  setCurrentStream(activeReel.stream)
  
  // 스트리머 권한도 자동으로 체크
  if (userType === 'seller' && userId && activeReel.stream.seller_id === parseInt(userId)) {
    setIsStreamer(true)
  } else {
    setIsStreamer(false)
  }
}
```

## 📊 데이터 흐름 비교

### Before (변경 전)
```
1. GET /api/streams/20 → Stream #20
2. GET /api/streams/20/products → Products [A, B, C]
3. Reels 생성:
   - Reel 1: Stream #20 + Product A
   - Reel 2: Stream #20 + Product B
   - Reel 3: Stream #20 + Product C
```

### After (변경 후)
```
1. GET /api/streams → All Streams [#20, #21, #22]
2. 각 Stream의 Products 로드:
   - GET /api/streams/20/products → Product A
   - GET /api/streams/21/products → Product D
   - GET /api/streams/22/products → Product G
3. Reels 생성:
   - Reel 1: Stream #20 + Product A
   - Reel 2: Stream #21 + Product D
   - Reel 3: Stream #22 + Product G
```

## 🎬 사용자 경험

### TikTok 스타일 탐색
```
┌───────────────────────┐
│ [YouTube 영상 #20]    │
│ Product A             │
│ 판매자: 홍길동         │
└───────────────────────┘
        ⬇️ 스크롤
┌───────────────────────┐
│ [YouTube 영상 #21]    │
│ Product D             │
│ 판매자: 김철수         │
└───────────────────────┘
        ⬇️ 스크롤
┌───────────────────────┐
│ [YouTube 영상 #22]    │
│ Product G             │
│ 판매자: 이영희         │
└───────────────────────┘
```

## 🔧 기술적 세부사항

### 1. Initial Index 설정
```typescript
// URL의 streamId를 기반으로 초기 activeIndex 설정
if (streamId) {
  const initialIndex = reelsData.findIndex(r => r.stream.id === parseInt(streamId))
  if (initialIndex !== -1) {
    setActiveIndex(initialIndex)
  }
}
```

**예시:**
- URL: `/live/21` → activeIndex = 1 (Stream #21이 두 번째 Reel)
- 페이지 로드 시 Stream #21부터 시작

### 2. 브라우저 히스토리 관리
```typescript
// replaceState 사용 (뒤로가기 히스토리 생성 안 함)
window.history.replaceState(null, '', `/live/${activeStreamId}`)
```

**장점:**
- 뒤로가기 버튼을 눌러도 스크롤한 모든 Stream으로 돌아가지 않음
- 현재 보고 있는 Stream의 URL만 유지

### 3. IntersectionObserver 활용
```typescript
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const index = Number(entry.target.getAttribute('data-index'))
        setActiveIndex(index)  // 자동으로 activeIndex 업데이트
      }
    })
  },
  { threshold: 0.6 }  // 60% 이상 보이면 활성화
)
```

## 🚀 배포 정보

| 항목 | 값 |
|------|-----|
| **Commit** | `227a2b0` |
| **Message** | "FEAT: Load all streams in LivePageV2 for vertical scroll + Remove recommendation badge" |
| **Preview URL** | https://502f1d9a.ur-live.pages.dev/live/20 |
| **Production URL** | https://live.ur-team.com/live/20 |
| **배포 시간** | 2026-02-19 07:10 GMT |

## 🧪 테스트 방법

### 1. Preview URL 테스트
```
https://502f1d9a.ur-live.pages.dev/live/20
```

### 2. 확인 사항
- [x] "지금 추천!" 배지가 사라졌는지
- [x] 아래로 스크롤하면 다른 라이브 방송으로 이동하는지
- [x] URL이 자동으로 업데이트되는지 (/live/20 → /live/21)
- [x] 각 Stream의 YouTube 영상이 정상 재생되는지
- [x] 상품 정보가 올바르게 표시되는지

### 3. 스크롤 테스트
```
1. /live/20 접속
2. 아래로 스크롤
3. URL 확인: /live/21로 변경됨
4. 다시 아래로 스크롤
5. URL 확인: /live/22로 변경됨
```

## 📝 주의사항

### 1. Demo Fallback
- API가 실패하면 여전히 demo streams 사용
- Demo streams는 3개만 존재 (id: 1, 2, 3)

### 2. Products 표시
- 현재는 각 Stream의 **첫 번째 Product**만 Reel에 표시
- 다른 Products는 하단 Sheet에서 확인 가능
- 스트리머가 "상품 변경" 버튼으로 표시 상품 변경 가능

### 3. 스트리머 권한
- 스크롤로 다른 Stream으로 이동하면 스트리머 권한도 자동 체크
- 자신의 Stream이 아니면 "상품 변경" 버튼 숨김

## 💡 핵심 개념

**LivePageV2는 이제 "모든 라이브 방송을 TikTok 스타일로 세로 스크롤하며 탐색하는 페이지"입니다.**

### 변경 전
- 하나의 라이브 방송(Stream)
- 여러 상품(Products)을 스크롤

### 변경 후
- 여러 라이브 방송(Streams)을 스크롤
- 각 방송의 첫 번째 상품 표시
- TikTok처럼 끝없이 스크롤 가능

## 🎯 예상 효과

### 사용자 측면
- ✅ 여러 라이브를 빠르게 탐색 가능
- ✅ TikTok과 유사한 익숙한 UX
- ✅ 관심 있는 라이브를 쉽게 발견

### 판매자 측면
- ✅ 더 많은 노출 기회
- ✅ 다른 판매자의 라이브와 경쟁
- ✅ 시청자 유입 증가 가능

### 플랫폼 측면
- ✅ 사용자 체류 시간 증가
- ✅ 더 많은 라이브 소비
- ✅ 플랫폼 활성화

---

**작성일**: 2026-02-19  
**버전**: LivePageV2 통합 업데이트  
**상태**: 배포 완료 ✅
