/**
 * 💬 카카오톡 채널 챗봇 매장 관리 (2026-10-10) — 주입 매니페스트.
 * 가드: src/tests/unit/kakao-bot-store-ops-2026-10-10.test.ts
 *
 * 지키는 것: 연결 코드 1회용·만료·무차별 대입 상한 · 매 명령 좌석 재확인 · 쓰기는 "네" 확인 뒤 1회 ·
 * 이 매장 이용권/상품만 · 게이트 OFF fail-closed · 대시보드 코드 발급은 좌석 있는 사람만.
 */
const TEST = 'src/tests/unit/kakao-bot-store-ops-2026-10-10.test.ts'
const STORE = 'src/worker/utils/kakao-bot-store.ts'
const CMDS = 'src/worker/utils/kakao-bot-commands.ts'

export default [
  {
    name: '💬 카카오봇 — 연결 코드가 1회용이 아니게 된다(used_at·만료 조건 제거)',
    file: STORE,
    find: `"UPDATE kakao_bot_link_codes SET used_at = datetime('now') WHERE code = ? AND used_at IS NULL AND expires_at > datetime('now')"`,
    replace: `"UPDATE kakao_bot_link_codes SET used_at = datetime('now') WHERE code = ?"`,
    test: TEST,
    why: '코드가 재사용·만료 후 사용되면 한 번 엿본 코드로 아무나 매장 채팅을 연결해 이용권을 사용 처리할 수 있다.',
  },
  {
    name: '💬 카카오봇 — 봇 키당 실패 상한이 사라진다(6자리 무차별 대입)',
    file: STORE,
    find: `if (Number(mine?.n) >= LINK_FAIL_LIMIT_PER_HOUR) return { ok: false, reason: 'rate_limited' }`,
    replace: `void mine`,
    test: TEST,
    why: '6자리 코드는 상한이 없으면 10분 안에도 두드려 맞힐 수 있다 — 그 순간 남의 매장 채팅이 열린다.',
  },
  {
    name: '💬 카카오봇 — 명령마다 좌석을 다시 보지 않는다(회수된 운영자가 계속 관리)',
    file: STORE,
    find: `  if (!seat.ok) {\n    await unlinkBot(DB, botUserKey)\n    return { kind: 'revoked' }\n  }`,
    replace: ``,
    test: TEST,
    why: '연결은 "그때 좌석에 있었다" 일 뿐이다. 회수·정지 뒤에도 채팅이 살아 있으면 권한 모델이 채팅 한 줄로 우회된다.',
  },
  {
    name: '💬 카카오봇 — "사용 코드" 가 확인 없이 바로 사용 처리된다',
    file: CMDS,
    find: `await setPending(ctx.DB, botUserKey, seat.sellerId, { action: 'redeem', code: cmd.code })`,
    replace: `await redeemVoucherForStore(ctx.DB, { code: cmd.code, actorSellerId: seat.sellerId, path: 'kakao_bot', waitUntil: ctx.defer })`,
    test: TEST,
    why: '오타 한 번이 손님 이용권을 소각한다 — 되돌리려면 환불·원장 역전이 필요한 머니 경로다.',
  },
  {
    name: '💬 카카오봇 — 사용 처리 공유 함수가 매장 소유 검사를 잃는다',
    file: 'src/worker/utils/voucher-seller-redeem.ts',
    find: `if (actorSellerId !== null && Number(voucher.seller_id) !== Number(actorSellerId)) {`,
    replace: `if (false) {`,
    test: TEST,
    why: '이 함수는 계산대 스캔과 챗봇이 함께 쓴다 — 여기가 뚫리면 코드만 알면 남의 매장 이용권을 우리 매장 정산으로 소각한다.',
  },
  {
    name: '💬 카카오봇 — 판매 중지/재개가 매장 범위를 잃는다(WHERE seller_id 제거)',
    file: CMDS,
    find: "      WHERE id = ? AND seller_id = ? AND COALESCE(status, '') != 'DELETED'`\n  ).bind(active ? 1 : 0, productId, sellerId).run()",
    replace: "      WHERE id = ? AND ? > 0 AND COALESCE(status, '') != 'DELETED'`\n  ).bind(active ? 1 : 0, productId, sellerId).run()",
    test: TEST,
    why: '목록 스냅샷·확인 대기는 DB 행이라 오염될 수 있다 — 마지막 방어선은 UPDATE 의 seller_id 다.',
  },
  {
    name: '💬 카카오봇 — 매장 관리 게이트가 fail-open 이 된다',
    file: STORE,
    find: `if (env.KAKAO_BOT_STORE_OPS_ENABLED === 'true') return true`,
    replace: `return true`,
    test: TEST,
    why: '기본 OFF 가 깨지면 staging 검증 전에 머니 경로(사용 처리)가 라이브에 열린다.',
  },
  {
    name: '💬 카카오봇 — 확인 대기를 꺼낼 때 지우지 않는다("네" 두 번 = 두 번 실행)',
    file: STORE,
    find: `"DELETE FROM kakao_bot_pending WHERE bot_user_key = ? RETURNING payload, seller_id, expires_at > datetime('now') AS live"`,
    replace: `"SELECT payload, seller_id, expires_at > datetime('now') AS live FROM kakao_bot_pending WHERE bot_user_key = ?"`,
    test: TEST,
    why: '확인은 한 번만 실행돼야 한다 — 꺼내면서 지우지 않으면 같은 쓰기가 반복된다.',
  },
  {
    name: '💬 카카오봇 — 대시보드 연결 코드 발급이 좌석을 확인하지 않는다',
    file: 'src/features/seller/api/seller-kakao-bot.routes.ts',
    find: `    const ok = await canOperateStore(c.env.DB, userId, actor.sellerId)\n    if (ok.ok) return { sellerId: actor.sellerId, userId }`,
    replace: `    return { sellerId: actor.sellerId, userId }`,
    test: TEST,
    why: '회수된 운영자의 옛 토큰(30일)으로도 코드를 받아 채팅을 연결할 수 있게 된다 — 토큰의 매장 id 는 요청일 뿐 권한이 아니다.',
  },
]
