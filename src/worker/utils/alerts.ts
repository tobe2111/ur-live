/**
 * Unified Alert Utility
 * Sends alerts to Discord or Slack webhook (whichever is configured).
 * Falls back silently if neither webhook is available.
 */

import type { Env } from '../types/env';

export interface AlertPayload {
  severity: 'info' | 'warn' | 'error' | 'critical';
  title: string;
  message: string;
  context?: Record<string, unknown>;
  /** dedup window in seconds — same (title, severity) within window collapses to first send. 0 = no dedup. */
  dedupSeconds?: number;
}

// Keys whose values must never leak into alert webhooks (Discord/Slack).
// Matching is case-insensitive on a substring basis, so `authToken`,
// `refresh_token`, `paymentKey`, etc. are all caught by the core names.
const SENSITIVE_KEYS = [
  'password', 'passwd', 'pwd',
  'token', 'accesstoken', 'refreshtoken',
  'api_key', 'apikey',
  'secret',
  'paymentkey', 'payment_key',
  'authorization', 'auth',
  'cookie', 'set-cookie',
  'jwt', 'bearer',
  'ssn', 'card', 'cvc', 'cvv',
] as const;

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => lower.includes(s));
}

/**
 * Recursively redact sensitive values in an arbitrary object.
 * Caps recursion depth to guard against circular/huge payloads.
 */
function sanitizeContext(obj: unknown, depth = 0): unknown {
  if (depth > 6) return '[TRUNCATED]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => sanitizeContext(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(k)) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      out[k] = sanitizeContext(v, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * 🛡️ 2026-05-22: dedup via RATE_LIMIT_KV. Same (title, severity) within window
 *   suppressed — prevents 100+ identical alerts during a sustained spike.
 *   Default window: 5분 (caller can override or set 0 to disable).
 */
async function isDedupSuppressed(env: Env, payload: AlertPayload): Promise<boolean> {
  const window = payload.dedupSeconds ?? 300;
  if (window <= 0) return false;
  const kv = env.RATE_LIMIT_KV;
  if (!kv) return false;  // KV 미설정 시 fail-open (alert 모두 발송)
  const key = `alert:dedup:${payload.severity}:${payload.title}`.slice(0, 256);
  try {
    const existing = await kv.get(key);
    if (existing) return true;
    await kv.put(key, '1', { expirationTtl: window });
  } catch {
    return false;
  }
  return false;
}

/**
 * Send an alert to the configured webhook (Discord or Slack).
 * Uses AbortSignal.timeout(5000) to avoid blocking the worker.
 */
export async function sendAlert(env: Env, payload: AlertPayload): Promise<void> {
  const e = env as unknown as Record<string, string | undefined>
  const discordUrl = e.DISCORD_ALERT_WEBHOOK || env.DISCORD_WEBHOOK_URL;
  const slackUrl = e.SLACK_ALERT_WEBHOOK;

  if (!discordUrl && !slackUrl) return;

  // dedup — critical 은 항상 발송 (의도적으로 dedup window=0 권장).
  if (await isDedupSuppressed(env, payload)) return;

  // ⚠️  Never send raw payload.context to a third-party webhook. It can contain
  //    tokens, payment keys, cookies, etc. Redact before stringifying.
  const safeContext = payload.context ? sanitizeContext(payload.context) : undefined;
  const contextStr = safeContext
    ? '\n```json\n' + JSON.stringify(safeContext, null, 2).slice(0, 800) + '\n```'
    : '';

  try {
    if (discordUrl) {
      await sendDiscordAlert(discordUrl, payload, contextStr);
    } else if (slackUrl) {
      await sendSlackAlert(slackUrl, payload, contextStr);
    }
  } catch {
    // Fire and forget — never let alert failures crash the worker
  }
}

async function sendDiscordAlert(
  webhookUrl: string,
  payload: AlertPayload,
  contextStr: string
): Promise<void> {
  const colors: Record<string, number> = {
    info: 0x3498db,
    warn: 0xf39c12,
    error: 0xe74c3c,
    critical: 0x8b0000,
  };
  const icons: Record<string, string> = {
    info: 'ℹ️',
    warn: '⚠️',
    error: '🚨',
    critical: '🔥',
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      embeds: [{
        title: `${icons[payload.severity] || ''} ${payload.title}`,
        description: (payload.message + contextStr).slice(0, 2000),
        color: colors[payload.severity] || colors.error,
        timestamp: new Date().toISOString(),
      }],
    }),
  });
}

async function sendSlackAlert(
  webhookUrl: string,
  payload: AlertPayload,
  contextStr: string
): Promise<void> {
  const icons: Record<string, string> = {
    info: ':information_source:',
    warn: ':warning:',
    error: ':rotating_light:',
    critical: ':fire:',
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      text: `${icons[payload.severity] || ''} *${payload.title}*\n${payload.message}${contextStr}`,
    }),
  });
}
