# 유어딜 플랫폼 모델 (UR Deal Platform Model) — 마스터 SSOT

> 작성: 2026-07-02 · 출처: 대표 지시 ("링크샵뿐 아니라 유어딜 전반의 모든 것을 고려해 최대한 빠짐없이")
> 상태: **설계/전략 SSOT (살아있는 문서)** · 새 세션은 이 문서로 전체 그림을 잡는다.
> ⚠️ **모든 수치(%·기간·금액)는 "기본값"이며 어드민 대시보드(`platform_settings` 등)에서 언제든 조정 가능.** 이 문서는 *구조와 관계*를 고정하고, *값*은 고정하지 않는다.
> 🔗 링크샵 상세 드릴다운은 [linkshop-role-model.md](./linkshop-role-model.md).

---

## 0. 설계 원칙 (전 서비스 공통)

1. **역할이 표현을 정하고, 경제 엔진은 공통(stack)** — 한 사람이 여러 모자를 써도 각 행위(추천/판매/영입/구매)가 독립적으로 적립·정산된다.
2. **수치는 데이터, 구조는 코드** — 요율/기간/한도는 `platform_settings`에서 주입(어드민 조정). 코드엔 *기본값(박제)*만.
3. **서비스 3분리 절대** — 유어딜 공구(소비자) · 도매몰(유통스타트 B2B) · 유어애즈(마케팅). 한쪽 작업이 다른 쪽에 새지 않게 (플래그·네임스페이스 격리).
4. **모든 클릭은 거래로 수렴** — "죽은 클릭"(담았는데 안 보이는 핀, 유도했는데 막다른 골목) 0. 발견→어트리뷰션→전환→정산 루프가 끊기지 않게.
5. **신뢰가 전환을 만든다** — 사업자 인증·전자상거래법 표시·안전결제(에스크로)·투명 정산이 소비자 신뢰의 토대.

---

## 1. 서비스 지도 (3-서비스)

| 서비스 | 정체성 | 행위자 | 도메인 | 코드 경계 |
|---|---|---|---|---|
| **🎟️ 유어딜 공구** (소비자) | 공동구매·이용권·교환권·동네딜·쇼핑 (딜포인트/결제) | 유저·인플루언서·매장 업주·에이전시·운영 | `live.ur-team.com` | `features/{group-buy,community-group-buy,curator,products,vouchers,...}` |
| **🏭 도매몰** (유통스타트) | 제조사→판매사 B2B 도매 (도매가/예치금/정산) | 제조사·판매사·도매 어드민 | `utongstart.com` | `features/supply/**`, `pages/wholesale*`, `pages/supplier-dashboard` |
| **📣 유어애즈** (마케팅) | 광고·자동입찰·부정클릭방지·통합실적 | 광고주(매장/셀러)·운영 | `/ads` | `features/marketing`, urads-* 문서 |

> 이 문서의 **주 대상은 유어딜 공구(소비자)**. 도매몰·유어애즈는 인접 서비스로 §12에서 관계만 정리(각자 별도 SSOT 문서 보유).

---

## 2. 행위자 전체 매트릭스 (누가 · 무엇을 · 무엇으로 성과)

### 2-1. 소비자 서비스 행위자

| 행위자 | 정의(코드 실체) | 핵심 Job | 성과 지표 | 경제(기본값·어드민 조정) |
|---|---|---|---|---|
| **일반 유저** | 회원가입 누구나 (`users`+handle, 링크샵 자동생성) | 딜 발견·구매, 친구 추천/초대 | 딜 적립·절약, 초대·추천 수익 | 핀 어필리에이트 **2%** · 초대 보상 **1,000딜**(첫 구매) |
| **인플루언서** | 판매승인 셀러 `seller_type='influencer'` | 팔로워에 **추천**·매장 **영입** | 추천 클릭→구매 커미션, 영입 매장 매출 | 추천 2% · 매장영입 **1.5%**(성숙 T+7, 원천징수 후) |
| **매장 업주** | 사업자 유저 `seller_type='store_owner'` | **본인 상품/이용권** 판매 | 판매액·현금 정산 | 판매 플랫폼 수수료 **3P 5%**(이용권/쇼핑), **1P 0%**(유어딜 직판) |
| **에이전시** | `agencies` (B2B 조직) | 여러 매장 관리·영입·성장 | 관리 매장 GMV rollup, 영입 커미션 | 영입 가게 GMV **1%**(플랫폼분에서), **24개월** 한도, 실판매 시만 |
| **유어딜 운영** | 플랫폼(`admin`) | 4부류가 다 거래하게 + 정합·신뢰 | 총 GMV × take rate | 판매 5% + 후원 **15%** + 충전 마진 |

