# 🧪 STAGING 검증 체크리스트 (SSOT)

> **2026-07-05 신설 (대표 승인 "모두 이상적으로 진행" — 1인 운영 유지보수 개선)**
>
> CLAUDE.md audit log 곳곳에 흩어져 있던 "⚠️ staging 실결제 검증 필수" 항목을 한 곳으로 통합.
> **게이트 플래그는 여기 시나리오를 통과하기 전에 프로덕션에서 켜지 말 것.**
> 어드민 현황판: `/admin/system-monitoring` → "게이트·하트비트" 탭 (`GET /api/admin/ops-status`)
> — 어떤 게이트가 활성인지 + S# 검증 참조가 표시됨.
>
> **운영 룰**:
> 1. 항목 검증 통과 시 아래 표의 상태를 ✅ + 날짜로 갱신하고 같은 커밋에 기록.
> 2. 새 게이트/staging-필수 기능이 생기면 **같은 커밋에서** 이 문서에 항목 추가
>    + `admin-system-monitoring.routes.ts` `OPS_GATES` 에 등록(staging_ref 부여).
> 3. staging 배포: `npm run deploy:staging` (`scripts/deploy-staging.sh`).
>
> ---
>
> ### 🔁 2026-09-21 대표 승인 — "staging 실결제" 는 **대표 통제 매장에서의 프로덕션 검증**으로 대체한다
>
> 결재 `docs/decisions/2026-09-19-staging-gate-unperformable.md`(대표 *"모두 승인"*, 기본안=안 2).
> **배경**: 이 규칙이 2.5개월간 **한 건도 닫지 못했다** — 프로덕션 D1 을 공유하면 의미가 없어 별도 D1 이
> 필요한데, 1인 운영에서 그 유지보수를 아무도 시작하지 않았다. 그동안 머니 경로 변경은 *"배포는 됐지만
> 검증은 안 된"* 상태로 쌓였고, **문서가 거짓말을 하고 있었다**(audit log 는 "검증 필수" 라고 적어 두지만
> 아무도 안 하고, 다음 세션은 그 문장을 믿는다). S7 이 이미 그 대안으로 실제 검증을 했다 — 그걸 규칙으로 올린다.
>
> **⚠️ 진짜 프로덕션이다.** 그래서 조건 넷을 못 박는다. 하나라도 못 지키면 그 항목은 검증하지 않는다:
>
> | | 조건 |
> |---|---|
> | ⓐ | **실매출 영향 0 을 먼저 실측** — 해당 매장·상품의 주문이 0건임을 쿼리로 확인하고 그 근거를 적는다 |
> | ⓑ | 게이트는 **검증 직후 되돌린다**(계속 켜 두려면 그건 별도 결재) |
> | ⓒ | 판정 근거는 화면이 아니라 **원장 행**(`ledger_entries`·`influencer_attributions`) |
> | ⓓ | 결과를 이 문서에 **날짜와 함께** 기록한다 |
>
> 🔴 **바뀐 것은 *어디서 검증하는가* 하나뿐이다.** 머니 경로 변경은 여전히 **단독 세션 + 결재(등급 C)**이고,
> **실제 결제는 대표가 한다** — 세션이 대신 결제하지 않는다.

## S# — 게이트 플래그 (검증 전 활성 금지)

