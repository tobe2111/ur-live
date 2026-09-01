# 예산 아비터(S1) — 켜도 되는지 **판정할 수 있게** 만들기

**날짜** 2026-09-01 · **서비스** 유어딜 · **머니 경로** 없음(read-only 조회 + 문서)

## 왜 지금인가

대표가 판단 대기 3건에 "모두 다 해줘" 라고 했고, 그중 ③b 가 **예산 아비터 점등**이었다.
그런데 이 게이트는 **2026-07-04 에 배선되고 두 달 넘게 미검증**으로 남아 있었다. 이유가 분명하다:

> 통과 기준이 *"Σ적립 ≤ 주문당 예산"* 인데, 그걸 보려면 `affiliate_earnings` ·
> `referral_commissions` · `influencer_attributions` · `agency_store_intro_commissions` ·
> `ledger_entries` 를 **손으로 조회해 더해야** 했다.

**손으로 더해야 하는 검증은 아무도 안 한다.** 그래서 이번엔 게이트를 켜는 대신
**판정을 서버가 내놓게** 했다. 켜는 것은 그다음이고, 그건 대표가 어드민에서 한다.

## 무엇을 했나

1. **`GET /api/admin/promo-ledger/order/:orderNumber`** (신규, read-only, finance 권한)
   주문 하나에 대해 — 예산(실제 원장 fee − PG 준비금) · 성장 커미션 4축 적립 · `platform:revenue`
   credit/debit · 그리고 **`verdict` 세 줄**:
   `within_budget` · `over_by_krw` · `platform_revenue_untouched`([INV-#44]).
2. **`docs/STAGING_CHECKLIST.md` §S1 절차** — 준비물(겹친 주문을 만드는 조건) → 4단계 실행 →
   무엇을 보면 판정되는지.
3. `OPS_GATES` 의 `turn_on_when` 에 그 판정 방법을 적었다(어드민 화면에 그대로 뜬다).

## 🔑 예산은 **실제 원장 fee** 로 계산한다

요율을 이 화면에서 다시 계산하면 실제 청구와 갈린다 — 갈리는 것이 이 레포의 단골 사고다
(2026-08-27 채널 요율 표시가 실제 청구와 달랐던 건과 같은 클래스). 그래서 이 주문의
`ledger_entries.fee_amount` 합을 진실로 삼는다.

## ⚠️ 헷갈리기 쉬운 것 — 두 기준을 섞지 말 것

`platform_revenue_untouched: false` 는 **지금은 정상**이다. flip(promo 재원 전환) 전에는
에이전시·영입 커미션이 플랫폼 부담이라 `platform:revenue` 를 debit 한다.
그 줄이 `true` 가 되는 것은 **8월 promo flip** 의 통과 기준이지 **S1** 의 기준이 아니다.

## 다음 세션의 첫 액션

1. staging 에서 §S1 절차 4단계를 돌린다. **1번에서 `within_budget: false` 가 나와야 정상**이다 —
   그게 이 게이트가 필요하다는 증거다. `true` 가 나오면 커미션 축이 안 겹친 것이니 준비물 B를 다시.
2. 2~4번 통과 → S1 상태 ✅ + 날짜. **프로덕션 점등은 대표가 어드민에서.**
3. 아직 남은 것: flip(§commission-funding-restructure 갭 표의 C2/C3 owner 이전)은 별개 작업이고
   **단독 세션 + staging 실결제** 룰이 붙는다.
