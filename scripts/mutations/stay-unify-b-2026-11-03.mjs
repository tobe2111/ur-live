/** 🧬 주입 — 숙소 통일 ②(2026-11-03). 가드: src/tests/unit/stay-unify-b-2026-11-03.test.ts */
const T = 'src/tests/unit/stay-unify-b-2026-11-03.test.ts'
export default [
  {
    name: 'stay-unify-b — /pass 로 들어온 숙소가 이용권 화면으로 열린다',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: "if (detail.category === 'stay_voucher' && !searchParams.get('nostay')) return <Navigate",
    replace: "if (detail.category === 'stay_voucher_x' && !searchParams.get('nostay')) return <Navigate",
    test: T,
    why: '객실·날짜 없이 이용권 구매 버튼이 보인다.',
  },
  {
    name: 'stay-unify-b — 숙소 탭의 구역 id 가 사라진다(눌러도 안 가는 탭)',
    file: 'src/pages/StayDetailPage.tsx',
    find: 'id="stay-sec-policy"',
    replace: 'data-x="stay-sec-policy"',
    test: T,
    why: '탭을 눌러도 이동하지 않는다.',
  },
]
