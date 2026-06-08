# 유어딜 / 유통스타트 — 전체 서비스 지도 & 소개서 커버리지 검증 (MECE)

> **이 문서의 목적**: **5개 대표 소개서**(`wholesale-mall-brief` 도매몰 / `offline-groupbuy-brief` 오프라인 공구 / `online-listing-proposal-brief` 온라인 입점 / `linkshop-brief` 링크샵 / `agency-brief` 에이전시)가 **유어딜/유통스타트 서비스 전체를 빠짐없이(MECE) 커버하는지** 검증하기 위한 마스터 인벤토리 + 커버리지 매트릭스.
>
> ✅ **최종 구조 = 5개 소개서** (2026-06-07 사용자 확정 — 아래 §5 최종 결정 참조). 라이브커머스는 온라인입점·링크샵에 1급 흡수, 에이전시는 전용 덱 신설.
> **작성일**: 2026-06-07 · **근거**: 코드 audit (`src/App.tsx`, `src/routes/*.tsx`, `src/features/*/api/*.routes.ts`, `src/shared/seller-roles.ts`, `src/shared/constants/policy.ts`, `CLAUDE.md`, `docs/design/*`).
> **원칙**: 코드/설정에서 추출. 운영 정책으로만 정해지는 값은 `[확인 필요]`.
> ⚠️ 이 파일은 신규 생성. 다른 4개 소개서 파일은 동시 편집 중이므로 본 문서에서는 수정하지 않음.

---

## 1. 유어딜 전체 사업 지도 (한눈에)

유어딜은 **하나의 코드베이스/DB**로 두 도메인(`live.ur-team.com` = 소비자 라이브커머스, `utongstart.com` = B2B 도매몰)을 호스트 인식 라우팅으로 서비스한다. 사업 라인을 상위 카테고리로 묶으면 다음과 같다.

### 범례
- **위치** = 주요 route / feature module (file).
- **주체** = influencer(크리에이터) / store_owner(매장 사장님) / 일반 user / supplier(제조사) / distributor(유통사) / agency / admin / advertiser(광고주).

### A. 소비자 커머스 (B2C — live.ur-team.com)

| # | 사업 라인 | 1줄 설명 | 위치 (route / feature) | 주 주체 |
|---|---|---|---|---|
| A1 | **라이브커머스 (라이브 방송)** | 셀러가 실시간 방송하며 상품 판매. WHIP/OBS/멀티플랫폼 송출 | `/live`, `/live/:streamId`, `/seller/live-broadcast`, `youtube/`, `streaming/`, `broadcast-notify/`, `multi-platform/` | influencer |
| A2 | **쇼츠 (Shorts)** | 세로 숏폼 피드 + 상품 태깅 | `/shorts`, `/seller/shorts`, `shorts/` | influencer |
| A3 | **라이브 보조 — 경매/타임딜/추첨** | 방송 중 경매(`auction`), 타임딜(`timedeal`) 진행 | `auction/`, `timedeal/` (방송 컨트롤) | influencer |
| A4 | **교환권/기프티콘 (Vouchers)** | 식사권·미용·숙소·기타 교환권 발급·QR 사용·검증 | `/vouchers`, `/vouchers/:id`, `/my-vouchers`, `/v/:code`, `group-buy-voucher/` | store_owner, user |
| A5 | **온라인 쇼핑 (상품/카트/주문)** | 실물 상품 진열·장바구니·결제·배송·반품 | `/browse`, `/products/:id`, `/cart`, `/checkout`, `/my-orders`, `products/`, `cart/`, `orders/`, `shipping/`, `returns/` | 모든 셀러 |
| A6 | **공동구매 (셀러 온라인 공구)** | 즉시판매형 단일가 공구(이름만 공구, 경제=즉시판매) | `/group-buy`, `/group-buy/:id`, `/seller/group-buy`, `group-buy/` | influencer, store_owner |
| A7 | **오프라인 공구 / 동네딜 (맛집)** | 매장 선결제 손님 확보 → 교환권 즉시 발급 (당근식) | `/group-buy`(동네딜 탭), `/meal-vouchers`, `/restaurant-map`, `restaurant-suggestions/`, `settlement/restaurant-settlement` | store_owner |
| A8 | **커뮤니티(유저) 공구 — 맛집 제안** | 소비자가 직접 맛집 공동구매 제안 → 딜 보증금 예치 | `/community-group-buy/new`, `/community-group-buy/:code`, `community-group-buy/` | user(검증 셀러) |
| A9 | **숙소 (Stays)** | 호텔/펜션 예약 — 달력 재고 + reserve-before-charge | `/stays`, `/stays/:id`, `/my-stays`, `/seller/stays`, `group-buy/stays-public` | store_owner |
| A10 | **호스팅 공구 (누구나 호스트)** | 일반 유저가 voucher 공구를 호스팅·모집 (HOSTING_DEFAULTS) | `/host`, `/host/new`, `/g/:invite_code`, `hosting/` | user |
| A11 | **펀딩 (Funding)** | 크라우드펀딩형 목표 달성 판매 | `funding/` | influencer [확인 필요: 노출 route] |
| A12 | **번들/묶음 판매** | 상품 묶음 구성 판매 | `/seller/bundles`, `bundles/` | 셀러 |
| A13 | **디지털 상품** | 디지털 콘텐츠 판매 + 토큰 접근 라이브러리 | `/my/digital`, `digital/` | 셀러 |
| A14 | **예약 (Appointments)** | 시간 슬롯 예약 (미용/체험 등) + 노쇼 정책 | `/my-appointments`, `/seller/appointments`, `appointments/` | store_owner |

### B. 크리에이터 / 링크샵 / 추천 (C2C·성과보상)

| # | 사업 라인 | 1줄 설명 | 위치 | 주 주체 |
|---|---|---|---|---|
| B1 | **링크샵 (크리에이터 공개 샵)** | bio 링크 1개 → 상품/라이브/쇼츠/공구/후원 올인원 페이지 | `/s/:sellerId`, `/profile/:sellerId`, `/seller/mini-shop`, `seller-public/` | influencer, store_owner |
| B2 | **큐레이터 (핀/추천 샵)** | 일반 유저가 상품을 핀(추천)해 어필리에이트 수익 | `/u/:handle`, `/u/me`, `/u/me/earnings`, `curator/` | user(큐레이터) |
| B3 | **후원 (Donations)** | 라이브/링크샵에서 팬이 셀러에게 후원 (딜 차감, 최소 500딜) | `/seller/donations`, `donations/`, `donation-booster` | influencer |
| B4 | **추천/어필리에이트 (Referral)** | 추천 코드·친구초대 양쪽 보너스(0.5%), 핀 어필(1%) | `/referral`, `/referral/:code`, `referral/`, `affiliate/`, `invite-reward` | user, 셀러 |
| B5 | **매장 영입 (Store Intro)** | 크리에이터/에이전시가 매장을 영입 → intro commission 적립 | `payment.routes` creditInfluencerStoreIntroCommission, `agency-introduced-stores/` | influencer, agency |
| B6 | **딜 포인트 (충전/지갑/원장)** | 1원=1딜 충전, 결제·후원 차감, 원장/정산 | `/points/charge`, `/my-deal-history`, `/my-ledger`, `points/`, `ledger/` | user, 셀러 |
| B7 | **로열티/뷰어 등급** | 시청자 로열티 등급, 셀러 등급(bronze~platinum) 보너스 | `loyalty/`, `viewer-loyalty`, `seller-tiers/`, `/seller/tier` | user, 셀러 |
| B8 | **쿠폰/프로모** | 쿠폰 발급·클레임, 프로모 코드 | `/my-coupons`, `/coupon/:code`, `coupons/`, `promo/`, `/seller/promo-codes` | 셀러 |

### C. 셀러 / 매장 운영 도구 (대시보드)

| # | 사업 라인 | 1줄 설명 | 위치 |
|---|---|---|---|
| C1 | **셀러 입점/온보딩/사업자 등록** | 가입·승인·사업자정보·2FA | `/seller/register`, `/seller/business-info`, `seller-registration`, `seller-onboarding` |
| C2 | **상품 관리 (등록/편집/재고/대량등록)** | 상품 CRUD, CSV 대량등록, 재고 | `/seller/products`, `/seller/inventory`, `bulk-upload/`, `inventory/` |
| C3 | **주문/배송/반품 관리** | 셀러 주문·운송장·반품 | `/seller/orders`, `seller-orders`, `returns/` |
| C4 | **정산 (Settlement)** | 셀러/매장 정산·출금 (최소 1만원, T+N 성숙) | `/seller/settlements`, `seller-settlements`, `settlement/` |
| C5 | **분석/리포트** | 셀러·라이브 분석, 매출 리포트 | `/seller/analytics`, `/seller/live-analytics`, `seller-analytics`, `reports/` |
| C6 | **리뷰 관리** | 상품/매장 리뷰, 리뷰 보너스 | `/seller/reviews`, `reviews/`, `review-bonus` |
| C7 | **알림톡/마케팅 (Alimtalk)** | 카카오 알림톡, 팔로워 알림, 마케팅 | `/seller/alimtalk`, `/seller/marketing`, `alimtalk/`, `marketing.routes`, `live-notify-followers` |
| C8 | **광고 슬롯/부스트** | 셀러 광고 슬롯, 노출 부스트 | `/seller/ad-slots`, `seller-ad-slots`, `promote-boosts` |
| C9 | **위탁/대리 판매 (Consignment/Proxy)** | 위탁 상품, 프록시 상품 | `/seller/consignment`, `/seller/proxy-products`, `consignment` |
| C10 | **YouTube 성장 도구** | 유튜브 채널 성장·할당량 | `/seller/youtube-growth`, `youtube-growth/` |
| C11 | **셀러 이전 (Transfer)** | 셀러 소유권/에이전시 이전 | `/seller/transfers`, `seller-transfer`, `seller-transfer-respond` |

### D. B2B 도매몰 — 유통스타트 (utongstart.com)

| # | 사업 라인 | 1줄 설명 | 위치 |
|---|---|---|---|
| D1 | **도매 카탈로그/주문 (유통사向)** | 등급 공급가로 무재고 사입·주문·정산 | `/wholesale`, `/wholesale/product/:id`, `/wholesale/cart`, `/wholesale/orders`, `wholesale/`, `wholesale-supplier` |
| D2 | **제조사(공급자) 대시보드** | 제조사 상품 공급·정산·가시성(MOQ/공급범위) | `/supplier`, `/supplier/wholesale-orders`, `supply/`, `supplier-dashboard`, `supplier-auth` |
| D3 | **유통사 등급제 (Distributor Grade)** | A~D/OEM/특별 등급별 마진율 (기본 C 20%) | `distributor-admin`, `distributor-pricing.ts`, `/admin/distributor-grades` |
| D4 | **OEM/ODM** | 제조 위탁(OEM) 등급(8%) + OEM 안내 페이지 | `/wholesale/oem`, OEM grade |
| D5 | **명세서/거래 문서** | 거래명세서, 세금계산서 문서 | `/wholesale/statement`, `/wholesale/documents` |
| D6 | **공급 정산 (B2B)** | 브랜드 익일/일반 7일 성숙, 일 1억 한도 | `wholesale-settlement.ts`, `supply-settlement.ts` |

### E. 에이전시 (매니징 조직)

| # | 사업 라인 | 1줄 설명 | 위치 |
|---|---|---|---|
| E1 | **에이전시 셀러 매니징** | 소속 셀러 관리·스케줄·캠페인·인센티브 | `/agency`, `/agency/sellers`, `agency/`, `agency-campaigns`, `agency-incentives` |
| E2 | **에이전시 정산/KPI** | 에이전시 입점 분배(30%)·정산·KPI·랭킹 | `/agency/settlements`, `/agency/stats`, `agency-settlements`, `agency-kpi` |
| E3 | **에이전시 매장/셀러 영입** | 매장 영입·매칭 제안·PK 배틀·부스트 | `/agency/introduced-stores`, `/agency/match-suggestions`, `/agency/pk`, `pk-battles`, `promote-boosts` |
| E4 | **에이전시 공구/숙소/캘린더** | 에이전시 단위 공구·숙소·일정 | `/agency/group-buy`, `/agency/stays`, `/agency/calendar` |
| E5 | **에이전시 공개 페이지/파트너 랜딩** | `/a/:slug` 공개 + 파트너 모집 | `/a/:slug`, `/agency-partner`, `agency-public` |

