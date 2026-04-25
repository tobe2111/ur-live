// ============================================================
// Cloudflare Worker - Main Entry Point (Unified)
// Global Marketplace API — ALL routes consolidated here
// Legacy src/index.tsx has been retired.
// ============================================================

import { Hono } from 'hono';
import type { Context, MiddlewareHandler, Next } from 'hono';
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
import { paymentRoutes as featurePaymentRoutes } from '../features/payments/api/payment.routes';
import { productsRoutes as featureProductsRoutes } from '../features/products/api/products.routes';
import { pushRoutes } from '../features/push/api/push.routes';
import { sellerManagementRoutes } from '../features/seller/api/seller-management.routes';
import { sellerAlimtalkManagementRoutes } from '../features/seller/api/seller-alimtalk-management.routes';
import { sellerKakaoLinkRoutes } from '../features/seller/api/seller-kakao-link.routes';
import { sellerSettlementsManagementRoutes } from '../features/seller/api/seller-settlements-management.routes';
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
import { botProtection } from './middleware/bot-detection';
import { bodyLimit } from './middleware/body-limit';
import { csrfProtection, csrfTokenHandler } from '../lib/csrf';
import { manifestRoutes } from './routes/manifest.routes';
import { sitemapRoutes } from './routes/sitemap.routes';
import { versionRoutes } from './routes/version.routes';
import { internalOpsRoutes } from './routes/internal-ops.routes';
import { smokeTestRoutes } from './routes/smoke-test.routes';
import { debugRoutes } from './routes/debug.routes';
import { fallbackRoutes } from './routes/fallback.routes';
import { cspReportRoutes } from './routes/csp-report.routes';
import { bootstrapRoutes } from './routes/bootstrap.routes';
import { healthDashboardRoutes } from './routes/health-dashboard.routes';
import { kakaoProxyRoutes } from './routes/kakao-proxy.routes';
import { naverProxyRoutes } from './routes/naver-proxy.routes';
import { sideBannersPublicRoutes } from './routes/side-banners-public.routes';
import { imageProxyRoutes } from './routes/image-proxy.routes';

// ---- Mid-file imports moved to top (ES module standard) ----
import { affiliateRoutes } from '../features/affiliate/api/affiliate.routes';
import { pointsRoutes } from '../features/points/api/points.routes';
import { shortsRoutes } from '../features/shorts/api/shorts.routes';
import { restaurantRecommendRoutes } from '../features/restaurants/api/restaurant-recommendations.routes';
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
import { inviteRewardRoutes } from '../features/referral/api/invite-reward.routes';
import { referralTreeRoutes } from '../features/referral/api/referral-tree.routes';
import { reportsRoutes } from '../features/reports/api/reports.routes';
import { broadcastNotifyRoutes } from '../features/broadcast-notify/api/broadcast-notify.routes';
import { loyaltyRoutes } from '../features/loyalty/api/loyalty.routes';
import { interestRoutes } from '../features/loyalty/api/interest.routes';
import { kakaoSocialRoutes } from '../features/kakao-social/api/kakao-social.routes';
import { blogRoutes } from '../features/blog/api/blog.routes';
import { agencyRoutes } from '../features/agency/api/agency.routes';
import { agencyPinRoutes } from '../features/agency/api/agency-pin.routes';
import { adminAgencyRoutes } from '../features/admin/api/admin-agency.routes';
import { adminToolsRoutes } from '../features/admin/api/admin-tools.routes';
import { adminMetricsRoutes } from '../features/admin/api/admin-metrics.routes';
import { restaurantSettlementRoutes, sellerSettlementRoutes } from '../features/settlement/api/restaurant-settlement.routes';
import { adminRestaurantRecommendRoutes } from '../features/restaurants/api/restaurant-recommendations.routes';
import { bundlePublicRoutes, bundleSellerRoutes, bundleCartRoutes } from '../features/bundles/api/bundle.routes';
import { guideRoutes } from '../features/guides/api/guide.routes';
import { handleScheduled } from './cron/scheduled-cleanup';
import { handleAutoSettlement, handleExpiredVoucherRefunds } from './cron/auto-settlement';
import { runReconciliation } from './cron/reconciliation';
import { runDailySelfDiagnostic } from './cron/daily-self-diagnostic';
import { sendDiscordAlert } from './utils/discord-alert';

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
app.use('/api/*', rateLimiterMiddleware as MiddlewareHandler);

