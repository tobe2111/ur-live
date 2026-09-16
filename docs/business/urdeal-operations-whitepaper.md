> 최종 갱신 2026-09-09 · 정본은 코드와 platform_settings, 이 문서는 그 지도

# 유어딜 서비스 운영 백서

## 0. 머리말

이 문서는 대표와 앞으로 운영을 맡을 사람이 유어딜을 **하루 단위로 굴리기 위해** 읽는 한 장의 지도다.
수수료율, 정산, 커미션, 원천징수, 딜 포인트, 환불, 게이트(스위치), 결재 규칙, 운영 큐를 한 곳에 모았다.
여러 세션이 따로 만든 것들을 하나로 꿰었을 뿐, 새로 정한 것은 없다.

**이 문서가 아닌 것.** 구조(행위자, 상품 종류, 서비스 경계)의 정본은 `docs/design/urdeal-platform-model.md`,
대외 설명(사업계획, 회사소개, 입점제안)의 정본은 `docs/business/urdeal-business-plan.md`,
"지금 살아 있는 베네핏 값"의 정본은 `docs/design/actor-benefit-map.md` 다. 그 셋을 여기서 다시 쓰지 않는다.
이 백서는 **돈과 운영**만 다루고, 구조나 설명이 필요하면 그쪽으로 링크한다.

**숫자의 진실은 코드와 `platform_settings` 다.** 이 문서의 모든 수치에는 출처를 `(출처: 경로)` 로 붙였고, 값의 성격을 셋으로 나눠 표기한다.

| 표기 | 뜻 |
|---|---|
| **코드 기본값** | 소스에 박힌 폴백. `platform_settings` 에 같은 키의 행이 있으면 그 행이 이긴다 |
| **어드민 조정값** | `/admin/platform-settings` 등에서 바꾸는 `platform_settings` 키. 라이브 실제 값은 어드민에서 읽어야 안다 |
| **어드민에서 확인** | 코드에 값이 없거나, 라이브 상태를 이 문서가 단정할 수 없는 것 |

문서와 코드가 다르면 코드가 진실이고, 이 문서는 기획(`planning`) 역할이 고친다. 값을 바꾸고 싶으면 `docs/decisions/` 에 결재를 올린다.

## 1. 서비스 지도

이 레포 하나에 서비스 네 개가 들어 있다. 작업이든 보고든 **"넷 중 어디인가"를 먼저 밝힌다** (출처: `CLAUDE.md` §서비스 철저 분리, `docs/design/urdeal-platform-model.md` §1).

| 축 | 정체성 | 도메인 | 이 백서의 범위 |
|---|---|---|---|
| 🎟️ **유어딜** (소비자) | 이용권, 교환권, 동네딜을 할인가에 즉시 구매. 유어샵(`/u/{handle}`) | `urdeal.kr` | **이 문서의 본문 전부** |
| 🏪 공구 서비스 (운영자 SaaS) | 매장 업주가 자기 몰을 열고 픽업 공구를 판다. 도매몰 코드를 용도 변경해 구현 중 | `urdeal.kr/{몰슬러그}` | 한 줄만. 상세 `docs/design/operator-mall-saas-gap.md` |
| 🏭 유통스타트 (도매 B2B) | 제조사 → 판매사 도매. 2026-08-02 대표 확정으로 철거 대상 | `utongstart.com` | 정산 성숙 게이트 한 줄만(§5) |
| 📣 유어애즈 (마케팅) | 인플루언서 DB 수집, 카테고리화, 필터링. 발송은 대표가 직접 | `/ads` (별도 워커 ur-ads) | 매장 영입 파이프라인 한 줄만(§9) |

주의할 짝: **유어딜의 이용권**(소비자가 즉시 구매, `/group-buy/:id`) 과 **공구 서비스의 픽업 공구**(운영자 몰). 코드는 둘 다 `group_buy_*` 라고 부른다.

## 2. 행위자와 돈의 흐름

행위자 정의와 살아 있는 베네핏은 `docs/design/actor-benefit-map.md` §1 이 정본이다. 여기서는 **한 주문에서 돈이 어디로 가는지**만 적는다.

| 행위자 | 코드 실체 | 이 주문에서 받는 것 | 출처 |
|---|---|---|---|
| 유저 | `users` + 유어샵 자동 생성 | 없음. 담기(소개) 보상은 OFF(`affiliate_program_enabled` 행 부재 = 꺼짐) | `src/worker/utils/affiliate-credit.ts:135-140` |
| 매장 업주(사업자 유저) | `sellers.seller_type='store_owner'` | 결제액 − 플랫폼 수수료(직접 10% / 중개 5%). 인플루언서 딜 %는 이 몫에서 낸다 | `src/worker/utils/fee-resolver.ts`, `src/worker/utils/ledger-commission-policy.ts` |
| 인플루언서 | `sellers.seller_type='influencer'` | ① 매장이 제안서에 적은 딜 %(매장 부담) ② 영입 2%(직접 입점 매장만, 1년) | `seller_influencer_deals`, `src/worker/utils/influencer-store-intro-commission.ts` |
| 운영(대행)자 | `seller_operators(role='operator')` | 유어딜에서 받는 것 0. 매장 몫 안에서 매장과 직접 거래 | `src/worker/utils/seller-operators.ts`, 2026-09-04 대표 확정 |
| 유어딜 | `admin` | 3P 10% / 5%, 1P 0%, 후원 15%. PG 비용은 이 안에서 흡수 | `src/shared/constants/policy.ts`, `src/features/donations/api/donations.routes.ts:104` |

한 주문의 흐름 (이용권 10,000원, 직접 입점, 영입자 있음). 숫자는 `actor-benefit-map.md` §2 와 같다.

```
소비자 10,000 ─ Toss(카드) 또는 딜 ─▶ 유어딜
   ├─ 매장 정산 9,000        플랫폼 수수료 10% 차감(직접 입점). 딜 제안 %는 매장이 여기서 낸다
   ├─ 영입 2% = 200          영입자 influencer_attributions 적립, T+7 성숙, 원천징수 후 지급
   └─ 유어딜 1,000 − 200 − PG(≈275) = 525
중개 경유 매장이면 유어딜 500 − PG 275 = 225 이고 영입 2%는 붙지 않는다.
```

결제 확정 경로는 둘(브라우저 `/api/payments/confirm`, Toss webhook)이고 CAS 로 단일 실행을 보장한다. 확정 뒤 부수효과(재고, 커미션, 알림, KT 교환권 발송, 딜 차감)는 전부 fail-soft 에 `order_id` 멱등이다 (출처: `docs/design/urdeal-platform-model.md` §15-1).

라이브 실측(2026-09-07, `actor-benefit-map.md`): 승인 매장 1(중개 채널, AB 테스트용), 최근 30일 주문 0, payouts 0건. **위 흐름은 전부 설계값이고 아직 돈이 흐른 적이 없다.**

## 3. 결제

### 3-1. 결제수단 판정 (SSOT `src/shared/product-flow.ts` `getProductFlow()`)

카테고리 이름으로 판정하지 않는다. `meal_voucher` 라고 딜 결제가 아니다.

| 판정 순서 | 조건 | flow | 결제수단 | 무엇 |
|---|---|---|---|---|
| 1 | `deal_only === 1` | `voucher_deal` | **딜** | 교환권(기프티콘, KT). 휴대폰 즉시 발송 |
| 2 | `group_buy_status === 'active'` | `group_buy_toss` | **카드(Toss)**, 게이트 ON 시 딜 또는 딜+카드 | 이용권(식당, 뷰티, 숙박) 및 공구 |
| 3 | 그 외 | `standard_checkout` | 카드(Toss) | 일반 쇼핑(현재 탭 숨김) |

### 3-2. Toss V2 잠금

아래 파일은 대표 명시 허가(`AskUserQuestion`) 없이 수정 금지다. 변경하면 `CLAUDE.md` audit log 에 `[UNLOCK]` 기록을 남긴다 (출처: `CLAUDE.md` §Toss V2 docs audit 잠금).

