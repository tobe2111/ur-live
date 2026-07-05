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
import { getSupplyMeta, setSupplyMeta } from '@/worker/utils/product-supply-meta';
import { loadPlatformCommissionPct } from '../../supply/api/wholesale-settlement';
import { distributorPriceFromCost } from '@/lib/distributor-pricing';
import { invalidateGroupBuyProductsCache } from '../../group-buy/api/cache-keys';
import { isValidKakaoPlaceUrl, normalizeKakaoPlaceUrl } from '@/shared/kakao-place-url';
import { intParam } from '@/shared/pagination'

export const adminProductsRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

/**
 * 🆕 2026-06-19 (대표 확정) 제품별 플랫폼 마진% 입력 정규화 (미끼/마진 전략).
 *   - undefined → touch:false (컬럼 미변경, 기존 유지)
 *   - null/''   → touch:true, value:null (override 해제 → 전역 기본 마진 사용)
 *   - 0~90 숫자 → touch:true, value:숫자
 *   - 범위 밖/숫자 아님 → error
 */
function normalizeMarginOverride(input: number | null | undefined): { touch: boolean; value: number | null; error?: string } {
  if (input === undefined) return { touch: false, value: null };
  if (input === null || (input as unknown) === '') return { touch: true, value: null };
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0 || n > 90) {
    return { touch: false, value: null, error: '마진율은 0~90 사이의 숫자여야 합니다' };
  }
  return { touch: true, value: Math.round(n * 10) / 10 }; // 소수 1자리 허용
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
    const page = Math.max(1, intParam(c.req.query('page'), 1));
    const limit = Math.min(500, Math.max(1, intParam(c.req.query('limit'), 100)));
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

    // 🎯 2026-07-03 (대표 "삭제하면 아예 안 보여야"): soft-retire 는 slug 를 'retired-' 로 마킹 →
    //   목록(dongnedeal/list)이 제외 → 삭제 즉시 관리 목록에서 사라짐(눈-토글 '숨김'은 slug 유지라 계속 보임).
    const RETIRE_SET = "is_active = 0, slug = CASE WHEN slug LIKE 'retired-%' THEN slug ELSE 'retired-' || slug || '-' || id END, updated_at = datetime('now')";
    const hasOrders = await executeQuery<IdRow>(DB, 'SELECT id FROM order_items WHERE product_id = ? LIMIT 1', [productId]);
    if (hasOrders.length > 0) {
      await executeRun(DB, `UPDATE products SET ${RETIRE_SET} WHERE id = ?`, [productId]);
      await writeAuditLog(c, { action: 'soft_delete_product', targetType: 'product', targetId: productId, after: { is_active: 0 } });
      await import('../../../worker/utils/group-buy-feed-invalidate').then((m) => m.invalidateGroupBuyFeed(c.env, new URL(c.req.url).origin, (p) => c.executionCtx?.waitUntil?.(p))).catch(() => {});
      return c.json({ success: true, data: { id: productId, soft_deleted: true } });
    }

    // 🛡️ 2026-07-02 (대표 신고 — 동네딜 단건 삭제 500): order_items 만 검사하던 하드삭제가
    //   다른 FK 참조(fcfs_applications/product_supply_meta/vouchers/product_regions 등) 때문에 실패 → 500.
    //   seed-demo 일괄삭제(2026-07-01)와 동일 패턴: 부속 데이터 선정리(best-effort) → DELETE 시도 →
    //   그래도 실패(잔여 FK)면 soft-retire(is_active=0) 폴백 — 어떤 경우에도 500 없이 목록에서 사라짐.
    // 🎯 2026-07-03 (대표 신고 — 삭제해도 '숨김'으로 남음): 자동시드된 fake 리뷰(product_reviews)·장바구니·
    //   위시리스트가 FK 로 하드삭제를 막아 soft-retire 로만 처리되던 것 → 파생 자식행도 선정리(주문 없을 때만이라 안전).
    await executeRun(DB, 'DELETE FROM product_supply_meta WHERE product_id = ?', [productId]).catch(() => {});
    await executeRun(DB, 'DELETE FROM fcfs_applications WHERE product_id = ?', [productId]).catch(() => {});
    await executeRun(DB, 'DELETE FROM product_regions WHERE product_id = ?', [productId]).catch(() => {});
    await executeRun(DB, 'DELETE FROM product_reviews WHERE product_id = ?', [productId]).catch(() => {});
    await executeRun(DB, 'DELETE FROM cart_items WHERE product_id = ?', [productId]).catch(() => {});
    await executeRun(DB, 'DELETE FROM wishlists WHERE product_id = ?', [productId]).catch(() => {});
    try {
      await executeRun(DB, 'DELETE FROM products WHERE id = ?', [productId]);
      await writeAuditLog(c, { action: 'hard_delete_product', targetType: 'product', targetId: productId });
    } catch {
      await executeRun(DB, `UPDATE products SET ${RETIRE_SET} WHERE id = ?`, [productId]);
      await writeAuditLog(c, { action: 'soft_delete_product', targetType: 'product', targetId: productId, after: { is_active: 0, reason: 'fk_refs' } });
      await import('../../../worker/utils/group-buy-feed-invalidate').then((m) => m.invalidateGroupBuyFeed(c.env, new URL(c.req.url).origin, (p) => c.executionCtx?.waitUntil?.(p))).catch(() => {});
      return c.json({ success: true, data: { id: productId, soft_deleted: true } });
    }
    await import('../../../worker/utils/group-buy-feed-invalidate').then((m) => m.invalidateGroupBuyFeed(c.env, new URL(c.req.url).origin, (p) => c.executionCtx?.waitUntil?.(p))).catch(() => {});

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
    const page = intParam(c.req.query('page'), 1);
    const limit = Math.min(intParam(c.req.query('limit'), 20), 100);
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

    // 🛡️ 2026-06-25: claim-before-credit CAS — 사전 SELECT 만으론 동시 승인 못 막음(둘 다 통과 → 알림톡 2회).
    //   PENDING 원자 선점 후 changes===0 이면 멱등 409 (side-effect 미실행).
    const upd = await DB.prepare(`
      UPDATE sample_requests
      SET status = ?, admin_memo = ?, updated_at = datetime('now'),
          approved_at = ${approvedAt}
      WHERE id = ? AND status = 'PENDING'
    `).bind(newStatus, body.admin_memo || null, reqId).run();
    if ((upd.meta?.changes ?? 0) === 0) {
      return c.json({ success: false, error: '이미 처리된 신청입니다' }, 409);
    }

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
    const page = Math.max(1, intParam(c.req.query('page'), 1));
    const limit = Math.min(200, Math.max(1, intParam(c.req.query('limit'), 50)));
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
              p.stock, p.image_url, p.detail_images, p.category, p.is_active,
              p.lowest_price_url, COALESCE(p.lowest_price_checked,0) AS lowest_price_checked,
              p.supply_margin_override_pct AS margin_override,
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

    // 🆕 2026-06-19 (대표 확정): 제품별 마진 미설정 시 적용되는 전역 기본 플랫폼 마진%(어드민 설정).
    //   어드민 검수 UI 가 '이 상품 마진 %' 를 결정할 때 기준값으로 표시.
    const defaultMarginPct = await loadPlatformCommissionPct(DB).catch(() => 10);

    // 🖼️ 2026-06-30: 대표 이미지 갤러리(meta) 첨부 — 어드민이 승인 전 썸네일·갤러리·상세이미지 시각 검수. fail-soft.
    const items = (rows.results ?? []) as Array<Record<string, unknown> & { id: number }>;
    if (items.length) {
      const metaMap = await getSupplyMeta(DB, items.map((r) => Number(r.id))).catch(() => null);
      if (metaMap) for (const r of items) r.gallery_images = metaMap.get(Number(r.id))?.gallery_images || null;
    }

    return c.json({ success: true, data: { items, total: total?.count ?? 0, page, limit, default_margin_pct: defaultMarginPct } });
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
    const body = await c.req.json<{ action: 'approve' | 'reject'; admin_memo?: string; lowest_price_checked?: boolean; margin_override_pct?: number | null }>();
    if (!body.action || !['approve', 'reject'].includes(body.action)) {
      return c.json({ success: false, error: 'action은 approve 또는 reject이어야 합니다' }, 400);
    }
    await ensureSupplyVisibilitySchema(DB);

    // 🆕 2026-06-19 (대표 확정): 승인 시 제품별 플랫폼 마진% 동시 설정(미끼=저, 마진상품=고).
    //   undefined → 컬럼 미변경(기존 유지) / null → 전역 기본 사용(override 해제) / 0~90 숫자 → 설정.
    const marginField = normalizeMarginOverride(body.margin_override_pct);
    if (marginField.error) return c.json({ success: false, error: marginField.error }, 400);

    const existing = await DB.prepare(
      `SELECT id, name, supplier_id, supply_approval_status, is_active, lowest_price_url
         FROM products WHERE id = ? AND is_supply_product = 1 AND supplier_id IS NOT NULL`
    ).bind(pid).first<{ id: number; name: string; supplier_id: number; supply_approval_status: string | null; is_active: number; lowest_price_url: string | null }>();
    if (!existing) return c.json({ success: false, error: '공급자 등록 상품을 찾을 수 없습니다' }, 404);

    if (body.action === 'approve') {
      // GATE: 온라인 최저가 검수를 게시 차단 게이트로 강제 (사용자 확인 2026-06-07).
      //   🛡️ 2026-06-25 (대표 신고 "최저가 확인함 체크했는데 계속 뜸"): 사람-검수 게이트 = 어드민의
      //   'lowest_price_checked' 체크. 기존엔 supplier 제출 lowest_price_url 도 필수였으나, 그 URL 은
      //   AddProductModal 에서 '선택값'(required 아님)이라 미제출 상품은 체크해도 영구 승인불가였음.
      //   → URL 은 검수 보조 참고자료로만 두고, 승인 게이트는 어드민 체크(lowest_price_checked)만 요구.
      if (!body.lowest_price_checked) {
        return c.json({ success: false, error: '온라인 최저가 검수가 필요합니다. 최저가 확인 후 승인하세요.' }, 400);
      }
      // 최저가 검수 결과 함께 기록 (체크 시 lowest_price_checked=1).
      // 🆕 마진 설정값이 전달되면 같은 원자 UPDATE 로 함께 반영(추가 RTT 없음).
      // CAS: pending → approved 원자 전이만 허용 (중복 승인/이중 audit·알림 방지).
      const marginSet = marginField.touch ? ', supply_margin_override_pct = ?' : '';
      const upd = await DB.prepare(
        `UPDATE products SET supply_approval_status = 'approved', is_active = 1, admin_memo = ?, lowest_price_checked = ?${marginSet}, updated_at = datetime('now') WHERE id = ? AND supply_approval_status = 'pending'`
      ).bind(body.admin_memo || null, body.lowest_price_checked ? 1 : 0, ...(marginField.touch ? [marginField.value] : []), pid).run();
      if ((upd.meta?.changes ?? 0) === 0) {
        return c.json({ success: false, error: '이미 처리되었거나 상태가 변경된 요청입니다' }, 409);
      }
    } else {
      // CAS: pending 상태에서만 거부 (이미 거부/승인된 건 재처리 X — 중복 audit·공급자 알림 방지).
      // 🔧 2026-06-24 (전수조사 B): 기존 IN('pending','rejected')는 이미 rejected 인 행 재거부 시 updated_at 변경으로
      //   changes=1 → '거부됨' 알림·audit 가 매번 재발생했음. 'rejected' 는 종단상태(재거부=409). 재제출은 공급자 PATCH 로 pending 복귀.
      const upd = await DB.prepare(
        "UPDATE products SET supply_approval_status = 'rejected', is_active = 0, admin_memo = ?, updated_at = datetime('now') WHERE id = ? AND supply_approval_status = 'pending'"
      ).bind(body.admin_memo || null, pid).run();
      if ((upd.meta?.changes ?? 0) === 0) {
        return c.json({ success: false, error: '이미 처리되었거나 상태가 변경된 요청입니다' }, 409);
      }
    }

    // 상태 전이 성공(changes===1) 시에만 side-effect 실행.
    await writeAuditLog(c, {
      action: body.action === 'approve' ? 'supplier_product_approve' : 'supplier_product_reject',
      targetType: 'product', targetId: String(pid),
      after: { supplier_id: existing.supplier_id, memo: body.admin_memo || null, ...(marginField.touch ? { margin_override_pct: marginField.value } : {}) },
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

// ── 🆕 2026-06-19 (대표 확정) 제품별 플랫폼 마진 설정 — 미끼/마진 전략 ──────────────
//   PATCH /supplier-products/:id/margin  body { margin_override_pct: number(0~90) | null }
//   승인 여부와 무관하게 언제든 마진 조율(승인된 상품도 포함). null → override 해제(전역 기본).
//   응답에 계산된 판매사 공급가(= 공급원가 × (1+마진%), 판매가 상한·공급원가 하한)를 함께 반환.
adminProductsRoutes.patch('/supplier-products/:id/margin', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const pid = c.req.param('id');
    if (!/^\d+$/.test(String(pid))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const body = await c.req.json<{ margin_override_pct?: number | null }>();
    const marginField = normalizeMarginOverride(body.margin_override_pct);
    if (marginField.error) return c.json({ success: false, error: marginField.error }, 400);
    if (!marginField.touch) return c.json({ success: false, error: 'margin_override_pct 값이 필요합니다' }, 400);
    await ensureSupplyVisibilitySchema(DB);

    const existing = await DB.prepare(
      `SELECT id, name, supplier_id, COALESCE(supply_price,0) AS supply_price, COALESCE(price,0) AS retail_price
         FROM products WHERE id = ? AND is_supply_product = 1 AND supplier_id IS NOT NULL`
    ).bind(pid).first<{ id: number; name: string; supplier_id: number; supply_price: number; retail_price: number }>();
    if (!existing) return c.json({ success: false, error: '공급자 등록 상품을 찾을 수 없습니다' }, 404);

    const upd = await DB.prepare(
      "UPDATE products SET supply_margin_override_pct = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(marginField.value, pid).run();
    if ((upd.meta?.changes ?? 0) === 0) {
      return c.json({ success: false, error: '마진 설정에 실패했습니다' }, 409);
    }

    await writeAuditLog(c, {
      action: 'supplier_product_set_margin',
      targetType: 'product', targetId: String(pid),
      after: { supplier_id: existing.supplier_id, margin_override_pct: marginField.value },
    }).catch(() => {});

    // 결과 공급가 미리보기 — 제품별 마진(없으면 전역 기본)으로 산출.
    const defaultMarginPct = await loadPlatformCommissionPct(DB).catch(() => 10);
    const effMarginPct = marginField.value != null ? marginField.value : defaultMarginPct;
    const distributorPrice = distributorPriceFromCost(existing.supply_price, effMarginPct, existing.retail_price);

    return c.json({
      success: true,
      data: {
        id: Number(pid),
        margin_override_pct: marginField.value,
        effective_margin_pct: effMarginPct,
        distributor_price: distributorPrice,
        platform_margin: Math.max(0, distributorPrice - existing.supply_price),
      },
      message: marginField.value != null
        ? `마진 ${effMarginPct}% 적용 — 판매사 공급가 ${distributorPrice.toLocaleString()}원`
        : '제품별 마진을 해제했습니다(전역 기본 적용).',
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] PATCH /supplier-products/:id/margin error:', err);
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

// ─────────────────────────────────────────────────────────────────────────────
// 🧭 2026-06-17 (대표 요청 — 동네딜 채우기): 동네딜(오프라인 공동구매) 상품 일괄 등록 + 데모 시드.
//   동네딜 피드(group-buy-public GET /products)는 category IN(meal/beauty/etc/general) + is_active=1 +
//   group_buy_status='active' 인 products 를 노출 → 여기서 그 형태로 INSERT 하면 즉시 동네딜에 표시.
//   ⚠️ 숙소(stay_voucher)는 product_stay_info(객실/날짜) 별도 테이블이 필요해 이 도구로 등록 불가
//      (셀러 숙소 등록 플로우 전용) — CSV 에 숙소가 오면 행 단위로 거부.
//   (adminApp 가 requireAdmin + admin-rbac + audit 적용 — 별도 미들웨어 불필요.)

const DEAL_DEMO_SLUG = 'demo-deal-';

const DEAL_CATEGORY_ALIAS: Record<string, string> = {
  '이용권': 'meal_voucher', '맛집': 'meal_voucher', '맛집 이용권': 'meal_voucher', 'meal': 'meal_voucher', 'meal_voucher': 'meal_voucher',
  '미용': 'beauty_voucher', '뷰티': 'beauty_voucher', 'beauty': 'beauty_voucher', 'beauty_voucher': 'beauty_voucher',
  '기타': 'etc_voucher', 'etc': 'etc_voucher', 'etc_voucher': 'etc_voucher',
  // ❌ 2026-07-02 (대표 확정 "완전 분리"): general(배송형) alias 제거 — 동네딜 도구로 배송형 등록 불가.
  '숙소': 'stay_voucher', 'stay': 'stay_voucher', 'stay_voucher': 'stay_voucher',
};
function mapDealCategory(raw: string): string | null {
  const t = (raw || '').trim();
  return DEAL_CATEGORY_ALIAS[t] ?? DEAL_CATEGORY_ALIAS[t.toLowerCase()] ?? null;
}

function parseDealCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) return [];
  const parseLine = (line: string): string[] => {
    const out: string[] = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else { if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
    return obj;
  });
}

// q = 네이버 이미지검색 키워드(실사진 확보용). img = 검색 실패/키 미설정 시 폴백.
// spots/seed = 추첨 응모(fcfs) — 정원(spots) 대비 지원 시드(seed, 정원 초과) → "선착순 {seed}/{spots}명" 표시.
// ⚠️ desc = 유저에게 그대로 노출되는 상품 설명 — "데모" 문구 절대 금지(2026-07-02 대표 지시,
//   실제 상품처럼 보여야 함). 데모 식별은 slug(demo-deal-N, 유저 비노출)로만.
// pq = 카카오 장소검색용 순수 업종 키워드(이미지검색용 q 와 분리 — "상차림/인테리어/시술" 같은 노이즈 배제).
//   place 매칭은 `{지역} {pq}` 로 질의 → 실제 매장(좌표·주소·place_url) 반환 확률 극대화(대표 "정확하게").
const DEAL_DEMO: { name: string; cat: string; price: number; orig: number; rest: string; addr: string; img: string; q: string; pq: string; spots: number; seed: number; desc: string }[] = [
  { name: '[강남] 1++ 한우 오마카세 2인', cat: 'meal_voucher', price: 89000, orig: 140000, rest: '한우공방 강남점', addr: '서울 강남구 봉은사로', img: 'https://picsum.photos/seed/urdeal1/600/600', q: '한우 오마카세 상차림', pq: '한우 오마카세', spots: 5, seed: 30, desc: '1++ 한우 오마카세 2인 코스. 셰프가 부위별로 직접 구워드립니다. 매장 방문 후 이용권 QR 제시로 바로 이용하세요.' },
  { name: '[연남] 화덕피자 + 파스타 2인 세트', cat: 'meal_voucher', price: 25900, orig: 39000, rest: '포르노 로마노', addr: '서울 마포구 동교로', img: 'https://picsum.photos/seed/urdeal2/600/600', q: '화덕피자', pq: '화덕피자', spots: 3, seed: 10, desc: '400℃ 화덕에서 구운 나폴리식 피자 1판 + 수제 파스타 1개, 2인 세트. 방문 시 이용권 QR 제시.' },
  { name: '[성수] 스페셜티 핸드드립 2인 + 디저트', cat: 'meal_voucher', price: 12900, orig: 21000, rest: '성수 로스터스', addr: '서울 성동구 연무장길', img: 'https://picsum.photos/seed/urdeal3/600/600', q: '핸드드립 커피', pq: '카페', spots: 10, seed: 47, desc: '스페셜티 원두 핸드드립 2잔 + 오늘의 디저트 1개. 원두는 매주 로스팅분만 사용합니다.' },
  { name: '두피 스케일링 + 헤어 클리닉', cat: 'beauty_voucher', price: 39000, orig: 80000, rest: '살롱 드 모드', addr: '서울 강남구 압구정로', img: 'https://picsum.photos/seed/urdeal4/600/600', q: '헤어살롱 매장 인테리어', pq: '헤어살롱', spots: 5, seed: 22, desc: '두피 진단 → 스케일링 → 영양 클리닉 풀코스(약 60분). 방문 전 전화 예약을 권장합니다.' },
  { name: '왁싱 전신 패키지', cat: 'beauty_voucher', price: 49000, orig: 90000, rest: '스무스 왁싱 라운지', addr: '서울 서초구 강남대로', img: 'https://picsum.photos/seed/urdeal5/600/600', q: '왁싱 뷰티샵 매장', pq: '왁싱샵', spots: 8, seed: 35, desc: '전신 왁싱 패키지 — 1회용 위생 재료만 사용합니다. 100% 예약제, 이용권 구매 후 전화 예약.' },
  { name: '속눈썹 연장 풀세트 + 리터치', cat: 'beauty_voucher', price: 29000, orig: 55000, rest: '아이래쉬 스튜디오', addr: '서울 마포구 양화로', img: 'https://picsum.photos/seed/urdeal6/600/600', q: '속눈썹 연장 시술', pq: '속눈썹', spots: 3, seed: 14, desc: '속눈썹 연장 풀세트 + 2주 내 리터치 1회 포함. 시술 약 90분, 예약 후 방문해주세요.' },
  { name: '반려견 종합 미용 (목욕+커트)', cat: 'etc_voucher', price: 35000, orig: 60000, rest: '댕댕살롱', addr: '서울 송파구 올림픽로', img: 'https://picsum.photos/seed/urdeal7/600/600', q: '강아지 미용', pq: '애견미용', spots: 6, seed: 28, desc: '목욕 + 전체 커트 종합 미용(소형견 기준). 중·대형견은 매장으로 문의해주세요.' },
  { name: '실내 클라이밍 1일 체험 + 강습', cat: 'etc_voucher', price: 19000, orig: 35000, rest: '더 클라임', addr: '서울 광진구 아차산로', img: 'https://picsum.photos/seed/urdeal8/600/600', q: '실내 클라이밍', pq: '클라이밍', spots: 4, seed: 19, desc: '실내 클라이밍 1일 이용권 + 초보 강습 30분 + 암벽화·초크 대여 포함. 운동복만 챙겨오세요.' },
  // ❌ 2026-07-02 (대표 "왜 이런 서비스가 데모에?"): general(배송형) 데모 2종(원두 드립백/한라봉) 제거.
  //   배경: 06-17 동네딜 리스트에 general 카테고리 서버 지원이 추가되며 06-30 데모 확장이 샘플을 넣었으나,
  //   ① 홈/동네딜 어디에도 '일반' 칩이 없고 기본 피드 쿼리도 이용권 4종만이라 소비자 정상 접근 불가(유령),
  //   ② 상세가 쇼핑 UI(/products, 장바구니·배송)로 열리는데 쇼핑탭은 잠정 숨김 — "동네딜=우리 동네 매장"
  //   멘탈모델만 흐림. 동네딜 데모 = 로컬 이용권만. (기존 시드분은 아래 heal 패스가 자동 은퇴.)
  // ⚠️ 2026-07-05: 이 배열은 **레거시 desc-heal 매칭 전용**으로만 유지 — 시드는 아래 생성형
  //   DEMO_BIZ(업종 문법)로 전환(대표 "고정 템플릿 말고 랜덤으로 뽑아와야").
];

// 🎲 2026-07-05 (대표 "40종 고정이 아니라 랜덤으로 뽑아와야 — 뭐가 이상적?"): **생성형 데모 문법**.
//   방향 역전: 상품을 정해놓고 매장을 찾는 게 아니라, 카카오에서 그 업종 실매장을 **랜덤으로 뽑고**
//   그 매장에 맞는 오퍼(구성·가격·할인)를 조합 생성. 업종(28) × 패턴(2~3) × 가격밴드 × 할인 25~45%
//   × 실매장(지역별 수십 곳 랜덤) × 실사진(매장명 검색) = 사실상 무한 조합, 같은 상품 반복 소멸.
interface DemoOfferPattern { n: string; d: string; min: number; max: number }
interface DemoBiz { pq: string; cat: string; iq?: string; pat: DemoOfferPattern[] }
const DEMO_BIZ: DemoBiz[] = [
  { pq: '삼겹살', cat: 'meal_voucher', pat: [
    { n: '숙성 삼겹살 2인 세트 (된찌 포함)', d: '숙성 삼겹살 2인 + 된장찌개 + 볶음밥 마무리. 숯불에 구워드립니다.', min: 26000, max: 38000 },
    { n: '삼겹살 500g + 김치찌개', d: '두툼한 삼겹살 500g 과 김치찌개. 셀프바 반찬 무제한.', min: 22000, max: 32000 } ] },
  { pq: '한우', cat: 'meal_voucher', pat: [
    { n: '한우 모둠 2인 스페셜', d: '등심·살치·안심 모둠 2인. 직원이 부위별로 구워드립니다.', min: 69000, max: 98000 },
    { n: '한우 런치 정식 2인', d: '한우 불고기 정식 2인 런치 구성. 평일 점심 방문.', min: 32000, max: 45000 } ] },
  { pq: '스시', cat: 'meal_voucher', pat: [
    { n: '초밥 오마카세 런치 코스', d: '셰프 추천 니기리 12점 런치 오마카세. 카운터석 진행, 예약 우선.', min: 39000, max: 65000 },
    { n: '모둠초밥 2인 세트 (우동 포함)', d: '모둠초밥 2인 + 미니우동. 당일 손질 재료만 사용합니다.', min: 28000, max: 42000 } ] },
  { pq: '파스타', cat: 'meal_voucher', pat: [
    { n: '파스타 + 리조또 2인 세트', d: '파스타 1 + 리조또 1 + 샐러드. 소스는 매일 매장에서 만듭니다.', min: 24000, max: 36000 } ] },
  { pq: '화덕피자', cat: 'meal_voucher', pat: [
    { n: '화덕피자 + 파스타 2인 세트', d: '화덕에서 구운 피자 1판 + 파스타 1개. 방문 시 이용권 QR 제시.', min: 24000, max: 35000 } ] },
  { pq: '카페', cat: 'meal_voucher', iq: '카페 디저트', pat: [
    { n: '음료 2잔 + 시그니처 디저트', d: '음료 2잔과 시그니처 디저트 1개. 매장 좌석 이용 가능.', min: 11000, max: 17000 },
    { n: '핸드드립 2잔 + 오늘의 디저트', d: '스페셜티 핸드드립 2잔 + 오늘의 디저트. 원두 설명과 함께.', min: 12000, max: 19000 } ] },
  { pq: '브런치 카페', cat: 'meal_voucher', iq: '브런치 플레이트', pat: [
    { n: '주말 브런치 2인 세트', d: '브런치 플레이트 택2 + 아메리카노 2잔. 주말 방문 가능.', min: 24000, max: 36000 } ] },
  { pq: '쌀국수', cat: 'meal_voucher', pat: [
    { n: '쌀국수 + 분짜 2인 세트', d: '양지 쌀국수 2 + 분짜 1. 육수는 매일 아침 우려냅니다.', min: 17000, max: 26000 } ] },
  { pq: '마라탕', cat: 'meal_voucher', pat: [
    { n: '마라탕 2인 + 꿔바로우', d: '재료 자유 선택 마라탕 2인 + 꿔바로우(중). 맵기 조절 가능.', min: 21000, max: 30000 } ] },
  { pq: '돈까스', cat: 'meal_voucher', pat: [
    { n: '수제 돈까스 정식 2인', d: '저온숙성 등심 돈까스 정식 2인. 매일 아침 빵가루를 입힙니다.', min: 18000, max: 27000 } ] },
  { pq: '족발', cat: 'meal_voucher', pat: [
    { n: '족발 中 + 막국수 세트', d: '쫄깃한 앞다리 족발(中) + 비빔막국수. 포장도 가능.', min: 29000, max: 41000 } ] },
  { pq: '치킨', cat: 'meal_voucher', pat: [
    { n: '치킨 + 생맥주 2잔 세트', d: '반반 치킨 + 생맥주 500cc 2잔. 매장 취식 전용.', min: 17000, max: 25000 } ] },
  { pq: '국밥', cat: 'meal_voucher', pat: [
    { n: '국밥 2인 + 수육 小', d: '진한 국밥 2그릇 + 수육 한 접시. 매일 직접 끓입니다.', min: 19000, max: 28000 } ] },
  { pq: '곱창', cat: 'meal_voucher', pat: [
    { n: '곱창 모둠 2인 + 볶음밥', d: '곱창·대창 모둠 2인 + 마무리 볶음밥. 당일 손질 국내산.', min: 34000, max: 49000 } ] },
  { pq: '베이커리', cat: 'meal_voucher', iq: '베이커리 빵', pat: [
    { n: '베이커리 인기빵 6종 박스', d: '당일 구운 인기 빵 6종. 매장에서 직접 골라 담으세요.', min: 13000, max: 19000 } ] },
  { pq: '샤브샤브', cat: 'meal_voucher', pat: [
    { n: '샤브샤브 2인 (야채바 포함)', d: '소고기 샤브샤브 2인 + 야채바. 마무리 죽 포함.', min: 30000, max: 44000 } ] },
  { pq: '미용실', cat: 'beauty_voucher', iq: '미용실 인테리어', pat: [
    { n: '프리미엄 커트 + 두피 샴푸', d: '1:1 맞춤 컨설팅 커트 + 두피 마사지 샴푸. 디자이너 지명 가능.', min: 20000, max: 35000 },
    { n: '뿌리염색 + 손상모 클리닉', d: '뿌리염색 + 클리닉 패키지. 저자극 염모제 사용, 예약 우선.', min: 39000, max: 65000 } ] },
  { pq: '네일샵', cat: 'beauty_voucher', iq: '젤네일 아트', pat: [
    { n: '젤네일 풀케어 + 이달의 아트', d: '젤네일 풀케어와 이달의 아트. 큐티클 정리·영양 마무리 포함.', min: 29000, max: 48000 } ] },
  { pq: '속눈썹', cat: 'beauty_voucher', iq: '속눈썹 연장', pat: [
    { n: '속눈썹 연장 풀세트 + 리터치', d: '풀세트 연장 + 2주 내 리터치 1회. 시술 약 90분, 예약제.', min: 25000, max: 45000 } ] },
  { pq: '왁싱샵', cat: 'beauty_voucher', iq: '왁싱샵 인테리어', pat: [
    { n: '브라질리언 왁싱 1회', d: '1회용 위생 재료만 사용. 100% 예약제, 개인 룸 진행.', min: 29000, max: 45000 },
    { n: '전신 왁싱 패키지', d: '전신 왁싱 풀 패키지. 마무리 진정 관리 포함, 예약제.', min: 45000, max: 75000 } ] },
  { pq: '피부관리', cat: 'beauty_voucher', iq: '피부관리 에스테틱', pat: [
    { n: '진정 광채 관리 1회 (60분)', d: '클렌징 → 진정 앰플 → 광채 마스크 풀코스. 민감성도 가능.', min: 33000, max: 59000 } ] },
  { pq: '마사지', cat: 'beauty_voucher', iq: '마사지샵', pat: [
    { n: '아로마 전신 마사지 60분', d: '아로마 오일 전신 관리 60분. 개인 룸, 100% 예약제.', min: 42000, max: 69000 } ] },
  { pq: '애견미용', cat: 'etc_voucher', iq: '강아지 미용', pat: [
    { n: '반려견 종합 미용 (목욕+커트)', d: '목욕 + 전체 커트(소형견 기준). 중·대형견은 매장 문의.', min: 30000, max: 48000 } ] },
  { pq: '클라이밍', cat: 'etc_voucher', iq: '실내 클라이밍', pat: [
    { n: '클라이밍 1일권 + 초보 강습', d: '1일 이용권 + 강습 30분 + 암벽화·초크 대여 포함.', min: 16000, max: 25000 } ] },
  { pq: '필라테스', cat: 'etc_voucher', iq: '기구 필라테스', pat: [
    { n: '기구 필라테스 체험 2회', d: '리포머 기구 체험 2회. 소수정원 강사 밀착 지도.', min: 25000, max: 42000 } ] },
  { pq: '헬스장', cat: 'etc_voucher', iq: '헬스장 PT', pat: [
    { n: 'PT 체험 2회 + 인바디', d: '1:1 PT 2회 + 인바디 측정·식단 상담. 초보 환영.', min: 29000, max: 49000 } ] },
  { pq: '요가원', cat: 'etc_voucher', iq: '요가 수업', pat: [
    { n: '요가 3회 체험권', d: '하타·빈야사 자유 수강 3회. 매트 무료 대여.', min: 24000, max: 39000 } ] },
  { pq: '방탈출', cat: 'etc_voucher', iq: '방탈출 카페', pat: [
    { n: '방탈출 2인 이용권', d: '테마 자유 선택 2인. 난이도별 테마 보유, 예약 후 방문.', min: 20000, max: 32000 } ] },
  { pq: '사진관', cat: 'etc_voucher', iq: '프로필 사진 스튜디오', pat: [
    { n: '프로필 촬영 + 보정 2컷', d: '개인 프로필 30분 촬영 + 고급 보정 2컷. 의상 1벌 교체 가능.', min: 39000, max: 69000 } ] },
  { pq: '셀프사진관', cat: 'etc_voucher', iq: '셀프사진관 부스', pat: [
    { n: '셀프사진 2인 (소품 무제한)', d: '부스 촬영 + 인화 2매 + 소품 무제한. 데이트 코스로 인기.', min: 10000, max: 16000 } ] },
  { pq: '볼링장', cat: 'etc_voucher', iq: '볼링장', pat: [
    { n: '볼링 2게임 + 대여화 (2인)', d: '2인 2게임 + 볼링화 대여 포함. 주말 저녁도 사용 가능.', min: 15000, max: 24000 } ] },
  { pq: '스크린골프', cat: 'etc_voucher', iq: '스크린골프', pat: [
    { n: '스크린골프 2시간 (2인)', d: '룸 2시간 + 음료 2잔. 초보 레슨 모드 지원.', min: 26000, max: 42000 } ] },
  { pq: '만화카페', cat: 'etc_voucher', iq: '만화카페 내부', pat: [
    { n: '만화카페 4시간 + 음료 2잔', d: '프라이빗 룸 4시간 + 음료 2잔. 신간 매주 입고.', min: 12000, max: 19000 } ] },
  { pq: '도자기공방', cat: 'etc_voucher', iq: '도자기 공방 클래스', pat: [
    { n: '도자기 원데이 클래스 2인', d: '물레 체험 + 소품 1개 제작. 완성품은 2주 후 수령.', min: 34000, max: 55000 } ] },
];
// 미지정 지역 시드 시 검색 앵커를 서울 전역에 분산(로테이션 대신 랜덤 구).
const DEMO_GUS = ['강남구', '서초구', '송파구', '마포구', '성동구', '용산구', '영등포구', '광진구', '종로구', '중구', '강동구', '동작구', '관악구', '서대문구', '노원구'];
// 오퍼 랜덤 조합: 패턴 → 가격(밴드 내 100원 단위) → 할인 25~45% 역산 정가.
function buildDemoOffer(t: DemoBiz): { name: string; desc: string; price: number; orig: number; q: string } {
  const p = t.pat[Math.floor(Math.random() * t.pat.length)];
  const price = Math.round((p.min + Math.random() * (p.max - p.min)) / 100) * 100;
  const disc = 0.25 + Math.random() * 0.2;
  const orig = Math.round(price / (1 - disc) / 1000) * 1000;
  return { name: p.n, desc: p.d, price, orig, q: t.iq || t.pq };
}

// 🎯 2026-07-01 (대표 "데모 이용권도 매장 지도 매칭 제대로"): 데모 매장은 가공 이름 + 번지 없는 주소라
//   좌표/place_url 이 없음 → 카카오 키워드 검색으로 실제 매장의 좌표·주소·place_url 을 붙여 지도 매칭 정상화.
//   best-effort: 키 없거나 결과 없으면 null → 시딩은 그대로 진행(기존 폴백).
// 🎯 2026-07-03 (대표 "지역 정확도"): 지역명을 좌표(중심점)로 1회 해석 — 이후 매장검색을 이 좌표
//   반경으로 앵커링(문자열 이어붙이기보다 정확). 카카오 주소검색 우선, 실패 시 키워드검색 폴백.
async function resolveRegionCenter(
  env: { KAKAO_REST_API_KEY?: string },
  region: string,
): Promise<{ x: string; y: string } | null> {
  const key = env.KAKAO_REST_API_KEY;
  const q = (region || '').trim();
  if (!key || !q) return null;
  try {
    for (const url of [
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(q)}&size=1`,
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=1`,
    ]) {
      const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
      if (!res.ok) continue;
      const data = await res.json() as { documents?: Array<{ x?: string; y?: string }> };
      const doc = data?.documents?.[0];
      if (doc?.x && doc?.y) return { x: doc.x, y: doc.y };
    }
    return null;
  } catch { return null; }
}

async function kakaoPlaceLookup(
  env: { KAKAO_REST_API_KEY?: string },
  query: string,
  pickIndex = 0,  // 🎯 여러 실매장 중 로테이션 선택 / -1 = 완전 랜덤(랜덤 페이지 + 랜덤 후보)
  center?: { x: string; y: string } | null,  // 🎯 지역 중심좌표 — 있으면 반경 검색 + 거리순(정확도 ↑)
): Promise<{ name: string | null; address: string | null; lat: number | null; lng: number | null; placeUrl: string | null } | null> {
  const key = env.KAKAO_REST_API_KEY;
  if (!key || !query.trim()) return null;
  try {
    // size 넉넉히(15) → 실제 존재하는 매장 후보 확보 후 pickIndex 로 회전 선택(대표 "카카오맵에서 랜덤/필터로 매장 선정").
    //   center 지정 시 그 좌표 반경 20km 내를 거리순으로 → 지역 정확도 극대화(문자열 이어붙이기 대비).
    // 🎲 2026-07-05 (대표 "랜덤으로 뽑아와야"): pickIndex=-1 이면 페이지(1~3)·후보 모두 랜덤 —
    //   같은 업종을 여러 번 시드해도 매번 다른 실매장.
    const randomMode = pickIndex < 0;
    const page = randomMode ? 1 + Math.floor(Math.random() * 3) : 1;
    let url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query.trim())}&size=15&page=${page}`;
    if (center) url += `&x=${center.x}&y=${center.y}&radius=20000&sort=distance`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) return null;
    const data = await res.json() as { documents?: Array<{ place_name?: string; road_address_name?: string; address_name?: string; x?: string; y?: string; id?: string; place_url?: string }> };
    const docs = data?.documents || [];
    if (!docs.length) return null;
    const doc = randomMode ? docs[Math.floor(Math.random() * docs.length)] : docs[pickIndex % docs.length];
    if (!doc) return null;
    const lat = Number(doc.y), lng = Number(doc.x);
    return {
      name: doc.place_name || null,
      address: doc.road_address_name || doc.address_name || null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      placeUrl: doc.id ? `https://place.map.kakao.com/${doc.id}` : normalizeKakaoPlaceUrl(doc.place_url),
    };
  } catch { return null; }
}

