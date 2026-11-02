# 화면별 첫 화면 무게 예산 — 변경 기록

`node scripts/check-surface-budgets.mjs --rebaseline --reason "…"` 가 **한 번에 파일 하나**
(`<날짜>-<화면들>.json`)로 여기에 쓴다. 손으로 만들지 않는다.

- 2026-11-02 이전 기록은 `scripts/surface-budgets.json` 의 `history` 에 **동결**돼 있다(옮기지 않았다).
- 왜 파일 하나씩인가: 예전엔 모든 rebaseline 이 JSON 끝에 기록을 덧붙여 **같은 자리**를 다퉜다.
  잠금 기록(`docs/locks/`)·세션 인계(`docs/handoff/`)와 같은 처방이다.
