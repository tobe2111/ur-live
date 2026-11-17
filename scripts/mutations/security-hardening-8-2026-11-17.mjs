/**
 * 🔐 2026-11-17 보안 점검 8차 — 주입 매니페스트.
 * 가드: src/tests/unit/security-hardening-8-2026-11-17.test.ts
 */
const TEST = 'src/tests/unit/security-hardening-8-2026-11-17.test.ts'

export default [
  {
    name: '[sec8] 재설정 토큰을 다시 원문으로 저장한다',
    file: 'src/features/auth/api/seller.routes.ts',
    find: '.bind(seller.id, await hashToken(token), expiresAt)',
    replace: '.bind(seller.id, token, expiresAt)',
    test: TEST,
    why: 'DB 를 읽을 수 있으면 아무 사장님 계정의 비밀번호를 바꾼다.',
  },
  {
    name: '[sec8] 원문 대조가 형식 검사 없이 통과한다',
    file: 'src/features/auth/api/seller.routes.ts',
    find: ".bind(await hashToken(token), /^[0-9a-f]{32}$/.test(token) ? token : '')",
    replace: '.bind(await hashToken(token), token)',
    test: TEST,
    why: '저장된 해시를 토큰인 척 내밀면 통과한다 — 해시 저장이 무의미해진다.',
  },
  {
    name: '[sec8] 주문 라우터가 다시 아무 토큰이나 받는다',
    file: 'src/worker/routes/order.routes.ts',
    find: "ordersRouter.use('*', requireUserType('user', 'admin'));",
    replace: "ordersRouter.use('*', requireUserType('user', 'admin', 'seller', 'agency'));",
    test: TEST,
    why: '셀러 #N 토큰으로 유저 #N 의 주문(수령인 이름·전화·주소)을 읽는다.',
  },
  {
    name: '[sec8] 알림 목록이 종류를 안 보고 user_notifications 를 읽는다',
    file: 'src/features/notifications/api/notifications.routes.ts',
    find: "bind(userType === 'user' ? userId : '', opts.limit)",
    replace: 'bind(userId, opts.limit)',
    test: TEST,
    why: '셀러 #N 이 유저 #N 의 알림을 읽는다.',
  },
  {
    name: '[sec8] 미승인 매장의 사업자 신원을 다시 공개',
    file: 'src/worker/utils/seller-public-payload.ts',
    find: "  return status === 'approved' || status === 'active'\n",
    replace: '  return true\n',
    test: TEST,
    why: '승인 전·반려 신청자의 등록번호·주소·대표자가 로그인 없이 조회된다.',
  },
  {
    name: '[sec8] 공개 셀러 조회가 다시 전화번호를 고른다',
    file: 'src/features/seller/api/seller-management.routes.ts',
    find: "FROM sellers WHERE id = ? AND status IN ('approved', 'active')`",
    replace: ", phone FROM sellers WHERE id = ? AND status IN ('approved', 'active')`",
    test: TEST,
    why: '번호만 바꿔 가며 모든 사장님 전화번호를 긁는다.',
  },
  {
    name: '[sec8] 경매 응답이 낙찰자 실명·id 를 그대로 준다',
    file: 'src/features/auction/api/auction.routes.ts',
    find: 'data: { ...publicAuction(auction), bids: (bids ?? []).map(publicBid) }',
    replace: 'data: { ...auction, bids }',
    test: TEST,
    why: '로그인 없이 낙찰자 실명이 조회된다.',
  },
  {
    name: '[sec8] 찜 조회가 종류를 안 본다',
    file: 'src/features/wishlists/api/wishlists.routes.ts',
    find: "    if ((authUser.type !== 'user' || userId !== String(authUser.id)) && authUser.type !== 'admin') { // 🔐",
    replace: "    if (userId !== String(authUser.id) && authUser.type !== 'admin') { // 🔐",
    test: TEST,
    why: '셀러 #N 이 유저 #N 의 찜 목록을 읽는다.',
  },
]
