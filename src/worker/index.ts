// ============================================================
// Cloudflare Worker - Main Entry Point (Unified)
// Global Marketplace API — ALL routes consolidated here
// Legacy src/index.tsx has been retired.
// ============================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { timing } from 'hono/timing';

// ---- Worker-local routes (multi-seller MVP) ----
import type { Env } from './types/env';
import { authRouter } from './routes/auth.routes';
import { productsRouter } from './routes/product.routes';
import { ordersRouter } from './routes/order.routes';
import { paymentsRouter } from './routes/payment.routes';
import { sellersRouter } from './routes/seller.routes';
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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' " +
      "https://*.cloudflare.com https://static.cloudflareinsights.com https://cloudflareinsights.com " +
      "https://*.tosspayments.com https://js.tosspayments.com " +
      "https://*.stripe.com https://js.stripe.com https://m.stripe.network https://m.stripe.com " +
      "https://*.firebase.google.com https://*.firebaseio.com https://apis.google.com https://*.googleapis.com " +
      "https://kauth.kakao.com https://*.kakao.com https://t1.kakaocdn.net https://*.daumcdn.net " +
      "https://cdn.jsdelivr.net https://unpkg.com https://*.sentry.io " +
      "https://www.googletagmanager.com https://www.google-analytics.com https://*.googletagmanager.com " +
      "https://googletagmanager.com https://*.firebaseapp.com; " +
    "script-src-elem 'self' 'unsafe-inline' " +
      "https://*.cloudflare.com https://static.cloudflareinsights.com https://cloudflareinsights.com " +
      "https://*.tosspayments.com https://js.tosspayments.com " +
      "https://*.stripe.com https://js.stripe.com https://m.stripe.network https://m.stripe.com " +
      "https://*.firebase.google.com https://*.firebaseio.com https://apis.google.com https://*.googleapis.com " +
      "https://kauth.kakao.com https://*.kakao.com https://t1.kakaocdn.net https://*.daumcdn.net " +
      "https://cdn.jsdelivr.net https://unpkg.com https://*.sentry.io " +
      "https://www.googletagmanager.com https://www.google-analytics.com https://*.googletagmanager.com " +
      "https://googletagmanager.com https://*.firebaseapp.com; " +
    "worker-src 'self' blob:; " +
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://*.stripe.com https://m.stripe.network; " +
    "img-src 'self' 'unsafe-inline' data: https: blob:; " +
    "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; " +
    "connect-src 'self' https: wss:; " +
    "frame-src 'self' https://*.tosspayments.com https://js.tosspayments.com https://*.stripe.com https://js.stripe.com https://m.stripe.network https://m.stripe.com https://*.firebaseapp.com https://urteam-live-commerce-5b284.firebaseapp.com https://*.firebase.google.com https://*.firebaseio.com https://kauth.kakao.com https://*.kakao.com https://www.youtube.com https://youtube.com https://player.vimeo.com; " +
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
// Auth Routes
// ============================================================

// Worker-native user auth (register / login / logout / refresh / me)
app.route('/api/auth', authRouter);

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
// Product & Seller Routes
// ============================================================

// Worker-native products (multi-seller MVP)
app.route('/api/products', productsRouter);

// Feature products (extended CRUD)
app.route('/api/products', featureProductsRoutes);

// Worker-native sellers list
app.route('/api/sellers', sellersRouter);

// Feature seller management
app.route('/api/seller', sellerManagementRoutes);
app.route('/api/seller', sellerOrdersRoutes);
app.route('/api/seller', sellerStreamsRoutes);

// ============================================================
// Order & Payment Routes
// ============================================================

// Worker-native orders (multi-seller, idempotency, webhook)
app.route('/api/orders', ordersRouter);

// Feature orders (extended query/types)
app.route('/api/orders', featureOrdersRoutes);

// Worker-native payments + webhook
app.route('/api/payments', paymentsRouter);

// Feature payments (confirm/rollback)
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
// 404 for API routes not matched above
// ============================================================

app.all('/api/*', (c) => c.json({ success: false, error: 'Not found' }, 404));

// ============================================================
// SPA Fallback
// Cloudflare Pages serves static assets automatically.
// For pure Worker mode, return 404 for non-API routes.
// ============================================================

app.get('*', async () => {
  return new Response('Not found', { status: 404 });
});

// ============================================================
// Error Handler
// ============================================================

app.onError(errorHandler);

export default {
  fetch: app.fetch,
};
