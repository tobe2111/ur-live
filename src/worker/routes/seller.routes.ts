// ============================================================
// Seller Routes
// GET /api/sellers                            - 판매자 목록
// GET /api/sellers/:id                        - 판매자 상세
// GET /api/sellers/:sellerId/products-public  - 판매자 공개 상품 목록
// GET /api/sellers/:sellerId/streams          - 판매자 스트림 목록 (공개)
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { QueryBuilder } from '../repositories/query-builder';
import type { AuthVariables } from '../middleware/auth.middleware';
import type { Seller } from '../../shared/types';
import { cacheGet } from '../utils/cache';

const sellersRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/sellers
sellersRouter.get('/', async (c) => {
  try {
    const qb = new QueryBuilder(c.env.DB);
    const { page = '1', limit = '20' } = c.req.query();
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    // ✅ 실제 sellers 테이블 스키마에 맞게 수정
    const where = "WHERE status = 'approved' AND is_active = 1";
    const countRow = await qb.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM sellers ${where}`,
      []
    );

    const rows = await qb.queryMany<Record<string, unknown>>(
      `SELECT id, username, name, email, phone, 
              business_name, business_number, 
              status, is_active, created_at, updated_at
       FROM sellers ${where}
       ORDER BY name
       LIMIT ? OFFSET ?`,
      [limitNum, offset]
    );

    return c.json({
      success: true,
      data: {
        items: rows,
        total: countRow?.count ?? 0,
        page: pageNum,
        limit: limitNum,
        has_next: pageNum * limitNum < (countRow?.count ?? 0),
      },
    });
  } catch (err) {
    console.error('[SELLERS] List error:', err);
    return c.json({ success: false, error: 'Failed to fetch sellers' }, 500);
  }
});

// GET /api/sellers/:id
// 🛡️ 2026-04-22: PII 누출 방어 — 공개 API 에서 phone/email/business_number/bank_account 제거.
// 이 정보는 /api/seller/me (인증된 본인) + admin API 에서만 노출. 공개 페이지는 PUBLIC_SELLER_COLUMNS.
sellersRouter.get('/:id', async (c) => {
  try {
    const qb = new QueryBuilder(c.env.DB);
    const sellerId = c.req.param('id');
    if (!sellerId || !/^\d+$/.test(sellerId)) {
      return c.json({ success: false, error: 'Invalid seller ID' }, 400)
    }

    const seller = await qb.queryOne<Seller>(
      `SELECT id, username, name,
              business_name,
              status, is_active,
              created_at, updated_at, approved_at
       FROM sellers WHERE id = ? AND status = 'approved' AND is_active = 1`,
      [sellerId]
    );

    if (!seller) {
      return c.json({ success: false, error: 'Seller not found' }, 404);
    }

    return c.json({ success: true, data: seller });
  } catch (err) {
    console.error('[SELLERS] Detail error:', err);
    return c.json({ success: false, error: 'Failed to fetch seller' }, 500);
  }
});

// GET /api/sellers/:id/public — 셀러 공개 프로필 (비인증, ID/username/slug 지원)
sellersRouter.get('/:id/public', async (c) => {
  try {
    const param = c.req.param('id');

    // Seller profile changes infrequently — 5 min TTL with 2 min SWR.
    // Key uses the lookup param directly (id/username/slug) so independent
    // callers that hit different keys stay cache-correct.
    // 🛡️ 2026-04-22: 공개 endpoint — 민감 필드 제외하고 public 필드만 SELECT
    // 이전: SELECT * 로 bank_account/email/phone/password_hash/business_number 노출
    // 🛡️ 2026-04-27: production sellers 테이블에 follower_count/is_verified 컬럼 없어서 500 → 제거
    //                 follower_count 는 seller_follows COUNT 서브쿼리로 대체
    // 🛡️ 2026-04-27 (2차): 너무 많이 잘라내서 셀러공개 페이지에 "이름 없음" + SNS/사업자 정보 미연동 →
    //                       SNS 링크, 사업자 정보 (전자상거래법 표시 의무 항목), 대표자명 추가.
    //                       프론트 호환을 위해 DB 컬럼명 alias: kakao_chat_url→kakao_chat_link, representative_name→ceo_name
    //                       민감 필드는 여전히 제외: password_hash/email/phone/bank_*/account_holder/tax_email
    // 🛡️ 2026-05-15 (PRISM 따라잡기): 미니샵 커스터마이징 컬럼 추가
    //   banner_url / brand_color / external_live_* (TikTok/Instagram/Facebook)
    const PUBLIC_SELLER_COLUMNS =
      's.id, s.username, s.name, s.business_name, s.business_number, s.business_address, ' +
      's.profile_image, s.bio, s.commission_rate, s.created_at, ' +
      's.sns_instagram, s.sns_youtube, s.sns_facebook, s.sns_twitter, s.website_url, ' +
      's.kakao_chat_url AS kakao_chat_link, s.representative_name AS ceo_name, ' +
      's.banner_url, s.brand_color, ' +
      's.external_live_tiktok, s.external_live_instagram, s.external_live_facebook, ' +
      '(SELECT COUNT(*) FROM seller_follows WHERE seller_id = s.id) AS follower_count';
    const seller = await cacheGet(
      c.env.SESSION_KV,
      `seller:${param}`,
      async () => {
        const qb = new QueryBuilder(c.env.DB);
        const isNumeric = /^\d+$/.test(param);
        return isNumeric
          ? await qb.queryOne(`SELECT ${PUBLIC_SELLER_COLUMNS} FROM sellers s WHERE s.id = ?`, [param])
          : await qb.queryOne(`SELECT ${PUBLIC_SELLER_COLUMNS} FROM sellers s WHERE s.username = ?`, [param]);
      },
      { ttl: 300, staleWhileRevalidate: 120 }
    );

    if (!seller) {
      return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404);
    }

    return c.json({ success: true, data: seller });
  } catch (err) {
    console.error('[SELLERS] Public profile error:', err);
    return c.json({ success: false, error: 'Failed to fetch seller' }, 500);
  }
});

// GET /api/sellers/:sellerId/products-public
// 비인증 판매자 공개 상품 목록 (프론트에서 /api/seller/:sellerId/products-public 및 /api/sellers/:sellerId/products-public 사용)
sellersRouter.get('/:sellerId/products-public', async (c) => {
  try {
    const qb = new QueryBuilder(c.env.DB);
    const sellerId = c.req.param('sellerId');
    if (!sellerId || !/^\d+$/.test(sellerId)) {
      return c.json({ success: false, error: 'Invalid seller ID' }, 400)
    }
    const { page = '1', limit = '20' } = c.req.query();
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    const products = await qb.queryMany<any>(
      `SELECT id, name, description, price, original_price, discount_rate,
              image_url, stock, category, seller_id, is_active,
              created_at, updated_at
       FROM products
       WHERE seller_id = ? AND is_active = 1
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [sellerId, limitNum, offset]
    );

    const countRow = await qb.queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM products WHERE seller_id = ? AND is_active = 1`,
      [sellerId]
    );

    return c.json({
      success: true,
      data: products,
      pagination: { page: pageNum, limit: limitNum, total: countRow?.total ?? 0 },
    });
  } catch (err) {
    console.error('[SELLERS] Products error:', err);
    return c.json({ success: false, error: 'Failed to fetch seller products' }, 500);
  }
});

// GET /api/sellers/:sellerId/streams
// 비인증 판매자 공개 스트림 목록
sellersRouter.get('/:sellerId/streams', async (c) => {
  try {
    const db = c.env.DB;
    const sellerId = c.req.param('sellerId');
    if (!sellerId || !/^\d+$/.test(sellerId)) {
      return c.json({ success: false, error: 'Invalid seller ID' }, 400)
    }
    const { status, limit = '10' } = c.req.query();
    const limitNum = Math.min(parseInt(limit, 10), 50);

    const params: unknown[] = [sellerId];
    let statusWhere = '';
    if (status) {
      statusWhere = 'AND ls.status = ?';
      params.push(status);
    }
    params.push(limitNum);

    const rows = await db
      .prepare(
        `SELECT ls.id, ls.title, ls.status,
                ls.youtube_video_id, ls.created_at
         FROM live_streams ls
         WHERE ls.seller_id = ? ${statusWhere}
         ORDER BY ls.created_at DESC
         LIMIT ?`
      )
      .bind(...params)
      .all();

    return c.json({ success: true, data: rows.results || [] });
  } catch (err) {
    console.error('[SELLERS] Streams error:', err);
    return c.json({ success: false, error: 'Failed to fetch seller streams' }, 500);
  }
});

export { sellersRouter };
