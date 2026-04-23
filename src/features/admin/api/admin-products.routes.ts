/**
 * Admin Products Routes — 상품 + 샘플 신청 관리
 *
 * 🛡️ 2026-04-22 배치 148 (TD-006 부분): admin-management.routes.ts 에서 분리.
 *
 * 엔드포인트:
 * - GET    /products                   — 전체 상품 목록
 * - POST   /products                   — 상품 생성
 * - PUT    /products/:id               — 상품 전체 수정
 * - PATCH  /products/:id               — 상품 부분 수정 (is_active, sold_count)
 * - DELETE /products/:id               — 상품 삭제 (soft/hard)
 * - GET    /sample-requests            — 샘플 신청 목록
 * - PATCH  /sample-requests/:id        — 샘플 신청 승인/거부 + 알림톡
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { executeQuery, executeRun } from '@/worker/utils/database';
import { writeAuditLog } from '@/worker/middleware/admin-security';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';
import { sendAlimtalk, buildSampleApprovalMessage } from '../../alimtalk/aligo';

export const adminProductsRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

interface ProductRow {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
  image_url: string | null;
  is_active: number;
  product_type: string | null;
  category: string | null;
  seller_id: number | null;
  created_at: string;
  seller_name: string | null;
}
interface IdRow { id: number; status?: string }

adminProductsRoutes.get('/products', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const products = await executeQuery<ProductRow>(DB, `
      SELECT p.id, p.name, p.description, p.price, p.stock,
             p.image_url, p.is_active, p.product_type, p.category,
             COALESCE(p.supply_price, 0) AS supply_price,
             COALESCE(p.is_supply_product, 0) AS is_supply_product,
             p.seller_id, p.created_at, s.business_name as seller_name
      FROM products p LEFT JOIN sellers s ON p.seller_id = s.id
      ORDER BY p.created_at DESC LIMIT 1000
    `);
    return c.json({ success: true, data: products });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminProductsRoutes.delete('/products/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const productId = c.req.param('id');

    const product = await executeQuery<IdRow>(DB, 'SELECT id FROM products WHERE id = ?', [productId]);
    if (product.length === 0) {
      return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    }

    const hasOrders = await executeQuery<IdRow>(DB, 'SELECT id FROM order_items WHERE product_id = ? LIMIT 1', [productId]);
    if (hasOrders.length > 0) {
      await executeRun(DB, "UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?", [productId]);
      await writeAuditLog(c, { action: 'soft_delete_product', targetType: 'product', targetId: productId, after: { is_active: 0 } });
      return c.json({ success: true, data: { id: productId, soft_deleted: true } });
    }

    await executeRun(DB, 'DELETE FROM products WHERE id = ?', [productId]);
    await writeAuditLog(c, { action: 'hard_delete_product', targetType: 'product', targetId: productId });

    return c.json({ success: true, data: { id: productId } });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] delete product error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminProductsRoutes.post('/products', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const body = await c.req.json();
    const { name, description, long_description, price, compare_at_price, supply_price, stock, image_url, detail_images, category, product_type, is_supply_product } = body;

    if (!name || !price) {
      return c.json({ success: false, error: '상품명과 가격은 필수입니다' }, 400);
    }

    let result: any;
    try {
      result = await executeRun(DB, `
        INSERT INTO products (
          name, description, long_description, price, compare_at_price, supply_price,
          stock, image_url, detail_images, category, product_type,
          is_supply_product, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      `, [
        name, description || '', long_description || null, price,
        compare_at_price || null, supply_price || 0,
        stock || 0, image_url || '',
        detail_images || null,
        category || 'lifestyle', product_type || 'featured',
        is_supply_product ? 1 : 0,
      ]);
    } catch {
      result = await executeRun(DB, `
        INSERT INTO products (
          name, description, price, stock, image_url,
          category, product_type, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      `, [
        name, description || '', price,
        stock || 0, image_url || '',
        category || 'lifestyle', product_type || 'featured',
      ]);
    }

    return c.json({ success: true, data: { id: result.meta.last_row_id, name, price } });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] create product error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminProductsRoutes.put('/products/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const productId = c.req.param('id');
    const body = await c.req.json();
    const { name, description, long_description, price, compare_at_price, supply_price, stock, image_url, detail_images, category, product_type, is_supply_product } = body;

    const product = await executeQuery<IdRow>(DB, 'SELECT id FROM products WHERE id = ?', [productId]);
    if (product.length === 0) {
      return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    }

    try {
      await executeRun(DB, `
        UPDATE products
        SET name = ?, description = ?, long_description = ?, price = ?,
            compare_at_price = ?, supply_price = ?,
            stock = ?, image_url = ?, detail_images = ?,
            category = ?, product_type = ?,
            is_supply_product = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, [
        name, description || '', long_description || null, price,
        compare_at_price || null, supply_price || 0,
        stock || 0, image_url || '',
        detail_images || null,
        category || 'lifestyle', product_type || 'featured',
        is_supply_product ? 1 : 0,
        productId,
      ]);
    } catch {
      await executeRun(DB, `
        UPDATE products
        SET name = ?, description = ?, price = ?,
            stock = ?, image_url = ?,
            category = ?, product_type = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, [
        name, description || '', price,
        stock || 0, image_url || '',
        category || 'lifestyle', product_type || 'featured',
        productId,
      ]);
    }

    return c.json({ success: true, data: { id: productId, name } });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] update product error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminProductsRoutes.patch('/products/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const productId = c.req.param('id');
    const body = await c.req.json();
    const { is_active, sold_count } = body;

    const product = await executeQuery<IdRow>(DB, 'SELECT id FROM products WHERE id = ?', [productId]);
    if (product.length === 0) {
      return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    }

    const updates: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];

    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sold_count !== undefined) { updates.push('sold_count = ?'); params.push(Number(sold_count)); }

    params.push(productId);
    await executeRun(DB, `UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);

    return c.json({ success: true, data: { id: productId, ...(is_active !== undefined ? { is_active: is_active ? 1 : 0 } : {}), ...(sold_count !== undefined ? { sold_count: Number(sold_count) } : {}) } });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] patch product error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ─── 샘플 신청 관리 (Sample Requests) ────────────────────────────────────────

adminProductsRoutes.get('/sample-requests', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const status = c.req.query('status') || '';
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    let where = '1=1';
    const params: (string | number)[] = [];
    if (status) { where += ' AND sr.status = ?'; params.push(status); }

    let rows: { results: any[] } = { results: [] };
    let total: { count: number } | null = { count: 0 };
    try {
      rows = await DB.prepare(`
        SELECT
          sr.id, sr.seller_id, sr.product_id, sr.status,
          sr.seller_memo, sr.admin_memo, sr.created_at, sr.approved_at,
          s.name AS seller_name,
          COALESCE(s.business_name, s.name) AS business_name,
          COALESCE(s.email, '') AS seller_email,
          p.name AS product_name,
          p.price AS retail_price,
          COALESCE(p.supply_price, 0) AS supply_price,
          p.image_url AS product_image
        FROM sample_requests sr
        JOIN sellers  s ON sr.seller_id  = s.id
        JOIN products p ON sr.product_id = p.id
        WHERE ${where}
        ORDER BY sr.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all();

      total = await DB.prepare(
        `SELECT COUNT(*) as count FROM sample_requests sr WHERE ${where}`
      ).bind(...params).first<{ count: number }>();
    } catch (tableErr) {
      if (import.meta.env.DEV) console.warn('[Admin] sample_requests table not ready:', (tableErr as Error).message);
    }

    return c.json({
      success: true,
      data: { items: rows.results ?? [], total: total?.count ?? 0, page, limit },
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] GET /sample-requests error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminProductsRoutes.patch('/sample-requests/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const reqId = c.req.param('id');
    const body = await c.req.json<{ action: 'approve' | 'reject'; admin_memo?: string }>();

    if (!body.action || !['approve', 'reject'].includes(body.action)) {
      return c.json({ success: false, error: 'action은 approve 또는 reject이어야 합니다' }, 400);
    }

    const existing = await DB.prepare(
      'SELECT id, status FROM sample_requests WHERE id = ?'
    ).bind(reqId).first<{ id: number; status: string }>();

    if (!existing) return c.json({ success: false, error: '신청을 찾을 수 없습니다' }, 404);
    if (existing.status !== 'PENDING') {
      return c.json({ success: false, error: `이미 처리된 신청입니다 (${existing.status})` }, 409);
    }

    const newStatus = body.action === 'approve' ? 'APPROVED' : 'REJECTED';
    const approvedAt = body.action === 'approve' ? `datetime('now')` : 'NULL';

    const reqInfo = await DB.prepare(`
      SELECT sr.seller_id, s.phone AS seller_phone, s.name AS seller_name, p.name AS product_name
      FROM sample_requests sr
      JOIN sellers s ON sr.seller_id = s.id
      JOIN products p ON sr.product_id = p.id
      WHERE sr.id = ?
    `).bind(reqId).first<{ seller_id: number; seller_phone: string | null; seller_name: string; product_name: string }>()
      .catch(() => null);

    await DB.prepare(`
      UPDATE sample_requests
      SET status = ?, admin_memo = ?, updated_at = datetime('now'),
          approved_at = ${approvedAt}
      WHERE id = ?
    `).bind(newStatus, body.admin_memo || null, reqId).run();

    if (reqInfo?.seller_phone && c.env.ALIGO_API_KEY && c.env.ALIGO_USER_ID && c.env.ALIGO_SENDER_PHONE) {
      const { subject, message } = buildSampleApprovalMessage({
        sellerName: reqInfo.seller_name,
        productName: reqInfo.product_name,
        approved: body.action === 'approve',
        adminMemo: body.admin_memo,
      });
      sendAlimtalk({
        apikey: c.env.ALIGO_API_KEY,
        userid: c.env.ALIGO_USER_ID,
        senderkey: c.env.ALIGO_SENDER_KEY ?? '',
        tpl_code: c.env.ALIGO_TPL_SAMPLE_APPROVED ?? 'TBD',
        sender: c.env.ALIGO_SENDER_PHONE,
        receiver_1: reqInfo.seller_phone.replace(/-/g, ''),
        recvname_1: reqInfo.seller_name,
        subject_1: subject,
        message_1: message,
      }).catch(e => { if (import.meta.env.DEV) console.warn('[Alimtalk] 샘플 승인 알림 실패:', e) });
    }

    if (reqInfo?.seller_id) {
      const notifType = body.action === 'approve' ? 'supply_approved' : 'supply_rejected';
      const notifTitle = body.action === 'approve' ? '공급 상품 승인' : '공급 상품 거부';
      createDashboardNotification(DB, 'seller', String(reqInfo.seller_id), notifType, notifTitle, `상품: ${reqInfo.product_name}`, '/seller/supply').catch((_e) => { if (import.meta.env.DEV) console.warn(_e) });
    }

    return c.json({
      success: true,
      data: { id: reqId, status: newStatus },
      message: body.action === 'approve' ? '샘플 신청이 승인되었습니다.' : '샘플 신청이 거부되었습니다.',
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] PATCH /sample-requests/:id error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminProductsRoutes;
