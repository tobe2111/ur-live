// ============================================================
// Cloudflare Worker - Main Entry Point (Unified)
// Global Marketplace API — ALL routes consolidated here
// Legacy src/index.tsx has been retired.
// ============================================================

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { timing } from 'hono/timing';
import { swaggerUI } from '@hono/swagger-ui';
import { openApiSpec } from './openapi';

// ---- Worker-local routes (multi-seller MVP) ----
import type { Env } from './types/env';
import { authRouter } from './routes/auth.routes';
import { authTokenRoutes } from './routes/auth-token.routes'; // Phase 2.3
import { healthRoutes } from './routes/health.routes';
import { ordersRouter } from './routes/order.routes';
import { paymentsRouter } from './routes/payment.routes';
import { stripeRouter } from './routes/stripe.routes';
import { sellersRouter } from './routes/seller.routes';
import { emailRoutes } from '../features/notifications/api/email.routes';
import { streamsRouter } from './routes/streams.routes';  // ✅ 공개 스트림 라우트
import { usersRouter } from './routes/users.routes';      // ✅ /api/users/role, /api/users/init
import { i18nMiddleware } from './middleware/i18n.middleware';
import { rateLimitMiddleware as rateLimiterMiddleware } from './middleware/rate-limiter';
import { globalErrorHandler as errorHandler } from './middleware/error-handler';

// ---- Feature module routes ----
import { accountRoutes } from '../features/account/api/account.routes';
import { adminManagementRoutes, adminBannersRoutes, adminFlagsRoutes } from '../features/admin/api/index';
import { adminRoutes as adminAuthRoutes } from '../features/auth/api/admin.routes';
import { kakaoRoutes } from '../features/auth/api/kakao.routes';
import { sellerRoutes as sellerAuthRoutes } from '../features/auth/api/seller.routes';
import { googleRoutes } from '../features/auth/api/google.routes';
import { bannerRoutes } from '../features/banners/api/banners.routes';
import { cartRoutes } from '../features/cart/api/cart.routes';
import { notificationsRoutes } from '../features/notifications/api/notifications.routes';
import { resendWebhookRoutes } from '../features/notifications/api/resend-webhook.routes';
import { ordersRoutes as featureOrdersRoutes } from '../features/orders/api/orders.routes';
import { paymentRoutes as featurePaymentRoutes } from '../features/payments/api/payment.routes';
import { productsRoutes as featureProductsRoutes } from '../features/products/api/products.routes';
import { pushRoutes } from '../features/push/api/push.routes';
import { sellerManagementRoutes } from '../features/seller/api/seller-management.routes';
import { sellerOrdersRoutes } from '../features/seller/api/seller-orders.routes';
import { sellerAnalyticsRoutes } from '../features/seller/api/seller-analytics.routes';
import { sellerStreamsRoutes } from '../features/seller/api/seller-streams.routes';
import { shippingAddressRoutes } from '../features/shipping/api/shipping-address.routes';
import { wishlistRoutes } from '../features/wishlists/api/wishlists.routes';
import { supplyRoutes } from '../features/supply/api/supply.routes';
import { alimtalkRoutes } from '../features/alimtalk/api/alimtalk.routes';
import { donationsRoutes } from '../features/donations/api/donations.routes';
import { sellerDonationsRoutes } from '../features/donations/api/seller-donations.routes';
import youtubeRoutes from '../features/youtube/api/youtube.routes';
import youtubeChatRoutes from '../features/youtube/api/youtube-chat.routes';
import { liveSseRoutes, chatRoutes } from './routes/live-sse.routes';
import { cafe24Routes } from '../features/cafe24/api/cafe24.routes';

import { ALLOWED_ORIGINS, FIREBASE_RTDB_URL, FIREBASE_APP_URL } from '../shared/constants';
import { requireAdmin } from './middleware/auth';
import { adminIpWhitelist, adminAuditMiddleware } from './middleware/admin-security';
import { rateLimit } from './middleware/rate-limit';
import { bodyLimit } from './middleware/body-limit';
import { csrfProtection, csrfTokenHandler } from '../lib/csrf';

// ---- Durable Objects (re-exported for wrangler binding) ----
export { LiveStreamDurableObject } from '../durable-object';

// ============================================================
// Cache Control Middleware — adds CDN + browser cache headers
// for read-heavy GET endpoints to reduce origin load
// ============================================================
function cacheControl(maxAge: number) {
  return async (c: Context, next: Next) => {
    await next();
    if (c.res.status === 200 && c.req.method === 'GET') {
      c.header('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}`);
      c.header('CDN-Cache-Control', `max-age=${maxAge}`);
    }
  };
}

const app = new Hono<{ Bindings: Env }>();

// ============================================================
// Admin Sub-Application (code-level separation)
// All admin routes go through their own Hono app with:
//   1. CORS
//   2. IP whitelist (ADMIN_IP_WHITELIST env var)
//   3. requireAdmin() auth
//   4. Audit logging middleware
// ============================================================
const adminApp = new Hono<{ Bindings: Env }>();
adminApp.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }));
adminApp.use('*', adminIpWhitelist());
adminApp.use('*', requireAdmin());
adminApp.use('*', adminAuditMiddleware());

// ============================================================
// Global Middleware
// ============================================================

app.use('*', timing());
app.use('*', logger());
// Reject any request body larger than 1MB before it hits route handlers.
// Bulk-upload routes apply a larger limit locally if needed.
app.use('/api/*', bodyLimit(1_000_000));
app.use('/api/*', i18nMiddleware);
app.use('/api/*', rateLimiterMiddleware as any);

// CORS — multi-region support
app.use('*', cors({
  origin: (origin, c) => {
    const env = (c as any).env as Env;
    const allowed: string[] = [
      ...ALLOWED_ORIGINS,
      ...(env?.FRONTEND_URL ? [env.FRONTEND_URL] : []),
    ];
    if (!origin || allowed.includes(origin)) return origin ?? '';
    return '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Idempotency-Key',
    'X-Request-ID',
    'Accept-Language',
  ],
  exposeHeaders: ['X-Request-ID', 'Server-Timing'],
  credentials: true,
  maxAge: 86400,
}));

// ============================================================
// Security Headers (CSP etc.)
// ============================================================

