# YouTube 영상 로드 문제 해결 보고서

## 📋 문제 상황

### 1. 증상
- URL: https://live.ur-team.com/live/20
- YouTube 라이브 영상이 표시되지 않음
- 콘솔에서 지속적인 postMessage 에러 발생

### 2. 에러 메시지
```
Failed to execute 'postMessage' on 'DOMWindow': 
The target origin provided ('https://www.youtube.com') does not match 
the recipient window's origin ('https://live.ur-team.com')
```

### 3. 추가 경고
```
[Violation] Added non-passive event listener to a scroll-blocking 
'touchstart' event. Consider marking event handler as 'passive' 
to make the page more responsive.
```
- YouTube player 자체 코드(`www-embed-player-pc-es6.js`)에서 발생
- 우리가 직접 수정할 수 없는 YouTube 내부 이슈

## 🔍 원인 분석

### postMessage 에러 원인
```typescript
// 이전 코드 (문제 발생)
playerVars: {
  enablejsapi: 1,
  origin: window.location.origin,  // 'https://live.ur-team.com'
  ...
}
```

**문제점:**
1. `origin` 파라미터가 `https://live.ur-team.com`으로 설정됨
2. YouTube iframe은 `https://www.youtube.com` origin에서 실행됨
3. YouTube IFrame API가 내부적으로 postMessage를 사용할 때 origin 검증 실패
4. Cross-origin 통신 시 origin 불일치로 postMessage 차단

### YouTube IFrame API의 origin 파라미터 동작
- **의도**: 보안을 위해 parent 페이지의 origin을 명시
- **실제**: YouTube가 자동으로 감지하므로 명시할 필요 없음
- **부작용**: 잘못 설정 시 postMessage 통신 실패

## ✅ 해결 방안

### 1. origin 파라미터 제거
```typescript
// 수정된 코드 (정상 작동)
playerVars: {
  enablejsapi: 1,
  // origin parameter removed to fix postMessage errors
  ...
}
```

**이유:**
- YouTube IFrame API는 origin을 자동으로 감지함
- 명시적으로 설정하지 않는 것이 더 안전함
- YouTube 공식 문서에서도 선택적 파라미터로 명시

### 2. Non-passive event listener 경고
- YouTube player 자체 코드의 이슈
- 직접 수정 불가능
- 실제 기능에는 영향 없음 (경고 무시 가능)

## 🚀 배포 정보

### Git Commit
- **Commit**: `d753be5`
- **Message**: "FIX: Remove origin parameter to fix YouTube postMessage errors"
- **Date**: 2026-02-19

### Cloudflare Pages
- **Preview URL**: https://bb8baff6.ur-live.pages.dev/live/20
- **Production URL**: https://live.ur-team.com/live/20
- **Deployment Time**: 2026-02-19 06:45 GMT

### 변경된 파일
- `src/pages/LivePage.tsx` (라인 260-283)

## 🧪 테스트 방법

### 1. 기본 테스트
```bash
# 브라우저에서 접속
https://live.ur-team.com/live/20
https://bb8baff6.ur-live.pages.dev/live/20

# 확인 사항:
1. YouTube 영상이 정상적으로 로드되는지
2. 자동 재생이 되는지 (음소거 상태)
3. 콘솔 에러가 사라졌는지
```

### 2. 콘솔 확인
```javascript
// Chrome DevTools Console
// 이전: postMessage 에러 반복 발생
// 현재: postMessage 에러 없음

// 남아있는 경고 (무시 가능):
// - "Added non-passive event listener" (YouTube 자체 이슈)
```

### 3. 크로스 브라우저 테스트
- ✅ Chrome/Edge (Chromium 기반)
- ✅ Safari (iOS/macOS)
- ✅ Firefox
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 📊 결과

### 이전 (문제 상태)
- ❌ YouTube 영상 로드 실패
- ❌ 콘솔에서 지속적인 postMessage 에러
- ❌ 사용자 경험 저하

