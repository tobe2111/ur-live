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
import { ALLOWED_ORIGINS, DEFAULT_COMMISSION_RATE } from '@/shared/constants';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';
import { validateFileMagicBytes } from '@/lib/upload-security';
import { rateLimit } from '@/worker/middleware/rate-limit';

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

interface SellerJWTPayload extends Record<string, unknown> {
  seller_id?: number;
}

export const sellerManagementRoutes = new Hono<{ Bindings: Bindings }>();

let _sellerColumnsEnsured = false;
async function ensureSellerColumns(db: D1Database) {
  if (_sellerColumnsEnsured) return;
  try { await db.prepare("ALTER TABLE sellers ADD COLUMN linked_user_id INTEGER").run() } catch { /* exists */ }
  try { await db.prepare("ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'").run() } catch { /* exists */ }
  _sellerColumnsEnsured = true;
}

// CORS 설정
sellerManagementRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

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
sellerManagementRoutes.get('/profile', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({
        success: false,
        error: '로그인이 필요합니다'
      }, 401);
    }

    const db = c.env.DB;
    const seller = await db.prepare(`
      SELECT
        id, username, email, name, business_name, phone, address, description,
        bank_account, bank_name, account_holder, status, commission_rate,
        profile_image, bio, sns_instagram, sns_youtube, sns_facebook, sns_twitter,
        website_url, kakao_chat_url AS kakao_chat_link,
        created_at, updated_at
      FROM sellers
      WHERE id = ?
    `).bind(sellerId).first();

    if (!seller) {
      return c.json({
        success: false,
        error: 'Seller not found'
      }, 404);
    }

    return c.json({
      success: true,
      data: seller
    });

  } catch (error: unknown) {
    console.error('Get seller profile error:', error);
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to get seller profile'
    }, 500);
  }
});

/**
 * PUT /api/seller/profile
 * 셀러 프로필 수정
 */
