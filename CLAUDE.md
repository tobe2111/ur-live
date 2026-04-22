# CLAUDE.md — 유어딜 프로젝트 개발 규칙

## 🚨 기술 부채 & 알려진 이슈 (2026-04-22)

**남은 기술 부채는 `TECHNICAL_DEBT.md` 참조.** 특히 주의:
- 🔴 DB Migration CI 파이프라인 미작동 (D1 권한 없음) → `/api/_internal/repair-schema` 응급 처치 중
- 🔴 `.dev.vars` git history 노출 (비밀값 rotation 필요)
- 🟡 이중 라우팅 구조 (/api/orders, /api/payments, /api/seller)
- 🟡 스키마 이중화 컬럼 (stock/stock_quantity, shipping_fee/base_shipping_fee)

## 테마 규칙 (필수)

페이지를 생성하거나 수정할 때 **반드시** 해당 페이지의 테마에 맞는 색상을 사용합니다.

### 다크 테마 페이지 (유저 대면 메인)
- **해당**: 홈(`/`), 라이브(`/live/*`), 쇼츠(`/shorts`), 마이페이지(`/user/profile`), 알림(`/notifications`), 셀러 공개(`/profile/*`, `/s/*`)
- **배경**: `bg-[#020202]` (메인), `bg-[#121212]` (카드), `bg-[#1A1A1A]` (서브)
- **텍스트**: `text-white` (제목), `text-gray-300` (본문), `text-gray-400`~`text-gray-500` (보조)
- **보더**: `border-[#1A1A1A]`, `border-[#2A2A2A]`
- ❌ 절대 금지: `text-gray-900`, `text-gray-800`, `text-gray-700`, `bg-white`, `border-gray-200`

### 화이트 테마 페이지 (쇼핑/결제)
- **해당**: 쇼핑(`/browse`), 장바구니(`/cart`), 결제(`/checkout`), 상품상세(`/products/*`), 주문내역(`/my-orders`), 검색(`/search`), 위시리스트(`/wishlist`), 배송지(`/mypage/addresses`), 계정설정(`/account/*`), 공동구매(`/referral/*`), 맛집지도(`/restaurant-map`), 딜충전(`/points/charge`)
- **배경**: `bg-white` (메인), `bg-gray-50` (서브)
- **텍스트**: `text-gray-900` (제목), `text-gray-600` (본문), `text-gray-500` (보조)
- **보더**: `border-gray-100`, `border-gray-200`
- ❌ 절대 금지: `text-white` (컬러 버튼 위 제외), `text-gray-100`, `bg-[#020202]`, `bg-[#121212]`, `border-[#333]`, `hover:bg-[#333]`

### 라이트 테마 (셀러/어드민 대시보드)
- **해당**: 셀러(`/seller/*`), 어드민(`/admin/*`)
- **배경**: SellerLayout/AdminLayout이 처리 (`#F4F5F7`)
- **텍스트**: `text-gray-900` (제목), `text-gray-700` (본문)
- ❌ 절대 금지: `text-white` (컬러 버튼 위 제외)

### 공통 규칙
- `text-white`는 **컬러 배경 버튼** 위에서만 사용 (bg-pink-500, bg-red-500, bg-blue-600 등)
- 새 페이지 생성 시 위 목록에서 해당 테마 확인 → 해당 테마의 색상만 사용
- CSS 변수(`text-foreground`, `bg-muted`) 대신 **명시적 색상 클래스** 사용 (다크 변수 간섭 방지)

## 🚨 DB 스키마 규칙 (CRITICAL — 재발 방지)

프로덕션 DB는 **구 스키마** (`migrations/0001_initial_schema.sql` + 이후 마이그레이션) 기반입니다. 
`001_initial.sql` (신 스키마)은 **적용되지 않음**.

