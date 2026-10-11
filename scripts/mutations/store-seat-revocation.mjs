/**
 * 🪑 매장 좌석 토큰 회수·이전 — 되돌려-검증 주입 (2026-10-10).
 *
 * 지키는 규칙: 좌석 토큰(30일)은 **발급 순간이 아니라 매 요청** (매장, 사람)의 지금 권한으로 판정된다.
 * 전부 "에러 없이 조용히 열려 있는" 종류다 — 회수돼도 화면은 멀쩡히 돌고, 강등돼도 계좌 변경이 된다.
 *
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일해야 한다(`--only` 가 부분일치).
 */
export default [
  {
    name: '🪑좌석 가드가 회수된 좌석을 통과시킨다 (회수된 중개자가 30일 동안 매장을 연다)',
    file: 'src/worker/utils/store-seat-guard.ts',
    find: "    if (v.kind === 'revoked') return c.json(storeSeatRevokedResponse(), 401)",
    replace: '',
    test: 'src/tests/unit/store-seat-revocation-2026-10-10.test.ts',
    why:
      '셀러 라우트 26곳은 getSellerIdFromToken(서명만 본다)으로 스코프를 잡는다. 입구에서 끊지 않으면 ' +
      '사장님의 회수 버튼은 화면에서만 동작하고 그 사람 손의 토큰은 주문·정산을 계속 연다.',
  },
  {
    name: '🪑좌석 판정이 revoked_at 을 안 본다 (회수가 회수가 아니다)',
    file: 'src/worker/utils/store-seat-guard.ts',
    find: '           WHERE seller_id = ? AND user_id = ? AND revoked_at IS NULL LIMIT 1) AS grant_role`,',
    replace: '           WHERE seller_id = ? AND user_id = ? LIMIT 1) AS grant_role`,',
    test: 'src/tests/unit/store-seat-revocation-2026-10-10.test.ts',
    why: 'revoked_at 은 행 삭제 대신이다(분쟁 근거). 그걸 안 보면 회수된 행이 살아 있는 권한으로 읽힌다.',
  },
  {
    name: '🪑소유자 게이트가 토큰 claim 만 믿는다 (강등된 옛 주인이 정산 계좌를 바꾼다)',
    file: 'src/worker/utils/store-actor.ts',
    find: "  if (seat.kind !== 'live') return { sellerId, operatorUserId, isOwner: false }\n  if (seat.role) return { sellerId, operatorUserId, isOwner: seat.role === 'owner' }",
    replace: '',
    test: 'src/tests/unit/store-seat-revocation-2026-10-10.test.ts',
    why:
      '소유권 이전이 옛 주인을 operator 로 강등해도 그 토큰엔 store_role:owner 가 30일 남는다. ' +
      'PIN 은 그 사람 자신의 것이라 막지 못한다 — 돈의 목적지가 남에게 넘어간다.',
  },
  {
    name: '🪑소유권 이전이 매장 좌석 에포크를 안 올린다 (매장 계정 토큰이 이전 뒤에도 주인)',
    file: 'src/worker/utils/store-ownership-transfer.ts',
    find: "  await bumpStoreSeatEpoch(DB, sellerId, 'ownership_transfer')",
    replace: '',
    test: 'src/tests/unit/store-seat-revocation-2026-10-10.test.ts',
    why:
      '정체성 없는 토큰(매장 계정 카카오·비번 로그인, 이 수리 전 link 좌석)은 누구 것인지 모른다. ' +
      '에포크가 안 오르면 옛 주인이 그 토큰으로 계속 주인 판정을 받는다.',
  },
  {
    name: '🪑refresh 가 좌석 토큰을 받는다 (운영자 좌석 → claim 빠진 주인 토큰)',
    file: 'src/features/auth/api/seller.routes.ts',
    find: '    if (isSeatShapedToken(payload)) return c.json<AuthResponse>(',
    replace: '    if (false) return c.json<AuthResponse>(',
    test: 'src/tests/unit/store-seat-revocation-2026-10-10.test.ts',
    why:
      'refresh 행이 없는 매장은 해시 대조를 건너뛴다. 좌석 토큰을 넣으면 operator_user_id 가 빠진 ' +
      '매장 계정 토큰이 나오고, 그건 옛 규칙상 주인이다 — 회수된 운영자가 주인으로 갈아타는 문.',
  },
  {
    name: '🪑resolveActorUserId 가 좌석 토큰을 매장 주인 id 로 되짚는다 (쿠키 없는 운영자 = 주인)',
    file: 'src/features/seller/api/seller-operators.routes.ts',
    find: "  return resolveTokenActorUserId(c.env.DB, c.req.header('Authorization'), c.env.JWT_SECRET)",
    replace: "  const sid = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)\n  const row = sid ? await c.env.DB.prepare('SELECT linked_user_id FROM sellers WHERE id = ? LIMIT 1').bind(sid).first<{ linked_user_id: number | null }>().catch(() => null) : null\n  return Number(row?.linked_user_id) || null",
    test: 'src/tests/unit/store-seat-revocation-2026-10-10.test.ts',
    why:
      '운영자 좌석 토큰만 보내고 쿠키를 빼면 주인 id 로 둔갑해 운영자를 추가·회수하고 주인의 다른 ' +
      '매장 좌석까지 받는다. 이 레포가 반복해 만난 "id 공간이 섞이면 조용히 오판" 클래스.',
  },
]
