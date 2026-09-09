/**
 * 🧬 매장 소유권 승계(3단계) — 되돌려-검증 주입 (2026-09-09).
 *
 * 지키는 규칙 넷. 넷 다 **에러 없이 조용히 틀리는** 종류라, 통과 여부로만 판정하면 못 본다:
 *   ① 영입 보상은 승계에도 그대로 (설계 §5(c) — 깨지면 중개자가 사장님을 숨긴다)
 *   ② 이전 주인은 회수가 아니라 강등, 그리고 **끝나면 주인은 정확히 하나**
 *   ③ 자물쇠(미정산 잔액) 앞에서는 아무것도 쓰지 않는다
 *   ④ 승인이 막히면 신청서는 pending 그대로 (승인됨으로 찍으면 큐에서 사라진다)
 *
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일해야 한다(`--only` 가 부분일치).
 */
export default [
  {
    name: '🪑승계 영입 스탬프를 승계가 지운다 — 중개자가 사장님을 숨기게 된다',
    file: 'src/worker/utils/store-ownership-transfer.ts',
    find: `  // 두 신호가 다른 사람을 가리키지 않게 — 옛 칸은 정의상 이전 주인이므로 비운다.
  if (linked !== null) {`,
    replace: `  await DB.prepare(\`UPDATE sellers SET introduced_by_influencer_id = NULL WHERE id = ?\`)
    .bind(sellerId).run().catch(() => {})
  if (linked !== null) {`,
    test: 'src/tests/unit/store-ownership-transfer-2026-09-09.test.ts',
    why:
      '설계 §5(c) 가 "이게 설계의 핵심" 이라고 못 박은 조항. 운영권을 잃으면 수입도 끊긴다고 하면 ' +
      '중개자는 사장님이 직접 계정 만드는 걸 막고 자기가 유일한 창구로 남으려 한다 — 그러면 ' +
      '매장이 플랫폼에 영영 안 올라온다. 지워져도 화면엔 아무 표시가 없다.',
  },
  {
    name: '🪑승계 이전 주인을 강등이 아니라 회수한다',
    file: 'src/worker/utils/store-ownership-transfer.ts',
    find: `    \`UPDATE seller_operators SET role = 'operator'
      WHERE seller_id = ? AND user_id != ? AND role = 'owner' AND revoked_at IS NULL\`,`,
    replace: `    \`UPDATE seller_operators SET revoked_at = datetime('now')
      WHERE seller_id = ? AND user_id != ? AND role = 'owner' AND revoked_at IS NULL\`,`,
    test: 'src/tests/unit/store-ownership-transfer-2026-09-09.test.ts',
    why:
      '설계 §5(a): 이전 주인은 operator 로 남아 자기가 올려 둔 것을 계속 운영할 수 있어야 한다. ' +
      '회수해 버리면 중개자가 만든 상품·예약이 관리자를 잃는다.',
  },
  {
    name: '🪑승계 새 주인 외의 owner 행이 남는다 — 새 주인이 주인이 아니게 된다',
    file: 'src/worker/utils/store-ownership-transfer.ts',
    find: `      WHERE seller_id = ? AND user_id != ? AND role = 'owner' AND revoked_at IS NULL\`,
  ).bind(sellerId, nextUserId)`,
    replace: `      WHERE seller_id = ? AND user_id = ? AND role = 'owner' AND revoked_at IS NULL\`,
  ).bind(sellerId, nextUserId)`,
    test: 'src/tests/unit/store-ownership-transfer-2026-09-09.test.ts',
    why:
      '실제로 내가 처음 이렇게 짰고 시험이 잡았다. resolveStoreOwnerUserId 는 owner 행 중 ' +
      'granted_at 이 가장 이른 것을 고르므로, 옛 owner 행이 남으면 이전이 끝난 뒤에도 ' +
      '새 주인이 주인이 아니다 — 에러 없이.',
  },
  {
    name: '🪑승계 미정산 잔액이 남았는데 주인을 바꾼다',
    file: 'src/worker/utils/store-ownership-transfer.ts',
    find: `  const gate = await checkStoreHandover(DB, sellerId, nextUserId)
  if (gate.blocked) {`,
    replace: `  const gate = await checkStoreHandover(DB, sellerId, nextUserId)
  if (false && gate.blocked) {`,
    test: 'src/tests/unit/store-ownership-transfer-2026-09-09.test.ts',
    why:
      '대표 확정 2026-09-08: "중개사가 한 매장으로 번 돈이 있으면 그 돈은 승계가 되더라도 일단 ' +
      '중개사에게 정산되어야지." 자물쇠가 없으면 그 돈이 새 주인 계좌로 간다 — 되돌릴 방법이 없다.',
  },
  {
    name: '🪑신청 이전이 막혔는데 신청서를 승인됨으로 찍는다',
    file: 'src/worker/utils/store-ownership-claims.ts',
    find: `  if (!transfer.ok) {
    // 신청서는 pending 그대로`,
    replace: `  if (false && !transfer.ok) {
    // 신청서는 pending 그대로`,
    test: 'src/tests/unit/store-ownership-transfer-2026-09-09.test.ts',
    why:
      '자물쇠에 막혔는데 신청서만 approved 가 되면 아무도 주인이 안 된 채 심사 큐에서 사라진다. ' +
      '사장님은 "승인됐다" 는 화면을 보고 기다리고, 어드민에겐 할 일이 안 보인다.',
  },
  {
    name: '🪑신청 같은 사람이 같은 매장에 신청서를 여러 장 만든다',
    file: 'src/worker/utils/store-ownership-claims.ts',
    find: `         ON store_ownership_claims(seller_id, user_id) WHERE status = 'pending'\`,`,
    replace: `         ON store_ownership_claims(seller_id, user_id, id) WHERE status = 'pending'\`,`,
    test: 'src/tests/unit/store-ownership-transfer-2026-09-09.test.ts',
    why:
      '머니 룰 #3(멱등은 UNIQUE + INSERT OR IGNORE). id 를 키에 넣으면 UNIQUE 가 항상 통과해 ' +
      '한 사람이 같은 매장에 신청서를 무한히 쌓는다 — 심사 큐가 쓸모없어진다.',
  },
  {
    name: '🪑신청 사업자번호를 안 냈는데 불일치로 단정한다',
    file: 'src/worker/utils/store-ownership-claims.ts',
    find: `  const bnoMatch: boolean | null = bno && storeBno ? bno === storeBno : null`,
    replace: `  const bnoMatch: boolean | null = bno === storeBno`,
    test: 'src/tests/unit/store-ownership-transfer-2026-09-09.test.ts',
    why:
      '모름(null)과 불일치(false)는 다르다. 번호를 안 낸 신청이 "매장과 불일치" 로 뜨면 ' +
      '어드민이 진짜 사장님을 거절한다 — 이 세션이 반복해 만난 "모름을 통과/실패로 뭉개기" 클래스.',
  },
  {
    name: '🪑배선 어드민 소유자 이전 라우터가 마운트에서 빠진다',
    file: 'src/worker/index.ts',
    find: `adminApp.route('/', adminStoreOwnerRoutes);`,
    replace: `// adminApp.route('/', adminStoreOwnerRoutes);`,
    test: 'src/tests/unit/store-ownership-transfer-2026-09-09.test.ts',
    why:
      '마운트가 빠지면 404 다. 빌드도 타입체크도 초록이고, 어드민 화면에서만 "실패" 토스트가 뜬다 — ' +
      '이 레포가 반복해 당한 "조용한 부재".',
  },
  {
    name: '🪑배선 어드민 id 를 소비자 user id 칸에 적는다',
    file: 'src/features/admin/api/admin-store-owner.routes.ts',
    find: `nextUserId: target.id, actorUserId: null })`,
    replace: `nextUserId: target.id, actorUserId: adminId })`,
    test: 'src/tests/unit/store-ownership-transfer-2026-09-09.test.ts',
    why:
      'admins.id 와 users.id 는 다른 공간이다. 섞이면 granted_by_user_id 를 읽는 코드가 ' +
      '엉뚱한 사용자를 가리키고 아무 에러도 안 난다(오늘 하루에 그 병을 여섯 곳에서 봤다).',
  },
  {
    name: '🪑마감 수취인이 옛 신호(linked_user_id)로 되돌아간다',
    file: 'src/features/admin/api/admin-payouts/handover-closeout.ts',
    find: `      const ownerUserId = await resolveStoreOwnerUserId(DB, sellerId)`,
    replace: `      const ownerUserId = seller.linked_user_id`,
    test: 'src/tests/unit/store-handover-money-2026-09-07.test.ts',
    why:
      '그 칸은 /store/new 매장에서 항상 비어 있다 — 즉 이 창구가 **가장 필요한 중개 매장에서** ' +
      'payee_user_id 가 NULL 이 된다. 그러면 취소 게이트가 "주인이 바뀌었나" 를 판정할 근거를 잃는다.',
  },
  {
    name: '🪑취소게이트가 옛 신호로 지금 주인을 묻는다',
    file: 'src/features/admin/api/admin-payouts.routes.ts',
    find: `    const nowOwner = await resolveStoreOwnerUserId(DB, Number(row.payee_id))
    if (nowOwner === undefined || Number(nowOwner) !== Number(row.payee_user_id)) {`,
    replace: `    const nowOwner = (await DB.prepare('SELECT linked_user_id FROM sellers WHERE id = ? LIMIT 1')
      .bind(row.payee_id).first().catch(() => null))?.linked_user_id
    if (Number(nowOwner) !== Number(row.payee_user_id)) {`,
    test: 'src/tests/unit/store-handover-money-2026-09-07.test.ts',
    why:
      '중개 매장에서 linked_user_id 는 NULL 이라 비교가 늘 `NaN !== N` → 참이 된다. ' +
      '주인이 그대로인데도 확인을 요구하고, 운영자는 그 경고를 습관적으로 넘기게 된다(경고의 마모).',
  },
]
