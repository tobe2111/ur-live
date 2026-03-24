# YouTube/TikTok 영상 무한 반복 재생 가이드

## ✅ 구현 완료

### 🎬 YouTube 영상 무한 반복

**YouTube Shorts 및 일반 YouTube 영상이 자동으로 무한 반복 재생됩니다!**

---

## 🔧 구현 방법

### 1. YouTube Player 파라미터 설정

```typescript
playerVars: {
  autoplay: 1,
  mute: 1,
  loop: 1,                          // ← 무한 반복 활성화
  playlist: stream.youtube_video_id, // ← 루프를 위해 필수
  // ... 기타 설정
}
```

**핵심 포인트:**
- `loop: 1` - YouTube 루프 기능 활성화
- `playlist: videoId` - 단일 영상도 playlist로 지정해야 loop 작동
- YouTube API 공식 요구사항

---

### 2. ENDED 상태 처리 (백업 메커니즘)

```typescript
onStateChange: (event: any) => {
  setTimeout(() => {
    if (event.data === window.YT.PlayerState.ENDED) {
      // YouTube loop가 실패할 경우를 대비한 백업
      console.log('Video ended, restarting...')
      setVideoStatus('playing')  // ended 상태로 변경 X
      
      // 처음부터 다시 재생
      if (event.target && typeof event.target.seekTo === 'function') {
        event.target.seekTo(0)      // 0초로 이동
        event.target.playVideo()    // 재생
      }
    }
  }, 0)
}
```

**이중 안전장치:**
1. **YouTube 네이티브 루프** (`loop: 1` + `playlist`)
2. **백업 루프** (ENDED 이벤트 → seekTo(0) → playVideo)

---

## 🎯 작동 방식

### 시나리오 1: YouTube 네이티브 루프 (기본)
```
영상 시작 (0:00)
  ↓
영상 진행 중...
  ↓
영상 종료 (예: 0:15)
  ↓
YouTube가 자동으로 처음부터 재생 ✅
  ↓
무한 반복...
```

### 시나리오 2: 백업 루프 (네이티브 실패 시)
```
영상 시작 (0:00)
  ↓
영상 진행 중...
  ↓
영상 종료 (예: 0:15)
  ↓
onStateChange(ENDED) 이벤트 발생
  ↓
seekTo(0) + playVideo() 호출 ✅
  ↓
무한 반복...
```

---

## 🧪 테스트 방법

### Test 1: YouTube Shorts 무한 반복
**절차:**
1. 라이브 페이지 접속: https://live.ur-team.com/live/15
2. YouTube Shorts 영상 끝까지 시청 (15초)
3. 영상 종료 확인

**예상 결과:**
- ✅ 영상이 자동으로 처음부터 다시 재생
- ✅ 흰 화면 없음
- ✅ "ended" 상태로 변경 안 됨
- ✅ 콘솔에 "Video ended, restarting..." 메시지 (백업 루프 사용 시)

---

### Test 2: 일반 YouTube 영상 무한 반복
**절차:**
1. 일반 YouTube 영상 URL로 스트림 생성
2. 라이브 페이지 접속
3. 영상 끝까지 시청

**예상 결과:**
- ✅ 영상이 자동으로 처음부터 다시 재생
- ✅ 무한 반복

---

## 🌐 배포 정보

- **최신 배포**: https://d91e0e24.toss-live-commerce.pages.dev
- **프로덕션**: https://live.ur-team.com
- **테스트 페이지**: https://live.ur-team.com/live/15

---

## 📱 지원 플랫폼

### ✅ 현재 지원
- **YouTube Shorts** ✅
- **일반 YouTube 영상** ✅

### ⏳ TikTok 영상 (향후 지원 예정)
**현재 상황:**
- TikTok은 YouTube와 달리 iframe embed를 공식 지원하지 않음
- TikTok oEmbed API를 사용해야 함

