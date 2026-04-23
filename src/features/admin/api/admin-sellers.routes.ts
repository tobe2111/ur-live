/**
 * Admin Sellers Routes — 판매자 관리
 *
 * 🛡️ 2026-04-22 배치 146 (TD-006 부분): admin-management.routes.ts 에서 분리.
 *
 * 엔드포인트:
 * - GET    /sellers                          — 판매자 목록
 * - GET    /sellers/pending                  — 승인 대기 목록
 * - GET    /sellers/:id                      — 판매자 상세
 * - PATCH  /sellers/:id/business-info/approve — 사업자 정보 승인
 * - PATCH  /sellers/:id/business-info/reject  — 사업자 정보 반려
 * - PATCH  /sellers/:id/approve              — 판매자 승인
 * - PATCH  /sellers/:id/reject               — 판매자 거부
 * - DELETE /sellers/:id                      — 판매자 정지 (soft delete)
 * - PATCH  /sellers/:id/commission           — 수수료율 변경
 * - PATCH  /sellers/:id/donation-commission  — 후원 수수료율 변경
 * - PATCH  /sellers/:id/permissions          — 특수 권한 변경
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { executeQuery, executeRun } from '@/worker/utils/database';
import { writeAuditLog } from '@/worker/middleware/admin-security';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';

export const adminSellersRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

interface SellerRow {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  business_name: string | null;
  business_number: string | null;
  status: string;
  created_at: string;
  commission_rate?: number;
  can_manipulate_stats?: number;
  linked_user_id?: number;
  linked_user_name?: string;
}

interface IdRow {
  id: number;
  status?: string;
  commission_rate?: number;
}

adminSellersRoutes.get('/sellers', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const page = Math.max(parseInt(c.req.query('page') || '1'), 1);
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50'), 1), 200);
    const offset = (page - 1) * limit;

    let sellers;
    try {
      sellers = await executeQuery<SellerRow>(DB, `
        SELECT id, email, name, phone, business_name, business_number,
               status, created_at,
               COALESCE(commission_rate, 10) AS commission_rate,
               COALESCE(can_manipulate_stats, 0) AS can_manipulate_stats
        FROM sellers ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
      `, [limit, offset]);
    } catch {
      sellers = await executeQuery<SellerRow>(DB, `
        SELECT id, email, name, phone, business_name, business_number,
               status, created_at
        FROM sellers ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
      `, [limit, offset]);
    }
    const totalRow = await DB.prepare('SELECT COUNT(*) as cnt FROM sellers').first<{ cnt: number }>();
    return c.json({
      success: true,
      data: sellers,
      pagination: {
        page, limit, total: totalRow?.cnt ?? 0,
        totalPages: Math.ceil((totalRow?.cnt ?? 0) / limit),
      },
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] sellers error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.get('/sellers/pending', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellers = await executeQuery<SellerRow>(DB, `
      SELECT s.id, s.email, s.name, s.phone, s.business_name, s.business_number,
             s.status, s.created_at,
             COALESCE(s.commission_rate, 10) AS commission_rate,
             s.linked_user_id, u.name AS linked_user_name
      FROM sellers s LEFT JOIN users u ON s.linked_user_id = u.id
      WHERE s.status = 'pending' ORDER BY s.created_at ASC
    `);
    return c.json({ success: true, data: sellers });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] pending sellers error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.get('/sellers/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');

    const seller = await DB.prepare(`
      SELECT s.id, s.email, s.name, s.phone, s.business_name, s.business_number,
             s.status, s.created_at,
             COALESCE(s.commission_rate, 10) AS commission_rate,
             COALESCE(s.can_manipulate_stats, 0) AS can_manipulate_stats
      FROM sellers s WHERE s.id = ?
    `).bind(sellerId).first().catch(() => null);

    if (!seller) {
      const row2 = await DB.prepare(
        `SELECT id, email, name, phone, business_name, business_number, status, created_at FROM sellers WHERE id = ?`
      ).bind(sellerId).first();
      if (!row2) return c.json({ success: false, error: 'Not found' }, 404);
      return c.json({ success: true, data: { ...row2, commission_rate: 10, can_manipulate_stats: 0 } });
    }

    let biz = null;
    try {
      biz = await DB.prepare(`
        SELECT business_number AS biz_number, business_name AS biz_name, ceo_name,
               business_type, business_category, postal_code,
               address, address_detail, phone AS biz_phone, email AS biz_email,
               is_verified AS biz_is_verified, verified_at AS biz_verified_at
        FROM seller_business_info WHERE seller_id = ?
      `).bind(sellerId).first();
    } catch {
      biz = await DB.prepare(`
        SELECT business_number AS biz_number, business_name AS biz_name, ceo_name,
               business_type, business_category, postal_code,
               address, '' AS address_detail, phone AS biz_phone, email AS biz_email,
               is_verified AS biz_is_verified, verified_at AS biz_verified_at
        FROM seller_business_info WHERE seller_id = ?
      `).bind(sellerId).first().catch(() => null);
    }

    return c.json({ success: true, data: { ...seller, ...(biz || {}) } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.patch('/sellers/:id/business-info/approve', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const existing = await DB.prepare(
      `SELECT id, is_verified FROM seller_business_info WHERE seller_id = ?`
    ).bind(sellerId).first<{ id: number; is_verified: number }>();
    if (!existing) return c.json({ success: false, error: '사업자 정보가 없습니다' }, 404);
    if (existing.is_verified) return c.json({ success: false, error: '이미 승인된 사업자 정보입니다' }, 400);
    await DB.prepare(`
      UPDATE seller_business_info
      SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
      WHERE seller_id = ?
    `).bind(sellerId).run();
    await writeAuditLog(c, { action: 'approve_business_info', targetType: 'seller', targetId: sellerId, after: { is_verified: true } });
    return c.json({ success: true, message: '사업자 정보를 승인했습니다' });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.patch('/sellers/:id/business-info/reject', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const { reason } = await c.req.json<{ reason?: string }>();
    const existing = await DB.prepare(
      `SELECT id FROM seller_business_info WHERE seller_id = ?`
    ).bind(sellerId).first();
    if (!existing) return c.json({ success: false, error: '사업자 정보가 없습니다' }, 404);
    await DB.prepare(`
      UPDATE seller_business_info
      SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
      WHERE seller_id = ?
    `).bind(sellerId).run();
    await writeAuditLog(c, { action: 'reject_business_info', targetType: 'seller', targetId: sellerId, after: { is_verified: false, reason } });
    return c.json({ success: true, message: '사업자 정보를 반려했습니다' });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.patch('/sellers/:id/approve', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const rows = await executeQuery<IdRow>(DB, 'SELECT id, status FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    if (rows[0].status === 'approved') return c.json({ success: false, error: '이미 승인된 판매자입니다' }, 400);
    await executeQuery(DB, `UPDATE sellers SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sellerId]);
    await writeAuditLog(c, { action: 'approve_seller', targetType: 'seller', targetId: sellerId, before: { status: rows[0].status }, after: { status: 'approved' } });
    createDashboardNotification(DB, 'seller', String(sellerId), 'seller_approved', '셀러 승인 완료', '판매를 시작할 수 있습니다', '/seller').catch((_e) => { if (import.meta.env.DEV) console.warn(_e) });
    return c.json({ success: true, data: { id: sellerId, status: 'approved' } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.patch('/sellers/:id/reject', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const { reason: rawReason } = await c.req.json<{ reason?: string }>();
    const reason = typeof rawReason === 'string' ? rawReason.slice(0, 500) : null;
    const rows = await executeQuery<IdRow>(DB, 'SELECT id FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    await executeQuery(DB, `UPDATE sellers SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sellerId]);
    await writeAuditLog(c, { action: 'reject_seller', targetType: 'seller', targetId: sellerId, after: { status: 'rejected', reason } });
    return c.json({ success: true, data: { id: sellerId, status: 'rejected', reason } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.delete('/sellers/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const rows = await executeQuery<IdRow>(DB, 'SELECT id, status FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    if (rows[0].status === 'suspended') return c.json({ success: false, error: '이미 정지된 판매자입니다' }, 400);
    try {
      await executeRun(DB, `UPDATE sellers SET is_active = 0, status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sellerId]);
    } catch {
      await executeRun(DB, `UPDATE sellers SET status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sellerId]);
    }

    try {
      await executeRun(DB, `UPDATE products SET is_active = 0 WHERE seller_id = ?`, [sellerId]);
    } catch { /* defensive — schema may vary */ }
    try {
      await executeRun(DB, `UPDATE live_streams SET status = 'ended' WHERE seller_id = ? AND status = 'live'`, [sellerId]);
    } catch { /* defensive */ }

    await writeAuditLog(c, { action: 'suspend_seller', targetType: 'seller', targetId: sellerId, before: { status: rows[0].status }, after: { status: 'suspended', is_active: 0 } });
    return c.json({ success: true, message: '판매자가 정지되었습니다', data: { id: sellerId, status: 'suspended' } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.patch('/sellers/:id/commission', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const { commission_rate } = await c.req.json();
    if (commission_rate === undefined || commission_rate < 0 || commission_rate > 100)
      return c.json({ success: false, error: '수수료율은 0~100 사이여야 합니다' }, 400);
    const rows = await executeQuery<IdRow>(DB, 'SELECT id, commission_rate FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    await executeQuery(DB, `UPDATE sellers SET commission_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [commission_rate, sellerId]);
    await writeAuditLog(c, { action: 'change_commission', targetType: 'seller', targetId: sellerId, before: { commission_rate: rows[0].commission_rate }, after: { commission_rate } });
    return c.json({ success: true, data: { id: sellerId, commission_rate } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.patch('/sellers/:id/donation-commission', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const { donation_commission_rate } = await c.req.json();
    if (donation_commission_rate === undefined || donation_commission_rate < 0 || donation_commission_rate > 100) {
      return c.json({ success: false, error: '수수료율은 0~100 사이여야 합니다' }, 400);
    }
    const rows = await executeQuery<IdRow>(DB, 'SELECT id FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    await executeQuery(DB,
      `UPDATE sellers SET donation_commission_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [donation_commission_rate, sellerId]
    );
    return c.json({ success: true, data: { id: sellerId, donation_commission_rate } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.patch('/sellers/:id/permissions', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const { can_manipulate_stats } = await c.req.json();
    if (![0, 1, true, false].includes(can_manipulate_stats))
      return c.json({ success: false, error: 'can_manipulate_stats는 0 또는 1이어야 합니다' }, 400);
    const rows = await executeQuery<IdRow>(DB, 'SELECT id FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    const val = can_manipulate_stats ? 1 : 0;
    await executeQuery(DB, `UPDATE sellers SET can_manipulate_stats = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [val, sellerId]);
    return c.json({ success: true, data: { id: sellerId, can_manipulate_stats: val } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminSellersRoutes;
