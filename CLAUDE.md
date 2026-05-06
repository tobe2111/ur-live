# CLAUDE.md — 유어딜 프로젝트 개발 규칙

## 🎨 디자인 시안 archive 룰 (필수)

사용자가 디자인 시안 (이미지/스크린샷) 을 보낼 때:

1. **반드시 `docs/design/<page-name>.md` 에 저장** — 채팅 이미지는 세션 끝나면 사라져 다음 세션이 못 봄
2. 파일 구조: 시안 설명 + 현재 vs 시안 차이 표 + 구현 todo 체크리스트
3. **구현 전이라도** 시안 받은 즉시 commit + push (다음 세션 / 다른 에이전트가 추적 가능)
4. 구현 완료 시 같은 파일 하단에 `## ✅ 구현 완료` + commit hash 추가
5. 미구현 시안 목록은 `docs/design/README.md` 의 표에 등록

> ⚠️ 이 룰을 안 지키면: 시안이 채팅에서 잊혀지고 → 구현 안 됨 → 사용자가 "왜 이거 안 됐어?" 질문 반복.


## 📖 운영 가이드 3종 자동 업데이트 규칙 (필수)

유어딜에는 **3개의 운영 가이드** 가 있으며, 모두 DB(`operation_guides` 테이블)에 저장됩니다:

1. **어드민 가이드** (`guide_type='admin'`) — `/admin/operations-guide`
2. **셀러 가이드** (`guide_type='seller'`) — `/seller/guide`
3. **에이전시 가이드** (`guide_type='agency'`) — `/agency/guide`

**시드 데이터 파일**: `src/features/guides/api/guide-seed.ts`
- DB가 비어있을 때 자동 시드됨 (각 role 의 `ensureSeeded()` 에서)
- 어드민이 UI에서 편집하면 DB가 시드를 덮어씀 (시드는 최초 1회만)

### 코드 변경 시 반드시 함께 업데이트

- **새 API 엔드포인트** 추가 → 영향받는 역할의 가이드 섹션에 반영
  - 예: `/api/seller/bundles` 추가 → 셀러 가이드의 "상품 관리" 섹션에 번들 설명 추가
- **새 관리자 페이지** 추가 → 어드민 가이드 "유용한 링크" + 해당 운영 섹션
- **정산/주문 플로우 변경** → 어드민 "주문 관리"/"정산 처리" + 셀러 "주문 처리"/"정산 받기" 동시 업데이트
- **수수료율 변경** → 어드민 "셀러 관리"/"에이전시 관리" + 셀러 "환영" + 에이전시 "시작" 동시 업데이트
- **장애 발생 및 해결** → 어드민 "기술 장애 대응" 섹션에 사례 추가
- **FAQ 추가** → 해당 역할 가이드의 "자주 묻는 문제" 섹션

### 업데이트 방법

**옵션 A (권장)**: `guide-seed.ts` 의 기본 시드를 수정 + 프로덕션 DB에서 해당 섹션을 DELETE → 재시드

**옵션 B**: 프로덕션에서 관리자가 `/admin/operations-guide` 에서 직접 편집

> ⚠️ 어드민이 UI에서 편집한 내용은 `guide-seed.ts` 변경과 별개로 DB에 저장됩니다.
> 두 곳 모두 최신 상태를 유지하려면 seed 도 함께 업데이트하고,
> 배포 후 관리자에게 "seed 업데이트됨, UI 편집 내용과 merge 필요" 알림 필요.

### ⚙️ 자동 강제 시스템 (`scripts/check-guide-sync.sh`)

Pre-commit hook이 다음 파일 변경 시 `guide-seed.ts` 동시 수정 여부를 검사합니다:

