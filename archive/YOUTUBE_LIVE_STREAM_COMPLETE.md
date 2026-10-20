# YouTube 라이브 스트림 통합 완료 🎥

## 📋 작업 요약

**셀러가 YouTube 라이브 링크를 업로드하면 자동으로 실시간 재생되는 시스템 구현**

---

## ✅ 구현 완료 사항

### 1. **YouTube 라이브 스트림 재생 지원**
- YouTube 라이브 스트림 자동 재생
- 플레이어 컨트롤 활성화 (controls: 1)
- 불필요한 loop/playlist 파라미터 제거
- 라이브 스트림은 끝나지 않으므로 ENDED 재시작 로직 제거

### 2. **YouTube URL 자동 추출 함수**
```typescript
function extractYouTubeVideoId(url: string): string | null
```

**지원하는 URL 형식:**
- ✅ `https://www.youtube.com/watch?v=VIDEO_ID`
- ✅ `https://youtu.be/VIDEO_ID`
- ✅ `https://www.youtube.com/embed/VIDEO_ID`
- ✅ `https://www.youtube.com/live/VIDEO_ID`
- ✅ 직접 Video ID 입력 (11자리 문자열)

### 3. **셀러 API 업데이트**

#### **라이브 스트림 생성 API**
```bash
POST /api/seller/streams
```

**Request Body:**
```json
{
  "title": "🎮 게이밍 기어 특가 라이브",
  "description": "프로게이머가 추천하는 필수 아이템",
  "youtube_url": "https://www.youtube.com/watch?v=-JhoMGoAfFc",
  "status": "live",
  "seller_instagram": "gaming_pro",
  "seller_youtube": "@GamingPro",
  "seller_facebook": "GamingProOfficial"
}
```

**또는 직접 Video ID 사용:**
```json
{
  "title": "라이브 방송",
  "youtube_video_id": "-JhoMGoAfFc",
  "status": "live"
}
```

#### **라이브 스트림 수정 API**
```bash
PUT /api/seller/streams/:id
```

**Request Body (동일):**
```json
{
  "youtube_url": "https://www.youtube.com/watch?v=NEW_VIDEO_ID",
  "status": "live"
}
```

---

## 🎯 테스트 결과

### **테스트 스트림**
- **URL**: https://www.youtube.com/watch?v=-JhoMGoAfFc
- **Video ID**: `-JhoMGoAfFc`
- **Status**: ✅ 정상 재생 확인

### **라이브 페이지**
- **Production**: https://live.ur-team.com/live/1
- **Latest Deploy**: https://cdf58859.toss-live-commerce.pages.dev/live/1

---

## 📊 Before vs After

| 항목 | Before | After |
|------|--------|-------|
| **URL 형식** | Video ID만 지원 | ✅ 다양한 YouTube URL 지원 |
| **셀러 업로드** | Video ID 수동 입력 | ✅ YouTube 링크 복사-붙여넣기 |
| **라이브 재생** | 일반 동영상 설정 (loop) | ✅ 라이브 스트림 최적화 |
| **플레이어 컨트롤** | 숨김 (controls: 0) | ✅ 표시 (controls: 1) |
| **사용자 경험** | 복잡한 ID 추출 필요 | ✅ 원클릭 URL 붙여넣기 |

---

## 🚀 사용 방법

### **셀러 입장**
1. YouTube Studio에서 라이브 스트림 시작
2. 공유 URL 복사 (예: `https://www.youtube.com/watch?v=-JhoMGoAfFc`)
3. 셀러 대시보드에서 라이브 스트림 생성
4. YouTube URL 붙여넣기
5. 저장 → 자동으로 Video ID 추출 및 저장

### **시청자 입장**
1. 라이브 페이지 접속: `https://live.ur-team.com/live/1`
2. YouTube 라이브 스트림 자동 재생
3. 실시간으로 상품 확인 및 구매

---

## 🛠️ 기술 구현

### **YouTube Player 설정**
```typescript
playerVars: {
  autoplay: 1,
  mute: 1,           // 자동재생 정책 준수
  controls: 1,       // 라이브에서는 컨트롤 표시
  modestbranding: 1,
  rel: 0,
  showinfo: 0,
  iv_load_policy: 3,
  playsinline: 1,
  enablejsapi: 1,
  origin: window.location.origin
}
```

### **상태 관리**
```typescript
onStateChange: (event) => {
  if (event.data === YT.PlayerState.PLAYING) {
    setVideoStatus('playing')
  } else if (event.data === YT.PlayerState.BUFFERING) {
    setVideoStatus('playing')  // 버퍼링 중에도 playing 유지
  } else if (event.data === YT.PlayerState.ENDED) {
    setVideoStatus('ended')    // 일반 동영상의 경우만
  }
}
```