> **능력 레이어 모델**: 유저 →(사업자등록·판매승인)→ 사업자 유저. 같은 `/u/{handle}`에 기능이 *레이어로 추가*(신분 교체 아님). `seller_type`은 `influencer | store_owner | both`.
> **원천징수**: 사업소득 3.3% / 기타소득 8.8% (`tax-withholding.ts`) — 커미션 지급 시.
> **라이브커머스 영구중단**(`LIVE_COMMERCE_SUSPENDED`) → 인플루언서 주 수익축 = **추천·영입**(방송 아님).

### 2-2. 도매(B2B) 행위자 — §12 참조
- **판매사** (도매가로 사입해 재판매, `sellers.is_distributor=1`)
- **제조사** (도매몰에 상품 공급, suppliers)
- **도매 어드민** (`admin role='wholesale'`)

---

## 3. 상품·콘텐츠 종류 (소비자)

| 종류 | 정의 | 식별 | 라우트 | 경제 |
|---|---|---|---|---|
| **이용권** | 할인가로 즉시 구매 → 매장에서 QR/PIN 사용 (식사·미용·숙박·액티비티) | `category ∈ {meal,beauty,stay,etc}_voucher` | `/vouchers`, `/vouchers/:id` | 3P 5% |
| **교환권** | 기프티콘·KT 등 즉시 교환권 | `deal_only=1` | `/vouchers`(딜only), 카탈로그 | 3P 5% / 공급자 정산 |
| **동네딜** | 내 주변 로컬 공동구매 딜 (지도+리스트) | 지역태그 + voucher category | `/group-buy`, `/restaurant-map`(홈 `/`) | 3P 5% |
| **공동구매(공구)** | 즉시판매 단일가 모델(이름만 공구, 최대 tier 할인 즉시적용) | `group_buy_*` | `/group-buy/:id` | 3P 5% |
| **커뮤니티 공구** | 유저 제안형 공동구매 (수요신호) | `community-group-buy` | `/community-group-buy/*` | — |
| **일반 상품(쇼핑)** | 일반 이커머스 상품 | `exclude_deal_only` | `/browse`, `/products/:id` (탭 잠정숨김 `SHOPPING_TAB_HIDDEN`) | 3P 5% / 1P 0% |
| **숙소(stays)** | 날짜 캘린더 예약형 | `stays` | `/stays`, `/stays/:id` | reserve-before-charge |
| **디지털** | 다운로드/코드형 (보관함 발급) | `digital` | `/my/digital` | — |
| **선물(gifts)** | 교환권 선물하기 | `gifts` | `/gift/claim/:token` | — |
| **경매/펀딩/타임딜** | 보조 커머스 메커니즘 | `auction`/`funding`/`timedeal` | — | — |

> ⚠️ **종류 판별 SSOT**: `deal_only===1`(교환권) + `isVoucherCategory(category)`(이용권). `group_buy_status`로 종류 판별 금지(수명주기 전용).
> 🏷️ **명칭 SSOT**: 이용권(구 식사권/공구권 폐기) · 교환권 · 동네딜 · 유저/사업자 유저. "인플루언서/큐레이터/셀러"는 코드 식별자로만, 사용자-가시엔 유저/사업자 유저.

---

## 4. 표면(라우트) 지도 — 행위자별

### 소비자 (다크/화이트 테마)
- **발견**: `/`(동네딜 지도) · `/vouchers`(이용권+쇼핑) · `/group-buy`(동네딜) · `/browse`(쇼핑,숨김) · `/search` · `/blog` · **`/local/:code`(상권관 — B2G 상권 패키지 지역 랜딩, 2026-07-04)**
- **상세/구매**: `/vouchers/:id` · `/group-buy/:id` · `/products/:id` · `/stays/:id` · `/checkout` · `/points/charge`
- **링크샵**: `/u/:handle`(단일화) · `/u/me`(본인) · `/u/me/add`(핀 추가) · `/u/me/earnings` · `/profile/:username`·`/s/:id`(셀러 공개)
- **마이**: `/user/profile` · `/my-vouchers`(지갑) · `/my-orders` · `/my-deal-history` · `/my-commissions` · `/notifications` · `/account/settings`
- **성장**: `/referral` · `/g/:invite_code` · `/influencer/*`(랭킹·정산·발굴)

