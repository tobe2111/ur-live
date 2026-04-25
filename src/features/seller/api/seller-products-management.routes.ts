/**
 * Seller Products Management API Routes
 *
 * Endpoints:
 * - GET    /api/seller/products                      - 셀러 상품 목록 조회
 * - POST   /api/seller/products                      - 셀러 상품 등록
 * - PUT    /api/seller/products/:id                  - 셀러 상품 수정
 * - DELETE /api/seller/products/:id                  - 셀러 상품 삭제
 * - POST   /api/seller/products/:id/link-to-stream   - 상품-스트림 연결
 * - PUT    /api/seller/products/:id/pin              - 바우처 인증 PIN 설정
 */

import { Hono } from 'hono';
import { verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';
import type { Env } from '@/worker/types/env';
import { logError } from '@/worker/utils/logger';

export const sellerProductsManagementRoutes = new Hono<{ Bindings: Env }>();

// ─── Auth helper ───────────────────────────────────────────────────────────

async function getSellerIdFromToken(authorization: string | undefined, jwtSecret: string): Promise<string | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) return null;
  try {
    const token = authorization.substring(7);
    const payload = await verify(token, jwtSecret, 'HS256') as JWTPayload & { seller_id?: number | string };
    return payload.seller_id ? String(payload.seller_id) : null;
  } catch {
    return null;
  }
}

// ─── GET /products ─────────────────────────────────────────────────────────

sellerProductsManagementRoutes.get('/products', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const db = c.env.DB;
    const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);
    const offset = parseInt(c.req.query('offset') || '0');
    const sort = c.req.query('sort') === 'asc' ? 'ASC' : 'DESC';
    const search = c.req.query('search') || '';

    // COALESCE로 신/구 컬럼 모두 대응 (image_url, thumbnail_url, image 순으로 fallback)
    let query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        COALESCE(p.stock_quantity, p.stock, 0)                    AS stock,
        COALESCE(p.thumbnail_url, p.image_url)                    AS image_url,
        COALESCE(p.status, 'ACTIVE')                              AS status,
        p.category,
        p.created_at,
        p.updated_at,
        COUNT(DISTINCT oi.id)                                      AS order_count,
        COALESCE(SUM(
          CASE WHEN o.status NOT IN ('CANCELLED', 'FAILED', 'REFUNDED')
               THEN oi.quantity ELSE 0 END
        ), 0)                                                      AS total_sold
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.seller_id = ?
        AND COALESCE(p.is_active, 1) = 1
        AND COALESCE(p.is_supply_product, 0) = 0
    `;
    const params: unknown[] = [sellerId];

    if (search) {
      query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY p.id ORDER BY p.created_at ${sort} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const products = await db.prepare(query).bind(...params).all();

    let countQuery = `SELECT COUNT(*) as total FROM products WHERE seller_id = ? AND COALESCE(is_active, 1) = 1`;
    const countParams: unknown[] = [sellerId];
    if (search) {
      countQuery += ` AND (name LIKE ? OR description LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }
    const countResult = await db.prepare(countQuery).bind(...countParams).first<{ total: number }>();

    return c.json({
      success: true,
      data: products.results || [],
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset,
        has_more: (countResult?.total || 0) > (offset + limit),
      },
    });
  } catch (error: unknown) {
    logError('seller.products.list.error', { error: (error as Error)?.message });
    return c.json({ success: false, error: (error as Error).message || 'Failed to get products' }, 500);
  }
});

// ─── POST /products ────────────────────────────────────────────────────────

