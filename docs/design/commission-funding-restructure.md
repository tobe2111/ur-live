# 커미션 재원 구조 개편 (Commission Funding Restructure) — 설계 SSOT

> 작성: 2026-07-04 · 출처: 대표 승인 방향 ("수수료율은 건드리지 말고, 수수료 구조를 고쳐라 — 마켓플레이스를 '절대 잃지 않는 층'으로")
> 상태: **설계 (구현 전)** · 구현 시 이 문서 하단 구현 로그에 commit hash 기록.
> 관련: `urdeal-platform-model.md` §5 (경제 엔진) · `product-ownership-model.md` (1P/3P·promo 슬라이스) · `vendor-commission-passthrough.md` (벤더 분할 B) · CLAUDE.md 💸 머니 룰.

---

## ⭐ 확정 원칙 (2026-07-08 대표 확정 — "커미션 구조 확정, 8월 promo flip 때 이대로 켠다")

> 이 섹션이 재원 구조의 **최상위 원칙**이다. 아래 §0~§6 은 2026-07-04 시점 "5% 안에서 캡" 프레임으로 쓰여 있고, 본 확정 원칙이 그 프레임을 **판매 커미션에 한해 역전**한다(판매 커미션은 5% 밖 promo 재원). 8월 flip 전까지 **코드 변경 없음** — 원칙 인지 + 문서 박제 + flip 체크리스트만.

**대원칙: 유어딜 5% 는 *어떤* 커미션에도 일절 안 쓴다 (순수 인프라비, PG 포함). 판매 커미션도 에이전시 조율 수수료도 전부 5% 밖 매장 promo 에서. 어떤 축도 5% 를 안 건드린다.**

> 🧭 **제품 정체성(2026-07-08 대표 확정)**: 유어딜 = **쇼핑 공구의 벤더/에이전시 중개 모델을 오프라인 매장 이용권으로 옮긴 것.** (쇼핑: 벤더가 브랜드-인플 조율 → 인플 판매 → 벤더·인플 promo 분배. 유어딜: 에이전시가 매장-인플 조율 → 인플 이용권 판매 → 에이전시·인플 promo 분배.) 구조 1:1, "상품→이용권 · 택배→QR방문"만 바뀜. → 유어딜은 판·정산·QR·자동화 인프라만 5% 로 빌려주고 **중개 수수료엔 관여 안 함**. 상세: `urdeal-platform-model.md`.

1. **유어딜 5% (불가침, 순수 인프라비)** — 소비자 결제 인프라비. **PG 수수료는 이 5% *안에서* 플랫폼이 흡수(자기 비용)** → 유어딜 실현 마진 = 5% − PG. **5% 는 gross(총) take 이고 판매·에이전시 등 어떤 커미션도 이 5% 를 0 만큼 건드린다**(전부 promo). ⚠️ "5% 불변" = **원장상 `platform:revenue` = 5% 전액(어떤 성장 커미션도 platform:revenue debit 0)** 을 뜻하며, PG 후 실현마진(5%−PG)과 구분. **판매·에이전시 조율 등 어떤 커미션 재원으로도 5% 사용 금지.**
2. **판매 커미션(인플루언서·벤더·어필리에이트) = 매장 promo(5% 밖) = `promo_funding_source=owner`.** 인플/벤더에게 얼마를 주든 **유어딜 5% 는 불변** — 이 불변식이 깨지면 **버그**.
3. **에이전시 = 매장-인플 조율 독립 사업자 (수수료도 promo 재원, 5% 무관).** 유어딜이 커미션을 "주는" 게 아니라 — 에이전시가 매장에 "이 조건으로 이용권 내놓으세요" 협상 + 인플에 "이거 파세요" 붙임 → **매장이 건 promo 를 인플과 나눠 갖고 차액이 자기 수수료**. 즉 에이전시 몫도 **매장 promo(5% 밖)** 에서 스스로 가져간다 — 유어딜 5% 는 무관 (= 쇼핑 벤더가 promo 마진 먹는 것과 동일). ⚠️ 현행 C4(1%/24개월)는 5% 재원이라 **8월 flip 때 promo 기반으로 재설계**(판매 커미션과 함께 정리). 콜드스타트(매장 promo 아직 없음)에 한시 보조가 필요하면 그건 **5% 밖 별도 마케팅 보조금**(구조 축 아님·대표 재량)으로 — **5% 는 여전히 불가침**.
4. **A/B 구조는 마진과 무관.** 직접 판매(A)든 벤더/에이전시 pass-through(B)든 재원이 전부 매장 promo(5% 밖)라 유어딜 5% 무영향. **A 폐지·B 강제 불필요** — 현행 A(병렬 독립 지급) 유지, B 는 실벤더/에이전시 조율 본격화 시 `vendor-commission-passthrough.md` 기반으로 얹기. **B 의 풀 재원도 반드시 promo(5% 밖).**
5. **수수료율 결정 권한 = 3단(셀프형/승인형(기본)/완전위임형).** promo 는 매장 돈이므로 값 세팅/발효를 매장이 에이전시에 얼마나 위임했는지로 갈림(현실은 에이전시 대신관리가 다수 = 완전위임형 지원). **어느 모드든 매장은 promo 지출 내역 상시 조회 + 위임 회수 가능**, 유어딜은 **캡·투명성 가드만**(값·승인 무관). 상세: `vendor-commission-passthrough.md §4.3`.

