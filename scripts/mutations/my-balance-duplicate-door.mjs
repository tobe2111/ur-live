/**
 * 🪙 마이 딜 잔액 통합 + 🔇 중복 등록 문 제거 되돌려-검증 주입 (2026-09-28).
 * 가드: src/tests/unit/my-balance-and-duplicate-door-2026-09-28.test.ts
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일.
 */
const TEST = 'src/tests/unit/my-balance-and-duplicate-door-2026-09-28.test.ts'
const MY = 'src/pages/user-profile/TeamPointsCard.tsx'
const SHARED = 'src/pages/vouchers/DealBalanceCard.tsx'
const PILL = 'src/pages/user-profile/SellerSwitchInline.tsx'

export default [
  {
    name: '🪙마이잔액 부품을 안 쓰고 마이가 자기 카드를 다시 그린다',
    file: MY,
    find: '      <DealBalanceCard',
    replace: '      <div className="bg-ink rounded-2xl px-5 py-4" /><DealBalanceCard',
    test: TEST,
    why: '스타일을 베끼면 다음 변경에서 또 한쪽만 따라간다 — 이 어긋남 자체가 그 증거였다.',
  },
  {
    name: '🪙마이잔액 실패를 조용히 삼킨다 (0딜로 보인다)',
    file: MY,
    find: '        error={error}',
    replace: '        error={false}',
    test: TEST,
    why: '2026-07-02 규칙 — 조회 실패를 0딜로 위장하지 않는다. 잔액 0 과 장애는 다른 일이다.',
  },
  {
    name: '🪙마이잔액 무상 리워드 안내를 뺀다',
    file: MY,
    find: "    ? `무상 리워드 ${formatNumber(freeBalance)}딜 포함 · 환급 가능 ${formatNumber(Math.max(0, balance - freeBalance))}딜`",
    replace: '    ? undefined',
    test: TEST,
    why: '무상 딜은 현금 환급 제외다(약관) — 안 알리면 사장님이 환급되는 줄 안다.',
  },
  {
    name: '🪙마이잔액 숫자가 오기 전 높이를 안 잡는다',
    file: MY,
    find: '        loggedIn={!!getUserIdSync()}',
    replace: '        loggedIn={false}',
    test: TEST,
    why: '응답이 오면 한 줄 바 → 큰 카드로 바뀌며 아래가 통째로 밀린다(2026-09-16 에 고친 그 밀림).',
  },
  {
    name: '🪙공유카드 실패도 큰 숫자로 그린다',
    file: SHARED,
    find: '  if (error) {',
    replace: '  if (false) {',
    test: TEST,
    why: '모르는 값을 42px 로 띄우는 순간 그 화면은 거짓말을 한다.',
  },
  {
    name: '🔇중복문 이름 옆 알약이 등록 문을 다시 연다',
    file: PILL,
    find: '  return null\n}',
    replace: "  return (\n    <button onClick={() => navigate('/store/new')}>내 가게 등록</button>\n  )\n}",
    test: TEST,
    why: '같은 글자·같은 목적지가 한 화면에 둘이 된다(약 850px 간격).',
  },
]