sellerProductsManagementRoutes.post('/products', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const body = await c.req.json<{
      name: string;
      description?: string;
      price: number;
      stock?: number;
      image_url?: string;
      category?: string;
      live_stream_id?: number | null;
    }>();

    const { name, description, price, stock, image_url, category } = body;
    if (!name || price === undefined) {
      return c.json({ success: false, error: '상품명과 가격은 필수입니다.' }, 400);
    }

    // slug 생성: 이름 기반 + 타임스탬프 suffix (중복 방지)
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60) || 'product';
    const slug = `${baseSlug}-${Date.now()}`;

    const db = c.env.DB;

    // 스키마 버전에 따른 INSERT (신규 → 중간 → 최소 순으로 fallback)
    let result: D1Result;
    try {
      // 신규 스키마: slug, stock_quantity, thumbnail_url 존재
      result = await db.prepare(`
        INSERT INTO products
          (seller_id, name, slug, description, price, stock_quantity, thumbnail_url, image_url, category, product_type, status, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', 'ACTIVE', 1, datetime('now'), datetime('now'))
      `).bind(
        sellerId, name, slug, description || null, price,
        stock ?? 0, image_url || null, image_url || null, category || null
      ).run();
    } catch {
      try {
        // 프로덕션 스키마: stock, image_url, status 존재 (slug, stock_quantity 없음)
        result = await db.prepare(`
          INSERT INTO products
            (seller_id, name, description, price, stock, image_url, category, product_type, status, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'live', 'ACTIVE', 1, datetime('now'), datetime('now'))
        `).bind(
          sellerId, name, description || null, price,
          stock ?? 0, image_url || null, category || null
        ).run();
      } catch {
        // 최소 스키마: status 없는 경우
        result = await db.prepare(`
          INSERT INTO products
            (seller_id, name, description, price, stock, image_url, category, product_type, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'live', 1, datetime('now'), datetime('now'))
        `).bind(
          sellerId, name, description || null, price,
          stock ?? 0, image_url || null, category || null
        ).run();
      }
    }

    if (!result.success) throw new Error('Failed to create product');

    // 식사권/공동구매 필드 저장 (별도 UPDATE — INSERT fallback 구조 유지)
    const productId = result.meta.last_row_id;
    if (category === 'meal_voucher') {
      const mealFields = ['restaurant_name', 'restaurant_address', 'restaurant_phone', 'voucher_terms', 'voucher_expiry', 'group_buy_target', 'group_buy_deadline', 'store_verify_pin'] as const;
      for (const field of mealFields) {
        const val = (body as Record<string, unknown>)[field];
        if (val !== undefined && val !== null && val !== '') {
          try { await db.prepare(`UPDATE products SET ${field} = ? WHERE id = ?`).bind(val, productId).run() } catch { /* column may not exist */ }
        }
      }
    }

    const newProduct = await db.prepare(
      `SELECT id, seller_id, name, description, price,
              COALESCE(stock_quantity, stock, 0) AS stock,
              COALESCE(thumbnail_url, image_url) AS image_url,
              category, created_at, updated_at
       FROM products WHERE id = ?`
    ).bind(result.meta.last_row_id).first<Record<string, unknown>>();

    // 팔로워에게 새 상품 알림 (인앱 + 카카오)
    if (newProduct) {
      const { notifyFollowers, sendKakaoToFollowers } = await import('../../../lib/notifications');
      const productName = String((newProduct as Record<string, unknown>).name ?? '');
      const newProductId = String((newProduct as Record<string, unknown>).id ?? '');
      notifyFollowers(db, Number(sellerId), 'new_product', `🛍️ 새 상품 등록!`, productName, `/products/${newProductId}`).catch(() => {});
      sendKakaoToFollowers(db, Number(sellerId), `🛍️ 새 상품이 등록되었어요!`, productName, `/products/${newProductId}`, '상품 보기').catch(() => {});
    }

    return c.json({ success: true, data: newProduct }, 201);
  } catch (error: unknown) {
    logError('seller.products.create.error', { error: (error as Error)?.message });
    return c.json({ success: false, error: (error as Error).message || 'Failed to create product' }, 500);
  }
});

// ─── PUT /products/:id ─────────────────────────────────────────────────────

sellerProductsManagementRoutes.put('/products/:id', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const productId = c.req.param('id');
    const body = await c.req.json<{
      name?: string;
      description?: string;
      price?: number;
      original_price?: number;
      stock?: number;
      image_url?: string;
      category?: string;
      live_only_price?: number | null;
      live_price_enabled?: boolean;
      status?: string;
      is_active?: boolean | number;
    }>();

    const db = c.env.DB;

    // 소유권 확인
    const existing = await db.prepare(
      `SELECT id FROM products WHERE id = ? AND seller_id = ?`
    ).bind(productId, sellerId).first();
    if (!existing) return c.json({ success: false, error: 'Product not found or forbidden' }, 404);

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
    if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
    if (body.price !== undefined) { fields.push('price = ?'); values.push(body.price); }
    if (body.original_price !== undefined) { fields.push('original_price = ?'); values.push(body.original_price); }
    if (body.stock !== undefined) {
      fields.push('stock_quantity = ?', 'stock = ?');
      values.push(body.stock, body.stock);
    }
    if (body.image_url !== undefined) {
      fields.push('image_url = ?', 'thumbnail_url = ?');
      values.push(body.image_url, body.image_url);
    }
    if (body.category !== undefined) { fields.push('category = ?'); values.push(body.category); }
    if (body.live_only_price !== undefined) { fields.push('live_only_price = ?'); values.push(body.live_only_price); }
    if (body.live_price_enabled !== undefined) { fields.push('live_price_enabled = ?'); values.push(body.live_price_enabled ? 1 : 0); }
    if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
    if (body.is_active !== undefined) { fields.push('is_active = ?'); values.push(body.is_active ? 1 : 0); }

    if (fields.length === 0) return c.json({ success: false, error: '수정할 내용이 없습니다.' }, 400);

    fields.push(`updated_at = datetime('now')`);
    values.push(productId, sellerId);

    await db.prepare(
      `UPDATE products SET ${fields.join(', ')} WHERE id = ? AND seller_id = ?`
    ).bind(...values).run();

    const updated = await db.prepare(
      `SELECT id, name, description, price, original_price,
              COALESCE(stock_quantity, stock, 0) AS stock,
              COALESCE(thumbnail_url, image_url, image) AS image_url,
              category, live_only_price, live_price_enabled,
              COALESCE(status, 'ACTIVE') AS status, updated_at
       FROM products WHERE id = ?`
    ).bind(productId).first<Record<string, unknown>>();

    return c.json({ success: true, data: updated });
  } catch (error: unknown) {
    logError('seller.products.update.error', { error: (error as Error)?.message });
    return c.json({ success: false, error: (error as Error).message || 'Failed to update product' }, 500);
  }
});