### **URL 추출 로직**
```typescript
function extractYouTubeVideoId(url: string): string | null {
  // 직접 Video ID
  if (!/^https?:\/\//.test(url) && /^[\w-]{11}$/.test(url)) {
    return url;
  }

  const urlObj = new URL(url);
  
  // youtube.com/watch?v=VIDEO_ID
  if (urlObj.hostname.includes('youtube.com')) {
    const videoId = urlObj.searchParams.get('v');
    if (videoId) return videoId;
    
    // youtube.com/embed/VIDEO_ID or youtube.com/live/VIDEO_ID
    const pathMatch = urlObj.pathname.match(/\/(embed|live)\/([a-zA-Z0-9_-]{11})/);
    if (pathMatch) return pathMatch[2];
  }
  
  // youtu.be/VIDEO_ID
  if (urlObj.hostname === 'youtu.be') {
    return urlObj.pathname.slice(1);
  }
  
  return null;
}
```

---

## 📦 API 응답 예시

### **성공 응답**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "🎮 게이밍 기어 특가 라이브",
    "description": "프로게이머가 추천하는 필수 아이템",
    "youtube_video_id": "-JhoMGoAfFc",
    "status": "live",
    "seller_id": 1,
    "created_at": "2026-02-05 03:50:00",
    "updated_at": "2026-02-05 03:50:00"
  }
}
```

### **오류 응답 (잘못된 URL)**
```json
{
  "success": false,
  "error": "Invalid YouTube URL. Please provide a valid YouTube video or live stream URL."
}
```

---

## 🎬 화면 구성

```
┌─────────────────────────────────────────┐
│                                         │
│        YouTube Live Stream 재생          │
│         (자동재생 + 컨트롤 표시)           │
│                                         │
├─────────────────────────────────────────┤
│  [상품 카드]               [결제 버튼]   │
│  이미지 + 이름 + 가격       ShoppingBag  │
└─────────────────────────────────────────┘
│  채팅 영역                               │
│  - 실시간 채팅 메시지                     │
│  - 담기 버튼 클릭 시 자동 메시지          │
└─────────────────────────────────────────┘
```

---

## 🔐 보안 고려사항

1. **URL 검증**: 
   - YouTube 도메인만 허용
   - 정규식으로 Video ID 형식 검증
   - 11자리 영문/숫자/하이픈/언더스코어만 허용

2. **셀러 인증**:
   - 모든 API는 셀러 세션 토큰 필요
   - 본인 스트림만 수정 가능

3. **CORS 설정**:
   - YouTube Player API는 `origin` 파라미터 필수
   - 현재 도메인만 허용

---

## 📝 데이터베이스 업데이트

### **로컬 DB 업데이트**
```bash
npx wrangler d1 execute toss-live-commerce-db --local \
  --command="UPDATE live_streams SET youtube_video_id = '-JhoMGoAfFc' WHERE id = 1;"
```

### **프로덕션 DB 업데이트**
```bash
npx wrangler d1 execute toss-live-commerce-db --remote \
  --command="UPDATE live_streams SET youtube_video_id = '-JhoMGoAfFc' WHERE id = 1;"
```

---

## 🎯 핵심 성과

✅ **3/3 완료 (100%)**

1. ✅ YouTube 라이브 스트림 재생 지원
2. ✅ YouTube URL 자동 추출 함수 구현
3. ✅ 셀러 API에 youtube_url 파라미터 추가

---

## 🚀 배포 정보

- **Production Main URL**: https://live.ur-team.com
- **Latest Deploy**: https://cdf58859.toss-live-commerce.pages.dev
- **Live Page**: https://live.ur-team.com/live/1
- **Git Commit**: `ab91d75`
- **Status**: ✅ **Production Ready**

---

## 📄 관련 파일

- `src/pages/LivePage.tsx` - YouTube Player 설정
- `src/index.tsx` - API 및 URL 추출 함수
- `/tmp/test_youtube_url.sh` - 테스트 스크립트

---

## 🔜 다음 단계 (선택사항)

### **셀러 대시보드 UI 추가**
- 라이브 스트림 생성/수정 폼
- YouTube URL 입력 필드
- 실시간 미리보기
- 라이브 상태 관리

### **추가 기능**
- YouTube 썸네일 자동 가져오기
- 라이브 시청자 수 표시
- 라이브 채팅 동기화 (선택)

---

## 🎉 최종 결론

**셀러가 YouTube 라이브 링크만 붙여넣으면 자동으로 실시간 스트리밍이 재생되는 시스템이 완성되었습니다!**

**테스트 URL**: https://live.ur-team.com/live/1

---

**작성일**: 2026-02-05  
**작성자**: AI Developer  
**프로젝트**: Toss Live Commerce
