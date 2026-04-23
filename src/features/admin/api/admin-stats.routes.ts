/**
 * Admin Stats Routes — 어드민 통계
 *
 * 🛡️ 2026-04-22 배치 144 (TD-006 부분): admin-management.routes.ts 에서 분리.
 *
 * 엔드포인트:
 * - GET /supply/sales       — 공급 상품 셀러별 판매
 * - GET /stats              — 판매자/라이브 통계
 * - GET /dashboard/stats    — 오늘 매출/주문/라이브
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { executeQuery } from '@/worker/utils/database';

export const adminStatsRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

interface CountRow { count: number }
interface SalesRow { total: number }

adminStatsRoutes.get('/supply/sales', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const supplyProductId = c.req.query('product_id') || '';
    const sellerId = c.req.query('seller_id') || '';

    const hasCol = await DB.prepare(
      "SELECT COUNT(*) as c FROM pragma_table_info('products') WHERE name='supply_source_id'"
    ).first<{ c: number }>().catch(() => null);

    if (!hasCol || hasCol.c === 0) {
      return c.json({ success: true, data: { rows: [], summary: { total_orders: 0, total_qty: 0, total_revenue: 0, total_supply_cost: 0 } } });
    }

    let where = "sp.supply_source_id IS NOT NULL AND o.status IN ('DONE','PAID','DELIVERED')";
    const params: (string | number)[] = [];
    if (supplyProductId) { where += ' AND sp.supply_source_id = ?'; params.push(supplyProductId); }
    if (sellerId) { where += ' AND sp.seller_id = ?'; params.push(sellerId); }

    const rows = await DB.prepare(`
      SELECT
        src.id            AS supply_product_id,
        src.name          AS supply_product_name,
        COALESCE(src.supply_price, 0) AS supply_price,
        sp.id             AS seller_product_id,
        sp.name           AS seller_product_name,
        sp.price          AS seller_price,
        sp.seller_id,
        s.name            AS seller_name,
        COALESCE(s.business_name, s.name) AS business_name,
        COUNT(DISTINCT o.id)      AS order_count,
        COALESCE(SUM(oi.quantity), 0) AS total_qty,
        COALESCE(SUM(oi.quantity * oi.price), 0)               AS total_revenue,
        COALESCE(SUM(oi.quantity * src.supply_price), 0)       AS total_supply_cost,
        COALESCE(SUM(oi.quantity * (oi.price - COALESCE(src.supply_price,0))), 0) AS seller_margin
      FROM products sp
      JOIN products src ON sp.supply_source_id = src.id
      JOIN sellers  s   ON sp.seller_id = s.id
      JOIN order_items oi ON oi.product_id = sp.id
      JOIN orders o      ON oi.order_id = o.id
      WHERE ${where}
      GROUP BY sp.supply_source_id, sp.seller_id
      ORDER BY total_supply_cost DESC
    `).bind(...params).all<{
      supply_product_id: number;
      supply_product_name: string;
      supply_price: number;
      seller_product_id: number;
      seller_product_name: string;
      seller_price: number;
      seller_id: number;
      seller_name: string;
      business_name: string;
      order_count: number;
      total_qty: number;
      total_revenue: number;
      total_supply_cost: number;
      seller_margin: number;
    }>();

    const items = rows.results ?? [];
    const summary = {
      total_orders: items.reduce((s, r) => s + r.order_count, 0),
      total_qty:    items.reduce((s, r) => s + r.total_qty, 0),
      total_revenue: items.reduce((s, r) => s + r.total_revenue, 0),
      total_supply_cost: items.reduce((s, r) => s + r.total_supply_cost, 0),
    };

    return c.json({ success: true, data: { rows: items, summary } });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] GET /supply/sales error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminStatsRoutes.get('/stats', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const safe = async <T>(q: string): Promise<T[]> => {
      try { return await executeQuery<T>(DB, q); } catch { return []; }
    };
    const [ts, as_, tst, ast] = await Promise.all([
      safe<CountRow>('SELECT COUNT(*) as count FROM sellers'),
      safe<CountRow>("SELECT COUNT(*) as count FROM sellers WHERE status = 'approved'"),
      safe<CountRow>('SELECT COUNT(*) as count FROM live_streams'),
      safe<CountRow>("SELECT COUNT(*) as count FROM live_streams WHERE status = 'live'"),
    ]);
    return c.json({ success: true, data: {
      totalSellers: ts[0]?.count || 0,
      activeSellers: as_[0]?.count || 0,
      totalStreams: tst[0]?.count || 0,
      activeStreams: ast[0]?.count || 0,
    }});
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminStatsRoutes.get('/dashboard/stats', cors(), async (c) => {
  const { DB } = c.env;
  const today = new Date().toISOString().split('T')[0];

  const safe = async <T>(q: string, p: unknown[] = []): Promise<T[]> => {
    try { return await executeQuery<T>(DB, q, p); } catch { return []; }
  };

  const [sales, orders, live] = await Promise.all([
    safe<SalesRow>(`SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE DATE(created_at, '+9 hours')=? AND status IN ('DONE','PAID','DELIVERED')`, [today]),
    safe<CountRow>("SELECT COUNT(*) as count FROM orders WHERE DATE(created_at, '+9 hours')=?", [today]),
    safe<CountRow>("SELECT COUNT(*) as count FROM live_streams WHERE status='live'"),
  ]);

  return c.json({ success: true, data: {
    todaySales: (sales[0] as SalesRow)?.total || 0,
    todayOrders: (orders[0] as CountRow)?.count || 0,
    currentVisitors: 0,
    liveStreams: (live[0] as CountRow)?.count || 0,
  }});
});

export default adminStatsRoutes;
