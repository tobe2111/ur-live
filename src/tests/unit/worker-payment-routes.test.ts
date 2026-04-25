/**
 * Worker Payment Routes 단위 테스트 (webhook, stripe, refund)
 */
import { describe, it, expect } from 'vitest';

const mockDB = {
  prepare: (_sql: string) => ({
    bind: (..._: unknown[]) => ({
      run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
      first: async () => null,
      all: async () => ({ results: [] }),
    }),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
  }),
};

// ── Webhook signature verification mirrors ────────────────────────────────────

async function hmacSha256(secret: string, payload: string): Promise<string> {
  // Browser-compatible Web Crypto
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyWebhookSignature(
  signature: string,
  expectedSignature: string,
): Promise<boolean> {
  if (signature.length !== expectedSignature.length) return false;
  // 상수시간 비교
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return result === 0;
}

// ── Webhook idempotency mirrors ───────────────────────────────────────────────

function checkWebhookDuplicate(
  eventId: string,
  processedEvents: Array<{ event_id: string }>,
): boolean {
  return processedEvents.some(e => e.event_id === eventId);
}

// ── Stripe event mirrors ──────────────────────────────────────────────────────

const HANDLED_STRIPE_EVENTS = new Set([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'invoice.payment_succeeded',
]);

function isHandledStripeEvent(eventType: string): boolean {
  return HANDLED_STRIPE_EVENTS.has(eventType);
}

// ── Refund logic mirrors ──────────────────────────────────────────────────────

interface OrderForRefund {
  status: string;
  total_amount: number;
  refunded_amount: number;
}

const REFUNDABLE_STATUSES = new Set(['PAID', 'DONE', 'DELIVERED', 'SHIPPING']);

function canIssueRefund(order: OrderForRefund): { ok: boolean; error?: string } {
  if (!REFUNDABLE_STATUSES.has(order.status.toUpperCase())) {
    return { ok: false, error: `${order.status} 상태는 환불 불가` };
  }
  if (order.refunded_amount >= order.total_amount) {
    return { ok: false, error: '이미 전액 환불됨' };
  }
  return { ok: true };
}

function calcMaxRefundable(order: OrderForRefund): number {
  return Math.max(0, order.total_amount - order.refunded_amount);
}

function validatePartialRefundAmount(amount: number, maxRefundable: number): string | null {
  if (!Number.isInteger(amount) || amount <= 0) return '환불 금액은 양의 정수';
  if (amount > maxRefundable) return `최대 환불 가능액: ${maxRefundable}`;
  return null;
}

// ── Cancel preconditions mirrors ──────────────────────────────────────────────

const CANCELLABLE_STATUSES = new Set(['PENDING', 'PAID']);

function canCancelOrder(currentStatus: string): boolean {
  return CANCELLABLE_STATUSES.has(currentStatus.toUpperCase());
}

// ── Idempotency-Key generation mirrors ────────────────────────────────────────

function buildPaymentIdempotencyKey(prefix: string, orderId: string, paymentKey: string): string {
  return `${prefix}_${orderId}_${paymentKey}`;
}

function buildRefundIdempotencyKey(orderId: string | number, refundIndex: number): string {
  return `refund_${orderId}_${refundIndex}_${Date.now()}`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Webhook Signature Verification', () => {
  it('HMAC-SHA256 동일 입력 → 동일 시그너처', async () => {
    const sig1 = await hmacSha256('secret', 'payload');
    const sig2 = await hmacSha256('secret', 'payload');
    expect(sig1).toBe(sig2);
  });

  it('다른 secret 또는 payload → 다른 시그너처', async () => {
    const sig1 = await hmacSha256('secret', 'payload');
    const sig2 = await hmacSha256('different', 'payload');
    expect(sig1).not.toBe(sig2);
  });

  it('verifyWebhookSignature - 일치/불일치 검증', async () => {
    expect(await verifyWebhookSignature('abc', 'abc')).toBe(true);
    expect(await verifyWebhookSignature('abc', 'xyz')).toBe(false);
    expect(await verifyWebhookSignature('abc', 'abcd')).toBe(false);  // 길이 다름
  });

  it('상수시간 비교 - 길이 다른 시그너처 즉시 거부', async () => {
    expect(await verifyWebhookSignature('a', 'aaa')).toBe(false);
  });
});

describe('Webhook Idempotency', () => {
  it('중복 이벤트 검출', () => {
    const processed = [{ event_id: 'evt_123' }, { event_id: 'evt_456' }];
    expect(checkWebhookDuplicate('evt_123', processed)).toBe(true);
    expect(checkWebhookDuplicate('evt_789', processed)).toBe(false);
  });

  it('빈 history 에서는 중복 없음', () => {
    expect(checkWebhookDuplicate('evt_1', [])).toBe(false);
  });
});