### 사업자 유저(셀러 대시보드, 라이트 고정)
- `/seller`(홈) · `/seller/products/new` · `/seller/meal-voucher/new` · `/seller/orders` · `/seller/business-info`(사업자정보·통신판매업) · `/seller/guide`

### 에이전시 / 운영 / 도매
- `/agency/*`(관리·영입·정산) · `/admin/*`(운영 콘솔) · `/wholesale/*`·`/supplier/*`(도매)

---

## 5. 경제 엔진 (Money Flows) — 전부 어드민 조정 기본값

### 5-1. 딜포인트
- **충전**: 1원 = 1딜 (수수료 없음). 고액 패키지(5/10/20만) 권장 — PG 수수료(~2.5%) 흡수 위해 결제 횟수↓.
- **사용**: 후원·상품결제·이용권 구매 시 즉시 차감 (`adjustUserPoints` CAS guardBalance).
- **최소 후원**: 500딜 · **후원 수수료**: 15%.
- **유상/무상 이중 버킷** (2026-07-05, 약관 강제 — SSOT `worker/utils/point-buckets.ts`):
  `user_points.balance`=총액 · `free_balance`=무상(가입/초대/광고/리뷰/이벤트/어드민 선물 등 리워드) · 유상=차액(파생).
  차감은 전 경로 **무상 우선 소진**, **현금 환급(출금)은 유상 한도**(무상 딜 인출 불가 — 전금법 유상 잔액 산출 근거),
  환불은 원장(`point_transactions.free_delta`) 역산으로 **원 버킷 대칭 복원**. 커미션성 소득(어필리에이트/추천 수익)은 유상.
- **상권 방문 리워드** (2026-07-05, B2G 상권 패키지 — SSOT `worker/utils/visit-reward.ts`): 캠페인(상권 지역코드·기간·
  지급액·총액 캡) 단위로 그 상권 매장 상품 **첫 구매 확정** 시 무상 딜 1인 1회 지급(UNIQUE claim 멱등 · 캡 도달 자동 종료
  +어드민 알림 · 환불 시 회수). 트리거: group-buy `/join`·`/confirm-toss`. 어드민 `/admin/visit-rewards`.

### 5-2. 판매 정산 (사업자 유저)
- **플랫폼 수수료**: **3P(남의 상품, 이용권+쇼핑) 5%** / **1P(유어딜 직판) 0%** (`fee-resolver.ts` SSOT, `product-ownership-model.md`).
- 셀러별 `sellers.commission_rate` 개별 조정 가능.
- 정산 성숙(hold) 후 지급, 이용권은 **매장 발송/사용 확인 게이트**.

### 5-3. 성장 커미션 (stack — 동시 적립)
| 커미션 | 대상 | 기본율 | 조건/성숙 | 역전 |
|---|---|---|---|---|
| **어필리에이트(추천/핀)** | 추천한 유저·인플루언서 | 2% (CAC라 낮춤, 0 가능) | 주문 confirm, order_id 멱등 | 환불 시 clawback |
| **매장영입(인플루언서)** | 매장 영입한 크리에이터 | 1.5% | 매 결제, T+7 성숙, 원천징수 | `reverseInfluencerStoreIntroOnRefund` |
| **매장영입(에이전시)** | 영입 에이전시 | 1% (플랫폼 5%에서) | 실판매 시만, 24개월 한도 | 대칭 역전 |
| **공급자(도매)** | 공급 상품 공급자 | 공급가 | 즉시(D2), order_id 멱등 | `reverseSupplierOnRefund` |
| **초대 보상** | 초대한 유저 | 1,000딜 | 피초대자 첫 구매, UNIQUE claim | — |

