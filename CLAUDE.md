# CLAUDE.md — 유어딜 프로젝트 개발 규칙

## 🎨 디자인 시안 archive 룰 (필수)

사용자가 디자인 시안 (이미지/스크린샷) 을 보낼 때:

1. **반드시 `docs/design/<page-name>.md` 에 저장** — 채팅 이미지는 세션 끝나면 사라져 다음 세션이 못 봄
2. 파일 구조: 시안 설명 + 현재 vs 시안 차이 표 + 구현 todo 체크리스트
3. **구현 전이라도** 시안 받은 즉시 commit + push (다음 세션 / 다른 에이전트가 추적 가능)
4. 구현 완료 시 같은 파일 하단에 `## ✅ 구현 완료` + commit hash 추가
5. 미구현 시안 목록은 `docs/design/README.md` 의 표에 등록

> ⚠️ 이 룰을 안 지키면: 시안이 채팅에서 잊혀지고 → 구현 안 됨 → 사용자가 "왜 이거 안 됐어?" 질문 반복.

## 📚 문서 분할 (CLAUDE.md 는 활성 룰만)

- **`docs/INCIDENTS.md`** — 사고 기록 / 재발 방지 룰의 출처
- **`docs/SCHEMA.md`** — DB 스키마 룰 (금지 컬럼, status 값 등)
- **`docs/ROUTES.md`** — `/api/seller` 등 라우트 매핑
- **`docs/design/`** — UI 시안 archive
- **`TECHNICAL_DEBT.md`** — 기술 부채 목록

CLAUDE.md 는 매 작업마다 읽는 활성 규칙만 유지. 사고 후일담 / 긴 표 / 시안 detail 은 위 파일로 분리.

## 📖 운영 가이드 3종 자동 업데이트

DB(`operation_guides` 테이블) 에 저장된 3개 가이드:
- `admin` → `/admin/operations-guide`
- `seller` → `/seller/guide`
- `agency` → `/agency/guide`

**시드**: `src/features/guides/api/guide-seed.ts` (DB 비었을 때 1회 시드, UI 편집 시 DB 가 시드 덮어씀).

### 코드 변경 시 함께 업데이트
- 새 API 엔드포인트 → 영향받는 역할의 가이드 섹션
- 새 관리자 페이지 → 어드민 가이드 "유용한 링크"
- 정산/주문 플로우 변경 → 어드민 + 셀러 동시
- 수수료율 변경 → 어드민 + 셀러 + 에이전시 동시
- 장애 발생/해결 → 어드민 "기술 장애 대응" 섹션
- FAQ 추가 → 해당 역할 "자주 묻는 문제"

### 업데이트 방법
- **권장**: `guide-seed.ts` 수정 + 프로덕션 DB 해당 섹션 DELETE → 재시드
- **대안**: 관리자가 `/admin/operations-guide` 에서 직접 편집

### 자동 강제 (`scripts/check-guide-sync.sh`)
Pre-commit hook 이 다음 파일 변경 시 `guide-seed.ts` 동시 수정 검사:

| 변경 파일 | 영향 가이드 |
|---|---|
| `src/pages/Seller*.tsx`, `src/features/(seller\|youtube)/api/*.ts` | 셀러 |
| `src/pages/Admin*.tsx`, `src/worker/routes/*.ts` | 어드민 |
| `src/pages/Agency*.tsx`, `src/features/agency/api/*.ts` | 에이전시 |
| `src/features/auth/api/*.ts` | 모두 |

기본 warn-only, 차단 모드: `STRICT_GUIDE_SYNC=1`.

### 자동 생성 참조 (`scripts/generate-guide-references.mjs`)
각 가이드 끝에 "코드 자동 참조" 섹션 자동 추가 (key=`auto-reference`, order=999):
- `src/App.tsx` 라우트 + `*.routes.ts` 의 endpoint 추출
- 출력: `src/features/guides/api/auto-reference.ts` (수동 편집 금지)
- Pre-commit hook 자동 재생성. 수동: `npm run generate:guide-refs`