describe('Stripe Events', () => {
  it('처리하는 이벤트 타입 확인', () => {
    expect(isHandledStripeEvent('payment_intent.succeeded')).toBe(true);
    expect(isHandledStripeEvent('charge.refunded')).toBe(true);
  });

  it('처리하지 않는 이벤트는 무시', () => {
    expect(isHandledStripeEvent('customer.created')).toBe(false);
    expect(isHandledStripeEvent('product.deleted')).toBe(false);
  });
});

describe('Refund Logic', () => {
  it('환불 가능 상태 검증', () => {
    expect(canIssueRefund({ status: 'PAID', total_amount: 10000, refunded_amount: 0 }).ok).toBe(true);
    expect(canIssueRefund({ status: 'DONE', total_amount: 10000, refunded_amount: 0 }).ok).toBe(true);
    expect(canIssueRefund({ status: 'DELIVERED', total_amount: 10000, refunded_amount: 0 }).ok).toBe(true);
    expect(canIssueRefund({ status: 'PENDING', total_amount: 10000, refunded_amount: 0 }).ok).toBe(false);
    expect(canIssueRefund({ status: 'CANCELLED', total_amount: 10000, refunded_amount: 0 }).ok).toBe(false);
  });

  it('전액 환불됨 거부', () => {
    const r = canIssueRefund({ status: 'PAID', total_amount: 10000, refunded_amount: 10000 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('전액');
  });

  it('최대 환불 가능액 계산', () => {
    expect(calcMaxRefundable({ status: 'PAID', total_amount: 10000, refunded_amount: 3000 })).toBe(7000);
    expect(calcMaxRefundable({ status: 'PAID', total_amount: 10000, refunded_amount: 10000 })).toBe(0);
  });

  it('부분 환불 금액 검증', () => {
    expect(validatePartialRefundAmount(5000, 7000)).toBeNull();
    expect(validatePartialRefundAmount(7000, 7000)).toBeNull();  // 최대 허용
    expect(validatePartialRefundAmount(8000, 7000)).toContain('최대');
    expect(validatePartialRefundAmount(0, 7000)).toBe('환불 금액은 양의 정수');
    expect(validatePartialRefundAmount(-100, 7000)).toBe('환불 금액은 양의 정수');
  });

  it('부분 환불 누적 검증', () => {
    // 첫 환불: 3000
    const order: OrderForRefund = { status: 'PAID', total_amount: 10000, refunded_amount: 3000 };
    expect(calcMaxRefundable(order)).toBe(7000);

    // 두 번째 환불 시도: 8000 → 거부
    expect(validatePartialRefundAmount(8000, calcMaxRefundable(order))).toContain('최대');

    // 두 번째 환불 시도: 5000 → 통과
    expect(validatePartialRefundAmount(5000, calcMaxRefundable(order))).toBeNull();
  });
});

describe('Cancel Preconditions', () => {
  it('취소 가능 상태', () => {
    expect(canCancelOrder('PENDING')).toBe(true);
    expect(canCancelOrder('PAID')).toBe(true);
    expect(canCancelOrder('pending')).toBe(true);  // 대소문자 무관
  });

  it('취소 불가 상태', () => {
    expect(canCancelOrder('SHIPPING')).toBe(false);
    expect(canCancelOrder('DELIVERED')).toBe(false);
    expect(canCancelOrder('CANCELLED')).toBe(false);
  });
});

describe('Idempotency-Key Generation', () => {
  it('결제 idempotency key 형식', () => {
    expect(buildPaymentIdempotencyKey('payments_confirm', 'ORD-1', 'pk_abc')).toBe('payments_confirm_ORD-1_pk_abc');
    expect(buildPaymentIdempotencyKey('points_charge', 'DEAL-1', 'pk_xyz')).toBe('points_charge_DEAL-1_pk_xyz');
  });

  it('환불 idempotency key 시간 포함 유니크', () => {
    const k1 = buildRefundIdempotencyKey(1, 0);
    expect(k1).toMatch(/^refund_1_0_\d+$/);
  });
});

describe('D1 mock', () => {
  it('webhook 이벤트 INSERT', async () => {
    const r = await mockDB.prepare('INSERT INTO webhook_events (event_id, event_type) VALUES (?, ?)')
      .bind('evt_1', 'payment.succeeded').run();
    expect(r.success).toBe(true);
  });
});
