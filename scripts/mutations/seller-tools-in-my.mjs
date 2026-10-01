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
    // 🔁 2026-09-26 재조준: 대표 *"이용권 등록, 숙소까지 해줘"* 로 등록이 **마이 안으로** 들어왔다.
    //   옛 앵커(`enterSeat('/seller/meal-voucher/new')`)가 사라져 낡은 지도가 됐다.
    //   지키는 것은 그대로다 — 마이가 등록 폼 부품을 **직접 들이지 않는다**(들이면 두 벌로 갈린다).
    name: '🧰 등록 폼을 마이가 복제한다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    // 🔁 2026-09-26 재조준: 시트 import 가 전부 `lazy` 로 바뀌어 그 정적 줄이 사라졌다.
    //   지키는 것은 그대로다 — 마이가 등록 폼 **부품**을 직접 들이지 않는다.
    find: "import PendingOrders from './seller-section/PendingOrders'",
    replace: "import PendingOrders from './seller-section/PendingOrders'\nimport VoucherInfoStep from '@/pages/seller-meal-voucher/VoucherInfoStep'",
    test: TEST,
    why: '이용권 등록은 3단계 전용 폼이다 — 그 부품을 마이가 직접 들이는 순간 두 벌로 갈리기 시작한다(전용 시트가 같은 페이지를 통째로 연다).',
  },
  {
    name: '🪑 도구 시트가 좌석을 안 맞추고 열린다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    // 🔁 2026-10-01 철거 재조준: 좌석 규칙이 `ensureSeat` **한 벌**로 합쳐졌다.
    //   종전 앵커는 복사된 두 곳에 걸려 *"주입 대상이 2곳"* 으로 잡혔다(그 검사가 내 중복을 찾아냈다).
    //   불변식은 그대로 — **좌석을 안 맞추고 열면 남의 가게 데이터를 그린다.**
    find: "    if (currentSeatId() === store.seller_id) return true",
    replace: "    return true",
    test: 'src/tests/unit/seller-tools-in-my-2026-09-25.test.ts',
    why: '좌석 토큰이 다른 가게를 가리키는데 시트를 열면 **남의 가게 주문·정산**이 뜬다. 서버는 토큰으로 거르므로 에러가 아니라 **다른 가게 데이터**가 보인다 — 그게 더 나쁘다.',
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
