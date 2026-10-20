# 디렉토리 정찰 결과 (2026-04-26)

> 메인 코드(`src/`) 외에 루트에 존재하는 디렉토리들의 실제 용도/상태 정리.

| 디렉토리 | 용도 | 상태 | 권장 |
|---|---|---|---|
| **`ffmpeg-service/`** | WebM → RTMP 변환 (라이브 송출 보조). Express+Docker. | 별도 서비스로 운영. 메인 워커와 분리. | 유지. README 보강 권장. |
| **`chrome-extension/`** | "UR Live — OBS Bridge" 브라우저 확장. HTTPS 페이지에서 ws://localhost(OBS WebSocket) 중개 + YouTube Studio 에 컨트롤 주입. | 셀러용 보조 도구. 배포 여부 불명. | 유지. 배포 상태 확인 필요. |
| **`naver-ad-scraper/`** | 네이버 검색광고(파워링크) 광고주 이메일 수집. Playwright + SQLite. | SessionStart hook 으로 매번 띄움. 외부 영업 도구로 보임. | 유지하되 README 작성 (운영 목적 명시). |
| **`app/`** | Next.js App Router 형식 — checkout 페이지 1개만 (page.tsx, layout.tsx). | **별도 Next.js 시도의 잔재로 추정**. `src/` 의 어디에서도 import 안 됨. | ⚠️ 사용 중 아니면 archive 권장. |
| **`workers/`** | 별도 Cloudflare Worker (`cleanup-cron.ts`, `proxy.js`). 메인 워커와 분리. | `src/` 에서 참조 0건. 자체 배포된 적 있는지 확인 필요. | ⚠️ 미사용이면 archive. cleanup-cron 은 이미 메인 워커의 cron 으로 통합됨. |
| **`design/`** | v3, v4 디자인 시안 폴더. | 디자인 자료. | 유지. |
| **`docs-site/`** | Docusaurus 기반 문서 사이트 (urdeal-docs). | 사용 여부 불명. | 별도 배포 흐름 확인. |
| **`client/`** | **빈 디렉토리**. | 사용 안 함. | ⚠️ 삭제. |
| **`checkout-design/`** | 별도 Next.js 프로토타입 (체크아웃 UI 디자인 시안). | 디자인 PoC. `src/` 에서 참조 0건. | ⚠️ archive 또는 design/ 으로 이동. |

## 권장 액션

### 즉시 (이 PR)
1. **`client/`** 빈 디렉토리 삭제
2. **`app/`** → `archive/dead-code/` (Next.js 잔재 — Vite 프로젝트라 사용 불가)
3. **`workers/`** → `archive/dead-code/` (메인 워커로 통합 완료 확인)
4. **`checkout-design/`** → `design/checkout-prototype/` 로 이동 (디자인 자료 일관성)

### 후속
5. **`naver-ad-scraper/README.md`** 보강 — 운영 목적/사용법 명시
6. **`chrome-extension/`** 배포 상태 확인 (Chrome Web Store 등록 여부)
7. **`docs-site/`** 자동 배포 파이프라인 점검
