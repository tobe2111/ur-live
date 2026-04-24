import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAdmin } from '../middleware/auth';

export const smokeTestRoutes = new Hono<{ Bindings: Env }>();

// 🛡️ admin 전용. 내부 엔드포인트 구조 노출 차단.
smokeTestRoutes.get('/api/_internal/smoke-test', requireAdmin(), async (c) => {
  const origin = new URL(c.req.url).origin;
  const chunk = Number(c.req.query('chunk') || '0');
  const CHUNK_SIZE = 45;
  const endpoints: Array<{ path: string; method: 'GET' | 'POST'; body?: string; cat: string }> = [
    // ── 인프라 ──────────────────────────────────────────────
    { cat: 'infra', path: '/api/health', method: 'GET' },
    { cat: 'infra', path: '/api/health/detailed', method: 'GET' },
    { cat: 'infra', path: '/api/version', method: 'GET' },

    // ── 공개 상품/방송/배너/검색 ─────────────────────────
    { cat: 'public', path: '/api/products?limit=3', method: 'GET' },
    { cat: 'public', path: '/api/products?limit=3&sort=ranking', method: 'GET' },
    { cat: 'public', path: '/api/products?limit=3&sort=popular', method: 'GET' },
    { cat: 'public', path: '/api/products?limit=3&sort=rating', method: 'GET' },
    { cat: 'public', path: '/api/products?limit=3&sort=price_low', method: 'GET' },
    { cat: 'public', path: '/api/products?limit=3&sort=price_high', method: 'GET' },
    { cat: 'public', path: '/api/products?limit=3&featured=true', method: 'GET' },
    { cat: 'public', path: '/api/products?category=food&limit=3', method: 'GET' },
    { cat: 'public', path: '/api/products/1', method: 'GET' },
    { cat: 'public', path: '/api/products/1/options', method: 'GET' },
    { cat: 'public', path: '/api/streams', method: 'GET' },
    { cat: 'public', path: '/api/search?q=test&limit=3', method: 'GET' },
    { cat: 'public', path: '/api/search/popular', method: 'GET' },
    { cat: 'public', path: '/api/banners', method: 'GET' },
    { cat: 'public', path: '/api/categories', method: 'GET' },
    { cat: 'public', path: '/api/sellers?limit=3', method: 'GET' },

    // ── 로그인 엔드포인트 (가짜 creds → 401 기대) ────────
    { cat: 'auth', path: '/api/auth/login', method: 'POST', body: '{"email":"smoke@test.com","password":"x"}' },
    { cat: 'auth', path: '/api/auth/register', method: 'POST', body: '{"email":"","password":"","name":""}' },
    { cat: 'auth', path: '/api/seller/login', method: 'POST', body: '{"email":"smoke@test.com","password":"x"}' },
    { cat: 'auth', path: '/api/admin/login', method: 'POST', body: '{"email":"smoke@test.com","password":"x"}' },
    { cat: 'auth', path: '/api/agency/login', method: 'POST', body: '{"email":"smoke@test.com","password":"x"}' },
    { cat: 'auth', path: '/api/seller/forgot-password', method: 'POST', body: '{"email":"smoke@test.com"}' },

    // ── 유저 대시보드 엔드포인트 (401 기대, 500 금지) ────
    { cat: 'user', path: '/api/auth/me', method: 'GET' },
    { cat: 'user', path: '/api/cart', method: 'GET' },
    { cat: 'user', path: '/api/orders', method: 'GET' },
    { cat: 'user', path: '/api/orders/1/tracking', method: 'GET' },
    { cat: 'user', path: '/api/wishlists/0', method: 'GET' },
    { cat: 'user', path: '/api/shipping-addresses', method: 'GET' },
    { cat: 'user', path: '/api/points/balance', method: 'GET' },
    { cat: 'user', path: '/api/points/history', method: 'GET' },
    { cat: 'user', path: '/api/notifications', method: 'GET' },
    { cat: 'user', path: '/api/reviews?product_id=1', method: 'GET' },
    { cat: 'user', path: '/api/coupons', method: 'GET' },
    { cat: 'user', path: '/api/account/profile', method: 'GET' },
    { cat: 'user', path: '/api/donations', method: 'GET' },
    { cat: 'user', path: '/api/returns', method: 'GET' },

    // ── 셀러 대시보드 엔드포인트 ────────────────────────
    { cat: 'seller', path: '/api/seller/my-seller-status', method: 'GET' },
    { cat: 'seller', path: '/api/seller/orders', method: 'GET' },
    { cat: 'seller', path: '/api/seller/analytics/summary', method: 'GET' },
    { cat: 'seller', path: '/api/seller/analytics/revenue', method: 'GET' },
    { cat: 'seller', path: '/api/seller/analytics/top-products', method: 'GET' },
    { cat: 'seller', path: '/api/seller/streams', method: 'GET' },
    { cat: 'seller', path: '/api/seller/products', method: 'GET' },
    { cat: 'seller', path: '/api/seller/coupons', method: 'GET' },
    { cat: 'seller', path: '/api/seller/settlement', method: 'GET' },

    // ── 어드민 대시보드 엔드포인트 ──────────────────────
    { cat: 'admin', path: '/api/admin/users', method: 'GET' },
    { cat: 'admin', path: '/api/admin/sellers', method: 'GET' },
    { cat: 'admin', path: '/api/admin/orders', method: 'GET' },
    { cat: 'admin', path: '/api/admin/tools/sellers', method: 'GET' },
    { cat: 'admin', path: '/api/admin/tools/settlements', method: 'GET' },
    { cat: 'admin', path: '/api/admin/metrics', method: 'GET' },
    { cat: 'admin', path: '/api/admin/flags', method: 'GET' },
    { cat: 'admin', path: '/api/admin/banners', method: 'GET' },
    { cat: 'admin', path: '/api/admin/blog', method: 'GET' },
    { cat: 'admin', path: '/api/admin/agencies', method: 'GET' },

    // ── 에이전시 대시보드 ──────────────────────────────
    { cat: 'agency', path: '/api/agency/me', method: 'GET' },
    { cat: 'agency', path: '/api/agency/sellers', method: 'GET' },
    { cat: 'agency', path: '/api/agency/analytics/summary', method: 'GET' },

    // ── 결제 / 주문 ────────────────────────────────────
    { cat: 'payment', path: '/api/payments/confirm', method: 'POST', body: '{"paymentKey":"x","orderId":"x","amount":1}' },
    { cat: 'payment', path: '/api/payments/checkout-session', method: 'POST', body: '{}' },
    { cat: 'payment', path: '/api/payment/stripe/create-intent', method: 'POST', body: '{}' },

    // ── 실시간 / 스트리밍 ──────────────────────────────
    { cat: 'stream', path: '/api/streams/1/chat/messages', method: 'GET' },
    { cat: 'stream', path: '/api/streams/1/products', method: 'GET' },
    { cat: 'stream', path: '/api/streams/1/current-product', method: 'GET' },

    // ── 기타 ────────────────────────────────────────────
    { cat: 'misc', path: '/api/push/vapid-public-key', method: 'GET' },
    { cat: 'misc', path: '/api/affiliate/balance', method: 'GET' },
    { cat: 'misc', path: '/api/cafe24/auth-url', method: 'GET' },
    { cat: 'misc', path: '/api/shortcuts', method: 'GET' },
    { cat: 'misc', path: '/api/csrf-token', method: 'GET' },
  ];

  const totalCount = endpoints.length;
  const startIdx = chunk * CHUNK_SIZE;
  const endIdx = Math.min(startIdx + CHUNK_SIZE, totalCount);
  const testSlice = endpoints.slice(startIdx, endIdx);
  const hasMore = endIdx < totalCount;

  const results: Array<{ cat: string; path: string; method: string; status: number; ok: boolean; ms: number }> = [];
  const catStats: Record<string, { total: number; passed: number; failed: number }> = {};
  let fail5xx = 0;

  for (const ep of testSlice) {
    const start = Date.now();
    let status = 0;
    try {
      const res = await fetch(`${origin}${ep.path}`, {
        method: ep.method,
        headers: ep.body ? { 'Content-Type': 'application/json' } : {},
        body: ep.body || undefined,
      });
      status = res.status;
    } catch {
      status = 0;
    }
    const ms = Date.now() - start;
    const is5xx = status >= 500 || status === 0;
    if (is5xx) fail5xx++;

    catStats[ep.cat] = catStats[ep.cat] || { total: 0, passed: 0, failed: 0 };
    catStats[ep.cat].total++;
    if (is5xx) catStats[ep.cat].failed++;
    else catStats[ep.cat].passed++;

    results.push({ cat: ep.cat, path: ep.path, method: ep.method, status, ok: !is5xx, ms });
  }

  const failures = results.filter(r => !r.ok);

  return c.json({
    success: fail5xx === 0,
    chunk,
    range: { from: startIdx, to: endIdx, totalEndpoints: totalCount },
    tested: testSlice.length,
    passed: testSlice.length - fail5xx,
    failed5xx: fail5xx,
    nextChunkUrl: hasMore ? `/api/_internal/smoke-test?chunk=${chunk + 1}` : null,
    byCategory: catStats,
    failures: failures.length > 0 ? failures : undefined,
    allResults: results,
  });
});

