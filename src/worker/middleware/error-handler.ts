import type { Context } from 'hono';
import type { HTTPException } from 'hono/http-exception';

/**
 * ✅ Global Error Handler
 * 
 * Week 5 Day 4 - Rate Limiting & Global Error Handler
 * 
 * 목적:
 * - 모든 에러를 중앙에서 처리
 * - Sentry로 에러 전송
 * - Discord Webhook 알림
 * - 사용자 친화적 에러 메시지
 */

interface ErrorResponse {
  error: string;
  message: string;
  code: string;
  statusCode: number;
  timestamp: string;
  path: string;
  requestId?: string;
}

/**
 * 에러 코드 매핑
 */
const ERROR_CODES = {
  // 클라이언트 에러 (4xx)
  BAD_REQUEST: { code: 'BAD_REQUEST', status: 400, message: 'Invalid request' },
  UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401, message: 'Authentication required' },
  FORBIDDEN: { code: 'FORBIDDEN', status: 403, message: 'Access denied' },
  NOT_FOUND: { code: 'NOT_FOUND', status: 404, message: 'Resource not found' },
  RATE_LIMIT_EXCEEDED: { code: 'RATE_LIMIT_EXCEEDED', status: 429, message: 'Too many requests' },
  
  // 서버 에러 (5xx)
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', status: 500, message: 'Internal server error' },
  SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', status: 503, message: 'Service temporarily unavailable' },
  GATEWAY_TIMEOUT: { code: 'GATEWAY_TIMEOUT', status: 504, message: 'Gateway timeout' },
  
  // 데이터베이스 에러
  DATABASE_ERROR: { code: 'DATABASE_ERROR', status: 500, message: 'Database operation failed' },
  
  // 외부 API 에러
  EXTERNAL_API_ERROR: { code: 'EXTERNAL_API_ERROR', status: 502, message: 'External API error' },
} as const;

/**
 * 에러 응답 생성
 */
function createErrorResponse(
  c: Context,
  error: Error | HTTPException,
  code: string = 'INTERNAL_ERROR'
): ErrorResponse {
  const errorInfo = ERROR_CODES[code as keyof typeof ERROR_CODES] || ERROR_CODES.INTERNAL_ERROR;

  // ✅ Security: never leak raw internal error strings in production — they
  //    can disclose stack traces, SQL snippets, or secrets. Only surface
  //    error.message for 4xx client errors or in DEV builds.
  const isDev = (() => {
    try { return !!import.meta.env?.DEV; } catch { return false; }
  })();
  const is4xx = errorInfo.status >= 400 && errorInfo.status < 500;
  const safeMessage = (isDev || is4xx)
    ? (error.message || errorInfo.message)
    : errorInfo.message;

  return {
    error: errorInfo.code,
    message: safeMessage,
    code: errorInfo.code,
    statusCode: errorInfo.status,
    timestamp: new Date().toISOString(),
    path: new URL(c.req.url).pathname,
    requestId: c.req.header('x-request-id'),
  };
}

/**
 * 에러를 Sentry로 전송
 */
