/**
 * 🪙 마이 딜 잔액 통합 + 🔇 중복 등록 문 제거 되돌려-검증 주입 (2026-09-28).
 * 가드: src/tests/unit/my-balance-and-duplicate-door-2026-09-28.test.ts
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일.
 */
const TEST = 'src/tests/unit/my-balance-and-duplicate-door-2026-09-28.test.ts'
/* 🔁 2026-09-29 재조준(안 C): `TeamPointsCard` 가 사라지고 딜 잔액이 상단 **숫자 한 줄**로 옮겨갔다.
   지키려던 것(딜이 마이에서 사라지지 않는다 · 실패를 0 으로 위장하지 않는다 · 무상 리워드 고지 ·
   값 도착 전 높이)은 전부 그대로라 **앵커만** 새 파일로 옮긴다. */
const MY = 'src/pages/user-profile/MyStats.tsx'
const SHARED = 'src/pages/vouchers/DealBalanceCard.tsx'
const PILL = 'src/pages/user-profile/SellerSwitchInline.tsx'

export default [
  {
    name: '🪙마이잔액 딜 칸이 상단 줄에서 통째로 사라진다',
    file: MY,
    // 🔁 2026-09-30 재조준 — 값에서 단위(`unit="딜"`)를 뺐다(390px 에서 숫자가 잘리던 원인).
    //   불변식은 그대로다: **딜 칸이 이 줄에 있어야 한다.**
    find: '        <Cell label="내 딜" to={DEAL_PATH} value={balance} />\n',
    replace: '',
    test: TEST,
    why: '딜은 이 화면에서 가장 중요한 숫자다 — 칸이 빠져도 나머지 둘이 멀쩡히 서서 아무도 신고하지 않는다.',
  },
  {
    name: '🪙마이잔액 실패를 조용히 삼킨다 (0딜로 보인다)',
    file: MY,
    find: '          .catch(() => setBalance(null))',
    replace: '          .catch(() => setBalance(0))',
    test: TEST,
    why: '2026-07-02 규칙 — 조회 실패를 0딜로 위장하지 않는다. 잔액 0 과 장애는 다른 일이다.',
  },
  {
    name: '🪙마이잔액 무상 리워드 안내를 뺀다',
    file: MY,
    find: '      {balance != null && freeBalance > 0 && (',
    replace: '      {false && (',
    test: TEST,
    why: '무상 딜은 현금 환급 제외다(약관) — 안 알리면 사장님이 환급되는 줄 안다.',
  },
  {
    name: '🪙마이잔액 숫자가 오기 전 높이를 안 잡는다',
    file: MY,
    find: '          <span className="inline-block w-10 h-[18px] align-middle rounded bg-gray-100 dark:bg-white/[0.06]" aria-hidden="true" />',
    replace: '          <>0</>',
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
