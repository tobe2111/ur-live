/**
 * Admin Routes — HTTP-level business logic tests
 *
 * Covers:
 *   - admin-sellers.routes.ts   (commission validation, 404, pagination)
 *   - admin-settlements.routes.ts (status transitions, auth role check)
 *
 * Auth note: the routes are mounted without the adminApp auth wrapper
 * (which lives in worker/index.ts).  Business logic is tested directly.
 * For `requireAdminRole` middleware, we add a test-only auth shim.
 *
 * Strategy: mount real Hono routers, stub executeQuery/executeRun/D1 so
 * tests never touch D1.  Verify HTTP status codes + response shapes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// ── Mocks (hoisted so they're available before imports) ──────────────────────
const mockExecuteQuery = vi.hoisted(() => vi.fn());
const mockExecuteRun   = vi.hoisted(() => vi.fn());
const mockWriteAuditLog = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('@/worker/utils/database', () => ({
  executeQuery: mockExecuteQuery,
  executeRun:   mockExecuteRun,
}));
vi.mock('@/worker/middleware/admin-security', () => ({
  writeAuditLog: mockWriteAuditLog,
}));
vi.mock('@/features/notifications/api/dashboard-notifications.routes', () => ({
  createDashboardNotification: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/worker/utils/swallow', () => ({ swallow: () => () => {} }));
vi.mock('../../../lib/system-alimtalk', () => ({ sendSystemAlimtalk: vi.fn(() => Promise.resolve()) }));
vi.mock('@/shared/constants', () => ({
  DEFAULT_COMMISSION_RATE: 5,
  ALLOWED_ORIGINS: ['http://localhost:3000'],
}));

// requireAdminRole is tested via settlements
vi.mock('@/worker/middleware/auth', () => ({
  requireAdminRole: (..._roles: string[]) => async (c: { req: { header: (h: string) => string | undefined }, json: (b: unknown, s?: number) => Response }, next: () => Promise<void>) => {
    const auth = c.req.header('Authorization');
    if (!auth?.startsWith('Bearer admin-ok')) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    await next();
  },
}));

// Import routes AFTER mocks
import { adminSellersRoutes } from '@/features/admin/api/admin-sellers.routes';
import { adminSettlementsRoutes } from '@/features/admin/api/admin-settlements.routes';

// ── D1 stub ──────────────────────────────────────────────────────────────────
function makeDB() {
  return {
    prepare: (sql: string) => ({
      bind: (..._args: unknown[]) => ({
        all:   () => Promise.resolve({ results: [] }),
        first: () => Promise.resolve(null),
        run:   () => Promise.resolve({ meta: { last_row_id: 1, changes: 1 } }),
      }),
      first: () => Promise.resolve(null),
    }),
  } as unknown as D1Database;
}

const ENV = { DB: makeDB(), JWT_SECRET: 'test', ENVIRONMENT: 'test' };

// ── Test Hono apps ───────────────────────────────────────────────────────────
function makeSellerApp() {
  const app = new Hono<{ Bindings: typeof ENV }>();
  app.route('/', adminSellersRoutes);
  return app;
}

function makeSettlementApp() {
  const app = new Hono<{ Bindings: typeof ENV }>();
  app.route('/', adminSettlementsRoutes);
  return app;
}

// ── Helper ───────────────────────────────────────────────────────────────────
function req(method: string, url: string, body?: unknown, headers?: Record<string, string>) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body != null) opts.body = JSON.stringify(body);
  return new Request(`http://test.local${url}`, opts);
}

// ════════════════════════════════════════════════════════════════════════════
// admin-sellers.routes.ts
// ════════════════════════════════════════════════════════════════════════════

describe('admin-sellers routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /sellers ────────────────────────────────────────────────────────

  describe('GET /sellers', () => {
    it('returns paginated seller list', async () => {
      mockExecuteQuery.mockResolvedValueOnce([
        { id: 1, email: 'seller@test.com', name: '셀러1', status: 'approved' },
      ]);
      const app = makeSellerApp();
      const db = { ...makeDB(), prepare: (sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return { first: () => Promise.resolve({ cnt: 1 }) } as any;
        }
        return makeDB().prepare(sql);
      }};
      const r = await app.fetch(req('GET', '/sellers'), { ...ENV, DB: db });
      expect(r.status).toBe(200);
      const body = await r.json() as { success: boolean; data: unknown[]; pagination: { page: number; limit: number } };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(50);
    });

    it('clamps limit to max 200', async () => {
      let capturedLimit: number | null = null;
      mockExecuteQuery.mockImplementation((_db, _sql, params) => {
        capturedLimit = params?.[0] as number;
        return Promise.resolve([]);
      });
      const app = makeSellerApp();
      const db = { ...makeDB(), prepare: () => ({ first: () => Promise.resolve({ cnt: 0 }) }) };
      await app.fetch(req('GET', '/sellers?limit=9999&page=1'), { ...ENV, DB: db });
      expect(capturedLimit).toBe(200);
    });

    it('clamps limit to min 1', async () => {
      let capturedLimit: number | null = null;
      mockExecuteQuery.mockImplementation((_db, _sql, params) => {
        capturedLimit = params?.[0] as number;
        return Promise.resolve([]);
      });
      const app = makeSellerApp();
      const db = { ...makeDB(), prepare: () => ({ first: () => Promise.resolve({ cnt: 0 }) }) };
      await app.fetch(req('GET', '/sellers?limit=0&page=1'), { ...ENV, DB: db });
      expect(capturedLimit).toBe(1);
    });
  });

  // ── PATCH /sellers/:id/commission ────────────────────────────────────────

  describe('PATCH /sellers/:id/commission', () => {
    it('rejects commission_rate above 100', async () => {
      const app = makeSellerApp();
      const r = await app.fetch(req('PATCH', '/sellers/1/commission', { commission_rate: 150 }), ENV);
      expect(r.status).toBe(400);
      const body = await r.json() as { success: boolean; error: string };
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/0~100/);
    });

    it('rejects negative commission_rate', async () => {
      const app = makeSellerApp();
      const r = await app.fetch(req('PATCH', '/sellers/1/commission', { commission_rate: -1 }), ENV);
      expect(r.status).toBe(400);
    });

    it('rejects missing commission_rate', async () => {
      const app = makeSellerApp();
      const r = await app.fetch(req('PATCH', '/sellers/1/commission', {}), ENV);
      expect(r.status).toBe(400);
    });

    it('returns 404 when seller not found', async () => {
      mockExecuteQuery.mockResolvedValueOnce([]); // no rows
      const app = makeSellerApp();
      const r = await app.fetch(req('PATCH', '/sellers/999/commission', { commission_rate: 10 }), ENV);
      expect(r.status).toBe(404);
      const body = await r.json() as { success: boolean };
      expect(body.success).toBe(false);
    });

    it('updates commission and writes audit log', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([{ id: 1, commission_rate: 5 }]) // SELECT
        .mockResolvedValueOnce([]);                              // UPDATE
      const app = makeSellerApp();
      const r = await app.fetch(req('PATCH', '/sellers/1/commission', { commission_rate: 8 }), ENV);
      expect(r.status).toBe(200);
      const body = await r.json() as { success: boolean; data: { commission_rate: number } };
      expect(body.success).toBe(true);
      expect(body.data.commission_rate).toBe(8);
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'change_commission' }),
      );
    });

    it('allows commission_rate of 0', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([{ id: 1, commission_rate: 5 }])
        .mockResolvedValueOnce([]);
      const app = makeSellerApp();
      const r = await app.fetch(req('PATCH', '/sellers/1/commission', { commission_rate: 0 }), ENV);
      expect(r.status).toBe(200);
    });

    it('allows commission_rate of 100', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([{ id: 1, commission_rate: 5 }])
        .mockResolvedValueOnce([]);
      const app = makeSellerApp();
      const r = await app.fetch(req('PATCH', '/sellers/1/commission', { commission_rate: 100 }), ENV);
      expect(r.status).toBe(200);
    });
  });

  // ── PATCH /sellers/:id/approve ───────────────────────────────────────────

  describe('PATCH /sellers/:id/approve', () => {
    it('returns 404 for non-existent seller', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([])  // SELECT (not found)
      const app = makeSellerApp();
      const r = await app.fetch(req('PATCH', '/sellers/999/approve', {}), ENV);
      expect(r.status).toBe(404);
    });

    it('approves an existing seller', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([{ id: 1, status: 'pending', email: 'seller@test.com', name: '셀러' }])
        .mockResolvedValueOnce([]); // UPDATE
      const app = makeSellerApp();
      const r = await app.fetch(req('PATCH', '/sellers/1/approve', {}), ENV);
      expect(r.status).toBe(200);
      const body = await r.json() as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  // ── PATCH /sellers/:id/reject ────────────────────────────────────────────

  describe('PATCH /sellers/:id/reject', () => {
    it('returns 404 for non-existent seller', async () => {
      mockExecuteQuery.mockResolvedValueOnce([]);
      const app = makeSellerApp();
      const r = await app.fetch(req('PATCH', '/sellers/999/reject', {}), ENV);
      expect(r.status).toBe(404);
    });
  });

  // ── PATCH /sellers/:id/permissions ──────────────────────────────────────

  describe('PATCH /sellers/:id/permissions', () => {
    it('rejects invalid can_manipulate_stats value', async () => {
      const app = makeSellerApp();
      const r = await app.fetch(req('PATCH', '/sellers/1/permissions', { can_manipulate_stats: 'yes' }), ENV);
      expect(r.status).toBe(400);
    });

    it('accepts boolean true', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([]);
      const app = makeSellerApp();
      const r = await app.fetch(req('PATCH', '/sellers/1/permissions', { can_manipulate_stats: true }), ENV);
      expect(r.status).toBe(200);
    });

    it('accepts 0/1 integers', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([]);
      const app = makeSellerApp();
      const r = await app.fetch(req('PATCH', '/sellers/1/permissions', { can_manipulate_stats: 0 }), ENV);
      expect(r.status).toBe(200);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// admin-settlements.routes.ts
// ════════════════════════════════════════════════════════════════════════════

describe('admin-settlements routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── requireAdminRole middleware ──────────────────────────────────────────

  describe('requireAdminRole middleware (PATCH /settlement/:id/status)', () => {
    it('returns 403 without Authorization header', async () => {
      const app = makeSettlementApp();
      const r = await app.fetch(req('PATCH', '/settlement/1/status', { status: 'paid' }), ENV);
      expect(r.status).toBe(403);
    });

    it('returns 403 with wrong token', async () => {
      const app = makeSettlementApp();
      const r = await app.fetch(
        req('PATCH', '/settlement/1/status', { status: 'paid' }, { Authorization: 'Bearer wrong' }),
        ENV,
      );
      expect(r.status).toBe(403);
    });

    it('passes through with admin token (status=completed)', async () => {
      mockExecuteRun.mockResolvedValueOnce({ meta: { changes: 1 } });
      const app = makeSettlementApp();
      const r = await app.fetch(
        req('PATCH', '/settlement/1/status', { status: 'completed' }, { Authorization: 'Bearer admin-ok' }),
        ENV,
      );
      expect(r.status).toBe(200);
    });

    it('POST /settlement/batch-complete requires admin token', async () => {
      const app = makeSettlementApp();
      const r = await app.fetch(req('POST', '/settlement/batch-complete', { ids: [1, 2] }), ENV);
      expect(r.status).toBe(403);
    });

    it('POST /settlement/execute requires admin token', async () => {
      const app = makeSettlementApp();
      const r = await app.fetch(req('POST', '/settlement/execute', {}), ENV);
      expect(r.status).toBe(403);
    });
  });

  // ── GET /settlement/stats (public within adminApp — no requireAdminRole) ──

  describe('GET /settlement/stats', () => {
    it('returns stats structure', async () => {
      mockExecuteQuery.mockResolvedValueOnce([{
        total_orders: 10,
        total_sales: 100000,
        total_commission: 5000,
        total_seller_amount: 95000,
      }]);
      const app = makeSettlementApp();
      const r = await app.fetch(req('GET', '/settlement/stats'), ENV);
      expect(r.status).toBe(200);
      const body = await r.json() as { success: boolean; data: Record<string, unknown> };
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });
  });

  // ── PATCH /settlement/:id/status ────────────────────────────────────────

  describe('PATCH /settlement/:id/status (with admin token)', () => {
    const adminHeaders = { Authorization: 'Bearer admin-ok' };

    it('rejects invalid status value', async () => {
      const app = makeSettlementApp();
      const r = await app.fetch(
        req('PATCH', '/settlement/1/status', { status: 'paid' }, adminHeaders),
        ENV,
      );
      // 'paid' is not a valid status (only 'pending'/'completed')
      expect(r.status).toBe(400);
    });

    it('updates settlement to completed', async () => {
      mockExecuteRun.mockResolvedValueOnce({ meta: { changes: 1 } });
      const app = makeSettlementApp();
      const r = await app.fetch(
        req('PATCH', '/settlement/1/status', { status: 'completed' }, adminHeaders),
        ENV,
      );
      expect(r.status).toBe(200);
      const body = await r.json() as { success: boolean; data: { settlement_status: string } };
      expect(body.success).toBe(true);
      expect(body.data.settlement_status).toBe('completed');
    });

    it('updates settlement to pending', async () => {
      mockExecuteRun.mockResolvedValueOnce({ meta: { changes: 1 } });
      const app = makeSettlementApp();
      const r = await app.fetch(
        req('PATCH', '/settlement/1/status', { status: 'pending' }, adminHeaders),
        ENV,
      );
      expect(r.status).toBe(200);
    });
  });

  // ── GET /settlement/records ──────────────────────────────────────────────

  describe('GET /settlement/records', () => {
    it('returns records list', async () => {
      mockExecuteQuery.mockResolvedValue([]);
      const app = makeSettlementApp();
      const db = {
        ...makeDB(),
        prepare: (sql: string) => ({
          bind: (..._args: unknown[]) => ({
            first: () => Promise.resolve(sql.includes('COUNT') ? { total: 0 } : null),
            all: () => Promise.resolve({ results: [] }),
          }),
          first: () => Promise.resolve(null),
        }),
      } as unknown as D1Database;
      const r = await app.fetch(req('GET', '/settlement/records'), { ...ENV, DB: db });
      expect(r.status).toBe(200);
      const body = await r.json() as { success: boolean };
      expect(body.success).toBe(true);
    });
  });
});
