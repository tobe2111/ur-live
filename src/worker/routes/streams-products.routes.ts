// ============================================================
// Streams Products Routes
// GET  /:id/products         — 스트림의 상품 목록
// GET  /:id/current-product  — 현재 방송 중 상품
// POST /:id/current-product  — 현재 방송 상품 변경 (판매자 인증 필요)
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { cacheInvalidate } from '../utils/cache';
import { logError } from '../utils/logger';

interface ProductRow {
  id: number;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  discount_rate: number | null;
  image_url: string | null;
  thumbnail_url: string | null;
  stock: number | null;
  stock_quantity: number | null;
  category: string | null;
  seller_id: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export const streamsProductsRouter = new Hono<{ Bindings: Env }>();

// ── GET /:id/products ─────────────────────────────────────────────────────────
streamsProductsRouter.get('/:id/products', async (c) => {
  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');

    // ✅ products 테이블에서 live_stream_id로 조회
    const rows = await db
      .prepare(`
        SELECT
          id, name, description, price, original_price, discount_rate,
          image_url, stock,
          category, seller_id, is_active, created_at, updated_at
        FROM products
        WHERE live_stream_id = ? AND is_active = 1
        ORDER BY created_at DESC
      `)
      .bind(streamId)
      .all();

    let products = rows.results || [];

    // ✅ live_stream_id로 연결된 상품이 없으면 current_product_id 상품을 fallback으로 반환
    if (products.length === 0) {
      const stream = await db
        .prepare('SELECT current_product_id FROM live_streams WHERE id = ?')
        .bind(streamId)
        .first<{ current_product_id: number | null }>();

      if (stream?.current_product_id) {
        const fallbackProduct = await db
          .prepare(`
            SELECT
              id, name, description, price, original_price, discount_rate,
              image_url, stock,
              category, seller_id, is_active, created_at, updated_at
            FROM products WHERE id = ?
          `)
          .bind(stream.current_product_id)
          .first<ProductRow>();

        if (fallbackProduct) {
          products = [fallbackProduct as unknown as Record<string, unknown>];
        }
      }
    }

    return c.json({
      success: true,
      data: products
    });
  } catch (err: unknown) {
    logError('streams.products.list.error', { error: (err as Error)?.message });
    return c.json({ success: false, error: 'Failed to fetch stream products' }, 500);
  }
});

// ── GET /:id/current-product ──────────────────────────────────────────────────
streamsProductsRouter.get('/:id/current-product', async (c) => {
  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');

    const stream = await db
      .prepare('SELECT current_product_id FROM live_streams WHERE id = ?')
      .bind(streamId)
      .first<{ current_product_id: number | null }>();

    if (!stream) {
      return c.json({ success: false, error: 'Stream not found' }, 404);
    }

    if (!stream.current_product_id) {
      return c.json({ success: true, data: null });
    }

    const product = await db
      .prepare('SELECT id, name, description, price, original_price, discount_rate, image_url, stock, category, live_stream_id, is_active, created_at, updated_at, seller_id, version, detail_images, sold_count, view_count, avg_rating, review_count FROM products WHERE id = ?')
      .bind(stream.current_product_id)
      .first();

    return c.json({ success: true, data: product });
  } catch (err: unknown) {
    logError('streams.products.currentProduct.error', { error: (err as Error)?.message });
    return c.json({ success: false, error: 'Failed to fetch current product' }, 500);
  }
});

// ── POST /:id/current-product ─────────────────────────────────────────────────
// 현재 방송 상품 변경 (판매자 JWT 필요)
streamsProductsRouter.post('/:id/current-product', async (c) => {
  try {
    const db = c.env.DB;
    const streamId = c.req.param('id');
    const { productId } = await c.req.json<{ productId: number }>();

    await db
      .prepare('UPDATE live_streams SET current_product_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(productId ?? null, streamId)
      .run();

    // Invalidate cached stream detail (list entries will expire naturally within TTL)
    await cacheInvalidate(c.env.SESSION_KV, `stream:${streamId}`);

    return c.json({ success: true, message: 'Current product updated' });
  } catch (err: unknown) {
    logError('streams.products.setCurrentProduct.error', { error: (err as Error)?.message });
    return c.json({ success: false, error: 'Failed to update current product' }, 500);
  }
});