| 변경 파일 | 영향받는 가이드 |
|---|---|
| `src/pages/Seller*.tsx`, `src/features/(seller\|youtube)/api/*.ts` | 셀러 |
| `src/pages/Admin*.tsx`, `src/worker/routes/*.ts` | 어드민 |
| `src/pages/Agency*.tsx`, `src/features/agency/api/*.ts` | 에이전시 |
| `src/features/auth/api/*.ts` | 모두 |

**기본**: warn-only (커밋 진행하되 경고 표시)
**차단 모드**: `STRICT_GUIDE_SYNC=1 git commit ...`

### 🤖 자동 생성 참조 섹션 (`scripts/generate-guide-references.mjs`)

각 역할 가이드 끝에 **"코드 자동 참조" 섹션이 자동 추가**됩니다 (key=`auto-reference`, order=999):

- **자동 추출 대상**:
  - 페이지 라우트 (`src/App.tsx` 의 `<Route path="...">`)
  - API 엔드포인트 (`src/features/*/api/*.routes.ts`, `src/worker/routes/*.routes.ts` 의 `app.get/post/put/delete/patch`)
  - 마운트 prefix (`app.route('/api/seller/...', sellerRoutes)`, `adminApp.route(...)`)

- **분류**: prefix 기반 (`/admin/*`, `/seller/*`, `/agency/*`)

- **출력**: `src/features/guides/api/auto-reference.ts` (auto-generated, 수동 편집 금지)

- **자동 실행**:
  - Pre-commit hook: 라우트/페이지 변경 시 자동 재생성 + staged 추가
  - 수동: `npm run generate:guide-refs`

코드 변경 PR 작성 시 가능하면 같은 PR에 가이드 narrative 업데이트도 포함하세요.
auto-reference 섹션은 자동이므로 신경 안 써도 됨. narrative(개념/플로우 설명)만 수동 업데이트.

후속 PR로 미루면 커밋 메시지에 `guide-update-pending` 명시.

## 🚨 기술 부채 & 알려진 이슈 (2026-04-27 갱신)

**남은 기술 부채는 `TECHNICAL_DEBT.md` 참조.** 특히 주의:
- 🔴 DB Migration CI 파이프라인 미작동 (D1 권한 없음) → `/api/_internal/repair-schema` 응급 처치 중. 적용 상태 확인은 `/api/_internal/migration-status` (admin, 읽기 전용).
- 🟢 시크릿 회전 완료 (2026-04-27): JWT/Refresh/Cron/Toss-Webhook 4종 + Toss live sk/ck 재발급. 이전 노출 시크릿은 무효화됨.
- 🟡 git history 시크릿 잔존 (commit 204f2f9 등) — 의식적 무시 처리. 모든 값 무효 상태라 실해 없음.
- 🟢 Co-mounted routing (/api/orders, /api/seller) — path 충돌 0건 확인 (2026-04-26, `docs/DOUBLE_ROUTING_AUDIT.md`). worker = 핵심 CRUD, feature = 부가 기능. /api/payments 의 dead `/rollback` 제거 완료.
- 🟡 스키마 이중화 컬럼 (stock/stock_quantity, shipping_fee/base_shipping_fee)
- 🟢 신규 에이전시 cron (tier-eval, monthly-tasks, monthly-invoices, creator-eval, auto-settle, campaigns-aggregate, tiktok-videos-sync) — Feature flag kill switch 로 보호됨. emergency-mode endpoint 로 일괄 OFF 가능.

### 시크릿 회전 메모 (2026-04-27)
- 4종 secrets 회전: PowerShell `[Security.Cryptography.RandomNumberGenerator]` 로 사용자가 직접 생성 → Cloudflare Pages Variables 에 등록
- Toss `TOSS_WEBHOOK_SECRET` 은 토스 대시보드 "보안 키" (hex 64) 와 동일해야 함. 우리 코드는 HMAC-SHA256 검증만 수행 (`webhook.routes.ts:90` `verifyTossSignature`)
- `ENVIRONMENT=production` (Plain text) 등록 필수 — 미등록 시 webhook 서명 검증이 우회됨
- 운영 MID 는 `urteamizy1` 만 사용 (`cp_urteamw10d` 는 잘못 등록된 것, 의식적 방치)

