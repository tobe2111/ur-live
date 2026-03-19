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
import { sellersRouter } from './routes/seller.routes';
import { streamsRouter } from './routes/streams.routes';  // ✅ 공개 스트림 라우트
import { usersRouter } from './routes/users.routes';      // ✅ /api/users/role, /api/users/init
import { i18nMiddleware } from './middleware/i18n.middleware';
import { rateLimitMiddleware as rateLimiterMiddleware } from './middleware/rate-limiter';
import { globalErrorHandler as errorHandler } from './middleware/error-handler';

// ---- Feature module routes ----
import { accountRoutes } from '../features/account/api/account.routes';
import { adminManagementRoutes, adminBannersRoutes } from '../features/admin/api/index';
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
import { sellerStreamsRoutes } from '../features/seller/api/seller-streams.routes';
import { shippingAddressRoutes } from '../features/shipping/api/shipping-address.routes';
import { wishlistRoutes } from '../features/wishlists/api/wishlists.routes';
import youtubeRoutes from '../features/youtube/api/youtube.routes';
import youtubeChatRoutes from '../features/youtube/api/youtube-chat.routes';

// ---- Durable Objects (re-exported for wrangler binding) ----
export { LiveStreamDurableObject } from '../durable-object';

const app = new Hono<{ Bindings: Env }>();

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
    const allowed = [
      env?.FRONTEND_URL ?? 'http://localhost:5173',
      'https://ur-live.pages.dev',
      'https://www.ur-live.com',
      'https://live.ur-team.com',   // ✅ 실제 프로덕션 도메인 추가
      'https://ur-team.com',
      'https://www.ur-team.com',
      'http://localhost:5173',
      'http://localhost:3000',
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
  c.header('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: " +
      "https://*.cloudflare.com https://static.cloudflareinsights.com https://cloudflareinsights.com " +
      "https://*.googletagmanager.com https://*.google-analytics.com " +
      "https://*.tosspayments.com https://js.tosspayments.com " +
      "https://*.stripe.com https://js.stripe.com https://m.stripe.network https://m.stripe.com " +
      "https://*.firebase.google.com https://*.firebaseio.com https://*.firebasedatabase.app " +
      "https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app " +
      "https://apis.google.com https://*.googleapis.com " +
      "https://kauth.kakao.com https://*.kakao.com https://t1.kakaocdn.net https://*.daumcdn.net " +
      "https://www.youtube.com https://youtube.com https://s.ytimg.com https://*.youtube.com " +
      "https://cdn.jsdelivr.net https://unpkg.com https://*.sentry.io " +
      "https://*.firebaseapp.com https://urteam-live-commerce-5b284.firebaseapp.com; " +
    "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' blob: " +
      "https://*.cloudflare.com https://static.cloudflareinsights.com https://cloudflareinsights.com " +
      "https://*.googletagmanager.com https://*.google-analytics.com " +
      "https://*.tosspayments.com https://js.tosspayments.com " +
      "https://*.stripe.com https://js.stripe.com https://m.stripe.network https://m.stripe.com " +
      "https://*.firebase.google.com https://*.firebaseio.com https://*.firebasedatabase.app " +
      "https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app " +
      "https://apis.google.com https://*.googleapis.com " +
      "https://kauth.kakao.com https://*.kakao.com https://t1.kakaocdn.net https://*.daumcdn.net " +
      "https://www.youtube.com https://youtube.com https://s.ytimg.com https://*.youtube.com " +
      "https://cdn.jsdelivr.net https://unpkg.com https://*.sentry.io " +
      "https://*.firebaseapp.com https://urteam-live-commerce-5b284.firebaseapp.com; " +
    "worker-src 'self' blob:; " +
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://*.stripe.com https://m.stripe.network; " +
    "img-src 'self' 'unsafe-inline' data: https: blob:; " +
    "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; " +
    "connect-src 'self' https: wss: " +
      "https://*.firebaseio.com https://*.firebasedatabase.app " +
      "wss://*.firebaseio.com wss://*.firebasedatabase.app " +
      "wss://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app; " +
    "frame-src 'self' " +
      "https://*.tosspayments.com https://js.tosspayments.com " +
      "https://*.stripe.com https://js.stripe.com https://m.stripe.network https://m.stripe.com " +
      "https://*.firebaseapp.com https://urteam-live-commerce-5b284.firebaseapp.com " +
      "https://*.firebase.google.com https://*.firebaseio.com " +
      "https://kauth.kakao.com https://*.kakao.com " +
      "https://www.youtube.com https://youtube.com https://*.youtube.com https://www.youtube-nocookie.com " +
      "https://player.vimeo.com; " +
    "child-src 'self' blob:; " +
    "media-src 'self' https: blob:; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'none';"
  );
  const url = new URL(c.req.url);
  if (url.hostname !== 'localhost' && url.protocol === 'https:') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(self), usb=()');
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

app.get('/api/health', (c) => c.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '2.0.0',
  environment: (c.env as Env).ENVIRONMENT ?? 'development',
}));

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

// Debug endpoint to check bindings
app.get('/api/debug/bindings', (c) => {
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

// Feature: Admin auth   →  /api/admin/login, /api/admin/refresh
app.route('/api/admin', adminAuthRoutes);

// Feature: Seller auth  →  /api/seller/login, /api/seller/refresh
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
app.route('/api/seller', sellerStreamsRoutes);

// ============================================================
// Order & Payment Routes
// ============================================================

// ✅ ordersRouter (worker-native) 가 먼저 처리:
//    POST /, GET /, GET /:id, POST /:id/cancel
//    (authMiddleware 사용, 멀티셀러 지원, 아이덤포턴시)
app.route('/api/orders', ordersRouter);

// ✅ featureOrdersRoutes가 ordersRouter에 없는 추가 엔드포인트 처리
//    GET / 와 GET /:id 는 ordersRouter가 먼저 처리하므로 featureOrdersRoutes의 동일 엔드포인트는 도달하지 않음
//    → 실제로는 ordersRouter가 모든 주요 경로 처리. feature는 fallback용으로만 유지.
app.route('/api/orders', featureOrdersRoutes);

// ✅ paymentsRouter: POST /confirm, POST /checkout-session (worker-native)
app.route('/api/payments', paymentsRouter);

// ✅ featurePaymentRoutes: POST /rollback (paymentsRouter에 없는 경로만)
//    POST /confirm 은 paymentsRouter가 먼저 처리 → featurePaymentRoutes의 /confirm 미도달
//    → /rollback 만 실질적으로 featurePaymentRoutes에서 처리됨
app.route('/api/payments', featurePaymentRoutes);

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
app.route('/api/admin/banners', adminBannersRoutes);

// Admin management
app.route('/api/admin', adminManagementRoutes);

// Push notifications
app.route('/', pushRoutes);  // pushRoutes already uses full path /api/push/*

// Account
app.route('/api/account', accountRoutes);

// YouTube / Live streaming
// Register at both paths for backward-compatibility with older frontend deployments
app.route('/api/seller/youtube', youtubeRoutes);
app.route('/api/youtube', youtubeRoutes); // legacy path alias
app.route('/api/youtube/chat', youtubeChatRoutes);

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
// 404 for API routes not matched above
// ============================================================

app.all('/api/*', (c) => c.json({ success: false, error: 'Not found' }, 404));

// ============================================================
// Error Handler
// ============================================================

app.onError(errorHandler);

// ============================================================
// Export Worker - API routes only (_routes.json handles static files)
// ============================================================

export default app;
