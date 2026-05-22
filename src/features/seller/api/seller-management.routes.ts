/**
 * Seller Management API Routes
 * 
 * Endpoints:
 * - POST /api/seller/register - 셀러 회원가입
 * - GET /api/seller/profile - 셀러 프로필 조회
 * - PUT /api/seller/profile - 셀러 프로필 수정
 * - GET /api/seller/business-info - 사업자 정보 조회
 * - PUT /api/seller/business-info - 사업자 정보 수정
 * - GET /api/seller/stats - 셀러 통계
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import { hashPassword, validatePasswordComplexity } from '@/lib/password';
import type { JWTPayload } from 'hono/utils/jwt/types';
import {DEFAULT_COMMISSION_RATE } from '@/shared/constants';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';
import { validateFileMagicBytes } from '@/lib/upload-security';
import { rateLimit } from '@/worker/middleware/rate-limit';
import { safeError } from '@/worker/utils/safe-error';

import { swallow } from '@/worker/utils/swallow';
type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  ALIGO_API_KEY?: string;
  ALIGO_USER_ID?: string;
};

type SellerRegisterRequest = {
  username: string;
  email: string;
  password: string;
  name: string;
  business_name: string;
  business_number: string;
  phone: string;
  address?: string;
  description?: string;
  youtube_email: string; // 유튜브 라이브에 사용할 구글 계정 (필수)
  seller_type?: 'influencer' | 'store_owner' | 'both';
  invite_code?: string; // 🛡️ 2026-04-27 Phase 1-3: 영입 코드 자동 매핑
};

type SellerProfileUpdate = {
  name?: string;
  business_name?: string;
  phone?: string;
  address?: string;
  description?: string;
  bank_account?: string;
  bank_name?: string;
  account_holder?: string;
};

type BusinessInfoUpdate = {
  business_number?: string;
  business_registration_file?: string;
  tax_email?: string;
  representative_name?: string;
  business_address?: string;
};

// ── DB row types ─────────────────────────────────────────────────────────────

interface SellerProfileRow {
  id: number;
  username: string;
  email: string;
  name: string;
  business_name: string;
  phone: string;
  address: string | null;
  description: string | null;
  bank_account: string | null;
  bank_name: string | null;
  account_holder: string | null;
  status: string;
  commission_rate: number;
  created_at: string;
  updated_at: string;
}

interface BusinessInfoRow {
  business_number: string | null;
  business_registration_file: string | null;
  tax_email: string | null;
  representative_name: string | null;
  business_address: string | null;
}

interface SettlementStatsRow {
  total_settled: number;
  pending_amount: number;
  total_requests: number;
}

interface SettlementRow {
  id: number;
  seller_id: number;
  amount: number;
  status: string;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  created_at: string;
}

interface PublicSellerRow {
  id: number;
  name: string;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  email: string;
  base_shipping_fee: number | null;
  free_shipping_threshold: number | null;
  country: string | null;
  currency: string | null;
  status: string;
  is_verified: number;
  created_at: string;
}

interface ProductIdRow {
  id: number;
}

interface ImgbbResponse {
  success: boolean;
  data?: { url: string; delete_url: string };
  error?: { message: string };
}

export const sellerManagementRoutes = new Hono<{ Bindings: Bindings }>();

let _sellerColumnsEnsured = false;
async function ensureSellerColumns(db: D1Database) {
  if (_done_ensureSellerColumns.has(db)) return
  _done_ensureSellerColumns.add(db)
  if (_sellerColumnsEnsured) return;
  try { await db.prepare("ALTER TABLE sellers ADD COLUMN linked_user_id INTEGER").run() } catch { /* exists */ }
  try { await db.prepare("ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'").run() } catch { /* exists */ }
  _sellerColumnsEnsured = true;
}

// CORS 설정
// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.
//   서브라우터 wildcard 미들웨어가 같은 prefix 의 다른 라우터 경로 가로채는 버그 (Hono v4) 방지.

/**
 * JWT 토큰에서 셀러 ID 추출
 */