sellerManagementRoutes.on(['PUT', 'PATCH'], '/profile', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json<SellerProfileUpdate & Record<string, unknown>>();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    const fieldMap: Record<string, string> = {
      name: 'name', business_name: 'business_name', phone: 'phone',
      address: 'address', description: 'description',
      bank_account: 'bank_account', bank_name: 'bank_name', account_holder: 'account_holder',
      profile_image: 'profile_image', bio: 'bio',
      sns_instagram: 'sns_instagram', sns_youtube: 'sns_youtube',
      sns_facebook: 'sns_facebook', sns_twitter: 'sns_twitter',
      website_url: 'website_url', kakao_chat_link: 'kakao_chat_url'
    };

    // 🛡️ 2026-04-22: 정산 계좌 변경 시 is_verified=0 강제 → 어드민 재인증 전까지 출금 차단.
    // 이전: 셀러가 이메일/UI 만 뚫리면 은행 계좌 변경 후 정산 받아감.
    const bankChangeKeys = ['bank_account', 'bank_name', 'account_holder'] as const;
    const bankChanged = bankChangeKeys.some(k => body[k] !== undefined);

    // 🛡️ 계좌 변경은 민감 액션 — 최근 15분 내 PIN 인증 필수
    if (bankChanged) {
      const { isPinVerified } = await import('./seller-pin.routes');
      const pinOk = await isPinVerified(c.req.header('Cookie'), sellerId, c.env.JWT_SECRET);
      if (!pinOk) {
        return c.json({ success: false, error: '계좌 변경은 PIN 인증이 필요합니다', code: 'PIN_REQUIRED' }, 412);
      }
    }

    for (const [bodyKey, dbCol] of Object.entries(fieldMap)) {
      if (body[bodyKey] !== undefined) {
        updates.push(`${dbCol} = ?`);
        values.push(body[bodyKey] as string | number | null);
      }
    }

    if (bankChanged) {
      updates.push('is_verified = 0');
      // 감사 로그 (실패해도 업데이트는 진행)
      try {
        await c.env.DB.prepare(
          `INSERT INTO admin_audit_logs (admin_id, admin_email, action, target_type, target_id, after_value)
           VALUES (?, ?, 'seller_bank_change', 'seller', ?, ?)`
        ).bind(String(sellerId), 'system', String(sellerId), JSON.stringify({
          reason: 'seller-self-bank-change',
          bank_name: body.bank_name ?? null,
          account_holder: body.account_holder ?? null,
        })).run();
      } catch {}
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: 'No fields to update' }, 400);
    }

    updates.push("updated_at = datetime('now')");
    values.push(sellerId);

    const db = c.env.DB;
    await db.prepare(`UPDATE sellers SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

    const updatedSeller = await db.prepare(`
      SELECT
        id, username, email, name, business_name, phone, address, description,
        bank_account, bank_name, account_holder, status, commission_rate,
        profile_image, bio, sns_instagram, sns_youtube, sns_facebook, sns_twitter,
        website_url, kakao_chat_url AS kakao_chat_link,
        created_at, updated_at
      FROM sellers WHERE id = ?
    `).bind(sellerId).first();

    return c.json({ success: true, data: updatedSeller });

  } catch (error: unknown) {
    console.error('Update seller profile error:', error);
    return c.json({ success: false, error: (error as Error).message || 'Failed to update seller profile' }, 500);
  }
});

/**
 * GET /api/seller/business-info
 * 사업자 정보 조회 (seller_business_info 테이블)
 */
sellerManagementRoutes.get('/business-info', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const db = c.env.DB;
    let businessInfo;
    try {
      businessInfo = await db.prepare(`
        SELECT
          id, business_number, business_name, ceo_name,
          business_type, business_category,
          postal_code, address, address_detail,
          phone, email,
          is_verified, verified_at, created_at
        FROM seller_business_info
        WHERE seller_id = ?
      `).bind(sellerId).first();
    } catch {
      // address_detail 컬럼이 없는 경우 fallback
      businessInfo = await db.prepare(`
        SELECT
          id, business_number, business_name, ceo_name,
          business_type, business_category,
          postal_code, address, '' as address_detail,
          phone, email,
          is_verified, verified_at, created_at
        FROM seller_business_info
        WHERE seller_id = ?
      `).bind(sellerId).first();
    }

    if (!businessInfo) {
      return c.json({ success: false, error: 'Not found' }, 404);
    }

    return c.json({ success: true, data: businessInfo });

  } catch (error: unknown) {
    console.error('Get business info error:', error);
    return c.json({ success: false, error: 'Failed to get business info' }, 500);
  }
});

/**
 * POST/PUT/PATCH /api/seller/business-info
 * 사업자 정보 등록/수정 (seller_business_info 테이블 UPSERT)
 * 수정 시 is_verified = 0 으로 초기화 (재승인 필요)
 */
sellerManagementRoutes.on(['POST', 'PUT', 'PATCH'], '/business-info', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const body = await c.req.json<{
      business_number?: string;
      business_name?: string;
      ceo_name?: string;
      business_type?: string;
      business_category?: string;
      postal_code?: string;
      address?: string;
      address_detail?: string;
      phone?: string;
      email?: string;
    }>();

    // 사업자번호 형식 검증
    if (body.business_number) {
      const businessNumberRegex = /^\d{3}-\d{2}-\d{5}$/;
      if (!businessNumberRegex.test(body.business_number)) {
        return c.json({ success: false, error: 'Invalid business number format (XXX-XX-XXXXX)' }, 400);
      }
    }

    const db = c.env.DB;

    // address_detail 컬럼이 없을 수 있으므로 확인 (마이그레이션 0127 미적용 대비)
    let hasAddressDetail = true;
    try {
      await db.prepare('SELECT address_detail FROM seller_business_info LIMIT 0').all();
    } catch {
      hasAddressDetail = false;
    }

    const existing = await db.prepare(
      'SELECT id, is_verified FROM seller_business_info WHERE seller_id = ?'
    ).bind(sellerId).first<{ id: number; is_verified: number }>();

    if (existing) {
      // UPDATE — 재제출 시 승인 상태 초기화
      if (hasAddressDetail) {
        await db.prepare(`
          UPDATE seller_business_info SET
            business_number = COALESCE(?, business_number),
            business_name   = COALESCE(?, business_name),
            ceo_name        = COALESCE(?, ceo_name),
            business_type   = COALESCE(?, business_type),
            business_category = COALESCE(?, business_category),
            postal_code     = COALESCE(?, postal_code),
            address         = COALESCE(?, address),
            address_detail  = COALESCE(?, address_detail),
            phone           = COALESCE(?, phone),
            email           = COALESCE(?, email),
            is_verified     = 0,
            verified_at     = NULL,
            updated_at      = datetime('now')
          WHERE seller_id = ?
        `).bind(
          body.business_number ?? null,
          body.business_name ?? null,
          body.ceo_name ?? null,
          body.business_type ?? null,
          body.business_category ?? null,
          body.postal_code ?? null,
          body.address ?? null,
          body.address_detail ?? null,
          body.phone ?? null,
          body.email ?? null,
          sellerId
        ).run();
      } else {
        await db.prepare(`
          UPDATE seller_business_info SET
            business_number = COALESCE(?, business_number),
            business_name   = COALESCE(?, business_name),
            ceo_name        = COALESCE(?, ceo_name),
            business_type   = COALESCE(?, business_type),
            business_category = COALESCE(?, business_category),
            postal_code     = COALESCE(?, postal_code),
            address         = COALESCE(?, address),
            phone           = COALESCE(?, phone),
            email           = COALESCE(?, email),
            is_verified     = 0,
            verified_at     = NULL,
            updated_at      = datetime('now')
          WHERE seller_id = ?
        `).bind(
          body.business_number ?? null,
          body.business_name ?? null,
          body.ceo_name ?? null,
          body.business_type ?? null,
          body.business_category ?? null,
          body.postal_code ?? null,
          body.address ?? null,
          body.phone ?? null,
          body.email ?? null,
          sellerId
        ).run();
      }
    } else {
      // INSERT — NOT NULL 제약 대비: 빈 문자열 기본값
      if (hasAddressDetail) {
        await db.prepare(`
          INSERT INTO seller_business_info
            (seller_id, business_number, business_name, ceo_name,
             business_type, business_category, postal_code, address, address_detail,
             phone, email, is_verified)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).bind(
          sellerId,
          body.business_number || '',
          body.business_name || '',
          body.ceo_name || '',
          body.business_type ?? null,
          body.business_category ?? null,
          body.postal_code ?? null,
          body.address ?? null,
          body.address_detail ?? null,
          body.phone ?? null,
          body.email ?? null
        ).run();
      } else {
        await db.prepare(`
          INSERT INTO seller_business_info
            (seller_id, business_number, business_name, ceo_name,
             business_type, business_category, postal_code, address,
             phone, email, is_verified)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).bind(
          sellerId,
          body.business_number || '',
          body.business_name || '',
          body.ceo_name || '',
          body.business_type ?? null,
          body.business_category ?? null,
          body.postal_code ?? null,
          body.address ?? null,
          body.phone ?? null,
          body.email ?? null
        ).run();
      }
    }

    // 저장 확인 (address_detail 유무에 따라 쿼리 분기)
    let saved;
    try {
      saved = await db.prepare(`
        SELECT id, business_number, business_name, ceo_name,
               business_type, business_category, postal_code, address, address_detail,
               phone, email, is_verified, verified_at, created_at
        FROM seller_business_info WHERE seller_id = ?
      `).bind(sellerId).first();
    } catch {
      saved = await db.prepare(`
        SELECT id, business_number, business_name, ceo_name,
               business_type, business_category, postal_code, address,
               '' as address_detail,
               phone, email, is_verified, verified_at, created_at
        FROM seller_business_info WHERE seller_id = ?
      `).bind(sellerId).first();
    }

    return c.json({ success: true, data: saved });

  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Unknown error';
    console.error('Update business info error:', errMsg, error);
    // 구체적인 에러 메시지 반환 (디버깅용)
    if (errMsg.includes('UNIQUE constraint')) {
      return c.json({ success: false, error: '이미 등록된 사업자번호입니다.' }, 409);
    }
    if (errMsg.includes('NOT NULL constraint')) {
      return c.json({ success: false, error: '필수 항목을 모두 입력해주세요 (사업자번호, 상호명, 대표자명).' }, 400);
    }
    return c.json({ success: false, error: `저장 실패: ${errMsg}` }, 500);
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
sellerManagementRoutes.get('/personal-info', async (c) => {
  return c.redirect('/api/seller/profile', 301);
});

/**
 * PUT /api/seller/personal-info
 * 셀러 개인 정보 수정 (profile 의 alias)
 */
sellerManagementRoutes.on(['PUT', 'PATCH'], '/personal-info', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  }
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);
    const body = await c.req.json();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
    if (body.phone !== undefined) { fields.push('phone = ?'); values.push(body.phone); }
    if (body.email !== undefined) { fields.push('email = ?'); values.push(body.email); }
    if (fields.length === 0) return c.json({ success: false, error: '수정할 항목이 없습니다' }, 400);
    fields.push("updated_at = datetime('now')");
    values.push(sellerId);
    await db.prepare(`UPDATE sellers SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
    const updatedSeller = await db.prepare(`
      SELECT
        id, username, email, name, business_name, phone, address, description,
        bank_account, bank_name, account_holder, status, commission_rate,
        profile_image, bio, sns_instagram, sns_youtube, sns_facebook, sns_twitter,
        website_url, kakao_chat_url AS kakao_chat_link,
        created_at, updated_at
      FROM sellers WHERE id = ?
    `).bind(sellerId).first();
    return c.json({ success: true, data: updatedSeller });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

/**
 * POST /api/seller/change-password
 * 셀러 비밀번호 변경
 */
sellerManagementRoutes.post('/change-password', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  }
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);
    const { currentPassword, newPassword } = await c.req.json<{ currentPassword: string; newPassword: string }>();
    if (!currentPassword || !newPassword) {
      return c.json({ success: false, error: '현재 비밀번호와 새 비밀번호가 필요합니다' }, 400);
    }
    // 🛡️ 2026-04-22: 이전 비밀번호 재사용 방어
    if (currentPassword === newPassword) {
      return c.json({ success: false, error: '새 비밀번호는 현재 비밀번호와 달라야 합니다' }, 400);
    }
    // 🛡️ 복잡도 검증 (user 와 동일 규칙)
    const { hashPassword: hp, verifyPassword, validatePasswordComplexity } = await import('../../../lib/password');
    const complexity = validatePasswordComplexity(newPassword);
    if (!complexity.ok) {
      return c.json({ success: false, error: complexity.error ?? '비밀번호 복잡도 부족' }, 400);
    }
    const seller = await db.prepare('SELECT password_hash FROM sellers WHERE id = ?').bind(sellerId).first<{ password_hash: string }>();
    if (!seller) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404);
    const { valid } = await verifyPassword(currentPassword, seller.password_hash);
    if (!valid) return c.json({ success: false, error: '현재 비밀번호가 올바르지 않습니다' }, 400);
    const newHash = await hp(newPassword);
    await db.prepare("UPDATE sellers SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").bind(newHash, sellerId).run();
    // 🛡️ 비번 변경 시 기존 refresh token 전량 revoke
    await db.prepare("DELETE FROM auth_refresh_tokens WHERE user_type = 'seller' AND user_id = ?").bind(Number(sellerId)).run().catch(swallow('seller:api:seller-management'));
    return c.json({ success: true, message: '비밀번호가 변경되었습니다' });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

