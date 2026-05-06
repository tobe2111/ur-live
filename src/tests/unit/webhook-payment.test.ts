/**
 * Webhook Payment — HTTP-level route tests
 *
 * Targets: POST /api/toss/webhook  (src/worker/routes/webhook.routes.ts)
 *
 * Strategy: mount the real Hono router, stub OrderRepository +
 * WebhookEventRepository + fetch + env so we never touch D1 or Toss APIs.
 *
 * Tests exercised (감사 보고서 🔴 우선순위):
 *  1. Signature verification failure → 401 (TOSS_WEBHOOK_SECRET 있을 때)
 *  2. Duplicate event (idempotency) → 200, status='duplicate_skipped'
 *  3. PAYMENT_STATUS_CHANGED + DONE → order status PAID/DONE 업데이트
 *  4. payment.cancelled → order status CANCELLED
 *  5. Already DONE order → idempotent (200, no re-processing)
 *
 * Key insight: when TOSS_WEBHOOK_SECRET is absent AND ENVIRONMENT != 'production',
 * signature/timestamp verification is SKIPPED → simplifies test setup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// ── Vitest hoisting: mock fns must be vi.hoisted() ────────────────────────────
const {
  mockIsAlreadyProcessed,
  mockRecord,
  mockMarkProcessed,
  mockMarkSkipped,
  mockMarkFailed,
  mockWebhookIsAlreadyProcessed,
  mockFindByOrderNumber,
  mockUpdateStatus,
  mockRestoreStock,
  mockConfirmPaymentAtomic,
  mockOrderIsAlreadyProcessed,
} = vi.hoisted(() => ({
  mockIsAlreadyProcessed: vi.fn(),
  mockRecord: vi.fn(),
  mockMarkProcessed: vi.fn(),
  mockMarkSkipped: vi.fn(),
  mockMarkFailed: vi.fn(),
  mockWebhookIsAlreadyProcessed: vi.fn(),
  mockFindByOrderNumber: vi.fn(),
  mockUpdateStatus: vi.fn(),
  mockRestoreStock: vi.fn(),
  mockConfirmPaymentAtomic: vi.fn(),
  mockOrderIsAlreadyProcessed: vi.fn(),
}));

// ── OrderRepository mock ──────────────────────────────────────────────────────
vi.mock('../../worker/repositories/order.repository', () => ({
  OrderRepository: vi.fn().mockImplementation(() => ({
    findByOrderNumber: mockFindByOrderNumber,
    updateStatus: mockUpdateStatus,
    restoreStock: mockRestoreStock,
    confirmPaymentAtomic: mockConfirmPaymentAtomic,
    isAlreadyProcessed: mockOrderIsAlreadyProcessed,
  })),
}));

// ── WebhookEventRepository mock ───────────────────────────────────────────────
vi.mock('../../worker/repositories/webhook.repository', () => ({
  WebhookEventRepository: vi.fn().mockImplementation(() => ({
    isAlreadyProcessed: mockWebhookIsAlreadyProcessed,
    record: mockRecord,
    markProcessed: mockMarkProcessed,
    markSkipped: mockMarkSkipped,
    markFailed: mockMarkFailed,
  })),
}));

// ── Silence side-effects ──────────────────────────────────────────────────────
vi.mock('@/worker/utils/swallow', () => ({ swallow: () => () => {} }));
vi.mock('@/worker/utils/alerts', () => ({ sendAlert: vi.fn(() => Promise.resolve()) }));
vi.mock('@/worker/utils/sentry', () => ({ captureException: vi.fn(() => Promise.resolve()) }));
vi.mock('@/features/notifications/api/dashboard-notifications.routes', () => ({
  createDashboardNotification: vi.fn(() => Promise.resolve()),
}));
// Dynamic import of coupons.routes used in handlePaymentCancelled
vi.mock('../../features/coupons/api/coupons.routes', () => ({
  restoreCouponsForOrders: vi.fn(() => Promise.resolve(0)),
}));

// ── Import router AFTER mocks are in place ────────────────────────────────────
import { webhookRouter } from '@/worker/routes/webhook.routes';

// ── App factory ───────────────────────────────────────────────────────────────
function buildApp() {
  const app = new Hono<{ Bindings: Record<string, unknown> }>();
  app.route('/api/toss/webhook', webhookRouter);
  return app;
}

// Minimal D1-like stub (never actually called — repositories are mocked)
const fakeDB = {
  prepare: () => ({
    bind: () => ({
      first: () => Promise.resolve(null),
      all: () => Promise.resolve({ results: [] }),
      run: () => Promise.resolve({ meta: { changes: 0 } }),
    }),
  }),
  batch: () => Promise.resolve([]),
} as unknown as D1Database;

function makeEnv(extra: Record<string, unknown> = {}) {
  return {
    DB: fakeDB,
    ENVIRONMENT: 'development',   // non-production → sig verification skipped by default
    // TOSS_WEBHOOK_SECRET intentionally absent unless overridden
    ...extra,
  };
}

// ── Payload helpers ───────────────────────────────────────────────────────────
function makeTossPayload(overrides: Record<string, unknown> = {}) {
  return {
    eventType: 'payment.confirmed',
    data: {
      orderId: 'ORD-TEST-001',
      paymentKey: 'toss_pk_test_001',
      status: 'DONE',
      totalAmount: 10000,
      method: 'CARD',
      approvedAt: '2026-05-06T10:00:00',
      ...((overrides.data as Record<string, unknown>) ?? {}),
    },
    ...overrides,
  }
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    order_number: 'ORD-TEST-001',
    user_id: '42',
    total_amount: 10000,
    status: 'PENDING',
    seller_id: 5,
    shipping_name: '홍길동',
    shipping_phone: '01012345678',
    shipping_address: '{}',
    ...overrides,
  };
}

// ── Request helper ────────────────────────────────────────────────────────────
async function postWebhook(
  app: Hono<{ Bindings: Record<string, unknown> }>,
  env: Record<string, unknown>,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return app.request(
    '/api/toss/webhook',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    },
    env,
  );
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe('POST /api/toss/webhook — signature verification', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('TOSS_WEBHOOK_SECRET 설정 + 잘못된 서명 → 401', async () => {
    const app = buildApp();
    const env = makeEnv({ TOSS_WEBHOOK_SECRET: 'real-secret-key' });
    const res = await postWebhook(
      app, env,
      makeTossPayload(),
      { 'Toss-Signature': 'v1=bad_signature_hex' },
    );
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('invalid_signature');
  });

  it('TOSS_WEBHOOK_SECRET 없음 (dev) → 서명 검증 스킵, 처리 진행', async () => {
    // Without secret, signature check is skipped
    mockWebhookIsAlreadyProcessed.mockResolvedValue(false);
    mockRecord.mockResolvedValue('evt-123');
    mockMarkProcessed.mockResolvedValue(undefined);
    // payment.confirmed: check idempotency + confirmPaymentAtomic
    mockOrderIsAlreadyProcessed
      .mockResolvedValueOnce(false) // isAlreadyProcessed('DONE')
      .mockResolvedValueOnce(false); // isAlreadyProcessed('PAID')
    mockConfirmPaymentAtomic.mockResolvedValue({ confirmed: 1 });
    // DB.prepare for digital items (returns empty)
    const app = buildApp();
    const env = makeEnv(); // no TOSS_WEBHOOK_SECRET
    const res = await postWebhook(app, env, makeTossPayload());
    expect(res.status).toBe(200);
    const json = await res.json() as { received: boolean; status: string };
    expect(json.received).toBe(true);
    expect(json.status).toBe('processed');
  });
});

describe('POST /api/toss/webhook — idempotency (중복 이벤트)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('이미 processed인 eventKey → 200, status=duplicate_skipped', async () => {
    mockWebhookIsAlreadyProcessed.mockResolvedValue(true); // already processed
    const app = buildApp();
    const res = await postWebhook(app, makeEnv(), makeTossPayload());
    expect(res.status).toBe(200);
    const json = await res.json() as { received: boolean; status: string };
    expect(json.received).toBe(true);
    expect(json.status).toBe('duplicate_skipped');
    // Confirm DB record was NOT created for the duplicate
    expect(mockRecord).not.toHaveBeenCalled();
  });
});

describe('POST /api/toss/webhook — payment.confirmed → PAID', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('payment.confirmed + DONE status → confirmPaymentAtomic 호출', async () => {
    mockWebhookIsAlreadyProcessed.mockResolvedValue(false);
    mockRecord.mockResolvedValue('evt-456');
    mockMarkProcessed.mockResolvedValue(undefined);
    mockOrderIsAlreadyProcessed
      .mockResolvedValueOnce(false) // not already DONE
      .mockResolvedValueOnce(false); // not already PAID
    mockConfirmPaymentAtomic.mockResolvedValue({ confirmed: 1 });

    const app = buildApp();
    const res = await postWebhook(app, makeEnv(), makeTossPayload({
      eventType: 'payment.confirmed',
      data: { orderId: 'ORD-TEST-001', paymentKey: 'toss_pk_001', status: 'DONE', totalAmount: 10000, method: 'CARD', approvedAt: '2026-05-06T10:00:00' },
    }));

    expect(res.status).toBe(200);
    const json = await res.json() as { received: boolean; status: string };
    expect(json.received).toBe(true);
    expect(json.status).toBe('processed');

    // confirmPaymentAtomic should have been called with order number + payment data
    expect(mockConfirmPaymentAtomic).toHaveBeenCalledWith(
      'ORD-TEST-001',
      expect.objectContaining({
        toss_payment_key: 'toss_pk_001',
        payment_method: 'CARD',
      }),
    );
    // Event must be marked processed
    expect(mockMarkProcessed).toHaveBeenCalledWith('evt-456');
  });
});

describe('POST /api/toss/webhook — payment.cancelled → CANCELLED', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('payment.cancelled → updateStatus CANCELLED + stock restore', async () => {
    const order = makeOrder({ status: 'PENDING' });
    mockWebhookIsAlreadyProcessed.mockResolvedValue(false);
    mockRecord.mockResolvedValue('evt-789');
    mockMarkProcessed.mockResolvedValue(undefined);
    mockFindByOrderNumber.mockResolvedValue([order]);
    mockRestoreStock.mockResolvedValue(undefined);

    // fakeDB.prepare for the CAS UPDATE must return changes > 0
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun, all: vi.fn().mockResolvedValue({ results: [] }) });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const envWithDB = makeEnv({ DB: { ...fakeDB, prepare: mockPrepare } as unknown as D1Database });

    const app = buildApp();
    const res = await postWebhook(app, envWithDB, makeTossPayload({
      eventType: 'payment.cancelled',
      data: { orderId: 'ORD-TEST-001', paymentKey: 'toss_pk_001', status: 'CANCELLED', totalAmount: 10000, failureMessage: 'User cancelled' },
    }));

    expect(res.status).toBe(200);
    const json = await res.json() as { received: boolean; status: string };
    expect(json.received).toBe(true);
    expect(json.status).toBe('processed');
    // restoreStock called for the cancelled order
    expect(mockRestoreStock).toHaveBeenCalledWith(order.id);
  });
});

describe('POST /api/toss/webhook — 이미 DONE인 주문 (멱등 처리)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('이미 DONE 상태 주문 → confirmPaymentAtomic 스킵 (200 반환)', async () => {
    mockWebhookIsAlreadyProcessed.mockResolvedValue(false);
    mockRecord.mockResolvedValue('evt-idm');
    mockMarkProcessed.mockResolvedValue(undefined);
    // isAlreadyProcessed returns true for DONE
    mockOrderIsAlreadyProcessed
      .mockResolvedValueOnce(true); // already DONE → early return

    const app = buildApp();
    const res = await postWebhook(app, makeEnv(), makeTossPayload({ eventType: 'payment.confirmed' }));

    expect(res.status).toBe(200);
    const json = await res.json() as { received: boolean; status: string };
    expect(json.received).toBe(true);
    // confirmPaymentAtomic should NOT have been called (already done)
    expect(mockConfirmPaymentAtomic).not.toHaveBeenCalled();
  });
});