### F. 광고/마켓플레이스 (B2B2C)

| # | 사업 라인 | 1줄 설명 | 위치 |
|---|---|---|---|
| F1 | **캐스팅 마켓플레이스** | 광고주 ↔ 셀러 캐스팅(협찬/광고) 중개 | `/seller/castings`, `/admin/castings`, `casting/` |
| F2 | **셀러 발굴 (Prospects/Discovery)** | 인플루언서/틱톡 발굴·영입 후보 | `/seller/prospects`, `/influencer/discover`, `seller-prospects`, `admin-tiktok-discovery` |

### G. 플랫폼 공통 / 외부연동 / 운영

| # | 사업 라인 | 1줄 설명 | 위치 |
|---|---|---|---|
| G1 | **인증 (카카오/구글/Firebase)** | 카카오 OAuth(한국), 구글, 셀러/어드민 JWT | `auth/`, `kakao-social/`, `/auth/kakao/callback` |
| G2 | **Cafe24 외부몰 연동** | 외부 쇼핑몰 상품 import | `/admin/cafe24`, `cafe24/` |
| G3 | **알림/푸시/이메일** | 인앱·푸시·이메일·대시보드 알림 | `/notifications`, `notifications/`, `push/`, `email.routes` |
| G4 | **블로그/콘텐츠** | 블로그 콘텐츠(SEO) | `/blog`, `/blog/:slug`, `blog/` |
| G5 | **어드민 운영 콘솔** | 승인·정산·분쟁·모니터링·세무 등 60+ 페이지 | `/admin/*`, `admin/`, `moderation/` |
| G6 | **세금/원천징수** | 사업소득 3.3% / 기타소득 8.8% 자동 원천징수 | `tax-withholding.ts`, `/admin/withholding` |
| G7 | **가이드/FAQ 봇** | 역할별 운영가이드 3종 + FAQ 봇 | `/seller/guide`, `/agency/guide`, `/admin/operations-guide`, `guides/`, `faq-bot` |
| G8 | **소셜/팔로우/위시리스트** | 팔로우, 관심상품, 위시리스트 | `/following`, `/wishlist`, `social/`, `wishlists/`, `loyalty/interest` |

> **수익원 요약 (policy.ts / CLAUDE.md):** 플랫폼 fee 5%, 위탁 셀러 commission 10%, 후원 수수료 15%, 에이전시 분배 30% / 인플루언서 입점 분배 20%, 어필리에이트 5% / 양쪽 추천 0.5% / 큐레이터 핀 1% / 호스트 1% / 매장영입 1.5%(`influencer_store_intro_pct`), 숙박 commission 상한 20%, 도매 등급 마진 A10/B15/C20/D25/OEM8%. 충전 수수료 0원(1원=1딜).

---

## 2. 대표 5대 소개서 정의 & 소유 범위

| 소개서 | 한 줄 정의 | 마땅히 소유해야 할 sub-feature |
|---|---|---|
| **도매몰** (`wholesale-mall-brief`) | utongstart.com B2B 무재고 유통 (제조사 ↔ 플랫폼 ↔ 유통사 등급제) | D1~D6 전부 (도매 카탈로그/주문, 제조사 대시보드, 등급제, OEM/ODM, 명세서, B2B 정산) |
| **오프라인 공구** (`offline-groupbuy-brief`) | 동네딜/맛집 — 매장 선결제 손님 확보 + 교환권 즉시발급 | A7(동네딜/식사권), A4(교환권 발급/QR), A9(숙소), A8(커뮤니티 맛집 제안=보조), A14(예약), restaurant-map/settlement |
| **온라인 입점** (`online-listing-proposal-brief`) | 상품 1회 등록 → 쇼핑·라이브·링크샵 3채널 동시판매 | A5(쇼핑), A6(온라인 공구), A1·A2(라이브/쇼츠 판매채널), C1~C5(입점/상품/주문/정산/분석), G2(Cafe24), A12(번들) |
| **링크샵** (`linkshop-brief`) | 크리에이터 bio 링크 1개 올인원 샵 (상품·라이브·공구·후원) | B1(링크샵), B2(큐레이터 핀), B3(후원), B4(추천 — 핀 어필), A1·A2(링크샵 내 라이브/쇼츠 노출) |

---

## 3. 커버리지 매트릭스 (MECE 검증)

표기: ✅ 주(primary) 소유 · 🔸 교차/부분 언급 · ❌ 미커버.

| 사업 라인 | 도매몰 | 오프라인공구 | 온라인입점 | 링크샵 | 공통/교차 | 미커버 판정 |
|---|:--:|:--:|:--:|:--:|:--:|---|
| A1 라이브커머스(방송) | | 🔸 | 🔸(판매채널) | 🔸(노출) | 라이브 자체 | ⚠️ **어느 소개서도 "라이브커머스 자체"를 주력으로 안 다룸** |
| A2 쇼츠 | | | 🔸 | 🔸 | | A1과 동일 — 보조로만 |
| A3 경매/타임딜 | | | | | | ❌ **GAP** (방송 수익화 기능, 어디에도 없음) |
| A4 교환권/기프티콘 | | ✅ | 🔸 | 🔸 | 교환권 | 오프라인공구가 주. 온라인 기프티콘 판매는 모호 [확인 필요] |
| A5 온라인 쇼핑 | | | ✅ | 🔸 | | OK |
| A6 셀러 온라인 공구 | | 🔸(혼동주의) | ✅ | 🔸 | | OK (단 "공구" 이름 중복 → 오프라인공구와 경계 명시 필요) |
| A7 동네딜/맛집 | | ✅ | | | | OK |
| A8 커뮤니티 맛집 제안 | | 🔸(보조 §7) | | | | OK(보조) |
| A9 숙소(Stays) | | 🔸 | | | | ⚠️ 오프라인공구에 §로만 — **숙소 전용 비중 약함** |
| A10 호스팅 공구 | | 🔸 | | 🔸 | | ⚠️ **거의 미커버** (누구나 호스트) |
| A11 펀딩 | | | 🔸 | | | ❌ **GAP** |
| A12 번들 | | | 🔸 | | | OK(약) |
| A13 디지털 상품 | | | 🔸 | | | ⚠️ 약함 |
| A14 예약(Appointments) | | 🔸 | | | | ⚠️ 약함 |
| B1 링크샵 | | | 🔸 | ✅ | | OK |
| B2 큐레이터 핀 | | | | ✅ | | OK |
| B3 후원 | | | | ✅ | 후원 | OK (단 라이브 후원과 링크샵 후원 경계) |
| B4 추천/어필리에이트 | | 🔸 | 🔸 | ✅ | 추천 | 🔸 여러 곳 분산 — **primary home 불명확** |
| B5 매장 영입 | | 🔸 | | 🔸 | | ⚠️ 에이전시/크리에이터 양쪽 — 모호 |
| B6 딜 포인트/지갑 | | 🔸 | 🔸 | 🔸 | 포인트 | 🔸 공통 인프라 — 전 소개서 cross-cut |
| B7 로열티/등급 | | | 🔸 | | | ⚠️ 약함 |
| B8 쿠폰/프로모 | | 🔸 | 🔸 | | | OK(약) |
| C1~C5 셀러 운영도구 | | 🔸 | ✅ | 🔸 | | OK |
| C7 알림톡/마케팅 | | 🔸 | 🔸 | | | OK(약) |
| C8 광고슬롯/부스트 | | | 🔸 | | | ⚠️ 약함 |
| C9 위탁/프록시 | 🔸 | | 🔸 | | | OK(약) |
| C10 YouTube 성장 | | | 🔸 | 🔸 | | ⚠️ 약함 |
| C11 셀러 이전 | | | | | | ❌ (운영 기능, 소개서 불필요할 수 있음) |
| D1~D6 도매/제조/등급/OEM | ✅ | | | | | OK |
| E1~E5 에이전시 | 🔸 | 🔸 | 🔸 | | | ❌ **에이전시 전체가 어느 소개서에도 주력 없음** |
| F1 캐스팅 마켓플레이스 | | | | 🔸 | | ❌ **GAP** (광고주↔셀러 중개) |
| F2 셀러 발굴/Discovery | | | | | | ❌ (운영/영업 기능) |
| G2 Cafe24 연동 | | | ✅ | | | OK |
| G1/G3/G6/G7 인증·알림·세금·가이드 | 🔸 | 🔸 | 🔸 | 🔸 | 공통 인프라 | 소개서 대상 아님(인프라) |

### 핵심 판정

**(a) 어느 소개서도 커버하지 않는 GAP (사업적 의미 있음):**
- **A1 라이브커머스 자체** — 모든 소개서에서 "채널/노출"로만 등장. 유어딜의 **간판 사업인데 주력 소개서 없음**. 🔴
- **A3 경매/타임딜** (방송 수익화), **A11 펀딩** — 판매 모델인데 누락.
- **E 에이전시 전체** — 매니징 조직 대상 소개서/섹션 없음. 🔴
- **F1 캐스팅 마켓플레이스** (광고주 B2B) — 별도 수익/사업 라인인데 누락.
- **A10 호스팅 공구**(누구나 호스트) — 링크샵·공구와 인접하나 명시적 소유 없음.

**(b) 복수 소개서가 겹쳐 모호한 OVERLAP:**
- **"공동구매" 이름 충돌** — A6(셀러 온라인 공구, 온라인입점 소유) vs A7(오프라인 동네딜, 오프라인공구 소유) vs A8(커뮤니티) vs A10(호스팅). 오프라인공구 브리프가 이미 §0에서 "공구 2종 혼동주의"를 경고하지만, **온라인입점 소개서와의 경계(A6는 온라인입점 쪽)**도 명시 필요.
- **B4 추천/어필리에이트** — 링크샵(핀 1%)·온라인입점·오프라인공구·B5 매장영입에 분산. **primary home = 링크샵**으로 통일 권고.
- **B3 후원** — 라이브(A1) 후원과 링크샵(B1) 후원이 같은 기능. primary home = 링크샵.
- **A4 교환권** — 오프라인공구(매장 발급) vs 온라인 기프티콘 판매 경계 [확인 필요].

**(c) 전 소개서를 가로지르는 cross-cutting 공통 기능 (별도 소개서 불필요, 단 각 소개서에 1줄씩 명시 권고):**
- **B6 딜 포인트/지갑/원장** (결제 수단), **C4 정산/원천징수(G6)**, **G1 카카오 인증**, **G3 알림/알림톡**. → 각 소개서 "공통 인프라" 박스로 동일 카피 재사용.

---

## 4. 각 소개서 보완 필요 항목 (빠짐 목록)

### 4-1. 도매몰 (`wholesale-mall-brief`)
- ➕ **D4 OEM/ODM** 전용 섹션 강화 — `/wholesale/oem`, OEM 등급 8% (현재 등급표에 줄로만 존재). 제조 위탁 수요는 별도 타깃.
- ➕ **D5 명세서/세금계산서**(`/wholesale/statement`, `/documents`) — 거래 증빙은 B2B 구매 결정 요소.
- ➕ **공급 범위 모드 3종**(ALL / APPROVED_CHANNEL / UTONGSTART_ONLY) 제조사 가치제안에 명시 — 가격질서/거래처 보호 핵심.
- ➕ **B2B↔B2C 연결**: 도매 입점 상품이 live.ur-team.com 셀러/라이브로도 팔린다는 "판로 2배" 메시지(현재 도메인 분리만 강조).

