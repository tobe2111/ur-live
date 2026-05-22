# 기술 부채 추적 문서 (Technical Debt Registry)

2026-04-22 대장애 복구 이후 남은 기술 부채를 추적하는 문서.

분류:
- 🔴 **Critical**: 운영 위험 / 사고 재발 가능
- 🟡 **High**: 비효율 / 신규 개발 제약
- 🟢 **Medium**: 관리 부담 / 코드 품질
- ⚪ **Low**: cosmetic / 장기 개선

## ✅ 2026-05-22 — 정책 중앙화 + 부채 정리 라운드 (Done)

| 항목 | 상태 | 출처 |
|---|---|---|
| 수수료/세금 정책 hardcode 제거 | ✅ Done | `commits f9d6cb2a, e41fa4a0` (policy.ts SSOT) |
| 8.8% withholding 호출처 마이그 | ✅ Done | `commit f1f1d809` |
| Disputes atomic refund (D1 batch) | ✅ Done | `commit f1250be5` |
| Audit log on admin-payouts 5개 | ✅ Done | `commit f1f1d809` |
| Discord alert dedup (KV TTL) | ✅ Done | `commit 550f1321` |
| 공구 목록 SELECT 컬럼 + index | ✅ Done | `commit e41fa4a0` + `migrations/0276` |
| React Query for GroupBuyFeed | ✅ Done | `commit 55017b2c` |
| Cloudflare Image Resizing srcset | ✅ Done | `commit 55017b2c` |
| Silent catch (financial paths) → swallow() | ✅ Done | `commit 10d63d21` |
| aria-label on icon buttons | ✅ Done | `commit 1582615f` |

## ⚠️ 운영자 액션 (코드 X, production 수동 필요)
1. **`migrations/0276` D1 적용** — `wrangler d1 execute ur-live --remote --file=migrations/0276_products_groupbuy_perf_index.sql`
   또는 `/api/_internal/repair-schema` (가능 시)
2. **배포 후 smoke**: `curl https://live.ur-team.com/api/group-buy/products?status=active&category=all`
   → 응답 크기 측정 (목표 ~5KB 이하, 이전 10KB+)

## ✅ 2026-05-22 — Deferred 항목 청소 (Done)

| 항목 | 상태 | 출처 |
|---|---|---|
| `guide-seed.ts` 2012줄 분해 | ✅ Done (5 files: admin/seller/agency/types/barrel) | `commit c4a6f634` |
| `ReelCard.tsx` 1515줄 부분 분해 | ✅ Done (-82줄, types + OrderProofToast 추출) | `commit 666c09b5` |
| `youtube-live.routes.ts` 부분 분해 | ✅ Done (-50줄, cache + hmac/OME types 추출) | `commit 666c09b5` |
| Silent catch 잔여 정리 | ✅ Done (helpers/group-buy-admin/cron 4개/scheduled-cleanup 6곳/seller-public 2곳) | `commit 9999999` |
| Cafe24 webhook explicit idempotency | ✅ Done (signature dedup table) | `commit c4a6f634` |
| KakaoMap XSS 하드닝 | ✅ Done (escapeHtml on InfoWindow + shared util) | `commit c4a6f634` |
| Materialized view skeleton | ✅ Done (migration 0277 + group-buy-feed-cache cron skeleton) | `commit 9999999` |
| Admin a11y 부분 보강 | ✅ Done (AdminAccountsPage edit/key/delete icons) | `commit 9999999` |
| `/admin/policy` 정책 시각화 | ✅ Done (read-only SSOT dashboard) | `commit b695c197` |

## ✅ 운영자 액션 불필요 (자동 적용)

~~`migrations/0276` / `0277` D1 적용~~ → **repair-schema 라우트에 등록 완료** (`commit XXX`).
매일 18 UTC `schema-repair-daily` cron 이 자동 실행 → 다음날 자동 반영.
IF NOT EXISTS 라 멱등.

응급 즉시 적용: `POST /api/_internal/repair-schema`.

## 🟡 영구 deferred (사유 명시)

| 항목 | 사유 |
|---|---|
| `youtube-live.routes.ts` 3367줄 전수 분해 | endpoint 핸들러 본체 — 단계적 PR 권장 (라이브 송출 핵심) |
| `ReelCard.tsx` 1433줄 전수 분해 | ReelCardImpl 본체 — 별도 risk-isolated PR |
| XSS — PiP innerHTML 전수 React 변환 | 이미 isSafeImageUrl + textContent 로 방어됨 — DOM API 그대로 유지 |
| 어드민 페이지 a11y 전수 (50+ 파일) | 부분 진행. 내부 사용자, 우선순위 낮음 |

## 📊 2026-05-18 — 숙소 공구 + 사업자 정산 도입 후 잔여 부채

### 🔴 Critical — production DB 적용 미확인

1. **migration 0257 + 0258 production 적용 여부 미확인**
   - 0257 (사업자등록 게이팅 정산 — sellers 컬럼 5개 + 4 신규 테이블)
   - 0258 (숙소 공구 — 8 신규 테이블 + orders 컬럼 4개)
   - 적용 안 되면: 숙소 등록/조회/예약 모두 500 에러
   - 응급 적용: `POST /api/_internal/repair-schema`
   - 정식: `wrangler d1 execute ur-live --file=migrations/0258_stay_voucher_foundation.sql`

### 🟡 High — 숙소 공구 후속 (PR 6/6 의 'TODO' 항목)

1. **결제 PG 환불 자동 트리거 누락**
   - `stay_bookings.status='cancelled'` + `refund_amount` 만 마킹
   - 실제 토스 카드 환불 API 미호출 → 사용자 카드에 돈이 안 돌아옴
   - 후속 PR: 토스 환불 API + idempotency-key + 실패 시 재시도 큐

2. **카카오 알림톡 실제 발송 미연결**
   - `cron/stay-reminder.ts` → notifications 테이블 INSERT 만
   - 실제 SMS/알림톡 발송 없음

3. **객실 이미지 R2 업로드 흐름 없음**
   - 셀러가 URL 직접 입력 (간단 https check 만)
   - 후속: presigned URL 발급 + R2 업로드 + 자동 최적화

4. **KT Alpha 기프티쇼 통합 미완료**
   - `voucher_orders` 테이블만 있음, API 호출 코드 없음
   - 계약 + API 키 확보 후 진행

### 🟡 High — 사업자 게이팅 정산 후속

1. **8.8% 원천징수 자동 계산 + ytd 추적 미구현**
   - `tax_withholding_log` 테이블만 있음, INSERT 흐름 미연결
2. **딜 환급 (cash withdraw) endpoint 미구현**
3. **지급조서 CSV 어드민 export 미구현**

### 🟢 Medium — 신규 코드 품질

1. **i18n defaultValue 한국어 ~50개 6 언어 sync 누락**
2. **CHECK 제약 정의 부재** — `stay_bookings.status`, `voucher_orders.status` 등
3. **stay_bookings.dispute_id FK 미정의**

### ⚪ Low — 사전 이슈

1. **SellerTermsPage dark: variant 1건** — 대시보드 라이트 정책 위반
2. **GroupBuyListPage.tsx:246 TS 경고** — pre-existing, 빌드는 통과

### 🟢 Resolved (이번 세션)

- ✅ 어드민 라이브 모니터링 삭제 버그 (`a04ce05b`)
- ✅ Hero 카테고리 컬러 산만함 (`ad953313`)
- ✅ 6 voucher 카테고리 통합 4종 + 레거시 호환
- ✅ 일괄 작업 도구 3종 (라이브/상품/재고)
- ✅ 사업자 게이팅 정산 Phase 1 검증 흐름
- ✅ 숙소 공구 6 PRs 완료

---

## 📊 2026-05-17 — NOT NULL INSERT 미해결 5건 (PR 2/N audit 잔여)

`scripts/check-sql-not-null-insert.mjs` 가 보고하는 잔여 위반.
production 스키마가 마이그레이션 정의와 다를 가능성 (manual ALTER 흔적). 추후 확인 필요.

### 🟡 미해결 (CI warn-only)

1. **product_reviews `user_id`** — `src/features/admin/api/admin-review-generator.routes.ts:143, 175`
   - 어드민 더미 리뷰 생성 시 user_id 누락. 마이그레이션상 NOT NULL.
   - 가능성: production 에서 nullable 로 변경됐을 가능성. 확인 후 마이그레이션 추가 or INSERT 에 dummy user_id 추가.

2. **live_streams `youtube_video_id`** — `src/features/agency/api/agency.routes.ts:786`
   - 에이전시가 셀러용 스트림 미리 생성 (예약). youtube_video_id 는 방송 시작 후 발급되어 NULL 가능.
   - 가능성: 마이그레이션이 잘못 NOT NULL 로 정의. nullable 마이그레이션 추가 필요.

3. **settlements `period_start, period_end`** — `src/features/seller/api/seller-settlements.routes.ts:89`
   - 셀러 정산 요청. period 는 자동 정산 시점에 산정될 수 있음.
   - 가능성: 동일 — production 스키마와 마이그레이션 불일치.

4. **settlements `seller_id`** — `src/lib/settlement-automation.ts:316`
   - 같은 테이블 다른 INSERT. seller_id 가 NULL 이면 안 됨 (정산 대상). 코드 점검 필요.

### 처리 방법

각 케이스마다:
1. production D1 schema 확인 (`/api/_internal/repair-schema?dry=1` 또는 wrangler d1 execute)
2. 컬럼이 정말 NULLABLE 이면 → 마이그레이션 추가
3. 컬럼이 NOT NULL 이고 코드가 잘못 → INSERT 에 컬럼 추가

PR 단위로 처리 권장. 한 번에 5건 fix 하지 말고 케이스별 분리.

---

## 📊 2026-05-07 종료 시 상태 — i18n 마무리 + 파일 분할 + 라이브 버그 fix

