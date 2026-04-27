/**
 * Cloudflare Workers Cron Job: Cleanup Expired Reservations
 * 
 * This worker runs every 5 minutes to automatically release expired stock reservations.
 * 
 * Setup:
 * 1. Deploy this worker: npx wrangler deploy workers/cleanup-cron.ts
 * 2. Set up cron trigger in Cloudflare Dashboard
 * 3. Schedule: every 5 minutes
 * 
 * Or configure via wrangler.toml with crons triggers
 */

interface Env {
  DB: D1Database;
}

const BASE_URL = 'https://live.ur-team.com';

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log('[Cron] 🕐 Starting scheduled tasks...');

    // ── 1. 만료된 예약 정리 (매 실행) ─────────────────────────────────────────
    try {
      const response = await fetch(`${BASE_URL}/api/cleanup/expired-reservations`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'X-Cron-Token': 'internal-cron-call' },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const result = await response.json();
      console.log('[Cron] ✅ Reservation cleanup completed:', result);
    } catch (error) {
      console.error('[Cron] ❌ Reservation cleanup failed:', error);
    }

    // ── 2. 배송 자동 완료 처리 (6시간마다: 0, 6, 12, 18 UTC) ─────────────────
    const now = new Date(event.scheduledTime);
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();

    if (hour % 6 === 0 && minute < 5) {
      console.log('[Cron] 🚚 Running delivery sync...');
      try {
        const response = await fetch(`${BASE_URL}/api/orders/internal/sync-deliveries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': 'cron-sync-deliveries',
          },
        });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const result = await response.json() as any;
        console.log(`[Cron] ✅ Delivery sync: ${result?.data?.delivered ?? 0} orders marked delivered`);
      } catch (error) {
        console.error('[Cron] ❌ Delivery sync failed:', error);
      }

      // ── 3. 14일 경과 배송중 주문 자동 구매확정 ──────────────────────────────
      console.log('[Cron] 🛒 Running 14-day auto-confirm...');
      try {
        const confirmResponse = await fetch(`${BASE_URL}/api/orders/internal/auto-confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': 'cron-sync-deliveries',
          },
        });
        if (!confirmResponse.ok) throw new Error(`${confirmResponse.status} ${confirmResponse.statusText}`);
        const confirmResult = await confirmResponse.json() as any;
        console.log(`[Cron] ✅ Auto-confirm: ${confirmResult?.data?.confirmed ?? 0} orders auto-confirmed`);
      } catch (error) {
        console.error('[Cron] ❌ Auto-confirm failed:', error);
      }
    }
  },
};
