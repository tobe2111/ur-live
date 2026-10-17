# 래칫 간헐 빨간불을 읽을 수 있게 + parity 의 npm 사각지대 (2026-10-18)

## 다음 세션의 첫 액션

**main 번들 예산 회차의 notice annotation 을 모아 판정한다.** 이 PR 이 머지되면
`bundle-budget-main.yml` 의 래칫 두 스텝이 **성공해도** 숫자를 남긴다.

```bash
W=$(gh api repos/tobe2111/ur-live/actions/workflows --jq '.workflows[]|select(.name=="Bundle budget (main)")|.id')
# 최근 회차들의 check-run id → annotation 본문
gh api "repos/tobe2111/ur-live/actions/workflows/$W/runs?per_page=8" \
  --jq '.workflow_runs[]|"\(.head_sha[0:9]) \(.conclusion)"'
CR=$(gh api "repos/tobe2111/ur-live/commits/<sha>/check-runs?per_page=50" \
  --jq '.check_runs[]|select(.name|contains("번들 예산"))|.id')
gh api "repos/tobe2111/ur-live/check-runs/$CR/annotations" --jq '.[]|"[\(.annotation_level)] \(.message)"'
```

판정:
- **한 run 안 3회 값의 폭** → 측정기 자체 분산
- **run 사이 같은 화면의 중앙값 차** → 러너 분산
- 둘 다 허용오차(+4KB) 안이면 → 빨간불은 **증가**다, 원인 커밋을 찾는다
- 넘으면 → 허용오차·반복 수를 고친다. **기준을 올리는 것이 아니다.**

## 이번에 밝힌 것 (실측)

### ① 래칫 빨간불은 간헐이고, 원인은 분산보다 `slack` 이 유력하다
main 하루치(10-15) 전수 — 완료 18회 중 **초록 16 · 빨강 2**, **둘 다 실행비용 스텝**,
빨강 바로 다음 커밋이 초록(그 사이 머지 1건 · **기준 파일 무변경**).
초록 run 의 그 스텝은 skip 이 아니라 **실제로 돌고 success**.

🔎 **기준 파일 `history` 가 더 나은 설명을 들고 있었다**: 마지막 항목 사유가
`홈: 실행된 JS 333.3 → 322.7 KB 로 줄었다 — 개선을 잠그라(--rebaseline)` — 그건
**`slack` 실패 문구를 그대로 붙여넣은 것**이다. 즉 유력한 원인은
**PR 작성자가 자기 빌드로 기준을 잠그고, 머지된 조합의 첫 main 회차가 그보다 낮게 측정돼
`slack` 으로 떨어지는 것**이다. (같은 history 에 `어드민은 같은 빌드가 530/538 두 갈래로 흔들려`
라는 실측도 있어 **분산 자체는 실재**하나 ±8KB 급이다.)

🩸 **내가 처음 대표에게 보고한 "분산" 은 근거가 약했다** — 두 빨강이 같은 스텝이고
사이 커밋이 초록이라는 것만으로 분산을 단정했다. `history` 를 읽고 정정했다.

### ② parity 파서가 npm 스크립트에 감싸인 차단 가드를 못 봤다
`verify.yml` 의 `Bundle size budget` 은 **strict** 인데 `npm run check:bundle:budget` 으로
호출돼 파서에 **0건**이었고, 그 이름이 보이는 유일한 자리는 같은 파일의 **보고·아티팩트 스텝**
(`continue-on-error: true`)이라 `check-bundle-size.mjs` 가 통째로 "CI 경고" 로 분류됐다
⇒ 차단 가드가 로컬 게이트에서 **조용히 빠진** 채 `check-local-ci-parity` 는 "건강" 으로 보고.

실측: verify.yml **7개 리비전 전수**에서 budget 스텝은 **항상** npm 호출(리터럴이었던 적 0회).
전수 스캔 결과 이 모양의 차단 가드는 **한 건**뿐(`generate-route-chunk-map.mjs` 는 빌드 생성기라 대상 아님).

### ③ 🩸 내 수리가 곧바로 결함을 하나 만들었고 측정이 잡았다
npm 해석을 넓히자 **`Build worker` 스텝이 가드로 분류**돼 로컬 게이트 스텝이 **100 → 101** 이 됐다
(= 푸시 게이트가 **빌드를 돌리기 시작한다**). ⇒ npm 해석은 **`check-*` 만** 센다.
리터럴 경로의 `generate-*` 는 2026-09-26 결정대로 그대로.
**로컬에서 실제로 도는 가드 수는 100 그대로** — 바뀐 것은 *예외가 명시되는가* 다.

### ④ 🩸 그리고 내가 쓰려던 CLAUDE.md "정정" 은 틀렸다 (넣지 않았다)
L1894 의 *"`check-bundle-size.mjs` 는 CI 에서 `continue-on-error: true`(경고)"* 를
*"지금은 전부 strict"* 로 고치려 했는데, 재 보니 **그 문장의 결론이 맞았다**(위 ②가 이유).
래칫 여섯 스텝이 전부 strict 인 것은 사실이지만, 그 문장이 말하는 것은
**파서가 그 가드 이름을 어떻게 분류하는가** 였다.
⇒ **낡은 지도라고 단정하기 전에 그 문장이 무엇을 주장하는지부터 정확히 읽을 것.**

## 측정 함정 (이번에 걸린 것)

- `annotations_count: 3` 만 보고 "출력이 있다" 로 읽으면 오판한다 — 열어 보니 전부
  보일러플레이트(Node 20 deprecation · `Process completed with exit code 1.` · ubuntu 이관)였고
  **래칫 숫자는 0** 이었다. **개수가 아니라 내용**.
- `git merge-base --is-ancestor <내 커밋> origin/main` 은 **스쿼시 머지에서 NO** 다.
  판정은 파일 내용 대조(`git diff --quiet <tip> origin/main -- <파일>`)로.
- 주입을 만들 때 `find` 를 **문자열 앞부분만** 잡으면 값이 그대로 남아 결함이 안 생긴다
  (`EXCLUDE` 사유 비우기 주입이 처음 그래서 통과했다 — 러너가 잡았다).

## 못 보는 것

- GitHub 가 notice annotation 을 실제로 저장·노출하는지(플랫폼 동작 — 머지 후 API 로만 확인)
- 래칫 빨간불의 **진짜 분포**: 표본이 2건뿐이다. notice 가 쌓여야 판정된다.
- 이미 쌓인 cron 미해결 1,331건(일괄 해소는 데이터 쓰기 = 결재)
