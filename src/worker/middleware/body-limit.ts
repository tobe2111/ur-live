/**
 * Body size limit middleware.
 *
 * Hono does not ship with a body-size guard, so we inspect the `Content-Length`
 * header and reject payloads larger than `maxBytes` with HTTP 413. This
 * prevents payload-DoS scenarios where a client sends a huge JSON body that
 * would otherwise be fully buffered by downstream handlers.
 *
 * Note: clients can omit or lie about Content-Length for chunked bodies. We
 * still accept the request in that case — downstream `c.req.json()` calls
 * should themselves have sensible field-level length caps (see
 * `utils/validation.ts`).
 */
import type { Context, Next } from 'hono';

export function bodyLimit(maxBytes = 1_000_000) {
  return async (c: Context, next: Next) => {
    const contentLength = c.req.header('content-length');
    if (contentLength) {
      const size = Number(contentLength);
      if (Number.isFinite(size) && size > maxBytes) {
        return c.json(
          { success: false, error: '요청 본문이 너무 큽니다.' },
          413
        );
      }
    }
    return next();
  };
}