async function sendToSentry(
  c: Context,
  error: Error,
  errorResponse: ErrorResponse
): Promise<void> {
  const sentryDsn = (c.env as any).SENTRY_DSN || (c.env as any).VITE_SENTRY_DSN;

  if (!sentryDsn) {
    return;
  }

  try {
    // Use Sentry Envelope API (no SDK needed for Workers)
    const sentryEvent = {
      event_id: crypto.randomUUID().replace(/-/g, ''),
      timestamp: Math.floor(Date.now() / 1000),
      platform: 'javascript',
      level: 'error',
      logger: 'cloudflare-worker',
      message: error.message,
      exception: {
        values: [{
          type: error.name || 'Error',
          value: error.message,
          stacktrace: error.stack ? {
            frames: error.stack.split('\n').slice(1).map(line => ({ filename: line.trim() }))
          } : undefined
        }]
      },
      request: {
        url: errorResponse.path,
        method: c.req.method,
      },
      extra: {
        code: errorResponse.code,
        statusCode: errorResponse.statusCode,
        requestId: errorResponse.requestId,
      },
    };

    // Parse DSN to get project endpoint
    const url = new URL(sentryDsn);
    const projectId = url.pathname.replace('/', '');
    const sentryUrl = `${url.protocol}//${url.host}/api/${projectId}/envelope/`;

    const envelope = [
      JSON.stringify({ event_id: sentryEvent.event_id, sent_at: new Date().toISOString() }),
      JSON.stringify({ type: 'event' }),
      JSON.stringify(sentryEvent),
    ].join('\n');

    await fetch(sentryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_key=${url.username}, sentry_version=7`,
      },
      body: envelope,
      signal: AbortSignal.timeout(5000), // ⏱️ 2026-11-17
    });

    // Error sent to Sentry
  } catch (err) {
    console.error('[Error Handler] Failed to send to Sentry:', err);
  }
}

/**
 * 에러를 Discord로 전송
 */
async function sendToDiscord(
  c: Context,
  error: Error,
  errorResponse: ErrorResponse
): Promise<void> {
  const webhookUrl = c.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    return;
  }

  // 5xx 에러만 Discord 알림 (중요한 에러만)
  if (errorResponse.statusCode < 500) {
    return;
  }

  try {
    const embed = {
      title: `🚨 ${errorResponse.error}`,
      description: error.message,
      color: 0xFF0000, // 빨간색
      fields: [
        { name: 'Path', value: errorResponse.path, inline: true },
        { name: 'Status', value: errorResponse.statusCode.toString(), inline: true },
        { name: 'Timestamp', value: errorResponse.timestamp, inline: false },
        { name: 'Stack', value: `\`\`\`${error.stack?.slice(0, 500) || 'N/A'}\`\`\``, inline: false },
      ],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
      signal: AbortSignal.timeout(5000), // ⏱️ 2026-11-17
    });

    // Error sent to Discord
  } catch (err) {
    console.error('[Error Handler] Failed to send to Discord:', err);
  }
}

/** 브라우저의 화면(문서) 요청인가 — API·에셋·비GET 은 아니다. */
export function isPageRequest(method: string, path: string, accept: string | null | undefined): boolean {
  if (method !== 'GET') return false;
  if (path.startsWith('/api/') || path.startsWith('/auth/') || path.startsWith('/assets/')) return false;
  if (/\.[a-z0-9]{1,5}$/i.test(path)) return false; // 파일(.js·.xml·.png …)
  return (accept || '').includes('text/html');
}

const FALLBACK_HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>유어딜</title><meta http-equiv="refresh" content="5"></head><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#F8F7FC;color:#16181C;display:flex;align-items:center;justify-content:center;min-height:100dvh;text-align:center"><div style="padding:24px"><p style="font-size:17px;font-weight:700;margin:0 0 8px">잠시 연결이 불안정해요</p><p style="font-size:15px;color:#666C72;margin:0 0 20px">몇 초 뒤 자동으로 다시 열어요.</p><button onclick="location.reload()" style="border:0;border-radius:12px;padding:12px 20px;font-size:15px;font-weight:700;background:#1C69EF;color:#fff">다시 열기</button></div></body></html>`;

/** 화면 요청이면 SPA 셸(없으면 안내 페이지)을 돌려준다. 화면 요청이 아니면 null. */
export async function pageFallback(c: Context): Promise<Response | null> {
  const url = new URL(c.req.url);
  if (!isPageRequest(c.req.method, url.pathname, c.req.header('accept'))) return null;
  const headers = { 'content-type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' };
  try {
    const assets = (c.env as { ASSETS?: { fetch: (u: string) => Promise<Response> } } | undefined)?.ASSETS;
    const res = assets ? await assets.fetch(new URL('/', url).toString()) : null;
    if (res && res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
      return new Response(res.body, { status: 200, headers });
    }
  } catch { /* 셸도 못 받았다 — 아래 안내 페이지 */ }
  return new Response(FALLBACK_HTML, { status: 503, headers: { ...headers, 'Retry-After': '5' } });
}

/**
 * Global Error Handler
 */
