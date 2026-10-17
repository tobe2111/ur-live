// 🏨 2026-10-17 숙소 예약 '주문 생성 실패' — orders.order_number NOT NULL 누락 재발 방지.
export default [
  {
    name: '🏨 숙소 예약 주문번호가 다시 비어 들어간다',
    file: 'src/features/group-buy/api/stays-public.routes.ts',
    find: '  return `STAYORD-${Date.now()',
    replace: '  return null as unknown as string; `STAYORD-${Date.now()',
    test: 'src/tests/unit/stay-order-number-2026-10-17.test.ts',
    why: '값을 빼면 라이브 NOT NULL 에 걸려 모든 숙소 예약이 다시 "주문 생성 실패" 가 된다',
  },
  {
    name: '🏨 숙소 예약이 지난 날짜 체크인을 다시 받는다',
    file: 'src/features/group-buy/api/stays-public.routes.ts',
    find: "      if (checkIn < kstToday()) return c.json({ success: false, error: '지난 날짜는",
    replace: "      if (false) return c.json({ success: false, error: '지난 날짜는",
    test: 'src/tests/unit/stay-order-number-2026-10-17.test.ts',
    why: '어제 체크인을 결제까지 받으면 쓸 수 없는 숙박권을 판다',
  },
]
