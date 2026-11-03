# 2026-11-03 — PR 검사 동시 실행 · 충돌 생성물 분리 · 검사 중 푸시 안내 · 머지 대기열 준비

대표 *"어쨌거나 계속 충돌은 하는 것 같아 세션마다. 가장 이상적인 형태로 하여금 낭비 없이 빨리 각 세션의 배포들을 빨리 할 수 있는 방법 없을까?"* → *"가장 이상적으로 해줘"*

## 실측 (최근 3일 · 10/31 21시 ~ 11/3 21시 KST)
- PR 검사 300회: 통과 132 · **취소 125(42%)** · 실패 40. 취소된 것은 평균 **42분** 돈 뒤 — 합계 약 87시간.
  취소 원인: 다음 커밋이 내용 수정 94 · main 병합 31.
- Verify 한 번 중앙 38분 = 변경분 주입 17.5분(360~540건) + 단위 시험 10.7분 + 나머지 ~10분 — **한 줄로 차례로**.
- main 머지 109건 중 같은 파일: CLAUDE.md 19 · 주입 목록 19(어제 가드) · **`critical-css.ts` 16(생성물, 59KB 한 줄)** ·
  `surface-budgets.json` 14 · **`docs/design/README.md` 13(표 맨 위 끼워 넣기)** · 번역 6종 각 11.
- 머지 대기열은 **개인 계정 저장소라 못 켠다**(`owner.type = User`). 규칙 `23392011` 은 "최신이어야 머지" 꺼짐.

## 한 것
| 무엇 | 파일 |
|---|---|
| Verify 를 셋으로 동시에: 변경분 주입 `mutation-changed`(변경분/4분 대수, 시험 파일 수 이하 · 최대 8) · 단위 시험 `unit-tests`(3대) · 나머지 `Verify`. `Verify` 첫 단계가 둘의 결과를 대조(건너뜀 = 통과 구멍 차단) | `.github/workflows/verify.yml` · `scripts/guard-mutations-shard.mjs`(`planChangedShards`, `--plan-changed`) · `scripts/check-guard-mutations.mjs`(`--changed --shard` 허용 — 변경분 목록 위에서 배분, `--scope-json` 에 changed·groups) |
| 첫 화면 CSS 를 커밋하지 않는다 — 추적 파일은 빈 자리표시자, 빌드가 `.build.ts` 로 만들고 플러그인이 번들 때 바꿔 끼움 + 번들 대조 | `scripts/critical-css-plugin.cjs` · `scripts/build-worker.js` · `scripts/generate-critical-css.mjs` · `src/worker/generated/critical-css.ts` |
| 디자인 시안 표 = 한 줄 파일 하나(`docs/design/index/`, 89개 이관) · 목차는 생성물 | `scripts/generate-design-index.mjs` · `docs/design/README.md` |
| 이 브랜치 Verify 가 5분+ 돌고 있으면 푸시 직전 멈춰 알림(우회 `PUSH_ANYWAY=1`, 조회 실패·시간 초과는 통과) | `scripts/check-verify-in-flight.mjs` · `scripts/pre-push-gate.mjs` |
| 머지 대기열 준비: `merge_group` 트리거 + 결재 | `docs/decisions/2026-11-03-merge-queue-org-move.md` |

검증: 관련 시험 79파일 1,192건 통과 · 새/재조준 주입 전부 빨간불 확인 · 실제 `npm run build:worker` 에서 첫 화면 CSS 61,428B 번들 확인 ·
임시 작업공간에서 변경분 25건 → 3조각 12+7+6, 182건 → 2조각 92+90(합 = 변경분).

## 이어받는 세션의 첫 액션 (대표가 이 작업을 이어서 하라고 했을 때만)
- 머지 뒤 1~2일 PR 검사를 같은 방법으로 다시 잰다: `curl -sS "https://api.github.com/repos/tobe2111/ur-live/actions/workflows/verify.yml/runs?per_page=100"`
  → 취소율(종전 42%) · 통과 소요 중앙(종전 32분) · Verify 잡 중앙(종전 38분). 목표: 중앙 15분 이하.
- 이 PR 은 `verify.yml`·러너를 바꿔 **전수로** 돈다 — `mutation-changed`·`unit-tests` 잡이 실제로 도는지는 **다음 좁은 PR** 에서 처음 확인된다.

## 이번에 틀렸던 판단
- 루프 조건을 `inChanged(m)` 로 바꿨다가 그 모양을 지키는 기존 시험·주입 둘을 깨뜨렸다 → 원래 줄로 되돌림(뜻이 같으면 모양을 보존).

## 남은 결정
- 머지 대기열(조직 이전) — 결재 `docs/decisions/2026-11-03-merge-queue-org-move.md`.
- 번역 6종(각 11회) · `surface-budgets.json`(14회)은 이번에 안 건드렸다 — 번역은 파일을 이름공간별로 쪼개는 큰 변경이라 별도.
