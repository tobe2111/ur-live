/**
 * 🧬 주입 — 이용권 최소 판매가 1,000원 (2026-10-11 대표 "최소가격을 정하는게 좋겠네")
 * 한 자리라도 빠지면 그 길로 1,000원 미만 이용권이 들어와 알림톡 비용이 수수료를 넘는다.
 */
const T = 'src/tests/unit/voucher-min-price-2026-10-11.test.ts'
export default [
  {
    name: '이용권 최소가 — 셀러 등록이 최소가를 안 본다',
    file: 'src/features/seller/api/seller-orders.routes.ts',
    find: "'가격은 0 ~ 1억 범위여야 합니다.' : voucherMinPriceError(category, price);",
    replace: "'가격은 0 ~ 1억 범위여야 합니다.' : null;",
    test: T,
    why: 'API 를 직접 부르면 화면 검사를 건너뛴다.',
  },
  {
    name: '이용권 최소가 — 셀러 수정으로 가격을 내릴 수 있다',
    file: 'src/features/seller/api/seller-orders.routes.ts',
    find: ": voucherMinPriceError(canonicalCategory(body.category) ?? existing.category, body.price);",
    replace: ': null;',
    test: T,
    why: '등록만 막으면 등록 뒤 수정으로 우회된다.',
  },
  {
    name: '이용권 최소가 — 수정 때 저장된 카테고리를 안 읽는다',
    file: 'src/features/seller/api/seller-orders.routes.ts',
    find: '`SELECT id, category FROM products WHERE id = ? AND seller_id = ?`',
    replace: '`SELECT id FROM products WHERE id = ? AND seller_id = ?`',
    test: T,
    why: '가격만 고치는 요청엔 카테고리가 없다 — 저장된 값을 못 읽으면 검사가 늘 통과한다.',
  },
  {
    name: '이용권 최소가 — 대행 등록이 최소가를 안 본다',
    file: 'src/worker/routes/curator.routes.ts',
    find: '    if (minErr) return c.json({ success: false, error: minErr }, 400)\n',
    replace: '',
    test: T,
    why: '영입자 대행 등록도 이용권을 만든다.',
  },
  {
    name: '이용권 최소가 — 기준을 1원으로 낮춘다',
    file: 'src/shared/constants/voucher-categories.ts',
    find: 'export const VOUCHER_MIN_PRICE = 1000',
    replace: 'export const VOUCHER_MIN_PRICE = 1',
    test: T,
    why: '대표 확정값 1,000원.',
  },
]
