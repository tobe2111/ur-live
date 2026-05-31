# 🚧 진행 중 작업

## 🟢 2026-05-31 — 테마 backlog 정리 (2차) + 공구 결제 런타임 버그 fix
- **공구 join 응답 ReferenceError fix** (`group-buy.routes.ts:854`): A2 단일가 전환 때 제거된 `currentTier` 를 응답이 계속 참조 → 런타임 `ReferenceError`. `next_tier: null` 로 교정 (A2 모델 정합). confirm-toss `body.ref` 타입 union 누락도 fix → **tsc 0** (이전 세션 node_modules 부재로 미검출된 잠복 타입에러 2건 해소).
- **테마 backlog 정리**: checker 정밀화(streaming/guide/dashboard 폴더 + ProductOptionForm/BulkUploadModal/LiveDonation 제외 — usage 추적으로 라이트 고정 확인) → 오탐 202→실제 58건. 유저 대면 26파일 dark: variant 정합(state-variant aware) + 이전 perl 잠복 orphan(`dark:hover:bg-[X] dark:bg-[X]`, `placeholder:text dark:text`, `hover:text dark:text`) 전수 제거. 남은 1건은 토글 thumb(의도된 흰색).
- npm 의존성 설치 후 tsc/build:worker 실검증 통과.

## 🟢 2026-05-31 — 다크/라이트 테마 전반 정합 + 미래 자동 강제
사용자 요구: "다크/라이트테마 가장 이상적으로 작업 전반 + 앞으로 생성/수정 페이지에도 정확히 적용".
- 유저 대면 화이트-토글 페이지 13종 dark: variant 정합 (GroupBuyDetail/ProductDetail/MyVouchers/MyReturns/MyAppointments/MyFollows/Affiliate/FAQ/Search/About/GroupBuyList/Address/CuratorEarnings/MapSearchHeader)
- perl 일괄치환이 만든 깨진 클래스 전수 교정: `dark:dark:`, 중복 `dark:bg-`/`dark:text-`, state 오매핑(`hover:bg-gray-100`→잘못된 `dark:bg-` 대신 `dark:hover:bg-`) → 0건 확인
- **미래 자동 강제**: `scripts/check-theme-consistency.mjs` (variant-aware, 대시보드·순수다크·콜백 제외) 를 pre-commit(staged) + `verify.yml` CI 에 등록 (warn-only, `STRICT_THEME=1` 차단, `[SKIP_THEME_CHECK]` 우회). CLAUDE.md 테마 섹션 + 영구 방어선 표 갱신.
- 기존 backlog ~200건(공유 컴포넌트 streaming/dashboard 다수) 은 warn 유지 — 점진 정리 후 strict 승격 예정.

## 🟢 2026-05-31 — 오프라인 공구 운영 플로우 audit + 자금 커버리지 갭 3종
역할별(매장/인플/에이전시) 운영 플로우 전수 audit. 서브에이전트 2종 결과를 **직접 검증해 오판 정정**:
- ❌→✅ "에이전시 정산 자동화 없음" 오판 — `agency-auto-settle.ts`(자동 집계+`agency_settlements` INSERT) + `agency-monthly-invoices` 실재
- ❌→✅ "매장 가입 pending 병목" 오판 — NTS 사업자 진위확인 자동승인 end-to-end 구현(폼이 rep_name+start_date 수집·전송). **`NTS_API_KEY` 환경변수만 설정하면 자동활성** (코드 변경 불필요·운영자 사안)
- ❌→✅ "3자 분배 0%" 오판 — 에이전시(intro 2%/매장별) + 인플(referral/?ref별) **병렬 공존**

**고친 실제 갭 (자금 누수)**:
- #2 카드 결제 인플 referral attribution 누락 → `applyGroupBuyReferral` 헬퍼로 닫음 (`fb5f809`)
- #1a 매장 정산 입금완료 알림톡 추가 (`daf9bee`)
- #3 에이전시 intro 커미션 공구 경로(딜+카드) 누락 → `creditAgencyStoreIntroCommission` 호출 추가 (`60586ae`)

**남은 것**: 인플/에이전시 최종 은행송금 자동화(PG 연동·KR 특성상 수동 일반), 정산서 PDF, Magic Link 영구저장. NTS_API_KEY 프로덕션 설정 확인(운영자).

## 📋 사용자 액션 TODO (로컬 — 원격 환경 빌드 불가)
- [ ] **SSR prerender 실제 동작 검증** (Phase 2 후속):
  ```bash
  npm run build:client && npm run build:ssr && npm run prerender:main
  ```
  - ✅ 성공: `[prerender-main] ... 갱신 완료 ✅` + `dist/client/index.html` 의 `<div id="root" ... data-ssr="main">` 에 카드 HTML 존재
  - ❌ throw: 에러가 찍은 module/전역을 `docs/SSR_MIGRATION.md` audit 패턴(`typeof window/document` 가드 or useEffect)으로 fix → 결과 공유
  - 성공 확인 후 → Phase 4(`_routes.json`) / Phase 5(Lighthouse 재측정)
- [ ] 배포 반영 확인: `claude/service-tech-debt-analysis-d1KOx` → main 머지 + Actions 녹색
- [ ] 배포 후 1회: `POST https://live.ur-team.com/api/_internal/repair-schema` (숙소 migration 보장)
- [ ] 스모크: 공구 카드결제 / 숙소 예약·취소 각 1건 (이번 세션 가격·환불·재고 변경분)
- [ ] **`NTS_API_KEY` 프로덕션 설정 확인** — 매장 가입 자동승인(국세청 진위확인)이 이 키 없으면 전원 pending 으로 묶임 (Cloudflare Dashboard → ur-live → Variables)