### 새 DB 쿼리 작성 시 필수 확인
1. **`src/shared/db/production-schema.ts` 파일 확인** — Single Source of Truth
2. 해당 테이블의 실제 컬럼만 참조
3. INSERT 시 모든 NOT NULL 컬럼 포함
4. try-catch 래핑 (방어적 코딩)

### 절대 사용 금지 컬럼 (존재하지 않음)

| 테이블 | ❌ 금지 | ✅ 대체 |
|--------|--------|--------|
| sellers | user_id, firebase_uid | id |
| sellers | slug | username |
| sellers | logo_url | profile_image |
| sellers | description | bio |
| users | deal_balance | user_points 테이블 사용 |
| users | status, role, avatar_url | 존재하지 않음 |
| users | display_name | name |
| users | referred_by, affiliate_ref | 존재하지 않음 |
| products | category_id | category (TEXT) |
| orders | total_price, amount | total_amount |
| orders | webhook_processed_at, webhook_event_id | 존재하지 않음 |
| orders | cancel_fail_reason | cancel_reason |
| order_items | price_snapshot | price |
| live_streams | viewer_count | current_viewers |
| donations | status | payment_status |

> ℹ️ `order_items.product_thumbnail`, `order_items.product_sku`는 마이그레이션 0118에서 추가되어 **사용 가능**합니다.