## 📐 PC 반응형 디자인 시스템 (2026-05-02 도입)

### 배경
이전 (~2026-05-01): PC 에서도 모든 사용자 페이지가 `max-w-[430px]` 모바일 폭으로 강제됨.
사용자 결정: 모든 페이지가 PC 화면 전체를 활용하되, 디자인 시스템을 일관되게 따라야 함.

### 핵심 원칙

1. **모바일 First**: 기존 모바일 디자인 그대로 (변경 없음)
2. **PC 활용**: `lg:` (1024px+) / `xl:` (1280px+) / `2xl:` (1536px+) Tailwind variants 로 desktop layout 구성
3. **콘텐츠 폭 토큰** (`src/index.css`):
   - `ur-content-narrow` (720px) — form / 결제 / 가입 페이지
   - `ur-content-medium` (1024px) — 기사 / 가이드 / 약관 페이지
   - `ur-content-wide` (1280px) — 쇼핑 / 상품 그리드 / 마이페이지
   - `ur-content-full` (1536px) — 어드민·셀러 대시보드 (이미 적용됨)
4. **모바일 액자 유지 페이지** (9:16 비디오):
   - `/live/*`, `/shorts` — `MobileAppLayout` 의 `MOBILE_ONLY_PREFIXES` 매칭 → `data-mobile-only="true"` 부착
   - PC 에서도 430px 액자 + box-shadow 유지

### 페이지별 패턴

| 페이지 종류 | 폭 토큰 | 핵심 변환 |
|---|---|---|
| **쇼핑 그리드** (BrowsePage, WishlistPage) | `ur-content-wide` | `grid-cols-2` → `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5` |
| **상품 상세** (ProductDetailPage) | `ur-content-wide` | mobile 1열 → lg에서 좌(이미지 갤러리) / 우(상세+구매) 2단 |
| **결제/주문** (CheckoutPage, MyOrdersPage) | `ur-content-narrow` | mobile 그대로, PC 에서 가운데 정렬 +좌우 여백 |
| **마이페이지** (UserProfilePage) | `ur-content-medium` | mobile 1열 → lg에서 좌(프로필) / 우(메뉴) 2단 |
| **홈** (MainHomePage) | `ur-content-wide` | hero + region picker 가운데, 라이브 카드 그리드는 PC 에서 4-5열 |
| **라이브** (LivePageV2) | `data-mobile-only="true"` | 9:16 풀스크린 유지, PC 에서도 430px 액자 (TikTok 스타일 좌측 사이드바는 별도 PR) |
| **셀러/어드민/에이전시** | (변경 없음) | 이미 EXCLUDE_MOBILE_LAYOUT — 풀 너비 대시보드 |

### 새 페이지 작성 시 체크리스트

1. **mobile 우선**: 기존 디자인 그대로 (430px 가정 OK)
2. **PC 활용**:
   - 외부 wrapper: `<div className="ur-content-wide px-4 lg:px-8">` 같은 패턴
   - 그리드: `grid-cols-2` → `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`
   - 폰트: `text-xl` → `text-xl lg:text-3xl` (제목)
   - 간격: `gap-3` → `gap-3 lg:gap-6`
3. **sticky header / footer**: 풀너비 sticky 유지하되, 내부 콘텐츠는 `ur-content-*` 로 centered
4. **9:16 비디오 페이지**: `MOBILE_ONLY_PREFIXES` 에 path 추가 (라이브/쇼츠 같은 경우)
5. **테스트**: 모바일 (≤640px) / 태블릿 (768px) / 데스크톱 (1280px) / wide (1920px) 4가지 뷰포트 확인

### 현재 적용 상태 (2026-05-03 — 거의 완료)

