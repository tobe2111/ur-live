/**
 * 🧬 주입 — 생활(이사·청소) 카테고리 (2026-10-20 대표 확정)
 */
const T = 'src/tests/unit/home-service-category-2026-10-20.test.ts'
export default [
  {
    name: '생활 — 구매 경로가 손으로 적은 옛 목록으로 돌아간다(생활 이용권 구매가 404)',
    file: 'src/features/group-buy/api/group-buy.routes.ts',
    find: "seller_id, group_buy_tiers FROM products WHERE id = ? AND is_active = 1 AND (category IN (${VOUCHER_CATEGORY_SQL_IN}) OR deal_only = 1)",
    replace: "seller_id, group_buy_tiers FROM products WHERE id = ? AND is_active = 1 AND (category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher') OR deal_only = 1)",
    test: T,
    why: '화면엔 생활 이용권이 뜨는데 구매를 누르면 "상품을 찾을 수 없습니다" — 에러 로그 0.',
  },
  {
    name: '생활 — SSOT 에서 home_voucher 가 빠진다',
    file: 'src/shared/constants/voucher-categories.ts',
    find: "  'home_voucher',\n  'etc_voucher',\n] as const",
    replace: "  'etc_voucher',\n] as const",
    test: T,
    why: '피드·구매·정산 전부에서 생활 이용권이 조용히 사라진다.',
  },
  {
    name: '생활 — 정산 통계(어드민 공구 현황)가 손 목록으로 돌아간다',
    file: 'src/features/group-buy/api/seller-commission-rate.ts',
    find: 'AND p.category IN (${VOUCHER_CATEGORY_SQL_IN})',
    replace: "AND p.category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')",
    test: T,
    why: '셀러 GMV 계산에서 생활 매출이 빠져 등급 수수료가 틀린다.',
  },
  {
    name: '생활 — 이사 할인권이 할인율을 지어낸다',
    file: 'src/features/admin/api/admin-products.routes.ts',
    find: '  const [dMin, dMax] = p.fixed ? [0, 0] : demoDiscountRange(t.cat);',
    replace: '  const [dMin, dMax] = demoDiscountRange(t.cat);',
    test: T,
    why: '견적에서 깎아 주는 권을 1,000원에 팔며 "정가 1,000원 → 할인 20%" 같은 없는 정가를 만든다.',
  },
  {
    name: '생활 — 홈 칩에서 생활이 빠진다',
    file: 'src/shared/deal-cats.ts',
    find: "  { key: 'home_voucher',   label: '생활' },\n",
    replace: '',
    test: T,
    why: '상품은 있는데 홈에서 그 카테고리로 찾아갈 길이 없다.',
  },
]
