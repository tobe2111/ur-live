/**
 * Lightweight Discord alert utility for critical error notifications.
 *
 * Usage:
 *   await sendDiscordAlert(env.DISCORD_WEBHOOK_URL, 'Title', 'message', 'error');
 *
 * Dedup (\uC635\uC158):
 *   await sendDiscordAlertDedup(env, env.DISCORD_WEBHOOK_URL, 'Title', 'message', 'error', 300);
 *   \u2192 \uAC19\uC740 (title,severity) 5\uBD84 \uB0B4 \uC911\uBCF5 \uBC1C\uC1A1 \uCC28\uB2E8 (RATE_LIMIT_KV \uD544\uC694).
 */

export async function sendDiscordAlert(
  webhookUrl: string,
  title: string,
  message: string,
  severity: 'info' | 'warn' | 'error' = 'error'
) {
  if (!webhookUrl) return;

  const colors = { info: 0x3498db, warn: 0xf39c12, error: 0xe74c3c };
  const icons = { info: '\u2139\uFE0F', warn: '\u26A0\uFE0F', error: '\uD83D\uDEA8' };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: `${icons[severity]} ${title}`,
          description: message.slice(0, 2000),
          color: colors[severity],
          timestamp: new Date().toISOString(),
        }]
      })
    });
  } catch {
    // fire and forget
  }
}

/**
 * \uD83D\uDEE1\uFE0F 2026-05-22: dedup \uB798\uD37C. \uAC19\uC740 (title,severity) \uAC00 window \uB0B4 \uC7AC\uD638\uCD9C\uB418\uBA74 skip.
 *   RATE_LIMIT_KV \uBBF8\uC124\uC815 \uC2DC fail-open (\uBAA8\uB450 \uBC1C\uC1A1).
 */
export async function sendDiscordAlertDedup(
  env: { RATE_LIMIT_KV?: KVNamespace },
  webhookUrl: string,
  title: string,
  message: string,
  severity: 'info' | 'warn' | 'error' = 'error',
  dedupSeconds = 300,
): Promise<void> {
  if (!webhookUrl) return;
  const kv = env.RATE_LIMIT_KV;
  if (kv && dedupSeconds > 0) {
    const key = `alert:dedup:${severity}:${title}`.slice(0, 256);
    try {
      const existing = await kv.get(key);
      if (existing) return;
      await kv.put(key, '1', { expirationTtl: dedupSeconds });
    } catch { /* KV \uC7A5\uC560 \uC2DC fail-open */ }
  }
  await sendDiscordAlert(webhookUrl, title, message, severity);
}
