/**
 * 🧮 잔액이 늦게 와서 이용권 목록 전체가 한 번 밀리던 것 (2026-09-16) — 주입 매니페스트.
 * 가드: src/tests/unit/deal-balance-awaiting-2026-09-16.test.tsx
 */
const TEST = 'src/tests/unit/deal-balance-awaiting-2026-09-16.test.tsx'
const CARD = 'src/pages/vouchers/DealBalanceCard.tsx'
const PAGE = 'src/pages/VouchersPage.tsx'

export default [
  {
    name: '🧮 기다리는 카드가 사라진다 (숫자가 오는 순간 목록이 한 번 내려간다)',
    file: CARD,
    find: 'const awaiting = balance == null && loggedIn',
    replace: 'const awaiting = false',
    test: TEST,
    why: '첫 커밋은 누구든 balance=null 이다 — 그걸 44px 바로 그리면 응답이 올 때 170px 카드로 바뀌며 아래가 전부 밀린다.',
  },
  {
    name: '🧮 비로그인에게도 빈 카드가 뜬다 ("당신은 0" 문제가 모양만 바꿔 되살아난다)',
    file: CARD,
    find: 'const awaiting = balance == null && loggedIn',
    replace: 'const awaiting = balance == null',
    test: TEST,
    why: '2026-09-01 대표 지적 — 처음 온 사람의 첫 화면이 자기 잔액 상자면 안 된다. 로그인 여부로 갈라야 한다.',
  },
  {
    name: '🧮 숫자를 모를 때 0 을 적는다 (잠깐 거짓 잔액을 보여 준다)',
    file: CARD,
    find: 'awaiting ? <span className="inline-block w-[2.2em] h-[0.72em] rounded bg-wash align-baseline" aria-hidden="true" /> : formatNumber(balance)',
    replace: 'formatNumber(balance ?? 0)',
    test: TEST,
    why: '모르는 것과 0 은 다르다. 0 을 보여 주면 딜을 가진 사람에게 잠깐 "잔액 없음" 이라고 말하는 셈이다.',
  },
  {
    name: '🧮 페이지가 로그인 여부를 안 넘긴다 (처방이 조용히 죽는다)',
    file: PAGE,
    find: '<DealBalanceCard balance={dealBalance} loggedIn={!!userId} />',
    replace: '<DealBalanceCard balance={dealBalance} />',
    test: TEST,
    why: '부품만 고치고 호출부를 안 고치면 아무 일도 안 일어난다 — 이 레포가 반복해 당한 "조용한 부재".',
  },
  {
    name: '🧮 조회 실패가 기다림을 못 끝낸다 (빈 카드가 영원히 남는다)',
    file: PAGE,
    find: 'setDealBalance(b => b ?? 0) ',
    replace: '',
    test: TEST,
    why: 'catch 는 읽은 값을 0 으로 안 덮는다(2026-06-26). 그 규칙을 지키면서도 **한 번도 못 읽은 경우**엔 0 으로 떨어뜨려야 숫자 없는 카드가 안 남는다.',
  },
]
