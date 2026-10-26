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
    find: "lg:mb-4 lg:rounded-2xl lg:shadow-lift'",
    replace: "lg:mb-4'",
    test: TEST,
    why: '대표 "PC도 해야하는거 아니야?" — PC 만 옛 평면으로 남으면 같은 상품이 두 화면에서 다른 서비스처럼 보인다.',
  },
  {
    name: '🎟️D 스캔 예외가 2단계에서 떨어져 나간다',
    file: 'src/pages/group-buy/RedeemHowTo.tsx',
    find: "{n === '2' && (",
    replace: "{n === '9' && (",
    test: TEST,
    why: '예외가 어느 순간의 일인지가 자리로 읽혀야 한다(대표 확정 시안 1) — 떨어지면 손님이 스캔 실패 때 무엇을 할지 못 찾는다.',
  },
  {
    name: '🎟️C 머리가 다시 사진을 덮는다 (대표 "왜 사진을 가리고 있고")',
    file: 'src/shared/pass-head.ts',
    // 🔁 2026-10-24 (그루폰식): 머리 여백이 pt-5 pb-3 으로 바뀌었다 — 불변식(음수 위 여백 금지) 그대로.
    find: "card: 'lg:hidden relative mx-3 mb-3 px-1 pt-5 pb-3'",
    replace: "card: 'lg:hidden relative mx-3 -mt-7 mb-3 px-1 pt-5 pb-3'",
    test: 'src/tests/unit/pass-detail-d-2026-10-11.test.ts',
    why: '라이브 실측 28px 가림. 히어로 크롭이 gravity=auto 라 피사체가 아래 앉으면 그 피사체가 가려진다.',
  },
  {
    name: '🎟️C 머리에 판(배경·그림자)이 돌아온다',
    file: 'src/shared/pass-head.ts',
    find: "card: 'lg:hidden relative mx-3 mb-3 px-1",
    replace: "card: 'lg:hidden relative mx-3 mb-3 bg-[var(--gbd-card)] shadow-lift px-1",
    test: 'src/tests/unit/pass-detail-d-2026-10-11.test.ts',
    why: '대표가 C(평면)를 고른 이유가 "투박하다" 였다. 판이 돌아오면 그 지적으로 되돌아간다.',
  },
  {
    name: "🎟️C '1장당 N원 아껴요' 상자가 돌아온다",
    // 🔁 2026-10-24 (그루폰식): 가격이 '옵션 선택' 카드로 옮겨갔다 — 상자가 돌아올 자리도 그쪽이다.
    // 🔁 2026-10-25 (E안): 옵션 카드를 걷어 가격은 머리(`PassHeadCard`) 한 곳 — 상자가 돌아올 자리도 거기다.
    file: 'src/pages/group-buy/PassHeadCard.tsx',
    find: "{!!discountPct && discountPct > 0 && <span className=\"text-[24px] font-bold\"",
    replace: "<span>1장당 아껴요</span>{!!discountPct && discountPct > 0 && <span className=\"text-[24px] font-bold\"",
    test: 'src/tests/unit/pass-detail-d-2026-10-11.test.ts',
    why: '48% 와 정가 취소선이 이미 같은 말을 한다. 2026-10-12 실측에서 한 화면에 가격이 여섯 번 나왔다.',
  },
]
