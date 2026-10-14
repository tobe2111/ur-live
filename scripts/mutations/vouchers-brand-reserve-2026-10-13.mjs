// 🧱 교환권 브랜드 줄 예약이 '전체'에서도 깔리던 것(실사용자 CLS p75 0.14) — 2026-10-13
const TEST = 'src/tests/unit/top-chrome-reserve-2026-09-16.test.ts'

export default [
  {
    name: '🧱 교환권 브랜드 줄 예약이 카테고리 없이도 깔린다(전체 → 124px 밀림)',
    file: 'src/pages/VouchersPage.tsx',
    find: 'currentBrands.length === 0 && !sectionsReady && !!category && <BrandStripReserve',
    replace: 'currentBrands.length === 0 && !sectionsReady && <BrandStripReserve',
    test: TEST,
    why: "'전체'에는 브랜드 줄이 없다 — 예약이 깔리면 카테고리 목록이 오는 순간 사라지며 목록이 124px 위로 튄다.",
  },
]
