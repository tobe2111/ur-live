/**
 * 🪑 옛 단일 좌석 경로가 /store/new 사장님을 찾는다 (2026-10-10 조회 통일 ④) 되돌려-검증 주입.
 * 가드: src/tests/unit/legacy-seller-lookup-owner-seat-2026-10-10.test.ts
 */
const TEST = 'src/tests/unit/legacy-seller-lookup-owner-seat-2026-10-10.test.ts'
const OPS = 'src/worker/utils/seller-operators.ts'
const KAKAO = 'src/features/auth/api/kakao.routes.ts'
const SESS = 'src/features/seller/api/seller-registration/session-routes.ts'

export default [
  {
    name: '🪑옛경로 중개자도 주인 좌석으로 잡힌다',
    file: OPS,
    find: "      WHERE o.user_id = ? AND o.role = 'owner' AND o.revoked_at IS NULL\n      ORDER BY o.granted_at, o.seller_id LIMIT 1`,",
    replace: "      WHERE o.user_id = ? AND o.revoked_at IS NULL\n      ORDER BY o.granted_at, o.seller_id LIMIT 1`,",
    test: TEST,
    why: '옛 "내 셀러" 경로가 중개자에게 남의 가게 토큰을 내준다 — 그 매장 주문·정산이 통째로 열린다.',
  },
  {
    name: '🪑옛경로 회수된 주인 좌석이 되살아난다',
    file: OPS,
    find: "      WHERE o.user_id = ? AND o.role = 'owner' AND o.revoked_at IS NULL\n      ORDER BY o.granted_at, o.seller_id LIMIT 1`,",
    replace: "      WHERE o.user_id = ? AND o.role = 'owner'\n      ORDER BY o.granted_at, o.seller_id LIMIT 1`,",
    test: TEST,
    why: '넘긴 가게에 옛 주인이 카카오 로그인만으로 다시 들어간다.',
  },
  {
    name: '🪑옛경로 주인 좌석 시트가 매장 전환과 갈린다',
    file: OPS,
    find: "  return { claims: { operator_user_id: userId, store_role: 'owner' }, seat: { role: 'seller_operator', id: userId } }",
    replace: "  return { claims: { operator_user_id: userId, store_role: 'owner' }, seat: { role: 'seller', id: userId } }",
    test: TEST,
    why: '같은 사장님이 로그인 경로에 따라 다른 시트를 받아, 한쪽으로 들어가면 다른 쪽이 튕긴다.',
  },
  {
    name: '🪑옛경로 카카오 로그인이 주인 좌석을 안 본다',
    file: KAKAO,
    find: '    const ownerGrant = !seller && !!(seller = await findOwnerSeatSellerRow<Row>(DB, userId, SELLER_COLS))',
    replace: '    const ownerGrant = false as boolean',
    test: TEST,
    why: '직접 등록한 사장님이 카카오로 로그인해도 셀러 토큰이 안 나와 대시보드에서 튕긴다(고치기 전 상태).',
  },
  {
    name: '🪑옛경로 셀러 전환이 주인 좌석에 옛 시트를 준다',
    file: SESS,
    find: "      const seat = ownerGrant ? ownerGrantSeat(Number(sessionUser.userId)).seat : { role: 'seller', id: seller.id as number };",
    replace: "      const seat = { role: 'seller', id: seller.id as number };",
    test: TEST,
    why: '전환한 사장님과 매장 전환 API 로 들어온 같은 사장님이 서로를 튕긴다.',
  },
  {
    name: '🪑옛경로 대기 화면이 주인 좌석을 안 본다',
    file: SESS,
    find: "        const grantId = await findOwnerSeatSellerId(db, Number(sessionUser.userId));\n        if (grantId) {\n          seller = await db.prepare(\n            'SELECT id, status, seller_type",
    replace: "        const grantId = 0 as number;\n        if (grantId) {\n          seller = await db.prepare(\n            'SELECT id, status, seller_type",
    test: TEST,
    why: '이미 등록한 사장님에게 대기 화면이 "새로 등록하세요" 를 띄운다.',
  },
]