app.use('*', async (c, next) => {
  await next();
  // Content-Security-Policy — worker-src blob: allows Web Workers from blob URLs
  // CSP — 공통 script sources (script-src와 script-src-elem에서 공유)
  // ✅ Security hardening: removed 'unsafe-eval' (no eval()/new Function() in code).
  //    If a third-party SDK requires it, add a nonce/hash for that specific script.
  const scriptSources = [
    "'self'", "'unsafe-inline'", "blob:",
    "https://*.cloudflare.com", "https://static.cloudflareinsights.com", "https://cloudflareinsights.com",
    "https://*.googletagmanager.com", "https://*.google-analytics.com",
    "https://*.tosspayments.com", "https://js.tosspayments.com",
    "https://*.stripe.com", "https://js.stripe.com", "https://m.stripe.network", "https://m.stripe.com",
    "https://*.firebase.google.com", "https://*.firebaseio.com", "https://*.firebasedatabase.app",
    FIREBASE_RTDB_URL,
    "https://apis.google.com", "https://*.googleapis.com",
    "https://kauth.kakao.com", "https://*.kakao.com", "https://t1.kakaocdn.net", "https://*.daumcdn.net",
    "https://www.youtube.com", "https://youtube.com", "https://s.ytimg.com", "https://*.youtube.com",
    "https://cdn.jsdelivr.net", "https://unpkg.com", "https://*.sentry.io",
    `https://*.firebaseapp.com`, FIREBASE_APP_URL,
  ].join(' ');

  c.header('Content-Security-Policy',
    "default-src 'self'; " +
    `script-src ${scriptSources}; ` +
    `script-src-elem ${scriptSources}; ` +
    "worker-src 'self' blob:; " +
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://*.stripe.com https://m.stripe.network; " +
    "img-src 'self' 'unsafe-inline' data: https: blob:; " +
    "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; " +
    `connect-src 'self' https: wss: https://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebaseio.com wss://*.firebasedatabase.app wss://${new URL(FIREBASE_RTDB_URL).host}; ` +
    "frame-src 'self' " +
      "https://*.tosspayments.com https://js.tosspayments.com " +
      "https://*.stripe.com https://js.stripe.com https://m.stripe.network https://m.stripe.com " +
      `https://*.firebaseapp.com ${FIREBASE_APP_URL} ` +
      "https://*.firebase.google.com https://*.firebaseio.com " +
      "https://accounts.google.com https://*.google.com " +
      "https://apis.google.com " +
      "https://kauth.kakao.com https://*.kakao.com " +
      "https://www.youtube.com https://youtube.com https://*.youtube.com https://www.youtube-nocookie.com " +
      "https://player.vimeo.com; " +
    "child-src 'self' blob:; " +
    "media-src 'self' https: blob:; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'self'; " +
    "report-uri /api/csp-report; report-to csp-endpoint;"
  );
  c.header(
    'Report-To',
    '{"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"/api/csp-report"}]}'
  );
  const url = new URL(c.req.url);
  // /embed/ 경로는 외부 사이트에서 iframe으로 임베드 가능하도록 허용
  if (url.pathname.startsWith('/embed/')) {
    c.header('Content-Security-Policy', c.res.headers.get('Content-Security-Policy')?.replace("frame-ancestors 'self'", "frame-ancestors *") || '');
    // X-Frame-Options 헤더 제거 (iframe 허용)
    c.res.headers.delete('X-Frame-Options');
  } else if (url.pathname.startsWith('/s/') || url.pathname.startsWith('/profile/') || url.pathname.startsWith('/live/')) {
    // 셀러 공개 페이지 + 라이브: 같은 도메인 iframe 허용 (대시보드 미리보기)
    c.header('X-Frame-Options', 'SAMEORIGIN');
  } else {
    c.header('X-Frame-Options', 'SAMEORIGIN');
  }
  if (url.hostname !== 'localhost' && url.protocol === 'https:') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  c.header('X-Content-Type-Options', 'nosniff');
  // ✅ X-XSS-Protection 제거: deprecated — 일부 브라우저에서 오히려 XSS를 유발 (HSTS/CSP로 대체)
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=(self), payment=(self), usb=()');
});

// ============================================================
// CSP Violation Report Endpoint
// Browsers POST violation reports here when CSP blocks a resource.
// Keep handler minimal and always return 204 to avoid influencing browser behavior.
// ============================================================
app.post('/api/csp-report', async (c) => {
  try {
    const report = await c.req.json().catch(() => null);
    if (import.meta.env.DEV && report) console.warn('[CSP violation]', report);
    // Optionally persist to DB here for later analysis.
  } catch { /* swallow — never surface parse errors to the browser */ }
  return c.body(null, 204);
});

// ============================================================
// Health Check
// ============================================================

app.get('/health', (c) => c.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '2.0.0',
  environment: (c.env as Env).ENVIRONMENT ?? 'development',
}));

