/**
 * 🧬 주입 — **이용권 주문이 "처리 대기" 에 영원히 쌓이던 것** (2026-10-07)
 *
 * 전부 에러 없이 조용히 되돌아간다. 숫자가 몇 개 더 찍힐 뿐이라 사장님만 매일 재촉받는다.
 */
const T = 'src/tests/unit/voucher-order-stage-2026-10-07.test.ts'

export default [
  {
    name: '주문단계 — 이용권을 결제 상태만으로 처리 대기로 센다',
    file: 'src/shared/order-stage.ts',
    find: '  if (isNoShippingOrder(kind)) {',
    replace: '  if (false) {',
    test: T,
    why: '종전 동작 그대로다 — 상태 집합만 보면 이용권 결제 주문이 waiting 이 되고 끝날 길이 없다.',
  },
  {
    name: '주문단계 — 발급 목록을 모르면 완료로 단정한다',
    file: 'src/shared/order-stage.ts',
    find: "    if (!vs || vs.length === 0) return 'unused'",
    replace: "    if (!vs || vs.length === 0) return 'done'",
    test: T,
    why: '조회가 한 번 실패한 날 아직 안 쓴 이용권이 "완료" 탭으로 숨어 사장님이 손님을 놓친다.',
  },
  {
    name: '주문단계 — 서버 요약이 이용권까지 처리 대기로 센다',
    file: 'src/features/seller/api/seller-operators.routes.ts',
    find: "            AND ${shippingOrderSql('o')}\n",
    replace: '\n',
    test: T,
    why: '마이 "확인 대기 N건" 이 서버 숫자를 그린다 — 클라만 고치면 같은 화면에서 두 숫자가 갈린다.',
  },
  {
    name: '주문단계 — 배송 술어가 교환권(deal_only)을 배송으로 센다',
    file: 'src/shared/db/shipping-order-sql.ts',
    find: '(COALESCE(p_s.deal_only, 0) <> 1 AND ',
    replace: '(',
    test: T,
    why: '교환권은 휴대폰 발송이라 사장님이 확인할 일이 없다 — 카테고리만 보면 편의점·커피 교환권이 처리 대기로 샌다.',
  },
  {
    name: '주문단계 — 홈 처리 대기가 상태 집합으로 되돌아간다',
    file: 'src/pages/seller-page/useSellerHome.ts',
    find: 'orders.filter(needsSellerConfirm).length',
    replace: "orders.filter((o) => ['PAID', 'DONE', 'PAY_COMPLETE'].includes(o.status)).length",
    test: T,
    why: '홈 티켓 "처리 대기" 와 할 일 "새 주문 N건" 이 이 숫자다.',
  },
  {
    name: '주문단계 — 폰 목록 이용권 행에 [주문 확인] 칩이 돌아온다',
    file: 'src/pages/seller-orders/MobileOrderList.tsx',
    find: "              const hot = stage === 'waiting'",
    replace: "              const hot = stage === 'waiting' || stage === 'unused'",
    test: T,
    why: '이용권에서 [주문 확인] 은 "준비 중" 으로 옮길 뿐 아무 일도 안 일어난다 — 누를 이유가 없는 버튼.',
  },
]
