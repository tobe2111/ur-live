## 🧠 세션 컨텍스트 예산 — `prompt is too long` · 크레딧 과소비 근본 수리

대표 신고 *"계속 클로드 코드 세션들에서 금방 prompt is too long 이라고 되는데 어떻게 해?"* ·
*"클로드 코드 크레딧을 너무 빨리 소비해"* · *"더이상은 발생하지 않도록 규칙을 가장 이상적이고
현명하게 짜줘"*. 승인: `AskUserQuestion` **"B안 — 기록 + 큰 표 분리"**.

### 다음 세션의 첫 액션

1. **PR [#2069](https://github.com/tobe2111/ur-live/pull/2069) 가 머지됐는지 확인.** head `01da0e9`,
   auto-merge(squash) 무장, `mergeable=True`. 안 머지됐으면 CI 를 보고 처리:
   `curl -sS https://api.github.com/repos/tobe2111/ur-live/pulls/2069`
2. ⚠️ **머지 후에야 효과가 난다** — 새 세션이 `main` 의 작아진 `CLAUDE.md` 를 받는다.
3. **새 `[UNLOCK*]` 기록을 `CLAUDE.md` 본문에 쓰지 말 것** → `docs/locks/loading-audit-log.md` 맨 위.
   (`check-context-budget` 가 막지만, 그 전에 습관으로 알고 있을 것.)

### 완료분

| 무엇 | 전 → 후 | 커밋 |
|---|---|---|
| `CLAUDE.md` | **30만 → 5.9만 토큰**(창 20만의 151% → 29%) | `4223314` |
| `docs/CURRENT_WORK.md` | 24.4만 토큰 → 822(옛 기록 311건 archive) | `1fcadf4` |
| 인계 목차 `INDEX.local.md` | 2.4만 → 1,722 토큰(기본 최근 40건, `--all` 로 전체) | `3d5165f` |
| 신규 가드 `check-context-budget` | 토큰 하드 상한 + 거대 문서 경고 강제 | `3d5165f` |
| 훅 OOM 오진 수리 | `Fix TypeScript errors` ← 실제론 heap 부족 | `3d5165f` |
| `measured` → `checked` | `guard-selfcheck` 어휘 요구 | `01da0e9` |

기록은 **한 글자도 안 지웠다** — 옮기고 포인터를 남겼다(`docs/locks/*` · `docs/GUARD_RAILS.md` ·
`docs/handoff/archive/2026-07-29-and-earlier-current-work.md`).

### 🩸 이번에 내가 틀린 판단 (제일 값진 부분)

1. **PR 본문에 과장을 썼다** — *"인계 592개가 크레딧의 나머지 절반"*. 재 보니 세션이 읽는 최근 5건은
   **11,338 토큰**(정상)이고 5.2만 토큰짜리는 7월 것이라 안 읽힌다. PR 에 정정으로 남겼다.
2. **인계 5건을 11,338 → 32,555 토큰으로 오독** — 목차 `INDEX.local.md` 가 역순 정렬에서 `I` 가
   숫자보다 앞이라 상위 5건에 섞였다. **그리고 내가 만든 가드가 같은 함정에 빠졌다**(시험이 잡았다).
3. **`generate-handoff-index.mjs` 를 깨뜨렸다** — 주석에 `*/` 를 빼먹어 `import` 가 주석에 먹혔다.
   즉시 실행해서 잡았다(`ReferenceError: existsSync`).
4. **검증 단언 둘이 틀렸다** — `generate-handoff-index.mjs` 가 CLAUDE.md 에 없다고 빨간불로 읽었는데
   그 단언 대상은 `CURRENT_WORK.md` 였고, `-s` 를 `run:` 줄 **앞**에서 찾았다(실제는 뒤).
5. **`pkill -f "pre-push-gate"` 가 자기 명령줄을 잡아 스스로를 죽였다**(exit 144, 2회).

### 남은 것

- 🔴 **대표 몫**: claude.ai → 설정 → 커넥터에서 안 쓰는 것 끄기. 연결 실패 **60개+** · 스킬 **300개+** 가
  매 요청에 실린다(`asana`·`linear`·`gong`·`klaviyo`·`pendo`·`atlassian` 등). 레포 밖이라 세션이 못 한다.
- ⚠️ `src/worker/index.ts` **61,670 토큰** — 세션이 읽을 때마다 비싸다. 분할은 위험(래칫 2,672줄). 별건.
- ⚠️ **긴 세션 자체가 비용** — 이 세션 대화가 3.9만 토큰이었다. 작업 단위로 새 세션이 절약된다.
  (대표가 전한 다른 유저의 *"로그 폴더 삭제로 해결"* 은 우리 경우가 **아니다** — 레포 내 큰 로그 0건 실측.
  다만 그 말이 가리키는 기제가 이것이다.)
- ⚠️ **다른 열린 브랜치가 옛 `CLAUDE.md` 구조로 작업 중일 수 있다** — 머지 때 같은 충돌이 난다.
  해소법: **구조(포인터)는 유지하고 그쪽 신규 기록만 `docs/locks/` 로 옮긴다.** 손으로 고르지 말고
  스크립트로 대조할 것(이번에 main 쪽 43줄 중 **1줄만** 신규였다).

### 가드가 잡아 준 것 (설계가 일했다)

새 가드가 즉시 실물 1건(`archive/2026-07-26-and-earlier.md` 17만 토큰, 경고 머리말 부재) ·
`guard-selfcheck` 가 내 어휘 불일치 · `audit-registry-sync` 가 표 행 누락 · 내 시험이 내 결함 둘.