### 4-2. 오프라인 공구 (`offline-groupbuy-brief`)
- ➕ **A9 숙소(Stays)** — 현재 카테고리 4종 중 stay_voucher로만. 숙소는 달력재고·reserve-before-charge 등 차별 기능이 있어 **별도 비중** 또는 전용 섹션 권고.
- ➕ **A14 예약(Appointments)** — 미용/체험 시간 슬롯 예약 + 노쇼 정책(12h, 30분 알림)을 매장 가치제안에 포함.
- ➕ **A10 호스팅 공구** — "단골/지인이 직접 공구를 호스팅"하는 흐름(HOST 1%)을 매장 확산 도구로 언급.
- ➕ **QR 사용/검증·현금 정산 플로우**(`/v/:code`, VoucherVerify)를 매장 운영 안심 포인트로 명시.

### 4-3. 온라인 입점 (`online-listing-proposal-brief`)
- ➕ **A6 공구 vs A7 동네딜 경계 한 줄** — "여기서 말하는 공구=온라인 즉시판매형, 오프라인 매장 공구는 별도 동네딜 소개서"라고 명시(혼동 차단).
- ➕ **A3 경매/타임딜** — 라이브 방송 중 판매 수익화 기능을 "3채널" 설명에 추가(현재 누락).
- ➕ **A13 디지털 상품 / A11 펀딩 / A12 번들** — 진열형 외 판매 모델 다양성으로 짧게.
- ➕ **C8 광고슬롯/부스트, C7 알림톡, C10 YouTube 성장** — 입점 후 "노출 확대 도구"로 묶어 1박스.
- ➕ **B6 딜 포인트 + C4 자동정산/원천징수** — 정산 안심 카피(이미 5% 수수료는 있음).

### 4-4. 링크샵 (`linkshop-brief`)
- ➕ **B4 추천/어필리에이트의 primary home 선언** — 핀 1% + 양쪽 추천 0.5% + ref 쿠키 24h를 링크샵 수익 구조의 중심으로 명확화.
- ➕ **A10 호스팅 공구** — 링크샵에서 바로 공구를 호스팅(누구나 호스트)하는 동선.
- ➕ **B7 로열티/팔로우** — 팔로워→단골 전환(viewer-loyalty, following)을 "팬덤" 카피로.
- ➕ **A1/A2 라이브·쇼츠 임베드** — 링크샵 탭에 라이브/쇼츠가 실제 들어간다는 점(SellerPublicPage 탭) 시각화 강화.

---

## 5. 권고: 4개로 충분한가?

**결론: 4개로는 빠짐없이(MECE) 커버되지 않는다.** 현재 4개는 "입점 주체별"(도매사/매장/온라인셀러/크리에이터) 분류로는 깔끔하나, 유어딜의 **간판 사업과 B2B 중개 사업이 어느 소개서의 주력도 아닌 사각지대**가 있다.

### 가장 큰 누락 (소개서 추가 또는 전용 섹션 권고)
1. 🔴 **라이브커머스 (라이브 방송 + 쇼츠)** — 플랫폼 정체성의 핵심인데 4개 모두 "보조 채널"로만 취급. **별도 "라이브커머스 소개서" 또는 온라인입점 소개서 내 1급 섹션**으로 승격 권고.
2. 🔴 **에이전시 (매니징 조직)** — 셀러 매니징·정산분배·캐스팅·PK 등 독립 B2B 라인. **에이전시 전용 소개서** 권고(타깃이 셀러·매장·제조사와 전혀 다름).
3. 🟡 **후원 + 추천/어필리에이트 (크리에이터 수익화)** — 링크샵에 흡수 가능하나, 분산되어 있어 **링크샵을 "크리에이터 수익화 올인원" 소개서로 명시 확장**하면 4개 유지 가능.
4. 🟡 **캐스팅(광고주) / 펀딩 / 경매** — 마이너 라인. 별도 소개서까진 불필요, 관련 소개서(온라인입점/에이전시)에 섹션 흡수.

### 권고하는 MECE 구조 (가장 깔끔한 안)

**옵션 A — 4개 유지 + 범위 재정의 (최소 변경):**
- 온라인입점 = 온라인 상품판매 **+ 라이브/쇼츠/경매/타임딜 수익화 채널을 1급 섹션으로 승격**.
- 링크샵 = 링크샵 **+ 후원 + 추천/어필리에이트 + 큐레이터 + 호스팅** (크리에이터 수익화 올인원으로 확장).
- 오프라인공구 = 동네딜 **+ 숙소 + 예약**을 명시 비중.
- 도매몰 = 그대로 + OEM/명세서 보강.
- → **에이전시는 여전히 사각** (옵션 A의 약점).

**옵션 B — 5~6개로 확장 (완전 MECE, 권고):**
1. **라이브커머스 & 크리에이터 수익화** (라이브/쇼츠/경매/타임딜 + 후원 + 추천 + 링크샵 = 통합) — 또는 라이브와 링크샵 2개로 분리.
2. **온라인 상품 입점** (쇼핑/상품/정산/Cafe24).
3. **오프라인 공구 / 동네딜** (동네딜 + 숙소 + 예약 + 교환권).
4. **도매몰 / 유통스타트** (B2B 등급제 + OEM).
5. **에이전시 파트너** (매니징 + 캐스팅 + 정산분배).
> 공통 인프라(딜 포인트·정산·원천징수·카카오 인증·알림톡)는 모든 소개서가 공유하는 "공통 1페이지" 모듈로 재사용.

**최종 권고:** 발표 목적이면 **옵션 A(4개 유지, 범위 보강)** + "라이브커머스"와 "에이전시"는 각각 온라인입점/별도 부록으로 흡수. 사업 전체를 빠짐없이 보여줄 목적이면 **옵션 B(에이전시 소개서 1개 추가 = 5개, 라이브를 링크샵/온라인입점에 1급 승격)**.

---

## ✅ 5. 최종 결정 (2026-06-07 — 사용자 확정) & 반영 결과

**채택: 옵션 B 변형 → 총 5개 소개서.** "라이브커머스/에이전시 사각" 문제를 다음과 같이 해소(전부 반영 완료):

| # | 소개서 | 파일 | 흡수한 누락 라인 |
|---|---|---|---|
| 1 | 도매몰 (B2B) | `wholesale-mall-brief.md` | 최저가검수·가격승인 / 합배송·드랍쉽 / 공급범위3종 / OEM·ODM / 바로빌 / B2B↔B2C 경계 |
| 2 | 오프라인 공구 | `offline-groupbuy-brief.md` | 숙소(stays) / 식사권 / 예약(appointments) / 커뮤니티 제안 소개글 / 매장영입 경계 / 공구 4흐름 경계 |
| 3 | 온라인 입점 | `online-listing-proposal-brief.md` | **라이브커머스 1급 승격** / 경매·타임딜 / 펀딩 / 번들·디지털 / 캐스팅 / 기프티콘 판매 / 셀러 운영도구 전체 / 에이전시 매니징 옵션 |
| 4 | 링크샵 | `linkshop-brief.md` | **라이브·쇼츠(크리에이터)** / 후원(primary) / 추천·어필리에이트(primary: 친구초대·매장영입·큐레이터) / 호스팅공구 / 지갑·원장 |
| 5 | **에이전시 (신규)** | `agency-brief.md` | 에이전시 매니징 / 정산분배 30% / 영입·매칭·PK / 공구·숙소 운영대행 / 공개페이지 — **유어딜의 에이전시 *기능*** 소개(회사 소개 아님) |

- **라이브커머스**: 별도 덱 대신 온라인입점(셀러 판매)·링크샵(크리에이터 호스팅) 양쪽에 **1급 섹션**으로 승격 흡수.
- **"공동구매" 명칭 4중 충돌**: 각 덱의 범위·경계 섹션에서 정리 — ① 셀러 온라인 즉시판매형=온라인입점, ② 오프라인 동네딜·맛집=오프라인공구, ③ 호스팅공구=링크샵, (B2B 사입은 공구 아님=도매몰).
- **cross-cutting 공통 인프라**(딜포인트·정산·원천징수·카카오 인증·알림톡): 각 덱에 1줄씩 명시 + 본 마스터 문서가 SSOT.
- **남은 미배정**: 없음(아래 매트릭스 기준 전 라인 primary home 지정). 마이너 라인은 해당 덱 보조 섹션으로 흡수 완료.

---

## 6. 근거 파일 (Ground Truth)
- 라우트 전수: `src/App.tsx`(L500~802), `src/routes/{seller,admin,agency,supplier}.routes.tsx`
- 역할: `src/shared/seller-roles.ts` (influencer/store_owner/both)
- 수수료/세금/정책 SSOT: `src/shared/constants/policy.ts`, `src/worker/utils/tax-withholding.ts`
- 도매 등급/정산: `src/lib/distributor-pricing.ts`, `src/features/supply/api/*`(wholesale/supplier/distributor-admin/supply-settlement/wholesale-settlement)
- 공구 2종: `src/features/group-buy/api/*` + `src/features/community-group-buy/api/community-group-buy.routes.ts`, `docs/design/groupbuy-instant-sale.md`
- 캐스팅: `src/features/casting/api/casting.routes.ts`(광고주↔셀러 중개)
- 링크샵/큐레이터: `src/pages/SellerPublicPage.tsx`, `src/features/curator/api/curator-api.ts`, `docs/design/linkshop-pivot.md`
- 기능 모듈 전수: `src/features/*/api/*.routes.ts` (auction/timedeal/funding/digital/bundles/donations/referral/affiliate/loyalty/hosting/appointments/cafe24/multi-platform/youtube 등)

---

<!-- AUTO-GENERATED:proposal-refs START -->

## 🤖 코드 자동 동기화 (수치 SSOT + 기능 인벤토리) — 자동 생성, 수동 수정 금지

> 마스터 문서: 전체 도메인 인벤토리 + 버킷별 커버리지 요약. `scripts/generate-proposal-refs.mjs` 자동 생성.

### 커버리지 요약 (자동 — 버킷별 카운트)

| 도메인 | 소개서 파일 | 페이지 | API 엔드포인트 |
|---|---|---|---|
| 도매몰 (유통스타트) | `wholesale-mall-brief.md` | 24 | 101 |
| 오프라인 공구 / 동네딜 | `offline-groupbuy-brief.md` | 27 | 83 |
| 온라인 입점 / 라이브커머스 | `online-listing-proposal-brief.md` | 72 | 332 |
| 링크샵 / 큐레이터 | `linkshop-brief.md` | 13 | 58 |
| 에이전시 | `agency-brief.md` | 53 | 166 |
| **합계** | — | **189** | **740** |

### 전체 커버리지 검증 (자동 — 빠진 기능 보증)

> 모든 페이지/엔드포인트를 3분류: **도메인 버킷** / **공통·인프라(의도적 제외)** / **미커버**.
> 미커버(allowlist 비포함)가 0 이면 모든 서비스 기능이 5개 소개서에 반영됨을 의미.

| 분류 | 페이지 | API 엔드포인트 |
|---|---|---|
| 전체 | 304 | 1046 |
| 도메인 버킷 (5개 소개서) | 189 | 740 |
| 공통/인프라 (의도적 제외) | 115 | 306 |
| **미커버 (점검 필요)** | **0** | **0** |

✅ **미커버 0** — 모든 도메인 관련 페이지/엔드포인트가 5개 소개서 버킷에 포함되었습니다. (나머지는 공통/인프라로 의도적 제외.)
### 핵심 수치 (자동 추출 — 전체)

#### 도매몰 (유통스타트)

### 핵심 수치 (자동 추출)

| 항목 | 값 | 출처 (파일:심볼) |
|---|---|---|
| 유통사 등급 마진율 — A등급 | 10% | `src/lib/distributor-pricing.ts:DEFAULT_GRADE_MARGINS` |
| 유통사 등급 마진율 — B등급 | 15% | `src/lib/distributor-pricing.ts:DEFAULT_GRADE_MARGINS` |
| 유통사 등급 마진율 — C등급 | 20% | `src/lib/distributor-pricing.ts:DEFAULT_GRADE_MARGINS` |
| 유통사 등급 마진율 — D등급 | 25% | `src/lib/distributor-pricing.ts:DEFAULT_GRADE_MARGINS` |
| 유통사 등급 마진율 — OEM등급 | 8% | `src/lib/distributor-pricing.ts:DEFAULT_GRADE_MARGINS` |
| 유통사 등급 마진율 — SPECIAL등급 | 0% | `src/lib/distributor-pricing.ts:DEFAULT_GRADE_MARGINS` |
| 유통회원 가입 시 기본 등급 | C등급 | `src/lib/distributor-pricing.ts:DEFAULT_UNGRADED` |
| 공급자 정산 1일 한도 (default) | 100,000,000원 | `src/features/supply/api/supply-settlement.ts:DEFAULT_DAILY_CAP` |
| 공급자 환불창 (성숙 기간) | 7일 | `src/features/supply/api/supply-settlement.ts:SUPPLIER_REFUND_WINDOW_DAYS` |
| 원천징수 — 사업소득 (반복 활동, default) | 3.3% | `src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.business_income` |
| 원천징수 — 기타소득 (단발성 협업) | 8.8% | `src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.other_income` |
| 기타소득 분리과세 연 한도 | 3,000,000원 | `src/worker/utils/tax-withholding.ts:ANNUAL_THRESHOLD` |