### 🔴 현행 코드와의 갭 (8월 flip 체크리스트 — 전수조사 2026-07-08)

오늘 `promo_funding_source='owner'` 스위치는 **어필리에이트(C1)만** 5% 밖으로 이전한다. 나머지 판매 커미션은 **여전히 5% 를 잠식**한다. flip 은 이 갭을 닫는 작업이다:

| 축 | 오늘 재원 | flip 조치 | 상태 |
|---|---|---|---|
| C1 어필리에이트/핀 | owner 스위치로 이전됨 (`order-commissions.ts:183` + `debitOwnerPromoForOrder` `ledger.ts:471`) | flip 시 `promo_funding_source='owner'` — 이미 커버 | ✅ 확정 |
| C2 멀티티어 트리 | **5% (예산 캡, owner 미이전)** | owner 제외 분기 + `referral_commissions` owner debit 신설 | ❌ 미구현(갭) |
| C3 인플루언서 매장영입(1.5%) | **5%** — owner 레버 없음 | owner-펀딩으로 이전 (C1 과 동일 패턴) | ❌ 미구현(갭) |
| 이용권 사용시 인플 20% share | **5%** (`recordIntroductionCommissionShare` `ledger.ts:356` → `debit platform:revenue`) | owner 이전 또는 flip 시 off | ❌ 미구현(갭) |
| C4 에이전시 매장영입 1%/24mo + signup ₩30k + 이용권 30% share(`recordAgencyCommissionShare` `ledger.ts:206`) | **5%** (예산 우선보호) | **promo 기반 재설계** — 에이전시 몫도 매장 promo(조율 마진)에서, `platform:revenue` debit 제거. 판매 커미션과 동일 owner-펀딩 처리 | 🟢 flip 시 promo(재설계) |
| 공급자 B2B (`supply-settlement.ts`) | 매장(공급가) | 없음 — 이미 정합 | ✅ 확정 |
| 인플 라이브셀/`seller_influencer_deals` 딜% (`group-buy.routes.ts:517`) | 매장(seller receivable debit) | 없음 — 이미 owner-펀딩(=B 의 선례) | ✅ 확정 |
| 우회 사이트: `/track`(`affiliate.routes.ts:81`, uncapped) · `/calculate-commission`(`referral-tree.routes.ts:629`, uncapped) · 숙소 referral 직접 INSERT(`payment.routes.ts:604`, owner debit 미적용) · agency-incentives 병렬 엔진(`agency-incentives.routes.ts:255`, 아비터 미배선) | 혼재 | flip 전 오케스트레이터/owner 경유로 정리 또는 폐기 | ⚠️ 확인필요 |

### 🛡️ 불변식 #44 (flip 시 신설) — "원장상 platform:revenue = 5% 전액 (성장 커미션 debit 0)"

> ⚠️ **정의 명확화(2026-07-08 대표 — "PG 는 5% 안에서 해결")**: 여기서 "5%" 는 **원장 `platform:revenue` pool = 결제액의 5% 전액**을 뜻한다(성장 커미션이 이 pool 을 debit 하지 않음). **PG 는 이 5% *안에서* 플랫폼이 흡수하는 원장 밖 비용** — 실현 마진(5%−PG)과 이 불변식은 구분된다. 즉 불변식은 "커미션이 5% pool 을 안 건드림"이지 "PG 후에도 5%"가 아니다.

오늘의 [INV-CB]는 **"platform 원장 net ≥ 0"**(커미션이 5% pool 을 PG 준비금 바닥까지 잠식 허용)일 뿐, "5% pool 불가침" 은 **어디에도 인코딩 안 됨**. flip 시 **더 강한 불변식**을 신설:
- **Layer 1 (순수/유닛):** `commission-budget.ts` 에 flip 플래그 추가 → 플랫폼-펀딩 예산을 **0 강제**(모든 판매 커미션은 owner/promo 슬라이스에서). `commission-budget.test.ts` 에 `platformNet(order) === round(total×5/100)` 항등식 단언.
- **Layer 2 (정적 가드):** `check-commission-budget.mjs` 에 **R4** — **어떤** 성장 커미션(판매 + 에이전시 포함)도 `debit_account:'platform:revenue'`(또는 `platform:commission`)로 5% 를 빼면 안 됨(`recordAgencyCommissionShare`/`recordIntroductionCommissionShare`/`creditUserCommission` 전부). flip 후엔 **예외 없이** owner(매장 promo) 계정 debit 만 허용 → 5% pool 은 누구도 안 건드림.
- **Layer 3 (선택, 런타임):** 정산 reconcile cron 에서 주문당 "성장 커미션의 platform:revenue debit == 0"(flip 플래그 ON) 확인.
- 등록: `AUDIT_INVARIANTS.md` #44 + `audit-gate.sh` 머니 도메인.