> **머니 룰**(코드 작성 시 필수): ① Claim-before-credit(CAS 선점) ② 적립-역전 대칭(같은 commit) ③ 멱등=UNIQUE+INSERT OR IGNORE ④ status 플립≠취소(환불 경유). 자세히는 CLAUDE.md "💸 머니/정합성".
>
> 💸 **[INV-CB] 커미션 예산 캡 (2026-07-04 대표 확정 — "수수료율 동결, 재원 구조 수정")**: 위 커미션 중
> **플랫폼 부담 비례(%) 커미션**(어필리에이트·멀티티어 추천트리·크리에이터 영입·에이전시 영입)의 총합은
> 3P 주문당 **예산 = 플랫폼 수수료 − PG 준비금(`pg_reserve_pct`)** 을 초과할 수 없다(초과 시 비례 축소) —
> 어떤 3P 거래도 커미션 때문에 플랫폼 마이너스가 구조적으로 불가. 오케스트레이터 `order-commissions.ts`
> `creditOrderCommissions`(confirm/webhook 공용 진입점) 가 단일 배분자이고, 우회는 `check-commission-budget` 가드가 차단.
> 정액 보상(초대 1,000딜·에이전시 signup ₩30,000)은 거래 캡 밖 → **월 예산 캡**(`invite_reward_monthly_budget_krw` /
> `agency_signup_bonus_monthly_budget_krw`). 어필리에이트 재원은 `promo_funding_source`('platform' 기본 / 'owner')
> 스위치로 **주인(셀러) 부담(promo 슬라이스)** 이전 가능 — 'owner' 면 추천인 딜 적립은 유지하되 같은 금액을
> 주인 정산에서 차감(이용권=사용 시 원장 debit, 쇼핑=원장 fee 합산, 환불 역전 대칭). 게이트
> `commission_budget_enabled` 기본 OFF(=현행) — staging 실결제 검증 후 활성. 설계: `commission-funding-restructure.md`.

### 5-4. 결제 (Toss V2)
- 모든 confirm은 `confirmTossPayment()` 게이트웨이 경유(직접 fetch 금지). circuit breaker·idempotency·금액검증 자동.
- 확정 경로 2개(브라우저 `/confirm` + webhook) — side-effect는 CAS로 단일실행 보장(재고·커미션·발송 이중실행 0).

---

## 6. 성장 루프 (Growth Loops)

1. **추천 루프**: 유저/인플루언서가 상품 상세의 **"+" 핀**으로 링크샵에 담음 → 공유 → 클릭 `?aff=` 어트리뷰션 → 구매 시 어필리에이트 2% 적립. (링크샵 = 수요 캡처 표면)
2. **영입 루프**: 인플루언서/에이전시가 매장을 유어딜에 **영입** → 그 매장 매 결제마다 영입자 커미션(지속·시한부). 공급 확장.
3. **초대 루프**: 유저 초대 링크 `/g/:invite_code` → 피초대자 첫 구매 시 양쪽 보상.
4. **수요신호 루프**: 커뮤니티 공구 제안 → 어드민 알림 → 확정 시 참여자 전원 알림. (없는 상품을 유저가 끌어옴)
5. **SEO/공유 루프**: 링크샵·블로그·공구 상세 서버측 OG/JSON-LD → 카톡/네이버/구글 유입 → 재유통.

---

## 7. 링크샵 역할 모델 (요약 — 상세: linkshop-role-model.md)

- **링크샵을 "소유"하는 건 3부류**(유저·인플루언서·매장 업주). 에이전시·운영은 rollup 뒷단.
- **역할 적응형 2모드**:
  - **큐레이터 모드**(본인 상품 없음): 추천(핀)이 hero.
  - **스토어프론트 모드**(본인 상품 있음): 내 상품 hero + 추천 **하단 opt-in** 섹션.
- **"+" 핀 버튼**은 모두 유지, 담으면 항상 어딘가 노출(막다른 골목 제거) + 매장은 안내 토스트.
- 경제 엔진 stack → 한 링크샵에서 판매+추천+영입 동시 수익 가능(운영 GMV 최대).

---

## 8. 신뢰 · 컴플라이언스

- **사업자 인증 배지**(이름 옆 U) → 탭하면 "사업자 인증이 된 유저" 설명(구현 완료).
- **전자상거래법 표시**: 링크샵 하단 "MORE INFO" 푸터(상호·대표·사업자번호[+공정위 확인 링크]·통신판매업신고번호·주소). 구현 완료.
- **원천징수**: 커미션 지급 시 사업소득 3.3%/기타 8.8% (`withholdAndLog`).
- **개인정보(PIPA)**: 셀러 전화·이메일 공개 제외. **카카오 OAuth**: safeRedirect·state CSRF·토큰 암호화·iOS 쿠키 영속(fragment/session establish).
- **안전결제/에스크로**: 동네딜 사용처리 = 매장원장+정산검문(`dongnedeal-redemption.md`).

