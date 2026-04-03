import { Hono } from 'hono';
import type { Env } from '../../worker/types/env';

/**
 * 네이버 광고 스크래퍼 프록시 라우트
 *
 * 브라우저 → Cloudflare Worker (/api/admin/scraper/*) → 스크래퍼 서버
 *
 * 이 구조가 필요한 이유:
 *   브라우저의 localhost ≠ 스크래퍼 서버의 localhost
 *   Worker가 중간에서 프록시 역할을 해야 브라우저가 스크래퍼에 접근 가능
 *
 * 환경변수:
 *   SCRAPER_URL = http://localhost:3456  (개발)
 *   SCRAPER_URL = https://scraper.your-domain.com  (운영)
 */
const scraperProxy = new Hono<{ Bindings: Env }>();

const DEFAULT_SCRAPER_URL = 'http://localhost:3456';

scraperProxy.all('/*', async (c) => {
  const scraperUrl = (c.env as any).SCRAPER_URL || DEFAULT_SCRAPER_URL;

  // /api/admin/scraper/api/status → scraperUrl + /api/status
  const subPath = c.req.path.replace(/^\/api\/admin\/scraper/, '');
  const targetUrl = `${scraperUrl}${subPath || '/'}`;

  try {
    const req = c.req.raw;
    const proxyReq = new Request(targetUrl, {
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
          'x-accel-buffering': 'no',   // nginx 버퍼링 비활성화
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
