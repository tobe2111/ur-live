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

import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { requireAdmin } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import {
  exchangeCodeForTokens,
  saveTokens,
  getStoredTokens,
  getValidAccessToken,
  fetchAllProducts,
  syncProductsToLocal,
} from '../services/cafe24-api.service';
import { logError } from '@/worker/utils/logger';

const cafe24Routes = new Hono<{ Bindings: Env }>();

// CORS
cafe24Routes.use(
  '/*',
  cors({
    origin: [...ALLOWED_ORIGINS],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);

// ── GET /auth-url ──────────────────────────────────────────────────
// Returns the Cafe24 OAuth authorization URL for the admin to click
cafe24Routes.get('/auth-url', requireAdmin() as MiddlewareHandler, async (c) => {
  const { CAFE24_CLIENT_ID, CAFE24_MALL_ID, FRONTEND_URL } = c.env;

  if (!CAFE24_CLIENT_ID || !CAFE24_MALL_ID) {
    return c.json({ success: false, error: 'Cafe24 환경변수가 설정되지 않았습니다' }, 500);
  }

  const redirectUri = `${FRONTEND_URL || 'https://live.ur-team.com'}/admin/cafe24/callback`;
  const scopes = 'mall.read_product,mall.write_product,mall.read_order,mall.write_order';
  const state = crypto.randomUUID();

  // SECURITY (MED-1): CSRF 방지를 위해 state를 HttpOnly 쿠키에 저장
  setCookie(c, 'cafe24_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 600, // 10분
  });

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
  const receivedState = c.req.query('state');

  if (error || !code) {
    // Redirect back to admin page with error
    const adminUrl = `${FRONTEND_URL || 'https://live.ur-team.com'}/admin/cafe24?error=${error || 'no_code'}`;
    return c.redirect(adminUrl);
  }

  // SECURITY (MED-1): state 파라미터 검증 (CSRF 방지)
  const cookieState = getCookie(c, 'cafe24_oauth_state');
  if (!receivedState || !cookieState || receivedState !== cookieState) {
    deleteCookie(c, 'cafe24_oauth_state', { path: '/' });
    const adminUrl = `${FRONTEND_URL || 'https://live.ur-team.com'}/admin/cafe24?error=invalid_state`;
    return c.redirect(adminUrl);
  }
  deleteCookie(c, 'cafe24_oauth_state', { path: '/' });

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
    // 🛡️ at-rest 암호화 — KEK 전달
    await saveTokens(DB, CAFE24_MALL_ID, tokens, c.env.DATA_ENCRYPTION_KEY);

    // Redirect back to admin Cafe24 page with success
    const adminUrl = `${FRONTEND_URL || 'https://live.ur-team.com'}/admin/cafe24?connected=true`;
    return c.redirect(adminUrl);
  } catch (err) {
    logError('cafe24.oauth.callback_failed', { error: (err as Error)?.message });
    const adminUrl = `${FRONTEND_URL || 'https://live.ur-team.com'}/admin/cafe24?error=token_exchange_failed`;
    return c.redirect(adminUrl);
  }
});

