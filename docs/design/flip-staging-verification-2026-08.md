# 8월 promo flip — staging 실결제 검증 체크리스트 + OFF-parity 증명 (PR #496)

> 대표 조건: ① 이 코드는 전용 draft PR(main 머지 금지)에만, staging 실결제 축별 검증 통과 후에만 머지. ② 완료 기준 = 축별 유닛테스트 + OFF-parity 증명. ③ 스위치는 서초 온보딩 시작 → staging 실결제 축별 검증 → 머지 → 대표 클릭, 순서 고정.

## 🎯 검증 방식 = 파일럿 매장 스코프 (2026-07-12 대표 결정 — flip 검증 당김)

**전제 발견**: 이 프로젝트는 D1 이 하나뿐(`toss-live-commerce-db`)이고 flip 스위치는 `platform_settings` **전역 값** → 별도 staging 환경 없음. 전역 스위치를 켜면 프로덕션 전체 적용.
**해결**: `flip_pilot_seller_ids`(S8) — **지정 테스트 매장 주문만** flip 경로(예산 아비터 ON + owner 펀딩)로 태우고, 나머지 실주문은 현행(byte-동일). **프로덕션에서 실카드 소액 결제로 그 매장만 검증** → 통과 후 전역 스위치.

### 검증 세션 순서 (고정)
1. **준비(코드)**: PR #496 을 프로덕션에 반영(머지) — **단 스위치·파일럿 전부 미설정 = 라이브 0**. (게이트 뒤 dormant.)
2. **테스트 매장 생성**: 대표님이 실제 매장 하나 온보딩(가입→승인→이용권 1개 등록). 그 `sellers.id` 확보(어드민 매장목록).
3. **파일럿 지정**: 어드민 플랫폼 설정에서 `flip_pilot_seller_ids = {그 seller_id}` + `commission_budget_enabled = true` + `promo_funding_source = owner` 저장. **→ 그 매장 주문만 flip. (전역은 여전히 파일럿 목록으로만 스코프.)**
   - ⚠️ 주의: `commission_budget_enabled`/`promo_funding_source` 는 전역이지만, **파일럿 목록이 비어있지 않으면 order-commissions 가 파일럿 매장만 budgeted 경로로 라우팅** — 나머지 매장은 `legacyOrders`(현행). 즉 파일럿 목록이 실질 스코프. (전역만 켜고 파일럿 비우면 전 매장 적용이니, 검증 중엔 **반드시 파일럿 목록에 테스트 매장만** 둘 것.)
4. **실카드 축별 결제**(아래 §2 시나리오) → 어드민 `/admin/promo-ledger`(A2 promo 재원 감사) + 원장으로 **유어딜 net == 정확히 5%** 확인.
5. **통과 시**: S4b 마무리(사용시점 셰어 redirect — 이제 실데이터 확보) → PR #496 최종 → **파일럿 목록 비우고 전역 스위치 ON**(전 매장) → 대표 클릭.
6. **롤백**: `flip_pilot_seller_ids` 비우기 + `promo_funding_source=platform` → 즉시 현행.

### 대표님 준비물 요약
- **스테이징 URL**: 별도 없음 → **프로덕션(`live.ur-team.com`) + 파일럿 매장 스코프**로 대체(위).
- **관측 화면**: `/admin/promo-ledger` (A2 promo 재원 원장 감사 — order당 5% vs promo 구분) + `/admin/abuse`(§0 탐지).
- **결제 금액·건수**: §2 표 참조 (총 6~8건 × ₩1,000~3,000 소액, 환불 포함).

---

## 0. 스위치 (platform_settings — 전부 기본 OFF, 라이브 영향 0)

