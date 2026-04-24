# UR Live Chrome Extension

HTTPS 프로덕션에서 OBS 원격 제어(obs-websocket)를 가능하게 하고,
YouTube Studio 페이지에 UR Live 사이드바 컨트롤을 주입합니다.

## 주요 기능

1. **OBS WebSocket 브릿지**: `ws://localhost:4455` 로컬 연결을 Extension
   background가 중개 → Mixed Content 차단 우회.
2. **YouTube Studio 사이드바**: 셀러가 Studio 에서 방송 중일 때 옆에
   UR Live 상품/채팅/타임딜 컨트롤을 iframe 으로 띄움.

## 개발용 로드

1. Chrome에서 `chrome://extensions/` 열기
2. "개발자 모드" 토글 ON
3. "압축 해제된 확장 프로그램 로드" → 이 디렉터리 선택
4. 확장이 목록에 나타남 — UR Live 페이지 새로고침 시 자동 활성화

## 프로덕션 배포

Chrome Web Store 등록 필요 (개발자 계정 $5, 심사 수일):
- 아이콘 생성 (16/48/128px) — 현재 placeholder
- 스크린샷
- 프라이버시 정책

## 페이지 감지

UR Live 앱은 `window.addEventListener('ur-live-extension-ready', ...)`
로 Extension 설치 여부 감지 가능:

```js
let extensionVersion = null
window.addEventListener('ur-live-extension-ready', (e) => {
  extensionVersion = e.detail.version
})
```

## OBS 연결 프로토콜

페이지 → Extension: `window.postMessage({ __urlive: true, type: 'OBS_CONNECT', host, port })`
Extension → 페이지: `window.postMessage({ __urlive: true, type: 'OBS_CONNECT_RESULT', resp })`

OBS 메시지 수신: `window.addEventListener('message', (e) => { if (e.data.__urlive && e.data.type === 'OBS_MESSAGE') ... })`

## TODO

- [ ] 아이콘 디자인 (16/48/128 PNG)
- [ ] Extension 이 설치되어 있을 때 우리 앱이 `OBSWebSocketClient` 대신
      postMessage 프록시를 사용하도록 분기 — `src/lib/obs-websocket-ext.ts`
- [ ] YouTube Studio 에서 현재 방송 ID 자동 감지 → URL param 대신
- [ ] Chrome Web Store 등록