#### 오프라인 공구 / 동네딜

### 핵심 수치 (자동 추출)

| 항목 | 값 | 출처 (파일:심볼) |
|---|---|---|
| 식사권 기본 수수료 | 5% | `src/features/group-buy/api/helpers.ts:DEFAULT_MEAL_VOUCHER_COMMISSION_RATE` |
| 차등 수수료 — 월 GMV 100,000,000원 이상 | 3% | `src/features/group-buy/api/helpers.ts:TIER_COMMISSION` |
| 차등 수수료 — 월 GMV 10,000,000원 이상 | 4% | `src/features/group-buy/api/helpers.ts:TIER_COMMISSION` |
| 커뮤니티 공구 — 기본 보증금/인 | 5,000원 | `src/features/community-group-buy/api/community-group-buy.routes.ts:deposit_per_person` |
| 커뮤니티 공구 — 기본 목표 인원 | 10명 | `src/features/community-group-buy/api/community-group-buy.routes.ts:target_count` |
| 커뮤니티 공구 — 인기 그룹 임계 | 50명 | `src/features/community-group-buy/api/community-group-buy.routes.ts:popular` |
| 호스팅 인센티브 (호스트 적립) | 1% | `src/shared/constants/policy.ts:HOSTING_DEFAULTS.HOST_INCENTIVE_PCT` |
| 호스팅 기본 모집 기간 | 7일 | `src/shared/constants/policy.ts:HOSTING_DEFAULTS.DEFAULT_DEADLINE_DAYS` |
| 호스트당 동시 공구 상한 | 10개 | `src/shared/constants/policy.ts:HOSTING_DEFAULTS.MAX_ACTIVE_HOSTINGS` |
| 예약 노쇼 자동 알림 | 시작 30분 후 | `src/shared/constants/policy.ts:REFUND_POLICY.APPOINTMENT_NOSHOW_ALERT_MIN` |
| 예약 취소 환불 마감 | 시작 12시간 이내 | `src/shared/constants/policy.ts:REFUND_POLICY.APPOINTMENT_CANCEL_DEADLINE_HOURS` |
| 원천징수 — 사업소득 (반복 활동, default) | 3.3% | `src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.business_income` |
| 원천징수 — 기타소득 (단발성 협업) | 8.8% | `src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.other_income` |
| 기타소득 분리과세 연 한도 | 3,000,000원 | `src/worker/utils/tax-withholding.ts:ANNUAL_THRESHOLD` |

#### 온라인 입점 / 라이브커머스

### 핵심 수치 (자동 추출)

| 항목 | 값 | 출처 (파일:심볼) |
|---|---|---|
| 플랫폼 fee (default) | 5% | `src/shared/constants/policy.ts:COMMISSION_DEFAULTS.PLATFORM_FEE_PCT` |
| 위탁 판매 셀러 commission | 10% | `src/shared/constants/policy.ts:COMMISSION_DEFAULTS.SELLER_COMMISSION_PCT` |
| 제휴 마케팅 추천 보상 (default) | 5% | `src/shared/constants/policy.ts:COMMISSION_DEFAULTS.AFFILIATE_COMMISSION_PCT` |
| 외부 카테고리(숙박 등) 수수료 상한 | 20% | `src/shared/constants/policy.ts:COMMISSION_DEFAULTS.STAYS_COMMISSION_CAP_PCT` |
| 최소 출금 금액 | 10,000원 | `src/shared/constants/policy.ts:WITHDRAWAL_DEFAULTS.MIN_AMOUNT` |
| 최소 commission 출금 | 10,000원 | `src/shared/constants/policy.ts:REFUND_POLICY.COMMISSION_MIN_WITHDRAWAL` |
| 원천징수 — 사업소득 (반복 활동, default) | 3.3% | `src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.business_income` |
| 원천징수 — 기타소득 (단발성 협업) | 8.8% | `src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.other_income` |
| 기타소득 분리과세 연 한도 | 3,000,000원 | `src/worker/utils/tax-withholding.ts:ANNUAL_THRESHOLD` |

#### 링크샵 / 큐레이터

### 핵심 수치 (자동 추출)

| 항목 | 값 | 출처 (파일:심볼) |
|---|---|---|
| 제휴 마케팅 추천 보상 (default) | 5% | `src/shared/constants/policy.ts:COMMISSION_DEFAULTS.AFFILIATE_COMMISSION_PCT` |
| 공구 양쪽 추천 보너스 (각각) | 0.5% | `src/shared/constants/policy.ts:COMMISSION_DEFAULTS.REFERRAL_BONUS_BOTHSIDES_PCT` |
| 큐레이터 핀 어필리에이트 | 1% | `src/shared/constants/policy.ts:COMMISSION_DEFAULTS.CURATOR_AFFILIATE_PCT` |
| 후원 수수료 (default) | 15% | `src/features/donations/api/donations.routes.ts:donation_commission_rate fallback` |
| 후원 1일 한도 (인당) | 50,000,000원 | `src/features/donations/api/donations.routes.ts:DAILY_CAP` |
| 큐레이터당 최대 핀 개수 | 200개 | `src/shared/constants/policy.ts:CURATOR_DEFAULTS.PIN_MAX_PER_USER` |
| 추천 ref 쿠키 TTL | 24시간 | `src/shared/constants/policy.ts:CURATOR_DEFAULTS.REF_COOKIE_TTL_HOURS` |
| 큐레이터→셀러 승급 권유 임계 (누적 정산) | 500,000원 | `src/shared/constants/policy.ts:WITHDRAWAL_DEFAULTS.SELLER_UPGRADE_THRESHOLD` |
| 최소 출금 금액 | 10,000원 | `src/shared/constants/policy.ts:WITHDRAWAL_DEFAULTS.MIN_AMOUNT` |
| 최소 commission 출금 | 10,000원 | `src/shared/constants/policy.ts:REFUND_POLICY.COMMISSION_MIN_WITHDRAWAL` |
| 원천징수 — 사업소득 (반복 활동, default) | 3.3% | `src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.business_income` |
| 원천징수 — 기타소득 (단발성 협업) | 8.8% | `src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.other_income` |
| 기타소득 분리과세 연 한도 | 3,000,000원 | `src/worker/utils/tax-withholding.ts:ANNUAL_THRESHOLD` |

#### 에이전시

### 핵심 수치 (자동 추출)

| 항목 | 값 | 출처 (파일:심볼) |
|---|---|---|
| 에이전시 입점 분배 (platform_fee 중) | 30% | `src/shared/constants/policy.ts:COMMISSION_DEFAULTS.AGENCY_SHARE_PCT` |
| 에이전시 본인 commission (매출 기준) | 2% | `src/shared/constants/policy.ts:COMMISSION_DEFAULTS.AGENCY_OWN_RATE` |
| 인플루언서 입점 분배 (platform_fee 중) | 20% | `src/shared/constants/policy.ts:COMMISSION_DEFAULTS.INFLUENCER_INTRO_SHARE_PCT` |
| 크리에이터 매장 영입 commission (default) | 1.5% | `src/worker/utils/influencer-store-intro-commission.ts:DEFAULT_STORE_INTRO_PCT` |
| 원천징수 — 사업소득 (반복 활동, default) | 3.3% | `src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.business_income` |
| 원천징수 — 기타소득 (단발성 협업) | 8.8% | `src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.other_income` |
| 기타소득 분리과세 연 한도 | 3,000,000원 | `src/worker/utils/tax-withholding.ts:ANNUAL_THRESHOLD` |

### 전체 도메인 코드 인벤토리 (자동)

#### 도매몰 (유통스타트)

### 도메인 코드 인벤토리 (자동) — 페이지 (24개)

- `/admin/distributor-grades`
- `/admin/suppliers`
- `/admin/wholesale-guide`
- `/admin/wholesale-orders`
- `/seller/register/supplier`
- `/seller/supply`
- `/supplier`
- `/supplier/login`
- `/supplier/register`
- `/supplier/wholesale-orders`
- `/wholesale`
- `/wholesale/cart`
- `/wholesale/checkout`
- `/wholesale/dashboard`
- `/wholesale/documents`
- `/wholesale/intro`
- `/wholesale/join`
- `/wholesale/login`
- `/wholesale/oem`
- `/wholesale/orders`
- `/wholesale/product/:id`
- `/wholesale/quotes`
- `/wholesale/statement`
- `/wholesale/success`

### 도메인 코드 인벤토리 (자동) — API 엔드포인트 (101개)


**/api/admin/distributor**
- `POST /api/admin/distributor/auto-grade/run`
- `GET /api/admin/distributor/auto-grade/settings`
- `PATCH /api/admin/distributor/auto-grade/settings`
- `GET /api/admin/distributor/company-info`
- `PUT /api/admin/distributor/company-info`
- `GET /api/admin/distributor/distributors`
- `PATCH /api/admin/distributor/distributors/:id`
- `GET /api/admin/distributor/distributors/:id/credit`
- `PATCH /api/admin/distributor/distributors/:id/credit`
- `POST /api/admin/distributor/distributors/:id/credit-repayment`
- `GET /api/admin/distributor/grades`
- `PUT /api/admin/distributor/grades/:grade`
- `GET /api/admin/distributor/oem-requests`
- `PATCH /api/admin/distributor/oem-requests/:id`
- `GET /api/admin/distributor/orders`
- `GET /api/admin/distributor/orders/:id`
- `POST /api/admin/distributor/orders/:id/refund`
- `GET /api/admin/distributor/price-history`
- `GET /api/admin/distributor/product-access`
- `POST /api/admin/distributor/product-access`
- `DELETE /api/admin/distributor/product-access/:id`
- `PATCH /api/admin/distributor/products/:id/margin-override`
- `GET /api/admin/distributor/products/:id/qty-tiers`
- `PUT /api/admin/distributor/products/:id/qty-tiers`
- `PATCH /api/admin/distributor/products/:id/visibility`
- `GET /api/admin/distributor/products/export`
- `GET /api/admin/distributor/proposals`
- `POST /api/admin/distributor/proposals`
- `DELETE /api/admin/distributor/proposals/:id`
- `DELETE /api/admin/distributor/seed-demo-products`
- `POST /api/admin/distributor/seed-demo-products`
- `GET /api/admin/distributor/tax-documents`
- `PATCH /api/admin/distributor/tax-documents/:id`
- `GET /api/admin/distributor/tax-documents/:id/html`
- `POST /api/admin/distributor/tax-documents/:id/issue-nts`
- `POST /api/admin/distributor/tax-documents/issue`
- `GET /api/admin/distributor/tax-summary`

**/api/admin/supplier-products**
- `GET /api/admin/supplier-products`
- `PATCH /api/admin/supplier-products/:id`
- `PATCH /api/admin/supplier-products/:id/price-change`

**/api/admin/suppliers**
- `GET /api/admin/suppliers`
- `PATCH /api/admin/suppliers/:id`
- `POST /api/admin/suppliers/:id/payout`
- `GET /api/admin/suppliers/:id/payouts`

**/api/supplier/analytics**
- `GET /api/supplier/analytics`

**/api/supplier/become**
- `POST /api/supplier/become`

**/api/supplier/login**
- `POST /api/supplier/login`

**/api/supplier/me**
- `GET /api/supplier/me`

