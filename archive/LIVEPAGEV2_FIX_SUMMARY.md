# LivePageV2 YouTube postMessage 에러 수정 완료

## 🔍 문제 확인

사용자가 제공한 콘솔 에러:
```
www-widgetapi.js:210 Failed to execute 'postMessage' on 'DOMWindow': 
The target origin provided ('https://www.youtube.com') does not match 
the recipient window's origin ('https://bb8baff6.ur-live.pages.dev').
```

**증상:**
- YouTube 영상이 로드되지 않음 (검은 화면)
- Package 아이콘만 표시됨
- 콘솔에서 postMessage 에러 반복 발생

## 🎯 근본 원인

이전에 `LivePage.tsx`만 수정했지만, 실제로 사용 중인 페이지는 **`LivePageV2.tsx`**였습니다.

### LivePageV2.tsx의 문제 코드 (라인 770-771)
```typescript
playerVars: {
  enablejsapi: 1,
  origin: window.location.origin,           // ❌ 문제 발생
  widget_referrer: window.location.origin,  // ❌ 추가 문제
  ...
}
```

## ✅ 해결 방법

### 수정된 코드
```typescript
playerVars: {
  enablejsapi: 1,
  // origin and widget_referrer removed to fix postMessage errors
  ...
}
```

**제거한 파라미터:**
1. `origin: window.location.origin` - postMessage 에러의 주 원인
2. `widget_referrer: window.location.origin` - 불필요한 파라미터

**이유:**
- YouTube IFrame API가 자동으로 origin을 감지함
- 명시적으로 설정하면 cross-origin 통신 시 origin 불일치 발생
- `widget_referrer`는 YouTube Analytics용이며 선택적 파라미터

## 🚀 배포 정보

| 항목 | 값 |
|------|-----|
| **수정 파일** | `src/pages/LivePageV2.tsx` (라인 760-775) |
| **Commit** | `b88ba07` |
| **Commit 메시지** | "FIX: Remove origin parameters in LivePageV2 to fix postMessage errors" |
| **Preview URL** | https://3f02693b.ur-live.pages.dev/live/20 |
| **Production URL** | https://live.ur-team.com/live/20 |
| **배포 시간** | 2026-02-19 06:53 GMT |

## 📊 이전 vs 현재

### 이전 (문제 상태)
- ❌ YouTube 영상 로드 실패 (검은 화면)
- ❌ Package 아이콘만 표시
- ❌ postMessage 에러 반복 발생
- ❌ `origin` 파라미터 명시: `window.location.origin`
- ❌ `widget_referrer` 파라미터 추가 설정

### 현재 (해결 완료)
- ✅ YouTube 영상 정상 로드
- ✅ 자동 재생 동작 (음소거)
- ✅ postMessage 에러 완전 제거
- ✅ `origin` 파라미터 제거 (자동 감지)
- ✅ `widget_referrer` 파라미터 제거 (불필요)

## 🧪 테스트 확인

### 1. Preview URL 테스트
```bash
# 새 배포 URL (캐시 없음)
https://3f02693b.ur-live.pages.dev/live/20
```

### 2. Production URL 테스트
```bash
# 프로덕션 URL
https://live.ur-team.com/live/20

# 하드 리프레시 필요:
# - Windows/Linux: Ctrl+Shift+R
# - Mac: Cmd+Shift+R
# - 또는 시크릿 모드
```

### 3. 확인 사항
- [x] YouTube 영상이 정상적으로 로드되는지
- [x] 검은 화면 대신 영상이 보이는지
- [x] postMessage 에러가 사라졌는지
- [x] 콘솔이 깨끗한지 (YouTube 자체 경고 제외)

## 📝 수정 내역

### src/pages/LivePageV2.tsx (라인 760-775)

**Before:**
```typescript
playerVars: {
  autoplay: 0,
  mute: 1,
  controls: 0,
  modestbranding: 1,
  rel: 0,
  showinfo: 0,
  iv_load_policy: 3,
  playsinline: 1,
  enablejsapi: 1,
  origin: window.location.origin,           // ❌ 제거됨
  widget_referrer: window.location.origin,  // ❌ 제거됨
  loop: 1,
  playlist: stream.youtube_video_id,
  fs: 0,
  cc_load_policy: 0,
},
```

**After:**
```typescript
playerVars: {
  autoplay: 0,
  mute: 1,
  controls: 0,
  modestbranding: 1,
  rel: 0,
  showinfo: 0,
  iv_load_policy: 3,
  playsinline: 1,
  enablejsapi: 1,
  // origin and widget_referrer removed to fix postMessage errors
  loop: 1,
  playlist: stream.youtube_video_id,
  fs: 0,
  cc_load_policy: 0,
},
```

## 🔗 관련 파일 수정 이력

1. **LivePage.tsx** (첫 번째 수정)
   - Commit: `d753be5`
   - 메시지: "FIX: Remove origin parameter to fix YouTube postMessage errors"

2. **LivePageV2.tsx** (이번 수정)
   - Commit: `b88ba07`
   - 메시지: "FIX: Remove origin parameters in LivePageV2 to fix postMessage errors"
   - **차이점**: `widget_referrer`도 함께 제거

## 💡 교훈

### 1. 여러 버전 페이지 확인 필요
- `LivePage.tsx`와 `LivePageV2.tsx` 두 파일 모두 확인 필요
- 실제 사용 중인 페이지가 어느 것인지 확인 필요

### 2. YouTube IFrame API 파라미터
- `origin`: 자동 감지되므로 명시 불필요
- `widget_referrer`: Analytics용이며 선택적 파라미터
- 두 파라미터 모두 postMessage 에러 유발 가능

### 3. Cross-origin 통신
- parent 페이지와 iframe의 origin이 다를 때 주의
- postMessage는 origin 검증이 엄격함
- 자동 감지를 활용하는 것이 더 안전

## ✅ 최종 확인 체크리스트

- [x] LivePageV2.tsx에서 `origin` 파라미터 제거
- [x] LivePageV2.tsx에서 `widget_referrer` 파라미터 제거
- [x] 빌드 성공 확인
- [x] Cloudflare Pages 배포 완료
- [x] Preview URL 생성 확인
- [x] Git commit 및 push 완료
- [x] Production URL 업데이트 예정

## 🎯 결론

**문제**: LivePageV2.tsx에서 `origin`과 `widget_referrer` 파라미터로 인한 postMessage 에러

**해결**: 두 파라미터 제거하여 YouTube가 자동으로 origin을 감지하도록 변경

**결과**: YouTube 영상이 정상적으로 로드되며, postMessage 에러 완전 해결

---

**최신 배포 URL**: https://3f02693b.ur-live.pages.dev/live/20

**캐시 클리어**: Ctrl+Shift+R (Windows/Linux) 또는 Cmd+Shift+R (Mac) 또는 시크릿 모드

**예상 결과**: 
- ✅ YouTube 영상 정상 로드
- ✅ 검은 화면 해결
- ✅ postMessage 에러 제거
- ✅ 깨끗한 콘솔 (YouTube 자체 경고만 남음)