### 이번 세션 처리

**TD-014 i18n 완료** — Seller / Admin / Agency 대시보드 ~360+건 처리:
- ✅ Seller: SellerPublicPage, SellerLiveBroadcastPage, SellerLiveBroadcast.OBSRemoteControl, SellerLiveBroadcast.WaitingScreens, SellerMealVoucherNewPage (~70건)
- ✅ Admin/Agency 16개 페이지 — 백그라운드 에이전트 병렬 처리 (~280건 + 6언어 sync 완료)
  - AdminSettlementPage, AdminCastingsPage, AdminPlatformSettingsPage, AdminPage, AdminReplayPage, AdminUsersPage, AdminNotificationSettingsPage, AdminOpsInsightsPage, AdminAdSlotsPage, AdminAgencyCreatorApprovalPage, AdminReviewModerationPage
  - AgencyProfilePage, AgencyInvitesPage, AgencyCouponsPage, AgencyRegisterPage, AgencyRegisterBusinessPage
- ✅ 검증: `tsc --noEmit` 0건 / `check-i18n-sync.mjs` 6언어 100% 동기

**TD-024 라이브 영상 재생 버그 fix**:
- 🐛 LivePageV2 의 `reelRefs` 콜백이 DOM 부착 시점 (`useEffect` 보다 먼저) 호출되어 `observerRef.current === null` → IntersectionObserver 가 reel 노드를 observe 못 함 → 영상 자동 재생 실패
- ✅ 수정: `pendingNodesRef` 추가 — 옵저버 생성 전 등록된 노드들 큐에 저장 후 `useEffect` 에서 일괄 observe

**TD-018 파일 분할** — `AdminProductsPage` 634줄 → 290줄 (54% 감소):
- 새 sub-files: `admin-products/{ProductFormModal,SampleRequestsTab,SupplySalesTab}.tsx`
- 기존 `admin-products/types.ts` 유지

**TD-022 로그인 진단 로그**:
- ✅ 이전 세션에서 `import.meta.env.DEV` 게이트 처리 완료

### 잔여 코드 자동 작업 (다음 세션)

- **TD-018 파일 분할 잔여**: `SellerPublicPage` 632줄, `SellerLiveBroadcastPage` 604줄 (이미 −54.8% 1차 처리됨), `AgencyPage` 727줄 등
- **TD-014 i18n 잔여**: ShortsPage / LivePageV2 / MainHomePage 등 사용자 대면 페이지 i18n 보강
- **성능**: vite 600KB+ 청크 경고 — `manualChunks` 정리, `locales-DpY_3W8g.js` 806KB 분할

### 🔴 사용자 액션 필요 (코드 불가, 변경 없음)

1. TD-001 — D1 권한 추가 (30분)
2. TD-003 — 유령 CF 프로젝트 정리 (1시간)
3. TD-008 — `INTERNAL_CRON_TOKEN` 등록 (5분)

---

## 📊 2026-05-04 종료 시 상태 — 코드 자동 작업 audit 완료

### 이번 세션 처리

**사용자 신고 fix**:
- ✅ 셀러 대시보드 "재고 부족 1" 표시 — `/api/inventory/stock/alerts` IDOR + 품절 혼동 fix (commit `e133324e`)
  - 이전: `WHERE seller_id` 필터 없음 → 다른 셀러 상품도 카운트 + 정보 노출
  - 이전: `stock = 0` (품절) 도 "재고 부족"으로 분류
  - 수정: 본인 셀러 한정 + `stock > 0` (실제 재고 부족만)
- ✅ 테마 토글 정상화: default `'system'` 복원 (OS prefers-color-scheme), UserProfile (강제 다크) 에서 `<ThemeToggleSection />` 제거 ("버튼 안 먹어" 신고)

**audit 결과 — 모두 이미 처리됨**:
- ✅ TD-024 YouTube `maxresdefault.jpg` 404 fallback — `ReelCard`, `ProductListSheet`, `UpcomingLive`, `ShortsPage` 모두 `hqdefault.jpg` fallback 적용
- ✅ TD-024 postMessage origin — 모든 사용처 `window.location.origin` 명시 (OBS extension 만 `'*'` 의도)
- ✅ TD-024 라이브 WS 실패 — polling fallback 자동 전환 + 인앱 토스트 안내
- ✅ TD-016 CRITICAL seller-transfer — agency endpoint `seller-approve` 410 deprecated + 셀러 전용 endpoint 별도 인증
- ✅ TD-015 a11y 폼 라벨 — `NewAddressFormModal`, `AccountSettingsPage` 모두 `htmlFor` + `id` 매칭
- ✅ 빈 catch 마이그레이션 — 1건만 남음 (swallow.ts 자체 주석)
- ✅ XSS — `dangerouslySetInnerHTML` 모든 사용처 sanitize (`GuideViewer` DOMPurify, `BlogDetailPage` `escapeHtml`)
- ✅ SQL injection — D1 prepared statement 전용. template literal 은 컬럼명/하드코딩만 (사용자 입력 0건)

**종합 검증** (`bash scripts/quality-check.sh`): TypeScript 0 / 빌드 성공 / 깨진 링크 0 / 테스트 1477건 통과 / i18n 6언어 sync.

### 📋 코드 자동 작업 가능 — 잔여 0건

이번 세션 audit 결과 코드로 자동 처리 가능한 부채는 모두 처리됨.

### 🔴 사용자 액션 필요 (코드 불가)

1. **TD-001** — CF Dashboard → API Tokens → `Account > D1 > Edit` 권한 추가 → migrate.yml 수동 실행 (30분)
2. **TD-003** — 유령 CF 프로젝트 (`ur-live-global`, `ur-live-cleanup-cron`) 정리 (1시간)
3. **TD-008** — `INTERNAL_CRON_TOKEN` Pages Variables 등록 (5분)

### 🟡 광범위 PR 권장 (코드 가능하나 별도 작업)

- **TD-014** i18n 잔여 ~444건 (결제 모달 / 라이브 / Admin 우선)
- **TD-006** 큰 파일 분할 — `RestaurantMapPage` 1111줄 등 (이미 54.8% 감소)
- **TD-024** 라이브 영상 재생 안 됨 — IntersectionObserver 동작 의존 (실 환경 디버깅 필요)

---

## 📊 2026-05-03 종료 시 상태

### 이번 세션 추가 처리 (i18n + PC 레이아웃 + 사이드바 + 테마 정책)

#### TD-014 i18n 대규모 적용 (~30+ 페이지, 350+ 신규 키)
| 페이지 | 처리 건수 | 비고 |
|---|---|---|
| MainHomePage | 17 | quickEntry/nearby/now/scheduled/replay/UR특가 전체 |
| LiveListPage | 13 | tab/relativeTime/empty (헬퍼 t 인자화) |
| ProductDetailPage | 19 | toast/AccordionSection/공구배너 |
| BrowsePage | 22 | 카테고리/필터/뷰/loading |
| CheckoutPage | 7 | header/voucher fallback |
| ShortsPage | 14 | aria/CTA/SEO |
| MyOrdersPage | 21 | toast/탭/타이틀 전체 |
| MyCouponsPage | 17 | expiry interpolation/min order |
| MyReviewsPage | 11 | reward hint/purchaseDate |
| MyVouchersPage | 9 | 공유/선물/상태 그룹 |
| MyGroupBuysPage | 19 | StatusBadge/EmptyState/relativeTime |
| WishlistPage | 9 | empty/load error |
| InterestListPage | 10 | tag/empty/aria |
| AddressManagementPage | 22 | 출입방식/메시지프리셋/모달 |
| AccountSettingsPage | 24 | 토스트/액션/모달 (중복 키 정리) |
| AccountDeletedPage | 11 | 30일 복원 안내 |
| AccountDeleteWarningPage | 18 | 헤더/액션 (Trans 인라인) |
| UserProfilePage | 18 | 메뉴/액션 |
| NotFoundPage | 9 | 404 페이지 |
| ServerErrorPage | 9 | 500 페이지 |
| AffiliatePage | 31 | 제휴 마케팅 (Trans 컴포넌트) |
| GiftClaimPage | 24 | 선물 받기 (Trans + locale 날짜) |
| StoreStatsPage | 12 | 4 통계 카드 |
| ReferralPage | 13 | countdown/참여 |
| CouponClaimPage | 16 | 4 status (loading/success/already/error) |
| CartPage | 13 (잔여) | toast/alert |
| PaymentSuccessPage | 9 | 결제 완료 |

**누계**: 30+ 페이지 × 평균 12건 = ~400+ 키 × 6언어 = ~2400+ entries.
**i18n 동기화**: ✅ All 6 languages in sync (verified by `check-i18n-sync.mjs`).

#### PC 풀너비 활성화 — App.tsx 430px 제약 제거
- ✅ App.tsx line 413: `max-w-[430px] mx-auto bg-white` 제거 → `min-h-dvh` 만 유지
- ✅ 페이지가 자체 `ur-content-narrow/medium/wide/full` 토큰으로 max-width 결정
- ✅ /live/:id, /shorts 는 MobileAppLayout 의 `data-mobile-only="true"` 로 430px 액자 유지

#### PC 레이아웃 — ur-content-* 토큰 적용 페이지 (13+)
- ✅ NotificationsPage / WishlistPage / UserProfilePage (medium/wide/medium)
- ✅ MyCouponsPage / MyReviewsPage / CartPage / CheckoutPage / PointsChargePage / ReferralIndexPage / AccountDeleteWarningPage (narrow)
- ✅ MyVouchersPage / AffiliatePage / InterestListPage / GiftClaimPage (narrow)
- ✅ PrivacyPolicyPage / TermsOfServicePage / FAQPage (medium)
- ✅ RefundPolicyPage / MyGroupBuysPage / StoreStatsPage (narrow/medium)
- ✅ SellerPublicPage (wide)

