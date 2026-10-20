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
    name: '🪦위탁 결제 경로의 자동 매핑까지 같이 지운다',
    file: 'src/worker/utils/checkout.ts',
    find: '          `SELECT id, product_id FROM consignment_partnerships',
    replace: '          `SELECT id, product_id FROM consignment_partnerships_REMOVED',
    test: TEST,
    why: '문만 닫은 것이지 기능을 없앤 게 아니다 — 살릴지 없앨지는 대표 판단이고 위탁 정산은 머니 경로다.',
  },
  {
    name: '🪦위탁 테이블 부재를 더 이상 허용하지 않는다',
    file: 'src/worker/utils/checkout.ts',
    find: '    try {\n      const productIds = products.map(p => String(p.productId))',
    replace: '    if (true) {\n      const productIds = products.map(p => String(p.productId))',
    test: TEST,
    why: '`catch` 가 사라지면 테이블 없는 라이브에서 **주문 생성이 통째로 실패**한다.',
  },
]
