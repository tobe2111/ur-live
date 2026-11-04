/** 🧬 주입 — 유어샵 B 주인 요약 판(2026-11-03). 가드: src/tests/unit/ushop-owner-summary-2026-11-03.test.tsx */
const TEST = 'src/tests/unit/ushop-owner-summary-2026-11-03.test.tsx'
export default [
  {
    name: '🧾 유어샵 — 요약 판이 관리 화면에서 빠진다',
    file: 'src/pages/UShopManagePage.tsx',
    find: '        <div className="mt-3"><OwnerSummaryCard /></div>',
    replace: '',
    test: TEST,
    why: '2026-11-04 대표가 관리 안으로 옮겨 달라고 한 숫자가 어디에도 안 보인다.',
  },
  {
    name: '🧾 유어샵 B — 모르는 숫자를 0 으로 위장한다',
    file: 'src/pages/curator-page/OwnerSummaryCard.tsx',
    find: "(s && v != null ? `${formatNumber(v)}${unit}` : '—')",
    replace: "`${formatNumber(v ?? 0)}${unit}`",
    test: TEST,
    why: '아직 모르는 것을 0 이라고 말하지 않는다.',
  },
]
