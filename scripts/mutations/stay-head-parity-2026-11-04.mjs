// 🏨 2026-11-04 숙소 폰 머리 = 이용권 폰 머리 — 가드가 실제로 실패하는지.
const TEST = 'src/tests/unit/stay-detail-parity-2026-11-04.test.ts'
const HEAD = 'src/pages/stay-detail/StayHeadCard.tsx'
export default [
  {
    name: 'stay-head — 머리에서 가격 줄이 빠진다(이용권 머리엔 있다)',
    file: HEAD,
    find: '{formatNumber(minPrice)}원~',
    replace: '원~',
    test: TEST,
    why: '이용권 상세는 사진 아래 머리에 가격을 말한다 — 숙소만 빠지면 다시 다른 화면이 된다.',
  },
  {
    name: 'stay-head — 폰 머리에 주소 줄이 되돌아온다',
    file: HEAD,
    find: '      <h1 className={STAY_HEAD.h1}>{name}</h1>',
    replace: '      <h1 className={STAY_HEAD.h1}>{name}</h1>\n      <PinIcon className="w-3 h-3" />',
    test: TEST,
    why: '이용권 머리는 2026-11-02 C안에서 주소 줄을 걷었다 — 위치 구역이 같은 말을 한다.',
  },
  {
    name: 'stay-head — 옛 추천 할인 배너가 되돌아온다(할인은 0인데 약속)',
    file: 'src/pages/StayDetailPage.tsx',
    find: "        {/* 🗑️ 2026-11-04: 옛 '추천 할인 N% 적용' 배너 제거",
    replace: "        {referrerId && <p>추천 할인 {stay.influencer_discount_pct}% 적용</p>}\n        {/* 🗑️ 2026-11-04: 옛 '추천 할인 N% 적용' 배너 제거",
    test: TEST,
    why: '예약 생성이 옛 객실 할인을 언제나 건너뛴다 — 배너가 서면 손님에게 거짓 할인이다.',
  },
]