smokeTestRoutes.get('/api/_internal/smoke-test-auth', async (c) => {
  const { sign } = await import('hono/jwt');
  const origin = new URL(c.req.url).origin;
  const jwtSecret = (c.env as any).JWT_SECRET;

  if (!jwtSecret) {
    return c.json({ success: false, error: 'JWT_SECRET not configured' }, 500);
  }

  const now = Math.floor(Date.now() / 1000);

  const adminToken = await sign(
    { sub: '0', email: 'smoke@test.internal', type: 'admin', role: 'super_admin', iat: now, exp: now + 60 },
    jwtSecret
  );

  const sellerToken = await sign(
    { sub: '0', email: 'smoke@test.internal', type: 'seller', seller_id: 0, iat: now, exp: now + 60 },
    jwtSecret
  );

  const endpoints: Array<{ path: string; token: string; cat: string }> = [
    { cat: 'admin', path: '/api/admin/users', token: adminToken },
    { cat: 'admin', path: '/api/admin/sellers', token: adminToken },
    { cat: 'admin', path: '/api/admin/orders', token: adminToken },
    { cat: 'admin', path: '/api/admin/banners', token: adminToken },
    { cat: 'admin', path: '/api/admin/agencies', token: adminToken },
    { cat: 'admin', path: '/api/admin/metrics', token: adminToken },
    { cat: 'admin', path: '/api/admin/flags', token: adminToken },
    { cat: 'admin', path: '/api/admin/blog', token: adminToken },
    { cat: 'admin', path: '/api/admin/tools/sellers', token: adminToken },
    { cat: 'admin', path: '/api/admin/tools/settlements', token: adminToken },
    { cat: 'user', path: '/api/orders', token: adminToken },
    { cat: 'user', path: '/api/cart', token: adminToken },
    { cat: 'user', path: '/api/points/balance', token: adminToken },
    { cat: 'user', path: '/api/points/history', token: adminToken },
    { cat: 'user', path: '/api/notifications', token: adminToken },
    { cat: 'user', path: '/api/shipping-addresses', token: adminToken },
    { cat: 'user', path: '/api/wishlists/0', token: adminToken },
    { cat: 'seller', path: '/api/seller/orders', token: sellerToken },
    { cat: 'seller', path: '/api/seller/products', token: sellerToken },
  ];

  const results: Array<{ cat: string; path: string; status: number; ok: boolean; ms: number }> = [];
  const catStats: Record<string, { total: number; passed: number; failed: number }> = {};
  let fail5xx = 0;

  for (const ep of endpoints) {
    const start = Date.now();
    let status = 0;
    try {
      const res = await fetch(`${origin}${ep.path}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${ep.token}` },
      });
      status = res.status;
    } catch {
      status = 0;
    }
    const ms = Date.now() - start;
    const is5xx = status >= 500 || status === 0;
    if (is5xx) fail5xx++;

    catStats[ep.cat] = catStats[ep.cat] || { total: 0, passed: 0, failed: 0 };
    catStats[ep.cat].total++;
    if (is5xx) catStats[ep.cat].failed++;
    else catStats[ep.cat].passed++;

    results.push({ cat: ep.cat, path: ep.path, status, ok: !is5xx, ms });
  }

  const failures = results.filter(r => !r.ok);

  return c.json({
    success: fail5xx === 0,
    tested: endpoints.length,
    passed: endpoints.length - fail5xx,
    failed5xx: fail5xx,
    byCategory: catStats,
    failures: failures.length > 0 ? failures : undefined,
    allResults: results,
  });
});