/**
 * POST /api/seller/upload-image
 * 셀러 이미지 업로드 (imgbb 사용)
 * Security: auth required, MIME whitelist, 5MB size limit, safe filename
 */
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

sellerManagementRoutes.post('/upload-image', cors(), async (c) => {
  // ── Auth required ──────────────────────────────────────────────────────────
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return c.json({ success: false, error: '이미지 파일이 필요합니다' }, 400);
    }

    // ── Size limit ────────────────────────────────────────────────────────────
    if (file.size > MAX_UPLOAD_BYTES) {
      return c.json({ success: false, error: `파일 크기는 5MB 이하여야 합니다 (현재: ${(file.size / 1024 / 1024).toFixed(1)}MB)` }, 400);
    }

    // ── MIME type whitelist ───────────────────────────────────────────────────
    if (!ALLOWED_IMAGE_MIME.has(file.type)) {
      return c.json({ success: false, error: '허용되지 않는 파일 형식입니다. JPEG, PNG, WebP, GIF만 허용됩니다.' }, 400);
    }

    // ── Extension whitelist (double-check, MIME can be spoofed) ──────────────
    const ext = ('.' + file.name.split('.').pop()?.toLowerCase()) as string;
    if (!ALLOWED_IMAGE_EXT.has(ext)) {
      return c.json({ success: false, error: '허용되지 않는 파일 확장자입니다.' }, 400);
    }

    // ── Magic-byte validation (MIME + extension can both be spoofed) ─────────
    const buffer = await file.arrayBuffer();
    const magicCheck = await validateFileMagicBytes(buffer, file.type);
    if (!magicCheck.valid) {
      return c.json({ success: false, error: magicCheck.error || '파일 형식이 올바르지 않습니다' }, 400);
    }

    const imgbbKey = (c.env as unknown as Record<string, string | undefined>).IMGBB_API_KEY;
    if (!imgbbKey) {
      return c.json({ success: false, error: '이미지 업로드 서비스가 구성되지 않았습니다' }, 500);
    }

    // ── Safe filename (no path traversal) ─────────────────────────────────────
    const safeName = `seller_${sellerId}_${Date.now()}${ext}`;

    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const resp = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `image=${encodeURIComponent(base64)}&name=${encodeURIComponent(safeName)}`,
      // 🛡️ 2026-04-22: 30s timeout — 큰 이미지 업로드 + imgbb 응답 지연 대비
      signal: AbortSignal.timeout(30_000),
    });
    const json = await resp.json() as ImgbbResponse;
    if (!json.success) throw new Error(json.error?.message || 'imgbb upload failed');
    // 🛡️ 2026-04-22: delete_url 은 응답에 포함하지 않음.
    // 클라이언트가 받으면 악의적으로 이미지 삭제 가능. 서버 내부에만 저장.
    return c.json({ success: true, url: json.data!.url });
  } catch (err: unknown) {
    console.error('[Seller] Upload image error:', (err as Error).message);
    return c.json({ success: false, error: '이미지 업로드에 실패했습니다.' }, 500);
  }
});

