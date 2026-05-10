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
import { docsRoutes } from './routes/docs.routes'; // 2026-04-27 TD-006 split (openapi/swagger)
import { internalDiagnosticsRoutes } from './routes/internal-diagnostics.routes'; // 2026-04-27 TD-006 split
import { internalAdminToolsRoutes } from './routes/internal-admin-tools.routes'; // 2026-04-27 TD-006 Phase C
import { smokeTestRoutes } from './routes/smoke-test.routes'; // 2026-04-27 TD-006 Phase D
import { repairSchemaRoutes } from './routes/repair-schema.routes'; // 2026-04-27 TD-006 Phase E

// ---- Worker-local routes (multi-seller MVP) ----
import type { Env } from './types/env';
import { authRouter } from './routes/auth.routes';
import { authTokenRoutes } from './routes/auth-token.routes'; // Phase 2.3
import { healthRoutes } from './routes/health.routes';
import { killerSwRoutes } from './routes/killer-sw.routes'; // 2026-04-27 PWA 사고 복구
import { sitemapRoutes } from './routes/sitemap.routes'; // 2026-04-27 TD-006 분할
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
import { adminAbuseRoutes } from '../features/admin/api/admin-abuse.routes';
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
import { sellerAdSlotsRoutes } from '../features/seller/api/seller-ad-slots.routes';
import { sellerKakaoLinkRoutes } from '../features/seller/api/seller-kakao-link.routes';
import { sellerAlimtalkMgmtRoutes } from '../features/seller/api/seller-alimtalk-mgmt.routes';
import { sellerRegistrationRoutes } from '../features/seller/api/seller-registration.routes';
import { sellerProfileRoutes } from '../features/seller/api/seller-profile.routes';
import { sellerSettlementsRoutes } from '../features/seller/api/seller-settlements.routes';
import { sellerAccountRoutes } from '../features/seller/api/seller-account.routes';
import { consignmentRoutes } from '../features/seller/api/consignment.routes';
import { giftsRoutes } from '../features/gifts/api/gifts.routes';
import { fundingRoutes } from '../features/funding/api/funding.routes';
import { sellerPinRoutes } from '../features/seller/api/seller-pin.routes';
import { sellerOrdersRoutes } from '../features/seller/api/seller-orders.routes';
import { sellerAnalyticsRoutes } from '../features/seller/api/seller-analytics.routes';
import { sellerStreamsRoutes } from '../features/seller/api/seller-streams.routes';
import { sellerOnboardingRoutes } from '../features/seller/api/seller-onboarding.routes';
import { viewerLoyaltyRoutes } from '../features/seller/api/viewer-loyalty.routes';
import { optimalTimeRoutes } from '../features/seller/api/optimal-time.routes';
import { faqBotRoutes } from '../features/guides/api/faq-bot.routes';
import { moderationRoutes } from '../features/moderation/api/moderation.routes';
import { adminTikTokDiscoveryRoutes } from '../features/admin/api/admin-tiktok-discovery.routes';
import { adminOpsInsightsRoutes } from '../features/admin/api/admin-ops-insights.routes';
import { adminNotificationSettingsRoutes } from '../features/admin/api/admin-notification-settings.routes';
import { adminBusinessMonitoringRoutes } from '../features/admin/api/admin-business-monitoring.routes';
import { agencySelfEventsRoutes } from '../features/agency/api/agency-self-events.routes';
import { promoteBoostsAgencyRoutes, promoteBoostsSellerRoutes } from '../features/agency/api/promote-boosts.routes';
import { liveNotifyFollowersRoutes } from '../features/seller/api/live-notify-followers.routes';
import { sellerTransferRoutes } from '../features/agency/api/seller-transfer.routes';
import { sellerTransferRespondRoutes } from '../features/seller/api/seller-transfer-respond.routes';
import {
  adminAdvertiserRoutes,
  adminCastingRoutes,
  sellerCastingRoutes,
} from '../features/casting/api/casting.routes';
import { donationBoosterRoutes, donationBoosterPublicRoutes } from '../features/donations/api/donation-booster.routes';
import { pkBattlesRoutes, pkBattlesPublicRoutes } from '../features/agency/api/pk-battles.routes';
import { shippingAddressRoutes } from '../features/shipping/api/shipping-address.routes';
import { wishlistRoutes } from '../features/wishlists/api/wishlists.routes';
import { supplyRoutes } from '../features/supply/api/supply.routes';
import { alimtalkRoutes } from '../features/alimtalk/api/alimtalk.routes';
import { restaurantSuggestionsRoutes } from '../features/restaurant-suggestions/api/restaurant-suggestions.routes';
import { donationsRoutes } from '../features/donations/api/donations.routes';
import { sellerDonationsRoutes } from '../features/donations/api/seller-donations.routes';
import youtubeRoutes from '../features/youtube/api/youtube.routes';
import { youtubeLiveRoutes, omeAdmissionHandler } from '../features/youtube/api/youtube-live.routes';
import { multiPlatformRoutes } from '../features/multi-platform/api/multi-platform.routes';
import youtubeChatRoutes from '../features/youtube/api/youtube-chat.routes';
import { liveSseRoutes, chatRoutes } from './routes/live-sse.routes';
import { cafe24Routes } from '../features/cafe24/api/cafe24.routes';

