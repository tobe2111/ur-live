/**
 * 🔐 2026-11-09 — 종류를 안 보는 로그인 경로의 user.id 사용 — 주입 매니페스트.
 * 가드: src/tests/unit/consumer-identity-guard-2026-11-09.test.ts
 */
const TEST = 'src/tests/unit/consumer-identity-guard-2026-11-09.test.ts'
export default [
  {
    name: '[cid] 장바구니 담기를 다시 아무 토큰이나 받게',
    file: 'src/features/cart/api/cart.routes.ts',
    find: "cartRoutes.post('/', cartRateLimit, requireUser(),",
    replace: "cartRoutes.post('/', cartRateLimit, requireAuth(),",
    test: TEST,
    why: '셀러 토큰 #N 으로 유저 #N 의 장바구니를 바꾼다.',
  },
  {
    name: '[cid] 추천 수익 출금 신청을 다시 아무 토큰이나',
    file: 'src/features/referral/api/referral-tree.routes.ts',
    find: "post('/withdrawals', requireUser()",
    replace: "post('/withdrawals', requireAuth()",
    test: TEST,
    why: '셀러 토큰 #N 으로 유저 #N 의 추천 수익 출금을 신청한다.',
  },
]