`src/worker/utils/toss-gateway.ts`, `toss-error-messages.ts`, `toss-refund.ts`, `toss-payments.ts`, `refund.ts`, `src/worker/routes/payment.routes.ts`, `webhook.routes.ts`, `src/components/payments/TossPaymentWidget.tsx`, `src/pages/TossWidgetPayPage.tsx`, `src/pages/PaymentSuccessPage.tsx`, `src/shared/types/index.ts`(Toss 타입).

규칙: 새 결제 시나리오는 `confirmTossPayment()` / `cancelTossPayment()` 를 **호출만** 한다. 직접 `fetch('https://api.tosspayments.com/...')` 금지.

### 3-3. 딜 포인트

| 항목 | 값 | 성격 | 출처 |
|---|---|---|---|
| 가치 앵커 | 1딜 = 1원 | 코드 | `CLAUDE.md` §딜 포인트, `urdeal-platform-model.md` §5-1 |
| 유상 충전 | **종료**. `POST /api/points/charge/init` 가 403. `/charge/confirm` 은 진행 중 결제 완결용으로 열어 둠 | 코드 플래그 `TOPUP_DISABLED = true` (2026-07-18 대표 확정) | `src/shared/feature-flags.ts:111`, `src/features/points/api/points.routes.ts:131` |
| 후원 최소/최대 | 500딜 이상, 10,000,000딜 이하 | 코드 | `points.routes.ts:392` |
| 후원 수수료 | 15% | 어드민 조정값 `commission_rate_donation`(시드 15) + 셀러별 `sellers.donation_commission_rate` COALESCE 15.0 | `admin-misc.routes.ts:334`, `donations.routes.ts:104` |
| 유저 딜 → 현금 출금 | 최소 10,000딜, 어드민 주 1회 일괄 송금 | 코드 | `points.routes.ts:1122-1146` |
| 유상/무상 이중 버킷 | 차감은 무상 우선, 현금 출금은 유상 한도 | 코드 SSOT `src/worker/utils/point-buckets.ts` | `urdeal-platform-model.md` §5-1 |

### 3-4. 이용권을 딜로 사는 두 게이트 (2겹: 서버 키 + 클라 플래그)

| 게이트 | 서버 키 / 클라 플래그 | 코드 기본 | 라이브 상태 | 선행 조건 |
|---|---|---|---|---|
| 전부 딜 결제 | `voucher_deal_payment_enabled` / `VOUCHER_DEAL_PAYMENT_ENABLED` | false / true | **2026-09-04 라이브 ON**(대표 "너가 직접 켜줘"), 실결제 1건 미검증(S9) | `influencer_deal_bonus_pct = 0` (실측 확인됨) |
| 부분결제(딜 + 카드) | `voucher_partial_deal_enabled` | false | **2026-09-04 라이브 ON**, 실결제 1건 미검증(S12). 켠 당일 환불 결함 2건 수리됨 | 같음 |

출처: `docs/STAGING_CHECKLIST.md` S9, S12. 선행 조건의 이유: 딜 보너스 20%가 살아 있으면 1,000딜은 유어딜 부채 1,200원이고, 마진 5~10%인 이용권에 쓰이면 팔릴수록 적자다.

## 4. 수수료율 표

**같은 요율을 읽는 키가 셋이다.** 어느 키가 실제 정산을 지배하는지가 핵심이다.

| 경로 | 읽는 키 | 지금 살아 있나 | 출처 |
|---|---|---|---|
| 원장(이용권 정산) `channelPlatformRate` | `fee_channel_rates_enabled`, `platform_fee_pct_direct`, `platform_fee_pct_brokered` | **살아 있음**(게이트 ON). OFF 면 `sellers.commission_rate` 로 폴백 | `src/worker/utils/ledger-commission-policy.ts` |
| fee-resolver `loadFeeRates` | `fee_platform_pct_3p`, `fee_platform_pct_3p_direct`, `fee_agency_pct`, `fee_agency_term_months` | **그림자 기록만**(`FEE_RESOLVER_ENABLED` OFF, 정산 무영향) | `src/worker/utils/fee-resolver.ts:236-266` |
| 레거시 | `commission_rate_default`(시드 5), `commission_rate_meal_voucher`(시드 5), `sellers.commission_rate` | auto-settlement(Rail A), 어드민 셀러 등록 기본 | `admin-misc.routes.ts:334`, `auto-settlement.ts:112-122` |

| 항목 | 값 | 코드 기본 (출처) | platform_settings 키 | 게이트 | 상태 |
|---|---|---|---|---|---|
| 플랫폼 수수료 3P 직접 입점 | **10%** | `DEFAULT_FEE_RATES.platformPctDirect = 10` (`fee-resolver.ts`) | `platform_fee_pct_direct`(라이브 10), `fee_platform_pct_3p_direct` | `fee_channel_rates_enabled` | 라이브 ON 2026-08-29 (S7, 실결제 미검증) |
| 플랫폼 수수료 3P 중개 경유 | **5%** | `DEFAULT_FEE_RATES.platformPct = 5`, `PLATFORM_FEE_PCT = 5` (`policy.ts:25`) | `platform_fee_pct_brokered`(라이브 5), `fee_platform_pct_3p`, `commission_rate_default` | 같음 | 같음 |
| 플랫폼 수수료 1P(유어딜 직판) | 0% | `fee-resolver.ts` 규칙 1 | 없음 | 없음 | 코드 |
| 채널 미지정 매장 | 종전 경로(`sellers.commission_rate`)로 폴백. 새 매장은 등록 시 채널 필수 선택 | `ledger-commission-policy.ts` fail-soft, PR #1390 | 없음 | 없음 | 2026-09-08 머지 |
| 후원 수수료 | 15% | `donations.routes.ts:104` COALESCE 15.0 | `commission_rate_donation`(시드 15), `sellers.donation_commission_rate` | 없음 | 코드 |
| PG 준비금(예산 아비터의 분모) | 2.75% (코드) | `DEFAULT_PG_RESERVE_PCT = 2.75` (`commission-budget.ts`) | `pg_reserve_pct` | `commission_budget_enabled` OFF 면 미참조 | **어드민 UI 기본 표기는 2.5** (어긋남, §12-3) |
| 영입 커미션 | **2%**, 직접 입점(`store_channel='direct'`) 매장만, 미지정도 미지급 | `INFLUENCER_STORE_INTRO_PCT = 2.0` (`policy.ts:43`) | `influencer_store_intro_pct`(라이브 2) | 없음(상시) | 2026-08-27 대표 2%, 2026-08-31 직접 한정 |
| 영입 유효기간 | 12개월 (`introduced_at` 기산, `referral_bonus_until` 이 있으면 그 값 우선) | `INFLUENCER_STORE_INTRO_MONTHS = 12` | `influencer_store_intro_months` | 없음 | 코드 |
| 영입 환불 역전 창 | 7일 | `REFUND_WINDOW_DAYS = 7` (`influencer-store-intro-commission.ts:36`) | `refund_window_days`(시드 7) | 없음 | 코드 |
| 인플루언서 딜 커미션 | 매장이 제안한 % 그대로, **상한 없음**(입력검증 90), 매장 부담 | `seller_influencer_deals` | `max_influencer_commission_pct` 는 더 이상 읽히지 않음 | 없음 | 2026-09-07 결재 Q2-1 |
| 인플루언서 딜 수령 보너스 | 시드 20%, **라이브 0**(딜 결제 게이트 선행 조건) | 시드 `column-repairs.ts:731` | `influencer_deal_bonus_pct` | 없음 | 라이브 0 실측(S9) |
| 어필리에이트(담기 소개) | 2% | `AFFILIATE_COMMISSION_PCT = 2` (`policy.ts:63`) | `affiliate_commission_rate`, 스위치 `affiliate_program_enabled` | 행 부재 = OFF | **종료** 2026-08-22, 결재 Q1-1 로 0 유지 확정 |
| 멀티티어 추천 트리 | 10 / 3 / 1% | `referral-tree.routes.ts:119` | `tier1_commission_rate`, `tier2_…`, `tier3_…`, 스위치 `multi_tier_enabled` | 행 부재 = OFF | **종료** 2026-08-23 |
| 초대 보상 | 정액(딜), 월 예산 캡 | `invite-reward.ts` | `invite_reward_enabled`, `invite_reward_amount`, `invite_reward_monthly_budget_krw` | OFF | **종료** 2026-08-23 |
| 에이전시 영입 1% / 24개월 | **폐지** 2026-08-31 (`CommissionAxis` 에서 제거), 에이전시 자체 일몰 2026-09-04 | `DEFAULT_FEE_RATES.agencyPct = 1`, `agencyTermMonths = 24` 는 코드에 잔존 | `fee_agency_pct`, `fee_agency_term_months`, `agency_commission_pct`(시드 2) | 없음 | 코드 잔재. §12-3 참조 |
| 이용권 사용 시 수수료 share | 에이전시 30%, 인플 20%(플랫폼 수수료의) | `ledger.ts:235`, `INFLUENCER_INTRO_SHARE_PCT = 20` | `agency_share_pct`, `influencer_intro_share_pct` | 없음 | 에이전시 일몰 뒤 라이브 발효 여부 **어드민에서 확인** |
| 도매 공급가 | 공급자 즉시 적립(D2) | `creditSupplierOnOrder` | 없음 | 없음 | 도매몰 철거 대상 |

