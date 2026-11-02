/**
 * 🧬 주입 — 세션 = 작업 하나 (2026-11-02 대표 *"다른 세션에서 기존 세션에서 작업하던 걸 가져오고 그래"*)
 *    가드: src/tests/unit/session-scope-2026-11-02.test.ts
 *
 * 막는 사고: 새 세션이 최신 인계(= 다른 세션이 하던 일)를 열고 거기 적힌 할 일을 실행한다.
 */
const T = 'src/tests/unit/session-scope-2026-11-02.test.ts'
export default [
  {
    name: '세션범위 — 최신순으로 열라는 옛 지시를 되살린다',
    file: 'docs/CURRENT_WORK.md',
    find: "grep -ril '<내 작업 낱말>' docs/handoff/ | sort -r | head -3",
    replace: 'ls docs/handoff/ | sort -r | head -5',
    test: T,
    why: '최신 인계는 동시에 도는 다른 세션의 일이다 — 열면 그 일을 가져온다.',
  },
  {
    name: '세션범위 — 남의 브랜치·PR 금지 줄을 지운다',
    file: 'CLAUDE.md',
    find: '3. **다른 세션의 브랜치·PR 에 커밋·머지·코멘트하지 않는다.**',
    replace: '3. 필요하면 다른 세션의 PR 도 정리한다.',
    test: T,
    why: '남의 PR 에 커밋하면 두 세션이 같은 브랜치를 다툰다.',
  },
  {
    name: '세션범위 — 인계 칸 이름을 "다음 세션" 으로 되돌린다',
    file: 'CLAUDE.md',
    find: '1. **이어받는 세션의 첫 액션** — 명령/쿼리까지',
    replace: '1. **다음 세션의 첫 액션** — 명령/쿼리까지',
    test: T,
    why: '"다음 세션" 이라 쓰면 아무 새 세션이나 자기 일로 읽는다.',
  },
  {
    name: '세션범위 — 검사 메시지가 다시 "다음 세션의 첫 액션" 을 가르친다',
    file: 'scripts/check-current-work-sync.mjs',
    find: '**이어받는 세션의 첫 액션**(대표가 이어서 하라고 했을 때만 실행된다)',
    replace: '**다음 세션의 첫 액션**',
    test: T,
    why: '인계를 쓰는 모든 세션이 이 메시지를 보고 따라 쓴다.',
  },
  {
    name: '세션범위 — dev 역할의 범위 한정을 지운다',
    file: '.claude/agents/dev.md',
    find: '아래 루틴(남의 PR·인계를 보는 일)은 **dev 역할 루틴으로 돈 세션만** 한다.',
    replace: '아래 루틴을 한다.',
    test: T,
    why: 'dev 정의를 읽은 아무 세션이 남의 PR 을 수리하러 간다.',
  },
]
