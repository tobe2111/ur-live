# [E2] 승인 실행기 3회차 — 결재 `2026-09-07-actor-benefit-conflicts` 중 Q4-2 (재원 원칙 폐기 → 예산 아비터) — PR #1394 (draft, 머지 대기)

> 실행기(이 세션 바인딩) 05:18 KST 회차. 실행 순서 Q3-3(#1390 `1d0593e`) → Q2-1(#1392 `6c50b8f`) → **Q4-2**. 이 PR 로 결재의 하위 항목 다섯이 전부 반영된다.

## 무엇을 했나 (finance 역할 · 문서만 · 머니 경로 코드 무접촉)
결재 Q4-2 = *"07-08 재원 원칙 폐기 — 직접 10% 안에서 유어딜이 커미션 부담, 총합 ≤ 수수료 − PG 를 예산 아비터가 강제"*. 코드는 이미 있다(`commission-budget.ts` · `creditOrderCommissions` · 게이트 `commission_budget_enabled` 기본 OFF, 2026-07-04). 남은 것은 **문서가 반대 원칙을 여전히 최상위로 말하고 있던 것**이었다:
- `urdeal-platform-model.md` §5-3 — 08-31 재검토 문단 아래에 **⭐ 2026-09-07 확정** 문단(현행 원칙 한 줄 + 왜 적자 경로가 없는지 + flip/#44 중단 + ON 은 대표) · 한 줄 정의(§🧭)의 "재원 원칙" 참조를 폐기 표기로.
- `commission-funding-restructure.md` — §확정 원칙 머리에 🛑 폐기 블록(본문은 역사 기록으로 보존) · 불변식 #44 절에 "신설하지 않는다".
- `CLAUDE.md` 💰 절 — 08-31 블록 아래 ⭐ 2026-09-07 확정 줄.
- `actor-benefit-map.md` §3 4행 · `STAGING_CHECKLIST.md` S1 — 살아 있는 축이 영입 2% 하나라 시나리오를 그에 맞춰 ⓐ~ⓔ 로 보강.
- 결재 파일 `반영 커밋` — Q2-1 = `6c50b8f`, Q4-2 = 이 PR.

## 판정
- **라이브 동작 변화 0** — 문서뿐. 게이트는 기본 OFF 그대로.
- 다음 = **S1 staging 실결제**(대표 결제 방문) → 통과 시 대표가 `/admin/platform-settings` 에서 `commission_budget_enabled=true`. 그때 E4.

## 다음 실행기 회차
승인 항목 0 → 무동작. 결재함 open 3건(매장 영입 파이프라인 · 셀러 자동 승인 · payout 자동 승인)은 대표 답변 대기.