**/api/supplier/orders**
- `GET /api/supplier/orders`
- `PUT /api/supplier/orders/:orderId/shipping`

**/api/supplier/products**
- `GET /api/supplier/products`
- `POST /api/supplier/products`
- `PATCH /api/supplier/products/:id`
- `GET /api/supplier/products/:id/channel-access`
- `POST /api/supplier/products/:id/channel-access`
- `DELETE /api/supplier/products/:id/channel-access/:accessId`
- `POST /api/supplier/products/:id/price-change-request`
- `POST /api/supplier/products/bulk`
- `POST /api/supplier/products/bulk-price-change`
- `GET /api/supplier/products/bulk-template`
- `POST /api/supplier/products/stock-import`

**/api/supplier/register**
- `POST /api/supplier/register`

**/api/supplier/settlements**
- `GET /api/supplier/settlements`

**/api/supplier/wholesale**
- `POST /api/supplier/wholesale/items/:id/ship`
- `GET /api/supplier/wholesale/orders`
- `POST /api/supplier/wholesale/orders/:id/refund`
- `POST /api/supplier/wholesale/orders/:id/ship-all`
- `GET /api/supplier/wholesale/orders/export`
- `POST /api/supplier/wholesale/tracking/bulk`

**/api/supply/products**
- `GET /api/supply/products`

**/api/supply/register**
- `POST /api/supply/register`

**/api/supply/sample-requests**
- `GET /api/supply/sample-requests`
- `POST /api/supply/sample-requests`

**/api/wholesale/admin**
- `GET /api/wholesale/admin/claims`
- `PATCH /api/wholesale/admin/claims/:id`

**/api/wholesale/become-distributor**
- `POST /api/wholesale/become-distributor`

**/api/wholesale/catalog**
- `GET /api/wholesale/catalog`
- `GET /api/wholesale/catalog/:id`

**/api/wholesale/catalog-export**
- `GET /api/wholesale/catalog-export`

**/api/wholesale/claims**
- `GET /api/wholesale/claims`
- `POST /api/wholesale/claims`

**/api/wholesale/documents**
- `GET /api/wholesale/documents`
- `GET /api/wholesale/documents/:id/html`

**/api/wholesale/home**
- `GET /api/wholesale/home`

**/api/wholesale/me**
- `GET /api/wholesale/me`

**/api/wholesale/oem-requests**
- `GET /api/wholesale/oem-requests`
- `POST /api/wholesale/oem-requests`

**/api/wholesale/order-template**
- `GET /api/wholesale/order-template`

**/api/wholesale/orders**
- `GET /api/wholesale/orders`
- `POST /api/wholesale/orders`
- `GET /api/wholesale/orders/:id`
- `POST /api/wholesale/orders/confirm`

**/api/wholesale/proposals**
- `GET /api/wholesale/proposals`

**/api/wholesale/quotes**
- `GET /api/wholesale/quotes`
- `POST /api/wholesale/quotes`
- `POST /api/wholesale/quotes/:id/accept`
- `POST /api/wholesale/quotes/:id/reject`
- `PATCH /api/wholesale/quotes/:id/respond`

**/api/wholesale/recent-items**
- `GET /api/wholesale/recent-items`

**/api/wholesale/register**
- `POST /api/wholesale/register`

**/api/wholesale/statement**
- `GET /api/wholesale/statement`


#### 오프라인 공구 / 동네딜

### 도메인 코드 인벤토리 (자동) — 페이지 (27개)

- `/admin/deals`
- `/admin/group-buy`
- `/admin/restaurant-demand`
- `/admin/stays`
- `/admin/voucher-orders`
- `/admin/voucher-transactions`
- `/community-group-buy/:code`
- `/community-group-buy/new`
- `/g/:invite_code`
- `/group-buy`
- `/group-buy/:id`
- `/group-buy/confirm-payment`
- `/meal-vouchers`
- `/my-appointments`
- `/my-stays`
- `/restaurant-map`
- `/seller/appointments`
- `/seller/meal-voucher/new`
- `/seller/products/:id/booking-slots`
- `/seller/stays`
- `/seller/stays/:id`
- `/seller/stays/bookings`
- `/seller/stays/new`
- `/seller/store-dashboard`
- `/seller/voucher-orders`
- `/stays`
- `/stays/:id`

### 도메인 코드 인벤토리 (자동) — API 엔드포인트 (83개)


**/api/admin/stays**
- `GET /api/admin/stays`
- `GET /api/admin/stays/bookings`
- `GET /api/admin/stays/bookings/:id`
- `PATCH /api/admin/stays/bookings/:id/dispute`
- `PATCH /api/admin/stays/bookings/:id/refund`
- `GET /api/admin/stays/kpi`
- `PATCH /api/admin/stays/reviews/:id/hide`

**/api/admin/voucher-orders**
- `GET /api/admin/voucher-orders`
- `POST /api/admin/voucher-orders/:id/resend`

**/api/appointments/:id**
- `PATCH /api/appointments/:id/cancel`

**/api/appointments/book**
- `POST /api/appointments/book`

**/api/appointments/my**
- `GET /api/appointments/my`

**/api/community-group-buy/:id**
- `PATCH /api/community-group-buy/:id/confirm`
- `GET /api/community-group-buy/:id/messages`
- `POST /api/community-group-buy/:id/messages`
- `POST /api/community-group-buy/:id/refund`
- `PATCH /api/community-group-buy/:id/status`

**/api/community-group-buy/create**
- `POST /api/community-group-buy/create`

**/api/community-group-buy/detail**
- `GET /api/community-group-buy/detail/:code`

**/api/community-group-buy/join**
- `POST /api/community-group-buy/join/:code`

**/api/community-group-buy/list**
- `GET /api/community-group-buy/list`

**/api/community-group-buy/my**
- `GET /api/community-group-buy/my`

**/api/community-group-buy/popular**
- `GET /api/community-group-buy/popular`

**/api/funding**
- `GET /api/funding/`

**/api/funding/:id**
- `GET /api/funding/:id`
- `GET /api/funding/:id/progress`

**/api/group-buy/:code**
- `POST /api/group-buy/:code/use`
- `POST /api/group-buy/:code/use-by-seller`

**/api/group-buy/_diag**
- `GET /api/group-buy/_diag`

**/api/group-buy/admin**
- `GET /api/group-buy/admin/analytics`
- `POST /api/group-buy/admin/force-refund/:productId`
- `GET /api/group-buy/admin/list`
- `POST /api/group-buy/admin/seller-closure/:sellerId`

**/api/group-buy/commission-rate**
- `GET /api/group-buy/commission-rate`

**/api/group-buy/confirm-toss**
- `POST /api/group-buy/confirm-toss`

**/api/group-buy/join**
- `POST /api/group-buy/join/:id`

**/api/group-buy/live-ticker**
- `GET /api/group-buy/live-ticker`

**/api/group-buy/my**
- `GET /api/group-buy/my`

**/api/group-buy/products**
- `GET /api/group-buy/products`
- `GET /api/group-buy/products/:id`
- `GET /api/group-buy/products/:id/participants`

**/api/group-buy/refund**
- `POST /api/group-buy/refund/:productId`

**/api/group-buy/seller-voucher-stats**
- `GET /api/group-buy/seller-voucher-stats`

**/api/group-buy/stays**
- `GET /api/group-buy/stays/:productId`
- `GET /api/group-buy/stays/:productId/availability`
- `GET /api/group-buy/stays/:productId/reviews`
- `PATCH /api/group-buy/stays/bookings/:id/cancel`
- `POST /api/group-buy/stays/bookings/:id/review`
- `POST /api/group-buy/stays/bookings/confirm`
- `POST /api/group-buy/stays/bookings/create`
- `POST /api/group-buy/stays/bookings/create-multi`
- `GET /api/group-buy/stays/my-bookings`
- `GET /api/group-buy/stays/search`

**/api/group-buy/store-stats**
- `POST /api/group-buy/store-stats/:productId`

**/api/group-buy/verify**
- `GET /api/group-buy/verify/:code`

**/api/group-buy/voucher**
- `POST /api/group-buy/voucher/:code/cancel`
- `POST /api/group-buy/voucher/:code/partial-refund`

**/api/group-buy/voucher-logs**
- `GET /api/group-buy/voucher-logs`

**/api/hosting/catalog**
- `GET /api/hosting/catalog`

**/api/hosting/g**
- `GET /api/hosting/g/:invite_code`

**/api/hosting/me**
- `GET /api/hosting/me`
- `POST /api/hosting/me`
- `GET /api/hosting/me/:id`
- `PATCH /api/hosting/me/:id/cancel`

**/api/restaurant-suggestions**
- `POST /api/restaurant-suggestions/`

**/api/restaurant-suggestions/stats**
- `GET /api/restaurant-suggestions/stats`

**/api/seller/appointments**
- `GET /api/seller/appointments`
- `PATCH /api/seller/appointments/:id/complete`
- `PATCH /api/seller/appointments/:id/no-show`

**/api/seller/stays**
- `GET /api/seller/stays`
- `POST /api/seller/stays`
- `GET /api/seller/stays/:productId`
- `PUT /api/seller/stays/:productId`
- `GET /api/seller/stays/:productId/bookings`
- `GET /api/seller/stays/:productId/calendar`
- `PUT /api/seller/stays/:productId/calendar`
- `POST /api/seller/stays/:productId/rooms`
- `DELETE /api/seller/stays/:productId/rooms/:roomId`
- `PUT /api/seller/stays/:productId/rooms/:roomId`
- `PATCH /api/seller/stays/bookings/:bookingId/check-in`
- `PATCH /api/seller/stays/bookings/:bookingId/check-out`
- `PATCH /api/seller/stays/bookings/:bookingId/no-show`
- `PATCH /api/seller/stays/bookings/:bookingId/use-voucher`


#### 온라인 입점 / 라이브커머스

### 도메인 코드 인벤토리 (자동) — 페이지 (72개)

- `/browse`
- `/cart`
- `/checkout`
- `/live`
- `/live/:streamId`
- `/live/recap/:id`
- `/my-orders`
- `/my-returns`
- `/my-vouchers`
- `/product/:id`
- `/products/:id`
- `/search`
- `/seller`
- `/seller/2fa`
- `/seller/ad-slots`
- `/seller/alimtalk`
- `/seller/analytics`
- `/seller/bundles`
- `/seller/business-info`
- `/seller/consignment`
- `/seller/coupons`
- `/seller/dashboard`
- `/seller/followers`
- `/seller/forgot-password`
- `/seller/group-buy`
- `/seller/guide`
- `/seller/inventory`
- `/seller/ledger`
- `/seller/live`
- `/seller/live-analytics`
- `/seller/live-analytics/:streamId`
- `/seller/live-broadcast`
- `/seller/live-broadcast/:streamId`
- `/seller/live-control`
- `/seller/login`
- `/seller/marketing`
- `/seller/notify-followers`
- `/seller/orders`
- `/seller/plus-friend-guide`
- `/seller/products`
- `/seller/products/:id/edit`
- `/seller/products/new`
- `/seller/profile`
- `/seller/promo-codes`
- `/seller/promote-boosts`
- `/seller/proxy-products`
- `/seller/realtime`
- `/seller/register`
- `/seller/register/business`
- `/seller/reset-password`
- `/seller/reviews`
- `/seller/settlements`
- `/seller/shorts`
- `/seller/signup`
- `/seller/streaming-guide`
- `/seller/streaming-setup`
- `/seller/streams/:id`
- `/seller/streams/new`
- `/seller/tier`
- `/seller/tiktok-callback`
- `/seller/transfers`
- `/seller/verify-whip-proxy`
- `/seller/waiting`
- `/seller/youtube-growth`
- `/seller/youtube-growth/success`
- `/seller/youtube/callback`
- `/shorts`
- `/store/stats/:productId`
- `/v/:code`
- `/vouchers`
- `/vouchers/:id`
- `/wishlist`

### 도메인 코드 인벤토리 (자동) — API 엔드포인트 (332개)


**/api/admin-review-bonus/:id**
- `POST /api/admin-review-bonus/:id/approve`
- `POST /api/admin-review-bonus/:id/reject`

