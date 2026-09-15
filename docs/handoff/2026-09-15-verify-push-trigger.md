# 2026-09-15 — verify.yml push 트리거 제거 (필수 검사 룰셋과의 충돌)

[E2] 검증됨 — `ci-verify-coverage.test.ts` 4/4 · 주입 2건 되돌려-검증 red · `check-local-ci-parity` GREEN · YAML 파싱 OK. 라이브 판정(E4)은 다음 PR 이 "손 Re-run 없이" auto-merge 되는지로.

## 무슨 일이 있었나

대표가 이날 GitHub 에 **main 룰셋(필수 검사 `Verify`) + Allow auto-merge** 를 켰다(세션이 안내). 그러자 CI 초록인 PR 두 개(#1429·#1239)가 `mergeable_state: blocked` 로 남았다.

원인: PR 브랜치에 푸시하면 `verify.yml` 이 **pull_request 와 push 두 이벤트로 run 을 둘** 만들고, concurrency 가 push-run 을 취소한다. 그 취소본이 이름이 같은 `Verify` **check run(cancelled)** 으로 남고, 룰셋은 그것을 **실패한 필수 검사**로 센다. 58분 걸린 pull_request-run 이 초록이어도 소용없다. 룰셋이 없던 어제까지는 아무 증상이 없었다.

대표가 두 PR 의 취소본을 손으로 **Re-run** 해야 auto-merge 가 발동했다(각 +50분). 이 문서의 PR 은 그 재실행이 앞으로 매 PR 마다 필요해지는 것을 없앤다.

## 무엇을 바꿨나

| 파일 | 변경 |
|---|---|
| `.github/workflows/verify.yml` | `on.push` 블록 제거(pull_request + workflow_dispatch 만). 상단 주석에 사유. |
| `src/tests/unit/ci-verify-coverage.test.ts` | "push 쪽 skip 유지" → **"push 트리거 없음"** 으로 불변식 교체(주석 제거 후 `on:` 블록만 판정 + 제거된 주석이 0줄이면 실패). |
| `scripts/check-guard-mutations.mjs` | 기존 주입 "PR 검증이 다시 건너뛰어짐" 의 find 앵커를 `push:` → 새 주석 줄로 재조준(낡은 지도 방지). |
| `scripts/mutations/verify-push-trigger.mjs` | 신규 주입 1건: `push:` 부활 → 빨강. |

잃는 것: PR 을 안 연 브랜치의 CI 피드백. 그 브랜치는 main 에 못 들어가고 로컬은 pre-push 게이트 94개가 막는다. 얻는 것: 취소본 0 · Verify 부하 절반 · auto-merge 가 첫 초록에 발동.

## 이번에 틀렸던 판단

- **룰셋을 만들기 전에 #1429 를 머지했어야 했다.** 규칙을 먼저 안내해서 이미 초록이던 PR 이 35분을 더 기다렸다.
- 첫 진단에서 "GitHub 가 아직 재판정을 안 한 것"으로 봤다. 실제로는 취소본이 Required 로 잡혀 있었고, PR 화면 스크린샷이 그것을 보여줬다. `mergeable_state: blocked` 만으로는 이유를 알 수 없다 — 화면의 check 목록(어느 줄에 Required 배지가 붙었나)을 봐야 한다.

## 다음 세션의 첫 액션

이 PR 이 머지된 뒤 **다음 PR** 에서 auto-merge 를 누르고, 취소된 `Verify (push)` 줄이 **애초에 안 생기는지** 확인. 생기면 이 문서의 전제가 틀린 것이다(다른 워크플로가 같은 이름을 쓰는지 `gh api repos/tobe2111/ur-live/commits/<sha>/check-runs` 로 볼 것).

## 남은 결정

- 룰셋의 필수 검사에 `smoke`·`contrast` 는 넣지 않았다(경로 필터 워크플로라 안 도는 PR 에서는 "Expected" 로 영구 대기하게 된다). 넣으려면 워크플로 쪽에 항상-생성 잡이 먼저 필요하다.
