// 🏷️ 브랜드 전 지점 사용 — 같은 주인 지점만 받는다 · 비밀은 CAS 안에서 다시 대조 · 정산은 판 지점 (2026-10-18)
const TEST = 'src/tests/unit/brand-wide-redeem-2026-10-18.test.ts'

export default [
  {
    name: '🏷️ 브랜드 전 지점: 주인이 다른 가맹점도 받아 준다',
    file: 'src/worker/utils/brand-wide-redeem.ts',
    find: 'accepting: ownerId != null && sibOwner === ownerId && Number(r.ok_status) === 1,',
    replace: 'accepting: ownerId != null && Number(r.ok_status) === 1,',
    test: TEST,
    why: '주인이 다르면 남의 손님을 공짜로 받아 주게 된다(정산은 판 지점에 남으므로) — 같은 주인만 받는 것이 이 단계의 머니 안전판이다.',
  },
  {
    name: '🏷️ 브랜드 전 지점: 심사 중·정지 지점도 받아 준다',
    file: 'src/worker/utils/brand-wide-redeem.ts',
    find: "const ACCEPTING_STATUS = `COALESCE(s.status, '') IN ('approved', 'active')`",
    replace: "const ACCEPTING_STATUS = `1 = 1`",
    test: TEST,
    why: '정산 가능 상태가 아닌 지점이 사용 처리를 받으면 승인 전 매장이 이용권을 소각할 수 있다.',
  },
  {
    name: '🏷️ 브랜드 전 지점: 꺼진 이용권도 형제 지점이 받는다',
    file: 'src/worker/utils/brand-wide-redeem.ts',
    find: "  return r?.value === '1'",
    replace: '  return true',
    test: TEST,
    why: '기본은 꺼짐(그 지점에서만) — 사장님이 고르지 않은 이용권이 다른 지점에서 쓰이면 안 된다.',
  },
  {
    name: '🏷️ 브랜드 전 지점: 손님 셀프가 scan_only 지점 코드를 받는다',
    file: 'src/worker/utils/brand-wide-redeem.ts',
    find: "    if (!opts.allowScanOnly && r.mode === 'scan_only') continue",
    replace: '',
    test: TEST,
    why: 'scan_only 는 손님 혼자 누르는 사용을 막는 매장 설정이다 — 형제 지점이라는 이유로 그 문을 열면 안 된다.',
  },
  {
    name: '🏷️ 브랜드 전 지점: 카운터 CAS 가 형제 지점 id 만 믿고 비밀을 안 본다',
    file: 'src/worker/utils/counter-redeem.ts',
    find: "                  AND rb.store_code IS NOT NULL AND rb.store_code <> '' AND rb.store_code = ?",
    replace: "                  AND rb.store_code IS NOT NULL AND rb.store_code <> '' AND ? IS NOT NULL",
    test: TEST,
    why: '실제 문은 CAS 다 — 사전 판정만 믿으면 동시 요청·변경 사이에 틀린 코드로 소각될 수 있다.',
  },
  {
    name: '🏷️ 브랜드 전 지점: 사장님 스캔이 아무 지점이나 받아 준다',
    file: 'src/worker/utils/brand-wide-redeem.ts',
    find: '  return siblings.some((s) => s.accepting && s.seller_id === Number(actorSellerId))',
    replace: '  return siblings.length > 0',
    test: TEST,
    why: '같은 브랜드라도 받아 주는 지점만 — 가맹점·심사 중 지점의 스캔은 막는다.',
  },
  {
    name: '🏷️ 브랜드 전 지점: 셀프 게이트에 상품 id 를 안 넘긴다(잠금 파일)',
    file: 'src/features/group-buy/api/group-buy-public.routes.ts',
    find: "checkSelfRedeemGate(DB, pre.seller_id, String(body.store_code || ''), pre.product_id)",
    replace: "checkSelfRedeemGate(DB, pre.seller_id, String(body.store_code || ''))",
    test: TEST,
    why: '안 넘기면 손님이 다른 지점에서 그 지점 코드를 넣어도 막힌다 — 켜 둔 기능이 셀프 경로에서만 조용히 죽는다.',
  },
  {
    name: '🏷️ 브랜드 전 지점: /v 처리 버튼이 형제 지점을 다른 매장으로 본다',
    file: 'src/features/group-buy/api/voucher-can-redeem.ts',
    find: '    return !!v && await canStoreRedeemProduct(DB, Number(v.product_id), Number(productSellerId), Number(u.id))',
    replace: '    return false',
    test: TEST,
    why: '실제 처리는 형제 지점을 받는데 화면이 "다른 매장의 이용권" 을 띄우면 처리할 수 있는 사장님에게 버튼이 사라진다.',
  },
]
