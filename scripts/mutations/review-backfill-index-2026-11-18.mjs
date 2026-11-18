/** 🧬 주입 — 리뷰 이름 백필 부분 색인 (2026-11-18) · 가드: src/tests/unit/review-backfill-index-2026-11-18.test.ts */
export default [
  { name: 'reviewidx: 색인 조건이 UPDATE 와 어긋난다', file: 'src/worker/routes/repair-schema/index-repairs.ts',
    find: "ON product_reviews(user_id) WHERE user_name IS NULL OR user_name = ''`", replace: "ON product_reviews(user_id) WHERE user_name IS NULL`",
    test: 'src/tests/unit/review-backfill-index-2026-11-18.test.ts',
    why: '플래너가 함의를 인정하지 않아 매일 11.8만 행 전체를 다시 읽는다.' },
]
