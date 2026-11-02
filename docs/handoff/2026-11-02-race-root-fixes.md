# 2026-11-02 — 오늘 main 을 막은 사고들의 근본 수리 (경주·중복·인자·브랜치 밖)

대표 *"단발적으로 문제 해결하지 말고 교훈삼아서 근본적으로 해결할 수 있는게 있으면 해결해줘."*

## 무엇이 있었나 (같은 날 main 빨강 세 번 + 내 실수 둘)
1. `inline-mutations-frozen` 시험이 **main 의 절대값**을 상수(977)와 견줬다 → 동결 전에 Verify 를 통과한 #2094 가
   동결 뒤 머지되어 main 빨강(GitHub 은 "최신이어야 머지" 를 요구하지 않는다).
2. 그걸 고치려고 **두 세션이 각자** 같은 2건을 다른 파일로 옮겼다(#2098 · #2089) → 이름 중복으로 모든 PR 의 Verify 빨강.
   #2102 에서 한쪽 파일을 지워 풀었다.
3. 내가 `check-guard-mutations.mjs --plan`(형제 도구의 인자)을 주자 러너가 모르는 인자를 무시하고 **전수**를 돌렸고,
   끊자 `ledger-commission-policy.ts` 에 주입이 남았다(커밋 전 되돌림).
4. 내가 `git checkout -q origin/main --` 로 HEAD 를 브랜치 밖으로 옮긴 채 커밋 → push 가 **"Everything up-to-date"**
   를 내고 고침이 안 올라갔다. GitHub head sha 를 대조하고서야 알았다.

## 고친 것 (구조로)
| 사고 | 처방 | 파일 |
|---|---|---|
| 1 | 절대값 상수 → **merge-base 와 비교**(이 PR 이 늘렸는가). main 엔 차이가 없어 경주로 안 막힌다. 상수 삭제 | `scripts/check-inline-mutations-growth.mjs` (verify strict) · 시험 `inline-mutations-growth-2026-11-02` |
| 2 | 글자까지 같은 주입 중복은 **접고 경고**, 같은 이름에 내용이 다를 때만 멈춘다 | `foldDuplicateInjections` (`guard-mutations-manifest-diff.mjs`) |
| 3 | **모르는 인자·값 빠진 인자면 아무것도 주입하지 않고 exit 2** | `scripts/guard-mutations-args.mjs` |
| 4 | **브랜치 밖 커밋을 pre-commit 이 막는다**(rebase·cherry-pick 중은 통과, 우회 `ALLOW_DETACHED_COMMIT=1`) | `scripts/check-detached-head.mjs` |
| 일반화 | 플레이북에 "늘지 않게는 PR 차이로" 4줄 | `docs/DEV_IMPLEMENTATION_PLAYBOOK.md` |

검증: 시험 17건 통과 · 새 주입 7건 `--only` 로 전부 빨간불 확인 · `--plan`/`--only`(값 없음) 실제로 exit 2.

## 이번에 틀렸던 판단
- 동결 시험을 만들 때 "줄였으면 상수도 내려라"(상수 = 측정값)를 **헐거움 방지**로 넣었는데, 그것 자체가 경주 지점이었다
  (두 PR 이 각자 줄이면 둘 다 머지된 뒤 빨강). ⇒ 여러 세션이 동시에 머지하는 레포에서 main 절대값 상수는 안 된다.

## 남은 것 · 보고만
- main 의 `번들 예산 (머지된 조합)` 빨강 — #2089(이용권 상세 C안)가 이용권 상세 2화면을 +1.5~1.6KB(허용 1.5).
  그 PR 세션이 판단할 일이라 손대지 않았다.
- 못 막는 것: 훅이 설치되지 않은 세션의 브랜치 밖 커밋(설치는 session-start 훅) · 같은 PR 안에서 인라인 하나 빼고 하나 더하기.
