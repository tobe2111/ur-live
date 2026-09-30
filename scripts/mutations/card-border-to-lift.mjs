/**
 * 🎫 카드 표면 — 테두리 0 + 들림 한 값 (2026-09-29)
 * 가드: src/tests/unit/card-border-to-lift-2026-09-29.test.ts
 *
 * 되돌리려는 사고 셋 — ① 테두리 친 카드가 슬금슬금 다시 는다 ② 코드모드와 시험의 판정이 갈린다
 * ③ 테두리를 쓸다가 **선택 표시**(border-brand)까지 같이 쓸어 간다.
 */
const TEST = 'src/tests/unit/card-border-to-lift-2026-09-29.test.ts'
const CODEMOD = 'scripts/codemods/card-border-to-lift.mjs'

export default [
  {
    name: '🎫 흐름 속 흰 카드에 테두리가 다시 생긴다 (규칙 ① 신규 금지 위반)',
    // 🩸 첫 판 앵커를 GuideViewer 로 잡았다가 "낡은 지도" 로 걸렸다 — 그 파일엔 `p-4` 카드가 없고
    //    내가 본 diff 가 **두 파일을 합친 것**이었다. 앵커는 재조준하고 결함(replace)은 그대로 둔다.
    file: 'src/pages/MyLedgerPage.tsx',
    // ⚠️ 같은 카드가 4칸이라 앵커는 **다음 줄까지** 잡아야 유일해진다(러너가 유일성을 요구한다).
    find: '<div className="bg-white rounded-xl p-4 shadow-lift">\n              <div className="flex items-center gap-1 text-[12px] text-gray-500"><TrendingUp',
    replace: '<div className="bg-white rounded-xl p-4 border border-gray-200">\n              <div className="flex items-center gap-1 text-[12px] text-gray-500"><TrendingUp',
    test: TEST,
    why:
      '확정 시스템 규칙 ①(카드 테두리 0). 선을 그리면 면이 둘로 안 나뉘고, 화면마다 ' +
      '테두리 카드와 들림 카드가 섞여 "덜 만든 화면" 의 인상이 된다 — 대표가 두 번 지적한 그 인상이다.',
  },
  {
    name: '🎫 코드모드가 잠금표를 안 보게 된다 (승인 절차 우회)',
    file: CODEMOD,
    find: '  .filter((f) => !LOCK.has(f) && !MIRRORS.has(f))',
    replace: '  .filter((f) => !MIRRORS.has(f))',
    test: TEST,
    why:
      '잠금표 파일(TossPaymentWidget 등)은 className 하나를 바꿔도 대표 승인이 필요하다. ' +
      '코드모드가 그 목록을 안 보면 조용히 들어가고, 그러면 잠금 자체가 형해화된다. ' +
      '시험이 코드모드를 `--dry` 로 돌리므로 대상이 늘어나면 바로 빨간불이 된다.',
  },
  {
    name: '🎫 코드모드가 떠 있는 면까지 쓸어 간다 (드롭다운 경계가 사라진다)',
    file: CODEMOD,
    find: "const FLOAT = /\\b(absolute|fixed|sticky)\\b|\\bz-\\[|\\bshadow-(xl|2xl)\\b/",
    replace: "const FLOAT = /\\bNEVERMATCHTHIS\\b/",
    test: TEST,
    why:
      '드롭다운·토스트는 페이지 **위에** 겹치므로 `shadow-lift`(잉크 6%) 만으로는 경계가 안 선다. ' +
      '규칙 ①은 *흐름 속 카드* 의 규칙이지 떠 있는 면의 규칙이 아니다.',
  },
  {
    name: '🎫 코드모드가 선택 신호까지 지운다 (눌러도 표시가 없다)',
    file: CODEMOD,
    find: "const SIGNAL = /\\bborder-brand|\\bring-|\\bborder-(2|4|8)\\b|border-\\[/",
    replace: "const SIGNAL = /\\bNEVERMATCHTHIS\\b/",
    test: TEST,
    why:
      '2026-09-29 UI① 이 *"선택 상태는 브랜드 면 하나"* 로 통일한 직후다. 테두리를 쓸면서 ' +
      '`border-brand` 를 같이 지우면 **그 언어가 하루 만에 무너진다** — 그리고 에러가 안 나서 아무도 모른다.',
  },
  {
    name: '🎫 카드 래칫이 헐거워진다 (239 → 600)',
    file: 'src/components/guide/GuideViewer.tsx',
    find: '<section key={s.section_key} id={`guide-${s.section_key}`} className="bg-white rounded-xl overflow-hidden scroll-mt-4 shadow-lift">',
    replace: '<section key={s.section_key} id={`guide-${s.section_key}`} className="bg-white rounded-xl overflow-hidden scroll-mt-4 border border-gray-200">',
    test: TEST,
    why:
      '🩸 같은 날 아이콘 가드에서 배운 것 — **래칫 기준을 올리는 주입은 헛돈다**(느슨해지는 건 ' +
      '위반이 아니라 시험이 빨개질 수가 없다). 그래서 이 주입도 기준이 아니라 **실제 한 건**을 되돌린다.',
  },
]
