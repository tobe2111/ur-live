// ============================================================
// Request-ID correlation middleware
//
// Reads Cloudflare's `CF-Ray` header (or generates a UUID) and
// stores it on the Hono context as `requestId`. The same value
// is echoed back to the client via the `X-Request-Id` response
// header so logs, client telemetry, and Cloudflare's edge logs
// can be correlated to the same request.
//
// Usage in routes:
//   const reqId = c.get('requestId');
//   logError('something failed', { requestId: reqId, ... });
// ============================================================

import type { Context, Next } from 'hono';

export function requestId() {
  return async (c: Context, next: Next) => {
    const id = c.req.header('CF-Ray') || crypto.randomUUID();
    c.set('requestId', id);
    await next();
    c.res.headers.set('X-Request-Id', id);
  };
}
