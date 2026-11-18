/**
 * 🪦 위탁 판매 문 닫기 되돌려-검증 주입 (2026-09-28).
 * 가드: src/tests/unit/consignment-door-closed-2026-09-28.test.ts
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일.
 */
const TEST = 'src/tests/unit/consignment-door-closed-2026-09-28.test.ts'

export default [
  {
    name: '🪦위탁 깨진 페이지를 도로 연다',
    file: 'src/routes/seller.routes.tsx',
    find: '      <Route path="/seller/consignment" element={<Navigate to="/seller" replace />} />',
    replace: '      <Route path="/seller/consignment" element={<ProtectedRoute requireSeller><SellerConsignmentPage /></ProtectedRoute>} />',
    test: TEST,
    why: '테이블이 없어 API 일곱 개가 전부 `no such table` 로 죽는 화면이다 — 북마크로 닿으면 그걸 본다.',
  },
  {
    name: '🪦위탁 결제가 없는 표를 다시 묻는다',
    file: 'src/worker/utils/checkout.ts',
    find: '    await db.batch([\n      // 주문 아이템 생성',
    replace: '    try { await db.prepare(`SELECT id, product_id FROM consignment_partnerships WHERE status = \'active\'`).all() } catch { /* */ }\n    await db.batch([\n      // 주문 아이템 생성',
    test: TEST,
    why: '2026-11-18 대표 결정으로 지운 조회다 — 라이브에 표가 없어 결제마다 한 번씩 실패한다.',
  },
]
