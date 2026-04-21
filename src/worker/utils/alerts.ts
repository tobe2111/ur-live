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

  const contextStr = payload.context
    ? '\n```json\n' + JSON.stringify(payload.context, null, 2).slice(0, 800) + '\n```'
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
