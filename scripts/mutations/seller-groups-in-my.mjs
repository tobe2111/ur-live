/**
 * 🧰 주입 — 마이 안 판매 = 묶음 다섯 (2026-09-26, 설계 §21)
 *
 * 여기 있는 것들은 **전부 에러 없이** 회귀한다. 좌석 가드가 빠져도 화면은 그려지고, 확인 단계가
 * 사라져도 저장은 되고, 가게 시트가 계좌를 같이 보내도 서버는 200 을 줄 수 있다(대신 PIN 을 묻는다).
 * 그래서 시험이 실제로 빨간불을 낼 수 있는지 매번 확인한다.
 */
const TEST = 'src/tests/unit/seller-groups-in-my-2026-09-26.test.ts'
const TEST_ALL = 'src/tests/unit/seller-all-in-my-2026-09-26.test.ts'

export default [
  // 🧹 **2026-10-01 철거(2차) — 환불 주입 2건을 더 내렸다.** `RefundSheet` 가 사라져 그 문(門)도
  //   없다. 환불은 `/seller/orders` 대시보드 화면이 맡고 거기엔 `confirmDialog(danger)` 가 있다 —
  //   다만 **사유 칸이 없다**(가드 머리주석의 표에 적어 뒀다. 등급 C 라 결재문으로 올렸다).
  //   − ↩️ 환불로 가는 문이 사라진다 (시트가 도달 불가가 된다)
  //   − ↩️ 환불을 닫으면 주문이 아니라 통째로 닫힌다
  {
    name: '🧰 판매 중 목록이 카드에 되살아난다 (두 곳이 갈린다)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: '          <PendingOrders work={work} onDone={onWorkDone} />',
    replace: '          <PendingOrders work={work} onDone={onWorkDone} />\n          <SellingList work={work} />',
    test: TEST,
    why: '같은 목록이 카드와 묶음 두 곳에 있으면 한쪽만 새로고침되는 날이 온다 — 그래서 지웠다.',
  },
  {
    name: '🧰 주문 묶음이 다시 대시보드로 나간다 (마이가 경유지가 된다)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    // 🔁 2026-10-01 철거 재조준: 바로가기가 `openPage`(시트 안 대시보드 화면)로 바뀌었다.
    //   지키는 것은 그대로다 — **마이가 경유지가 되지 않는다**(나가면 "대시보드가 따로 있다" 를 배운다).
    find: "          onClick={() => openPage('/seller/orders', '주문')}",
    replace: "          onClick={() => enterSeat('/seller/orders')}",
    test: TEST,
    why: '나가는 순간 사장님은 "대시보드라는 게 따로 있다" 를 배운다 — 대표 지시의 정반대다.',
  },
  {
    name: '🧰 가게 묶음 줄만 있고 시트가 안 열린다 (눌러도 아무 일이 없다)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    // 🔁 2026-10-01 철거 재조준: `store` 손수 시트가 내려갔다 → 대시보드 화면 시트(`page`)로 앵커 교체.
    //   불변식 동일: **줄만 있고 렌더가 없으면 눌러도 아무 일이 없다.**
    find: "      {tool === 'page' && page && (",
    replace: '      {false && page && (',
    test: TEST,
    why: '줄과 시트는 짝이다 — 한쪽만 있으면 에러 없이 조용히 아무 일도 안 난다.',
  },
  {
    name: '🔑 PIN 이 언제나 출금으로 돌아간다 (계좌를 넣다 푼 사람이 엉뚱한 곳에 떨어진다)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: "onDone={() => setTool(pinReturn)}",
    replace: "onDone={() => setTool('withdraw')}",
    test: TEST_ALL,
    why: '출금도 계좌도 412 를 준다 — 돌아갈 곳이 하나면 계좌를 저장도 못 한 채 출금 화면에 떨어진다.',
  },
  {
    name: '🔑 계좌 412 가 다시 막다른 길이 된다',
    file: 'src/pages/user-profile/seller-section/BankSheet.tsx',
    find: "      if (res?.code === 'PIN_REQUIRED' && onFixPin) {",
    replace: '      if (false) {',
    test: TEST_ALL,
    why: '2026-09-26 에 실제로 났던 결함이다 — 출금이 막혀 계좌를 넣으러 온 사장님이 거기서 또 막혔다.',
  },
]