---

## 9. 데이터 모델 핵심 (SSOT: `src/shared/db/production-schema.ts`)

- `users`(유저+handle+bio) · `sellers`(seller_type·is_distributor·commission_rate) · `agencies` · `suppliers`
- `products`(is_supply_product·deal_only·category — **컬럼 추가 금지, 예산제** → `product_supply_meta` K-V) · `product_pins`(핀) · `pin_click_logs`
- `orders`(status 대문자/payment_status 소문자) · `order_fee_breakdown` · `affiliate_earnings` · `influencer_attributions` · `seller_business_info`(mail_order_number)
- `platform_settings`(**요율 SSOT** — 어드민 조정) · `point_ledger` · `voucher_orders`

---

## 10. 기술 아키텍처 (요약)

- **배포**: Cloudflare Pages 단일(`_worker.js`) · `npm run build`(client+worker+prepare) · feature push → 훅이 main 자동머지 → Actions 배포.
- **로딩 최적화(잠금)**: SSR 0-RTT inject(`__SSR_INITIAL_*__`) · edge cache(`caches.default`) · KV write 최소 · 단일 URDEAL 로더 · 청크 자가복구.
- **인증**: 카카오 세션 쿠키(한국) · 역할 토큰 fragment 전달 · Firebase optimistic(해외).
- **자동 방어선**: pre-commit + `verify.yml` + `audit-gate.sh`(41 불변식) — 서비스분리·머니패턴·스키마·테마·i18n·파일크기 등 기계 강제.

---

## 11. 로드맵 (단계별 — 링크샵 역할 모델 기준)

| 단계 | 내용 | 리스크 |
|---|---|---|
| **1** | ✅ 완료(2026-07-04) — 매장 링크샵 하단 "추천" opt-in 부활 + 핀 담기 토스트 + 오너 토글(기본 off) | 낮음 |
| **2** | 링크샵 모드 자동 전환(본인 상품 유무 → 큐레이터↔스토어프론트) | 중 |
| **3** | 에이전시 매출 rollup 대시보드(관리 매장 GMV/정산 집계) | 중 |
| **4** | 부류별 온보딩 분기("추천할래요/팔래요" 초기 모드 힌트) | 낮음 |
| **5** | 정산 단일화(payout SSOT)·머니이동 정합 (`settlement-reconciliation.md`) | 중·대표 결정 |

---

## 12. 인접 서비스 관계 (도매몰 · 유어애즈)

- **도매몰(유통스타트)**: 제조사가 공급한 상품을 **판매사**가 사입 → *소비자 유어딜에서 재판매*하면 그 판매는 소비자 정산 엔진을 탐(공급자 정산 stack). 공유 테이블은 `is_supply_product`/`is_distributor` 플래그로 격리. 상세: `wholesale-*.md`.
- **유어애즈**: 매장/셀러가 광고비로 유어딜 내 노출 구매 → GMV 부스트. 자동입찰·부정클릭방지. 상세: `urads-*.md`.
- **크로스 결정 대기**: 유어애즈×유어딜 판매채널 번들(`urads-yourdeal-channel-bundle.md`).

---

## 13. 열린 결정사항 (대표 확인 필요)

1. **매장 "추천" 섹션 기본값**: off(직접 켜야) vs on? (정체성 보수적이면 off 권장)
2. **인플루언서 본인 상품 판매 허용 범위**(both 모드 육성?)
3. **에이전시 rollup 착수 시점**: 지금 vs 링크샵 3부류 먼저?
4. **정산 단일화**(payout SSOT·정산신청 폐기) 머니이동 정책 — staging 검증 동반.
5. **1P/3P·에이전시 요율 cutover**(3P 10→5%·에이전시 2→1%) 결제 배선 gated — 대표 승인+staging (`product-ownership-model.md`).
6. **쇼핑탭 재오픈** 시점(`SHOPPING_TAB_HIDDEN`) · 도매몰·유어애즈 소비자 노출 전략.

---

# Part II — 시스템 상세 (Deep Dive)

> Part I 이 "구조/관계"라면, Part II 는 실제 동작하는 서브시스템의 상세. 코드 변경 시 해당 섹션 갱신.