| ID | 게이트 | 위치 | 시나리오 | 통과 기준 | 상태 |
|---|---|---|---|---|---|
| **S1** | `commission_budget_enabled='true'` | platform_settings | 영입자 커미션 + 추천트리 커미션이 **겹치는** 3P 주문 결제 → 환불 | ① Σ(모든 커미션 적립) ≤ 주문당 예산(수수료−`pg_reserve_pct`) ② 환불 시 전 커미션 역전 대칭 ③ OFF 복귀 시 기존 동작과 동일 | ⬜ 미검증 (2026-07-04 배선). **2026-09-07 결재 Q4-2 로 켜기 확정(대표)** — 이 항목 통과가 선행. 지금 살아 있는 플랫폼 부담 축은 **영입 2%(직접 입점 매장만)** 하나라 시나리오를 그에 맞춘다: ⓐ 직접 입점 매장(채널 direct · `introduced_by_influencer_id` 있음) 주문 1건 → 영입 적립 = 2% 이고 총합 ≤ 10% − `pg_reserve_pct` ⓑ 같은 매장에 추천트리(`multi_tier_enabled`)까지 켜서 겹친 주문 1건 → Σ 적립이 예산에 비례 배분돼 상한을 안 넘는다 ⓒ 중개 매장 주문 1건 → 영입 0(08-31) ⓓ 환불 → 전 커미션 역전 ⓔ OFF 복귀 → 종전 동작. 판정 근거는 `ledger_entries`·`influencer_attributions` 행과 어드민 `/admin/commission-settings` 표시값의 일치 (PR [#1394](https://github.com/tobe2111/ur-live/pull/1394) 머지됨 `95d172157`) |
| **S2** | `promo_funding_source='owner'` | platform_settings | 이용권 구매 → 매장에서 사용 → 환불 | ① 사용 시 매장 원장 promo debit **정확히 1회** ② 쇼핑 원장 fee 합산 정합 ③ 환불 시 debit 복원 | ⬜ 미검증 (2026-07-04 배선) |
| **S3** | `SHOPPING_LEDGER_ENABLED='true'` | Cloudflare env | 일반 쇼핑 주문 결제 → 환불 (쇼핑탭 재오픈 전 필수) | ① 셀러 원장 net 크레딧(gross+fee) **정확히 1회**(이용권/공구 주문은 skip — 이중적립 0) ② 환불 시 역전 → receivable 0 | ⬜ 미검증 (2026-07-01 배선) |
| **S5** | `pickup_unclaimed_policy_enabled='true'` | platform_settings | 🔴 **머니 경로 · 이미 흐르는 환불의 방향을 바꾼다**(cron `0 18` 실행 확인됨). 절차: P10 참조 | ① 게이트 OFF 로 되돌리면 **즉시 전액 환불 복귀** ② `storage` 미설정 상품은 **전액**(모르면 안 깎는다) ③ cron 2회 실행에도 **이중 환불 0**(CAS) ④ 깎인 만큼 `ledger_entries` 에 `unclaimed_forfeit` 1행 ⑤ **유어딜 5% 불변** | ⬜ 미검증 (2026-08-01 배선, 기본 OFF) |
| **S6** | `partial_refund_enabled='true'` | platform_settings | 🔴 **머니 경로.** 부분환불 금액을 사람이 정한다. 절차: P11 참조 | ① OFF 면 금액 설정 API **403**(=현행 전액 환불 그대로) ② 결제액 초과 입력이 **서버에서** 클램프 ③ 환불 실행 후엔 금액 변경 불가 ④ 저장 값이 Toss 취소·딜 비례 복원·정산 clawback 에 **그대로** 반영 | ⬜ 미검증 (2026-08-01 배선, 기본 OFF) |
| **S7** | `fee_channel_rates_enabled='true'` | platform_settings | 🔴 **머니 경로 · 플랫폼 take 율 자체를 바꾼다.** 직판 상품 주문 1건 + 중개(벤더) 상품 주문 1건 각각 결제 → 환불 | ① 직판 주문의 원장 fee 가 **10%** ② 중개 주문이 **5%** ③ 채널이 **확정된** 매장은 채널이 `sellers.commission_rate` 를 **이긴다**(2026-08-27 — 그 컬럼은 tier cron 이 덮어써서, 아래에 두면 채널 요율이 조용히 지워진다) ④ 채널 **미지정**이면 종전 경로 폴백(모르면 바꾸지 않는다) ⑤ 환불 시 fee 역전 대칭 ⑥ **유어딜 5% 불변식**([INV-#44]) 위반 0 | 🔴 **2026-08-29 라이브 ON** (대표 지시 *"채널 요율은 지금 켜줘"* — **staging 실결제 없이 켰다**). 당시 판매 중 이용권 0개·성공 주문 0건이라 잘못 걷힐 돈이 없었고, 첫 실매출 전에 맞춰 두는 판단. 저장값: `fee_channel_rates_enabled=true` / `platform_fee_pct_direct=10` / `platform_fee_pct_brokered=5`. 채널 지정된 매장은 홍대돈까스(14, brokered→5%) 하나뿐이고 나머지는 정지됨. 🔑 **2026-08-30 대표 확인: 그 홍대돈까스도 AB테스트용 가상 매장이다 — 실제 사업자 매장은 0곳.** 즉 지금 이 게이트가 영향을 주는 실제 돈은 없고, **대표가 통제하는 매장이라 실결제 검증을 여기서 돌릴 수 있다**(brokered 로 1건 → 5% 확인, `direct` 로 바꿔 1건 → 10% 확인). ✅ **2026-09-21 첫 실결제 통과** — 대표가 01:36 KST 에 홍대돈까스(14) 이용권을 **토스 카드 1,000원**으로 결제했다.
원장 실측(`ledger_entries` id=3, `reference_id=GB-3-1789611467065`): `amount=1000` · `debit=user:3` · `credit=seller:14` ·
**`fee_amount=50`(정확히 5%)** · `fee_account=platform:commission`. 홍대돈까스는 `seller_meta.store_channel='brokered'` 이므로
**중개 요율 5% 가 채널대로 찍혔다**(①직판 10% 는 아직 미측정 — 직판 채널 매장의 주문이 0건). 유어딜 5% 불변식 위반 0.
⚠️ **남은 검증**: ⑤ **환불 시 fee 역전 대칭**(그 주문을 환불해 원장 역전 1행 확인) + ① 직판 10%(채널을 `direct` 로 바꿔 1건). 롤백은 `/admin/platform-settings` 에서 게이트를 `false` 로 (즉시 종전 동작). · 2026-08-25 손잡이 신설 · **2026-08-27 재작업**: 대행사도 자기 키에서 요율을 받고, 채널이 매장별 값보다 위로 올라갔다. 라이브 실측상 매장 7곳 전부 `commission_rate=10` 이라 그 전엔 대행사가 10% 를 냈다) |
| **S4** | `FEE_RESOLVER_ENABLED='true'` | Cloudflare env | 다양한 소유모델 주문 여러 건 결제 (그림자 — 정산 무영향) | ① `order_fee_breakdown` 에 주문당 1행 기록 ② 기록된 분배 vs 현행 정산 비교 검증 → 일치 확인 후에만 authoritative 전환 논의 | ⬜ 미검증 (2026-06-27 배선) |
| **S8** | (없음 — 상시) | 코드 | 🔴 **머니 경로 · 소개자 몫 계산이 바뀐다.** 딜 계약(`seller_influencer_deals`) 있는 매장에서 소개자 링크로 결제 1건 + 딜 없는 매장에서 결제 1건 | ① 딜 있는 주문: 소개자 몫 = **딜 % 그대로**(2% 로 안 잘림) ② 딜 없는 주문: 소개자 몫 **0원**(자동 1% 안 나감) ③ 매장 정산액이 그만큼 늘었는지 ④ `payout_method='deal'` 인 소개자가 어드민 지급대기 알림에 **뜨는지**(종전엔 계좌 없다고 누락) | ⬜ 미검증 (2026-08-30 — 대표 "자동분은 빼줘"). 게이트 없음: 머지 즉시 적용된다. **2026-09-07 결재 Q2-1("상한 없음") 로 확정** — 정산 순수함수의 옛 clamp 인자까지 제거(PR [#1392](https://github.com/tobe2111/ur-live/pull/1392) 머지됨 `6c50b8fac`). 이 항목 ①이 그 판정이다. |
| **S9** | `voucher_deal_payment_enabled='true'` + 클라 `VOUCHER_DEAL_PAYMENT_ENABLED` | platform_settings + 배포 | 🔴 **머니 경로 · 2겹 게이트.** 이용권을 딜로 결제 1건 → 매장 사용 → 환불. **선행 필수: `influencer_deal_bonus_pct=0`** | ① 게이트 OFF 면 이용권 딜 결제가 **400 `DEAL_PAYMENT_NOT_ALLOWED`**(=이 PR 이 닫은 기존 구멍) ② 교환권(`deal_only=1`) 딜 결제는 **영향 0** ③ 딜 차감이 **무상 버킷 우선**, 정확히 1회 ④ 매장 원장 크레딧이 카드 결제와 **동일 금액** ⑤ 환불 시 딜이 **무상으로** 복원(현금 유출 0) ⑥ 보너스가 0 인지 재확인 — 20% 면 건당 8~14원 적자 | 🟡 **2026-09-04 라이브 ON** (대표 지시 *"머지하고, 너가 직접 켜줘"*). 선행 조건 실측 확인: `influencer_deal_bonus_pct = 0`. 게이트·클라 플래그 둘 다 켜짐. **남은 것은 실결제 1건** — 잔액 충분 계정으로 전부-딜 구매(Toss 호출 0) → 매장 원장 크레딧 → 환불 시 딜이 **무상으로** 복원. 롤백: `/admin/platform-settings` 에서 `OFF` (배포 불필요) |
| **S10** | `influencer_payout_cash_fee_pct` > 0 | platform_settings | 🔴 **머니 경로 · 인플루언서가 받는 돈이 줄어든다.** 현금 수령 소개자 1건 지급 처리 + 딜 수령 1건 | ① 수수료 0 이면 종전과 **동일 금액**(기본값) ② 율 설정 후 어드민 화면·확인창·실송금 안내가 **같은 숫자** ③ 딜 수령엔 수수료 **0** ④ 원천징수 대상액이 `총액 − 수수료` 인지 (**세무 확정 선행**) ⑤ 기타소득 원천징수가 1원 늘어난 것(부동소수점 수리) 확인 | ⬜ **배선 안 됨** — 🩸 2026-09-15 정정: 여기 *"2026-08-31 배선"* 이라 적혀 있었으나 `influencer_payout_cash_fee_pct` 가 **main 에 없다**(레포 전체 grep 0). 코드는 PR [#1269](https://github.com/tobe2111/ur-live/pull/1269) 에 있고 **아직 열려 있다.** ⇒ 검증 이전에 **머지가 선행**이다. 그때까지 이 행은 '켤 수 있는 게이트' 가 아니다 |
| **S12** | `voucher_partial_deal_enabled='true'` | platform_settings | 🔴 **머니 경로 · 결제 금액이 두 갈래로 갈린다.** 딜 잔액이 있는 계정으로 이용권 카드결제 1건 → 전액 환불 1건. 잔액이 총액보다 많은 경우도 1건 | ① 카드 청구액 + 딜 차감액 = **상품 총액**(어느 쪽도 더 걷히지 않는다) ② `orders.total_amount` 는 **총액 그대로** — 딜을 써도 매장 정산이 안 줄어든다 ③ 딜 차감 **정확히 1회**(웹훅이 또 빼지 않는지 `point_transactions` 로 확인 — 주문이 PAID 로 들어가 웹훅이 즉시 return 하는 설계) ④ 무상 딜이 **먼저** 빠진다 ⑤ 환불 시 딜이 복원되고 무상분은 무상으로 복원 ⑥ 잔액이 총액보다 많아도 카드가 최소 100원은 청구된다(전부-딜은 별도 흐름) ⑦ 게이트 OFF 복귀 시 총액과 다른 청구액은 `AMOUNT_MISMATCH` | 🟡 **2026-09-04 라이브 ON** (같은 지시). 선행 조건(`influencer_deal_bonus_pct = 0`) 실측 확인. ⚠️ **켜자마자 환불 결함 2건이 드러나 같은 날 수리**했다 — `refundOrderFully` 와 `returns.routes` 가 카드에 **총액**을 취소 요청해 `EXCEED_CANCEL_AMOUNT` 로 환불이 통째로 막히거나(전액) 딜이 따로 더 나가 과다 환불(부분)되던 것. 지금은 환불액을 카드 몫과 딜 몫으로 나눈다. **남은 것은 실결제 1건** — 딜+카드 구매 → 결제창에 `상품/딜/카드` 3줄 표시 → 환불 → **카드 몫 취소 + 딜 몫 복원, 합계 = 총액**. 롤백: 게이트 `OFF` (배포 불필요) |
| **S-CART** | `voucher_cart_enabled='true'` + 클라 `VOUCHER_CART_UI_ENABLED` | platform_settings + 배포 | 🔴 **머니 경로 · 2겹 게이트.** 이용권 장바구니로 여러 매장을 한 번에 결제. 절차 15항목: 아래 `## S-CART` 절 | ① 서로 다른 매장 이용권이 **전부** 발급되고 정산이 셀러별로 갈린다 ② 한 줄이라도 막히면 **결제창이 안 열린다**(부분 구매 0) ③ 교환권(`deal_only=1`)은 400 `DEAL_ONLY_NOT_SUPPORTED` — 딜로 살 것이 원화로 청구되지 않는다 ④ 환불 시 매장별로 각각 회수 | 🟡 **2026-09-15 서버 게이트 ① ON** (대표 "장바구니 켜줘"). ②`VOUCHER_CART_UI_ENABLED` 는 **여전히 OFF** — 담기 버튼이 없어 신규 유입 0(당시 장바구니 내 이용권 0건 실측). ①을 켠 이유는 **이 표를 실행할 수 있게 하려는 것**이다(게이트가 꺼져 있으면 S-CART 자체를 못 돈다). ⛔ **아래 15항목 실결제 미실시** — 통과 전에는 ②를 켜지 않는다. 롤백: 어드민에서 `voucher_cart_enabled='false'`(배포 불필요, 1초) |
| **S11** | `review_bonus_owner_funded='true'` | platform_settings | 🔴 **머니 경로 · 매장 정산에서 돈이 나간다.** 매장이 셀러 대시보드에서 후기 보너스 금액 설정 → 그 매장 상품에 후기 제출 → 어드민 승인 | ① 유저에게 보너스가 **먼저** 지급되고, 그 뒤에만 매장 원장 debit ② debit **정확히 1회**(`reference_id='review:{id}'` 멱등 — 같은 건 재승인해도 추가 0) ③ 게이트 OFF 로 되돌리면 판정이 `platform` 이라 **차감 0**(즉시 현행 복귀) ④ 매장이 금액을 설정하지 않았으면 게이트가 켜져 있어도 `platform`(=차감 0) ⑤ 셀러 대시보드 문구가 서버 판정(`funded_by`)과 일치 ⑥ **유어딜 5% 불변식**([INV-#44]) 위반 0 | ⬜ 미검증 (2026-09-01 배선, 기본 OFF) |

## P# — 게이트 없는 staging-필수 검증 (코드 경로 변경분)

| ID | 항목 | 시나리오 | 통과 기준 | 상태 |
|---|---|---|---|---|
| **P1** | 가상계좌(무통장) 조기확정 방어 (2026-07-01) | 가상계좌 결제 → 입금 전/후 확인 | 입금 전: 주문 `AWAITING_PAYMENT` + 재고/딜/교환권 발송 미실행. 입금 webhook 후: 확정 + KT 발송 **1회** | ⬜ |
| **P2** | 혼합결제 딜 차감 bind fix (2026-07-01, 쇼핑 재오픈 전) | 쿠폰+딜 혼합 결제 → 환불 | confirm 통과 + 딜 잔액 차감 1회 + 환불 시 복원 | ⬜ |
| **P3** | 결제 felt-latency waitUntil 이동 (2026-07-02) | 교환권 딜결제 1회 | 응답 즉시 + 교환권 수초 내 도착 + `kt-alpha-voucher-retry` 스위퍼 무발동(정상 주문) | ⬜ |
| **P4** | webhook-only 확정 알림 대칭 (2026-07-01) | 브라우저 confirm 누락 상태로 webhook 확정 / Toss측 취소 | 셀러 '결제 확정' 벨 1회 / 구매자 취소 알림 1회 | ⬜ |
| **P5** | 확정경로 side-effect 대칭 3종 (2026-06-26) | 디지털 상품·교환권·혼합결제 각 1회 (webhook-only 포함) | 디지털 보관함 발급 1회 / KT 발송 1회(이중발송 0) / 딜 차감 1회 | ⬜ |
| **P6** | TossPaymentWidget 약관 클릭-시점 검증 (2026-06-26) | 미동의 클릭 / 동의 후 결제 | 미동의: 안내+스크롤(Toss 미호출) / 동의: 정상 진행 | ⬜ |
| **P7** | 결제 셀프취소 3건 fix (AUDIT_INVARIANTS 2026-06-26, 쇼핑 재오픈 전 fix 필요) | TECHNICAL_DEBT 등록분 — fix 후 시나리오 확정 | 쇼핑 재오픈 전 fix + 검증 | ⬜ (fix 선행) |
| **P8** | 링크샵 공유 카드 (2026-07-01) | `/u/{handle}` 카톡 공유 + 하드로드 | 큐레이터 이름·프로필 OG 카드 / 로더 1종만 노출 | ⬜ |
| **P13** | 리뷰 자격 = 이용권 사용자 (2026-09-02) | 이용권 구매 후 **사용 전** 리뷰 시도 / 매장 사용 후 리뷰 | 사용 전: 403 "이용권을 사용한 뒤에" + 리워드 0 / 사용 후: 등록 + 리워드 1회(사용한 장의 주문) · 교환권·쇼핑은 종전대로 구매만으로 등록 · **배송 상품(식품/리빙)도 구매만으로 등록**(09-02 2차 — 카테고리 조건 추가) | ⬜ |
| **P14** | 이용권 셀프 사용 = 매장 확인코드 (2026-09-03 대표) | 실매장 이용권을 코드 없이 셀프 사용 시도 / 코드 입력 후 시도 / 데모 이용권 셀프 시도 | 코드 없음: 403 `STORE_CODE_REQUIRED` · 코드 일치: 사용 처리 1회 · 데모: 403 `NO_STORE` · **직원 QR 스캔(use-by-seller)은 세 경우 모두 정상 동작** | ⬜ |
| **P15** | 🥕 승인 전 매장 좌석 개방 + 정산 승인 게이트 (2026-09-20) | ① 중개사가 새 매장 등록(pending) → 그 매장 좌석으로 전환 → 이용권 등록·협업 코드 발급 ② 그 매장 이용권을 직링크로 1건 결제·사용 처리 ③ `payouts-generate` 수동 실행 ④ 어드민 승인 뒤 다시 실행 | ①: 전환 200 + 등록·발급 성공 + 메인 피드에 **미노출** · ②: 원장 `seller:{id}` credit 1행 · ③: 그 매장 `payouts` **0행**(로그 `skip unapproved seller`) · ④: `payouts` 1행(전기간 외상 회수) — 승인 전에 돈이 나가면 실패 | ⬜ |
| **P9~P11** | 🔴 **통합 실결제 절차 (결제 방문 1회)** — 공구 특가 · 미수령 환불 · 부분환불 | [gb-price-production-verification.md](./design/gb-price-production-verification.md) §통합 | 아래 §통합 실결제 표 참조 | ⬜ |
| **P12** | 자기 링크 자기 구매 보상 0 (2026-09-02 대표) | 사업자 유저가 `?ref={자기 sellers.id}` 로 이용권 카드 결제 | `affiliate/influencer` 적립 0 · 사용자 보너스 0 · 구매 자체는 정상 발급 (`gb-purchase-guards.isSelfReferral`) | ⬜ |
| **P16** | 💸 결제된 주문의 `payment_status` (2026-09-21) | 🔴 **머니 경로 · 환불 게이트를 연다.** ① 이용권 카드 결제 1건 → `orders` 행 확인 ② 그 주문을 **소비자 앱에서** 환불 요청 ③ 셀러 대시보드에서 환불 1건 ④ `repair-schema` 1회 실행 후 재실행 | ①: `payment_status='approved'`(종전 `pending`) · ②: 400 *"결제가 완료되지 않은 주문입니다"* 가 **안 뜬다**(⚠️ 공구 카드 주문은 `toss_payment_key` 가 NULL 이라 여기서 422 `PAYMENT_KEY_MISSING` 에 막힌다 — 그건 이 항목 범위 밖이고 아래 후속에 적었다) · ③: 환불 뒤 `payment_status='refunded'`(머지 전엔 `approved` 로 남아 **매출로 계속 집계**됐다) · ④: backfill 이 결제 흔적 있는 `PAID/DONE/DELIVERED` 행만 바꾸고 `CANCELLED` 57건은 **그대로**, 2회 실행해도 결과 동일(멱등) | ⬜ 미검증 |

### 🔴 통합 실결제 (대표 결제 방문 **1회**) — 2026-08-02 대표 확정 ⑥

> 🧭 **실행할 때는 [`VERIFICATION_DAY.md`](./VERIFICATION_DAY.md) 를 열어라** — 이 절의 근거를
> 반나절 순서(준비물 만드는 화면 → 결제 4건 → 다음날 조회 → 기록)로 풀어 놓은 실행서다.
> 이 절은 *무엇을 왜* 보는지, 그쪽은 *어디서 어떻게* 하는지를 담는다.

**목적**: 대표의 결제 세션 횟수를 최소화한다. 아래는 **한 번의 방문에 몇 건까지 되는지 실제로 판정**한 결과다.

⚠️ **2026-08-12 정정 — 준비물은 DB 가 아니라 화면에서 만든다.** 아래 표가 `pickup_storage=room`,
`공구가` 를 **products 컬럼처럼** 읽히게 적어 놨는데, 실측하면 그 둘은 products 에 **없다** —
`product_supply_meta` 사이드테이블의 K-V(`pickup_storage` · `gb_price`)다(products 는 컬럼 예산제).
⇒ DB 를 직접 고치려 들면 막힌다. **셀러 `/seller/products/quick`(⚡ 빠른 공구 등록)** 한 화면이
공구가·마감·픽업일·보관구분을 함께 받고 서버가 알아서 저장한다.

| 준비물(테스트 상품) | 왜 |
|---|---|
| **A** 공구가만 설정 | P9 ① |
| **B** 공구가 + tiers **병존** | P9 ② — 이중할인 없이 공구가 그대로여야 한다(더 싸면 실패) |
| **C** `voucher_expiry` 를 **오늘**로 · 보관구분 **실온(room)** | P10 — 만료를 기다리지 않으려면 상품에서 만료일을 당겨야 한다 |
| **D** 아무 소액 상품 | P11 반품용 |

**한 방문에 되는 것 (결제 4건)**
1. **P9** — A·B 결제 → 원장 플랫폼 분 = **결제액의 5%**(상시가 5% 아님) → 즉시 전액 환불
2. **P11** — D 결제 → 반품 신청 → 승인 → 검수 통과 → **금액을 결제액보다 작게 저장** → 환불 실행
   → ① Toss 취소액 = 저장액 ② 딜 **비례** 복원 ③ 초과 입력 클램프 안내 ④ 환불 후 변경 400
3. **P10 — 결제까지만.** C 결제 후 종료

**한 방문에 안 되는 것 (판정만 다음날, 결제 없음)**
- **P10 판정**: 미수령 스윕은 cron `0 18 * * *` = **KST 03:00** 에 하루 한 번 돈다.
  ⇒ 다음날 아침 어드민에서 **조회만** 한다 — 환불액이 설정 비율인지 · `ledger_entries` 에
  `unclaimed_forfeit` 1행인지 · cron 재실행에도 추가 환불 0인지.
  ⚠️ 이때 `pickup_unclaimed_policy_enabled` 가 **켜져 있어야** 한다(꺼져 있으면 전액 환불이 정상 동작).

> 🔴 **게이트를 언제 켜는가**: 아래 §점등 순서. 이 절차서의 검증은 **게이트를 켠 상태에서** 해야 의미가 있고,
> 실패하면 **즉시 끄면 현행으로 복귀**한다(전 게이트 공통 설계).

### 🔴 S12 선행 — 딜 보너스가 0 이 되기 전에는 켜지 않는다 (2026-09-01 신설)

**부분결제는 "딜을 쓸 수 있게" 하는 것이고, 딜은 지금 액면가보다 비싸다.**

`influencer_deal_bonus_pct` 의 시드 기본값이 **20** 이다(`repair-schema/column-repairs.ts`).
인플루언서가 현금 대신 딜로 정산받으면 20%가 더 붙으므로, **딜 1,000원은 유어딜에게
1,200원짜리 부채**다. 그 딜이 마진 5~10%인 이용권 결제로 흘러가면 **팔릴수록 손해**다.

| | 마크업 | 딜 보너스 | 상쇄 |
|---|---|---|---|
| 교환권(KT) | 소비자 20% | 20% | ✅ 상쇄됨 |
| **이용권** | **5~10%** | 20% | ❌ **건당 적자** |

교환권은 소비자 마크업 20%가 보너스를 상쇄해 왔다. **이용권엔 그 상쇄가 없다.**

⇒ **점등 순서**: `influencer_deal_bonus_pct = 0` **먼저** → 그다음 `voucher_partial_deal_enabled`.
   같은 이유로 PR #1272 의 `voucher_deal_payment_enabled`(전부-딜)도 같은 선행 조건을 갖는다 —
   그 PR 본문이 이 구조를 먼저 지적했고, 순서를 맞출 것.

⚠️ **이 절은 뒤늦게 추가됐다.** 2026-09-01 에 부분결제를 배선하면서 이 선행 조건을 빠뜨렸고,
같은 레일을 건드리는 PR #1272 를 읽다가 발견했다. **게이트를 만든 사람이 "무엇이 선행돼야 하는가"를
안 적으면, 켜는 사람은 그걸 알 방법이 없다.**

### 🚦 게이트 점등 순서 (2026-08-02 대표 확정 ⑤)

1. **P9 통과** → `gb_engine_enabled` ON (⚠️ 클라 `GB_ENGINE_ENABLED` 도 함께)
2. **파일럿 1호 몰 개설 시점** → 그 몰의 `wholesale_malls.consumer_path = 1`
3. **첫 픽업 공구 개설과 동시** → `pickup_unclaimed_policy_enabled` + `partial_refund_enabled` 동시 ON

각 게이트의 *"무엇이 확인되면 켜는가"* 는 **어드민 `/admin/system-monitoring` → 게이트·하트비트 탭**에
한 줄씩 표시된다(`OPS_GATES.turn_on_when`). **점등 조건 없는 게이트는 영원히 안 켜진다** —
실제로 13개가 전부 미설정인 채로 있었다.

### 🔍 게이트 판정은 **주문번호 하나**로 한다 (2026-09-15 확장)

```
GET /api/admin/promo-ledger/order/:orderNumber      (read-only, finance)
```

결제 한 건 하고 그 주문번호를 넣으면 **여섯 게이트가 한 화면에서 판정**된다. 게이트마다 표를
서너 개씩 손으로 대조해야 했던 것이 이 게이트들이 몇 달째 미검증인 이유였다 —
**손으로 세야 하는 검증은 아무도 안 한다.**

| 응답 `gates.*` | 무엇을 보나 | 통과선 |
|---|---|---|
| `s2` | 이용권 사용 시 매장 원장 promo debit | `exactly_once` · `reversal_symmetric` |
| `s3` | 쇼핑 주문 셀러 net 크레딧 | 〃 |
| `s4` | `order_fee_breakdown` 그림자 기록 | `one_row_per_order` |
| `s5` | 미수령 몰수(`unclaimed_forfeit`) | `no_double_forfeit` |
| `s6` | 사람이 정한 부분환불 금액 | `within_paid` |
| **`s8`** | **소개자 몫 = 매장이 합의한 딜 %** | `matches_deal_pct` |

🔴 **읽는 법 셋** — 안 지키면 통과가 아닌 것을 통과로 읽는다.
1. **`readable: false` 는 실패가 아니라 "판정 불가"** 다. 통과로 세지 말 것.
2. **0건은 `gate_on` 과 같이 읽는다.** 게이트가 꺼져 있으면 0건이 정상이다.
3. **`s8` 만 게이트가 없다** — 2026-08-30 머지 즉시 라이브다. 나머지는 켜야 도는 코드다.

⚠️ 이 화면이 **못 보는 것**: S8 의 ③매장 정산액 증가분·④`payout_method='deal'` 소개자의 지급대기
노출은 주문 한 건으로 판정되지 않는다(`/admin/payout-center` 에서 본다). S10 은 **코드가 아직
main 에 없다**(PR #1269 미머지).

### 🔍 S1 절차 — 손으로 더하지 않는다 (2026-09-15 신설)

S1 의 통과 기준은 *"Σ적립 ≤ 주문당 예산"* 인데, 그걸 보려면 `affiliate_earnings` ·
`referral_commissions` · `influencer_attributions` · `agency_store_intro_commissions` ·
`ledger_entries` 를 **손으로 조회해 더해야** 했다. **손으로 더해야 하는 검증은 아무도 안 한다** —
그래서 2026-07-04 에 배선된 이 게이트가 두 달 넘게 미검증으로 남았다. 이제 서버가 판정한다.

```
GET /api/admin/promo-ledger/order/:orderNumber      (read-only, finance 권한)
```

응답의 **`verdict` 두 줄**이 판정이다.

| 필드 | 뜻 |
|---|---|
| `within_budget` | Σ적립 ≤ 예산인가 — **S1 의 합격선** |
| `over_by_krw` | 넘었다면 얼마나 |

같이 오는 것: `budget`(이 주문의 실제 원장 `fee_amount` − PG 준비금) · `grants`(4축 적립,
축별 금액·행수) · `platform_revenue`(credit/debit).

**절차 4단계**

1. **게이트를 끈 채로** 결제 1건 — 커미션 축이 **겹치게**(직접 입점 매장 · `introduced_by_influencer_id`
   있음 · `multi_tier_enabled` ON). 여기서 `within_budget: false` 가 나오는 것이
   **이 게이트가 필요하다는 증거**다. `true` 가 나오면 축이 안 겹친 것이니 준비물을 다시 본다.
2. `commission_budget_enabled = 'true'` 로 켜고 같은 조건으로 결제 1건 → `within_budget: true`.
3. 그 주문을 **환불** → 4축 적립이 전부 역전되는지(`grants` 가 0 으로).
4. 게이트 `'false'` 복귀 → 종전 동작과 같은지.

⚠️ **`platform_revenue.debit_krw > 0` 은 결함이 아니다.** 2026-09-07 결재 Q4-2 로
*"유어딜 5% 는 어떤 커미션에도 안 쓴다"*(2026-07-08 원칙)가 **폐기**됐다 — 성장 커미션은
플랫폼 수수료 안에서 부담하되 총합이 예산을 못 넘게 아비터가 강제하는 쪽으로 갔다.
그래서 S1 의 합격선은 `within_budget` **하나**이고, 원장 debit 은 참고 수치다.

## 검증 데이 권장 순서 (반나절)

1. staging 배포 + `bash scripts/audit-gate.sh` GREEN 확인
2. **P1→P6** (게이트 무관 경로 변경분 — 현재 라이브에 이미 나가 있는 코드) 먼저
3. **S1→S4** 게이트를 staging 에서만 켜고 순서대로 (각각 켜기→검증→끄기, 상호간섭 배제)
4. 통과 항목 이 문서에 ✅ + 날짜 기록 → 프로덕션 게이트 활성은 별도 커밋/기록으로

## 완료 기록

| 날짜 | 항목 | 결과 | 비고 |
|---|---|---|---|
| — | — | — | 아직 없음 |

## S-QTYCAP · 1인당 구매 상한 (2026-09-14)

- [ ] 한도 미설정 상품에서 `POST /api/group-buy/:id/join` 에 `quantity: 50` → **400 `PER_PERSON_LIMIT`**
      (종전엔 100까지 통과했다. 화면은 원래 10에서 막혀 이 경로로만 재현된다)
- [ ] 상세 응답에 `qty_cap` 이 실리는지 — `curl .../api/group-buy/products/2888 | grep qty_cap`
- [ ] 어드민에서 `platform_settings.voucher_max_per_person_default` 를 3 으로 두면 스테퍼가 3에서 멈추는지
      (캐시 TTL 120초 뒤 반영)
- [ ] 셀러가 상품별 값을 5 로 두면 플랫폼 기본보다 그것이 이기는지

## S-CART — 이용권 장바구니 결제 (2026-09-15)

🔑 **스위치가 둘이다. 켤 때 반드시 같이 켠다** (2026-09-15 라이브에서 어긋난 적 있음):

| | 스위치 | 무엇 | 켜는 법 |
|---|---|---|---|
| ① | `platform_settings.voucher_cart_enabled = 'true'` | **서버 게이트 = 보안 경계** | 어드민(배포 불필요) |
| ② | `src/shared/feature-flags.ts` `VOUCHER_CART_UI_ENABLED = true` | 화면의 '담기' 진입점 | 코드 + 배포 |

🟢 **현재 상태(2026-09-15 19:0x KST)**: ① **ON** · ② **OFF**. 즉 API 는 열렸고 화면 진입점은 없다 —
이 조합이라야 위 15항목을 실제로 돌려 볼 수 있으면서 일반 사용자에겐 아무 변화가 없다.

⚠️ **①만 켜면** 아무도 담을 수 없다(버튼이 없다). **②만 켜면** 담기는 되는데 결제가 403 이라
**막다른 길**이 된다 — 담은 것이 `cart_items` 에 남고 "장바구니 결제는 아직 준비 중입니다" 만 본다.
실제로 그 상태로 배포된 적이 있고(2026-09-15), 그래서 ②를 신설해 기본 OFF 로 막았다.
**아래를 통과하기 전에는 둘 다 켜지 않는다.**

설계: `docs/design/voucher-cart-2026-09.md` · 가드: `src/tests/unit/voucher-cart-checkout-2026-09-15.test.ts`
· 짝 가드: `src/tests/unit/voucher-cart-gate-pairing-2026-09-15.test.ts`

레포가 못 재는 것만 적는다(D1·Toss 가 필요하다).

| # | 확인 | 통과 기준 |
|---|---|---|
| S-CART-1 | 게이트 OFF 상태로 `/api/group-buy/cart/init` 호출 | 403 `CART_CHECKOUT_DISABLED` — 단일 구매는 종전대로 동작 |
| S-CART-2 | 게이트 ON → **서로 다른 매장** 이용권 2종 담아 카드 결제 1회 | 이용권이 **전부** 발급 · `orders` 1행 (`seller_id` null) · `order_items` 2행 |
| S-CART-3 | 같은 결제의 정산 기록 | `donations` 가 **셀러별 2행** · `ledger_entries(group_buy_join)` 도 셀러별 2건 · 수수료 합이 총액×요율 |
| S-CART-4 | 그 주문 전액 환불 | 이용권 전부 `refunded` · 두 매장 정산이 **각각** 회수(`voucher-settlement-clawback`) · `refunded_amount` 일치 |
| S-CART-5 | 복귀 URL 의 `orderId` 를 **다른 사람 주문번호**로 바꿔 확정 시도 | 400 `INTENT_NOT_FOUND` (주인만 읽는다) |
| S-CART-6 | 1인당 한도가 걸린 상품을 한도 초과 수량으로 담아 결제 시작 | init 이 400 `PER_PERSON_LIMIT` — **결제창이 안 열린다** |
| S-CART-7 | init 후 다른 탭에서 한도를 채우고 확정 | 승인 전 400 — 카드 청구 0(토스 자동 만료) |
| S-CART-8 | 재고 1개인 상품 2장 담아 결제 | `OUT_OF_STOCK` 409 + **자동 환불** · 다른 줄 재고 원복 확인 |
| S-CART-9 | 부분결제(딜) 켜고 딜+카드로 장바구니 결제 | `orders.deal_used` 기록 · 환불 시 딜 복원 |
| S-CART-10 | 같은 `paymentKey` 로 확정 재시도(새로고침) | `idempotent: true` · 이용권 **재발급 0** |
| S-CART-11 | 가상계좌로 시도 | 발급 0 + 자동 취소(웹훅에 공구 발급이 없다) |
| S-CART-12 | 한 매장 1종만 담아 결제 | 완료 화면이 **기존 티켓**(`PaymentCompleteTicket`) — 묶음 화면이 아니다 |
| S-CART-13 | 🏷️ **교환권(`deal_only=1`) 을 카드 레일에 직접 밀어 넣기** — 화면을 거치지 않고 `POST /api/group-buy/cart/init` 에 그 상품 id 를 보낸다 | 400 `DEAL_ONLY_NOT_SUPPORTED` — **원화로 청구되지 않는다** |
| S-CART-14 | 교환권 + 이용권을 함께 골라 `/cart` 에서 주문 시도 | 주문 버튼이 **비활성**이고 이유가 화면에 있다 · 총액이 두 줄(`N원` / `N딜`)로 갈려 있다 |
| S-CART-15 | 교환권만 골라 주문 | 종전 `/checkout` **딜 모드** 로 간다(토스 옵션 없음) · 결제예정금액이 `N딜` |

## 💸 S-BROKER — 중개사 몫 유어딜 직접 송금 (2026-09-19)

**S-BROKER** — 결재 `docs/decisions/2026-09-16-broker-payout-model.md` 안 1(대표 *"일단 알겠어. 그렇게 하자."*).
게이트 `platform_settings.broker_share_enabled`(기본 `false`) · 적립 SSOT `src/worker/utils/broker-share.ts` ·
호출 2곳(`group-buy.routes` `/join`·`confirm-toss`) · 화면 `/admin/platform-settings` ⑩. **켜는 것은 대표 판단.**

| ID | 시나리오 | 통과 기준 |
|---|---|---|
| S-BROKER-1 | 중개 매장(등록 시 중개사 몫 10%) 이용권 **카드** 결제 1건(10,000원) | `influencer_attributions` 에 `source='broker_share'` **1행**(1,000원, influencer_id=중개사 user id) · `influencer_balances.pending_amount` +1,000 · 원장 `broker_share` debit=`seller:{id}` credit=`influencer:{uid}` |
| S-BROKER-2 | 같은 매장 이용권 **딜** 결제 1건 | 위와 동일하게 1행 — 결제수단에 따라 몫이 갈리지 않는다 |
| S-BROKER-3 | S-BROKER-1 주문 환불 | 그 행 `clawed_back`, 잔액 원복(`voucher-clawback` 이 order_id 로 전 행을 되돌린다) |
| S-BROKER-4 | 같은 매장에 인플루언서 딜(코드 5%)로 팔린 주문 1건 | 인플루언서 5% 행 + 중개사 10% 행 **둘 다**, 매장 정산액 = 총액 − 유어딜 5% − 5% − 10% |
| S-BROKER-5 | 게이트 OFF 복귀 후 결제 1건 | `broker_share` 행 0 — 종전과 동일 |

상태: ⬜ 미검증 (2026-09-19 배선). 통과 전 프로덕션 ON 금지.

## 🔒 S-USEGATE — 소개 커미션 사용 확인 게이트 (2026-09-16)

**S-USEGATE** — 대표 확정 *"모든게 다 이용권을 쓰고 나서 정산 할 때 정산되는거고"* (2026-09-16).

게이트: `platform_settings.payout_requires_voucher_use` (기본 OFF) · 천장: `payout_unused_max_wait_days`(기본 180).
**OFF 인 동안은 종전과 byte-동일**이라 배포만으로는 아무것도 안 바뀐다 — 켜는 것이 등급 C 다.

| # | 확인 | 통과 기준 |
|---|---|---|
| S-USEGATE-1 | 게이트 OFF 로 `influencer-payout` cron 실행 | 종전대로 환불창(T+7)만 보고 성숙 — 회귀 0 |
| S-USEGATE-2 | 게이트 ON + 이용권 **미사용** 상태로 T+7 경과 후 cron | `influencer_attributions` 가 `pending` 유지 · 송금 대기에 **안 뜬다** |
| S-USEGATE-3 | 같은 건을 매장에서 **1장 사용** 처리 후 cron | 즉시 `available` 로 성숙 · 금액이 종전과 동일 |
| S-USEGATE-4 | qty 3 중 1장만 사용한 주문 | 성숙된다 — 전량 소진을 기다리지 않는다(정상 소비자를 막지 않는지) |
| S-USEGATE-5 | 이용권이 아닌 주문(쇼핑·교환권)의 소개 적립 | 게이트와 무관하게 성숙 — 영영 갇히지 않는지 |
| S-USEGATE-6 | 만료일이 지났지만 `auto-settlement` 가 아직 안 돈 건 | `pending` 유지 → cron 이 돌면 고객 100% 환불 + `clawback` 으로 **회수**(성숙 후 회수가 아니라) |
| S-USEGATE-7 | `voucher_expiry` 미설정(무기한) 이용권, 발급 후 천장일 경과 | 성숙 — 무기한 이용권의 소개비가 영구히 갇히지 않는지 |
| S-USEGATE-8 | `/influencer/settlement` 화면 | 게이트 ON 이면 보류 라벨이 **"사용 확인 대기"** · OFF 면 "환불기간 (대기)" |

## **S-OCR** — 서류 OCR 자동 승인 (2026-09-16)

게이트 `platform_settings.ocr_auto_verify_enabled`(기본 `false`). 결재
`docs/decisions/2026-09-16-ocr-license-automation.md`.

⚠️ **게이트를 켜기 전에 S-OCR-1~3 을 먼저 통과해야 한다.** 이 축의 오판은
정상 사장님을 쫓아내거나(반려) 위조를 통과시키는(승인) 양방향 피해를 낸다.
⚠️ **Pages 바인딩은 배포 후에야 붙는다** — 배포 전 호출의 `AI_UNAVAILABLE` 은 정상이다.
🩸 **2026-09-20 실측 — 첫 라이브 호출이 Workers AI `5016` 으로 죽었다**: *"Prior to using this model, you must submit
the prompt 'agree'"*. Llama 3.2 비전은 계정 단위 **1회 라이선스 동의**가 선행이다. 09-16 부터 아무도 실제로 부르지 않아
`AI_UNAVAILABLE` 이 아닌 이 실패를 아무도 못 봤다(응답에 message 가 없어 `unreadable` 로만 보였다 — #1506 이 동봉).
동의는 대표가 `POST /api/admin/ai/agree-ocr-model` 로 1회. 그 전까지 S-OCR-1~3 은 전부 `unreadable`(모델 미가동)이다.
✅ **2026-09-21 동의 완료**(대표 "동의해" → 세션이 호출). 응답이 `5016: Thank you for agreeing to this model's terms.` 로
**에러 형태**로 온다 — 실패가 아니다(그 직후 OCR 이 실제로 읽었다). 같은 날 합성 등록증 3종으로 아래 표를 실측했다.
🩸 **완전 일치 서류 5회 호출에 `match` 0회** — 원인 셋, 둘은 우리 결함이라 고쳤다: ① 빈 응답 2/5(예외도 산문도 아닌
빈 문자열) → `ocr-license.ts` 빈 응답 1회 재시도 ② 모델이 `가리내10길` 을 `가리내 10길` 로 띄어 써서 파서가 도로명을
`10길` 로 잘라 `near` → `korean-address.ts` 한글 조각 뒤 `N길|N로` 붙이기 ③ 모델이 `클로드` 를 `글로드` 로 한 글자
틀리게 읽음(1/5) → `compareBizName` 은 의도적으로 오타를 안 봐주므로 `review`(사람 확인). ③은 결함이 아니라 설계이고,
편집거리 1 허용은 **자동 승인 문턱을 낮추는 결정**이라 대표 판단(안 하면 그 서류는 사람 큐에 남을 뿐 — 해는 없다).
④ 모델이 등록번호 칸에 개업일을 넣은 적 2/5(fill 0.75 로만 떨어짐, 판정 무영향).
✅ **①② 배포(#1508) 뒤 재호출 4회(64KB 사진)**: `match`·JSON없음(산문 "정보 없음")·`match`·빈응답(2회 시도) — **`match` 2/4**
(수리 전 0/5). 남은 실패 둘은 모델 쪽(산문 거절·빈 응답)이고 #1509 가 산문도 재시도 대상에 넣는다. 사진 크기 신호:
114KB(2.5×) 7회 중 읽음 3 · 64KB 7회 중 읽음 5 — **큰 사진이 더 자주 빈다**(표본 작음, 실사진에서 재확인).


| # | 무엇 | 통과 기준 |
|---|---|---|
| S-OCR-1 | 실제 사업자등록증 사진 5장으로 `POST /api/admin/sellers/:id/business-registration/ocr` | `extracted.fill` 평균 0.75 이상 · 상호·주소가 사람 눈과 일치 — ⏳ **대표 실사진 필요**. 절차: 사장님 계정으로 `/seller/business-info` 서류 탭에 등록증 사진 업로드(폰 사진 그대로 — 2400px·2MB 로 자동 압축) → `/admin/business-verification` 에서 그 매장의 **[사업자등록증] 버튼** → 배지(일치/확인 필요/불일치/못 읽음)·읽힘 %·상호/소재지 줄·**모델 이유**(못 읽었을 때)·`모델 원문 보기`. 한 장당 2회까지 눌러 본다(빈 응답은 서버가 이미 1회 재시도). 5장 중 `읽힘 75%+` 가 4장 이상이고 상호·소재지가 눈과 같으면 통과 |
| S-OCR-2 | 서류 소재지 ≠ 등록 매장(다른 구)인 건 | `verdict='mismatch'` · 화면이 어느 지역끼리 다른지 말한다 — ✅ 2026-09-21 매장 16(부산 해운대구 서류 ↔ 전주 덕진구 매장): `mismatch` · "다른 지역입니다 (해운대구 ↔ 덕진구)" |
| S-OCR-3 | 흐린 사진 / 잘린 사진 | `verdict='unreadable'` — **절대 `mismatch` 아님**(자동 반려의 씨앗) — ✅ 2026-09-21 매장 17(blur 5px): `unreadable` · nameCheck/addressCheck `unknown` |
| S-OCR-4 | 게이트 OFF 상태에서 완전 일치 건 | `sellers.business_registration_status` **불변** · 응답 `autoVerified=false` — ✅ 2026-09-21 매장 15 OCR 5회 뒤 `business_registration_status='pending'` 그대로(어드민 라우트는 상태를 쓰지 않는다 — `note: 자동 승인·반려는 하지 않습니다`). ✅ 배포 뒤 `match` 2/4 확인(상태는 계속 `pending`) |
| S-OCR-5 | 게이트 ON 후 완전 일치 건 | `verified` 로 1회 전이 · 어드민 audit 에 남는다 |
| S-OCR-6 | 인허가 원장에 없는 정상 매장 | `ledgerNote` 가 "이상 신호가 아닙니다" 라고 분명히 말한다(원장 커버리지 1% 미만) |
| S-OCR-7 | 🍽️ 셀러 대시보드 → 서류 탭에서 **영업신고증** 사진 업로드 | `seller_meta.food_permit_url` 에 `/api/media/...` 저장 · 새로고침해도 남아 있다 |
| S-OCR-8 | 🍽️ `?kind=business_license` 로 OCR 호출 | 응답 `kind='business_license'` · **영업신고증** 이미지를 읽는다(등록증이 아니라) |
| S-OCR-9 | 📄 **8MB 폰 사진**을 등록증·영업신고증 양쪽에 업로드 | 둘 다 성공(압축 후 ≤2MB) — 거절 문구가 뜨지 않는다 |
| S-OCR-10 | 🔒 운영자(중개사) 토큰으로 `GET /api/seller/business-info` | `food_permit_url` 이 `null` · `POST /api/seller/food-permit` 는 403 |

---

## S13 — 결제 화면에서 딜 사용액 조절 (2026-09-19, 대표 확정 "C안")

`TossWidgetPayPage.tsx` 는 **Toss V2 감사 잠금 파일**이고, 이 변경으로 `setAmount` 호출이
1 → 2 가 됐다(초기화 + 딜 조절). **SDK 의 실제 재호출 동작은 유닛으로 못 잰다** — 여기서만 판정된다.

전제: `platform_settings.voucher_partial_deal_enabled = true`, 딜 잔액이 있는 계정.
⚠️ 그 게이트를 켜기 전에 **S12**(`influencer_deal_bonus_pct = 0`)가 선행이다.

| # | 무엇 | 통과 기준 |
|---|---|---|
| S13-1 | 이용권 결제 진입 → 딜 카드에서 **전액 사용** | 카드 청구액이 즉시 줄고, 큰 숫자·CTA·토스 위젯이 **같은 금액**을 말한다 |
| S13-2 | 딜을 **0 으로** 되돌리기 | 청구액이 상품 총액으로 복귀 · '딜 사용' 줄이 사라진다 |
| S13-3 | 딜을 조절한 채 **실제 카드 승인**까지 | 승인 금액 = 화면의 카드 결제액 · 주문 생성 · 이용권 발급 |
| S13-4 | 승인 후 원장 | `orders.total_amount` = **상품 총액**(딜 차감 전) · `orders.deal_used` = 쓴 딜 · 잔액이 그만큼 줄었다 |
| S13-5 | 딜을 **상한까지** 올리기 | 카드 청구액이 **100원 밑으로 안 내려간다**(전부-딜은 상세의 딜 결제 버튼이 담당) |
| S13-6 | 🔒 URL `dealMax` 를 크게 위조한 뒤 승인 시도 | 잔액을 넘으면 **서버가 거절**(`INSUFFICIENT_DEAL`) — 카드만 긁히고 이용권이 나가는 일이 없다 |
| S13-7 | 게이트 **OFF** 상태로 진입 | 딜 카드가 **아예 안 뜬다** · 결제가 종전과 동일하게 진행된다 |
| S13-8 | 환불 | `orders.deal_used` 만큼 딜이 **되돌아온다**(`refundOrderFully` 대칭) |

⚠️ **S13-3 이 이 변경의 핵심 판정이다** — 화면이 말한 금액과 토스가 승인한 금액이 갈리면
사용자는 결제가 끝난 뒤에야 안다. 유닛은 "호출이 두 곳이고 가드가 있다"까지만 본다.
