/**
 * 🗑️➡️🎟️ "삭제한 이용권을 되돌릴 수 있어야 한다" (2026-09-15).
 *
 * 대표가 삭제 버튼을 시험 삼아 눌렀더니 라이브의 유일한 실제 매장 이용권이 지워졌고 —
 * **되돌릴 화면이 아무 데도 없었다**(어드민 PATCH 는 status 를 안 받고, 셀러 목록은 삭제분을 숨긴다).
 * 아래 주입들이 그 상태를 하나씩 되살려 본다.
 *
 * 가드: src/tests/unit/voucher-restore-2026-09-15.test.ts
 */
const SERVER = 'src/features/seller/api/seller-orders.routes.ts'
const QUERY = 'src/features/seller/api/seller-products-query.ts'
const HOOK = 'src/pages/seller-page/useSellerHome.ts'
const ROW = 'src/pages/seller-group-buy/VoucherRow.tsx'
const TEST = 'src/tests/unit/voucher-restore-2026-09-15.test.ts'

export default [
  {
    name: '🕳️ 삭제분 opt-in 을 없앤다 (삭제한 이용권이 다시 영영 안 보인다)',
    file: SERVER,
    find: "const includeDeleted = c.req.query('include_deleted') === '1';",
    replace: 'const includeDeleted = false;',
    test: TEST,
    why:
      '이것이 2026-09-15 이전 상태다. 서버에 복구 쓰기 경로(PUT status=ACTIVE)는 있었지만 ' +
      '삭제분을 보여 주는 읽기 경로가 없어 도달할 화면을 만들 수 없었다.',
  },
  {
    name: '🕳️ 기본 요청에도 삭제분을 섞는다 (판매 중 목록에 지운 상품이 돌아온다)',
    file: QUERY,
    find: "  const notDeleted = includeDeleted ? '' : `AND COALESCE(p.status, 'ACTIVE') != 'DELETED'`",
    replace: "  const notDeleted = ''",
    test: TEST,
    why:
      'opt-in 이 opt-in 이 아니게 된다. 홈·상품관리 등 이 목록을 쓰는 모든 화면이 지운 상품을 다시 그리고, ' +
      '셀러는 방금 지운 것이 왜 살아 있는지 알 수 없다.',
  },
  {
    name: '🕳️ count 를 목록과 갈라 놓는다 (페이지 수가 거짓말을 한다)',
    file: QUERY,
    find: "  const notDeletedBare = includeDeleted ? '' : `AND COALESCE(status, 'ACTIVE') != 'DELETED'`",
    replace: "  const notDeletedBare = `AND COALESCE(status, 'ACTIVE') != 'DELETED'`",
    test: TEST,
    why:
      '2026-07-02 에 정확히 이 불일치를 고친 기록이 같은 파일에 있다(도매상품 보유 셀러 total 과대). ' +
      '목록과 카운트가 다른 필터를 쓰면 has_more 가 틀리고 마지막 페이지가 빈다.',
  },
  {
    name: '🕳️ 콜드 D1 컬럼 보장을 뺀다 (셀러 메인 목록이 "no such column" 500)',
    file: SERVER,
    find: '    await ensureGroupBuyColumns(db);',
    replace: '    void ensureGroupBuyColumns;',
    test: TEST,
    why:
      'restaurant_phone·group_buy_current·store_owner_token 은 마이그레이션이 아니라 ensureTables 의 ' +
      'ALTER 로 생긴다. 콜드 isolate 에서 안 부르면 셀러가 가장 먼저 보는 화면이 통째로 500 이다.',
  },
  {
    name: '🕳️ 목록 SELECT 에서 식당 연락처를 뺀다 (연락처가 있어도 "미등록" 배너가 뜬다)',
    file: QUERY,
    find: '        p.restaurant_phone,\n        p.store_owner_token,',
    replace: '        p.store_owner_token,',
    test: TEST,
    why:
      '이것이 2026-09-15 이전 상태이고, **에러가 안 나서 몇 달간 아무도 몰랐다** — undefined 가 되어 ' +
      '화면은 조용히 "연락처 미등록" 으로 갈라졌다(라이브 2888 은 연락처가 등록돼 있다).',
  },
  {
    name: '🕳️ 살아 있는 목록이 삭제분을 안 거른다 (홈의 이용권 수가 부풀려진다)',
    file: HOOK,
    find: "  return useQuery({ ...vouchersQuery(), select: (l: HomeVoucher[]) => l.filter((v) => v.status !== 'DELETED') })",
    replace: '  return useQuery({ ...vouchersQuery() })',
    test: TEST,
    why:
      '목록을 삭제분까지 받도록 바꾼 대가다. 여기서 안 거르면 홈(M2)·판매 중 세그먼트·공구 제안 패널이 ' +
      '전부 지운 이용권을 포함해 센다 — 숫자만 틀리고 에러는 없다.',
  },
  {
    name: '🕳️ 두 훅의 queryKey 를 갈라 놓는다 (같은 목록을 두 번 받아 온다)',
    file: HOOK,
    find: "    queryKey: ['seller', 'home', 'vouchers'] as const,",
    replace: "    queryKey: ['seller', 'home', 'vouchers', Math.random()] as const,",
    test: TEST,
    why:
      '캐시가 갈리면 요청이 두 배가 되고, 더 나쁘게는 복구 직후 한쪽만 갱신돼 ' +
      '"복구했는데 목록엔 아직 없다" 가 된다.',
  },
  {
    name: '🕳️ 복구 버튼에서 실제 호출을 뗀다 (버튼은 있는데 아무 일도 안 일어난다)',
    file: ROW,
    find: "onClick={() => setSale(true, t('seller.vouchers.restored'",
    replace: "onClick={() => undefined && setSale(true, t('seller.vouchers.restored'",
    test: TEST,
    why:
      '이 레포가 반복해 당한 "조용한 부재" 다 — 눌러도 에러가 없고 화면도 안 바뀌어서 ' +
      '셀러는 자기가 잘못 눌렀다고 생각한다.',
  },
  {
    name: '🕳️ 삭제된 행에 삭제 버튼을 도로 넣는다 (이미 지운 것을 또 지우라고 권한다)',
    file: ROW,
    find: "          <RotateCcw size={13} /> {t('seller.vouchers.restore', { defaultValue: '복구' })}",
    replace: "          <RotateCcw size={13} /> {t('seller.vouchers.restore', { defaultValue: '복구' })} {String(deleteVoucher)}",
    test: TEST,
    why: '삭제된 상품에 의미 있는 행동은 복구 하나뿐이다. 선택지를 늘리면 무엇이 되돌리는 것인지 흐려진다.',
  },
  {
    name: '🕳️ PUT 소유권 조회가 삭제분을 배제한다 (복구가 404 가 된다)',
    file: SERVER,
    // ⚠️ 같은 문장이 파일에 세 번 있다(PUT·알림톡·PIN). 앞의 주석 줄까지 넣어 PUT 것으로 고유화한다.
    find: '    // 소유권 확인\n    const existing = await db.prepare(\n      `SELECT id FROM products WHERE id = ? AND seller_id = ?`',
    replace: "    // 소유권 확인\n    const existing = await db.prepare(\n      `SELECT id FROM products WHERE id = ? AND seller_id = ? AND COALESCE(status,'ACTIVE') != 'DELETED'`",
    test: TEST,
    why:
      '복구가 새 서버 경로 없이 성립하는 이유가 바로 이 조회에 DELETED 조건이 없다는 것이다. ' +
      '여기가 조여지면 화면의 복구 버튼이 조용히 404 를 받는다.',
  },
]
