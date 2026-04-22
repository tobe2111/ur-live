/**
 * 5xx Error Rate Monitor
 *
 * 짧은 시간에 5xx 가 폭증하면 Discord 로 긴급 알림.
 * 개별 에러는 globalErrorHandler 가 처리, 이건 "스파이크" 감지용.
 *
 * 사용 예: 1인 운영자가 새벽에 자는 동안 갑자기 에러 100개 터지면 즉시 알림.
 *
 * 메커니즘:
 * - D1 rate_limit_attempts 테이블 재사용 (action='5xx_spike')
 * - 1분 window 에 5xx 가 THRESHOLD 이상이면 webhook 발송
 * - 같은 분에 한 번만 알림 (cooldown)
 */

import type { Context, Next } from 'hono';
import { sendDiscordAlert } from '../utils/discord-alert';

const SPIKE_THRESHOLD = 10; // 1분 내 5xx 10건 이상이면 알림
const WINDOW_SEC = 60;

export function errorRateMonitor() {
  return async (c: Context, next: Next) => {
    await next();

    const status = c.res.status;
    if (status < 500) return;

    const env = c.env as Record<string, unknown>;
    const DB = env.DB as D1Database | undefined;
    const webhookUrl = env.DISCORD_WEBHOOK_URL as string | undefined;
    if (!DB || !webhookUrl) return;

    try {
      const now = Math.floor(Date.now() / 1000);
      const windowStart = now - (now % WINDOW_SEC);

      await DB.prepare(`
        INSERT INTO rate_limit_attempts (key, action, window_start, count)
        VALUES ('global', '5xx_spike', ?, 1)
        ON CONFLICT(key, action, window_start)
        DO UPDATE SET count = count + 1
      `).bind(windowStart).run();

      const row = await DB.prepare(`
        SELECT count FROM rate_limit_attempts
        WHERE key='global' AND action='5xx_spike' AND window_start=?
      `).bind(windowStart).first<{ count: number }>();

      const count = row?.count ?? 1;

      // threshold 도달한 '정확한' 순간에만 alert (cooldown 역할)
      if (count === SPIKE_THRESHOLD) {
        const url = c.req.url;
        const path = new URL(url).pathname;
        await sendDiscordAlert(
          webhookUrl,
          `🚨 5xx Error Spike`,
          `최근 1분에 ${count}개 이상의 5xx 에러 발생.\n` +
          `최근 path: ${path}\n` +
          `Status: ${status}\n` +
          `Request ID: ${c.req.header('CF-Ray') || 'n/a'}\n` +
          `대시보드: /api/_internal/health-dashboard`,
          'error'
        );
      }
    } catch {
      // monitoring 실패해도 요청 막지 않음
    }
  };
}
