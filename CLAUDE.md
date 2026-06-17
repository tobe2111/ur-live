# CLAUDE.md — 유어딜 프로젝트 개발 규칙

## 🔒 Toss V2 docs audit 잠금 (2026-05-24 — 사용자 명령)

**배경**: 2026-05-24 사용자가 토스페이먼츠 V2 공식 docs 9개를 직접 공유하여 SDK / 결제승인 응답 / 에러코드 (~100) / 결제위젯 어드민 / Webhook / 결제취소 / 간편결제 응답 / 세금처리 / 결제결과안내 / 지급대행 / Status Page / WebView 전 영역 audit + 정합 작업 완료.

**🚫 절대 룰**: 아래 파일/심볼은 **사용자 명시 허가 없이 직접 수정 금지**. 변경 필요할 때는 반드시 사용자에게 먼저 질문할 것 (`AskUserQuestion`).

| 파일 | 잠긴 이유 |
|---|---|
| `src/worker/utils/toss-gateway.ts` | confirmTossPayment / cancelTossPayment / detectTossKeyType / decideTossFlow / generateTossOrderId — V2 docs SSOT |
| `src/worker/utils/toss-error-messages.ts` | ~100개 에러코드 SSOT (docs `/reference/error-codes`) |
| `src/worker/utils/toss-refund.ts` | gateway wrapper. 직접 수정 X, 변경은 gateway 에서 |
| `src/worker/utils/toss-payments.ts` | gateway wrapper |
| `src/worker/utils/refund.ts` | gateway wrapper |
| `src/worker/routes/payment.routes.ts` | /confirm / amount 검증 / client-key endpoint — docs 준수 |
| `src/worker/routes/webhook.routes.ts` | V2 이벤트 (PAYMENT_STATUS_CHANGED 등) + graceful 시그니처 |
| `src/components/payments/TossPaymentWidget.tsx` | V2 SDK widgets() / customerEmail / customerName / orderName 100자 |
| `src/pages/TossWidgetPayPage.tsx` | 딜 충전용 widgets() flow |
| `src/pages/PaymentSuccessPage.tsx` | TossPaymentObject 필드 표시 (receipt.url / cashReceipt / easyPay / card) |
| `src/shared/types/index.ts` | TossEventType / TossWebhookPayload — V2 docs 사양 |

**예외 (수정 OK — 사용자 허가 불필요)**:
- 새로 추가되는 결제 시나리오에서 SSOT helper (`confirmTossPayment` / `cancelTossPayment`) 를 **호출**하는 코드 — 단, helper 자체는 변경 X
- 운영 가이드 / 주석 / 비-결제 UI 문자열만의 변경

**수정 절차 (예외 발생 시)**:
1. `AskUserQuestion` 으로 의도/근거 설명 + 확인 받기
2. 변경 사유 + docs URL 인용 + commit 메시지 명시
3. 본 CLAUDE.md 의 audit log 에 변경 commit 추가

### 변경 audit log
- 2026-06-12 `[UNLOCK]` `payment.routes.ts` `/confirm` 확정 side-effect 3종 배선 (사용자 승인 "나머지 다 이상적으로 진행" — 전 플로우 감사) — reduceStock 직후 waitUntil 블록 추가: ① `creditAffiliateFromIntent`(주문 생성 시 저장된 추천 의도 소비 — 기존 내부 fetch dead-call 의 근본수정, 검증/멱등은 /track 과 동일 SSOT `affiliate-credit.ts`) ② `grantInviteRewardForFirstPurchase`(초대 1,000딜 — 호출자 0 이던 약속 미이행 마감, UNIQUE claim 멱등) ③ 셀러 '결제 확정' 벨 알림. 전부 fail-soft + 응답 후 실행. **Toss confirm/금액검증/CAS/달력 무변경.**
- 2026-06-11 `[UNLOCK]` `payment.routes.ts` `/confirm` referral 알림 waitUntil 분리 (사용자 승인 "진행하자" — 참여하기 felt-latency 전수조사 후속). 숙소 referral 적립 직후의 알림 묶음(notifications INSERT + phone/누적 SELECT + 알리고 알림톡 외부 HTTP)이 결제 confirm 응답을 동기로 막던 것을 내용/순서/에러처리 그대로 응답 후(waitUntil, ctx 없으면 동기 fallback)로 이동. **적립(affiliate_earnings INSERT)·Toss confirm/금액검증/CAS/달력 전부 무변경** — 알림 실행 시점만. unit 2028 green.
- 2026-06-11 `[UNLOCK]` `payment.routes.ts` `/confirm` 숙소 야간 캘린더 batch 화 (사용자 승인, 감사 백로그 마감) — 야간당 2왕복(INSERT OR IGNORE+UPDATE) 루프를 일괄 2 batch 로, `releaseStays()` 도 단일 batch. **가드 의미 동일**: UPDATE 의 `available_count > 0` + 결과별 `meta.changes` 로 야간별 성공 판정, 실패 야간 발견 시 성공분 전체 롤백(기존 '첫 실패 break 후 롤백'과 최종 상태 동일). reserve-before-charge 순서/CAS/Toss 금액검증/confirmTossPayment 전부 불변. 같은 commit 에서 `helpers.ts` `clawbackVoucherCommission` 도 행당 write 루프 → DB.batch (사전 조회값 기반, read-after-write 없음 — 원자성만 강화).
- 2026-06-11 `[UNLOCK]` `payment.routes.ts` + `webhook.routes.ts` 결제 확정 side-effect 누락 2건 (사용자 승인, 머니 감사). **Med-A** `payment.routes.ts /confirm`: `ALREADY_PROCESSED_PAYMENT` 분기의 early-return 제거 — 기존엔 updateStatus('DONE')만 하고 즉시 반환해 reduceStock·커미션·KT발송 영구 생략(Toss 승인 직후~CAS 직전 worker 크래시→재시도 케이스). 제거로 아래 confirmClaim CAS 에 위임(이미 DONE=멱등반환 / PENDING=claim 후 side-effect 복구). **Med-C** `webhook.routes.ts`: 결제 확정 경로가 둘인데 커미션 적립이 /confirm 에만 있어 webhook 만 도착 시 누락 → 공통 멱등 헬퍼 `creditOrderCommissions`(order-commissions.ts, 에이전시/영입자/공급자 3종 order_id 멱등) 를 webhook 확정 직후 호출. **Toss confirm/금액검증/client-key/confirmTossPayment helper 전부 무수정** — side-effect 배선만.
- 2026-06-04 `[UNLOCK]` `payment.routes.ts` `/confirm` 숙소 오버부킹 **reserve-before-charge** 근본수정 (사용자 승인, deep audit) — 기존: Toss 승인 *후* 달력 차감 → 오버부킹이면 자동환불. **자동환불 실패 시 '청구만 되고 방 반환' 잔여 리스크**. 수정: 달력 예약(차감)을 **Toss 승인 전**으로 이동 → 방 못 잡으면 청구 자체 안 함(STAY_OVERBOOKED 409, 미회수 0). 동시 confirm 이중차감은 `stay_bookings` status CAS(pending→confirmed)로 차단(이 thread 만 예약). Toss 실패 시 `releaseStays()`(달력+booking 되돌림). 기존 post-Toss 차감/오버부킹/confirm 블록은 affiliate 적립만 남김(멱등, status!=='confirmed' skip). **Toss 금액검증/confirmTossPayment helper/client-key 미변경** — 달력 side-effect 순서만 이동. ⚠️ 실결제 staging 미검증 — 운영 반영 전 숙소 결제 E2E 1회 권장.
- 2026-05-24 초기 잠금 — commit `02be3610`, `c47e7326`, 후속
- 2026-06-01 `[UNLOCK]` `payment.routes.ts` `/confirm` 영입자(크리에이터) 매장영입 commission 배선 (사용자 승인) — 에이전시 intro commission 블록 직후 `creditInfluencerStoreIntroCommission(DB, order)` 호출 추가(fail-soft, 멱등). 매장 `introduced_by_influencer_id` 있으면 매출의 `platform_settings.influencer_store_intro_pct`(default 1.5%)를 영입자 `influencer_attributions`(source='store_intro')에 적립 → 기존 influencer-payout cron 이 T+7 성숙 + 사업자 3.3%/비사업자 8.8% 원천징수 후 송금. **Toss confirm/amount 검증 미변경** — side-effect 적립만. 환불 역전은 `returns.routes.ts`(비잠금)에 `reverseInfluencerStoreIntroOnRefund` 추가.
- 2026-05-31 `[UNLOCK]` `payment.routes.ts` `/confirm` 공급(B2B) 정산 배선 (도매몰 INC-5b, 사용자 승인) — 에이전시 커미션 적립 블록 직후 `creditSupplierOnOrder(DB, order.id)` 호출 추가(fail-soft, order_id 멱등). 공급상품(supply_source_id) 라인의 공급가를 공급자에게 즉시 적립(D2). **Toss confirm/amount 검증 미변경** — side-effect 적립만. 환불 역전은 `returns.routes.ts`(비잠금) 에 `reverseSupplierOnRefund` 추가.
- 2026-05-31 `[UNLOCK]` `payment.routes.ts` `/confirm` 동시요청 CAS 가드 (사용자 승인, 보안 audit) — Toss confirm 후 `UPDATE orders SET status='DONE' WHERE order_number=? AND status NOT IN (DONE/PAID/CANCELLED/REFUNDED/FAILED)` 로 PENDING→DONE 원자 claim. `meta.changes==0`(다른 동시요청이 이미 처리)이면 reduceStock/agency·referral commission side-effect 재실행 없이 멱등 반환. **Toss confirm/amount 검증/client-key 로직 미변경** — 내부 정합(재고 2배차감·커미션 중복)만 차단. confirmTossPayment 는 호출만(수정 X).
- 2026-05-30 `[UNLOCK]` 숙소 오버부킹 원자적 가드 (사용자 허가) — `payment.routes.ts` `/confirm` 의 stay-calendar 차감 블록만 변경: `MAX(0, count-1)` clamp → `WHERE available_count > 0` 가드 + `meta.changes` 검사 + 부족 시 성공분 롤백 + `cancelTossPayment()` 자동 환불. **Toss confirm/amount 검증/client-key 로직은 미변경**, locked SSOT helper 는 호출만(수정 X). 동일 가드 `stays-public.routes.ts` `/stays/bookings/confirm` 에도 적용.