**예산 아비터 [INV-CB]**: 3P 주문 하나에서 플랫폼이 부담하는 비례 커미션 총합 ≤ `플랫폼 수수료 − 결제액 × pg_reserve_pct`. 초과하면 비례 축소(largest-remainder), 예산 ≤ 0 이면 전부 0. 진입점은 `creditOrderCommissions` 하나이고 우회는 `scripts/check-commission-budget.mjs` 가 막는다 (출처: `src/worker/utils/commission-budget.ts`, `order-commissions.ts`). 지금 살아 있는 플랫폼 부담 축은 영입 2% 하나라, 직접 입점에서 `10 − 2.75 − 2 = +5.25` 로 적자 경로가 없다.

## 5. 정산 (payout)

### 5-1. 원장 구조

`ledger_entries` 는 복식부기다. 모든 사건이 debit/credit 짝으로 기록되고 셀러 계정은 `seller:{id}` 문자열이다.

| 규칙 | 식 | 출처 |
|---|---|---|
| 순 receivable | **Σ(credit − fee_amount) − Σ(debit)** | `src/worker/utils/ledger.ts:477-500` `getLedgerReceivable` |
| payout 가능 잔액 | receivable − 이미 payout(pending/approved/sent) 처리분 | `ledger.ts:504-544`, `admin-payouts.routes.ts:39` |
| 신규 credit 규칙 | `fee_amount` = amount 중 payee 몫이 아닌 부분(플랫폼 수수료). net 을 그대로 credit 하면 fee_amount = 0 | `ledger.ts:484` |
| 계정 키의 한계 | 사람이 아니라 매장 행. 집계에 기간이 없다(전기간 누적) | `docs/decisions/2026-09-07-store-handover-money-cut.md` |

### 5-2. 주기와 단계

| 단계 | 누가 | 언제(KST) | 무엇 | 출처 |
|---|---|---|---|---|
| 이용권 자동정산(Rail A) | cron `auto-settlement` | 매일 03:00 (`0 18 * * *` daily lane) | 월~일 사용분 → 차주 목요일 정산. `restaurant_settlements` 생성 | `src/worker/cron/auto-settlement.ts`, `daily-lane.ts:74` |
| 원장 무결성 검사 | cron `ledger-integrity-check` | 매일 03:00 | Σdebit = Σcredit 재검 | `daily-lane.ts:99` |
| 주간 payout 생성(Rail B) | cron `payouts-generate` | **매주 월 09:45** (`*/5` 틱 위 슬롯 `45 0 * * 1`) | 잔액 **10,000원 이상** payee 별 `pending` 행 INSERT(멱등) | `scheduled.ts:452-456`, `payouts-generate.ts:33`, `policy.ts:48` |
| 승인 | **사람**(어드민, 2FA 옵트인, audit log) | 검토 후 | `PATCH /api/admin/payouts/:id/approve` → `approved`. 과다지급 가드 | `admin-payouts.routes.ts:7,166` |
| 송금 완료 마킹 | **사람** | 실제 이체 후 | `PATCH /api/admin/payouts/:id/sent` (transaction_id 기록) | 같은 파일 |
| 취소 | 사람 | sent 전 | `PATCH /api/admin/payouts/:id/cancel` | 같은 파일 |
| 인플루언서 payout | cron `influencer-payout` | 매일 04:00 (`0 19 * * *`) | T+7 성숙(pending → available) → `influencer_payout_min`(시드 100,000원) 이상이면 지급 대기, 원천징수 후 실송금 안내 | `src/worker/cron/influencer-payout.ts:6,41,76,142-147` |
| 인플루언서 송금 주기 | 설정 | 시드 monthly, 1일 | `influencer_payout_frequency`, `influencer_payout_day_of_month` | `column-repairs.ts` 시드 |
| 유저 딜 출금 | 사람(주 1회 일괄) | | 최소 10,000딜 | `points.routes.ts:1122-1146` |

어드민 화면: `/admin/payouts`, `/admin/payout-center`, `/admin/settlement`, `/admin/influencer-payouts`, `/admin/commission-withdrawals`, `/admin/withholding` (출처: `src/App.tsx` 라우트).

### 5-3. 정산 관련 게이트

| 게이트 | 뜻 | 기본 | 상태 | 출처 |
|---|---|---|---|---|
| 자동 승인 임계값 | `pending → approved` 를 원장 무결성 통과 + 건당 ≤ N + 계좌 검증 시 자동. `sent` 는 항상 사람 | 결재 기본안 N = 300,000원, 게이트 `payout_auto_approve_enabled` | **결재 open(보류)**. 대표 2026-09-08 "3번은 고민이네". **코드에 없음** | `docs/decisions/2026-09-07-payout-auto-approve-threshold.md` |
| `SHOPPING_LEDGER_ENABLED` (env) | 일반 쇼핑 매출을 원장에 net 크레딧 | false | OFF. 쇼핑 탭 재오픈 전 S3 필수 | `money-gates-inventory.md`, S3 |
| `settlement_skip_ledgered` | 원장에 잡힌 주문은 자동정산에서 제외(이중 정산 방지) | false | OFF. 원장 적립이 실제로 돌기 시작한 뒤 켠다 | `money-switch-fields.ts` |
| 도매 정산 성숙 | 공급자 정산은 라인 `line_status='SHIPPED'` 일 때만 성숙(시간만으로 지급되던 것 차단) | 코드 | 상시 | `src/features/supply/api/supply-settlement.ts:272-279` |
| 쇼핑 원장 요율 비대칭 | 쇼핑 원장은 `store_channel` 을 읽지 않고 `orders.commission_rate ?? 5` 를 쓴다 | 코드 | 쇼핑 탭 숨김이라 영향 0. 재오픈 전 배선 필요 | `order-ledger-credit.ts:41-43`, `money-gates-inventory.md` |

### 5-4. 원천징수

