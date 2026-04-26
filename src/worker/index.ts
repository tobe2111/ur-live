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
import { errorRateMonitor } from './middleware/error-rate-monitor';
import { edgeCache } from './middleware/edge-cache';

// ---- Feature module routes ----
import { accountRoutes } from '../features/account/api/account.routes';
import { adminManagementRoutes, adminBannersRoutes, adminFlagsRoutes } from '../features/admin/api/index';
import { adminCouponsRoutes } from '../features/admin/api/admin-coupons.routes';
import { adminSideBannersRoutes } from '../features/admin/api/admin-side-banners.routes';
import { adminSettlementsRoutes } from '../features/admin/api/admin-settlements.routes';
import { adminStatsRoutes } from '../features/admin/api/admin-stats.routes';
import { adminSellersRoutes } from '../features/admin/api/admin-sellers.routes';
import { adminProductsRoutes } from '../features/admin/api/admin-products.routes';
import { adminOrdersRoutes } from '../features/admin/api/admin-orders.routes';
import { adminStreamsRoutes } from '../features/admin/api/admin-streams.routes';
import { adminAccountsRoutes } from '../features/admin/api/admin-accounts.routes';
import { adminAnalyticsRoutes } from '../features/admin/api/admin-analytics.routes';
import { adminModerationRoutes } from '../features/admin/api/admin-moderation.routes';
import { adminUsersRoutes } from '../features/admin/api/admin-users.routes';
import { adminMiscRoutes } from '../features/admin/api/admin-misc.routes';
import { adminReviewGeneratorRoutes } from '../features/admin/api/admin-review-generator.routes';
import { adminRoutes as adminAuthRoutes } from '../features/auth/api/admin.routes';
import { kakaoRoutes } from '../features/auth/api/kakao.routes';
import { sellerRoutes as sellerAuthRoutes } from '../features/auth/api/seller.routes';
import { googleRoutes } from '../features/auth/api/google.routes';
import { bannerRoutes } from '../features/banners/api/banners.routes';
import { cartRoutes } from '../features/cart/api/cart.routes';
import { notificationsRoutes } from '../features/notifications/api/notifications.routes';
import { resendWebhookRoutes } from '../features/notifications/api/resend-webhook.routes';
import { ordersRoutes as featureOrdersRoutes } from '../features/orders/api/orders.routes';
import { productsRoutes as featureProductsRoutes } from '../features/products/api/products.routes';
import { pushRoutes } from '../features/push/api/push.routes';
import { sellerManagementRoutes } from '../features/seller/api/seller-management.routes';
import { sellerPinRoutes } from '../features/seller/api/seller-pin.routes';
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
import { multiPlatformRoutes } from '../features/multi-platform/api/multi-platform.routes';
import youtubeChatRoutes from '../features/youtube/api/youtube-chat.routes';
import { liveSseRoutes, chatRoutes } from './routes/live-sse.routes';
import { cafe24Routes } from '../features/cafe24/api/cafe24.routes';

import { ALLOWED_ORIGINS, FIREBASE_RTDB_URL, FIREBASE_APP_URL } from '../shared/constants';
import { requireAdmin } from './middleware/auth';
import { adminIpWhitelist, adminAuditMiddleware } from './middleware/admin-security';
import { rateLimit } from './middleware/rate-limit';
import { hashPassword } from '../lib/password';
import { botProtection } from './middleware/bot-detection';
import { bodyLimit } from './middleware/body-limit';
import { csrfProtection, csrfTokenHandler } from '../lib/csrf';

// 🛡️ 2026-04-26: 파일 중간 import 를 상단으로 이동 (CLAUDE.md 금지 패턴 — 2026-04-22 사고 재발 방지)
import { blogRoutes } from '../features/blog/api/blog.routes';
import { agencyRoutes } from '../features/agency/api/agency.routes';
import { agencyPinRoutes } from '../features/agency/api/agency-pin.routes';
import { agencyCampaignsRoutes, recomputeAllActiveCampaigns } from '../features/agency/api/agency-campaigns.routes';
import { agencyIncentivesRoutes, calculateAllAgencyIncentives } from '../features/agency/api/agency-incentives.routes';
import { adminAgencyRoutes } from '../features/admin/api/admin-agency.routes';
import { adminAgencyApprovalsRoutes } from '../features/admin/api/admin-agency-approvals.routes';
import { proxyRoutes } from './routes/proxy.routes';
import { bundlePublicRoutes, bundleSellerRoutes, bundleCartRoutes } from '../features/bundles/api/bundle.routes';
import { guideRoutes } from '../features/guides/api/guide.routes';
import { inviteRewardRoutes } from '../features/referral/api/invite-reward.routes';
import { referralTreeRoutes } from '../features/referral/api/referral-tree.routes';
import { reportsRoutes } from '../features/reports/api/reports.routes';
import { broadcastNotifyRoutes } from '../features/broadcast-notify/api/broadcast-notify.routes';
import { loyaltyRoutes } from '../features/loyalty/api/loyalty.routes';
import { interestRoutes } from '../features/loyalty/api/interest.routes';
import { kakaoSocialRoutes } from '../features/kakao-social/api/kakao-social.routes';
import { affiliateRoutes } from '../features/affiliate/api/affiliate.routes';
import { adminToolsRoutes } from '../features/admin/api/admin-tools.routes';
import { adminMetricsRoutes } from '../features/admin/api/admin-metrics.routes';
import { blogRoutes as adminBlogRoutes } from '../features/blog/api/blog.routes';
import { restaurantSettlementRoutes, sellerSettlementRoutes } from '../features/settlement/api/restaurant-settlement.routes';
import { pointsRoutes } from '../features/points/api/points.routes';
import { shortsRoutes } from '../features/shorts/api/shorts.routes';
import { groupBuyRoutes } from '../features/group-buy/api/group-buy.routes';
import { couponRoutes } from '../features/coupons/api/coupons.routes';
import { socialRoutes } from '../features/social/api/social.routes';
import { reviewsRoutes } from '../features/reviews/api/reviews.routes';
import { sellerTiersRoutes } from '../features/seller-tiers/api/seller-tiers.routes';
import { inventoryRoutes } from '../features/inventory/api/inventory.routes';
import { sectionsRoutes } from '../features/sections/api/sections.routes';
import { youtubeGrowthRoutes, youtubeGrowthAdminRoutes } from '../features/youtube-growth/api/youtube-growth.routes';
import { dashboardNotificationsRoutes } from '../features/notifications/api/dashboard-notifications.routes';
import { bulkUploadRoutes } from '../features/bulk-upload/api/bulk-upload.routes';
import { returnsRoutes } from '../features/returns/api/returns.routes';
import { auctionRoutes } from '../features/auction/api/auction.routes';
import { timedealRoutes } from '../features/timedeal/api/timedeal.routes';
import { communityGroupBuyRoutes } from '../features/community-group-buy/api/community-group-buy.routes';
import { referralRoutes } from '../features/referral/api/referral.routes';
import { handleScheduled } from './cron/scheduled-cleanup';
import { handleAutoSettlement, handleExpiredVoucherRefunds } from './cron/auto-settlement';
import { runReconciliation } from './cron/reconciliation';
import { runDailySelfDiagnostic } from './cron/daily-self-diagnostic';
import { handleAgencyAutoSettle } from './cron/agency-auto-settle';

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

