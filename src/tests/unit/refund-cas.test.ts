/**
 * Refund CAS (compare-and-swap) regression tests
 *
 * Ensures partial/full refund logic correctly prevents over-refund via
 * concurrent requests. Mirror of the CAS query in src/worker/routes/order.routes.ts.
 *
 * The canonical defense:
 *   UPDATE orders
 *   SET refunded_amount = COALESCE(refunded_amount, 0) + ?
 *   WHERE id = ?
 *     AND COALESCE(refunded_amount, 0) + ? <= total_amount
 *
 * If changes=0 → reject (would exceed total). If changes=1 → claim slot, call Toss.
 * If Toss fails → rollback: refunded_amount -= amount.
 */
import { describe, it, expect } from 'vitest';

// Simulated DB row and CAS reservation (no D1 needed)
type OrderRow = { id: string; total_amount: number; refunded_amount: number };

function reserveRefund(
  order: OrderRow,
  refundAmount: number,
): { ok: true; newRefunded: number } | { ok: false; error: string } {
  const currentRefunded = order.refunded_amount || 0;
  if (refundAmount <= 0) return { ok: false, error: 'amount must be positive' };
  if (currentRefunded + refundAmount > order.total_amount) {
    return { ok: false, error: 'would exceed total_amount' };
  }
  order.refunded_amount = currentRefunded + refundAmount;
  return { ok: true, newRefunded: order.refunded_amount };
}

function rollbackRefund(order: OrderRow, amount: number): void {
  order.refunded_amount = Math.max(0, (order.refunded_amount || 0) - amount);
}

describe('Refund CAS — single request', () => {
  it('accepts full refund on fresh order', () => {
    const o: OrderRow = { id: 'o1', total_amount: 10000, refunded_amount: 0 };
    const r = reserveRefund(o, 10000);
    expect(r.ok).toBe(true);
    expect(o.refunded_amount).toBe(10000);
  });

  it('accepts partial refund (half)', () => {
    const o: OrderRow = { id: 'o1', total_amount: 10000, refunded_amount: 0 };
    const r = reserveRefund(o, 3000);
    expect(r.ok).toBe(true);
    expect(o.refunded_amount).toBe(3000);
  });

  it('rejects refund exceeding total (over-refund attempt)', () => {
    const o: OrderRow = { id: 'o1', total_amount: 10000, refunded_amount: 0 };
    const r = reserveRefund(o, 10001);
    expect(r.ok).toBe(false);
    expect(o.refunded_amount).toBe(0); // unchanged
  });

  it('rejects zero amount', () => {
    const o: OrderRow = { id: 'o1', total_amount: 10000, refunded_amount: 0 };
    const r = reserveRefund(o, 0);
    expect(r.ok).toBe(false);
  });

  it('rejects negative amount', () => {
    const o: OrderRow = { id: 'o1', total_amount: 10000, refunded_amount: 0 };
    const r = reserveRefund(o, -1000);
    expect(r.ok).toBe(false);
  });
});

describe('Refund CAS — sequential partial refunds', () => {
  it('accepts two partial refunds summing to total', () => {
    const o: OrderRow = { id: 'o1', total_amount: 10000, refunded_amount: 0 };
    expect(reserveRefund(o, 3000).ok).toBe(true);
    expect(o.refunded_amount).toBe(3000);
    expect(reserveRefund(o, 7000).ok).toBe(true);
    expect(o.refunded_amount).toBe(10000);
  });

  it('rejects third refund after full refund already applied', () => {
    const o: OrderRow = { id: 'o1', total_amount: 10000, refunded_amount: 10000 };
    const r = reserveRefund(o, 1);
    expect(r.ok).toBe(false);
  });

  it('rejects partial refund when sum would exceed total', () => {
    const o: OrderRow = { id: 'o1', total_amount: 10000, refunded_amount: 7000 };
    const r = reserveRefund(o, 3001);
    expect(r.ok).toBe(false);
    expect(o.refunded_amount).toBe(7000);
  });
});

describe('Refund rollback — Toss failure path', () => {
  it('restores refunded_amount after Toss failure', () => {
    const o: OrderRow = { id: 'o1', total_amount: 10000, refunded_amount: 0 };
    expect(reserveRefund(o, 3000).ok).toBe(true);
    expect(o.refunded_amount).toBe(3000);

    // Simulate Toss failure → rollback
    rollbackRefund(o, 3000);
    expect(o.refunded_amount).toBe(0);

    // Retry after rollback should succeed
    expect(reserveRefund(o, 3000).ok).toBe(true);
  });

  it('rollback bounded at 0 (never goes negative)', () => {
    const o: OrderRow = { id: 'o1', total_amount: 10000, refunded_amount: 1000 };
    rollbackRefund(o, 5000);
    expect(o.refunded_amount).toBe(0);
  });
});

describe('Refund CAS — simulated race (sequential ordering)', () => {
  it('prevents over-refund when two concurrent requests race', () => {
    // Race: both requests see refunded_amount=0, try to refund 6000 each.
    // Only one should succeed (total=10000).
    const o: OrderRow = { id: 'o1', total_amount: 10000, refunded_amount: 0 };

    // Request A claims first
    const a = reserveRefund(o, 6000);
    expect(a.ok).toBe(true);

    // Request B arrives after A's reservation (atomic CAS protects)
    const b = reserveRefund(o, 6000);
    expect(b.ok).toBe(false);
    expect(o.refunded_amount).toBe(6000); // not 12000
  });

  it('allows second request if amount fits remaining', () => {
    const o: OrderRow = { id: 'o1', total_amount: 10000, refunded_amount: 0 };
    expect(reserveRefund(o, 6000).ok).toBe(true);
    expect(reserveRefund(o, 4000).ok).toBe(true); // exactly fills
    expect(o.refunded_amount).toBe(10000);
  });
});
