/**
 * Seller Streams Live-Control Routes
 *
 * - PUT  /:id/product-display — 상품 표시 모드 변경
 * - POST /:id/change-product  — 실시간 상품 변경
 */

import { Hono } from 'hono';
import type { KVNamespace } from '@cloudflare/workers-types';
import { cacheInvalidate } from '@/worker/utils/cache';
import { getSellerIdFromToken } from './seller-streams-helpers';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  SESSION_KV?: KVNamespace;
};

export const sellerStreamsLiveRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * PUT /:id/product-display
 * 상품 표시 모드 변경
 */
sellerStreamsLiveRoutes.put('/:id/product-display', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401);

    const streamId = c.req.param('id');
    const { mode } = await c.req.json<{ mode: 'current_only' | 'all' }>();

    if (!mode || !['current_only', 'all'].includes(mode)) {
      return c.json({ success: false, error: "mode는 'current_only' 또는 'all'이어야 합니다" }, 400);
    }

    // 소유권 확인
    const stream = await c.env.DB.prepare(
      'SELECT id FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first();

    if (!stream) return c.json({ success: false, error: '스트림을 찾을 수 없습니다' }, 404);

    await c.env.DB.prepare(
      "UPDATE live_streams SET product_display_mode = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(mode, streamId).run();

    await cacheInvalidate(c.env.SESSION_KV, `stream:${streamId}`);

    return c.json({
      success: true,
      data: { mode },
      message: mode === 'all' ? '전체 상품이 표시됩니다' : '현재 상품만 표시됩니다'
    });
  } catch (error: unknown) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

/**
 * POST /:id/change-product
 * 실시간 상품 변경
 */
sellerStreamsLiveRoutes.post('/:id/change-product', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401);

    const streamId = c.req.param('id');
    const { productId } = await c.req.json<{ productId: number }>();

    const stream = await c.env.DB.prepare(
      'SELECT id FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first();

    if (!stream) return c.json({ success: false, error: '스트림을 찾을 수 없습니다' }, 404);

    // 🛡️ 2026-04-22: 연결할 상품이 본인 상품인지 검증 (다른 셀러 상품 도용 방지)
    if (productId) {
      const product = await c.env.DB.prepare(
        'SELECT seller_id FROM products WHERE id = ?'
      ).bind(productId).first<{ seller_id: number }>();
      if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
      if (product.seller_id !== sellerId) {
        return c.json({ success: false, error: '본인 상품만 연결 가능합니다' }, 403);
      }
    }

    await c.env.DB.prepare(
      "UPDATE live_streams SET current_product_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(productId ?? null, streamId).run();

    await cacheInvalidate(c.env.SESSION_KV, `stream:${streamId}`);

    return c.json({ success: true, message: '상품이 변경되었습니다' });
  } catch (error: unknown) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});