**/api/admin-review-bonus/list**
- `GET /api/admin-review-bonus/list`

**/api/auction/:id**
- `GET /api/auction/:id`
- `POST /api/auction/:id/bid`
- `POST /api/auction/:id/cancel`
- `POST /api/auction/:id/end`
- `POST /api/auction/:id/forfeit-winner`
- `POST /api/auction/:id/promote-runner-up`
- `POST /api/auction/:id/purchase`
- `POST /api/auction/:id/release-hold`
- `POST /api/auction/:id/winner-paid`

**/api/auction/create**
- `POST /api/auction/create`

**/api/auction/holds**
- `GET /api/auction/holds/me`

**/api/auction/stream**
- `GET /api/auction/stream/:streamId`

**/api/cart**
- `GET /api/cart/`
- `POST /api/cart/`

**/api/cart/:id**
- `DELETE /api/cart/:id`
- `PUT /api/cart/:id`

**/api/cart/clear**
- `POST /api/cart/clear`

**/api/chat/:liveId**
- `POST /api/chat/:liveId/messages`
- `DELETE /api/chat/:liveId/messages/:messageId`

**/api/live/:liveId**
- `POST /api/live/:liveId/broadcast`
- `GET /api/live/:liveId/chat/messages`
- `GET /api/live/:liveId/chat/sse`
- `GET /api/live/:liveId/sse`
- `POST /api/live/:liveId/view`
- `GET /api/live/:liveId/ws`

**/api/orders**
- `GET /api/orders/`
- `POST /api/orders/`

**/api/orders/:id**
- `GET /api/orders/:id`
- `POST /api/orders/:id/cancel`
- `POST /api/orders/:id/confirm`
- `GET /api/orders/:id/tracking`

**/api/orders/:orderId**
- `GET /api/orders/:orderId/pending-bookings`

**/api/orders/internal**
- `POST /api/orders/internal/auto-confirm`
- `POST /api/orders/internal/sync-deliveries`

**/api/orders/refund**
- `POST /api/orders/refund`

**/api/platforms**
- `GET /api/platforms`

**/api/platforms/destinations**
- `GET /api/platforms/destinations`

**/api/platforms/multistream**
- `GET /api/platforms/multistream`

**/api/platforms/streaming-tools**
- `GET /api/platforms/streaming-tools`
- `GET /api/platforms/streaming-tools/:tool/preset`

**/api/products**
- `GET /api/products/`
- `POST /api/products/`

**/api/products/:id**
- `DELETE /api/products/:id`
- `GET /api/products/:id`
- `PUT /api/products/:id`
- `GET /api/products/:id/available-slots`
- `GET /api/products/:id/options`

**/api/products/dominant-color**
- `POST /api/products/dominant-color`

**/api/products/search**
- `GET /api/products/search/popular`
- `GET /api/products/search/suggestions`

**/api/returns/:id**
- `PUT /api/returns/:id/approve`
- `PUT /api/returns/:id/inspect`
- `PUT /api/returns/:id/refund`
- `PUT /api/returns/:id/reject`
- `PUT /api/returns/:id/shipping`

**/api/returns/admin**
- `GET /api/returns/admin`

**/api/returns/my**
- `GET /api/returns/my`

**/api/returns/request**
- `POST /api/returns/request`

**/api/returns/seller**
- `GET /api/returns/seller`

**/api/review-bonus/my**
- `GET /api/review-bonus/my`

**/api/review-bonus/submit**
- `POST /api/review-bonus/submit`

**/api/search**
- `GET /api/search/`
- `POST /api/search/`

**/api/search/:id**
- `DELETE /api/search/:id`
- `GET /api/search/:id`
- `PUT /api/search/:id`
- `GET /api/search/:id/options`

**/api/search/dominant-color**
- `POST /api/search/dominant-color`

**/api/search/search**
- `GET /api/search/search/popular`
- `GET /api/search/search/suggestions`

**/api/seller/:sellerId**
- `GET /api/seller/:sellerId/products-public`

**/api/seller/ad-slots**
- `GET /api/seller/ad-slots`
- `POST /api/seller/ad-slots/:id/bid`
- `POST /api/seller/ad-slots/:id/cancel-bid`
- `GET /api/seller/ad-slots/my-bids`

**/api/seller/alimtalk**
- `GET /api/seller/alimtalk`
- `POST /api/seller/alimtalk`
- `GET /api/seller/alimtalk/balance`
- `POST /api/seller/alimtalk/charge`
- `GET /api/seller/alimtalk/credits`
- `POST /api/seller/alimtalk/credits/charge`
- `POST /api/seller/alimtalk/credits/confirm`
- `GET /api/seller/alimtalk/logs`
- `GET /api/seller/alimtalk/messages`
- `POST /api/seller/alimtalk/send`
- `POST /api/seller/alimtalk/test`

**/api/seller/analytics**
- `GET /api/seller/analytics/chart/revenue`
- `GET /api/seller/analytics/coupons`
- `POST /api/seller/analytics/coupons`
- `DELETE /api/seller/analytics/coupons/:id`
- `GET /api/seller/analytics/customers`
- `GET /api/seller/analytics/detailed`
- `POST /api/seller/analytics/orders/bulk-tracking`
- `POST /api/seller/analytics/products/:id/duplicate`
- `GET /api/seller/analytics/products/monthly-trend`
- `GET /api/seller/analytics/products/performance`
- `GET /api/seller/analytics/proxy-products`
- `POST /api/seller/analytics/proxy-products/:id/approve`
- `POST /api/seller/analytics/proxy-products/:id/reject`
- `GET /api/seller/analytics/referral-commissions/summary`
- `GET /api/seller/analytics/reviews`
- `POST /api/seller/analytics/reviews/:id/reply`
- `GET /api/seller/analytics/revisit`
- `GET /api/seller/analytics/store-dashboard/stats`
- `GET /api/seller/analytics/voucher-usage`

**/api/seller/business-info**
- `GET /api/seller/business-info`

**/api/seller/business-registration**
- `POST /api/seller/business-registration/ocr-verify`
- `POST /api/seller/business-registration/submit`

**/api/seller/change-password**
- `POST /api/seller/change-password`

**/api/seller/consignment**
- `GET /api/seller/consignment/`
- `POST /api/seller/consignment/:id/approve`
- `POST /api/seller/consignment/:id/terminate`
- `POST /api/seller/consignment/request`
- `GET /api/seller/consignment/settlements`

**/api/seller/dashboard**
- `GET /api/seller/dashboard/stats`

**/api/seller/deal-balance**
- `GET /api/seller/deal-balance`

**/api/seller/deal-withdraw**
- `POST /api/seller/deal-withdraw`

**/api/seller/forgot-password**
- `POST /api/seller/forgot-password`

**/api/seller/kakao-link-status**
- `GET /api/seller/kakao-link-status`

**/api/seller/link-kakao**
- `POST /api/seller/link-kakao`

**/api/seller/live-notify**
- `POST /api/seller/live-notify/`

**/api/seller/login**
- `POST /api/seller/login`

**/api/seller/my-seller-status**
- `GET /api/seller/my-seller-status`

**/api/seller/onboarding**
- `GET /api/seller/onboarding/`
- `POST /api/seller/onboarding/complete/:step_key`

**/api/seller/optimal-time**
- `GET /api/seller/optimal-time/`

**/api/seller/orders**
- `GET /api/seller/orders`
- `POST /api/seller/orders/:id/refund`
- `PATCH /api/seller/orders/:id/status`
- `PUT /api/seller/orders/:id/status`
- `PUT /api/seller/orders/:id/tracking`
- `PATCH /api/seller/orders/bulk-status`

**/api/seller/personal-info**
- `GET /api/seller/personal-info`

**/api/seller/pin-status**
- `GET /api/seller/pin-status`

**/api/seller/platforms**
- `GET /api/seller/platforms/destinations/:dest/auth-url`
- `POST /api/seller/platforms/destinations/:dest/live/create`

**/api/seller/products**
- `GET /api/seller/products`
- `POST /api/seller/products`
- `DELETE /api/seller/products/:id`
- `GET /api/seller/products/:id`
- `PUT /api/seller/products/:id`
- `GET /api/seller/products/:id/booking-slots`
- `POST /api/seller/products/:id/booking-slots`
- `DELETE /api/seller/products/:id/booking-slots/:slotId`
- `POST /api/seller/products/:id/link-to-stream`
- `GET /api/seller/products/:id/options`
- `POST /api/seller/products/:id/options`
- `PUT /api/seller/products/:id/pin`
- `POST /api/seller/products/:id/resend-store-link`

**/api/seller/profile**
- `GET /api/seller/profile`

**/api/seller/public**
- `GET /api/seller/public/:sellerId`

**/api/seller/referral-info**
- `GET /api/seller/referral-info`

**/api/seller/refresh**
- `POST /api/seller/refresh`

**/api/seller/register**
- `POST /api/seller/register`

**/api/seller/register-from-user**
- `POST /api/seller/register-from-user`

**/api/seller/request-kakao-stepup**
- `POST /api/seller/request-kakao-stepup`

**/api/seller/reset-password**
- `POST /api/seller/reset-password`

**/api/seller/set-pin**
- `POST /api/seller/set-pin`

**/api/seller/settlement-options**
- `GET /api/seller/settlement-options`

**/api/seller/settlements**
- `GET /api/seller/settlements`
- `GET /api/seller/settlements/:id/download`
- `POST /api/seller/settlements/request`
- `GET /api/seller/settlements/stats`
- `GET /api/seller/settlements/summary`

**/api/seller/stats**
- `GET /api/seller/stats`

**/api/seller/stays-amenities**
- `GET /api/seller/stays-amenities`

**/api/seller/stays-bookings**
- `GET /api/seller/stays-bookings`

**/api/seller/stays-kpi**
- `GET /api/seller/stays-kpi`

**/api/seller/stays-quota**
- `GET /api/seller/stays-quota`

**/api/seller/streams**
- `GET /api/seller/streams/`
- `POST /api/seller/streams/`
- `DELETE /api/seller/streams/:id`
- `GET /api/seller/streams/:id`
- `PUT /api/seller/streams/:id`
- `GET /api/seller/streams/:id/analytics`
- `POST /api/seller/streams/:id/change-product`
- `POST /api/seller/streams/:id/heartbeat`
- `GET /api/seller/streams/:id/live-stats`
- `PUT /api/seller/streams/:id/product-display`
- `GET /api/seller/streams/analytics/summary`

**/api/seller/switch-to-seller**
- `POST /api/seller/switch-to-seller`

**/api/seller/switch-to-user**
- `POST /api/seller/switch-to-user`

**/api/seller/tax-summary**
- `GET /api/seller/tax-summary`

**/api/seller/tier**
- `GET /api/seller/tier`

**/api/seller/tiktok**
- `GET /api/seller/tiktok/auth-url`
- `PATCH /api/seller/tiktok/badge`
- `POST /api/seller/tiktok/callback`
- `GET /api/seller/tiktok/me`
- `GET /api/seller/tiktok/seller/:id/videos`
- `POST /api/seller/tiktok/sync-videos`
- `DELETE /api/seller/tiktok/unlink`

**/api/seller/transfers**
- `GET /api/seller/transfers/`
- `POST /api/seller/transfers/:id/respond`

**/api/seller/unlink-kakao**
- `POST /api/seller/unlink-kakao`

**/api/seller/upload-image**
- `POST /api/seller/upload-image`
- `GET /api/seller/upload-image/health`

**/api/seller/verify-pin**
- `POST /api/seller/verify-pin`

**/api/seller/viewers**
- `GET /api/seller/viewers/:user_id/loyalty`

**/api/seller/voucher-catalog**
- `GET /api/seller/voucher-catalog`

**/api/seller/voucher-orders**
- `GET /api/seller/voucher-orders`

**/api/seller/voucher-redeem**
- `POST /api/seller/voucher-redeem`

