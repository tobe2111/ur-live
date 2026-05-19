# 🚧 진행 중 작업

**최종 업데이트**: 2026-05-19 (KT Alpha B2B API 완전 통합 5 PRs)
**최근 main 머지 커밋**: `e5f66093` (KT Alpha final — 셀러 voucher 모달 + 발송 이력 + 잔액 알림)

## 📦 2026-05-19 세션 — KT Alpha (기프티쇼) B2B API 통합

**비사업자 셀러** 정산 대안 완성 — 적립금으로 KT Alpha 기프티쇼 상품권 받기.

| PR | Commit | 범위 |
|---|---|---|
| 1 | `d9302be3` | foundation — giftishow-api.ts utility + 0101 listGoods + 0111 getGoodsDetail |
| 2 | `d3bfd177` | 0201 getCouponInfo + 0202 cancelCoupon + 에러 매핑 일부 |
| 3 | `7958c88a` | 0203 resendCoupon + 0204 sendCoupon + 0301 getBizMoneyBalance + 에러 코드 40+ 매핑 |
| 4 | `d9805d6` | 어드민 페이지 (\`/admin/kt-alpha\`) + 카탈로그 sync cron + 셀러 voucher 발송 endpoint |
| 5 | `e5f66093` | 셀러 voucher 발송 모달 + 발송 이력 페이지 + 잔액 부족 자동 알림 |

### 신규 파일
- \`src/worker/utils/giftishow-api.ts\` — 7개 API (0101/0111/0102/0112/0201/0202/0203/0204/0301) + 에러 매핑
- \`src/features/admin/api/admin-kt-alpha.routes.ts\` — 어드민 5 endpoints
- \`src/pages/AdminKtAlphaPage.tsx\` — 어드민 설정/잔액/카탈로그 페이지
- \`src/pages/SellerVoucherOrdersPage.tsx\` — 셀러 발송 이력
- \`src/worker/cron/kt-alpha-catalog-sync.ts\` — 매일 03:00 UTC sync
- \`migrations/0264_kt_alpha_gift_catalog.sql\` — gift_catalog 테이블
- \`migrations/0265_kt_alpha_markup.sql\` — markup_pct, user_id, callback_no 설정

### 셀러 통합
- \`SellerSettlementsPage\` 에 VoucherRedeemModal 추가 — '🎁 상품권으로 받기' 버튼
- \`/api/seller/voucher-catalog\` — 활성 상품 + 마진 포함 가격
- \`/api/seller/voucher-redeem\` — 발송 + 적립금 차감 + voucher_orders 기록
- \`/api/seller/voucher-orders\` — 발송 이력 조회

### 자동 모니터링
- cron 매일 KT Alpha 0301 잔액 호출 → \`platform_settings.kt_alpha_biz_money_balance\` 저장
- 10만 원 이하 시 \`admin_dashboard_notifications\` 자동 추가 (24h 중복 방지)
- 잔액 0 시 즉시 차단 경고

### 운영 가이드 업데이트 (본 PR)
- 어드민 가이드: \`kt-alpha-admin\` + \`stay-voucher-admin\` 섹션 추가
- 셀러 가이드: \`seller-voucher-kt-alpha\` 섹션 추가

### 🔴 운영 측 액션 필요 (별도 작업 — 코드로 처리 불가)
1. **KT Alpha 상용 Key 신청** — \`/admin/kt-alpha\` 페이지 스크린샷 4종 첨부
2. **wrangler secret put** — KT_ALPHA_AUTH_CODE, KT_ALPHA_TOKEN_KEY, KT_ALPHA_AUTH_TOKEN
3. **Cloudflare Dashboard** — R2 bucket 'ur-live-media' 생성 + MEDIA_BUCKET binding
4. **D1 production** — migration 0264 + 0265 적용 (\`wrangler d1 execute\`)
5. **카탈로그 초기 sync** — 어드민 페이지 'Sync 지금 실행' 버튼 (수동 1회)

## 📦 2026-05-18 세션 누적 (대량 작업)

### 🏨 숙소 공구 (stay_voucher) 완전 구현 — 6 PRs

야놀자/Booking.com 수준 완전 구현. 5000+ 줄, 8 페이지, 30+ endpoints, 1 cron.

| PR | Commit | 범위 |
|---|---|---|
| 1 | `fab38759` | DB schema (8 tables) + Backend CRUD (28 endpoints) |
| 2 | `386f9006` | 셀러 UI — 등록/객실/캘린더 (3 페이지) |
| 3 | `0bcb647c` | 사용자 검색/상세/예약 (2 페이지) |
| 4 | `ba8c1e32` | 셀러 KPI (OCC/ADR/RevPAR) + 예약 처리 |
| 5 | `ad8fd93d` | 어드민/에이전시 모니터링 + 분쟁 처리 |
| 6 | `1317c7d3` | 알림 cron + 환불 자동화 + 리뷰 작성 |

신규 테이블 8종:
- `product_stay_info`, `product_stay_rooms`, `product_stay_calendar`
- `stay_bookings`, `stay_booking_reviews`, `stay_booking_status_log`
- `stay_property_amenities` (30개 시드)
- `orders` 에 stay_booking_id 등 4 컬럼 추가

신규 페이지: `/seller/stays`, `/seller/stays/new`, `/seller/stays/:id`,
`/seller/stays/bookings`, `/stays`, `/stays/:id`, `/my-stays`,
`/admin/stays`, `/agency/stays`

### 💳 사업자등록 게이팅 정산 시스템 (Phase 1)

- migration `0257_business_reg_gated_settlement.sql` — sellers 컬럼 + 4 신규 테이블
  (`seller_deal_balances`, `seller_deal_transactions`, `voucher_orders`, `tax_withholding_log`)
- POST /api/seller/settlements/request — verified 셀러만 (412 BUSINESS_REGISTRATION_REQUIRED)
- GET /api/seller/settlement-options — 3 방식 (cash/voucher/deal) + 검증 상태
- POST /api/seller/business-registration/submit — 셀러 제출
- PATCH /api/admin/sellers/:id/business-registration/verify — 어드민 검증
- SellerSettlementsPage 에 검증 상태 배너 + 모달

### 🎨 UI 개선 (다수)

- `ad953313`: Hero 카테고리 monochrome 통일 (촌스러운 컬러 배경 제거)
- `6e5fc29e`: 어드민 배너 제목 optional (이미지만으로 등록 가능)
- `c7fbc88b`: 메인 페이지 오프라인/온라인 대분류 헤더
- `47f2f029`: Group buy 카테고리 탭 6→4 통합
- `c4882404`: 셀러 대시보드 Mode-based IA (라이브/매장)
- `6408723d`: 에이전시 대시보드 Mode-based IA
- `b8be80db`: 셀러 대시보드 홈 Mode-specific KPI

### 🛠️ 어드민 도구

- `d91aaea2`: 라이브 모니터링 — 다시보기 일괄 삭제 (체크박스)
- `a04ce05b`: 라이브 모니터링 삭제 fix (deleted_at 필터)
- `f9d1cb2a`: 상품 관리 — 체크박스 일괄 삭제/활성/비활성
- `1b393d26`: 상품 관리 — 재고 인라인 편집 (색상 시각화)

### 📄 문서

- `a17e2e33`: 공동구매 서비스 회사소개서 (`docs/company-intro-group-buy.md`)
- 본 PR: production-schema.ts 업데이트 (8 stay tables + 4 settlement tables)

## ⏭️ 다음 우선순위 (시장 검증 후 별도 PR)

### 🔴 즉시 적용 필요 (DB)
1. **production D1 에 migration 0257 + 0258 적용**
   - 현재는 코드만 있고 production 스키마 미적용 가능성
   - `/api/_internal/repair-schema` 또는 wrangler d1 execute 로 적용
   - defensive ALTER TABLE 들이 첫 호출 시 자동 처리하지만 인덱스/시드는 별도

### 🟡 후속 PR (필요 시)
1. **결제 PG 환불 자동 트리거** — 토스 API 연동 (현재는 status='cancelled' 마킹만)
2. **카카오 알림톡 실제 발송** — D-1/D-day cron (현재 notifications INSERT only)
3. **객실 이미지 R2 업로드** — 현재 URL 입력만 가능
4. **다객실 한 결제** — 2 객실 동시 예약
5. ~~**KT Alpha 기프티쇼 통합**~~ — ✅ 2026-05-19 완료 (5 PRs, 위 섹션 참조)
6. **8.8% 원천징수 자동 계산** + 지급조서 export (어드민 CSV)

### 🟢 i18n 6개 언어 sync (낮은 우선순위)
새로 추가된 defaultValue 한국어 키들 (~50개+) 6 언어 sync:
- 숙소 공구 관련 라벨 (식사권/미용/숙소/기타 등)
- 사업자등록 정산 안내 텍스트
- KPI 라벨 (OCC/ADR/RevPAR)

### 🐛 사전 이슈 (별도 작업)
- `SellerTermsPage.tsx` — dark: variant 1건 (대시보드 정책 위반)
- `GroupBuyListPage.tsx:246` — TypeScript 경고 (사전 이슈)
- `TECHNICAL_DEBT.md` 의 NOT NULL INSERT 5건 (warn-only)

---


**미배포 (PC 머지 대기)**: `bf3b75e` (GroupBuyList/Search/Embed i18n)

## 📦 2026-05-15 (Round 2) — 공동구매 이상적 구현 (10개 영역)

10개 영역 모두 구현 완료 — 전용 detail page, 티어 할인, 마일스톤 알림, 이메일 영수증,
동적 OG 이미지, JSON-LD SEO, voucher map, 어드민 analytics, 엣지 케이스 가드.

### 신규 추가
- **`GroupBuyDetailPage` (`/group-buy/:id`)**: 카운트다운 ring, 티어 시각화, 참여자 아바타,
  셀러 카드, KakaoLink share, sticky bottom 결제. 6개 voucher 카테고리 전체 지원.
- **`/api/group-buy/products/:id/participants`**: 마스킹된 최근 참여자 20명.
- **`/api/group-buy/admin/analytics`**: 카테고리별 funnel, GMV top 10, 일별 추이 30일.
- **`/api/og/group-buy/:id`**: 동적 SVG OG 이미지 (1200x630), 진행률/할인율 포함.
- **`og-image.routes.ts`**: 신규 worker route, 1시간 edge cache.
- **티어 할인 시스템**: `products.group_buy_tiers` JSON, `vouchers.applied_discount_pct/applied_price`,
  `calcTierDiscount()` 헬퍼, SellerMealVoucherNewPage 에 토글 + 단계 입력 UI.
- **마일스톤 알림**: 50%/80%/1명 남음 hot push, atomic CAS dedup 컬럼 3개.
- **이메일 영수증**: Resend 로 voucher 코드 + 매장 정보 + 티어 할인 내역 HTML 메일.
- **VoucherMap**: MyVouchersPage 에 미사용 식사권 카카오 멀티 마커 지도 (lat/lng 응답에 추가).
- **AdminGroupBuyPage**: 모니터링/분석 탭 분리, 카테고리별 통계 + Top 10 + 일별 표.

### SEO 풀 적용
- `<SEO>` JSON-LD: Product + Offer + GeoCoordinates + BreadcrumbList + ItemList (목록 페이지)
- 동적 OG image (위 endpoint)
- KakaoShareButton 통합

### 엣지 가드
- POST /join: voucher_expiry ≤ group_buy_deadline 차단 (불가능 voucher 발급 방지)
- POST /join: status=expired/cancelled 명시적 차단
- DELETE /seller/products/:id: active 공구 + 참여자 1명+ 이면 409 (참여자 보호)
- ProductDetailPage: voucher 카테고리 6종 → /group-buy/:id 자동 redirect (URL 보존)

### 커밋 흐름
- `881c3f4b`: Round 1 (티어/마일스톤/이메일/detail/edge cases)
- 다음 commit: Round 2 (SEO/OG/voucher map/admin analytics)

라이브 서비스와 완전 독립 — OAuth verification 검토 영향 없음.

---

## 📦 2026-05-15 — 공동구매 6대 영역 런칭 준비 완료

OAuth verification 검토 (4-6주) 동안 공동구매 서비스를 정식 운영 가능 상태로 마무리.

### 변경 (`claude/check-live-commerce-flow-jgNs8`)
- **`/api/group-buy/join/:id`**: rate limit 5/min 추가 (동시 클릭 / 봇 방어, voucher 중복 발급 차단)
- **`/api/group-buy/admin/list`** (NEW): 어드민 전체 공구 조회 + status/filter (unsuccessful) 지원
- **`/api/group-buy/admin/force-refund/:productId`** (NEW): 어드민 강제 환불 + audit_logs + 참여자/셀러 알림
- **`AdminGroupBuyPage.tsx`** (NEW): `/admin/group-buy` — 모니터링 + 필터 + 강제 환불 버튼 UI
- **AdminLayout 메뉴** 추가: `공동구매` (Ticket icon, 거래 그룹)
- **scheduled-cleanup cron**: 미달성 자동 환불 시 셀러에게 dashboard notification + Alimtalk 발송 (best-effort)
- **`ProductDetailPage.handleBuyNow`**: voucher 카테고리 6종 감지 시 `/api/group-buy/join` 호출 (기존엔 일반 checkout 으로 빠져 group_buy_current 미증가 + voucher 미발급 버그). 딜 부족 시 `/points/charge` 안내 confirm.
- **운영 가이드**: `/admin/operations-guide` 의 "공동구매/타임딜 승인" 섹션에 어드민 도구 사용법 추가

### 핵심 진단 결과
공동구매 시스템은 백엔드 80% 완성 (atomic CAS, 자동 환불 cron, voucher 발급) — 차단 이슈는 단 2개:
1. ✅ ProductDetailPage 가 voucher 를 일반 checkout 으로 보내던 버그 (해결)
2. ✅ 어드민이 분쟁 환불 시 DB 직접 수정해야 하던 문제 (해결)

라이브 서비스와 완전 독립 (DB / 라우트 / 외부 의존성 모두 분리) — OAuth 검토 영향 없음.

## 📦 2026-05-12 후반 세션 — 4차 배포 (배포 대기)

### Batch 1 (`59a8cf2`) ✅ 배포 완료
- LiveRecapPage: 상품 클릭 `[object Object]` 버그 수정
- ReelCard: 종료 라이브 "LIVE" 배지 → "다시보기" 배지
- TopNav: YouTube 아이콘 `?sub_confirmation=1` + "구독" 레이블
- TopNav: 셀러 pill → 셀러 프로필 클릭 링크

### Batch 2 (`9ac922d`) ✅ 배포 완료
- ReelActionRail: tap target 40 → 44px (WCAG 2.5.5)
- ReelChatSheet: 백드롭 키보드 접근성 + 변수 `t` shadowing 수정
- ReelProductCard: 재입고 알림 상태 분리 (idle/requesting/requested/error)
- ReelCard: 시청 트래킹 leave fetch `keepalive: true`

### Batch 3 (`cb48a60`) ✅ 배포 완료
- ShortsPage: 음소거/닫기 버튼 32 → 44px + silent error → DEV 로깅
- AccountSettings: handleCheck setTimeout 누수 + cleanup + isMounted guard
- BlogDetail: 하드코딩 한글 → t()

### Batch 4 (`bf3b75e`) ⏳ PC 머지 대기
- GroupBuyListPage: 헤더/배너/탭/empty state/CTA/뱃지 ~14건 i18n
- SearchPage: 관련 키워드 헤딩 + 기본 6개 키워드 i18n
- EmbedLivePage: 폴백 메시지 i18n

### Batch 5 (`ae21e1b`) ⏳ PC 머지 대기
- ProductDetailPage: 옵션 가격, 최대 적립딜, 추천 링크, 리뷰/전체보기 → t()
- useLiveStreamWebSocket: 재연결 에러, 인앱 fallback toast, 메시지 전송 실패 → t()
  → 훅에 useTranslation 도입

### TD-014 i18n 점검 결과
- ✅ MainHomePage: 잔여 한글 모두 주석 — 클린
- ✅ ShortsPage: JSX 텍스트 모두 t() 처리됨
- ✅ LivePageV2: JSX 텍스트 모두 t() 처리됨
- ⏭️ PaymentFailPage: Toss 한국 전용 의도 (line 25) — skip
- ⏭️ KakaoLinkCallbackPage: 팝업 300ms 자동 닫힘 — 무영향
- ⏭️ Seller/Admin/Agency: 별도 TD-014 PR

### TD-024 점검 결과
- ✅ WebSocket 503 fallback: polling + 인앱 toast 안내
- ✅ postMessage origin: `window.location.origin` 명시
- ✅ IntersectionObserver: best entry by intersectionRatio (line 91-103)
- ✅ YouTube fallback iframe: handleVideoClick 에서 player destroy 후 native iframe
- ⚠️ 영상 재생 실패 잔여 — **실 프로덕션 브라우저 콘솔 로그 필요**
  - 검증: `/live/<id>` 진입 → DevTools Console → 셀러 라이브 시작 후 시청자 입장 시 에러 메시지 캡처

## 🔥 2026-05-12 배포 사고 + 해결

**증상**: `wrangler pages deploy` 시 "Disallowed operation called within global scope. ... generating random values are not allowed within global scope" 오류로 모든 신규 배포 실패. 프로덕션은 이전 배포본으로 정상 작동 중이었음.

**원인**: `src/lib/rate-limit.ts` 21~31줄이 모듈 최상위에서 `setInterval(...)` 호출 → CF Pages 런타임이 module init time async I/O 거부.

**해결** (PR #315 / `41e3587`): `setInterval` → lazy `maybeCleanup()` 패턴. 매 요청 처음에 호출, 1분 경과한 경우에만 실제 정리. global scope I/O 없음.

**재발 방지 룰**: Worker 코드 (`src/worker/`, `src/lib/`, `src/features/*/api/`) 에서 모듈 최상위 (function/class 밖) 에 다음 호출 절대 금지:
- `setInterval` / `setTimeout`
- `fetch` / `connect`
- `Math.random` / `crypto.getRandomValues` / `crypto.randomUUID`

검증: `grep -n "^setInterval\|^setTimeout\|^fetch(\|^Math\.random" dist/_worker.js` 결과 empty 여야 함.

새 세션 진입 시 이 문서를 먼저 읽고 이어서 작업할 것.

---

## ✅ 완료 (20차 배치, 2026-05-12)

### 🔒 보안 (10~19차)
| 내용 |
|---|
| security: 전체 셀러/어드민/스트림/에이전시 numeric param 검증 |
| security: 셀러/에이전시 쿠키 SameSite=Strict + 어드민 감사 로그 |
| fix: 프로덕션 ErrorBoundary 스택트레이스 노출 차단 |
| fix: DEV guards on worker + frontend console.log |
| fix: fake avg_rating 4.5 fallback 제거 |
| reliability: Toss 결제 circuit breaker 6개 경로 전체 + 15s timeout |

### 📦 성능 (11~17차)
- KV 캐시: products/streams/popular-search/sections (D1 읽기 80%↓)
- N+1 쿼리 제거 (live-notify-followers 15,000→1 read)
- YouTube chat 배치 INSERT + quota isolate 캐시
- Dead-letter queue 크론 (이메일/푸시 재시도)
- 자동 환불 크론 (만료 공동구매)

### 🧪 테스트 (20차) — 1,727개 100% 통과
- circuit-breaker, rate-limiter, safe-internal-path, validation 유닛 테스트
- payment-validation (금액 변조 방지, 상태전이, 멱등성)
- auth-guards (IDOR, RBAC, JWT 파싱)

### 📦 인프라/CI
- `scripts/deploy-staging.sh` + `deploy-production.sh` (5단계 체크리스트)
- `docs/CANARY_DEPLOY.md` — CF Pages Gradual Deployments 절차
- `tests/load/critical-paths.js` — k6 로드 테스트 (5개 시나리오)
- `scripts/check-npm-audit.sh` + pre-commit hook (high/critical 차단)
- `docs/SLA.md` — 결제 99.9%, RTO 30분, RPO 1시간 정의
- PR #310 머지 → main 배포 완료

---

## ⚠️ 사용자 액션 필요

1. **CF Pages 배포 확인**
   - https://dash.cloudflare.com → Pages → ur-live → 최신 빌드 확인
   - 성공 시: `live.ur-team.com/about` 접속 테스트

2. **repair-new-tables 호출** (admin_audit_log 테이블 생성)
   ```bash
   curl -X POST https://live.ur-team.com/api/_internal/repair-new-tables \
     -H "Authorization: Bearer <ADMIN_TOKEN>"
   ```

3. **GitHub Actions 수동 배포** (CF Pages 자동 연동 없으면)
   - GitHub → Actions → "Deploy to Cloudflare Pages" → Run workflow

4. **스테이징 환경** (선택)
   - CF Dashboard에서 `ur-live-staging` Pages 프로젝트 생성
   - 생성 후: `npm run deploy:staging`

---

## 📋 기술 부채 (남은 항목)

| 항목 | 심각도 | 설명 |
|---|---|---|
| DB 마이그레이션 CI | 🔴 | D1 권한 없음 → repair-schema 응급처치 |
| ur-live-global Workers 빌드 실패 | 🟡 | 글로벌(world.ur-team.com) 버전 — 한국 서비스 무관 |
| E2E Playwright 테스트 | 🟡 | 브라우저 환경 필요, CI에서 실행 |
| GitHub Actions 분 초과 | 🟡 | 매월 1일 리셋, 그 전엔 수동 배포 |
| 스테이징 환경 | 🟡 | 스크립트는 준비됨, CF 프로젝트 생성 필요 |

---

## 📋 다음 세션 시작 시 체크리스트

1. 이 파일 읽기
2. `git log --oneline origin/main -5` 확인
3. CF Pages 최신 배포 상태 확인
4. repair-new-tables 호출됐는지 확인
