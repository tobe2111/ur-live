/**
 * Seller Stats Routes
 *
 * - GET /stats — 셀러 통계 조회
 */

import { Hono } from 'hono';
import {
  type Bindings,
  getSellerIdFromToken,
} from './seller-management-helpers';
import { logError } from '@/worker/utils/logger';

export const sellerStatsRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/seller/stats
 * 셀러 통계 조회
 */
sellerStatsRoutes.get('/stats', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const db = c.env.DB;

    // 상품 통계
    const productsCount = await db.prepare(`
      SELECT COUNT(*) as total
      FROM products
      WHERE seller_id = ?
    `).bind(sellerId).first();

    // 주문 통계 — production orders.status uses uppercase values
    // orders.product_id doesn't exist; must JOIN through order_items
    const ordersStats = await db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN o.status = 'PAID' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN o.status = 'DONE' THEN 1 ELSE 0 END) as confirmed_orders,
        SUM(CASE WHEN o.status = 'SHIPPING' THEN 1 ELSE 0 END) as shipped_orders,
        SUM(CASE WHEN o.status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN o.status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_orders
      FROM orders o
      WHERE o.seller_id = ?
    `).bind(sellerId).first();

    // 매출 통계
    const revenueStats = await db.prepare(`
      SELECT
        COALESCE(SUM(o.total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN o.total_amount ELSE 0 END), 0) as confirmed_revenue,
        COALESCE(SUM(CASE WHEN DATE(o.created_at) = DATE('now') THEN o.total_amount ELSE 0 END), 0) as today_revenue,
        COALESCE(SUM(CASE WHEN DATE(o.created_at) >= DATE('now', '-30 days') THEN o.total_amount ELSE 0 END), 0) as month_revenue
      FROM orders o
      WHERE o.seller_id = ? AND o.status IN ('PAID','DONE','SHIPPING','DELIVERED')
    `).bind(sellerId).first();

    // 최근 7일 매출 추이
    const recentRevenue = await db.prepare(`
      SELECT
        DATE(o.created_at) as date,
        COUNT(*) as order_count,
        SUM(o.total_amount) as revenue
      FROM orders o
      WHERE o.seller_id = ?
        AND o.status IN ('PAID','DONE','SHIPPING','DELIVERED')
        AND DATE(o.created_at) >= DATE('now', '-7 days')
      GROUP BY DATE(o.created_at)
      ORDER BY date DESC
    `).bind(sellerId).all();

    // 인기 상품 TOP 5 — JOIN via order_items since orders.product_id doesn't exist
    const topProducts = await db.prepare(`
      SELECT
        p.id,
        p.name,
        p.price,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(oi.subtotal), 0) as total_revenue
      FROM products p
      LEFT JOIN order_items oi ON oi.product_id = p.id
      LEFT JOIN orders o ON o.id = oi.order_id
        AND o.status IN ('PAID','DONE','SHIPPING','DELIVERED')
      WHERE p.seller_id = ?
      GROUP BY p.id, p.name, p.price
      ORDER BY order_count DESC
      LIMIT 5
    `).bind(sellerId).all();

    return c.json({
      success: true,
      stats: {
        products: {
          total: productsCount?.total || 0
        },
        orders: {
          total: ordersStats?.total_orders || 0,
          pending: ordersStats?.pending_orders || 0,
          confirmed: ordersStats?.confirmed_orders || 0,
          shipped: ordersStats?.shipped_orders || 0,
          delivered: ordersStats?.delivered_orders || 0,
          cancelled: ordersStats?.cancelled_orders || 0
        },
        revenue: {
          total: revenueStats?.total_revenue || 0,
          confirmed: revenueStats?.confirmed_revenue || 0,
          today: revenueStats?.today_revenue || 0,
          month: revenueStats?.month_revenue || 0
        },
        recent_revenue: recentRevenue.results || [],
        top_products: topProducts.results || []
      }
    });

  } catch (error: unknown) {
    logError('seller.stats.getError', { error: (error as Error)?.message });
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to get seller stats'
    }, 500);
  }
});