// CORS — multi-region support
app.use('*', cors({
  origin: (origin, c) => {
    const env = c.env as Env;
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
app.route('/', cspReportRoutes);

// ============================================================
// Health Check
// ============================================================

app.get('/health', (c) => c.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '2.0.0',
  environment: (c.env as Env).ENVIRONMENT ?? 'development',
}));

app.route('/', manifestRoutes);

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
//   → bootstrap.routes.ts 참조
// ============================================================
app.route('/', bootstrapRoutes);

// 클라이언트 빌드 버전 확인 — index.html의 스크립트 해시를 서버가 알려줌
// 프론트가 자신의 번들 해시와 비교해서 불일치 시 자동 리로드
// ============================================================
// 🩺 상세 헬스 대시보드 → health-dashboard.routes.ts 참조
app.route('/', healthDashboardRoutes);

app.route('/', sitemapRoutes);
app.route('/', versionRoutes);
app.route('/', internalOpsRoutes);
app.route('/', smokeTestRoutes);
app.route('/', debugRoutes);

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
app.route('/api/seller', sellerAlimtalkManagementRoutes);
app.route('/api/seller', sellerKakaoLinkRoutes);
app.route('/api/seller', sellerSettlementsManagementRoutes);
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
adminApp.route('/blog', blogRoutes);
// Restaurant settlement (admin)
adminApp.route('/restaurant-settlement', restaurantSettlementRoutes);
adminApp.route('/', adminRestaurantRecommendRoutes);
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

// ── 맛집 추천 ──
app.route('/api/restaurants', restaurantRecommendRoutes);

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

// ── 카카오 장소 검색 프록시 (브라우저 CORS 우회) → kakao-proxy.routes.ts
app.route('/', kakaoProxyRoutes);

// ── 네이버 검색 API 프록시 (식당 이미지/정보) → naver-proxy.routes.ts
app.route('/', naverProxyRoutes);

// ── 블로그 (어드민 CRUD + 공개 조회) ──
// SECURITY: /api/admin/blog는 adminApp 내부에서 등록되어 requireAdmin + IP 화이트리스트 적용
// /api/blog는 공개 GET /public, /public/:slug만 허용 (나머지는 라우터 내부에서 admin 체크)
app.route('/api/blog', blogRoutes); // public 엔드포인트 접근용 (내부에서 /public만 공개)

// ── 에이전시 ──
app.route('/api/agency', agencyPinRoutes);
app.route('/api/agency', agencyRoutes);
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

// ── 사이드 배너 (공개 API, 인증 불필요) → side-banners-public.routes.ts
app.route('/', sideBannersPublicRoutes);

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
// → image-proxy.routes.ts
// ============================================================
app.route('/', imageProxyRoutes);

// ============================================================
// 404 for API routes not matched above
// ============================================================

app.all('/api/*', (c) => c.json({ success: false, error: 'Not found' }, 404));

app.route('/', fallbackRoutes);

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
            await sendDiscordAlert(webhook, `🔴 Cron Failed: ${name}`, msg.slice(0, 1500), 'error');
          } catch { /* discord 자체 실패는 무시 */ }
        }
      }
    };

    // Every 5 minutes: short cleanup tasks
    if (cron === '*/5 * * * *') {
      ctx.waitUntil(safeCron('scheduled-cleanup', () => handleScheduled(env)));
    }

    // Daily 18:00 UTC (KST 03:00): heavy tasks (settlement + expired-voucher refund + self diagnostic)
    if (cron === '0 18 * * *') {
      ctx.waitUntil(safeCron('auto-settlement', () => handleAutoSettlement(env)));
      ctx.waitUntil(safeCron('expired-voucher-refund', () => handleExpiredVoucherRefunds(env)));
      ctx.waitUntil(safeCron('daily-self-diagnostic', () => runDailySelfDiagnostic(env)));
    }

    // Daily 19:00 UTC (KST 04:00): reconciliation
    if (cron === '0 19 * * *') {
      ctx.waitUntil(safeCron('reconciliation', () => runReconciliation(env)));
    }
  },
};
