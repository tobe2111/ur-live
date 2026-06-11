// ── BIZ-4 (2026-06-08) 카탈로그 검색/정렬/필터 컨트롤 정의 ──────────────────────
//   서버 `/catalog` 파라미터(sort/category/in_stock/min_price/max_price)에 1:1 매핑.
//   ⚠️ 기본값('popular'/cat 'all'/재고off/가격 미설정)은 쿼리스트링에서 생략 → 기본 요청 URL 불변.
export type CatalogSort = 'popular' | 'price_low' | 'price_high' | 'discount' | 'newest'
export const CATALOG_SORTS: { id: CatalogSort; label: string; defaultLabel: string }[] = [
  { id: 'popular', label: 'wholesale.sort.popular', defaultLabel: '인기순' },
  { id: 'price_low', label: 'wholesale.sort.priceLow', defaultLabel: '가격 낮은순' },
  { id: 'price_high', label: 'wholesale.sort.priceHigh', defaultLabel: '가격 높은순' },
  { id: 'discount', label: 'wholesale.sort.discount', defaultLabel: '할인율순' },
  { id: 'newest', label: 'wholesale.sort.newest', defaultLabel: '신상품순' },
]
// 가격대 프리셋(원, supply_price proxy 기준 — 서버 주석 참조). null = 상한 없음.
export const PRICE_BANDS: { id: string; label: string; min: number | null; max: number | null }[] = [
  { id: 'p1', label: '~1만원', min: null, max: 10000 },
  { id: 'p2', label: '1~3만원', min: 10000, max: 30000 },
  { id: 'p3', label: '3~5만원', min: 30000, max: 50000 },
  { id: 'p4', label: '5만원~', min: 50000, max: null },
]
