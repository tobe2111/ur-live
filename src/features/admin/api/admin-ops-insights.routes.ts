/**
 * Admin Ops Insights — 운영 인사이트 API
 *
 * 마운트: /api/admin/ops-insights
 *
 * Endpoints:
 *   GET / — 부진 에이전시 + 부진 셀러 + 신규 가입 후 미접속 + 결제 이상 검출
 *
 * 어드민이 한 번에 운영 위험 요소를 파악하기 위한 통합 위젯.
 */

import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';
import { requireAdmin } from '@/worker/middleware/auth';

const app = new Hono<{ Bindings: Env }>();

app.use('*', requireAdmin());

app.get('/', async (c) => {
  const DB = c.env.DB;
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500);

  const insights: Record<string, any> = {};

  // 1. 부진 에이전시 (월 매출 0)
  try {
    const r = await DB.prepare(`
      SELECT a.id, a.name, a.email,
        (SELECT COALESCE(SUM(o.total_amount), 0)
         FROM agency_sellers ag_s
         JOIN orders o ON o.seller_id = ag_s.seller_id
         WHERE ag_s.agency_id = a.id
           AND o.payment_status = 'approved'
           AND o.created_at >= datetime('now', '-30 days')
        ) AS monthly_revenue,
        (SELECT COUNT(*) FROM agency_sellers WHERE agency_id = a.id) AS seller_count
      FROM agencies a
      WHERE a.status = 'active'
      ORDER BY monthly_revenue ASC
      LIMIT 50
    `).all<{ id: number; name: string; email: string; monthly_revenue: number; seller_count: number }>()
      .catch(() => ({ results: [] as any[] }));
    insights.inactive_agencies = (r.results || []).filter(a => a.monthly_revenue === 0);
  } catch { insights.inactive_agencies = []; }

  // 2. 신규 가입 후 7일 미접속 셀러
  try {
    const r = await DB.prepare(`
      SELECT s.id, s.business_name, s.email, s.created_at,
        (SELECT MAX(last_login_at) FROM sellers WHERE id = s.id) AS last_login_at
      FROM sellers s
      WHERE s.status = 'active'
        AND s.created_at >= datetime('now', '-30 days')
        AND (s.last_login_at IS NULL OR s.last_login_at < datetime('now', '-7 days'))
      ORDER BY s.created_at DESC
      LIMIT 50
    `).all().catch(() => ({ results: [] as any[] }));
    insights.dormant_new_sellers = r.results || [];
  } catch { insights.dormant_new_sellers = []; }

  // 3. 결제 이상 (PENDING 24h+)
  try {
    const r = await DB.prepare(`
      SELECT id, order_number, total_amount, created_at
      FROM orders
      WHERE status = 'PENDING'
        AND created_at < datetime('now', '-24 hours')
      ORDER BY created_at DESC
      LIMIT 50
    `).all().catch(() => ({ results: [] as any[] }));
    insights.stuck_pending_orders = r.results || [];
  } catch { insights.stuck_pending_orders = []; }

  // 4. 부진 셀러 (소속 셀러 중 30일 무매출 + 무라이브)
  try {
    const r = await DB.prepare(`
      SELECT s.id, s.business_name,
        (SELECT MAX(created_at) FROM live_streams WHERE seller_id = s.id) AS last_live,
        (SELECT MAX(created_at) FROM orders WHERE seller_id = s.id AND payment_status = 'approved') AS last_paid
      FROM sellers s
      WHERE s.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM live_streams WHERE seller_id = s.id AND created_at >= datetime('now', '-30 days')
        )
        AND NOT EXISTS (
          SELECT 1 FROM orders WHERE seller_id = s.id AND payment_status = 'approved' AND created_at >= datetime('now', '-30 days')
        )
      ORDER BY s.created_at DESC
      LIMIT 100
    `).all().catch(() => ({ results: [] as any[] }));
    insights.dormant_sellers = r.results || [];
  } catch { insights.dormant_sellers = []; }

  // 6. Webhook 실패 (TD-009) — 24h 동안 FAILED 이벤트
  try {
    const r = await DB.prepare(`
      SELECT id, source, event_type, status, error_message, retry_count, created_at
      FROM webhook_events
      WHERE status = 'FAILED'
        AND created_at >= datetime('now', '-24 hours')
      ORDER BY created_at DESC
      LIMIT 50
    `).all().catch(() => ({ results: [] as any[] }));
    insights.failed_webhooks_24h = r.results || [];
  } catch { insights.failed_webhooks_24h = []; }

  // 7. Rate limit 차단 통계 (24h) — 의심 IP / 봇 탐지
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
    insights.rate_limit_top_24h = r.results || [];
  } catch { insights.rate_limit_top_24h = []; }

  // 5. 부진 셀러 알림 발송 통계 (24h)
  try {
    const r = await DB.prepare(`
      SELECT type, COUNT(*) AS cnt
      FROM agency_notifications
      WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY type
    `).all().catch(() => ({ results: [] as any[] }));
    insights.notifications_24h = r.results || [];
  } catch { insights.notifications_24h = []; }

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
