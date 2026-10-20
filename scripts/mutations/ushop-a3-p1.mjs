/**
 * 🛍️ 2026-09-30 (대표 확정 **안 A** — "다 순서대로 이상적으로 해줘") 주입.
 *
 * 되돌리려는 사고: **PC 에서 줄 목록이 우 칸(796px)만큼 늘어나는 것.**
 * 줄(s3)은 폰 폭에 맞춰 11라운드 37안 끝에 확정된 형식이라(`PinRow` 머리말) 늘리면
 * 64px 썸네일 하나에 오른쪽 절반이 빈 칸이 된다 — 2026-09-28 실측 `out/visual/ushop-pc.png`.
 * **빌드도 화면도 안 깨지고** 그냥 성의 없어 보인다. 그래서 가드가 센다.
 *
 * 가드: src/tests/unit/ushop-a3-p1.test.ts
 */
const TEST = 'src/tests/unit/ushop-a3-p1.test.ts'

export default [
  {
    name: '🛍️ 안A — 줄 목록 2열 규칙이 CSS 에서 사라진다 (우 칸 796px 로 늘어남)',
    file: 'src/index.css',
    find: '  .ur-ushop-main .ur-ushop-rows { grid-template-columns: repeat(2, minmax(0, 1fr)); }',
    replace: '  .ur-ushop-main .ur-ushop-rows { gap: 8px; }',
    test: TEST,
    why: '규칙만 지우면 컨테이너는 여전히 grid 라 1열로 남아 **796px 줄**이 된다 — 2026-09-28 에 본 그 화면.',
  },
  {
    name: '🛍️ 안A — 목록이 그리드가 아니게 되돌아간다 (열 규칙이 무시됨)',
    file: 'src/pages/CuratorPage.tsx',
    // 🔁 2026-09-30 재조준(#1581 한 톤 머지) — 폰은 `divide-y`, PC 만 `lg:grid` 다.
    //   불변식 그대로: **PC 에서 display:grid 가 없으면 열 규칙이 무시된다.**
    find: 'className="max-w-3xl mx-auto px-4 pb-4 divide-y divide-rule lg:divide-y-0 lg:grid lg:gap-2 ur-ushop-rows"',
    replace: 'className="max-w-3xl mx-auto px-4 pb-4 divide-y divide-rule ur-ushop-rows"',
    test: TEST,
    why: '클래스는 남는데 `display:grid` 가 없으면 `grid-template-columns` 가 무시된다 — 클래스만 보는 가드가 헛도는 자리.',
  },
  {
    name: '🛍️ 안A — 전용 클래스를 tailwind lg:grid-cols-2 로 바꾼다 (액자에서 되돌아감)',
    file: 'src/pages/CuratorPage.tsx',
    // 🔁 2026-09-30 재조준(#1581 한 톤 머지) — 앵커만 결합본으로. 결함은 그대로다.
    find: 'className="max-w-3xl mx-auto px-4 pb-4 divide-y divide-rule lg:divide-y-0 lg:grid lg:gap-2 ur-ushop-rows"',
    replace: 'className="max-w-3xl mx-auto px-4 pb-4 divide-y divide-rule lg:divide-y-0 lg:grid lg:gap-2 lg:grid-cols-2"',
    test: TEST,
    why: '`.app-framed .lg\\:grid-cols-2` 가 1열로 덮으므로 액자가 남는 `/profile`·`/s` 에선 아무 일도 안 한다.',
  },
  {
    name: '🛍️ 안A — 클래스가 PinRow 가 아닌 칩 줄에 붙는다 (앵커가 옳은지)',
    file: 'src/pages/CuratorPage.tsx',
    // 🔁 2026-09-30 재조준(#1581 한 톤 머지) — 칩 줄이 `pt-3 pb-2` → `pt-2 border-b border-rule` 가 됐다.
    find: 'className="max-w-3xl mx-auto px-4 pt-2 border-b border-rule flex items-center gap-2 empty:hidden"',
    replace: 'className="max-w-3xl mx-auto px-4 pt-2 border-b border-rule flex items-center gap-2 empty:hidden ur-ushop-rows"',
    test: TEST,
    why:
      '칩 줄이 파일에서 **먼저** 나오므로 가드의 첫 매치가 그쪽으로 옮겨간다. 클래스 존재만 보는 가드라면 ' +
      '통과한다 — 그래서 `grid` 유무와 `<PinRow` 를 감싸는지까지 본다.',
  },
]
