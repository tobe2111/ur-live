/**
 * 🪟 마이 `전체 도구` → 도구 시트가 **실제로 열리는가** 되돌려-검증 주입 (2026-09-28).
 * 가드: src/tests/unit/tool-page-sheet-renders-2026-09-28.test.tsx
 *       src/tests/unit/sheet-history-swap-2026-09-28.test.ts
 *
 * 이 경로는 **두 번 깨져 있었고 둘 다 에러가 0이었다**:
 *   ① 중첩 라우터 — 여는 즉시 throw(프로덕션은 메시지가 지워져 `Error` 만 남았다)
 *   ② 히스토리 칸 — 갈아 끼우기에서 새 시트가 스스로 닫혀 전체 도구로 되돌아왔다
 * 텍스트 가드는 둘 다 못 봤다("배선이 있는가" 만 봤다). 그래서 주입으로 잠근다.
 *
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일.
 */
const RENDER_TEST = 'src/tests/unit/tool-page-sheet-renders-2026-09-28.test.tsx'
const HISTORY_TEST = 'src/tests/unit/sheet-history-swap-2026-09-28.test.ts'
const SHEET = 'src/pages/user-profile/seller-section/Sheet.tsx'
const HIST = 'src/pages/user-profile/seller-section/sheet-history.ts'

export default [
  {
    name: '🪟도구시트 바깥 라우터와의 줄을 도로 잇는다 (중첩 라우터)',
    file: 'src/pages/user-profile/seller-section/ToolPageSheet.tsx',
    find: '    <RouterReset>',
    replace: '    <>',
    test: RENDER_TEST,
    why: 'react-router v6 은 중첩 라우터를 금지한다 — 이 줄이 없으면 시트는 여는 즉시 터진다(한 번도 동작한 적이 없었다).',
  },
  {
    name: '🪟도구시트 위치 컨텍스트만 끊고 라우트 컨텍스트는 남긴다',
    file: 'src/pages/user-profile/seller-section/ToolPageSheet.tsx',
    find: '      <UNSAFE_RouteContext.Provider value={{ outlet: null, matches: [], isDataRoute: false }}>',
    replace: '      <>',
    test: RENDER_TEST,
    why: '둘 다 끊어야 안쪽 라우터가 그 서브트리의 최상위가 된다. 하나만 끊으면 매칭이 바깥 경로를 물고 늘어진다.',
  },
  {
    name: '🔙시트히스토리 갈아 끼우기에서도 칸을 뺀다 (종전 버그)',
    file: HIST,
    find: '  if (s.open > 0 || !s.pushed) return { next: s, back: false }',
    replace: '  if (!s.pushed) return { next: s, back: false }',
    test: HISTORY_TEST,
    why: 'A 가 빼려던 칸을 방금 열린 B 가 뒤집어쓴다 — 도구를 골라도 전체 도구로 되돌아온다(에러 0).',
  },
  {
    name: '🔙시트히스토리 판정을 미루지 않고 그 자리에서 뺀다',
    file: SHEET,
    find: '      queueMicrotask(() => {',
    replace: '      ;((fn) => fn())(() => {',
    test: HISTORY_TEST,
    why: '정리 시점엔 새 시트의 설치가 아직 안 돌았다 — 그 자리에서 판정하면 교체를 닫기로 오독한다.',
  },
  {
    name: '🔙시트히스토리 시트마다 칸을 하나씩 쌓는다',
    file: HIST,
    find: '  const push = !s.pushed',
    replace: '  const push = true',
    test: HISTORY_TEST,
    why: '겹쳐 열리면 뒤로가기를 두 번 눌러야 마이로 나온다 — 칸은 "열려 있음" 에 붙는다.',
  },
  {
    name: '🔙시트히스토리 뒤로가기로 닫혀도 칸을 또 뺀다',
    file: HIST,
    find: '  if (poppedByUser) return { next: { open, pushed: false }, schedule: false }',
    replace: '  if (poppedByUser) return { next: { open, pushed: s.pushed }, schedule: open === 0 && s.pushed }',
    test: HISTORY_TEST,
    why: '이미 소비된 칸을 또 빼면 뒤로가기 한 번이 마이 밖으로 나간다.',
  },
]
