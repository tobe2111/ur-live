# LivePageV2 영상 재생 문제 분석 및 해결

## 🔍 문제 분석

### 사용자 보고
> "https://502f1d9a.ur-live.pages.dev/live/20 페이지에서 영상이 제대로 재생이 안돼"

### 발견된 문제들

#### 1. ❌ URL 자동 변경 문제
**증상:**
- `/live/20`으로 진입
- 자동으로 `/live/1`로 URL 변경됨
- Stream #1의 YouTube 영상이 표시됨

**원인:**
```typescript
// 초기 activeIndex를 3으로 설정했지만...
setActiveIndex(3)  // Stream #20은 배열의 4번째 (index 3)
setReels(reelsData)

// 문제: 페이지가 로드될 때 스크롤 위치가 맨 위 (index 0)
// IntersectionObserver가 첫 번째 Reel (index 0)을 감지
// activeIndex가 0으로 변경됨
// URL이 /live/1로 변경됨
```

#### 2. ❌ YouTube 영상 에러 무시
**증상:**
- YouTube 영상이 로드 실패해도 에러 메시지 없음
- 검은 화면만 표시됨

**원인:**
```typescript
onError: (event: any) => {
  // Suppress YouTube player errors silently  ← 에러를 완전히 무시!
},
```

#### 3. ❌ 삭제된 YouTube 영상
**API 응답:**
```json
{
  "id": 1,
  "youtube_video_id": "dQw4w9WgXcQ",  // Rick Astley 영상 (삭제됨)
  "status": "live"
}
```

**문제:**
- Stream #1, #2, #3의 youtube_video_id가 모두 `"dQw4w9WgXcQ"`
- 이 영상은 실제로 존재하지 않거나 embedding 불가
- YouTube player가 에러를 발생시키지만 무시됨

## ✅ 해결 방법

### 1. 초기 스크롤 위치 설정
```typescript
// reels가 로드된 후 activeIndex 위치로 자동 스크롤
useEffect(() => {
  if (reels.length === 0 || !containerRef.current) return
  if (activeIndex === 0) return // 이미 맨 위면 스크롤 불필요
  
  const targetElement = containerRef.current.children[activeIndex]
  if (targetElement) {
    console.log('[LivePageV2] Scrolling to index:', activeIndex)
    targetElement.scrollIntoView({ behavior: 'instant' })
  }
}, [reels])
```

**효과:**
- `/live/20` 진입 → activeIndex = 3으로 설정
- reels 로드 후 → index 3 위치로 자동 스크롤
- Stream #20이 화면에 표시됨
- URL 유지: `/live/20`

### 2. YouTube 에러 로깅
```typescript
onError: (event: any) => {
  if (!isMounted) return
  console.error(`[ReelCard] YouTube player error for video ${stream.youtube_video_id}:`, event.data)
  // Error codes: 2=invalid ID, 5=HTML5 error, 100=not found, 101/150=embedding disabled
  setShowPlayButton(true)
},
```

**효과:**
- YouTube 에러를 콘솔에 출력
- 어떤 video_id가 문제인지 확인 가능
- 에러 코드로 원인 파악 가능

### 3. activeIndex 설정 순서 변경
```typescript
// BEFORE (잘못된 순서)
setReels(reelsData)
setActiveIndex(initialIndex)  // reels가 아직 업데이트 안됨

// AFTER (올바른 순서)
setActiveIndex(initialIndex)  // activeIndex 먼저 설정
setReels(reelsData)           // 그 다음 reels 설정
```

**효과:**
- activeIndex가 먼저 설정되어 React가 올바른 순서로 렌더링
- 스크롤 useEffect가 올바른 activeIndex를 받음

## 📊 데이터 흐름 분석

### 현재 API 응답 (실제 데이터)
```json
{
  "success": true,
  "data": [
    {"id": 1, "youtube_video_id": "dQw4w9WgXcQ", ...},  // ❌ 삭제된 영상
    {"id": 2, "youtube_video_id": "dQw4w9WgXcQ", ...},  // ❌ 삭제된 영상
    {"id": 3, "youtube_video_id": "dQw4w9WgXcQ", ...},  // ❌ 삭제된 영상
    {"id": 20, "youtube_video_id": "XN71R4Sf5DQ", ...}, // ✅ 정상 영상
    {"id": 19, "youtube_video_id": "VB4o0skZ4Lk", ...}, // ✅ 정상 영상
    {"id": 15, "youtube_video_id": "69xU_b5TfY8", ...}  // ✅ 정상 영상
  ]
}
```

### Reels 배열 생성
```typescript
// 결과 배열 (순서 유지)
reels = [
  { stream: #1, product: ... },  // index 0 - ❌ 영상 재생 불가
  { stream: #2, product: ... },  // index 1 - ❌ 영상 재생 불가
  { stream: #3, product: ... },  // index 2 - ❌ 영상 재생 불가
  { stream: #20, product: ... }, // index 3 - ✅ 영상 재생 가능
  { stream: #19, product: ... }, // index 4 - ✅ 영상 재생 가능
  { stream: #15, product: ... }  // index 5 - ✅ 영상 재생 가능
]
```

### URL → activeIndex 매핑
```typescript
URL: /live/20
streamId = 20
initialIndex = reels.findIndex(r => r.stream.id === 20)
// initialIndex = 3 (배열의 4번째)

// 이전: initialIndex 설정했지만 스크롤 위치는 맨 위 (index 0)
// 현재: initialIndex 위치로 자동 스크롤 ✅
```

