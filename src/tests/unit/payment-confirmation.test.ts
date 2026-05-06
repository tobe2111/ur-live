/**
 * Payment Confirmation — HTTP-level route tests
 *
 * Targets: POST /api/payments/confirm  (src/worker/routes/payment.routes.ts)
 *
 * Strategy: mount the real Hono router, stub OrderRepository + fetch + env
 * so we never touch D1 or Toss APIs.  The tests verify the HTTP status codes
 * produced by each guard in the confirm handler.
 *
 * Guards exercised:
 *  1. Missing / invalid body fields           → 400
 *  2. Order not found in DB                   → 404
 *  3. Already DONE order (idempotency)        → 200 (success shortcut)
 *  4. Cancelled/refunded order                → 409
 *  5. User ownership mismatch (IDOR guard)    → 403
 *  6. Amount mismatch (tamper guard)          → 400
 *  7. Missing TOSS_SECRET_KEY config          → 500
 *  8. Toss circuit breaker open               → 503
 *  9. Toss returns ALREADY_PROCESSED_PAYMENT  → 200 (idempotent confirm)
 * 10. Successful confirm (happy path)         → 200
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import * as jwt from '@tsndr/cloudflare-worker-jwt';

// ── Vitest hoisting: shared mock fns must be created via vi.hoisted() ────────
// vi.mock() factories are hoisted above imports; regular `const` are not.
const { mockFindByOrderNumber, mockUpdateStatus, mockReduceStock } = vi.hoisted(() => ({
  mockFindByOrderNumber: vi.fn(),
  mockUpdateStatus: vi.fn(),
  mockReduceStock: vi.fn(),
}));

// ── OrderRepository mock ─────────────────────────────────────────────────────
// The payment route does: import { OrderRepository } from '../repositories/order.repository'
// Resolved from the test file's perspective: ../../worker/repositories/order.repository
vi.mock('../../worker/repositories/order.repository', () => ({
  OrderRepository: vi.fn().mockImplementation(() => ({
    findByOrderNumber: mockFindByOrderNumber,
    updateStatus: mockUpdateStatus,
    reduceStock: mockReduceStock,
  })),
}));

// ── Silence non-critical side-effects ───────────────────────────────────────
vi.mock('@/worker/utils/sentry', () => ({ captureException: vi.fn(() => Promise.resolve()) }));
vi.mock('@/worker/utils/alerts', () => ({ sendAlert: vi.fn(() => Promise.resolve()) }));
vi.mock('@/worker/utils/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));
vi.mock('@/features/alimtalk/send', () => ({ sendSellerAlimtalk: vi.fn(() => Promise.resolve()) }));
vi.mock('@/features/alimtalk/aligo', () => ({ buildOrderConfirmMessage: vi.fn(() => ({ subject: '', message: '' })) }));
vi.mock('@/worker/utils/swallow', () => ({ swallow: () => () => {} }));

// ── withCircuitBreaker: indirection via a mutable ref so tests can override ──
const circuitBreakerRef = vi.hoisted(() => ({
  impl: (fn: () => Promise<Response>) => fn(),
}));
vi.mock('@/worker/utils/circuit-breaker', () => ({
  withCircuitBreaker: vi.fn((_opts: unknown, fn: () => Promise<Response>) => circuitBreakerRef.impl(fn)),
}));

// ── Import route AFTER mocks are in place ───────────────────────────────────
import { paymentsRouter } from '@/worker/routes/payment.routes';

// ── JWT helpers ──────────────────────────────────────────────────────────────
const JWT_SECRET = 'test-secret-payment-confirmation';

async function signUserJwt(userId: string | number) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iat: now, exp: now + 3600, userId: String(userId), email: 'u@test.com', type: 'user' },
    JWT_SECRET,
  );
}

// ── App factory ─────────────────────────────────────────────────────────────
function buildApp() {
  const app = new Hono<{ Bindings: Record<string, unknown> }>();
  app.route('/api/payments', paymentsRouter);
  return app;
}

// Minimal D1-like stub (never called because OrderRepository is mocked)
const fakeDB = {
  prepare: () => ({ bind: () => ({ first: () => Promise.resolve(null) }) }),
} as unknown as D1Database;

function makeEnv(extra: Record<string, unknown> = {}) {
  return {
    DB: fakeDB,
    JWT_SECRET,
    FIREBASE_PROJECT_ID: 'test-project',
    TOSS_SECRET_KEY: 'test_toss_secret',
    ...extra,
  };
}

// ── Sample order rows ────────────────────────────────────────────────────────
function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    order_number: 'ORD-2026-001',
    user_id: '42',
    total_amount: 10000,
    status: 'PENDING',
    seller_id: 5,
    shipping_name: '홍길동',
    shipping_phone: '01012345678',
    items: [{ product_name: '테스트상품', unit_price: 10000, quantity: 1 }],
    ...overrides,
  };
}

// ── Request helper ───────────────────────────────────────────────────────────
async function postConfirm(
  app: Hono<{ Bindings: Record<string, unknown> }>,
  env: Record<string, unknown>,
  body: Record<string, unknown>,
  token?: string,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return app.request(
    '/api/payments/confirm',
    { method: 'POST', headers, body: JSON.stringify(body) },
    env,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('POST /api/payments/confirm — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    circuitBreakerRef.impl = (fn) => fn();
  });

  it('missing Authorization header → 401', async () => {
    const app = buildApp();
    const res = await app.request(
      '/api/payments/confirm',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      makeEnv(),
    );
    expect(res.status).toBe(401);
  });

  it('missing paymentKey → 400', async () => {
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(app, makeEnv(), { orderId: 'ORD-2026-001', amount: 10000 }, token);
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it('missing orderId → 400', async () => {
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(app, makeEnv(), { paymentKey: 'pk_test', amount: 10000 }, token);
    expect(res.status).toBe(400);
  });

  it('orderId too short (< 6 chars) → 400', async () => {
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(app, makeEnv(), { paymentKey: 'pk_test', orderId: 'ORD', amount: 10000 }, token);
    expect(res.status).toBe(400);
  });

  it('amount = 0 (not positive) → 400', async () => {
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(app, makeEnv(), { paymentKey: 'pk_test', orderId: 'ORD-2026-001', amount: 0 }, token);
    expect(res.status).toBe(400);
  });

  it('amount is a float (not integer) → 400', async () => {
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(app, makeEnv(), { paymentKey: 'pk_test', orderId: 'ORD-2026-001', amount: 99.5 }, token);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/payments/confirm — order lookup guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    circuitBreakerRef.impl = (fn) => fn();
  });

  it('order not found → 404', async () => {
    mockFindByOrderNumber.mockResolvedValue([]);
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(
      app, makeEnv(),
      { paymentKey: 'pk_test_001', orderId: 'ORD-2026-999', amount: 10000 },
      token,
    );
    expect(res.status).toBe(404);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it('all orders already DONE → 200 shortcut (idempotency — no double confirm)', async () => {
    mockFindByOrderNumber.mockResolvedValue([makeOrder({ status: 'DONE' })]);
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(
      app, makeEnv(),
      { paymentKey: 'pk_test_001', orderId: 'ORD-2026-001', amount: 10000 },
      token,
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('order with status PAID → 200 shortcut (idempotency)', async () => {
    mockFindByOrderNumber.mockResolvedValue([makeOrder({ status: 'PAID' })]);
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(
      app, makeEnv(),
      { paymentKey: 'pk_test_001', orderId: 'ORD-2026-001', amount: 10000 },
      token,
    );
    expect(res.status).toBe(200);
  });

  it('order with status CANCELLED → 409 (cannot re-confirm cancelled order)', async () => {
    mockFindByOrderNumber.mockResolvedValue([makeOrder({ status: 'CANCELLED' })]);
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(
      app, makeEnv(),
      { paymentKey: 'pk_test_001', orderId: 'ORD-2026-001', amount: 10000 },
      token,
    );
    expect(res.status).toBe(409);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it('order with status REFUNDED → 409', async () => {
    mockFindByOrderNumber.mockResolvedValue([makeOrder({ status: 'REFUNDED' })]);
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(
      app, makeEnv(),
      { paymentKey: 'pk_test_001', orderId: 'ORD-2026-001', amount: 10000 },
      token,
    );
    expect(res.status).toBe(409);
  });
});

describe('POST /api/payments/confirm — security guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    circuitBreakerRef.impl = (fn) => fn();
  });

  it('user ownership mismatch → 403 (IDOR prevention)', async () => {
    // Order belongs to user 99, but attacker authenticates as user 42
    mockFindByOrderNumber.mockResolvedValue([makeOrder({ user_id: '99' })]);
    const app = buildApp();
    const attackerToken = await signUserJwt('42');
    const res = await postConfirm(
      app, makeEnv(),
      { paymentKey: 'pk_test_001', orderId: 'ORD-2026-001', amount: 10000 },
      attackerToken,
    );
    expect(res.status).toBe(403);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/[Ff]orbidden/);
  });

  it('user mismatch is checked before amount mismatch (guards order)', async () => {
    // Both user wrong AND amount wrong — should return 403 (user check first)
    mockFindByOrderNumber.mockResolvedValue([makeOrder({ user_id: '99', total_amount: 10000 })]);
    const app = buildApp();
    const attackerToken = await signUserJwt('42');
    const res = await postConfirm(
      app, makeEnv(),
      { paymentKey: 'pk_test_001', orderId: 'ORD-2026-001', amount: 1 },
      attackerToken,
    );
    expect(res.status).toBe(403);
  });

  it('amount tampered down → 400 (amount mismatch guard)', async () => {
    mockFindByOrderNumber.mockResolvedValue([makeOrder({ user_id: '42', total_amount: 10000 })]);
    const app = buildApp();
    const token = await signUserJwt('42');
    // Client sends 100 instead of 10000 — classic payment manipulation
    const res = await postConfirm(
      app, makeEnv(),
      { paymentKey: 'pk_test_001', orderId: 'ORD-2026-001', amount: 100 },
      token,
    );
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it('amount tampered up → 400', async () => {
    mockFindByOrderNumber.mockResolvedValue([makeOrder({ user_id: '42', total_amount: 10000 })]);
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(
      app, makeEnv(),
      { paymentKey: 'pk_test_001', orderId: 'ORD-2026-001', amount: 9_999_999 },
      token,
    );
    expect(res.status).toBe(400);
  });

  it('multi-order: one order belongs to different user → 403', async () => {
    mockFindByOrderNumber.mockResolvedValue([
      makeOrder({ id: 1, user_id: '42', total_amount: 5000 }),
      makeOrder({ id: 2, user_id: '99', total_amount: 5000 }), // hijacked order
    ]);
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(
      app, makeEnv(),
      { paymentKey: 'pk_test_001', orderId: 'ORD-2026-001', amount: 10000 },
      token,
    );
    expect(res.status).toBe(403);
  });
});

describe('POST /api/payments/confirm — Toss API integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    circuitBreakerRef.impl = (fn) => fn();
    mockUpdateStatus.mockResolvedValue(undefined);
    mockReduceStock.mockResolvedValue(undefined);
  });

  it('missing TOSS_SECRET_KEY → 500', async () => {
    mockFindByOrderNumber.mockResolvedValue([makeOrder()]);
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(
      app, makeEnv({ TOSS_SECRET_KEY: undefined }),
      { paymentKey: 'pk_test_001', orderId: 'ORD-2026-001', amount: 10000 },
      token,
    );
    expect(res.status).toBe(500);
  });

  it('circuit breaker throws → 503 with CIRCUIT_OPEN code', async () => {
    mockFindByOrderNumber.mockResolvedValue([makeOrder()]);
    // Make the circuit breaker throw (simulating open circuit)
    circuitBreakerRef.impl = () => { throw new Error('Circuit open'); };
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(
      app, makeEnv(),
      { paymentKey: 'pk_test_001', orderId: 'ORD-2026-001', amount: 10000 },
      token,
    );
    expect(res.status).toBe(503);
    const json = await res.json() as { code: string };
    expect(json.code).toBe('CIRCUIT_OPEN');
  });

  it('Toss returns ALREADY_PROCESSED_PAYMENT → 200 (idempotent)', async () => {
    mockFindByOrderNumber
      .mockResolvedValueOnce([makeOrder()])
      .mockResolvedValue([makeOrder({ status: 'DONE' })]);
    mockUpdateStatus.mockResolvedValue(undefined);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'ALREADY_PROCESSED_PAYMENT', message: 'Already processed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(
      app, makeEnv(),
      { paymentKey: 'pk_test_001', orderId: 'ORD-2026-001', amount: 10000 },
      token,
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('Toss returns generic error → 400 with user-friendly message', async () => {
    mockFindByOrderNumber.mockResolvedValue([makeOrder()]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'REJECT_CARD_COMPANY', message: 'Card rejected' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(
      app, makeEnv(),
      { paymentKey: 'pk_test_001', orderId: 'ORD-2026-001', amount: 10000 },
      token,
    );
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean; error: string; code: string };
    expect(json.success).toBe(false);
    // Should have a user-friendly Korean message, not raw code
    expect(json.error).toMatch(/카드사/);
    expect(json.code).toBe('REJECT_CARD_COMPANY');
  });

  it('happy path: valid confirm → 200, Toss called with DB amount (not client amount)', async () => {
    const orders = [makeOrder({ user_id: '42', total_amount: 10000 })];
    mockFindByOrderNumber.mockResolvedValue(orders);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          paymentKey: 'pk_test_001',
          orderId: 'ORD-2026-001',
          totalAmount: 10000,
          method: 'CARD',
          approvedAt: '2026-05-06T10:00:00',
          status: 'DONE',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const app = buildApp();
    const token = await signUserJwt('42');
    const res = await postConfirm(
      app, makeEnv(),
      { paymentKey: 'pk_test_001', orderId: 'ORD-2026-001', amount: 10000 },
      token,
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
    // Verify the Toss API was called with the DB-verified amount
    const tossBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(tossBody.amount).toBe(10000); // matches DB, not client
    expect(tossBody.paymentKey).toBe('pk_test_001');
    // Verify stock was reduced
    expect(mockReduceStock).toHaveBeenCalledWith(orders[0].id);
  });

  it('Toss API uses Idempotency-Key = paymentKey', async () => {
    mockFindByOrderNumber.mockResolvedValue([makeOrder()]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          paymentKey: 'pk_idem_key',
          orderId: 'ORD-2026-001',
          totalAmount: 10000,
          method: 'CARD',
          approvedAt: '2026-05-06T10:00:00',
          status: 'DONE',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const app = buildApp();
    const token = await signUserJwt('42');
    await postConfirm(
      app, makeEnv(),
      { paymentKey: 'pk_idem_key', orderId: 'ORD-2026-001', amount: 10000 },
      token,
    );
    const headers = fetchSpy.mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('pk_idem_key');
  });
});
