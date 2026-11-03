/** 🧬 주입 — 에이전시 화면 토스 참고 안(2026-11-03). 가드: src/tests/unit/agency-toss-2026-11-03.test.tsx */
const TEST = 'src/tests/unit/agency-toss-2026-11-03.test.tsx'
export default [
  {
    name: '🧾 토스 — 오늘 매출을 모를 때 0원으로 위장한다',
    file: 'src/pages/agency-console/agency-toss.tsx',
    find: "{known ? `${formatNumber(sum('todayRevenue'))}원` : rows === null ? '' : '—'}",
    replace: "{`${formatNumber(sum('todayRevenue'))}원`}",
    test: TEST,
    why: '아직 모르는 것을 0 이라고 말하지 않는다(마이 숫자 규칙).',
  },
  {
    name: '🧾 토스 — 에이전시 탭이 토스 안을 안 쓴다',
    file: 'src/pages/user-profile/MyAgencyZone.tsx',
    find: 'toss={inHead}',
    replace: 'toss={false}',
    test: TEST,
    why: '대표가 정한 에이전시 화면 모양이 사라진다.',
  },
]