---

## 🔒 로딩 최적화 잠금 (2026-05-27 — 사용자 명령)

**배경**: 2026-05-27 사용자가 메인/공구/쇼핑/교환권/링크샵 페이지 로딩 속도 + KV 비용 + 상품 수 확장성 동시에 이상적으로 최적화 완료. 이 영역의 회귀는 즉시 사용자 체감 + Cloudflare 비용 발생.

**🚫 절대 룰**: 아래 파일/심볼은 **사용자 명시 허가 없이 변경/제거 금지**. 추가는 OK (예: 이미지 host 화이트리스트 확장), 제거/약화는 금지.

| 파일 | 잠긴 항목 | 회귀 시 발생 |
|---|---|---|
| `src/worker/middleware/edge-cache.ts` | `publicCache` 의 `useKv: false` 기본 | KV write 한도 초과 → 월 $2-5 비용 |
| `src/worker/middleware/edge-cache.ts` | `CDN-Cache-Control` 분리 헤더 | 브라우저/edge TTL trade-off 깨짐 |
| `src/worker/index.ts` | HTMLRewriter SSR inject 블록 (4페이지) + `caches.default.match` 직접 read | SSR 0 RTT 회귀 → 메인 페이지 200-500ms ↑ |
| `src/worker/cron/cache-prewarm.ts` | `HOT_PATHS` 의 SSR key 정확 매칭 | SSR cache miss → 첫 사용자 skeleton |
| `src/utils/cf-image.ts` | `SUPPORTED_HOSTS` / `EXTERNAL_PROXY_HOSTS` | 추가 OK, **제거 금지** (LCP 회귀, 트래픽 ↑) |
| `src/utils/cf-image.ts` | Save-Data 감지 quality 자동 조절 | 모바일 데이터 절약 사용자 트래픽 ↑ |
| `src/worker/index.ts` `/api/image/resize` | `ALLOWED_HOSTS` | 같음 |
| `src/components/RestaurantMiniMap.tsx` | IntersectionObserver lazy load (`shouldLoadSdk`) | 모든 공구 상세 페이지 SDK 즉시 로드 회귀 |
| `src/components/auth/RouteGuards.tsx` | `isAdminLoggedIn` / `isUserLoggedIn` / `isSellerLoggedIn` 토큰 존재 검사 | admin↔user 이중 로그인 자동 로그아웃 회귀 (`user_type` 추가 검사 X) |
| `src/components/main/BottomNav.tsx` | `linkshopPath` localStorage cache 우선 (seller_username → linked_seller_username → user_handle) | 매번 API 호출, `/host/new` fall through |
| `src/components/main/BottomNav.tsx` | `isActivePath` 가 `/profile/`, `/s/` 도 링크샵 활성 | 링크샵 탭 비활성 표시 |
| `src/pages/main-home/GroupBuyFeedCard.tsx` | hover/touch/focus prefetch + IntersectionObserver viewport prefetch | 카드 클릭 시 fetch waterfall |
| `src/pages/main-home/GroupBuyFeedCard.tsx` | image fade-in (`opacity` transition) + aboveFold eager | UX 깜빡임 |
| `src/pages/GroupBuyDetailPage.tsx` | `__SSR_INITIAL_DETAIL__` 즉시 사용 | 상세 페이지 fetch waterfall |
| `src/pages/SellerPublicPage.tsx` | `__SSR_INITIAL_SELLER__` 즉시 사용 | 셀러 페이지 fetch waterfall |
| `src/pages/VouchersPage.tsx` | `__SSR_INITIAL_VOUCHERS__` 즉시 사용 + default sort `price_low` | first paint 회귀 |
| `src/pages/BrowsePage.tsx` | `__SSR_INITIAL_BROWSE__` 즉시 사용 | first paint 회귀 |
| `src/features/auth/services/KakaoAuthService.ts` | `upsertUser` 의 same-email seller auto-link | `/host/new` fall through 사고 회귀 |
| `src/features/auth/api/kakao.routes.ts` | `linkUserExtraRoles` 응답에 `seller.username` 포함 | localStorage `seller_username` 누락 |
| `src/pages/KakaoCallbackPage.tsx` | `seller_username` localStorage 저장 + admin/agency 토큰 있을 때 user_type 보존 | 이중 로그인 race |
| `src/worker/routes/repair-schema.routes.ts` | `backfill: sellers.linked_user_id (same-email)` UPDATE | 시드 데이터 정정 못 함 |
| `index.html` | preload `crossOrigin` 속성 없음 (same-origin) | preload mismatch → 200-500ms 손해 |
| `index.html` | Speculation Rules prerender 대상 (`/group-buy/*`, `/products/*`, `/live/*`) | 카드 클릭 후 prerender 효과 X |
| `index.html` | preconnect (`firebasestorage.googleapis.com` 등) | DNS+TLS 100-200ms 손해 |
| `src/App.tsx` | `MainHomePage` eager `import` (lazy X) | chunk fetch waterfall 50-100ms |
| `src/App.tsx` | idle prefetch (BrowsePage / VouchersPage / UserProfilePage / MyVouchersPage / SellerPublicPage) | 탭 클릭 시 chunk fetch 대기 |
| Migration `0276_products_groupbuy_perf_index` | `idx_products_groupbuy_feed` partial composite index | 풀스캔 회귀 → 상품 늘면 선형 느려짐 |
| Migration `0080` FTS5 | `products_fts` virtual table | 검색 풀스캔 회귀 |

**예외 (수정 OK — 사용자 허가 불필요)**:
- 새 페이지 / 새 SSR slot 추가 (기존 4 페이지 inject 패턴 따라)
- `EXTERNAL_PROXY_HOSTS` / `ALLOWED_HOSTS` **추가** (제거 X)
- 새 BottomNav 탭 추가 (기존 5탭 active path 패턴 보존)
- 새 cron HOT_PATHS 추가 (제거 X)

