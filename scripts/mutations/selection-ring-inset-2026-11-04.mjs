/** 🧬 주입 — 선택 테두리 안쪽(2026-11-04). 가드: src/tests/unit/selection-ring-inset-2026-11-04.test.ts */
const TEST = 'src/tests/unit/selection-ring-inset-2026-11-04.test.ts'
export default [
  {
    name: '🔵 이사 견적 선택 칸 테두리가 다시 바깥으로(맨 위 칸 위 테두리 잘림)',
    file: 'src/pages/life/request/FieldSheets.tsx',
    find: "bg-brand-tint ring-2 ring-inset ring-brand'",
    replace: "bg-brand-tint ring-2 ring-brand'",
    test: TEST,
    why: '대표 "윗칸에 파란색 테두리가 잘리는 경우가 많아".',
  },
]