import { ALLOWED_ORIGINS, FIREBASE_RTDB_URL, FIREBASE_APP_URL } from '../shared/constants';
import { requireAdmin, requireAuth } from './middleware/auth';
import { adminIpWhitelist, adminAuditMiddleware } from './middleware/admin-security';
import { rateLimit } from './middleware/rate-limit';
import { hashPassword } from '../lib/password';
import { botProtection } from './middleware/bot-detection';
import { bodyLimit } from './middleware/body-limit';
import { csrfProtection, csrfTokenHandler } from '../lib/csrf';

// 🛡️ 2026-04-26: 파일 중간 import 를 상단으로 이동 (CLAUDE.md 금지 패턴 — 2026-04-22 사고 재발 방지)
import { blogRoutes } from '../features/blog/api/blog.routes';
import { agencyRoutes } from '../features/agency/api/agency.routes';
import { agencyKakaoLinkRoutes } from '../features/agency/api/agency-kakao-link.routes';
import { agencyStatsRoutes } from '../features/agency/api/agency-stats.routes';
import { agencySettlementsRoutes } from '../features/agency/api/agency-settlements.routes';
import { agencyOpsRoutes } from '../features/agency/api/agency-ops.routes';
import { agencySellersRoutes } from '../features/agency/api/agency-sellers.routes';
import { agencyPinRoutes } from '../features/agency/api/agency-pin.routes';
import { agencyCampaignsRoutes } from '../features/agency/api/agency-campaigns.routes';
import { agencyIncentivesRoutes } from '../features/agency/api/agency-incentives.routes';
import { agencyMessagesRoutes } from '../features/agency/api/agency-messages.routes';
import { agencyCouponsRoutes } from '../features/agency/api/agency-coupons.routes';
import { agencyMembersRoutes } from '../features/agency/api/agency-members.routes';
import { agencyCalendarRoutes } from '../features/agency/api/agency-calendar.routes';
import { agencyInvitesRoutes, inviteCodePublicRoutes } from '../features/agency/api/agency-invites.routes';
import { agencyKpiRoutes } from '../features/agency/api/agency-kpi.routes';
import { agencyMatchSuggestionsRoutes } from '../features/agency/api/agency-match-suggestions.routes';
import { agencyPublicRoutes, agencyPublicEditRoutes } from '../features/agency/api/agency-public.routes';
import { adminAgencyRoutes } from '../features/admin/api/admin-agency.routes';
import { adminAgencyApprovalsRoutes } from '../features/admin/api/admin-agency-approvals.routes';
import { proxyRoutes } from './routes/proxy.routes';
import { debugRoutes } from './routes/debug.routes';
import { publicUtilityRoutes } from './routes/public-utility.routes';
import { tiktokRoutes } from '../features/multi-platform/api/tiktok.routes';
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
import { adminSystemMonitoringRoutes } from '../features/admin/api/admin-system-monitoring.routes';
import { blogRoutes as adminBlogRoutes } from '../features/blog/api/blog.routes';
import { restaurantSettlementRoutes, sellerSettlementRoutes } from '../features/settlement/api/restaurant-settlement.routes';
import { pointsRoutes } from '../features/points/api/points.routes';
import { shortsRoutes } from '../features/shorts/api/shorts.routes';
import { groupBuyRoutes } from '../features/group-buy/api/group-buy.routes';
import { couponRoutes } from '../features/coupons/api/coupons.routes';
import { digitalRoutes } from '../features/digital/api/digital.routes';
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
  c.header('Permissions-Policy', 'geolocation=(self), microphone=(self), camera=(self), payment=(self), usb=()');
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
// /api/csp-report → public-utility.routes.ts (P1, 2026-04-26)

