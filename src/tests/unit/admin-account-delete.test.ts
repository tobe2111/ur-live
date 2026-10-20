/**
 * 🛡️ 2026-07-05 (대표 신고 — /admin/accounts 계정 삭제가 이상적으로 안 됨 + "삭제하면 로그인 못하게 막아야"):
 *   관리자 소프트 삭제 회귀 방지.
 *
 * 검증 불변식:
 *   1. 이미 삭제된 계정 재삭제 → 멱등(already:true), UPDATE 재실행 안 함(= _deleted_ 접미사 이중부착 금지).
 *   2. 삭제 시 세션·토큰 무효화 — auth_refresh_tokens DELETE + dashboard_sessions bump(startDashboardSession).
 *   3. 활성 계정 정상 삭제 → is_active=0/status='deleted' UPDATE 1회.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const mockExecuteQuery = vi.hoisted(() => vi.fn());
const mockExecuteRun = vi.hoisted(() => vi.fn(() => Promise.resolve({ meta: { changes: 1 } })));
const mockWriteAuditLog = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const mockStartDashboardSession = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('@/worker/utils/database', () => ({ executeQuery: mockExecuteQuery, executeRun: mockExecuteRun }));
vi.mock('@/worker/middleware/admin-security', () => ({ writeAuditLog: mockWriteAuditLog }));
vi.mock('@/worker/utils/dashboard-session', () => ({ startDashboardSession: mockStartDashboardSession }));
vi.mock('@/worker/utils/ensure-admins-role', () => ({ ensureAdminsRoleUnconstrained: vi.fn(() => Promise.resolve()) }));
vi.mock('@/lib/password', () => ({ hashPassword: vi.fn(async () => 'h'), validatePasswordComplexity: () => ({ ok: true }) }));
vi.mock('@/worker/middleware/rate-limit', () => ({ rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));

import { adminAccountsRoutes } from '@/features/admin/api/admin-accounts.routes';

// executeRun(DB, sql, params) — sql 은 2번째 인자. mock.calls 를 캐스팅해 인덱싱.
function runSqls(): string[] {
  return (mockExecuteRun.mock.calls as unknown as unknown[][]).map((call) => String(call[1] ?? ''));
}

// currentAdmin role 조회는 raw D1 (DB.prepare('SELECT role...').first) — super_admin 반환.
function makeDB() {
  return {
    prepare: (_sql: string) => ({
      bind: (..._a: unknown[]) => ({
        first: () => Promise.resolve({ role: 'super_admin' }),
        run: () => Promise.resolve({ meta: { changes: 1 } }),
        all: () => Promise.resolve({ results: [] }),
      }),
      first: () => Promise.resolve({ role: 'super_admin' }),
      run: () => Promise.resolve({ meta: { changes: 1 } }),
    }),
  } as unknown as D1Database;
}
const ENV = { DB: makeDB(), JWT_SECRET: 'test', ENVIRONMENT: 'test' };

function makeApp() {
  const app = new Hono<{ Bindings: typeof ENV }>();
  app.use('*', async (c, next) => { (c as unknown as { set: (k: string, v: unknown) => void }).set('user', { id: '1', role: 'super_admin' }); await next(); });
  app.route('/', adminAccountsRoutes);
  return app;
}
function del(id: string) {
  return new Request(`http://test.local/admins/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  mockExecuteQuery.mockReset();
  mockExecuteRun.mockReset().mockResolvedValue({ meta: { changes: 1 } });
  mockWriteAuditLog.mockReset().mockResolvedValue(undefined);
  mockStartDashboardSession.mockReset().mockResolvedValue(undefined);
});

describe('DELETE /admins/:id — 소프트 삭제', () => {
  it('🔒 이미 삭제된 계정 재삭제 → 멱등(already), UPDATE 재실행 안 함 (이중 _deleted_ 금지)', async () => {
    mockExecuteQuery.mockResolvedValueOnce([
      { id: 2, username: 'u_deleted_1', email: 'x@x.com_deleted_1', name: '길동', role: 'admin', is_active: 0, status: 'deleted' },
    ]);
    const res = await makeApp().request(del('2'), {}, ENV);
    const body = await res.json() as { success: boolean; already?: boolean };
    expect(res.status).toBe(200);
    expect(body.already).toBe(true);
    const ranUpdate = runSqls().some((sql) => sql.includes('UPDATE admins SET') && sql.includes('_deleted_'));
    expect(ranUpdate).toBe(false);
  });

  it('🔒 활성 계정 삭제 → soft delete UPDATE + 세션/토큰 무효화', async () => {
    mockExecuteQuery.mockResolvedValueOnce([
      { id: 3, username: 'bob', email: 'bob@x.com', name: 'Bob', role: 'admin', is_active: 1, status: 'active' },
    ]);
    const res = await makeApp().request(del('3'), {}, ENV);
    const body = await res.json() as { success: boolean };
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    const sqls = runSqls();
    expect(sqls.some((sql) => sql.includes('is_active = 0') && sql.includes("status = 'deleted'"))).toBe(true);
    expect(sqls.some((sql) => sql.includes('DELETE FROM auth_refresh_tokens'))).toBe(true);
    expect(mockStartDashboardSession).toHaveBeenCalledWith(expect.anything(), 'admin', 3, expect.any(Number));
  });

  it('🔒 활성 계정 삭제 시 email/username 접미사는 각 1회만 (기존 _deleted_ 없을 때)', async () => {
    mockExecuteQuery.mockResolvedValueOnce([
      { id: 4, username: 'carol', email: 'carol@x.com', name: 'Carol', role: 'admin', is_active: 1, status: 'active' },
    ]);
    await makeApp().request(del('4'), {}, ENV);
    const updateSql = runSqls().find((sql) => sql.includes('is_active = 0'));
    expect(updateSql).toBeDefined();
    expect((updateSql!.match(/_deleted_/g) || []).length).toBe(2);
  });
});
