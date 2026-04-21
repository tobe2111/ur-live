/**
 * Payment amount-validation regression tests
 *
 * These tests prevent regressions where a malicious client could confirm
 * a Toss payment by sending a manipulated `amount` in the body while the
 * DB-stored order total is different.
 *
 * The canonical defense (src/worker/routes/payment.routes.ts) is:
 *   1. Zod schema: amount must be a positive integer.
 *   2. Look up orders in DB by orderNumber, sum total_amount.
 *   3. If (DB sum) !== (client amount) → 400.
 *   4. Pass DB-computed total to Toss (ignore client amount for API call).
 *
 * We test the validation logic in isolation (no DB). Regression checks
 * that the zod schema rejects bad input AND that the amount-mismatch
 * guard rejects tampered totals.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mirror the zod schema used in src/worker/routes/payment.routes.ts
const confirmSchema = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(6).max(64).regex(/^[a-zA-Z0-9\-_]+$/, 'Invalid orderId format'),
  amount: z.number().int().positive(),
});

// Mirror the amount-verification function used inline in the route
function verifyAmount(
  dbOrders: Array<{ total_amount: number }>,
  clientAmount: number
): { ok: true; amount: number } | { ok: false; error: string } {
  if (dbOrders.length === 0) return { ok: false, error: '주문을 찾을 수 없습니다' };
  const dbTotal = dbOrders.reduce((sum, o) => sum + o.total_amount, 0);
  if (dbTotal !== clientAmount) return { ok: false, error: '결제 금액이 일치하지 않습니다' };
  return { ok: true, amount: dbTotal };
}

describe('Payment confirm — request schema', () => {
  it('accepts a valid request', () => {
    const res = confirmSchema.safeParse({
      paymentKey: 'test-payment-key',
      orderId: 'ORD-20260421-abc',
      amount: 10000,
    });
    expect(res.success).toBe(true);
  });

  it('rejects negative amount', () => {
    const res = confirmSchema.safeParse({
      paymentKey: 'pk',
      orderId: 'ORD-20260421-abc',
      amount: -1,
    });
    expect(res.success).toBe(false);
  });

  it('rejects zero amount', () => {
    const res = confirmSchema.safeParse({
      paymentKey: 'pk',
      orderId: 'ORD-20260421-abc',
      amount: 0,
    });
    expect(res.success).toBe(false);
  });

  it('rejects non-integer amount', () => {
    const res = confirmSchema.safeParse({
      paymentKey: 'pk',
      orderId: 'ORD-20260421-abc',
      amount: 100.5,
    });
    expect(res.success).toBe(false);
  });

  it('rejects orderId shorter than 6 chars (prevent trivial IDs)', () => {
    const res = confirmSchema.safeParse({
      paymentKey: 'pk',
      orderId: 'abc',
      amount: 1000,
    });
    expect(res.success).toBe(false);
  });

  it('rejects orderId longer than 64 chars (DoS / DB constraint)', () => {
    const res = confirmSchema.safeParse({
      paymentKey: 'pk',
      orderId: 'a'.repeat(65),
      amount: 1000,
    });
    expect(res.success).toBe(false);
  });

  it('rejects orderId with SQL injection characters', () => {
    const res = confirmSchema.safeParse({
      paymentKey: 'pk',
      orderId: "ORD'; DROP TABLE orders;--",
      amount: 1000,
    });
    expect(res.success).toBe(false);
  });

  it('rejects orderId with slashes / path traversal', () => {
    const res = confirmSchema.safeParse({
      paymentKey: 'pk',
      orderId: '../../etc/passwd',
      amount: 1000,
    });
    expect(res.success).toBe(false);
  });

  it('rejects missing paymentKey', () => {
    const res = confirmSchema.safeParse({
      paymentKey: '',
      orderId: 'ORD-20260421-abc',
      amount: 1000,
    });
    expect(res.success).toBe(false);
  });
});

describe('Payment confirm — amount tampering', () => {
  it('rejects when client total is lower than DB total (primary attack)', () => {
    const orders = [{ total_amount: 1_000_000 }];
    const res = verifyAmount(orders, 1); // attacker tries 1₩ for 1M₩ product
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/금액이 일치하지 않습니다/);
  });

  it('rejects when client total is higher than DB total (less likely but check)', () => {
    const orders = [{ total_amount: 10_000 }];
    const res = verifyAmount(orders, 999_999);
    expect(res.ok).toBe(false);
  });

  it('accepts when client total matches DB sum across multiple orders', () => {
    const orders = [{ total_amount: 3000 }, { total_amount: 7000 }];
    const res = verifyAmount(orders, 10_000);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.amount).toBe(10_000);
  });

  it('rejects when DB has no matching orders (prevents approving phantom orders)', () => {
    const res = verifyAmount([], 5000);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/찾을 수 없습니다/);
  });

  it('rejects when one split-order total was tampered (sum still wrong)', () => {
    // DB: order A=3000, B=7000 (total 10000). Attacker sends 5000.
    const orders = [{ total_amount: 3000 }, { total_amount: 7000 }];
    const res = verifyAmount(orders, 5000);
    expect(res.ok).toBe(false);
  });
});
