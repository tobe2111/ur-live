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
    name: '[cid] 추천 수익 출금 내역을 다시 아무 토큰이나', // 2026-11-17 재조준 — 신청(POST)은 닫힌 안내만 주는 경로가 됐다(신원을 안 읽는다)
    file: 'src/features/referral/api/referral-tree.routes.ts',
    find: "get('/withdrawals', requireUser()",
    replace: "get('/withdrawals', requireAuth()",
    test: TEST,
    why: '셀러 토큰 #N 으로 유저 #N 의 추천 수익 출금 내역을 읽는다.',
  },
  {
    name: '[cid] 견적 요청 목록이 다시 아무 토큰이나 (getCurrentUser(c)?.id 형태)',
    file: 'src/features/home-service/api/home-service.routes.ts',
    find: "homeServiceRoutes.get('/requests/mine', requireUser(), async (c) => {",
    replace: "homeServiceRoutes.get('/requests/mine', requireAuth(), async (c) => {",
    test: TEST,
    why: '2026-11-17 — 첫 스캐너가 `user.id` 글자만 봐서 이 형태 58곳을 놓쳤다.',
  },
  {
    name: '[cid] 선물 보낸 목록이 다시 아무 토큰이나',
    file: 'src/features/gifts/api/gifts.routes.ts',
    find: "giftsRoutes.get('/sent', requireUser(), async (c) => {",
    replace: "giftsRoutes.get('/sent', requireAuth(), async (c) => {",
    test: TEST,
    why: '셀러 #N 이 유저 #N 이 보낸 선물의 받는 사람 이름·전화를 읽는다.',
  },
  {
    name: '[cid] 영수증·쿠폰함이 다시 아무 토큰이나 (router.use 형태)',
    file: 'src/features/district/api/district-coupon.routes.ts',
    find: "userApp.use('*', requireUser())",
    replace: "userApp.use('*', requireAuth())",
    test: TEST,
    why: '`use(\'*\', requireAuth())` 로 건 경로는 첫 스캐너가 아예 안 봤다.',
  },
]
