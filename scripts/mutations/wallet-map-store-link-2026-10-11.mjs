/**
 * 🧬 주입 — 지갑 '지도로 보기' 화면 · 상세 '가게 보기' 눌림 영역 (2026-10-11 대표 신고)
 */
const T = 'src/tests/unit/wallet-map-and-store-link-2026-10-11.test.ts'
export default [
  {
    name: '지갑지도 — 지도 상자를 400 고정으로 되돌린다',
    file: 'src/pages/my-vouchers/VoucherMap.tsx',
    find: "style={{ height: '100%', minHeight: 400, isolation: 'isolate' }}",
    replace: 'style={{ height: 400 }}',
    test: T,
    why: '이용권 카드가 지도 밑으로 들어가 반쯤 가려진다(대표 신고 화면).',
  },
  {
    name: '지갑지도 — 머리줄을 지갑 흰 토큰으로 되돌린다',
    file: 'src/pages/MyVouchersPage.tsx',
    find: 'sticky top-0 md:top-14 z-30 flex items-center gap-2 px-3 pt-3 pb-2 bg-surface border-b border-rule',
    replace: 'sticky top-0 md:top-14 z-30 flex items-center gap-2 px-3 pt-3 pb-2',
    test: T,
    why: '다크 모드에서 제목이 흰 바탕 흰 글자로 사라진다.',
  },
  {
    name: '가게보기 — 눌림 영역을 글자 크기로',
    file: 'src/pages/group-buy/StoreLocation.tsx',
    find: 'min-h-[44px] -my-3 -mr-2 pl-3 pr-2',
    replace: 'p-0',
    test: T,
    why: '폰에서 19px 짜리 글자를 정확히 눌러야 해 "눌러지지도 않는" 버튼이 된다.',
  },
]
