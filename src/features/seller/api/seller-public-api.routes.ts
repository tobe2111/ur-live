/**
 * Seller Public API Routes (no auth required)
 *
 * - GET /public/:sellerId             — 공개 셀러 프로필 조회
 * - GET /:sellerId/products-public    — 공개 셀러 상품 목록
 * - GET /products/:id/options         — 셀러 상품 옵션 목록 (auth required)
 * - POST /products/:id/options        — 셀러 상품 옵션 추가/교체 (auth required)
 */

import { Hono } from 'hono';
import {
  type Bindings,
  type ProductIdRow,
  getSellerIdFromToken,
} from './seller-management-helpers';

export const sellerPublicApiRoutes = new Hono<{ Bindings: Bindings }>();

// ── GET /api/seller/public/:sellerId ─────────────────────────────────────────
// 공개 셀러 프로필 조회 (ID 또는 slug/username으로 조회, 인증 불필요)
sellerPublicApiRoutes.get('/public/:sellerId', async (c) => {
  const { DB } = c.env;
  const param = c.req.param('sellerId');

  try {
    // 숫자면 ID, 아니면 slug 또는 username으로 조회
    const isNumeric = /^\d+$/.test(param);
    const seller = isNumeric
      ? await DB.prepare(
          `SELECT id, username, slug, name, email, description, business_name, business_number, phone,
                  profile_image, bio, sns_instagram, sns_youtube, sns_facebook, sns_twitter,
                  website_url, kakao_chat_link, status, created_at
           FROM sellers WHERE id = ? AND status = 'approved'`
        ).bind(param).first()
      : await DB.prepare(
          `SELECT id, username, slug, name, email, description, business_name, business_number, phone,
                  profile_image, bio, sns_instagram, sns_youtube, sns_facebook, sns_twitter,
                  website_url, kakao_chat_link, status, created_at
           FROM sellers WHERE (slug = ? OR username = ?) AND status = 'approved'`
        ).bind(param, param).first();

    if (!seller) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404);
    return c.json({ success: true, data: seller });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /api/seller/:sellerId/products-public ─────────────────────────────────
// 공개 셀러 상품 목록 (SellerPublicPage.tsx에서 /api/seller/:sellerId/products-public 호출)
sellerPublicApiRoutes.get('/:sellerId/products-public', async (c) => {
  const { DB } = c.env;
  const sellerId = c.req.param('sellerId');
  const { page = '1', limit = '20' } = c.req.query();
  const pageNum = parseInt(page, 10);
  const limitNum = Math.min(parseInt(limit, 10), 100);
  const offset = (pageNum - 1) * limitNum;

  try {
    const [products, countRow] = await Promise.all([
      DB.prepare(
        `SELECT id, name, description, price, original_price, discount_rate,
                image_url, stock_quantity, category, seller_id, is_active, created_at
         FROM products WHERE seller_id = ? AND is_active = 1
         ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(sellerId, limitNum, offset).all(),
      DB.prepare(
        `SELECT COUNT(*) as total FROM products WHERE seller_id = ? AND is_active = 1`
      ).bind(sellerId).first<{ total: number }>(),
    ]);

    return c.json({
      success: true,
      data: products.results || [],
      pagination: { page: pageNum, limit: limitNum, total: countRow?.total ?? 0 },
    });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /api/seller/products/:id/options ─────────────────────────────────────
// 셀러 상품 옵션 목록 조회 (SellerProductEditPage.tsx에서 호출)
sellerPublicApiRoutes.get('/products/:id/options', async (c) => {
  const { DB } = c.env;
  const authorization = c.req.header('Authorization');
  const sellerId = await getSellerIdFromToken(authorization, c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const productId = Number(c.req.param('id'));
  if (isNaN(productId)) return c.json({ success: false, error: 'Invalid product ID' }, 400);

  try {
    // 판매자 소유 상품인지 확인
    const product = await DB.prepare(
      `SELECT id FROM products WHERE id = ? AND seller_id = ?`
    ).bind(productId, sellerId).first<ProductIdRow>();
    if (!product) return c.json({ success: false, error: 'Product not found' }, 404);

    const result = await DB.prepare(
      `SELECT id, product_id, option_type, option_value, price_adjustment, stock_quantity
       FROM product_options WHERE product_id = ? ORDER BY option_type, option_value`
    ).bind(productId).all();

    return c.json({ success: true, data: result.results || [] });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── POST /api/seller/products/:id/options ────────────────────────────────────
// 셀러 상품 옵션 추가/교체 (SellerProductEditPage.tsx, SellerProductNewPage.tsx에서 호출)
sellerPublicApiRoutes.post('/products/:id/options', async (c) => {
  const { DB } = c.env;
  const authorization = c.req.header('Authorization');
  const sellerId = await getSellerIdFromToken(authorization, c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const productId = Number(c.req.param('id'));
  if (isNaN(productId)) return c.json({ success: false, error: 'Invalid product ID' }, 400);

  try {
    // 판매자 소유 상품인지 확인
    const product = await DB.prepare(
      `SELECT id FROM products WHERE id = ? AND seller_id = ?`
    ).bind(productId, sellerId).first<ProductIdRow>();
    if (!product) return c.json({ success: false, error: 'Product not found' }, 404);

    const body = await c.req.json<{ options: Array<{ option_type: string; option_value: string; price_adjustment?: number; stock_quantity?: number }> }>();
    const options = body.options || [];

    // 기존 옵션 삭제 후 새 옵션 삽입 (upsert 방식)
    await DB.prepare(`DELETE FROM product_options WHERE product_id = ?`).bind(productId).run();

    for (const opt of options) {
      await DB.prepare(
        `INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock_quantity, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(productId, opt.option_type, opt.option_value, opt.price_adjustment ?? 0, opt.stock_quantity ?? 0).run();
    }

    const updated = await DB.prepare(
      `SELECT id, product_id, option_type, option_value, price_adjustment, stock, created_at FROM product_options WHERE product_id = ? ORDER BY option_type, option_value`
    ).bind(productId).all();

    return c.json({ success: true, data: updated.results || [] }, 201);
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});
