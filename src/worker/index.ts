/**
 * Cloudflare Worker Entry Point
 * 
 * 모든 Feature 라우트를 통합하는 메인 Worker 파일
 * 기존 src/index.tsx의 16,031줄을 대체
 * 
 * Week 5 Day 4 업데이트:
 * - Rate limiting (IP-based, KV-backed)
 * - Global error handling with Sentry
 * - Retry logic for external APIs
 * - Discord alerts for critical errors
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { serveStatic } from 'hono/cloudflare-workers';

// Feature Routes
import { kakaoRoutes, googleRoutes, sellerRoutes, adminRoutes } from '@/features/auth';
import { adminManagementRoutes, adminBannersRoutes } from '@/features/admin';
import { productsRoutes } from '@/features/products';
import { ordersRoutes } from '@/features/orders';
import { accountRoutes } from '@/features/account';
import { sellerManagementRoutes } from '@/features/seller/api/seller-management.routes';
import { sellerOrdersRoutes } from '@/features/seller/api/seller-orders.routes';
import { sellerStreamsRoutes } from '@/features/seller/api/seller-streams.routes';
import { cartRoutes } from '@/features/cart/api/cart.routes';
import { shippingAddressRoutes } from '@/features/shipping/api/shipping-address.routes';
import { paymentRoutes } from '@/features/payments/api/payment.routes';
import youtubeRoutes from '@/features/youtube/api/youtube.routes';
import youtubeChatRoutes from '@/features/youtube/api/youtube-chat.routes';

// Middleware & Utils
import { rateLimitMiddleware } from './middleware/rate-limiter';
import { handleError, attachErrorContext } from './middleware/error-handler';
import { initSentry, captureException } from './utils/sentry';
import { initDiscord, sendCriticalAlert } from './utils/discord';
import { APICacheStrategy, CacheConfigs } from '@/lib/api-cache-strategy';

type Bindings = {
  DB: D1Database;
  SESSION_KV: KVNamespace;
  CACHE_KV: KVNamespace;
  RATE_LIMIT_KV: KVNamespace;
  ASSETS: Fetcher;
  KAKAO_REST_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_DATABASE_URL: string;
  SENTRY_DSN?: string;
  DISCORD_WEBHOOK_URL?: string;
  ENVIRONMENT: string;
  REGION: 'KR' | 'WORLD';
  [key: string]: any;
};

const app = new Hono<{ Bindings: Bindings }>();

// =================================
// Global Middleware
// =================================

// CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Compression
app.use('*', compress());

// Initialize monitoring tools
app.use('*', async (c, next) => {
  // Initialize Sentry (once per worker instance)
  if (c.env.SENTRY_DSN && !c.get('sentryInitialized')) {
    initSentry({
      dsn: c.env.SENTRY_DSN,
      environment: c.env.ENVIRONMENT || 'production',
      region: c.env.REGION || 'KR',
      enabled: true,
    });
    c.set('sentryInitialized', true);
  }

  // Initialize Discord alerter (once per worker instance)
  if (c.env.DISCORD_WEBHOOK_URL && !c.get('discordInitialized')) {
    initDiscord({
      webhookUrl: c.env.DISCORD_WEBHOOK_URL,
      environment: c.env.ENVIRONMENT || 'production',
      region: c.env.REGION || 'KR',
      enabled: true,
      rateLimitMs: 60000, // 1 minute between duplicate alerts
    });
    c.set('discordInitialized', true);
  }

  await next();
});

// API Response Caching (KV-backed)
app.use('/api/products*', async (c, next) => {
  if (!c.env.CACHE_KV) return next();
  
  const cacheStrategy = new APICacheStrategy(c.env.CACHE_KV);
  const cacheKey = cacheStrategy.generateCacheKey(c.req.path, c.req.query());
  
  // Try to get from cache
  const cached = await cacheStrategy.get(cacheKey);
  if (cached && c.req.method === 'GET') {
    c.header('X-Cache', 'HIT');
    c.header('X-Cache-Age', Math.floor((Date.now() - cached.timestamp) / 1000).toString());
    return c.json(cached.data);
  }
  
  // Continue with request
  await next();
  
  // Cache successful GET responses
  if (c.res.ok && c.req.method === 'GET') {
    try {
      const responseData = await c.res.clone().json();
      await cacheStrategy.set(cacheKey, responseData, CacheConfigs.products);
      c.header('X-Cache', 'MISS');
    } catch (e) {
      // Non-JSON response, skip caching
    }
  }
});

// Rate Limiting (IP-based, KV-backed)
app.use('/api/*', rateLimitMiddleware);
app.use('/auth/*', rateLimitMiddleware);

// Attach error context for better debugging
app.use('*', attachErrorContext);

// Request Logging with Performance Monitoring
app.use('*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  
  await next();
  
  const duration = Date.now() - start;
  const status = c.res.status;
  
  console.log(`[${method}] ${path} - ${status} (${duration}ms)`);
  
  // Performance warning for slow requests (>2s)
  if (duration > 2000) {
    console.warn(`⚠️ Slow request detected: ${method} ${path} took ${duration}ms`);
    
    // Send Discord alert for very slow requests (>5s)
    if (duration > 5000) {
      try {
        const { getDiscord } = await import('./utils/discord');
        const discord = getDiscord();
        if (discord) {
          await discord.sendPerformanceWarning(
            `${method} ${path}`,
            duration,
            5000
          );
        }
      } catch (err) {
        console.error('[Discord] Failed to send performance alert:', err);
      }
    }
  }
});

// =================================
// Health Check
// =================================

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    worker: 'ur-live-worker-v2.3',
    version: '2.3.0',
    features: [
      'auth-kakao', 
      'auth-google', 
      'auth-seller', 
      'auth-admin', 
      'products', 
      'orders', 
      'account'
    ],
    middleware: ['rate-limiting', 'error-handling', 'retry-logic', 'monitoring'],
    region: c.env.REGION || import.meta.env.VITE_REGION || 'KR',
    environment: c.env.ENVIRONMENT || 'production',
    monitoring: {
      sentry: !!c.env.SENTRY_DSN,
      discord: !!c.env.DISCORD_WEBHOOK_URL,
    },
  });
});

// =================================
// Feature Routes
// =================================

// Auth Feature (KR: Kakao, WORLD: Google, JWT: Seller/Admin)
app.route('/auth/kakao', kakaoRoutes);
app.route('/api/auth/kakao', kakaoRoutes);
app.route('/api/auth/google', googleRoutes);
app.route('/api/seller', sellerRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api', kakaoRoutes); // Add this to handle /api/users/role

// Admin Management Feature (Complete Implementation)
app.route('/api/admin', adminManagementRoutes);
app.route('/api/admin/banners', adminBannersRoutes);

// Seller Management Feature (Phase 1)
app.route('/api/seller', sellerManagementRoutes);
app.route('/api/seller', sellerOrdersRoutes);
app.route('/api/seller', sellerStreamsRoutes);

// Cart Feature (Phase 1)
app.route('/api/cart', cartRoutes);

// Shipping Address Feature (Phase 1)
app.route('/api/shipping-addresses', shippingAddressRoutes);

// Payment Feature (Phase 1)
app.route('/api/payments', paymentRoutes);

// Products Feature
app.route('/api/products', productsRoutes);

// Orders Feature
app.route('/api/orders', ordersRoutes);

// Account Management Feature
app.route('/api/account', accountRoutes);

// YouTube Integration Feature
app.route('/api/youtube', youtubeRoutes);
app.route('/api/youtube/chat', youtubeChatRoutes);

// TODO: Phase 2 Feature 라우트 추가
// app.route('/api/streams', liveStreamRoutes);
// app.route('/api/banners', bannersRoutes);
// app.route('/api/admin/sellers', adminSellersRoutes);

// =================================
// Static Assets & SPA Fallback
// =================================

// Static files (먼저 시도)
app.get('*', serveStatic({ root: './' }));

// SPA Fallback (React Router 지원)
app.get('*', async (c) => {
  const path = c.req.path;
  
  // API/Auth 경로는 404 반환
  if (path.startsWith('/api/') || path.startsWith('/auth/')) {
    return c.notFound();
  }
  
  // 그 외 모든 경로는 index.html 제공
  try {
    const indexHtml = await c.env.ASSETS.fetch(
      new Request('https://dummy.com/index.html')
    ).then(r => r.text());
    
    return c.html(indexHtml);
  } catch (error) {
    console.error('[SPA Fallback] Failed to serve index.html:', error);
    return c.notFound();
  }
});

// =================================
// Error Handler (Unified with Sentry + Discord)
// =================================

app.onError(async (err, c) => {
  console.error('[Worker Error]', {
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method
  });
  
  // Use unified error handler (Sentry + Discord + structured logging)
  try {
    const errorContext = c.get('errorContext') || {};
    const response = await handleError(err, c.req.raw, errorContext);
    return response;
  } catch (handlerError) {
    console.error('[Error Handler] Failed:', handlerError);
    
    // Fallback error response
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 오류가 발생했습니다.'
      }
    }, 500);
  }
});

// =================================
// Not Found Handler
// =================================

app.notFound((c) => {
  console.warn('[404]', c.req.path);
  
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
      path: c.req.path
    }
  }, 404);
});

export default app;