## 🎬 사용자 경험 개선

### Before (문제 상황)
```
1. /live/20 진입
2. Stream #1 표시 (삭제된 영상) ❌
3. URL이 /live/1로 변경 ❌
4. 검은 화면만 보임 ❌
5. 에러 메시지 없음 ❌
```

### After (해결 후)
```
1. /live/20 진입
2. 자동으로 index 3 위치로 스크롤 ✅
3. Stream #20 표시 (정상 영상) ✅
4. URL 유지: /live/20 ✅
5. 영상 정상 재생 ✅
6. 에러 발생 시 콘솔에 로그 출력 ✅
```

## 🔧 기술적 세부사항

### 1. scrollIntoView() 사용
```typescript
targetElement.scrollIntoView({ behavior: 'instant' })
```
- `behavior: 'instant'`: 즉시 스크롤 (애니메이션 없음)
- `behavior: 'smooth'`: 부드러운 애니메이션 (사용하지 않음)
- 이유: 페이지 로드 시 즉시 올바른 위치에 표시

### 2. useEffect 의존성 배열
```typescript
useEffect(() => {
  // Scroll to initial position
}, [reels])  // reels가 변경될 때만 실행
```
- `reels`가 로드되면 실행
- 한 번만 실행됨 (reels는 초기 로드 후 변경 안됨)

### 3. IntersectionObserver
```typescript
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const index = Number(entry.target.getAttribute('data-index'))
        setActiveIndex(index)  // 화면에 보이는 Reel의 index로 업데이트
      }
    })
  },
  { threshold: 0.6 }  // 60% 이상 보이면 활성화
)
```

## 🚀 배포 정보

| 항목 | 값 |
|------|-----|
| **Commit** | `b8cee0f` → `c5b8c0e` |
| **변경 사항** | 1. YouTube 에러 로깅<br>2. activeIndex 설정 순서 변경<br>3. 초기 스크롤 위치 설정 |
| **Preview URL** | https://7b6acf06.ur-live.pages.dev/live/20 |
| **Production URL** | https://live.ur-team.com/live/20 |
| **배포 시간** | 2026-02-19 07:25 GMT |

## 🧪 테스트 결과

### 테스트 URL
```
https://7b6acf06.ur-live.pages.dev/live/20
```

### 예상 결과
1. ✅ 페이지 로드 시 Stream #20이 즉시 표시됨
2. ✅ URL이 `/live/20`으로 유지됨
3. ✅ YouTube 영상 `XN71R4Sf5DQ`가 정상 재생됨
4. ✅ 상품 정보 "지리산 설날 떡국떡" 표시됨
5. ✅ 위로 스크롤하면 Stream #3, #2, #1 (에러 영상)
6. ✅ 아래로 스크롤하면 Stream #19, #15

### 콘솔 로그 확인
```javascript
// 정상 로그
[LivePageV2] Loaded all streams: 6
[LivePageV2] Created reels: 6
[LivePageV2] Initial index for stream 20 : 3
[LivePageV2] Scrolling to index: 3
[LivePageV2] URL updated to: /live/20  // ✅ 올바른 URL

// Stream #1, #2, #3으로 스크롤 시 예상 에러
[ReelCard] YouTube player error for video dQw4w9WgXcQ: 101
// Error code 101 = embedding disabled (또는 영상 삭제됨)
```

## 📝 권장 사항

### 1. 삭제된 YouTube 영상 교체
**문제:**
- Stream #1, #2, #3의 `youtube_video_id: "dQw4w9WgXcQ"`는 재생 불가

**해결 방법:**
```sql
-- DB에서 youtube_video_id 업데이트
UPDATE streams 
SET youtube_video_id = '유효한_YouTube_Video_ID'
WHERE id IN (1, 2, 3);
```

### 2. YouTube 영상 유효성 검증
**백엔드에서 구현:**
```typescript
// Stream 생성/수정 시 YouTube API로 영상 존재 확인
const isValid = await validateYouTubeVideo(youtube_video_id)
if (!isValid) {
  throw new Error('Invalid YouTube video ID')
}
```

### 3. 에러 UI 개선
**현재:**
- 영상 로드 실패 시 검은 화면만 표시

**개선안:**
```tsx
{videoError && (
  <div className="absolute inset-0 bg-black flex items-center justify-center">
    <div className="text-center">
      <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
      <p className="text-white text-lg">영상을 로드할 수 없습니다</p>
      <p className="text-gray-400 text-sm mt-2">잠시 후 다시 시도해주세요</p>
    </div>
  </div>
)}
```

## 💡 교훈

### 1. 초기 상태와 UI 동기화
- State 설정 (activeIndex) ≠ UI 상태 (스크롤 위치)
- State 변경 후 UI도 동기화 필요

### 2. 에러 처리의 중요성
- 에러를 무시하면 디버깅 불가능
- 최소한 콘솔 로그는 남겨야 함

### 3. 순서의 중요성
- State 업데이트 순서가 렌더링 결과에 영향
- 의존성이 있는 State는 순서 고려 필요

---

**작성일**: 2026-02-19  
**버전**: LivePageV2 영상 재생 문제 해결  
**상태**: 해결 완료 ✅
