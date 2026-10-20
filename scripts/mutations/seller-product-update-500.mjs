/**
 * 🛠️ 셀러 상품 수정 500 (2026-09-21, E5 실사용에서 발견) — 주입 매니페스트.
 * 가드: src/tests/unit/seller-product-update-500-2026-09-21.test.ts
 */
const T = 'src/tests/unit/seller-product-update-500-2026-09-21.test.ts'

export default [
  {
    name: '🛠️ 상품 수정 응답이 라이브에 없는 `image` 컬럼을 다시 읽는다 (매번 500 재발)',
    file: 'src/features/seller/api/seller-product-response.ts',
    find: '              COALESCE(thumbnail_url, image_url) AS image_url,',
    replace: '              COALESCE(thumbnail_url, image_url, image) AS image_url,',
    test: T,
    why: '라이브 products 에 image 컬럼이 없다. UPDATE 는 되고 응답만 500 이라 셀러가 "수정 실패" 를 보고 같은 걸 다시 누른다.',
  },
  {
    name: '🛠️ 스키마 편차 폴백이 모든 에러를 삼킨다',
    file: 'src/features/seller/api/seller-product-response.ts',
    find: "    if (!/no such column/i.test(String((e as Error)?.message || ''))) throw e",
    replace: '    void e',
    test: T,
    why: '없는 컬럼만 흡수해야 한다. 잠금·타임아웃까지 삼키면 다음 결함이 조용해진다.',
  },
  {
    name: '🛠️ 재고 응답이 legacy stock_quantity(DEFAULT 0) 를 먼저 읽는다 (등록 직후 재고 0)',
    file: 'src/features/seller/api/seller-product-response.ts',
    find: '              COALESCE(stock, stock_quantity, 0) AS stock,',
    replace: '              COALESCE(stock_quantity, stock, 0) AS stock,',
    test: T,
    why: '등록은 stock 에만 쓴다. legacy 컬럼을 먼저 읽으면 방금 넣은 재고가 0 으로 보인다.',
  },
]