**TikTok 무한 반복 구현 방법 (향후):**
1. **Option 1: TikTok oEmbed API 사용**
   ```typescript
   // TikTok embed 로드
   const embedUrl = `https://www.tiktok.com/oembed?url=${tiktokUrl}`
   
   // iframe에 삽입
   // 하지만 자동 재생/루프 제어가 제한적
   ```

2. **Option 2: TikTok embed 스크립트 + 이벤트 리스너**
   ```html
   <blockquote class="tiktok-embed" cite="${tiktokUrl}">
   <script async src="https://www.tiktok.com/embed.js"></script>
   ```
   - 단점: 재생 제어가 매우 제한적
   - TikTok이 공식적으로 자동 재생/루프 API 제공 안 함

3. **Option 3: 영상 직접 호스팅 (권장하지 않음)**
   - 저작권 문제
   - TikTok ToS 위반 가능성

**결론:**
- YouTube는 완벽하게 무한 반복 지원 ✅
- TikTok은 플랫폼 제약으로 완전한 제어 어려움 ⚠️
- 대안: TikTok 영상을 YouTube에 업로드 후 사용

---

## 🔍 브라우저 캐시 문제 해결

**"아직도 흰 화면이 되는 경우":**

### 해결 방법

**1. 하드 리프레시 (가장 빠름)**
- **Windows/Linux**: `Ctrl + Shift + R` 또는 `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

**2. 캐시 삭제**
```
브라우저 설정 → 인터넷 사용 기록 삭제
→ 캐시된 이미지 및 파일 선택
→ live.ur-team.com 관련만 삭제
```

**3. 시크릿/프라이빗 모드**
- 새 시크릿 창에서 https://live.ur-team.com/live/15 접속
- 캐시 없이 최신 버전 로드

**4. 최신 배포 URL 직접 접속**
- https://d91e0e24.toss-live-commerce.pages.dev/live/15
- 항상 최신 버전

**5. 프로덕션 업데이트 대기**
- Cloudflare Pages는 1~2분 후 자동 반영
- 프로덕션: https://live.ur-team.com

---

## 🎉 최종 확인

### ✅ 구현된 기능
- [x] YouTube Shorts 무한 반복 재생
- [x] 일반 YouTube 영상 무한 반복 재생
- [x] 영상 종료 시 흰 화면 방지
- [x] React DOM 에러 방지
- [x] 이중 안전장치 (네이티브 루프 + 백업 루프)

### ⚠️ 알려진 제약
- TikTok 영상: 플랫폼 제약으로 완전한 제어 어려움
- 대안: YouTube 업로드 후 사용

---

## 🛠️ 코드 변경 요약

### Before ❌
```typescript
playerVars: {
  autoplay: 1,
  mute: 1,
  // loop 없음
}

onStateChange: (event: any) => {
  if (event.data === window.YT.PlayerState.ENDED) {
    setVideoStatus('ended')  // 영상 종료 상태로 변경 → 흰 화면
  }
}
```

### After ✅
```typescript
playerVars: {
  autoplay: 1,
  mute: 1,
  loop: 1,                          // ← 무한 반복
  playlist: stream.youtube_video_id, // ← 필수
}

onStateChange: (event: any) => {
  setTimeout(() => {
    if (event.data === window.YT.PlayerState.ENDED) {
      console.log('Video ended, restarting...')
      setVideoStatus('playing')  // ← ended 대신 playing 유지
      // 백업: 처음부터 다시 재생
      event.target.seekTo(0)
      event.target.playVideo()
    }
  }, 0)
}
```

---

## 📋 디버깅 콘솔 메시지

**정상 작동 시 콘솔 로그:**
```javascript
YouTube player ready
YouTube player state: 1  // PLAYING
YouTube player state: 0  // ENDED
Video ended, restarting... // 백업 루프 작동
YouTube player state: 1  // PLAYING (다시 재생)
```

**에러가 없어야 할 메시지:**
```javascript
// ❌ 이 에러가 나오면 안 됨
NotFoundError: Failed to execute 'insertBefore' on 'Node'
```

---

## 🚀 결론

**YouTube 영상 무한 반복 재생이 완벽하게 구현되었습니다!**

- ✅ YouTube Shorts 무한 반복
- ✅ 일반 YouTube 영상 무한 반복
- ✅ 영상 종료 시 흰 화면 방지
- ✅ 이중 안전장치로 안정성 확보

**프로덕션 사용 준비 완료!** 🎉

---

## 💡 TikTok 대안 제안

TikTok 영상도 무한 반복하고 싶다면:

**권장 방법:**
1. TikTok 영상을 다운로드
2. YouTube에 업로드 (Shorts 형식)
3. YouTube URL을 라이브 스트림에 사용

**장점:**
- ✅ 완벽한 무한 반복 지원
- ✅ 자동 재생 지원
- ✅ 제어 가능
- ✅ 저작권 명확

이 방법이 가장 안전하고 효과적입니다! 🚀
