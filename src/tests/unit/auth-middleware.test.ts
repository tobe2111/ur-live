/**
 * Auth middleware regression tests
 *
 * Covers requireAuth / requireUserType behavior that has previously regressed:
 * - Missing Authorization header → 401
 * - Invalid JWT signature → 401
 * - JWT missing userId / sub → 401
 * - Expired JWT → 401
 * - Seller JWT passes requireSeller
 * - User JWT fails requireSeller (403)
 * - Admin-only endpoint rejects non-admin (403)
 *
 * Uses Hono directly with the real middleware — no DB / Firebase mocks needed.
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import * as jwt from '@tsndr/cloudflare-worker-jwt';
import {
  requireAuth,
  requireSeller,
  requireAdmin,
  requireUser,
} from '@/worker/middleware/auth';

const JWT_SECRET = 'test-secret-for-auth-middleware';

function makeEnv() {
  return { JWT_SECRET, FIREBASE_PROJECT_ID: 'test-project' };
}

async function signJwt(payload: Record<string, unknown>, secret = JWT_SECRET) {
  const now = Math.floor(Date.now() / 1000);
  return await jwt.sign(
    { iat: now, exp: now + 3600, ...payload },
    secret
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildApp(middleware: any) {
  // Use loose typing — Hono's strict generics around middleware response
  // types collide across requireAuth / requireUserType. For tests we only
  // care about HTTP status.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const app = new Hono<any>();
  app.use('/protected', middleware);
  app.get('/protected', (c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (c as any).get('user') as { id: string; type: string } | undefined;
    return c.json({ ok: true, userId: user?.id, type: user?.type });
  });
  return app;
}

describe('requireAuth', () => {
  it('rejects request without Authorization header → 401', async () => {
    const app = buildApp(requireAuth());
    const res = await app.request('/protected', {}, makeEnv());
    expect(res.status).toBe(401);
  });

  it('rejects malformed Bearer token → 401', async () => {
    const app = buildApp(requireAuth());
    const res = await app.request(
      '/protected',
      { headers: { Authorization: 'Bearer not-a-jwt' } },
      makeEnv()
    );
    expect(res.status).toBe(401);
  });

  it('rejects JWT signed with wrong secret → 401', async () => {
    const token = await signJwt({ userId: '1', email: 'a@a.com', type: 'user' }, 'wrong-secret');
    const app = buildApp(requireAuth());
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      makeEnv()
    );
    expect(res.status).toBe(401);
  });

  it('rejects expired JWT → 401', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await jwt.sign(
      { userId: '1', email: 'a@a.com', type: 'user', iat: now - 7200, exp: now - 3600 },
      JWT_SECRET
    );
    const app = buildApp(requireAuth());
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      makeEnv()
    );
    expect(res.status).toBe(401);
  });

  it('rejects JWT missing both userId and sub → 401', async () => {
    const token = await signJwt({ email: 'a@a.com', type: 'user' });
    const app = buildApp(requireAuth());
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      makeEnv()
    );
    expect(res.status).toBe(401);
  });

  it('accepts valid JWT with userId → 200, sets user', async () => {
    const token = await signJwt({ userId: '42', email: 'u@u.com', type: 'user' });
    const app = buildApp(requireAuth());
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      makeEnv()
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { userId: string; type: string };
    expect(body.userId).toBe('42');
    expect(body.type).toBe('user');
  });

  it('accepts valid JWT with sub (not userId) → 200', async () => {
    const token = await signJwt({ sub: '99', email: 'u@u.com', type: 'user' });
    const app = buildApp(requireAuth());
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      makeEnv()
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { userId: string };
    expect(body.userId).toBe('99');
  });

  it('returns 503 when JWT_SECRET is missing (misconfiguration)', async () => {
    const app = buildApp(requireAuth());
    const res = await app.request('/protected', {}, { FIREBASE_PROJECT_ID: 'x' });
    expect(res.status).toBe(503);
  });
});

describe('requireSeller / requireUser / requireAdmin', () => {
  it('seller JWT passes requireSeller', async () => {
    const token = await signJwt({ userId: '10', email: 's@s.com', type: 'seller' });
    const app = buildApp(requireSeller());
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      makeEnv()
    );
    expect(res.status).toBe(200);
  });

  it('user JWT is rejected by requireSeller → 403', async () => {
    const token = await signJwt({ userId: '10', email: 'u@u.com', type: 'user' });
    const app = buildApp(requireSeller());
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      makeEnv()
    );
    expect(res.status).toBe(403);
  });

  it('seller JWT is rejected by requireAdmin → 403', async () => {
    const token = await signJwt({ userId: '10', email: 's@s.com', type: 'seller' });
    const app = buildApp(requireAdmin());
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      makeEnv()
    );
    expect(res.status).toBe(403);
  });

  it('admin JWT passes requireAdmin', async () => {
    const token = await signJwt({ userId: '1', email: 'a@a.com', type: 'admin' });
    const app = buildApp(requireAdmin());
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      makeEnv()
    );
    expect(res.status).toBe(200);
  });

  it('user JWT passes requireUser', async () => {
    const token = await signJwt({ userId: '5', email: 'u@u.com', type: 'user' });
    const app = buildApp(requireUser());
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      makeEnv()
    );
    expect(res.status).toBe(200);
  });

  it('missing auth on seller-gated route → 401 (not 403)', async () => {
    const app = buildApp(requireSeller());
    const res = await app.request('/protected', {}, makeEnv());
    expect(res.status).toBe(401);
  });
});
