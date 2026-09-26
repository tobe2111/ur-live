/**
 * 🧰 마이 안 판매 도구 넷 (2026-09-25, 설계 §19) — 주입 매니페스트.
 * 가드: src/tests/unit/seller-tools-in-my-2026-09-25.test.ts
 */
const TEST = 'src/tests/unit/seller-tools-in-my-2026-09-25.test.ts'

export default [
  {
    name: '🔴 출금 버튼이 탈퇴 엔드포인트를 부른다 (가게가 사라진다)',
    file: 'src/pages/user-profile/seller-section/WithdrawSheet.tsx',
    find: "api.post('/api/seller/deal-withdraw', {",
    replace: "api.post('/api/seller/account/withdraw', { confirm: true } && {",
    test: TEST,
    why: '이름이 비슷해 실제로 내가 설계 문서에 이렇게 적어 뒀었다. 사장님은 돈을 받으려고 눌렀는데 상품이 전부 내려가고 매장이 지워진다 — 그 API 는 성공하므로 에러도 안 난다.',
  },
  // 🩸 2026-09-25: 이 주입은 원래 *"화면이 계좌를 지정한다"* 였고, 전제가 **틀렸다**.
  //   서버는 매장 행에서 계좌를 읽지 않는다 — 본문 값을 그대로 저장하고 어드민도 그 행만 읽는다.
  //   지우지 않고 **지키려던 것**(화면이 목적지를 *지어내지* 않는다)으로 재조준했다.
  {
    name: '🔴 화면이 출금 계좌를 지어낸다 (서버 값이 아니라 상수)',
    file: 'src/pages/user-profile/seller-section/WithdrawSheet.tsx',
    find: "        account_holder: payout.account_holder,",
    replace: "        account_holder: '홍길동',",
    test: TEST,
    why: '목적지를 화면이 정할 수 있으면 돈이 다른 계좌로 갈 길이 열린다. 계좌는 좌석 인증된 서버 응답을 그대로 되돌려보내는 것뿐이어야 한다.',
  },
  {
    name: '🔴 412 넷이 "출금 실패" 한 마디로 뭉개진다',
    file: 'src/pages/user-profile/seller-section/WithdrawSheet.tsx',
    find: "  BUSINESS_REGISTRATION_REQUIRED: '사업자등록증이 아직 확인되지 않았어요. 전체 도구 › 사업자 정보에서 올리면 확인 후 출금할 수 있어요.',",
    replace: '',
    test: TEST,
    why: '사장님이 무엇을 해야 하는지 모른 채 같은 버튼을 반복해 누른다(레이트리밋 5회/시간에 걸린다).',
  },
  {
    name: '💸 환불이 상태 변경 취소로 되돌아간다',
    file: 'src/pages/user-profile/seller-section/RefundSheet.tsx',
    find: "const r = await api.post(`/api/seller/orders/${encodeURIComponent(picked.orderNumber)}/refund`, {",
    replace: "const r = await api.put(`/api/seller/orders/${encodeURIComponent(picked.orderNumber)}/status`, { status: 'CANCELLED' }, {",
    test: TEST,
    why: '그 길은 고객 돈을 안 돌려주고 취소 알림만 보낸다(서버가 REFUND_REQUIRED 로 막지만, 화면이 그 길을 쓰면 안 된다).',
  },
  {
    name: '💸 환불이 한 번의 탭으로 실행된다',
    file: 'src/pages/user-profile/seller-section/RefundSheet.tsx',
    find: '            결제는 <span className="font-bold text-gray-900 dark:text-white">바로 취소</span>되고 손님에게 돌아갑니다.\n            되돌릴 수 없습니다. 이용권이 발급됐다면 함께 회수됩니다.',
    replace: '            결제가 취소됩니다.',
    test: TEST,
    why: '되돌릴 수 없는 일에 경고가 없으면 잘못 누른 환불을 수습할 방법이 없다.',
  },
  {
    name: '📈 분석이 주문 목록으로 매출을 다시 계산한다',
    file: 'src/pages/user-profile/seller-section/AnalyticsSheet.tsx',
    find: "api.get('/api/seller/dashboard/stats')",
    replace: "api.get('/api/seller/orders?limit=50')",
    test: TEST,
    why: '두 곳에서 매출을 계산하면 마이와 대시보드가 다른 숫자를 말하는 날이 온다(이 레포가 반복해 당한 클래스).',
  },
  {
    name: '🧰 등록 폼을 마이가 복제한다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: "enterSeat('/seller/meal-voucher/new')",
    replace: "enterSeat('/seller/products/new')",
    test: TEST,
    why: '이용권 등록은 전용 단계 폼이다 — 일반 상품 폼으로 보내면 매장·픽업 설정이 통째로 빠진다.',
  },
  {
    name: '🪑 도구 시트가 좌석을 안 맞추고 열린다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: '    if (currentSeatId() !== store.seller_id) {\n      setEntering(true)',
    replace: '    if (false) {\n      setEntering(true)',
    test: TEST,
    why: '화면엔 A 가 떠 있는데 토큰이 B 면, 환불 목록에 B 의 주문이 뜨고 사장님이 남의 주문을 환불한다.',
  },
  {
    name: '🗂️ 시트가 자체 오버레이를 그려 셸이 두 벌이 된다',
    file: 'src/pages/user-profile/seller-section/AnalyticsSheet.tsx',
    find: '    <Sheet title="매출 분석" onClose={onClose}>',
    replace: '    <div className="fixed inset-0 bg-black/45" onClick={onClose} /><Sheet title="매출 분석" onClose={onClose}>',
    test: TEST,
    why: '높이·z-index·스크롤 규약이 시트마다 갈리면 폰에서 아래가 잘리는 시트가 생긴다(CLAUDE.md 모바일 룰).',
  },
  {
    name: '🏦 출금이 입금 계좌를 본문에서 뺀다 (송금 못 하는 지급 행)',
    file: 'src/pages/user-profile/seller-section/WithdrawSheet.tsx',
    find: "        bank_name: payout.bank_name,",
    replace: "",
    test: TEST,
    why: 'settlements 행은 본문 값을 그대로 저장하고 어드민 지급 센터는 그 행만 읽는다(sellers 폴백 없음) — 빠지면 계좌 없는 지급 행이 에러 없이 쌓인다.',
  },
  {
    name: '🏦 출금이 계좌를 localStorage 에서 읽는다 (좌석을 안 따라간다)',
    file: 'src/pages/user-profile/seller-section/WithdrawSheet.tsx',
    find: "        account_number: payout.account_number,",
    replace: "        account_number: localStorage.getItem('seller_account_number') || '',",
    test: TEST,
    why: 'seller_account_number 는 좌석을 따라 안 바뀐다 — 가게를 옮긴 뒤 출금하면 직전 가게 계좌로 송금 행이 생긴다.',
  },
  {
    name: '🏦 계좌가 없어도 출금을 보낼 수 있게 된다',
    file: 'src/pages/user-profile/seller-section/WithdrawSheet.tsx',
    find: "&& bizVerified === true && payout !== null",
    replace: "&& bizVerified === true",
    test: TEST,
    why: '송금할 계좌가 없는 지급 행을 만드는 것이 아무것도 안 하는 것보다 나쁘다.',
  },
  {
    name: '🏦 계좌 번호가 화면에 통째로 찍힌다',
    file: 'src/pages/user-profile/seller-section/WithdrawSheet.tsx',
    find: "{maskAccount(payout.account_number)}",
    replace: "{payout.account_number}",
    test: TEST,
    why: '확인에 필요한 건 뒤 4자리뿐이다 — 전체를 찍으면 화면 캡처 한 장으로 계좌가 통째로 샌다.',
  },
]