### 🔧 flip 구현 스펙 (per-axis owner-펀딩 전환 — 2026-07-08 코드 실사 확인, 8월 세션용)

> ⚠️ **핵심 발견: 축마다 재원 지급 방식이 달라 owner 되갚기 산출도 축마다 다르다.** 틀리면 "5% 불변"이 깨진다. **역전은 자동 대칭(안전), debit 금액 산출만 staging 실검증 필수.** 아래는 그 축별 정확한 전환 지점.

**owner 되갚기 메커니즘(기존 C1):** `ledger.ts debitOwnerPromoForOrder` — 주문의 커미션 합을 **주인 계정 debit → platform:revenue credit**(딜 재원 회수) 1개 원장 엔트리(`order:N:promo`, event_type `promo_fee`, 멱등). 역전 `reverseOwnerPromoDebit` 는 **저장된 amount 를 그대로 되돌림 → 합산 대상을 넓혀도 역전 자동 대칭**(리스크 낮음). 호출: 이용권=사용 시점(voucher-use, confirm 이후라 C2/C3 적립 존재 ✓) / 쇼핑=`order-ledger-credit.ts` confirm(현재 `SHOPPING_LEDGER_ENABLED` OFF=휴면).

| 축 | 오늘 재원 지급 방식 | flip 전환(2곳) |
|---|---|---|
| **C1 어필리에이트** | 딜포인트, `affiliate_earnings(status IN holding/granted)` | ✅ 완료 — `debitOwnerPromoForOrder` 가 이미 이 합 debit |
| **C2 멀티티어** | 딜포인트, `referral_commissions(order_id, commission_amount, status)` | ① `budgetedCreditForOrder` 에서 `promoOwnerFunded` 시 mtReq 예산 제외 ② `debitOwnerPromoForOrder` 합에 `SUM(commission_amount) WHERE order_id=? AND status != 'withdrawn'` 추가. ⚠️ status vocabulary(`pending/granted/withdrawal_requested/paid_out/withdrawn`) 중 '되갚을 활성분' 정의를 staging 에서 확정 |
| **C3 크리에이터 영입** | 현금/딜, `influencer_attributions(source='store_intro', commission_amount, status)` | ① infReq 예산 제외 ② owner debit 합에 `SUM(commission_amount) WHERE order_id=? AND source='store_intro' AND 활성상태` 추가 |
| **(V) 이용권 20% 인플 share** | **원장 직접** `recordIntroductionCommissionShare` = `debit platform:revenue → user:N` | **debit 계정을 platform:revenue → 주인 계정으로 변경**(when owner) — 이 축은 딜 합산이 아니라 원장 debit 이라 debitOwnerPromoForOrder 가 아니라 *이 함수 자체*를 owner-redirect. 기존 역전이 debit_account 를 읽어 복원하므로 대칭 유지 |
| **C4 에이전시 매장영입 + (V) 30% agency share** | `agency_store_intro_commissions` + 원장 `recordAgencyCommissionShare`(platform_fee 30% debit platform:revenue) | **promo 재설계 — 판매 커미션과 동일**: 예산 제외 + owner(매장 promo) debit. `recordAgencyCommissionShare` 는 debit 계정을 platform:revenue → 주인으로 redirect. 에이전시는 조율 마진(promo)에서 먹으므로 5% 무관 |

**#44 가드(전환 후 신설):** owner-redirect 가 완료되면 `check-commission-budget.mjs` R4 = "**어떤** 성장 커미션(C1/C2/C3·V인플·**C4 에이전시 포함**)도 `debit_account:'platform:revenue'` 로 5% 를 빼는 곳 0"(**예외 없음**) 정적 단언 + `commission-budget.test.ts` 에 flip 플래그 시 `platformNet == round(total×5/100)` 항등식. ⚠️ 이 가드는 **owner-redirect 리팩토링 후에** 추가(그 전엔 현행 platform:revenue debit 이 정상이라 false-positive).

