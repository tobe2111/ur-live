/**
 * Cloudflare Worker Entry Point
 * 
 * 모든 Feature 라우트를 통합하는 메인 Worker 파일
 * 기존 src/index.tsx의 16,031줄을 대체
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { serveStatic } from 'hono/cloudflare-workers';

// Feature Routes
import { kakaoRoutes } from '@/features/auth';

type Bindings = {
  DB: D1Database;
  SESSION_KV: KVNamespace;
  CACHE_KV: KVNamespace;
  ASSETS: Fetcher;
  KAKAO_REST_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_DATABASE_URL: string;
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

// Request Logging
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`[${c.req.method}] ${c.req.path} - ${c.res.status} (${duration}ms)`);
});

// =================================
// Health Check
// =================================

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    worker: 'ur-live-worker-v2',
    features: ['auth', 'products', 'orders']
  });
});

// =================================
// Feature Routes
// =================================

// Auth Feature
app.route('/auth/kakao', kakaoRoutes);
app.route('/api/auth/kakao', kakaoRoutes);

// TODO: 다른 Feature 라우트 추가
// app.route('/api/products', productsRoutes);
// app.route('/api/orders', ordersRoutes);
// app.route('/api/live-stream', liveStreamRoutes);

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
// Error Handler
// =================================

app.onError(async (err, c) => {
  console.error('[Worker Error]', {
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method
  });
  
  // Discord Webhook으로 에러 알림 (선택)
  if (c.env.DISCORD_WEBHOOK_URL) {
    try {
      await fetch(c.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '🚨 Worker Error',
            color: 0xFF0000,
            fields: [
              { name: 'Error', value: err.message, inline: false },
              { name: 'Path', value: c.req.path, inline: true },
              { name: 'Method', value: c.req.method, inline: true }
            ],
            timestamp: new Date().toISOString()
          }]
        })
      });
    } catch (webhookErr) {
      console.error('[Discord] Webhook failed:', webhookErr);
    }
  }
  
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '서버 오류가 발생했습니다.'
    }
  }, 500);
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
