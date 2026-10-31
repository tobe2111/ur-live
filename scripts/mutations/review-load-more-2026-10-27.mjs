/** 🧬 주입 — 리뷰 더 보기(2026-10-27). 가드: src/tests/unit/review-load-more-2026-10-27.test.tsx */
const T = 'src/tests/unit/review-load-more-2026-10-27.test.tsx'
export default [
  {
    name: 'review-load-more — 다음 페이지가 기존 목록을 덮어쓴다',
    file: 'src/pages/product-detail/ProductReviews.tsx',
    find: 'return [...prev, ...more.filter(x => !seen.has(x.id))]',
    replace: 'return more.filter(x => !seen.has(x.id))',
    test: T,
    why: '더 보기를 누르면 앞의 리뷰가 사라진다.',
  },
  {
    name: 'review-load-more — 버튼이 안 뜬다',
    file: 'src/pages/product-detail/ProductReviews.tsx',
    find: '{reviews.length > 0 && remaining > 0 && (',
    replace: '{false && (',
    test: T,
    why: '첫 5개 뒤의 리뷰를 볼 길이 없다.',
  },
]