**staging 검증(flip 전 필수):** `promo_funding_source='owner'` + `commission_budget_enabled='true'` 로 C1~C3 겹친 3P 주문 실결제 → **주문당 platform:revenue net == 정확히 5%**(커미션이 5% 를 안 건드림) + 환불 시 owner debit 역전으로 주인 receivable 복원 + Σ(인플+벤더 적립) = 매장 promo 슬라이스 확인.

### 지금 할 것 / 안 할 것
- **지금:** 원칙 인지 + 문서 박제(본 섹션 + 아래 관련 문서) + flip 체크리스트 + **per-axis 구현 스펙(위)**. **코드·머니 경로 변경 0.**
- **8월 promo flip:** 위 갭을 순서대로 — 예산캡 → owner-펀딩 확장(C2/C3/인플 20%) → promo 필드 → 공구엔진, **staging 실결제 검증**. 머니 경로라 **단독 세션 격리**.
- **에이전시 마중물 조정(1%→축소/정액/폐지):** 별도 결정 후. 지금은 현행 유지.

---

## 0. 목표 (한 문장)

**3P 5% 수수료율은 불변**(영업 무기). 대신 **"플랫폼이 부담하는 성장 커미션 총합이 플랫폼 실수령 여력을 절대 초과 못 하는" 구조적 상한**을 만들어, 어떤 거래도 플랫폼에 마이너스가 될 수 없게 한다. 어필리에이트는 재원을 플랫폼 부담 → **주인(셀러) 부담(promo 슬라이스)** 으로 이전할 수 있는 스위치를 만든다.

---

## 1. 현재 상태 — 플랫폼 부담 커미션 전수 인벤토리 (2026-07-04 코드 확인 완료)

주문 1건에 얹힐 수 있는 플랫폼 부담 커미션. **전부 GMV 기준 % 이고 서로 캡을 모른다.**

| # | 커미션 | 기본율 | 적립 코드 | 적립 테이블 | 지급 | 멱등 |
|---|---|---|---|---|---|---|
| **C1** | 어필리에이트(핀 추천) | **2%** (`affiliate_commission_rate`, 상품별 `products.referral_commission_rate` override) | `affiliate-credit.ts` `creditAffiliateForOrder` | `affiliate_earnings` (holding→granted) | 딜 | UNIQUE(referrer,order) |
| **C2** | 멀티티어 추천트리 | **tier1 10% / tier2 3% / tier3 1%** (`tier{1,2,3}_commission_rate`, 자체 합캡 15%) | `referral-tree.routes.ts` `calculateMultiTierCommission` | `referral_commissions` | — | order_id 선점 + **C1 존재 시 skip**(상호배타) |
| **C3** | 크리에이터 매장영입 | **1.5%** (`influencer_store_intro_pct`) | `influencer-store-intro-commission.ts` | `influencer_attributions`(source='store_intro') | 현금(T+7·원천징수)/딜 | (influencer,order,source) |
| **C4** | 에이전시 매장영입 | **1~2%** (`agencies.store_intro_commission_pct`, 24개월 한도) **+ signup 보너스 정액 ₩30,000**(첫 결제 1회) | `agency-store-intro-commission.ts` | `agency_store_intro_commissions` | 정산 | UNIQUE(order,type) |
| **C5** | 초대 보상 | **정액 1,000딜** (피초대자 첫 구매) | `invite-reward.ts` | `invite_rewards` | 딜 | UNIQUE(inviter,invited) |
| (V) | 이용권 사용 시 셰어 | agency 30% **of platform_fee** 등 | `ledger.ts` `recordAgencyCommissionShare`/`recordIntroductionCommissionShare` | `ledger_entries` | 정산 | reference_id |

### 손익 산술 (플랫폼 관점, 3P 5% 기준)
- **일반 최악(핀 경유)**: +5% − PG ~2.5% − C1 2% − C3 1.5% − C4 1% = **−2%**
- **트리 최악(추천트리 경유, C1 없음)**: +5% − PG 2.5% − C2 최대 14% − C3 1.5% − C4 1% = **−14%** ← 설계 과정에서 발견. 기존 논의(제안서 포함)가 놓친 최대 노출.
- (V)는 **이미 platform_fee 안에서 분배**되는 구조라 안전(목표 패턴의 선례).

### 🚩 설계 중 발견 — 별도 검증/결정 필요 (이 설계의 범위 밖, 착수 전 확인)
1. **F1 — 멀티티어 기본율 10/3/1**: 2026-06-17 "추천은 CAC라 2%로 하향" 결정과 정합 재검토 필요. 캡이 구조적으로 막아주지만 기본율 자체도 어드민 조정 대상.
2. **F2 — 이용권 이중 커미션 의혹**: 결제확정 시 GMV 커미션(C3/C4)과 이용권 *사용* 시 platform_fee 셰어(V)가 **같은 매장·같은 구매 생애주기에 둘 다** 적립될 수 있어 보임 — 호출 경로 감사 필요(중복이면 별도 수정).
3. **F3 — signup 보너스 ₩30,000 정액**: 거래 캡에 못 들어감(소액 첫 주문이면 캡 초과 자명) → 월 예산 캡으로 분리(§4-D).