| 규칙 | 값 | 출처 |
|---|---|---|
| 사업소득(반복 활동, 기본) | **3.3%** (소득세 3% + 지방세 0.3%) | `src/worker/utils/tax-withholding.ts` `WITHHOLDING_RATES.business_income = 0.033` |
| 기타소득(단발 협업) | **8.8%** (8% + 0.8%) | 같은 파일 `other_income = 0.088` |
| 어느 쪽인가 | `sellers.tax_type` (`business_income` 기본 / `other_income`) | 같은 파일 `getSellerTaxType` |
| 면제 | `business_registration_status` 가 `verified` 또는 `exempt` 면 면제(사업자가 세금계산서 발행) | 같은 파일 헤더 |
| 지급조서 기준 | 연 누계 3,000,000원 | `ANNUAL_THRESHOLD = 3_000_000` |
| 호출 시점 | 정산 송금(`settlement_cash`), 교환권 발송(`voucher_order`), 딜 환급(`deal_redeem`) | `withholdAndLog()` 호출부 `seller-settlements.routes.ts:585,739` |

규칙: 새 코드는 `withholdAndLog()` 만 호출한다. `0.033`, `0.088` 직접 곱셈 금지 (출처: `CLAUDE.md`). ⚠️ 인플루언서 payout cron 은 이 헬퍼를 거치지 않고 자체 분기를 쓴다(§12-3 어긋남 4).

## 6. 커미션 재원 원칙 (시간순)