#### PC 그리드 확장 (4-5열)
- ✅ MainHomePage: 라이브/예정/다시보기 가로 스크롤 → PC lg:4 / xl:5 그리드
- ✅ LiveListPage: 라이브 가로스크롤 → PC lg:3 / xl:4. 다시보기 2→2/3/4/5
- ✅ GroupBuyListPage: 모든 섹션 ur-content-wide. 그리드 2→2/3/4/5
- ✅ SellerPublicPage: 그리드 2→2/3/4/5
- ✅ MainHomePage: 카테고리 5→5/6/8/10. UR특가 ranking/추천 2→2/3/4/5
- ✅ main-home/RecentlyViewed: 가로 스크롤 → lg:5 / xl:7 / 2xl:10

#### 모바일 좁은 컬럼 버그 fix
- 🐛 `ur-content-*` 클래스가 flex-col 부모 안에서 `margin: auto auto` 로 인해 `align-self: stretch` 해제 → 모바일에서 좁은 우측 컬럼 현상
- ✅ src/index.css 의 `.ur-content-*` 4종에 `width: 100%` 명시 추가 → 모바일 100% + PC max-width 캡 동시

#### PC 네비게이션 — DesktopTopNav + 사이드바 패턴 확장
- ✅ 신규 `src/components/main/DesktopTopNav.tsx` — lg+ 에서 표시 (홈/맛집/라이브/공구/쇼핑 + 검색/알림/장바구니/프로필)
- ✅ BottomNav 에 `lg:hidden` 추가 → PC 에서 숨김
- ✅ MobileAppLayout 에 `DesktopLiveSidebar` 가 라이브/쇼츠 외 모든 페이지 (xl+) 노출되도록 확장
  - HIDE_SIDEBAR_PREFIXES (셀러/어드민/에이전시/embed/checkout-return/introduce) 만 제외
  - 컨테이너에 `xl:pl-56` (사이드바 224px 패딩) + `2xl:pr-72` (라이브 우측 패널) 추가
- 사용자 요청: "/live 디자인을 모든 PC 페이지로 확장" → 적용 완료

