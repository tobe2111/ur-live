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

## 2차 (같은 날 · 대표 *"더 개선할 건 없어?"* → *"다 하자"*)
- **main 배포**: 14.1분 중 9.4분이 단위 시험(한 대). → `unit-tests` 잡 4대 + `deploy` 가 `needs: unit-tests`(합친 결과가 깨지면 안 올린다)
  + 시험 실패로 배포가 시작조차 안 하면 `report-tests-failed` 가 어드민에 기록(deploy 잡의 기록 단계는 그 잡이 건너뛰어지면 안 돈다).
  가드 `main-deploy-parallel-2026-11-03`.
- **Verify 나머지 9.3분** 중 무거운 둘을 분리: `exec-cost`(빌드 → 크롬 → 실행 비용, 2.9분 · Verify 가 결과 대조) ·
  `naming-conflicts`(경고만인데 2.8분 — 머지를 막지 않으므로 대조 대상 아님). 가드 `verify-pr-shards` ⑦.

### ⚠️ 이번에 틀렸던 판단 — "고친 횟수" 를 "충돌" 로 셌다
대표께 *"번역 파일 6종 각 11회 · 화면 용량 기준 파일 14회 — 충돌 지점"* 이라고 보고했는데, 재 보니 **고친 횟수였지 충돌 수가 아니었다.**
- 번역 파일: 그 11회가 고친 자리가 **7천 줄 안에 흩어져 있다**(2934·3295·5013·5695·6216·6369·7109행 등) — git 이 알아서 합친다.
  나누는 작업(런타임 로딩 구조 변경, 관련 파일 50개)에 비해 얻을 것이 없어 **하지 않았다.**
- 화면 용량 기준 파일: 한 번 고칠 때 25~99줄이 바뀌는데, 공용 조각(`lz-common.js` 등)이 커지면 **모든 화면의 같은 줄**이 바뀐다.
  두 PR 이 동시에 첫 화면을 무겁게 하면 충돌하는 게 **맞다**(둘을 합친 무게를 다시 재야 하므로) — 파일을 나눠도 그 줄은 그대로 겹친다. **하지 않았다.**
- 대조: 첫 화면 CSS(59KB **한 줄**)·디자인 표(**맨 위 끼워 넣기**)는 구조상 충돌이 확정이라 1차에서 고친 것이 맞았다.
⇒ 다음에 충돌 지점을 고를 때는 **고친 횟수가 아니라 같은 줄을 고쳤는지**(구조)를 볼 것.
