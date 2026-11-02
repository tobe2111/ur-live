/**
 * 🧾 소비자 화면 흐름 속 판 → 평면 (2026-11-02 대표 확정 A안 · 소비자 전체)
 * 가드: src/tests/unit/consumer-plate-flat-2026-11-02.test.ts
 *
 * 되돌리려는 사고 — ① 흐름 속 판에 그림자가 슬금슬금 돌아온다 ② 판정이 떠 있는 면까지 걷어
 * 흰 바탕에서 모달·지도 카드가 사라진다(첫 판이 지갑 지도 위 카드를 실제로 걷었다) ③ `--lift` 를
 * 전역 none 으로 "간단히" 처리한다 ④ 대표가 고른 자리(PC 마이)가 다시 카드가 된다.
 */
const TEST = 'src/tests/unit/consumer-plate-flat-2026-11-02.test.ts'
const CODEMOD = 'scripts/codemods/consumer-plate-flat.mjs'

export default [
  {
    name: '🧾 지갑 요약에 그림자 판이 돌아온다',
    file: 'src/pages/my-vouchers/WalletSummaryCard.tsx',
    find: '<div className="-mx-4 px-4 py-4 flex items-end justify-between gap-4">',
    replace: '<div className="rounded-2xl bg-surface shadow-lift px-5 py-4 flex items-end justify-between gap-4">',
    test: TEST,
    why: '대표가 지갑을 세 안으로 보고 고른 것이 평면이다. 판 하나가 돌아오면 같은 화면에 두 문법이 선다.',
  },
  {
    name: '🧾 판정이 떠 있는 면을 못 알아본다 (모달·토스트·화살표까지 걷힌다)',
    file: CODEMOD,
    find: 'export const KEEP_LINE = /\\b(absolute|fixed|sticky)\\b|',
    replace: 'export const KEEP_LINE = /\\bNEVERMATCH(absolute|fixed|sticky)\\b|',
    test: TEST,
    why: '떠 있는 면은 흰 바탕 위에 겹치므로 그림자가 유일한 경계다. 걷으면 통째로 사라진다(index.css `--lift` 주석).',
  },
  {
    name: '🧾 지갑 지도 위 가로 카드를 흐름 속 판으로 본다',
    file: CODEMOD,
    find: '|\\bsnap-start shrink-0',
    replace: '',
    test: TEST,
    why: '🩸 첫 판이 실제로 걷었다 — 부모가 absolute 라 그 줄만 보면 흐름 속처럼 보인다. 지도 타일 위에서 흰 면이 없으면 글자가 안 읽힌다.',
  },
  {
    name: '🧾 `--lift` 를 전역 none 으로 바꾼다',
    file: 'src/index.css',
    find: '    --lift: 0 2px 10px rgb(22 24 28 / 0.12); /* 화이트 카드 들림. 다크에선 none */',
    replace: '    --lift: none; /* 화이트 카드 들림. 다크에선 none */',
    test: TEST,
    why: '가장 쉬운 처방처럼 보이지만 모달·시트·드롭다운·토스트·캐러셀 화살표·지도 오버레이가 흰 바탕에서 사라진다.',
  },
  {
    name: '🧾 PC 마이 카드가 다시 그림자 판이 된다',
    file: 'src/index.css',
    find: '    background: transparent;\n    border-radius: 16px;\n    box-shadow: none;',
    replace: '    background: var(--surface);\n    border-radius: 16px;\n    box-shadow: var(--lift);',
    test: TEST,
    why: '범위가 "소비자 화면 전체" 다. PC 마이 다섯 블록은 이 규칙 한 곳에서 모양을 받는다.',
  },
]
