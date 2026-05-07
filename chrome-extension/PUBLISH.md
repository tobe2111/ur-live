# UR Live Extension — Chrome Web Store 배포 가이드

## 사용자(운영자) 액션

### Step 1: 아이콘 만들기 (디자이너 또는 셀프, 약 30분)

PNG 형식 3개 필요:
- `icon-16.png` (16×16, 툴바)
- `icon-48.png` (48×48, 익스텐션 관리 페이지)
- `icon-128.png` (128×128, Web Store 표시)

빠른 방법:
- Figma / Photoshop 으로 직접 디자인
- 또는 https://realfavicongenerator.net 에 1024×1024 로고 업로드 → 자동 생성
- 이 폴더 (`chrome-extension/`) 에 동일 파일명으로 저장

### Step 2: 압축

```bash
cd /path/to/ur-live/chrome-extension
zip -r ur-live-extension.zip . -x "PUBLISH.md" "README.md" "*.DS_Store"
```

### Step 3: Chrome Web Store 등록

1. https://chrome.google.com/webstore/devconsole 접속 → Google 계정으로 로그인
2. "개발자 등록" — **$5 일회성 수수료** 결제
3. "새 항목" 클릭 → 위 ZIP 업로드
4. 다음 정보 입력:
   - **제품 이름**: `UR Live Broadcaster`
   - **간단 설명** (132자 이내): `유어딜 셀러용 — OBS 자동 송출 + YouTube Studio 통합 컨트롤`
   - **카테고리**: `Productivity`
   - **언어**: 한국어
   - **스크린샷** (최소 1개, 1280×800): 셀러 대시보드 + OBS 자동 송출 화면
   - **프라이버시 정책 URL**: `https://live.ur-team.com/privacy-policy`
5. "검토 요청" 제출
6. 심사 기간: **1-3 영업일**

### Step 4: 승인 후 ID 적용

승인되면 Web Store URL 에 익스텐션 ID 표시됨 (예: `pkmgekbgfekafmiipclmpdfodjmebngc`).

이 ID를 코드에 반영:

`src/components/streaming/ChromeExtensionBanner.tsx:6` 수정:
```ts
// Before
const EXTENSION_URL = 'https://chrome.google.com/webstore/detail/ur-live-broadcaster/'

// After (실제 ID로 교체)
const EXTENSION_URL = 'https://chrome.google.com/webstore/detail/ur-live-broadcaster/pkmgekbgfekafmiipclmpdfodjmebngc'
```

`chrome-extension/manifest.json` 의 `key` 필드 추가도 권장 (배포 후 ID 고정용 — Web Store 자동 생성).

---

## 사전 테스트 (배포 전 — 권장)

1. Chrome 에서 `chrome://extensions/` 열기
2. **"개발자 모드"** 토글 ON (오른쪽 상단)
3. **"압축 해제된 확장 프로그램 로드"** 클릭
4. 이 `chrome-extension/` 폴더 선택
5. 익스텐션 활성화 됨

이제 `https://live.ur-team.com/seller/live-broadcast` 접속:
- F12 콘솔에서 `document.documentElement.dataset.urExtension` 입력 → `"0.1.0"` 출력되면 ✅
- OBS 마법사에서 "Extension 설치됨" 표시됨

YouTube Studio 사이드바 테스트:
- `https://studio.youtube.com/video/{vid}/livestreaming?ur_stream_id=123` 접속
- 우측에 빨간색 ◀ 토글 + 우리 사이드바 자동 등장
