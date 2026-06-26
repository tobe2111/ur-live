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
import { errorTelemetryRoutes } from './routes/error-telemetry.routes'; // 2026-05-23 frontend 에러 수집
import { healthcheckRoutes } from './routes/healthcheck.routes'; // 2026-05-23 결제/인증 사전 점검
import { selftestRoutes } from './routes/selftest.routes'; // 2026-05-23 운영 인프라 자가 점검

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
import { appointmentsRoutes } from '../features/appointments/api/appointments.routes';
import { adminPayoutsRoutes } from '../features/admin/api/admin-payouts.routes';
import { adminTaxRoutes } from '../features/admin/api/admin-tax.routes';
import { ledgerRoutes } from '../features/ledger/api/ledger.routes';
import { streamsRouter } from './routes/streams.routes';  // ✅ 공개 스트림 라우트
import { usersRouter } from './routes/users.routes';      // ✅ /api/users/role, /api/users/init
import { meRegionRoutes, adminRegionRoutes, publicRegionRoutes } from './routes/region.routes'; // 🗺️ 내 동네 + 동별 밀도 + 좌표해석
import { i18nMiddleware } from './middleware/i18n.middleware';
import { rateLimitMiddleware as rateLimiterMiddleware } from './middleware/rate-limiter';
import { globalErrorHandler as errorHandler } from './middleware/error-handler';
import { errorRateMonitor } from './middleware/error-rate-monitor';
import { edgeCache, publicCache } from './middleware/edge-cache';

// ---- Feature module routes ----
import { accountRoutes } from '../features/account/api/account.routes';
import { adminManagementRoutes, adminBannersRoutes, adminFlagsRoutes } from '../features/admin/api/index';
import { adminCouponsRoutes } from '../features/admin/api/admin-coupons.routes';
import { adminBulkEmailRoutes } from '../features/admin/api/admin-bulk-email.routes';
import { adminSideBannersRoutes } from '../features/admin/api/admin-side-banners.routes';
import { adminSettlementsRoutes } from '../features/admin/api/admin-settlements.routes';
import { adminStatsRoutes } from '../features/admin/api/admin-stats.routes';
import { adminSellersRoutes } from '../features/admin/api/admin-sellers.routes';
import { adminProductsRoutes } from '../features/admin/api/admin-products.routes';
import { adminSuppliersRoutes } from '../features/admin/api/admin-suppliers.routes';
// 🛡️ 2026-05-18: 숙소 공구 (stay_voucher) 어드민 — PR 1 Foundation.
import { adminStaysRoutes } from '../features/admin/api/admin-stays.routes';
// 🛡️ 2026-05-19: KT Alpha (기프티쇼) 어드민.
import { adminKtAlphaRoutes } from '../features/admin/api/admin-kt-alpha.routes';
// 🛡️ 2026-05-19: 원천징수 + 지급조서 어드민.
import { adminWithholdingRoutes } from '../features/admin/api/admin-withholding.routes';
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
import { ucansignWebhookRoutes } from '../features/contracts/api/ucansign-webhook.routes';
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
// 🛡️ 2026-05-18: 숙소 공구 (stay_voucher) 셀러 CRUD — PR 1 Foundation.
import { sellerStaysRoutes } from '../features/seller/api/seller-stays.routes';
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
import { supplierAuthRoutes } from '../features/supply/api/supplier-auth.routes';
import { supplierDashboardRoutes } from '../features/supply/api/supplier-dashboard.routes';
import { distributorAdminRoutes } from '../features/supply/api/distributor-admin.routes';
import { wholesaleRoutes } from '../features/supply/api/wholesale.routes';
import { wholesaleSupplierRoutes } from '../features/supply/api/wholesale-supplier.routes';
import { wholesaleClaimsRoutes } from '../features/supply/api/wholesale-claims.routes';
import { naverCommerceRoutes } from '../features/supply/api/naver-commerce.routes';
import { coupangCommerceRoutes } from '../features/supply/api/coupang-commerce.routes';
import { wholesaleQuotesRoutes } from '../features/supply/api/wholesale-quotes.routes';
import { supplierAnalyticsRoutes } from '../features/supply/api/supplier-analytics.routes';
import { wholesalePriceReferenceRoutes } from '../features/supply/api/wholesale-price-reference.routes';
import wholesaleTaxRoutes from '../features/supply/api/wholesale-tax.routes';
import { wholesaleIntegrityRoutes } from '../features/supply/api/wholesale-integrity.routes';
import { wholesaleNotificationsRoutes } from '../features/supply/api/wholesale-notifications.routes';
import { wholesaleDepositRoutes, adminWholesaleDepositRoutes } from '../features/supply/api/wholesale-deposit.routes';
import { wholesalePlusRoutes } from '../features/supply/api/wholesale-plus.routes';
import { supplierWithdrawalRoutes, adminWholesaleWithdrawalRoutes } from '../features/supply/api/supplier-withdrawal.routes';
import { wholesaleChatRoutes } from '../features/supply/api/wholesale-chat.routes';
import { wholesaleMainPublicRoutes, adminWholesaleBannerRoutes, adminWholesaleProposalRoutes, adminWholesaleProductRoutes, adminWholesaleDepositAccountRoutes } from '../features/supply/api/wholesale-main.routes';
import { wholesaleBoardPublicRoutes, wholesaleWishlistRoutes, adminWholesaleBoardRoutes } from '../features/supply/api/wholesale-board.routes';
import { partnershipPublicRoutes, adminPartnershipRoutes } from './routes/partnership.routes';
import { adminWholesaleMallRoutes } from '../features/supply/api/wholesale-malls-admin.routes';
import { adminWholesaleOverviewRoutes } from '../features/supply/api/wholesale-overview-admin.routes';
import { adminUcansignRoutes } from '../features/admin/api/admin-ucansign.routes';
import { platformMetricsRoutes } from '../features/admin/api/platform-metrics.routes';
import { alimtalkRoutes } from '../features/alimtalk/api/alimtalk.routes';
import { restaurantSuggestionsRoutes } from '../features/restaurant-suggestions/api/restaurant-suggestions.routes';
import { donationsRoutes } from '../features/donations/api/donations.routes';
import { sellerDonationsRoutes } from '../features/donations/api/seller-donations.routes';
import youtubeRoutes from '../features/youtube/api/youtube.routes';
import { youtubeLiveRoutes, omeAdmissionHandler, createLiveBroadcastHandler } from '../features/youtube/api/youtube-live.routes';
import { rateLimit as rateLimitMw } from './middleware/rate-limit';
import { multiPlatformRoutes } from '../features/multi-platform/api/multi-platform.routes';
import youtubeChatRoutes from '../features/youtube/api/youtube-chat.routes';
import { liveSseRoutes, chatRoutes } from './routes/live-sse.routes';
import { cafe24Routes } from '../features/cafe24/api/cafe24.routes';

import { ALLOWED_ORIGINS, FIREBASE_RTDB_URL, FIREBASE_APP_URL } from '../shared/constants';
import { requireAdmin, requireAuth } from './middleware/auth';
import { adminIpWhitelist, adminAuditMiddleware } from './middleware/admin-security';
import { adminRbacMiddleware } from './middleware/admin-rbac';
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
// 🛡️ 2026-05-20: 에이전시 = 가게 입점 영업 모델 (Phase 2).
import { agencyIntroducedStoresRoutes } from '../features/agency/api/agency-introduced-stores.routes';
import { agencySettlementsRoutes } from '../features/agency/api/agency-settlements.routes';
// 🛡️ 2026-05-18: 숙소 공구 에이전시 모니터링 — PR 1 Foundation.
import { agencyStaysRoutes } from '../features/agency/api/agency-stays.routes';
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
// 🛡️ 2026-05-27 (영업 검증 Layer 2): 매장 사전 등록 prospects.
import { prospectsRoutes } from '../features/seller-prospects/api/seller-prospects.routes';
import { agencyKpiRoutes } from '../features/agency/api/agency-kpi.routes';
import { agencyMatchSuggestionsRoutes } from '../features/agency/api/agency-match-suggestions.routes';
import { agencyPublicRoutes, agencyPublicEditRoutes } from '../features/agency/api/agency-public.routes';
import { adminAgencyRoutes } from '../features/admin/api/admin-agency.routes';
import { payoutCenterRoutes } from '../features/admin/api/admin-payout-center.routes';
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
// 🛡️ 2026-05-18: 숙소 공구 (stay_voucher) 사용자 측 public — PR 1 Foundation.
import { staysPublicRoutes } from '../features/group-buy/api/stays-public.routes';
// 🛡️ 2026-05-18: R2 이미지 업로드 (seller/admin/agency/user 공용).
import { uploadRoutes } from '../features/upload/api/upload.routes';
import { sellerMarketingRoutes, influencerSettlementRoutes, adminPayoutRoutes, influencerDiscoverRoutes, influencerRankingsRoutes } from '../features/group-buy/api/marketing.routes';
import { reviewBonusUserRoutes, reviewBonusAdminRoutes } from '../features/group-buy/api/review-bonus.routes';
import { fcfsRoutes, fcfsAdminRoutes } from '../features/group-buy/api/fcfs.routes';
import { voucherDisputeRoutes, voucherDisputeAdminRoutes } from '../features/group-buy/api/voucher-dispute.routes';
// 🛡️ 2026-05-20: requireAdmin 은 위 (line 127) 에서 이미 import — 중복 제거.
import { ogRoutes } from './routes/og-image.routes';
import { curatorRoutes } from './routes/curator.routes'; // 2026-05-25 큐레이터 링크샵
import { shippingRoutes } from './routes/shipping.routes'; // 2026-05-25 배송 재설계 (migration 0279)
import { hostingRoutes } from './routes/hosting.routes'; // 2026-05-25 호스팅 (migration 0280)
import { analyticsRoutes } from './routes/analytics.routes';
import { flagRoutes } from './routes/feature-flag.routes';
import { currencyRoutes } from './routes/currency.routes';
import { ocrRoutes } from './routes/ocr.routes';
import { disputesRoutes } from './routes/disputes.routes';
import { twofaRoutes } from './routes/twofa.routes';
import { sellerPublicRoutes } from '../features/seller-public/api/seller-public.routes';
import { promoRoutes } from '../features/promo/api/promo.routes';
import { csrfIssue } from './middleware/csrf';
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
export { RateLimiterDurableObject } from '../durable-objects/rate-limiter';

