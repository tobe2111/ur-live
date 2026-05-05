/**
 * 🛡️ 2026-04-28 TD-006 (split): Seller Profile + Business-Info (4 endpoints)
 *
 * 원본: seller-management.routes.ts (185-553).
 *
 * - GET            /profile         — 셀러 프로필 조회
 * - PUT/PATCH      /profile         — 프로필 수정
 * - GET            /business-info   — 사업자 정보 조회
 * - POST/PUT/PATCH /business-info   — 사업자 정보 등록/수정
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verify } from 'hono/jwt'
import type { JWTPayload } from 'hono/utils/jwt/types'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { getSellerIdFromToken, type SellerJWTPayload } from '@/lib/seller-shared'
import { swallow } from '@/worker/utils/swallow'
import { isPinVerified } from './seller-pin.routes'

type Bindings = { DB: D1Database; JWT_SECRET: string }
interface SellerProfileUpdate {
  name?: string
  business_name?: string
  phone?: string
  address?: string
  description?: string
  bank_account?: string
  bank_name?: string
  account_holder?: string
}

interface BusinessInfoUpdate {
  business_number?: string
  business_registration_file?: string
  tax_email?: string
  representative_name?: string
  business_address?: string
}

export const sellerProfileRoutes = new Hono<{ Bindings: Bindings }>()
sellerProfileRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))
sellerProfileRoutes.get('/profile', async (c) => {
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
sellerProfileRoutes.on(['PUT', 'PATCH'], '/profile', async (c) => {
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
sellerProfileRoutes.get('/business-info', async (c) => {
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
sellerProfileRoutes.on(['POST', 'PUT', 'PATCH'], '/business-info', async (c) => {
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