| 키 | 기본(라이브) | flip 값 | 효과 |
|---|---|---|---|
| `flip_pilot_seller_ids` | (미설정=없음) | `{테스트 seller_id}` | **파일럿 스코프** — 이 매장 주문만 flip(전역 무관). 검증용. 통과 후 비움 |
| `commission_budget_enabled` | (미설정=false) | `true` | 예산 아비터 ON — 3P 주문당 커미션 ≤ 수수료−PG준비금 |
| `pg_reserve_pct` | (미설정→코드 기본 **2.75**) | 필요시 재확정 | 예산 = 수수료 − 결제액×2.75%(VAT 실측) |
| `promo_funding_source` | (미설정=platform) | `owner` | C1~C4 를 매장 promo(5% 밖) 재원으로 이전 |
| `seller_promo_field_enabled` | false | `true` | 셀러 promo% 입력 UI 노출 |
| `gb_engine_enabled` | (미설정=false) | `true` | 공구 엔진 — 🔴 **게이트가 2겹이다. 아래 주의 참조** |
| `affiliate_use_mature_min_hours` | (미설정=0) | 예: `24` | §0-1 구매→사용 즉시확정 보류(어뷰즈창) |
| `affiliate_referrer_daily_cap_krw` / `_monthly_cap_krw` | (미설정=무제한) | 정책값 | §0-3 referrer 적립 캡 |

### 🔴 0-a. 공구 엔진 게이트는 **2겹**이다 (2026-07-29 실행 증거 감사에서 발견)

`gb_engine_enabled`(서버) **하나만 켜도 공구 특가는 적용되지 않는다.** 클라 쪽에 하드코딩된 겹이 하나 더 있다:

| 겹 | 위치 | 현재 값 | 켜는 방법 |
|---|---|---|---|
| 서버 | `platform_settings.gb_engine_enabled` | **키 자체 부재**(=false) | 어드민 플랫폼 설정에서 값 저장 — **배포 불필요** |
| 클라 | `src/shared/feature-flags.ts` `GB_ENGINE_ENABLED` | `false` (하드코딩) | **소스 수정 + 배포 필요** |

라이브 실측(2026-07-29): `GET /api/gb-marketplace` → `{ "data": [], "gb_engine": false }`

