/** 🎟️ 이용권 상세 D안(2026-10-11) — `src/tests/unit/pass-detail-d-2026-10-11.test.ts` 가 실제로 실패할 수 있는가. */
const TEST = 'src/tests/unit/pass-detail-d-2026-10-11.test.ts'
export default [
  {
    name: '🎟️D 바의 구매하기가 창을 건너뛰고 바로 결제한다',
    file: 'src/pages/group-buy/DealBottomBar.tsx',
    find: ": () => setOpen(true)}",
    replace: ": () => onJoin()}",
    test: TEST,
    why: '수량을 고를 자리가 창으로 옮겨갔다 — 바에서 바로 결제하면 언제나 1장이 결제된다.',
  },
  {
    name: '🎟️D 유효기간 빈 폴백이 돌아온다',
    file: 'src/pages/group-buy/UsageGuide.tsx',
    find: "const expiry = voucherExpiry ? safeDate(voucherExpiry)?.toLocaleDateString('ko-KR') : null",
    replace: "const expiry = voucherExpiry ? safeDate(voucherExpiry)?.toLocaleDateString('ko-KR') : '발급 후 사용 기간 적용'",
    test: TEST,
    why: '대표가 짚은 "부연설명" 그 자체 — 아무 정보도 없는 문장이다.',
  },
  {
    name: '🎟️D 모바일 셀러 카드가 다시 뜬다',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: '<div className={`hidden lg:block ${PASS_CARD}`}><SellerCard',
    replace: '<div><SellerCard',
    test: TEST,
    why: '매장 이름이 다시 네 번 나온다 — 가게로 가는 입구는 매장 카드 머리가 맡는다.',
  },
  {
    name: '🎟️D PC 에서 카드가 다시 평면으로 풀린다',
    file: 'src/shared/pass-head.ts',
    find: "overflow-hidden lg:mx-0 lg:mb-4'",
    replace: "overflow-hidden lg:mx-0 lg:mb-4 lg:rounded-none lg:shadow-none'",
    test: TEST,
    why: '대표 "PC도 해야하는거 아니야?" — PC 만 옛 평면으로 남으면 같은 상품이 두 화면에서 다른 서비스처럼 보인다.',
  },
]