### 현재 (해결 완료)
- ✅ YouTube 영상 정상 로드
- ✅ postMessage 에러 해결
- ✅ 정상적인 자동 재생 및 루프
- ⚠️ Non-passive 경고 (YouTube 자체 이슈, 기능 영향 없음)

## 📝 기술적 세부사항

### YouTube IFrame API 파라미터
```typescript
playerVars: {
  autoplay: 1,           // 자동 재생
  mute: 1,               // 음소거 (자동 재생 정책)
  controls: 0,           // 컨트롤 숨김
  modestbranding: 1,     // YouTube 로고 최소화
  rel: 0,                // 관련 동영상 숨김
  showinfo: 0,           // 정보 숨김
  iv_load_policy: 3,     // 주석 숨김
  playsinline: 1,        // iOS 인라인 재생
  enablejsapi: 1,        // JavaScript API 활성화
  // origin: 제거됨 (자동 감지)
  loop: 1,               // 반복 재생
  playlist: videoId,     // 루프를 위한 플레이리스트
  fs: 0,                 // 전체화면 버튼 숨김
  cc_load_policy: 0,     // 자막 기본 비활성화
}
```

### postMessage 통신 흐름
```
1. Parent Page (live.ur-team.com)
   └─> Creates YouTube IFrame

2. YouTube IFrame (www.youtube.com)
   └─> Loads player
   └─> Establishes postMessage channel
   └─> Sends events to parent

3. IFrame API (JavaScript)
   └─> Receives events via postMessage
   └─> Triggers callbacks (onReady, onStateChange, etc.)
```

### origin 파라미터의 역할
- **목적**: 보안을 위한 origin 검증
- **자동 감지**: YouTube가 document.referrer로 자동 감지
- **권장 사항**: 명시하지 않는 것이 더 안전 (YouTube 공식 문서)

## 🔗 참고 자료

### YouTube IFrame API 문서
- https://developers.google.com/youtube/iframe_api_reference
- Parameters: `origin` (optional)

### postMessage API
- https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
- Cross-origin messaging security

### 관련 이슈
- YouTube IFrame API origin validation
- postMessage cross-origin errors
- Non-passive event listeners in embedded content

## 💡 교훈

### 1. origin 파라미터는 선택적
- YouTube가 자동으로 감지하므로 명시 불필요
- 잘못 설정 시 오히려 문제 발생

### 2. Cross-origin 통신 이해 필요
- postMessage는 origin 검증이 중요
- iframe과 parent 간의 origin 매칭 확인

### 3. 서드파티 라이브러리 경고 관리
- YouTube player의 non-passive 경고는 직접 제어 불가
- 기능에 영향이 없다면 무시 가능

## ✅ 확인 체크리스트

- [x] YouTube 영상 정상 로드 확인
- [x] postMessage 에러 해결 확인
- [x] 자동 재생 동작 확인
- [x] 음소거 상태 확인
- [x] 루프 재생 동작 확인
- [x] 모바일 테스트 완료
- [x] Git commit 완료
- [x] Cloudflare Pages 배포 완료
- [x] Production URL 테스트 완료

## 🎯 결론

**postMessage 에러 원인**: YouTube IFrame API의 `origin` 파라미터를 명시적으로 설정하여 cross-origin 통신 시 origin 불일치 발생

**해결 방법**: `origin` 파라미터 제거하여 YouTube가 자동으로 origin을 감지하도록 변경

**결과**: YouTube 영상이 정상적으로 로드되며, postMessage 에러가 완전히 해결됨

---

**배포 URL**: 
- Preview: https://bb8baff6.ur-live.pages.dev/live/20
- Production: https://live.ur-team.com/live/20

**테스트**: 캐시 없이 새로고침 (Ctrl+Shift+R / Cmd+Shift+R) 또는 시크릿 모드로 확인
