/**
 * 🧬 주입 — **사장님·중개사 플로우 전수조사 수리** (2026-10-10)
 *
 * 되돌리면 전부 **에러 없이** 종전으로 간다: 승인 대기 사장님이 몰 화면에서 로그아웃되고,
 * 매장 확인코드를 맞게 넣어도 사용 처리가 실패하고, 코드는 대시보드를 열어야만 생긴다.
 */
const GB = 'src/features/seller/api/seller-gb.routes.ts'
const GB_T = 'src/tests/unit/seller-gb-pending-seat-2026-10-10.test.ts'
const CR = 'src/worker/utils/counter-redeem.ts'
const RS = 'src/worker/utils/redemption-settings.ts'
const CR_T = 'src/tests/unit/counter-redeem-2026-10-10.test.ts'

export default [
  {
    name: '사장님플로우 — 대기 좌석을 401(=로그아웃)로 되돌린다',
    file: GB,
    find: "  return { ok: false, status: 403, body: { ...SELLER_PENDING_APPROVAL } }\n}",
    replace: "  return unauth\n}",
    test: GB_T,
    why: '401 은 클라 인터셉터가 토큰을 지우고 로그인으로 보낸다 — 방금 매장을 등록한 사장님이 쫓겨난다.',
  },
  {
    name: '사장님플로우 — 고객센터 안내도 대기 좌석에 닫는다',
    file: GB,
    find: '  if (opts.allowUnapproved && isSeatableStoreStatus(row.status)) return { ok: true, sellerId: id }',
    replace: '  if (false && opts.allowUnapproved && isSeatableStoreStatus(row.status)) return { ok: true, sellerId: id }',
    test: GB_T,
    why: '승인을 기다리는 사람이 가장 먼저 찾는 것이 연락처다 — 그 자리가 승인 뒤에만 열리면 물어볼 곳이 없다.',
  },
  {
    name: '사장님플로우 — 카운터가 매장 확인코드를 안 본다(PIN 전용)',
    file: CR,
    find: "                  AND r.store_code IS NOT NULL AND r.store_code <> '' AND r.store_code = ?",
    replace: "                  AND r.store_code IS NOT NULL AND r.store_code <> '' AND r.store_code = ? AND 0",
    test: CR_T,
    why: '기본 사용 방식이 store_code 인데 카운터는 상품 PIN 만 봤다 — 코드를 맞게 넣어도 언제나 실패했다.',
  },
  {
    name: '사장님플로우 — 확인코드 선발급이 기존 코드를 덮어쓴다',
    file: RS,
    find: "        store_code = CASE WHEN COALESCE(seller_redemption_settings.store_code, '') = '' THEN excluded.store_code ELSE seller_redemption_settings.store_code END,",
    replace: '        store_code = excluded.store_code, mode = excluded.mode,',
    test: CR_T,
    why: '사장님이 매장에 붙여 둔 스티커 코드가 재등록·재실행 한 번에 무효가 된다(에러 0).',
  },
]
