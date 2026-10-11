/** 🧬 주입 — 이용권 공유 미리보기가 옛 카테고리 목록으로 되돌아간다 (2026-10-11) */
export default [
  {
    name: '공유카드 — 상품 조회를 옛 카테고리 7종으로 다시 거른다',
    file: 'src/worker/routes/og-image.routes.ts',
    find: "      FROM products\n      WHERE id = ?\n    `).bind(id).first<ProductForOG>()",
    replace: "      FROM products\n      WHERE id = ? AND category IN ('meal_voucher','beauty_voucher')\n    `).bind(id).first<ProductForOG>()",
    test: 'src/tests/unit/og-pass-card-category-2026-10-11.test.ts',
    why: "그 밖의 이용권(2917 'lifestyle')은 카톡 미리보기 사진이 404 로 빈다 — 에러 없이.",
  },
]