async function getSellerIdFromToken(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authorization.substring(7);
    const payload = await verify(token, jwtSecret, 'HS256') as JWTPayload & { seller_id?: number };
    return payload.seller_id || null;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * POST /api/seller/register
 * 셀러 회원가입
 */
// 🛡️ 2026-04-28 TD-006 (split): /register, /register-from-user, /my-seller-status,
//   /switch-to-seller, /switch-to-user → src/features/seller/api/seller-registration.routes.ts

/**
 * GET /api/seller/profile
 * 셀러 프로필 조회
 */
// 🛡️ 2026-04-28 TD-006 (split): /profile (GET/PUT/PATCH) + /business-info (GET/POST/PUT/PATCH)
//   → src/features/seller/api/seller-profile.routes.ts

/**
 * GET /api/seller/tier (2026-05-05)
 * 셀러 등급 + score + exposure_weight + commission_rate.
 * Migration 0244 의 sellers.tier 컬럼을 노출.
 *
 * 🛡️ 2026-05-06: 절대 500 안 반환. TierBadge 가 홈/대시보드에서 호출하는 비핵심
 * 엔드포인트 — DB 일시 오류 / 마이그레이션 미적용 / row 없음 등 모든 케이스에
 * 안전 기본값(new tier) 반환. 사용자에게 에러 토스트 안 띄우고 silent skip.
 */
sellerManagementRoutes.get('/tier', async (c) => {
  const SAFE_DEFAULT = {
    tier: 'new',
    tier_score: 0,
    exposure_weight: 1.0,
    commission_rate: 5,
    tier_updated_at: null,
    history: [] as unknown[],
  };

  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    // 1차 시도: 0244 컬럼 (tier_score, exposure_weight, tier_updated_at) 포함
    let row: {
      tier: string; tier_score: number; exposure_weight: number;
      commission_rate: number; tier_updated_at: string | null;
      history: unknown[];
    } | null = null;
    try {
      const r = await c.env.DB.prepare(`
        SELECT
          COALESCE(tier, 'new') AS tier,
          COALESCE(tier_score, 0) AS tier_score,
          COALESCE(exposure_weight, 1.0) AS exposure_weight,
          COALESCE(commission_rate, 5) AS commission_rate,
          tier_updated_at
        FROM sellers WHERE id = ?
      `).bind(sellerId).first<{
        tier: string; tier_score: number; exposure_weight: number;
        commission_rate: number; tier_updated_at: string | null;
      }>();
      if (r) row = { ...r, history: [] };
    } catch {
      // fallback: 0244 컬럼 없는 구 스키마. tier 만 조회.
      try {
        const fallback = await c.env.DB.prepare(`
          SELECT
            COALESCE(tier, 'new') AS tier,
            COALESCE(commission_rate, 5) AS commission_rate
          FROM sellers WHERE id = ?
        `).bind(sellerId).first<{ tier: string; commission_rate: number }>();
        if (fallback) {
          row = {
            tier: fallback.tier,
            tier_score: 0,
            exposure_weight: 1.0,
            commission_rate: fallback.commission_rate,
            tier_updated_at: null,
            history: [],
          };
        }
      } catch {
        // sellers 테이블 자체 접근 실패 — silent default
      }
    }

    // row 없거나 DB 실패 → 안전 기본값 반환 (success: true 로 silent skip)
    if (!row) return c.json({ success: true, data: SAFE_DEFAULT });

    // 최근 등급 변경 이력 — 테이블 없으면 빈 배열.
    try {
      const history = await c.env.DB.prepare(`
        SELECT prev_tier, new_tier, prev_score, new_score, changed_at
        FROM seller_tier_history
        WHERE seller_id = ?
        ORDER BY changed_at DESC LIMIT 5
      `).bind(sellerId).all();
      row.history = history.results || [];
    } catch {
      row.history = [];
    }

    return c.json({ success: true, data: row });
  } catch (err) {
    if (import.meta.env?.DEV) console.error('[seller/tier]', err);
    // 어떤 예외든 안전 기본값으로 fall-through. TierBadge 가 noisy 500 에러 안 보임.
    return c.json({ success: true, data: SAFE_DEFAULT });
  }
});

/**
 * GET /api/seller/stats
 * 셀러 통계 조회
 */
