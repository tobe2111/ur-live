/**
 * Cafe24 Admin Routes
 *
 * Endpoints:
 * - GET  /auth-url       → Redirect URL for Cafe24 OAuth
 * - GET  /callback       → OAuth callback (exchanges code for tokens)
 * - POST /sync           → Trigger product sync from Cafe24
 * - GET  /status         → Connection status
 * - POST /disconnect     → Remove stored tokens
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAdmin } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import {
  exchangeCodeForTokens,
  saveTokens,
  getStoredTokens,
  getValidAccessToken,
  fetchAllProducts,
  syncProductsToLocal,
} from '../services/cafe24-api.service';

const cafe24Routes = new Hono<{ Bindings: Env }>();

// CORS
cafe24Routes.use(
  '/*',
  cors({
    origin: ['https://live.ur-team.com', 'http://localhost:5173'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);

// ── GET /auth-url ──────────────────────────────────────────────────
// Returns the Cafe24 OAuth authorization URL for the admin to click
cafe24Routes.get('/auth-url', requireAdmin() as any, async (c) => {
  const { CAFE24_CLIENT_ID, CAFE24_MALL_ID, FRONTEND_URL } = c.env;

  if (!CAFE24_CLIENT_ID || !CAFE24_MALL_ID) {
    return c.json({ success: false, error: 'Cafe24 환경변수가 설정되지 않았습니다' }, 500);
  }

  const redirectUri = `${FRONTEND_URL || 'https://live.ur-team.com'}/admin/cafe24/callback`;
  const scopes = 'mall.read_product,mall.write_product,mall.read_order,mall.write_order';
  const state = crypto.randomUUID();

  const authUrl =
    `https://${CAFE24_MALL_ID}.cafe24api.com/api/v2/oauth/authorize` +
    `?response_type=code` +
    `&client_id=${CAFE24_CLIENT_ID}` +
    `&state=${state}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}`;

  return c.json({ success: true, data: { authUrl, state } });
});

// ── GET /callback ──────────────────────────────────────────────────
// Cafe24 redirects here after the admin authorizes
cafe24Routes.get('/callback', async (c) => {
  const { DB, CAFE24_CLIENT_ID, CAFE24_CLIENT_SECRET, CAFE24_MALL_ID, FRONTEND_URL } = c.env;

  const code = c.req.query('code');
  const error = c.req.query('error');

  if (error || !code) {
    // Redirect back to admin page with error
    const adminUrl = `${FRONTEND_URL || 'https://live.ur-team.com'}/admin/cafe24?error=${error || 'no_code'}`;
    return c.redirect(adminUrl);
  }

  if (!CAFE24_CLIENT_ID || !CAFE24_CLIENT_SECRET || !CAFE24_MALL_ID) {
    return c.json({ success: false, error: 'Cafe24 환경변수 누락' }, 500);
  }

  const redirectUri = `${FRONTEND_URL || 'https://live.ur-team.com'}/admin/cafe24/callback`;

  try {
    const tokens = await exchangeCodeForTokens(
      CAFE24_MALL_ID,
      CAFE24_CLIENT_ID,
      CAFE24_CLIENT_SECRET,
      code,
      redirectUri,
    );
    await saveTokens(DB, CAFE24_MALL_ID, tokens);

    // Redirect back to admin Cafe24 page with success
    const adminUrl = `${FRONTEND_URL || 'https://live.ur-team.com'}/admin/cafe24?connected=true`;
    return c.redirect(adminUrl);
  } catch (err) {
    console.error('[Cafe24] OAuth callback error:', err);
    const adminUrl = `${FRONTEND_URL || 'https://live.ur-team.com'}/admin/cafe24?error=token_exchange_failed`;
    return c.redirect(adminUrl);
  }
});

// ── POST /sync ─────────────────────────────────────────────────────
// Trigger a full product sync from Cafe24 → local DB
cafe24Routes.post('/sync', requireAdmin() as any, async (c) => {
  const { DB, CAFE24_CLIENT_ID, CAFE24_CLIENT_SECRET, CAFE24_MALL_ID } = c.env;

  if (!CAFE24_CLIENT_ID || !CAFE24_CLIENT_SECRET || !CAFE24_MALL_ID) {
    return c.json({ success: false, error: 'Cafe24 환경변수가 설정되지 않았습니다' }, 500);
  }

  try {
    const accessToken = await getValidAccessToken(DB, CAFE24_MALL_ID, CAFE24_CLIENT_ID, CAFE24_CLIENT_SECRET);
    const products = await fetchAllProducts(CAFE24_MALL_ID, accessToken);
    const result = await syncProductsToLocal(DB, CAFE24_MALL_ID, products);

    return c.json({
      success: true,
      message: `동기화 완료: ${result.created}개 생성, ${result.updated}개 업데이트`,
      data: result,
    });
  } catch (err) {
    console.error('[Cafe24] Sync error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /status ────────────────────────────────────────────────────
// Check if Cafe24 is connected and token is valid
cafe24Routes.get('/status', requireAdmin() as any, async (c) => {
  const { DB, CAFE24_MALL_ID } = c.env;

  if (!CAFE24_MALL_ID) {
    return c.json({ success: true, data: { connected: false, reason: 'CAFE24_MALL_ID not set' } });
  }

  const tokens = await getStoredTokens(DB, CAFE24_MALL_ID);
  if (!tokens) {
    return c.json({ success: true, data: { connected: false } });
  }

  const expiresAt = new Date(tokens.expires_at);
  const isExpired = Date.now() > expiresAt.getTime();

  // Count synced products
  const countRow = await DB.prepare(
    'SELECT COUNT(*) as count FROM cafe24_product_map WHERE cafe24_mall_id = ?',
  )
    .bind(CAFE24_MALL_ID)
    .first<{ count: number }>();

  return c.json({
    success: true,
    data: {
      connected: true,
      mall_id: tokens.mall_id,
      token_expired: isExpired,
      expires_at: tokens.expires_at,
      scopes: tokens.scopes,
      synced_products: countRow?.count ?? 0,
      last_updated: tokens.updated_at,
    },
  });
});

// ── POST /disconnect ───────────────────────────────────────────────
// Remove Cafe24 connection
cafe24Routes.post('/disconnect', requireAdmin() as any, async (c) => {
  const { DB, CAFE24_MALL_ID } = c.env;

  if (!CAFE24_MALL_ID) {
    return c.json({ success: false, error: 'CAFE24_MALL_ID not set' }, 400);
  }

  await DB.prepare('DELETE FROM cafe24_auth WHERE mall_id = ?').bind(CAFE24_MALL_ID).run();

  return c.json({ success: true, message: 'Cafe24 연동 해제 완료' });
});

// ── POST /webhook ──────────────────────────────────────────────────
// Cafe24 webhook for product changes (optional, for auto-sync)
cafe24Routes.post('/webhook', async (c) => {
  const { DB, CAFE24_CLIENT_ID, CAFE24_CLIENT_SECRET, CAFE24_MALL_ID } = c.env;

  if (!CAFE24_MALL_ID || !CAFE24_CLIENT_ID || !CAFE24_CLIENT_SECRET) {
    return c.json({ success: false }, 400);
  }

  try {
    const body = await c.req.json();
    const eventType = body.event_no;

    // product events: product create/update/delete
    if (
      eventType === 'product_create' ||
      eventType === 'product_update' ||
      eventType === 'product_delete'
    ) {
      console.log(`[Cafe24 Webhook] ${eventType}:`, JSON.stringify(body).slice(0, 200));

      // Re-sync all products (simple approach)
      const accessToken = await getValidAccessToken(
        DB,
        CAFE24_MALL_ID,
        CAFE24_CLIENT_ID,
        CAFE24_CLIENT_SECRET,
      );
      const products = await fetchAllProducts(CAFE24_MALL_ID, accessToken);
      await syncProductsToLocal(DB, CAFE24_MALL_ID, products);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error('[Cafe24 Webhook] Error:', err);
    return c.json({ success: true }); // Always return 200 to Cafe24
  }
});

export { cafe24Routes };
export default cafe24Routes;