export async function globalErrorHandler(
  error: Error | HTTPException,
  c: Context
): Promise<Response> {
  console.error('[Global Error Handler] Error caught:', {
    message: error.message,
    stack: error.stack,
    url: c.req.url,
  });

  // 에러 코드 감지
  let errorCode = 'INTERNAL_ERROR';
  
  if ('status' in error) {
    // HTTPException
    const status = error.status;
    if (status === 400) errorCode = 'BAD_REQUEST';
    else if (status === 401) errorCode = 'UNAUTHORIZED';
    else if (status === 403) errorCode = 'FORBIDDEN';
    else if (status === 404) errorCode = 'NOT_FOUND';
    else if (status === 429) errorCode = 'RATE_LIMIT_EXCEEDED';
    else if (status === 503) errorCode = 'SERVICE_UNAVAILABLE';
    else if (status === 504) errorCode = 'GATEWAY_TIMEOUT';
  } else if (error.message.includes('database')) {
    errorCode = 'DATABASE_ERROR';
  } else if (error.message.includes('fetch') || error.message.includes('API')) {
    errorCode = 'EXTERNAL_API_ERROR';
  }

  // 에러 응답 생성
  const errorResponse = createErrorResponse(c, error, errorCode);

  // Sentry & Discord 전송 (비동기, 블로킹 안 함)
  // ⏱️ 2026-11-17: 응답 뒤에도 끝까지 보내도록 waitUntil 에 맡긴다 — 맡기지 않으면 응답이 나가는 순간 런타임이 이 전송을
  //   취소할 수 있어, 장애가 한창일 때 알림이 빠졌다(가장 알림이 필요한 순간). 응답 시간은 그대로다.
  const notify = Promise.all([
    sendToSentry(c, error as Error, errorResponse),
    sendToDiscord(c, error as Error, errorResponse),
  ]).catch((err) => {
    console.error('[Error Handler] Failed to send notifications:', err);
  });
  try { c.executionCtx.waitUntil(notify) } catch { /* executionCtx 없는 환경(시험) — 위 promise 는 그대로 돈다 */ }

  // 사용자에게 에러 응답 반환
  // 🩹 2026-11-18 (Sentry JAVASCRIPT-REACT-38 — GET `/` 에서 `internal error; reference=…`):
  //   그 문구는 Cloudflare 런타임 내부 일시 오류(에셋·캐시·서브요청)다. 문제는 그 다음이었다 —
  //   **화면 요청에도 JSON 500 을 돌려줘서** 손님이 홈 대신 영어 오류 글자만 봤다.
  //   화면 요청이면 SPA 셸을 다시 받아 그대로 준다(서버 시드만 빠지고 앱이 스스로 불러온다).
  //   셸도 못 받으면 한국어 안내 + 자동 재시도 페이지. API·비GET 은 종전 그대로 JSON.
  if (errorResponse.statusCode >= 500) {
    const page = await pageFallback(c).catch(() => null);
    if (page) return page;
  }
  return c.json(errorResponse, errorResponse.statusCode as any);
}

/**
 * Simplified handleError for direct usage (alias for globalErrorHandler)
 */
export async function handleError(
  error: Error | HTTPException,
  request: Request,
  extraContext?: Record<string, any>
): Promise<Response> {
  // Create a minimal Context-like object
  const mockContext: any = {
    req: {
      url: request.url,
      header: (name: string) => request.headers.get(name),
    },
    get: (key: string) => extraContext?.[key],
    set: () => {},
    json: (data: any, status: number) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  };

  return globalErrorHandler(error, mockContext);
}

/**
 * Not Found Handler (404)
 */
/**
 * Middleware to attach error context to requests
 */
export async function attachErrorContext(c: any, next: () => Promise<void>) {
  // Attach request context for error handling
  c.set('errorContext', {
    timestamp: Date.now(),
    requestId: crypto.randomUUID(),
    ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for'),
    userAgent: c.req.header('user-agent'),
  });
  
  await next();
}

/**
 * 404 Not Found Handler
 */
export function notFoundHandler(c: Context): Response {
  const errorResponse: ErrorResponse = {
    error: 'NOT_FOUND',
    message: 'The requested resource was not found',
    code: 'NOT_FOUND',
    statusCode: 404,
    timestamp: new Date().toISOString(),
    path: new URL(c.req.url).pathname,
    requestId: c.req.header('x-request-id'),
  };

  console.warn('[Not Found Handler]', errorResponse.path);

  return c.json(errorResponse, 404);
}