| 시점 | 결정 | 지금 상태 |
|---|---|---|
| 2026-07-04 | 커미션 예산 아비터 [INV-CB] 설계. 요율은 동결, 재원 구조만 고친다 | 코드 있음, `commission_budget_enabled` **OFF** |
| 2026-07-08 | "유어딜 5%는 어떤 커미션에도 안 쓴다". 판매 커미션 전부 매장 promo(`promo_funding_source=owner`)로 flip 예정 | **폐기**(2026-09-07) |
| 2026-08-20 | 플랫폼 수수료를 채널로 이원화: 직접 10% / 중개 5% | 코드 + 라이브 ON(2026-08-29) |
| 2026-08-31 | 대표 재검토: "10%도 받으니 07-08 전제가 바뀌었다". 확정 2건: ① 영입 2%는 직접 입점 매장만 ② 예산 아비터는 staging 뒤 켠다 | ① 코드 반영 ② S1 대기 |
| 2026-09-07 | 결재 Q4-2 승인: 07-08 원칙 폐기. **성장 커미션은 플랫폼 수수료 안에서 유어딜이 부담하되 총합 ≤ 수수료 − PG 준비금을 아비터가 강제** | 문서 정리 머지(PR #1394). 아비터 ON 은 대표가 S1 실결제 뒤 |

출처: `docs/design/commission-funding-restructure.md` §확정 원칙(폐기 표기), `urdeal-platform-model.md` §5-3, `docs/decisions/2026-09-07-actor-benefit-conflicts.md`.

현재 유효한 스위치 상태(코드 기본 기준, 라이브는 어드민 확인):

| 키 | 코드 기본 | 라이브(실측일) |
|---|---|---|
| `commission_budget_enabled` | false | OFF (2026-09-07 미설정) |
| `promo_funding_source` | `platform` | platform (owner 경로는 코드에 남되 켜지 않는다) |
| `commission_priority_axes` | `agency_intro`(어드민 UI 기본) | 어드민에서 확인. 해당 축은 2026-08-31 폐지돼 기본값이 낡았다 |
| `flip_pilot_seller_ids` | 빈 값 | 어드민에서 확인 |

## 7. 환불, 취소, 반품

| 원칙 | 내용 | 출처 |
|---|---|---|
| 캡처된 주문은 status 플립 금지 | `PAID / DONE / PREPARING / SHIPPING / DELIVERED` 는 `refundOrderFully` 경유 또는 `REFUND_REQUIRED` 차단. `status='CANCELLED'` 만 바꾸면 고객 미환불 + 커미션 미역전 | `src/worker/utils/order-refund.ts` `CANCELLABLE`, `CLAUDE.md` §머니 룰 4 |
| 전액 환불 루틴 | Toss 취소(또는 딜 환불) + CAS 상태전이(멱등) + 재고 복원 + 디지털 revoke + 부가 적립 역전 | `order-refund.ts` 헤더 |
| 부가 적립 역전(대칭) | 디지털 access revoke, affiliate 역전(+point 원장 기록), 공급자/영입자 역전, 구매자 referral_bonus 회수, 쿠폰 un-use, 이용권 정산 clawback. 전부 order_id 멱등 | `reverseOrderAncillaryOnRefund` |
| 이용권 share 원장 역전 | 원본 엔트리의 debit/credit 을 읽어 그대로 뒤집는다(flip 상태 무관 자동 대칭). `{ref}:reversal` 멱등 | `ledger-commission-policy.ts` `reverseVoucherCommissionShares` |
| 딜 복원 | 환불 시 원 버킷(유상/무상) 대칭 복원. 부분결제(딜+카드)는 환불액을 카드 몫과 딜 몫으로 나눈다(2026-09-04 수리) | `urdeal-platform-model.md` §5-1, S12 |
| 부분 반품 | `returns.routes.ts` 가 비례 역전 | `urdeal-platform-model.md` §16 |
| 적립-역전 대칭 규칙 | 새 적립을 만들면 같은 커밋에서 역전 함수를 만들고 `refundOrderFully` + `returns.routes.ts` 양쪽에 배선 | `CLAUDE.md` §머니 룰 2 |

정책 상수 (출처: `src/shared/constants/policy.ts` `REFUND_POLICY` 및 `platform_settings` 시드):

| 항목 | 값 | 성격 |
|---|---|---|
| 매장 송금 전 환불 가능 기간 | 7일 | `refund_window_days` 시드 7, 코드 기본 7 |
| 만료 이용권 자동 환불 유예 | 7일 | `VOUCHER_REFUND_AFTER_EXPIRY_DAYS` |
| 만료 이용권 보관 | 365일 | `VOUCHER_ARCHIVE_AFTER_EXPIRY_DAYS` |
| Toss 환불 재시도 | 최대 5회 | `TOSS_REFUND_MAX_RETRY` |
| 분쟁 에스컬레이션 | 24시간 | `DISPUTE_ESCALATION_HOURS` |
| 반복 분쟁 임계 | 매장 5건 / 유저 3건 | `DISPUTE_REPEAT_*_THRESHOLD` |
| 미수령 환불 정책 | 게이트 OFF, 기본 냉장 100% / 실온 100% / 유예 0일(= 항상 전액) | `src/shared/pickup-refund.ts` `DEFAULT_UNCLAIMED_POLICY` |
| 부분환불 금액 지정 | 게이트 `partial_refund_enabled` OFF 면 금액 설정 API 403(= 전액만) | `money-switch-fields.ts` |

## 8. 게이트와 스위치 목록

켜는 조건은 공통이다: **결재 C 승인 + staging 실결제(해당 S#) + 대표가 직접 켠다.** 세션과 루틴은 켜지 않는다. OFF 로 되돌리는 것은 B 등급이다 (출처: `docs/design/ai-team-operating-model.md` §2).
어드민 현황판: `/admin/system-monitoring` 게이트 탭(`OPS_GATES`, `GET /api/admin/ops-status`), 손잡이: `/admin/platform-settings` 머니 스위치 섹션.

### 8-1. 서버 게이트 (platform_settings / env)

| 키 | 저장소 | 코드 기본 | 켜는 조건 | 상태 | 출처 |
|---|---|---|---|---|---|
| `fee_channel_rates_enabled` | setting | false | S7 직판·중개 각 1건 원장 fee 확인 | **라이브 ON** 2026-08-29(실결제 없이, 실매장 0 상태) | STAGING S7 |
| `voucher_deal_payment_enabled` (+클라 플래그) | setting | false | S9, 선행 `influencer_deal_bonus_pct=0` | **라이브 ON** 2026-09-04 | STAGING S9 |
| `voucher_partial_deal_enabled` | setting | false | S12 | **라이브 ON** 2026-09-04 | STAGING S12 |
| `gb_pricing_enabled` | setting | **true**(킬스위치, 반대 방향) | 항상 ON 이 정상. 과소청구 시 false 로 즉시 상시가 | ON | `money-switch-fields.ts` |
| `commission_budget_enabled` | setting | false | S1 | OFF, 결재 Q4-2 로 켜기 확정(대표) | OPS_GATES |
| `promo_funding_source` | setting | platform | S2 | platform, 되살리려면 새 결재 | OPS_GATES |
| `pg_reserve_pct` | setting | 2.75(코드) / 2.5(어드민 UI 표기) | 아비터 ON 과 함께 | 어드민에서 확인 | §12-3 |
| `platform_fee_pct_direct` / `_brokered` | setting | 10 / 5 | 채널 게이트 ON 일 때만 읽힘 | 라이브 10 / 5 | actor-benefit-map |
| `affiliate_program_enabled` | setting | 행 부재 = OFF | `promo_funding_source=owner` 먼저. 대표 권고 기준선 매장 10곳 | OFF(종료) | OPS_GATES |
| `multi_tier_enabled`, `invite_reward_enabled` | setting | OFF | 켜지 않는다(종료 축) | OFF | OPS_GATES |
| `seller_promo_field_enabled` (+클라 플래그) | setting | false | owner 펀딩 먼저 | OFF | OPS_GATES |
| `gb_engine_enabled` (+클라 `GB_ENGINE_ENABLED`) | setting | false | P9 통과 시 | OFF | OPS_GATES |
| `pickup_unclaimed_policy_enabled` | setting | false | 첫 픽업 공구 개설과 동시(P10) | OFF | OPS_GATES |
| `partial_refund_enabled` | setting | false | 첫 픽업 공구 개설과 동시(P11) | OFF | OPS_GATES |
| `settlement_skip_ledgered` | setting | false | 원장 적립이 실제로 돌기 시작한 뒤 | OFF | OPS_GATES |
| `outreach_auto_send` | setting | false | 콜드 발송은 대표가 직접 판단. 세션이 켜지 않는다 | OFF | OPS_GATES |
| `promo_bar_enabled` | setting | false | 홍보 문구가 정해지면 | OFF | OPS_GATES |
| `SHOPPING_LEDGER_ENABLED` | env | false | 쇼핑 재오픈 + S3 | OFF | OPS_GATES |
| `FEE_RESOLVER_ENABLED` | env | false | S4 그림자 vs 현행 비교 일치 | OFF | OPS_GATES |
| `DISTRICT_AUTO_ISSUE_ENABLED` | env | false | 상권 파일럿 매장 + 예산 풀 배정 | OFF | OPS_GATES |
| `MATCHING_SETTLEMENT_ENABLED` | env | 미설정 | 문서에만 존재 | 어드민에서 확인 | `money-gates-inventory.md` |
| `BLOG_AI_DRAFTS_ENABLED` | env | false | `ANTHROPIC_API_KEY` 설정 + 주간 초안 필요 시 | OFF | OPS_GATES |
| `wholesale_auto_grade_enabled` | setting | 0 | 켜지 않는다(도매몰 철거) | OFF | OPS_GATES |
| `seller_auto_approval_enabled` | setting | (코드 없음) | 결재 승인됨, 구현 대기 | **코드에 없음** | `docs/decisions/2026-09-07-seller-auto-approval.md` |
| `payout_auto_approve_enabled` / `_max_krw` | setting | (코드 없음) | 결재 보류 | **코드에 없음** | `docs/decisions/2026-09-07-payout-auto-approve-threshold.md` |

⚠️ `docs/design/money-gates-inventory.md`(2026-08-25) 는 위 게이트가 "전부 OFF" 라고 적는다. 그 뒤 셋이 라이브 ON 됐다(08-29, 09-04). 라이브 상태는 그 문서가 아니라 어드민에서 읽을 것.

### 8-2. 클라이언트 플래그 (`src/shared/feature-flags.ts`, 자동 생성표 `docs/FEATURE_STATUS.md`)

| 플래그 | 값 | 뜻 |
|---|---|---|
| `TOPUP_DISABLED` | true | 딜 충전 종료(2026-07-18) |
| `SHOPPING_TAB_HIDDEN` | true | 쇼핑 탭 숨김(2026-06-10) |
| `LIVE_COMMERCE_SUSPENDED` | true | 라이브커머스 영구 중단 |
| `HOSTING_HIDDEN`, `COMMUNITY_PROPOSAL_HIDDEN` | true | 공구 호스팅, 동네 공구 제안 진입 숨김 |
| `REFERRAL_GROUP_DISCOUNT_DISABLED` | true | 친구초대 동적 할인 종료 |
| `SELLER_PROMO_FIELD_ENABLED`, `GB_ENGINE_ENABLED` | false | 서버 게이트와 2겹 |
| `VOUCHER_DEAL_PAYMENT_ENABLED` | true | 이용권 딜 결제 클라 표면 |
| `SELLER_STORE_ONLY_MODE` | true | 셀러 대시보드 = 매장 운영 콘솔 |
| `MATCHING_ENABLED`, `REGION_PAGES_ENABLED`, `REGION_COUNT_INCLUDE_DEMO`, `HOME_SHOWCASE_ENABLED`, `CAMPAIGN_SIGNUP_ENABLED` | true | 노출 |
| `ADS_AI_HIDDEN`, `CONSUMER_LANGUAGE_SWITCH_HIDDEN` | true | 숨김 |
| `IOS_HIDE_DIGITAL_TOPUP` | false | iOS 충전 숨김(충전 자체가 종료라 무의미) |

플래그가 켜져 있다고 그 경로가 끝까지 돈다는 뜻은 아니다. 표면 노출만 말한다.

## 9. 운영 큐 (사람이 누르는 것)

`ops` 역할이 매일 08:15 집계해 규칙 안/밖/정보부족으로 나누고, 예외만 결재로 올린다. 실제 송금, 발송, 게이트는 사람이 누른다 (출처: `.claude/agents/ops.md`).

| 큐 | 어드민 경로 | 자동화 상태 | 출처 |
|---|---|---|---|
| 셀러 승인 | `/admin/seller-approval`, `/admin/pending-sellers` | **수동**. 2026-06-12 사용자 결정 "자동승인 말고 수동". 국세청 진위는 참고 신호만(`nts_verified_at`) | `seller-registration.routes.ts:229-245` |
| 사업자정보 승인 | `/admin/business-verification` | 수동. 결재 `seller-auto-approval` 승인됨(게이트 OFF 로 배포 예정, 진위 API 키 발급은 대표), **아직 코드 없음** | `docs/decisions/2026-09-07-seller-auto-approval.md` |
| 매장 채널(직접/중개) | `/admin/platform-settings` 채널 카드, 셀러 등록 폼 | 새 매장은 필수 선택(PR #1390). 옛 미지정 매장은 이용권 등록 1단계에서 한 번 고른다(set-once) | `admin-store-channel.routes.ts` |
| 정산 승인, 송금 | `/admin/payouts`, `/admin/payout-center`, `/admin/settlement` | 생성은 cron(월 09:45), 승인과 sent 는 사람. 자동 승인 임계값은 결재 보류 | §5-2 |
| 인플루언서 지급 | `/admin/influencer-payouts` | 성숙과 대기 목록은 cron, 송금은 사람 | `influencer-payout.ts` |
| 유저 딜 출금 | `/admin/commission-withdrawals` | 주 1회 일괄, 사람 | `points.routes.ts:1126` |
| 환불, 반품 | `/admin/returns`, `/admin/orders` | 전액 환불 루틴 자동, 부분환불 금액 지정은 게이트 OFF | §7 |
| 분쟁, 신고 | `/admin/disputes`, `/admin/voucher-disputes`, `/admin/influencer-disputes`, `/admin/abuse` | 수동. 24시간 에스컬레이션 규칙(상수)만 | `policy.ts` |
| 대리등록 상품, 상품 검수 | `/admin/products`, `/admin/group-buy`, `/admin/dongnedeal-import` | 수동 | App.tsx 라우트 |
| 상권 쿠폰 영수증(경로 A) | `/admin/district-coupons`, `/admin/district-report` | 오프라인 영수증은 어드민 승인, 온라인 자동발급(경로 B)은 env 게이트 OFF | `CLAUDE.md` audit log 2026-07-13 |
| 블로그 발행 | `/admin/blog` | AI 초안은 항상 비공개 초안, 발행은 사람. 주간 cron 은 `BLOG_AI_DRAFTS_ENABLED` OFF | `CLAUDE.md` §블로그 시드 |
| 매장 영입 파이프라인 | `/admin/store-prospects` 상단 패널 | 주 20건 후보 + 제안 문구 + 추적표까지 자동, **발송은 대표**(PR #1406 머지) | `docs/decisions/2026-09-07-store-acquisition-pipeline.md` |
| 인플루언서 제휴 제안 | `/admin/influencer-outreach` | 초안까지, 발송은 대표. `outreach_auto_send` OFF | OPS_GATES |
| 결재함 | `/admin/decisions` | `docs/decisions/*.md` 가 정본, 화면은 거울 + 입력창 | `AdminDecisionsPage.tsx` |
| 게이트 현황 | `/admin/system-monitoring` | 조회 전용 | `admin-system-monitoring.routes.ts` |

## 10. 결정 규칙

### 10-1. 결정권 세 등급 (출처: `docs/design/ai-team-operating-model.md` §2)

| 등급 | 뜻 | 대표 개입 |
|---|---|---|
| **A 자율** | 하고 나서 handoff 에 기록 | 없음 |
| **B 보고 후 진행** | 세 줄(레일, 머니 접촉, 롤백) 보고하고 기다리지 않고 진행 | 사후 열람 |
| **C 결재** | `docs/decisions/` 항목 올리고 승인 전 실행 금지 | 승인/반려 |

C 인 것: 결제, 정산, 요율, 환불, 원장, 커미션 코드(+ 단독 세션 + staging 실결제) / 게이트, 플래그 ON / 이메일, 알림톡, 소셜, 블로그 **발행** / 외부 서비스 유료 전환 / 삭제, purge, D1 일괄 UPDATE / 잠금표(Toss V2, 로딩) 파일 / 명칭 SSOT, 브랜드 색, 아이콘 컨셉 / 머니 경로 PR 머지. 애매하면 한 등급 위.

### 10-2. 완료 판정 E1~E5 (같은 문서 §4)

| 등급 | 이름 | 증거 | 써도 되는 말 |
|---|---|---|---|
| E1 | 작성됨 | diff | "작성했다" |
| E2 | 검증됨 | tsc 0, vitest, 가드 GREEN, 되돌려-검증 빨강 | "검증됐다" |
| E3 | 머지, 배포됨 | 머지 해시 + main.yml 성공 | "배포됐다" |
| **E4** | 라이브 판정됨 | 라이브에서 의도한 효과를 실측 | **"완료"** |
| E5 | 사용자 판정됨 | 대표 또는 실사용자 확인 | "확정" |

모든 보고 첫 줄에 `[E등급]`. **머니 경로의 E4 는 staging 실결제**다. 실결제 없이 "완료" 금지.

### 10-3. 결재함 (`docs/decisions/`, 상태 2026-09-09)

| 파일 | 질문 | 등급/역할 | 상태 | 반영 |
|---|---|---|---|---|
| `2026-09-07-actor-benefit-conflicts.md` | 인플루언서, 매장, 중개사 베네핏 어긋남 5곳 | C / planning | **approved** ("기본안대로 모두 승인") | Q3-3 PR #1390, Q2-1 PR #1392, Q4-2 PR #1394 전부 머지. 남은 것: 대표가 S1 뒤 `commission_budget_enabled` ON |
| `2026-09-07-seller-auto-approval.md` | 셀러, 사업자정보 승인을 규칙으로 자동화(게이트 OFF 배포) | C / ops | **approved** | 반영 커밋 비어 있음(실행 대기). 공공데이터포털 API 키는 대표 |
| `2026-09-07-store-acquisition-pipeline.md` | 매장 영입 파이프라인(준비까지 자동, 발송은 대표) | C / ops | **approved** | PR #1406 머지 `4a4f292`(2026-09-08). E4 = 패널에 20곳 + 제안 문구 확인 |
| `2026-09-07-payout-auto-approve-threshold.md` | 정산 승인을 30만원 이하 자동, sent 는 사람 | C / finance | **open(보류)** "3번은 고민이네" | 기한 09-14, 대표 답 대기 |
| `2026-09-07-store-handover-money-cut.md` | 매장 손바뀜 때 과거 미지급 잔액을 새 주인에게 줄 것인가 | C / finance | **open** | 코드 측 방어(손바뀜 자물쇠, 운영자 합류 이후 정산 범위, 손바뀜 마감)는 들어감. 판정은 staging |

규칙: `approved` 인데 `반영 커밋` 이 비면 실행 대기이고, 승인 실행기(4시간, WIP 1)가 집는다. 머니 경로와 게이트 ON 은 실행기가 PR 까지만 만들고 켜는 것은 사람이다 (출처: `docs/decisions/README.md`).

## 11. AI 팀 7역할과 루틴

역할은 채팅에서 즉석으로 주지 않는다. `.claude/agents/*.md` 프론트매터가 도구, 결정권, 금지 레일을 정한다 (출처: 각 파일의 `description`).

| 역할 | 파일 | 한 줄 | 주기 |
|---|---|---|---|
| 경영 사무국 | `ceo-office` | 결재함을 비우고 다른 역할의 보고를 대표가 5분에 읽게 만든다. 결정을 대신 내리지 않는다 | 매일 |
| 기획 | `planning` | "코드에 있다 ≠ 살아 있다"를 매주 재확인, 행위자와 게이트와 로드맵을 정합시킨다 | 주 1 |
| 마케팅 | `marketing` | 유어딜 홍보 초안과 SEO 계약. 발송과 발행은 절대 하지 않는다 | 주 1 |
| 디자인 | `design` | 코레일톡 디자인 시스템과 anti-slop 규칙을 렌더해서 판정. 대시보드는 대상 아님 | 주 1 |
| 개발 | `dev` | CI, 가드, 배포, 에러, 루틴이 초록인지 매일 판정하고 빨강은 그날 고친다 | 매일 |
| 정산 | `finance` | 원장, payout, 수수료, 커미션이 코드 SSOT 및 platform_settings 와 일치하는지 매일 판정. 스위치는 절대 켜지 않는다 | 매일 |
| 운영 | `ops` | 어드민 수동 큐를 매일 판정, 규칙 안은 처리 준비까지, 예외만 결재함으로 | 매일 |

루틴 일정(설계값, `docs/design/ai-team-operating-model.md` §6):

| 루틴 | 역할 | KST |
|---|---|---|
| 개발 일일 판정 | dev | 매일 08:00 |
| 운영 일일 큐 | ops | 매일 08:15 |
| 정산 일일 판정 | finance | 매일 08:30 |
| 결재함 브리핑(월요일은 역할별 한 줄) | ceo-office | 매일 09:00 |
| 기획 주간 | planning | 월 09:30 |
| 마케팅 주간 | marketing | 화 09:30 |
| 디자인 주간 | design | 수 09:30 |
| 승인 실행기(세션 바인딩, WIP 1) | 승인 항목의 역할 | 4시간마다 |

⚠️ **현재 상태: 위 루틴은 2026-09-08 대표 지시로 비활성(일시정지)이다.** 이 사실은 레포 문서에 기록돼 있지 않고 이 백서가 첫 기록이다. 실제 켜짐/꺼짐은 claude.ai/code 의 Routines UI 가 정본이므로 거기서 확인한다. 루틴이 꺼져 있는 동안 §9 큐와 §10-3 결재함은 사람이 직접 본다.

## 12. 부록

### 12-1. platform_settings 키 사전

검증 규칙의 정본은 `src/worker/utils/platform-settings-validation.ts` `SETTING_VALIDATORS`, 시드는 `src/worker/routes/repair-schema/column-repairs.ts` 및 `admin-misc.routes.ts`, 어드민 손잡이는 `src/pages/admin-platform-settings/money-switch-fields.ts`. 라이브 값은 어드민에서 읽는다.

| 키 | 용도 | 코드 기본 / 시드 | 읽는 곳 |
|---|---|---|---|
| `fee_channel_rates_enabled` | 채널별 요율 실제 적용 | false(라이브 true) | `ledger-commission-policy.ts` |
| `platform_fee_pct_direct` | 직접 입점 요율 | 10 | 같은 파일 |
| `platform_fee_pct_brokered` | 중개 경유 요율 | 5 | 같은 파일 |
| `fee_platform_pct_3p`, `fee_platform_pct_3p_direct` | fee-resolver 그림자 요율 | 5 / 10 | `fee-resolver.ts` |
| `fee_agency_pct`, `fee_agency_term_months` | fee-resolver 에이전시(폐지 축) | 1 / 24 | `fee-resolver.ts` |
| `commission_rate_default` | 레거시 기본 수수료 | 시드 5 | `points.routes.ts:31`(폴백 10), 어드민 셀러 등록 |
| `commission_rate_meal_voucher` | 이용권 자동정산 요율(Rail A) | 시드 5, 코드 5 | `auto-settlement.ts:112` |
| `commission_rate_donation` | 후원 수수료 | 시드 15 | 어드민 설정 화면(소비 경로는 §12-3 어긋남 11) |
| `commission_rate_live` | 라이브 수수료(영구 중단 축) | 어드민에서 확인 | `settlement-automation.ts:558` |
| `commission_budget_enabled` | 예산 아비터 | false | `order-commissions.ts` |
| `pg_reserve_pct` | PG 준비금 | 2.75(코드) / 2.5(UI 표기) | `commission-budget.ts` |
| `commission_priority_axes` | 캡 발동 시 우선 보전 축 | `agency_intro`(낡음) | `order-commissions.ts` |
| `promo_funding_source` | 커미션 재원 platform/owner | platform | `owner-promo.ts` |
| `flip_pilot_seller_ids` | flip 파일럿 매장 | 빈 값 | `flip-pilot.ts` |
| `affiliate_program_enabled` | 담기 소개 프로그램 | 행 부재 = OFF | `affiliate-credit.ts:139` |
| `affiliate_commission_rate` | 어필리에이트 % | 2 | `affiliate-credit.ts:42` |
| `affiliate_hold_days`, `affiliate_use_mature_min_hours`, `affiliate_referrer_daily_cap_krw`, `affiliate_referrer_monthly_cap_krw` | 어필리에이트 성숙, 캡 | 어드민에서 확인(0 = 무제한) | `affiliate-credit.ts` |
| `multi_tier_enabled`, `tier1_commission_rate`, `tier2_…`, `tier3_…` | 멀티티어(종료) | OFF, 10 / 3 / 1 | `referral-tree.routes.ts` |
| `invite_reward_enabled`, `invite_reward_amount`, `invite_reward_monthly_budget_krw` | 초대 보상(종료) | OFF, 어드민에서 확인, 0 = 무제한 | `invite-reward.ts` |
| `agency_signup_bonus_monthly_budget_krw` | 에이전시 signup 보너스 월 예산(폐지 축) | 0 = 무제한 | `agency-store-intro-commission.ts` |
| `agency_commission_pct`, `agency_commission_rate` | 에이전시 %(폐지 축) | 시드 2 | `commission-rates.ts` |
| `agency_auto_settle_legacy_enabled` | 에이전시 자동정산 레거시 | boolStr | `cron/agency-auto-settle.ts` |
| `influencer_store_intro_pct` | 영입 % | 2 | `influencer-store-intro-commission.ts` |
| `influencer_store_intro_months` | 영입 유효기간 | 12 | 같은 파일 |
| `influencer_deal_bonus_pct` | 딜 수령 보너스 | 시드 20, 라이브 0 | `marketing.routes.ts:679` |
| `influencer_payout_min`, `influencer_payout_frequency`, `influencer_payout_day_of_month` | 인플 송금 조건 | 100,000 / monthly / 1 | `influencer-payout.ts` |
| `influencer_commission_pct`, `user_referral_bonus_pct` | 자동 referral(종료) | 0 / 0 | `commission-rates.ts` |
| `max_influencer_commission_pct` | 딜 % 상한 | 더 이상 읽히지 않음(시드 2 잔존) | 검증만 |
| `influencer_intro_share_pct`, `agency_share_pct` | 이용권 사용 시 share | 20 / 30 | `ledger.ts` |
| `platform_fee_pct`, `seller_commission_pct`, `platform_margin_pct` | 원장 분배 레거시 | 5 / 10 / 5 | `ledger.ts:132` |
| `seller_referral_bonus_pct`, `seller_referral_bonus_months` | 인플 매장 영입 추가 보너스 | 시드 1 / 6 | `seller-registration.routes.ts` |
| `refund_window_days` | 송금 전 환불 가능 기간 | 시드 7 | `helpers.ts:217` |
| `settlement_hold_days`, `auto_confirm_days`, `return_period_days` | 정산 hold, 자동 확정, 반품 기간 | 어드민에서 확인 | 검증 사전 |
| `settlement_skip_ledgered` | 원장 기록분 자동정산 제외 | false | `auto-settlement.ts:54` |
| `voucher_deal_payment_enabled`, `voucher_partial_deal_enabled` | 이용권 딜 결제, 부분결제 | false(라이브 true) | `gb-purchase-guards.ts`, `partial-deal.ts` |
| `gb_pricing_enabled`, `gb_engine_enabled`, `seller_promo_field_enabled` | 공구가 킬스위치, 공구 엔진, promo 필드 | true / false / false | `gb-order-pricing`, `seller-orders.routes.ts` |
| `pickup_unclaimed_policy_enabled`, `pickup_unclaimed_cold_pct`, `pickup_unclaimed_room_pct`, `pickup_unclaimed_room_grace_days` | 미수령 환불 정책 | false / 100 / 100 / 0 | `pickup-refund.ts` |
| `partial_refund_enabled` | 부분환불 금액 지정 | false | `return-amount.routes.ts` |
| `min_donation` | 후원 최소(검증 사전에만 존재, 코드는 500 상수) | 어드민에서 확인 | 검증 사전 |
| `free_shipping_threshold`, `default_shipping_fee`, `jeju_extra_fee`, `island_extra_fee` | 배송비(쇼핑 숨김) | 어드민에서 확인 | 검증 사전 |
| `review_reward_text`, `review_reward_image`, `review_reward_video`, `review_level_thresholds` | 리뷰 리워드(딜) | 어드민에서 확인 | 검증 사전 |
| `kakao_review_auto_approve`, `kakao_review_bonus_amount` | 카카오맵 후기 | 시드 0 / 1000 | 시드 |
| `curator_affiliate_pct`, `curator_min_withdrawal`, `curator_withholding_rate`, `host_incentive_pct`, `hosting_max_active`, `pin_max_per_user`, `seller_upgrade_threshold` | 유어샵, 호스팅 레거시 | 코드 상수 `policy.ts`(1.0 / 10,000 / 1.0 / 10 / 500,000) | 검증 사전 |
| `outreach_auto_send`, `outreach_daily_email_cap` | 인플 제휴 제안 발송 | false / 어드민에서 확인 | `seller-influencers.routes.ts` |
| `promo_bar_enabled` | 홈 프로모 바 | false | `public-utility.routes.ts` |
| `operator_support_contact` | 운영자 문의 연락처 | 빈 값 | `seller-gb.routes.ts` |
| `kt_alpha_user_id`, `kt_alpha_markup_pct`, `kt_alpha_consumer_markup_pct`, `kt_alpha_last_import_at` | KT 교환권 연동 | 어드민에서 확인 | KT-Alpha 유틸 |
| `wholesale_platform_commission_pct`, `wholesale_min_platform_margin_pct`, `supplier_daily_payout_cap` | 도매(철거 대상) | 어드민에서 확인 | supply 라우트 |
| `district_deal_bridge_enabled`, `experience_campaign_seller_create` | 상권, 체험 캠페인 | 어드민에서 확인 | 각 라우트 |
| `guide_seed_version`, `demo_price_multipliers`, `ads_*`, `cf_api_token`, `cf_account_id` | 시스템 내부(값 노출 금지) | | |

### 12-2. 용어 SSOT 요약 (출처: `CLAUDE.md` §명칭 SSOT, 2026-06-17, 08-26 대표 확정)

| 명칭 | 뜻 | 코드 실체 |
|---|---|---|
| 유저 | 회원가입한 누구나. 유어샵 자동 생성 | `users` + handle |
| 사업자 유저 | 유저 + 사업자등록 → 판매 승인. 현금 정산 | `users` + 승인된 `sellers` |
| 유어샵 | 그 사람의 진열대 `/u/{handle}`. 옛 이름 "링크샵"은 사용자 표면에서 폐기(URL 불변) | `CuratorPage` + `SellerPublicPage` |
| 이용권 | 온라인에서 할인가에 즉시 구매, 매장에서 QR/PIN 으로 사용. **카드 결제**(게이트 ON 시 딜도) | `group_buy_status='active'` + voucher 카테고리 |
| 교환권 | 기프티콘, KT. **딜 결제**, 휴대폰 발송 | `deal_only=1` |
| 담기(소개) | 누구나 남의 이용권을 내 유어샵에 담는다. 소개 커미션은 현재 0 | 핀 |
| 운영(대행) | 매장 사장님이 위임한 사람만 그 매장을 대신 판다 | `seller_operators(role='operator')` |
| 셀러 대시보드 | 도구 이름으로만 유지 | `/seller/*` |
| 판매사 / 제조사 | 도매몰 회원 명칭(유통사, 공급사 금지) | `sellers.is_distributor`, suppliers |

사람을 가리킬 때 "인플루언서, 크리에이터, 큐레이터, 셀러"는 사용자 표면에서 쓰지 않는다. 행위(담기, 운영)로 말한다.

### 12-3. 문서와 코드가 어긋난 곳 (2026-09-09 실측, 정본은 코드)

| # | 어긋남 | 어디 | 처리 |
|---|---|---|---|
| 1 | 기본 수수료 폴백이 **10%** | `points.routes.ts:31` `DEFAULT_COMMISSION_RATE = 0.10` vs `policy.ts` 5, `admin-misc` 시드 5, `CLAUDE.md` 5 | `commission_rate_default` 행이 있으면 무해. 행이 없으면 딜 결제 경로만 10%. 코드 정리 대상 |
| 2 | 플랫폼 수수료를 "3P 5% / 1P 0%" 로만 적음 | `urdeal-platform-model.md` §5-2, §15-3, §13 항목 5(3P 10→5 cutover) | 채널 이원화(직접 10 / 중개 5) 반영 필요(planning) |
| 3 | PG 준비금 기본이 둘 | 코드 2.75 (`commission-budget.ts`) vs 어드민 UI 표기 2.5 (`money-switch-fields.ts`), 설계 문서 2.5 | 아비터 ON 전에 `pg_reserve_pct` 를 어드민에서 명시 저장 |
| 4 | 원천징수 규칙이 셋 | `tax-withholding.ts`(기본 3.3, verified 면제) vs `influencer-payout.ts:142-145`(사업자번호 있으면 3.3, other_income 8.8, 그 외 **0**) vs `points.routes.ts:1126`(출금 기본 8.8) | 인플 payout 이 SSOT 헬퍼를 안 쓴다. finance 결재 대상 |
| 5 | 에이전시 % 기본이 둘, 축은 폐지인데 코드 잔존 | `fee-resolver.ts` 1% / 24개월 vs 시드 `agency_commission_pct` 2, `commission-rates.ts` 2. `actor-benefit-map.md` 는 "agencies 코드 삭제"라 하나 `FROM agencies` 참조 10곳 잔존 | 잔재 정리 대상. 정산 영향은 `agency_intro` 축 제거로 0 |
| 6 | 게이트 전부 OFF 라는 문서 | `money-gates-inventory.md`(08-25) vs 라이브 ON 3개(채널 요율 08-29, 딜 결제와 부분결제 09-04) | 그 문서는 역사 기록. 라이브는 어드민 |
| 7 | 주간 payouts-generate 가 "자리 밖, 차단" 이라는 주석 | `wrangler.toml:260,285` vs `scheduled.ts:452-456` 월 09:45 KST 슬롯으로 실제 실행 | 주석 낡음 |
| 8 | 요율 키 네임스페이스가 셋 | `fee_platform_pct_*`(그림자), `platform_fee_pct_*`(원장, 살아 있음), `commission_rate_*`(레거시) | 한 값을 세 곳에 두면 갈린다. 원장 키가 정본 |
| 9 | 결재 승인됐는데 코드 없음 | `seller_auto_approval_enabled`(approved), `payout_auto_approve_*`(open) | 실행기 대기. 켜기는 별도 결재 |
| 10 | 우선 보전 축 기본값이 폐지 축 | `commission_priority_axes` 기본 `agency_intro` vs `CommissionAxis` 에서 2026-08-31 제거 | 기본값 정리 |
| 11 | 후원 수수료 키가 소비되는지 불명 | `commission_rate_donation` 시드는 있으나 `donations.routes.ts` 는 `sellers.donation_commission_rate` COALESCE 15.0 을 읽음 | 어드민에서 값을 바꿔도 반영 안 될 수 있음. 확인 필요 |
| 12 | 인플루언서 현금 수령 수수료 | STAGING S10 이 `influencer_payout_cash_fee_pct` 를 말하나 `src/` 에 그 키 참조 0 | 코드에 없음. 어드민에서 확인 |
| 13 | 켜짐 표에 값 false | `FEATURE_STATUS.md` 가 `IOS_HIDE_DIGITAL_TOPUP`(false) 를 🟢 켜짐으로 분류 | 생성기 표기 문제, 동작 무관 |
| 14 | 루틴 상태 | 설계 문서는 8개 루틴 활성 전제 vs 2026-09-08 대표 지시로 비활성 | §11 에 기록. 레포 다른 문서엔 없음 |

### 12-4. 관련 문서

| 문서 | 무엇 |
|---|---|
| `docs/design/urdeal-platform-model.md` | 구조 SSOT(행위자, 상품 종류, 경계, 라우트) |
| `docs/business/urdeal-business-plan.md` | 대외 문서(사업계획, 회사소개, 입점제안) |
| `docs/design/actor-benefit-map.md` | 행위자별 살아 있는 베네핏 값 |
| `docs/design/commission-funding-restructure.md` | 예산 아비터 설계, 07-08 원칙(폐기) 기록 |
| `docs/design/money-gates-inventory.md` | 2026-08-25 게이트 전수(역사 기록) |
| `docs/STAGING_CHECKLIST.md`, `docs/VERIFICATION_DAY.md` | staging 실결제 시나리오 S#, P# 와 실행서 |
| `docs/FEATURE_STATUS.md` | 클라 플래그 자동 생성표 |
| `docs/design/ai-team-operating-model.md`, `.claude/agents/*.md`, `docs/decisions/` | 역할, 결정권, 결재함 |
| `docs/design/linkshop-role-model.md`, `docs/design/store-operator-model.md` | 유어샵 역할, 운영자 모델 |
| `CLAUDE.md` | 잠금표(Toss V2, 로딩), 머니 룰, 명칭 SSOT, 어드민 진단 접근 |
| `/admin/platform-model` | 이 백서를 포함한 SSOT 문서를 어드민에서 열람 |
