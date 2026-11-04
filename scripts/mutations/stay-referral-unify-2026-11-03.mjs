/** 🧬 주입 — 숙소 소개 적립 통일 ③(2026-11-03). 가드: src/tests/unit/stay-referral-unify-2026-11-03.test.ts */
const T = 'src/tests/unit/stay-referral-unify-2026-11-03.test.ts'
export default [
  { name: 'stay-referral — 손님 취소에서 이용권 장부 회수가 빠진다', file: 'src/features/group-buy/api/stays-public.routes.ts',
    find: "reason: 'stay_cancel' })", replace: "reason: 'stay_cancel_x' })", test: T, why: '환불된 숙소의 소개비가 남는다(매장 영구 부담).' },
  { name: 'stay-referral — 결제 확정이 옛 금액이 있어도 새 장부에 적립(이중 적립)', file: 'src/worker/routes/payment.routes.ts',
    find: 'if (booking.referrer_id && !(booking.influencer_commission_amount > 0)) {', replace: 'if (booking.referrer_id) {', test: T, why: '옛 affiliate_earnings 와 새 attribution 이 둘 다 쌓인다.' },
  { name: 'stay-referral — /pass ↔ /stays 루프', file: 'src/pages/GroupBuyDetailPage.tsx',
    find: "&& !searchParams.get('nostay')) return <Navigate", replace: ") return <Navigate", test: T, why: '숙소 정보 없는 숙소 상품에서 두 화면이 서로를 끝없이 보낸다.' },
  { name: 'stay-referral — 숙소 상세에서 팔아보기가 사라진다', file: 'src/pages/StayDetailPage.tsx',
    find: '{!own && <div className="-mx-4 empty:hidden"><SellThisCard', replace: '{false && <div className="-mx-4 empty:hidden"><SellThisCard', test: T, why: '숙소만 다시 이용권과 달라진다.' },
  { name: 'stay-referral — 실제 숙소 결제 경로에서 소개 적립이 빠진다', file: 'src/features/group-buy/api/stays-public.routes.ts',
    find: "if (rb?.referrer_id && !(Number(rb.influencer_commission_amount) > 0)) await", replace: "if (false && rb?.referrer_id) await", test: T, why: '숙소 소개 링크로 팔려도 소개자에게 0원.' },
]