## 14. 인증·세션 시스템

### 14-1. 토큰/세션 모델 (역할별 독립·병렬)
소비자와 각 대시보드 역할은 **독립 토큰**을 병렬 보관 → **이중 로그인** 지원(한 기기에서 소비자+셀러+어드민 동시).

| 역할 | localStorage 키 | 서버 세션(httpOnly) | 만료/갱신 |
|---|---|---|---|
| 소비자(유저) | `user_id`·`user_type`·`session_login`·`active_role` | `ur_session`(카카오) | 세션쿠키 + `/session/establish` 재발급 |
| 사업자 유저(셀러) | `seller_token`(JWT 30일)·`seller_refresh_token`·`seller_id`·`seller_username` | `ud_seller_token` | `useTokenAutoRefresh('seller')` |
| 에이전시 | `agency_token`·`agency_refresh_token` | `ud_agency_token` | 동일 |
| 어드민 | `admin_token`·`admin_refresh_token` | — | 동일 |
| 도매(공급자) | `ud_supplier_token` | 쿠키 | — |

### 14-2. 로그인 플로우
- **카카오(소비자)**: OAuth → `state` CSRF + `safeRedirect` → 콜백. **iOS 쿠키 미영속** 대응: 세션은 fragment(`#st=`) 티켓 → same-origin `POST /api/auth/session/establish` 로 `ur_session` 200-발급 / 역할토큰은 fragment(`#auth=`, `pending-auth.ts`). 302 Set-Cookie 의존 금지.
- **연결 역할 자동발급**: `issueLinkedRoleTokens(DB, jwtSecret, userId)` — `sellers.linked_user_id = userId` (status active/approved) → `seller_token`(30일) 발급. agency 동일. **pending/suspended 는 미발급**. → 사업자 유저는 카카오 로그인 한 번에 셀러 토큰까지.
- **same-email 자동연결**: `KakaoAuthService.upsertUser` 가 `email_verified` + `LOWER(email)=LOWER(?)` + COUNT≤1(모호성 게이트)일 때만 미연결 셀러를 링크(takeover 방어).
- **대시보드 직접 로그인**: `/seller/login`·`/admin/login`·`/agency/login` (이메일/비번 또는 카카오) → 해당 역할 JWT+refresh.

### 14-3. 로그아웃
- `logout(type?)`: type 지정 시 **부분**(해당 역할 쿠키+localStorage), 미지정 시 **전체**. 서버 `clearServerSessionCookies()` 를 **await**(레이스 제거) — 안 지우면 `ur_session` 잔존 → `/api/auth/me` 재인증으로 로그아웃 실패(2026-06-29 근본수정).
- 계정 전환(다른 user.id 로그인): 이전 계정 역할 토큰·핸들 wipe 후 새 응답에서 재설정.

### 14-4. 게이트 (ProtectedRoute)
- `requireSeller`/`requireAdmin`: 해당 토큰 **존재 + JWT exp 유효**(2026-07-02 P1b) 검사. 만료+refresh불가면 로그인으로. `requireUser`: `user_id`/`session_login`.
- **이중 세션 원칙**: `user_type`은 DISPLAY 용. 게이트는 각 역할 토큰만 봄(한쪽 로그인이 다른쪽 자동 로그아웃 유발 금지).

### 14-5. 알려진 취약점 (auth-product-registration-audit)
- **P1(부분수정 2026-07-02)**: 소비자앱 체류 중 seller_token 미갱신 → App 전역 refresh 로 보강. 게이트 exp 검사 추가.
- **P2(✅ 해결 2026-07-04)**: 연결 셀러인데 seller_token 만료/부재 → `/seller/login` 튕김 → **자가치유 구현**: `POST /api/auth/reissue-role-tokens`(requireAuth 소비자 세션 → `issueLinkedRoleTokens` 재사용, rate limit 10/분) + RouteGuards `RoleTokenSelfHeal`(게이트 실패 시 소비자 세션 있으면 1회 재발급 후 통과, 실패 시 기존과 동일 로그인 이동). 잠금 불변식(토큰 존재/exp 검사) byte-불변.
- **UX**: 링크샵(모바일) → 상품등록 = 셀러 대시보드 풀폼 점프. 경량 바텀시트 등록 미구현.

## 15. 결제·정산 시스템

