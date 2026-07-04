# 커미션 재원 구조 개편 (Commission Funding Restructure) — 설계 SSOT

> 작성: 2026-07-04 · 출처: 대표 승인 방향 ("수수료율은 건드리지 말고, 수수료 구조를 고쳐라 — 마켓플레이스를 '절대 잃지 않는 층'으로")
> 상태: **설계 (구현 전)** · 구현 시 이 문서 하단 구현 로그에 commit hash 기록.
> 관련: `urdeal-platform-model.md` §5 (경제 엔진) · `product-ownership-model.md` (1P/3P·promo 슬라이스) · CLAUDE.md 💸 머니 룰.

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