// ── POST /sync ─────────────────────────────────────────────────────
// Trigger a full product sync from Cafe24 → local DB
cafe24Routes.post('/sync', requireAdmin() as MiddlewareHandler, async (c) => {
  const { DB, CAFE24_CLIENT_ID, CAFE24_CLIENT_SECRET, CAFE24_MALL_ID } = c.env;

  if (!CAFE24_CLIENT_ID || !CAFE24_CLIENT_SECRET || !CAFE24_MALL_ID) {
    return c.json({ success: false, error: 'Cafe24 환경변수가 설정되지 않았습니다' }, 500);
  }

  try {
    const accessToken = await getValidAccessToken(DB, CAFE24_MALL_ID, CAFE24_CLIENT_ID, CAFE24_CLIENT_SECRET, c.env.DATA_ENCRYPTION_KEY);
    const products = await fetchAllProducts(CAFE24_MALL_ID, accessToken);
    const result = await syncProductsToLocal(DB, CAFE24_MALL_ID, products);

    return c.json({
      success: true,
      message: `동기화 완료: ${result.created}개 생성, ${result.updated}개 업데이트`,
      data: result,
    });
  } catch (err) {
    logError('cafe24.sync.failed', { error: (err as Error)?.message });
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /status ────────────────────────────────────────────────────
// Check if Cafe24 is connected and token is valid
cafe24Routes.get('/status', requireAdmin() as MiddlewareHandler, async (c) => {
  const { DB, CAFE24_MALL_ID } = c.env;

  if (!CAFE24_MALL_ID) {
    return c.json({ success: true, data: { connected: false, reason: 'CAFE24_MALL_ID not set' } });
  }

  const tokens = await getStoredTokens(DB, CAFE24_MALL_ID, c.env.DATA_ENCRYPTION_KEY);
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
cafe24Routes.post('/disconnect', requireAdmin() as MiddlewareHandler, async (c) => {
  const { DB, CAFE24_MALL_ID } = c.env;

  if (!CAFE24_MALL_ID) {
    return c.json({ success: false, error: 'CAFE24_MALL_ID not set' }, 400);
  }

  await DB.prepare('DELETE FROM cafe24_auth WHERE mall_id = ?').bind(CAFE24_MALL_ID).run();

  return c.json({ success: true, message: 'Cafe24 연동 해제 완료' });
});

// ── POST /webhook ──────────────────────────────────────────────────
// Cafe24 webhook for product changes (optional, for auto-sync)
// SECURITY: HMAC-SHA256 서명 검증 (X-Cafe24-Hmac-Sha256 헤더)
cafe24Routes.post('/webhook', async (c) => {
  const { DB, CAFE24_CLIENT_ID, CAFE24_CLIENT_SECRET, CAFE24_MALL_ID, CAFE24_WEBHOOK_SECRET } = c.env;

  if (!CAFE24_MALL_ID || !CAFE24_CLIENT_ID || !CAFE24_CLIENT_SECRET) {
    return c.json({ success: false }, 400);
  }

  // Webhook 시크릿 미설정 시 요청 거부 (안전 기본값)
  if (!CAFE24_WEBHOOK_SECRET) {
    return c.json({ success: false, error: 'webhook not configured' }, 503);
  }

  const signature = c.req.header('X-Cafe24-Hmac-Sha256') || '';
  const rawBody = await c.req.text();

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(CAFE24_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const computed = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

    if (!signature || signature !== computed) {
      return c.json({ success: false, error: 'Invalid signature' }, 401);
    }
  } catch (err) {
    logError('cafe24.webhook.signature_failed', { error: (err as Error)?.message });
    return c.json({ success: false, error: 'Signature verification failed' }, 401);
  }

  try {
    const body = JSON.parse(rawBody);
    const eventType = body.event_no;

    // product events: product create/update/delete
    if (
      eventType === 'product_create' ||
      eventType === 'product_update' ||
      eventType === 'product_delete'
    ) {
      // Re-sync all products (simple approach)
      const accessToken = await getValidAccessToken(
        DB,
        CAFE24_MALL_ID,
        CAFE24_CLIENT_ID,
        CAFE24_CLIENT_SECRET,
        c.env.DATA_ENCRYPTION_KEY,
      );
      const products = await fetchAllProducts(CAFE24_MALL_ID, accessToken);
      await syncProductsToLocal(DB, CAFE24_MALL_ID, products);
    }

    return c.json({ success: true });
  } catch (err) {
    logError('cafe24.webhook.processing_failed', { error: (err as Error)?.message });
    return c.json({ success: true }); // Always return 200 to Cafe24
  }
});

export { cafe24Routes };
export default cafe24Routes;