**수정 절차 (예외 발생 시)**:
1. `AskUserQuestion` 으로 의도/근거 + 회귀 영향 설명
2. 변경 사유 + commit 메시지에 잠금 해제 명시 (`[UNLOCK_LOADING]`)
3. 본 CLAUDE.md 의 audit log 에 변경 commit 추가

### 변경 audit log
- 2026-06-17 `[UNLOCK_LOADING]` `group-buy-public.routes.ts` GET /products 에 `category=general`(일반 상품) 명시 지원 (사용자 요청 — 일반 상품 카테고리 추가). 기존엔 general 이 `VOUCHER_CATEGORIES` 에 없어 항상 voucher 로 폴백 → 클라 필터에서 0개로 사라지는 **구조적 빈 카테고리**였음. `categoryParam==='general'` 일 때만 `categories=['general']` 로 쿼리(이 분기 추가만). **기본 'all' 요청의 categories(voucher 4종)·캐시키(`group_buy_products:active:meal,beauty,stay,etc`)·materialized·SSR 0-RTT·Cache-Control/CDN-Cache-Control 분리 전부 불변** — general 전용 캐시키(`...:active:general`)는 신규(충돌 0). 롤백: ternary 1줄 환원.
- 2026-06-13 `[LOADING_ADDITIVE]` 대시보드 hard-load 홈 shell 깜빡임 제거 (사용자 신고 "대부분 페이지 로딩 중 / 홈이 잠깐 등장") — `worker/index.ts` HTMLRewriter 의 도매 surface `#root` 라이트 placeholder 로직을 `needsRootBlank = isWholesaleSurface || isDashboardSurface(/seller|admin|agency/)` 로 일반화. prerender 된 index.html `#root` 의 소비자 홈 shell(다크·라이브 nav)이 대시보드 첫 paint 에 잠깐 보이던 것 차단. **소비자 페이지 SSR inject·0-RTT shell·wholesale OG/canonical rewrite 전부 불변(additive)** — createRoot(비-hydrate)라 #root 비움 안전. 롤백: `needsRootBlank` → `isWholesaleSurface` 환원.
- 2026-06-11 `[LOADING_ADDITIVE]` 업로드 이미지 = R2 커스텀 도메인 파이프라인 (사용자가 media.ur-team.com 연결 + PUBLIC_R2_URL 등록 — 이상적 구조 전환) — `cf-image.ts` `/api/media/<key>` 분기를 워커 프록시(리사이즈 불가) → `/cdn-cgi/image/<옵션>/https://media.ur-team.com/<key>` 로. **prod 실측: cf-resized OK, 779KB→9.7KB(128px), 1y immutable** — 레거시 저장 URL 도 도메인 매핑만으로 전부 치유(재업로드 불필요). `media.ur-team.com` 을 EXTERNAL_PROXY_HOSTS(추가)+`CDN_CGI_VERIFIED`(실측 통과)에 등재. `/api/upload/` 분기·호스트 목록·Save-Data 불변. 아바타 소비처(UserProfilePage/BottomNav raw `<img>`) cfImage 래핑(additive). 신규 업로드는 PUBLIC_R2_URL 로 절대 URL 반환(upload.routes 기존 env 분기 — 코드 무수정). 롤백: cf-image 분기 1곳 복원. ⚠️ 버킷 공개화로 biz-cert 도 URL 노출 — 16자 랜덤키(~95bit)라 추측 불가, 장기적으로 별도 비공개 버킷 분리 권장(TECHNICAL_DEBT).
- 2026-06-11 `[LOADING_ADDITIVE]` 카드 이미지 외부호스트 변환 경로 수리 (사용자 신고 "현저히 느림" — prod 실측 기반) — `cf-image.ts` EXTERNAL_PROXY 분기 중 **실측 검증된 호스트(giftishow.com/kt.com)만** `/api/image/resize` 프록시 → **zone 리사이저 직접 래핑**(`/cdn-cgi/image/<옵션>/<외부절대URL>`)으로. 근거(GitHub Actions 실측): 프록시는 워커 내부 cdn-cgi subrequest 에 리사이저 미적용 → 항상 원본 폴백(143KB 그대로, 기프티쇼 origin 1~4.5s) / 브라우저→cdn-cgi 직접은 cf-resized OK(143KB→18KB, zone 캐시). ⚠️ **당일 회귀 교훈**: 첫 배포에서 전체 외부호스트에 적용했다가 카카오 프로필(kakaocdn) 깨짐 — cdn-cgi 직결은 리사이저의 원본 fetch 가 성공하는 호스트만 안전, 신규 호스트는 `prod-diag.yml` 로 cf-resized 실측 후 `CDN_CGI_VERIFIED` 에 추가. **SUPPORTED_HOSTS/EXTERNAL_PROXY_HOSTS 목록·Save-Data·`/api/media` 프록시 분기(06-06 사고로 cdn-cgi 불가) 전부 불변.**
- 2026-06-11 `[UNLOCK_LOADING]` `kakao.routes.ts` SSR Phase 2 D단계 (사용자 승인 "모두 진행") — 카카오 콜백의 linked seller/agency 토큰 전달 2지점(redirect transfer cookie/JSON 응답)에 httpOnly `ud_seller_token`/`ud_agency_token` Set-Cookie **추가 발급만**. 기존 transfer cookie→localStorage 이전 흐름·state CSRF·safeRedirect·linkUserExtraRoles 응답(seller.username 포함) 전부 불변(additive). 목적: beta.ur-team.com(SSR) 로그인 개인화. 설계: docs/SSR_PHASE2_AUTH.md. 롤백: cookie_block 2곳 제거.
- 2026-06-10 `[UNLOCK_LOADING]` 하단바 ➕(만들기) + 쇼핑 잠정 숨김 + 라이브 잔재 정리 (사용자 결정 — "라이브는 영구 중단, 쇼핑은 잠정 보류") — (1) `feature-flags.ts` `SHOPPING_TAB_HIDDEN=true` 신설: `BottomNav` 쇼핑 탭 → 가운데 ➕(시트: 유저=동네 공구 제안 `/community-group-buy/new`, 셀러=공구권 등록 — 기존 휴면 시트 재활용). `DesktopTopNav`/`DesktopLiveSidebar` 쇼핑·둘러보기·카테고리(식사권 외) 동일 플래그 게이트. **플래그 false 면 전부 즉시 복원(가역). /browse·/cart 라우트·prefetch 코드 보존, linkshop 경로캐시·active-path 로직 불변**. (2) `index.html` Speculation Rules 에서 `/live/*` prerender 제거(라이브 영구 중단 — `/group-buy/*`·`/products/*` 불변). DesktopTopNav LIVE 배지/라이브 탭 LIVE_COMMERCE_SUSPENDED 게이트. (3) 수요 신호 루프: community-group-buy `/create` → 어드민 벨 알림, `/confirm` → 참여자 전원 "공구 확정" 알림(fail-soft). (4) 링크샵 재정향: CuratorTabs 식사권 탭을 상품 앞으로 + 홈 탭 교환권/공구 핀 우선 정렬.
- 2026-06-06 `[LOADING_ADDITIVE]` 링크샵 배경/프로필 업로드 404 근본수정 (사용자 신고) — `cf-image.ts cfImage` 에 **additive 분기**: 워커가 R2 에서 서빙하는 same-origin 업로드 이미지(`/api/media/*`·`/api/upload/*`)를 `/cdn-cgi/image/` 대신 검증된 `/api/image/resize` 워커 프록시로 경유. 원인: 업로드는 R2 저장 성공(`/api/media/<key>` 상대 URL 저장, PUBLIC_R2_URL 미설정)인데 cfImage 가 `/cdn-cgi/image/.../api/media/...` 로 감싸 → CF URL 리사이저가 워커 서브요청 소스를 못 풀어 404. 프록시(cf.image fetch)는 리사이즈 비활성 시 원본 200 반환 → 절대 404 안 남. **SUPPORTED_HOSTS/EXTERNAL_PROXY_HOSTS/Save-Data 불변(제거 X)** — 분기 추가만. SSR/비브라우저는 raw R2 URL fallback. 커레이터 배너+프로필 동일 chokepoint 동시 해결.
- 2026-06-06 `[UNLOCK]` 카카오 become(도매/제조) same-email 자동연결 verified 게이트 (사용자 승인, 보안 audit M1) — `KakaoAuthService.upsertUser` 에 **additive**: 매 로그인 시 카카오 `is_email_verified` 를 `users.email_verified`(0/1) 에 저장(best-effort, 컬럼 없으면 repair-schema 후 채워짐). **기존 same-email 셀러 자동연결 로직·COUNT=1 가드 불변** — email_verified 쓰기만 추가. 목적: `become-distributor`(wholesale.routes) + `become`(supplier-auth.routes) 의 미연결 same-email 셀러/공급자 자동연결을 `email_verified===1` 일 때만 허용 → 미verified 카카오 email 로 사전등록(관리자 시드) 승인 계정 takeover 차단. upsert 가 become 보다 먼저 실행되므로 플래그는 호출 시점에 실제 verified 반영. `repair-schema` 에 `users.email_verified` 컬럼 추가.
- 2026-06-05 `[LOADING_ADDITIVE]` 도매몰 진입 시 소비자 홈 shell 깜빡임 제거 (사용자 신고) — `worker/index.ts` HTMLRewriter 에 **`/wholesale`·`/supplier` surface 한정** `#root` placeholder(라이트 `#F4F5F7`) 주입 추가. prerender 된 index.html `#root` 의 소비자 홈 shell(다크·라이브/동네딜 nav)이 hard-load 첫 paint 에 잠깐 보이던 것 차단. **소비자 페이지(`isWholesaleSurface=false`)는 기존 4페이지 SSR inject·`caches.default` read·nonce 처리 전부 불변(byte-identical)** — additive. createRoot(비-hydrate)라 #root 비움 안전.
- 2026-06-05 `[UNLOCK_LOADING]` 동네딜 필터 50개 cap 근본수정 (사용자 승인) — `group-buy-public.routes.ts` GET /products 에 `sort`/`page`/`limit` 서버사이드(additive). **기본 요청(파라미터 없음)은 캐시키·materialized·ORDER BY created_at DESC·LIMIT 50 불변 → SSR 0-RTT 보존**; 파라미터 붙은 요청만 새 캐시키 + 라이브쿼리(화이트리스트 ORDER BY + LIMIT/OFFSET, materialized 스킵). 클라 `GroupBuyListPage` 셀러탭 fetch `limit=200` 상향 → 50개 초과 공구가 필터/정렬에 안 잡히던 잠재버그 해소. Cache-Control 불변.
- 2026-06-05 `[UNLOCK]` 카카오 계정 중첩 근본수정 (사용자 승인 — 마이=정지원/링크샵=디스크프리) — (1) `KakaoCallbackPage.tsx`: 다른 user.id 로 로그인(계정 전환) 시 이전 계정 `seller_*`/`linked_seller_username`/`user_handle`/`agency_*`/`is_distributor` 잔존 키 제거(추가만, seller_username 저장·admin/agency user_type 보존 불변). (2) `KakaoAuthService.upsertUser` same-email 셀러 자동연결: email 이 정확히 1명에게만 속할 때(`COUNT=1`)만 연결 — cross-account 오연결 차단(verified 게이트는 기존 유지). (3) `repair-schema`: same-email 백필을 `LIMIT 1`(비결정적)→`COUNT=1` 1:1 + `ORDER BY u.id` 결정적, `idx_users_email_unique` 부분 UNIQUE 추가(best-effort, 중복 email 있으면 생성 실패→정리 후 재실행). (4) `handle-generator`: 한글/비라틴 닉네임 빈 슬러그→bare `'user'`(generic @user) 대신 `user{id}`, `'user'` 예약어 추가. 각 repair 스텝 개별 try-catch(556) — 인덱스 실패가 타 스텝 안 깨뜨림.
- 2026-06-04 `[UNLOCK_LOADING]` 홈 기본 카테고리 = '커피/음료' (사용자 요청 "기본으로 먼저 나오게") — (1) `worker/index.ts` MAIN SSR 슬롯 path 에 `&category=커피/음료`(URLSearchParams 인코딩 `%EC%BB%A4%ED%94%BC%2F%EC%9D%8C%EB%A3%8C`) 추가. (2) `cache-prewarm.ts` HOT_PATHS 에 동일 인코딩 key **추가**(기존 `deal_only=1&sort=price_low` key 존치 — `/vouchers` VOUCHERS 슬롯용) → 홈 0-RTT 유지. (3) `VouchersPage` embedded 기본 category = `EMBEDDED_DEFAULT_CATEGORY`('커피/음료') + SSR consume 가드를 embedded 시 `category==='커피/음료'` 일 때 `__SSR_INITIAL_MAIN__` 읽도록 변경(비embedded `/vouchers` 는 기존 `!category` 동작 불변·default sort price_low 불변). (4) 브랜드 그리드: 브랜드 클릭(필터)해도 그대로 유지(`!brand &&` 제거) + 선택 브랜드 ring 강조 + 재클릭 해제. (5) 커피 브랜드 우선순위 정렬 `orderedBrands`(스타벅스/메가/투썸/할리스/컴포즈/빽다방, `name.includes`, 나머지 원본순). 쿼리 문자열은 클라/서버/cron 1:1 일치(슬래시 `%2F`)라야 cache key 정합 — 셋 모두 동일 리터럴.
- 2026-06-04 `[LOADING_ADDITIVE]` 동네딜·링크샵 로딩 최적화 (감사 기반, 사용자 "근본적 이상적" 승인) — 홈(교환권)은 빠른데 동네딜(`/group-buy` 리스트)·링크샵(SellerPublicPage) 느림 보고. **모두 additive(기존 슬롯/키/헤더 불변, 약화 X)**: (1) `worker/index.ts` SSR 매처에 **GROUPBUY 슬롯 신규**(`/group-buy`&!search → `/api/group-buy/products?status=active`) — 유일 누락 리스트 페이지(기존 4페이지 inject 패턴 그대로). (2) `cache-prewarm.ts` HOT_PATHS 에 동일 key `?status=active` 추가(기존 `&category=all` 와 별개 — 클라 요청 정확 일치). (3) `GroupBuyListPage` 가 `__SSR_INITIAL_GROUPBUY__` consume-once → 마운트 cold fetch 워터폴 제거. (4) 링크샵: dynamic prewarm 에 top10 셀러 `/api/products?seller_id=ID&limit=20`(기본탭 sub-data) 추가 + `/api/shorts/feed` edge cache 추가(정확매칭 `/api/shorts` 에서 서브경로 누락분). sub-request 44/50 안전.
- 2026-06-01 `[LOADING_ADDITIVE]` 피드 카드 React.memo 추출 (감사 기반, 사용자 승인 "이상적 진행") — `VouchersPage`(홈 블렌드) `BrowsePage`(쇼핑) 의 인라인 `.map()` 카드를 `React.memo` 컴포넌트(`VoucherCard`/`BrowseProductCard`)로 추출. 부모 재렌더(스크롤 reveal/필터/무한스크롤 append) 시 전체 카드 재조정되던 것 차단 — `GroupBuyFeedCard`/`ReelCard` 와 동일 패턴의 누락분. **순수 렌더 래퍼 — `__SSR_INITIAL_VOUCHERS__`/`__SSR_INITIAL_BROWSE__`·default sort `price_low`·이미지 속성(width/height/srcSet/lazy/dominant_color) 전부 불변**(약화 X, additive). BrowsePage `toggleInterest` 는 `currentlyInterested` 인자 + `useCallback([t])` 로 안정화(interestedIds per-card boolean 전달 → 토글 카드만 재렌더). `MyVouchersPage` qrcode.react lazy(QR 모달 열 때만, page chunk -10KB).
- 2026-06-01 `[UNLOCK_LOADING]` 유통스타트 도메인 진입 redirect (사용자 승인 "모두 진행") — `worker/index.ts` **export default fetch 진입부에 additive 가드만 추가**: host 가 `utongstart.com`/`www.` 이고 path 가 `/` 이면 `/wholesale` 로 302. **잠긴 SSR inject(349~577)·`caches.default` read 미수정** — 다른 호스트는 즉시 `app.fetch` 통과(no-op). live.ur-team.com 동작·성능 불변. 목적: 클라이언트 redirect 의 첫 깜빡임 제거.
- 2026-06-01 `[UNLOCK_LOADING]` 홈 = 교환권 + 딜모으는법 전환 (사용자 승인) — 홈 `/` 메인 콘텐츠를 공구 피드 → 교환권으로 변경. (1) `worker/index.ts` MAIN SSR 슬롯 path 를 `/api/products?...deal_only=1&sort=price_low`(이미 HOT_PATHS warm → 0-RTT 유지)로 변경. (2) `VouchersPage` 에 `embedded` prop 추가 — embedded 시 SEO/자체헤더 skip + SSR 를 `__SSR_INITIAL_MAIN__` 에서 읽음(기존 `/vouchers` 동작·default sort price_low 불변). (3) `MainHomePage` 가 `GroupBuyFeed` → `DealEarnStrip`(정적) + `<VouchersPage embedded/>` 렌더. entry chunk 58.9KB(회귀 없음). 오프라인 공구는 동네딜(`/group-buy`) 탭 전담. GroupBuyFeed prewarm paths 는 동네딜용으로 유지.
- 2026-06-01 `[UNLOCK_LOADING]` 하단바 재구성 (사용자 승인) — `BottomNav.tsx` 5탭 재배치: 교환권(`/vouchers`) 탭 제거 → 동네딜(`/group-buy`, MapPin) 추가. 순서 홈/동네딜/쇼핑/링크샵/마이. **linkshop localStorage 경로 로직·active-path 패턴 보존** + 동네딜 active-path(`/stays`,`/meal-vouchers`) 추가. `DesktopTopNav` 공구 라벨도 동네딜로 정합. nav.dongnedeal 6개 언어. 교환권 콘텐츠는 블렌드 홈 상단 + `/vouchers` 전체보기로 유지(라우트 불변). 다음: 홈을 기프티콘+딜모으는법으로 전환.
- 2026-05-27 초기 잠금 — commit `cf837926` 외 누적 (`0d6217fe` 이후 모든 perf commit)
- 2026-05-27 2차 확장 — commit `c4925af`~`74bb925` (이번 세션 총 14 commits, critical path -341 KB / -31%)
  - 폴링/Countdown adaptive (`c4925af`)
  - voucher cache invalidation (`daeb2c8`)
  - 카테고리 prewarm + Cache-Control 분리 (`cb8d0a5`)
  - useMyCounts 통합 + Card.memo + SSR 확장 (`9de2840`)
  - GroupBuyDetail below-fold lazy + unused import (`21ab0fb`)
  - cf-image host 확장 + VoucherMap lazy (`b8bd41d`)
  - img-utils critical path -51KB + admin limits + audio singleton (`5583eed`)
  - env-validator dynamic + admin/agency limits + 4 모달 lazy (`cbb08c8`)
  - env-validator chunk 분리 → validation -52KB lazy (`5e556a4`)
  - Phase 1+2 chunk 분할 (`dfb11df`)
  - Phase 3 FrameWrapper 사고 + rollback (`374ea9c`/`336a988`)
  - Phase 4 live hooks (`c1a42d7`)
  - Phase 5 single-page hooks (`74bb925`)
