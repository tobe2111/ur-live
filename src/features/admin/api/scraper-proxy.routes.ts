import { Hono } from 'hono';
import { verify } from 'hono/jwt';
import type { Env } from '../../../worker/types/env';

/**
 * 네이버 광고 스크래퍼 프록시 라우트
 *
 * 브라우저 → Cloudflare Worker (/api/scraper/*) → 스크래퍼 서버
 *
 * /api/admin 경로와 완전 분리 — adminApp의 requireAdmin() 미들웨어가
 * /api/admin/* 전체에 적용되므로 /api/scraper로 등록해야 충돌 없음
 *
 * 환경변수:
 *   SCRAPER_URL = http://localhost:3456  (개발)
 *   SCRAPER_URL = https://scraper.your-domain.com  (운영)
 */
const scraperProxy = new Hono<{ Bindings: Env }>();

const DEFAULT_SCRAPER_URL = 'http://localhost:3456';

scraperProxy.all('/*', async (c) => {
  // ── Auth: Bearer 토큰만 허용 (hono/jwt — 서명과 동일 라이브러리) ─────
  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) {
    return c.json({ error: 'Auth service misconfigured' }, 503);
  }

  const authHeader = c.req.header('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await verify(token, jwtSecret, 'HS256') as Record<string, unknown>;
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  if (payload.type !== 'admin') {
    return c.json({ error: 'Admin access required', got: payload.type }, 403);
  }

  // ── Proxy ──────────────────────────────────────────────────────────────
  const scraperUrl = (c.env as any).SCRAPER_URL;
  if (!scraperUrl) {
    return c.json({ error: '스크래퍼 서버가 설정되지 않았습니다 (SCRAPER_URL 환경변수 필요)' }, 503);
  }

  // /api/scraper/api/status → scraperUrl + /api/status
  const subPath = c.req.path.replace(/^\/api\/scraper/, '');
  const targetUrl = `${scraperUrl}${subPath || '/'}`;

  // query string 전달
  const qs = c.req.url.split('?')[1];
  const fullUrl = qs ? `${targetUrl}?${qs}` : targetUrl;

  try {
    const req = c.req.raw;
    const proxyReq = new Request(fullUrl, {
      method: req.method,
      headers: {
        'content-type': req.headers.get('content-type') || '',
        'accept':       req.headers.get('accept') || '',
      },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
    });

    const upstream = await fetch(proxyReq);

    // SSE 스트리밍은 그대로 통과 (ReadableStream 지원)
    const contentType = upstream.headers.get('content-type') || '';
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': contentType,
        'cache-control': 'no-cache',
        ...(contentType.includes('event-stream') && {
          'x-accel-buffering': 'no',
        }),
      },
    });
  } catch (err: any) {
    return c.json(
      { error: '스크래퍼 서버에 연결할 수 없습니다.', detail: err.message },
      502
    );
  }
});

export { scraperProxy };