// 🔒 2026-04-22: 인증 필요 엔드포인트는 CDN 캐싱 금지
// auth.routes.ts 의 /me, /orders, /cart 등 개인화된 응답이 CDN 에 캐싱되면
// 다른 유저에게 노출될 수 있음 (계정 탈취와 동급의 정보 유출).
function privateNoCache() {
  return async (c: Context, next: Next) => {
    await next();
    c.header('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Vary', 'Authorization, Cookie');
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

// 🆔 Request ID 미들웨어 (2026-04-22 추가)
// CF ray ID 또는 crypto.randomUUID() 로 고유 ID 부여 후 response 헤더로 반환.
// 장애 발생 시 사용자가 이 ID 만 알려주면 Cloudflare Logs 에서 즉시 해당 요청 추적 가능.
app.use('*', async (c, next) => {
  const rayId = c.req.header('CF-Ray') || crypto.randomUUID();
  c.set('requestId' as never, rayId);
  await next();
  c.header('X-Request-Id', rayId);
});

// 🚨 5xx 스파이크 자동 감지 + Discord 알림 (1인 운영자용)
app.use('/api/*', errorRateMonitor());

app.use('*', async (c, next) => {
  await next();
  // 🛡️ 2026-04-22: CSP nonce — 요청별 랜덤 nonce 로 inline script 허용 범위 제한.
  // 'unsafe-inline' 은 nonce 미지원 구형 브라우저용 fallback (CSP2+ 는 nonce 우선).
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes)).replace(/[+/=]/g, '');

  // Content-Security-Policy — worker-src blob: allows Web Workers from blob URLs
  // CSP — 공통 script sources (script-src와 script-src-elem에서 공유)
  // 🛡️ 2026-04-22 배치 121: strict-dynamic 재도입 + HTMLRewriter 가 모든 script 태그
  //   (inline & external src) 에 nonce 부여. 지난번 실패 원인: 외부 src script 에 nonce
  //   누락 → strict-dynamic 이 차단. 이번엔 HTMLRewriter 를 확장하여 script[src] 도 포함.
  //
  // 구성:
  //   - CSP3 브라우저: strict-dynamic 이 host allowlist 무시, nonce 만 신뢰. dynamic import()
  //     로 로드되는 chunk 는 부모 script 의 nonce 자동 propagation.
  //   - CSP2 브라우저: strict-dynamic 무시 → host allowlist 로 fallback.
  //   - 둘 다 unsafe-inline 도 설정되지만 CSP3 에서는 nonce 존재 시 자동 무시됨.
  const scriptSources = [
    "'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "'unsafe-inline'", "blob:",
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
  // 2026-04-22 추가: Spectre-class 공격 차단 + cross-origin 이슈 방지
  c.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups'); // 카카오/구글 OAuth 팝업 허용
  c.header('Cross-Origin-Resource-Policy', 'same-site');
  c.header('X-Permitted-Cross-Domain-Policies', 'none'); // Flash/PDF 크로스도메인 차단

  // 🛡️ 2026-04-22 배치 121: HTML 응답에 nonce 주입 — 모든 <script> (inline & external src).
  //   strict-dynamic + nonce 조합: 신뢰된 script 가 dynamic 하게 로드하는 하위 script 는
  //   브라우저가 자동으로 nonce propagation (createElement('script') 케이스).
  const ct = c.res.headers.get('Content-Type') || '';
  if (ct.includes('text/html') && c.res.body) {
    const rewritten = new HTMLRewriter()
      .on('script', {
        element(el) { el.setAttribute('nonce', nonce); },
      })
      .transform(c.res);
    c.res = new Response(rewritten.body, rewritten);
  }
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
    // 🛡️ 2026-04-22: CSP 위반 DB 저장 — 어드민이 이상 패턴 분석 가능.
    // 테이블은 auto-create (마이그레이션 미적용 환경 호환).
    if (report && c.env.DB) {
      try {
        await c.env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS csp_violations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            blocked_uri TEXT,
            violated_directive TEXT,
            document_uri TEXT,
            source_file TEXT,
            line_number INTEGER,
            user_agent TEXT,
            ip TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `).run();
        const body = (report as any)['csp-report'] || report;
        await c.env.DB.prepare(`
          INSERT INTO csp_violations
            (blocked_uri, violated_directive, document_uri, source_file, line_number, user_agent, ip)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          String(body?.['blocked-uri'] || body?.blockedURL || '').slice(0, 500),
          String(body?.['violated-directive'] || body?.effectiveDirective || '').slice(0, 200),
          String(body?.['document-uri'] || body?.documentURL || '').slice(0, 500),
          String(body?.['source-file'] || body?.sourceFile || '').slice(0, 500),
          Number(body?.['line-number'] || body?.lineNumber || 0) || null,
          (c.req.header('User-Agent') || '').slice(0, 300),
          c.req.header('CF-Connecting-IP') || '',
        ).run();
      } catch { /* DB 실패도 CSP 에 영향 주지 않음 */ }
    }
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

// ============================================================
// 🔒 BOOTSTRAP: 대시보드 비밀번호 재설정
//   2026-04-22 배치 134: fixed 모드 제거 (배치 125 의 임시 동작).
//   로그인 복구 완료 후 보안 복원 — 이제 BOOTSTRAP_TOKEN secret 세팅 필수.
//   미세팅 시 404 로 엔드포인트 자체 숨김.
//
// 사용법:
//   curl -X POST https://live.ur-team.com/api/_bootstrap/reset-dashboard-password \
//     -H "X-Bootstrap-Token: <BOOTSTRAP_TOKEN>" \
//     -H "Content-Type: application/json" \
//     -d '{"email":"...","password":"...","role":"all|admin|seller|agency"}'
// ============================================================
app.post('/api/_bootstrap/reset-dashboard-password', async (c) => {
  const expected = (c.env as any).BOOTSTRAP_TOKEN as string | undefined;
  const provided = c.req.header('X-Bootstrap-Token');

  // BOOTSTRAP_TOKEN 미세팅 or 헤더 불일치 → 404 (엔드포인트 존재 감추기)
  if (!expected || !provided || expected !== provided) {
    return c.json({ error: 'Not Found' }, 404);
  }

  let body: { email?: string; password?: string; role?: string } = {};
  try { body = await c.req.json(); } catch { body = {}; }
  const { email, password, role = 'all' } = body;

  if (!email || !password) {
    return c.json({ success: false, error: 'email, password 필수' }, 400);
  }
  if (password.length < 6) {
    return c.json({ success: false, error: '비밀번호 6자 이상' }, 400);
  }

  // 서버 자체의 hashPassword() 사용 → verifyPassword 와 100% 호환
  const { hashPassword } = await import('../lib/password');
  const hash = await hashPassword(password);

  const DB = c.env.DB;
  const results: Record<string, { updated: number; status?: string }> = {};

  const targets = role === 'all' ? ['admins', 'sellers', 'agencies'] : [`${role}s`];

  for (const table of targets) {
    try {
      const activeValue = table === 'sellers' ? 'approved' : 'active';
      const sql = table === 'sellers'
        ? `UPDATE ${table} SET password_hash = ?, status = ?, is_active = 1 WHERE email = ?`
        : `UPDATE ${table} SET password_hash = ?, status = ? WHERE email = ?`;
      const res = await DB.prepare(sql).bind(hash, activeValue, email).run();
      results[table] = { updated: res.meta.changes ?? 0, status: activeValue };
    } catch (e: any) {
      results[table] = { updated: 0, status: `ERROR: ${e.message}` };
    }
  }

  try { await DB.prepare("DELETE FROM account_lockouts").run(); } catch {}

  return c.json({ success: true, results, hashLength: hash.length });
});

// 클라이언트 빌드 버전 확인 — index.html의 스크립트 해시를 서버가 알려줌
// 프론트가 자신의 번들 해시와 비교해서 불일치 시 자동 리로드
// ============================================================
// 🩺 상세 헬스 대시보드 (2026-04-22 추가)
// GET /api/_internal/health-dashboard
// DB latency, 테이블 행 수, 최근 에러 수, 배포 시점 등 운영자용 종합 지표
// ============================================================
// 🛡️ 2026-04-22: admin 전용 (또는 INTERNAL_OPS_TOKEN 헤더 매치).
// 이전: 누구나 호출 가능 → DB 스키마 조작, 내부 구조 노출 위험.
app.get('/api/_internal/health-dashboard', requireAdmin(), async (c) => {
  const env = c.env as any;
  const DB = env.DB as D1Database;
  const start = Date.now();

  // DB latency 측정
  let dbLatency = 0;
  let dbOk = false;
  try {
    const t0 = Date.now();
    await DB.prepare('SELECT 1').first();
    dbLatency = Date.now() - t0;
    dbOk = true;
  } catch {}

  // 주요 테이블 행 수
  const tableCounts: Record<string, number | null> = {};
  const tablesToCheck = ['users', 'sellers', 'products', 'orders', 'live_streams'];
  for (const t of tablesToCheck) {
    try {
      const row = await DB.prepare(`SELECT COUNT(*) as c FROM ${t}`).first<{ c: number }>();
      tableCounts[t] = row?.c ?? null;
    } catch {
      tableCounts[t] = null;
    }
  }

  // 최근 24시간 주문/결제 건수
  let recentOrders = 0;
  let recentPaidOrders = 0;
  try {
    const o = await DB.prepare(
      "SELECT COUNT(*) as c FROM orders WHERE created_at >= datetime('now', '-24 hours')"
    ).first<{ c: number }>();
    recentOrders = o?.c ?? 0;
    const p = await DB.prepare(
      "SELECT COUNT(*) as c FROM orders WHERE created_at >= datetime('now', '-24 hours') AND payment_status = 'approved'"
    ).first<{ c: number }>();
    recentPaidOrders = p?.c ?? 0;
  } catch {}

  // 환경 변수 sanity
  const envCheck = {
    JWT_SECRET: !!env.JWT_SECRET,
    REFRESH_TOKEN_SECRET: !!env.REFRESH_TOKEN_SECRET,
    KAKAO_REST_API_KEY: !!env.KAKAO_REST_API_KEY,
    FIREBASE_PRIVATE_KEY: !!env.FIREBASE_PRIVATE_KEY,
    TOSS_SECRET_KEY: !!env.TOSS_SECRET_KEY,
    RESEND_WEBHOOK_SECRET: !!env.RESEND_WEBHOOK_SECRET,
    INTERNAL_CRON_TOKEN: !!env.INTERNAL_CRON_TOKEN,
  };
  const secretsTotal = Object.keys(envCheck).length;
  const secretsSet = Object.values(envCheck).filter(Boolean).length;

  // Slow query 통계 (24h)
  let slowQueries: Array<{ label: string; count: number; avg_ms: number; max_ms: number }> = [];
  try {
    const { getSlowQueryStats } = await import('./utils/slow-query-logger');
    slowQueries = await getSlowQueryStats(DB, 24);
  } catch {}

  // 최근 5xx spike 기록
  let recent5xxSpikes = 0;
  try {
    const row = await DB.prepare(
      "SELECT COUNT(*) as c FROM rate_limit_attempts WHERE action='5xx_spike' AND window_start >= ?"
    ).bind(Math.floor(Date.now() / 1000) - 86400).first<{ c: number }>();
    recent5xxSpikes = row?.c ?? 0;
  } catch {}

  return c.json({
    timestamp: new Date().toISOString(),
    totalDurationMs: Date.now() - start,
    db: {
      status: dbOk ? 'healthy' : 'unhealthy',
      latencyMs: dbLatency,
      latencyGrade: dbLatency < 50 ? 'excellent' : dbLatency < 200 ? 'good' : dbLatency < 500 ? 'slow' : 'critical',
    },
    tables: tableCounts,
    traffic: {
      last24hOrders: recentOrders,
      last24hPaidOrders: recentPaidOrders,
      conversionPct: recentOrders > 0 ? Math.round((recentPaidOrders / recentOrders) * 100) : 0,
    },
    secrets: {
      total: secretsTotal,
      configured: secretsSet,
      missing: Object.entries(envCheck).filter(([, v]) => !v).map(([k]) => k),
      health: secretsSet === secretsTotal ? 'complete' : 'incomplete',
    },
    performance: {
      slowQueriesLast24h: slowQueries.length,
      topSlow: slowQueries.slice(0, 5),
    },
    errors: {
      spikesLast24h: recent5xxSpikes,
    },
  });
});

let _cachedBuildVersion: { version: string; fetchedAt: number } | null = null;
// ============================================================
// 🌐 Dynamic Sitemap.xml (2026-04-22 추가)
// 기존 정적 public/sitemap.xml 은 상품/스트림 누락 + 7일 stale.
// 서버가 현재 DB 상태로 매번 생성 → 검색엔진이 항상 최신 인덱싱.
// ============================================================
app.get('/sitemap.xml', async (c) => {
  const origin = new URL(c.req.url).origin;
  const DB = c.env.DB as D1Database | undefined;
  const urls: Array<{ loc: string; priority: number; changefreq: string }> = [
    // 정적 페이지
    { loc: '/', priority: 1.0, changefreq: 'daily' },
    { loc: '/browse', priority: 0.9, changefreq: 'daily' },
    { loc: '/live', priority: 0.9, changefreq: 'hourly' },
    { loc: '/shorts', priority: 0.8, changefreq: 'hourly' },
    { loc: '/search', priority: 0.7, changefreq: 'weekly' },
    { loc: '/login', priority: 0.5, changefreq: 'monthly' },
    { loc: '/blog', priority: 0.6, changefreq: 'daily' },
  ];

  if (DB) {
    try {
      // 활성 상품 최신 500개
      const products = await DB.prepare(
        `SELECT id FROM products WHERE is_active = 1 ORDER BY id DESC LIMIT 500`
      ).all<{ id: number }>();
      for (const p of products.results || []) {
        urls.push({ loc: `/products/${p.id}`, priority: 0.8, changefreq: 'weekly' });
      }

      // 활성 셀러 공개 프로필
      const sellers = await DB.prepare(
        `SELECT id, username FROM sellers WHERE status = 'approved' ORDER BY id DESC LIMIT 200`
      ).all<{ id: number; username: string }>();
      for (const s of sellers.results || []) {
        urls.push({ loc: `/s/${s.username || s.id}`, priority: 0.7, changefreq: 'weekly' });
      }

      // 최근 라이브 스트림
      const streams = await DB.prepare(
        `SELECT id FROM live_streams WHERE status IN ('live','scheduled','ended') ORDER BY id DESC LIMIT 100`
      ).all<{ id: number }>();
      for (const s of streams.results || []) {
        urls.push({ loc: `/live/${s.id}`, priority: 0.6, changefreq: 'hourly' });
      }

      // 블로그 글
      const blogs = await DB.prepare(
        `SELECT slug FROM blog_posts WHERE published = 1 ORDER BY id DESC LIMIT 100`
      ).all<{ slug: string }>().catch(() => ({ results: [] as { slug: string }[] }));
      for (const b of blogs.results || []) {
        if (b.slug) urls.push({ loc: `/blog/${b.slug}`, priority: 0.5, changefreq: 'monthly' });
      }
    } catch {
      // DB 쿼리 실패해도 정적 URL 은 응답
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${origin}${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;

  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  });
});

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
// Migration 버전 추적 — 매 repair-schema 호출 시 현재 상태 기록.
// CI 에서 D1 권한 받으면 정식 migration runner 로 전환하고 이 엔드포인트는 deprecate.
async function ensureMigrationTrackingTable(DB: D1Database) {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS _migration_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      details TEXT,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run().catch(() => {});
}

// ============================================================
// 🔑 어드민 복구 엔드포인트 (INTERNAL_API_TOKEN 보호)
// POST /api/_internal/clear-rate-limit  — rate limit 초기화
// POST /api/_internal/reset-admin-password — 어드민 비밀번호 초기화
// 사용법: X-Internal-Token: <INTERNAL_API_TOKEN 값> 헤더 필요
// ============================================================

app.post('/api/_internal/clear-rate-limit', async (c) => {
  const env = c.env as any;
  const opsToken: string | undefined = env.INTERNAL_API_TOKEN;
  const reqToken = c.req.header('X-Internal-Token');
  if (!opsToken || opsToken !== reqToken) return c.json({ success: false, error: 'Forbidden' }, 403);
  const DB = env.DB as D1Database;
  const body = await c.req.json<{ action?: string; ip?: string }>().catch(() => ({} as { action?: string; ip?: string }));
  const action = body.action || 'admin_login';
  if (body.ip) {
    await DB.prepare('DELETE FROM rate_limit_attempts WHERE key = ? AND action = ?')
      .bind(`${action}:${body.ip}`, action).run();
  } else {
    await DB.prepare('DELETE FROM rate_limit_attempts WHERE action = ?').bind(action).run();
  }
  return c.json({ success: true, message: `Rate limit cleared for action: ${action}` });
});

app.post('/api/_internal/reset-admin-password', async (c) => {
  const env = c.env as any;
  const opsToken: string | undefined = env.INTERNAL_API_TOKEN;
  const reqToken = c.req.header('X-Internal-Token');
  if (!opsToken || opsToken !== reqToken) return c.json({ success: false, error: 'Forbidden' }, 403);
  const DB = env.DB as D1Database;
  const body = await c.req.json<{ email: string; newPassword: string }>().catch(() => ({ email: '', newPassword: '' }));
  if (!body.email || !body.newPassword) return c.json({ success: false, error: 'email and newPassword required' }, 400);
  const hash = await hashPassword(body.newPassword);
  const result = await DB.prepare('UPDATE admins SET password_hash = ? WHERE email = ?')
    .bind(hash, body.email).run();
  if ((result.meta as any).changes === 0) return c.json({ success: false, error: 'Admin not found' }, 404);
  return c.json({ success: true, message: 'Password reset successful. Login with the new password.' });
});

// 🛡️ 2026-04-22: admin 전용. 이전: 공개 → 누구나 DB 스키마 수정 가능 (CRITICAL)
app.get('/api/_internal/repair-schema', requireAdmin(), async (c) => {
  const env = c.env as any;
  const DB = env.DB as D1Database;
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500);
  await ensureMigrationTrackingTable(DB);

  const stmts: Array<{ desc: string; sql: string }> = [
    // ── sellers ────────────────────────────────────
    { desc: 'sellers.commission_rate', sql: "ALTER TABLE sellers ADD COLUMN commission_rate REAL DEFAULT 10.00" },
    { desc: 'sellers.seller_type', sql: "ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'" },
    { desc: 'sellers.business_number', sql: "ALTER TABLE sellers ADD COLUMN business_number TEXT" },
    { desc: 'sellers.phone', sql: "ALTER TABLE sellers ADD COLUMN phone TEXT" },
    { desc: 'sellers.bank_account', sql: "ALTER TABLE sellers ADD COLUMN bank_account TEXT" },
    { desc: 'sellers.last_login_at', sql: "ALTER TABLE sellers ADD COLUMN last_login_at TEXT" },
    { desc: 'sellers.kakao_chat_url', sql: "ALTER TABLE sellers ADD COLUMN kakao_chat_url TEXT" },
    { desc: 'sellers.base_shipping_fee', sql: "ALTER TABLE sellers ADD COLUMN base_shipping_fee INTEGER DEFAULT 3000" },
    { desc: 'sellers.shipping_fee', sql: "ALTER TABLE sellers ADD COLUMN shipping_fee INTEGER DEFAULT 3000" },
    { desc: 'sellers.free_shipping_threshold', sql: "ALTER TABLE sellers ADD COLUMN free_shipping_threshold INTEGER DEFAULT 50000" },
    { desc: 'sellers.profile_image', sql: "ALTER TABLE sellers ADD COLUMN profile_image TEXT" },
    { desc: 'sellers.bio', sql: "ALTER TABLE sellers ADD COLUMN bio TEXT" },
    { desc: 'sellers.youtube_channel', sql: "ALTER TABLE sellers ADD COLUMN youtube_channel TEXT" },
    { desc: 'sellers.youtube_email', sql: "ALTER TABLE sellers ADD COLUMN youtube_email TEXT" },
    { desc: 'sellers.agency_id', sql: "ALTER TABLE sellers ADD COLUMN agency_id INTEGER" },
    { desc: 'sellers.approved_by', sql: "ALTER TABLE sellers ADD COLUMN approved_by INTEGER" },
    { desc: 'sellers.approved_at', sql: "ALTER TABLE sellers ADD COLUMN approved_at DATETIME" },

    // ── admins ─────────────────────────────────────
    { desc: 'admins.role', sql: "ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'admin'" },
    { desc: 'admins.is_active', sql: "ALTER TABLE admins ADD COLUMN is_active INTEGER DEFAULT 1" },
    { desc: 'admins.last_login_at', sql: "ALTER TABLE admins ADD COLUMN last_login_at TEXT" },

    // ── users (CRITICAL — 감사에서 발견) ─────────────
    { desc: 'users.password_hash', sql: "ALTER TABLE users ADD COLUMN password_hash TEXT" },
    { desc: 'users.last_login_at', sql: "ALTER TABLE users ADD COLUMN last_login_at TEXT" },
    { desc: 'users.firebase_uid', sql: "ALTER TABLE users ADD COLUMN firebase_uid TEXT" },
    { desc: 'users.user_type', sql: "ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'buyer'" },
    { desc: 'users.kakao_access_token', sql: "ALTER TABLE users ADD COLUMN kakao_access_token TEXT" },
    { desc: 'users.kakao_refresh_token', sql: "ALTER TABLE users ADD COLUMN kakao_refresh_token TEXT" },
    { desc: 'users.profile_image', sql: "ALTER TABLE users ADD COLUMN profile_image TEXT" },

    // ── products ───────────────────────────────────
    { desc: 'products.view_count', sql: "ALTER TABLE products ADD COLUMN view_count INTEGER DEFAULT 0" },
    { desc: 'products.avg_rating', sql: "ALTER TABLE products ADD COLUMN avg_rating REAL DEFAULT 0" },
    { desc: 'products.review_count', sql: "ALTER TABLE products ADD COLUMN review_count INTEGER DEFAULT 0" },
    { desc: 'products.sold_count', sql: "ALTER TABLE products ADD COLUMN sold_count INTEGER DEFAULT 0" },
    // 🛡️ 2026-04-22 배치 114: stock_quantity ALTER 제거 — 신규 환경에서 중복 컬럼 생성 방지.
    //   기존 `stock` 컬럼을 단일 truth source 로 사용. 이미 stock_quantity 가 있는 환경은
    //   코드의 fallback (`p.stock ?? p.stock_quantity`) 로 하위 호환.
    { desc: 'products.product_type', sql: "ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'regular'" },
    { desc: 'products.slug', sql: "ALTER TABLE products ADD COLUMN slug TEXT" },
    { desc: 'products.is_active', sql: "ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1" },
    { desc: 'products.thumbnail', sql: "ALTER TABLE products ADD COLUMN thumbnail TEXT" },

    // ── orders ─────────────────────────────────────
    { desc: 'orders.recipient_name', sql: "ALTER TABLE orders ADD COLUMN recipient_name TEXT" },
    { desc: 'orders.recipient_phone', sql: "ALTER TABLE orders ADD COLUMN recipient_phone TEXT" },
    { desc: 'orders.shipping_postal_code', sql: "ALTER TABLE orders ADD COLUMN shipping_postal_code TEXT" },
    { desc: 'orders.shipping_address', sql: "ALTER TABLE orders ADD COLUMN shipping_address TEXT" },
    { desc: 'orders.shipping_address_detail', sql: "ALTER TABLE orders ADD COLUMN shipping_address_detail TEXT" },
    { desc: 'orders.refunded_amount', sql: "ALTER TABLE orders ADD COLUMN refunded_amount INTEGER DEFAULT 0" },
    { desc: 'orders.payment_status', sql: "ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending'" },
    { desc: 'orders.cancel_reason', sql: "ALTER TABLE orders ADD COLUMN cancel_reason TEXT" },
    { desc: 'orders.payment_method', sql: "ALTER TABLE orders ADD COLUMN payment_method TEXT" },
    { desc: 'orders.paid_at', sql: "ALTER TABLE orders ADD COLUMN paid_at DATETIME" },
    { desc: 'orders.shipped_at', sql: "ALTER TABLE orders ADD COLUMN shipped_at DATETIME" },
    { desc: 'orders.delivered_at', sql: "ALTER TABLE orders ADD COLUMN delivered_at DATETIME" },

    // ── order_items ────────────────────────────────
    { desc: 'order_items.product_name', sql: "ALTER TABLE order_items ADD COLUMN product_name TEXT" },
    { desc: 'order_items.product_thumbnail', sql: "ALTER TABLE order_items ADD COLUMN product_thumbnail TEXT" },
    { desc: 'order_items.product_sku', sql: "ALTER TABLE order_items ADD COLUMN product_sku TEXT" },
    { desc: 'order_items.price', sql: "ALTER TABLE order_items ADD COLUMN price INTEGER" },

    // ── shipping_addresses ─────────────────────────
    { desc: 'shipping_addresses.label', sql: "ALTER TABLE shipping_addresses ADD COLUMN label TEXT" },
    { desc: 'shipping_addresses.delivery_note', sql: "ALTER TABLE shipping_addresses ADD COLUMN delivery_note TEXT" },
    { desc: 'shipping_addresses.entry_code', sql: "ALTER TABLE shipping_addresses ADD COLUMN entry_code TEXT" },
    { desc: 'shipping_addresses.entry_method', sql: "ALTER TABLE shipping_addresses ADD COLUMN entry_method TEXT" },
    { desc: 'shipping_addresses.country', sql: "ALTER TABLE shipping_addresses ADD COLUMN country TEXT DEFAULT 'KR'" },

    // ── live_streams ───────────────────────────────
    { desc: 'live_streams.current_viewers', sql: "ALTER TABLE live_streams ADD COLUMN current_viewers INTEGER DEFAULT 0" },
    { desc: 'live_streams.total_viewers', sql: "ALTER TABLE live_streams ADD COLUMN total_viewers INTEGER DEFAULT 0" },
    { desc: 'live_streams.like_count', sql: "ALTER TABLE live_streams ADD COLUMN like_count INTEGER DEFAULT 0" },
    // 2026-04-23 배치 164: 라이브 분석 정확도 개선 (P1)
    { desc: 'live_streams.peak_viewers', sql: "ALTER TABLE live_streams ADD COLUMN peak_viewers INTEGER DEFAULT 0" },
    { desc: 'live_stream_views.last_heartbeat', sql: "ALTER TABLE live_stream_views ADD COLUMN last_heartbeat TEXT" },
    { desc: 'idx_lsv_stream_session', sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_lsv_stream_session ON live_stream_views(live_stream_id, session_id)" },
    { desc: 'idx_lsv_stream_heartbeat', sql: "CREATE INDEX IF NOT EXISTS idx_lsv_stream_heartbeat ON live_stream_views(live_stream_id, last_heartbeat)" },

    // ── donations ──────────────────────────────────
    { desc: 'donations.payment_status', sql: "ALTER TABLE donations ADD COLUMN payment_status TEXT DEFAULT 'pending'" },
    { desc: 'donations.amount', sql: "ALTER TABLE donations ADD COLUMN amount INTEGER DEFAULT 0" },
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

  // 부수적: 자주 사용되는 보조 테이블 보장 (static code audit 확장)
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
    { name: 'refresh_tokens', sql: `CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'product_reviews', sql: `CREATE TABLE IF NOT EXISTS product_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      order_id INTEGER,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      title TEXT,
      content TEXT,
      images TEXT,
      is_hidden INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'order_refund_history', sql: `CREATE TABLE IF NOT EXISTS order_refund_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      refund_amount INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'user_points', sql: `CREATE TABLE IF NOT EXISTS user_points (
      user_id INTEGER PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'point_transactions', sql: `CREATE TABLE IF NOT EXISTS point_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'coupons', sql: `CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT NOT NULL,
      discount_value INTEGER NOT NULL,
      min_purchase INTEGER DEFAULT 0,
      max_discount INTEGER,
      valid_from DATETIME,
      valid_until DATETIME,
      max_uses INTEGER,
      used_count INTEGER DEFAULT 0,
      seller_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'user_coupons', sql: `CREATE TABLE IF NOT EXISTS user_coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      coupon_id INTEGER NOT NULL,
      used INTEGER DEFAULT 0,
      used_at DATETIME,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'wishlists', sql: `CREATE TABLE IF NOT EXISTS wishlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id)
    )` },
    { name: 'agencies', sql: `CREATE TABLE IF NOT EXISTS agencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      commission_rate REAL DEFAULT 5.0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    // 🚀 인덱스 추가 (2026-04-22 static audit 결과 — 셀러 대시보드 쿼리 500ms → 50ms)
    { name: 'idx_orders_seller_status_v2', sql: `CREATE INDEX IF NOT EXISTS idx_orders_seller_status_v2 ON orders(seller_id, status)` },
    { name: 'idx_donations_seller_payment_status', sql: `CREATE INDEX IF NOT EXISTS idx_donations_seller_payment_status ON donations(seller_id, payment_status)` },
    { name: 'idx_orders_live_stream_status', sql: `CREATE INDEX IF NOT EXISTS idx_orders_live_stream_status ON orders(live_stream_id, status)` },
    { name: 'idx_orders_user_id', sql: `CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)` },
    { name: 'idx_cart_user_id', sql: `CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart_items(user_id)` },
    { name: 'idx_products_seller_id', sql: `CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id)` },
    { name: 'idx_wishlists_user_id', sql: `CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists(user_id)` },
    { name: 'shipping_addresses', sql: `CREATE TABLE IF NOT EXISTS shipping_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recipient_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      postal_code TEXT,
      address TEXT NOT NULL,
      address_detail TEXT,
      is_default INTEGER DEFAULT 0,
      country TEXT DEFAULT 'KR',
      label TEXT,
      delivery_note TEXT,
      entry_code TEXT,
      entry_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    // 🛡️ 2026-04-23 배치 169: 번들(세트) 상품
    { name: 'product_bundles', sql: `CREATE TABLE IF NOT EXISTS product_bundles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      seller_id INTEGER NOT NULL,
      discount_type TEXT DEFAULT 'percent' CHECK(discount_type IN ('percent', 'fixed')),
      discount_value REAL DEFAULT 0,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES sellers(id)
    )` },
    { name: 'product_bundle_items', sql: `CREATE TABLE IF NOT EXISTS product_bundle_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bundle_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (bundle_id) REFERENCES product_bundles(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )` },
    // 🛡️ 2026-04-23 배치 174: 운영 가이드 테이블 (어드민/셀러/에이전시)
    { name: 'operation_guides', sql: `CREATE TABLE IF NOT EXISTS operation_guides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guide_type TEXT NOT NULL CHECK(guide_type IN ('admin', 'seller', 'agency')),
      section_key TEXT NOT NULL,
      section_icon TEXT,
      section_title TEXT NOT NULL,
      section_order INTEGER DEFAULT 0,
      content_md TEXT NOT NULL,
      updated_by INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(guide_type, section_key)
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

// ============================================================
// 🩺 전수조사 스모크 테스트
// GET /api/_internal/smoke-test
// 모든 공개 API를 내부 fetch 로 호출하고 5xx 여부 리포트.
// 인증 필요 없는 엔드포인트만 테스트 (401은 정상으로 간주).
// ============================================================
// 🛡️ 2026-04-22: admin 전용. 내부 엔드포인트 구조 노출 차단.
app.get('/api/_internal/smoke-test', requireAdmin(), async (c) => {
  const origin = new URL(c.req.url).origin;
  // 🛡️ Cloudflare Workers 의 subrequest 제한(50/invocation) 회피를 위해 chunk 지원.
  // /api/_internal/smoke-test          → 자동으로 처음 45개만
  // /api/_internal/smoke-test?chunk=1  → 46~끝
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

  // ── chunk 단위 슬라이스 ────────────────────────────────
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

  // 5xx 실패만 필터해서 bottom 에 요약
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

// ============================================================
// 🩺 인증 스모크 테스트
// GET /api/_internal/smoke-test-auth
// 임시 JWT 토큰을 생성해 보호된 GET 엔드포인트를 호출.
// 5xx = 인증 통과 후 핸들러 자체가 크래시한다는 뜻 → 실패로 카운트.
// ============================================================
app.get('/api/_internal/smoke-test-auth', async (c) => {
  const { sign } = await import('hono/jwt');
  const origin = new URL(c.req.url).origin;
  const jwtSecret = (c.env as any).JWT_SECRET;

  if (!jwtSecret) {
    return c.json({ success: false, error: 'JWT_SECRET not configured' }, 500);
  }

  const now = Math.floor(Date.now() / 1000);

  // Admin token — also works for user-level endpoints
  const adminToken = await sign(
    { sub: '0', email: 'smoke@test.internal', type: 'admin', role: 'super_admin', iat: now, exp: now + 60 },
    jwtSecret
  );

  // Seller token — for seller-scoped endpoints
  const sellerToken = await sign(
    { sub: '0', email: 'smoke@test.internal', type: 'seller', seller_id: 0, iat: now, exp: now + 60 },
    jwtSecret
  );

  const endpoints: Array<{ path: string; token: string; cat: string }> = [
    // ── 어드민 ──────────────────────────────────────────
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

    // ── 유저 (admin token으로 호출 — sub=0) ─────────────
    { cat: 'user', path: '/api/orders', token: adminToken },
    { cat: 'user', path: '/api/cart', token: adminToken },
    { cat: 'user', path: '/api/points/balance', token: adminToken },
    { cat: 'user', path: '/api/points/history', token: adminToken },
    { cat: 'user', path: '/api/notifications', token: adminToken },
    { cat: 'user', path: '/api/shipping-addresses', token: adminToken },
    { cat: 'user', path: '/api/wishlists/0', token: adminToken },

    // ── 셀러 ──────────────────────────────────────────
    { cat: 'seller', path: '/api/seller/orders', token: sellerToken },
    { cat: 'seller', path: '/api/seller/products', token: sellerToken },
  ];

  // Total: 19 subrequests — well within 45 limit

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

// 🔒 인증 필요 엔드포인트 CDN 캐싱 차단 (개인정보 유출 방지)
app.use('/api/auth/me', privateNoCache());
app.use('/api/orders/*', privateNoCache());
app.use('/api/cart/*', privateNoCache());
app.use('/api/wishlists/*', privateNoCache());
app.use('/api/shipping-addresses/*', privateNoCache());
app.use('/api/points/*', privateNoCache());
app.use('/api/notifications/*', privateNoCache());
app.use('/api/account/*', privateNoCache());
app.use('/api/users/*', privateNoCache());
app.use('/api/coupons/*', privateNoCache());
app.use('/api/donations/*', privateNoCache());
app.use('/api/reviews/*', privateNoCache());
app.use('/api/returns/*', privateNoCache());
app.use('/api/referral/*', privateNoCache());

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

// 🛡️ 2026-04-22: 민감 endpoint 에 bot protection 적용 — 자동화 도구 차단
// 합법 bot (Googlebot, Kakao 등) 은 allowlist 로 통과.
app.use('/api/auth/register', botProtection());
app.use('/api/auth/login', botProtection());
app.use('/api/seller/register', botProtection());
app.use('/api/seller/login', botProtection());
app.use('/api/admin/login', botProtection());
app.use('/api/agency/login', botProtection());
app.use('/api/auth/forgot-password', botProtection());
app.use('/api/seller/forgot-password', botProtection());
app.use('/api/agency/forgot-password', botProtection());

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
// 🚀 Edge cache + Cache-Control 동시 적용 (1인 운영 D1 부하 감소)
// edge cache 는 CF edge 에서 응답 캐싱 → D1 쿼리 자체를 우회 → 빠르고 비용 절감
app.use('/api/products', edgeCache(60), cacheControl(60));     // 1 min
app.use('/api/streams', edgeCache(30), cacheControl(30));      // 30 sec
app.use('/api/group-buy/products', edgeCache(60), cacheControl(60)); // 1 min
app.use('/api/banners', edgeCache(300), cacheControl(300));    // 5 min
// 🛡️ 2026-04-22: 추가 공개 read-only 엔드포인트 캐싱 (성능 감사 결과)
app.use('/api/shorts', edgeCache(60), cacheControl(60));                // 쇼츠 피드 1min
app.use('/api/reviews/product/*', edgeCache(120), cacheControl(120));   // 리뷰 목록 2min (리뷰 쓰기는 POST 라 캐시 무영향)
app.use('/api/restaurants', edgeCache(300), cacheControl(300));         // 식당 목록 5min

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
app.route('/api/seller', sellerPinRoutes);
app.route('/api/seller', sellerOrdersRoutes);
app.route('/api/seller/analytics', sellerAnalyticsRoutes);
app.route('/api/seller/streams', sellerStreamsRoutes);

// Email notifications (global)
app.route('/api/email', emailRoutes);

// Affiliate marketing
app.route('/api/affiliate', affiliateRoutes);

// ============================================================
// Order & Payment Routes
// ============================================================

// -------------------------------------------------------
// Order routing: 두 라우터 — 이제 경로 non-overlapping (배치 112).
//
// ordersRouter  → worker/repositories/order.repository.ts (PRIMARY)
//   POST /, GET /, GET /:id, POST /refund, POST /:id/cancel
//
// featureOrdersRoutes → features/orders (delivery tracking & cron)
//   GET /:id/tracking, POST /:id/confirm,
//   POST /internal/auto-confirm, POST /internal/sync-deliveries
//
// 🛡️ 2026-04-22 배치 112: featureOrdersRoutes 의 중복 경로 (GET /, GET /:id, POST /)
//    삭제 완료 → 이제 완전 non-overlapping.
// -------------------------------------------------------
app.route('/api/orders', ordersRouter);
app.route('/api/orders', featureOrdersRoutes);

// -------------------------------------------------------
// Payment routing: /api/payments (single router)
//
// paymentsRouter → POST /confirm, POST /checkout-session, POST /webhook
//
// 과거에 featurePaymentRoutes (/rollback) 가 추가 마운트되어 있었으나,
// 호출처가 0건으로 dead code 확인되어 2026-04-26 제거.
// 결제 취소는 POST /api/orders/:id/cancel 사용.
// -------------------------------------------------------
app.route('/api/payments', paymentsRouter);

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
// 🛡️ 2026-04-26: 에이전시 셀러 심사 큐 (Agency P0 #1)
adminApp.route('/agency-creator-approvals', adminAgencyApprovalsRoutes);
// Admin tools (chart, sellers, banners, notices, settlements, reports, settings)
adminApp.route('/tools', adminToolsRoutes);
// Admin real-time health metrics (active streams, orders/min, stuck orders, webhooks)
adminApp.route('/metrics', adminMetricsRoutes);
adminApp.route('/', adminManagementRoutes);
// 🛡️ 2026-04-22 배치 138 (TD-006 부분): admin-coupons 분리 — admin-management.routes.ts 줄임
adminApp.route('/', adminCouponsRoutes);
// 🛡️ 2026-04-22 배치 141 (TD-006 부분): admin-side-banners 분리
adminApp.route('/', adminSideBannersRoutes);
// 🛡️ 2026-04-22 배치 143 (TD-006 부분): admin-settlements 분리 (가장 큰 섹션 ~296줄)
adminApp.route('/', adminSettlementsRoutes);
// 🛡️ 2026-04-22 배치 144 (TD-006 부분): admin-stats 분리
adminApp.route('/', adminStatsRoutes);
// 🛡️ 2026-04-22 배치 146 (TD-006 부분): admin-sellers 분리 (272줄)
adminApp.route('/', adminSellersRoutes);
// 🛡️ 2026-04-22 배치 148 (TD-006 부분): admin-products + sample-requests 분리
adminApp.route('/', adminProductsRoutes);
// 🛡️ 2026-04-22 배치 149 (TD-006 부분): admin-orders 분리 (~356줄)
adminApp.route('/', adminOrdersRoutes);
// 🛡️ 2026-04-22 배치 150 (TD-006 부분): admin-streams + alimtalk 분리
adminApp.route('/', adminStreamsRoutes);
// 🛡️ 2026-04-22 배치 151 (TD-006 부분): admin-accounts (관리자 CRUD) 분리
adminApp.route('/', adminAccountsRoutes);
// 🛡️ 2026-04-22 배치 152 (TD-006 부분): admin-analytics 분리
adminApp.route('/', adminAnalyticsRoutes);
// 🛡️ 2026-04-22 배치 153 (TD-006 부분): admin-moderation (리뷰 + 라이브 모니터) 분리
adminApp.route('/', adminModerationRoutes);
// 🛡️ 2026-04-22 배치 154 (TD-006 부분): admin-users 분리
adminApp.route('/', adminUsersRoutes);
// 🛡️ 2026-04-22 배치 155 (TD-006 부분): admin-misc (donations/deals/commission/audit) 분리
adminApp.route('/', adminMiscRoutes);
// 🛡️ 2026-04-22 배치 156 (TD-006 부분): admin-review-generator 분리
adminApp.route('/', adminReviewGeneratorRoutes);
adminApp.route('/banners', adminBannersRoutes);
// Feature flags / kill-switch (graceful degradation for traffic spikes)
adminApp.route('/flags', adminFlagsRoutes);
adminApp.route('/cafe24', cafe24Routes);
// Blog admin — mounted INSIDE adminApp (requireAdmin + IP whitelist + audit log)
adminApp.route('/blog', adminBlogRoutes);
// Restaurant settlement (admin)
adminApp.route('/restaurant-settlement', restaurantSettlementRoutes);
// Naver Ad Scraper 제거됨 (2026-04-22) — 법적 리스크(PIPA/정보통신망법) + 기술 불안정
// 남은 `/api/scraper/d1/*` 엔드포인트도 단계적 제거. scraped_advertisers 테이블은 데이터 보존 목적으로 남김.

// 🛡️ 2026-04-22: Legacy scraper endpoint 제거 (법적 리스크 + 보안 위험)
// - /api/scraper/d1/emails, /api/scraper/d1/stats 모두 제거
// - 이유: adminApp 미들웨어 체인 (IP whitelist + audit) 을 우회하고 있었음
// - scraped_advertisers 테이블은 데이터 보존용으로 남겨둠 (직접 SQL 조회 가능)
// - 스크래핑 기능은 이미 CLAUDE.md 에 따라 제거됨 (PIPA/정보통신망법 리스크)

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
app.route('/api/points', pointsRoutes);

// ── 쇼츠 ──
app.route('/api/shorts', shortsRoutes);

// ── 공동구매 & 바우처 ──
app.route('/api/group-buy', groupBuyRoutes);
app.route('/api/vouchers', groupBuyRoutes);

// ── 쿠폰 ──
app.route('/api/coupons', couponRoutes);

// ── 소셜 (팔로우 + 알림) ──
app.route('/api/social', socialRoutes);

// ── 상품 리뷰 ──
app.route('/api/reviews', reviewsRoutes);

// ── 셀러 등급 ──
app.route('/api/seller-tiers', sellerTiersRoutes);

// ── 바코드 + 재고 관리 ──
app.route('/api/inventory', inventoryRoutes);

// ── 홈페이지 섹션 관리 ──
app.route('/api/sections', sectionsRoutes);

// ── YouTube 구독자 늘리기 ──
app.route('/api/youtube-growth', youtubeGrowthRoutes);
// SECURITY (HIGH-5): admin 엔드포인트는 adminApp 내부로 별도 마운트 (IP whitelist + audit log)
adminApp.route('/youtube-growth', youtubeGrowthAdminRoutes);

// ── 대시보드 알림 ──
app.route('/api/dashboard-notifications', dashboardNotificationsRoutes);

// ── 상품 대량등록 ──
app.route('/api/bulk-upload', bulkUploadRoutes);

// ── 반품/환불 ──
app.route('/api/returns', returnsRoutes);

// ── 라이브 경매 ──
app.route('/api/auction', auctionRoutes);

// ── 타임딜 룰렛 ──
app.route('/api/timedeal', timedealRoutes);

// ── 유저 공동구매 (커뮤니티) ──
app.use('/api/community-group-buy/create', rateLimit({ action: 'group_buy_create', max: 10, windowSec: 300 }));
app.use('/api/community-group-buy/join/*', rateLimit({ action: 'group_buy_join', max: 20, windowSec: 300 }));
app.route('/api/community-group-buy', communityGroupBuyRoutes);

// ── 친구 초대 공동구매 ──
app.route('/api/referral', referralRoutes);

// ── 초대 보상 ──
app.route('/api/invite', inviteRewardRoutes);

// ── 다단계 추천 커미션 ──
app.route('/api/referral-tree', referralTreeRoutes);

// ── CS 신고 (유저 신고 접수) ──
app.route('/api/reports', reportsRoutes);

// ── 방송 알림 구독 ──
app.route('/api/broadcast-notify', broadcastNotifyRoutes);

// ── VIP 등급 (유저 로열티) ──
app.route('/api/loyalty', loyaltyRoutes);

// ── 관심/알림 (맛집·상품·공동구매 관심 등록) ──
app.route('/api/interest', interestRoutes);

// ── 카카오 소셜 (메시지 + 캘린더) + 글로벌 (.ics) ──
app.route('/api/kakao-social', kakaoSocialRoutes);

// ── 외부 서비스 프록시 (kakao/naver place + image) ──
// 2026-04-26 worker/index.ts 비대화 해소를 위해 src/worker/routes/proxy.routes.ts 로 추출
app.route('/api', proxyRoutes);

// ── 블로그 (어드민 CRUD + 공개 조회) ──
// SECURITY: /api/admin/blog는 adminApp 내부에서 등록되어 requireAdmin + IP 화이트리스트 적용
// /api/blog는 공개 GET /public, /public/:slug만 허용 (나머지는 라우터 내부에서 admin 체크)
app.route('/api/blog', blogRoutes); // public 엔드포인트 접근용 (내부에서 /public만 공개)

// ── 에이전시 ──
app.route('/api/agency', agencyPinRoutes);
app.route('/api/agency', agencyRoutes);
// 🛡️ 2026-04-26: Agency P0 #4 캠페인 관리
app.route('/api/agency/campaigns', agencyCampaignsRoutes);
// 🛡️ 2026-04-26: Agency P0 #5 인센티브 규칙 엔진
app.route('/api/agency/incentives', agencyIncentivesRoutes);
// adminAgencyRoutes는 위에서 adminApp에 등록됨

// 🛡️ 2026-04-23 배치 169: 번들(세트) 상품
app.route('/api/bundles', bundlePublicRoutes);
app.route('/api/bundles', bundleCartRoutes);
app.route('/api/seller/bundles', bundleSellerRoutes);

// 🛡️ 2026-04-23 배치 174: 운영 가이드 (어드민 편집, 셀러/에이전시 읽기)
app.route('/api/guides', guideRoutes);

// YouTube / Live streaming
// Register at both paths for backward-compatibility with older frontend deployments
app.route('/api/seller/youtube', youtubeRoutes);
app.route('/api/youtube', youtubeRoutes); // legacy path alias
app.route('/api/youtube/chat', youtubeChatRoutes);

// 🛡️ 2026-04-23 배치 164: 다중 플랫폼 stub (TikTok / Naver Chzzk / SOOP)
//   GET /api/platforms 로 지원 플랫폼 상태 조회. 미구현 플랫폼은 501 반환.
app.route('/api', multiPlatformRoutes);

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
  // 🛡️ 2026-04-22: radix=10 명시 (legacy octal 해석 방지) + 범위 clamp
  const width = Math.min(2048, Math.max(16, parseInt(c.req.query('w') || '400', 10) || 400));
  const quality = Math.min(100, Math.max(10, parseInt(c.req.query('q') || '80', 10) || 80));

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

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const cron = event.cron;

    // 🛡️ Cron 에러 래퍼 — 실패 시 Discord 알림 (이전엔 silent failure)
    const safeCron = async (name: string, task: () => Promise<unknown>) => {
      try {
        await task();
      } catch (err) {
        const msg = (err as Error)?.message || String(err);
        console.error(`[cron:${name}] FAILED:`, msg);
        const webhook = env.DISCORD_WEBHOOK_URL;
        if (webhook) {
          try {
            const { sendDiscordAlert } = await import('./utils/discord-alert');
            await sendDiscordAlert(webhook, `🔴 Cron Failed: ${name}`, msg.slice(0, 1500), 'error');
          } catch { /* discord 자체 실패는 무시 */ }
        }
      }
    };

    // Every 5 minutes: short cleanup tasks
    if (cron === '*/5 * * * *') {
      ctx.waitUntil(safeCron('scheduled-cleanup', () => handleScheduled(env)));
    }

    // Daily 18:00 UTC (KST 03:00): heavy tasks (settlement + expired-voucher refund + self diagnostic + campaign aggregation)
    if (cron === '0 18 * * *') {
      ctx.waitUntil(safeCron('auto-settlement', () => handleAutoSettlement(env)));
      ctx.waitUntil(safeCron('expired-voucher-refund', () => handleExpiredVoucherRefunds(env)));
      ctx.waitUntil(safeCron('daily-self-diagnostic', () => runDailySelfDiagnostic(env)));
      // 🛡️ 2026-04-26: Agency P0 #4 — 캠페인 상태 전환 + participants 누적 매출 재집계
      ctx.waitUntil(safeCron('agency-campaigns-aggregate', () => recomputeAllActiveCampaigns(env.DB)));
    }

    // Daily 19:00 UTC (KST 04:00): reconciliation
    if (cron === '0 19 * * *') {
      ctx.waitUntil(safeCron('reconciliation', () => runReconciliation(env)));
    }

    // Weekly Monday 00:00 UTC (= KST 09:00): 에이전시 자동 정산 (P0 #3) + 전월 인센티브 계산 (P0 #5)
    if (cron === '0 0 * * 1') {
      ctx.waitUntil(safeCron('agency-auto-settle', () => handleAgencyAutoSettle(env)));
      // 매주 월요일에 전월 인센티브 재계산 (월 1회만 실제 변경, 멱등 — INSERT ON CONFLICT)
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
      ctx.waitUntil(safeCron('agency-incentives-recalc', () => calculateAllAgencyIncentives(env.DB, monthStr)));
    }
  },
};