// ============================================================
// Cache Control Middleware — adds CDN + browser cache headers
// for read-heavy GET endpoints to reduce origin load
// ============================================================
function cacheControl(maxAge: number, swr?: number) {
  // 🛡️ 2026-05-22: stale-while-revalidate 추가 — edge 에 stale 응답 있으면 즉시 반환 +
  //   백그라운드에서 origin 재요청 → 100% edge hit, 사용자는 D1 cold-start 절대 안 만남.
  const staleWhileRevalidate = swr ?? maxAge * 4
  return async (c: Context, next: Next) => {
    await next();
    if (c.res.status === 200 && c.req.method === 'GET') {
      c.header('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
      c.header('CDN-Cache-Control', `max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
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

// 🛡️ 2026-05-15: CSRF cookie 발급 (모든 GET 응답) — double-submit pattern.
//   POST/PATCH/DELETE 검증은 endpoint 별 csrfGuard() 적용 (Bearer 토큰은 자동 면제).
app.use('*', csrfIssue());

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
    // 🛡️ 2026-05-21 REVERT: style-src nonce 도입 시도 → CSP3 가 unsafe-inline 무력화 →
    //   Tailwind/React inline style (수천 곳) nonce 없이 전부 차단 → 화면 깨짐.
    //   nonce 도입은 큰 리팩토링 필요. 일단 unsafe-inline 유지 (style 은 script 보다 XSS 위험 낮음).
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://*.stripe.com https://m.stripe.network; " +
    // img-src 'unsafe-inline' 은 CSP 스펙상 의미 없는 키워드 (제거 유지).
    "img-src 'self' data: https: blob:; " +
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
  // 🛡️ 2026-05-13: autoplay + fullscreen + picture-in-picture 명시 허용 — YouTube iframe 라이브 재생 차단 사고.
  //   기존 헤더에 autoplay 누락 → 브라우저 기본값 'self' 적용 → cross-origin YouTube iframe 의 autoplay 차단.
  //   결과: 셀러는 송출 됨, 시청자 페이지는 "터치하여 시청 시작" 영구 오버레이 후 클릭해도 무반응.
  //   iframe 의 allow="autoplay" 만으로는 부족 — 부모 페이지 Permissions-Policy 가 우선.
  c.header(
    'Permissions-Policy',
    'geolocation=(self), microphone=(self), camera=(self), payment=(self), usb=(), ' +
    'autoplay=*, fullscreen=*, picture-in-picture=*, encrypted-media=*'
  );
  // 2026-04-22 추가: Spectre-class 공격 차단 + cross-origin 이슈 방지
  c.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups'); // 카카오/구글 OAuth 팝업 허용
  c.header('Cross-Origin-Resource-Policy', 'same-site');
  c.header('X-Permitted-Cross-Domain-Policies', 'none'); // Flash/PDF 크로스도메인 차단

  // 🛡️ 2026-04-22 배치 121: HTML 응답에 nonce 주입 — 모든 <script> (inline & external src).
  //   strict-dynamic + nonce 조합: 신뢰된 script 가 dynamic 하게 로드하는 하위 script 는
  //   브라우저가 자동으로 nonce propagation (createElement('script') 케이스).
  // 🛡️ 2026-05-25 (loading P0): 메인 페이지 SSR inline — KV cache 에서 group-buy/products
  //   조회 + <head> 에 type="application/json" 으로 inject. 클라이언트는 inline 우선 사용.
  //   효과: 모바일 메인 LCP -0.3~0.5s (첫 API fetch waterfall 제거).
  //   부하: KV read 1회 + 정적 inject. 매 메인 요청 1회 (publicCache 5분 HIT 보장).
  const ct = c.res.headers.get('Content-Type') || '';
  if (ct.includes('text/html') && c.res.body) {
    const url = new URL(c.req.url);
    const isMainPage = url.pathname === '/' || url.pathname === '/index.html';

    // 🛡️ 2026-05-27 (loading P0): SSR data 사전 fetch — multi-page robust.
    //   페이지별 critical endpoint 1개를 KV → self-fetch (150ms) 순서로 inject.
    //   클라이언트는 __SSR_INITIAL_${slot}__ 읽어 useQuery initialData 로 즉시 render.
    //   - main: /api/group-buy/products?status=active&category=all
    //   - detail (/group-buy/:id): /api/group-buy/products/:id
    //   - seller (/profile/:username): /api/sellers/:username/public
    type SsrTarget = { slot: string; path: string };
    let ssrTarget: SsrTarget | null = null;

    if (isMainPage) {
      // 🛡️ 2026-06-18 [UNLOCK_LOADING] (대표 결정 — 홈 = 동네딜 중심): 홈 SSR 슬롯을 교환권(deal_only) →
      //   동네딜(group-buy active) 데이터로 전환. GroupBuyFeed(category='all')가 __SSR_INITIAL_MAIN__ 를
      //   consume → 0-RTT. 이 path 는 cache-prewarm HOT_PATHS 의 '/api/group-buy/products?status=active&category=all'
      //   와 1:1 일치(이미 prewarm 됨). 교환권은 홈에서 강등 → /vouchers(자체 __SSR_INITIAL_VOUCHERS__).
      ssrTarget = { slot: 'MAIN', path: '/api/group-buy/products?status=active&category=all' };
    } else if (url.pathname === '/vouchers' && !url.search) {
      // 🛡️ 2026-05-27: VouchersPage first-paint inject (no query — default 페이지).
      //   클라이언트가 categoryParam/brand 변경 시 새 fetch — SSR 첫 진입만 효과.
      //   /api/vouchers/categories 는 cron warming + publicCache 5분 → edge cache 항상 hit.
      ssrTarget = { slot: 'VOUCHERS', path: '/api/products?page=1&limit=20&deal_only=1&sort=price_low' };
    } else if (url.pathname === '/browse' && !url.search) {
      ssrTarget = { slot: 'BROWSE', path: '/api/products?page=1&limit=20&exclude_deal_only=1' };
    } else if (url.pathname === '/live' && !url.search) {
      // 🛡️ 2026-05-27 (Step P1-2): 라이브 페이지 SSR inject — 사용자 체류 시간 큰 페이지.
      ssrTarget = { slot: 'LIVE', path: '/api/streams?status=live&limit=20' };
    } else if (url.pathname === '/group-buy' && !url.search) {
      // 🛡️ 2026-06-04 [LOADING_ADDITIVE]: 동네딜(공구 리스트) SSR inject — 유일하게 누락됐던 리스트 페이지.
      //   GroupBuyListPage 가 마운트 후 /api/group-buy/products?status=active 를 cold fetch(3-RTT 워터폴) 하던 것 제거.
      //   ⚠️ path 는 클라가 보내는 query 와 정확히 일치해야 edge-key hit (prewarm 키도 동일하게 추가).
      ssrTarget = { slot: 'GROUPBUY', path: '/api/group-buy/products?status=active' };
    } else if (url.pathname === '/wholesale' && !url.search) {
      // 🏭 2026-06-10 [LOADING_ADDITIVE] (사용자 신고 — 도매몰 상품 느림): guest 카탈로그 SSR inject.
      //   HTML→JS→fetch 3-RTT 워터폴 제거 — 카드가 첫 페인트에 즉시. 비로그인(공유 응답)만 consume
      //   (로그인 등급가는 클라가 fetch — 등급 캐시로 빠름). prewarm 키와 동일 path.
      ssrTarget = { slot: 'WHOLESALE', path: '/api/wholesale/catalog' };
    } else {
      // 🛡️ 2026-05-30 (loading): /products/:id 상세 SSR inject — 기존엔 누락되어 마운트 후
      //   useProduct fetch 워터폴(HTML→JS→fetch 3-RTT). /api/products/:id 는 publicCache(120) → edge-hit.
      const productMatch = url.pathname.match(/^\/products\/(\d+)(?:[/?#]|$)/);
      // 🛡️ 2026-05-27: /group-buy/:id 와 /vouchers/:id 둘 다 같은 endpoint 사용 → 같은 SSR slot.
      const detailMatch = url.pathname.match(/^\/(?:group-buy|vouchers)\/(\d+)(?:[/?#]|$)/);
      if (productMatch) {
        ssrTarget = { slot: 'PRODUCT', path: `/api/products/${productMatch[1]}` };
      } else if (detailMatch) {
        ssrTarget = { slot: 'DETAIL', path: `/api/group-buy/products/${detailMatch[1]}` };
      } else {
        // 🛡️ 2026-05-27: /profile/:sellerId 외 /s/:sellerId 도 동일 SellerPublicPage — SSR inject 확장.
        const profileMatch = url.pathname.match(/^\/(?:profile|s)\/([A-Za-z0-9_-]{1,40})(?:[/?#]|$)/);
        if (profileMatch) {
          ssrTarget = { slot: 'SELLER', path: `/api/sellers/${profileMatch[1]}/public` };
        } else {
          // 🛡️ 2026-05-27 (큐레이터 SSR): /u/:handle 도 inject — 큐레이터 페이지 로딩 ↓.
          const curatorMatch = url.pathname.match(/^\/u\/([A-Za-z0-9_-]{1,40})(?:[/?#]|$)/);
          if (curatorMatch && curatorMatch[1] !== 'me') {
            ssrTarget = { slot: 'CURATOR', path: `/api/curator/${curatorMatch[1]}` };
          }
        }
      }
    }

    let ssrPayload: string | null = null;
    let ssrStatus = 'skip';
    // 🛡️ 2026-05-27 (production 측정): Server-Timing 헤더 — Chrome DevTools 에서 직접 확인.
    //   edge-read / self-fetch 각각 시간 기록 → 어디서 시간 쓰는지 즉시 파악.
    const timings: string[] = [];
    if (ssrTarget) {
      // 🛡️ 2026-05-27 (비용 최적화 + 속도): edge cache (`caches.default`) 직접 read.
      //   기존: KV second-layer read (~50ms) → KV write 한도 초과 → 비용 발생.
      //   변경: edge cache 직접 read (~5ms). KV 의존성 0, 비용 $0, 속도 더 빠름.
      //   miss 시 self-fetch fallback (publicCache middleware 가 edge cache 자동 write).
      const edgeStart = Date.now();
      try {
        const origin = new URL(c.req.url).origin;
        const cacheKey = new Request(`${origin}${ssrTarget.path}`, { method: 'GET' });
        // @ts-expect-error — Cloudflare Workers 전역 caches
        const cached = await caches.default.match(cacheKey);
        if (cached && cached.status >= 200 && cached.status < 300) {
          const body = await cached.text();
          ssrPayload = body.replace(/<\/script/gi, '<\\/script');
          ssrStatus = 'edge-hit';
        }
      } catch { /* edge cache unavailable */ }
      timings.push(`edge;dur=${Date.now() - edgeStart}`);

      if (!ssrPayload) {
        // 🛡️ 2026-05-27 v2: timeout 증가 — cold start 시 fresh inject 보장.
        //   이전: MAIN 150ms / DETAIL 250ms — cold 시 self-fetch-timeout → 클라가 직접 fetch → 10초+ timeout
        //   변경: MAIN 1500ms / DETAIL/SELLER 2000ms — wait 후 fresh data inject 보장.
        //   trade-off: cold 첫 사용자 1-2초 wait. warm 사용자 (99%+) 영향 0 (edge-hit 가 먼저 응답).
        // 🏭 2026-06-19 [UNLOCK_LOADING] (대표 신고 — 도매 카탈로그 스켈레톤 고착, HTML 증거: __SSR_INITIAL_WHOLESALE__
        //   미주입): 저트래픽 도매몰은 colo 캐시가 대부분 cold → self-fetch 가 콜드 D1(isolate 콜드스타트+ensure+조회)을
        //   1.5초 안에 못 끝내 timeout → 빈 ssrPayload → 주입 스킵 → 클라가 또 콜드 fetch(스켈레톤 장기화).
        //   WHOLESALE 만 3000ms 로 상향 → 콜드여도 데이터 주입 완료(첫 사용자만 ~2-3초 문서 wait, 이후 colo 캐시 300s).
        //   warm(edge-hit) 경로·타 슬롯·소비자 페이지 전부 불변. 근본 해결은 CACHE_KV 전역 워밍(self-fetch=KV-HIT).
        const timeoutMs = (ssrTarget.slot === 'DETAIL' || ssrTarget.slot === 'SELLER' || ssrTarget.slot === 'PRODUCT') ? 2000
          : ssrTarget.slot === 'WHOLESALE' ? 3000
          : 1500;
        const ctlr = new AbortController();
        const timer = setTimeout(() => ctlr.abort(), timeoutMs);
        const selfStart = Date.now();
        try {
          const origin = new URL(c.req.url).origin;
          const r = await fetch(`${origin}${ssrTarget.path}`, {
            signal: ctlr.signal,
            headers: { 'x-ssr-prefetch': '1', 'User-Agent': 'ur-live-ssr-prefetch/1.0' },
          });
          if (r.ok) {
            const body = await r.text();
            ssrPayload = body.replace(/<\/script/gi, '<\\/script');
            ssrStatus = 'self-fetch-hit';
          } else {
            ssrStatus = `self-fetch-${r.status}`;
          }
        } catch {
          ssrStatus = 'self-fetch-timeout';
        } finally {
          clearTimeout(timer);
        }
        timings.push(`self;dur=${Date.now() - selfStart}`);
      }
      c.res.headers.set('X-SSR-Status', `${ssrTarget.slot}:${ssrStatus}`);
      if (timings.length > 0) c.res.headers.set('Server-Timing', timings.join(', '));
    }

    // 🛡️ 2026-05-30 (loading): Early Hints — cross-origin preconnect 를 응답 Link 헤더로 송출.
    //   index.html <head> 의 잠긴 3개 preconnect origin 과 동일(미러 — 변경 아님).
    //   Cloudflare Early Hints(대시보드 Speed→Optimization toggle) 켜지면 103 으로 HTML 본문 전 송출(무료).
    //   toggle off 여도 응답 헤더라 브라우저가 본문 파싱 전 preconnect 시작 → 소폭 이득, 회귀 0.
    c.res.headers.append('Link', '<https://cdn.jsdelivr.net>; rel=preconnect; crossorigin, <https://t1.kakaocdn.net>; rel=preconnect; crossorigin, <https://img1.kakaocdn.net>; rel=preconnect; crossorigin');

    const ssrSlot = ssrTarget?.slot ?? 'MAIN';
    // 🏭 2026-06-05 (사용자 신고 — 도매몰 진입 시 소비자 홈 화면이 잠깐 깜빡임):
    //   prerender 된 index.html 의 #root 에는 소비자 홈 shell(다크 테마·라이브/동네딜 nav 등)이 구워져 있어
    //   /wholesale·/supplier 를 hard-load 하면 React 가 도매 페이지로 라우팅하기 전 그 소비자 shell 이 첫 paint 에
    //   잠깐 보임(다른 업태·다른 테마라 이질적). 해당 surface 에서만 #root 를 도매 라이트 배경 placeholder 로 비워
    //   깜빡임 제거. createRoot(비-hydrate)라 안전. 소비자 페이지의 0-RTT shell·SSR inject 는 불변(additive).
    const isWholesaleSurface = /^\/(wholesale|supplier)(\/|$)/.test(url.pathname);
    // 🏁 2026-06-13 [LOADING_ADDITIVE] (사용자 신고 — "대부분 페이지 로딩 중 / 홈이 잠깐 등장"):
    //   대시보드(seller/admin/agency) hard-load 시에도 prerender 된 #root 의 소비자 홈 shell(다크·라이브 nav)이
    //   첫 paint 에 잠깐 보임 → 도매 surface 와 동일하게 #root 를 라이트 placeholder 로 비워 깜빡임 제거.
    //   createRoot(비-hydrate)라 안전 · 소비자 페이지 SSR inject/0-RTT shell 불변(additive).
    const isDashboardSurface = /^\/(seller|admin|agency)(\/|$)/.test(url.pathname);
    const needsRootBlank = isWholesaleSurface || isDashboardSurface;
    // 🎨 2026-06-21 [LOADING_ADDITIVE] (대표 신고 — 링크샵 첫 로드 시 옛 홈 shell 잔상): /u·/profile·/s 도
    //   prerender 된 #root 의 소비자 홈 shell(다크·라이브 nav)이 React 마운트 전 잠깐 보임("예전 잔재 이미지").
    //   대시보드/도매와 달리 링크샵은 테마 가변(다크 기본+라이트 토글)이라 라이트 placeholder 대신 #root 를
    //   "비워서"(empty) body 테마 bg(인라인 스크립트가 이미 설정)만 잠깐 노출 → 곧 CuratorPage/SellerPublicPage
    //   가 SSR 주입데이터(__SSR_INITIAL_CURATOR/SELLER__)로 즉시 렌더. SSR inject/0-RTT·createRoot 비-hydrate 불변.
    const isLinkshopSurface = /^\/(u|profile|s)(\/|$)/.test(url.pathname);
    // 🧭 2026-06-22 [LOADING_ADDITIVE] (대표 신고 — "잠시 다른 페이지(홈) 갔다 오는 느낌"): 공구/교환권 상세
    //   (/group-buy/:id · /vouchers/:id — 같은 DETAIL slot)도 prerender 된 #root 의 소비자 홈 shell(다크·라이브 nav)이
    //   React 마운트 전 잠깐 보임. linkshop 과 동일하게 #root 비움 — 이 페이지들은 __SSR_INITIAL_DETAIL__ 주입데이터로
    //   즉시 렌더(테마 가변이라 색 placeholder 대신 body 테마 bg 노출). SSR inject/0-RTT·createRoot 비-hydrate 불변(additive).
    const isDetailSurface = /^\/(?:group-buy|vouchers)\/\d+(?:[/?#]|$)/.test(url.pathname);
    let rb = new HTMLRewriter()
      .on('script', {
        element(el) { el.setAttribute('nonce', nonce); },
      })
      .on('meta[name="csp-nonce"]', {
        element(el) { el.setAttribute('content', nonce); },
      })
      .on('head', {
        element(el) {
          if (ssrPayload) {
            // 🛡️ 2026-05-27: slot-prefixed script id — 클라이언트가 페이지별 inject 구별.
            //   기존 __SSR_INITIAL_MAIN__ 호환 유지 (main slot 은 같은 id).
            const scriptId = ssrSlot === 'MAIN' ? '__SSR_INITIAL_MAIN__' : `__SSR_INITIAL_${ssrSlot}__`;
            el.append(
              `<script id="${scriptId}" type="application/json">${ssrPayload}</script>`,
              { html: true },
            );
          }
        },
      });
    if (isWholesaleSurface) {
      // 🏭 2026-06-08 도매 surface 서버측 OG/canonical 주입 — JS 안 도는 소셜 스크래퍼(카톡/페북/슬랙)·일부 봇은
      //   react-helmet(클라 렌더)을 못 보고 index.html 의 소비자 기본 메타만 봄. utongstart 정식 도메인 육성을 위해
      //   도매 surface 응답의 head 메타를 도매 브랜드값으로 rewrite + utongstart canonical append.
      //   (Googlebot 은 JS 렌더해 react-helmet 의 페이지별 정밀 메타를 봄 — 본 주입은 비-JS 크롤러용 fallback.)
      const wsTitle = '유통스타트 도매몰 — 제조사 직거래 B2B 도매사이트';
      const wsDesc = '검증 제조사 상품을 판매사 등급별 도매 공급가로. 무재고 위탁판매·OEM·사입까지, 도매가 거래 B2B 플랫폼.';
      const wsCanonical = `https://utongstart.com${url.pathname}`;
      rb = rb
        .on('title', { element(el) { el.setInnerContent(wsTitle); } })
        .on('meta[name="description"]', { element(el) { el.setAttribute('content', wsDesc); } })
        .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', wsTitle); } })
        .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', wsDesc); } })
        .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', wsCanonical); } })
        .on('meta[property="og:site_name"]', { element(el) { el.setAttribute('content', '유통스타트'); } })
        .on('meta[name="twitter:title"]', { element(el) { el.setAttribute('content', wsTitle); } })
        .on('meta[name="twitter:description"]', { element(el) { el.setAttribute('content', wsDesc); } })
        .on('head', { element(el) { el.append(`<link rel="canonical" href="${wsCanonical}">`, { html: true }); } });
    }
    if (needsRootBlank) {
      // 도매·대시보드 공통: 소비자 홈 shell 깜빡임 제거 (라이트 배경 placeholder).
      rb = rb.on('#root', {
        element(el) {
          el.setInnerContent('<div style="position:fixed;inset:0;background:#F4F5F7"></div>', { html: true });
        },
      });
    } else if (isLinkshopSurface || isDetailSurface) {
      // 링크샵·공구/교환권 상세: 홈 shell 잔상 제거 — #root 비움(테마 가변이라 색 placeholder 대신 body 테마 bg 노출).
      rb = rb.on('#root', {
        element(el) { el.setInnerContent('', { html: true }); },
      });
    }
    const rewritten = rb.transform(c.res);
    c.res = new Response(rewritten.body, rewritten);
    // 🛡️ 2026-06-25 [UNLOCK_LOADING] (대표 승인 "가장 이상적으로 모두"): SPA HTML 셸은 항상 재검증.
    //   옛 HTML(옛 청크 해시)이 브라우저/bfcache 에 잔존 → 새 배포 후 그 청크 404 → 흰화면/안넘어감을
    //   *근본* 차단(서버가 매 하드로드마다 fresh HTML → fresh 청크 해시 보장). 클라 캐시버스트 복구와 이중 방어.
    //   ⚠️ SSR 0-RTT 무영향: 0-RTT 는 API 페이로드를 caches.default 에 캐시(line 553 .match)하는 것이고,
    //   HTML 셸 자체는 edge 캐시 안 함(caches.default.put / cacheEverything 없음 — 워커가 매요청 생성).
    //   no-cache 는 "저장하되 사용 전 재검증" — bfcache 는 유지(no-store 아님)되 stale 사용은 차단.
    c.res.headers.set('Cache-Control', 'no-cache');
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

// 🏭 2026-06-08 호스트 인지 robots.txt — utongstart.com 은 도매 Sitemap 으로 (도매 정식 도메인 육성).
//   SSOT 는 public/robots.txt(ASSETS). utongstart 호스트일 때만 Sitemap 라인을 도매 도메인으로 치환.
//   live.ur-team.com 등 다른 호스트는 원본 그대로(회귀 0).
app.get('/robots.txt', async (c) => {
  const host = new URL(c.req.url).hostname.toLowerCase();
  const isWholesaleHost = host === 'utongstart.com' || host === 'www.utongstart.com';
  let body = '';
  try {
    const assetUrl = new URL('/robots.txt', c.req.url);
    const res = await (c.env as { ASSETS?: { fetch?: (u: string) => Promise<Response> } }).ASSETS?.fetch?.(assetUrl.toString());
    if (res && res.ok) body = await res.text();
  } catch { /* ASSETS 미바인딩 — 아래 fallback */ }
  if (!body) body = 'User-agent: *\nAllow: /\nSitemap: https://live.ur-team.com/sitemap.xml\n';
  if (isWholesaleHost) {
    body = body.replace(/Sitemap:\s*https?:\/\/\S+/i, 'Sitemap: https://utongstart.com/sitemap.xml');
  }
  return c.text(body, 200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
});
app.route('/', docsRoutes);
app.route('/', internalDiagnosticsRoutes);
app.route('/', internalAdminToolsRoutes);
app.route('/', smokeTestRoutes);
app.route('/', repairSchemaRoutes);
app.route('/', errorTelemetryRoutes);
app.route('/', healthcheckRoutes);
app.route('/', selftestRoutes);

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
// 🛡️ 2026-06-16 어드민 RBAC 게이트 — 제한 역할(ops/cs/finance/viewer) 강제. 모든 /api/admin/* 라우트보다 먼저.
//   (login/refresh 는 토큰 전이라 통과 — 미들웨어가 role 미상 시 next). admin-payouts(하이픈)도 별도 게이트.
app.use('/api/admin/*', adminRbacMiddleware());
app.use('/api/admin-payouts/*', adminRbacMiddleware());
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
app.route('/api/me', meRegionRoutes);              // 🗺️ 내 동네 설정/조회
app.route('/api/region', publicRegionRoutes);      // 🗺️ 좌표 → 동네 해석 (공개, 비로그인 자동감지)
app.route('/api/admin/region', adminRegionRoutes); // 🗺️ 동별 딜 밀도 (영입 타겟)

// ============================================================
// Cache Control — read-heavy public endpoints
// ============================================================
// 🚀 Edge cache + Cache-Control 동시 적용 (1인 운영 D1 부하 감소)
// edge cache 는 CF edge 에서 응답 캐싱 → D1 쿼리 자체를 우회 → 빠르고 비용 절감
//
// 🛡️ 2026-05-23 (Task 1): publicCache() 도입 — user-agnostic endpoint 는 인증 헤더 무시 캐싱.
//   기존 edgeCache 는 Authorization/Cookie session 있으면 우회 → 로그인 사용자는 항상 D1 hit.
//   publicCache 는 인증 헤더 무시 → 로그인 사용자도 edge hit → D1 부하 추가 감소.
//   ⚠️ 응답이 user-specific 인 endpoint 에는 절대 사용 금지 (다른 유저 데이터 노출).
app.use('/api/products', publicCache(60), cacheControl(60));     // 1 min — list (user-agnostic)
// 🛡️ 2026-05-19 (사용자 신고: /products/:id 로딩 2-3초):
//   상품 상세 / 옵션 / 리뷰 summary 도 edge cache 로 D1 우회 → ~50ms (cache hit).
app.use('/api/products/:id', publicCache(120), cacheControl(120));      // 2 min — detail (user-agnostic)
app.use('/api/products/:id/options', publicCache(300), cacheControl(300));  // 5 min — 거의 안 변함
app.use('/api/reviews/product/:id/summary', publicCache(180), cacheControl(180));  // 3 min
app.use('/api/streams', publicCache(30), cacheControl(30));      // 30 sec (공개 라이브 목록 — user-agnostic)
// 🛡️ 2026-05-22 사용자 신고 "메인 공구 상품 로딩 너무 느림" 영구 해결:
//   edge cache 60s → 300s + SWR 1800s.
//   stale-while-revalidate 1800s = 5분 fresh + 30분 stale 허용 동안 background revalidate.
//   → 두 번째 사용자부터는 0ms (edge hit), 첫 사용자만 D1 cold-start (KV cache 도 함께 작동).
app.use('/api/group-buy/products', publicCache(300), cacheControl(300, 1800)); // 5min fresh + 30min SWR
// 🛡️ 2026-05-15: 공구 detail (개별) 30초 — group_buy_current 자주 바뀌지만 stale-while-revalidate 가 사용성 보존
app.use('/api/group-buy/products/*', publicCache(30), cacheControl(30));
// 참여자 마스킹 리스트 — 1분 (자주 바뀌지만 prv 정보 X — 이름은 이미 마스킹됨)
app.use('/api/group-buy/products/*/participants', publicCache(60), cacheControl(60));
app.use('/api/group-buy/live-ticker', publicCache(30), cacheControl(30));
app.use('/api/og/group-buy/*', publicCache(3600), cacheControl(3600)); // OG image 1h
app.use('/api/currency/rates', publicCache(3600), cacheControl(3600)); // 환율 1h (전역 데이터)
app.use('/api/banners', publicCache(300), cacheControl(300));    // 5 min (공개 배너)
// 🛡️ 2026-04-22: 추가 공개 read-only 엔드포인트 캐싱 (성능 감사 결과)
app.use('/api/shorts', publicCache(60), cacheControl(60));                // 쇼츠 피드 1min (공개)
// 🛡️ 2026-06-04 [LOADING_ADDITIVE]: /api/shorts/feed (서브경로) 는 위 정확매칭에서 누락 → 링크샵 쇼츠탭 cold.
app.use('/api/shorts/feed', publicCache(60), cacheControl(60));           // 쇼츠 feed 1min (공개)
app.use('/api/reviews/product/*', publicCache(120), cacheControl(120));   // 리뷰 목록 2min (리뷰 쓰기는 POST 라 캐시 무영향)
app.use('/api/restaurants', publicCache(300), cacheControl(300));         // 식당 목록 5min (공개)
// 🛡️ 2026-04-28: 메인페이지 통합 endpoint — 1회 호출 + 1분 edge cache (공개 — user 무관)
app.use('/api/home/bundle', publicCache(60), cacheControl(60));
// 🛡️ 2026-05-19: /api/home/categories — 25+ DB 쿼리 매번 실행되면 느림. 5분 cache.
app.use('/api/home/categories', publicCache(300), cacheControl(300));
// 🛡️ 2026-04-30 perf audit: 추가 공개 read-only 엔드포인트 캐싱
app.use('/api/sellers/*/public', publicCache(60), cacheControl(60));        // 셀러 공개 프로필 1min
// 🏭 2026-06-04 (링크샵 로딩 근본수정): /api/curator/:handle 는 manual 헤더만 있어 caches.default 에
//   write 안 됨 → worker SSR inject 가 항상 edge-MISS → 매 요청 cold self-fetch(최대 1.5s). publicCache
//   미들웨어가 cache.put 하여 SSR edge-HIT 0-RTT 보장. 공개 데이터(본인 편집은 /me/* + 클라 낙관).
//   exact 1세그먼트 매칭 → /:handle/p/* redirect·/me/* 미영향.
// 🏁 2026-06-17 [UNLOCK_LOADING] flip-flop(셀러↔핀 왔다갔다) 근본수정 — publicCache(300)+cacheControl(60,900) → edgeCache(300).
//   원인: publicCache(bypassIfAuthed:false)가 URL-key 캐시를 "소유자에게도" 서빙 + cacheControl 이 소유자 no-store 를 덮어씀
//   → curator.routes 의 owner-fresh 분기(line 178)가 사실상 dead → layout 결정 필드 linked_seller 가 stale캐시↔fresh 로 튐.
//   edgeCache(bypassIfAuthed:true): 인증(소유자/세션) 요청은 캐시 우회 → 핸들러의 owner-aware 헤더(owner=no-store, 익명=max-age60+CDN900)가 그대로 적용.
//   익명 방문자 + SSR self-fetch(무인증) + cron prewarm 은 그대로 caches.default 캐싱 → SSR 0-RTT/CDN 분리/KV-false 전부 불변(익명 경로 byte-동일).
app.use('/api/curator/:handle', edgeCache(300));    // 링크샵 — 소유자/인증 bypass→fresh, 익명/SSR/cron 만 edge 캐싱
app.use('/api/sections', publicCache(120), cacheControl(120));              // 홈 섹션 2min (변동 적음)
app.use('/api/seller-tiers', publicCache(300), cacheControl(300));          // 셀러 등급 5min (거의 안 변함)
app.use('/api/blog/public/*', publicCache(180), cacheControl(180));         // 블로그 공개 글 3min
app.use('/api/search/*', publicCache(30), cacheControl(30));                // 검색 결과 30s (query 기반 — user 무관)
// 🛡️ 2026-05-24 perf audit: 누락된 user-agnostic GET 추가 (실코드 검증 — auth/PII 없음, exact path 충돌 없음)
app.use('/api/vouchers/categories', publicCache(300), cacheControl(300, 1800));    // 교환권 카테고리 5min + SWR 30min — KT Alpha sync 시점에만 변경
app.use('/api/community-group-buy/popular', publicCache(60), cacheControl(60, 300)); // 인기 공구 (50명+) — exact path
app.use('/api/community-group-buy/list', publicCache(30), cacheControl(30, 120));    // 공개 공구 목록 — sort/filter query 기반
app.use('/api/community-group-buy/detail/:code', publicCache(30), cacheControl(30, 120)); // 초대 코드 detail (current_count 변경 위해 짧게)
app.use('/api/group-buy/stays/search', publicCache(60), cacheControl(60, 300));      // 숙소 검색 — query 기반 user 무관

// ============================================================
// Rate limits for read/write endpoints
// Applied per-IP (default key). Auth-sensitive routes fail closed.
// ============================================================
// 🛡️ 2026-05-19 (사용자 신고 fix): 검색 rate limit 상향.
//   30/min 은 typeahead + infinite scroll 페이지네이션 (페이지당 1 req) 합산 시 빠르게 도달.
//   120/min 으로 상향 — 정상 사용 충분, scraping 은 여전히 차단.
app.use('/api/search/*', rateLimit({ action: 'search', max: 120, windowSec: 60 }));
// 🛡️ 2026-05-13: KV 무료 한도 보호 — Products/Sellers 의 GET 트래픽이 rate-limit KV ops 의 대부분 차지.
//   이 endpoint 들은 캐시 (5-30s TTL) 가 있고 scraping abuse 위험 낮음 → rate-limit 제거.
//   필요 시 Cloudflare WAF 또는 turnstile 로 대체.
// app.use('/api/products', rateLimit({ action: 'product_list', max: 60, windowSec: 60 }));
// app.use('/api/sellers/*', rateLimit({ action: 'seller_view', max: 60, windowSec: 60 }));
// app.use('/api/moderation/*', rateLimit({ action: 'moderation_check', max: 60, windowSec: 60 }));
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
// 🛡️ 2026-05-18: 숙소 공구 셀러 CRUD (PR 1 Foundation).
app.route('/api/seller', sellerStaysRoutes);
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
// 🛡️ 2026-04-29 보안 audit (TD-016 MEDIUM): 인증 필수 — DoS / DB write 폭주 방어
// 🛡️ 2026-05-13: KV 무료 한도 보호 — moderation rate-limit 제거 (인증으로 충분, 1m 60회 abuse 위험 낮음)
app.use('/api/moderation/*', requireAuth());
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

// 유캔싸인 전자계약 webhook (문서 상태변경 → contract_signatures 갱신)
app.route('/api/webhooks/ucansign', ucansignWebhookRoutes);

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
// 🏦 2026-06-12 지급 센터 — 셀러/큐레이터/에이전시 신청→입금완료 통합 (사용자 결정)
adminApp.route('/payout-center', payoutCenterRoutes);
// 🛡️ 2026-04-26: 에이전시 셀러 심사 큐 (Agency P0 #1)
adminApp.route('/agency-creator-approvals', adminAgencyApprovalsRoutes);
// Admin tools (chart, sellers, banners, notices, settlements, reports, settings)
adminApp.route('/tools', adminToolsRoutes);
// Admin real-time health metrics (active streams, orders/min, stuck orders, webhooks)
adminApp.route('/metrics', adminMetricsRoutes);
adminApp.route('/business-metrics', platformMetricsRoutes); // 비즈니스 지표(GMV·순수익률·반복구매·여신미수)
// 🛡️ 2026-05-07: Cron / 알림톡 실패 모니터링 (admin 가시성)
adminApp.route('/', adminSystemMonitoringRoutes);
adminApp.route('/', adminManagementRoutes);
// 🛡️ 2026-04-22 배치 138 (TD-006 부분): admin-coupons 분리 — admin-management.routes.ts 줄임
adminApp.route('/', adminCouponsRoutes);

// 📧 2026-06-09 Wave 3b: 어드민 단체메일 (filtered bulk email) — /api/admin/bulk-email
adminApp.route('/', adminBulkEmailRoutes);
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
// 🛡️ 2026-06-01 도매몰: 공급자 계정 관리 + 지급 실행
adminApp.route('/', adminSuppliersRoutes);
// 🏦 2026-06-09 도매몰: 제조사 정산금 출금 신청 승인/반려 (requireAdmin + IP whitelist + audit 체인)
adminApp.route('/', adminWholesaleWithdrawalRoutes);
// 🛡️ 2026-05-18: 숙소 공구 어드민 (PR 1 Foundation).
adminApp.route('/', adminStaysRoutes);
// 🛡️ 2026-05-19: KT Alpha 관리 (catalog sync, markup, biz money 잔액).
adminApp.route('/', adminKtAlphaRoutes);
// 🛡️ 2026-05-19: 원천징수 + 지급조서 export (소득세법 §164/165 의무).
adminApp.route('/', adminWithholdingRoutes);
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
app.route('/api/supplier', supplierAuthRoutes); // 도매몰 INC-3: 외부 도매상 인증
app.route('/api/supplier', supplierDashboardRoutes); // 도매몰 INC-4/6: 공급자 카탈로그 self-serve + 대시보드
app.route('/api/admin/distributor', distributorAdminRoutes); // 유통스타트: 판매사 등급/마진 설정 (Phase 1b)
// 🏭 2026-06-16 [LOADING_ADDITIVE] 도매 user-agnostic 엔드포인트 엣지캐시 — 소비자 /api/products 와 동일 publicCache.
//   실측: 기존 cf-cache DYNAMIC(매 요청 워커) → publicCache 로 HIT(~10ms). banners/mall/board 는 전 사용자 동일 응답.
//   (catalog 는 등급가라 핸들러 내부 캐시로 처리 — 여기 미적용.) 라우트 mount 보다 먼저 등록해야 적용됨.
app.use('/api/wholesale/banners', publicCache(120));
app.use('/api/wholesale/mall', publicCache(300));
app.use('/api/wholesale/board/posts', publicCache(120));
// 🏭 2026-06-16 [LOADING_ADDITIVE] 상품 상세(/catalog/:id) 게스트 엣지캐시 — edgeCache(bypassIfAuthed): 게스트=캐시(가격 null),
//   로그인(Authorization 헤더)=bypass→핸들러(등급가). 200 만 캐시(edge-cache.ts:150, 4xx/5xx 제외) → 머니/오류 안전.
//   리스트(/catalog)는 핸들러 내부 조기 단락으로 처리(여긴 /catalog/* = 상세만 매칭).
app.use('/api/wholesale/catalog/*', edgeCache(120));
app.route('/api/wholesale', wholesaleRoutes); // 유통스타트: 판매사 도매 카탈로그 + B2B 주문 (Phase 2)
app.route('/api/supplier/wholesale', wholesaleSupplierRoutes); // 유통스타트: 제조사 도매주문 송장/반품 (Phase 3)
app.route('/api/wholesale', wholesaleClaimsRoutes); // BIZ-1: 판매사 발의 클레임/RMA + admin 검수
app.route('/api/wholesale/naver', naverCommerceRoutes); // 🛒 2026-06-12: 판매사 스마트스토어 연동 (네이버 커머스API Phase A)
app.route('/api/wholesale/coupang', coupangCommerceRoutes); // 🛒 2026-06-12: 판매사 쿠팡 연동 (Wing 오픈API — 내보내기)
app.route('/api/wholesale', wholesaleQuotesRoutes);  // BIZ-3: 견적/발주(Quote/PO) 워크플로
app.route('/api/wholesale', wholesaleNotificationsRoutes); // NOTI-1: 재입고 알림 + 주문 메모 스레드
app.route('/api/supplier', supplierAnalyticsRoutes); // BIZ-6: 공급사 분석 + 가격일괄/재고import
app.route('/api/supplier', supplierWithdrawalRoutes); // 🏦 제조사 정산금 출금 신청/내역 (requireSupplier)
app.route('/api/admin/wholesale', wholesalePriceReferenceRoutes); // BIZ-5: 네이버 최저가 참고값(어드민 검수)
app.route('/api/admin/wholesale', wholesaleTaxRoutes); // TAX-1: 미수/미지급 aging + 매입 역발행(수동)
app.route('/api/admin/wholesale/integrity', wholesaleIntegrityRoutes); // DATA-1: 고아행 무결성 리포트
app.route('/api/wholesale', wholesaleDepositRoutes); // 🏦 예치금(선불) 결제 — 판매사 잔액/충전요청
app.route('/api/wholesale/plus', wholesalePlusRoutes); // 🏅 프로 멤버십(연 구독) — 예치금 차감
app.route('/api/admin/wholesale-deposits', adminWholesaleDepositRoutes); // 🏦 예치금 입금확인/거절/보정 (어드민)
app.route('/api/wholesale/chat', wholesaleChatRoutes); // 💬 판매사↔제조사 채팅 (D1 polling, websocket/DO 없음)
// 🏭 2026-06-09 도매몰 메인 리디자인 Wave 2 — 배너/제안·신고/프리미엄/입금계좌
app.route('/api/wholesale', wholesaleMainPublicRoutes); // 공개 배너 캐러셀(GET /banners, 캐시) + 판매사 제안·신고(POST/GET /proposals)
app.route('/api/admin/wholesale-banners', adminWholesaleBannerRoutes); // 어드민 배너 CRUD
app.route('/api/wholesale/board', wholesaleBoardPublicRoutes); // 🏭 통합 게시판(공지/자료실) 공개 읽기
app.route('/api/wholesale/wishlist', wholesaleWishlistRoutes); // 🏭 판매사 찜리스트 (로그인)
app.route('/api/admin/wholesale-board', adminWholesaleBoardRoutes); // 어드민 게시글 CRUD
app.route('/api/partnership', partnershipPublicRoutes); // 🤝 광고/제휴 문의 (공개 접수)
app.route('/api/admin/partnership-inquiries', adminPartnershipRoutes); // 어드민 접수함

// 🔐 2026-06-11 SSR Phase 2 (docs/SSR_PHASE2_AUTH.md §3.2-4): 로그아웃 시 ud_* 토큰 쿠키 삭제.
//   클라 clearAuthData() 가 fire-and-forget 호출. 인증 불필요(쿠키 삭제는 무해·멱등).
app.post('/api/auth/logout-cookies', async (c) => {
  const { authTokenClearCookie } = await import('./utils/auth-cookies');
  const host = new URL(c.req.url).hostname;
  c.header('Set-Cookie', authTokenClearCookie('ud_seller_token', host), { append: true });
  c.header('Set-Cookie', authTokenClearCookie('ud_agency_token', host), { append: true });
  // 🔐 2026-06-17 쿠키 전환 Phase 1: admin/supplier ud_* 도 정리.
  c.header('Set-Cookie', authTokenClearCookie('ud_admin_token', host), { append: true });
  c.header('Set-Cookie', authTokenClearCookie('ud_supplier_token', host), { append: true });
  return c.json({ success: true });
});
app.route('/api/admin/wholesale-proposals', adminWholesaleProposalRoutes); // 어드민 제안·신고 큐/처리
app.route('/api/admin/wholesale-products', adminWholesaleProductRoutes); // 어드민 프리미엄 전용관 토글
app.route('/api/admin/wholesale-deposit-account', adminWholesaleDepositAccountRoutes); // 어드민 예치금 입금계좌 설정
app.route('/api/admin/wholesale-malls', adminWholesaleMallRoutes); // 🏬 어드민 멀티-몰 관리 CRUD (식품/패션 등 카테고리별 도매몰)
app.route('/api/admin/wholesale-overview', adminWholesaleOverviewRoutes); // 🏬 어드민 도매 통합 현황 (크로스-몰 read-only 집계)
app.route('/api/admin/ucansign', adminUcansignRoutes); // 🖋️ 전자계약(유캔싸인) 설정 진단 — read-only 준비완료 점검

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
// 🛡️ 2026-05-18: 숙소 공구 사용자 측 (PR 1 Foundation).
app.route('/api/group-buy', staysPublicRoutes);
// 🛡️ 2026-05-18: R2 이미지 업로드 (multi-role).
app.route('/api', uploadRoutes);
// 🛡️ 2026-05-21: 자체 예약 캘린더 (뷰티/액티비티/건강/펫 등 sub-1day 예약).
//   숙소는 별도 stay_bookings 유지. routes 내부 prefix 가 /seller/, /products/, /appointments/ 등 다양.
app.route('/api', appointmentsRoutes);
// 🛡️ 2026-05-21 Phase C: 통합 정산 (payouts 어드민).
app.route('/api', adminPayoutsRoutes);
// 🛡️ 2026-05-21 Phase D: 세무 (전자세금계산서 + 연말 리포트).
app.route('/api', adminTaxRoutes);
// 🛡️ 2026-05-21 Phase D-2: 셀러/에이전시 본인 ledger 조회.
app.route('/api', ledgerRoutes);
// 🛡️ 2026-05-16: 셀러 마케팅 (인플 차단) + 인플루언서 정산 + 어드민 송금 + 인플 카탈로그
app.route('/api/seller-marketing', sellerMarketingRoutes);
app.route('/api/influencer-settlement', influencerSettlementRoutes);
app.use('/api/admin-payouts/*', requireAdmin());
app.route('/api/admin-payouts', adminPayoutRoutes);
app.route('/api/influencer-discover', influencerDiscoverRoutes);
// 🛡️ 2026-05-16: 인플 지역 ranking (공개 — 누구나 조회 가능)
app.route('/api/influencer-rankings', influencerRankingsRoutes);
// 🛡️ 2026-05-16: 카카오맵 후기 보너스
app.route('/api/review-bonus', reviewBonusUserRoutes);
app.use('/api/admin-review-bonus/*', requireAdmin());
app.route('/api/admin-review-bonus', reviewBonusAdminRoutes);
// 🎯 2026-06-20 선착순 응모 상품 (대표) — 공개(목록/상태) + 유저(지원) + 어드민(설정/지원자/선정)
app.route('/api/fcfs', fcfsRoutes);
app.route('/api/admin/fcfs', fcfsAdminRoutes);
// 🎟️ 2026-06-22 사용처리 분쟁(매장 "안 왔어요" 신고 → 정산 보류 + 어드민 중재)
app.route('/api/voucher-dispute', voucherDisputeRoutes);
app.route('/api/admin/voucher-dispute', voucherDisputeAdminRoutes);

// 🛡️ 2026-05-15: 동적 OG 이미지 (KakaoLink / Twitter / Meta 공유용)
app.route('/api/og', ogRoutes);

// 🛡️ 2026-05-25 (migration 0278): 큐레이터 링크샵 (모든 유저가 /u/:handle 공개 페이지)
app.route('/api/curator', curatorRoutes);

// 🛡️ 2026-05-25 (migration 0279): 배송 추적 (tracker.delivery 무료 GraphQL + 외부 URL fallback)
//   - /api/shipping/track/:carrier/:trackingNumber (public)
//   - /api/shipping/order/:orderId/track (requireUser)
//   - /api/shipping/admin/bulk-tracking (requireAdmin, CSV)
//   - /api/shipping/admin/sync (requireAdmin, 수동 cron trigger)
app.route('/api/shipping', shippingRoutes);

// 🛡️ 2026-05-25 (migration 0280): 호스팅 (누구나 voucher 공구 모집)
//   - /api/hosting/catalog (requireUser)
//   - /api/hosting/me (CRUD)
//   - /api/hosting/g/:invite_code (public)
app.route('/api/hosting', hostingRoutes);

// 🛡️ 2026-05-15: Web Vitals + funnel 수집 (1% sampling, KV 카운터, 0원 운영)
app.route('/api/analytics', analyticsRoutes);

// 🛡️ 2026-05-15: A/B Feature Flag (KV 기반, 0원 운영)
app.route('/api/flags', flagRoutes);

// 🛡️ 2026-05-15: 환율 (1시간 KV 캐시)
app.route('/api/currency', currencyRoutes);

// 🛡️ 2026-05-15: 메뉴 OCR (Workers AI llava-1.5-7b, 무료 10K req/day, fallback graceful)
app.route('/api/ocr', ocrRoutes);

// 🛡️ 2026-05-15: 분쟁 자동 분류 (Workers AI llama-3.1-8b, fallback graceful)
//   AI 가 voucher_refused / merchant_closed 분류 + confidence > 0.75 → 즉시 자동 환불
//   나머지는 어드민 escalation
app.route('/api/disputes', disputesRoutes);

// 🛡️ 2026-05-15: 2FA TOTP (셀러/어드민 추가 보안 — Workers crypto 만 사용, 외부 lib 0)
app.route('/api/2fa', twofaRoutes);

// 🛡️ 2026-05-15 (PRISM 따라잡기): 셀러 단골 / 라이브 예고 / 단골 push
app.route('/api/seller-public', sellerPublicRoutes);

// 🛡️ 2026-05-15: 셀러 자체 promo 코드 (단골 전용 할인 등)
app.route('/api/promo', promoRoutes);

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
app.route('/api/agency', agencyIntroducedStoresRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /settlements, /settlement-invoices, /settlement-invoices/:id, /settlements/request
app.route('/api/agency', agencySettlementsRoutes);
// 🛡️ 2026-05-18: 숙소 공구 에이전시 (PR 1 Foundation).
app.route('/api/agency', agencyStaysRoutes);
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
app.route('/api/prospects', prospectsRoutes);
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
// 🛡️ 2026-05-12 (재발 fix): POST /api/seller/youtube/live/create 를 top-level 직접 등록.
//   sub-router 마운트 순서 swap 으로도 405 가 계속 발생 → Hono v4 에서 같은 prefix 의
//   여러 sub-app 마운트 시 라우팅 분쟁이 있음. top-level 직접 등록은 분쟁 없음.
//   sub-router 내부 등록도 유지하여 정상 작동 시 동일하게 동작.
// 🛡️ 2026-05-14: rate limit 제거 (테스트 편의 — 사용자 요청). 필요 시 다시:
//   `const _liveCreateRateLimit = rateLimitMw({ action: 'youtube_live_create', max: 15, windowSec: 3600 });`
//   `app.post(..., _liveCreateRateLimit, createLiveBroadcastHandler);`
app.post('/api/seller/youtube/live/create', createLiveBroadcastHandler);
app.post('/api/youtube/live/create', createLiveBroadcastHandler);

// 그 외 /live/* 경로 (status, start, end, chat 등) 는 기존대로 sub-router 사용.
// 🛡️ 2026-05-12: youtubeLiveRoutes 를 먼저 마운트 — Hono v4 에서 같은 prefix 에
//   두 라우터 마운트 시 첫 번째 라우터가 경로를 "소비"하여 두 번째 라우터의
//   POST /live/create 가 405 반환되는 문제 해결. /live/* 가 더 구체적이므로 우선.
app.route('/api/seller/youtube', youtubeLiveRoutes);
app.route('/api/youtube', youtubeLiveRoutes);
app.route('/api/seller/youtube', youtubeRoutes);
app.route('/api/youtube', youtubeRoutes); // legacy path alias

// 🛡️ 2026-05-08: OvenMediaEngine admission webhook (자체 미디어 서버).
//   OME 가 publish 시도 시 호출 → token 검증 + 셀러의 YouTube RTMP key 동적 push 등록.
app.post('/api/internal/ome/admission', async (c) => {
  // signature 검증을 위해 raw body 그대로 보존 (re-stringify 시 OME 의 원본 바이트와 달라질 수 있음).
  const rawBody = await c.req.text().catch(() => '')
  if (!rawBody) {
    return c.json({ allowed: false, reason: 'empty body' }, 400)
  }
  // 🛡️ 2026-05-12 (C4): JSON 파싱 실패와 핸들러 실패 분리. 잘못된 JSON 은 400 (재시도 무의미),
  //   핸들러 내부 실패만 500 (재시도 가능). OME 에게 정확한 신호 전달.
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch (parseErr) {
    console.warn('[OME admission] invalid JSON body', { length: rawBody.length, err: String(parseErr).slice(0, 100) })
    return c.json({ allowed: false, reason: 'invalid JSON' }, 400)
  }
  try {
    const sig = c.req.header('X-OME-Signature') || null
    const result = await omeAdmissionHandler(body as Parameters<typeof omeAdmissionHandler>[0], sig, c.env, rawBody, (p) => c.executionCtx.waitUntil(p))
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
  // 🛡️ 2026-05-27 (사용자 지적): naver image search / 카카오 daumcdn 호스트 추가.
  //   셀러 등록 시 naver 이미지 선택 → 다양한 외부 호스트 image_url 저장 → 변환 없으면 큰 트래픽.
  const ALLOWED_HOSTS = [
    'firebasestorage.googleapis.com', 'img.youtube.com', 'k.kakaocdn.net', 'images.unsplash.com',
    'live.ur-team.com', 'ur-live.pages.dev',
    'pstatic.net',  // search.pstatic / shop-phinf / blogfiles / postfiles / phinf / mblogthumb-phinf 등
    'daumcdn.net',  // t1.daumcdn / i1.daumcdn / cf.daumcdn 등
    'giftishow.com', // KT Alpha (image / imghub / bizapi / mall / gift / static)
    'kt.com',        // gift-img.kt / image.kt / static.kt
    'ibb.co',        // ImgBB — 셀러가 api.imgbb.com 으로 업로드한 이미지 (i.ibb.co)
    'googleusercontent.com', // Google 프로필 (lh3.googleusercontent.com)
    'kakaocdn.net',  // 🛡️ 2026-05-27 (메인 페이지 카드 이미지 403 사고): img1/img2/k.kakaocdn.net 카카오 이미지 호스트.
                     //   cf-image.ts EXTERNAL_PROXY_HOSTS 에 추가했는데 worker ALLOWED_HOSTS 미추가 → /api/image/resize 403 → 카드 이미지 안 보임.
  ]
  try {
    const parsed = new URL(url)
    if (!ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
      return c.json({ success: false, error: 'domain not allowed' }, 403)
    }
  } catch {
    return c.json({ success: false, error: 'invalid url' }, 400)
  }

  try {
    // 🔬 2026-06-11 (실측 기반 수리 — 사용자 신고 "업로드 카드 느림"):
    //   기존 cf.image fetch 가 Pages 환경에서 변환을 적용하지 않아(실측: 원본 42KB 그대로, 1.6~2.7s)
    //   업로드 이미지(/api/media → 이 프록시 경유)가 전부 원본+느림.
    //   수리: ① 요청 단위 엣지 캐시(repeat ~ms) ② zone 리사이저(cdn-cgi — 오늘 Enable, cf-resized 실측 OK)
    //   경유로 변환 ③ 변환 실패 시 원본 폴백(이미지는 항상 보임 — 기존 동작 보존).
    const cacheKey = new Request(c.req.url, { method: 'GET' });
    // @ts-expect-error — Cloudflare Workers 전역 caches (edge-cache.ts:110 동일 패턴)
    const edge = caches.default as Cache;
    const hit = await edge.match(cacheKey).catch(() => null);
    if (hit) return hit;

    const immutable = (body: BodyInit | ReadableStream | null, type: string) => {
      const headers = new Headers();
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('Content-Type', type);
      return new Response(body as BodyInit, { headers });
    };

    // 🏁 2026-06-11 (사용자 — "이미지가 빠르진 않다" → 사전 생성 파이프라인): 변환 결과를 R2 에
    //   영구 저장. 엣지 캐시는 PoP/시간 한정이지만 R2 썸네일은 전 세계·영구 — 같은 이미지의
    //   변환 비용은 평생 1회(월 unique 한도 소비도 1회), 이후 모든 사용자는 즉시 응답.
    const R2 = (c.env as { MEDIA_BUCKET?: R2Bucket }).MEDIA_BUCKET;
    const safeKey = btoa(unescape(encodeURIComponent(url))).replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/g, '').slice(0, 200);
    const thumbKey = `thumbs/v1/${width}q${quality}/${safeKey}`;
    if (R2) {
      const stored = await R2.get(thumbKey).catch(() => null);
      if (stored) {
        const out = immutable(stored.body, stored.httpMetadata?.contentType || 'image/webp');
        if (c.executionCtx) c.executionCtx.waitUntil(edge.put(cacheKey, out.clone()).catch(() => {}));
        return out;
      }
    }

    const origin = new URL(c.req.url).origin;
    let response = await fetch(`${origin}/cdn-cgi/image/width=${width},quality=${quality},format=auto/${url}`);
    const transformed = response.ok && !!response.headers.get('cf-resized');
    if (!transformed) {
      // 리사이저 미작동/소스 실패 — 원본 폴백 (변환 없이도 이미지는 표시)
      response = await fetch(url);
      if (!response.ok) return c.redirect(url);
    }

    const type = response.headers.get('Content-Type') || 'image/webp';
    // 변환본만 R2 영구 저장 (원본 폴백분은 저장 X — 다음 요청이 변환 재시도). 5MB 캡.
    if (R2 && transformed) {
      const buf = await response.arrayBuffer();
      const out = immutable(buf, type);
      if (c.executionCtx && buf.byteLength > 0 && buf.byteLength <= 5 * 1024 * 1024) {
        c.executionCtx.waitUntil(R2.put(thumbKey, buf, { httpMetadata: { contentType: type } }).catch(() => {}));
        c.executionCtx.waitUntil(edge.put(cacheKey, out.clone()).catch(() => {}));
      }
      return out;
    }

    const out = immutable(response.body, type);
    if (c.executionCtx) c.executionCtx.waitUntil(edge.put(cacheKey, out.clone()).catch(() => {}));
    return out;
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
// 🛡️ 2026-05-21: 사용자 요청 — "돈버는 쇼핑" 키워드 노출 + 오프라인 공동구매 우선.
//   서버 side rendering 의 OG meta tag 와 크롤러용 fallback HTML (search bot).
const DEFAULT_OG = {
  title: '유어딜 - 돈버는 쇼핑, 오프라인 공동구매 & 라이브커머스',
  desc: '동네 가게 공동구매로 결제하고 딜 적립까지. 인플루언서 추천 공구권 + 라이브 쇼핑.',
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

    // 🏁 2026-06-12 (전 플로우 감사 🟡): /u/:handle 링크샵 + /group-buy/:id 공구 상세 —
    //   카카오 공유의 핵심 표면 2곳이 generic OG 였음(스크래퍼는 JS 미실행이라 클라 SEO 무용).
    const curatorMatch = path.match(/^\/u\/([A-Za-z0-9_-]{1,40})(?:[/?#]|$)/);
    if (curatorMatch && curatorMatch[1] !== 'me') {
      const u = await DB.prepare('SELECT name, bio, profile_image, handle FROM users WHERE handle = ?')
        .bind(curatorMatch[1]).first<any>().catch(() => null);
      if (u) {
        og.title = `${u.name || '@' + u.handle} 링크샵 - 유어딜`;
        og.desc = (u.bio || '').slice(0, 200) || `${u.name || '@' + u.handle}님의 추천 — 교환권·공구 모음`;
        const pi = u.profile_image as string | null;
        if (pi) og.image = pi.startsWith('r2://') ? `${BASE_URL}/api/media/${pi.slice(5)}` : (pi.startsWith('/') ? `${BASE_URL}${pi}` : pi);
      }
    }

    const gbMatch = path.match(/^\/group-buy\/(\d+)/);
    if (gbMatch) {
      const p2 = await DB.prepare('SELECT name, description, price, image_url, restaurant_name FROM products WHERE id = ?')
        .bind(gbMatch[1]).first<any>().catch(() => null);
      if (p2) {
        og.title = `${p2.name}${p2.restaurant_name ? ` · ${p2.restaurant_name}` : ''} - 유어딜 공구`;
        og.desc = (p2.description || '').slice(0, 200) || `같이 사면 더 싸다 — ${p2.name} 공동구매`;
        if (p2.image_url) og.image = p2.image_url;
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

  // 🛡️ 2026-06-26 [보안] OG/메타 HTML 인젝션 차단 — og.title/desc/image/canonical 은
  //   products.name / users.bio / live_streams.title 등 사용자-제어 DB 값에서 옴.
  //   봇 UA 로 위장한 요청이 셀러가 심은 `"><script>...` 상품명을 받으면 속성/태그 탈출 →
  //   서빙 문서에 HTML 주입 + 모든 소셜/카톡 링크프리뷰 변조. 모든 보간값을 escape.
  const esc = (v: unknown): string =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  // 메타 태그가 포함된 최소 HTML 반환
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>${esc(og.title)}</title>
<meta name="description" content="${esc(og.desc)}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(og.title)}" />
<meta property="og:description" content="${esc(og.desc)}" />
<meta property="og:image" content="${esc(og.image)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:site_name" content="유어딜" />
<meta property="og:locale" content="ko_KR" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(og.title)}" />
<meta name="twitter:description" content="${esc(og.desc)}" />
<meta name="twitter:image" content="${esc(og.image)}" />
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
// 🏭 2026-06-01 유통스타트 도메인 진입 라우팅 (Phase 5, lock-safe 추가).
//   utongstart.com = 도매몰 전용. 도매몰 surface 밖의 페이지 경로는 /wholesale/intro 로 서버 302.
//   ⚠️ 잠긴 SSR inject / caches.default 블록은 미수정 — fetch 진입부에 additive 가드만.
//   live.ur-team.com 등 다른 호스트는 즉시 app.fetch 로 통과(no-op).
const WHOLESALE_HOSTS = new Set(['utongstart.com', 'www.utongstart.com']);

// 🏭 2026-06-04 도매몰 도메인 게이팅 (사용자 승인 "가장 이상적이고 근본적으로").
//   utongstart.com 에서 접근 허용되는 경로 prefix. 이 목록 밖의 페이지 라우트는 302.
//   ⚠️ 추가만 OK — 제거 시 도매몰에 소비자몰 페이지가 노출됨.
//   동기화 대상: src/utils/domain.ts `isWholesaleAllowedPath` (클라 SPA 가드 — 같이 갱신).
const WHOLESALE_ALLOWED_PATHS = [
  '/api/', '/assets/', '/cdn-cgi/', '/locales/',  // 인프라 (호스트 무관 통과)
  '/wholesale', '/supplier',                        // 도매몰 + 제조사 surface
  '/seller/login', '/seller/register',              // 판매사 = 셀러 계정 인증
  '/auth/', '/login',                               // 카카오 OAuth 콜백 / 로그인
];

/** utongstart.com 에서 해당 경로가 허용되는지 (정적파일 + allowlist prefix). */
function isWholesaleAllowedPath(pathname: string): boolean {
  if (/\.[a-z0-9]+$/i.test(pathname)) return true; // 정적 파일 (favicon/robots/.js/.css …)
  for (const p of WHOLESALE_ALLOWED_PATHS) {
    if (pathname === p) return true;
    if (pathname.startsWith(p.endsWith('/') ? p : p + '/')) return true;
  }
  return false;
}

// 🏬 2026-06-09 멀티몰: wholesale_malls 에 등록된 host 도 '도매몰 전용'으로 인식(루트→/wholesale).
//   ⚠️ 소비자 호스트는 fast-path 로 DB 조회 skip(핫패스 byte-identical). 미지 호스트만 캐시된 몰-호스트 set 조회.
const CONSUMER_FAST_PATH = new Set(['live.ur-team.com', 'ur-live.pages.dev', 'localhost']);
let _mallHostCache: { hosts: Set<string>; at: number } | null = null;
async function getWholesaleMallHosts(env: unknown): Promise<Set<string>> {
  const now = Date.now();
  if (_mallHostCache && now - _mallHostCache.at < 300_000) return _mallHostCache.hosts; // 5분 isolate 캐시
  const set = new Set<string>();
  try {
    const DB = (env as { DB?: D1Database }).DB;
    if (DB) {
      const { results } = await DB.prepare("SELECT host FROM wholesale_malls WHERE active = 1 AND host IS NOT NULL AND host != ''").all<{ host: string }>();
      for (const r of (results || [])) {
        for (const h of String(r.host).split(',')) {        // host 컬럼은 콤마 다중 호스트 허용
          const hh = h.trim().toLowerCase().replace(/^www\./, '');
          if (hh) { set.add(hh); set.add('www.' + hh); }
        }
      }
    }
  } catch { /* 테이블 미존재 환경 — 빈 set(폴백: 정적 WHOLESALE_HOSTS 만) */ }
  _mallHostCache = { hosts: set, at: now };
  return set;
}

export default {
  fetch: async (request: Request, env: unknown, ctx: unknown) => {
    try {
      const url = new URL(request.url);
      const host = url.hostname.toLowerCase();
      let isWhHost = WHOLESALE_HOSTS.has(host);
      // 멀티몰: 정적 set 밖 + 소비자 호스트 아닌 미지 호스트만 등록 몰-호스트 조회(캐시 — 핫패스 영향 0).
      if (!isWhHost && !CONSUMER_FAST_PATH.has(host)) {
        const mallHosts = await getWholesaleMallHosts(env);
        isWhHost = mallHosts.has(host);
      }
      if (isWhHost && !isWholesaleAllowedPath(url.pathname || '/')) {
        // 🏭 몰-first: 도매몰 도메인 비-도매몰 경로 → 카탈로그(/wholesale)로 302. (utongstart + 등록 몰 호스트)
        return Response.redirect(`${url.origin}/wholesale`, 302);
      }
      // 🔗 2026-06-17 [UNLOCK_LOADING] 링크샵 URL 통일 (사용자 승인 "전체 통일 + 301"):
      //   셀러 공개 URL /profile/:username · /s/:slug → 연결 유저 handle 있으면 /u/{handle} 로 301(영구).
      //   handle 없으면 통과(기존 SellerPublicPage 그대로). 검색 노출/외부링크를 /u/ 로 통일.
      //   /u/{seller-handle} 은 CuratorPage 가 linked_seller 감지해 SellerPublicPage 를 inline 렌더(기존 동작).
      //   additive 진입 가드 — 잠긴 SSR inject 블록 무수정. /profile/:x, /s/:x exact 1세그먼트만 매칭(서브경로 X).
      const lsMatch = url.pathname.match(/^\/(?:profile|s)\/([A-Za-z0-9_-]{1,40})\/?$/);
      if (lsMatch) {
        try {
          const DB = (env as { DB?: D1Database }).DB;
          if (DB) {
            const slug = lsMatch[1];
            const row = await DB.prepare(
              `SELECT u.handle AS handle FROM sellers s JOIN users u ON u.id = s.linked_user_id
               WHERE (s.username = ? OR CAST(s.id AS TEXT) = ?) AND u.handle IS NOT NULL AND u.handle != '' LIMIT 1`
            ).bind(slug, slug).first<{ handle: string }>();
            if (row?.handle && row.handle.toLowerCase() !== 'me' && row.handle.toLowerCase() !== slug.toLowerCase()) {
              return Response.redirect(`${url.origin}/u/${encodeURIComponent(row.handle)}${url.search || ''}`, 301);
            }
          }
        } catch { /* 조회 실패 — 기존 /profile 서빙으로 통과 */ }
      }
    } catch { /* URL 파싱 시 통과 */ }
    // @ts-expect-error — Hono app.fetch 시그니처로 위임 (env/ctx passthrough).
    return app.fetch(request, env, ctx);
  },
  scheduled: handleCronScheduled,
};