- 2026-05-31 `[UNLOCK_LOADING]` 카카오 same-email 셀러 자동연결 verified 게이트 (사용자 승인, 보안 audit) — `KakaoAuthService.upsertUser` 의 seller auto-link 에 `kakaoUser.emailVerified === true` 조건 추가 (카카오 `is_email_verified`). 미verified email 로 사전생성된 미연결 셀러 행 takeover 차단. **`/host/new` fall-through 방지 동작은 verified 사용자에게 그대로 유지** (대부분 카카오 email 은 verified). KakaoUser/KakaoUserInfoResponse type 에 emailVerified/is_email_verified 필드 추가.
- 2026-05-28 `[UNLOCK_LOADING]` 이미지별 dominant_color placeholder (사용자 허가) — 카드 이미지 깜빡임 0.
  - products.dominant_color 컬럼 (migration 0282 + repair-schema) + 클라이언트 canvas 1x1 lazy 백필 (`src/utils/dominant-color.ts`)
  - 잠금 라우트 SELECT 에 dominant_color 추가 (group-buy-public.routes / ProductRepository LIST_COLUMNS) — 추가만, Cache-Control 등 기존 잠금 동작 불변
  - GroupBuyFeedCard / VouchersPage / BrowsePage 카드: `p.dominant_color || 카테고리 색` fallback + onLoad 백필
  - 신규 public endpoint `POST /api/products/dominant-color` (hex 검증 + NULL 일 때만 UPDATE + rate limit)
