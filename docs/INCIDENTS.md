# 사고 기록 (재발 방지 archive)

이 문서는 과거 발생한 production 사고와 재발 방지 룰의 출처를 기록합니다.
**활성 규칙은 `CLAUDE.md`** — 이 문서는 "왜 그 룰이 생겼는지" 의 근거.

---

## 2026-05-12 — youtube-live.routes.ts 통째 삭제 (PowerShell 덮어쓰기 사고)

- **증상**:
  - 셀러가 라이브 방송 생성 시도 → `POST /api/seller/youtube/live/create` 404
  - 셀러가 "방송 시작" 클릭 → `POST /api/seller/youtube/live/:id/start` 404 → DB status 가 `scheduled` 에서 안 바뀜
  - 메인 페이지에 라이브 노출 안 됨 (DB 에 `status='live'` 가 없으니)
  - YouTube Studio 에서 broadcast 가 아예 생성 안 됨

- **원인**:
  - 이전 에이전트 세션이 `+5min schedule` 패치를 PowerShell 로 적용하다가 1978줄짜리 `youtube-live.routes.ts` 를 **`// PLACEHOLDER` 2줄짜리 placeholder 로 덮어씀**
  - commit `b09d9b4` (diff: `-1953/+1`) 로 push 됨
  - 다음 커밋 `bd9b806` 에서 "또 안됐네" 하고 `PLACEHOLDER_CONTENT` → `PLACEHOLDER` 단어만 바꾸고 또 push (실제 코드는 여전히 없음)
  - 빌드 검증 / `git diff --stat` 검토 / 한글 깨짐 검증 모두 누락

- **복구**:
  - `git show 85139f5:src/features/youtube/api/youtube-live.routes.ts` 로 마지막 정상 버전 (1978줄) 복원
  - `scheduledStartTime` 을 "+5분 강제 override" 로 보강 (클라이언트가 현재 시각 보내도 미래 시각으로 사용)
  - `ReelCard.tsx` 의 `export default memo(ReelCardImpl)` 중복 발생 → PowerShell `Get-Content -Raw` 인코딩 깨짐 → `git checkout` 후 `[System.IO.File]::WriteAllText` UTF-8 NoBOM 방식으로 재수정

- **교훈 → `CLAUDE.md` "큰 파일 / PowerShell 수정 규칙" 신설**:
  - 500줄 이상 파일에 Write (전체 덮어쓰기) 금지 — Edit 만 사용
  - PowerShell `Set-Content` / `Get-Content -Raw` 로 한글 파일 수정 금지 (인코딩 깨짐)
  - 안전한 PowerShell I/O: `[System.IO.File]::ReadAllText` / `WriteAllText` + `UTF8Encoding($false)` (NoBOM)
  - commit 전 `git diff --stat` 으로 큰 `-N줄` 감소 의심
  - push 전 `npx vite build` 통과 필수

## 2026-04-22 — Pages vs Workers 이중 배포로 로그인 500

- **증상**: admin/seller/agency 로그인 500 + 유저 로그인 후 API 401 (이틀간)
- **원인**: Pages 프로젝트에 secret 세팅했으나 별개 Workers 프로젝트가 Custom Domain 을 붙들고 있어 실제 요청은 secret 없는 Workers 에서 처리 → `JWT_SECRET is not configured` 500
- **교훈**: 로그인/인증 500 반복되면 **가장 먼저 Cloudflare Dashboard 의 Workers/Pages Custom Domain 어느 쪽에 연결되어 있는지** 확인

## 2026-04-22 — webhook.routes.ts 중간 import 로 로그인 전부 500

- **원인**: 파일 중간(line 86) 에 `import` 문 추가 → ES module 표준 위반
- **룰화**: 파일 중간에 `import` 문 추가 절대 금지

## 2026-04-22 — Worker 코드 dynamic import + path alias crash

- **원인**: `await import('@/...')` 패턴이 빌드 시 resolve 안 됨 → 런타임 crash
- **룰화**:
  1. Worker 코드는 반드시 상대경로: `await import('../../features/foo')`
  2. `esbuild.worker.config.js` 에 `alias: { '@': path.resolve(__dirname, 'src') }` 추가
  3. Pre-commit hook 이 `src/{worker,features,shared,lib}/` 에서 `await import('@/...')` 감지 시 차단

