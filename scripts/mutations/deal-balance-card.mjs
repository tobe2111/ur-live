/**
 * 🧬 주입 — 딜 잔액 카드 확정 구조(안 A3 + 42px, 2026-09-14)
 *   대표가 시안 셋 → 여섯을 거쳐 고른 것이라, **조용히 되돌아가는 것**을 막는 게 이 시험의 일이다.
 */
export default [
  {
    name: '🪙잔액 숫자가 종전 36px 로 되돌아간다',
    file: 'src/pages/vouchers/DealBalanceCard.tsx',
    find: `text-[42px]`,
    replace: `text-[36px]`,
    test: 'src/tests/unit/deal-balance-card-2026-09-14.test.ts',
    why: '대표가 36/42/48 중 42 를 골랐다. 두 층 구조에서 36 은 아래층에 눌려 보인다.',
  },
  {
    name: '🪙잔액 위층에 채운 버튼이 다시 생긴다',
    file: 'src/pages/vouchers/DealBalanceCard.tsx',
    find: `          <span className={\`font-bold text-gray-400 dark:text-gray-500 \${compact ? 'text-[15px]' : 'text-[18px]'}\`}>딜</span>`,
    replace: `          <span className={\`font-bold text-gray-400 dark:text-gray-500 \${compact ? 'text-[15px]' : 'text-[18px]'}\`}>딜</span>
          <button type="button" className="ml-auto px-3 py-1 rounded-full bg-brand text-white text-[12px]">내역</button>`,
    test: 'src/tests/unit/deal-balance-card-2026-09-14.test.ts',
    why:
      '종전에 바로 이것이 문제였다 — 브랜드 블루로 채운 [내역] 알약이 화면에서 가장 센 버튼인데 ' +
      '내역 보기는 주 행동이 아니다. 위층은 금액만 두는 것이 A3 의 전부다.',
  },
  {
    name: '🪙잔액 아래층 두 칸이 하나로 줄어든다',
    file: 'src/pages/vouchers/DealBalanceCard.tsx',
    find: `        <span className="w-px bg-rule" aria-hidden="true" />`,
    replace: ``,
    test: 'src/tests/unit/deal-balance-card-2026-09-14.test.ts',
    why: '두 행동이 같은 무게로 나란히 서는 것이 A3 다. 가르는 선이 없으면 두 칸으로 안 읽힌다.',
  },
  {
    name: '🪙잔액 "1딜 = 1원" 이 되살아난다',
    file: 'src/pages/vouchers/DealBalanceCard.tsx',
    find: `        </div>
      </div>

      {/* 아래층`,
    replace: `        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">1딜 = 1원 · 현금처럼 사용</p>
      </div>

      {/* 아래층`,
    test: 'src/tests/unit/deal-balance-card-2026-09-14.test.ts',
    why:
      '대표 확정: "딜의 값어치를 말할 필요는 없어. 어차피 교환권을 통해서 어느 정도는 알거니까." ' +
      '지운 이유가 자리 부족이 아니라 **바로 아래 가격표가 같은 말을 한다**는 것이다.',
  },
  {
    name: '🪙잔액 0 에도 큰 카드를 쓴다',
    file: 'src/pages/vouchers/DealBalanceCard.tsx',
    find: `  if (!balance && !awaiting) {`,
    replace: `  if (false) {`,
    test: 'src/tests/unit/deal-balance-card-2026-09-14.test.ts',
    why:
      'dealBalance 는 비로그인 방문자에게도 0 이다. 큰 카드를 그대로 쓰면 첫 진입이 ' +
      '"당신은 0" 이라고 알리는 상자로 시작한다 — 2026-09-01 에 이미 한 번 고친 실수다.',
  },
  {
    name: '🪙잔액 PC 가 모바일과 다른 카드를 쓴다',
    file: 'src/pages/VouchersPage.tsx',
    find: `            <DealBalanceCard balance={dealBalance} variant="compact" loggedIn={!!userId} />`,
    replace: `            <div className="rounded-2xl p-4 bg-white shadow-lift"><p>내 딜 잔액</p></div>`,
    test: 'src/tests/unit/deal-balance-card-2026-09-14.test.ts',
    why:
      '두 벌이 되면 한쪽만 고쳐지는 사고가 난다 — 며칠 전 딜 선택 UI 에서 실제로 PC 를 통째로 잊었다. ' +
      '같은 부품을 쓰는 것이 그 클래스의 유일한 방어다.',
  },
  {
    name: '🪙잔액 페이지가 부품 대신 다시 인라인으로 그린다',
    file: 'src/pages/VouchersPage.tsx',
    find: `        <DealBalanceCard balance={dealBalance} loggedIn={!!userId} />`,
    replace: `        <div className="rounded-2xl p-5 bg-white shadow-lift"><span className="text-[42px]">0</span></div>`,
    test: 'src/tests/unit/vouchers-top-chrome.test.ts',
    why:
      '2026-09-14 에 잔액 카드를 부품으로 뺐고, `vouchers-top-chrome` ① 의 불변식(0 이면 큰 카드를 ' +
      '내지 않는다)을 그 부품으로 **재조준**했다. 재조준한 단언이 실제로 실패할 수 있어야 한다 — ' +
      '자리를 옮긴 가드가 헛도는 것이 이 레포가 반복해 당한 "낡은 지도" 클래스다.',
  },
]