**✅ ur-content-* 토큰 적용 페이지 (20+)**:
- BrowsePage / SearchPage / WishlistPage (wide + grid 2-5열)
- ProductDetailPage (wide + lg:grid-cols-5 좌이미지/우정보 sticky)
- MainHomePage (wide + 라이브/예정/다시보기 4-5열, 카테고리 5/6/8/10)
- LiveListPage / GroupBuyListPage / SellerPublicPage (그리드 2-5열)
- CheckoutPage / CartPage / PointsChargePage / ReferralIndexPage (narrow)
- MyOrdersPage / UserProfilePage / FAQPage / Privacy/Terms/Refund (medium)
- AddressManagementPage / AccountSettingsPage / MyVouchersPage / MyCouponsPage / MyReviewsPage / NotificationsPage (narrow)
- AffiliatePage / GiftClaimPage / InterestListPage / StoreStatsPage / ReferralPage (narrow)
- 404 / 500 / AccountDeleted (자체 max-w-xl/lg)

**✅ App.tsx 430px 강제 제약 제거** (2026-05-03):
- `<div className="max-w-[430px] mx-auto bg-white">` 래퍼 → `<div className="min-h-dvh">` 만
- 페이지가 자체 ur-content-* 로 max-width 결정
- /live/:id, /shorts 만 MobileAppLayout 의 data-mobile-only 로 430px 액자 유지

**✅ ur-content-* 클래스 — width 100% 명시 (모바일 좁은 컬럼 fix)**:
- flex-col 부모 안에서 `margin: auto auto` 가 align-self: stretch 해제하던 버그 → `width: 100%` 추가

**✅ PC 사이드바 패턴 모든 페이지 확장** (2026-05-03):
- 신규 `DesktopTopNav` (lg+ 상단 네비) + 기존 `DesktopLiveSidebar` (xl+ 좌측 사이드바)
- BottomNav 에 `lg:hidden` 추가 — PC 에서 숨김
- MobileAppLayout 에 `xl:pl-56` (사이드바 224px) + `2xl:pr-72` (라이브 우측 패널) 자동 적용
- HIDE_SIDEBAR_PREFIXES (셀러/어드민/에이전시/embed/checkout-return/introduce) 만 사이드바 제외

## 테마 규칙 (필수)

페이지를 생성하거나 수정할 때 **반드시** 해당 페이지의 테마에 맞는 색상을 사용합니다.

### 다크 테마 페이지 (유저 대면 메인)
- **해당**: 홈(`/`), 라이브(`/live/*`), 쇼츠(`/shorts`), 마이페이지(`/user/profile`), 알림(`/notifications`), 셀러 공개(`/profile/*`, `/s/*`)
- **배경**: `bg-[#020202]` (메인), `bg-[#121212]` (카드), `bg-[#1A1A1A]` (서브)
- **텍스트**: `text-white` (제목), `text-gray-300` (본문), `text-gray-400`~`text-gray-500` (보조)
- **보더**: `border-[#1A1A1A]`, `border-[#2A2A2A]`
- ❌ 절대 금지: `text-gray-900`, `text-gray-800`, `text-gray-700`, `bg-white`, `border-gray-200`

### 화이트 테마 페이지 (쇼핑/결제) — 사용자 다크 모드 토글 지원
- **해당**: 쇼핑(`/browse`), 장바구니(`/cart`), 결제(`/checkout`), 상품상세(`/products/*`), 주문내역(`/my-orders`), 검색(`/search`), 위시리스트(`/wishlist`), 배송지(`/mypage/addresses`), 계정설정(`/account/*`), 공동구매(`/referral/*`), 맛집지도(`/restaurant-map`), 딜충전(`/points/charge`)
- **배경**: `bg-white` (메인), `bg-gray-50` (서브)
- **텍스트**: `text-gray-900` (제목), `text-gray-600` (본문), `text-gray-500` (보조)
- **보더**: `border-gray-100`, `border-gray-200`
- ❌ 절대 금지: `text-white` (컬러 버튼 위 제외), `text-gray-100`, `bg-[#020202]`, `bg-[#121212]`, `border-[#333]`, `hover:bg-[#333]`