후속 PR 로 미루면 커밋 메시지에 `guide-update-pending` 명시.

## 🚨 기술 부채 & 알려진 이슈

**전체 목록**: `TECHNICAL_DEBT.md`. 특히 주의:
- 🔴 DB Migration CI 미작동 (D1 권한 없음) → `/api/_internal/repair-schema` 응급 처치
- 🟡 스키마 이중화 컬럼 (`stock`/`stock_quantity`, `shipping_fee`/`base_shipping_fee`)
- 🟢 시크릿 회전 완료 (2026-04-27) — 자세한 내용은 `docs/INCIDENTS.md`

## 📐 PC 반응형 디자인 시스템 (2026-05-02 도입)

### 핵심 원칙
1. **모바일 First** — 기존 모바일 디자인 그대로
2. **PC 활용** — `lg:` (1024px+) / `xl:` (1280px+) / `2xl:` (1536px+) variants
3. **콘텐츠 폭 토큰** (`src/index.css`):
   - `ur-content-narrow` (720px) — form / 결제 / 가입
   - `ur-content-medium` (1024px) — 가이드 / 약관
   - `ur-content-wide` (1280px) — 쇼핑 / 그리드 / 마이
   - `ur-content-full` (1536px) — 어드민/셀러 대시보드
4. **9:16 비디오 페이지** (`/live/*`, `/shorts`) — `MOBILE_ONLY_PREFIXES` 매칭, PC 에서도 430px 액자

### 페이지별 패턴

