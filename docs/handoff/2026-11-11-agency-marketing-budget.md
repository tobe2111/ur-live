# 2026-11-11 — 총 마케팅 비용 상한 (에이전시 수수료 + 소개비)

대표 확정: *"응 그걸로 확정하고 진행해줘"* — 결재 `docs/decisions/2026-11-11-agency-share-auto-split.md` (후속 절).
"큰 쪽 하나"와 10-11 규칙 1은 **폐기**. 수수료·소개비는 따로 받고, 합계가 사장님이 동의한 상한을 못 넘는다.

## 한 것 (④ — 저장·표시·동의. 돈 이동 0)
- 표: 새 `agency_budget_defaults`(에이전시 제안값) · 새 `agency_budget_terms`(매장별 이력). 처음엔 `agency_share_defaults` 에 ALTER 로 칸을 더했는데 컬럼 검사기가 ALTER 와 CREATE 가 섞인 표를 못 읽어 막았다 → 표를 따로.
- `agency-share.ts`: `validateBudgetPct`(0=미정 · 수수료 이상 · 90 이하) · `currentBudgetPctSql` · `setAgencyBudget`.
  `activeAgencySharesForStore` 가 `budgetPct` 도 — 상한 표를 못 읽으면 **수수료 줄은 남기고** 상한만 0(폴백 질의).
- 에이전시: 영입 카드에 "총 마케팅 비용 상한" 칸(`POST /store-invite/share {pct, budget_pct}`).
- 사장님: 초대 화면·등록 띠·카톡 카드가 같은 한 줄(`agencyCostLine`) · `/accept` 가 본 상한이 다르면 409 · 새 맡김 때 상한 저장 ·
  `[수수료 정하기]` 에 상한 칸(`POST /agency-link/share {budget_pct}`) · 마진 계산기 "상한까지 다 쓰면 최종 마진".
- 가드: share-auto ⑥ 6건 + voucher-margin 폴백 · 주입 5건 빨간불. 가이드 시드 → `GUIDE_SEED_VERSION` 65.

## 틀렸던 판단 (이번 대화에서 두 번 뒤집혔다)
- "큰 쪽 하나"를 이상적이라고 했다 — 수수료와 소개비는 **다른 일의 대가**이고 사장님 부담은 누가 팔든 같다. 하나만 주면 에이전시가 직접 팔수록 손해 → 지인 계정 우회 동기.
- 그다음 "직원 계정 소개비만 사장님 승인" — 지인 계정을 못 가린다. ⇒ 판별이 필요 없는 **합계 상한**이 답.

## 남은 것 (⑤ — 다음 단계, 머니 경로)
- 에이전시는 지금 소개비 계약을 **못 만든다**(`agency-product-scope.ts` 허용목록 밖). 소개비 계약이 *가게 단위*(`seller_influencer_deals`)라
  에이전시 이용권만으로 좁히는 설계 → 상한 검사 → 초과 시 사장님 승인 알림톡(새 템플릿, 카카오 검수는 대표) → 규칙 1 코드 제거. staging 뒤.
- 월간 명세서에 수수료·소개비·합계 나눠 보이기.