#### 🌗 사용자 다크 모드 토글 (2026-05-02)
- 화이트 테마 페이지는 **사용자가 `/account/settings` 의 "화면 테마" 섹션에서 시스템 / 라이트 / 다크 선택 가능**
- 인프라: `useTheme` 스토어 (`src/shared/stores/useTheme.ts`) + `<html class="dark">` 토글 + Tailwind `darkMode: 'class'`
- **새 페이지·컴포넌트 작성 시 dark: variant 동시 추가 필수**. 표준 매핑:

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

- 자동 마이그레이션 스크립트: `perl /tmp/dark_migrate.pl <files...>` (사용 후 git diff 검토 필수)
- 첫 페인트 FOUC 방지: `index.html` inline script 가 `localStorage.ur_theme_mode_v1` 읽고 `<html>` 에 `dark` 클래스 선반영
- **다크 테마 페이지 (홈/라이브/마이) 와 셀러·어드민 라이트 테마는 토글 무영향** — 페이지 단에서 `bg-[#020202]` / `bg-white` 가 명시 강제되어 있어 `dark:` variant 가 매칭되지 않음 (의도된 동작)

> ⚠️ **2026-05-03 시도/롤백**: 글로벌 CSS override (`html:not(.dark)` selector)로 다크 페이지를 light 모드 시 invert 시도 → 사용자 신고 "모든 페이지 UI 깨짐" → 즉시 revert. 향후 "모든 페이지 토글" 구현은 페이지별 명시 `dark:` variant 추가 (글로벌 invert 금지).

### 화이트(라이트) 테마 — 셀러/어드민/에이전시 대시보드 (테마 토글 무영향, 고정 — 절대 변경 금지)
- **해당**: 셀러(`/seller/*`), 어드민(`/admin/*`), 에이전시(`/agency/*`)
- **배경**: SellerLayout/AdminLayout/AgencyLayout 이 처리 (`#F4F5F7`)
- **텍스트**: `text-gray-900` (제목), `text-gray-700` (본문)
- **🚨 절대 규칙 (사용자 명령, 위반 즉시 차단)**:
  - 대시보드는 사용자 다크 모드 토글에 절대 영향받지 않아야 함
  - 페이지/컴포넌트에 `dark:` variant 추가 절대 금지
  - 향후 다크 모드가 다시 활성화되더라도 대시보드는 항상 화이트 유지
  - `scripts/check-dashboard-theme.sh` (pre-commit hook) 가 위반 차단
- **현재 상태**: dark 모드 활성 (2026-05-04 재활성). `useTheme.applyToDocument` 가 정상 동작.
  → 쇼핑/결제 페이지는 사용자 토글에 따라 `html.dark` 적용. `dark:` variants 정상 매칭.
  → 단, 대시보드(셀러/어드민/에이전시)는 아래 절대 금지 규칙에 의해 토글 무영향 유지.
- ❌ 절대 금지: `text-white` (컬러 버튼 위 제외), `dark:` variants (`dark:bg-...` 등) — **대시보드에만 해당**

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
2. **권한 검증** (🚨 IDOR 방지 — 2026-04-27 사고 후 강화):
   - POST/PATCH/DELETE는 본인/본인 소속 리소스만 수정 가능
   - `resource.seller_id === authenticatedSellerId` 같은 소유권 체크
   - **body/query 의 user_id/seller_id 를 인증 없이 신뢰하지 말 것**
   - 토큰 발급/세션 생성 endpoint 는 호출자 본인 검증 (session cookie OR 외부 ID token verify) 필수