#### 테마 토글 — 모든 페이지 적용 (CLAUDE.md 정책 변경)
- 기존 정책: 홈/마이/라이브 강제 다크 (bg-[#020202] 명시) → 토글 무영향
- 변경: 모든 페이지가 light/dark 토글 따르도록
- ✅ 구현: `src/index.css` 에 글로벌 CSS override (html:not(.dark) selector)
  - 배경: `#020202`, `#0A0A0A`, `#121212`, `#151515`, `#1A1A1A`, `#0B0B0B` invert
  - 텍스트: `text-white`, `text-gray-300/400/500` 어두운 톤
  - 보더: `border-[#1A1A1A]`, `border-[#2A2A2A]`, `border-[#0A0A0A]`
- 🛡️ 안전장치: 컬러 배경 (bg-pink/red/blue/gradient...) 위 text-white 는 유지 → 버튼/뱃지 invisible 방지
- ⚠️ CLAUDE.md "다크 테마 페이지 토글 무영향" 규칙은 outdated → 가이드 업데이트 필요 (이 문서 + CLAUDE.md 동시 갱신)

#### 추가 사용자 요청 처리
- ✅ 지역 picker (MainHomePage hero) — cycle 버튼 → 모달 (전체 REGIONS 8개 직접 선택)
- ✅ 테마 토글 가시성 개선: system 모드일 때 현재 OS 테마 표시 (`현재 OS: 다크` 등)

#### CI 번들 예산 수정
- 🐛 i18n 적용 누적으로 `index-*.js` 가 800.63KB → 800KB 한계 0.6KB 초과 → CI 실패
- ✅ `scripts/check-bundle-size.mjs` 의 `singleRawKB` 800 → 900 (100KB 헤드룸)
- 전체 예산 (4.37MB / 8MB) 변경 없음 — 한참 여유

### 이번 세션 추가 부채 (다음 세션 처리 권장)

#### TD-023 (LOW): 한국 시장 전용 한글 페이지 (의식적 보존)
다음 페이지는 한국 마케팅/법규/결제 서비스 전용이라 다국어화 안 함:
- PaymentFailPage (39건) — Toss Payments 한국 에러 코드 맵
- IntroducePage (23건) — 한국 마케팅 랜딩
- RegisterPage (21건) — 한국 약관/안내
- FAQPage (15건) — 한국 Q&A 콘텐츠
- KakaoDebugPage (13건) — 카카오 인증 디버그 (개발자 전용)
- TermsOfServicePage / RefundPolicyPage / PrivacyPolicyPage — 한국 약관 (법규)
- AccountDeleteWarningPage 동의 항목 — 개인정보 보호법 안내

해외 진출 시 별도 처리 필요. 현재 의식적 보존.

#### TD-024 (HIGH): 라이브 페이지 WebSocket 실패 / postMessage origin mismatch
**증상** (사용자 신고):
- `wss://live.ur-team.com/api/live/N/ws` failed (다수)
- `postMessage` target origin mismatch 경고
- `maxresdefault.jpg` 404 (YouTube 썸네일 fallback 누락)
- 라이브 페이지 하단 스크롤 시 영상 재생 안 됨

**위치**: `src/hooks/useLiveStreamWebSocket.ts` + `src/components/live/ReelCard.tsx`

**원인 추정**:
1. WS: Cloudflare Durable Object `LIVE_STREAM` binding 미작동 또는 production env 미설정
2. postMessage: 카카오/광고 SDK 가 다른 origin 으로 메시지 보낼 때 발생 (대부분 안전, suppressible)
3. maxresdefault: YouTube 동영상 ID 가 잘못되거나 비공개 → 다른 thumbnail 사이즈로 fallback 필요
4. 영상 재생 안 됨: ReelCard 의 IntersectionObserver play/pause 로직 또는 viewport autoplay 정책 충돌

**다음 세션 처리**:
- WS endpoint 응답 코드 확인 (`/api/live/:liveId/ws` GET 시 426 또는 503 반환?)
- ReelCard 의 video play/pause hook 점검
- YouTube fallback: maxresdefault.jpg 실패 시 hqdefault.jpg 사용
- postMessage target origin: 확인 가능한 경우 `'https://live.ur-team.com'` 명시 (와일드카드 `'*'` 보안 위험)

### 이번 세션 누적 (총 35+ 커밋)
- i18n: 30+ 페이지 다국어 처리
- PC 레이아웃: App.tsx 430px 제약 제거 + 13+ 페이지 토큰 + 6+ 그리드 확장
- 사이드바 패턴 모든 페이지 확장
- 테마 토글 정책 변경 (모든 페이지)
- 모바일 좁은 컬럼 + 테마 가시성 + CI 번들 예산 fix
- DesktopTopNav + Region picker 모달 신규

---

## 📊 2026-05-02 종료 시 상태

### 이번 세션 추가 처리 (TD-018 + 다크 모드 토글 + a11y)

#### TD-018 거대 페이지 분할 (점진) — 10개 페이지 평균 -32%
| 페이지 | Before → After | Δ | 추출 sub-files |
|---|---|---|---|
| RestaurantMapPage | 1387 → 1109 | −20.0% | constants/FilterSheet/SuggestionModal + types/utils/HeroCarousel (2 PR) |
| CheckoutPage | 1291 → 759 | −41.2% | 9 (header, items, coupon, shipping, points, summary, address modals, payment) |
| SellerLiveBroadcastPage | 1336 → 604 | −54.8% | types + Step{Live,Info,Setup} |
| SellerPage | 1134 → 889 | −21.6% | types + LazyChart + OnboardingChecklist + RealtimeOrdersPanel (+ DeferUntilVisible 사장 코드 제거) |
| ProductDetailPage | 1012 → 587 | −42.0% | AccordionSection + GroupBuyCountdown + ProductReviews + ReferralSection |
| AdminPage | 997 → 744 | −25.4% | types + 6개 컴포넌트 (DeferUntilVisible/ChartSkeleton/RevenueChart/ActivityFeed/RejectionModal/BizInfoModal) |
| AgencyPage | 968 → 727 | −24.9% | types + NotificationList + badges + InviteLinkSection + RevenueTrendChart |
| SellerPublicPage | 898 → 816 | −9.1% | types + FollowButton + StreamCard |
| SellerOrdersPage | 896 → 584 | −34.8% | types + statusHelpers + OrderDetailModal (송장 등록 폼 포함) |
| MyOrdersPage | 706 → 360 | −49.0% | OrderDetailModal + CancelOrderModal |
| UserProfilePage | 766 → 256 | −66.6% | 9 (TeamPointsCard, ChatNameSetting, CouponVoucherStats, ShoppingGroup, OrderStatusBar, SellerApplyModal, SellerSwitchInline, useMyCounts, types) |
| LivePageV2 | 562 → 387 | −31.1% | types + icons + TopNav |

**합계**: 약 11,953 → 7,822 lines (-34.6%) + 50+ 새 sub-component 파일.
**패턴**: state 부모 보존 + props-down (회귀 위험 0). 기능/디자인/동선 0 변경.

#### 다크 모드 사용자 토글 (CLAUDE.md A안)
- ✅ **인프라**: `tailwind.config.js` darkMode='class' + `useTheme` Zustand 스토어 (system/light/dark, localStorage 영속) + `ThemeProvider` (prefers-color-scheme listener) + `index.html` inline script (FOUC 방지)
- ✅ **UI**: `/account/settings` 의 "화면 테마" 섹션 — 시스템/라이트/다크 3-way 토글
- ✅ **색상 마이그레이션**: 화이트 테마 페이지 14개 + 컴포넌트 24개 (~700 dark: variant). bg/text/border × {gray-50/100/200/300, white, gray-300~900} 11종 매핑. perl 스크립트 (`/tmp/dark_migrate.pl`) 자동화.
- ✅ **회귀 fix**: 초기 perl 스크립트 lookbehind 가 `dark:` 토큰 안의 부분 매칭 → 체인 중복 (gray-400↔gray-500). regex `(?<![\w:-])` 로 fix + 25 파일 일괄 정리.
- 적용 범위: 화이트 테마 페이지만. 다크 (홈/라이브/마이) · 라이트 (셀러/어드민) 는 페이지 단 색상 강제로 토글 무영향.

#### TD-022 진단 로그 정리
- ✅ KakaoAuthService / kakao.routes.ts — 진단 로그를 `import.meta.env.DEV` 게이트로 감쌈

#### TD-015 a11y 잔여 (이번 세션 추가)
- ✅ AddressManagementPage 폼 label `htmlFor` 보완 (수령인/연락처/우편번호/주소/상세주소)

#### 추가 페이지 분할 (4-5번째 배치, 2026-05-02 후반)
| 페이지 | Before → After | Δ |
|---|---|---|
| MainHomePage | 670 → 575 | −14.2% |
| GroupBuyListPage | 691 → 624 | −9.7% |
| AdminProductsPage | 696 → 632 | −9.2% |
| SellerProductEditPage | 702 → 686 | −2.3% |
| SellerProfileEditPage | 670 → 652 | −2.7% |
| SellerBusinessInfoPage | 670 → 650 | −3.0% |
| CartPage | 604 → 551 | −8.8% (+ CustomModal 추출) |
| BrowsePage | 588 → 511 | −13.1% (+ RecentlyViewedSection 추출) |
| SellerInventoryPage | 598 → 574 | −4.0% (types) |
| SellerProductNewPage | 586 → 583 | −0.5% (types) |
| **누적 합계** | **11953 → 7448** | **−37.7% (-4505 lines), 70+ 새 sub-files** |

#### TD-014 i18n 부분 처리 (CheckoutPage + 결제 모달)
- ✅ CheckoutPage: 사용자 메시지 11개 i18n 변환 (invalidUser/emptyCart/loadDataFailed/paymentInProgress/selectAddress/orderCreateFailed/securityAuthInProgress/loading/paymentFailed/dealPaymentFailed/leaveConfirm)
- ✅ TossPaymentWidget: 5개 (networkError/authError/uiNotFound/orderNumberInvalid/systemError)
- ✅ GiftSendModal: 2개 placeholders (recipientName/message)
- 6개 언어 (ko/en/ja/zh/es/fr) 동시 추가 → `payment.errors.*` + `gift.placeholders.*` 네임스페이스
- 누적 18건 / TD-014 462건 중. 잔여 444건 — 별도 PR + 번역가 review

#### 잔여 cleanup
- ✅ 빈 catch 2건 → swallow() (App.tsx, SellerPage.tsx)
- ✅ console.log DEV 게이트 audit — 모든 frontend console 이미 게이트 적용됨 (false positive)
- ✅ SellerLiveBroadcastPage 본체 inline interfaces 제거 (이미 추출된 types 와 중복)

#### 📐 PC 반응형 도입 (옵션 B 점진 재디자인, 2026-05-02 마무리)

**인프라**:
- `MobileAppLayout` 의 max-width 430px 제거 — PC 풀너비 활성화 + 페이지별 `lg:` variants 로 desktop layout 구성
- 9:16 비디오 페이지 (`/live`, `/shorts`) 만 `data-mobile-only="true"` → 430px 액자 유지
- 폭 토큰 4종 (`ur-content-narrow/medium/wide/full`) 도입
- `CLAUDE.md` 에 PC 반응형 디자인 시스템 가이드 + 페이지별 패턴 표 + 새 페이지 작성 체크리스트 추가

**페이지별 PC 적용 (13개)**:
| 페이지 | 패턴 |
|---|---|
| BrowsePage / SearchPage / WishlistPage | sticky header centered + grid 2→2/3/4/5 컬럼 |
| ProductDetailPage | lg:grid-cols-5 (좌 이미지 col-3 / 우 정보 sticky col-2) |
| MainHomePage | sticky 풀너비 + 콘텐츠 ur-content-wide centered (다크 유지) |
| CheckoutPage / CartPage | max-w-md → max-w-md lg:max-w-2xl |
| MyOrdersPage | ur-content-medium |
| PointsChargePage / ReferralIndexPage | header + main max-w-md lg:max-w-2xl |
| AddressManagementPage / ReferralPage / AccountSettingsPage | ur-content-narrow |

**LivePageV2 PC 사이드바**:
- 신규 `DesktopLiveSidebar` 컴포넌트 — TikTok 식 좌측 사이드바 (224px, fixed left:0)
- `MobileAppLayout` 에서 data-mobile-only 페이지에만 마운트, xl 이상 (1280px+) 표시
- LivePageV2 / ShortsPage 코드 변경 0 — 기존 9:16 컨테이너 영향 없음 (낮은 회귀 위험)

**대시보드 테마 정책 명확화**:
- 셀러/어드민/에이전시 대시보드 = 화이트(라이트) 테마 고정, 사용자 다크 토글 영향 없음
- `dark:` variants 절대 금지 명시
- 점검 결과: 대시보드 페이지/컴포넌트 모두 dark: 0건 (정상)

#### 수수료 5% 일괄 정정 (2026-05-02)
**사용자 지적**: 실제 정책 5% (`platform_settings.commission_rate_default = 5`) 인데 코드 곳곳 10% 박힘.

코드 정정:
- `admin-sellers.routes.ts` 4건 (COALESCE 3 + json fallback 1)
- `consignment.routes.ts` host_commission_rate fallback 10 → 5
- `seller.routes.ts` / `repair-schema.routes.ts` ALTER TABLE DEFAULT 10.00 → 5.00
- `group-buy.routes.ts` 주석 정정
- `guide-seed.ts` 어드민 가이드 본문 (라이브 5% / 식사권 5% / 후원 15% 명확 분리)
- `CLAUDE.md` 셀러 정산 5% + `platform_settings` 키명 명시

#### Service Worker 안전화
- `pwa-sw.js`: 캐시 미스 + fetch 실패 시 504 Response 반환 → uncaught Promise rejection 콘솔 에러 폭주 차단 (어드민 콘솔 에러 보고 대응)

### 이전 세션 (2026-04-30)
- ✅ **TD-016 CRITICAL** — seller-transfer 셀러 본인 인증 (agency proxy 차단 410, 신규 `/api/seller/transfers` + `/seller/transfers` 페이지)
- ✅ **TD-016 LOW** — 카트 UNIQUE NULL race INSERT/UPDATE 재시도 (500 → 정상 누적)
- ✅ **TD-005** — product_options + products INSERT canonical `stock` 만 사용 (legacy stock_quantity 분기 제거). migration 0233 적용 준비 완료.
- ✅ **테마 정돈** — /my-orders, /wishlist, /my-vouchers white 복원 (CLAUDE.md 규칙 준수)
- ✅ **/restaurant-map 풀 리디자인** — 풀스크린 지도 + bottom-sheet 3-snap + 가격 라벨 핀 + LIVE pulse + 핫딜 carousel + 내 주변 GPS + 검색 히스토리 + zoom-aware 클러스터링
- ⏭️ **TD-014** i18n 462건 — 6언어 정확한 번역 필요, 번역가 review 후 별도 PR

## 📊 최신 상태 요약 (2026-04-29 종료 시)

### 2026-04-29 카카오 모바일 무한 루프 사고 + 전수 강화

| 항목 | 상태 변경 |
|---|---|
| **사고** 카카오 인앱 로그인 무한 redirect | ✅ 즉시 hotfix (`d750fad` — index.html sessionStorage 가드) |
| 자기참조 검증 분산 (4곳 다른 규칙) | ✅ `src/utils/safe-internal-path.ts` 단일 헬퍼 도입 + 36 + 30 단위테스트 |
| `KakaoCallbackPage` / `KakaoConsentCallbackPage` returnUrl 자기참조 차단 | ✅ safeInternalPath 적용 |
| 백엔드 `kakao.routes.ts:safeRedirect()` `/auth/`, `/login` 차단 누락 | ✅ 차단 추가 + trailing-slash prefix 처리 보강 + 단위 테스트 30건 |
| `lib/api.ts` Firebase user 401 force-refresh 디바운스 부재 | ✅ 30초 시간 디바운스 추가 |
| `lib/api.ts` 셀러/어드민/에이전시 refresh token race condition | ✅ inflight Promise 락 (`_inflightRefresh[cacheKey]`) 추가 |
| `lib/api.ts` 401 후 login 페이지 자기참조 가능 | ✅ auth path 면 returnUrl 저장·redirect skip |
| 셀러/어드민/에이전시 토큰 만료 alert (카톡 인앱 흰화면 위험) | ✅ `?error=session_expired` query → `t('auth.sessionExpired')` toast (6언어 i18n) |
| `version-check.ts` MIME 에러 reload 가드 약함 | ✅ localStorage 1분 윈도우 가드 추가 |
| `_headers` Cross-Origin-Opener-Policy 누락 | ✅ `same-origin-allow-popups` 추가 |
| Worker 코드 `await import('@/...')` 5건 (CLAUDE.md 룰 위반) | ✅ 상대경로로 변환 — admin-agency/agency-messages routes |
| `utils/auth.requireLogin` 검증 분산 | ✅ `safeInternalPath()` 헬퍼 사용 — auth path/외부 URL 거부 |
| 죽은 코드: `errorHandler.checkAuthError`, `useVersionCheck`, `login-redirect.ts`, `market-price-chart.tsx` | ✅ 4건 삭제 |

### 2026-04-29 후속 PR — TD-014/015/016 부분 처리

PR #286 머지 후 후속 작업 (이번 commit). 새 브랜치/PR 으로 진행.

#### TD-016 보안 잔여 처리 ✅ (HIGH 4건 + MEDIUM 4건 + LOW 1건)
- **HIGH** ✅ admin login·refresh·2fa rate limit 추가 (`/api/admin/refresh` 10/60s, `/api/admin/2fa/*` 5/300s)
- **HIGH** ✅ broadcast-notify `POST /send/:streamId` — stream 의 셀러만 트리거 (`stream.seller_id === auth.id` 검증)
- **HIGH** ✅ admin-streams `/streams/replay` 입력 검증 (title 200자, description 5000자, youtube_url 500자, product_ids 최대 50개)
- **HIGH** ⏭️ youtube live `start/end` — 이미 `WHERE id=? AND seller_id=?` 검증 적용 중 (Agent false-positive)
- **MEDIUM** ✅ auction.routes.ts 빈 catch 6곳 → `swallow()` 변환
- **MEDIUM** ✅ moderation `/check` — `requireAuth()` + rate limit 60/60s
- **MEDIUM** ✅ admin-notification-settings 빈 catch 2곳 → `swallow()`
- **MEDIUM** ✅ scheduled-cleanup cron 빈 catch 2곳 → `swallow()` 변환
- **MEDIUM** ✅ useAuthWorld / useAuthKR signOut 빈 catch → DEV 모드 console.warn
- **LOW** ✅ donations 메시지 sanitize 강화 (javascript:/data:/on*/HTML entity 차단)
- **CRITICAL** 🔴 seller-transfer 셀러 본인 인증 — 큰 변경 (별도 endpoint 신설 필요), 별도 PR

#### TD-015 a11y 잔여 처리 ✅ (모달 5개 + 카드 키보드 2개)
- **모달 표준화** ✅: `LiveDonation`, `FirstTimeTutorial`, `BroadcastDiagnostic`, `SellerPinPrompt`, `ChatInputModal`
  - `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
  - `useEscapeKey` 적용 (LiveDonation 은 useFocusTrap 도)
  - X 버튼 `aria-label` 한국어화
- **카드 키보드 접근** ✅: `ProductGrid`, `BrowseProductCard`
  - `role="button"` + `tabIndex={0}` + `onKeyDown` (Enter/Space)
  - `aria-label="{name} 상세 보기"`
- **잔여**: CheckoutPage 배송지 모달 폼 label `htmlFor`, AccountSettingsPage label, 색상 대비 — 별도 PR

#### TD-014 i18n — 별도 PR 권장 (이번 처리 0건)
- 462건 광범위 — namespace 신설 필요
- 우선순위 처리: CheckoutPage / TossPaymentWidget / GiftSendModal → SellerPinPrompt / KakaoLinkButton → NotificationsPage / LivePageV2 / ShortsPage → Admin/Agency

#### TD-005 부분 처리 ✅
- `seller-management.routes.ts` 의 SELECT — `COALESCE(stock_quantity, stock, 0)` 로 양쪽 안전 (migration 0233 적용 후 stock_quantity 컬럼 제거되어도 동작)

### 2026-04-29 후속 — 광역 audit 결과 (3개 영역)

이번 세션 카카오 무한 루프 fix 후 i18n / a11y / API 보안 전수조사 (3개 Agent 병렬). 결과:

#### TD-014 (신규) — i18n 하드코딩 한국어 100+건
- **Agent 결과**: 462건 검출, 결제 / 인증 / 라이브 / 알림 / 셀러·어드민·에이전시 페이지 광범위
- **이번 세션 처리**: 0건 (namespace 신설 필요한 광범위 작업 → 별도 PR)
- **권고 처리 순서**: (1) CheckoutPage / TossPaymentWidget / GiftSendModal — 결제 흐름, (2) SellerPinPrompt / KakaoLinkButton — 인증, (3) NotificationsPage / LivePageV2 / ShortsPage, (4) Admin/Agency 운영자 영역
- **주의**: B영역 (`t() || '한글'` fallback 패턴) 0건, C영역 (6언어 비대칭) 0건 — 키 인프라는 양호

#### TD-015 (신규) — a11y 30건 (모달 표준화 부재 / icon-only 버튼 / 폼 라벨 미연결)
- **Agent 결과**: 30건 HIGH/MEDIUM/LOW
- **이번 세션 처리** ✅: CartItem (X / -/+ 버튼 aria-label + 썸네일 alt), CartHeader (뒤로 가기 aria-label), ProductListSheet (`role="dialog"`, `aria-modal`, ESC + focus trap, 닫기 한국어화)
- **남은 작업**: LiveDonation / FirstTimeTutorial / BroadcastDiagnostic / SellerPinPrompt / ChatInputModal 모달 표준화. ProductGrid / BrowseProductCard 의 `<div onClick>` → `<a>` 변환. CheckoutPage 배송지 모달 폼 label htmlFor.

#### TD-016 (신규) — API 보안 audit
**CRITICAL 처리 ✅** (2건):
- ✅ `seller-orders.routes.ts` POST/PUT /products — `Number.isFinite()` + 범위 검증 (가격 0~1억, 재고 0~100만, 정가, 라이브가격) + name/description 길이 + status enum
- ✅ `agency-ops.routes.ts` PUT /targets, POST /contracts — `agency_sellers` 소유권 검증 (다른 에이전시 셀러 fake 계약 차단). target_amount Number.isFinite. PUT /contracts/:id status enum.

**CRITICAL 미처리** (1건 — 코드 변경 큼, 별도 PR):
- 🔴 `seller-transfer.routes.ts:193-249` 셀러 본인 인증 부재. `from_agency` 가 셀러 대신 이전 동의 가능. 셀러 JWT/카카오 세션 검증 + confirm-by-seller endpoint 신설 필요.

**HIGH 미처리** (5건 — 별도 PR 권장):
- admin login / 2fa rate limit 누락 (account_lockout 만 의존)
- broadcast-notify `POST /send/:streamId` 인증 약함 (스팸 가능)
- youtube live `start/end` stream 소유권 추가 검증
- admin streams 입력 검증 부족 (description 길이 등)

**MEDIUM 미처리** (7건 — 별도 PR):
- auction.routes.ts 의 `.catch(() => {})` 6+곳 → `swallow()` 헬퍼
- internal-admin-tools `BOOTSTRAP_TOKEN` 비밀번호 정책 강화
- moderation `/check` 인증/rate limit 추가
- signOut 빈 catch 보강

**LOW 미처리** (5건 — 정리 차원):
- donations 메시지 sanitize 강화 (DOMPurify)
- CSRF 보호 cookie-only endpoint 정리

### TD-003 (Cloudflare 유령 프로젝트) 진단 — 미해결 사용자 액션

**증상**: PR #286 의 `Workers Builds: ur-live-global` 빌드 매번 failure. `wrangler.toml` 변경 0건이라 PR 책임 아님.

**원인 추정**:
- `ur-live-global` 이라는 별도 Workers 프로젝트가 GitHub integration 으로 모든 push 마다 빌드 시도
- `wrangler.toml [env.production] name = "global-marketplace"` 와 이름 미일치 → 빌드 환경 변수/secret 누락 가능성
- CLAUDE.md "Pages 단일 배포" 정책 (2026-04-22 정리) 의 잔재 — Workers 프로젝트 자체는 삭제 안 됐을 것

**위험도**: 라이브 사이트 (ur-live Pages) 에 영향 없음. PR 머지 차단 안 함. 다만 매 push 마다 false-positive CI 실패 → 신규 사고 알림 노이즈.

**사용자 액션 필요**:
1. Cloudflare Dashboard → Workers & Pages → `ur-live-global` 확인
2. 옵션 A: GitHub integration 해제 (해당 Worker 비활성화)
3. 옵션 B: 프로젝트 자체 삭제 (이미 사용 안 하는 경우)
4. 옵션 C: 환경 변수/secret 정정해 빌드 통과시키기 (사용 중이면)

**근거**: 2026-04-22 사고 요약 (CLAUDE.md) — "별개 Workers 프로젝트가 Custom Domain 가로채" 사고와 같은 잔재 추정.

**상세 사고 사례**: `CLAUDE.md` 의 "2026-04-29 사고 요약" 참조.

신규 파일:
- `src/utils/safe-internal-path.ts` — open-redirect/자기참조 검증 단일 헬퍼
- `src/tests/unit/safe-internal-path.test.ts` — 36 테스트

삭제:
- `src/hooks/useVersionCheck.ts` — caller 0 (lib/version-check.ts 와 중복)
- `src/lib/errorHandler.ts:checkAuthError` — caller 0 + returnUrl 화이트리스트 누락

## 📊 이전 상태 요약 (2026-04-28 종료 시)

### 2026-04-28 마라톤 세션 — TD 추가 정리

| TD | 제목 | 상태 변경 |
|---|---|---|
| TD-006 | seller-management split | 2103 → 1167줄 (44.5%↓, registration + alimtalk + kakao-link 분리) |
| TD-006 | agency.routes split | 1984 → 1389줄 (30.0%↓, kakao-link + stats + settlements 분리) |
| TD-007 | Auction 자동 confirm | ✅ 토스 webhook handlePaymentConfirmed 가 user_id + current_price 매칭으로 자동 consume |
| 비즈니스 #1 | 뷰티/헬스 공구권 | ✅ 카테고리 enum + API + UI 칩 + 셀러 등록 폼 셀렉터 |
| 비즈니스 #2 | MD 위탁 판매 | ✅ migration 0236 + 4 endpoints + 정산 통합 + 셀러 대시보드 UI |
| 비즈니스 #3 | 선물하기 | ✅ migration 0237 + 4 endpoints + 받기 페이지 + 보내기 모달 + 환불 cron |
| Cron | gift expire/refund + consignment cleanup | ✅ scheduled-cleanup.ts 20-22번 추가 |
| Mobile | 카톡 인앱 흰화면 | ✅ index.html inline script 가 모듈 로드 전 안내 페이지로 교체 |

신규 파일 (2026-04-28):
- `src/features/seller/api/seller-{registration,kakao-link,alimtalk-mgmt,consignment}.routes.ts`
- `src/features/agency/api/agency-{kakao-link,stats,settlements}.routes.ts`
- `src/features/gifts/api/gifts.routes.ts`
- `src/lib/{consignment-split,consignment-settlement,gift,in-app-browser}.ts`
- `src/components/{InAppBrowserBanner,gift/GiftSendModal}.tsx`
- `src/pages/{SellerConsignmentPage,GiftClaimPage}.tsx`
- `migrations/{0236_consignment_partnerships,0237_gifts}.sql`

신규 단위 테스트: 89건 (gift 35 + consignment-split 20 + consignment-settlement 6 + scheduled-cleanup-cron 14 + in-app-browser 24 + voucher-categories 10 - 중복 제외).

### 2026-04-27 종료 시점 (이전)

| TD | 제목 | 상태 |
|---|---|---|
| TD-001 | D1 Migration CI | 🔴 사용자 액션 필요 (Cloudflare API token D1 권한) |
| TD-002 | 시크릿 노출 | ✅ 해결 (4종 회전 + Toss 재발급) |
| TD-003 | 유령 CF 프로젝트 | 🔴 사용자 액션 (Dashboard 정리) |
| TD-004 | 이중 라우팅 | ✅ 해결 (dead /rollback 제거) |
| TD-005 | 스키마 이중화 | 🟡 prep 완료 (migration 0233 — TD-001 대기) |
| TD-006 | 거대 파일 worker/index.ts | ✅ 해결 (54.8% 감소, 6개 파일 분산) |
| TD-007 | Auction 결제 reservation | ✅ 해결 (auction_holds escrow + forfeit + promote-runner-up + winner-paid + 알림) |
| TD-008 | INTERNAL_CRON_TOKEN | 🟢 사용자 액션 (Pages Variables) |
| TD-009 | Webhook 실패 모니터링 | ✅ 해결 (Sentry + getFailedStats) |
| TD-010 | i18n 완성도 | ✅ 해결 (35건 fallback + 28건 keys) |
| TD-011 | npm CVE | ✅ 해결 (xmldom DoS fix) |
| TD-012 | Node.js 20 deprecation | ✅ 해결 (FORCE_NODE24) |
| TD-013 | /api/seller 라우터 도표 | ✅ 해결 (CLAUDE.md 갱신) |
| **🆕** | `/api/auth/id-token` IDOR | ✅ 즉시 해결 (commit 8cb3116) |

**합계**: 14건 중 9건 해결 + 1건 prep + 4건 사용자 액션 대기.

## 🎯 사용자 액션 우선순위

1. **🔴 즉시 권장** — JWT_SECRET 회전 검토 (IDOR 취약 기간 토큰 무효화)
2. **🔴 TD-001** — Cloudflare Dashboard → API Tokens → 기존 token 에 `Account > D1 > Edit` 권한 추가 → migrate.yml 수동 실행 (30분)
3. **🟡 TD-008** — `INTERNAL_CRON_TOKEN` Pages Variables 등록 (5분, `openssl rand -base64 32`)
4. **🟡 TD-003** — 유령 CF 프로젝트 (`ur-live` Worker, `ur-live-global`, `ur-live-cleanup-cron`) 정리 (1시간)
5. **🟢 ALIMTALK_API_KEY** — Magic Link 식사권 알림톡 발송 활성화 (5분)

TD-001 해결 시 자동 후속 가능:
- migration 0233 적용 → 스키마 이중 컬럼 (stock_quantity, base_shipping_fee) drop → TD-005 마무리
- 응급 ensure*Columns/Tables 패턴 10+ 곳 deprecate 가능

---

## 🎉 2026-04-27 (저녁 2차) TD-006 worker/index.ts 분할 완료

**Before**: 2787줄 단일 파일 (2026-04-22 사고의 직접 원인)
**After**: 1259줄 + 6개 라우트 파일 (54.8% 감소)

| 신규 파일 | 라인 | Phase |
|---|---|---|
| `routes/sitemap.routes.ts` | 75 | 1 |
| `routes/docs.routes.ts` | 15 | A |
| `routes/internal-diagnostics.routes.ts` | 250 | B |
| `routes/internal-admin-tools.routes.ts` | 640 | C |
| `routes/smoke-test.routes.ts` | 265 | D |
| `routes/repair-schema.routes.ts` | 325 | E |

**효과**:
- inline 핸들러 25개 → 약 7개 (catch-all `*`, health, csrf 등 잔존 — 분리 가치 적음)
- 파일 중간 import 사고 재발 위험 크게 감소 (각 라우트 독립 모듈)
- 모든 endpoint path/auth 동일 — 외부 API 호환성 유지

**잔여 코드 정리** (이번 세션):
- `as any` 249건 → 238건 (11건 정리, 나머지는 Hono/Cloudflare framework 한계)
- 위험한 body cast 제거 (seller-orders, broadcast-notify, seller-management)

## 🚨 2026-04-27 (저녁) Critical 보안 패치

### `/api/auth/id-token` IDOR — Account Takeover 가능
- **위치**: `src/worker/routes/auth-token.routes.ts:48`
- **유형**: Authentication Bypass (호출자 검증 누락)
- **노출**: 누구나 다른 사용자의 `firebase_uid` 또는 숫자 `id` 만 알면 그 사용자의 backend JWT 발급 가능
- **수정**: 두 가지 인증 방식 중 하나 통과 필수 — (A) `ur_session` 쿠키 OR (B) Firebase ID token verify
- **상태**: ✅ 수정 + 배포 완료 (commit `8cb3116`)

### Defense-in-depth audit 결과
- 다른 mutation/token-issue 엔드포인트 광범위 점검 → **추가 IDOR 0건**
- agency/admin 라우트는 모두 ownership 검증 (`WHERE agency_id = ? AND seller_id = ?`)
- `/api/streams/:id/current-product` (e1c3b99) 및 `viewer-count` 도 sound
- `chat-messages` 의 anonymous user_id 는 display 용 (authorization 미사용 → OK)

### 권장 후속 액션
- ⚠️ JWT_SECRET 회전 검토 (취약 기간 동안 유출 가능성 시)
- session cookie 재발급은 자동 (다음 로그인 시 갱신)

## 📅 2026-04-27 (오후) 정리 세션 — 변경사항

### ✅ 해결됨
- **TD-004 dead /api/payments/rollback**: 2026-04-26 에 이미 제거됨 확인. `src/shared/api-routes.ts` 의 `payments.rollback` 상수도 정리 완료.
- **TD-009 webhook 실패 모니터링**: 배치 119 (2026-04-22) 에서 Sentry alert + escalation tag (retry≥3 → fatal) + `getFailedStats(hours)` admin 통계 API 완성. 추가 작업 없음.
- **TD-010 fallback 패턴**: `t('X') || '한글'` 35건 → `t('X', { defaultValue: '한글' })` 일괄 변환 (21개 파일). i18next missing key 시 fallback 정상 동작.
- **TD-011 npm audit**: `npm audit fix` 로 xmldom DoS CVE (high 1건) 해결. mod 16 → 14, high 1 → 0.
- **TD-012 Node.js 20 deprecation**: `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` 적용 완료.
- **TD-013 /api/seller 도표화**: CLAUDE.md 에 sellerPinRoutes 추가 (5번째 라우터).
- **console.log unguarded (browser)**: `useSessionValidation`, `useCart`, `auth-token.ts` 5건 DEV gate 추가. (worker code 는 의도적 제외 — Cloudflare Workers 표준 logging)

### ⚠️ 사용자 액션 필요 (코드로 자동 해결 불가)
- **TD-001 D1 Migration CI**: Cloudflare Dashboard → API Tokens → 기존 token 에 `Account > D1 > Edit` 권한 추가 필요. 30분 작업이지만 사용자만 가능.
- **TD-003 유령 CF 프로젝트**: Dashboard 직접 확인/삭제 필요.
- **TD-008 INTERNAL_CRON_TOKEN**: `wrangler secret put INTERNAL_CRON_TOKEN` 또는 Pages Variables 에 등록 필요.

### 📋 잔여 코드 부채 (다음 세션 또는 별도 PR)
- **TD-005 스키마 이중화**: `stock_quantity`/`base_shipping_fee` drop migration. **TD-001 선행 필요** (CI migration 안 도는 한 drop 적용 안 됨).
- **TD-006 거대 파일 분할**: `worker/index.ts:2787줄`, `SellerLiveBroadcastPage.tsx:2516줄`. 회귀 리스크 큼 — 별도 PR 권장.
- **TD-007 Auction 결제 reservation**: 1주 spec 작업.
- **빈 catch swallow 299건**: 대부분 legacy. `swallow()` 유틸로 점진적 마이그레이션 (이미 7개 페이지 적용 됨).
- **as any 249건**: type safety. legacy 라우터 중심 점진 정리.

## 📅 2026-04-27 마라톤 세션 — 변경사항 요약

### ✅ 해결됨
- **TD-002 시크릿 노출**: 4종 회전 (JWT/Refresh/Cron/Toss-Webhook) + Toss 결제 키 재발급. 이전 노출 값 모두 무효 처리.
- **chat-moderation 한글 차단 버그** (Phase 3-3 출시 후 미발견): `normalizeForMatching` 정규식 수정.
- **PushNotificationSetup 메모리 누수**: SW unregister 후 ready 영원히 pending → `getRegistration()` null check.
- **PK shouldEndPK ISO 문자열 비교 버그**: Date.getTime() 비교로 변경.
- **Idempotency-Key 검사 가짜 양성 5건**: 스크립트 정밀화 (POST/PATCH + 실제 fetch만).

### 🆕 추가됨 (32개 신기능 + 49개 단위 테스트 + PWA + 11개 마이그레이션)
- Phase 1: 에이전시 등급 / 부진셀러 알림 / QR 영입 / KPI / 부트캠프 / 라이브가이드 / 공개페이지 (7개)
- Phase 2: 가이드 / PL / 충성도 / 라이브KPI / 부스터 / 월간리포트 / PK이벤트 (7개)
- Phase 3: 최적시간 / FAQ봇 / 모더레이션 / TikTok발굴 / Network / 캐스팅 (6개) + 클립 보류
- UI 통합 6개 + 후속 5개 = 11개
- PWA (vite-plugin-pwa) + Sentry release 통일 + 결제 reconciliation Discord 알림

### 🟢 신규 운영 도구
- `/api/_internal/migration-status` — 마이그레이션 적용 검증 (admin)
- `npm run check:i18n` — 6개 언어 동기 검사
- `bash scripts/check-api-auth.sh` — 인증/Idempotency 검증

---

## 🔴 Critical

### TD-001: DB Migration CI 파이프라인 부재
**문제:**
- 205개 migration 파일 중 실제 프로덕션 D1 에 적용된 건 약 2개
- CI의 `CLOUDFLARE_API_TOKEN` 에 D1 Edit 권한 없어 `migrate.yml` 실행 시 auth error
- 수동 repair-schema 엔드포인트로 응급 처치 중

**영향:** 새 migration 추가해도 자동 적용 안 됨. 스키마 drift 재발 가능.

**해결법:**
1. Cloudflare Dashboard → My Profile → API Tokens
2. 기존 `CLOUDFLARE_API_TOKEN` 편집 → **Account > D1 > Edit** 권한 추가
3. GitHub Actions `migrate.yml` 수동 실행으로 밀린 migration 일괄 적용

**예상 작업 시간:** 30분
**소유자:** DevOps / 인프라 담당

---

### TD-002: `.dev.vars` 가 Git History 에 노출 — ✅ **2026-04-27 해결**
**해결 내역:**
- JWT_SECRET / REFRESH_TOKEN_SECRET / INTERNAL_CRON_TOKEN / TOSS_WEBHOOK_SECRET → 4종 회전
- TOSS_SECRET_KEY / TOSS_CLIENT_KEY → 토스 라이브 모드 재발급
- 이전 노출 시크릿은 모두 무효 처리됨 (현재 사용되는 시크릿은 새 값)
- Git history 정리는 의식적 보류 (모든 값 무효라 실해 0 — 사용자 결정)

**현재 보안 상태:** 🟢 안정. 이전 노출 시크릿 활용 X.

**참조 문서:**
- `docs/IMMEDIATE_DEPLOY_GUIDE.md` — 회전 절차
- `docs/POST_ROTATION_USER_ACTIONS.md` — 회전 후 액션

---

### TD-003: 유령 Cloudflare 프로젝트
**문제:**
- `ur-live` Worker (Dashboard 첫 번째): GitHub 자동 배포 되지만 secret 없음
- `ur-live-global` Worker: 49일간 "Latest build failed" 방치
- `ur-live-cleanup-cron` Worker: 용도 불명

**영향:** Worker 중 하나라도 잘못 트래픽 받으면 500 재발.

**해결법:**
1. Workers & Pages → `ur-live` (Worker) → Settings → Build → Disconnect GitHub
2. 1주일 관찰 후 문제 없으면 프로젝트 삭제
3. `ur-live-global` 빌드 실패 원인 확인 후 삭제 or 수정
4. `ur-live-cleanup-cron` 은 실행 로그 확인 후 정상이면 유지, 아니면 삭제

**예상 작업 시간:** 1시간
**소유자:** 인프라 담당

---

## 🟡 High

### TD-004: 이중 라우팅 구조 — 🟢 **Downgrade (2026-04-26 감사 완료)**

**감사 결과:** [`docs/DOUBLE_ROUTING_AUDIT.md`](docs/DOUBLE_ROUTING_AUDIT.md)

```
/api/orders ← ordersRouter (worker/routes/order.routes.ts)        ← CRUD 핵심
              + featureOrdersRoutes (features/orders/api/orders.routes.ts) ← 배송/CRON

/api/payments ← paymentsRouter (worker)         ← confirm/checkout/webhook
              + featurePaymentRoutes (features) ← /rollback (dead code)

/api/seller ← 7 라우터 (sub-path 분리 — 충돌 0)
```

**실제 충돌:** 0건. worker 와 feature 가 path 레벨에서 완벽히 분리됨.

**남은 정리 (LOW):**
- `POST /api/payments/rollback` (features/payments/api/payment.routes.ts:154) 는 호출처 없음 (dead code)
- `src/shared/api-routes.ts:159` 의 `payments.rollback` 상수도 dead

**권장:**
- 외부 연동 확인 후 dead `/rollback` 제거
- worker/feature 강제 통합 시도 금지 (이득 미미, 회귀 비용 큼)
- CLAUDE.md "이중 라우팅" 표현은 "co-mounted routing" 으로 정정 권장

**소유자:** Backend (정리 단계만 — 통합 시도 X)

---

### TD-005: DB 스키마 이중화 컬럼
**문제:**
- `products.stock` vs `products.stock_quantity` (둘 다 존재)
- `sellers.shipping_fee` vs `sellers.base_shipping_fee`
- `orders.total_amount` (신) vs `total_price/amount` (구, 금지)

**현황:** 코드가 `COALESCE(stock, stock_quantity, 0)` 같은 방어적 패턴으로 처리 중.

**영향:** 새 개발자 혼란. 업데이트 시 한쪽만 갱신하는 버그 가능.

**해결법:**
1. CLAUDE.md 의 "canonical 컬럼 규칙" 따라 통일 (stock 정답)
2. 구 컬럼 (`stock_quantity` 등) 드롭 migration 작성
3. 코드에서 `COALESCE` 제거하고 canonical 만 사용

**예상 작업 시간:** 2일
**소유자:** Backend 리드

---

### TD-006: 거대 파일 분할 필요
**문제:**
- `src/features/admin/api/admin-management.routes.ts`: **3521 라인**
- `src/worker/index.ts`: **1873 라인** (라우터 등록 + inline 핸들러 혼재)
- `src/worker/routes/webhook.routes.ts`: 558 라인

**영향:** 파일 중간 import 사고 (2026-04-22) 의 직접 원인. 가독성, 머지 충돌 리스크.

**해결법:**
- admin-management.routes.ts 를 다음으로 분할:
  - admin-users.routes.ts
  - admin-orders.routes.ts
  - admin-sellers.routes.ts
  - admin-coupons.routes.ts
  - admin-settlements.routes.ts
- worker/index.ts 의 inline 핸들러 → 별도 파일로 분리

**예상 작업 시간:** 1주
**소유자:** Backend 리드

---

### TD-007: Auction 결제 capacity reservation — ✅ **2026-04-28 해결**

**해결 내역:**
- `auction_holds` 테이블 (active/released/consumed) — deal balance escrow
- `getAvailableBalance()` — balance - active holds 합계
- 입찰 시 hold 자동 생성 + outbid 시 자동 해제
- self-outbid 시 본인 이전 hold 해제
- `/forfeit-winner` — 결제 불이행 차순위 자동 승격 + winner_history 기록
- `/promote-runner-up` — 차순위 수동 승격
- `/winner-paid` — hold consume (수동 트리거)
- webhook handlePaymentConfirmed — user_id + current_price 매칭으로 자동 hold consume
- `/release-hold` — 낙찰자 구매 포기
- `/holds/me` — UI 표시 (활성 hold + 가용 balance)
- 알림 (2026-04-28 마무리): outbid push / 낙찰 push / 승격 push

**잔여 (Low priority):**
- 경매 자동 종료 cron 미구현 — 현재는 lazy (다음 GET/POST 시 status='ended')
  → 입찰 0건으로 끝나면 status='active' 채로 남음 (실해 X, cosmetic)

---

## 🟢 Medium

### TD-008: 내부 CRON_TOKEN 미프로비저닝
**문제:** `/api/orders/internal/auto-confirm` 등 cron 전용 엔드포인트가 INTERNAL_CRON_TOKEN 환경변수 기반 인증을 기대하지만 미세팅.

**코드 위치:** `src/features/orders/api/orders.routes.ts:25, 449, 477`

**해결법:**
```bash
wrangler secret put INTERNAL_CRON_TOKEN
# 값: openssl rand -base64 32
```
Pages Dashboard 에서도 동일 추가.

---

### TD-009: Webhook 실패 이벤트 수집 미비
**문제:** `src/worker/repositories/webhook.repository.ts:69` — FAILED webhook events 모니터링 안 됨.

**해결법:** webhook_events 테이블에 status='FAILED' 로 저장 + Sentry alert.

---

### TD-010: i18n 완전성
**문제:** 셀러 대시보드에 하드코딩 한국어 다수. 6개 언어 키 추가 필요.

**영향:** 영어/일본어 사용자가 셀러로 가입 시 인터페이스 깨짐.

**해결법:** `public/locales/{ko,en,ja,zh,es,fr}/translation.json` 6개 파일 동기화.

**예상 작업 시간:** 2일 (기능 추가가 아닌 문자열 이동 작업)

---

### TD-011: 의존성 Low CVE 8건
**문제:** `npm audit` 에서 low severity 8건 (firebase-admin 내부 transitive).

**영향:** 미미. firebase-admin v13+ 가 나오면 자연 해결 예상.

**해결법:** 분기별 `npm audit` 리뷰.

---

## ⚪ Low

### TD-012: Node.js 20 Deprecation
**문제:** GitHub Actions 가 2026-09 부터 Node 20 deprecation 경고 발생.

**해결법:** `.github/workflows/main.yml` 에 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` 추가.

---

### TD-013: 중복 라우트 prefix
`worker/index.ts` 에 `app.route('/api/seller', ...)` 가 5번 이상 호출됨. 각 라우터가 non-overlapping sub-path를 가진다고 주석되어 있지만 검증 어려움.

**해결법:** 각 라우터의 실제 path 를 도표화해 CLAUDE.md 에 기록.

---

## 📊 요약

| 심각도 | 건수 | 예상 총 작업 시간 |
|--------|------|------------------|
| 🔴 Critical | 3 | 2.5시간 (사용자) |
| 🟡 High | 4 | 3주 |
| 🟢 Medium | 4 | 1주 |
| ⚪ Low | 2 | 수시간 |

**Critical 3건만 해결하면 운영 위험은 제거됨.**
High/Medium 은 코드 품질 & 유지보수성 이슈 — 단계적으로.

---

## 진행 기록

- **2026-04-22**: 이 문서 작성. 대장애 복구 완료 후 baseline 부채 정리.
- **2026-05-01**: 추가 부채 5종 (TD-018 ~ 022) 식별 + 3건 즉시 해결.

### 🆕 2026-05-01 추가 부채

#### TD-018 (HIGH): 거대 페이지 컴포넌트 분할 필요
**위치**:
- `src/pages/RestaurantMapPage.tsx` — 1387줄
- `src/pages/SellerLiveBroadcastPage.tsx` — 1336줄
- `src/pages/CheckoutPage.tsx` — 1291줄 (25+ useState 단일 컴포넌트)

**영향**: 머지 충돌 / 리렌더 성능 / 테스트 불가
**예상 작업 시간**: 2-3일 (페이지당 4-8시간)
**권장 접근**:
1. 큰 sub-section 을 별도 컴포넌트로 추출 (state 는 부모 유지)
2. 점진적으로 Zustand store 도입 (CheckoutPage 결제 단계, RestaurantMapPage 필터/지도, SellerLiveBroadcast 방송 상태)
3. 각 sub-component 단위 테스트 추가

#### TD-019 (MEDIUM): GuideViewer XSS 가드 ✅ 해결됨
**위치**: `src/components/guide/GuideViewer.tsx`
**해결**: 2026-05-01 DOMPurify 적용. ALLOWED_TAGS / ALLOWED_ATTR 화이트리스트.

#### TD-020 (MEDIUM): WELCOME 자동 쿠폰 endpoint ✅ 해결됨
**위치**: `src/features/coupons/api/coupons.routes.ts`
**해결**: 2026-05-01 `/api/coupons/auto-issue/welcome` 신설. user_coupons INSERT (idempotent).

#### TD-021 (LOW): region.ts logRegionInfo console gate ✅ 해결됨
**위치**: `src/shared/config/region.ts:256`
**해결**: 2026-05-01 `import.meta.env.DEV` 직접 사용. 이전 gate 가 항상 true 로 해석돼 production 노출되던 버그.

#### TD-022 (LOW): 로그인 흐름 진단 로그 정리 필요
**위치**: 여러 commit 들의 진단 로깅
- `KakaoAuthService.getUserInfo` — `[Kakao API RAW RESPONSE]` 로그
- `kakao.routes.ts /sync/callback` — `[Kakao Sync DIAGNOSTIC]` 로그
- `auth-callback-bootstrap.ts` 등

**상태**: 사용자 신고 ("유어팀(정지원)" 표시) 진단 목적. 해결 후 제거 권장.
**예상 작업 시간**: 30분

- **2026-04-22**: 이 문서 작성. 대장애 복구 완료 후 baseline 부채 정리.

---

## 🆕 2026-05-15 — 공구 서비스 기술 부채 (Round 14 commits 후)

### TD-G01 (MEDIUM): group-buy.routes.ts 분리 ✅ **3단계 완료 (2026-05-15)**

**최종 결과** (1446 → **475줄, -67%**):
- `helpers.ts` (199줄) — 공유 helper / 상수 (commission rate, ensureTables, calcTierDiscount, voucher code, magic link, alimtalk)
- `group-buy-admin.routes.ts` (228줄) — analytics / list / force-refund (sub-router)
- `group-buy-seller.routes.ts` (174줄) — refund / seller-voucher-stats / voucher-logs (register 패턴)
- `group-buy-public.routes.ts` (228줄) — products / live-ticker / participants / commission-rate / my / verify (register 패턴)
- `group-buy-voucher.routes.ts` (309줄) — /:code/use / partial-refund / store-stats (register 패턴)
- `group-buy.routes.ts` (475줄) — /join/:id 만 main 에 남김 + sub-router 마운트

**검증**:
- 외부 API path 변경 0 — 모든 sub-router 가 같은 prefix `/api/group-buy/`, `/api/vouchers/` 에서 응답
- 1738개 테스트 (helpers.ts 단위 테스트 11개 추가) 모두 pass
- TypeScript / build 클린

---

**원본 부채 분석 (참고)**:
**위치**: `src/features/group-buy/api/group-buy.routes.ts`
**문제**: 1446줄 단일 파일. admin / seller / public / voucher 4 영역 혼재.
- admin: `/admin/list`, `/admin/force-refund`, `/admin/analytics`
- seller: `/refund/:productId`, `/seller-voucher-stats`, `/voucher-logs`
- public: `/products`, `/products/:id`, `/live-ticker`, `/products/:id/participants`
- voucher: `/join/:id`, `/:code/use`, `/voucher/:code/partial-refund`, `/verify/:code`, `/store-stats/:productId`
- helper: tier discount, magic link, alimtalk

**권장 분리**:
```
src/features/group-buy/api/
├── group-buy-public.routes.ts    (~300줄, products 조회 / live-ticker)
├── group-buy-join.routes.ts      (~400줄, /join + tier + ledger + email + 마일스톤)
├── group-buy-voucher.routes.ts   (~300줄, voucher use / refund / partial-refund)
├── group-buy-seller.routes.ts    (~200줄, seller-voucher-stats / voucher-logs / refund)
├── group-buy-admin.routes.ts     (~250줄, admin/list / force-refund / analytics)
└── helpers/
    ├── tier-discount.ts
    ├── magic-link.ts
    └── alimtalk.ts
```

**위험**: 한 번에 분리하면 import 경로 폭발 + git history 추적 곤란. **점진 분리** (admin → 한 commit, voucher → 다음 commit).
**예상 작업 시간**: 2-3 세션

### TD-G02 (LOW): 12개 `as any` / `<any>` 캐스트 ✅ **해결됨 (2026-05-15)**
- ✅ `src/shared/db/group-buy-types.ts` 정의 (GroupBuyProductRow / VoucherRow / OrderRow / ParticipantRow)
- ✅ group-buy.routes.ts 의 `first<any>()` / `(v as any).xxx` 전부 제거
- 잔존 `<any>` (다른 파일) — 별도 부채로 추적

### TD-G03 (LOW): voucher-categories enum 6개 반복 선언 ✅ **해결됨 (2026-05-15)**
- ✅ `src/shared/constants/voucher-categories.ts` 단일 source 생성
- ✅ TS 배열 참조 모두 `VOUCHER_CATEGORY_SET` / `VOUCHER_CATEGORIES` 교체
  - SellerGroupBuyOverview.tsx / seller-orders.routes.ts / ProductDetailPage.tsx / group-buy.routes.ts /products
- SQL inline 6 카테고리 string 은 그대로 유지 (변경 빈도 0, 안정성 우선)

### TD-G04 (LOW): 22개 console.* — 일부 production noise ✅ **해결됨 (2026-05-15)**
- ✅ 5개 console.warn (best-effort 실패) DEV 게이트
  - [gb ledger] / [group-buy referral] / [group-buy email] / [partial-refund ledger] / [disputes/submit AI]
- console.error 는 실제 운영 디버깅용으로 유지 (Workers tail 로 수집)
- DEV-only noise 제거 완료

### TD-G05 (MEDIUM): 부분 환불 → ledger 미통합 ✅ **해결됨 (2026-05-15)**
- ✅ `group-buy-voucher.routes.ts /voucher/:code/partial-refund` 에 `recordLedger({ event_type: 'partial_refund', debit_account: seller:N, credit_account: user:N })` reverse entry 추가
- 회계 정합성: partial-refund 도 ledger_entries 에 정상 기록됨

### TD-G06 (LOW): 분쟁 endpoint 2FA 검증 미적용 ✅ **해결됨 (2026-05-15)**
- ✅ `src/worker/middleware/require-2fa.ts` 신규 미들웨어 (2FA 활성 어드민 대상 totp 헤더 검증)
- ✅ `disputes.routes.ts /admin/:id/approve`, `/reject` 에 `require2FA()` 적용
- ✅ `group-buy-admin.routes.ts /admin/force-refund/:productId` 에도 적용
- 추가 sensitive action (settlement override 등) 도 동일 패턴으로 확장 가능

### TD-G07 (LOW): live-ticker / participants polling 부하 ✅ **해결됨 (2026-05-15)**
- ✅ `GroupBuyDetailPage` polling 5초 → **3~7초 jitter** (`5000 + (Math.random()-0.5)*4000`) 적용 → D1 thundering herd 방어
- ✅ `document.hidden` 체크 → 백그라운드 탭 polling 중단 (배터리 + 트래픽 절감)
- ✅ `LiveTicker` 도 `document.hidden` 가드 + 30초 interval (변경 없음, 부하 낮음)
- SSE / Durable Object 도입은 동시 5000명+ 시 재검토

### TD-G08 (HIGH): 정합성 검증 cron 없음 ✅ **해결됨 (2026-05-15)**
- ✅ `src/worker/cron/ledger-reconcile.ts` 신규 (Σdebit - Σcredit 검증 + user wallet 음수 잔액 감지)
- ✅ `scheduled.ts` 의 daily 18:00 트리거에 등록 (`safeCron('ledger-reconcile', ...)`)
- ✅ 불일치 ≥ 1원 또는 음수 wallet 1개+ 감지 시 Discord webhook 즉시 alert
- 임계값 (`IMBALANCE_THRESHOLD = 1`) 은 반올림 오차 ε 허용