**/api/seller/youtube**
- `POST /api/seller/youtube/admin/rotate-all-stream-keys`
- `GET /api/seller/youtube/auth-url`
- `GET /api/seller/youtube/channels`
- `GET /api/seller/youtube/live-readiness`
- `GET /api/seller/youtube/live/_admin-quota-dashboard`
- `POST /api/seller/youtube/live/_cleanup-pushes`
- `GET /api/seller/youtube/live/_health-check`
- `GET /api/seller/youtube/live/_quota`
- `POST /api/seller/youtube/live/_verify-whip-proxy`
- `POST /api/seller/youtube/live/:id/_force-live`
- `POST /api/seller/youtube/live/:id/admin-force-end`
- `GET /api/seller/youtube/live/:id/chat`
- `GET /api/seller/youtube/live/:id/detect-webcam`
- `GET /api/seller/youtube/live/:id/diagnose`
- `POST /api/seller/youtube/live/:id/end`
- `POST /api/seller/youtube/live/:id/end-beacon`
- `POST /api/seller/youtube/live/:id/force-transition`
- `PATCH /api/seller/youtube/live/:id/link-broadcast`
- `POST /api/seller/youtube/live/:id/notify-followers`
- `POST /api/seller/youtube/live/:id/refresh-thumbnail`
- `POST /api/seller/youtube/live/:id/reset-zombie`
- `POST /api/seller/youtube/live/:id/start`
- `GET /api/seller/youtube/live/:id/status`
- `GET /api/seller/youtube/live/:id/youtube-stats`
- `POST /api/seller/youtube/live/create`
- `POST /api/seller/youtube/live/create-webcam`
- `DELETE /api/seller/youtube/oauth/:id`
- `POST /api/seller/youtube/oauth/callback`
- `POST /api/seller/youtube/rotate-stream-key`
- `GET /api/seller/youtube/shorts/sync`
- `GET /api/seller/youtube/streaming-setup`
- `POST /api/seller/youtube/streaming-setup/init`
- `GET /api/seller/youtube/streaming/health`
- `DELETE /api/seller/youtube/streaming/whip-proxy-ome/:streamId`
- `PATCH /api/seller/youtube/streaming/whip-proxy-ome/:streamId`
- `POST /api/seller/youtube/streaming/whip-proxy-ome/:streamId`
- `DELETE /api/seller/youtube/streaming/whip-proxy/:streamId`
- `POST /api/seller/youtube/streaming/whip-proxy/:streamId`
- `POST /api/seller/youtube/streaming/whip-token`

**/api/sellers**
- `GET /api/sellers/`

**/api/sellers/:id**
- `GET /api/sellers/:id`
- `GET /api/sellers/:id/public`

**/api/sellers/:sellerId**
- `GET /api/sellers/:sellerId/products-public`
- `GET /api/sellers/:sellerId/streams`

**/api/shipping-addresses**
- `GET /api/shipping-addresses/`
- `POST /api/shipping-addresses/`

**/api/shipping-addresses/:id**
- `DELETE /api/shipping-addresses/:id`
- `PUT /api/shipping-addresses/:id`

**/api/shipping/admin**
- `POST /api/shipping/admin/bulk-tracking`
- `POST /api/shipping/admin/sync`

**/api/shipping/couriers**
- `GET /api/shipping/couriers`

**/api/shipping/order**
- `GET /api/shipping/order/:orderId/track`

**/api/shipping/track**
- `GET /api/shipping/track/:carrier/:trackingNumber`

**/api/shorts**
- `POST /api/shorts/`

**/api/shorts/:id**
- `DELETE /api/shorts/:id`
- `GET /api/shorts/:id`
- `POST /api/shorts/:id/like`
- `POST /api/shorts/:id/view`

**/api/shorts/feed**
- `GET /api/shorts/feed`

**/api/shorts/seller**
- `GET /api/shorts/seller/list`

**/api/streams**
- `GET /api/streams/`

**/api/streams/:id**
- `GET /api/streams/:id`
- `GET /api/streams/:id/current-product`
- `POST /api/streams/:id/current-product`
- `POST /api/streams/:id/fake-cart-notification`
- `GET /api/streams/:id/product-timestamps`
- `GET /api/streams/:id/products`
- `POST /api/streams/:id/restock-notify`
- `GET /api/streams/:id/viewer-count`
- `PUT /api/streams/:id/viewer-count`
- `POST /api/streams/:id/viewer/join`
- `POST /api/streams/:id/viewer/leave`

**/api/timedeal/:id**
- `GET /api/timedeal/:id`
- `POST /api/timedeal/:id/claim`

**/api/timedeal/create**
- `POST /api/timedeal/create`

**/api/timedeal/stream**
- `GET /api/timedeal/stream/:streamId`

**/api/vouchers/categories**
- `GET /api/vouchers/categories`

**/api/vouchers/confirm-toss**
- `POST /api/vouchers/confirm-toss`

**/api/vouchers/join**
- `POST /api/vouchers/join/:id`

**/api/youtube-growth/:id**
- `PUT /api/youtube-growth/:id`

**/api/youtube-growth/admin**
- `GET /api/youtube-growth/admin`

**/api/youtube-growth/confirm**
- `POST /api/youtube-growth/confirm`

**/api/youtube-growth/my**
- `GET /api/youtube-growth/my`

**/api/youtube-growth/packages**
- `GET /api/youtube-growth/packages`

**/api/youtube-growth/request**
- `POST /api/youtube-growth/request`

**/api/youtube/admin**
- `POST /api/youtube/admin/rotate-all-stream-keys`

**/api/youtube/auth-url**
- `GET /api/youtube/auth-url`

**/api/youtube/channels**
- `GET /api/youtube/channels`

**/api/youtube/chat**
- `GET /api/youtube/chat/chat/:streamId`
- `POST /api/youtube/chat/chat/:streamId`
- `GET /api/youtube/chat/chat/:streamId/cached`
- `GET /api/youtube/chat/chat/:streamId/public`

**/api/youtube/live**
- `GET /api/youtube/live/_admin-quota-dashboard`
- `POST /api/youtube/live/_cleanup-pushes`
- `GET /api/youtube/live/_health-check`
- `GET /api/youtube/live/_quota`
- `POST /api/youtube/live/_verify-whip-proxy`
- `POST /api/youtube/live/:id/_force-live`
- `POST /api/youtube/live/:id/admin-force-end`
- `GET /api/youtube/live/:id/chat`
- `GET /api/youtube/live/:id/detect-webcam`
- `GET /api/youtube/live/:id/diagnose`
- `POST /api/youtube/live/:id/end`
- `POST /api/youtube/live/:id/end-beacon`
- `POST /api/youtube/live/:id/force-transition`
- `PATCH /api/youtube/live/:id/link-broadcast`
- `POST /api/youtube/live/:id/notify-followers`
- `POST /api/youtube/live/:id/refresh-thumbnail`
- `POST /api/youtube/live/:id/reset-zombie`
- `POST /api/youtube/live/:id/start`
- `GET /api/youtube/live/:id/status`
- `GET /api/youtube/live/:id/youtube-stats`
- `POST /api/youtube/live/create`
- `POST /api/youtube/live/create-webcam`

**/api/youtube/live-readiness**
- `GET /api/youtube/live-readiness`

**/api/youtube/oauth**
- `DELETE /api/youtube/oauth/:id`
- `POST /api/youtube/oauth/callback`

**/api/youtube/rotate-stream-key**
- `POST /api/youtube/rotate-stream-key`

**/api/youtube/shorts**
- `GET /api/youtube/shorts/sync`

**/api/youtube/streaming**
- `GET /api/youtube/streaming/health`
- `DELETE /api/youtube/streaming/whip-proxy-ome/:streamId`
- `PATCH /api/youtube/streaming/whip-proxy-ome/:streamId`
- `POST /api/youtube/streaming/whip-proxy-ome/:streamId`
- `DELETE /api/youtube/streaming/whip-proxy/:streamId`
- `POST /api/youtube/streaming/whip-proxy/:streamId`
- `POST /api/youtube/streaming/whip-token`

**/api/youtube/streaming-setup**
- `GET /api/youtube/streaming-setup`
- `POST /api/youtube/streaming-setup/init`


#### 링크샵 / 큐레이터

### 도메인 코드 인벤토리 (자동) — 페이지 (13개)

- `/host`
- `/host/new`
- `/profile/:sellerId`
- `/referral`
- `/referral/:code`
- `/s/:sellerId`
- `/seller/donations`
- `/seller/mini-shop`
- `/u/:handle`
- `/u/:handle/p/:productId`
- `/u/me`
- `/u/me/earnings`
- `/user/affiliate`

### 도메인 코드 인벤토리 (자동) — API 엔드포인트 (58개)


**/api/affiliate/funnel**
- `GET /api/affiliate/funnel`

**/api/affiliate/link**
- `GET /api/affiliate/link/:type/:id`

**/api/affiliate/stats**
- `GET /api/affiliate/stats`

**/api/affiliate/top-groups**
- `GET /api/affiliate/top-groups`

**/api/affiliate/track**
- `POST /api/affiliate/track`

**/api/curator/:handle**
- `GET /api/curator/:handle`

**/api/curator/handle**
- `GET /api/curator/handle/check`

**/api/curator/me**
- `GET /api/curator/me/business`
- `POST /api/curator/me/business`
- `GET /api/curator/me/dashboard`
- `PATCH /api/curator/me/handle`
- `GET /api/curator/me/introduced-stores`
- `POST /api/curator/me/pins`
- `DELETE /api/curator/me/pins/:id`
- `PATCH /api/curator/me/pins/:id`
- `PATCH /api/curator/me/pins/reorder`
- `GET /api/curator/me/pins/stats`
- `PATCH /api/curator/me/profile`
- `POST /api/curator/me/proxy-product`
- `POST /api/curator/me/seller-upgrade-acknowledge`
- `GET /api/curator/me/withdrawal`
- `POST /api/curator/me/withdrawal`

**/api/curator/recommendations**
- `GET /api/curator/recommendations`

**/api/donation-boosters**
- `POST /api/donation-boosters/`

**/api/donation-boosters-public/live**
- `GET /api/donation-boosters-public/live/:live_stream_id`

**/api/donation-boosters/:id**
- `POST /api/donation-boosters/:id/cancel`

**/api/donations/confirm**
- `POST /api/donations/confirm`

**/api/donations/init**
- `POST /api/donations/init`

**/api/donations/stream**
- `GET /api/donations/stream/:streamId`

**/api/referral-tree/admin**
- `GET /api/referral-tree/admin/withdrawals`
- `PATCH /api/referral-tree/admin/withdrawals/:id/approve`
- `PATCH /api/referral-tree/admin/withdrawals/:id/reject`

**/api/referral-tree/calculate-commission**
- `POST /api/referral-tree/calculate-commission`

**/api/referral-tree/my-commissions**
- `GET /api/referral-tree/my-commissions`

**/api/referral-tree/my-network**
- `GET /api/referral-tree/my-network`

**/api/referral-tree/register**
- `POST /api/referral-tree/register`

**/api/referral-tree/stats**
- `GET /api/referral-tree/stats`

**/api/referral-tree/withdrawals**
- `GET /api/referral-tree/withdrawals`
- `POST /api/referral-tree/withdrawals`

**/api/referral/:code**
- `GET /api/referral/:code`

**/api/referral/create**
- `POST /api/referral/create`

**/api/referral/discount**
- `GET /api/referral/discount/:productId`

**/api/referral/join**
- `POST /api/referral/join/:code`

**/api/referral/my**
- `GET /api/referral/my`

**/api/referral/product**
- `GET /api/referral/product/:productId`

**/api/seller-public/:sellerId**
- `DELETE /api/seller-public/:sellerId/follow`
- `POST /api/seller-public/:sellerId/follow`
- `GET /api/seller-public/:sellerId/follow/preferences`
- `PATCH /api/seller-public/:sellerId/follow/preferences`
- `GET /api/seller-public/:sellerId/is-following`
- `GET /api/seller-public/:sellerId/upcoming`

**/api/seller-public/my**
- `GET /api/seller-public/my/follows`

**/api/seller-public/notify-followers**
- `POST /api/seller-public/notify-followers`

**/api/seller-public/seller**
- `GET /api/seller-public/seller/analytics`