| 페이지 종류 | 폭 토큰 | 핵심 변환 |
|---|---|---|
| 쇼핑 그리드 | `ur-content-wide` | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5` |
| 상품 상세 | `ur-content-wide` | mobile 1열 → lg 좌이미지 / 우구매 |
| 결제/주문 | `ur-content-narrow` | PC 가운데 정렬 |
| 마이 | `ur-content-medium` | mobile 1열 → lg 2단 |
| 홈 | `ur-content-wide` | 라이브 카드 4-5열 |
| 라이브 | `data-mobile-only="true"` | 9:16 풀스크린 |
| 셀러/어드민/에이전시 | (변경 없음) | 풀 너비 |

### 새 페이지 작성 체크리스트
1. mobile 우선 (430px 가정)
2. PC: `<div className="ur-content-wide px-4 lg:px-8">` + 그리드/폰트/간격 lg variants
3. sticky header/footer 풀너비, 내부 콘텐츠는 `ur-content-*` centered
4. 9:16 비디오면 `MOBILE_ONLY_PREFIXES` 추가
5. 4가지 뷰포트 (≤640 / 768 / 1280 / 1920) 확인

### PC 사이드바 / TopNav
- `DesktopTopNav` (lg+) + `DesktopLiveSidebar` (xl+)
- BottomNav `lg:hidden` (PC 에서 숨김)
- MobileAppLayout 자동: `xl:pl-56` + `2xl:pr-72`
- HIDE_SIDEBAR_PREFIXES (셀러/어드민/에이전시/embed/checkout-return/introduce) 만 사이드바 제외

> 시안에 따른 사이드바 재설계 todo: `docs/design/home-sidebar.md`

## 🎨 테마 규칙 (필수)

페이지 생성/수정 시 **반드시** 해당 테마에 맞는 색상 사용.

### 다크 테마 — 유저 대면 메인
- **해당**: 홈 (`/`), 라이브 (`/live/*`), 쇼츠 (`/shorts`), 마이 (`/user/profile`), 알림 (`/notifications`), 셀러 공개 (`/profile/*`, `/s/*`)
- **배경**: `bg-[#020202]` (메인) / `bg-[#121212]` (카드) / `bg-[#1A1A1A]` (서브)
- **텍스트**: `text-white` (제목) / `text-gray-300` (본문) / `text-gray-400`~`500` (보조)
- **보더**: `border-[#1A1A1A]`, `border-[#2A2A2A]`
- ❌ 금지: `text-gray-900/800/700`, `bg-white`, `border-gray-200`
- 🛡️ `/user/profile` 은 화이트/다크 토글 **모두 지원** — 서브 컴포넌트 전부 `dark:` 매핑 완료 (2026-05-06)

### 화이트 테마 — 쇼핑/결제 (사용자 토글 지원)
- **해당**: `/browse`, `/cart`, `/checkout`, `/products/*`, `/my-orders`, `/search`, `/wishlist`, `/mypage/addresses`, `/account/*`, `/referral/*`, `/restaurant-map`, `/points/charge`
- **배경**: `bg-white` / `bg-gray-50`
- **텍스트**: `text-gray-900` / `text-gray-600` / `text-gray-500`
- **보더**: `border-gray-100`, `border-gray-200`
- ❌ 금지: `text-white` (컬러 버튼 위 제외), `bg-[#020202]`, `border-[#333]`

#### 사용자 다크 모드 토글 (2026-05-02)
- `/account/settings` "화면 테마" — 시스템 / 라이트 / 다크 선택
- 인프라: `useTheme` 스토어 + `<html class="dark">` + Tailwind `darkMode: 'class'`
- **새 페이지·컴포넌트 작성 시 `dark:` variant 동시 추가 필수**:

  | 라이트 (기본) | 다크 |
  |---|---|
  | `bg-white` | `dark:bg-[#0A0A0A]` |
  | `bg-gray-50` | `dark:bg-[#121212]` |
  | `bg-gray-100` | `dark:bg-[#1A1A1A]` |
  | `text-gray-900` | `dark:text-white` |
  | `text-gray-800` | `dark:text-gray-100` |
  | `text-gray-700` | `dark:text-gray-200` |
  | `text-gray-600` | `dark:text-gray-300` |
  | `text-gray-500` | `dark:text-gray-400` |
  | `text-gray-400` | `dark:text-gray-500` |
  | `border-gray-100` | `dark:border-[#1A1A1A]` |
  | `border-gray-200` | `dark:border-[#2A2A2A]` |

- 자동 마이그레이션: `perl /tmp/dark_migrate.pl <files...>` (사용 후 git diff 검토)
- FOUC 방지: `index.html` inline script 가 `localStorage.ur_theme_mode_v1` 읽고 선반영
- 다크 페이지 / 셀러 / 어드민 대시보드는 토글 무영향 (페이지 단 명시 강제)

> ⚠️ **글로벌 CSS invert 절대 금지** (2026-05-03 시도/롤백, `docs/INCIDENTS.md`)

### 라이트 테마 — 셀러/어드민/에이전시 대시보드 (토글 무영향, 고정)
- **해당**: `/seller/*`, `/admin/*`, `/agency/*`
- **배경**: SellerLayout/AdminLayout/AgencyLayout 처리 (`#F4F5F7`)
- **🚨 절대 규칙** (사용자 명령, 위반 시 차단):
  - `dark:` variant 추가 절대 금지 — `scripts/check-dashboard-theme.sh` 자동 차단
  - 향후 다크 모드 활성 시에도 항상 화이트 유지
- ❌ 금지: `text-white` (컬러 버튼 위 제외), `dark:` variants

### 공통 규칙
- `text-white` 는 컬러 배경 버튼 위에서만 (bg-pink-500, bg-red-500 등)
- CSS 변수 (`text-foreground`, `bg-muted`) 대신 **명시적 색상 클래스**

## 🚨 DB 스키마 규칙 (요약 — 자세한 건 `docs/SCHEMA.md`)

- **SSOT**: `src/shared/db/production-schema.ts`
- 새 쿼리 작성 전 컬럼 확인 + INSERT 시 NOT NULL 포함 + try-catch
- 자주 틀리는 컬럼 alias: `stock` / `is_active` / `credit_amount`
- orders.status: 대문자 (`PAID`, `DONE`, …) / payment_status: 소문자 (`approved`, …)
- 검증: `bash scripts/check-schema-refs.sh`

## 🔒 API 엔드포인트 보안 규칙 (필수)

### 새 엔드포인트 체크리스트
1. **인증**: `requireAuth()` / `requireSeller()` / `requireAdmin()` / `requireAgency()` 필수
2. **권한 검증** (IDOR 방지):
   - `resource.seller_id === authenticatedSellerId` 같은 소유권 체크
   - body/query 의 user_id/seller_id 를 인증 없이 신뢰 금지
   - 토큰 발급/세션 생성 endpoint 는 호출자 본인 검증 필수
3. **입력 검증**: `Number.isFinite()` + 범위 체크 + 문자열 길이 + enum 허용 값
4. **서버 재계산**: 결제 금액은 절대 클라이언트 값 신뢰 금지
5. **Rate limit** (민감 엔드포인트 — `/login`, `/pay`, `/donate` 등):
   - `RATE_LIMIT_KV` Dashboard Bindings 등록 필수 (미등록 시 fail-OPEN)
   - 검증: `curl -I .../api/products` → `X-RateLimit-Limit` 헤더 존재
6. **Bot challenge (Turnstile)**:
   - `verifyTurnstile(c.env.TURNSTILE_SECRET, body.turnstile_token, ip)`
   - 적용: `/api/donations/init` (2026-05-03)
   - `TURNSTILE_SECRET` 미설정 시 fail-open
7. **Idempotency**: 결제 관련 Toss API 호출 시 `Idempotency-Key` 필수
8. **에러 처리**: try-catch + DEV 모드 로깅 (조용히 삼키지 말 것)
9. **i18n fallback**: `t('X', { defaultValue: '한글' })` (NOT `t('X') || '...'`)

### 절대 하지 말 것
- ❌ `debug-*` 엔드포인트 프로덕션 배포
- ❌ 클라이언트 값으로 금액 계산
- ❌ `.catch(() => {})` 로 에러 완전 무시
- ❌ 권한 체크 없는 POST/PATCH/DELETE
- ❌ `SELECT *` with LIMIT/OFFSET but no ORDER BY
- ❌ 하드코딩된 내부 API 토큰
- ❌ `Function('p', 'return import(p)')(...)` 에 사용자 입력 전달 (RCE)

## 🌍 i18n (다국어) 필수 규칙

셀러 대시보드 (`src/pages/Seller*.tsx`, `src/components/Seller*.tsx`) 수정 시:

1. 모든 UI 텍스트는 `t()` 함수 — 하드코딩 한국어 금지
2. 새 텍스트 → `public/locales/{ko,en,ja,zh,es,fr}/translation.json` **6개 언어 모두**
3. 키 네이밍: `common.*` (공통) / `seller.*` (셀러)
4. fallback 패턴: `t('X', { defaultValue: '한글' })` — `||` 연산자 금지

## 🔐 인증

- Bearer 토큰 우선, 세션 쿠키 차선
- 셀러/어드민: localStorage JWT 즉시 체크 (Firebase 대기 안 함)
- 유저: Firebase Auth + optimistic rendering
- 한국 (live.ur-team.com): 카카오 세션 쿠키 전용, Firebase 호출 0
- ProtectedRoute: `localStorage(user_type + user_id)` 동기 체크
- `isKorea()` 분기로 Firebase 코드 건너뜀

### Redirect / returnUrl 안전 규칙
OAuth 콜백·로그인·401 핸들러 등에서 외부 입력은 **반드시 `safeInternalPath()` 통과**:

```ts
import { safeInternalPath } from '@/utils/safe-internal-path'
const returnUrl = safeInternalPath(searchParams.get('returnUrl'), '/')
navigate(returnUrl)
```

자동 차단: `/login`, `/seller/login`, `/admin/login`, `/agency/login`, `/auth/*`, `/oauth/*`, 외부 URL, protocol-relative `//`, backslash, 제어문자.

**Worker 코드** (`src/features/*/api/*.routes.ts`, `src/worker/`) 는 alias `@/` import 못 함 → `kakao.routes.ts:safeRedirect()` 가 인라인으로 동일 규칙 유지. **양쪽 같이 갱신**.

### 외부 스킴 redirect 가드 (2026-04-29 사고 후)
`kakaotalk://`, `intent://`, `line://` redirect 는 **반드시 sessionStorage 가드** (webview reload 무한 재시도 방지). inline script + module script 가 같은 가드 공유 시 키 이름 명시 + 두 곳 동시 수정. 자세한 사고 경위: `docs/INCIDENTS.md`.

## 💰 딜 포인트 시스템

- 충전: 1원 = 1딜 (수수료 없음)
- 후원/상품 결제: 딜 즉시 차감
- 셀러 정산: 기본 5% 플랫폼 수수료 (`platform_settings.commission_rate_default`). 어드민이 셀러별로 `sellers.commission_rate` 조정 가능. 후원 수수료 별도 15%.
- 최소 후원: 500딜

## 🆕 새 페이지 생성 체크리스트

1. **SEO**: `<SEO title="제목 - 유어딜" description="설명" url="/경로" />` 필수 (관리자/콜백 제외)
2. **테마**: 위 테마 규칙
3. **text-gray-900**: 화이트 테마 input/select/textarea 에 명시
4. **App.tsx**: lazy import + Route 추가
5. **console.log 금지**: `import.meta.env.DEV` 게이트 필수
6. **검증**: `bash scripts/quality-check.sh`

## 🚀 배포 아키텍처

⚠️ **Cloudflare Pages 단일 배포** (Workers 아님):
- `live.ur-team.com` → Pages `ur-live` (Custom Domain)
- `ur-live.pages.dev` → 동일 프로젝트 기본 도메인
- 명령: `npx wrangler@3 pages deploy dist/client --project-name=ur-live`
- 구조: Pages with `_worker.js`. `wrangler deploy` (Workers용) 사용 금지.

### Secret/환경변수
- Cloudflare Dashboard → Workers & Pages → ur-live → Settings → Variables and Secrets
- secret 은 한 번 저장하면 값 못 봄 — 외부 참조 시 별도 기록

### 자동 배포 규칙
- feature 브랜치 push → PostToolUse 훅이 자동 main 머지 + 푸시 (`scripts/auto-merge-main.sh`)
- 절대 feature 브랜치만 두지 말 것 — main 반영되어야 배포

### 변경 후 체크리스트
1. `bash scripts/check-schema-refs.sh`
2. `bash scripts/check-api-auth.sh`
3. `npx tsc --noEmit --skipLibCheck` (에러 0)
4. `npx vite build`
5. `git push origin <branch>` (훅이 main 자동 머지 + 배포)
6. Actions 탭 녹색 확인

### 절대 하지 말 것 (배포 관련)
- ❌ Service Worker / PWA 라이브러리 — 카카오 OAuth 차단 사고 (2026-04-27, `docs/INCIDENTS.md`)
- ❌ `_redirects` 에 `/* /index.html 200` — Workers 무한 루프
- ❌ `_headers` 에 2000자 초과 줄 — 배포 실패
- ❌ `wrangler.toml` 에서 `new_classes` (free plan 은 `new_sqlite_classes`)
- ❌ 파일 중간에 `import` 문 추가 — ES module 위반, 런타임 crash (2026-04-22 사고)
- ❌ Worker 코드에서 `await import('@/...')` — dynamic import + alias 조합 crash
  - 반드시 상대경로: `await import('../../features/foo')`
  - 예외: 순수 프론트엔드 (pages/components/shared/stores) 는 Vite 가 alias resolve → OK
  - 이중 방어: `esbuild.worker.config.js` alias + Pre-commit hook 차단

## 🛠️ 개발 환경 셋업 (새 컨트리뷰터)
1. `npm install`
2. `bash scripts/install-git-hooks.sh` — pre-commit 훅 설치
3. 이후 모든 커밋 전 자동 검증
