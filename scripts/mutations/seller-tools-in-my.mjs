/**
 * 🧰 마이 안 판매 도구 넷 (2026-09-25, 설계 §19) — 주입 매니페스트.
 * 가드: src/tests/unit/seller-tools-in-my-2026-09-25.test.ts
 */
const TEST = 'src/tests/unit/seller-tools-in-my-2026-09-25.test.ts'

export default [
  // 💰 2026-10-12 재조준: 돈 시트가 `WithdrawSheet`(출금 신청) → `PayoutSheet`(주간 자동 정산, 읽기 전용).
  //   출금 신청 전용이던 주입(412 번역 · 본문 계좌 필드 · 최소 금액)은 대상이 사라져 내렸고,
  //   지키려던 큰 것(탈퇴 API 금지 · 좌석 · 계좌 출처 · 실패를 0으로 위장 금지)은 새 시트로 옮겼다.
  {
    name: '🔴 정산 시트가 탈퇴 엔드포인트를 부른다 (가게가 사라진다)',
    file: 'src/pages/user-profile/seller-section/PayoutSheet.tsx',
    find: "        api.get('/api/seller/payouts'),",
    replace: "        api.post('/api/seller/account/withdraw', { confirm: true }),",
    test: TEST,
    why: '이름이 비슷해 실제로 설계 문서에 "출금" 이라고 적혀 있었다. 사장님은 돈을 보려고 눌렀는데 가게가 지워진다 — 그 API 는 성공하므로 에러도 안 난다.',
  },
  {
    name: '💰 정산 시트가 한 번도 적립되지 않는 잔액을 다시 읽는다',
    file: 'src/pages/user-profile/seller-section/PayoutSheet.tsx',
    find: "        api.get('/api/seller/payouts'),",
    replace: "        api.get('/api/seller/deal-balance'),",
    test: TEST,
    why: '`seller_deal_balances` 는 적립 경로가 없어 늘 0 이다 — 사장님은 매출이 있는데 "0원" 을 본다(2026-10-12 까지 실제로 그랬다).',
  },
  {
    name: '🏦 정산 시트가 계좌 여부를 localStorage 로 판정한다 (좌석을 안 따라간다)',
    file: 'src/pages/user-profile/seller-section/PayoutSheet.tsx',
    find: "        api.get('/api/seller/profile').catch(() => null),",
    replace: "        Promise.resolve({ data: { success: true, data: { bank_name: localStorage.getItem('seller_bank_name'), bank_account: localStorage.getItem('seller_account_number') } } }),",
    test: TEST,
    why: 'seller_bank_name 은 좌석을 따라 안 바뀐다 — 가게를 옮긴 뒤엔 직전 가게의 계좌 상태를 보여 준다.',
  },
  {
    name: '💰 정산 조회 실패가 0원으로 위장된다',
    file: 'src/pages/user-profile/seller-section/PayoutSheet.tsx',
    find: "        if (!p.data?.success) { setFailed(true); return }",
    replace: "        if (!p.data?.success) { setData({ payable: 0, scheduled_total: 0, sent_total: 0, payouts: [] }); return }",
    test: TEST,
    why: '모르는 것과 0 은 다르다 — 매출이 있는 사장님에게 "받을 돈 0원" 이라고 말하면 정산이 끊긴 줄 안다(머니 표면 룰).',
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
]
