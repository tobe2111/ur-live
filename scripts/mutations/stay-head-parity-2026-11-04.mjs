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
]
