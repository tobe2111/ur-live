/**
 * Lightweight Discord alert utility for critical error notifications.
 *
 * Usage:
 *   await sendDiscordAlert(env.DISCORD_WEBHOOK_URL, 'Title', 'message', 'error');
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