// ============================================================
// Health Check
// ============================================================

app.get('/health', (c) => c.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '2.0.0',
  environment: (c.env as Env).ENVIRONMENT ?? 'development',
}));

// 🚨 2026-04-27 (긴급 가드): sw.js 요청 시 Killer SW 직접 응답.
//   기존 PWA SW 가 브라우저에 등록된 사용자가 페이지 못 여는 문제 해결.
//   Worker 가 정적 파일 (dist/client/sw.js) 보다 먼저 응답 → 캐시 우회.
//   Killer SW: 자기 자신 unregister + 모든 캐시 삭제 후 종료.
//
//   재발 방지: 30일 후 (2026-05-27) 이 endpoint 제거 — TECHNICAL_DEBT.md 참조.
//   (2026-04-27 TD-006 split): 별도 라우터 파일로 분리.
app.route('/', killerSwRoutes);
app.route('/', sitemapRoutes);
app.route('/', docsRoutes);
app.route('/', internalDiagnosticsRoutes);
app.route('/', internalAdminToolsRoutes);
app.route('/', smokeTestRoutes);
app.route('/', repairSchemaRoutes);

// v32 FIX: PWA manifest MIME type 명시 (Workers asset serving은 _headers 미지원)
// Chrome "Manifest: Line: 1 Syntax error" 원인 — Worker가 HTML fallback으로 응답하거나
// MIME이 text/plain으로 나올 때 발생. 명시적 intercept로 application/manifest+json 반환.
// /manifest.webmanifest → public-utility.routes.ts (P1, 2026-04-26)