**/api/seller/donations**
- `GET /api/seller/donations`
- `GET /api/seller/donations/settlements`
- `POST /api/seller/donations/settlements`
- `GET /api/seller/donations/summary`


#### 에이전시

### 도메인 코드 인벤토리 (자동) — 페이지 (53개)

- `/a/:slug`
- `/admin/agencies`
- `/admin/agency-creator-approval`
- `/admin/castings`
- `/admin/influencer-disputes`
- `/admin/influencer-payouts`
- `/agency`
- `/agency-partner`
- `/agency/calendar`
- `/agency/campaigns`
- `/agency/compare`
- `/agency/contracts`
- `/agency/coupons`
- `/agency/events`
- `/agency/forgot-password`
- `/agency/group-buy`
- `/agency/guide`
- `/agency/incentives`
- `/agency/introduced-stores`
- `/agency/invites`
- `/agency/ledger`
- `/agency/login`
- `/agency/match-suggestions`
- `/agency/members`
- `/agency/messages`
- `/agency/notices`
- `/agency/orders`
- `/agency/pk`
- `/agency/profile`
- `/agency/promote-boosts`
- `/agency/prospects`
- `/agency/ranking`
- `/agency/register`
- `/agency/register/business`
- `/agency/reset-password`
- `/agency/returns`
- `/agency/schedule`
- `/agency/sellers`
- `/agency/sellers/:sellerId/products`
- `/agency/settlements`
- `/agency/stats`
- `/agency/stays`
- `/agency/streams`
- `/agency/targets`
- `/agency/transfers`
- `/agency/waiting`
- `/influencer`
- `/influencer/analytics`
- `/influencer/discover`
- `/influencer/rankings`
- `/influencer/settlement`
- `/seller/castings`
- `/seller/prospects`

### 도메인 코드 인벤토리 (자동) — API 엔드포인트 (166개)


**/api/admin-payouts/disputes**
- `GET /api/admin-payouts/disputes`
- `POST /api/admin-payouts/disputes/:id/resolve`

**/api/admin-payouts/payouts**
- `GET /api/admin-payouts/payouts`
- `POST /api/admin-payouts/payouts/process`

**/api/admin/agencies**
- `GET /api/admin/agencies/`
- `POST /api/admin/agencies/`
- `DELETE /api/admin/agencies/:id`
- `PATCH /api/admin/agencies/:id`
- `POST /api/admin/agencies/:id/reset-password`
- `GET /api/admin/agencies/:id/sellers`
- `POST /api/admin/agencies/:id/sellers`
- `DELETE /api/admin/agencies/:id/sellers/:sellerId`
- `GET /api/admin/agencies/unassigned-sellers`

**/api/admin/agency-creator-approvals**
- `GET /api/admin/agency-creator-approvals/`
- `GET /api/admin/agency-creator-approvals/:id`
- `POST /api/admin/agency-creator-approvals/:id/approve`
- `POST /api/admin/agency-creator-approvals/:id/reject`

**/api/admin/castings**
- `GET /api/admin/castings/`
- `POST /api/admin/castings/`
- `PATCH /api/admin/castings/:id/complete`

**/api/agency-public/:slug**
- `GET /api/agency-public/:slug`

**/api/agency/calendar**
- `GET /api/agency/calendar/`
- `DELETE /api/agency/calendar/notes/:id`
- `PATCH /api/agency/calendar/notes/:id`
- `POST /api/agency/calendar/notes/:id/mark-read`
- `GET /api/agency/calendar/streams/:id`
- `POST /api/agency/calendar/streams/:id/notes`

**/api/agency/campaigns**
- `GET /api/agency/campaigns/`
- `POST /api/agency/campaigns/`
- `GET /api/agency/campaigns/:id`
- `PATCH /api/agency/campaigns/:id`
- `POST /api/agency/campaigns/:id/cancel`
- `POST /api/agency/campaigns/:id/participants`
- `DELETE /api/agency/campaigns/:id/participants/:sid`
- `PATCH /api/agency/campaigns/:id/participants/:sid`
- `POST /api/agency/campaigns/:id/refresh`

**/api/agency/contracts**
- `GET /api/agency/contracts`
- `POST /api/agency/contracts`
- `PUT /api/agency/contracts/:id`

**/api/agency/coupons**
- `POST /api/agency/coupons/distribute`
- `GET /api/agency/coupons/distributions`
- `GET /api/agency/coupons/distributions/:parentId/stats`

**/api/agency/dashboard**
- `GET /api/agency/dashboard/bundle`

**/api/agency/forgot-password**
- `POST /api/agency/forgot-password`

**/api/agency/incentives**
- `GET /api/agency/incentives/payouts`
- `GET /api/agency/incentives/preview`
- `GET /api/agency/incentives/rules`
- `POST /api/agency/incentives/rules`
- `DELETE /api/agency/incentives/rules/:id`
- `PATCH /api/agency/incentives/rules/:id`

**/api/agency/intro-code**
- `GET /api/agency/intro-code`

**/api/agency/introduced-stores**
- `GET /api/agency/introduced-stores`
- `GET /api/agency/introduced-stores/commissions`
- `GET /api/agency/introduced-stores/summary`

**/api/agency/invite-seller**
- `POST /api/agency/invite-seller`

**/api/agency/invites**
- `GET /api/agency/invites/`
- `POST /api/agency/invites/`
- `DELETE /api/agency/invites/:code`

**/api/agency/kakao-link-status**
- `GET /api/agency/kakao-link-status`

**/api/agency/kpi**
- `GET /api/agency/kpi/`

**/api/agency/link-kakao**
- `POST /api/agency/link-kakao`

**/api/agency/login**
- `POST /api/agency/login`

**/api/agency/match-suggestions**
- `GET /api/agency/match-suggestions`
- `POST /api/agency/match-suggestions/:id/accept`
- `POST /api/agency/match-suggestions/:id/decline`

**/api/agency/members**
- `GET /api/agency/members/`
- `DELETE /api/agency/members/:id`
- `PATCH /api/agency/members/:id`
- `POST /api/agency/members/:id/reactivate`
- `POST /api/agency/members/:id/suspend`
- `POST /api/agency/members/accept`
- `POST /api/agency/members/invite`

**/api/agency/messages**
- `POST /api/agency/messages/preview`
- `POST /api/agency/messages/send`
- `GET /api/agency/messages/sends`
- `GET /api/agency/messages/templates`
- `POST /api/agency/messages/templates`
- `DELETE /api/agency/messages/templates/:id`
- `PATCH /api/agency/messages/templates/:id`
- `GET /api/agency/messages/variables`

**/api/agency/monthly-tasks**
- `GET /api/agency/monthly-tasks`

**/api/agency/my-agency-status**
- `GET /api/agency/my-agency-status`

**/api/agency/notices**
- `GET /api/agency/notices`
- `POST /api/agency/notices`

**/api/agency/notifications**
- `GET /api/agency/notifications`
- `PUT /api/agency/notifications/read-all`

**/api/agency/orders**
- `GET /api/agency/orders`

**/api/agency/pin-status**
- `GET /api/agency/pin-status`

**/api/agency/pk**
- `GET /api/agency/pk/`
- `POST /api/agency/pk/`
- `POST /api/agency/pk/:id/cancel`
- `POST /api/agency/pk/:id/start`

**/api/agency/profile**
- `GET /api/agency/profile`
- `PUT /api/agency/profile`

**/api/agency/promote-boosts**
- `GET /api/agency/promote-boosts/`
- `POST /api/agency/promote-boosts/`

**/api/agency/public-profile**
- `GET /api/agency/public-profile/me/public`
- `PATCH /api/agency/public-profile/me/public`

**/api/agency/ranking**
- `GET /api/agency/ranking`

**/api/agency/register**
- `POST /api/agency/register`

**/api/agency/register-from-user**
- `POST /api/agency/register-from-user`

**/api/agency/report**
- `GET /api/agency/report/csv`

**/api/agency/request-kakao-stepup**
- `POST /api/agency/request-kakao-stepup`

**/api/agency/reset-password**
- `POST /api/agency/reset-password`

**/api/agency/returns**
- `GET /api/agency/returns`

**/api/agency/schedule**
- `GET /api/agency/schedule`

**/api/agency/self-events**
- `GET /api/agency/self-events/`
- `POST /api/agency/self-events/`
- `POST /api/agency/self-events/:id/cancel`
- `POST /api/agency/self-events/:id/join`
- `GET /api/agency/self-events/:id/leaderboard`

**/api/agency/sellers**
- `GET /api/agency/sellers`
- `GET /api/agency/sellers/:id/inventory`
- `GET /api/agency/sellers/:id/products`
- `POST /api/agency/sellers/:id/products`
- `PUT /api/agency/sellers/:id/products/:productId`
- `GET /api/agency/sellers/:id/stats`
- `POST /api/agency/sellers/:id/streams`
- `GET /api/agency/sellers/compare`

**/api/agency/set-pin**
- `POST /api/agency/set-pin`

**/api/agency/settlement-invoices**
- `GET /api/agency/settlement-invoices`
- `GET /api/agency/settlement-invoices/:id`

**/api/agency/settlements**
- `GET /api/agency/settlements`
- `GET /api/agency/settlements/csv`
- `POST /api/agency/settlements/request`

**/api/agency/stats**
- `GET /api/agency/stats`
- `GET /api/agency/stats/batch`
- `GET /api/agency/stats/daily`
- `GET /api/agency/stats/kpi`
- `GET /api/agency/stats/kt-alpha`
- `GET /api/agency/stats/realtime`

**/api/agency/stays**
- `GET /api/agency/stays`
- `GET /api/agency/stays/bookings`
- `GET /api/agency/stays/kpi`

**/api/agency/streams**
- `GET /api/agency/streams`

**/api/agency/targets**
- `GET /api/agency/targets`
- `PUT /api/agency/targets`

**/api/agency/transfers**
- `GET /api/agency/transfers/`
- `POST /api/agency/transfers/`
- `POST /api/agency/transfers/:id/cancel`
- `POST /api/agency/transfers/:id/respond`
- `POST /api/agency/transfers/:id/seller-approve`

**/api/agency/unlink-kakao**
- `POST /api/agency/unlink-kakao`

**/api/agency/verify-pin**
- `POST /api/agency/verify-pin`

**/api/influencer-discover/products**
- `GET /api/influencer-discover/products`

**/api/influencer-rankings**
- `GET /api/influencer-rankings/`

**/api/influencer-settlement/analytics**
- `GET /api/influencer-settlement/analytics`

**/api/influencer-settlement/deals**
- `POST /api/influencer-settlement/deals/propose`

**/api/influencer-settlement/disputes**
- `POST /api/influencer-settlement/disputes`

**/api/influencer-settlement/me**
- `GET /api/influencer-settlement/me`
- `PUT /api/influencer-settlement/me`

**/api/influencer-settlement/my-rank**
- `GET /api/influencer-settlement/my-rank`

**/api/influencer-settlement/my-stores**
- `GET /api/influencer-settlement/my-stores`

**/api/pk-public/live**
- `GET /api/pk-public/live/:live_id`

**/api/seller-marketing/block**
- `POST /api/seller-marketing/block`

**/api/seller-marketing/deals**
- `GET /api/seller-marketing/deals`
- `POST /api/seller-marketing/deals/:id/respond`
- `POST /api/seller-marketing/deals/propose`

**/api/seller-marketing/me**
- `GET /api/seller-marketing/me`

**/api/seller-marketing/realtime-stats**
- `GET /api/seller-marketing/realtime-stats`

**/api/seller-marketing/toggle**
- `POST /api/seller-marketing/toggle`

**/api/seller-marketing/unblock**
- `POST /api/seller-marketing/unblock`

**/api/seller/castings**
- `GET /api/seller/castings/`
- `POST /api/seller/castings/:id/respond`

**/api/seller/promote-boosts**
- `GET /api/seller/promote-boosts/`
- `POST /api/seller/promote-boosts/:id/activate`



> 마지막 생성: 2026-06-08T02:01:43.553Z
> 생성기: `scripts/generate-proposal-refs.mjs`

<!-- AUTO-GENERATED:proposal-refs END -->