> ⚠️ **순서 주의**: 클라만 켜면 화면에는 공구 UI 가 뜨는데 서버가 값을 안 실어 **빈 목록**이 된다.
> **서버 → 클라** 순서로 켜고, 서버만 켠 상태에서 `/api/gb-marketplace` 가 `gb_engine: true` + 데이터를
> 반환하는지 먼저 확인할 것.
>
> ⚠️ **세션 ①(#844, gb 특가 → 결제 배선)의 실효 조건이 곧 이것이다.** #844 를 머지하고 staging 실결제를
> 통과해도 **두 겹이 다 켜지기 전에는 결제에 공구가가 적용되지 않는다.** #844 의 staging 검증 시나리오
> (*"결제 금액이 공구가인지"*)를 실행하려면 **검증 환경에서 두 겹을 먼저 켜야 한다** — 안 켜면
> "상시가로 결제됨"이 관측되고, 그건 배선 실패가 아니라 게이트 OFF 다. **오진하기 쉬운 자리다.**

서버 겹은 어드민 `/admin/system-monitoring` → 게이트·하트비트 탭(`OPS_GATES`)에 등재됐다(2026-07-29).
클라 겹은 값이 아니라 배포물이라 화면에 못 싣는다 — 그래서 라벨에 함께 적어 뒀다.

## 1. OFF-parity 증명 (스위치 OFF = 현행 byte-동일)

**구조적 증명(코드 게이트):**
- `order-commissions.ts creditOrderCommissions`: `commission_budget_enabled !== 'true'` → `legacyCredit()`(기존 경로 그대로 위임). `promoOwnerFunded` 는 `gateOn` 블록 안에서만 set → OFF 시 항상 false → per-axis 제외 로직 미발동.
- `ledger.ts debitOwnerPromoForOrder`: 첫 줄 `promo_funding_source !== 'owner'` → **return 0**. 확장한 C2/C3/C4 합산 쿼리는 실행 자체가 안 됨.
- `commission-budget.ts DEFAULT_PG_RESERVE_PCT=2.75`: `commission_budget_enabled` OFF 면 예산 계산 경로 미진입 → 미참조.
- §0 방어: 전부 설정 게이트(미설정=현행). **예외 §0-2**(영입인플 본인구매 skip)는 무조건 — 단 이는 주석이 이미 약속했던 self-skip 의 **버그픽스**이고 지급을 *축소*하는 방향(구매자==영입자일 때만)이라 정상 거래 무영향.

**shadow-rail 대조(staging 권장):** `FEE_RESOLVER_ENABLED=true`(그림자, 정산 무변경)로 `order_fee_breakdown` 에 새 규칙 분배를 기록 → 스위치 OFF 상태에서 [실제 정산액] vs [그림자 new_* 분배] 대조. flip 후 authoritative 전환 판단 근거.

**유닛(CI):** `commission-budget.test.ts`(예산 2.75) + `commission-owner-funding.test.ts`(5% 불변 항등식) — CI `verify.yml` 에서 실행(이 원격환경은 npm 403 으로 로컬 미실행).

## 2. 축별 staging 실결제 체크리스트 (flip 전 필수 — 조건 ①)

각 축: `commission_budget_enabled=true` + `promo_funding_source=owner` 로 실결제 → 원장 확인.

- [ ] **C1 어필리에이트/핀**: 추천 경유 3P 주문 결제→이용권 사용 → 추천인 딜 적립 = 전액 + `order:{id}:promo` merchant debit == 적립액 + `platform:revenue` net == 정확히 5%. 환불 → `promo_fee_reversal` 로 merchant 복원.
- [ ] **C2 멀티티어 트리**: 추천트리 경유 주문 → tier1/2/3 딜 적립 + owner 되갚기 합 == Σ(referral_commissions 적립분). **⚠️ '되갚을 활성분' status 정의 확인** — 코드는 `status != 'withdrawn'` 보수 필터(작성 시점 미확정, `commission-funding-restructure.md §flip 구현 스펙`). 실제 적립분과 되갚기가 정확히 같은지 원장 대조.
- [ ] **C3 크리에이터 영입(1.5%)**: 영입 매장 주문 → `influencer_attributions(store_intro)` 적립 + owner 되갚기 포함. **본인구매(§0-2)**: 영입자가 자기 매장 구매 → 적립 0 확인.
- [ ] **C4 에이전시 매장영입(1%)**: `agency_store_intro_commissions(sales_commission)` 적립 + owner 되갚기 포함. signup_bonus(정액·월예산)는 예산 밖 독립 처리 확인.
- [ ] **혼합 주문**(C1+C2+트리 겹침): Σ적립 ≤ 예산(캡 발동) OR owner-펀딩 시 전액+되갚기. `platform:revenue net == 5%`(어떤 조합에서도).
- [ ] **환불 대칭**: 위 각 축 환불 → `reverseOwnerPromoDebit` 로 merchant receivable 정확 복원 + 커미션 역전.

### 2-1. 실카드 결제 계획 (금액·건수·순서 — 대표님 실행표)

> 소액 실카드. 각 건 결제 직후 `/admin/promo-ledger` 에서 그 order 의 `platform:revenue net == 결제액×5%` + `order:{id}:promo` merchant debit == 커미션 적립합 확인. 환불은 각 축 1건씩만 해도 대칭 검증 충분.

| 순서 | 축 | 사전 세팅(테스트 데이터) | 결제 | 금액 | 확인 |
|---|---|---|---|---|---|
| 1 | **베이스(커미션 없음)** | 파일럿 매장 이용권, 추천/영입 없음 | 본인 구매 | ₩2,000 | 유어딜 net=100원(5%), promo debit **0**(현행과 동일) |
| 2 | **C1 어필리에이트** | 다른 유저 링크(`?ref=`/핀) 경유 | 그 링크로 구매→이용권 사용(QR) | ₩2,000 | 추천인 딜 적립=X · promo debit==X · net==100원 |
| 3 | **C3 크리에이터 영입** | 매장 `introduced_by_influencer_id` = 인플A | 제3자 구매 | ₩2,000 | `influencer_attributions(store_intro)` 적립 · promo 포함 · net==100원 |
| 4 | **C3 본인구매(§0-2)** | 위와 동일 매장 | **인플A 본인이** 구매 | ₩1,000 | 적립 **0** (자가 커미션 차단 확인) |
| 5 | **C4 에이전시 영입** | 매장 `introduced_by_agency_id` = 에이전시B | 제3자 구매 | ₩2,000 | `agency_store_intro_commissions(sales_commission)` 적립 · promo 포함 · net==100원 |
| 6 | **C2 멀티티어**(선택) | 추천트리 있는 구매자 | 트리 유저 구매 | ₩3,000 | tier 적립합 == promo debit · net==150원 · **되갚기 status 정의 실확인** |
| 7 | **혼합** | 2·5 겹친 주문(추천+영입매장) | 구매 | ₩3,000 | Σ적립 = promo debit · net==150원(어떤 조합에서도 정확 5%) |
| 8 | **환불 대칭** | 위 2·3·5 중 각 1건 | 환불 | — | `promo_fee_reversal` merchant 복원 · 커미션 역전 · net 원복 |

**합계: 약 ₩15,000 내외 / 7~8건 결제 + 3건 환불.** (전부 파일럿 매장 스코프라 다른 실주문 무영향.)
**통과 기준(전 건 공통):** 어떤 주문에서도 **유어딜 `platform:revenue` net = 결제액 × 정확히 5%** (커미션이 5% 를 0원도 안 건드림). 어긋나면 그 축 보류 후 원인분석.

## 3. ⚠️ S4b — 사용시점 셰어(V 20% / C4 30%) 미완 (staging 후속)

confirm-시점 커미션이 안 뜬 주문(매장이 구매 *후* 영입된 레거시 케이스)에서만 발동하는 **사용시점 셰어**(`recordIntroductionCommissionShare`/`recordAgencyCommissionShare`)는 아직 `platform:revenue` 를 debit. 이를 owner 로 redirect 하려면 coarse 환불 역전(`recordRefundLedger`)의 rework 가 필요하고, 그 대칭성은 **staging 실데이터로만** 검증 가능 → 블라인드 미구현(안전). #44 가드 R4 도 이 축은 범위 밖(false-positive 방지). **flip 스위치는 이 케이스 빈도가 낮으므로(정상 이용권 구매는 confirm-시점 C3/C4 가 처리) 서초 검증엔 무방하나, 완전 #44 준수 전 S4b 를 staging 데이터 확보 후 마무리.**

## 4. 롤백
스위치 OFF(`promo_funding_source=platform`, `commission_budget_enabled=false`)로 즉시 현행 복귀. 코드 롤백 불필요(게이트 뒤 dormant).

## 구현 로그 (PR #496, claude/promo-flip-money)
- S1 `commission-budget.ts` PG 준비금 2.5→2.75(+test)
- S2 `refund.ts` restoreStock 멱등화(R6, [UNLOCK])
- S3 `affiliate-credit.ts`/`influencer-store-intro-commission.ts`/`ledger.ts`/`anomaly-detect.ts`/`AdminAbusePage.tsx` §0 방어 4종
- S4a `order-commissions.ts`+`ledger.ts` 딜지급 축(C1~C4) owner-redirect(예산 제외 + 되갚기 합산 확장)
- S5 `commission-owner-funding.test.ts` 5% 불변 항등식
- S7 `check-commission-budget.mjs` R4 (#44 가드)
- S8 `flip-pilot.ts` + `order-commissions.ts`/`ledger.ts` 파일럿 매장 스코프 게이트 + `platform-settings-validation.ts` 키 등록(`flip_pilot_seller_ids`·§0 3키)
- S4b 사용시점 셰어 redirect — staging 후속(§3)