sellerManagementRoutes.get('/stats', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const db = c.env.DB;

    // 상품 통계
    const productsCount = await db.prepare(`
      SELECT COUNT(*) as total
      FROM products
      WHERE seller_id = ?
    `).bind(sellerId).first();

    // 주문 통계 — production orders.status uses uppercase values
    // orders.product_id doesn't exist; must JOIN through order_items
    const ordersStats = await db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN o.status = 'PAID' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN o.status = 'DONE' THEN 1 ELSE 0 END) as confirmed_orders,
        SUM(CASE WHEN o.status = 'SHIPPING' THEN 1 ELSE 0 END) as shipped_orders,
        SUM(CASE WHEN o.status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN o.status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_orders
      FROM orders o
      WHERE o.seller_id = ?
    `).bind(sellerId).first();

    // 매출 통계
    const revenueStats = await db.prepare(`
      SELECT
        COALESCE(SUM(o.total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN o.total_amount ELSE 0 END), 0) as confirmed_revenue,
        COALESCE(SUM(CASE WHEN DATE(o.created_at) = DATE('now') THEN o.total_amount ELSE 0 END), 0) as today_revenue,
        COALESCE(SUM(CASE WHEN DATE(o.created_at) >= DATE('now', '-30 days') THEN o.total_amount ELSE 0 END), 0) as month_revenue
      FROM orders o
      WHERE o.seller_id = ? AND o.status IN ('PAID','DONE','SHIPPING','DELIVERED')
    `).bind(sellerId).first();

    // 최근 7일 매출 추이
    const recentRevenue = await db.prepare(`
      SELECT
        DATE(o.created_at) as date,
        COUNT(*) as order_count,
        SUM(o.total_amount) as revenue
      FROM orders o
      WHERE o.seller_id = ?
        AND o.status IN ('PAID','DONE','SHIPPING','DELIVERED')
        AND DATE(o.created_at) >= DATE('now', '-7 days')
      GROUP BY DATE(o.created_at)
      ORDER BY date DESC
    `).bind(sellerId).all();

    // 인기 상품 TOP 5 — JOIN via order_items since orders.product_id doesn't exist
    const topProducts = await db.prepare(`
      SELECT
        p.id,
        p.name,
        p.price,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(oi.subtotal), 0) as total_revenue
      FROM products p
      LEFT JOIN order_items oi ON oi.product_id = p.id
      LEFT JOIN orders o ON o.id = oi.order_id
        AND o.status IN ('PAID','DONE','SHIPPING','DELIVERED')
      WHERE p.seller_id = ?
      GROUP BY p.id, p.name, p.price
      ORDER BY order_count DESC
      LIMIT 5
    `).bind(sellerId).all();

    return c.json({
      success: true,
      stats: {
        products: {
          total: productsCount?.total || 0
        },
        orders: {
          total: ordersStats?.total_orders || 0,
          pending: ordersStats?.pending_orders || 0,
          confirmed: ordersStats?.confirmed_orders || 0,
          shipped: ordersStats?.shipped_orders || 0,
          delivered: ordersStats?.delivered_orders || 0,
          cancelled: ordersStats?.cancelled_orders || 0
        },
        revenue: {
          total: revenueStats?.total_revenue || 0,
          confirmed: revenueStats?.confirmed_revenue || 0,
          today: revenueStats?.today_revenue || 0,
          month: revenueStats?.month_revenue || 0
        },
        recent_revenue: recentRevenue.results || [],
        top_products: topProducts.results || []
      }
    });

  } catch (error: unknown) {
    console.error('Get seller stats error:', error);
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to get seller stats'
    }, 500);
  }
});

// ============================================================
// ✅ 누락 API 추가 (프론트에서 호출하는 경로 보완)
// ============================================================

/**
 * GET /api/seller/personal-info
 * 셀러 개인 정보 조회 (profile 의 alias)
 */
// 🛡️ 2026-04-28 TD-006 (split): /personal-info, /change-password, /upload-image →
//   src/features/seller/api/seller-account.routes.ts
// 🛡️ 2026-04-28 TD-006 (split): /settlements*, /dashboard/stats →
//   src/features/seller/api/seller-settlements.routes.ts

// ── GET /api/seller/public/:sellerId ─────────────────────────────────────────
// 공개 셀러 프로필 조회 (ID 또는 slug/username으로 조회, 인증 불필요)
sellerManagementRoutes.get('/public/:sellerId', async (c) => {
  const { DB } = c.env;
  const param = c.req.param('sellerId');

  try {
    // 숫자면 ID, 아니면 slug 또는 username으로 조회
    const isNumeric = /^\d+$/.test(param);
    const seller = isNumeric
      // 🛡️ 2026-05-07: 'approved' 와 'active' 모두 활성으로 인정 (status 표준 분기).
      ? await DB.prepare(
          `SELECT id, username, slug, name, email, description, business_name, business_number, phone,
                  profile_image, bio, sns_instagram, sns_youtube, sns_facebook, sns_twitter,
                  website_url, kakao_chat_link, status, created_at
           FROM sellers WHERE id = ? AND status IN ('approved', 'active')`
        ).bind(param).first()
      : await DB.prepare(
          `SELECT id, username, slug, name, email, description, business_name, business_number, phone,
                  profile_image, bio, sns_instagram, sns_youtube, sns_facebook, sns_twitter,
                  website_url, kakao_chat_link, status, created_at
           FROM sellers WHERE (slug = ? OR username = ?) AND status IN ('approved', 'active')`
        ).bind(param, param).first();

    if (!seller) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404);
    return c.json({ success: true, data: seller });
  } catch (err: unknown) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[seller-management]');
  }
});

// ── GET /api/seller/:sellerId/products-public ─────────────────────────────────
// 공개 셀러 상품 목록 (SellerPublicPage.tsx에서 /api/seller/:sellerId/products-public 호출)
sellerManagementRoutes.get('/:sellerId/products-public', async (c) => {
  const { DB } = c.env;
  const sellerId = c.req.param('sellerId');
  const { page = '1', limit = '20' } = c.req.query();
  const pageNum = parseInt(page, 10);
  const limitNum = Math.min(parseInt(limit, 10), 100);
  const offset = (pageNum - 1) * limitNum;

  try {
    const [products, countRow] = await Promise.all([
      DB.prepare(
        // 🛡️ 2026-04-29 (TD-005): legacy/canonical 양쪽 안전 — migration 0233 적용 후
        //   stock_quantity 컬럼 제거되어도 동작 유지.
        `SELECT id, name, description, price, original_price, discount_rate,
                image_url, COALESCE(stock_quantity, stock, 0) AS stock_quantity,
                category, seller_id, is_active, created_at
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
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[seller-management]');
  }
});

