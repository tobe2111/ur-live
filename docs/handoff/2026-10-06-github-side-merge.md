# 로컬은 clean 인데 GitHub 은 충돌 — Verify 가 *부재*로 남는 함정 (2026-10-06)

대표 **"머지해줘 모두"** 를 집행하다 찾은 것이다. PR 넷을 머지하려는데 셋이 멎어 있었고,
**PR 화면에 빨간 체크가 하나도 없었다.**

## 🩸 증상과 기제

```
#1621 c46a124  →  Cloudflare Pages=success      ← Verify 가 **없다**(실패가 아니라 부재)
#1625 064ac07  →  Cloudflare Pages=success      ← 같음
         mergeable=false / mergeable_state=dirty
```

```
.gitattributes:  docs/CURRENT_WORK.md merge=union
로컬 git        → union 이 자동 해소          → "clean"      ← 내가 본 것
GitHub 서버측   → .gitattributes 를 안 쓴다   → CONFLICT     ← 실제
```

🔴 그리고 그 결과가 '머지 못 함' 보다 나쁘다 — **GitHub 이 머지 커밋을 못 만들면 `pull_request`
워크플로가 디스패치되지 않는다.** 그래서 `Verify` 가 **부재**로 남고, PR 화면엔 빨간 게 없어
통과처럼 보이고, **auto-merge 는 조용히 멎는다.** 이 레포가 반복해 당한 '조용한 부재'.

CLAUDE.md 는 이 비대칭을 2026-07-29 부터 적어 두고 있었다(#835 실측). **새로 드러난 것은 CI 결과**다.

## 🧭 제가 틀린 것 — 기제는 맞췄는데 **근거가 가짜였다**

처음 "증명" 에 쓴 명령:

```bash
git merge-tree --write-tree --attr-source=/dev/null origin/main "origin/$B"   # ❌
# → error: unknown option `attr-source=...'   +  exit 129
```

`--attr-source` 는 **최상위 git 옵션**이다. 하위로 주면 usage 오류이고, 저는 그 **129 를 '충돌'로
읽어** 대표에게 보고했다. 올바른 형태:

```bash
git --attr-source=4b825dc642cb6eb9a060e54bf8d69288fbee4904 merge-tree --write-tree <base> <head>
```

⇒ **명령 실패와 판정 결과를 섞지 말 것.** 결론이 우연히 맞으면 더 위험하다(검증했다고 믿게 된다).

## ✅ 한 것

1. **`scripts/check-github-side-merge.mjs`** — 커스텀 머지 드라이버를 끈 상태로 머지를 다시 돌려
   "로컬만 clean" 을 잡는다. 평소 충돌은 경고만(이 검사의 일이 아니다). 우회 `GSM_SKIP=1`.
2. **pre-push 게이트가 가드보다 *먼저* 돌린다** — CI 가 아예 안 도는 경우를 제일 먼저 막는 게 맞다.
   ⚠️ CI 에는 넣지 않았다. PR 체크아웃은 이미 머지 ref 라 의미가 없다.
3. **`check-guard-registry.mjs` 가 pre-push 게이트를 러너로 인정**하게 했다(안 그러면 pre-push 전용
   검사가 전부 "어디서도 안 돈다" 로 걸려 결국 가드를 지우게 된다). ⚠️ `local-ci-parity.mjs` 는
   **넣지 않았다** — 그 파일의 EXCLUDE 는 *제외* 목록이라 넣으면 '등록됨' 으로 둔갑한다.
4. 시험 9건 + 주입 6건(**전부 빨간불 확인**). 시험 ⑥⑦⑧은 **합성 레포를 실제로 만들어** 돌린다
   (이력 커밋에 의존하면 브랜치가 지워질 때 같이 낡는다).

## 🩸 주입 러너가 내 시험 하나를 "헛돈다" 고 잡았다

②(레지스트리 배선)를 원문 `toContain` 으로 썼는데, 그 줄을 **주석 처리**한 주입이 통과했다 —
`// add('scripts/pre-push-gate.mjs')` 도 같은 문자열을 담는다. SSOT `stripComments` 로 교체했다.
**배선 단언은 거의 항상 주석에 속는다**(이 레포 상습 클래스).

## 🟡 다음 세션

- **근본 해소가 아니다.** main 이 움직일 때마다 다시 난다 — 이 레포는 세션이 여러 개 동시에 돌고
  `docs/CURRENT_WORK.md` 는 거의 모든 브랜치가 건드린다. 이 검사는 **푸시 전에 알려 주는 것**까지다.
- 근본은 둘 중 하나이고 **둘 다 대표 판단이 필요하다**(레포 관례 변경):
  ① `CURRENT_WORK.md` 를 커밋에서 빼고 CI/배포 시 생성 ② 그 파일을 `-merge`(항상 ours/재생성)로.
  ②가 싸지만 "인계는 양쪽 다 남긴다" 는 #836 결정과 부딪친다 — 재생성이면 보존은 유지된다
  (내용의 진짜 출처는 `docs/handoff/**` 이고 그 파일은 **색인**일 뿐이다).
- 판정 명령: `gh api repos/tobe2111/ur-live/pulls/N --jq .mergeable` — `git merge-tree` 로는 모른다.