3. **입력 검증**:
   - 숫자: `Number.isFinite()`, 범위 체크 (가격 0~1억, 재고 0~100만 등)
   - 문자열: 길이 제한
   - enum: 허용된 값만
4. **서버 재계산**:
   - 결제 금액은 **절대 클라이언트 값 신뢰 금지**
   - `SELECT price FROM products WHERE id IN (...)` 서버에서 다시 조회
5. **Rate limit** (민감한 엔드포인트):
   - `/login`, `/register`, `/forgot-password`, `/pay`, `/donate`, `/review` 등
   - 🛡️ **운영 필수**: `RATE_LIMIT_KV` Dashboard Bindings 등록 (미등록 시 비-인증 fail-OPEN)
   - 검증: `curl -I https://live.ur-team.com/api/products` → `X-RateLimit-Limit` 헤더 있어야 정상
6. **Bot challenge (Turnstile)** — 분산 봇 brute-force 방어 추가 layer:
   - `verifyTurnstile(c.env.TURNSTILE_SECRET, body.turnstile_token, ip)` 사용
   - 적용 권장: login / register / donate / group_buy_create
   - 현재 적용: `/api/donations/init` (2026-05-03)
   - `TURNSTILE_SECRET` 미설정 시 fail-open (즉시 활성 안전)
   - frontend: `<TurnstileWidget onVerify={token => setTurnstileToken(token)} />`
7. **Idempotency**:
   - 결제 관련 Toss API 호출 시 `Idempotency-Key` 헤더 필수
7. **에러 처리**:
   - try-catch 래핑
   - 조용히 삼키지 말고 DEV 모드에서 로깅
8. **i18n fallback**:
   - `t('X') || '한글'` 사용 금지 (i18next 가 missing key 시 key 자체 반환 → fallback 미동작)
   - 대체: `t('X', { defaultValue: '한글' })`

### 절대 하지 말 것
- ❌ `debug-*` 엔드포인트 프로덕션 배포
- ❌ 클라이언트 값으로 금액 계산 (해킹 취약점)
- ❌ `.catch(() => {})` 로 에러 완전 무시
- ❌ 권한 체크 없는 POST/PATCH/DELETE
- ❌ `SELECT *` with LIMIT/OFFSET but no ORDER BY
- ❌ 하드코딩된 내부 API 토큰
- ❌ `Function('p', 'return import(p)')(...)` 패턴에 **사용자 입력 전달**
  - 현재 사용처 (`src/components/my-page/reward-ad-card.tsx:67`) 는 하드코딩된 패키지명 (`@capacitor-community/admob`) 만 받아 안전.
  - 동적 import 가 필요한 이유: Capacitor native 플러그인을 웹 번들에서 제외하기 위함.
  - 새로 추가 시: 입력 문자열이 hardcoded 인지 반드시 확인. 사용자 입력 / API 응답 / URL 파라미터에서 온 값 절대 금지 (RCE 위험).

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

### 🛡️ Redirect / returnUrl 안전 규칙 (2026-04-29 추가)

OAuth 콜백·로그인 페이지·401 핸들러 등에서 외부 입력 (returnUrl, state, redirect 파라미터) 을 navigate / window.location.href 로 그대로 사용하지 말 것. **반드시 `safeInternalPath()` 통과**:

```ts
import { safeInternalPath } from '@/utils/safe-internal-path'

// ❌ 위험 — 자기참조 / open redirect 무한루프 가능
const returnUrl = searchParams.get('returnUrl') || '/'
navigate(returnUrl)

// ✅ 안전
const returnUrl = safeInternalPath(searchParams.get('returnUrl'), '/')
navigate(returnUrl)
```

**자동 차단**: `/login`, `/seller/login`, `/admin/login`, `/agency/login`, `/auth/*`, `/oauth/*`, 외부 URL, protocol-relative `//`, backslash, 제어문자.