// ── GET /api/seller/products/:id/options ─────────────────────────────────────
// 셀러 상품 옵션 목록 조회 (SellerProductEditPage.tsx에서 호출)
sellerManagementRoutes.get('/products/:id/options', async (c) => {
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

    // 🛡️ 2026-04-30 TD-005: stock_quantity / stock 양쪽 호환 — canonical 은 stock,
    //   legacy 는 stock_quantity. COALESCE 로 양쪽 안전 + alias 유지 (FE 호환).
    const result = await DB.prepare(
      `SELECT id, product_id, option_type, option_value, price_adjustment,
              COALESCE(stock, stock_quantity, 0) AS stock_quantity
       FROM product_options WHERE product_id = ? ORDER BY option_type, option_value`
    ).bind(productId).all();

    return c.json({ success: true, data: result.results || [] });
  } catch (err: unknown) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[seller-management]');
  }
});

// ── POST /api/seller/products/:id/options ────────────────────────────────────
// 셀러 상품 옵션 추가/교체 (SellerProductEditPage.tsx, SellerProductNewPage.tsx에서 호출)
sellerManagementRoutes.post('/products/:id/options', async (c) => {
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

    // 🛡️ 2026-04-30 TD-005: canonical 'stock' 컬럼에만 INSERT (stock_quantity 이중 쓰기 제거).
    //   기존 row 의 stock_quantity 값은 SELECT side COALESCE 로 읽혀 호환됨.
    for (const opt of options) {
      await DB.prepare(
        `INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(productId, opt.option_type, opt.option_value, opt.price_adjustment ?? 0, opt.stock_quantity ?? 0).run();
    }

    const updated = await DB.prepare(
      `SELECT * FROM product_options WHERE product_id = ? ORDER BY option_type, option_value`
    ).bind(productId).all();

    // 옵션 수정 시 KV 캐시 무효화 (GET /api/products/:id/options 10분 캐시)
    try {
      const KV = (c.env as any).SESSION_KV;
      if (KV) await KV.delete(`product_options:${productId}`);
    } catch { /* non-fatal */ }

    return c.json({ success: true, data: updated.results || [] }, 201);
  } catch (err: unknown) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[seller-management]');
  }
});

// 🛡️ 2026-04-28 TD-006 (split): /alimtalk* 7개 핸들러 →
//   src/features/seller/api/seller-alimtalk-mgmt.routes.ts (worker/index.ts 에서 별도 mount)
//   /alimtalk/credits + /logs 는 alimtalk.routes.ts 가 처리 (path 비충돌)

// 🛡️ 2026-04-28 TD-006 (split): /link-kakao /unlink-kakao /kakao-link-status →
//   src/features/seller/api/seller-kakao-link.routes.ts (worker/index.ts 에서 별도 mount)


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureSellerColumns = new WeakSet<object>()
