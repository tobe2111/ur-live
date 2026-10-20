// ============================================================
// Structured Logging for Cloudflare Workers
//
// Outputs JSON lines to `console.*` so Cloudflare Logs
// (wrangler tail, Workers Logs) can parse them as structured
// events. Use from routes / services where you need richer
// context than bare `console.log`.
//
// Browser code should continue to use `src/lib/logger.ts`.
// ============================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  userId?: string | number
  orderId?: string | number
  endpoint?: string
  duration?: number
  requestId?: string
  // anything else caller wants to attach
  [key: string]: unknown
}

/**
 * Emit a structured log line.
 *
 * `debug` is suppressed unless `ENVIRONMENT=development` is passed
 * via `context.env` or the worker-wide `__DEV__` flag is set.
 */
export function log(level: LogLevel, message: string, context: LogContext = {}): void {
  if (level === 'debug' && !isDev(context)) return

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }

  // Workers console outputs JSON → Cloudflare Logs
  const line = safeStringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

/** Shortcut helpers. */
export const logDebug = (message: string, context?: LogContext) => log('debug', message, context)
export const logInfo = (message: string, context?: LogContext) => log('info', message, context)
export const logWarn = (message: string, context?: LogContext) => log('warn', message, context)
export const logError = (message: string, context?: LogContext) => log('error', message, context)

function isDev(context: LogContext): boolean {
  // Workers runtime has no `import.meta.env.DEV`.
  // Prefer explicit env hint if caller passes it.
  const env = context?.env as { ENVIRONMENT?: string } | undefined
  if (env?.ENVIRONMENT && env.ENVIRONMENT !== 'production') return true
  // Fallback — conservative (production-safe).
  return false
}

/** JSON.stringify that never throws on cycles / BigInts. */
function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'bigint') return value.toString()
      return value
    })
  } catch {
    return JSON.stringify({ error: 'logger:serialize_failed' })
  }
}

/**
 * Time an async operation and log duration on both success and failure.
 */
export async function logDuration<T>(
  label: string,
  fn: () => Promise<T>,
  context: LogContext = {},
): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    log('info', label, { ...context, duration: Date.now() - start, outcome: 'success' })
    return result
  } catch (e) {
    log('error', label, {
      ...context,
      duration: Date.now() - start,
      outcome: 'error',
      error: (e as Error)?.message,
    })
    throw e
  }
}
