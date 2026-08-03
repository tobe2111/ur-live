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

    /**
     * 🩺 **의도된 상태 신호는 서버 에러가 아니다** (2026-08-03, 경로 계측 1시간 만에 판명).
     *
     * `/api/_healthcheck/cron` 은 cron 침묵을 알리는 **dead-man's switch** 라, 침묵이 있으면
     * **설계대로 503** 을 낸다(`healthcheck.routes.ts` — `health.ok ? 200 : 503`).
     * 그걸 5xx 로 세면 외부 프로브(`uptime.yml`, 10분)가 두드릴 때마다 카운터가 올라가
     * **5xx 채널이 영구히 점유**된다 — 그러면 진짜 5xx 가 왔을 때 구분이 안 된다.
     * 다이제스트의 "spike 2건"이 정확히 이것이었고, 침묵 자체는 uptime.yml + 자가진단의
     * cron 침묵 항목이 이미 **각자 채널로** 보고한다. 즉 여기서 빼도 잃는 정보가 없다.
     *
     * ⚠️ **경로 전체를 면제하지 않는다** — `/api/_healthcheck/*` 의 503 중 이 dead-man's switch 만
     *   의도된 것이고, 다른 헬스체크가 5xx 를 내면 그건 진짜 고장이다.
     */
    if (status === 503 && new URL(c.req.url).pathname === '/api/_healthcheck/cron') return;

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

      /**
       * 📟 **경로별 계수 — 알림을 받고 나서 무엇을 볼지** (2026-08-03)
       *
       * 이 표에는 지금까지 **숫자만** 있었다(`key='global'`). 그래서 "5xx 가 있었다"는 알 수 있어도
       * **무엇이 실패했는지는 알 수 없었다** — 경보를 받아도 손에 쥔 것이 없다.
       * 실측(08-03): 시간당 1건씩 규칙적으로 5xx 가 나는데, 어디서 나는지 판정할 방법이 없었다.
       *
       * `key` 컬럼에 경로를 넣어 **같은 표·같은 인덱스**로 경로별 24시간 분포를 얻는다.
       * 스파이크 판정은 기존 `global` 행 그대로다 — 경로가 갈려도 합계가 임계를 넘으면 잡힌다.
       * ⚠️ 5xx 당 쓰기가 1→2 로 는다. 5xx 는 드물고(실측 시간당 1건) D1 쓰기라 KV 한도와 무관하다.
       */
      let path = 'unknown'
      try { path = new URL(c.req.url).pathname.slice(0, 80) } catch { /* URL 파싱 실패는 무시 */ }
      await DB.prepare(`
        INSERT INTO rate_limit_attempts (key, action, window_start, count)
        VALUES (?, '5xx_path', ?, 1)
        ON CONFLICT(key, action, window_start)
        DO UPDATE SET count = count + 1
      `).bind(path, windowStart).run().catch(() => null);

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