- 2026-05-30 `[UNLOCK_LOADING]` 공동구매 = 즉시판매 단일가 모델 (A2, 사용자 허가) — 동적 tier 제거.
  - 배경/설계: `docs/design/groupbuy-instant-sale.md`. 경제=즉시판매, 이름=공동구매 유지, 가격=인원 무관 최대 tier 할인 즉시 단일 적용.
  - `group-buy-public.routes.ts`: 상세 `current_discount_pct = maxTierDiscount`(고정), `next_tier/next_tier_remaining = null`. 리스트 응답에 `current_price` enrich. **Cache-Control / CDN-Cache-Control / tiers array parse 불변** (body enrich + 할인율 의미만 변경).
  - `helpers.ts`: `maxTierDiscount()` 추가 (calcTierDiscount 는 존치 — 테스트/하위호환).
  - `group-buy.routes.ts:223`: join 가격 = `maxTierDiscount` (비잠금 파일).
  - `GroupBuyDetailPage.tsx`: 단계별 tier 사다리 UI + "N명 더 모이면 할인 시작!" 제거 → 정직한 단일가 안내. CountdownRing adaptive / below-fold lazy 등 perf 락 불변.

### 2차 확장 — 추가 잠금 항목 (회귀 시 critical path 30%+ 증가 위험)

