/** 🧬 주입 — 하단 구매 바 통일(2026-10-27). 가드: src/tests/unit/buy-bar-unify-2026-10-27.test.tsx */
const T = 'src/tests/unit/buy-bar-unify-2026-10-27.test.tsx'
export default [
  {
    name: 'buy-bar-unify — 숙소 바가 다시 자기 작은 버튼을 그린다',
    file: 'src/pages/stay-detail/StayStickyBar.tsx',
    find: "          <BuyBarCta on onClick={hasCart ? onBook : onPickRoom}>\n            {hasCart ? (cartTotalQty === 1 ? '예약하기' : '묶음 예약 →') : '객실 고르기'}\n          </BuyBarCta>",
    replace: "          <button type=\"button\" className=\"px-5 py-3 bg-brand text-white rounded-xl\" onClick={hasCart ? onBook : onPickRoom}>\n            {hasCart ? (cartTotalQty === 1 ? '예약하기' : '묶음 예약 →') : '객실 고르기'}\n          </button>",
    test: T,
    why: '두 상세의 주 버튼이 다시 갈린다 — 하나를 고치면 다른 쪽이 남는 그 클래스.',
  },
  {
    name: 'buy-bar-unify — 공용 가격 칸이 작아진다',
    file: 'src/components/deal/BuyBar.tsx',
    find: '<div className="text-[24px] font-bold tracking-[-.02em] leading-tight"',
    replace: '<div className="text-[17px] font-bold tracking-[-.02em] leading-tight"',
    test: T,
    why: '가격이 바의 주인공이다.',
  },
]