### 15-1. 결제 (Toss V2)
- **게이트웨이 SSOT** `toss-gateway.ts`: `confirmTossPayment`/`cancelTossPayment` — circuit breaker·idempotency-key·금액검증·에러코드(~100) 표준화. **직접 fetch 금지**.
- **확정 경로 2개**: ① 브라우저 `POST /api/payments/confirm` ② Toss `webhook`. **CAS(confirmClaim/confirmPaymentAtomic)로 단일실행 보장** → 재고차감·커미션·발송·딜차감 이중실행 0(winner만 side-effect).
- **확정 side-effect**(waitUntil): 재고차감 → 어필리에이트/영입/공급자 커미션 적립 → 셀러/buyer 알림 → 디지털 access 발급 → KT-Alpha 교환권 발송 → 혼합결제 딜차감. 전부 fail-soft + order_id 멱등.
- **위젯**: `TossPaymentWidget`(V2 widgets, 약관 클릭시점 검증) · 충전 `TossWidgetPayPage`.

### 15-2. 딜포인트
- 충전 1원=1딜(수수료 0, 보너스 0 — 2026-05-22 신뢰 위해 제거). 패키지 5천/1만/… 고액유도(PG 변동비 흡수). 사용=즉시차감(`adjustUserPoints` CAS guardBalance). 원장 `point_ledger`.

### 15-3. 정산 (Settlement)
- 판매 정산: 플랫폼 수수료(3P 5%/1P 0%, `fee-resolver`) 차감 후 성숙(hold, 기본 T+7) → payout. 이용권은 **매장 발송/사용 확인 게이트**.
- 커미션 성숙: 어필리에이트/영입 T+7 + **원천징수**(사업 3.3%/기타 8.8%, `withholdAndLog`) → 지급.
- 역전: 환불 시 `refundOrderFully`+`returns.routes` 에서 커미션 clawback·딜 복원·쿠폰 un-use **대칭**.
- 크론: `auto-settlement`·`payouts-generate`·`influencer-payout`·`agency-auto-settle`·`reconciliation`·`ledger-integrity-check`.

## 16. 주문·환불·반품 라이프사이클
- **주문 status(대문자)**: `PENDING → PAID → DONE`(디지털/이용권) 또는 `PREPARING → SHIPPING → DELIVERED`(배송). 종결: `CANCELLED`/`REFUNDED`/`FAILED`. `payment_status`는 소문자.
- **환불**: `refundOrderFully`(전액)·`returns.routes`(부분 비례) — 캡처된 주문은 status 플립 금지, 반드시 환불경유(딜/커미션/재고/쿠폰 대칭 역전).
- **반품**: `returns` 도메인. 숙소는 reserve-before-charge + `releaseStays()` 되돌림.

## 17. 알림 시스템
- **채널**: ① 인앱(`notifyUser`/`createDashboardNotification` — 유저/셀러 벨) ② 알림톡(알리고, `alimtalk`) ③ 웹푸시(`push`) ④ Discord(운영). 
- **재시도 크론**: `retry-notifications`·`retry-alimtalk`·`webhook-failed-drain`·`bulk-email-drain`.
- 확정/취소/발송/정산/영입/초대/공구확정 등 이벤트별 발화. 양 확정경로(confirm/webhook) 대칭 배선.

## 18. 백그라운드 잡 (크론 60+, `wrangler.toml` 스케줄)
- **정산/재무**: auto-settlement·payouts-generate·influencer-payout·reconciliation·ledger-reconcile·ledger-integrity-check·prospects-commission-activate
- **에이전시**: agency-auto-settle·agency-monthly-invoices/report/tasks·agency-tier-eval·agency-creator-eval·agency-seller-match·agency-store-intro-monthly-bonus·agency-inactive-sellers
- **셀러/등급**: seller-tier-eval·seller-daily-report·seller-churn-detect·wholesale-grade-eval
- **캐시/성능**: cache-prewarm·cache-warming·group-buy-feed-cache
- **숙소**: stay-checkout-transition·stay-pending-expire·stay-reminder·stay-voucher-expire
- **교환권/외부**: kt-alpha-catalog-sync·kt-alpha-voucher-retry·voucher-expire·tiktok-videos-sync·youtube-*·shipping-sync·restaurant-geocode
- **운영/안전**: anomaly-detect·disputes-escalation·daily-self-diagnostic·d1-backup·scheduled-cleanup·channel-watchdog·toss-refund-retry·blog-ai-draft(킬스위치)
- **schema-repair-daily**(18 UTC): migrations 누락 컬럼/테이블 자동 보장(신규 컬럼은 다음날 자동 적용 — 또는 어드민 수동 `/api/_internal/repair-schema`).

