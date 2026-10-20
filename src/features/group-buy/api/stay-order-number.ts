/**
 * 🛡️ 2026-10-17 숙소 예약 주문번호 — orders.order_number 는 NOT NULL UNIQUE 인데 두 INSERT 가
 *   이 컬럼을 안 넣어 **모든 날짜·이용권 예약이 '주문 생성 실패'** 로 끝났다(라이브 stay_bookings 0건).
 *   토스 orderId('STAY-{orders.id}')와 **일부러 다른** 모양이다 — 같으면 결제 webhook 이 이 주문을
 *   일반 주문 확정 경로로 처리하기 시작한다(숙소 확정은 /stays/bookings/confirm 이 맡는다).
 */
export function stayOrderNumber(): string {
  return `STAYORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

/** 한국 날짜(YYYY-MM-DD) — 체크인이 오늘(KST)보다 이르면 막는다. */
export function kstToday(now: number = Date.now()): string {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 10)
}
