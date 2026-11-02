# [E2] 머지 충돌 단골 파일 셋 정리 (2026-11-02)

대표: *"이러니까 계속 충돌이 되었지. 또 다른 개선 뭐 있어?"* → *"모두 개선해줘. 근데 제안서는 계속 자동 업데이트가 안돼. 3번은 더 이상적인 방법 알려줘."*

## 실측 (최근 main 머지 200건, 기록·시험·시안 폴더 제외)
| 파일 | 건수 | 원인 |
|---|---|---|
| `CLAUDE.md` | 20 | 대부분 기록(잠금 변경 기록 · E4 판정 실측 · 가드 표). 2026-11-01 분리 뒤에도 판정 기록이 다시 들어왔다(#2067) |
| `scripts/check-guard-mutations.mjs` | 8 | 2026-09-08 "새 주입은 scripts/mutations/" 규칙에 강제가 없어 인라인 배열에 계속 덧붙였다(11-02 하루 4건) |
| `docs/proposals/00-*.md` | 8 | pre-commit 이 매 커밋 재생성(이번 PR 범위 밖 — 대표에게 방법 제안) |
| `scripts/surface-budgets.json` | 7 | `--rebaseline` 이 27개 화면을 **전부** 새로 쓰고 기록을 배열 끝에 덧붙였다 |

## 바꾼 것
1. **CLAUDE.md 증가 상한** — `scripts/check-claude-md-growth.mjs`(verify strict → pre-push 도 자동). PR 하나가 4,000자 넘게 늘리거나 판정 기록 줄을 더하면 실패. 우회 `[CLAUDE_MD_GROWTH]`. 기존 판정 기록 2블록(24줄)은 `docs/handoff/2026-11-02-claude-md-verdicts-moved.md` 로 옮기고 포인터 한 줄씩.
2. **인라인 주입 동결** — `src/tests/unit/inline-mutations-frozen-2026-11-02.test.ts` (977 이하). 재조준은 허용.
3. **예산 rebaseline 범위** — `nextBaselineDoc` : 위반한 화면만 바꾸고 나머지는 커밋된 값 그대로, 기록은 `scripts/surface-budgets-history/<날짜>-<화면>.json` 파일 하나씩(JSON 의 옛 history 28건은 동결). 전부 다시 쓰려면 `--all`.
- 시험 5 + 3 + 7(기존 파일에 추가), 주입 3 + 2 + 2 전부 빨간불 확인.

## 이어받는 세션의 첫 액션 (대표가 이 작업을 이어서 하라고 했을 때만)
- 판정: 머지 뒤 2주간 `git log origin/main -100 --name-only --format= | sort | uniq -c | sort -rn | head` 에서 위 세 파일의 횟수가 줄었는지 본다.

## 틀렸던 판단
- 처음엔 CLAUDE.md 20건을 "아직 진행 중인 문제" 로 셌다. 쪼개 보니 대부분이 2026-11-01 분리 **이전**의 잠금 기록이었다(이미 해결). 분리 뒤 남은 원인은 판정 기록이었다.

## 남은 것
- 제안서(소개서 PDF) 자동 갱신 — 대표에게 방법을 제안했고 답을 기다린다(결정 전 실행하지 않음).
