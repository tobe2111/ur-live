/** 🧬 주입 — 데모 숙소 중복(2026-10-31). 가드: src/tests/unit/demo-stay-merge-2026-10-31.test.ts */
const T = 'src/tests/unit/demo-stay-merge-2026-10-31.test.ts'
const F = 'src/features/admin/api/admin-stays/dedupe-demo-stays.ts'
export default [
  {
    name: 'demo-stay-merge — 시드 검사가 다시 제목만 본다',
    file: F,
    find: 'AND (restaurant_name = ? OR name = ?) LIMIT 1',
    replace: 'AND (name = ? OR name = ?) LIMIT 1',
    test: T,
    why: '같은 숙소가 시드될 때마다 상품이 늘어난다(대표 신고 — 휴가스테이 3개).',
  },
  {
    name: 'demo-stay-merge — 같은 이름 객실까지 옮겨 중복이 생긴다',
    file: F,
    find: "          WHERE product_id = ? AND name NOT IN (SELECT name FROM product_stay_rooms WHERE product_id = ?)`,\n      ).bind(keeper, extra, keeper)",
    replace: "          WHERE product_id = ? AND ? > 0`,\n      ).bind(keeper, extra, keeper)",
    test: T,
    why: '한 상세에 스탠다드 텐트가 두 번 뜬다.',
  },
  {
    name: 'demo-stay-merge — 실숙소까지 합친다',
    file: F,
    find: "      WHERE slug LIKE 'demo-stay-%' AND COALESCE(is_active, 1) = 1 AND restaurant_name IS NOT NULL\n        AND restaurant_name IN (",
    replace: "      WHERE COALESCE(is_active, 1) = 1 AND restaurant_name IS NOT NULL\n        AND restaurant_name IN (",
    test: T,
    why: '이름이 같은 실매장 숙소가 데모에 흡수돼 판매가 내려간다.',
  },
]