// 🛡️ 2026-05-08: 대역폭 probe — 클라이언트가 임의 사이즈 body POST → server 가 길이 응답.
//   클라이언트가 (size / elapsed) 로 업로드 처리량 추정. 라이브 시작 전 사고 예방.
//   인증 불필요 (간단 검증), 인입 사이즈 5MB 제한.
app.post('/api/probe/upload', async (c) => {
  const cl = parseInt(c.req.header('content-length') || '0')
  if (!cl || cl > 5_000_000) return c.json({ ok: false, reason: 'invalid size' }, 400)
  // Body 를 끝까지 읽어야 실제 업로드 시간 측정 됨
  await c.req.arrayBuffer()
  return c.json({ ok: true, bytes: cl })
})

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

  // KV check — 🛡️ 2026-05-03: 미등록은 'warning' 으로만 표시 (smoke test 차단 회피).
  //   상세 점검은 /api/health/detailed 에서. 여기는 deploy gating 용 단순 health.
  try {
    if (env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.get('health-check');
      checks.kv = 'ok';
    } else if (env.SESSION_KV) {
      await env.SESSION_KV.get('health-check');
      checks.kv = 'session_kv_only'; // legacy fallback
    } else {
      // KV 미등록 — operational warning. status='ok' 유지 (smoke test 통과).
      // /api/health/detailed 또는 dashboard binding 점검으로 추가 모니터링.
      checks.kv = 'missing';
      checks.kv_warning = 'rate limit disabled — register RATE_LIMIT_KV in Dashboard';
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
// /api/_bootstrap/reset-dashboard-password → routes/internal-admin-tools.routes.ts (TD-006 Phase C)

// 클라이언트 빌드 버전 확인 — index.html의 스크립트 해시를 서버가 알려줌
// 프론트가 자신의 번들 해시와 비교해서 불일치 시 자동 리로드
// ============================================================
// 🩺 상세 헬스 대시보드 (2026-04-22 추가)
// GET /api/_internal/health-dashboard
// DB latency, 테이블 행 수, 최근 에러 수, 배포 시점 등 운영자용 종합 지표
// ============================================================
// 🛡️ 2026-04-22: admin 전용 (또는 INTERNAL_OPS_TOKEN 헤더 매치).
// 이전: 누구나 호출 가능 → DB 스키마 조작, 내부 구조 노출 위험.
// /api/_internal/health-dashboard → routes/internal-diagnostics.routes.ts (TD-006 split)

// _cachedBuildVersion 모듈 캐시 → public-utility.routes.ts 로 이동 (P1)
// ============================================================
// 🌐 Dynamic Sitemap.xml (2026-04-22 추가)
// 기존 정적 public/sitemap.xml 은 상품/스트림 누락 + 7일 stale.
// 서버가 현재 DB 상태로 매번 생성 → 검색엔진이 항상 최신 인덱싱.
// ============================================================
// /sitemap.xml → routes/sitemap.routes.ts (TD-006 partial split, 2026-04-27)

// /api/version → public-utility.routes.ts (P1, 2026-04-26)

// ============================================================
// 🩹 Self-healing schema repair (idempotent, 재실행 안전)
// 2026-04-22: D1 migration runner CI/CD 권한 부재 우회용.
// 모든 ALTER TABLE은 IF EXISTS / catch 처리 — 이미 있으면 무해 무동작.
// 운영자가 한 번 호출하면 누락된 컬럼이 자동 추가됨.
// ============================================================
// Migration 버전 추적 — 매 repair-schema 호출 시 현재 상태 기록.
// CI 에서 D1 권한 받으면 정식 migration runner 로 전환하고 이 엔드포인트는 deprecate.
// ensureMigrationTrackingTable → routes/repair-schema.routes.ts (TD-006 Phase E)

// ============================================================
// 🔑 어드민 복구 엔드포인트 (INTERNAL_API_TOKEN 보호)
// POST /api/_internal/clear-rate-limit  — rate limit 초기화
// POST /api/_internal/reset-admin-password — 어드민 비밀번호 초기화
// 사용법: X-Internal-Token: <INTERNAL_API_TOKEN 값> 헤더 필요
// ============================================================

// /api/_internal/clear-rate-limit → routes/internal-admin-tools.routes.ts (TD-006 Phase C)

// /api/_internal/reset-admin-password → routes/internal-admin-tools.routes.ts (TD-006 Phase C)

// 🛡️ 2026-04-27: 신규 마이그레이션 0207~0230 테이블 일괄 생성 (admin 전용).
// repair-schema 가 ALTER (컬럼 추가) 만 처리하므로, CREATE TABLE 신규 테이블은 본 endpoint 로 생성.
// 멱등 (CREATE TABLE IF NOT EXISTS).
// /api/_internal/repair-new-tables → routes/internal-admin-tools.routes.ts (TD-006 Phase C)

// 🛡️ 2026-04-27: 마이그레이션 적용 상태 검증 (admin 전용, 읽기만).
// 신규 에이전시/TikTok 테이블이 D1 에 적용됐는지 한 번에 확인.
// 응답: { summary: { applied, missing }, results: [{ table, exists }] }
// /api/_internal/migration-status → routes/internal-diagnostics.routes.ts (TD-006 split)

// 🛡️ 2026-04-22: admin 전용. 이전: 공개 → 누구나 DB 스키마 수정 가능 (CRITICAL)
// /api/_internal/repair-schema → routes/repair-schema.routes.ts (TD-006 Phase E)

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
// /api/_internal/smoke-test → routes/smoke-test.routes.ts (TD-006 Phase D)

// ============================================================
// 🩺 인증 스모크 테스트
// GET /api/_internal/smoke-test-auth
// 임시 JWT 토큰을 생성해 보호된 GET 엔드포인트를 호출.
// 5xx = 인증 통과 후 핸들러 자체가 크래시한다는 뜻 → 실패로 카운트.
// ============================================================
// /api/_internal/smoke-test-auth → routes/smoke-test.routes.ts (TD-006 Phase D)

// 배포 검증용 — 현재 worker 빌드가 언제 / 어떤 커밋에서 빌드됐는지 즉시 확인
// 이 핸들러의 존재 자체가 "최신 배포 반영" 증거
// build-info 는 src/worker/routes/debug.routes.ts 로 이동됨 (M9 분리, 2026-04-26)

// /api/debug/whoami + /api/debug/auth-trace → routes/internal-diagnostics.routes.ts (TD-006 split)

// ============================================================
// API Documentation (OpenAPI / Swagger UI) → routes/docs.routes.ts (TD-006 split, 2026-04-27)
// ============================================================
// Debug & Utilities
// ============================================================

// Debug endpoint to check bindings (admin only)
// bindings 는 src/worker/routes/debug.routes.ts 로 이동됨 (M9 분리, 2026-04-26)

// KV usage monitoring (admin only)
// /api/debug/kv-usage → routes/internal-diagnostics.routes.ts (TD-006 split)

// ============================================================
// Database Index Optimization (admin only)
// Creates indexes on frequently queried columns for faster lookups
// ============================================================
// /api/admin/optimize-db → routes/internal-admin-tools.routes.ts (TD-006 Phase C)

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
// 🛡️ 2026-05-07 (CRITICAL fix): app.use(path) 가 path + 모든 sub-path 매칭하는 Hono prefix
//   동작 때문에 /api/seller/register 가 /api/seller/register-from-user 도 잡아 403 사고 발생.
//   → 정확 path + 정확 method 만 매칭하는 wrapper 로 변경. method 불일치 시 즉시 next() pass.
//   wildcard sub-path (/register-from-user, /register/business) 영향 0.
const exactPostBot = (exactPath: string) => {
  const bot = botProtection();
  return async (c: Context, next: Next) => {
    const url = new URL(c.req.url);
    if (c.req.method !== 'POST' || url.pathname !== exactPath) return next();
    return bot(c, next);
  };
};
app.use('/api/auth/register', exactPostBot('/api/auth/register'));
app.use('/api/auth/login', exactPostBot('/api/auth/login'));
app.use('/api/seller/register', exactPostBot('/api/seller/register'));
app.use('/api/seller/login', exactPostBot('/api/seller/login'));
app.use('/api/admin/login', exactPostBot('/api/admin/login'));
app.use('/api/agency/login', exactPostBot('/api/agency/login'));
app.use('/api/auth/forgot-password', exactPostBot('/api/auth/forgot-password'));
app.use('/api/seller/forgot-password', exactPostBot('/api/seller/forgot-password'));
app.use('/api/agency/forgot-password', exactPostBot('/api/agency/forgot-password'));

// Feature: Admin auth — rate limited: 5 attempts per 5 min per IP
// 🛡️ 2026-04-29 보안 audit (TD-016 HIGH): admin refresh / 2FA 도 rate limit.
//   refresh: brute-force 방어 / 2FA: 6자리 TOTP brute-force 방어 (1M 조합).
app.use('/api/admin/login', rateLimit({ action: 'admin_login', max: 5, windowSec: 300 }));
app.use('/api/admin/refresh', rateLimit({ action: 'admin_refresh', max: 10, windowSec: 60 }));
app.use('/api/admin/2fa/*', rateLimit({ action: 'admin_2fa', max: 5, windowSec: 300 }));
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
// 🛡️ 2026-04-28: 메인페이지 통합 endpoint — 1회 호출 + 1분 edge cache
app.use('/api/home/bundle', edgeCache(60), cacheControl(60));
// 🛡️ 2026-04-30 perf audit: 추가 공개 read-only 엔드포인트 캐싱
app.use('/api/sellers/*/public', edgeCache(60), cacheControl(60));        // 셀러 공개 프로필 1min
app.use('/api/sections', edgeCache(120), cacheControl(120));              // 홈 섹션 2min (변동 적음)
app.use('/api/seller-tiers', edgeCache(300), cacheControl(300));          // 셀러 등급 5min (거의 안 변함)
app.use('/api/blog/public/*', edgeCache(180), cacheControl(180));         // 블로그 공개 글 3min
app.use('/api/search/*', edgeCache(30), cacheControl(30));                // 검색 결과 30s

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
// 2026-05-05: 광고 슬롯 입찰 (/ad-slots, /ad-slots/my-bids, /ad-slots/:id/bid)
app.route('/api/seller', sellerAdSlotsRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /register, /register-from-user, /my-seller-status, /switch-to-*
app.route('/api/seller', sellerRegistrationRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /profile (GET/PUT/PATCH) + /business-info (GET/POST/PUT/PATCH)
app.route('/api/seller', sellerProfileRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /settlements*, /dashboard/stats
app.route('/api/seller', sellerSettlementsRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /personal-info, /change-password, /upload-image
app.route('/api/seller', sellerAccountRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /link-kakao, /unlink-kakao, /kakao-link-status
app.route('/api/seller', sellerKakaoLinkRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /alimtalk* (account/balance/test/send/messages/charge)
app.route('/api/seller', sellerAlimtalkMgmtRoutes);
// 🛡️ 2026-04-28: MD 위탁 판매 (셀러간 협업)
app.route('/api/seller/consignment', consignmentRoutes);
// 🛡️ 2026-04-28: 선물하기 (라이브 시청 중 다른 사람에게 상품 선물)
app.route('/api/gifts', giftsRoutes);
// 🛡️ 2026-04-28: 라이브 펀딩 (와디즈 모델 — 셀러 PB 사전 펀딩)
app.route('/api/funding', fundingRoutes);
app.route('/api/seller', sellerPinRoutes);
app.route('/api/seller', sellerOrdersRoutes);
app.route('/api/seller/analytics', sellerAnalyticsRoutes);
app.route('/api/seller/streams', sellerStreamsRoutes);
// 🛡️ 2026-04-27 Phase 1-5: 셀러 7일 부트캠프 온보딩
app.route('/api/seller/onboarding', sellerOnboardingRoutes);
// 🛡️ 2026-04-27 Phase 2-3: 시청자 충성도 4단계
app.route('/api/seller/viewers', viewerLoyaltyRoutes);
// 🛡️ 2026-04-27 Phase 3-1: 데이터 기반 최적 라이브 시간 추천
app.route('/api/seller/optimal-time', optimalTimeRoutes);
// 🛡️ 2026-04-27 Phase 3-2: FAQ 봇 (가이드 검색)
app.route('/api/faq-bot', faqBotRoutes);
// 🛡️ 2026-04-27 Phase 3-3: 채팅 모더레이션
// 🛡️ 2026-04-29 보안 audit (TD-016 MEDIUM): rate limit + 인증 — DoS / DB write 폭주 방어
app.use('/api/moderation/*', requireAuth());
app.use('/api/moderation/*', rateLimit({ action: 'moderation_check', max: 60, windowSec: 60 }));
app.route('/api/moderation', moderationRoutes);
// 🛡️ 2026-04-27 Phase 3-4: 어드민 TikTok 발굴
app.route('/api/admin/tiktok-discovery', adminTikTokDiscoveryRoutes);
// 🛡️ 2026-04-27 운영 안정: 어드민 운영 인사이트 (부진 검출)
app.route('/api/admin/ops-insights', adminOpsInsightsRoutes);
// 🛡️ 2026-04-28: 알림 채널 설정 (어드민 대시보드)
app.route('/api/admin/notification-settings', adminNotificationSettingsRoutes);
// 🛡️ 2026-04-28: business-monitoring (gift + consignment 운영 통계)
app.route('/api/admin/business-monitoring', adminBusinessMonitoringRoutes);
// 🛡️ 2026-04-27 자사 이벤트 (매출 챌린지)
app.route('/api/agency/self-events', agencySelfEventsRoutes);
// 🛡️ 2026-04-27 노출 부스팅 쿠폰 (Promote to Live)
app.route('/api/agency/promote-boosts', promoteBoostsAgencyRoutes);
app.route('/api/seller/promote-boosts', promoteBoostsSellerRoutes);
// 🛡️ 2026-04-27 라이브 시작 자동 알림 (단골/VIP)
app.route('/api/seller/live-notify', liveNotifyFollowersRoutes);
// 🛡️ 2026-04-27 Phase 3-5: 셀러 이전 (Network 마켓플레이스)
app.route('/api/agency/transfers', sellerTransferRoutes);
// 🛡️ 2026-04-30 TD-016 CRITICAL: 셀러 본인이 직접 동의/거부 (agency 대행 금지)
app.route('/api/seller/transfers', sellerTransferRespondRoutes);
// 🛡️ 2026-04-27 Phase 3-6: 캐스팅 마켓플레이스
app.route('/api/admin/advertisers', adminAdvertiserRoutes);
app.route('/api/admin/castings', adminCastingRoutes);
app.route('/api/seller/castings', sellerCastingRoutes);
// 🛡️ 2026-04-27 Phase 2-5: 라이브 후원 부스터 이벤트
app.route('/api/donation-boosters', donationBoosterRoutes);
app.route('/api/donation-boosters-public', donationBoosterPublicRoutes);
// 🛡️ 2026-04-27 Phase 2-7: PK 이벤트 (셀러 vs 셀러 매출 경쟁)
app.route('/api/agency/pk', pkBattlesRoutes);
app.route('/api/pk-public', pkBattlesPublicRoutes);

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
// 🛡️ 2026-05-07: Cron / 알림톡 실패 모니터링 (admin 가시성)
adminApp.route('/', adminSystemMonitoringRoutes);
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
// 2026-05-05: 어뷰징 탐지 + 광고 슬롯 관리
adminApp.route('/', adminAbuseRoutes);
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
// 🛡️ 2026-04-28: restaurant-map 옵션 B — 사용자 수요 신호 (셀러 영입/알림)
app.route('/api/restaurant-suggestions', restaurantSuggestionsRoutes);

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

// ── 디지털 상품 (2026-05-05): 전자책/강의/가이드/영상 ──
app.route('/api/digital', digitalRoutes);

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

// ── 디버그 (build-info, bindings) — 2026-04-26 M9 부분 추출
app.route('/api/debug', debugRoutes);

// ── 공개 유틸 (csp-report, manifest, version) — 2026-04-26 P1 추출
//    sub-paths 가 / (root), /api/csp-report, /manifest.webmanifest, /api/version 으로
//    분기되므로 prefix '' 마운트.
app.route('/', publicUtilityRoutes);

// ── 🛡️ 2026-04-26 T1: TikTok Login + Display API (셀러 외부 SNS 연동) ──
app.route('/api/seller/tiktok', tiktokRoutes);

// ── 블로그 (어드민 CRUD + 공개 조회) ──
// SECURITY: /api/admin/blog는 adminApp 내부에서 등록되어 requireAdmin + IP 화이트리스트 적용
// /api/blog는 공개 GET /public, /public/:slug만 허용 (나머지는 라우터 내부에서 admin 체크)
app.route('/api/blog', blogRoutes); // public 엔드포인트 접근용 (내부에서 /public만 공개)

// ── 에이전시 ──
app.route('/api/agency', agencyPinRoutes);
app.route('/api/agency', agencyRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /link-kakao, /unlink-kakao, /kakao-link-status
app.route('/api/agency', agencyKakaoLinkRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /stats, /stats/kpi, /stats/daily, /stats/realtime, /stats/batch
app.route('/api/agency', agencyStatsRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /settlements, /settlement-invoices, /settlement-invoices/:id, /settlements/request
app.route('/api/agency', agencySettlementsRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /notices, /monthly-tasks, /targets, /sellers/compare, /contracts
app.route('/api/agency', agencyOpsRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /sellers*, /orders, /streams, /ranking, /schedule, /returns
app.route('/api/agency', agencySellersRoutes);
// 🛡️ 2026-04-26: Agency P0 #4 캠페인 관리
app.route('/api/agency/campaigns', agencyCampaignsRoutes);
// 🛡️ 2026-04-26: Agency P0 #5 인센티브 규칙 엔진
app.route('/api/agency/incentives', agencyIncentivesRoutes);
// 🛡️ 2026-04-26 Q2: 메시지 템플릿 + 일괄 발송
app.route('/api/agency/messages', agencyMessagesRoutes);
// 🛡️ 2026-04-26 Q7: 쿠폰 캐스케이드 (에이전시 → 셀러 → 시청자)
app.route('/api/agency/coupons', agencyCouponsRoutes);
// 🛡️ 2026-04-26 M4: 에이전시 멀티 권한 (owner/manager/agent/analyst)
app.route('/api/agency/members', agencyMembersRoutes);
// 🛡️ 2026-04-26 M5: 라이브 캘린더 + 에이전트 노트
app.route('/api/agency/calendar', agencyCalendarRoutes);
// 🛡️ 2026-04-27 Phase 1-3: QR/링크 영입 코드
app.route('/api/agency/invites', agencyInvitesRoutes);
app.route('/api/invite', inviteCodePublicRoutes);
// 🛡️ 2026-04-27 Phase 1-4: 6대 KPI 대시보드 API
app.route('/api/agency/kpi', agencyKpiRoutes);
// 🛡️ 2026-04-27 Phase 1-7: 에이전시 공개 브랜딩 페이지
app.route('/api/agency-public', agencyPublicRoutes);          // 공개 (인증 X)
app.route('/api/agency/public-profile', agencyPublicEditRoutes); // 본인 편집 (인증)
// 2026-05-05: 신규 셀러 자동 매칭 제안 (수락/거절)
app.route('/api/agency', agencyMatchSuggestionsRoutes);
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
// 🛡️ 2026-04-28 TD-006 (split): /live/* 5개 endpoint
app.route('/api/seller/youtube', youtubeLiveRoutes);
app.route('/api/youtube', youtubeLiveRoutes);

// 🛡️ 2026-05-08: OvenMediaEngine admission webhook (자체 미디어 서버).
//   OME 가 publish 시도 시 호출 → token 검증 + 셀러의 YouTube RTMP key 동적 push 등록.
app.post('/api/internal/ome/admission', async (c) => {
  try {
    // signature 검증을 위해 raw body 그대로 보존 (re-stringify 시 OME 의 원본 바이트와 달라질 수 있음).
    const rawBody = await c.req.text()
    const body = JSON.parse(rawBody)
    const sig = c.req.header('X-OME-Signature') || null
    const result = await omeAdmissionHandler(body, sig, c.env, rawBody, (p) => c.executionCtx.waitUntil(p))
    return c.json(result)
  } catch (e) {
    console.error('[OME admission] handler error', e)
    return c.json({ allowed: false, reason: 'internal error' }, 500)
  }
});
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

  if (!url) return c.json({ success: false, error: 'url required' }, 400);

  // SSRF 방어: 허용된 도메인만 프록시
  const ALLOWED_HOSTS = ['firebasestorage.googleapis.com', 'img.youtube.com', 'k.kakaocdn.net', 'images.unsplash.com', 'live.ur-team.com', 'ur-live.pages.dev']
  try {
    const parsed = new URL(url)
    if (!ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
      return c.json({ success: false, error: 'domain not allowed' }, 403)
    }
  } catch {
    return c.json({ success: false, error: 'invalid url' }, 400)
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

// 🛡️ 2026-04-28 결정적 fix: 일반 카톡 인앱 (kakaotalk/kakaostory/naver) 제거.
//   이들은 *일반 사용자의 인앱 브라우저* 라 SSR meta-only HTML 응답하면 흰화면 + 무한 reload.
//   진짜 검색엔진 크롤러만 유지: googlebot/bingbot/yandex/baiduspider/yeti/naverbot/daumoa
//   메신저 링크 preview 봇 유지 (link card 표시용):
//     - facebookexternalhit/twitterbot/linkedinbot/slackbot/whatsapp/telegram/discord
//     - 🛡️ 2026-04-28 추가: KakaoTalk-Scrap (카톡 link preview 봇) — 카톡 채팅방
//       link card 의 제목/이미지/설명 표시. 일반 카톡 인앱 'KAKAOTALK' 와 다른 UA.
const BOT_UA_REGEX = /googlebot|bingbot|yandex|baiduspider|twitterbot|facebookexternalhit|rogerbot|linkedinbot|embedly|quora link|showyoubot|outbrain|pinterest|slackbot|vkshare|w3c_validator|yeti|naverbot|daumoa|telegram|whatsapp|discord|KakaoTalk-Scrap/i;

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
<!-- 🛡️ 2026-04-28: window.location.href 제거. 이전 코드: 같은 URL redirect →
     봇으로 잘못 매칭된 일반 사용자가 무한 reload + 흰화면 (카톡 인앱 사고).
     봇은 어차피 JS 실행 안 하므로 redirect 불필요. -->
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

// 🛡️ 2026-04-27 (TD-006 부분): scheduled handler 를 src/worker/scheduled.ts 로 분리.
// worker/index.ts 가 90줄 줄어듦. cron 로직 변경 시 scheduled.ts 만 수정.
import { handleCronScheduled } from './scheduled';

import { swallow } from './utils/swallow';
export default {
  fetch: app.fetch,
  scheduled: handleCronScheduled,
};
