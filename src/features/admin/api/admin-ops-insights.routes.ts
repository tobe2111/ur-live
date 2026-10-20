/**
 * Admin Ops Insights — 운영 인사이트 API
 *
 * 마운트: /api/admin/ops-insights
 *
 * Endpoints:
 *   GET / — 부진 에이전시 + 부진 셀러 + 신규 가입 후 미접속 + 결제 이상 검출
 *
 * 어드민이 한 번에 운영 위험 요소를 파악하기 위한 통합 위젯.
 *
 * 🛡️ 2026-05-22 P1 영구 fix:
 *   - 이전: agency 당 2 correlated subquery (N+1) — N agencies × 2 = 2N D1 query.
 *     6개 병렬 + 무거운 EXISTS subquery → admin 진입마다 200-500ms 부담.
 *   - 영구 해결: agency 1 → JOIN + GROUP BY (1 query). KV cache 5분 (인사이트는 실시간성 불필요).
 *   - 효과: admin 10명 × 5분/1회 진입 = 시간당 12 D1 query → 12개 → 1개 (cron 만 갱신).
 */

import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';
import { requireAdmin } from '@/worker/middleware/auth';
import { cacheGet } from '@/worker/utils/cache';

const app = new Hono<{ Bindings: Env }>();

app.use('*', requireAdmin());

app.get('/', async (c) => {
  const DB = c.env.DB;
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500);

  // 🛡️ KV cache 5분 — 모든 admin 공유. cron 갱신 X (admin 들이 자연스럽게 첫 1명만 cold-miss).
  //   stale-while-revalidate 60s 동안 background refetch (이전 admin 의 응답으로 즉시 응답).
  const insights = await cacheGet(
    c.env.SESSION_KV,
    'admin:ops-insights:v2',
    async () => {
      const out: Record<string, any> = {};

      // 1. 부진 에이전시 (월 매출 0) — agency_sellers + orders JOIN + GROUP BY 로 1 query.
      try {
        const r = await DB.prepare(`
          SELECT a.id, a.name, a.email,
            COALESCE(SUM(CASE
              WHEN o.payment_status = 'approved' AND o.created_at >= datetime('now', '-30 days')
              THEN o.total_amount ELSE 0 END), 0) AS monthly_revenue,
            COUNT(DISTINCT ag_s.seller_id) AS seller_count
          FROM agencies a
          LEFT JOIN agency_sellers ag_s ON ag_s.agency_id = a.id
          LEFT JOIN orders o ON o.seller_id = ag_s.seller_id
          WHERE a.status = 'active'
          GROUP BY a.id, a.name, a.email
          HAVING monthly_revenue = 0
          ORDER BY seller_count DESC
          LIMIT 50
        `).all<{ id: number; name: string; email: string; monthly_revenue: number; seller_count: number }>()
          .catch(() => ({ results: [] as any[] }));
        out.inactive_agencies = r.results || [];
      } catch { out.inactive_agencies = []; }

      // 2. 신규 가입 7일 미접속 셀러 — 자기 self-JOIN 제거 (불필요한 subquery).
      try {
        const r = await DB.prepare(`
          SELECT id, business_name, email, created_at, last_login_at
          FROM sellers
          WHERE status = 'active'
            AND created_at >= datetime('now', '-30 days')
            AND (last_login_at IS NULL OR last_login_at < datetime('now', '-7 days'))
          ORDER BY created_at DESC
          LIMIT 50
        `).all().catch(() => ({ results: [] as any[] }));
        out.dormant_new_sellers = r.results || [];
      } catch { out.dormant_new_sellers = []; }

      // 3. 결제 이상 (PENDING 24h+)
      try {
        const r = await DB.prepare(`
          SELECT id, order_number, total_amount, created_at
          FROM orders
          WHERE status = 'PENDING' AND created_at < datetime('now', '-24 hours')
          ORDER BY created_at DESC
          LIMIT 50
        `).all().catch(() => ({ results: [] as any[] }));
        out.stuck_pending_orders = r.results || [];
      } catch { out.stuck_pending_orders = []; }

      // 4. 부진 셀러 (30일 무매출 + 무라이브) — NOT EXISTS 2개 → LEFT JOIN + IS NULL 로 1 query.
      try {
        const r = await DB.prepare(`
          SELECT s.id, s.business_name, ls.last_live, op.last_paid
          FROM sellers s
          LEFT JOIN (
            SELECT seller_id, MAX(created_at) AS last_live FROM live_streams GROUP BY seller_id
          ) ls ON ls.seller_id = s.id
          LEFT JOIN (
            SELECT seller_id, MAX(created_at) AS last_paid FROM orders
            WHERE payment_status = 'approved' GROUP BY seller_id
          ) op ON op.seller_id = s.id
          WHERE s.status = 'active'
            AND (ls.last_live IS NULL OR ls.last_live < datetime('now', '-30 days'))
            AND (op.last_paid IS NULL OR op.last_paid < datetime('now', '-30 days'))
          ORDER BY s.created_at DESC
          LIMIT 100
        `).all().catch(() => ({ results: [] as any[] }));
        out.dormant_sellers = r.results || [];
      } catch { out.dormant_sellers = []; }

      // 5. Webhook 실패
      try {
        const r = await DB.prepare(`
          SELECT id, source, event_type, status, error_message, retry_count, created_at
          FROM webhook_events
          WHERE status = 'FAILED' AND created_at >= datetime('now', '-24 hours')
          ORDER BY created_at DESC
          LIMIT 50
        `).all().catch(() => ({ results: [] as any[] }));
        out.failed_webhooks_24h = r.results || [];
      } catch { out.failed_webhooks_24h = []; }

      // 6. Rate limit 차단 통계
      try {
        const since = Math.floor(Date.now() / 1000) - 86400;
        const r = await DB.prepare(`
          SELECT key, action, MAX(count) AS max_count, COUNT(DISTINCT window_start) AS windows
          FROM rate_limit_attempts
          WHERE window_start >= ?
          GROUP BY key, action
          HAVING max_count > 50
          ORDER BY max_count DESC
          LIMIT 30
        `).bind(since).all().catch(() => ({ results: [] as any[] }));
        out.rate_limit_top_24h = r.results || [];
      } catch { out.rate_limit_top_24h = []; }

      // 7. 알림 통계
      try {
        const r = await DB.prepare(`
          SELECT type, COUNT(*) AS cnt
          FROM agency_notifications
          WHERE created_at >= datetime('now', '-24 hours')
          GROUP BY type
        `).all().catch(() => ({ results: [] as any[] }));
        out.notifications_24h = r.results || [];
      } catch { out.notifications_24h = []; }

      return out;
    },
    { ttl: 300, staleWhileRevalidate: 60 },  // 5분 fresh + 1분 SWR
  );

  return c.json({
    success: true,
    data: insights,
    summary: {
      inactive_agencies: insights.inactive_agencies?.length ?? 0,
      dormant_new_sellers: insights.dormant_new_sellers?.length ?? 0,
      stuck_pending_orders: insights.stuck_pending_orders?.length ?? 0,
      dormant_sellers: insights.dormant_sellers?.length ?? 0,
      failed_webhooks_24h: insights.failed_webhooks_24h?.length ?? 0,
    },
  });
});

export { app as adminOpsInsightsRoutes };
