/** 🧬 주입 — PC 교환권 인기 브랜드 줄 자리 잡기 (2026-10-19 라이브 1440px CLS 0.037) */
const T = 'src/tests/unit/top-chrome-reserve-2026-09-16.test.ts'
export default [
  { name: 'PC브랜드예약 — 예약을 지운다', file: 'src/pages/VouchersPage.tsx', find: '{currentBrands.length === 0 && !sectionsReady && !!category && <PcBrandStripReserve />}', replace: '', test: T, why: '첫 방문 PC 에서 카테고리 응답 순간 상품 그리드가 139px 내려간다.' },
  { name: 'PC브랜드예약 — 예약 바깥 클래스가 진짜와 갈린다', file: 'src/pages/vouchers/TopChromeReserve.tsx', find: '<div className={`${PC_BRAND.wrap} invisible`}', replace: '<div className="mb-3 invisible"', test: T, why: '예약 높이가 진짜 블록과 달라 여전히 밀린다.' },
]