| 파일 | 잠긴 항목 | 회귀 시 발생 |
|---|---|---|
| `src/hooks/queries/useMyData.ts` | `useMyVouchers / useMyOrders / useMyAppointments` 의 `refetchOnMount: 'always'` | voucher/주문 발급 후 페이지 진입 시 빈 화면 (2026-05-27 사고) |
| `src/pages/user-profile/useMyCounts.ts` | `useMyVouchers` 재사용 (별도 fetch 금지) | /user/profile 카운트 ↔ /my-vouchers 목록 불일치 재발 |
| voucher 발급 4곳 (`GroupBuyDetailPage`, `GroupBuyConfirmPaymentPage`, `VoucherDetailPage`, `ProductDetailPage`) | `useInvalidateMyVouchers()` 호출 — voucher 발급 후 navigate 직전 | RQ stale cache 영구 표시 |
| `src/main.tsx` | `validateEnvForRuntime` dynamic import — eager 금지 | zod 52KB chunk critical path 진입 |
| `vite.config.ts` `manualChunks` | env-validator/AdminLayout/AgencyLayout/SellerLayout 등 별도 chunk + seller-public/agency/dashboard/payments/cart/search/mypage/wallet/group-buy/product/guide/shipping/upload/glass/settings 폴더별 chunk + useLiveStream/product-template/useCart/useSearch/useTokenAutoRefresh hoisted | critical path -341 KB 회귀 |
| `src/utils/cf-image.ts` `SUPPORTED_HOSTS` / `EXTERNAL_PROXY_HOSTS` + worker `ALLOWED_HOSTS` | ImgBB (i.ibb.co), googleusercontent 추가 — 제거 금지 | 셀러 업로드 이미지 변환 회피 → 트래픽 폭증 |
| `src/worker/cron/cache-prewarm.ts` | 카테고리 칩 4종 prewarm (meal/stay/beauty/etc) — 제거 금지 | 칩 클릭 시 cold D1 (~200-500ms) |
| `src/features/group-buy/api/group-buy-public.routes.ts` | `Cache-Control: max-age=60` + `CDN-Cache-Control: max-age=900` 분리 + `group_buy_tiers` 서버 parse → array 반환 | 브라우저 5분 stale (신선도 회귀) + 클라이언트 JSON.parse 부담 |
| `src/features/products/api/products.routes.ts`, `src/worker/routes/public-utility.routes.ts` | 동일 Cache-Control / CDN-Cache-Control 분리 | 동일 |
| `src/worker/index.ts` SSR inject regex | `/(?:profile\|s)/:slug` 둘 다 매칭 — 제거 금지 | `/s/:id` SSR cache miss 회귀 |
| `src/pages/GroupBuyDetailPage.tsx` | CountdownRing adaptive interval + polling adaptive jitter + below-fold lazy (Confetti/RestaurantMiniMap/ProductReviewsSection) | 매초 리렌더 회귀 + 폴링 부하 ↑ + 초기 chunk 30-50KB ↑ |
| `src/pages/main-home/GroupBuyFeedCard.tsx` | `React.memo` + `rootMargin: '100px'` (200px 금지 — 트래픽 ↑) | 카드 reconcile + 익명 사용자 트래픽 ↑ |
| `src/pages/MyVouchersPage.tsx` | VoucherMap lazy chunk (Kakao Maps SDK) | 진입 시 ~150KB 즉시 로드 |
| `src/lib/image-compress.ts` | `browser-image-compression` 함수 내 dynamic import (module-level eager 금지) | critical path +51KB |
| 발급/주문/모달 lazy (`SellerOrdersPage`, `MyOrdersPage`, `AdminPage`) | OrderDetailModal / BizInfoModal / RejectionModal lazy + Suspense | 페이지 chunk 10-30KB ↑ |

---

## 🚨 개발 + 에러 대처 절대 룰 (모든 다른 룰보다 우선)

**개발/리팩토링 작업 시작 시**: `docs/DEV_IMPLEMENTATION_PLAYBOOK.md` 먼저 스캔.
**에러/버그 신고 받았을 때**: `docs/ERROR_DEBUGGING_PLAYBOOK.md` 먼저 스캔.
**처음 보는 에러 메시지**: `docs/KNOWN_ERRORS.md` 에서 grep — 매칭되면 5분 fix.

핵심 (Playbook 요약):
1. **추측 금지** — "캐시일거다", "env 일거다" 단정 후 코드 변경 X
2. **진단 페이지/명령 먼저** — 같은 에러 2번 보고 받으면 무조건 ground truth 수집 도구 작성 (10분 이내)
3. **에러 메시지 단어 그대로 grep** — 의역 X. `node_modules/<sdk>/types/*.d.ts` 에서 1:1 매칭
4. **dual-mode 제거 금지** — "통일/단순화" 명목으로 기존 분기 삭제 X
5. **1 commit = 1 원인** — 큰 리팩토링 X

> ⚠️ 이 룰 안 지키면: 2026-05-23 Toss 사건처럼 추측 fix 5번 반복 → 사용자 시간 1시간+ 낭비.

## 🔄 진행 중 작업 인계 (필수 — 새 세션 진입 시 첫 액션)

**새 세션 시작 시 반드시 `docs/CURRENT_WORK.md` 먼저 읽기.**

이 파일은 **진행 중 / 미완 작업의 단일 진실원천 (SSOT)**:
- 현재 작업 중인 기능 / 미완 todo 리스트
- 최근 커밋 + 핵심 아키텍처 결정
- 다음 작업 우선순위

**자동 업데이트 룰 (모든 세션이 지킬 것)**:
1. 새 기능/리팩토링 시작 시 → `docs/CURRENT_WORK.md` 의 "진행 중" 표에 추가
2. 기능 완료 + commit 시 → 해당 항목을 "완료" 섹션으로 이동 + commit hash 기록
3. 사용자가 새 요구 추가 시 → 즉시 표에 반영
4. 매 commit 의 변경 파일에 코어 기능 (송출/결제/인증) 포함 시 → 같은 commit 에 `docs/CURRENT_WORK.md` 갱신 함께 staged

> ⚠️ 이 룰 안 지키면: 다음 세션이 진행 상태 모름 → 중복 구현 / 누락 / 사용자 "왜 이거 안 됐어?" 반복.

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

## 🚨 큰 파일 / PowerShell 수정 규칙 (2026-05-12 사고 후 추가)

**배경:** `youtube-live.routes.ts` (1978줄) 가 이전 에이전트의 PowerShell 전체 덮어쓰기 실패로 `// PLACEHOLDER` 2줄만 남고 모두 삭제됨 → YouTube 라이브 API 5개 전부 404 → 셀러 방송 시작 불가 → 메인에 라이브 노출 안 됨. commit `b09d9b4` (-1953줄) 으로 push 됐는데 빌드/diff 검증 누락. 자세한 경위는 `docs/INCIDENTS.md`.

### 절대 하지 말 것
- ❌ **500줄 이상 파일에 Write (전체 덮어쓰기) 사용 금지** — 반드시 Edit 으로 부분 수정
- ❌ **PowerShell `Set-Content` / `Out-File` / heredoc 으로 큰 코드 덮어쓰기 금지** — 한글 인코딩 + 버퍼 잘림 사고 빈발
- ❌ **`Get-Content -Raw` 로 한글 포함 파일 읽기 금지** — 기본 인코딩이 UTF-8 아님 → 한글 깨짐
  - 안전한 방법: `[System.IO.File]::ReadAllText($path, [System.Text.UTF8Encoding]::new($false))`
  - 안전한 쓰기: `[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))`

### 반드시 할 것
- ✅ **commit 전 `git diff --stat` 으로 줄 수 변화 확인** — `-500` 이상 줄이 사라졌으면 의심하고 멈춤
- ✅ **push 전 `npx vite build` 또는 `npx tsc --noEmit --skipLibCheck` 통과 확인 필수**
- ✅ **PowerShell 로 파일 수정한 직후 Select-String 으로 한글 깨짐 검증** — 예: `Select-String -Path X -Pattern "시스템"` 매치 안 되면 인코딩 깨진 것
- ✅ **`export default` 같은 중복 가능 라인은 추가 전에 `Select-String` 으로 기존 존재 여부 확인** — 중복 export → 빌드 실패

> ⚠️ 이 룰 안 지키면: 오늘처럼 또 라이브 API 통째로 날아감 → 운영 중단.

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
  - ⚠️ perl 일괄 치환은 **이미 `dark:` / `hover:` / `focus:` prefix 가 붙은 토큰까지 매칭**해
    `dark:dark:bg-` / 중복 `dark:bg-` / 잘못된 state(`hover:bg-gray-100` → `dark:bg-` 아닌
    `dark:hover:bg-`) 같은 깨진 클래스를 만들 수 있음. 치환 후 반드시
    `node scripts/check-theme-consistency.mjs` 로 검증하고 중복/오매핑 수동 교정.
- FOUC 방지: `index.html` inline script 가 `localStorage.ur_theme_mode_v1` 읽고 선반영
- 다크 페이지 / 셀러 / 어드민 대시보드는 토글 무영향 (페이지 단 명시 강제)
- 🛡️ **자동 강제 (2026-05-31)**: `scripts/check-theme-consistency.mjs` 가 pre-commit(staged 파일)
  + `verify.yml` CI 에서 라이트 토큰의 `dark:` variant 누락을 검사 (variant-aware — `hover:`/`focus:`/
  `placeholder:` 등 state 별 매칭). 대시보드(seller/admin/agency) + 순수 다크 페이지(`bg-[#020202]`/
  `data-mobile-only`) + 콜백/디버그/embed 는 자동 제외. 기본 warn-only, 차단: `STRICT_THEME=1`,
  우회: commit 메시지 `[SKIP_THEME_CHECK]`. → **앞으로 생성/수정되는 페이지에 테마 누락 자동 감지.**

