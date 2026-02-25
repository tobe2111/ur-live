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

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log('[Cron] 🕐 Starting cleanup of expired reservations...');

    try {
      // Call the cleanup API endpoint (internal call)
      const apiUrl = 'https://live.ur-team.com/api/cleanup/expired-reservations';
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Cron-Token': 'internal-cron-call' // Add authentication if needed
        }
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[Cron] ✅ Cleanup completed:', result);

    } catch (error) {
      console.error('[Cron] ❌ Cleanup failed:', error);
      // Don't throw - let the cron continue next time
    }
  }
};
