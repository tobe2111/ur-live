/**
 * 🧬 매장 주인 신호 SSOT — 되돌려-검증 주입 (2026-09-09).
 *
 * 지키는 규칙 하나: **"이 사람이 이 매장의 주인인가"는 두 신호를 함께 본다** —
 * `sellers.linked_user_id`(옛 방식) **와** `seller_operators.role='owner'`(지금 `/store/new` 방식).
 * 한쪽만 보면 직접 등록한 사장님이 남이 되고, 그 순간 돈이 어긋난다(출금 403 · 자가구매 가드 통과).
 *
 * 규칙은 `scripts/mutations/` 규약대로 `export default [ … ]` 하나. 이름은 전체에서 유일해야 한다.
 */
export default [
  {
    name: '🪑 출금 자격이 옛 신호(linked_user_id)로 되돌아간다',
    file: 'src/worker/utils/seller-operators.ts',
    find: `        AND ( s.linked_user_id = ?
           OR EXISTS (SELECT 1 FROM seller_operators o`,
    replace: `        AND ( s.linked_user_id = ?
           OR EXISTS (SELECT 1 FROM seller_operators o WHERE 1 = 0 AND (`,
    test: 'src/tests/unit/store-owner-signal-2026-09-09.test.ts',
    why:
      '이 한 줄이 빠지면 /store/new 로 등록한 사장님이 "사업자 셀러" 판정에서 전부 빠져 ' +
      '자기 매장 매출을 출금하지 못한다(403). 화면엔 "일반 회원은 딜로 적립" 이라고만 떠서 ' +
      '결함이 아니라 정책처럼 보인다 — 그래서 아무도 신고하지 않는다.',
  },
  {
    name: '🪑 중개(operator)까지 주인으로 인정된다 — 남의 가게 돈',
    file: 'src/worker/utils/seller-operators.ts',
    find: `                         AND o.role = 'owner' AND o.revoked_at IS NULL) )`,
    replace: `                         AND o.revoked_at IS NULL) )`,
    test: 'src/tests/unit/store-owner-signal-2026-09-09.test.ts',
    why:
      'operator 는 볼 수 있는 매장을 넓힐 뿐 정산 귀속을 바꾸지 않는다(seller-operators.ts 머리말). ' +
      'role 조건이 사라지면 중개자가 자기가 올린 남의 가게 매출을 출금 대상으로 갖게 된다.',
  },
  {
    name: '🪑 회수된 owner 가 계속 주인으로 남는다',
    file: 'src/worker/utils/seller-operators.ts',
    find: `      WHERE seller_id = ? AND role = 'owner' AND revoked_at IS NULL
      ORDER BY granted_at LIMIT 1`,
    replace: `      WHERE seller_id = ? AND role = 'owner'
      ORDER BY granted_at LIMIT 1`,
    test: 'src/tests/unit/store-owner-signal-2026-09-09.test.ts',
    why:
      'revoked_at 은 행 삭제 대신이다 — 회수 이력이 남아야 분쟁 때 근거가 된다. 그 조건이 빠지면 ' +
      '권한을 뺏긴 사람이 계속 주인으로 조회돼 손바뀜 자물쇠와 출금 판정이 옛 사람을 가리킨다.',
  },
  {
    name: '🪑 자가구매 가드가 다시 조용히 통과한다',
    file: 'src/worker/utils/affiliate-credit.ts',
    find: `      const ownerUserId = ownerRow?.seller_id
        ? await resolveStoreOwnerUserId(DB, Number(ownerRow.seller_id))
        : null`,
    replace: `      const ownerUserId: number | null = null`,
    test: 'src/tests/unit/store-owner-signal-2026-09-09.test.ts',
    why:
      '주인을 못 찾으면 자가구매(①)와 주인=추천인 이중지급(②) 가드가 **에러 없이** 통과한다. ' +
      '②는 2026-07-07 대표 결정으로 넣은 가드다 — 판매수익과 추천수수료를 동시에 가져가는 것을 막는다.',
  },
  {
    name: '🪑 손바뀜 자물쇠가 출금 판정과 다른 규칙을 쓴다',
    file: 'src/worker/utils/store-handover-guard.ts',
    find: `  return await resolveStoreOwnerUserId(DB, sellerId)`,
    replace: `  const r = await DB.prepare('SELECT linked_user_id FROM sellers WHERE id = ? LIMIT 1')
    .bind(sellerId).first<{ linked_user_id: number | null }>().catch(() => undefined)
  return r === undefined ? undefined : r?.linked_user_id ? Number(r.linked_user_id) : null`,
    test: 'src/tests/unit/store-owner-signal-2026-09-09.test.ts',
    why:
      '두 판정이 갈리면 "손바뀜은 막는데 출금은 다른 사람이 한다" 같은 상태가 된다. ' +
      '2026-09-08 에 자물쇠가 정확히 이 옛 규칙이라 **모든 매장에서 무력**이었다.',
  },
]