> ⚠️ **글로벌 CSS invert 절대 금지** (2026-05-03 시도/롤백, `docs/INCIDENTS.md`)

> ⚠️ **CSP `style-src` 에 `'nonce-XXX'` 추가 절대 금지** (2026-05-21 사고)
> - React/Tailwind inline style 수천 곳이 nonce 없어 전부 차단 → 화면 전체 깨짐.
> - `'unsafe-inline'` 만 유지. script-src 의 nonce 는 OK (HTMLRewriter 자동 부여).
> - 향후 강화는 별도 PR (모든 inline style 외부화 후 nonce 부여 인프라).

> ⚠️ **셀러 role (seller_type) 직접 비교 절대 금지** (2026-05-21 Phase D-5)
> - `=== 'influencer'`, `=== 'store_owner'` 같은 직접 비교 금지.
> - 항상 `isInfluencer()` / `isStoreOwner()` / `canBroadcast()` 등 helper 사용.
> - UI 자동 분기는 `<RoleGate showFor="...">` 컴포넌트 사용.
> - 마스터: `src/shared/seller-roles.ts` (single source of truth).
> - 라벨 변경 / 새 role 추가 시 본 파일만 수정 → 전체 UI 자동 반영.
> - 한국어 명칭:
>   - "셀러" = 인플루언서 (라이브커머스 컨벤션)
>   - "사장님" / "매장" = store_owner (오프라인 공구 컨벤션)
>   - "에이전시" = 매니징 조직

> ⚠️ **원천징수율 hardcode 절대 금지** (2026-05-21 정정)
> - default 3.3% (사업소득 — 반복적 활동, 대부분 인플루언서)
> - 8.8% 는 기타소득만 (단발성 협업)
> - 마스터: `src/worker/utils/tax-withholding.ts` `WITHHOLDING_RATES`
> - sellers.tax_type 컬럼 ('business_income' default / 'other_income')
> - 새 코드는 `withholdAndLog()` 헬퍼만 호출 — 직접 0.088 / 0.033 곱셈 금지.

> ⚠️ **카카오 OAuth 룰** (2026-05-22 전수 점검)
> - 신규 카카오 endpoint 는 반드시 `safeRedirect()` (kakao.routes.ts) 사용 — open redirect 방어.
> - state CSRF: 모든 OAuth flow 는 `kakao_oauth_state` 쿠키 + URL state 검증.
> - 신규 사용자 생성 전 이메일 takeover 검사 — `KakaoAuthService.upsertUser` 의 `EMAIL_ALREADY_LINKED_TO_OTHER_METHOD` 패턴 따를 것.
> - access_token/refresh_token DB 저장 시 반드시 `encryptToken()` (DATA_ENCRYPTION_KEY).
> - 셀러-카카오 1:1 매핑: `idx_sellers_linked_user_unique` UNIQUE index 필수 (repair-schema 등록 완료).
> - kakao_id UNIQUE: `idx_users_kakao_id_unique` partial unique index (repair-schema 등록 완료).
> - `kakaotalk://` scheme redirect 는 sessionStorage 가드 (2026-04-29 사고).

> ⚠️ **Toss 결제 confirm 직접 fetch 절대 금지** (2026-05-22 옵션 B)
> - 5개 평행 흐름 (충전 / 주문 / 공구 / 숙소 / 교환권) 이 각자 fetch 호출 → 같은 버그 5번 재발.
> - 마스터: `src/worker/utils/toss-gateway.ts` `confirmTossPayment()`
> - 신규 토스 결제 endpoint 는 반드시 helper 호출. 직접 `fetch('https://api.tosspayments.com/...')` 금지.
> - circuit breaker / idempotency-key / amount validation / 에러 메시지 표준화 자동.
> - 키 type 검증도 helper (`decideTossFlow`, `detectTossKeyType`) 사용.

> ⚠️ **`(err as Error).message` 클라이언트 반환 절대 금지** (2026-05-22 보안)
> - DB 에러 메시지 (`UNIQUE constraint failed: users.email`) → 계정 enumeration 공격
> - 스택트레이스 누출 → 내부 구조 노출
> - 마스터: `src/worker/utils/safe-error.ts` `safeError(c, err, '한국어 generic 메시지', '[tag]')`
> - 패턴:
>   ```ts
>   } catch (err) {
>     return safeError(c, err, '주문 처리 중 오류가 발생했습니다', '[orders]')
>   }
>   ```
> - DEV 모드 (ENVIRONMENT=development) 에서만 `_debug` 필드에 detail 포함.

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

## 💸 머니/정합성 코드 작성 룰 (2026-06-11 전 영역 감사에서 도출 — 새 코드는 처음부터 이대로)

> 감사에서 발견된 머니 버그 13건이 전부 아래 4가지 클래스였음. 새 결제/적립/취소/환불 코드는
> 작성 시점에 이 패턴을 따르면 후 감사가 필요 없음. warn 검사: `scripts/check-money-patterns.sh`.

1. **Claim-before-credit (CAS 선점 후 side-effect)** — 적립/차감/환급 같은 돈 side-effect 앞에는
   반드시 원자적 상태 선점: `UPDATE ... SET status='X' WHERE id=? AND status='이전상태'` 후
   `meta.changes === 0` 이면 side-effect 없이 멱등 반환. **사전 SELECT 체크만으로는 동시요청을 못 막음**
   (예: 숙소 confirm/취소, 예약 딜환급, 주문 confirm — 전부 이 패턴으로 수정됨).
2. **적립-역전 대칭** — 새 적립(커미션/보너스/포인트)을 만들면 **같은 commit 에서** 역전 함수를 만들고
   `refundOrderFully`(order-refund.ts) + `returns.routes.ts` 양쪽에 배선. 적립 경로가 둘(confirm/webhook)이면
   적립도 공용 멱등 헬퍼 1개로 (예: `creditOrderCommissions`).
3. **멱등 = UNIQUE index + INSERT OR IGNORE** — "이미 있는지 SELECT 후 INSERT" 금지(race).
   `INSERT OR IGNORE` + repair-schema 에 partial UNIQUE index 등록 + `meta.changes` 검사.
4. **status 플립 ≠ 취소** — 결제 캡처된(PAID/DONE/PREPARING/SHIPPING/DELIVERED) 주문을
   `status='CANCELLED'` 로만 바꾸면 고객 미환불 + 커미션 미역전. 반드시 `refundOrderFully` 경유
   또는 `REFUND_REQUIRED` 차단. bulk 엔드포인트도 동일.

**부수 룰**: 핸들러 안 inline `ALTER TABLE`/`CREATE INDEX` 금지 — `ensureXxx(DB)` + WeakSet 메모이즈
(per-request DDL). 신규 KV write 는 무료 1K/day 한도 고려(고볼륨이면 샘플링), SESSION_KV 에 분석용 write 금지.

## 🚨 DB 스키마 규칙 (요약 — 자세한 건 `docs/SCHEMA.md`)

- **SSOT**: `src/shared/db/production-schema.ts`
- 새 쿼리 작성 전 컬럼 확인 + INSERT 시 NOT NULL 포함 + try-catch
- 자주 틀리는 컬럼 alias: `stock` / `is_active` / `credit_amount`
- orders.status: 대문자 (`PAID`, `DONE`, …) / payment_status: 소문자 (`approved`, …)
- 🛡️ **products 컬럼 추가 금지(예산제, 2026-06-10)**: 새 도매/브랜드/전시 메타는 `product_supply_meta`(K-V 사이드테이블, `src/worker/utils/product-supply-meta.ts`) 사용. products ALTER 가 정말 필요하면 `scripts/products-column-baseline.json` 에 등록 + PR 사유 — CI 가 차단함
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
6. **숫자 포매팅** (대시보드 ₩NaN 사고 — 2026-05-17): `value.toLocaleString()` 직접 호출 금지.
   DB row 값이 null/undefined 이거나 `a * b` 곱셈에 한쪽이 null 이면 `NaN` 노출.
   대신 `@/utils/format` 의 헬퍼 사용:
   ```ts
   import { formatNumber, formatWon, safeNum } from '@/utils/format'
   {formatWon(value)}                       // → ₩1,234 (null → ₩0)
   {formatNumber(value)}                    // → 1,234 (null → 0)
   formatNumber(safeNum(a) * safeNum(b))    // 산술 후 포매팅 — NaN 방지
   ```
