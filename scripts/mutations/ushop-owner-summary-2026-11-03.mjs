/** 🧬 주입 — 유어샵 B 주인 요약 판(2026-11-03). 가드: src/tests/unit/ushop-owner-summary-2026-11-03.test.tsx */
const TEST = 'src/tests/unit/ushop-owner-summary-2026-11-03.test.tsx'
export default [
  {
    name: '🧾 유어샵 B — 요약 판이 방문자에게도 뜬다',
    file: 'src/pages/CuratorPage.tsx',
    find: '{isOwner && <Suspense fallback=',
    replace: '{true && <Suspense fallback=',
    test: TEST,
    why: '주인의 수익·방문 수가 손님에게 보인다.',
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