---

## 2. 목표 불변식 (신규 — 가드 #43)

> **[INV-CB] 주문 1건에서 플랫폼이 부담하는 비례(%) 성장 커미션 총합 ≤ 커미션 예산
> = 플랫폼 수수료(platform fee) − PG 준비금(pg_reserve_pct × 결제액)**

- 요율(`platform_settings`)은 어드민이 계속 자유 조정 — **총합이 예산에 닿으면 비례 축소**(요청액 비율대로, 정수 배분).
- 정액 보상(C5 초대 1,000딜, C4 signup ₩30,000)은 거래 캡 **밖** — 대신 **월 예산 캡**(§4-D).
- (V) 이용권 셰어는 이미 fee 內 분배라 대상 외(이 불변식의 선례).
- **적용 범위 = 3P 주문만**(구현 시 확정): 1P 는 수수료 슬라이스가 없어 예산 정의 불가(원가/마진은 머천다이징 관심사) → 현행 유지. 1P 커미션 노출은 F4 로 별도 트랙.

---

## 3. 변경 파일 목록 (정확한 스코프)

### 3-A. 신규 — 순수 예산 아비터 (테스트 가능한 코어)
**`src/worker/utils/commission-budget.ts`** (신규, 순수 함수 — DB/시간 의존 0)
```
computeCommissionBudget({ amountKrw, platformFeeKrw, pgReservePct }) → budgetKrw
  = max(0, platformFeeKrw − round(amountKrw × pgReservePct / 100))

allocateCommissions(requested: {key, amountKrw}[], budgetKrw) → {key, granted}[]
  — Σ요청 ≤ 예산이면 전액. 초과면 비례 축소(largest-remainder 정수 배분, Σgranted ≤ budget 정확 보장)

assertCommissionBudgetInvariants(...) — Σgranted ≤ budget · 각 0 ≤ granted ≤ requested. 위반 throw.
```
**`src/tests/unit/commission-budget.test.ts`** (신규): 전액통과/비례축소/0예산/1원 반올림/빈 요청/음수 방어.

### 3-B. 오케스트레이터 — 기존 공용 헬퍼를 아비터로 승격
**`src/worker/utils/order-commissions.ts`** (수정) — `creditOrderCommissions` 가 이미 /confirm·webhook 공용 진입점. 여기에 예산 로직 삽입:
1. 게이트 `platform_settings.commission_budget_enabled !== 'true'` → **현행과 byte-동일 경로**(각 헬퍼 그대로 위임).
2. on 이면: 주문의 platform fee 산출(셀러 `commission_rate` ?? 5%) → `computeCommissionBudget` → 각 커미션의 **요청액 사전 계산**(compute-only) → `allocateCommissions` → 각 헬퍼에 `amountOverride` 전달.
3. 시그니처 확장(additive): `creditOrderCommissions(DB, orders, opts?: { env?, referrerIntent?, buyerUserId? })` — C1(어필리에이트)·C2(멀티티어)도 이 아비터 안으로 들어와야 예산이 전체를 봄.

### 3-C. 각 적립 헬퍼 — additive 파라미터만 (기본 미전달 = 현행 100% 동일)
| 파일 | 변경 |
|---|---|
| `src/worker/utils/affiliate-credit.ts` | `creditAffiliateForOrder(..., opts?: { amountOverride? })` + 요청액 계산부(`computeOrderCommission`)는 이미 분리돼 있어 export 만 추가 |
| `src/worker/utils/influencer-store-intro-commission.ts` | `creditInfluencerStoreIntroCommission(DB, order, opts?: { amountOverride? })` + 요청액 계산 함수 분리 export |
| `src/worker/utils/agency-store-intro-commission.ts` | sales_commission 에 `amountOverride`. signup_bonus 는 §4-D 월예산 캡만 |
| `src/features/referral/api/referral-tree.routes.ts` | `calculateMultiTierCommission(..., budgetKrw?)` — 기존 15% 자체캡 유지 + 주입 예산으로 추가 스케일 |

원칙: **적립·멱등·차단(블록/셀프추천/어뷰즈) 로직은 전부 불변** — 금액 산출만 override 주입 가능하게. 역전(환불) 경로는 기록된 금액을 역전하므로 **무수정으로 대칭 유지**.

### 3-D. 어필리에이트 재원 이전 (owner-funded promo) — 독립 스위치
스위치: `platform_settings.promo_funding_source` = `'platform'`(기본, 현행) | `'owner'`.

