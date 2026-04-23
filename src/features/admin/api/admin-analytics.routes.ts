/**
 * Admin Analytics Routes
 *
 * 🛡️ 2026-04-22 배치 152 (TD-006 부분): admin-management.routes.ts 에서 분리.
 *
 * 엔드포인트:
 * - GET /analytics/revenue       — 일별 매출 (7d/30d/90d/1y)
 * - GET /analytics/category      — 카테고리별 매출
 * - GET /analytics/top-sellers   — 판매자 순위
 * - GET /analytics/top-products  — 상품 순위
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { executeQuery } from '@/worker/utils/database';

export const adminAnalyticsRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

interface RevenueRow { date: string; revenue: number; order_count: number }
interface CategoryRevenueRow { category: string; revenue: number; order_count: number }
interface TopSellerRow { seller_id: number; seller_name: string | null; business_name: string | null; revenue: number; order_count: number }
interface TopProductRow { product_id: number; product_name: string; sales_count: number; revenue: number; image_url: string | null }

adminAnalyticsRoutes.get('/analytics/revenue', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const period = c.req.query('period') || '30d';

    let days: number;
    switch (period) {
      case '7d': days = 7; break;
      case '90d': days = 90; break;
      case '1y': days = 365; break;
      default: days = 30;
    }

    const dailyRevenue = await executeQuery<RevenueRow>(DB,
      `SELECT DATE(created_at, '+9 hours') as date,
              SUM(total_amount) as revenue,
              COUNT(*) as order_count
       FROM orders
       WHERE status IN ('PAID','DONE','SHIPPING','DELIVERED')
         AND created_at >= datetime('now', '-' || ? || ' days')
       GROUP BY DATE(created_at, '+9 hours')
       ORDER BY date ASC`,
      [days]
    );

    const totalRows = await executeQuery<{ total_revenue: number; total_orders: number }>(DB,
      `SELECT COALESCE(SUM(total_amount), 0) as total_revenue,
              COUNT(*) as total_orders
       FROM orders
       WHERE status IN ('PAID','DONE','SHIPPING','DELIVERED')
         AND created_at >= datetime('now', '-' || ? || ' days')`,
      [days]
    );

    return c.json({
      success: true,
      data: {
        daily: dailyRevenue,
        totals: totalRows[0] || { total_revenue: 0, total_orders: 0 },
        period
      }
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] analytics/revenue error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminAnalyticsRoutes.get('/analytics/category', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const categories = await executeQuery<CategoryRevenueRow>(DB,
      `SELECT COALESCE(p.category, 'uncategorized') as category,
              SUM(oi.price * oi.quantity) as revenue,
              COUNT(DISTINCT o.id) as order_count
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE o.status IN ('PAID','DONE','SHIPPING','DELIVERED')
       GROUP BY p.category
       ORDER BY revenue DESC`
    );

    return c.json({ success: true, data: categories });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] analytics/category error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminAnalyticsRoutes.get('/analytics/top-sellers', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '10')));

    const topSellers = await executeQuery<TopSellerRow>(DB,
      `SELECT o.seller_id,
              s.name as seller_name,
              s.business_name,
              SUM(o.total_amount) as revenue,
              COUNT(*) as order_count
       FROM orders o
       LEFT JOIN sellers s ON s.id = o.seller_id
       WHERE o.status IN ('PAID','DONE','SHIPPING','DELIVERED')
         AND o.seller_id IS NOT NULL
       GROUP BY o.seller_id
       ORDER BY revenue DESC
       LIMIT ?`,
      [limit]
    );

    return c.json({ success: true, data: topSellers });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] analytics/top-sellers error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminAnalyticsRoutes.get('/analytics/top-products', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '10')));

    const topProducts = await executeQuery<TopProductRow>(DB,
      `SELECT oi.product_id,
              COALESCE(p.name, oi.product_name) as product_name,
              SUM(oi.quantity) as sales_count,
              SUM(oi.price * oi.quantity) as revenue,
              p.image_url
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.status IN ('PAID','DONE','SHIPPING','DELIVERED')
       GROUP BY oi.product_id
       ORDER BY sales_count DESC
       LIMIT ?`,
      [limit]
    );

    return c.json({ success: true, data: topProducts });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] analytics/top-products error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminAnalyticsRoutes;