## 🟢 2026-05-31 — SSR Phase 2 메인 트리 audit + fix
- 인프라(entry-server renderToString + prerender HTML inject) 이미 구현 + graceful skip 확인
- 메인 `/` 트리 정적 audit: 실제 throw 는 `isLoggedInSync()` 하나 → `typeof localStorage` 가드 추가
- useTheme/i18n/useAuthKR/localCache/App.tsx/GroupBuyFeed/BottomNav 전부 가드 확인(안전)
- **다음(로컬 필수)**: `npm run build:ssr && npm run prerender:main` → prerender 성공/추가 throw 확인. 가이드 `docs/SSR_MIGRATION.md`

## 🟢 2026-05-31 — 백엔드 보안·하드닝 + 후속 4종 + 문서 동기화
- 카카오 구독자 전체발송 무인증 스팸 벡터 차단 (`38298f4`) — rateLimit+requireAuth+소유권
- 셀러/에이전시 카카오 연동 에러 누출 → safeError (`38298f4`)
- #1 숙소 취소/환불 객실 재고 복원 버그 fix + status 정합 (`40a5668`)
- #2 미결제 pending 숙소 예약 자동 만료 cron (안전 옵션) (`33622d8`)
- #3 카드(toss) A2 단일가 정합 + confirm-toss 정산기록 보강 (`1632642`)
- #4 어드민 에러 누출 37곳 safeError 통일 (`a8e3819`)
- `TECHNICAL_DEBT.md` 2026-05-31 동기화 + 후속 완료 기록
- **남은 것**: stay hold 모델([UNLOCK]), confirm-toss 인플 attribution, 데이터페칭 통합/God파일/SSR(대규모)

## 🟢 2026-05-30 — 공동구매 = 즉시판매 단일가 모델 (A2 구현 완료, 가격 코어)
- 결정 확정: 경제=즉시판매, 이름=공동구매 유지, 가격=**A2 최대 tier 즉시 단일 적용** (사용자 승인)
- 설계안: `docs/design/groupbuy-instant-sale.md`
- 구현 (`[UNLOCK_LOADING]` 사용자 허가, CLAUDE.md audit log 기록):
  - `helpers.ts` `maxTierDiscount()` 추가 / `group-buy.routes.ts:223` join 가격 = maxTier
  - `group-buy-public.routes.ts` 상세 current_discount_pct 고정 + next_tier=null, 리스트 current_price enrich (캐시 헤더 불변)
  - `GroupBuyDetailPage.tsx` 단계별 tier 사다리 + "N명 더 모이면 할인 시작!" 제거 → 정직한 단일가 안내
- tsc 0 / schema·status·sql 검증 통과
- **후속 4종 완료(2026-05-30)**:
  - ① 셀러 폼 tier 입력 제거 → 단일 공구가 안내 + i18n 6개 언어 (`SellerMealVoucherNewPage`)
  - ② 기존 진행중 공구: 런타임 maxTierDiscount 흡수 → 백필 불필요 검증
  - ③ 사용자 셀프 취소/청약철회: `POST /api/group-buy/voucher/:code/cancel` (본인+미사용+7일) + MyVouchersPage UI
  - ④ breakage: `auto-settlement.ts:173` 이미 만료 시 고객환불 — 문서화만
- **잔여 후속 3종 완료(2026-05-30)**:
  - 셀러 가이드 `groupbuy-single-price` 섹션 신설 (guide-seed-seller.ts)
  - 인플 clawback 통합: `helpers.clawbackVoucherCommission()` → 셀프취소 + 셀러 /refund 연결 (누수 차단)
  - 환불 알림톡 통합: `helpers.sendRefundAlimtalk()` → 셀프취소 + 부분환불 연결

**최종 업데이트**: 2026-05-28 (서비스 모델/정산 통합 + SSR 마이그레이션)
**브랜치**: `claude/check-live-commerce-flow-jgNs8` (서비스모델/정산) · `claude/vibrant-feynman-m3X3m` (SSR)

## 🚧 진행 중: SSR 마이그레이션 (LCP 10.7s → 0.5-1.5s)

**가이드**: `docs/SSR_MIGRATION.md` 필독. Phase 1-5 자세한 계획 + audit checklist.

**완료**:
- Phase 1 인프라 (`74a0625`): entry-server/client placeholder, vite build:ssr script, prerender-main 스켈레톤
- Phase 2 첫 fix (`c113f1b`): BottomNav 8/15곳 SSR-safe (useState + useEffect)
- Phase 3 Step 3-1 (`e3a3a7e`): App.tsx Router prop 받기 (default = BrowserRouter, 기존 동작 100% 보존)
- 추가: 카드 이미지 흐림 fix (`1d22ee0`) — cf-image width 200→300

**다음 세션 진행 순서 (이상적 path)**:
1. **Step 2-1 잔여**: BottomNav 나머지 7곳 (linkshopPath/cachedSeller/cachedHandle/JWT decode)
2. **Step 2-3**: 메인 페이지 의존 lazy import 페이지들 SSR-safe 검증
3. **Step 3-2**: entry-server.tsx 진짜 구현
   - `renderToString(<App Router={StaticRouter} routerProps={{ location: url }} />)`
   - HelmetProvider SSR mode
   - React Query dehydrate
4. **Step 3-3**: prerender-main.mjs 진짜 구현
   - API fetch (`/api/group-buy/products?status=active&category=all`)
   - import('./dist/server/entry-server.js')
   - renderApp('/', initialData)
   - dist/client/index.html 의 `<div id="root">` 안에 HTML inject
5. **Step 3-4**: package.json build script 확장
6. **Step 4**: `_routes.json` (메인 페이지만 정적)
7. **Step 5**: Lighthouse 재측정 + 카카오 OAuth 검증

**위험 영역**:
- entry-server 가 import 하는 모든 모듈 SSR-safe 필수 (한 곳 throw → 빌드 실패)
- BottomNav 잔여 7곳 + lazy import 페이지들 module 평가 시점 audit
- 결제(Toss V2 잠금) / 카카오 OAuth / 라이브 = 풀 audit 필요