**Worker 코드** (`src/features/*/api/*.routes.ts`, `src/worker/`) 는 alias `@/` import 못 함 → `src/features/auth/api/kakao.routes.ts:safeRedirect()` 가 동일 규칙을 인라인으로 유지. **양쪽 같이 갱신할 것**.

### 🛡️ 외부 스킴 redirect 가드 의무 (2026-04-29 사고 후 룰화)

`window.location.href = 'kakaotalk://...'` / `'intent://...'` / `'line://...'` 등 외부 스킴 redirect 는 **반드시 sessionStorage 가드**. webview reload (메모리/포커스 손실) 시 무한 재시도 폭주.

```js
// ❌ 위험 — 카톡 인앱에서 무한 reload
window.location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url)

// ✅ 안전 — 1회 가드
if (sessionStorage.getItem('ur_kakao_external_redirect_v1') !== '1') {
  sessionStorage.setItem('ur_kakao_external_redirect_v1', '1')
  window.location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url)
}
```

**inline script + module script 가 같은 가드를 공유**할 땐 키 이름 명시 + 두 곳 동시 수정. 사고 사례: `index.html` inline 과 `main.tsx autoRedirectKakaoToExternal` 가 키 공유 안 해 inline 만 무한 루프 발생 (2026-04-29).

## DB 스키마

- 프로덕션 DB 컬럼명은 `src/shared/db/production-schema.ts` 참조
- `stock` (not `stock_quantity`), `is_active` (not `status`), `credit_amount` (not `seller_amount`)

## 딜 포인트 시스템

- 충전: 1원 = 1딜 (수수료 없음)
- 후원/상품 결제: 딜 즉시 차감
- 셀러 정산: 기본 **5%** 플랫폼 수수료 (`platform_settings.commission_rate_default = 5`).
  어드민이 셀러별로 `sellers.commission_rate` 조정 가능. 후원 수수료는 별도 15% (`commission_rate_donation`).
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

### 2026-04-29 사고 요약 — 카카오 모바일 로그인 무한 루프
- 증상: 카카오톡 인앱 브라우저 → live.ur-team.com 로그인 시 webview 무한 reload.
- 원인: `index.html` inline script 가 `window.location.href = 'kakaotalk://web/openExternal?url=...'` 를 sessionStorage **가드 없이** 매 페이지 로드마다 시도. `main.tsx` 의 `autoRedirectKakaoToExternal()` 는 가드 있었지만 inline script 가 먼저 실행 → 무력화. 카톡 webview reload (메모리/포커스) 시 무한 재시도.
- 즉시 수정 (`d750fad`): inline script 에 `ur_kakao_external_redirect_v1` sessionStorage 가드 추가 (main.tsx 와 키 공유).
- 후속 강화 (`5952279`, `2026-04-29 C+추가`): 같은 종류 패턴 (returnUrl 자기참조 / 가드 누락) 전수조사 + `src/utils/safe-internal-path.ts` 단일 헬퍼 도입.
- 교훈:
  1. **외부 스킴 redirect (`kakaotalk://`, `intent://`, `line://`) 는 반드시 sessionStorage 가드** — webview reload 시 재시도 폭주.
  2. **returnUrl / state / redirect 파라미터는 항상 `safeInternalPath()` 통과** — `/login`, `/auth/*`, `/oauth/*` 자기참조 차단. 직접 검증 로직 작성 금지.
  3. **inline script + module script 가 같은 가드를 공유**할 땐 키 이름 명시 + 두 곳 동시 수정.
- 관련 파일:
  - `src/utils/safe-internal-path.ts` (Single Source of Truth — 프론트엔드)
  - `src/features/auth/api/kakao.routes.ts:safeRedirect()` (Worker 코드라 import 못 함, **인라인으로 동일 규칙 유지**)
  - 적용: `LoginPage`, `RouteGuards.PublicRoute`, `KakaoCallbackPage`, `KakaoConsentCallbackPage`

