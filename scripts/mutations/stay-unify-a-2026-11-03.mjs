/** 🧬 주입 — 숙소 통일 A(2026-11-03). 가드: src/tests/unit/stay-unify-a-2026-11-03.test.ts */
const T = 'src/tests/unit/stay-unify-a-2026-11-03.test.ts'
export default [
  {
    name: 'stay-unify-a — 담긴 숙소가 다시 이용권 상세(/pass)로 간다',
    file: 'src/worker/routes/curator.routes.ts',
    find: "prod.category === 'stay_voucher') return c.redirect(`/stays/${productId}?aff=",
    replace: "prod.category === 'stay_voucher_x') return c.redirect(`/stays/${productId}?aff=",
    test: T,
    why: '숙소가 객실·날짜 없이 이용권 화면으로 열린다.',
  },
  {
    name: 'stay-unify-a — 등록 폼 숙박에서 객실 칸이 사라진다(객실 없는 숙소)',
    file: 'src/pages/seller-meal-voucher/VoucherInfoStep.tsx',
    find: "{isStay ? <StayRoomsFields form={form} update={update} /> : <DiscountPriceFields",
    replace: "{false ? <StayRoomsFields form={form} update={update} /> : <DiscountPriceFields",
    test: T,
    why: '상세에서 고를 방이 0개인 숙소가 생긴다.',
  },
]
