// 🏨 2026-11-04 숙소 이용권 = 이용권과 같은 움직임·이용 안내 — 가드가 실제로 실패하는지.
const TEST = 'src/tests/unit/stay-motion-howto-2026-11-04.test.ts'
export default [
  {
    name: 'stay-motion — 숙소 상세에서 이용 방법이 빠진다',
    file: 'src/pages/StayDetailPage.tsx',
    find: '<RedeemHowTo steps={STAY_STEPS} fallbackLabel={STAY_FALLBACK_LABEL} fallback={STAY_REDEEM_FALLBACK} />',
    replace: '',
    test: TEST,
    why: '숙소 손님은 체크인 때 무엇을 보여 줄지 모른다 — 이용권 상세엔 있다.',
  },
  {
    name: 'stay-motion — 숙소 이용 방법이 이용권 말(확인코드)로 나온다',
    file: 'src/pages/group-buy/RedeemHowTo.tsx',
    find: '{steps.map(({ n, t, d }, i) => (',
    replace: '{STEPS.map(({ n, t, d }, i) => (',
    test: TEST,
    why: '숙소는 확인코드로 못 쓴다(직원 스캔 전용) — 거짓 안내가 된다.',
  },
  {
    name: 'stay-motion — 숙소 결제 완료가 옛 화면으로 돌아간다',
    file: 'src/pages/StayCheckoutReturnPage.tsx',
    find: '<PaymentCompleteTicket productId={done.productId} qty={done.rooms} amount={amountDone} stay={{ rooms: done.rooms }} />',
    replace: '<p>예약이 확정되었습니다</p>',
    test: TEST,
    why: '이용권 결제 완료와 다른 화면 — 대표가 통일을 지시했다.',
  },
  {
    name: 'stay-motion — 숙소 티켓에 상품 정가 기준 할인율이 뜬다',
    file: 'src/pages/group-buy/PaymentCompleteTicket.tsx',
    find: 'const pct = stay ? null :',
    replace: 'const pct = 0 ? null :',
    test: TEST,
    why: '숙소 가격은 객실·날짜별이라 상품 정가와 비교한 할인율은 지어낸 숫자다.',
  },
]