7. **첫 페인트 표준**: 리스트/상세 등 데이터 페이지는 `docs/LOADING_ARCHITECTURE.md` 의 "첫 페인트 표준" 표 적용 (SSR 슬롯 or prewarm or placeholder — 스피너-온리 첫 화면 금지)
8. **검증**: `bash scripts/quality-check.sh`

## 🚀 배포 아키텍처

⚠️ **Cloudflare Pages 단일 배포** (Workers 아님):
- `live.ur-team.com` → Pages `ur-live` (Custom Domain)
- `ur-live.pages.dev` → 동일 프로젝트 기본 도메인
- 구조: Pages with `_worker.js`. `wrangler deploy` (Workers용) 사용 금지.

### 🚨 빌드 명령 절대 룰 (2026-05-12 사고 후)

**원인**: `npx vite build` 만 실행하면 **`_worker.js` 가 갱신 안 됨** → 모든 worker 코드 변경이 production 에 반영 안 됨.

```jsonc
// package.json
"build": "npm run build:client && npm run build:worker && npm run build:prepare"
"build:client": "vite build"           ← client 만
"build:worker": "node scripts/build-worker.js"  ← worker 별도
```

- ✅ **올바른 명령**: `npm run build` (또는 PowerShell `.\scripts\deploy.ps1`)
- ❌ **금지**: `npx vite build` 단독 사용 — `_worker.js` 갱신 안 됨
- 🛡️ **자동 방어**: `scripts/validate-build-output.cjs` 가 `_worker.js` mtime 을
  `src/worker/`, `src/features/*/api/` 의 최신 mtime 과 비교 → 오래되면 빌드 실패.

### 권장 배포 명령

```powershell
# PC PowerShell — 안전 스크립트 (권장)
.\scripts\deploy.ps1 -Message "feat-XYZ"

# 또는 직접 명령
npm run build                                                            # ← 핵심: vite build 아님!
npx wrangler@3 pages deploy dist/client --project-name=ur-live `
  --commit-dirty=true --commit-message="ascii-only-no-korean"
```

> ⚠️ `commit-message` 는 **ASCII only** — 한글/em-dash/이모지 포함 시 CF API 가 거부 (`Invalid commit message, it must be a valid UTF-8 string` 에러).

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
4. `npm run build`  ← **`vite build` 아님!** (위 빌드 룰 참조)
5. `git push origin <branch>` (훅이 main 자동 머지 + 배포)
6. Actions 탭 녹색 확인
7. 배포 후 `curl -X POST -i https://live.ur-team.com/api/version` 등 핵심 endpoint smoke test

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

## 🛡️ 영구 방어선 (사고 재발 방지)

과거 사고 패턴이 다시 commit / deploy 되는 것을 차단하는 자동 검사:

| 검사 항목 | Pre-commit Hook | CI Workflow | 사고 출처 |
|---|---|---|---|
| Hono v4 wildcard `cors()` | `check-router-patterns.sh` | `verify.yml` | 2026-05-12/13 405 |
| `vite build` 단독 사용 | `check-build-command.sh` | `verify.yml` | 2026-05-12 _worker.js 미갱신 |
| `_worker.js` 신선도 | `validate-build-output.cjs` (post-build) | - | 2026-05-12 |
| Hardcoded secret | `check-no-secrets.sh` | `verify.yml` | public repo 전환 후 영구 노출 위험 |
| Schema drift | `check-schema-refs.sh` | `verify.yml` | DB 컬럼 부정확 |
| API 인증 누락 | `check-api-auth.sh` | `verify.yml` | IDOR |
| 대시보드 dark variant | `check-dashboard-theme.sh` | `verify.yml` | 사용자 룰 |
| 다크/라이트 테마 일관성 | `check-theme-consistency.mjs` | `verify.yml` (strict) | 2026-05-31 다크모드 흰 박스 + 2026-06-11 역방향 2규칙(bare 다크 hex bg=라이트 검정박스 / dark:bg-white+bare text-white=흰배경 흰글자 — 당일 사고 2건 패턴. 의도적 양모드 다크는 `theme-dual` 주석 면제) |
| Service Worker 등록 | `check-no-sw-register.sh` | `verify.yml` | 2026-04-27 OAuth 차단 |
| 파일 중간 import | (install-git-hooks.sh) | - | 2026-04-22 worker crash |
| Silent error (warn) | `check-silent-errors.sh` | - | 디버깅 곤란 |
| 머니 패턴 (warn, 차단 `STRICT_MONEY=1`) | `check-money-patterns.sh` | - | 2026-06-11 감사 — per-request DDL / 무환불 CANCELLED. 작성 룰: 위 '💸 머니/정합성 코드 작성 룰' |
| 대시보드 NaN/undefined (warn) | `check-nan-dashboard.sh` | - | 2026-05-17 ₩NaN 노출 |
| CHECK 제약 위반 | `check-status-constraints.mjs` (warn) | `verify.yml` (strict) | 2026-05-17 admin live-monitor delete 500 |
| SQL bind param mismatch | `check-sql-bind-params.mjs` (warn) | `verify.yml` (strict) | 'wrong number of bindings' SqlError 방지 |
| NOT NULL INSERT 누락 | `check-sql-not-null-insert.mjs` (warn) | `verify.yml` (warn) | 2026-05-17 알림 silent fail 사고 (notifications.body 컬럼 없음) |
| 존재하지 않는 컬럼 참조 | `check-sql-column-exists.mjs` (warn) | `verify.yml` (warn) | 2026-05-17 'no such column' SqlError 방지 |
| products `SELECT *`/`p.*` | - | `verify.yml` (strict) | 2026-06-10 D1 컬럼 한도(100) 초과 — 교환권/공구 상세 전체 500. `productDetailCols()` 명시 목록 사용 |
| products/sellers 새 컬럼 (예산제) | - | `verify.yml` (strict) | 같은 사고 구조적 후속 — 새 메타는 K-V 사이드테이블(`product_supply_meta`), products/sellers ALTER 는 baseline 등록 필수. **sellers 는 이미 100컬럼(D1 한도 도달)** — `check-products-column-budget.mjs` 가 두 테이블 모두 감시 (`scripts/{products,sellers}-column-baseline.json`) |
| PRODUCT_DETAIL_FIELDS 복구 가능성 | - | `verify.yml` (strict) | 2026-06-10 상품 상세 500 전수조사 — 명시 목록 컬럼은 base CREATE ∪ repair-schema 로 반드시 복구 가능해야 함 (`check-product-detail-fields-repairable.mjs`). 소비자 products SELECT 는 `productDetailColsHealed`+`withColumnPruning` 자가치유 필수 |

**Bypass (정당 사유만):**
- commit message 에 `[SKIP_ROUTER_CHECK]` / `[SKIP_BUILD_CHECK]` / `[SKIP_SECRET_CHECK]` / `[STRICT_SILENT]` 등 명시
- 또는 `git commit -n` (모든 hook 우회) — CI 에서 reject 됨

**배포 흐름 (자동):**
```
git push origin main
   ↓
GitHub Actions (main.yml) auto-trigger
   ↓
[verify.yml steps] 안티패턴 / 빌드 / 타입 / secret 검증
   ↓
[main.yml steps] npm run build → wrangler pages deploy
   ↓
Pages 갱신 → live.ur-team.com 반영
```

**Worker / Cron 변경 시 추가 (드물게):**
```powershell
npx wrangler@3 deploy   # Workers 프로젝트 (cron 코드 동기화)
```
