/**
 * 📩 사장님 통보 (2026-09-21) 되돌려-검증 주입.
 * 가드: src/tests/unit/store-owner-notice-2026-09-21.test.ts
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일.
 */
const TEST = 'src/tests/unit/store-owner-notice-2026-09-21.test.ts'
const UTIL = 'src/worker/utils/store-owner-notice.ts'
const ROUTE = 'src/features/admin/api/admin-store-owner.routes.ts'

export default [
  {
    name: '📩사장님통보 유선번호에도 줄을 세운다',
    file: UTIL,
    find: "  if (!isMobileKr(phone)) return 'skip_not_mobile'",
    replace: '  void phone',
    test: TEST,
    why: '알림톡이 안 가는 번호가 큐를 채우고, 사람이 걸어야 할 매장을 두 레일이 겹쳐 붙든다.',
  },
  {
    name: '📩사장님통보 한 매장에 두 번 보낸다',
    file: UTIL,
    find: "      'CREATE UNIQUE INDEX IF NOT EXISTS idx_store_owner_notices_once ON store_owner_notices(seller_id, kind)',",
    replace: "      'SELECT 1',",
    test: TEST,
    why: '같은 사장님에게 같은 안내가 두 번 간다 — 그건 스팸이고 신고당하면 채널이 막힌다.',
  },
  {
    name: '📩사장님통보 게이트가 템플릿 없이도 열린다',
    file: UTIL,
    find: "  if (!templateCode || templateCode === 'TBD') return false",
    replace: '  void templateCode',
    test: TEST,
    why: '검수도 안 끝난 템플릿 코드로 알리고를 때려 전부 실패하고, 실패가 행에 굳는다.',
  },
  {
    name: '📩사장님통보 설정이 아무 값이어도 켜진다',
    file: UTIL,
    find: "  return String(row?.value || '') === 'true'",
    replace: '  return true',
    test: TEST,
    why: '대표가 켜지도 않은 발송이 돈다 — 발송은 등급 C 다.',
  },
  {
    name: '📩사장님통보 선점 없이 발송한다 (동시에 두 번 간다)',
    file: UTIL,
    find: '    if (!claim.meta.changes) continue',
    replace: '    void claim',
    test: TEST,
    why: '어드민 둘이 동시에 누르면 같은 사장님이 문자를 두 통 받는다.',
  },
  {
    name: '📩사장님통보 실패해도 큐에 남아 계속 재시도된다',
    file: UTIL,
    find: "    ).bind(ok ? 'sent' : 'failed', ok ? null : err, ok ? 'sent' : 'failed', row.id).run().catch(() => null)",
    replace: "    ).bind(ok ? 'sent' : 'queued', ok ? null : err, ok ? 'sent' : 'failed', row.id).run().catch(() => null)",
    test: TEST,
    why: '수신거부한 번호에 누를 때마다 다시 보낸다 — 문자 폭탄이 된다.',
  },
  {
    name: '📩사장님통보 문구에서 신고 링크가 빠진다',
    file: UTIL,
    find: "    'https://urdeal.kr/store/find',",
    replace: "    '',",
    test: TEST,
    why: '"등록됐습니다" 만 알리고 **어떻게 신고하는지는 안 알려 준다** — 통보의 목적이 사라진다.',
  },
  {
    name: '📩사장님통보 한 번에 전부 긁어 간다',
    file: UTIL,
    find: '  const rows = await listOwnerNotices(DB, { status: \'queued\', limit: Math.min(50, Math.max(1, Number(opts.limit) || 20)) })',
    replace: "  const rows = await listOwnerNotices(DB, { status: 'queued', limit: 200 })",
    test: TEST,
    why: '한 번의 클릭이 수백 통을 쏜다 — 실수의 크기에 상한이 없어진다.',
  },
  {
    name: '📩사장님통보 셀러 크레딧을 깎는다',
    file: UTIL,
    find: '    let ok = false',
    replace: "    await DB.prepare('UPDATE seller_credits SET balance = balance - 1 WHERE seller_id = ?').bind(row.seller_id).run().catch(() => null)\n    let ok = false",
    test: TEST,
    why: '아직 유어딜을 알지도 못하는 사장님의 잔액으로 그 사람에게 통보를 보낸다.',
  },
  {
    name: '📩사장님통보 게이트를 안 보고 발송한다',
    file: ROUTE,
    find: "      if (!(await m.ownerNoticeSendEnabled(env.DB, tpl))) {",
    replace: '      if (false) {',
    test: TEST,
    why: '검수 전 템플릿·꺼진 설정에서도 버튼이 실제로 나간다 — 등급 C 를 우회한다.',
  },
  {
    name: '📩사장님통보 2FA 없이 보낸다',
    file: ROUTE,
    find: "  cors(), requireAdminRole('finance'), require2FA(), auditLog('stores.send_owner_notice'),",
    replace: "  cors(), requireAdminRole('finance'), auditLog('stores.send_owner_notice'),",
    test: TEST,
    why: '세션 하나만 탈취하면 실제 사람들에게 문자를 쏠 수 있다.',
  },
  {
    name: '📩사장님통보 승인 한쪽만 훅을 부른다',
    file: 'src/features/admin/api/admin-tools.routes.ts',
    find: "  await (await import('../../../worker/utils/seller-approved-hooks')).runSellerApprovedHooks(c.env.DB, Number(id), prev?.status).catch(() => null)",
    replace: '  void prev',
    test: TEST,
    why: '그 문으로 승인된 매장의 사장님은 영영 통보를 못 받는다 — 에러는 안 난다.',
  },
  {
    name: '📩사장님통보 훅이 줄을 안 세운다',
    file: 'src/worker/utils/seller-approved-hooks.ts',
    find: "  const notice = await queueOwnerNotice(DB, sellerId, phone?.phone).catch(() => 'skip_error')",
    replace: "  const notice = 'skip_error'; void phone",
    test: TEST,
    why: '훅은 불리는데 줄이 안 선다 — 배선은 멀쩡해 보이고 통보만 영영 안 간다.',
  },
  {
    name: '📩사장님통보 어드민 화면이 떨어진다',
    file: 'src/pages/AdminStoreOwnerPage.tsx',
    find: '        <StoreOwnerNoticeQueue onPickStore={(id) => { setSellerId(String(id)); void lookup(id) }} />',
    replace: '        {null}',
    test: TEST,
    why: '줄은 쌓이는데 볼 화면이 없다 — 있는 줄도 모른다.',
  },
  {
    name: '📩사장님통보 게이트가 꺼져도 버튼이 살아 있다',
    file: 'src/pages/admin-store-owner/StoreOwnerNoticeQueue.tsx',
    find: '            type="button" disabled={!sendEnabled || busy} onClick={send}',
    replace: '            type="button" disabled={busy} onClick={send}',
    test: TEST,
    why: '눌러도 409 만 받는 버튼이 활성으로 보인다 — 어드민이 뭔가 고장 났다고 오해한다.',
  },
]
