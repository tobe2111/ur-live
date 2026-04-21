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
    });

    // Error sent to Discord
  } catch (err) {
    console.error('[Error Handler] Failed to send to Discord:', err);
  }
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
  Promise.all([
    sendToSentry(c, error as Error, errorResponse),
    sendToDiscord(c, error as Error, errorResponse),
  ]).catch((err) => {
    console.error('[Error Handler] Failed to send notifications:', err);
  });

  // 사용자에게 에러 응답 반환
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
