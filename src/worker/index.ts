// ============================================================
// Cloudflare Worker - Main Entry Point (Unified)
// Global Marketplace API — ALL routes consolidated here
// Legacy src/index.tsx has been retired.
// ============================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { timing } from 'hono/timing';
import { swaggerUI } from '@hono/swagger-ui';
import { openApiSpec } from './openapi';

// ---- Worker-local routes (multi-seller MVP) ----
import type { Env } from './types/env';
import { authRouter } from './routes/auth.routes';
import { authTokenRoutes } from './routes/auth-token.routes'; // Phase 2.3
import { productsRouter } from './routes/product.routes';
import { ordersRouter } from './routes/order.routes';
import { paymentsRouter } from './routes/payment.routes';
import { stripeRouter } from './routes/stripe.routes';
import { sellersRouter } from './routes/seller.routes';
import { streamsRouter } from './routes/streams.routes';  // ✅ 공개 스트림 라우트
import { usersRouter } from './routes/users.routes';      // ✅ /api/users/role, /api/users/init
import { i18nMiddleware } from './middleware/i18n.middleware';
import { rateLimitMiddleware as rateLimiterMiddleware } from './middleware/rate-limiter';
import { globalErrorHandler as errorHandler } from './middleware/error-handler';

// ---- Feature module routes ----
import { accountRoutes } from '../features/account/api/account.routes';
import { adminManagementRoutes, adminBannersRoutes } from '../features/admin/api/index';
import { scraperProxy } from '../features/admin/api/scraper-proxy.routes';
import { adminRoutes as adminAuthRoutes } from '../features/auth/api/admin.routes';
import { kakaoRoutes } from '../features/auth/api/kakao.routes';
import { sellerRoutes as sellerAuthRoutes } from '../features/auth/api/seller.routes';
import { googleRoutes } from '../features/auth/api/google.routes';
import { bannerRoutes } from '../features/banners/api/banners.routes';
import { cartRoutes } from '../features/cart/api/cart.routes';
import { notificationsRoutes } from '../features/notifications/api/notifications.routes';
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

// ---- Durable Objects (re-exported for wrangler binding) ----
export { LiveStreamDurableObject } from '../durable-object';

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
  const scriptSources = [
    "'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:",
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
    "frame-ancestors 'self';"
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
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=(self), payment=(self), usb=()');
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
// Auth Routes
// ============================================================

// Worker-native user auth (register / login / logout / refresh / me)
app.route('/api/auth', authRouter);

// Phase 2.3: Backend ID Token endpoint
app.route('/api/auth', authTokenRoutes);

// Feature: Kakao OAuth  →  /auth/kakao/sync/callback + /api/auth/kakao/*
app.route('/auth/kakao', kakaoRoutes);
app.route('/api/auth/kakao', kakaoRoutes);

// Feature: Admin auth — rate limited: 5 attempts per 5 min per IP
app.use('/api/admin/login', rateLimit({ action: 'admin_login', max: 5, windowSec: 300 }));
app.route('/api/admin', adminAuthRoutes);

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
// Streams Routes  ← /api/streams (공개 조회용)
// 프론트엔드의 LiveNow, useLiveStream, AdminPage 등이 /api/streams 호출
// 판매자 전용 CRUD는 /api/seller/streams 유지
// ============================================================
app.route('/api/streams', streamsRouter);

// ============================================================
// Product & Seller Routes
// ============================================================

// ✅ Feature products 가 먼저 처리 (응답 포맷: { success, data: [...], pagination })
// Worker-native productsRouter는 Hono 라우트 겹침 방지를 위해 주석 처리
// (featureProductsRoutes가 GET / 와 GET /:id 를 모두 처리함)
// app.route('/api/products', productsRouter); // 제거: featureProductsRoutes와 충돌

// Feature products (extended CRUD) — 유일한 /api/products 핸들러
app.route('/api/products', featureProductsRoutes);

// /api/search/popular — featureProductsRoutes의 /search/popular 에 alias
// (프론트엔드가 /api/search/popular 로 호출)
app.route('/api/search', featureProductsRoutes);

// Worker-native sellers list + public routes
app.route('/api/sellers', sellersRouter);

// Feature seller management
app.route('/api/seller', sellerManagementRoutes);
app.route('/api/seller', sellerOrdersRoutes);
app.route('/api/seller/analytics', sellerAnalyticsRoutes);
app.route('/api/seller/streams', sellerStreamsRoutes);

// Email notifications (global)
import { emailRoutes } from '../features/notifications/api/email.routes';
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

// ✅ paymentsRouter: POST /confirm, POST /checkout-session (worker-native)
app.route('/api/payments', paymentsRouter);

// ✅ featurePaymentRoutes: POST /rollback 만 담당 (confirm은 paymentsRouter가 처리)
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
adminApp.route('/', adminManagementRoutes);
adminApp.route('/banners', adminBannersRoutes);
adminApp.route('/cafe24', cafe24Routes);
// Restaurant settlement (admin)
import { restaurantSettlementRoutes, sellerSettlementRoutes } from '../features/settlement/api/restaurant-settlement.routes';
adminApp.route('/restaurant-settlement', restaurantSettlementRoutes);
app.route('/api/scraper', scraperProxy);  // /api/admin 밖 — adminApp 미들웨어 간섭 없음
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
app.route('/api/seller', sellerDonationsRoutes);

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
import { youtubeGrowthRoutes } from '../features/youtube-growth/api/youtube-growth.routes';
app.route('/api/youtube-growth', youtubeGrowthRoutes);

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

// ── 블로그 (어드민 CRUD + 공개 조회) ──
import { blogRoutes } from '../features/blog/api/blog.routes';
app.route('/api/admin/blog', blogRoutes);
app.route('/api/blog', blogRoutes); // public 엔드포인트 접근용

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

  // Cloudflare Image Resizing (available on paid plans)
  // For free plan, just proxy with cache headers
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

    // If image resizing not available, just proxy with cache
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Content-Type', response.headers.get('Content-Type') || 'image/webp');

    return new Response(response.body, { headers });
  } catch {
    // Fallback: redirect to original
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
import { handleAutoSettlement } from './cron/auto-settlement';

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Run existing cleanup tasks (every 5 minutes)
    ctx.waitUntil(handleScheduled(env));

    // Auto-settlement: runs on every trigger but only processes vouchers 7+ days old
    ctx.waitUntil(handleAutoSettlement(env));
  },
};
