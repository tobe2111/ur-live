/**
 * 🔎 검색·자동완성의 정지 매장 누수 (2026-10-01) — 주입 매니페스트.
 * 가드: src/tests/unit/search-suspended-seller-2026-10-01.test.ts
 */
const TEST = 'src/tests/unit/search-suspended-seller-2026-10-01.test.ts'

export default [
  {
    name: '🔎 FTS 검색이 다시 정지 매장 상품을 보여 준다',
    file: 'src/features/products/repositories/ProductRepository.ts',
    find: "      AND ${activeSellerProductSql('p')}\n",
    replace: '',
    test: TEST,
    why: '2026-09-03 FTS 재작성이 정확히 이렇게 술어를 빠뜨렸고, is_active=1 이 남아 있어 몇 달간 증상이 안 보였다.',
  },
  {
    name: '🔎 자동완성이 교환권 분기에서만 정지 매장을 다시 노출한다',
    file: 'src/features/products/api/search-suggestions.ts',
    find: "    ? `is_active = 1\n         AND ${sellerLive}\n",
    replace: '    ? `is_active = 1\n',
    test: TEST,
    why: '세 쿼리가 같은 조건을 써야 한다 — 한 분기만 빠지면 그쪽 스코프로 조용히 샌다.',
  },
  {
    name: '🔎 셀러 술어가 뒤집혀 살아 있는 매장이 가려진다',
    file: 'src/shared/db/consumer-visible-product.ts',
    find: '       AND s_act.is_active = 0\n  )`\n}',
    replace: '       AND s_act.is_active = 1\n  )`\n}',
    test: TEST,
    why: '방향이 뒤집히면 라이브 카탈로그가 통째로 비는데 SQL 은 멀쩡히 돈다 — 에러가 안 난다.',
  },
  {
    name: '🔎 셀러 술어가 플랫폼 상품(seller_id NULL)까지 가린다',
    file: 'src/shared/db/consumer-visible-product.ts',
    find: '  return `NOT EXISTS (\n    SELECT 1 FROM sellers s_act\n     WHERE s_act.id = ${alias}.seller_id\n       AND s_act.is_active = 0\n  )`',
    replace: '  return `EXISTS (\n    SELECT 1 FROM sellers s_act\n     WHERE s_act.id = ${alias}.seller_id\n       AND s_act.is_active = 1\n  )`',
    test: TEST,
    why: '조이는 쪽으로 쓰면 교환권·KT·데모(seller_id NULL)가 전멸한다 — 이 파일의 다른 술어가 관대한 쪽으로 기운 바로 그 이유다.',
  },
  {
    name: '🔎 findAll 의 인라인 쌍둥이가 사라져 쇼핑 카탈로그만 다시 샌다',
    file: 'src/features/products/repositories/ProductRepository.ts',
    find: "    let query = `SELECT ${LIST_COLUMNS} FROM products WHERE is_active = 1\n      AND NOT EXISTS (SELECT 1 FROM sellers s WHERE s.id = products.seller_id AND s.is_active = 0)",
    replace: '    let query = `SELECT ${LIST_COLUMNS} FROM products WHERE is_active = 1',
    test: TEST,
    why: '네 자리(findAll·count·검색·자동완성)가 갈리면 같은 상품이 화면마다 보였다 안 보였다 한다.',
  },
  {
    name: '🔎 자동완성 인라인 복제본에서 셀러 술어가 사라진다 (라이브 누수 원상복구)',
    file: 'src/features/products/api/products.routes.ts',
    find: "         AND ${activeSellerProductSql('products')}\n",
    replace: '',
    test: TEST,
    why: '2026-10-01 라이브 실측: /api/products/search/suggestions 는 소스 주석이 "안 닿는다" 고 적어 둔 자리인데 200 이 나오고, 이 인라인 SQL 이 정지 매장 상품명을 그대로 뱉고 있었다.',
  },
  {
    name: '🔎 자동완성 쿼리에 별칭이 붙어 술어의 products.seller_id 가 깨진다 (조용히 빈 제안)',
    file: 'src/features/products/api/products.routes.ts',
    find: '`SELECT DISTINCT name FROM products WHERE name LIKE ? AND is_active = 1',
    replace: '`SELECT DISTINCT p.name FROM products p WHERE p.name LIKE ? AND p.is_active = 1',
    test: TEST,
    why: 'SQLite 가 던지지만 호출부 .catch 가 삼켜 자동완성이 조용히 비어 버린다 — 빨간불도 로그도 없다.',
  },
]
