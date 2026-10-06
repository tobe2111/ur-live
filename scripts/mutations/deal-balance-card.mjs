/**
 * 🧬 주입 — 딜 잔액 카드 확정 구조
 *   2026-09-14 안 A3(두 층 · 42px) → **2026-09-30 안 B(납작 · 28px · ~72px)** 로 대체.
 *   대표가 시안 넷을 보고 고른 것이라, **조용히 되돌아가는 것**을 막는 게 이 시험의 일이다.
 *   ⚠️ A3 가 지키던 이유 넷(채운 버튼 0 · 고아 링크 0 · "1딜=1원" 없음 · 0 이면 큰 카드 안 씀)은
 *      배치가 바뀌어도 **그대로** 살아 있다 — 아래 주입도 그 넷을 그대로 겨눈다.
 */
const CARD = 'src/pages/vouchers/DealBalanceCard.tsx'
const T = 'src/tests/unit/deal-balance-card-2026-09-14.test.ts'

export default [
  {
    name: '🪙잔액 숫자가 종전 두 층 카드 크기(40px)로 되돌아간다',
    file: CARD,
    /* 🔧 2026-09-30 재조준(머지): main #1579 의 디스플레이 스케일 이행으로 종전 두 층 숫자가
       42 → **40** 이 됐다. 되돌아가는 값도 그걸 따라간다 — 42 는 이제 스케일 밖이라(정본
       `28·34·40·48·60·76·96`) 심으면 **다른 가드**가 먼저 빨간불을 내서 이 주입이 무엇을
       검증했는지 알 수 없게 된다. 결함은 그대로다: 납작 카드가 두 층 시절 크기로 돌아간다. */
    find: `text-[28px]`,
    replace: `text-[40px]`,
    test: T,
    why: '대표 2026-09-30: "내 딜 잔액 부분이 너무 크달까?" — 큰 숫자 두 층이 152px 였고 그게 첫 상품을 화면 절반 아래로 밀었다.',
  },
  {
    name: '🪙잔액 금액 옆에 채운 버튼이 다시 생긴다',
    file: CARD,
    find: `            <span className="font-bold text-gray-400 dark:text-gray-500 text-[13px]">딜</span>`,
    replace: `            <span className="font-bold text-gray-400 dark:text-gray-500 text-[13px]">딜</span>
            <button type="button" className="ml-auto px-3 py-1 rounded-full bg-brand text-white text-[12px]">내역</button>`,
    test: T,
    why:
      '종전에 바로 이것이 문제였다 — 브랜드 블루로 채운 [내역] 알약이 화면에서 가장 센 버튼인데 ' +
      '내역 보기는 주 행동이 아니다. 금액 블록은 글자뿐이어야 한다.',
  },
  {
    name: '🪙잔액 행동 두 칸이 하나로 붙는다',
    file: CARD,
    find: `      <span className="w-px h-3 bg-rule" aria-hidden="true" />`,
    replace: ``,
    test: T,
    why: '두 행동이 같은 무게로 나란히 서는 것이 이 카드의 규약이다. 가르는 선이 없으면 두 칸으로 안 읽힌다.',
  },
  {
    name: '🪙잔액 "1딜 = 1원" 이 되살아난다',
    file: CARD,
    find: `          <p className="text-gray-500 dark:text-gray-400 tracking-wide mb-1 text-[12px]">내 딜 잔액</p>`,
    replace: `          <p className="text-gray-500 dark:text-gray-400 tracking-wide mb-1 text-[12px]">내 딜 잔액</p>
          <p className="text-[12px] text-gray-400 mt-1">1딜 = 1원 · 현금처럼 사용</p>`,
    test: T,
    why:
      '대표 확정: "딜의 값어치를 말할 필요는 없어. 어차피 교환권을 통해서 어느 정도는 알거니까." ' +
      '지운 이유가 자리 부족이 아니라 **바로 아래 가격표가 같은 말을 한다**는 것이다.',
  },
  {
    name: '🪙잔액 좁은 레일에서도 행동을 한 줄에 욱여넣는다',
    file: CARD,
    find: `    <div className={compact ? 'flex items-center gap-3 mt-2' : 'ml-auto shrink-0 flex items-center gap-3 pl-3'}>`,
    replace: `    <div className={'ml-auto shrink-0 flex items-center gap-3 pl-3'}>`,
    test: T,
    why:
      'PC 좌측 레일은 248px 다. 26px 숫자 + 행동 둘을 한 줄에 넣으면 7자리 잔액(999,999)에서 ' +
      '넘친다(실측 필요폭 248 > 가용 216). 좁은 쪽에서는 행동을 아래로 내린다.',
  },
  {
    name: '🪙잔액 0 에도 큰 카드를 쓴다',
    file: CARD,
    find: `  if (!balance && !awaiting) {`,
    replace: `  if (false) {`,
    test: T,
    why:
      'dealBalance 는 비로그인 방문자에게도 0 이다. 큰 카드를 그대로 쓰면 첫 진입이 ' +
      '"당신은 0" 이라고 알리는 상자로 시작한다 — 2026-09-01 에 이미 한 번 고친 실수다.',
  },
  {
    name: '🪙잔액 PC 가 모바일과 다른 카드를 쓴다',
    file: 'src/pages/VouchersPage.tsx',
    find: `            <DealBalanceCard balance={dealBalance} variant="compact" loggedIn={!!userId} />`,
    replace: `            <div className="rounded-2xl p-4 bg-white shadow-lift"><p>내 딜 잔액</p></div>`,
    test: T,
    why:
      '두 벌이 되면 한쪽만 고쳐지는 사고가 난다 — 딜 선택 UI 에서 실제로 PC 를 통째로 잊었다. ' +
      '같은 부품을 쓰는 것이 그 클래스의 유일한 방어다.',
  },
  {
    name: '🪙잔액 페이지가 부품 대신 다시 인라인으로 그린다',
    file: 'src/pages/VouchersPage.tsx',
    find: `        <DealBalanceCard balance={dealBalance} loggedIn={!!userId} />`,
    /* ⚠️ 심는 표식은 **시험이 찾는 그 값**이어야 한다(main #1579 이 40 으로 옮기며 남긴 경고).
       안 B 의 큰 숫자는 28px 이므로 여기도 28 — 갈리면 "인라인 회귀" 단언이 헛돈다
       (다른 단언 때문에 빨갛긴 해서, 지키려던 그 줄이 죽은 걸 아무도 못 본다). */
    replace: `        <div className="rounded-2xl p-5 bg-white shadow-lift"><span className="text-[28px]">0</span></div>`,
    test: 'src/tests/unit/vouchers-top-chrome.test.ts',
    why:
      '2026-09-14 에 잔액 카드를 부품으로 뺐고, `vouchers-top-chrome` ① 의 불변식(0 이면 큰 카드를 ' +
      '내지 않는다)을 그 부품으로 **재조준**했다. 재조준한 단언이 실제로 실패할 수 있어야 한다 — ' +
      '자리를 옮긴 가드가 헛도는 것이 이 레포가 반복해 당한 "낡은 지도" 클래스다.',
  },
]