## 2026-04-27 — vite-plugin-pwa 카카오 OAuth 차단으로 사이트 전면 다운

- **증상**: 'FetchEvent resulted in a network error: a redirected response was used for a request whose redirect mode is not "follow"'
- **원인**: vite-plugin-pwa 의 navigateFallback 이 `/auth/kakao/start?redirect=...` 까지 가로채 ERR_FAILED
- **복구**: Killer sw.js 배포 + 의존성 제거 + main.tsx 강제 unregister
- **룰화**: Service Worker / PWA 라이브러리 절대 금지. 재도입 시:
  1. `redirect: 'follow'` 명시
  2. `/auth/*`, `/oauth/*`, `/api/*` denylist
  3. e2e 카카오 로그인 사전 검증
  4. PR 단독 + 1주 prod 안정 후 다음 작업

## 2026-04-27 — IDOR 취약점 대응

- **결과**: 토큰 발급/세션 생성 endpoint 는 호출자 본인 검증 (session cookie OR 외부 ID token verify) 필수
- **룰화**: body/query 의 user_id/seller_id 를 인증 없이 신뢰하지 말 것

## 2026-04-27 — 시크릿 회전

- 4종 secrets 회전: JWT/Refresh/Cron/Toss-Webhook + Toss live sk/ck 재발급
- PowerShell `[Security.Cryptography.RandomNumberGenerator]` 로 사용자가 직접 생성 → Cloudflare Pages Variables 등록
- Toss `TOSS_WEBHOOK_SECRET` 은 토스 대시보드 "보안 키" (hex 64) 와 동일해야 함
- `ENVIRONMENT=production` (Plain text) 등록 필수 — 미등록 시 webhook 서명 검증 우회됨
- 운영 MID 는 `urteamizy1` 만 사용 (`cp_urteamw10d` 는 잘못 등록, 의식적 방치)

## 2026-04-29 — 카카오 인앱 webview 무한 reload

- **증상**: 카카오톡 인앱 브라우저 → live.ur-team.com 로그인 시 webview 무한 reload
- **원인**: `index.html` inline script 가 `window.location.href = 'kakaotalk://web/openExternal?url=...'` 를 sessionStorage 가드 없이 매 페이지 로드마다 시도
- **수정** (`d750fad`): inline script 에 `ur_kakao_external_redirect_v1` sessionStorage 가드 추가
- **후속 강화** (`5952279`): `src/utils/safe-internal-path.ts` 단일 헬퍼 도입
- **룰화**:
  1. 외부 스킴 redirect (`kakaotalk://`, `intent://`, `line://`) 는 반드시 sessionStorage 가드
  2. returnUrl / state / redirect 파라미터는 항상 `safeInternalPath()` 통과
  3. inline script + module script 가 같은 가드 공유 시 키 이름 명시 + 두 곳 동시 수정
- **관련 파일**:
  - `src/utils/safe-internal-path.ts` (Frontend SSOT)
  - `src/features/auth/api/kakao.routes.ts:safeRedirect()` (Worker, 인라인 동일 규칙)
  - 적용: LoginPage / RouteGuards.PublicRoute / KakaoCallbackPage / KakaoConsentCallbackPage

## 2026-05-03 — 글로벌 CSS invert 시도/롤백

- **시도**: `html:not(.dark)` selector 로 다크 페이지를 light 모드 시 invert
- **결과**: 사용자 신고 "모든 페이지 UI 깨짐" → 즉시 revert
- **룰화**: 향후 "모든 페이지 토글" 구현은 페이지별 명시 `dark:` variant 추가 (글로벌 invert 금지)

## 2026-05-04 — 대시보드 다크 모드 영향 차단

- **결정**: 셀러/어드민/에이전시 대시보드는 사용자 다크 모드 토글에 절대 영향받지 않아야 함
- **룰화**: 대시보드 페이지/컴포넌트에 `dark:` variant 추가 절대 금지
- **자동 차단**: `scripts/check-dashboard-theme.sh` (pre-commit hook)