`'owner'` 일 때 — 추천인 딜 적립(C1)은 그대로 두고, **같은 금액을 셀러 정산에서 차감**:
| 파일 | 변경 |
|---|---|
| `src/worker/utils/ledger.ts` `recordVoucherUsedLedger` | 이용권 사용 시: 해당 주문 `affiliate_earnings` 합 조회 → merchant 몫에서 promo debit 1행(`voucher:{id}:promo` reference 멱등) |
| `src/worker/utils/order-ledger-credit.ts` | 쇼핑(SHOPPING_LEDGER_ENABLED) 크레딧 시 fee_amount 에 promo 합산 |
| `src/worker/utils/fee-breakdown-record.ts` | 그림자 기록의 promo=0 미모델링 → `affiliate_earnings` 조회해 promo 슬라이스 기록(그림자 정확도↑, 정산 무변경) |
| 환불 | 기존 clawback + 원장 역전이 기록값 기준이라 대칭 자동 |

- **'owner' 전환 시 C1 은 플랫폼 부담이 아니게 되므로 §3-B 예산 요청 목록에서 제외**(promo 는 ownerNet 에서 — fee-resolver 모델 그대로).
- A안(기본 on 2%)/B안(opt-off) 결정은 **코드 무관** — `affiliate_commission_rate`(0=off) + 상품별 override 로 어드민이 표현. 이 설계는 양쪽 다 지원.
- 🔭 **미래 개선 — per-product owner-funding (2026-07-05 병렬 세션 충돌 정리 시 기록)**: 현재 `promo_funding_source='owner'` 는 **전역**이라 promo% 를 안 건 상품(기본 2%)까지 그 매장 부담으로 돌린다(매장이 동의 안 한 소개비까지 부담). 개선: `debitOwnerPromoForOrder` 가 주문 상품의 `products.referral_commission_rate IS NOT NULL AND referral_enabled=1`(=셀러가 소개비 필드로 명시 설정) 일 때만 매장 부담으로 좁히면, "promo 건 상품만 매장 부담 · 나머지는 현행 플랫폼(또는 예산캡)"으로 정밀해진다. 초기(소수 매장·전부 promo 설정)엔 전역으로 충분하므로 매장 수가 늘고 promo 미설정 상품이 섞일 때 착수. (별도 세션이 §1 필드/실수령 계산기/할인 가이드를 `referral_commission_rate` 저장 방식으로 먼저 구현·머지 — 그와 정합.)

### 3-E. 정액 보상 월 예산 캡
| 파일 | 변경 |
|---|---|
| `src/worker/utils/invite-reward.ts` | `platform_settings.invite_reward_monthly_budget_krw`(미설정=무제한 현행). 이달 granted 합 + 지급액 > 예산 → skip + 사유 로그 |
| `src/worker/utils/agency-store-intro-commission.ts` | signup_bonus 에 `agency_signup_bonus_monthly_budget_krw` 동일 패턴 |

### 3-F. 잠금 파일 배선 ([UNLOCK] 절차 — 대표 승인 + audit log)
**`src/worker/routes/payment.routes.ts`** `/confirm`:
- `_confirmSideFx` 의 개별 3연호출(agency/influencer/supplier) + `_postConfirmBg` 의 multiTier + affiliate intent 소비를 → **`creditOrderCommissions(DB, orders, opts)` 1회 호출로 통합**. Toss confirm/금액검증/CAS/재고·딜차감 **byte-불변** — side-effect 호출부만.
- `webhook.routes.ts` 는 이미 `creditOrderCommissions` 경유라 **무수정**.
- 게이트 off 기본값이므로 배포 시점 라이브 행동 0 변화.