### Status 값 대소문자 규칙
- orders.status: **대문자** ('PENDING', 'PAID', 'DONE', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED')
- payment_status: **소문자** — CHECK 제약으로 허용된 값: `'pending'`, `'approved'`, `'failed'`, `'cancelled'`, `'refunded'`
- `payment_status = 'approved'`는 실제 CHECK 제약에 포함되어 있으므로 **사용 가능**합니다. (과거에는 금지로 기재되어 있었으나 정정)
- 주문 "결제완료" 조건은 보통 `status IN ('PAID','DONE')` 또는 `payment_status = 'approved'` 모두 유효

### 검증 스크립트 실행
커밋 전 반드시:
```bash
bash scripts/check-schema-refs.sh
bash scripts/check-api-auth.sh
```
또는:
```bash
bash scripts/quality-check.sh
```

## 🔒 API 엔드포인트 보안 규칙 (필수)

### 새 엔드포인트 체크리스트
1. **인증**: `requireAuth()` / `requireSeller()` / `requireAdmin()` / `requireAgency()` 필수
2. **권한 검증**: 
   - POST/PATCH/DELETE는 본인/본인 소속 리소스만 수정 가능
   - `resource.seller_id === authenticatedSellerId` 같은 소유권 체크
3. **입력 검증**:
   - 숫자: `Number.isFinite()`, 범위 체크 (가격 0~1억, 재고 0~100만 등)
   - 문자열: 길이 제한
   - enum: 허용된 값만
4. **서버 재계산**:
   - 결제 금액은 **절대 클라이언트 값 신뢰 금지**
   - `SELECT price FROM products WHERE id IN (...)` 서버에서 다시 조회
5. **Rate limit** (민감한 엔드포인트):
   - `/login`, `/register`, `/forgot-password`, `/pay`, `/donate`, `/review` 등
6. **Idempotency**:
   - 결제 관련 Toss API 호출 시 `Idempotency-Key` 헤더 필수
7. **에러 처리**:
   - try-catch 래핑
   - 조용히 삼키지 말고 DEV 모드에서 로깅

### 절대 하지 말 것
- ❌ `debug-*` 엔드포인트 프로덕션 배포
- ❌ 클라이언트 값으로 금액 계산 (해킹 취약점)
- ❌ `.catch(() => {})` 로 에러 완전 무시
- ❌ 권한 체크 없는 POST/PATCH/DELETE
- ❌ `SELECT *` with LIMIT/OFFSET but no ORDER BY
- ❌ 하드코딩된 내부 API 토큰

## 개발 환경 셋업 (새 컨트리뷰터)
1. `npm install`
2. `bash scripts/install-git-hooks.sh` — pre-commit 훅 설치
3. 이후 모든 커밋 전 자동 검증

## i18n (다국어) 필수 규칙

셀러 대시보드(`src/pages/Seller*.tsx`, `src/components/Seller*.tsx`)를 수정할 때:

1. **모든 UI 텍스트**는 `t()` 함수를 사용해야 합니다. 하드코딩 한국어 금지.
2. 새로운 텍스트 추가 시 `public/locales/{ko,en,ja,zh,es,fr}/translation.json`의 **6개 언어** 모두에 키를 추가합니다.
3. 키 네이밍: `common.*` (공통 버튼/상태), `seller.*` (셀러 전용)
4. 예시:
   ```tsx
   // ❌ 하드코딩
   <button>저장</button>
   
   // ✅ i18n
   <button>{t('common.save')}</button>
   ```

## 다크 테마 (요약)

- 유저 대면 메인: 다크 (`#020202` 배경) — 위 테마 규칙 참조
- 쇼핑/결제: 화이트 (`bg-white`)
- 셀러/어드민: 라이트 (`#F4F5F7`)

## 인증

- Bearer 토큰 우선, 세션 쿠키 차선 (순서 중요)
- 셀러/어드민: localStorage JWT 즉시 체크 (Firebase 대기 안 함)
- 유저: Firebase Auth + optimistic rendering (캐시 있으면 스피너 없이 렌더)

## DB 스키마

- 프로덕션 DB 컬럼명은 `src/shared/db/production-schema.ts` 참조
- `stock` (not `stock_quantity`), `is_active` (not `status`), `credit_amount` (not `seller_amount`)

## 딜 포인트 시스템

- 충전: 1원 = 1딜 (수수료 없음)
- 후원/상품 결제: 딜 즉시 차감
- 셀러 정산: 15% 플랫폼 수수료 적용
- 최소 후원: 500딜

## 새 페이지 생성 체크리스트 (필수)

새 페이지를 만들 때 **반드시** 아래 항목을 확인합니다:

1. **SEO 메타 태그**: `<SEO title="제목 - 유어딜" description="설명" url="/경로" />` 필수 (관리자/콜백 페이지 제외)
2. **테마 적용**: 위 테마 규칙에 따라 올바른 색상 사용
3. **text-gray-900**: 화이트 테마 input/select/textarea에 반드시 포함
4. **App.tsx 라우트 등록**: lazy import + Route 추가
5. **console.log 금지**: 디버그 로그는 `import.meta.env.DEV` 게이트 필수
6. **검증**: 배포 전 `bash scripts/quality-check.sh` 실행

## 한국 인증 (KR Auth)

- 한국(live.ur-team.com): 카카오 세션 쿠키 **전용**. Firebase 호출 0.
- 카카오 콜백: `login=success&userId=...` 파라미터로 인증. firebase_token 사용 안 함.
- ProtectedRoute: `localStorage(user_type + user_id)` 동기 체크만
- 글로벌: Firebase Auth (Google/Apple 로그인) 유지
- `isKorea()` 분기로 Firebase 코드 건너뜀

## 배포 아키텍처 (필수 이해)

⚠️ **Cloudflare Pages 단일 배포** (2026-04-22 정정):
- `live.ur-team.com` → **Cloudflare Pages** `ur-live` (Custom Domain)
- `ur-live.pages.dev` → 같은 Pages 프로젝트의 기본 도메인
- 배포 명령: `npx wrangler@3 pages deploy dist/client --project-name=ur-live`
- 프로젝트 구조: Pages with `_worker.js` — `wrangler.toml`의 `[assets] directory = "./dist/client"`로 표시

❌ **Workers 프로젝트가 아님**:
- 과거(2026-04 이전) CLAUDE.md는 "Workers"라고 기재했었으나 실제로는 Pages
- `wrangler deploy` (Workers용) 명령은 사용 금지 — 이 프로젝트 구조에 부적합
- 2026-04-22 이전 Dashboard에 Workers 프로젝트 `ur-live`가 병행 존재했으나 Pages 로 일원화됨

### Secret/환경변수 관리
- **Cloudflare Dashboard → Workers & Pages → ur-live (Pages 프로젝트) → Settings → Variables and Secrets**
- CI 배포 후 즉시 반영 (Pages deploy는 곧바로 production promote)
- secret은 한 번 저장하면 값을 다시 볼 수 없음. 팀 외부에서도 참조해야 하면 별도 기록 필요.

### 2026-04-22 사고 요약 (재발 방지 기록)
- 증상: admin/seller/agency 로그인 500 + 유저 로그인 후 API 401 (이틀간)
- 원인: Pages 프로젝트에 secret 세팅했는데, 별개 Workers 프로젝트가 Custom Domain을 붙들고 있어 실제 요청은 secret 없는 Workers에서 처리 → `JWT_SECRET is not configured` 500
- 교훈: 로그인/인증 500이 반복되면 **가장 먼저 Cloudflare Dashboard의 Workers/Pages Custom Domain 어느 쪽에 연결되어 있는지** 확인. 코드 수정 전에 설정 파악.

### 파일-라우트 매핑 (실수 방지)
- 홈(`/`) → **`MainHomePage.tsx`** (NOT ~~HomePage.tsx~~ — 삭제됨)
- 마이페이지(`/user/profile`) → **`UserProfilePage.tsx`**
- 라우트 확인: `App.tsx`의 `<Route>` 컴포넌트 확인 필수

### 자동 배포 규칙 (필수)
- feature 브랜치에 push하면 **PostToolUse 훅**이 자동으로 main에 머지 & 푸시
- 스크립트: `scripts/auto-merge-main.sh`
- **절대 feature 브랜치에만 두지 말 것** — 모든 변경은 main에 반영되어야 배포됨

### 변경 후 체크리스트 (필수)
1. `bash scripts/check-schema-refs.sh` — 스키마 금지 컬럼 검출
2. `bash scripts/check-api-auth.sh` — 인증 누락 검출
3. `npx tsc --noEmit --skipLibCheck` — TS 에러 0개
4. `npx vite build` — 빌드 성공
5. `git push origin <branch>` — 훅이 자동으로 main 머지 & 배포
6. Actions 탭에서 **녹색 성공** 확인

### 절대 하지 말 것
- ❌ Service Worker 등록 (`navigator.serviceWorker.register`) — sw.js 배포 누락 위험
- ❌ `_redirects`에 `/* /index.html 200` — Workers에서 무한 루프
- ❌ `_headers`에 2000자 초과 줄 — Workers 배포 실패
- ❌ `wrangler.toml`에서 `new_classes` 사용 — free plan은 `new_sqlite_classes` 필요
- ❌ **파일 중간에 `import` 문 추가** — ES module 표준 위반, 런타임 crash 유발
  (2026-04-22 `webhook.routes.ts:86` 중간 import → 셀러/어드민/에이전시 로그인 전부 500 사고)
- ❌ **Worker 코드에서 `await import('@/...')` 금지** — dynamic import + path alias 조합은 런타임 crash
  - TypeScript `paths` alias(`@/*`)는 **컴파일 시 힌트**일 뿐, JS 런타임에 존재하지 않음
  - Static import는 esbuild가 빌드 시 실제 파일로 교체 → OK
  - Dynamic import는 문자열 그대로 번들에 남음 → JS engine이 `@/foo` 모듈을 못 찾아 crash
  - 반드시 **상대경로**로: `await import('../../features/foo')`
  - 예외: 순수 프론트엔드 파일(pages/components/shared/stores 등)은 Vite가 alias resolve → OK
  - 이중 방어 (2026-04-22 강화):
    1. `esbuild.worker.config.js` 의 `alias: { '@': path.resolve(__dirname, 'src') }` — 빌드 시 resolve
    2. Pre-commit hook이 `src/{worker,features,shared,lib}/` 하위 파일에서 `await import('@/...')` 감지 시 차단