// ─── DELETE /products/:id ──────────────────────────────────────────────────

sellerProductsManagementRoutes.delete('/products/:id', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const productId = c.req.param('id');
    const db = c.env.DB;

    // soft delete (status = DELETED)
    const result = await db.prepare(
      `UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND seller_id = ?`
    ).bind(productId, sellerId).run();

    if (!result.meta.changes) return c.json({ success: false, error: 'Product not found or forbidden' }, 404);

    return c.json({ success: true, message: '상품이 삭제되었습니다.' });
  } catch (error: unknown) {
    logError('seller.products.delete.error', { error: (error as Error)?.message });
    return c.json({ success: false, error: (error as Error).message || 'Failed to delete product' }, 500);
  }
});

// ─── POST /products/:id/link-to-stream ────────────────────────────────────
// body: { stream_id: number | null }  — null이면 연결 해제

sellerProductsManagementRoutes.post('/products/:id/link-to-stream', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const productId = c.req.param('id');
    const body = await c.req.json<{ stream_id: number | null }>();
    const streamId = body.stream_id ?? null;

    const db = c.env.DB;

    // 상품 소유권 확인
    const product = await db.prepare(
      `SELECT id FROM products WHERE id = ? AND seller_id = ?`
    ).bind(productId, sellerId).first();
    if (!product) return c.json({ success: false, error: 'Product not found or forbidden' }, 404);

    // 스트림 소유권 확인 (stream_id가 있는 경우)
    if (streamId !== null) {
      const stream = await db.prepare(
        `SELECT id FROM live_streams WHERE id = ? AND seller_id = ?`
      ).bind(streamId, sellerId).first();
      if (!stream) return c.json({ success: false, error: 'Stream not found or forbidden' }, 404);
    }

    await db.prepare(
      `UPDATE products SET live_stream_id = ?, updated_at = datetime('now') WHERE id = ? AND seller_id = ?`
    ).bind(streamId, productId, sellerId).run();

    return c.json({
      success: true,
      message: streamId ? `스트림 ${streamId}에 상품이 연결되었습니다.` : '스트림 연결이 해제되었습니다.',
    });
  } catch (error: unknown) {
    logError('seller.products.linkToStream.error', { error: (error as Error)?.message });
    return c.json({ success: false, error: (error as Error).message || 'Failed to link product' }, 500);
  }
});

// ─── PUT /products/:id/pin — 바우처 인증 PIN 설정 ─────────────────────────

sellerProductsManagementRoutes.put('/products/:id/pin', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: '로그인 필요' }, 401);

    const db = c.env.DB;
    const productId = c.req.param('id');
    const { pin } = await c.req.json<{ pin: string }>();

    if (!pin || pin.length < 4) return c.json({ success: false, error: 'PIN은 4자리 이상이어야 합니다' }, 400);

    // 소유권 확인
    const product = await db.prepare('SELECT id FROM products WHERE id = ? AND seller_id = ?').bind(productId, sellerId).first();
    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);

    // store_verify_pin 컬럼 존재 보장
    try { await db.prepare("ALTER TABLE products ADD COLUMN store_verify_pin TEXT").run() } catch {}

    await db.prepare("UPDATE products SET store_verify_pin = ?, updated_at = datetime('now') WHERE id = ?").bind(pin, productId).run();

    return c.json({ success: true, message: `PIN이 설정되었습니다: ${pin}` });
  } catch (error: unknown) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});