/**
 * GET  /api/seller/settlements
 * POST /api/seller/settlements/request
 * GET  /api/seller/settlements/stats
 * 셀러 정산 관련 API
 */
sellerManagementRoutes.get('/settlements', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    const rows = await db.prepare(
      'SELECT * FROM settlements WHERE seller_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(sellerId, limit, offset).all().catch(() => ({ results: [] }));
    const count = await db.prepare('SELECT COUNT(*) as total FROM settlements WHERE seller_id = ?')
      .bind(sellerId).first<{ total: number }>().catch(() => ({ total: 0 }));
    return c.json({ success: true, data: rows.results, total: count?.total ?? 0 });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

sellerManagementRoutes.post('/settlements/request', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);

    // 🛡️ 민감 액션 — 최근 15분 내 PIN 인증 필수
    const { isPinVerified } = await import('./seller-pin.routes');
    const pinOk = await isPinVerified(c.req.header('Cookie'), sellerId, c.env.JWT_SECRET);
    if (!pinOk) {
      return c.json({
        success: false,
        error: 'PIN 인증이 필요합니다',
        code: 'PIN_REQUIRED',
      }, 412);
    }

    const { amount, bank_name, account_number, account_holder } = await c.req.json();
    if (!amount || amount <= 0) return c.json({ success: false, error: '정산 금액이 올바르지 않습니다' }, 400);
    const result = await db.prepare(`
      INSERT INTO settlements (seller_id, amount, bank_name, account_number, account_holder, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
    `).bind(sellerId, amount, bank_name || null, account_number || null, account_holder || null).run()
      .catch(() => null);
    if (!result) return c.json({ success: false, error: '정산 신청 실패 (settlements 테이블 없음)' }, 500);
    // 1. 정산 신청 → 어드민 알림
    createDashboardNotification(db, 'admin', null, 'settlement_request', '정산 신청', `셀러 #${sellerId}`, '/admin/settlement').catch(swallow('seller:api:seller-management'));
    return c.json({ success: true, message: '정산 신청이 완료되었습니다', id: result.meta.last_row_id });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

sellerManagementRoutes.get('/settlements/stats', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);
    const stats = await db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_settled,
        SUM(CASE WHEN status = 'pending'   THEN amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'approved'  THEN amount ELSE 0 END) as approved_amount,
        SUM(CASE WHEN status = 'paid'      THEN amount ELSE 0 END) as paid_amount,
        COUNT(CASE WHEN status = 'pending'  THEN 1 END) as total_pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as total_approved,
        COUNT(CASE WHEN status = 'paid'     THEN 1 END) as total_paid,
        COUNT(*) as total_requests
      FROM settlements WHERE seller_id = ?
    `).bind(sellerId).first<SettlementStatsRow>().catch(() => null);
    const defaultStats = { total_settled: 0, pending_amount: 0, approved_amount: 0, paid_amount: 0, total_pending: 0, total_approved: 0, total_paid: 0, total_requests: 0 };
    return c.json({ success: true, data: stats ? { ...defaultStats, ...stats } : defaultStats });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /api/seller/settlements/summary ─────────────────────────────────────
// 셀러 정산 요약: 미정산 금액, 마지막 정산, 누적 정산
sellerManagementRoutes.get('/settlements/summary', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  const sellerId = await getSellerIdFromToken(authorization, c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 401);

  try {
    const { getSellerSettlementSummary } = await import('../../../lib/settlement-automation');
    const summary = await getSellerSettlementSummary(db, sellerId);
    return c.json({ success: true, data: summary });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /api/seller/dashboard/stats ─────────────────────────────────────────
// 셀러 대시보드 요약 통계 (SellerDashboardPage에서 호출)
sellerManagementRoutes.get('/dashboard/stats', async (c) => {
  const { DB } = c.env;
  const authorization = c.req.header('Authorization');
  const sellerId = await getSellerIdFromToken(authorization, c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

  try {
    const today = new Date().toISOString().slice(0, 10);
    const [orderStats, productStats, streamStats] = await Promise.all([
      DB.prepare(`
        SELECT COUNT(*) as total_orders,
               COALESCE(SUM(total_amount), 0) as total_revenue
        FROM orders WHERE seller_id = ? AND DATE(created_at) = ?
      `).bind(sellerId, today).first<{ total_orders: number; total_revenue: number }>(),
      DB.prepare(`
        SELECT COUNT(*) as total_products,
               SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_products
        FROM products WHERE seller_id = ?
      `).bind(sellerId).first<{ total_products: number; active_products: number }>(),
      DB.prepare(`
        SELECT COUNT(*) as total_streams,
               SUM(CASE WHEN status = 'live' THEN 1 ELSE 0 END) as live_streams
        FROM live_streams WHERE seller_id = ?
      `).bind(sellerId).first<{ total_streams: number; live_streams: number }>(),
    ]);

    return c.json({
      success: true,
      data: {
        today_orders: orderStats?.total_orders ?? 0,
        today_revenue: orderStats?.total_revenue ?? 0,
        total_products: productStats?.total_products ?? 0,
        active_products: productStats?.active_products ?? 0,
        total_streams: streamStats?.total_streams ?? 0,
        live_streams: streamStats?.live_streams ?? 0,
      },
    });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /api/seller/settlements/:id/download ─────────────────────────────────
// 정산 내역서 다운로드 (CSV/JSON)
sellerManagementRoutes.get('/settlements/:id/download', async (c) => {
  const { DB } = c.env;
  const authorization = c.req.header('Authorization');
  const sellerId = await getSellerIdFromToken(authorization, c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const settlementId = c.req.param('id');
  try {
    const settlement = await DB.prepare(
      `SELECT * FROM settlements WHERE id = ? AND seller_id = ?`
    ).bind(settlementId, sellerId).first<SettlementRow>();

    if (!settlement) return c.json({ success: false, error: '정산 내역을 찾을 수 없습니다' }, 404);

    // v34 CRITICAL FIX: 계좌번호 마스킹 (끝 4자리만 노출)
    // CSV 파일이 이메일/메신저로 공유되어도 plaintext 유출 방지
    const maskAccount = (acc: string | null | undefined): string => {
      if (!acc) return '';
      const s = String(acc);
      if (s.length <= 4) return '****';
      return '*'.repeat(Math.max(4, s.length - 4)) + s.slice(-4);
    };

    // CSV 형태로 반환
    const csv = [
      '정산ID,판매자ID,금액,상태,은행,계좌번호(마스킹),신청일',
      `${settlement.id},${settlement.seller_id},${settlement.amount},${settlement.status},${settlement.bank_name ?? ''},${maskAccount(settlement.account_number)},${settlement.created_at}`,
    ].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="settlement-${settlementId}.csv"`,
      },
    });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /api/seller/public/:sellerId ─────────────────────────────────────────
// 공개 셀러 프로필 조회 (ID 또는 slug/username으로 조회, 인증 불필요)
sellerManagementRoutes.get('/public/:sellerId', async (c) => {
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

    for (const opt of options) {
      await DB.prepare(
        `INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock_quantity, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(productId, opt.option_type, opt.option_value, opt.price_adjustment ?? 0, opt.stock_quantity ?? 0).run();
    }

    const updated = await DB.prepare(
      `SELECT * FROM product_options WHERE product_id = ? ORDER BY option_type, option_value`
    ).bind(productId).all();

    return c.json({ success: true, data: updated.results || [] }, 201);
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 🛡️ 2026-04-28 TD-006 (split): /alimtalk* 7개 핸들러 →
//   src/features/seller/api/seller-alimtalk-mgmt.routes.ts (worker/index.ts 에서 별도 mount)
//   /alimtalk/credits + /logs 는 alimtalk.routes.ts 가 처리 (path 비충돌)

// 🛡️ 2026-04-28 TD-006 (split): /link-kakao /unlink-kakao /kakao-link-status →
//   src/features/seller/api/seller-kakao-link.routes.ts (worker/index.ts 에서 별도 mount)
