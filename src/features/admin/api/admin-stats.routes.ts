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
      // 🛡️ 2026-05-07: status 표준 분기 — 'approved' / 'active' 모두 활성 셀러로 카운트
      safe<CountRow>("SELECT COUNT(*) as count FROM sellers WHERE status IN ('approved', 'active')"),
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

  const [sales, orders, live, voucherToday, voucherTodayAmount] = await Promise.all([
    safe<SalesRow>(`SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE DATE(created_at, '+9 hours')=? AND status IN ('DONE','PAID','DELIVERED')`, [today]),
    safe<CountRow>("SELECT COUNT(*) as count FROM orders WHERE DATE(created_at, '+9 hours')=?", [today]),
    safe<CountRow>("SELECT COUNT(*) as count FROM live_streams WHERE status='live'"),
    // 🛡️ 2026-05-24 Q1: 어드민 대시보드에 교환권 거래 분리 표시 (사용자 요청).
    safe<CountRow>(`SELECT COUNT(*) as count FROM vouchers WHERE DATE(created_at, '+9 hours')=?`, [today]),
    safe<SalesRow>(`SELECT COALESCE(SUM(applied_price),0) as total FROM vouchers WHERE DATE(created_at, '+9 hours')=?`, [today]),
  ]);

  return c.json({ success: true, data: {
    todaySales: (sales[0] as SalesRow)?.total || 0,
    todayOrders: (orders[0] as CountRow)?.count || 0,
    currentVisitors: 0,
    liveStreams: (live[0] as CountRow)?.count || 0,
    todayVouchers: (voucherToday[0] as CountRow)?.count || 0,
    todayVouchersAmount: (voucherTodayAmount[0] as SalesRow)?.total || 0,
  }});
});

// 🛡️ 2026-05-24 Q1 (사용자 요청): 교환권 거래 분리 페이지/패널용 endpoint.
//   누가 / 언제 / 어떤 교환권 — 일반 voucher 구매 (KT Alpha 발송 추적과 별개).
//   /admin/voucher-orders 는 KT Alpha 자동발송 status 추적, 본 endpoint 는 voucher 구매 자체.
//
//   params:
//     limit (default 50, max 500)
//     offset (default 0)
//     status (unused/used/expired/refunded, optional)
//     user_id (optional)
//     date_from / date_to (YYYY-MM-DD, optional)
//     category (optional, e.g. 'meal_voucher')
adminStatsRoutes.get('/vouchers/transactions', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const limit = Math.min(500, Math.max(1, Number(c.req.query('limit')) || 50));
    const offset = Math.max(0, Number(c.req.query('offset')) || 0);
    const status = c.req.query('status') || '';
    const userId = c.req.query('user_id') || '';
    const dateFrom = c.req.query('date_from') || '';
    const dateTo = c.req.query('date_to') || '';
    const category = c.req.query('category') || '';

    const where: string[] = ['1=1'];
    const params: unknown[] = [];
    if (status && ['unused','used','expired','refunded'].includes(status)) { where.push('v.status = ?'); params.push(status); }
    if (userId) { where.push('v.user_id = ?'); params.push(String(userId)); }
    if (dateFrom) { where.push(`DATE(v.created_at, '+9 hours') >= ?`); params.push(dateFrom); }
    if (dateTo) { where.push(`DATE(v.created_at, '+9 hours') <= ?`); params.push(dateTo); }
    if (category) { where.push('p.category = ?'); params.push(category); }

    // 🛡️ 2026-05-25 사용자 명령: 표 자체에서 KT Alpha 발송 상태 한눈에 확인.
    //   product.kt_alpha_gift_code 있는 voucher 만 KT 대상. voucher_orders.status 최신 1건.
    //   미발송 (NULL) / processing / sent / failed 분류.
    const rowsQuery = `
      SELECT v.id, v.code, v.status, v.created_at, v.used_at, v.expires_at,
             v.applied_price, v.applied_discount_pct,
             v.user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
             v.order_id, o.order_number, o.total_amount AS order_total, o.payment_method,
             v.product_id, p.name AS product_name, p.image_url AS product_image, p.category,
             p.restaurant_name, p.seller_id, s.name AS seller_name,
             p.kt_alpha_gift_code,
             p.auto_voucher_send,
             (SELECT vo.status FROM voucher_orders vo
              WHERE vo.external_order_id LIKE 'u' || v.order_id || '-%'
                 OR vo.external_order_id LIKE 'ur-cons-' || v.order_id || '-%'
              ORDER BY vo.id DESC LIMIT 1) AS kt_alpha_status,
             (SELECT vo.failure_reason FROM voucher_orders vo
              WHERE vo.external_order_id LIKE 'u' || v.order_id || '-%'
                 OR vo.external_order_id LIKE 'ur-cons-' || v.order_id || '-%'
              ORDER BY vo.id DESC LIMIT 1) AS kt_alpha_failure_reason
      FROM vouchers v
      LEFT JOIN users u ON CAST(v.user_id AS TEXT) = CAST(u.id AS TEXT)
      LEFT JOIN orders o ON v.order_id = o.id
      LEFT JOIN products p ON v.product_id = p.id
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE ${where.join(' AND ')}
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const countQuery = `
      SELECT COUNT(*) as count FROM vouchers v
      LEFT JOIN products p ON v.product_id = p.id
      WHERE ${where.join(' AND ')}
    `;

    const [rows, total] = await Promise.all([
      DB.prepare(rowsQuery).bind(...params, limit, offset).all().catch(() => ({ results: [] })),
      DB.prepare(countQuery).bind(...params).first<{ count: number }>().catch(() => ({ count: 0 })),
    ]);

    return c.json({
      success: true,
      data: {
        rows: rows.results ?? [],
        total: total?.count ?? 0,
        limit, offset,
      },
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] GET /vouchers/transactions error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminStatsRoutes;
