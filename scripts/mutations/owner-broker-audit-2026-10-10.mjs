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
const NP_T = 'src/tests/unit/seller-notify-phone-2026-10-10.test.ts'
const BR_T = 'src/tests/unit/biz-reg-resubmit-2026-10-10.test.ts'
const US_T = 'src/tests/unit/urshop-owned-store-2026-10-10.test.ts'

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
  {
    name: '사장님플로우 — 알림 번호를 매장 대표번호(유선)로 되돌린다',
    file: 'src/worker/utils/seller-notify-phone.ts',
    find: '  return toMobile(managerPhone) ?? toMobile(storePhone)',
    replace: '  return toMobile(storePhone)',
    test: NP_T,
    why: '라이브 13곳 중 12곳의 sellers.phone 이 유선이다 — 판매·사용·승인 알림이 에러 없이 아무에게도 안 간다.',
  },
  {
    name: '사장님플로우 — 첫 판매 안내 CAS 를 없앤다(동시 결제 두 건이 둘 다 첫 판매 문자)',
    file: 'src/features/group-buy/api/seller-sale-notify.ts',
    find: "        'UPDATE sellers SET first_voucher_notified = 1 WHERE id = ? AND COALESCE(first_voucher_notified, 0) = 0',",
    replace: "        'UPDATE sellers SET first_voucher_notified = 1 WHERE id = ?',",
    test: NP_T,
    why: '조건 없는 UPDATE 는 매번 1행을 바꿔 "첫 판매" 안내가 판매마다 간다.',
  },
  {
    name: '사장님플로우 — 카드 결제 경로의 판매 알림톡을 뺀다',
    file: 'src/features/group-buy/api/group-buy.routes.ts',
    find: '            await notifySellerVoucherSale(c.env, DB, { sellerId: product.seller_id, productName: product.name, qty, amount: Number(expectedAmount) || 0 })\n',
    replace: '',
    test: NP_T,
    why: '이용권은 대부분 카드로 팔린다 — 이 줄이 없으면 사장님은 손님이 올 때까지 판매를 모른다(종전 상태).',
  },
  {
    name: '사장님플로우 — 승인이 반려된 서류까지 verified 로 덮어쓴다',
    file: 'src/features/admin/api/admin-sellers/seller-decision-notify.ts',
    find: "      WHERE id = ? AND COALESCE(business_registration_image_url, '') <> '' AND business_registration_status = 'pending'`,",
    replace: "      WHERE id = ?`,",
    test: NP_T,
    why: '어드민이 반려한 서류를 매장 승인 한 번이 "확인 완료" 로 바꾸면 반려 판단이 조용히 사라진다.',
  },
  {
    name: '사장님플로우 — 반려 매장이 서류를 다시 내도 심사 큐로 안 돌아간다',
    file: 'src/features/seller/api/seller-settlements/biz-reg-submit.ts',
    find: "    \"UPDATE sellers SET status = 'pending', updated_at = datetime('now') WHERE id = ? AND status = 'rejected'\",",
    replace: "    \"UPDATE sellers SET updated_at = datetime('now') WHERE id = ? AND 0\",",
    test: BR_T,
    why: '사장님 화면엔 "제출됨" 이 뜨는데 어드민 승인 목록(status=pending)엔 다시 안 뜬다 — 서로를 기다리는 교착.',
  },
  {
    name: '사장님플로우 — 등록증 칸이 남의 서버 주소를 받는다',
    file: 'src/features/seller/api/seller-settlements/biz-reg-submit.ts',
    find: "    if (u.protocol !== 'https:' || !OWN_HOSTS.has(u.hostname)) return null",
    replace: "    if (u.protocol !== 'https:') return null",
    test: BR_T,
    why: '어드민 승인 화면이 그 주소를 띄운다 — 등록증 대신 아무 이미지나 심사 자료가 된다.',
  },
  {
    name: '사장님플로우 — 유어샵이 주인 좌석을 안 본다(연결 계정만)',
    file: 'src/worker/utils/seller-operators.ts',
    find: "     OR EXISTS (SELECT 1 FROM seller_operators o WHERE o.seller_id = s.id AND o.user_id = ? AND o.role = 'owner' AND o.revoked_at IS NULL) )",
    replace: "     OR (? IS NULL AND 0) )",
    test: US_T,
    why: '/store/new 로 직접 등록한 사장님은 linked_user_id 가 비어 있어 승인돼도 내 유어샵에 내 가게가 안 뜬다.',
  },
  {
    name: '사장님플로우 — 유어샵 내 가게 판정이 중개 좌석까지 통과시킨다',
    file: 'src/worker/utils/seller-operators.ts',
    find: "o.user_id = ? AND o.role = 'owner' AND o.revoked_at IS NULL) )\n  ORDER BY",
    replace: "o.user_id = ? AND o.revoked_at IS NULL) )\n  ORDER BY",
    test: US_T,
    why: '중개사의 유어샵에 남의 가게가 "내 가게" 로 진열된다.',
  },
]