// GET /dongnedeal/stats — 동네딜 상품 현황(전체/노출/데모/카테고리별)
adminProductsRoutes.get('/dongnedeal/stats', cors(), async (c) => {
  try {
    const cats = ['meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher', 'general'];
    const ph = cats.map(() => '?').join(',');
    const row = await c.env.DB.prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN COALESCE(is_active,1)=1 AND group_buy_status='active' THEN 1 ELSE 0 END) AS active FROM products WHERE category IN (${ph})`
    ).bind(...cats).first<{ total: number; active: number }>().catch(() => ({ total: 0, active: 0 }));
    const demo = await c.env.DB.prepare(`SELECT COUNT(*) AS c FROM products WHERE slug LIKE ?`).bind(DEAL_DEMO_SLUG + '%').first<{ c: number }>().catch(() => ({ c: 0 }));
    const byCat = await c.env.DB.prepare(
      `SELECT category, COUNT(*) AS c FROM products WHERE category IN (${ph}) AND COALESCE(is_active,1)=1 AND group_buy_status='active' GROUP BY category`
    ).bind(...cats).all<{ category: string; c: number }>().catch(() => ({ results: [] as { category: string; c: number }[] }));
    return c.json({ success: true, total: row?.total ?? 0, active: row?.active ?? 0, demo: demo?.c ?? 0, by_category: byCat.results ?? [] });
  } catch (err) {
    // 🛡️ 2026-06-25: 실패를 200(success:false)로 주면 클라가 "동네딜 0건"으로 오인 → 500 으로 명시.
    return c.json({ success: false, error: safeAdminError(err, c.env), total: 0, active: 0, demo: 0, by_category: [] }, 500);
  }
});

// 🎯 2026-07-03 (대표 "애초에 정확하게, 가장 이상적으로"): 검색된 실사진을 서버측에서 내려받아
//   우리 R2(MEDIA_BUCKET)에 **재호스팅** → 우리 도메인(/api/media/…) https 로 영구 서빙.
//   핫링크의 구조적 문제(인증서 불일치·혼합콘텐츠·핫링크차단·원본 404/삭제)를 원천 소멸 —
//   저장되는 건 항상 우리 URL 이라 렌더 시 cfImage(zone 리사이저)가 same-origin 으로 리사이즈.
//   이 함수가 URL 을 돌려주면 = "정상 이미지 확보"(검증+영구화 동시). 실패(키·네트워크·비이미지·과대/과소)
//   → null → 호출측이 좌표없음과 결합해 '유령 데모' 스킵 판정에 사용.
async function rehostImageToR2(env: { MEDIA_BUCKET?: R2Bucket }, srcUrl: string | null | undefined): Promise<string | null> {
  if (!srcUrl || !env.MEDIA_BUCKET || !/^https?:\/\//i.test(srcUrl)) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    let res: Response;
    try {
      res = await fetch(srcUrl, { signal: ctrl.signal });  // 인증서오류/DNS → throw → null
    } finally { clearTimeout(timer); }
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
    if (!ct.startsWith('image/')) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 500 || buf.byteLength > 6 * 1024 * 1024) return null; // 아이콘/깨짐 or 과대
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg';
    const yyyymm = new Date().toISOString().slice(0, 7);
    const rand = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const key = `uploads/demo/${yyyymm}/${rand}.${ext}`;
    await env.MEDIA_BUCKET.put(key, buf, {
      httpMetadata: { contentType: ct, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { source: 'dongnedeal-demo', at: new Date().toISOString() },
    });
    return `/api/media/${key}`;  // upload.routes 의 same-origin 서빙 규약과 동일(PUBLIC_R2_URL 무관하게 표시)
  } catch { return null; }
}

// POST /dongnedeal/seed-demo — 데모 동네딜 상품 시드 (멱등, slug 'demo-deal-N')
adminProductsRoutes.post('/dongnedeal/seed-demo', cors(), async (c) => {
  try {
    const { DB } = c.env;
    // 🎯 2026-07-02 (대표): 옵션 — region(특정 지역, 예 "영등포") / category(특정 카테고리)로 시드.
    const body = (await c.req.json().catch(() => ({}))) as { region?: string; category?: string };
    const region = String(body.region || '').trim().slice(0, 30);
    const catFilter = mapDealCategory(String(body.category || '').trim());
    // 🎲 2026-07-05: 시드 소스 = 생성형 업종 문법(DEMO_BIZ). DEAL_DEMO 는 레거시 heal 매칭 전용.
    const types = catFilter ? DEMO_BIZ.filter((t) => t.cat === catFilter) : DEMO_BIZ;
    if (types.length === 0) return c.json({ success: false, error: '해당 카테고리 데모 업종이 없습니다' }, 400);

    // 🛡️ 2026-07-02 v2 (라이브 콘솔 증거로 방향 전환): v1 은 phinf/http 원본을 search.pstatic
    //   프록시로 감쌌으나 **그 프록시가 404**(imgnews·yt3 등 외부발 src 거부 — 콘솔 실측).
    //   v2 치유 = 프록시 래퍼로 오염된 행을 **원본으로 un-wrap**. 원본 http/phinf 는 렌더 시점
    //   cfImage(zone 리사이저, CDN_CGI_VERIFIED 실측 ok)가 처리하므로 DB 는 원본이 정답.
    let healed = 0;
    try {
      const { needsNaverImageHeal, toNaverSafeImageUrl } = await import('../../../shared/naver-safe-image');
      const broken = await DB.prepare(
        `SELECT id, image_url FROM products
          WHERE image_url LIKE 'https://search.pstatic.net/common/%'
          LIMIT 500`
      ).all<{ id: number; image_url: string }>().catch(() => ({ results: [] as { id: number; image_url: string }[] }));
      for (const rowB of (broken.results || [])) {
        if (!needsNaverImageHeal(rowB.image_url)) continue;
        const safe = toNaverSafeImageUrl(rowB.image_url);
        if (safe && safe !== rowB.image_url) {
          await DB.prepare('UPDATE products SET image_url = ? WHERE id = ?').bind(safe, rowB.id).run().catch(() => {});
          healed++;
        }
      }
    } catch { /* best-effort — 치유 실패해도 시드 진행 */ }

    // ❌ 2026-07-02: 과거 시드된 general(배송형) 데모 자동 은퇴 — 동네딜 데모는 로컬 이용권만.
    //   soft-retire(is_active=0 + slug 리네임)로 노출 제거·참조 보존. 시드 재실행 한 번이면 정리됨.
    try {
      await DB.prepare(
        `UPDATE products SET is_active = 0, slug = 'retired-' || slug || '-' || id, updated_at = datetime('now')
          WHERE slug LIKE ? AND category = 'general' AND is_active = 1`
      ).bind(DEAL_DEMO_SLUG + '%').run();
    } catch { /* best-effort */ }

    // 🛡️ 2026-07-02 (대표 "데모 문구가 유저에게 보이면 안 됨"): 기존 시드분의 "데모 동네딜 — …"
    //   설명을 실제 상품 설명(템플릿 desc)으로 일괄 교정. 매칭 = 지역 프리픽스 제거한 상품명.
    try {
      const oldDemo = await DB.prepare(
        `SELECT id, name FROM products WHERE slug LIKE ? AND description LIKE '데모%' LIMIT 300`
      ).bind(DEAL_DEMO_SLUG + '%').all<{ id: number; name: string }>().catch(() => ({ results: [] as { id: number; name: string }[] }));
      const stripRegion = (s: string) => String(s || '').replace(/^\[[^\]]+\]\s*/, '').trim();
      for (const rowD of (oldDemo.results || [])) {
        const tpl = DEAL_DEMO.find((d) => stripRegion(d.name) === stripRegion(rowD.name));
        const newDesc = tpl?.desc || stripRegion(rowD.name);  // 템플릿 미매칭이어도 최소한 "데모" 제거
        await DB.prepare('UPDATE products SET description = ? WHERE id = ?').bind(newDesc, rowD.id).run().catch(() => {});
      }
    } catch { /* best-effort */ }

    // 누적 추가 — 기존 slug(demo-deal-N)의 최대 N 다음 번호부터(UNIQUE 충돌 원천 제거).
    const slugRows = await DB.prepare(`SELECT slug FROM products WHERE slug LIKE ?`).bind(DEAL_DEMO_SLUG + '%')
      .all<{ slug: string }>().catch(() => ({ results: [] as { slug: string }[] }));
    let maxSuffix = 0;
    const suffixRe = new RegExp(`^${DEAL_DEMO_SLUG}(\\d+)$`);  // 상수와 동기(리터럴 하드코딩 X)
    for (const row of (slugRows.results || [])) {
      const m = suffixRe.exec(String(row.slug || ''));
      if (m) maxSuffix = Math.max(maxSuffix, Number(m[1]));
    }
    // 🔁 2026-07-04 (대표 "계속 생성" + "왜 개수가 제각각?"): count(1~24, 기본 8) 를 **정확히 채울 때까지**
    //   라운드 보충(최대 3라운드) — 실매장 미매칭/중복매장 스킵분을 다른 랜덤 매장으로 메꿈.
    //   그 지역 실매장 후보가 고갈될 때만 목표 미달(skipped 표기).
    const reqCount = Math.max(1, Math.min(24, Math.round(Number((body as { count?: unknown }).count)) || 8));
    const { fetchNaverImageUrl } = await import('../../../worker/utils/naver-image-search');
    // 🎯 실제 매장 매칭(카카오): region 을 중심좌표로 1회 해석 → 그 반경 내 거리순 검색(정확도 ↑).
    //   center 있으면 검색어는 순수 업종(pq)만(지역명은 좌표로 반영), 없으면 "지역 랜덤구 pq" 폴백.
    const regionCenter = region ? await resolveRegionCenter(c.env, region) : null;
    // 🎲 업종을 셔플해서 need 만큼 — 한 배치 안에서 업종이 최대한 안 겹치고, 부족하면 순환.
    const nextWork = (need: number): Array<{ t: DemoBiz }> => {
      const shuffled = [...types].sort(() => Math.random() - 0.5);
      const w: Array<{ t: DemoBiz }> = [];
      for (let i = 0; i < need; i++) w.push({ t: shuffled[i % shuffled.length] });
      return w;
    };
    // 🎯 2026-07-01 (대표 요청): 데모 딜을 추첨 응모(fcfs)로 — 정원 대비 지원수가 이미 넘치게(30/5, 10/3 …).
    //   삽입 후 last_row_id 로 product_supply_meta 에 fcfs 설정 기록 → 기존 fcfs UI 가 "선착순 {seed}/{spots}명" 표시.
    // 🎛️ 2026-07-04 (대표 "지원자 수 조절 + 각각 기간 설정 — 지금은 데모만"): 시드 옵션 —
    //   fcfsDays(마감 N일 후, 1~60, 기본 7) + applicantsMin/Max(표시 지원자 수 랜덤 범위, 미지정 시 템플릿값).
    //   개별 수정은 DealList 의 추첨 설정(PUT /api/admin/fcfs/:id)으로.
    const { setSupplyMeta } = await import('../../../worker/utils/product-supply-meta');
    const optB = body as { fcfsDays?: unknown; applicantsMin?: unknown; applicantsMax?: unknown };
    const fcfsDays = Math.max(1, Math.min(60, Math.round(Number(optB.fcfsDays)) || 7));
    const fcfsDeadline = new Date(Date.now() + fcfsDays * 24 * 60 * 60 * 1000).toISOString();
    const aMinRaw = Math.round(Number(optB.applicantsMin));
    const hasApplicantRange = Number.isFinite(aMinRaw) && aMinRaw > 0;
    const aMin = hasApplicantRange ? Math.min(aMinRaw, 5000) : 0;
    const aMax = hasApplicantRange ? Math.min(Math.max(Math.round(Number(optB.applicantsMax)) || aMin, aMin), 5000) : 0;
    const pickApplicants = (tplSeed: number) => hasApplicantRange ? aMin + Math.floor(Math.random() * (aMax - aMin + 1)) : tplSeed;
    let seeded = 0;
    let realPhotos = 0;
    let placed = 0;
    let skipped = 0;  // 🎯 좌표·실사진 둘 다 없어 생성하지 않은 데모 수
    // 🎯 2026-07-03 (대표 "데모 리뷰가 매장 특색에 안 맞음"): 시드된 데모의 매장특색 리뷰 생성 대상.
    const seededForReviews: Array<{ id: number; name: string; category: string; storeName: string | null; price: number }> = [];
    // 🔁 같은 호출 내 + **기존 시드분과도** 동일 매장 중복 생성 방지 — DB 의 기존 데모 매장을 선적재.
    const usedStores = new Set<string>();
    try {
      const prev = await DB.prepare(
        `SELECT restaurant_name, restaurant_address FROM products WHERE slug LIKE ?`
      ).bind(DEAL_DEMO_SLUG + '%').all<{ restaurant_name: string | null; restaurant_address: string | null }>();
      for (const r of (prev.results || [])) usedStores.add(`${r.restaurant_name || ''}|${r.restaurant_address || ''}`);
    } catch { /* best-effort */ }
    let slugCursor = maxSuffix;  // 누적 추가 — 기존 번호 다음부터, 실제 INSERT 시에만 증가(라운드 무관 충돌 0)
    for (let round = 0; round < 3 && seeded < reqCount; round++) {
      const work = nextWork(reqCount - seeded);
      // 🎲 1단계: 실매장 랜덤 매칭 먼저(랜덤 페이지·랜덤 후보) — region 미지정이면 서울 랜덤 구로 분산.
      const resolvedPlaces = await Promise.all(
        work.map((w) => kakaoPlaceLookup(
          c.env,
          regionCenter ? w.t.pq : `서울 ${DEMO_GUS[Math.floor(Math.random() * DEMO_GUS.length)]} ${w.t.pq}`,
          -1,  // 랜덤 모드
          regionCenter,
        ).catch(() => null))
      );
      // 🖼️ 2단계: **그 매장 이름으로** 실사진 검색(진짜 그 가게 사진 확률 ↑) → 실패 시 업종 일반 사진 폴백.
      const resolvedImgs = await Promise.all(
        work.map((w, i) => resolvedPlaces[i]?.name
          ? fetchNaverImageUrl(c.env, `${resolvedPlaces[i]!.name} ${w.t.pq}`, 0)
              .then((u) => u || fetchNaverImageUrl(c.env, w.t.iq || w.t.pq, Math.floor(Math.random() * 8)))
              .catch(() => null)
          : Promise.resolve(null))
      );
      // 🎯 2026-07-03: 검색된 실사진을 우리 R2 로 재호스팅 → 저장 URL 은 항상 우리 도메인(/api/media/…).
      const validImgs = await Promise.all(
        resolvedImgs.map((u) => rehostImageToR2(c.env as unknown as { MEDIA_BUCKET?: R2Bucket }, u)),
      );
      for (let i = 0; i < work.length && seeded < reqCount; i++) {
        const t = work[i].t;
        const realPhoto = validImgs[i];               // 검증 통과 실사진(없으면 null)
        if (realPhoto) realPhotos++;
        const place = resolvedPlaces[i];
        const hasCoord = place?.lat != null;
        if (hasCoord) placed++;
        // 🎯 2026-07-03 (대표 "데모는 실제 있는 매장이어야 해"): 카카오 실매장 매칭 실패 = 생성 안 함(스킵).
        if (!hasCoord) { skipped++; continue; }
        const storeKey = `${place?.name || ''}|${place?.address || ''}`;
        if (usedStores.has(storeKey)) { skipped++; continue; }  // 같은/이전 배치 매장 재사용 방지
        usedStores.add(storeKey);
        // 🎲 3단계: 그 매장에 맞는 오퍼 랜덤 조합(패턴×가격밴드×할인 25~45%).
        const offer = buildDemoOffer(t);
        const img = realPhoto || `https://picsum.photos/seed/urdeal-${t.pq}-${slugCursor + 1}/600/600`;
        const restName = place?.name || null;         // hasCoord 보장 → 항상 실매장명
        const restAddr = place?.address || null;
        // 🎯 상품명 지역 프리픽스 = 지정 region 우선, 없으면 실매장 주소의 구/시.
        const realRegion = region || (place?.address ? (place.address.match(/([가-힣]+구|[가-힣]+시)/)?.[1] || '') : '');
        const dispName = realRegion ? `[${realRegion}] ${offer.name}` : offer.name;
        const slug = DEAL_DEMO_SLUG + (++slugCursor);
        let res;
        try {
          res = await DB.prepare(
            `INSERT INTO products (name, description, price, original_price, image_url, category, product_type,
               is_active, group_buy_status, group_buy_target, stock, stock_quantity, restaurant_name, restaurant_address, restaurant_lat, restaurant_lng, slug, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'regular', 1, 'active', 0, 100, 100, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
          ).bind(dispName, offer.desc, offer.price, offer.orig, img, t.cat, restName, restAddr, place?.lat ?? null, place?.lng ?? null, slug).run();
        } catch {
          // 🛡️ restaurant_lat/lng 컬럼 미존재 환경 폴백 — 좌표 없이 시드(클라 지오코딩이 지도 보정).
          res = await DB.prepare(
            `INSERT INTO products (name, description, price, original_price, image_url, category, product_type,
               is_active, group_buy_status, group_buy_target, stock, stock_quantity, restaurant_name, restaurant_address, slug, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'regular', 1, 'active', 0, 100, 100, ?, ?, ?, datetime('now'), datetime('now'))`
          ).bind(dispName, offer.desc, offer.price, offer.orig, img, t.cat, restName, restAddr, slug).run();
        }
        seeded++;
        // 추첨 응모 설정 — 정원 3~8 랜덤, 표시 지원자 = 정원×3~6배(범위 지정 시 그 랜덤).
        const pid = Number((res as { meta?: { last_row_id?: number } })?.meta?.last_row_id ?? 0);
        if (pid > 0) {
          const spots = 3 + Math.floor(Math.random() * 6);
          await setSupplyMeta(DB, pid, {
            fcfs_enabled: '1',
            fcfs_spots: spots,
            fcfs_applied_seed: pickApplicants(spots * (3 + Math.floor(Math.random() * 4))),
            fcfs_deadline: fcfsDeadline,
          }).catch(() => {});
        }
        // 🎯 카카오 장소 페이지 URL(매장 지도 직접 연결) — 매칭 성공 시만.
        if (pid > 0 && place?.placeUrl) {
          await setSupplyMeta(DB, pid, { kakao_place_url: place.placeUrl }).catch(() => {});
        }
        // 🎯 매장특색 리뷰 생성 대상(응답 후 waitUntil 로 채움 — 실매장명/업종 grounding).
        if (pid > 0) seededForReviews.push({ id: pid, name: dispName, category: t.cat, storeName: restName, price: offer.price });
      }
    }
    await writeAuditLog(c, { action: 'dongnedeal_seed_demo', targetType: 'product', after: { seeded, realPhotos, placed, skipped, healed, region: region || null, category: catFilter || null } }).catch(() => {});
    await invalidateGroupBuyProductsCache((c.env as Env).SESSION_KV as unknown as Parameters<typeof invalidateGroupBuyProductsCache>[0]).catch(() => {}); // 홈/동네딜 즉시 반영
    await import('../../../worker/utils/group-buy-feed-invalidate').then((m) => m.invalidateGroupBuyFeed(c.env, new URL(c.req.url).origin, (p) => c.executionCtx?.waitUntil?.(p))).catch(() => {});
    // 🧭 2026-07-02 (대표 승인 "가장 이상적으로"): 좌표 없이 시드된 행(place 미매칭/폴백 INSERT)을
    //   응답 직후 즉시 지오코딩 — 일일 cron Pass A 를 그대로 1회 실행(waitUntil, fail-soft).
    //   당일 좌표 공백 → 방문자마다 클라 지오코딩 폴백 발동하던 갭 원천 제거.
    try {
      c.executionCtx.waitUntil(
        import('../../../worker/cron/restaurant-geocode').then(m =>
          m.runRestaurantGeocode(c.env as { DB: D1Database; KAKAO_REST_API_KEY?: string })
        ).catch(() => {})
      );
    } catch { /* executionCtx 미가용 — 일일 cron 이 자연 처리 */ }
    // 🎯 2026-07-03 (대표 "데모 리뷰 매장 특색에 맞게, 가장 이상적으로"): 시드된 데모에 매장특색 리뷰 생성
    //   (Claude Haiku grounding: 오프라인 이용권·실매장명·업종 → 배송어 없이 자연스럽게. 키/실패 시 업종별 결정론 폴백).
    //   응답 후 waitUntil(외부 LLM 호출이라 응답 블록 방지) — review_count>0 채워 시간당 generic cron 이 안 건드림.
    if (seededForReviews.length > 0) {
      try {
        c.executionCtx.waitUntil(
          import('../../../worker/utils/demo-review-generator').then((m) =>
            // 🎭 상품별 리뷰 수도 6~12 랜덤 — 전 상품 동일 개수(8)면 그 자체가 조작 티.
            Promise.all(seededForReviews.map((prod) => m.seedDemoReviews(c.env as unknown as Env, prod, 6 + Math.floor(Math.random() * 7)).catch(() => 0)))
          ).then(() =>
            invalidateGroupBuyProductsCache((c.env as Env).SESSION_KV as unknown as Parameters<typeof invalidateGroupBuyProductsCache>[0]).catch(() => {})
          ).catch(() => {})
        );
      } catch { /* executionCtx 미가용 — 시간당 cron 이 폴백 처리 */ }
    }
    return c.json({ success: true, seeded, realPhotos, placed, skipped, healed, region: region || null, category: catFilter || null });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// DELETE /dongnedeal/seed-demo — 데모 동네딜 상품 일괄 삭제
adminProductsRoutes.delete('/dongnedeal/seed-demo', cors(), async (c) => {
  try {
    // 추첨(fcfs) 메타·지원 기록도 함께 정리(고아 방지) — best-effort.
    await c.env.DB.prepare(
      `DELETE FROM product_supply_meta WHERE product_id IN (SELECT id FROM products WHERE slug LIKE ?)`
    ).bind(DEAL_DEMO_SLUG + '%').run().catch(() => {});
    await c.env.DB.prepare(
      `DELETE FROM fcfs_applications WHERE product_id IN (SELECT id FROM products WHERE slug LIKE ?)`
    ).bind(DEAL_DEMO_SLUG + '%').run().catch(() => {});
    // 🎯 2026-07-03 (대표 신고 — 삭제해도 '숨김'으로 남음): 자동시드 fake 리뷰·장바구니·위시가 FK 로 하드삭제를
    //   막아 soft-retire 로만 남던 것 → 파생 자식행 선정리(데모 전용이라 안전) → 실제 하드삭제.
    for (const t of ['product_reviews', 'cart_items', 'wishlists']) {
      await c.env.DB.prepare(
        `DELETE FROM ${t} WHERE product_id IN (SELECT id FROM products WHERE slug LIKE ?)`
      ).bind(DEAL_DEMO_SLUG + '%').run().catch(() => {});
    }
    // 🛡️ 2026-07-01 (대표 신고 "데모 정리 안됨" — 500): 일괄 DELETE 는 데모에 주문/바우처 등
    //   FK 참조가 하나라도 붙으면 전체가 실패(500). → 행별 삭제 + 실패 행은 soft-retire
    //   (is_active=0 + slug 를 retired- 로 리네임 → 노출/데모 카운트에서 제외, 참조 데이터 보존).
    const demoRows = await c.env.DB.prepare(`SELECT id, slug FROM products WHERE slug LIKE ?`)
      .bind(DEAL_DEMO_SLUG + '%').all<{ id: number; slug: string }>().catch(() => ({ results: [] as { id: number; slug: string }[] }));
    let deleted = 0, retired = 0;
    for (const row of (demoRows.results || [])) {
      try {
        const del = await c.env.DB.prepare(`DELETE FROM products WHERE id = ?`).bind(row.id).run();
        if (del.meta?.changes) { deleted++; continue; }
      } catch { /* FK 참조 → soft-retire 폴백 */ }
      await c.env.DB.prepare(
        `UPDATE products SET is_active = 0, slug = 'retired-' || slug || '-' || id, updated_at = datetime('now') WHERE id = ?`
      ).bind(row.id).run().catch(() => {});
      retired++;
    }
    await writeAuditLog(c, { action: 'dongnedeal_clear_demo', targetType: 'product', after: { deleted, retired } }).catch(() => {});
    await invalidateGroupBuyProductsCache((c.env as Env).SESSION_KV as unknown as Parameters<typeof invalidateGroupBuyProductsCache>[0]).catch(() => {}); // 홈/동네딜 즉시 반영
    await import('../../../worker/utils/group-buy-feed-invalidate').then((m) => m.invalidateGroupBuyFeed(c.env, new URL(c.req.url).origin, (p) => c.executionCtx?.waitUntil?.(p))).catch(() => {});
    return c.json({ success: true, deleted, retired });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// POST /dongnedeal/bulk-import — CSV 동네딜 상품 일괄 등록 (즉시 노출). 행 단위 검증 + 리포트.
adminProductsRoutes.post('/dongnedeal/bulk-import', cors(), async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as { csv?: string };
    const csv = String(body.csv || '');
    if (!csv.trim()) return c.json({ success: false, error: 'CSV 내용이 비어 있습니다' }, 400);
    const rows = parseDealCsv(csv);
    if (!rows.length) return c.json({ success: false, error: '데이터 행이 없습니다 (헤더만 있거나 빈 CSV)' }, 400);

    const results: { row: number; name?: string; status: 'ok' | 'error'; reason?: string }[] = [];
    let created = 0;
    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const rowNum = idx + 2; // 헤더가 1행
      const name = (r['상품명'] || r['name'] || '').trim();
      const price = Math.round(Number((r['판매가'] || r['가격'] || r['price'] || '').replace(/[^\d.-]/g, '')));
      const catRaw = (r['카테고리'] || r['category'] || '').trim();
      const cat = mapDealCategory(catRaw);
      if (!name) { results.push({ row: rowNum, status: 'error', reason: '상품명 누락' }); continue; }
      if (!Number.isFinite(price) || price <= 0) { results.push({ row: rowNum, name, status: 'error', reason: '판매가가 올바르지 않습니다' }); continue; }
      if (!cat) { results.push({ row: rowNum, name, status: 'error', reason: `카테고리 인식 불가 (${catRaw || '빈값'}) — 이용권/미용/기타/숙소 중 하나` }); continue; }
      if (cat === 'stay_voucher') { results.push({ row: rowNum, name, status: 'error', reason: '숙소는 이 도구로 등록 불가 (숙소 전용 등록을 사용하세요)' }); continue; }
      const orig = (r['정가'] || r['original_price'] || '').replace(/[^\d.-]/g, '');
      const origNum = orig ? Math.round(Number(orig)) : 0;
      const img = (r['이미지URL'] || r['이미지'] || r['image_url'] || '').trim() || null;
      const rest = (r['매장명'] || r['restaurant_name'] || '').trim() || null;
      const addr = (r['주소'] || r['address'] || '').trim() || null;
      const desc = (r['설명'] || r['description'] || '').trim() || name;
      try {
        await c.env.DB.prepare(
          `INSERT INTO products (name, description, price, original_price, image_url, category, product_type,
             is_active, group_buy_status, group_buy_target, stock, stock_quantity, restaurant_name, restaurant_address, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'regular', 1, 'active', 0, 100, 100, ?, ?, datetime('now'), datetime('now'))`
        ).bind(name, desc, price, origNum > price ? origNum : null, img, cat, rest, addr).run();
        created++;
        results.push({ row: rowNum, name, status: 'ok' });
      } catch (e) {
        results.push({ row: rowNum, name, status: 'error', reason: safeAdminError(e, c.env) });
      }
    }
    await writeAuditLog(c, { action: 'dongnedeal_bulk_import', targetType: 'product', after: { total: rows.length, created } }).catch(() => {});
    await invalidateGroupBuyProductsCache((c.env as Env).SESSION_KV as unknown as Parameters<typeof invalidateGroupBuyProductsCache>[0]).catch(() => {}); // 홈/동네딜 즉시 반영
    await import('../../../worker/utils/group-buy-feed-invalidate').then((m) => m.invalidateGroupBuyFeed(c.env, new URL(c.req.url).origin, (p) => c.executionCtx?.waitUntil?.(p))).catch(() => {});
    // 🧭 2026-07-02: CSV 등록은 좌표 없이 INSERT — 응답 직후 cron Pass A 1회 즉시 실행(waitUntil,
    //   fail-soft, batch ≤100/회)로 좌표+동 태깅 채움 → 당일 클라 지오코딩 폴백 갭 원천 제거.
    try {
      c.executionCtx.waitUntil(
        import('../../../worker/cron/restaurant-geocode').then(m =>
          m.runRestaurantGeocode(c.env as { DB: D1Database; KAKAO_REST_API_KEY?: string })
        ).catch(() => {})
      );
    } catch { /* executionCtx 미가용 — 일일 cron 이 자연 처리 */ }
    return c.json({ success: true, summary: { total: rows.length, created, failed: rows.length - created }, results });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// POST /dongnedeal/create — 수기 단건 등록(좌표/전화 포함, 즉시 노출).
//   🗺️ 카카오 매장 검색으로 좌표(lat/lng) 확보 시 저장 → 지도에 바로 마커 표시.
//   좌표 없이 주소만 넣어도 OK — 지도 진입 시 클라 지오코딩 + 매일 04:00 cron 이 백필.
adminProductsRoutes.post('/dongnedeal/create', cors(), async (c) => {
  try {
    const b = (await c.req.json().catch(() => ({}))) as {
      name?: string; category?: string; price?: number | string; original_price?: number | string;
      image_url?: string; restaurant_name?: string; restaurant_address?: string;
      restaurant_phone?: string; lat?: number | string; lng?: number | string; description?: string;
      max_per_person?: number | string;
      kakao_place_url?: string;
      image_urls?: string[];  // 🖼️ 2026-07-02 (대표 "사진 여러 장"): 갤러리용 다중 이미지
    };
    const name = String(b.name || '').trim();
    const cat = mapDealCategory(String(b.category || '').trim());
    const price = Math.round(Number(String(b.price ?? '').replace(/[^\d.-]/g, '')));
    if (!name) return c.json({ success: false, error: '상품명을 입력하세요' }, 400);
    if (!Number.isFinite(price) || price <= 0) return c.json({ success: false, error: '판매가가 올바르지 않습니다' }, 400);
    if (!cat) return c.json({ success: false, error: '카테고리를 선택하세요 (이용권/미용/기타)' }, 400);
    if (cat === 'stay_voucher') return c.json({ success: false, error: '숙소는 이 도구로 등록 불가 (숙소 전용 등록을 사용하세요)' }, 400);
    const origNum = Math.round(Number(String(b.original_price ?? '').replace(/[^\d.-]/g, ''))) || 0;
    const img = String(b.image_url || '').trim() || null;
    const rest = String(b.restaurant_name || '').trim() || null;
    const addr = String(b.restaurant_address || '').trim() || null;
    const phone = String(b.restaurant_phone || '').trim() || null;
    const desc = String(b.description || '').trim() || name;
    const lat = Number(b.lat); const lng = Number(b.lng);
    const hasCoord = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
    // 🖼️ 2026-07-02 (대표 "사진 여러 장"): 다중 이미지 → products.image_urls(JSON) — 상세 스와이프
    //   갤러리(image_url + image_urls 병합·중복제거)가 소비. 최대 8장·http(s) URL 만.
    const galleryJson = Array.isArray(b.image_urls)
      ? JSON.stringify(b.image_urls.filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 8))
      : null;
    // 갤러리 저장처 = detail_images (0004 마이그레이션 실존 컬럼 — 상세 스와이프 갤러리가 병합 소비.
    //   image_urls 는 products 에 없음 + 컬럼 예산제로 신설 금지 → 기존 컬럼 재사용이 정답.)
    const r = await c.env.DB.prepare(
      `INSERT INTO products (name, description, price, original_price, image_url, detail_images, category, product_type,
         is_active, group_buy_status, group_buy_target, stock, stock_quantity, restaurant_name, restaurant_address, restaurant_phone,
         restaurant_lat, restaurant_lng, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'regular', 1, 'active', 0, 100, 100, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(name, desc, price, origNum > price ? origNum : null, img, galleryJson && galleryJson !== '[]' ? galleryJson : null, cat, rest, addr, phone,
      hasCoord ? lat : null, hasCoord ? lng : null).run();
    // 🎯 2026-07-01 (대표 "어드민 도구에도"): 1인당 한도 meta 저장 (1~99, 0/미설정=무제한).
    {
      const mpp = Number(b.max_per_person);
      if (r.meta?.last_row_id && Number.isFinite(mpp) && mpp >= 1 && mpp <= 99) {
        await setSupplyMeta(c.env.DB, Number(r.meta.last_row_id), { max_per_person: String(Math.floor(mpp)) }).catch(() => {});
      }
    }
    // 🎯 2026-07-01 (대표 "카카오맵 매장 페이지 연결"): 등록 시 캡처한 place_url meta 저장.
    {
      const kpu = normalizeKakaoPlaceUrl(b.kakao_place_url);
      if (r.meta?.last_row_id && kpu) {
        await setSupplyMeta(c.env.DB, Number(r.meta.last_row_id), { kakao_place_url: kpu }).catch(() => {});
      }
    }
    // 🧭 2026-07-02: 좌표 없이 등록 시 즉시 지오코딩(waitUntil, fail-soft) — cron 전 갭 제거.
    if (!hasCoord && addr && r.meta?.last_row_id) {
      try {
        c.executionCtx.waitUntil(
          import('../../../worker/cron/restaurant-geocode').then((m) =>
            m.geocodeProductNow(c.env as { DB: D1Database; KAKAO_REST_API_KEY?: string }, Number(r.meta.last_row_id))
          ).catch(() => {})
        );
      } catch { /* ctx 미가용 — cron 백필 */ }
    }
    await writeAuditLog(c, { action: 'dongnedeal_create', targetType: 'product', targetId: r.meta?.last_row_id, after: { name, cat, hasCoord } }).catch(() => {});
    // 🛡️ 2026-07-01 (대표 신고 — 어드민 수정이 홈에 즉시 반영 안 됨): 동네딜 뮤테이션 시 공구 목록
    //   앱 캐시(group_buy_products:*) 무효화. 셀러 상품 등록과 동일 패턴. (edge/SSR TTL 은 별도.)
    await invalidateGroupBuyProductsCache((c.env as Env).SESSION_KV as unknown as Parameters<typeof invalidateGroupBuyProductsCache>[0]).catch(() => {});
    await import('../../../worker/utils/group-buy-feed-invalidate').then((m) => m.invalidateGroupBuyFeed(c.env, new URL(c.req.url).origin, (p) => c.executionCtx?.waitUntil?.(p))).catch(() => {});
    return c.json({ success: true, id: r.meta?.last_row_id ?? null, hasCoord });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// GET /dongnedeal/list — 등록된 동네딜 목록(최근순). 수정/삭제 관리용.
adminProductsRoutes.get('/dongnedeal/list', cors(), async (c) => {
  try {
    const cats = ['meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher', 'general'];
    const ph = cats.map(() => '?').join(',');
    const limRaw = Number(c.req.query('limit'));
    const lim = Number.isFinite(limRaw) && limRaw > 0 && limRaw <= 200 ? Math.floor(limRaw) : 50;
    const { results } = await c.env.DB.prepare(
      `SELECT id, name, price, original_price, category, restaurant_name, restaurant_address, image_url,
              COALESCE(is_active,1) AS is_active, restaurant_lat, restaurant_lng, created_at
         FROM products WHERE category IN (${ph}) AND COALESCE(slug,'') NOT LIKE 'retired-%' ORDER BY created_at DESC LIMIT ?`
    ).bind(...cats, lim).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }));
    const rows = results || [];
    // 🎯 2026-07-01 (대표 "어드민 도구에도"): 1인당 한도(meta) 첨부 — 수정 폼 prefill 용 (0=무제한).
    try {
      const ids = rows.map(r => Number(r.id)).filter(n => Number.isFinite(n));
      if (ids.length) {
        const mm = await getSupplyMeta(c.env.DB, ids).catch(() => null);
        for (const r of rows) {
          const raw = mm?.get(Number(r.id))?.max_per_person;
          r.max_per_person = raw != null && Number.isFinite(Number(raw)) && Number(raw) > 0 ? Math.floor(Number(raw)) : 0;
          const kpu = mm?.get(Number(r.id))?.kakao_place_url;
          r.kakao_place_url = normalizeKakaoPlaceUrl(kpu);
        }
      }
    } catch { /* fail-soft */ }
    return c.json({ success: true, data: rows });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env), data: [] }, 500);
  }
});