### 파일-라우트 매핑 (실수 방지)
- 홈(`/`) → **`MainHomePage.tsx`** (NOT ~~HomePage.tsx~~ — 삭제됨)
- 마이페이지(`/user/profile`) → **`UserProfilePage.tsx`**
- 라우트 확인: `App.tsx`의 `<Route>` 컴포넌트 확인 필수

### 🛡️ /api/seller 라우터 매핑 도표 (2026-04-22 배치 118 · TD-013)

`/api/seller` prefix 로 여러 라우터가 마운트됨. Non-overlapping 하도록 sub-path 분리.
**새 엔드포인트 추가 시 이 표 먼저 확인.**

| Prefix | 라우터 | 파일 | 등록 path |
|---|---|---|---|
| `/api/seller` | sellerAuthRoutes | `features/auth/api/seller-auth.routes.ts` | `/login`, `/register`, `/refresh`, `/forgot-password` |
| `/api/seller` | sellerManagementRoutes | `features/seller/api/seller-management.routes.ts` | `/profile`, `/business-info`, `/stats`, `/settlements`, `/change-password`, `/upload-image`, `/register-from-user`, `/switch-to-*` |
| `/api/seller` | sellerPinRoutes | `features/seller/api/seller-pin.routes.ts` | `/set-pin`, `/verify-pin`, `/pin-status`, `/request-kakao-stepup` |
| `/api/seller` | sellerOrdersRoutes | `features/seller/api/seller-orders.routes.ts` | `/orders`, `/orders/:id/*`, `/products`, `/products/:id/*` |
| `/api/seller` | sellerDonationsRoutes | `features/donations/api/seller-donations.routes.ts` | `/donations`, `/donations/summary`, `/donations/settlements` |
| `/api/seller/analytics` | sellerAnalyticsRoutes | `features/seller/api/seller-analytics.routes.ts` | (전용 prefix) |
| `/api/seller/streams` | sellerStreamsRoutes | `features/seller/api/seller-streams.routes.ts` | (전용 prefix) |
| `/api/seller/alimtalk` | alimtalkRoutes | `features/alimtalk/api/alimtalk.routes.ts` | `/credits`, `/logs` 등 (전용 prefix) |
| `/api/seller/restaurant-settlements` | sellerSettlementRoutes | (전용 prefix) |
| `/api/seller/youtube` | youtubeRoutes | `features/seller/api/youtube.routes.ts` | (전용 prefix) |
| `/api/sellers` | sellersRouter | `worker/routes/seller.routes.ts` | `/`, `/:id`, `/:id/public`, `/:sellerId/products-public` (복수형! 공개 조회용) |

**주의**: `/api/seller` 복수 라우터는 path 충돌 시 **등록 순서** 대로 우선권. 현 순서는 auth → management → pin → orders → donations. 새 라우터 추가 시 기존 path 와 겹치는지 먼저 확인.

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
- ❌ **Service Worker 등록 + PWA 라이브러리** (`vite-plugin-pwa`, `workbox-window`, `navigator.serviceWorker.register`)
  - 2026-04-27 사고: vite-plugin-pwa 의 navigateFallback 가 카카오 OAuth `/auth/kakao/start?redirect=...` 까지 가로채 ERR_FAILED → **모든 사이트 다운**
  - 'FetchEvent resulted in a network error: a redirected response was used for a request whose redirect mode is not "follow"'
  - 복구: Killer sw.js 배포 + 의존성 제거 + main.tsx 강제 unregister
  - 재도입 시 필수:
    1. `redirect: 'follow'` 명시 (OAuth 호환)
    2. `/auth/*`, `/oauth/*`, `/api/*` denylist 추가
    3. e2e 테스트로 카카오 로그인 흐름 사전 검증
    4. PR 단독 + 1주 prod 안정 확인 후 다음 작업
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
