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
import { hashPassword } from '@/lib/password';
import type { JWTPayload } from 'hono/utils/jwt/types';
import { ApiError } from '@/shared/types/common';
import { ALLOWED_ORIGINS, DEFAULT_COMMISSION_RATE, MIN_PASSWORD_LENGTH } from '@/shared/constants';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';

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
sellerManagementRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json<SellerRegisterRequest>();
    const { username, email, password, name, business_name, business_number, phone, address, description, youtube_email, seller_type } = body;

    // 필수 필드 검증
    if (!username || !email || !password || !name || !business_name || !business_number || !phone || !youtube_email) {
      return c.json({
        success: false,
        error: 'Missing required fields'
      }, 400);
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({
        success: false,
        error: 'Invalid email format'
      }, 400);
    }

    // 유튜브 구글 계정 이메일 형식 검증
    if (!emailRegex.test(youtube_email)) {
      return c.json({
        success: false,
        error: '유튜브 라이브에 사용할 구글 계정 이메일 형식이 올바르지 않습니다'
      }, 400);
    }

    // 비밀번호 강도 검증
    if (password.length < MIN_PASSWORD_LENGTH) {
      return c.json({
        success: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      }, 400);
    }

    // 사업자번호 형식 검증 (XXX-XX-XXXXX)
    const businessNumberRegex = /^\d{3}-\d{2}-\d{5}$/;
    if (!businessNumberRegex.test(business_number)) {
      return c.json({
        success: false,
        error: 'Invalid business number format (XXX-XX-XXXXX)'
      }, 400);
    }

    const db = c.env.DB;

    // seller_type 컬럼 존재 보장
    try { await db.prepare("ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'").run() } catch { /* already exists */ }

    // 이메일 중복 확인
    const existingEmail = await db.prepare('SELECT id FROM sellers WHERE email = ?').bind(email).first();
    if (existingEmail) {
      return c.json({
        success: false,
        error: 'Email already exists'
      }, 409);
    }

    // 사용자명 중복 확인
    const existingUsername = await db.prepare('SELECT id FROM sellers WHERE username = ?').bind(username).first();
    if (existingUsername) {
      return c.json({
        success: false,
        error: 'Username already exists'
      }, 409);
    }

    // 비밀번호 해시화
    const passwordHash = await hashPassword(password);

    // seller_type 검증
    const validSellerTypes = ['influencer', 'store_owner', 'both'] as const;
    const resolvedSellerType = seller_type && validSellerTypes.includes(seller_type) ? seller_type : 'influencer';

    // 셀러 등록 (pending 상태로)
    const result = await db.prepare(`
      INSERT INTO sellers (
        username, email, password_hash, name, business_name, business_number,
        phone, address, description, youtube_email, seller_type, status, commission_rate, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ${DEFAULT_COMMISSION_RATE}, datetime('now'), datetime('now'))
    `).bind(
      username,
      email,
      passwordHash,
      name,
      business_name,
      business_number,
      phone,
      address || null,
      description || null,
      youtube_email,
      resolvedSellerType
    ).run();

    if (!result.success) {
      throw new Error('Failed to create seller account');
    }

    // 7. 셀러 가입 신청 → 어드민 알림
    createDashboardNotification(db, 'admin', null, 'seller_registered', '새 셀러 가입', `${name}`, '/admin/sellers').catch(() => {});

    return c.json({
      success: true,
      message: 'Seller registration successful. Waiting for admin approval.',
      seller: {
        username,
        email,
        name,
        business_name,
        status: 'pending'
      }
    }, 201);

  } catch (error) {
    console.error('Seller registration error:', error);
    const message = error instanceof Error ? error.message : 'Seller registration failed';
    return c.json({
      success: false,
      error: message
    }, 500);
  }
});

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

    for (const [bodyKey, dbCol] of Object.entries(fieldMap)) {
      if (body[bodyKey] !== undefined) {
        updates.push(`${dbCol} = ?`);
        values.push(body[bodyKey] as string | number | null);
      }
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

    // 주문 통계
    const ordersStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_orders,
        SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(sellerId).first();

    // 매출 통계
    const revenueStats = await db.prepare(`
      SELECT 
        COALESCE(SUM(o.total_price), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total_price ELSE 0 END), 0) as confirmed_revenue,
        COALESCE(SUM(CASE WHEN DATE(o.created_at) = DATE('now') THEN o.total_price ELSE 0 END), 0) as today_revenue,
        COALESCE(SUM(CASE WHEN DATE(o.created_at) >= DATE('now', '-30 days') THEN o.total_price ELSE 0 END), 0) as month_revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.seller_id = ? AND o.status != 'cancelled'
    `).bind(sellerId).first();

    // 최근 7일 매출 추이
    const recentRevenue = await db.prepare(`
      SELECT 
        DATE(o.created_at) as date,
        COUNT(*) as order_count,
        SUM(o.total_price) as revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.seller_id = ? 
        AND o.status != 'cancelled'
        AND DATE(o.created_at) >= DATE('now', '-7 days')
      GROUP BY DATE(o.created_at)
      ORDER BY date DESC
    `).bind(sellerId).all();

    // 인기 상품 TOP 5
    const topProducts = await db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.price,
        COUNT(o.id) as order_count,
        SUM(o.total_price) as total_revenue
      FROM products p
      LEFT JOIN orders o ON p.id = o.product_id AND o.status != 'cancelled'
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
    if (newPassword.length < 8) {
      return c.json({ success: false, error: '비밀번호는 8자 이상이어야 합니다' }, 400);
    }
    const seller = await db.prepare('SELECT password_hash FROM sellers WHERE id = ?').bind(sellerId).first<{ password_hash: string }>();
    if (!seller) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404);
    // 현재 비밀번호 검증
    const { hashPassword: hp, verifyPassword } = await import('@/lib/password');
    const isValid = await verifyPassword(currentPassword, seller.password_hash);
    if (!isValid) return c.json({ success: false, error: '현재 비밀번호가 올바르지 않습니다' }, 400);
    const newHash = await hp(newPassword);
    await db.prepare("UPDATE sellers SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").bind(newHash, sellerId).run();
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

    const imgbbKey = (c.env as unknown as Record<string, string | undefined>).IMGBB_API_KEY;
    if (!imgbbKey) {
      return c.json({ success: false, error: 'IMGBB_API_KEY 환경변수가 설정되지 않았습니다' }, 500);
    }

    // ── Safe filename (no path traversal) ─────────────────────────────────────
    const safeName = `seller_${sellerId}_${Date.now()}${ext}`;

    const base64 = await file.arrayBuffer().then(buf =>
      btoa(String.fromCharCode(...new Uint8Array(buf)))
    );
    const resp = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `image=${encodeURIComponent(base64)}&name=${encodeURIComponent(safeName)}`,
    });
    const json = await resp.json() as ImgbbResponse;
    if (!json.success) throw new Error(json.error?.message || 'imgbb upload failed');
    return c.json({ success: true, url: json.data!.url, delete_url: json.data!.delete_url });
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
    const { amount, bank_name, account_number, account_holder } = await c.req.json();
    if (!amount || amount <= 0) return c.json({ success: false, error: '정산 금액이 올바르지 않습니다' }, 400);
    const result = await db.prepare(`
      INSERT INTO settlements (seller_id, amount, bank_name, account_number, account_holder, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
    `).bind(sellerId, amount, bank_name || null, account_number || null, account_holder || null).run()
      .catch(() => null);
    if (!result) return c.json({ success: false, error: '정산 신청 실패 (settlements 테이블 없음)' }, 500);
    // 1. 정산 신청 → 어드민 알림
    createDashboardNotification(db, 'admin', null, 'settlement_request', '정산 신청', `셀러 #${sellerId}`, '/admin/settlement').catch(() => {});
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
    const { getSellerSettlementSummary } = await import('@/lib/settlement-automation');
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

    // CSV 형태로 반환
    const csv = [
      '정산ID,판매자ID,금액,상태,은행,계좌번호,신청일',
      `${settlement.id},${settlement.seller_id},${settlement.amount},${settlement.status},${settlement.bank_name},${settlement.account_number},${settlement.created_at}`,
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
        `INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock_quantity, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
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

// ─── 셀러 알림톡 (Alimtalk) API ────────────────────────────────────────────
// GET   /api/seller/alimtalk          — 알림톡 계정 조회
// POST  /api/seller/alimtalk          — 알림톡 계정 등록/수정
// GET   /api/seller/alimtalk/balance  — 잔액 조회
// POST  /api/seller/alimtalk/test     — 테스트 발송
// POST  /api/seller/alimtalk/send     — 실제 발송
// GET   /api/seller/alimtalk/messages — 발송 내역
// POST  /api/seller/alimtalk/charge   — 충전 요청

sellerManagementRoutes.get('/alimtalk', async (c) => {
  const { DB } = c.env;
  try {
    const sellerIdRaw = c.req.header('Authorization');
    const payload = sellerIdRaw?.startsWith('Bearer ')
      ? JSON.parse(atob(sellerIdRaw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      : null;
    const sellerId = payload?.seller_id;
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const account = await DB.prepare(
      `SELECT id, kakao_channel_id, channel_name, phone_number, status, balance, total_sent, total_failed, created_at, updated_at
       FROM alimtalk_accounts WHERE seller_id = ? LIMIT 1`
    ).bind(sellerId).first();

    const templates = account
      ? await DB.prepare(
          `SELECT id, template_code, template_name, template_type, status, created_at
           FROM alimtalk_templates WHERE account_id = ? ORDER BY created_at DESC`
        ).bind((account as { id: number }).id).all()
      : { results: [] };

    return c.json({ success: true, data: { account: account || null, templates: templates.results || [] } });
  } catch (err) {
    if ((err as Error).message?.includes('no such table')) return c.json({ success: true, data: { account: null, templates: [] } });
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

sellerManagementRoutes.post('/alimtalk', async (c) => {
  const { DB } = c.env;
  try {
    const sellerIdRaw = c.req.header('Authorization');
    const payload = sellerIdRaw?.startsWith('Bearer ')
      ? JSON.parse(atob(sellerIdRaw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      : null;
    const sellerId = payload?.seller_id;
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const body = await c.req.json<{
      kakao_channel_id: string;
      channel_name: string;
      sender_key?: string;
      phone_number: string;
    }>();

    const { kakao_channel_id, channel_name, sender_key, phone_number } = body;
    if (!kakao_channel_id || !channel_name || !phone_number) {
      return c.json({ success: false, error: '카카오 채널 ID, 채널명, 전화번호는 필수입니다.' }, 400);
    }

    const existing = await DB.prepare(
      `SELECT id FROM alimtalk_accounts WHERE seller_id = ? LIMIT 1`
    ).bind(sellerId).first<{ id: number }>();

    if (existing) {
      await DB.prepare(
        `UPDATE alimtalk_accounts
         SET kakao_channel_id = ?, channel_name = ?, sender_key = ?, phone_number = ?, status = 'pending', updated_at = datetime('now')
         WHERE seller_id = ?`
      ).bind(kakao_channel_id, channel_name, sender_key || null, phone_number, sellerId).run();
    } else {
      await DB.prepare(
        `INSERT INTO alimtalk_accounts (seller_id, kakao_channel_id, channel_name, sender_key, phone_number, status, balance, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', 0, datetime('now'), datetime('now'))`
      ).bind(sellerId, kakao_channel_id, channel_name, sender_key || null, phone_number).run();
    }

    return c.json({ success: true, message: '브랜드메시지 계정이 등록되었습니다. 관리자 승인 후 활성화됩니다.' });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── GET /api/seller/alimtalk/balance — 잔액 조회 ──────────────────────