// PATCH /dongnedeal/:id — 동네딜 단건 수정(이름/가격/사진/매장/좌표/노출). 부분 업데이트.
adminProductsRoutes.patch('/dongnedeal/:id', cors(), async (c) => {
  try {
    const id = c.req.param('id');
    if (!/^\d+$/.test(String(id))) return c.json({ success: false, error: 'bad id' }, 400);
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const sets: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];
    const put = (col: string, val: unknown) => { sets.push(`${col} = ?`); params.push(val); };
    if (typeof b.name === 'string' && b.name.trim()) put('name', b.name.trim());
    if (b.price !== undefined) { const n = Math.round(Number(String(b.price).replace(/[^\d.-]/g, ''))); if (Number.isFinite(n) && n > 0) put('price', n); }
    if (b.original_price !== undefined) { const n = Math.round(Number(String(b.original_price).replace(/[^\d.-]/g, ''))) || 0; put('original_price', n > 0 ? n : null); }
    if (b.image_url !== undefined) put('image_url', String(b.image_url || '').trim() || null);
    // 🖼️ 2026-07-02 (대표 "사진 여러 장"): 갤러리 다중 이미지 수정 — 빈 배열=해제(null).
    if (b.image_urls !== undefined) {
      const arr = Array.isArray(b.image_urls)
        ? (b.image_urls as unknown[]).filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 8)
        : [];
      put('detail_images', arr.length > 0 ? JSON.stringify(arr) : null);  // 실존 컬럼(0004) — image_urls 는 products 에 없음
    }
    if (b.restaurant_name !== undefined) put('restaurant_name', String(b.restaurant_name || '').trim() || null);
    if (b.restaurant_address !== undefined) put('restaurant_address', String(b.restaurant_address || '').trim() || null);
    if (b.restaurant_phone !== undefined) put('restaurant_phone', String(b.restaurant_phone || '').trim() || null);
    if (b.description !== undefined) put('description', String(b.description || '').trim() || null);
    if (b.category !== undefined) { const cat = mapDealCategory(String(b.category || '')); if (cat && cat !== 'stay_voucher') put('category', cat); }
    if (b.is_active !== undefined) put('is_active', b.is_active ? 1 : 0);
    if (b.lat !== undefined && b.lng !== undefined) {
      const lat = Number(b.lat), lng = Number(b.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) { put('restaurant_lat', lat); put('restaurant_lng', lng); }
    }
    // 🎯 2026-07-01 (대표 "어드민 도구에도"): 1인당 한도는 products 컬럼이 아니라 meta — 이것만 바뀌어도 저장.
    let mppChanged = false;
    if (b.max_per_person !== undefined) {
      const mpp = Number(b.max_per_person);
      if (Number.isFinite(mpp) && mpp >= 0 && mpp <= 99) {
        await setSupplyMeta(c.env.DB, Number(id), { max_per_person: String(Math.floor(mpp)) }).catch(() => {});
        mppChanged = true;
      }
    }
    // 🎯 2026-07-01 (대표 "카카오맵 매장 페이지 연결"): place_url meta 수정.
    if (b.kakao_place_url !== undefined) {
      const raw = String(b.kakao_place_url || '').trim();
      const kpu = raw === '' ? '' : normalizeKakaoPlaceUrl(raw);  // 빈값=해제, 유효=저장
      if (raw === '' || kpu) {
        await setSupplyMeta(c.env.DB, Number(id), { kakao_place_url: kpu || '' }).catch(() => {});
        mppChanged = true;
      }
    }
    if (params.length === 0 && !mppChanged) return c.json({ success: false, error: '변경할 내용이 없습니다' }, 400);
    if (params.length > 0) {
      params.push(id);
      await c.env.DB.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();
    }
    await writeAuditLog(c, { action: 'dongnedeal_update', targetType: 'product', targetId: id }).catch(() => {});
    await invalidateGroupBuyProductsCache((c.env as Env).SESSION_KV as unknown as Parameters<typeof invalidateGroupBuyProductsCache>[0]).catch(() => {}); // 홈/동네딜 즉시 반영
    await import('../../../worker/utils/group-buy-feed-invalidate').then((m) => m.invalidateGroupBuyFeed(c.env, new URL(c.req.url).origin, (p) => c.executionCtx?.waitUntil?.(p))).catch(() => {});
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminProductsRoutes;