## 19. 어드민 운영 도구 (101 페이지, `AdminLayout` 그룹)
운영 · 🎯유어애즈 · 🏭도매몰(운영/정산/CS) · 🏪오프라인 공구 · 🛒온라인 쇼핑 · 회원/파트너 · 💰정산/재무 · 검증/CS. 주요: 대시보드·인사이트·퍼널·매출분석·운영가이드·**플랫폼 모델**·어뷰징탐지·환경준비·정산·분쟁·리뷰관리·셀러/에이전시 승인·블로그·유어애즈.

## 20. 캐싱·성능 아키텍처 (잠금)
- **SSR 0-RTT**: `worker/index.ts` HTMLRewriter 가 `__SSR_INITIAL_{MAIN,VOUCHERS,BROWSE,DETAIL,SELLER,CURATOR,WHOLESALE,BLOGPOST,GROUPBUY}__` 주입 + `caches.default` edge read → 첫 페인트 데이터 즉시.
- **edge cache**: `publicCache(useKv:false)` + `CDN-Cache-Control` 분리(브라우저 60 / edge 900). cron `cache-prewarm` HOT_PATHS 워밍.
- **청크 자가복구**: index.html 부트가드 + `chunk-error.ts`(MIME 감지·`__cb` 캐시버스트) + main.tsx 배선 + SPA 셸 `no-cache`. 배포마다 해시회전 → stale HTML 자동복구.
- **로딩 로더**: 단일 URDEAL BrandLoader(라우트전환/링크샵 #root). 상품 이미지 `cf-image`(cdn-cgi 리사이즈) + dominant_color placeholder.

## 21. 보안·컴플라이언스
- **인증/권한**: requireAuth/Seller/Admin/Agency · IDOR(소유권 체크) · 서버 재계산(금액 클라 불신) · Rate limit(`RATE_LIMIT_KV`) · Turnstile(민감) · `safeError`(DB 에러 미노출) · `safeInternalPath`/`safeRedirect`(오픈리다이렉트 방어).
- **개인정보(PIPA)**: 셀러 phone/email 공개 제외 · 토큰 암호화(`encryptToken`).
- **전자상거래법**: 링크샵 MORE INFO 푸터(상호·대표·사업자번호+공정위확인·통신판매업신고·주소) · 원천징수 · 세금계산서(`tax-invoice-gateway`).
- **결제 잠금**: Toss V2 docs audit 잠금(gateway/에러코드/webhook/위젯 SSOT).

## 22. 자동 방어선 (품질 가드 42종)
pre-commit + `verify.yml` + `audit-gate.sh` 가 결정론으로 강제(수동 재감사 스킵 가능): 서비스분리·인증세션RBAC·머니패턴(claim-before-credit/역전대칭/멱등/무환불CANCELLED)·SQL(bind/컬럼/테이블/NOT NULL)·상품종류판별·UI테마(dark variant)·i18n·파일크기 래칫·청크자가복구·auth-쿠키(iOS)·CSV인젝션·로그인게이트·모달z-index·**플랫폼모델 문서동기화** 등. 상세: `docs/AUDIT_INVARIANTS.md`.

## 23. 에러·장애 대응
- Playbook: `docs/ERROR_DEBUGGING_PLAYBOOK.md`(신고 시)·`KNOWN_ERRORS.md`(grep)·`DEV_IMPLEMENTATION_PLAYBOOK.md`(개발 시). 원칙: 추측 금지 → 진단도구 먼저 → 에러 단어 그대로 grep → dual-mode 제거 금지 → 1 commit 1 원인.
- 진행 SSOT: `docs/CURRENT_WORK.md`. 사고 기록: `docs/INCIDENTS.md`.

---

## ✅ 구현 로그
- 2026-07-02 문서 신설 (마스터 SSOT) + Part II 시스템 상세(인증·결제·정산·주문·알림·크론·어드민·캐싱·보안·가드·장애) 확장. 개별 단계 완료 시 commit hash 기록.