**현재 Lighthouse 측정값** (이번 세션 마지막):
- Performance 44-66 (측정 변동 큼)
- LCP 8-11s (메인 페이지)
- TBT 300-1000ms
- CLS 0-0.188

**SSR 적용 후 목표**:
- Performance 85-92
- LCP 0.5-1.5s
- TBT/CLS 유지

---


## ✅ 2026-05-27 — 로딩 최적화 2차 (critical path -31%, 14 commits)

### 사용자 보고 → 처리
1. "전반적 로딩 길다, 공구 느림" → 폴링 / countdown / SSR 카테고리 prewarm
2. "/user/profile 1개 → /my-vouchers 0개" → voucher cache invalidation 영구 fix
3. "트래픽 절감 + 속도 가장 이상적으로" → chunk Phase 1-5 + image proxy 확장
4. "비용 0 원칙" → 모든 변경 무료 (D1/cf-image/KV write 한도 안)

### Critical path 변화
| 단계 | path | gzip |
|---|---|---|
| 초기 | ~1100 KB | ~330 KB |
| 최종 (`74bb925`) | **759 KB** | **228 KB** |
| **절감** | **-341 KB (-31%)** | **-102 KB (-31%)** |

### 14 commits
| # | hash | 효과 |
|---|---|---|
| 1 | `c4925af` | 공구 detail 폴링 + countdown adaptive |
| 2 | `daeb2c8` | voucher cache invalidation (사용자 보고 #2) |
| 3 | `cb8d0a5` | 카테고리 prewarm + Cache-Control 분리 + cf-image cache |
| 4 | `9de2840` | useMyCounts 통합 + Card.memo + SSR/cache 확장 |
| 5 | `21ab0fb` | 공구 detail below-fold lazy + unused import |
| 6 | `b8bd41d` | cf-image host 확장 + lazy rootMargin + VoucherMap lazy |
| 7 | `5583eed` | img-utils critical path -51KB + admin limits + audio singleton |
| 8 | `cbb08c8` | env-validator dynamic + admin/agency limits + 4 모달 lazy |
| 9 | `5e556a4` | env-validator chunk 분리 → validation -52KB lazy |
| 10 | `dfb11df` | Phase 1+2 chunk 분할 |
| 11 | `374ea9c`→`336a988` | Phase 3 FrameWrapper 사고 + rollback |
| 12 | `c1a42d7` | Phase 4 live hooks |
| 13 | `74bb925` | Phase 5 useCart/useSearch/useTokenAutoRefresh hoisted |

### 다음 우선순위
1. 사용자 액션 — Lighthouse 실측 (cloud 환경 403 차단)
2. 자동 main 머지 + 배포 확인 (Actions 탭)
3. 사용자 증가 대비:
   - C: SellerOrdersPage React Query (작업 중)
   - A: AdminOrdersPage 서버 페이지네이션 (큰 작업)
   - B: AdminPage SSE 마이그레이션 (인프라)
   - D: AgencyPage bundle endpoint

## 🎯 전략 (2026-05-28): 공동구매가 주력, 라이브커머스는 보조
- 우선순위·신규 투자는 **공동구매 플로우** 1순위. 역할/커미션/정산 SSOT = `docs/SERVICE_MODEL.md`.
- 정산 통합(§9): `creditUserCommission()` SSOT 추가됨 (현금/딜 1결정점). 추천 rail 통합은 payment.routes.ts 잠금 해제 후.

---

## ✅ 2026-05-27 세션 — 로딩/큐레이터/리뷰/운영 영구 fix (~50 commits)

### 1. 로딩 최적화 ($0 한도 도달) — CLAUDE.md "🔒 로딩 최적화 잠금" 추가
- KV write 일 3,744 → **0** (월 $2-5 → $0)
- `publicCache useKv: false` + CDN-Cache-Control 분리
- SSR inject **5페이지** (메인 / 공구상세 / 셀러 / vouchers / browse / curator)
- cron prewarm 5분 + 인기 셀러/상품/큐레이터 top 10 dynamic warm
- D1 partial composite index (10만 상품 O(log N))
- 이미지 변환 27+ 호스트 (firebase / pstatic / daumcdn / giftishow / kt) + Save-Data
- prefetch 4단계 (hover/touch/focus + viewport + speculation prerender)
- MainHomePage eager + idle prefetch 5탭
- preload mode mismatch 영구 제거
- `X-SSR-Status` + `Server-Timing` 헤더 (production 측정)
- `RestaurantMiniMap` IntersectionObserver lazy
- 공구 카드 shimmer skeleton

### 2. 큐레이터 모델 — 핵심 흐름 완성
- 일반 user 도 공개 페이지 (`/u/{handle}` — handle 자동 생성)
- KakaoAuthService same-email seller auto-link + repair-schema backfill
- BottomNav 4중 안전망 (seller_username / linked_seller / handle / seller_token JWT decode) + App.tsx idle warming
- 큐레이터 페이지 셀러 수준 (banner 업로드 / 인라인 편집 / grid-3 통계 / grid-2 CTA / 탭 4개 (홈/상품/식사권/정보) / sticky owner 배너 / 라이트-다크)
- PATCH `/api/curator/me/profile` (name / bio / profile_image / banner_url)
- 추천 링크 복사 → 자동 핀 추가 (idempotent)
- 핀 삭제 본인 view (group-hover ✕)
- 우하단 📌 담기 FAB (선물 버튼 아래, 1판매당 적립액 표시)

### 3. 자동 로그아웃 영구 fix
- `RouteGuards.isAdminLoggedIn / isUserLoggedIn` 토큰 존재만 검사
- KakaoCallback `user_type` 보존 (admin/agency 토큰 있을 때)
- `isLoggedInSync` 토큰만 검사 → `/my-vouchers` 빈 화면 영구 fix

### 4. 리뷰 시스템 영구 fix
- D1 트리거 v2: INSERT 즉시 `review_count` + `avg_rating` + **`sold_count = MAX(현재, review × 3)`**
- `autoSeedFakeReviews` soldMultiplier 3-5 random
- repair-schema backfill: `sold_count < review × 3` 자동 정정
- cron `maxBatch 200 → 1000` (시드 처리량 5배)
- BrowsePage / VouchersPage 카드 review=0 시 "신규" 표시

### 5. KT Alpha 마진 재계산
- `POST /api/admin/kt-alpha/recalc-prices` (사용자 결정)
- AdminKtAlphaPage "📊 일괄 재계산" 버튼

### 6. UI / UX
- PWA 팝업 분홍 네모 제거 + "🎁 앱 설치하면 환영 쿠폰!" (6언어)
- 교환권 default sort = `price_low`
- 카드 image fade-in + 카테고리 dominant color
- 셀러 placeholder name fallback (username)
- 공구 상세 SNS 버튼 4개 (인스타/유튜브/틱톡/페북) — 채팅/매너온도 X
- 큐레이터 라이트 테마 토글 지원
- 장바구니 썸네일 fix

### 7. 운영 통합
- `/api/admin/ops-status` — schema-repair / 활성 상품 / 24h 주문 / errors / KT Alpha 24h
- `/api/admin/csp-violations` — CSP 위반 패턴 분석
- `docs/OPS_RUNBOOK.md` — D1 Migration CI / Secret 회전 (다음 2026-10-27) / KV 모니터링 / 카카오 OAuth 체크리스트

### 8. 사고 영구 fix
- 공구 detail 500 (sns_tiktok 누락) → 3단계 graceful fallback SQL
- 링크샵 → /host/new fall through → email fallback + handle 자동 생성 + idle warming
- 핀 redirect 404 → URL suffix 제거
- 셀러 ↔ 큐레이터 self-affiliate 차단 검증 (이미 적용)

### 새 세션 진입 시 액션
1. `CLAUDE.md` 의 "🔒 로딩 최적화 잠금" 27개 항목 절대 변경 X
2. `docs/OPS_RUNBOOK.md` 사용자 액션 안내 (CI / Secret)
3. production 즉시 적용 안내:
   - `POST /api/_internal/repair-schema` — D1 트리거 + backfill
   - `POST /api/admin/reviews/auto-seed-missing {max_batch:1000}` — 별점 즉시 시드
   - `curl -sI https://live.ur-team.com/ | grep x-ssr-status` — SSR 검증

---

## ✅ 2026-05-25 — Phase 3+4 (호스팅 + 정산 + 셀러 승급) 완료

migration 0280 — 누구나 voucher 공구 호스팅 + 큐레이터 출금 UI.

| Commit | 영역 | hash |
|---|---|---|
| 1/5 | DB + 정책 SSOT (HOSTING/WITHDRAWAL) | `04ce0a3b` |
| 2/5 | Worker API (hosting + 출금) | `236e1673` |
| 3/5 | Frontend 호스팅 페이지 3개 | `(Commit 3)` |
| 4/5 | 출금 UI + 셀러 승급 안내 | `23ffa387` |
| 5/5 | 가이드 + docs | (이 commit) |

**Phase 3**: /host (목록) / /host/new (카탈로그) / /g/:invite_code (친구) — 1탭 호스팅
**Phase 4**: /u/me/earnings 출금 모달 + 원천징수 3.3% + 누적 50만원+ 셀러 승급 안내

## ✅ 2026-05-25 — Phase 2 (배송 재설계) 완료

migration 0279 + tracker.delivery 무료 API + 외부 URL fallback + cron sync + CSV 일괄.

| Commit | 영역 | hash |
|---|---|---|
| 1/5 | DB + 정책 SSOT + V2 배송비 함수 | `9d913840` |
| 2/5 | tracker.delivery + courier-codes + 5 endpoints | `(commit 2)` |
| 3/5 | order.routes V2 + 셀러 송장 carrier_code | `bb45dae6` |
| 4/5 | 인앱 추적 모달 + MyOrders 통합 | `74d945ba` |
| 5/5 | 어드민 CSV UI + 가이드 + docs | (이 commit) |

**3중 안전망**: tracker.delivery (무료) → 외부 URL fallback → cron 7일 추정
**지역별 배송비**: 제주 +3000, 도서산간 +5000 (`regional_shipping_fees` SSOT)
**12개 택배사**: CJ/한진/롯데/우체국/로젠/CU/GS/대신/일양/경동/천일/CWAY

## ✅ 2026-05-25 — Phase 1 (링크샵 + 큐레이터 + 1탭 핀) 완료

migration 0278 + worker API 13개 + 큐레이터 페이지 2개 + 핀 1탭 UX + 가이드 동기화.

| Commit | 영역 | hash |
|---|---|---|
| 1/5 | DB schema + 정책 SSOT | `97cd54b2` |
| 2/5 | Worker API + push + OG image | `060e0249` |
| 3/5 | Frontend 1-A 인프라 | `82ddc4a9` |
| 4/5 | Phase 1-B 핀 1탭 UX | `0f4824cd` |
| 5/5 | Phase 1-C+D 공유 + 가이드 | (이 commit) |

### 새 라우트
- `/u/:handle` (public, 다크 테마)
- `/u/me/earnings` (requireUser)
- `/u/:handle/p/:productId` (redirect)
- 13 worker endpoints under `/api/curator/*`

### ✅ 전체 신모델 인프라 완료 (2026-05-25)
- Phase 1 ~ 5 모두 완료
- Phase 6 (합배송) 인프라만 (`ENABLE_BUNDLING=false`)
- 정책 동적화 — 어드민이 9개 정책 코드 변경 없이 조정 가능 (`/admin/platform-settings`)
- 반품 carrier 정규화 + audit 통합

### 후속 PR 가능
- 합배송 UI 활성화 (Phase 6)
- 인스타 스토리 canvas 합성 (마케팅 UX)
- ja/zh/es/fr i18n 번역 (현재 한국어 stub)
- 반품 회수 송장 추적 UI


## 🚀 2026-05-25 — 비즈니스 모델 Pivot 컨셉 단계 진입

**사용자 결정 (2026-05-25 채팅)**: 라이브커머스 → "어드민 SSOT 카탈로그 + 모든 유저 큐레이터(링크샵) + 공구 호스팅 + 어필리에이트" trinity 로 전환.

- **컨셉 docs**: `docs/design/linkshop-pivot.md`
- **배송 재설계 docs**: `docs/design/shipping-redesign.md`

### 진행 순서
```
Phase 0 — MD/sourcing 사업 준비 (코드 외)
Phase 1 — 링크샵 + 큐레이터 핀 (코드 시작점)
Phase 2 — 배송 재설계 (별도 docs, A/B 결정 후 진행)
Phase 3 — 공구 호스팅 (정의 A/B 결정 필요)
Phase 4 — 어필리에이트 정산 (현행 0.5% 양방향 확장)
Phase 5 — 셀러 흡수 (Migration)
Phase 6 — 마케팅/UX 강화
```

### 옛 작업 처리
- Quick Action FAB: 신모델에서 "공구 호스팅 / 큐레이터 시작" 으로 재정의 — 옛 시안 (`quick-action-fab.md`) 은 신모델 흡수 예정
- 카카오 FAB: 그대로 보류 (`featureFlags.kakaoFab=false`)

## ⏳ 사용자 결정 대기 (Phase 1 시작 전 확정 필요)

### ✅ 2026-05-25 결정: A 채택 — voucher 공구 only
- 누구나 voucher 공구 호스팅 가능 (Phase 3)
- 실물 배송은 일반 쇼핑 (1인 주문) only — shipping-redesign §6 deprecated
- **추가 강조 요구사항** (사용자 명시):
  - 유저가 공개 페이지 (링크샵) 에 **상품 핀이 매우 쉬워야** — 모든 상품 카드에 1탭 핀 버튼
  - **수익이 즉시 보여야** — 큐레이터 대시보드 + 핀별 stats + 구매 즉시 push + 공유 simulator
  - linkshop-pivot.md Phase 1-B / 1-C / 1-D 신설

### linkshop-pivot.md 정책 (요약)
| 항목 | 권장 default |
|---|---|
| 공구 호스팅 정의 (Phase 3) | A vs B (위) |
| 어필리에이트 비율 | 현행 0.5% 양방향 유지 (큐레이터 단독 비율 별도?) |
| 공구 호스트 인센티브 | 마감 성공 시 거래액 1% 추가 |
| 큐레이터 → 셀러 승급 threshold | 누적 정산 50만원 (사업자등록 안내) |
| 자기 ref 자기 구매 | 정산 제외 + 적립 회수 |
| 기존 셀러 retention | 라이브권 + 큐레이터 흡수 + 기존 commission 유지 |
| 카탈로그 노출 정책 | 메인=어드민 큐레이션 / 검색=인기순 |
| 상품 등록 권한 | 100% 어드민 |

### shipping-redesign.md 정책 (요약, A 채택 시 §6 자동 삭제)
| 항목 | 권장 default |
|---|---|
| 제주 추가비 | +3,000원 |
| 도서산간 추가비 | +5,000원 |
| 공구 모집 미달 배송비 부담 (B 가설) | 플랫폼 |
| 공구 결제 시점 (B 가설) | 참여 시 즉시 결제 (현행) |
| 공구 일괄 발송 SLA (B 가설) | 마감 후 3영업일 |
| 택배사 추적 API | Phase 2 외부링크만 / Phase 6 스마트택배 |
| 합배송 도입 시점 | Phase 2-E (옵션) vs Phase 6 |

## 옛 보류 항목 (신모델로 흡수)
| 항목 | 처리 |
|---|---|
| Quick Action FAB — 비셀러 클릭 처리 | 신모델에서 모든 유저가 호스팅 가능 → 자연 해소. 옛 (a)(b)(c)(d) 분기 무의미 |
| Quick Action FAB — 노출/숨김 페이지 | Phase 6 에서 재정의 |
| 카카오 FAB 복원 시점 | Phase 6 |

## ✅ 2026-05-24 세션 — 교환권 flow 영구 fix + KT Alpha 진단

### Universal 자동 허위리뷰 시드 (공구/쇼핑/교환권 — commit 0cbd50a7)
- `src/worker/utils/auto-seed-fake-reviews.ts` SSOT util
- `src/worker/cron/auto-seed-reviews.ts` daily 18 UTC (max 200건)
- `POST /api/admin/reviews/auto-seed-missing` 즉시 백필
- 정책 B: `is_active=1` 만. idempotent.

### Q1+Q3+Q4 (commit 8a56bc90)
- Q3 P0: /my-vouchers 빈 화면 — repair-schema 5컬럼 등록 + 3단 fallback SELECT
- Q1: `/admin/voucher-transactions` + AdminPage 카드 + `GET /api/admin/vouchers/transactions`
- Q4 perf 50-150ms: Promise.all rates + RETURNING id + 통합 batch + 병렬 code gen

### KT Alpha 진단 (commit fdd79d8d, 3588f7b2)
- `GET /api/admin/kt-alpha/diagnose-order/:id`
- 진단 UI on `/admin/voucher-transactions` (모달 + 상단 input + 각 행 버튼)

### 카카오 phone 자동 저장 + 결제 phone 게이트 (commit 71d31067)
- KakaoUser.phoneNumber 매핑, normalizeKakaoPhone helper
- upsertUser INSERT/UPDATE 에 phone (UPDATE 는 COALESCE 보존)
- /join 딜 흐름: kt_alpha 상품 + phone 없으면 PHONE_REQUIRED → 클라 모달 + 동의 + auto-retry

### /admin/users (commit 3cf61d32)
- 페이지네이션 버그 fix + 정렬 (created_at/order_count/total_spent/review_count/name)
- 검색: 이름/이메일/전화번호 (하이픈 무관)
- 통계 컬럼 표시 + phone 미등록 빨간 표시

### 마지막 round (이번 commit)
- `kt_alpha_admin_seller_id` 어드민 UI input 추가 (필수 표시 + 설명)
- VoucherDetailPage phone 모달 — 개인정보보호법 동의 체크박스 + 보유기간
- MyVouchersPage — phone 미등록 안내 배너 (7일 dismiss)
- guide-seed-admin.ts — voucher-transactions / admin-users 가이드 2 섹션 추가

## ✅ 2026-05-22 세션 — 정책 중앙화 + 성능 + 부채 정리

### 정책 SSOT 1페이지화 (`src/shared/constants/policy.ts`)
- REFUND_POLICY (9) / COMMISSION_DEFAULTS (10) / TAX_POLICY (3) / TIME_CONSTANTS (7)
- WITHHOLDING_RATES 재내보내기 — 한 파일에서 모든 정책 접근
- 8.8% / 0.05 / 0.10 / 0.07 / 0.005 / Math.min(20, …) hardcode 모두 import 전환
  - `affiliate.routes.ts`, `admin-tools.routes.ts`, `ledger.ts`, `agency.routes.ts`,
    `group-buy.routes.ts`, `stays-public.routes.ts`, `payouts-generate.ts`
- 새 상수: `AFFILIATE_COMMISSION_PCT`, `REFERRAL_BONUS_BOTHSIDES_PCT`, `STAYS_COMMISSION_CAP_PCT`

### 정합성 (atomic refund)
- `disputes.routes.ts` auto-refund + admin approve → CAS + D1 `batch()` 패턴
  → voucher refunded 인데 user balance 미환불되는 ghost refund 방지

### Audit log 미들웨어
- `admin-payouts.routes.ts` 5 endpoint (generate / approve / sent / cancel / commission-rates)

### Observability
- `alerts.ts sendAlert` 옵션 `dedupSeconds` (default 300s) — RATE_LIMIT_KV
- `discord-alert.ts sendDiscordAlertDedup` — 같은 (title, severity) 5분 내 중복 차단
- swallow() 래퍼 적용 (financial path): group-buy 추천 보너스, marketing 인플 정산,
  review-bonus, disputes escalate, influencer-payout cron

### 홈 공구 로딩 perf (live.ur-team.com)
- `group-buy-public.routes.ts`: `SELECT p.*` → 명시적 16 컬럼 (~56% payload ↓)
- `migrations/0276`: partial composite index
  `idx_products_groupbuy_feed (category, group_buy_status, created_at DESC) WHERE is_active=1`
- `GroupBuyFeed.tsx`: useEffect+state → useQuery (탭 복귀 시 ~200ms ↓)
- `EmptyStateWithFallback`: 같은 queryKey 로 메인 캐시 hit (중복 fetch 제거)
- `GroupBuyFeedCard.tsx`: `cfImage` + `cfSrcSet` (200/400/600px WebP/AVIF) — 이미지 50-80% ↓

### A11y
- aria-label 추가: navigate(-1) back, X close (모달/필터/사이드), ShoppingCart 아이콘
- 14개 파일

### 8.8% 마이그레이션 (Phase 2 — 사용자 미루기 → 재개)
- `WITHHOLDING_RATES.other_income` 호출 마이그 (`points.routes.ts withdraw`,
  `seller-settlements.routes.ts voucher-redeem`)



## 🎯 2026-05-21 세션 — 5 Phase 정산 인프라 + UX 통합

### Phase A: Commission 출금 + 기초 인프라
- commission_withdrawals + 사용자/어드민 UI + 알림톡 + 회귀 테스트 9개
- YouTube 썸네일 자동 cron / 셀러 분석 강화 / KT Alpha progressive
- 교환권 결제 흐름 정상화 (토스 우회)

### Phase B: 자체 예약 캘린더 (뷰티/액티비티/건강/펫)
- product_booking_slots + appointment_bookings (atomic + UNIQUE INDEX)
- 9 endpoints + 3 UI (셀러 슬롯 / 셀러 예약 / 유저 내 예약)
- D-1 reminder cron + 결제 직후 prompt + 취소 자동 환불
- 회귀 테스트 10개

### Phase C: 통합 정산 인프라 (ledger 중심)
- ledger_entries 헬퍼 3개 + payouts 테이블 + 4 INDEX
- 6 admin endpoints + /admin/payouts 페이지 (2 탭)
- 주 1회 cron (월요일 00 UTC) — pending payouts 자동 생성
- voucher used → atomic ledger 3 entries (merchant + seller + platform)

### Phase D: AI 통합 (3개 AI 권장 모두 반영)
- 셀러 트래킹 링크 위젯 + SellerProductsPage / SellerMiniShopPage 노출
- 에이전시 commission 자동 분배 + 어드민 commission 비율 조정 UI
- 사장님 매직링크 발송 트리거 (AdminBusinessVerificationPage 버튼)
- 세금계산서 stub + 연말 정산 CSV 리포트
- 모든 voucher 카테고리 결제 정상화 (meal_voucher hardcode 제거)
- AdminPayoutsPage 4 탭 (ledger / payouts / 수수료율 / 연말 리포트)

### Phase D-2: Attribution + 가이드 + Smoke test (이번 commit)
- 셀러 트래킹 attribution (src/lib/seller-tracking.ts) — sessionStorage 24h
- BrowsePage / GroupBuyDetailPage / ProductDetailPage capture + ref 전달
- GET /api/ledger/my — 셀러/에이전시 본인 ledger 조회
- docs/ALIMTALK_TEMPLATES.md — Aligo 9 템플릿 등록 가이드
- scripts/smoke-test.sh — 15 endpoint 검증 (확장)

## ⚠️ 운영자 액션 (production 적용 — 코드 X)
1. **`/api/_internal/repair-schema` GET 호출** — 모든 신규 컬럼/테이블/INDEX 적용
2. **Aligo 템플릿 9개 등록** — `docs/ALIMTALK_TEMPLATES.md` 참조
3. **`/admin/payouts` 수수료율 첫 저장** — default 5/10/30 명시 저장
4. **smoke test 실행** — `ADMIN_TOKEN=xxx ./scripts/smoke-test.sh prod`
5. **KT Alpha 카테고리 자동 분류** — `/admin/kt-alpha` ⚡ 메가 버튼
6. **end-to-end 테스트** — voucher 결제 → 매장 QR 스캔 → ledger entry 3개 자동 생성 확인

## 🎯 영구 인프라 (1만~10만 매장 대응)
- ledger_entries 단일 source of truth (정산 / 환불 / 분쟁 모두 entries 로 추적)
- payouts 테이블 송금 audit trail (transaction_id 추적)
- 모든 검색/필터 INDEX 명시 (풀스캔 0)
- atomic CAS — voucher used + appointment booking race condition 0
- 멱등 ledger — voucher_id + event_type 중복 entry 0
- 매장당 1 에이전시 lock-in (admin reassign + 감사 로그)
- commission 비율 어드민 UI 조정 (즉시 적용)

## 🚨 2026-05-21 사고 + 영구 fix
### Incident 1: CSP style-src nonce → 화면 깨짐
- `src/worker/index.ts` 에 `style-src 'nonce-XXX'` 추가 → CSP3 가 unsafe-inline 무력화 → Tailwind/React inline style 전부 차단.
- **영구 fix**: nonce 제거 + `scripts/check-csp-style-nonce.sh` pre-commit hook + CLAUDE.md 금지 룰 명시 + docs/INCIDENTS.md 기록.

### Incident 2: /api/<feature>/admin/* admin_token 미부착 → 403
- `src/lib/api.ts` 가 `/api/admin/*` 만 admin_token 분기. `/api/referral-tree/admin/withdrawals` 호출 시 헤더 누락.
- **영구 fix**: `/^\/api\/[a-z0-9-]+\/admin(\/|$)/` 패턴 추가 + `src/tests/unit/api-admin-token-attach.test.ts` 6 케이스 회귀 테스트.

## 🆕 2026-05-21 세션 — Commission 출금 + UX 단순화 + 알림톡

### Commission 출금 시스템 신규 (커밋 `66bfe245`, `aa44c269`)
- 새 테이블 `commission_withdrawals` (계좌 정보 + status pending/approved/rejected)
- `referral_commissions` ALTER: `withdrawn_at` / `withdrawal_request_id` / `paid_out_at` 컬럼 추가 (production schema fix)
- 새 status: `withdrawal_requested` / `paid_out` (기존 pending/granted/withdrawn 외 확장)
- 신규 endpoints (`src/features/referral/api/referral-tree.routes.ts`):
  - `POST /api/referral-tree/withdrawals` 사용자 출금 신청 (10,000원 이상)
  - `GET  /api/referral-tree/withdrawals` 내 이력
  - `GET  /api/referral-tree/admin/withdrawals?status=pending|approved|rejected|all`
  - `PATCH /api/referral-tree/admin/withdrawals/:id/approve` (admin_memo 선택)
  - `PATCH /api/referral-tree/admin/withdrawals/:id/reject` (rejection_reason 필수)
- 신규 페이지:
  - `/my-commissions` — 사용자/셀러/에이전시 공통 commission 조회 + 출금 신청
  - `/admin/commission-withdrawals` — 어드민 송금완료/거절 처리
- 승인/거절 시 자동 알림톡 (수령자 type 별 phone 조회 + 계좌번호 마스킹)
  - template code: `commission_withdrawal_approved` / `commission_withdrawal_rejected`

### 셀러 정산 완료 알림톡 신규 (방금 추가)
- `POST /api/admin/settlement/execute` 대량 정산 직후 sellers.phone 으로 알림톡 발송
- template code: `seller_settlement_completed`
- 기존 dashboard notification 과 별개로 추가 — silent skip 보존

### YouTube 라이브 썸네일 자동 갱신 (5분 cron)
- 새 cron `src/worker/cron/youtube-thumbnail-refresh.ts`
- live 상태 + custom_thumbnail_url 없는 stream 의 cache-bust URL 매 cron 갱신
- 셀러 수동 호출 불필요

### 셀러 분석 페이지 2개 탭 추가 (`SellerAnalyticsPage`)
- 추천 Commission 탭 (granted/pending/paid_out + 상위 추천 고객 + 출금 신청 링크)
- 월별 입점 추이 탭 (최근 12개월 신규 상품 + 공구권 카운트)
- 신규 endpoints: `monthly-trend`, `referral-commissions/summary`

### 교환권 페이지 (vouchers) 성능 + UX
- KV 캐시 5분 + stale-while-revalidate 2분 (chip 로딩 지연 해결)
- N+1 → 단일 GROUP BY 쿼리
- 브랜드 아이콘 하단 "N종" 수 표시 제거 (사용자 요청)
- v3 다크 그라데이션 잔액 카드 + 6개 정렬 옵션

### 홈/브라우즈
- 공구 카드: gift_catalog 브랜드 fallback (참외 스타일)
- /browse 카테고리 가로 스크롤 이모지 아이콘 (사용자 선택)
- /browse 최근 본 상품에서 교환권 제외
- /cart 뒤로가기 무한 루프 영구 fix

### 리뷰 시스템
- 구매자 전용 리뷰 작성 (NOT_PURCHASED 403 toast)
- 리뷰 사진 첨부 (최대 5장, 5MB)

### 공구 개최 페이지 UX 단순화 (`SellerMealVoucherNewPage`)
- 기본값 자동: 마감 7일 후 / 만료 90일 후
- "고급 설정" 토글로 약관 + 단계별 할인 접기

### 회귀 테스트 (`tests/integration/commission-withdrawal-flow.test.ts`)
- 9개 신규 테스트 (인증/검증/권한/거절 사유)
- 전체 1782 tests 통과 (기존 1773 + 신규 9)

### Sitemap.xml 보강
- /vouchers + 6개 카테고리 명시
- /restaurant-map 추가

### 운영 가이드 4개 섹션 신규 (`guide-seed.ts`)
- admin: commission-withdrawals-admin
- seller: consignment-seller / introduction-commission
- agency: store-introduction

### ⚠️ 운영자 액션 필요 (production 적용 전)
1. **schema repair 호출** (필수)
   ```bash
   curl -X POST https://live.ur-team.com/api/_internal/repair-schema \
     -H "Authorization: Bearer <ADMIN_TOKEN>"
   ```
   (commission_withdrawals 테이블 + ALTER 컬럼 적용)
2. **Aligo 템플릿 등록**
   - `commission_withdrawal_approved` / `commission_withdrawal_rejected` / `seller_settlement_completed`
   - 등록 전까지 silent skip (운영 영향 0)
3. **CF Pages 배포 녹색 확인** → `live.ur-team.com/my-commissions` 401 응답 확인

## 🆕 2026-05-20 세션 — 셀러/사용자 사이드 종합 정리

### 셀러 사이드 (사용자 보고 이슈 영구 fix)
- `/api/seller/bundles 401` — `bundle.routes.ts:44` 가 `payload.id` 봤지만 토큰은 `seller_id`. 호환 fallback 추가.
- `/api/seller/analytics/reviews 500` — `FROM reviews` (실제 `product_reviews`) + `r.image_urls` (실제 `images`). 테이블/컬럼 영구 fix.
- `/seller/alimtalk` Toss 400 — V1 widget API → V2 `payment().requestPayment` (PointsChargePage 와 동일 패턴).
- 사이드바 "설정" → 메인페이지로 튕김 — `SellerProfileEditPage` 의 `?tab=` 없으면 `/profile/{slug}` redirect 제거.
- 사이드바 하단 버튼 스크롤 점프 — `ScrollToTop` 에 `state.preserveScroll: true` 옵트아웃 추가.
- 사업자등록증 업로드 UI (셀러 `/seller/business-info`) + 어드민 검증/반려 (`/admin/sellers` 상세 펼침).
- 셀러 공개페이지 owner 모드 sticky 안내 배너 + 항상 보이는 Pencil 아이콘.
- 큰 CTA 카드 그리드 (`PrimaryActions`) — 라이브/주문/상품등록/정산 4개 prominent.

### 사용자 사이드
- 본문 바로가기 a11y 링크 제거 (사용자 요청).
- Cart 판매종료 일괄 삭제 버튼 (`product_is_active === 0` 만 batch delete).
- 추천 수익 카드 코멘트 정정 (이미 항상 노출 중 — 적립 0 도 "시작하기" CTA).

### 어드민
- KT Alpha 카테고리 자동 분류 endpoint (`/admin/kt-alpha/categories/auto-classify`).
- 리뷰 대량 생성 / 정리 endpoints.
- 사업자등록증 검증 + 정산 계좌 정보 어드민 패널.

### 영구 패턴 정착
- 74개 누적 TS 에러 → 0개.
  - Hono `c.req.json<T>().catch(() => ({}))` → `T | {}` union 회피: `({} as T)` 명시 + 헬퍼 `src/shared/utils/parse-json-body.ts`.
  - `c.get('user'/'seller')` ContextVariableMap: `Hono<{ Bindings; Variables }>` 명시.
  - `caches.default`, `crypto.subtle.importKey(Uint8Array)`, `LIVE_STREAM` cast 등 영구 fix.
- 업로드 500 진단성 강화 — `INVALID_CONTENT_TYPE` / `MULTIPART_PARSE_FAILED` / `NO_FILE_FIELD` 에러 코드.
- ToastStore 시그니처 — `success(msg, { duration })` 지원.

### 검색 정확도
- 신규 migration `0275_fts5_trigram_korean.sql` — 한국어 trigram tokenizer.
- `ProductRepository.searchByText` 의 `JOIN fts.product_id` 버그 → `JOIN fts.rowid` 로 영구 fix (LIKE fallback 으로만 떨어지던 문제).
- `ProductService.getProducts` 가 search 있으면 FTS5 + bm25 ranking 자동 사용.

### Schema repair
- `/api/_internal/repair-schema` 에 0271 (`products.referral_enabled/rate`), 0272 (`sellers.can_broadcast`), 0273 (`search_logs`), 0274 (`user_withdrawals`) 추가. 한 번 호출로 production D1 동기화.

## ⏭️ 다음 작업 후보 (우선순위)
| 우선 | 항목 | 메모 |
|---|---|---|
| 🔴 | production smoke test | `/api/referral-tree/admin/withdrawals` + `/api/vouchers/categories` curl |
| 🟡 | KT alpha 자동 분류 production 1회 실행 | `/admin/kt-alpha` 메가버튼 |
| 🟡 | `/vouchers` 카테고리/브랜드 재검증 | 자동분류 실행 후 확인 |
| 🟡 | 라이브 시작 시 셀러 본인에게 알림톡 | 단골에게는 web push 가나 셀러 본인 미발송 |
| 🟢 | 공구 개최 페이지 추가 단순화 | 디자인 시안 필요 (현재 고급 설정 토글만 추가됨) |
| 🟢 | PC 반응형 검증 (남은 페이지) | 4 viewport |
| 🟢 | CSP unsafe-inline 줄이기 | 우리 코드만 (외부 iframe 제외) |
| 🟢 | YouTube 썸네일 콘솔 404 노이즈 | onError 처리는 됨, 로그는 못 막음 |
| 🟢 | PPT 슬라이드 디자인 | 지난 세션 outline → Claude Design 의뢰 |

### ✅ 완료된 항목 (2026-05-21)
- ~~공급자 (가게 사장님) 자체 onboarding UI~~ → `SellerRegisterSupplierPage.tsx` 이미 존재 (2026-05-20 신규)
- ~~새 기능 통합 테스트 (commission withdrawal)~~ → 9개 테스트 신규



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