// v32 FIX: PWA manifest MIME type 명시 (Workers asset serving은 _headers 미지원)
// Chrome "Manifest: Line: 1 Syntax error" 원인 — Worker가 HTML fallback으로 응답하거나
// MIME이 text/plain으로 나올 때 발생. 명시적 intercept로 application/manifest+json 반환.
app.get('/manifest.webmanifest', async (c) => {
  try {
    const assets = (c.env as any).ASSETS;
    if (assets) {
      const res = await assets.fetch(new Request(new URL('/manifest.webmanifest', c.req.url).toString()));
      if (res && res.ok) {
        const body = await res.text();
        return new Response(body, {
          headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    }
  } catch {}
  // Fallback: 인라인 매니페스트
  return new Response(JSON.stringify({
    name: '유어딜',
    short_name: '유어딜',
    start_url: '/',
    display: 'standalone',
    background_color: '#020202',
    theme_color: '#020202',
    orientation: 'portrait',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});

app.get('/api/health', async (c) => {
  const env = c.env as Env;
  const checks: Record<string, string> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };

  // DB check
  try {
    await env.DB.prepare("SELECT 1").first();
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
    checks.status = 'degraded';
  }

  // KV check
  try {
    if (env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.get('health-check');
      checks.kv = 'ok';
    }
  } catch {
    checks.kv = 'error';
  }

  checks.version = '2.0.0';
  checks.region = env.REGION || 'unknown';
  checks.environment = env.ENVIRONMENT ?? 'development';

  return c.json(checks, checks.status === 'ok' ? 200 : 503);
});

// Extended health routes: /api/health/detailed, /api/health/circuits
// ⚠️ Mounted under a sub-path so it does NOT shadow the inline GET /api/health above.
app.route('/api/health/detailed', healthRoutes);

// 클라이언트 빌드 버전 확인 — index.html의 스크립트 해시를 서버가 알려줌
// 프론트가 자신의 번들 해시와 비교해서 불일치 시 자동 리로드
let _cachedBuildVersion: { version: string; fetchedAt: number } | null = null;
app.get('/api/version', async (c) => {
  // 공개 secret 존재 여부 boolean — 값 자체는 노출 안 됨. 500 진단용.
  const env = c.env as any;
  const secrets = {
    JWT_SECRET: !!env.JWT_SECRET,
    REFRESH_TOKEN_SECRET: !!env.REFRESH_TOKEN_SECRET,
    KAKAO_REST_API_KEY: !!env.KAKAO_REST_API_KEY,
    FIREBASE_PRIVATE_KEY: !!env.FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL: !!env.FIREBASE_CLIENT_EMAIL,
    TOSS_SECRET_KEY: !!env.TOSS_SECRET_KEY,
    DB: !!env.DB,
  };
  try {
    const now = Date.now();
    if (_cachedBuildVersion && (now - _cachedBuildVersion.fetchedAt) < 60_000) {
      return c.json({ success: true, version: _cachedBuildVersion.version, secrets });
    }

    const origin = new URL(c.req.url).origin;
    const htmlRes = await fetch(`${origin}/`, { cf: { cacheTtl: 30 } } as RequestInit);
    if (!htmlRes.ok) return c.json({ success: false, version: null, secrets }, 200);

    const html = await htmlRes.text();
    const match = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/);
    const version = match?.[1] || 'unknown';
    _cachedBuildVersion = { version, fetchedAt: now };
    return c.json({ success: true, version, secrets });
  } catch {
    return c.json({ success: false, version: null, secrets }, 200);
  }
});

// ============================================================
// 🩹 Self-healing schema repair (idempotent, 재실행 안전)
// 2026-04-22: D1 migration runner CI/CD 권한 부재 우회용.
// 모든 ALTER TABLE은 IF EXISTS / catch 처리 — 이미 있으면 무해 무동작.
// 운영자가 한 번 호출하면 누락된 컬럼이 자동 추가됨.
// ============================================================
app.get('/api/_internal/repair-schema', async (c) => {
  const env = c.env as any;
  const DB = env.DB as D1Database;
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500);

  const stmts: Array<{ desc: string; sql: string }> = [
    // sellers
    { desc: 'sellers.commission_rate', sql: "ALTER TABLE sellers ADD COLUMN commission_rate REAL DEFAULT 10.00" },
    { desc: 'sellers.seller_type', sql: "ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'" },
    { desc: 'sellers.business_number', sql: "ALTER TABLE sellers ADD COLUMN business_number TEXT" },
    { desc: 'sellers.phone', sql: "ALTER TABLE sellers ADD COLUMN phone TEXT" },
    { desc: 'sellers.bank_account', sql: "ALTER TABLE sellers ADD COLUMN bank_account TEXT" },
    { desc: 'sellers.last_login_at', sql: "ALTER TABLE sellers ADD COLUMN last_login_at TEXT" },
    // admins
    { desc: 'admins.role', sql: "ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'admin'" },
    { desc: 'admins.is_active', sql: "ALTER TABLE admins ADD COLUMN is_active INTEGER DEFAULT 1" },
    { desc: 'admins.last_login_at', sql: "ALTER TABLE admins ADD COLUMN last_login_at TEXT" },
    // users
    { desc: 'users.password_hash', sql: "ALTER TABLE users ADD COLUMN password_hash TEXT" },
    { desc: 'users.last_login_at', sql: "ALTER TABLE users ADD COLUMN last_login_at TEXT" },
    // products (migration 0205)
    { desc: 'products.view_count', sql: "ALTER TABLE products ADD COLUMN view_count INTEGER DEFAULT 0" },
    { desc: 'products.avg_rating', sql: "ALTER TABLE products ADD COLUMN avg_rating REAL DEFAULT 0" },
    { desc: 'products.review_count', sql: "ALTER TABLE products ADD COLUMN review_count INTEGER DEFAULT 0" },
    { desc: 'products.sold_count', sql: "ALTER TABLE products ADD COLUMN sold_count INTEGER DEFAULT 0" },
  ];

  const results: Array<{ desc: string; status: 'added' | 'exists' | 'error'; error?: string }> = [];
  for (const { desc, sql } of stmts) {
    try {
      await DB.prepare(sql).run();
      results.push({ desc, status: 'added' });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (/duplicate column|already exists/i.test(msg)) {
        results.push({ desc, status: 'exists' });
      } else {
        results.push({ desc, status: 'error', error: msg.slice(0, 200) });
      }
    }
  }

  // 부수적: 자주 사용되는 보조 테이블 보장
  const tables: Array<{ name: string; sql: string }> = [
    { name: 'auth_refresh_tokens', sql: `CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )` },
    { name: 'rate_limit_attempts', sql: `CREATE TABLE IF NOT EXISTS rate_limit_attempts (
      key TEXT NOT NULL,
      action TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (key, action, window_start)
    )` },
    { name: 'password_reset_tokens', sql: `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
  ];
  const tableResults: Array<{ name: string; status: 'ok' | 'error'; error?: string }> = [];
  for (const { name, sql } of tables) {
    try {
      await DB.prepare(sql).run();
      tableResults.push({ name, status: 'ok' });
    } catch (e: any) {
      tableResults.push({ name, status: 'error', error: String(e?.message || e).slice(0, 200) });
    }
  }

  return c.json({ success: true, columns: results, tables: tableResults });
});

// ============================================================
// 🔍 Self-Diagnostic Endpoints (2026-04-22)
// 사용자가 브라우저 콘솔에서 직접 복사해 공유할 수 있는 진단용
// Dashboard/Logs 접근 없이 '왜 500인지' 찾기 위한 안전한 메타데이터 반환
// ============================================================

// 배포 검증용 — 현재 worker 빌드가 언제 / 어떤 커밋에서 빌드됐는지 즉시 확인
// 이 핸들러의 존재 자체가 "최신 배포 반영" 증거
app.get('/api/debug/build-info', requireAdmin(), (c) => {
  return c.json({
    success: true,
    // 빌드 시점 commit SHA — CI가 BUILD_SHA env로 주입
    commitSha: (c.env as any).BUILD_SHA || 'unknown',
    buildTimestamp: (c.env as any).BUILD_TIMESTAMP || 'unknown',
    // 이 엔드포인트가 도입된 커밋 기준 — 존재하면 그 이후 배포
    markers: {
      whoamiEndpoint: true,    // 2026-04-22 8b82323 이후
      buildInfoEndpoint: true, // 현재 커밋 이후
    },
  });
});

app.get('/api/debug/whoami', requireAdmin(), async (c) => {
  const authHeader = c.req.header('Authorization') || '';
  const hasAuthHeader = authHeader.length > 0;
  const cookieHeader = c.req.header('Cookie') || '';
  const hasCookie = cookieHeader.length > 0;
  const cookieNames = cookieHeader.split(';').map(s => s.split('=')[0].trim()).filter(Boolean);

  // 토큰 앞 20자만 (전체 노출 안 됨)
  const authPreview = hasAuthHeader ? authHeader.slice(0, 20) + '...' : null;

  // 쿠키 파싱: 세션 쿠키 존재 여부 (값은 노출 안 함)
  const sessionCookieNames = ['ur_session', 'firebase_token', 'seller_session', 'admin_session'];
  const presentSessionCookies = sessionCookieNames.filter(n => cookieNames.includes(n));

  // 미들웨어가 아직 안 돌았으므로 requireAuth 없이 수동 토큰 검증만
  let tokenInfo: any = null;
  if (hasAuthHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const { verify } = await import('hono/jwt');
      const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
      tokenInfo = {
        valid: true,
        type: (payload as any).type,
        sub: (payload as any).sub ? String((payload as any).sub).slice(0, 8) + '...' : null,
        exp: (payload as any).exp,
        expired: (payload as any).exp && (payload as any).exp < Math.floor(Date.now() / 1000),
      };
    } catch (err: any) {
      tokenInfo = { valid: false, error: String(err?.message || err).slice(0, 100) };
    }
  }

  return c.json({
    success: true,
    request: {
      url: c.req.url,
      method: c.req.method,
      origin: c.req.header('Origin') || null,
      userAgent: (c.req.header('User-Agent') || '').slice(0, 60),
      cfConnectingIp: c.req.header('CF-Connecting-IP') || null,
    },
    auth: {
      hasAuthHeader,
      authPreview,
      hasCookie,
      cookieNames,
      presentSessionCookies,
      tokenInfo,
    },
    env: {
      hasJwtSecret: !!c.env.JWT_SECRET,
      hasDb: !!c.env.DB,
      environment: (c.env as any).ENVIRONMENT || 'unknown',
    },
  });
});

// 세션 검증 시도 + 결과 리포트 (인증 경로 어느 스텝에서 실패하는지)
app.get('/api/debug/auth-trace', requireAdmin(), async (c) => {
  const steps: any[] = [];
  try {
    const authHeader = c.req.header('Authorization') || '';
    steps.push({ step: 'headers', authHeaderPresent: !!authHeader });

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      steps.push({ step: 'bearer-found', length: token.length });
      try {
        const { verify } = await import('hono/jwt');
        const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as any;
        steps.push({ step: 'jwt-verified', type: payload.type, sub: String(payload.sub).slice(0, 6) + '...' });
      } catch (e: any) {
        steps.push({ step: 'jwt-error', error: String(e?.message || e).slice(0, 100) });
      }
    }

    // 카카오 세션 쿠키 체크
    const cookieHeader = c.req.header('Cookie') || '';
    const urSession = cookieHeader.split(';').map(s => s.trim()).find(c => c.startsWith('ur_session='));
    if (urSession) {
      steps.push({ step: 'ur_session-found', length: urSession.length });
    }

    return c.json({ success: true, trace: steps });
  } catch (e: any) {
    steps.push({ step: 'exception', error: String(e?.message || e).slice(0, 200) });
    return c.json({ success: false, trace: steps });
  }
});

// ============================================================
// API Documentation (OpenAPI / Swagger UI)
// ============================================================

// OpenAPI Spec JSON endpoint
app.get('/api/openapi.json', (c) => {
  return c.json(openApiSpec);
});

// Swagger UI at /docs
app.get('/docs', swaggerUI({ url: '/api/openapi.json' }));

// Alternative: /api/docs
app.get('/api/docs', swaggerUI({ url: '/api/openapi.json' }));

// ============================================================
// Debug & Utilities
// ============================================================

// Debug endpoint to check bindings (admin only)
app.get('/api/debug/bindings', requireAdmin(), (c) => {
  const env = c.env as Env;
  return c.json({
    hasDB: !!env.DB,
    hasSessionKV: !!env.SESSION_KV,
    environment: env.ENVIRONMENT,
    frontendUrl: env.FRONTEND_URL,
    region: env.REGION,
    envKeys: Object.keys(env || {}),
  });
});

// KV usage monitoring (admin only)
app.get('/api/debug/kv-usage', requireAdmin(), async (c) => {
  const env = c.env as Env;
  try {
    // SESSION_KV의 활성 세션 키 수를 집계 (KV list 사용)
    let sessionCount = 0;
    if (env.SESSION_KV) {
      const listed = await env.SESSION_KV.list({ limit: 1000 });
      sessionCount = listed.keys.length;
    }

    const today = new Date().toISOString().split('T')[0];
    const nextReset = new Date();
    nextReset.setUTCHours(24, 0, 0, 0);

    // Free tier limits: reads 100k/day, writes 1k/day
    // Paid plan: reads 10M/day, writes 1M/day
    const readLimit = 100000;
    const writeLimit = 1000;
    // Estimate: each session = ~10 reads/day (token validation), 1 write (creation)
    const estimatedReads = sessionCount * 10;
    const estimatedWrites = Math.ceil(sessionCount * 0.3);
    const readUsagePercent = Math.min(100, Math.round((estimatedReads / readLimit) * 100));
    const writeUsagePercent = Math.min(100, Math.round((estimatedWrites / writeLimit) * 100));

    return c.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        note: 'KV 사용량은 활성 세션 수 기반 추정치입니다. 정확한 수치는 Cloudflare 대시보드에서 확인하세요.',
        activeSessions: sessionCount,
        reads: estimatedReads,
        writes: estimatedWrites,
        readLimit,
        writeLimit,
        readUsagePercent,
        writeUsagePercent,
        estimatedDailyCost: 0,
      },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ============================================================
// Database Index Optimization (admin only)
// Creates indexes on frequently queried columns for faster lookups
// ============================================================
app.get('/api/admin/optimize-db', requireAdmin(), async (c) => {
  const env = c.env as Env;
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id)',
    'CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
    'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id)',
    'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
    'CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status)',
    'CREATE INDEX IF NOT EXISTS idx_vouchers_user_id ON vouchers(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_referral_tree_parent ON referral_tree(parent_id)',
    'CREATE INDEX IF NOT EXISTS idx_referral_commissions_beneficiary ON referral_commissions(beneficiary_id)',
  ];

  let created = 0;
  const errors: string[] = [];

  for (const sql of indexes) {
    try {
      await env.DB.prepare(sql).run();
      created++;
    } catch (e) {
      errors.push(`${sql}: ${(e as Error).message}`);
    }
  }

  return c.json({
    success: true,
    indexes_created: created,
    total: indexes.length,
    ...(errors.length > 0 ? { errors } : {}),
  });
});

// ============================================================
// CSRF Token Endpoint + Protection for session-cookie routes
// ============================================================
// - GET /api/csrf-token issues a double-submit CSRF token
// - CSRF middleware only fires when the request uses session-cookie auth
//   (Bearer-token requests are skipped inside csrfProtection() itself).
app.get('/api/csrf-token', csrfTokenHandler);

// Session-cookie-authenticated mutation endpoints (Kakao/user flows).
// Admin/seller/Bearer-auth routes are intentionally NOT listed here — they use
// Authorization: Bearer headers which aren't cross-site-set-able.
app.use('/api/auth/logout', csrfProtection());
app.use('/api/auth/profile', csrfProtection());
app.use('/api/auth/change-password', csrfProtection());

// ============================================================
// Auth Routes
// ============================================================

// -------------------------------------------------------
// Auth routing: TWO routers on /api/auth (non-overlapping sub-routes).
//
// authRouter     → POST /register, /login, /logout, /refresh, GET /me, /session/*
// authTokenRoutes → POST /id-token (Phase 2.3 backend token exchange)
//
// ⚠️ Both mounted on /api/auth — authRouter registered first for priority.
// -------------------------------------------------------
app.route('/api/auth', authRouter);
app.route('/api/auth', authTokenRoutes);

// Feature: Kakao OAuth  →  /auth/kakao/sync/callback + /api/auth/kakao/*
app.route('/auth/kakao', kakaoRoutes);
app.route('/api/auth/kakao', kakaoRoutes);

// Feature: Admin auth — rate limited: 5 attempts per 5 min per IP
app.use('/api/admin/login', rateLimit({ action: 'admin_login', max: 5, windowSec: 300 }));
app.route('/api/admin', adminAuthRoutes);

// -------------------------------------------------------
// Seller routing: FOUR routers on /api/seller (non-overlapping sub-routes).
//
// sellerAuthRoutes       → POST /login, /register, GET /me  (auth)
// sellerManagementRoutes → /products/*, /profile, /dashboard (management CRUD)
// sellerOrdersRoutes     → /orders/*, /store-verify/*        (order management)
// sellerDonationsRoutes  → /donations/*                      (donation endpoints)
//
// ⚠️ All mounted on /api/seller — sellerAuthRoutes registered first for priority.
//    Rate limiting applied to /api/seller/login before route registration.
// -------------------------------------------------------
// Feature: Seller auth — rate limited: 10 attempts per 5 min per IP
app.use('/api/seller/login', rateLimit({ action: 'seller_login', max: 10, windowSec: 300 }));
app.route('/api/seller', sellerAuthRoutes);

// Feature: Google/Firebase auth
app.route('/api/auth/google', googleRoutes);

// ============================================================
// Users Routes  ← /api/users/role, /api/users/init
// 프론트엔드에서 /api/users/* 로 직접 호출
// ============================================================
app.route('/api/users', usersRouter);

// ============================================================
// Cache Control — read-heavy public endpoints
// ============================================================
app.use('/api/products', cacheControl(60));     // 1 min
app.use('/api/streams', cacheControl(30));      // 30 sec
app.use('/api/group-buy/products', cacheControl(60)); // 1 min
app.use('/api/banners', cacheControl(300));     // 5 min

// ============================================================
// Rate limits for read/write endpoints
// Applied per-IP (default key). Auth-sensitive routes fail closed.
// ============================================================
// Search: prevent keyword-abuse / scraping
app.use('/api/search/*', rateLimit({ action: 'search', max: 30, windowSec: 60 }));
// Product list: prevent scraping the catalog
app.use('/api/products', rateLimit({ action: 'product_list', max: 60, windowSec: 60 }));
// Seller public profile view: prevent enumeration
app.use('/api/sellers/*', rateLimit({ action: 'seller_view', max: 60, windowSec: 60 }));
// Chat send: prevent spam; only on POSTs handled inside chatRoutes
// HIGH-4: lowered from 30/min → 10/min to make message-flood / URL-spam harder.
app.use('/api/chat/*/messages', rateLimit({ action: 'chat_send', max: 10, windowSec: 60 }));

// HIGH-1: Upload endpoints — prevent abusive image/file uploads.
// Applied before route mount so it fires for POST/PUT/PATCH alike.
app.use('/api/seller/upload-image', rateLimit({ action: 'upload', max: 10, windowSec: 60 }));
app.use('/api/seller/upload-*', rateLimit({ action: 'upload', max: 10, windowSec: 60 }));

// ============================================================
// Streams Routes  ← /api/streams (공개 조회용)
// 프론트엔드의 LiveNow, useLiveStream, AdminPage 등이 /api/streams 호출
// 판매자 전용 CRUD는 /api/seller/streams 유지
// ============================================================
app.route('/api/streams', streamsRouter);

// ============================================================
// Product & Seller Routes
// ============================================================

// Feature products (extended CRUD) — 유일한 /api/products 핸들러
app.route('/api/products', featureProductsRoutes);

// /api/search/popular — featureProductsRoutes의 /search/popular 에 alias
// (프론트엔드가 /api/search/popular 로 호출)
app.route('/api/search', featureProductsRoutes);

// Worker-native sellers list + public routes
app.route('/api/sellers', sellersRouter);

// Feature seller management (see /api/seller routing note above — non-overlapping sub-routes)
app.route('/api/seller', sellerManagementRoutes);
app.route('/api/seller', sellerOrdersRoutes);
app.route('/api/seller/analytics', sellerAnalyticsRoutes);
app.route('/api/seller/streams', sellerStreamsRoutes);

// Email notifications (global)
app.route('/api/email', emailRoutes);

// Affiliate marketing
import { affiliateRoutes } from '../features/affiliate/api/affiliate.routes';
app.route('/api/affiliate', affiliateRoutes);

// ============================================================
// Order & Payment Routes
// ============================================================

// -------------------------------------------------------
// Order routing: TWO repositories, ONE path prefix.
//
// ordersRouter  → worker/repositories/order.repository.ts (PRIMARY)
//   POST /, GET /, GET /:id, POST /:id/cancel
//   Uses authMiddleware, multi-seller support, idempotency.
//
// featureOrdersRoutes → features/orders/repositories/OrderRepository.ts (SECONDARY)
//   GET /:id/tracking, POST /:id/confirm,
//   POST /internal/auto-confirm, POST /internal/sync-deliveries
//   These endpoints do NOT overlap with ordersRouter.
//
// ⚠️ Both are mounted on /api/orders — ordersRouter is registered
//    first so its routes take priority for any overlapping paths.
// -------------------------------------------------------
app.route('/api/orders', ordersRouter);
app.route('/api/orders', featureOrdersRoutes);

// -------------------------------------------------------
// Payment routing: TWO routers on /api/payments (non-overlapping sub-routes).
//
// paymentsRouter       → POST /confirm, POST /checkout-session (worker-native, PRIMARY)
// featurePaymentRoutes → POST /rollback (feature module, SECONDARY)
//
// ⚠️ Both mounted on /api/payments — paymentsRouter registered first for priority.
// -------------------------------------------------------
app.route('/api/payments', paymentsRouter);
app.route('/api/payments', featurePaymentRoutes);

// ✅ Stripe routes (Global region): POST /api/payment/stripe/create-intent
app.route('/api/payment/stripe', stripeRouter);

// ============================================================
// Feature Module Routes
// ============================================================

// Cart
app.route('/api/cart', cartRoutes);

// Notifications
app.route('/api/notifications', notificationsRoutes);

// Resend email webhook (bounce / complaint → suppression list)
app.route('/api/webhooks/resend', resendWebhookRoutes);

// Shipping addresses
app.route('/api/shipping-addresses', shippingAddressRoutes);

// Wishlists
app.route('/api/wishlists', wishlistRoutes);

// Banners
app.route('/api/banners', bannerRoutes);

// ============================================================
// Admin routes — all handled by adminApp (separate auth chain)
// adminApp has: CORS + IP whitelist + requireAdmin() + audit log
// ============================================================
adminApp.route('/agencies', adminAgencyRoutes);
// Admin tools (chart, sellers, banners, notices, settlements, reports, settings)
import { adminToolsRoutes } from '../features/admin/api/admin-tools.routes';
adminApp.route('/tools', adminToolsRoutes);
// Admin real-time health metrics (active streams, orders/min, stuck orders, webhooks)
import { adminMetricsRoutes } from '../features/admin/api/admin-metrics.routes';
adminApp.route('/metrics', adminMetricsRoutes);
adminApp.route('/', adminManagementRoutes);
adminApp.route('/banners', adminBannersRoutes);
// Feature flags / kill-switch (graceful degradation for traffic spikes)
adminApp.route('/flags', adminFlagsRoutes);
adminApp.route('/cafe24', cafe24Routes);
// Blog admin — mounted INSIDE adminApp (requireAdmin + IP whitelist + audit log)
import { blogRoutes as adminBlogRoutes } from '../features/blog/api/blog.routes';
adminApp.route('/blog', adminBlogRoutes);
// Restaurant settlement (admin)
import { restaurantSettlementRoutes, sellerSettlementRoutes } from '../features/settlement/api/restaurant-settlement.routes';
adminApp.route('/restaurant-settlement', restaurantSettlementRoutes);
// Naver Ad Scraper 제거됨 (2026-04-22) — 법적 리스크(PIPA/정보통신망법) + 기술 불안정
// 남은 `/api/scraper/d1/*` 엔드포인트도 단계적 제거. scraped_advertisers 테이블은 데이터 보존 목적으로 남김.

// ── (레거시) D1에 저장된 스크래핑 결과 조회 — admin용 read-only ──
app.get('/api/scraper/d1/emails', async (c) => {
  const auth = c.req.header('Authorization');
  if (!auth) return c.json({ error: 'Auth required' }, 401);
  try {
    const payload = await import('hono/jwt').then(m => m.verify(auth.replace('Bearer ', ''), c.env.JWT_SECRET, 'HS256'));
    if ((payload as any).type !== 'admin') return c.json({ error: 'Admin only' }, 403);
  } catch { return c.json({ error: 'Invalid token' }, 401); }

  const keyword = c.req.query('keyword') || '';
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const offset = (page - 1) * limit;

  try {
    const where = keyword ? `WHERE keyword LIKE ?` : '';
    const params = keyword ? [`%${keyword}%`] : [];

    const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM scraped_advertisers ${where}`)
      .bind(...params).first<{ total: number }>();

    const { results } = await c.env.DB.prepare(`
      SELECT id, keyword, advertiser_name, site_url, email, phone, description, scraped_at, session_name
      FROM scraped_advertisers ${where}
      ORDER BY scraped_at DESC LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    return c.json({
      success: true,
      data: results || [],
      total: countRow?.total || 0,
      page, limit,
    });
  } catch (e) {
    return c.json({ success: true, data: [], total: 0, page, limit });
  }
});

// /api/scraper/d1/trigger 제거 (workflow 삭제됨)

app.get('/api/scraper/d1/stats', async (c) => {
  const auth = c.req.header('Authorization');
  if (!auth) return c.json({ error: 'Auth required' }, 401);
  try {
    const payload = await import('hono/jwt').then(m => m.verify(auth.replace('Bearer ', ''), c.env.JWT_SECRET, 'HS256'));
    if ((payload as any).type !== 'admin') return c.json({ error: 'Admin only' }, 403);
  } catch { return c.json({ error: 'Invalid token' }, 401); }

  try {
    const total = await c.env.DB.prepare('SELECT COUNT(*) as c FROM scraped_advertisers').first<{ c: number }>();
    const withEmail = await c.env.DB.prepare("SELECT COUNT(*) as c FROM scraped_advertisers WHERE email IS NOT NULL AND email != ''").first<{ c: number }>();
    const uniqueEmails = await c.env.DB.prepare("SELECT COUNT(DISTINCT email) as c FROM scraped_advertisers WHERE email IS NOT NULL AND email != ''").first<{ c: number }>();
    const keywords = await c.env.DB.prepare('SELECT COUNT(DISTINCT keyword) as c FROM scraped_advertisers').first<{ c: number }>();
    const latest = await c.env.DB.prepare('SELECT scraped_at FROM scraped_advertisers ORDER BY scraped_at DESC LIMIT 1').first<{ scraped_at: string }>();

    return c.json({
      success: true,
      data: {
        total: total?.c || 0,
        withEmail: withEmail?.c || 0,
        uniqueEmails: uniqueEmails?.c || 0,
        keywords: keywords?.c || 0,
        latestScrape: latest?.scraped_at || null,
      },
    });
  } catch {
    return c.json({ success: true, data: { total: 0, withEmail: 0, uniqueEmails: 0, keywords: 0, latestScrape: null } });
  }
});

app.route('/api/admin', adminApp);
// Cafe24 public callback (no admin auth needed for OAuth redirect)
app.route('/admin/cafe24/callback', cafe24Routes);

// Push notifications
app.route('/', pushRoutes);  // pushRoutes already uses full path /api/push/*

// Account
app.route('/api/account', accountRoutes);

// Supply chain (공급가 시스템)
app.route('/api/supply', supplyRoutes);

// 알림톡/브랜드메시지 크레딧 시스템 — rate limit send: 60/min per seller
app.use('/api/seller/alimtalk/send', rateLimit({ action: 'alimtalk_send', max: 60, windowSec: 60 }));
app.route('/api/seller/alimtalk', alimtalkRoutes);

// ── 후원(도네이션) ──
app.route('/api/donations', donationsRoutes);
app.route('/api/seller', sellerDonationsRoutes); // (see /api/seller routing note — non-overlapping /donations/* sub-routes)

// ── 식당 정산 (셀러용) ──
app.route('/api/seller/restaurant-settlements', sellerSettlementRoutes);

// ── 딜 포인트 ──
import { pointsRoutes } from '../features/points/api/points.routes';
app.route('/api/points', pointsRoutes);

// ── 쇼츠 ──
import { shortsRoutes } from '../features/shorts/api/shorts.routes';
app.route('/api/shorts', shortsRoutes);

// ── 공동구매 & 바우처 ──
import { groupBuyRoutes } from '../features/group-buy/api/group-buy.routes';
app.route('/api/group-buy', groupBuyRoutes);
app.route('/api/vouchers', groupBuyRoutes);

// ── 쿠폰 ──
import { couponRoutes } from '../features/coupons/api/coupons.routes';
app.route('/api/coupons', couponRoutes);

// ── 소셜 (팔로우 + 알림) ──
import { socialRoutes } from '../features/social/api/social.routes';
app.route('/api/social', socialRoutes);

// ── 상품 리뷰 ──
import { reviewsRoutes } from '../features/reviews/api/reviews.routes';
app.route('/api/reviews', reviewsRoutes);

// ── 셀러 등급 ──
import { sellerTiersRoutes } from '../features/seller-tiers/api/seller-tiers.routes';
app.route('/api/seller-tiers', sellerTiersRoutes);

// ── 바코드 + 재고 관리 ──
import { inventoryRoutes } from '../features/inventory/api/inventory.routes';
app.route('/api/inventory', inventoryRoutes);

// ── 홈페이지 섹션 관리 ──
import { sectionsRoutes } from '../features/sections/api/sections.routes';
app.route('/api/sections', sectionsRoutes);

// ── YouTube 구독자 늘리기 ──
import { youtubeGrowthRoutes, youtubeGrowthAdminRoutes } from '../features/youtube-growth/api/youtube-growth.routes';
app.route('/api/youtube-growth', youtubeGrowthRoutes);
// SECURITY (HIGH-5): admin 엔드포인트는 adminApp 내부로 별도 마운트 (IP whitelist + audit log)
adminApp.route('/youtube-growth', youtubeGrowthAdminRoutes);

// ── 대시보드 알림 ──
import { dashboardNotificationsRoutes } from '../features/notifications/api/dashboard-notifications.routes';
app.route('/api/dashboard-notifications', dashboardNotificationsRoutes);

// ── 상품 대량등록 ──
import { bulkUploadRoutes } from '../features/bulk-upload/api/bulk-upload.routes';
app.route('/api/bulk-upload', bulkUploadRoutes);

// ── 반품/환불 ──
import { returnsRoutes } from '../features/returns/api/returns.routes';
app.route('/api/returns', returnsRoutes);

// ── 라이브 경매 ──
import { auctionRoutes } from '../features/auction/api/auction.routes';
app.route('/api/auction', auctionRoutes);

// ── 타임딜 룰렛 ──
import { timedealRoutes } from '../features/timedeal/api/timedeal.routes';
app.route('/api/timedeal', timedealRoutes);

// ── 유저 공동구매 (커뮤니티) ──
app.use('/api/community-group-buy/create', rateLimit({ action: 'group_buy_create', max: 10, windowSec: 300 }));
app.use('/api/community-group-buy/join/*', rateLimit({ action: 'group_buy_join', max: 20, windowSec: 300 }));
import { communityGroupBuyRoutes } from '../features/community-group-buy/api/community-group-buy.routes';
app.route('/api/community-group-buy', communityGroupBuyRoutes);

// ── 친구 초대 공동구매 ──
import { referralRoutes } from '../features/referral/api/referral.routes';
app.route('/api/referral', referralRoutes);

// ── 초대 보상 ──
import { inviteRewardRoutes } from '../features/referral/api/invite-reward.routes';
app.route('/api/invite', inviteRewardRoutes);

// ── 다단계 추천 커미션 ──
import { referralTreeRoutes } from '../features/referral/api/referral-tree.routes';
app.route('/api/referral-tree', referralTreeRoutes);

// ── CS 신고 (유저 신고 접수) ──
import { reportsRoutes } from '../features/reports/api/reports.routes';
app.route('/api/reports', reportsRoutes);

// ── 방송 알림 구독 ──
import { broadcastNotifyRoutes } from '../features/broadcast-notify/api/broadcast-notify.routes';
app.route('/api/broadcast-notify', broadcastNotifyRoutes);

// ── VIP 등급 (유저 로열티) ──
import { loyaltyRoutes } from '../features/loyalty/api/loyalty.routes';
app.route('/api/loyalty', loyaltyRoutes);

// ── 관심/알림 (맛집·상품·공동구매 관심 등록) ──
import { interestRoutes } from '../features/loyalty/api/interest.routes';
app.route('/api/interest', interestRoutes);

// ── 카카오 소셜 (메시지 + 캘린더) + 글로벌 (.ics) ──
import { kakaoSocialRoutes } from '../features/kakao-social/api/kakao-social.routes';
app.route('/api/kakao-social', kakaoSocialRoutes);

// ── 카카오 장소 검색 프록시 (브라우저 CORS 우회) ──
app.get('/api/kakao/place/search', async (c) => {
  const query = c.req.query('query')
  const category = c.req.query('category_group_code') || 'FD6,CE7'
  const size = c.req.query('size') || '15'
  if (!query) return c.json({ success: false, error: 'query required' }, 400)
  const KAKAO_REST_KEY = c.env.KAKAO_REST_API_KEY
  if (!KAKAO_REST_KEY) return c.json({ success: false, error: 'KAKAO_REST_API_KEY not configured' }, 500)
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=${size}${category && !category.includes(',') ? `&category_group_code=${category}` : ''}`
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } })
    const data = await res.json()
    return c.json({ success: true, data })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})

app.get('/api/kakao/place/address', async (c) => {
  const query = c.req.query('query')
  if (!query) return c.json({ success: false, error: 'query required' }, 400)
  const KAKAO_REST_KEY = c.env.KAKAO_REST_API_KEY
  if (!KAKAO_REST_KEY) return c.json({ success: false, error: 'KAKAO_REST_API_KEY not configured' }, 500)
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } })
    const data = await res.json()
    return c.json({ success: true, data })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})

// ── 네이버 검색 API 프록시 (식당 이미지/정보) ──
// 지역 검색: 식당명 + 주소 + 전화번호 + 카테고리
app.get('/api/naver/place/search', async (c) => {
  const query = c.req.query('query')
  const display = c.req.query('display') || '5'
  if (!query) return c.json({ success: false, error: 'query required' }, 400)
  const clientId = (c.env as Env).NAVER_CLIENT_ID
  const clientSecret = (c.env as Env).NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) return c.json({ success: false, error: 'NAVER API keys not configured' }, 500)
  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=${display}&sort=comment`
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    })
    const data = await res.json()
    return c.json({ success: true, data })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})

// 이미지 검색: 식당명으로 이미지 가져오기
app.get('/api/naver/image/search', async (c) => {
  const query = c.req.query('query')
  const display = c.req.query('display') || '3'
  if (!query) return c.json({ success: false, error: 'query required' }, 400)
  const clientId = (c.env as Env).NAVER_CLIENT_ID
  const clientSecret = (c.env as Env).NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) return c.json({ success: false, error: 'NAVER API keys not configured' }, 500)
  try {
    const url = `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query + ' 맛집')}&display=${display}&sort=sim&filter=large`
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    })
    const data = await res.json()
    return c.json({ success: true, data })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})

// 통합 식당 정보 (지역 검색 + 이미지 한번에)
app.get('/api/naver/restaurant', async (c) => {
  const query = c.req.query('query')
  if (!query) return c.json({ success: false, error: 'query required' }, 400)
  const clientId = (c.env as Env).NAVER_CLIENT_ID
  const clientSecret = (c.env as Env).NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) return c.json({ success: false, error: 'NAVER API keys not configured' }, 500)

  const headers = { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }

  try {
    const [localRes, imageRes] = await Promise.all([
      fetch(`https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=1&sort=comment`, { headers }),
      fetch(`https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query + ' 맛집 음식')}&display=3&sort=sim&filter=large`, { headers }),
    ])

    const localData: any = await localRes.json()
    const imageData: any = await imageRes.json()

    const place = localData.items?.[0] || null
    const images = (imageData.items || []).map((img: any) => img.link)

    return c.json({
      success: true,
      data: {
        place: place ? {
          title: place.title?.replace(/<[^>]*>/g, ''),
          address: place.roadAddress || place.address,
          phone: place.telephone,
          category: place.category,
          link: place.link,
          mapx: place.mapx,
          mapy: place.mapy,
        } : null,
        images,
      },
    })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})

// ── 블로그 (어드민 CRUD + 공개 조회) ──
// SECURITY: /api/admin/blog는 adminApp 내부에서 등록되어 requireAdmin + IP 화이트리스트 적용
// /api/blog는 공개 GET /public, /public/:slug만 허용 (나머지는 라우터 내부에서 admin 체크)
import { blogRoutes } from '../features/blog/api/blog.routes';
app.route('/api/blog', blogRoutes); // public 엔드포인트 접근용 (내부에서 /public만 공개)

// ── 에이전시 ──
import { agencyRoutes } from '../features/agency/api/agency.routes';
import { adminAgencyRoutes } from '../features/admin/api/admin-agency.routes';
app.route('/api/agency', agencyRoutes);
// adminAgencyRoutes는 위에서 adminApp에 등록됨

// YouTube / Live streaming
// Register at both paths for backward-compatibility with older frontend deployments
app.route('/api/seller/youtube', youtubeRoutes);
app.route('/api/youtube', youtubeRoutes); // legacy path alias
app.route('/api/youtube/chat', youtubeChatRoutes);

// Live stream real-time (SSE fallback + WebSocket → DO + chat messages)
app.route('/api/live', liveSseRoutes);
app.route('/api/chat', chatRoutes);

// ── 사이드 배너 (공개 API, 인증 불필요) ──
app.get('/api/side-banners', async (c) => {
  const env = c.env as Env;
  try {
    // Auto-create table if not exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS side_banners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        image_url TEXT NOT NULL,
        link_url TEXT,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
    const { results } = await env.DB.prepare(
      `SELECT id, title, image_url, link_url, sort_order
       FROM side_banners WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC`
    ).all();
    return c.json({ success: true, data: results ?? [] });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

// (Cafe24 is registered under adminApp above)


// ============================================================
// [참고] 라우트 등록 원칙 (이 주석을 절대 삭제하지 말 것)
// ============================================================
// 1. 동일 경로에 두 라우터를 app.route()하면 Hono는 먼저 등록된 것이 매칭됨.
//    → 같은 경로에 worker 라우터 + feature 라우터를 동시에 등록하지 말 것.
// 2. /api/streams  → streamsRouter   (이 파일에서만 관리)
// 3. /api/users/*  → usersRouter     (이 파일에서만 관리)
// 4. 프론트 호출 경로와 백엔드 app.route() 등록 경로가 반드시 일치해야 함.
//    프론트가 /api/streams 를 호출하는데 백엔드에 /api/seller/streams 만 있으면 404.
// 5. CORS allowed 목록에 실제 도메인이 반드시 포함되어야 함.

// ============================================================
// Image Optimization Proxy (Cloudflare Image Resizing)
// ============================================================

app.get('/api/image/resize', async (c) => {
  const url = c.req.query('url');
  const width = parseInt(c.req.query('w') || '400');
  const quality = parseInt(c.req.query('q') || '80');

  if (!url) return c.json({ error: 'url required' }, 400);

  // SSRF 방어: 허용된 도메인만 프록시
  const ALLOWED_HOSTS = ['firebasestorage.googleapis.com', 'img.youtube.com', 'k.kakaocdn.net', 'images.unsplash.com', 'live.ur-team.com', 'ur-live.pages.dev']
  try {
    const parsed = new URL(url)
    if (!ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
      return c.json({ error: 'domain not allowed' }, 403)
    }
  } catch {
    return c.json({ error: 'invalid url' }, 400)
  }

  try {
    const response = await fetch(url, {
      cf: {
        image: {
          width,
          quality,
          format: 'webp',
        }
      } as any
    });

    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Content-Type', response.headers.get('Content-Type') || 'image/webp');

    return new Response(response.body, { headers });
  } catch {
    return c.redirect(url);
  }
});

// ============================================================
// 404 for API routes not matched above
// ============================================================

app.all('/api/*', (c) => c.json({ success: false, error: 'Not found' }, 404));

// ============================================================
// SEO: 봇 감지 + 동적 메타 태그 주입 (SPA용)
// 구글/네이버/카카오/텔레그램 크롤러가 페이지 요청 시
// index.html의 메타 태그를 동적으로 교체하여 응답
// ============================================================

const BOT_UA_REGEX = /googlebot|bingbot|yandex|baiduspider|twitterbot|facebookexternalhit|rogerbot|linkedinbot|embedly|quora link|showyoubot|outbrain|pinterest|slackbot|vkshare|w3c_validator|kakaotalk|kakaostory|naver|daumoa|daum|telegram|whatsapp|discord/i;

const BASE_URL = 'https://live.ur-team.com';
const DEFAULT_OG = {
  title: '유어딜 - 라이브 커머스 & 맛집 공동구매',
  desc: '라이브 방송으로 만나는 최저가 특가 상품. 인플루언서 추천 맛집 공동구매, 실시간 라이브 쇼핑',
  image: `${BASE_URL}/og-image.png`,
};

app.get('*', async (c) => {
  const ua = c.req.header('user-agent') || '';
  const url = new URL(c.req.url);
  const path = url.pathname;

  // API 경로는 이미 위에서 처리됨 — 여기는 페이지 요청만
  if (path.startsWith('/api/') || path.startsWith('/auth/')) return c.notFound();

  // 봇이 아니면 SPA index.html 반환 (Cloudflare Pages가 처리)
  if (!BOT_UA_REGEX.test(ua)) {
    // Worker에서 직접 index.html을 서빙할 수 없으므로 fetch
    const assetUrl = new URL('/', c.req.url);
    const res = await (c.env as any).ASSETS?.fetch?.(assetUrl.toString())
      || await fetch(assetUrl.toString());
    return new Response(res.body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  // ── 봇: 동적 메타 태그 생성 ──
  const { DB } = c.env;
  let og = { ...DEFAULT_OG };
  let canonical = `${BASE_URL}${path}`;

  try {
    // /products/:id → 상품 정보
    const productMatch = path.match(/^\/products\/(\d+)/);
    if (productMatch) {
      const p = await DB.prepare('SELECT name, description, price, image_url FROM products WHERE id = ?')
        .bind(productMatch[1]).first<any>();
      if (p) {
        og.title = `${p.name} - 유어딜`;
        og.desc = p.description?.slice(0, 200) || `${p.name} ${p.price?.toLocaleString()}원 - 유어딜에서 구매하세요`;
        if (p.image_url) og.image = p.image_url;
      }
    }

    // /profile/:slug 또는 /s/:id → 셀러 정보
    const sellerMatch = path.match(/^\/(profile|s)\/(.+)/);
    if (sellerMatch) {
      const param = sellerMatch[2];
      const isNum = /^\d+$/.test(param);
      const s = isNum
        ? await DB.prepare('SELECT name, bio, profile_image FROM sellers WHERE id = ?').bind(param).first<any>()
        : await DB.prepare('SELECT name, bio, profile_image FROM sellers WHERE slug = ? OR username = ?').bind(param, param).first<any>();
      if (s) {
        og.title = `${s.name} - 유어딜`;
        og.desc = s.bio?.slice(0, 200) || `${s.name}의 스토어 - 유어딜`;
        if (s.profile_image) og.image = s.profile_image;
      }
    }

    // /live/:id → 라이브 방송
    const liveMatch = path.match(/^\/live\/(\d+)/);
    if (liveMatch) {
      const s = await DB.prepare('SELECT title, youtube_video_id FROM live_streams WHERE id = ?')
        .bind(liveMatch[1]).first<any>();
      if (s) {
        og.title = `🔴 ${s.title} - 유어딜 라이브`;
        og.desc = `지금 라이브 중! ${s.title} - 유어딜에서 실시간으로 시청하세요`;
        if (s.youtube_video_id) og.image = `https://img.youtube.com/vi/${s.youtube_video_id}/maxresdefault.jpg`;
      }
    }
    // /blog/:slug → 블로그 글
    const blogMatch = path.match(/^\/blog\/([a-z0-9-]+)$/);
    if (blogMatch) {
      const b = await DB.prepare('SELECT title, summary, thumbnail_url FROM blog_posts WHERE slug = ? AND is_published = 1')
        .bind(blogMatch[1]).first<any>();
      if (b) {
        og.title = `${b.title} - 유어딜 블로그`;
        og.desc = b.summary?.slice(0, 200) || '';
        if (b.thumbnail_url) og.image = b.thumbnail_url;
      }
    }

    // /blog → 블로그 목록
    if (path === '/blog') {
      og.title = '유어딜 블로그 — 라이브 커머스 가이드';
      og.desc = '셀러 가이드, 트렌드, 서비스 소식. 유어딜에서 라이브 커머스를 시작하세요.';
    }
  } catch {}

  // 메타 태그가 포함된 최소 HTML 반환
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>${og.title}</title>
<meta name="description" content="${og.desc}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${og.title}" />
<meta property="og:description" content="${og.desc}" />
<meta property="og:image" content="${og.image}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:site_name" content="유어딜" />
<meta property="og:locale" content="ko_KR" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${og.title}" />
<meta name="twitter:description" content="${og.desc}" />
<meta name="twitter:image" content="${og.image}" />
<meta name="robots" content="index, follow" />
<meta name="naver-site-verification" content="7be066f6c7f451d994e3a5482aa76f87e96c3c2f" />
</head>
<body>
<div id="root"></div>
<script>window.location.href="${canonical}";</script>
</body>
</html>`;

  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
});

// ============================================================
// Error Handler
// ============================================================

app.onError(errorHandler);

// ============================================================
// Export Worker + Scheduled Handler (Cron Triggers)
// ============================================================

import { handleScheduled } from './cron/scheduled-cleanup';
import { handleAutoSettlement, handleExpiredVoucherRefunds } from './cron/auto-settlement';
import { runReconciliation } from './cron/reconciliation';

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const cron = event.cron;

    // Every 5 minutes: short cleanup tasks
    if (cron === '*/5 * * * *') {
      ctx.waitUntil(handleScheduled(env));
    }

    // Daily 18:00 UTC (KST 03:00): heavy tasks (settlement + expired-voucher refund)
    if (cron === '0 18 * * *') {
      ctx.waitUntil(handleAutoSettlement(env));
      ctx.waitUntil(handleExpiredVoucherRefunds(env));
    }

    // Daily 19:00 UTC (KST 04:00): reconciliation — stuck orders, orphan data, negative stock cleanup
    if (event.cron === '0 19 * * *' || cron === '0 19 * * *') {
      ctx.waitUntil(runReconciliation(env));
    }
  },
};