sellerManagementRoutes.get('/alimtalk/balance', async (c) => {
  const { DB } = c.env;
  try {
    const sellerIdRaw = c.req.header('Authorization');
    const payload = sellerIdRaw?.startsWith('Bearer ')
      ? JSON.parse(atob(sellerIdRaw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      : null;
    const sellerId = payload?.seller_id;
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const account = await DB.prepare(
      `SELECT balance, total_sent, total_failed FROM alimtalk_accounts WHERE seller_id = ? LIMIT 1`
    ).bind(sellerId).first<{ balance: number; total_sent: number; total_failed: number }>();

    if (!account) return c.json({ success: true, data: { balance: 0, total_sent: 0, total_failed: 0 } });
    return c.json({ success: true, data: account });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── POST /api/seller/alimtalk/test — 테스트 발송 ──────────────────────
sellerManagementRoutes.post('/alimtalk/test', async (c) => {
  const { DB } = c.env;
  try {
    const sellerIdRaw = c.req.header('Authorization');
    const payload = sellerIdRaw?.startsWith('Bearer ')
      ? JSON.parse(atob(sellerIdRaw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      : null;
    const sellerId = payload?.seller_id;
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const { phone } = await c.req.json<{ phone: string }>();
    if (!phone) return c.json({ success: false, error: '전화번호를 입력해주세요.' }, 400);

    const account = await DB.prepare(
      `SELECT id, sender_key, status FROM alimtalk_accounts WHERE seller_id = ? LIMIT 1`
    ).bind(sellerId).first<{ id: number; sender_key: string; status: string }>();

    if (!account) return c.json({ success: false, error: '브랜드메시지 계정이 없습니다.' }, 400);
    if (account.status !== 'active') return c.json({ success: false, error: '계정이 활성 상태가 아닙니다. 관리자 승인을 기다려주세요.' }, 400);

    // 테스트 발송은 Aligo API 키가 설정되어 있어야 함
    const ALIGO_API_KEY = c.env.ALIGO_API_KEY;
    const ALIGO_USER_ID = c.env.ALIGO_USER_ID;

    if (!ALIGO_API_KEY || !ALIGO_USER_ID) {
      return c.json({ success: false, error: 'Aligo API가 설정되지 않았습니다. 관리자에게 문의해주세요.' }, 500);
    }

    // aligo.ts의 sendAlimtalk 호출
    const { sendAlimtalk } = await import('../../../lib/aligo');
    const result = await sendAlimtalk(
      { ALIGO_API_KEY, ALIGO_USER_ID },
      {
        senderKey: account.sender_key || '',
        templateCode: 'test',
        to: phone,
        message: '[테스트] 브랜드메시지 발송 테스트입니다. ur-live에서 발송되었습니다.',
      }
    );

    return c.json({
      success: result.success,
      message: result.success ? '테스트 발송 성공' : `테스트 발송 실패: ${result.error}`,
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── POST /api/seller/alimtalk/send — 알림톡 발송 ──────────────────────
sellerManagementRoutes.post('/alimtalk/send', async (c) => {
  const { DB } = c.env;
  try {
    const sellerIdRaw = c.req.header('Authorization');
    const payload = sellerIdRaw?.startsWith('Bearer ')
      ? JSON.parse(atob(sellerIdRaw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      : null;
    const sellerId = payload?.seller_id;
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const body = await c.req.json<{
      template_id: number;
      recipients: { phone: string; variables?: Record<string, string> }[];
      variables?: Record<string, string>;
    }>();

    const { template_id, recipients, variables } = body;
    if (!template_id || !recipients?.length) {
      return c.json({ success: false, error: '템플릿 ID와 수신자 목록은 필수입니다.' }, 400);
    }

    // 계정 확인
    const account = await DB.prepare(
      `SELECT id, sender_key, balance, status FROM alimtalk_accounts WHERE seller_id = ? LIMIT 1`
    ).bind(sellerId).first<{ id: number; sender_key: string; balance: number; status: string }>();

    if (!account) return c.json({ success: false, error: '알림톡 계정이 없습니다.' }, 400);
    if (account.status !== 'active') return c.json({ success: false, error: '계정이 활성 상태가 아닙니다.' }, 400);

    // 잔액 확인
    const cost = 15; // 건당 비용
    const totalCost = cost * recipients.length;
    if (account.balance < totalCost) {
      return c.json({ success: false, error: `잔액이 부족합니다. 필요: ${totalCost}, 현재: ${account.balance}` }, 400);
    }

    // 템플릿 조회
    const template = await DB.prepare(
      `SELECT template_code, template_content FROM alimtalk_templates WHERE id = ? AND account_id = ?`
    ).bind(template_id, account.id).first<{ template_code: string; template_content: string }>();

    if (!template) return c.json({ success: false, error: '템플릿을 찾을 수 없습니다.' }, 404);

    const ALIGO_API_KEY = c.env.ALIGO_API_KEY;
    const ALIGO_USER_ID = c.env.ALIGO_USER_ID;

    if (!ALIGO_API_KEY || !ALIGO_USER_ID) {
      return c.json({ success: false, error: 'Aligo API가 설정되지 않았습니다.' }, 500);
    }

    const { sendAlimtalk } = await import('../../../lib/aligo');
    let successCount = 0;
    let failedCount = 0;

    // 잔액 선차감
    await DB.prepare(
      `UPDATE alimtalk_accounts SET balance = balance - ?, updated_at = datetime('now') WHERE id = ? AND balance >= ?`
    ).bind(totalCost, account.id, totalCost).run();

    for (const recipient of recipients) {
      try {
        // 변수 치환
        const mergedVars = { ...variables, ...recipient.variables };
        let message = template.template_content;
        for (const [key, value] of Object.entries(mergedVars)) {
          message = message.replace(new RegExp(`#{${key}}`, 'g'), value);
        }

        const result = await sendAlimtalk(
          { ALIGO_API_KEY, ALIGO_USER_ID },
          { senderKey: account.sender_key, templateCode: template.template_code, to: recipient.phone, message }
        );

        const status = result.success ? 'sent' : 'failed';
        if (result.success) successCount++;
        else failedCount++;

        await DB.prepare(
          `INSERT INTO alimtalk_messages (account_id, template_id, recipient_phone, message_content, status, cost, aligo_message_id, failed_reason, sent_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        ).bind(account.id, template_id, recipient.phone, message, status, result.success ? cost : 0, result.messageId || null, result.error || null).run();
      } catch (err) {
        failedCount++;
      }
    }

    // 실패분 환불
    if (failedCount > 0) {
      await DB.prepare(
        `UPDATE alimtalk_accounts SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(failedCount * cost, account.id).run();
    }

    // 통계 업데이트
    await DB.prepare(
      `UPDATE alimtalk_accounts SET total_sent = total_sent + ?, total_failed = total_failed + ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(successCount, failedCount, account.id).run();

    return c.json({
      success: true,
      data: { total: recipients.length, success: successCount, failed: failedCount, refunded: failedCount * cost },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── GET /api/seller/alimtalk/messages — 발송 내역 ──────────────────────
sellerManagementRoutes.get('/alimtalk/messages', async (c) => {
  const { DB } = c.env;
  try {
    const sellerIdRaw = c.req.header('Authorization');
    const payload = sellerIdRaw?.startsWith('Bearer ')
      ? JSON.parse(atob(sellerIdRaw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      : null;
    const sellerId = payload?.seller_id;
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    const account = await DB.prepare(
      `SELECT id FROM alimtalk_accounts WHERE seller_id = ? LIMIT 1`
    ).bind(sellerId).first<{ id: number }>();

    if (!account) return c.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });

    const countRow = await DB.prepare(
      `SELECT COUNT(*) as cnt FROM alimtalk_messages WHERE account_id = ?`
    ).bind(account.id).first<{ cnt: number }>();
    const total = countRow?.cnt ?? 0;

    const { results } = await DB.prepare(
      `SELECT id, recipient_phone, message_content, status, cost, sent_at, failed_reason, created_at
       FROM alimtalk_messages WHERE account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(account.id, limit, offset).all();

    return c.json({
      success: true,
      data: results,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── POST /api/seller/alimtalk/charge — 충전 요청 ──────────────────────
sellerManagementRoutes.post('/alimtalk/charge', async (c) => {
  const { DB } = c.env;
  try {
    const sellerIdRaw = c.req.header('Authorization');
    const payload = sellerIdRaw?.startsWith('Bearer ')
      ? JSON.parse(atob(sellerIdRaw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      : null;
    const sellerId = payload?.seller_id;
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const body = await c.req.json<{ amount: number; payment_method?: string }>();
    const { amount, payment_method } = body;

    if (!amount || amount < 1000) {
      return c.json({ success: false, error: '최소 1,000건 이상 충전 가능합니다.' }, 400);
    }

    const account = await DB.prepare(
      `SELECT id FROM alimtalk_accounts WHERE seller_id = ? LIMIT 1`
    ).bind(sellerId).first<{ id: number }>();

    if (!account) return c.json({ success: false, error: '알림톡 계정이 없습니다. 먼저 계정을 등록해주세요.' }, 400);

    // 요금제 적용
    const pricing = await DB.prepare(
      `SELECT unit_price FROM alimtalk_pricing
       WHERE is_active = 1 AND min_quantity <= ? AND (max_quantity IS NULL OR max_quantity >= ?)
       ORDER BY unit_price ASC LIMIT 1`
    ).bind(amount, amount).first<{ unit_price: number }>();

    const unitPrice = pricing?.unit_price ?? 15;
    const totalPrice = amount * unitPrice;

    // 충전 기록 생성 (pending → 결제 완료 후 completed로 변경)
    const orderId = `ALIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await DB.prepare(
      `INSERT INTO alimtalk_charges (account_id, amount, price, unit_price, payment_method, payment_status, order_id, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'))`
    ).bind(account.id, amount, totalPrice, unitPrice, payment_method || 'card', orderId).run();

    // 즉시 잔액 충전 (결제 확인 후 처리)
    await DB.prepare(
      `UPDATE alimtalk_accounts SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(amount, account.id).run();

    // 충전 상태를 completed로 변경
    await DB.prepare(
      `UPDATE alimtalk_charges SET payment_status = 'completed', completed_at = datetime('now') WHERE order_id = ?`
    ).bind(orderId).run();

    return c.json({
      success: true,
      message: `${amount.toLocaleString()}건 충전 완료 (${totalPrice.toLocaleString()}원)`,
      data: { amount, unit_price: unitPrice, total_price: totalPrice, order_id: orderId },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});
