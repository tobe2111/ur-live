/**
 * Admin Products Routes — 상품 + 샘플 신청 관리
 *
 * 🛡️ 2026-04-22 배치 148 (TD-006 부분): admin-management.routes.ts 에서 분리.
 *
 * 엔드포인트:
 * - GET    /products                   — 전체 상품 목록
 * - POST   /products                   — 상품 생성
 * - PUT    /products/:id               — 상품 전체 수정
 * - PATCH  /products/:id               — 상품 부분 수정 (is_active, sold_count, stock)
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
import { ensureSupplyVisibilitySchema, recordSupplyPriceChange } from '../../supply/api/supply-visibility';

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
    // 🛡️ 2026-05-19: Coupang WING 스타일 — 검색/필터/정렬/페이지네이션.
    const page = Math.max(1, Number(c.req.query('page') || 1));
    const limit = Math.min(500, Math.max(1, Number(c.req.query('limit') || 100)));
    const offset = (page - 1) * limit;
    const q = String(c.req.query('q') || '').trim();
    const category = String(c.req.query('category') || '').trim();
    const status = String(c.req.query('status') || 'all'); // all | active | inactive
    const source = String(c.req.query('source') || 'all'); // all | kt_alpha | regular
    const minPrice = Number(c.req.query('min_price') || 0);
    const maxPrice = Number(c.req.query('max_price') || 0);
    const sort = String(c.req.query('sort') || 'created');  // created | price | sold | name
    const order = String(c.req.query('order') || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const where: string[] = [];
    const params: unknown[] = [];
    if (q) { where.push('(p.name LIKE ? OR p.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    if (category) { where.push('p.category = ?'); params.push(category); }
    if (status === 'active') where.push('p.is_active = 1');
    else if (status === 'inactive') where.push('p.is_active = 0');
    if (source === 'kt_alpha') where.push('p.kt_alpha_gift_code IS NOT NULL');
    else if (source === 'regular') where.push('p.kt_alpha_gift_code IS NULL');
    if (Number.isFinite(minPrice) && minPrice > 0) { where.push('p.price >= ?'); params.push(minPrice); }
    if (Number.isFinite(maxPrice) && maxPrice > 0) { where.push('p.price <= ?'); params.push(maxPrice); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sortCol: Record<string, string> = {
      created: 'p.created_at', price: 'p.price', sold: 'p.sold_count', name: 'p.name',
    };
    const orderBy = `${sortCol[sort] || 'p.created_at'} ${order}`;

    // 전체 개수 (페이지네이션용).
    const totalRow = await DB.prepare(`SELECT COUNT(*) as cnt FROM products p ${whereClause}`)
      .bind(...params).first<{ cnt: number }>().catch(() => ({ cnt: 0 }));
    const total = totalRow?.cnt ?? 0;

    // 상태별 카운트 (탭 표시용 — 필터 q/category 무시, source 만 반영).
    const tabWhere: string[] = [];
    const tabParams: unknown[] = [];
    if (source === 'kt_alpha') tabWhere.push('kt_alpha_gift_code IS NOT NULL');
    else if (source === 'regular') tabWhere.push('kt_alpha_gift_code IS NULL');
    const tabClause = tabWhere.length ? `WHERE ${tabWhere.join(' AND ')}` : '';
    const tabCounts = await DB.prepare(
      `SELECT
         COUNT(*) as all_count,
         SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active_count,
         SUM(CASE WHEN is_active=0 THEN 1 ELSE 0 END) as inactive_count,
         SUM(CASE WHEN stock=0 AND is_active=1 THEN 1 ELSE 0 END) as out_of_stock,
         SUM(CASE WHEN kt_alpha_gift_code IS NOT NULL THEN 1 ELSE 0 END) as kt_alpha_count
       FROM products ${tabClause}`
    ).bind(...tabParams).first<{
      all_count: number; active_count: number; inactive_count: number; out_of_stock: number; kt_alpha_count: number;
    }>().catch(() => null);

    // 카테고리별 카운트 (사이드바용).
    const catCounts = await DB.prepare(
      `SELECT COALESCE(category, '(미분류)') as category, COUNT(*) as cnt
         FROM products
        WHERE is_active = 1 OR is_active = 0
        GROUP BY category
        ORDER BY cnt DESC LIMIT 50`
    ).all<{ category: string; cnt: number }>().catch(() => ({ results: [] }));

    // 🛡️ 2026-05-19: referral_enabled / referral_commission_rate 추가 (migration 0271).
    //   컬럼 없는 환경에서도 graceful — try/catch fallback.
    let products: ProductRow[]
    try {
      products = await executeQuery<ProductRow>(DB, `
        SELECT p.id, p.name, p.description, p.price, p.stock,
               p.image_url, p.is_active, p.product_type, p.category,
               p.sold_count, p.kt_alpha_gift_code, p.deal_only,
               p.referral_enabled, p.referral_commission_rate,
               COALESCE(p.supply_price, 0) AS supply_price,
               COALESCE(p.is_supply_product, 0) AS is_supply_product,
               p.seller_id, p.created_at, s.business_name as seller_name
        FROM products p LEFT JOIN sellers s ON p.seller_id = s.id
        ${whereClause}
        ORDER BY ${orderBy} LIMIT ? OFFSET ?
      `, [...params, limit, offset]);
    } catch {
      // 마이그레이션 0271 미적용 환경 fallback (referral_* 컬럼 없음).
      products = await executeQuery<ProductRow>(DB, `
        SELECT p.id, p.name, p.description, p.price, p.stock,
               p.image_url, p.is_active, p.product_type, p.category,
               p.sold_count, p.kt_alpha_gift_code, p.deal_only,
               COALESCE(p.supply_price, 0) AS supply_price,
               COALESCE(p.is_supply_product, 0) AS is_supply_product,
               p.seller_id, p.created_at, s.business_name as seller_name
        FROM products p LEFT JOIN sellers s ON p.seller_id = s.id
        ${whereClause}
        ORDER BY ${orderBy} LIMIT ? OFFSET ?
      `, [...params, limit, offset]);
    }

    return c.json({
      success: true,
      data: products,
      page, limit, total,
      total_pages: Math.ceil(total / limit),
      tabs: tabCounts || { all_count: 0, active_count: 0, inactive_count: 0, out_of_stock: 0, kt_alpha_count: 0 },
      categories: catCounts.results || [],
      filters: { q, category, status, source, sort, order, min_price: minPrice, max_price: maxPrice },
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// 🛡️ 2026-05-18: 일괄 작업 — 삭제 / 활성화 / 비활성화.
//   body: { ids: number[], action: 'delete' | 'activate' | 'deactivate' }
//   응답: { success, deleted: N, soft_deleted: M, updated: K, skipped: L, message }
//   - delete: 주문 이력 있으면 soft (is_active=0), 없으면 hard delete (단일 DELETE 와 동일 정책)
//   - activate/deactivate: is_active 만 일괄 UPDATE
//   - 50건 제한 (단일 트랜잭션 부담 + 잘못된 일괄 작업 영향 범위 제한)
adminProductsRoutes.post('/products/bulk-action', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const body = await c.req.json<{ ids?: unknown; action?: unknown }>().catch(() => ({}));
    const rawIds = Array.isArray((body as any).ids) ? ((body as any).ids as unknown[]) : [];
    const ids = rawIds
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    const action = String((body as any).action || '');

    if (ids.length === 0) {
      return c.json({ success: false, error: '대상 ID 가 없습니다' }, 400);
    }
    if (ids.length > 50) {
      return c.json({ success: false, error: '한번에 최대 50건까지 처리 가능합니다' }, 400);
    }
    if (!['delete', 'activate', 'deactivate'].includes(action)) {
      return c.json({ success: false, error: 'action 은 delete / activate / deactivate 중 하나여야 합니다' }, 400);
    }

    const placeholders = ids.map(() => '?').join(',');

    // 존재 검증.
    const existing = await executeQuery<IdRow>(DB, `SELECT id FROM products WHERE id IN (${placeholders})`, ids)
      .catch(() => [] as Array<IdRow>);
    const existingIds = existing.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
    if (existingIds.length === 0) {
      return c.json({ success: false, error: '대상 상품을 찾을 수 없습니다' }, 404);
    }
    const ePlaceholders = existingIds.map(() => '?').join(',');

    if (action === 'activate' || action === 'deactivate') {
      const next = action === 'activate' ? 1 : 0;
      await executeRun(
        DB,
        `UPDATE products SET is_active = ?, updated_at = datetime('now') WHERE id IN (${ePlaceholders})`,
        [next, ...existingIds],
      );
      await writeAuditLog(c, {
        action: `bulk_${action}_product`,
        targetType: 'product',
        targetId: existingIds.join(','),
        after: { is_active: next, count: existingIds.length },
      }).catch(() => { /* audit 실패해도 성공 처리 */ });
      return c.json({
        success: true,
        updated: existingIds.length,
        skipped: ids.length - existingIds.length,
        message: `${existingIds.length}건 ${action === 'activate' ? '활성화' : '비활성화'} 완료`,
      });
    }

    // action === 'delete' — order_items 참조 분기로 soft vs hard.
    const referenced = await executeQuery<{ product_id: number }>(
      DB,
      `SELECT DISTINCT product_id FROM order_items WHERE product_id IN (${ePlaceholders})`,
      existingIds,
    ).catch(() => [] as Array<{ product_id: number }>);
    const refSet = new Set(referenced.map((r) => Number(r.product_id)));
    const softIds = existingIds.filter((id) => refSet.has(id));
    const hardIds = existingIds.filter((id) => !refSet.has(id));

    if (softIds.length > 0) {
      const sp = softIds.map(() => '?').join(',');
      await executeRun(
        DB,
        `UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id IN (${sp})`,
        softIds,
      );
    }
    if (hardIds.length > 0) {
      const hp = hardIds.map(() => '?').join(',');
      await executeRun(DB, `DELETE FROM products WHERE id IN (${hp})`, hardIds);
    }
    await writeAuditLog(c, {
      action: 'bulk_delete_product',
      targetType: 'product',
      targetId: existingIds.join(','),
      after: { soft_deleted: softIds.length, hard_deleted: hardIds.length },
    }).catch(() => { /* noop */ });

    return c.json({
      success: true,
      deleted: hardIds.length,
      soft_deleted: softIds.length,
      skipped: ids.length - existingIds.length,
      message: `${existingIds.length}건 처리 완료 (삭제 ${hardIds.length}건, 비활성 ${softIds.length}건)`,
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] bulk action error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminProductsRoutes.delete('/products/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const productId = c.req.param('id');
    if (!productId || !/^\d+$/.test(String(productId))) return c.json({ success: false, error: 'Invalid ID' }, 400);

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
      // 🛡️ 2026-05-19: 어드민 큐레이션 상품은 referral_enabled=1 기본 ON, 5% 보상률 (사용자 정책 B).
      //   referral_commission_rate=NULL → platform default (5%) 사용. 어드민이 상품별 override 가능.
      result = await executeRun(DB, `
        INSERT INTO products (
          name, description, long_description, price, compare_at_price, supply_price,
          stock, image_url, detail_images, category, product_type,
          is_supply_product, referral_enabled, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, datetime('now'), datetime('now'))
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
    if (!productId || !/^\d+$/.test(String(productId))) return c.json({ success: false, error: 'Invalid ID' }, 400);
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
    if (!productId || !/^\d+$/.test(String(productId))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const body = await c.req.json();
    const { is_active, sold_count, stock, referral_enabled, referral_commission_rate } = body;

    const product = await executeQuery<IdRow>(DB, 'SELECT id FROM products WHERE id = ?', [productId]);
    if (product.length === 0) {
      return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    }

    const updates: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];

    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sold_count !== undefined) { updates.push('sold_count = ?'); params.push(Number(sold_count)); }
    // 🛡️ 2026-05-18: 어드민 상품 목록에서 재고 인라인 편집 — stock 도 PATCH 지원.
    //   음수 차단 + Number.isFinite 검증 (NaN/Infinity 차단).
    if (stock !== undefined) {
      const n = Number(stock);
      if (!Number.isFinite(n) || n < 0) {
        return c.json({ success: false, error: '재고는 0 이상의 숫자여야 합니다' }, 400);
      }
      updates.push('stock = ?'); params.push(Math.floor(n));
    }
    // 🛡️ 2026-05-19: 어드민이 상품별 추천 ON/OFF + 보상률 조정 가능 (이상적·영구적 — 정책 B/C 모두 override 가능).
    if (referral_enabled !== undefined) {
      updates.push('referral_enabled = ?');
      params.push(referral_enabled ? 1 : 0);
    }
    if (referral_commission_rate !== undefined) {
      if (referral_commission_rate === null) {
        // NULL = platform default 사용 (override 해제)
        updates.push('referral_commission_rate = NULL');
      } else {
        const r = Number(referral_commission_rate);
        if (!Number.isFinite(r) || r < 0 || r > 0.5) {
          return c.json({ success: false, error: '보상률은 0~50% (0.0~0.5) 범위여야 합니다' }, 400);
        }
        updates.push('referral_commission_rate = ?'); params.push(r);
      }
    }

    params.push(productId);
    await executeRun(DB, `UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);

    return c.json({
      success: true,
      data: {
        id: productId,
        ...(is_active !== undefined ? { is_active: is_active ? 1 : 0 } : {}),
        ...(sold_count !== undefined ? { sold_count: Number(sold_count) } : {}),
        ...(stock !== undefined ? { stock: Math.floor(Number(stock)) } : {}),
        ...(referral_enabled !== undefined ? { referral_enabled: referral_enabled ? 1 : 0 } : {}),
        ...(referral_commission_rate !== undefined ? { referral_commission_rate } : {}),
      },
    });
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
    if (!reqId || !/^\d+$/.test(String(reqId))) return c.json({ success: false, error: 'Invalid ID' }, 400);
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

// ── 🛡️ 2026-06-01 도매몰 INC-4: 공급자 self-serve 등록 상품 승인 큐 ──────────────
//   GET  /supplier-products            — 공급자가 직접 등록한 상품 목록 (status 필터)
//   PATCH /supplier-products/:id        — 승인(is_active=1) / 거부(supply_approval_status='rejected')
//   (adminApp 가 requireAdmin + IP whitelist + audit 적용)
adminProductsRoutes.get('/supplier-products', cors(), async (c) => {
  try {
    const { DB } = c.env;
    await ensureSupplyVisibilitySchema(DB);
    const status = String(c.req.query('status') || 'pending'); // pending | approved | rejected | price_change | all
    const page = Math.max(1, Number(c.req.query('page') || 1));
    const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') || 50)));
    const offset = (page - 1) * limit;

    let where = 'p.is_supply_product = 1 AND p.supplier_id IS NOT NULL';
    const params: (string | number)[] = [];
    if (status === 'pending' || status === 'rejected') {
      where += ' AND p.supply_approval_status = ?'; params.push(status);
    } else if (status === 'approved') {
      where += " AND (p.supply_approval_status = 'approved' OR (p.supply_approval_status IS NULL AND p.is_active = 1))";
    } else if (status === 'price_change') {
      // 가격 변경 승인 대기 — 판매중 상품의 가격 수정 요청 큐.
      where += ' AND p.pending_supply_price IS NOT NULL';
    }

    // price_change 큐는 요청 시각순, 나머지는 등록순.
    const orderBy = status === 'price_change' ? 'p.pending_price_requested_at DESC' : 'p.created_at DESC';
    const rows = await DB.prepare(
      `SELECT p.id, p.name, p.description, p.price AS retail_price, COALESCE(p.supply_price, 0) AS supply_price,
              p.stock, p.image_url, p.category, p.is_active,
              p.lowest_price_url, COALESCE(p.lowest_price_checked,0) AS lowest_price_checked,
              p.pending_supply_price, p.pending_retail_price, p.pending_price_url, p.pending_price_reason, p.pending_price_requested_at,
              COALESCE(p.supply_approval_status, CASE WHEN p.is_active = 1 THEN 'approved' ELSE 'pending' END) AS approval_status,
              p.supplier_id, p.admin_memo, p.created_at,
              s.business_name AS supplier_name, s.email AS supplier_email
         FROM products p
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         WHERE ${where}
         ORDER BY ${orderBy} LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    const total = await DB.prepare(
      `SELECT COUNT(*) AS count FROM products p WHERE ${where}`
    ).bind(...params).first<{ count: number }>();

    return c.json({ success: true, data: { items: rows.results ?? [], total: total?.count ?? 0, page, limit } });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] GET /supplier-products error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminProductsRoutes.patch('/supplier-products/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const pid = c.req.param('id');
    if (!/^\d+$/.test(String(pid))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const body = await c.req.json<{ action: 'approve' | 'reject'; admin_memo?: string; lowest_price_checked?: boolean }>();
    if (!body.action || !['approve', 'reject'].includes(body.action)) {
      return c.json({ success: false, error: 'action은 approve 또는 reject이어야 합니다' }, 400);
    }
    await ensureSupplyVisibilitySchema(DB);

    const existing = await DB.prepare(
      `SELECT id, name, supplier_id, supply_approval_status, is_active, lowest_price_url
         FROM products WHERE id = ? AND is_supply_product = 1 AND supplier_id IS NOT NULL`
    ).bind(pid).first<{ id: number; name: string; supplier_id: number; supply_approval_status: string | null; is_active: number; lowest_price_url: string | null }>();
    if (!existing) return c.json({ success: false, error: '공급자 등록 상품을 찾을 수 없습니다' }, 404);

    if (body.action === 'approve') {
      // GATE: 온라인 최저가 검수를 게시 차단 게이트로 강제 (사용자 확인 2026-06-07).
      //   최저가 확인(lowest_price_checked) + 최저가 URL(lowest_price_url) 둘 다 있어야 승인/게시 가능.
      if (!body.lowest_price_checked || !existing.lowest_price_url) {
        return c.json({ success: false, error: '온라인 최저가 검수가 필요합니다. 최저가 확인 후 승인하세요.' }, 400);
      }
      // 최저가 검수 결과 함께 기록 (체크 시 lowest_price_checked=1).
      // CAS: pending → approved 원자 전이만 허용 (중복 승인/이중 audit·알림 방지).
      const upd = await DB.prepare(
        "UPDATE products SET supply_approval_status = 'approved', is_active = 1, admin_memo = ?, lowest_price_checked = ?, updated_at = datetime('now') WHERE id = ? AND supply_approval_status = 'pending'"
      ).bind(body.admin_memo || null, body.lowest_price_checked ? 1 : 0, pid).run();
      if ((upd.meta?.changes ?? 0) === 0) {
        return c.json({ success: false, error: '이미 처리되었거나 상태가 변경된 요청입니다' }, 409);
      }
    } else {
      // CAS: pending/rejected 상태에서만 거부 (이미 승인된 건 거부로 되돌리지 않음 + 이중 audit 방지).
      const upd = await DB.prepare(
        "UPDATE products SET supply_approval_status = 'rejected', is_active = 0, admin_memo = ?, updated_at = datetime('now') WHERE id = ? AND supply_approval_status IN ('pending','rejected')"
      ).bind(body.admin_memo || null, pid).run();
      if ((upd.meta?.changes ?? 0) === 0) {
        return c.json({ success: false, error: '이미 처리되었거나 상태가 변경된 요청입니다' }, 409);
      }
    }

    // 상태 전이 성공(changes===1) 시에만 side-effect 실행.
    await writeAuditLog(c, {
      action: body.action === 'approve' ? 'supplier_product_approve' : 'supplier_product_reject',
      targetType: 'product', targetId: String(pid),
      after: { supplier_id: existing.supplier_id, memo: body.admin_memo || null },
    }).catch(() => {});

    // 공급자 대시보드 알림.
    const notifType = body.action === 'approve' ? 'supply_product_approved' : 'supply_product_rejected';
    const notifTitle = body.action === 'approve' ? '공급상품 승인됨' : '공급상품 거부됨';
    createDashboardNotification(DB, 'supplier', String(existing.supplier_id), notifType, notifTitle,
      `상품: ${existing.name}`, '/supplier').catch((_e) => { if (import.meta.env.DEV) console.warn(_e); });

    return c.json({
      success: true,
      data: { id: Number(pid), approval_status: body.action === 'approve' ? 'approved' : 'rejected' },
      message: body.action === 'approve' ? '공급상품이 승인되어 셀러 카탈로그에 노출됩니다.' : '공급상품이 거부되었습니다.',
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] PATCH /supplier-products/:id error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ── 🏭 2026-06-07 공급가 변경 요청 승인/거부 (사용자 요청) ──────────────────────
//   PATCH /supplier-products/:id/price-change  body { action: approve|reject, admin_memo? }
//   approve → pending_* 를 라이브 supply_price/price 로 반영 + 이력 기록 + pending 클리어.
//   reject  → pending_* 클리어(요청 폐기), 라이브 가격 불변.
adminProductsRoutes.patch('/supplier-products/:id/price-change', cors(), async (c) => {
  try {
    const { DB } = c.env;
    await ensureSupplyVisibilitySchema(DB);
    const pid = c.req.param('id');
    if (!/^\d+$/.test(String(pid))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const body = await c.req.json<{ action: 'approve' | 'reject'; admin_memo?: string }>();
    if (!body.action || !['approve', 'reject'].includes(body.action)) {
      return c.json({ success: false, error: 'action은 approve 또는 reject이어야 합니다' }, 400);
    }

    const existing = await DB.prepare(
      `SELECT id, name, supplier_id, supply_price, price, pending_supply_price, pending_retail_price
         FROM products WHERE id = ? AND is_supply_product = 1 AND supplier_id IS NOT NULL`
    ).bind(pid).first<{ id: number; name: string; supplier_id: number; supply_price: number; price: number; pending_supply_price: number | null; pending_retail_price: number | null }>();
    if (!existing) return c.json({ success: false, error: '공급자 등록 상품을 찾을 수 없습니다' }, 404);
    if (existing.pending_supply_price == null) {
      return c.json({ success: false, error: '대기 중인 가격 변경 요청이 없습니다' }, 409);
    }

    if (body.action === 'approve') {
      const newSupply = Math.floor(Number(existing.pending_supply_price));
      const newRetail = existing.pending_retail_price != null ? Math.floor(Number(existing.pending_retail_price)) : existing.price;
      // 라이브 가격 반영 + pending 클리어. (admin_memo 갱신)
      // CAS: pending_supply_price 가 아직 살아있을 때만 처리 (동시 승인/거부 중복 방지).
      const upd = await DB.prepare(
        `UPDATE products
            SET supply_price = ?, price = ?, admin_memo = ?,
                pending_supply_price = NULL, pending_retail_price = NULL, pending_price_url = NULL,
                pending_price_reason = NULL, pending_price_requested_at = NULL, updated_at = datetime('now')
          WHERE id = ? AND pending_supply_price IS NOT NULL`
      ).bind(newSupply, newRetail, body.admin_memo || null, pid).run();
      if ((upd.meta?.changes ?? 0) === 0) {
        return c.json({ success: false, error: '이미 처리된 요청' }, 409);
      }
      // 공급가 변경 이력 (관리자만 확인).
      await recordSupplyPriceChange(DB, Number(pid), existing.supplier_id, existing.supply_price, newSupply, `admin:price-change`);
    } else {
      // CAS: pending 요청이 살아있을 때만 폐기 (동시 처리 중복 방지).
      const upd = await DB.prepare(
        `UPDATE products
            SET admin_memo = ?, pending_supply_price = NULL, pending_retail_price = NULL, pending_price_url = NULL,
                pending_price_reason = NULL, pending_price_requested_at = NULL, updated_at = datetime('now')
          WHERE id = ? AND pending_supply_price IS NOT NULL`
      ).bind(body.admin_memo || null, pid).run();
      if ((upd.meta?.changes ?? 0) === 0) {
        return c.json({ success: false, error: '이미 처리된 요청' }, 409);
      }
    }

    // 상태 전이 성공(changes===1) 시에만 side-effect(audit·알림) 실행.
    await writeAuditLog(c, {
      action: body.action === 'approve' ? 'supplier_price_change_approve' : 'supplier_price_change_reject',
      targetType: 'product', targetId: String(pid),
      after: { supplier_id: existing.supplier_id, old_supply_price: existing.supply_price, new_supply_price: existing.pending_supply_price, memo: body.admin_memo || null },
    }).catch(() => {});

    const notifType = body.action === 'approve' ? 'supply_price_change_approved' : 'supply_price_change_rejected';
    const notifTitle = body.action === 'approve' ? '공급가 변경 승인됨' : '공급가 변경 거부됨';
    createDashboardNotification(DB, 'supplier', String(existing.supplier_id), notifType, notifTitle,
      `상품: ${existing.name}`, '/supplier').catch((_e) => { if (import.meta.env.DEV) console.warn(_e); });

    return c.json({
      success: true,
      data: { id: Number(pid), action: body.action },
      message: body.action === 'approve' ? '가격 변경이 승인되어 반영되었습니다.' : '가격 변경 요청이 거부되었습니다.',
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] PATCH /supplier-products/:id/price-change error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminProductsRoutes;
