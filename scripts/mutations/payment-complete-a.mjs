/**
 * 🧾 결제 완료 화면 A안(대표 확정 2026-10-06) — 되돌려-검증 주입.
 */
export default [
  {
    name: '🧾 완료 화면에 "이런 서비스도 있어요" 타일 줄이 되살아난다',
    file: 'src/pages/group-buy/PaymentCompleteTicket.tsx',
    find: '        <button\n          type="button"\n          onClick={() => navigate(product?.seller_id ?',
    replace: '        <h2>이런 서비스도 있어요</h2>\n        <button\n          type="button"\n          onClick={() => navigate(product?.seller_id ?',
    test: 'src/tests/unit/ticket-surface-system.test.ts',
    why: '대표가 고른 A안은 그 줄을 뺀 화면이다 — 방금 산 사람에게 다른 서비스를 권하는 자리가 아니다.',
  },
  {
    name: '🧾 다른 이용권 한 줄이 매장이 아니라 홈으로만 간다',
    file: 'src/pages/group-buy/PaymentCompleteTicket.tsx',
    find: "onClick={() => navigate(product?.seller_id ? `/s/${product.seller_id}` : '/')}",
    replace: "onClick={() => navigate('/')}",
    test: 'src/tests/unit/ticket-surface-system.test.ts',
    why: '"홍대돈까스 다른 이용권 보기" 를 눌렀는데 홈이 뜨면 말과 목적지가 다르다.',
  },
  {
    name: '🧾 장바구니 결제 완료에 "이런 서비스도 있어요" 줄이 되살아난다',
    file: 'src/pages/group-buy/CartComplete.tsx',
    find: '          <span className="text-[15px] font-bold">다른 이용권 보기</span>',
    replace: '          <span className="text-[15px] font-bold">이런 서비스도 있어요</span>',
    test: 'src/tests/unit/ticket-surface-system.test.ts',
    why: '단건 화면만 고치고 장바구니 화면이 남아 있던 것이 라이브 판정에서 드러났다.',
  },
]
