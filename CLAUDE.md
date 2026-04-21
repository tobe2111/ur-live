# CLAUDE.md — 유어딜 프로젝트 개발 규칙

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
| order_items | product_thumbnail, product_sku | 존재하지 않음 |
| live_streams | viewer_count | current_viewers |
| donations | status | payment_status |

### Status 값 대소문자 규칙
- orders.status: **대문자** ('PENDING', 'PAID', 'DONE', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED')
- payment_status: **소문자** ('pending', 'completed', 'failed', 'cancelled')
- `payment_status = 'approved'`는 **존재하지 않음** → `status IN ('PAID','DONE')` 사용

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

⚠️ **두 개의 배포 대상이 있음**:
- `live.ur-team.com` → **Cloudflare Workers** (`wrangler deploy`) — 백엔드 API + 프론트엔드
- `ur-live.pages.dev` → **Cloudflare Pages** (`wrangler pages deploy`) — 프론트엔드만

GitHub Actions (`main.yml`)가 **둘 다** 배포함. Workers를 빠뜨리면 `live.ur-team.com`에 변경사항이 미반영.

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
