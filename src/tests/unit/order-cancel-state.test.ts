/**
 * 주문 취소 상태 전이 — 순수 로직 테스트
 *
 * src/worker/routes/order.routes.ts 의 cancel/refund 흐름 시뮬레이션.
 * 가드:
 *   1. PENDING / PAID 만 취소 가능 (SHIPPING / DELIVERED 거부)
 *   2. 이미 CANCELLED → 멱등 (동일 응답)
 *   3. partial refund 시 refunded_amount 누적 ≤ total_amount
 *   4. cancel_reason 길이 제한 (500자)
 */
import { describe, it, expect } from 'vitest';

type OrderStatus = 'PENDING' | 'PAID' | 'DONE' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

interface OrderRow {
  id: string;
  status: OrderStatus;
  total_amount: number;
  refunded_amount: number;
  cancel_reason: string | null;
}

type CancelResult =
  | { ok: true; status: OrderStatus; refunded_now: number }
  | { ok: false; code: 'INVALID_STATUS' | 'ALREADY_CANCELLED' | 'AMOUNT_EXCEEDS' | 'INVALID_REASON' | 'INVALID_AMOUNT' };

function tryCancel(
  order: OrderRow,
  refundAmount: number | null, // null = 전액 취소
  reason: string,
): CancelResult {
  if (typeof reason !== 'string' || reason.length > 500) {
    return { ok: false, code: 'INVALID_REASON' };
  }

  // 이미 취소됨 → 멱등 응답
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    return { ok: false, code: 'ALREADY_CANCELLED' };
  }

  // 취소 불가 상태
  if (order.status === 'SHIPPING' || order.status === 'DELIVERED' || order.status === 'DONE') {
    return { ok: false, code: 'INVALID_STATUS' };
  }

  // 환불액 결정
  const amount = refundAmount === null
    ? order.total_amount - order.refunded_amount // 잔여 전액
    : refundAmount;

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, code: 'INVALID_AMOUNT' };
  }

  // CAS 보장: 누적 환불액 ≤ 총액
  if (order.refunded_amount + amount > order.total_amount) {
    return { ok: false, code: 'AMOUNT_EXCEEDS' };
  }

  // 상태 전이 결정
  const newStatus: OrderStatus =
    order.refunded_amount + amount === order.total_amount ? 'CANCELLED' : 'PAID';

  // 부분 환불은 PAID 유지 (잔여 환불 가능), 전액 환불은 CANCELLED
  return { ok: true, status: newStatus, refunded_now: amount };
}

describe('Order 취소 — 상태별 허용/거부', () => {
  const baseOrder: OrderRow = {
    id: 'o1', status: 'PENDING', total_amount: 10_000, refunded_amount: 0, cancel_reason: null,
  };

  it('PENDING → 취소 가능', () => {
    const r = tryCancel({ ...baseOrder, status: 'PENDING' }, null, '주문 취소');
    expect(r.ok).toBe(true);
  });

  it('PAID → 취소 가능 (결제 완료 상태)', () => {
    const r = tryCancel({ ...baseOrder, status: 'PAID' }, null, '취소');
    expect(r.ok).toBe(true);
  });

  it('SHIPPING → 거부 (배송 중)', () => {
    const r = tryCancel({ ...baseOrder, status: 'SHIPPING' }, null, '취소');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_STATUS');
  });

  it('DELIVERED → 거부 (배송 완료, 환불은 별도 흐름)', () => {
    const r = tryCancel({ ...baseOrder, status: 'DELIVERED' }, null, '취소');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_STATUS');
  });

  it('DONE → 거부 (구매 확정 상태)', () => {
    const r = tryCancel({ ...baseOrder, status: 'DONE' }, null, '취소');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_STATUS');
  });

  it('CANCELLED → ALREADY_CANCELLED (멱등성 보장)', () => {
    const r = tryCancel({ ...baseOrder, status: 'CANCELLED' }, null, '재시도');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ALREADY_CANCELLED');
  });
});

describe('Order 부분 환불 — CAS', () => {
  const order: OrderRow = {
    id: 'o1', status: 'PAID', total_amount: 10_000, refunded_amount: 0, cancel_reason: null,
  };

  it('첫 부분 환불 (3000원) — 통과', () => {
    const r = tryCancel(order, 3000, '부분 환불');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.refunded_now).toBe(3000);
      expect(r.status).toBe('PAID'); // 잔여 7000원 → PAID 유지
    }
  });

  it('이미 3000 환불된 주문 + 5000 추가 → 통과', () => {
    const partial: OrderRow = { ...order, refunded_amount: 3000 };
    const r = tryCancel(partial, 5000, '추가 환불');
    expect(r.ok).toBe(true);
  });

  it('이미 3000 환불 + 8000 추가 → AMOUNT_EXCEEDS (총 11000 > 10000)', () => {
    const partial: OrderRow = { ...order, refunded_amount: 3000 };
    const r = tryCancel(partial, 8000, '');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('AMOUNT_EXCEEDS');
  });

  it('이미 3000 환불 + 7000 (정확히 잔여) → CANCELLED', () => {
    const partial: OrderRow = { ...order, refunded_amount: 3000 };
    const r = tryCancel(partial, 7000, '잔여 전액');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe('CANCELLED');
  });

  it('전액 환불 (refundAmount=null + 0 환불 상태) → CANCELLED', () => {
    const r = tryCancel(order, null, '전액 취소');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.refunded_now).toBe(10_000);
      expect(r.status).toBe('CANCELLED');
    }
  });

  it('환불액 0 또는 음수 거부', () => {
    expect(tryCancel(order, 0, '').ok).toBe(false);
    expect(tryCancel(order, -100, '').ok).toBe(false);
  });

  it('환불액 NaN 거부', () => {
    const r = tryCancel(order, NaN, '');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_AMOUNT');
  });
});

describe('Order 취소 사유 — 길이 제한', () => {
  const order: OrderRow = {
    id: 'o1', status: 'PAID', total_amount: 10_000, refunded_amount: 0, cancel_reason: null,
  };

  it('500자 정확 → 통과', () => {
    const r = tryCancel(order, null, 'a'.repeat(500));
    expect(r.ok).toBe(true);
  });

  it('501자 → 거부 (DB column 보호)', () => {
    const r = tryCancel(order, null, 'a'.repeat(501));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_REASON');
  });

  it('빈 문자열 → 통과 (사유 미제공 OK)', () => {
    const r = tryCancel(order, null, '');
    expect(r.ok).toBe(true);
  });
});