### 3-G. 결정론 가드 + 문서 (같은 커밋)
| 항목 | 내용 |
|---|---|
| `scripts/check-commission-budget.mjs` (신규) | R1: `creditAgencyStoreIntroCommission`/`creditInfluencerStoreIntroCommission`/`calculateMultiTierCommission` 직접 호출은 정의 파일 + `order-commissions.ts` + 테스트만 허용(아비터 우회 차단). R2: 신규 플랫폼 부담 적립 테이블 INSERT 가 아비터 밖에 생기면 경고. warn → strict(verify.yml + audit-gate #43) |
| `docs/AUDIT_INVARIANTS.md` | INV-CB 등록 |
| `docs/design/urdeal-platform-model.md` §5 | 커미션 재원 구조(예산 캡·promo 스위치) 반영 — 구조 변경이므로 같은 커밋 필수(CLAUDE.md 룰) |
| CLAUDE.md Toss audit log | payment.routes [UNLOCK] 항목 추가 |
| 블로그 시드 | **무관**(수수료 5%·3.3%·1,000딜 등 수치 불변 — `check-blog-fact-sync` 통과 확인만) |

### 신규 platform_settings 키 (전부 미설정=현행)
```
commission_budget_enabled              'true' 일 때만 예산 캡 (기본 off)
pg_reserve_pct                         기본 2.5
promo_funding_source                   'platform'(기본) | 'owner'
invite_reward_monthly_budget_krw       미설정=무제한
agency_signup_bonus_monthly_budget_krw 미설정=무제한
```

---

## 4. 머니 룰 준수 확인 (CLAUDE.md 💸)
1. **Claim-before-credit**: 기존 CAS/UNIQUE 전부 불변(금액 산출만 주입) ✅
2. **적립-역전 대칭**: 역전은 기록값 기준이라 축소 적립돼도 자동 대칭 ✅ (신규 promo 원장 debit 는 환불 역전에 동반 배선)
3. **멱등**: 기존 UNIQUE+INSERT OR IGNORE 불변, 신규 promo debit 는 reference_id 멱등 ✅
4. **status 플립≠취소**: 무관(환불 경로 무수정) ✅
5. per-request DDL 금지: 신규 테이블 없음(설정 키만) ✅

## 5. 롤아웃 (모두 기본 OFF — 배포 = 행동 0 변화)
| 단계 | 내용 | 검증 |
|---|---|---|
| **1. 배포** | 3-A~3-G 전부 머지. 게이트 전부 off(=현행 100% 동일 — 별도 그림자 로깅 없음, 검증은 2단계 staging 게이트-on 으로) | 단위테스트 + tsc + build + 가드 GREEN. 라이브 돈 무변경 |
| **2. staging 실결제** | `commission_budget_enabled=true` — 트리추천+영입 겹친 주문 → Σ적립 ≤ 예산 확인 + 환불 역전 확인. `promo_funding_source='owner'` — 이용권 구매→사용→원장 promo debit 1행 + 환불 역전 | 필수(잠금 파일 룰) |
| **3. 운영 활성** | `commission_budget_enabled=true` flip | 첫 주 그림자 로그 대조 |
| **4. promo 'owner' 전환** | 미팅 포지셔닝(A안/B안) 대표 결정 후 별도 flip | — |

## 6. 명시적 비변경 (스코프 밖)
- **수수료율 5%·모든 기본율 수치** — 불변(어드민 조정 사안).
- fee-resolver authoritative 전환(열린결정 #5 전체) — 이 설계는 그 전 단계로 호환(promo 그림자 정확도만 올림).
- F1(멀티티어 기본율)·F2(이용권 이중 커미션 의혹) — 별도 감사/결정.
- Toss confirm/금액검증/CAS 로직 — byte-불변.

---

## §1 authoritative 활성 런북 (2026-07-05 인플루언서 이용권 공구 엔진 스프린트)

> 목적: "매장이 딜마다 소개비%를 걸고, 그 비용은 매장이 부담하고, 유어딜은 5%만 갖는" owner-funded 모델을
> 라이브로. 이 문서 §3-D(owner-funding)·§2(예산캡)가 코드로 이미 존재 — 활성은 **스테이징 실결제 검증 후
> 게이트 flip** (잠금파일 룰). 아래 순서 **엄수**(순서 틀리면 플랫폼 누수).

**전제**: 실 Toss 키로 소액 결제 가능한 스테이징 배포 존재(대표 확인 2026-07-05 "있음/만들 수 있음").

**활성 순서 (스테이징 → 라이브, 각 단계 검증 후 다음)**
1. **예산캡 먼저** — `commission_budget_enabled='true'` (staging). 트리추천+영입 겹친 3P 주문 결제 →
   `commission_budget_logs` 에 Σ적립 ≤ 예산 확인 + 환불 시 역전 대칭 확인. (플랫폼 보호막 먼저.)
2. **owner-funding** — `promo_funding_source='owner'` (staging). 이용권 구매→사용 → `ledger_entries` 에
   promo debit 1행(매장 몫에서 차감) + 어필리에이트 딜 적립 유지 확인 + 환불 시 promo 복원 확인.
   → 이 단계가 켜져야 매장이 건 소개비를 **매장이** 문다(플랫폼 아님).
3. **셀러 소개비 필드** — 위 1·2 가 staging 에서 green 이면:
   - 서버: `seller_promo_field_enabled='true'` (staging → 검증 후 라이브).
   - 클라: `src/shared/feature-flags.ts` `SELLER_PROMO_FIELD_ENABLED=true` 로 바꿔 **배포**(빌드타임 플래그).
   - 검증: 이용권 등록 시 소개비 20% 입력 → 추천 링크 판매 → 매장 실수령 = 판매가−5%−20%,
     인플루언서 딜 적립 = 20%, 유어딜 = 5%−(예산캡 내 플랫폼부담분). 캡·owner-funding 로 플랫폼 음수 불가.
4. **라이브 flip** — staging green 후 라이브 platform_settings 3키 + 클라 플래그 배포. 첫 주 `commission_budget_logs`·원장 대조.

**롤백**: 어느 단계든 해당 게이트를 이전 값으로 되돌리면 즉시 현행 복귀(클라 플래그는 재배포 필요).
소개비 필드만 끄려면 `seller_promo_field_enabled='false'` — 서버가 referral_commission_rate 저장을 즉시 중단.

**주의(누수 방지)**: 3번(셀러 필드)을 2번(owner-funding) 없이 켜면 매장 소개비를 **플랫폼이 부담**(설계 §1 −14% 노출).
서버 게이트가 백스톱이지만, 순서를 지켜 owner-funding ON 상태에서만 필드 ON 할 것.

## ✅ 구현 로그
- 2026-07-04 설계 작성.
- 2026-07-04 **§3 전체 구현** (같은 브랜치 — 커밋 해시는 PR #446): commission-budget.ts(+유닛) ·
  헬퍼 4종 compute/override · order-commissions 오케스트레이터(게이트 OFF=현행 byte-동일) ·
  promo owner-펀딩(이용권 debit/쇼핑 fee/그림자 promo/환불 역전) · 월예산 캡 2종 ·
  payment.routes [UNLOCK] 통합 · check-commission-budget 가드(audit-gate+verify strict).
  구현 중 정제 2건: ① 캡 적용 범위 3P 한정(1P=F4) ② 1단계 그림자 로깅 생략(게이트-off 순수 배포).
  신규 발견 F5(숙소 referral 직접 INSERT — 예산 밖, 가드 베이스라인 등재) ·
  F6(/track 경로 — 동일) · F7(공구 딜결제 agency credit 2곳 — 래칫 등재, 통합은 별도 결정).
  ⚠️ 활성화는 staging 실결제 검증 후(§5 2단계).
- 2026-07-04 **후속 3건** (같은 세션 "더 진행해줘 이상적으로"):
  ① **F2 확정+수정**: 이용권 이중 커미션 실재 확인 — 영입 매장 이용권 1건에 에이전시(확정 GMV 1~2% +
  사용시 수수료 30%=GMV 1.5%)·크리에이터(확정 1.5% + 사용시 수수료 20%=GMV 1.0%) 이중 적립,
  합계 최대 GMV 6% > 수수료 5%. 수정: `ledger.ts` 사용시점 셰어 2함수에 **주문 단위 dedup**
  ([INV-CB-DEDUP] — 확정 시 적립이 있으면 skip, 없으면 레거시 셰어 단독 지급 = 단일-지급 보장).
  가드 R3(마커 2개 존재) 추가 — dedup 제거 회귀 차단.
  ② **F7 봉합**: 오케스트레이터에 `only` 축 필터 additive → group-buy 딜/카드 결제의 agency 적립
  2곳을 `creditOrderCommissions(..., { only: ['agency_intro'] })` 경유로(행동 불변 + 게이트 ON 시
  예산 캡 적용). 가드 R1 베이스라인에서 group-buy 예외 제거(예외 1곳 감소).
  ③ **어드민 스위치 UI**: `/admin/platform-settings` 에 [INV-CB] 섹션 — 5키 전부 편집 가능
  (select 2종 + 숫자 3종, staging 경고 문구 포함). 서버는 제네릭 upsert 라 무수정.
- 2026-07-05 **Q10 캡 관측성 + 에이전시 우선 보전** (운영 준비 13문항 감사 — 대표 "모두 이상적으로"):
  ① `allocateCommissions(requests, budget, { priorityKeys })` additive — 우선 축을 예산에서 먼저
  전액(min(요청, 잔여)) 배정 후 나머지가 잔여를 비례 배분. 미전달=기존과 byte-동일. [INV-CB]
  (Σ≤budget, granted≤requested) 어느 모드든 성립 — 유닛테스트(우선/초과/여유/미전달 동일성/property) 추가.
  ② 오케스트레이터 기본 `priorityKeys=['agency_intro']`("에이전시 1% 보호 최우선" 자문 반영) —
  `platform_settings.commission_priority_axes`(CSV, 빈값=우선 없음) 로 조정.
  ③ 캡 **발동 시에만**(Σ요청>예산) `commission_budget_logs`(order_id·budget·requested·granted·축별 JSON)
  1행 기록(평시 write 0, fail-soft) → `GET /api/admin/tools/commission-budget-logs` + 설정 페이지
  "커미션 캡 발동 이력" 표. 캡이 언제 누굴 얼마 깎았는지 어드민이 직접 확인 가능.
