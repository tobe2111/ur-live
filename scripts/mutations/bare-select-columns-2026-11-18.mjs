/** 🧬 주입 — alias 없는 SELECT 의 없는 칸 (2026-11-18) · 가드: src/tests/unit/bare-select-columns-2026-11-18.test.ts */
const T = 'src/tests/unit/bare-select-columns-2026-11-18.test.ts'
export default [
  { name: 'bareselect: 환불이 없는 칸을 다시 읽는다', file: 'src/worker/utils/order-refund.ts',
    find: '            total_amount, toss_payment_key,', replace: '            total_amount, amount, toss_payment_key,', test: T,
    why: '전액 환불이 매번 no such column 으로 실패한다(손님·어드민·셀러 전부).' },
  { name: 'bareselect: 셀러 공개 페이지가 없는 칸을 읽는다', file: 'src/features/seller/api/seller-management.routes.ts',
    find: 'website_url, kakao_chat_url AS kakao_chat_link, status, created_at\n           FROM sellers WHERE id = ?', replace: 'website_url, kakao_chat_link, status, created_at\n           FROM sellers WHERE id = ?', test: T,
    why: 'GET /api/seller/public/:id 가 다시 언제나 500 이다.' },
]
