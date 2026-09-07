# [E2] 승인 실행기 2회차 — 결재 `2026-09-07-actor-benefit-conflicts` 중 Q2-1 (딜 % 상한 없음) — <PR_Q2>

> 실행기(이 세션 바인딩, `trig_01BmSbMMZfpnC1TBF3xWfRGF`) 01:18 KST 회차. 실행 순서 Q3-3(→ #1390 머지 `1d0593e`) → **Q2-1** → Q4-2.

## 🔎 먼저 판정한 것 — Q2-1 은 이미 구현돼 있었다
결재 실행 계획은 *"`max_influencer_commission_pct` clamp(`matching-settlement.ts`·`marketing.routes.ts`) 제거 또는 무효화"* 라고 적혀 있는데, 코드를 열어 보니 **2026-08-30 대표 "자동분은 빼줘"** 가 이미 다 했다:
- `marketing.routes.ts /deals/propose` — `DEAL_PCT_MAX`(90) 만 검증, max 설정 안 읽음
- `commission-rates.ts calcInfluencerCommissionPct` — 딜 % 그대로, 90 clamp 만
- `deal-only-commission.test.ts` 가 둘 다 고정 · staging S8 항목이 라이브 판정
⇒ 결재 문서의 "clamp 제거 PR 대기" 는 **낡은 지도**였다(결재 항목을 쓸 때 코드를 안 열었다). 지도(`actor-benefit-map.md §3`)와 결재 파일을 사실로 고쳤다.

## 그래도 남아 있던 자투리(이번 PR · finance 역할 · 머니 경로 코드는 무런타임 변경)
- `computeMatchingSettlement` 의 선택 인자 `maxCommissionPct`(2% clamp) **제거** — 호출부 0 이라 런타임 영향 0 이지만, 인자가 남아 있으면 언젠가 누가 넘긴다. 테스트의 "clamp" 케이스를 "상한 없음" 으로 교체.
- 셀러 가이드 시드 '소개 협업' — *"플랫폼 상한 이내에서만 — 초과 시 서버가 차단"* 은 **거짓 안내**였다(서버는 2 로 안 막는다) → "매장이 정한 값 그대로, 0~90" 으로. `GUIDE_SEED_VERSION` 27 → 28.
- `SellerInfluencerDealsPage` 헤더 주석 · `AdminCommissionSettingsPage` 라벨 "— 미사용" + 설명 · `platform-settings-validation` 주석(낡은 줄 참조).
- 가드 `deal-pct-no-cap-2026-09-07.test.ts` 8건 + 주입 매니페스트 1건(정산에 2% clamp 되살리기 → 빨간불 확인).

## E2 증거
tsc 0 · vitest 3파일 pass · guard-mutations `--only` 빨간불 · pre-commit 통과.

## E4 판정 = S8 (staging 실결제, 게이트 없음)
딜 계약 매장에서 소개자 링크 결제 1건 → 소개자 몫이 딜 % 그대로(2% 로 안 잘림). 이 PR 로 **새로 바뀌는 라이브 동작은 없다**(가이드 문구·어드민 라벨뿐).

## 다음 회차
Q4-2 (finance · 머니): `STAGING_CHECKLIST` S1 항목 보강 + `urdeal-platform-model.md` §5-3 재원 원칙 문단 정리(07-08 원칙 폐기 → 직접 10% 안에서 유어딜 부담 + 예산 아비터). 게이트 ON 은 대표.
