/**
 * Seller Login API Routes
 * 
 * Endpoints:
 * - POST /api/seller/login - 셀러 로그인
 * - POST /api/seller/refresh - Access Token 갱신
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import { rateLimit } from '@/worker/middleware/rate-limit';
import { verifyPassword, hashPassword } from '@/lib/password';
import { sendEmail } from '@/services/email';
import type { AuthResponse } from '../types';
import {
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  internalServerErrorResponse
} from '@/worker/utils/response';
import { validateRequired } from '@/worker/utils/validation';
import { executeQuery } from '@/worker/utils/database';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  FRONTEND_URL?: string;
};

// ── 비밀번호 재설정 토큰 테이블 보장 ─────────────────────────
async function ensurePasswordResetTable(DB: D1Database) {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)'
  ).run().catch(() => {});
}

/** 32자 hex 토큰 생성 (Web Crypto) */
function generateResetToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 비밀번호 재설정 이메일 HTML */
function getPasswordResetEmailHTML(resetUrl: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1d1d1f;">
      <h2 style="font-size:20px;margin:0 0 16px;">유어딜 비밀번호 재설정</h2>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
        아래 링크를 클릭하여 새 비밀번호를 설정하세요. (1시간 유효)
      </p>
      <p style="margin:24px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
          비밀번호 재설정하기
        </a>
      </p>
      <p style="font-size:13px;color:#666;line-height:1.6;margin-top:24px;">
        요청하지 않았다면 이 이메일을 무시하세요.<br>
        링크가 동작하지 않을 경우 아래 URL을 복사해 주소창에 붙여넣으세요:<br>
        <span style="word-break:break-all;color:#2563eb;">${resetUrl}</span>
      </p>
    </div>
  `;
}

type SellerLoginRequest = {
  email: string;
  password: string;
};

type SellerLoginResponse = {
  token: string;
  seller: {
    id: number;
    username: string;
    email: string;
    name: string;
    business_name: string;
    status: string;
    commission_rate: number;
    seller_type: string;
  };
};

export const sellerRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * POST /api/seller/login
 * 셀러 로그인
 * 
 * Request body:
 * - email: 이메일
 * - password: 비밀번호
 * 
 * Response:
 * - token: JWT access token
 * - seller: 셀러 정보
 */
sellerRoutes.post('/login', cors(), rateLimit({ action: 'seller_login', max: 10, windowSec: 300 }), async (c) => {
  const { DB, JWT_SECRET } = c.env;
  
  try {
    // JWT_SECRET 확인
    if (!JWT_SECRET) {
      console.error('[Seller Login] JWT_SECRET not configured');
      return c.json<AuthResponse>({ 
        success: false, 
        error: 'Server configuration error',
        code: 'MISSING_JWT_SECRET'
      }, 500);
    }

    // Request body 파싱
    const body = await c.req.json<SellerLoginRequest>();
    const { email, password } = body;
    
    // Validation
    if (!email || !password) {
      return c.json<AuthResponse>({ 
        success: false, 
        error: '이메일과 비밀번호를 입력해주세요.' 
      }, 400);
    }
    
    // seller_type 컬럼 존재 보장
    try { await DB.prepare("ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'").run() } catch { /* already exists */ }

    // 1. 이메일로 셀러 조회
    const seller = await DB.prepare(`
      SELECT
        id, username, email, password_hash, name,
        business_name, business_number, phone, status, commission_rate,
        seller_type, created_at, updated_at
      FROM sellers
      WHERE email = ?
    `).bind(email).first<Record<string, any>>();
    
    if (!seller) {
      console.warn('[Seller Login] Seller not found:', email);
      return c.json<AuthResponse>({ 
        success: false, 
        error: '이메일 또는 비밀번호가 올바르지 않습니다.' 
      }, 401);
    }
    
    // 2. 계정 상태 확인
    if (seller.status === 'suspended') {
      console.warn('[Seller Login] Account suspended:', email);
      return c.json<AuthResponse>({ 
        success: false, 
        error: '정지된 계정입니다. 관리자에게 문의하세요.',
        code: 'ACCOUNT_SUSPENDED'
      }, 403);
    }
    
    if (seller.status === 'pending') {
      console.warn('[Seller Login] Account pending approval:', email);
      return c.json<AuthResponse>({ 
        success: false, 
        error: '승인 대기 중인 계정입니다. 관리자 승인 후 이용 가능합니다.',
        code: 'ACCOUNT_PENDING'
      }, 403);
    }
    
    // 3. 비밀번호 검증
    const passwordHash = seller.password_hash as string;
    const { valid } = await verifyPassword(password, passwordHash);

    if (!valid) {
      if (import.meta.env.DEV) console.warn('[Seller Login] Invalid password');
      return c.json<AuthResponse>({ 
        success: false, 
        error: '이메일 또는 비밀번호가 올바르지 않습니다.' 
      }, 401);
    }
    
    // 4. JWT 생성
    const payload = {
      sub: seller.id.toString(),
      seller_id: seller.id as number, // ✅ Added for compatibility with seller-management routes
      email: seller.email,
      name: seller.name,
      username: seller.username,
      type: 'seller',
      status: seller.status,
      seller_type: (seller.seller_type as string) || 'influencer',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7일
    };
    
    const token = await sign(payload, JWT_SECRET);
    
    // ✅ Generate refresh token (longer expiry: 30 days)
    const refreshPayload = {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30일
    };
    const refreshToken = await sign(refreshPayload, JWT_SECRET);
    
    // 5. 응답 반환 (frontend expects accessToken & refreshToken)
    return c.json({
      success: true,
      data: {
        accessToken: token,
        refreshToken: refreshToken,
        token, // backward compatibility
        seller: {
          id: seller.id as number,
          username: seller.username as string,
          email: seller.email as string,
          name: seller.name as string,
          business_name: seller.business_name as string,
          status: seller.status as string,
          commission_rate: seller.commission_rate as number,
          seller_type: (seller.seller_type as string) || 'influencer'
        }
      }
    });
    
  } catch (error) {
    console.error('[Seller Login] Error:', error);
    
    const errorMsg = (error as Error).message || 'Unknown error';
    const statusCode = errorMsg.includes('Database') ? 500 : 500;
    
    return c.json<AuthResponse>({
      success: false,
      error: '로그인 중 오류가 발생했습니다.',
      code: 'SELLER_LOGIN_FAILED'
    }, statusCode);
  }
});

/**
 * POST /api/seller/refresh
 * Refresh Token으로 새 Access Token 발급
 * 
 * Request body:
 * - refreshToken: Refresh Token (JWT)
 * 
 * Response:
 * - accessToken: 새 Access Token (7일)
 * - refreshToken: 새 Refresh Token (30일, 선택사항)
 */
sellerRoutes.post('/refresh', cors(), async (c) => {
  const { DB, JWT_SECRET } = c.env;
  
  try {
    // JWT_SECRET 확인
    if (!JWT_SECRET) {
      console.error('[Seller Refresh] JWT_SECRET not configured');
      return c.json<AuthResponse>({ 
        success: false, 
        error: 'Server configuration error',
        code: 'MISSING_JWT_SECRET'
      }, 500);
    }

    // Request body 파싱
    const body = await c.req.json<{ refreshToken: string }>();
    const { refreshToken } = body;
    
    if (!refreshToken) {
      return c.json<AuthResponse>({ 
        success: false, 
        error: 'Refresh Token이 필요합니다.' 
      }, 400);
    }
    
    // 1. Refresh Token 검증
    let payload: any;
    try {
      payload = await verify(refreshToken, JWT_SECRET, 'HS256');
    } catch (error) {
      console.warn('[Seller Refresh] Invalid refresh token:', error);
      return c.json<AuthResponse>({ 
        success: false, 
        error: 'Refresh Token이 유효하지 않거나 만료되었습니다.',
        code: 'INVALID_REFRESH_TOKEN'
      }, 401);
    }
    
    // 2. Refresh Token 타입 확인
    if (payload.type !== 'seller') {
      console.warn('[Seller Refresh] Invalid token type:', payload.type);
      return c.json<AuthResponse>({ 
        success: false, 
        error: 'Seller Refresh Token이 아닙니다.',
        code: 'INVALID_TOKEN_TYPE'
      }, 401);
    }
    
    // seller_type 컬럼 존재 보장
    try { await DB.prepare("ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'").run() } catch { /* already exists */ }

    // 3. DB에서 셀러 정보 조회 (계정 상태 확인)
    const sellerId = payload.seller_id || payload.sub;
    const seller = await DB.prepare(`
      SELECT id, email, name, username, status, business_name, commission_rate, seller_type
      FROM sellers
      WHERE id = ?
    `).bind(sellerId).first<Record<string, any>>();
    
    if (!seller) {
      console.warn('[Seller Refresh] Seller not found:', sellerId);
      return c.json<AuthResponse>({ 
        success: false, 
        error: '계정을 찾을 수 없습니다.',
        code: 'SELLER_NOT_FOUND'
      }, 401);
    }
    
    // 4. 계정 상태 확인
    if (seller.status === 'suspended') {
      console.warn('[Seller Refresh] Account suspended:', sellerId);
      return c.json<AuthResponse>({ 
        success: false, 
        error: '정지된 계정입니다.',
        code: 'ACCOUNT_SUSPENDED'
      }, 403);
    }
    
    if (seller.status !== 'approved' && seller.status !== 'active') {
      console.warn('[Seller Refresh] Account not approved:', sellerId, seller.status);
      return c.json<AuthResponse>({
        success: false,
        error: '활성화되지 않은 계정입니다.',
        code: 'ACCOUNT_NOT_ACTIVE'
      }, 403);
    }
    
    // 5. 새 Access Token 생성
    const newPayload = {
      sub: seller.id.toString(),
      seller_id: seller.id as number,
      email: seller.email,
      name: seller.name,
      username: seller.username,
      type: 'seller',
      status: seller.status,
      seller_type: (seller.seller_type as string) || 'influencer',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7일
    };
    
    const newAccessToken = await sign(newPayload, JWT_SECRET);
    
    // 6. 새 Refresh Token 생성 (선택사항, 보안 강화)
    const newRefreshPayload = {
      ...newPayload,
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30일
    };
    const newRefreshToken = await sign(newRefreshPayload, JWT_SECRET);
    
    // 7. 응답 반환
    return c.json<AuthResponse>({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken, // 새 Refresh Token 제공
        seller: {
          id: seller.id as number,
          username: seller.username as string,
          email: seller.email as string,
          name: seller.name as string,
          business_name: seller.business_name as string,
          status: seller.status as string,
          commission_rate: seller.commission_rate as number,
          seller_type: (seller.seller_type as string) || 'influencer'
        }
      }
    });
    
  } catch (error) {
    console.error('[Seller Refresh] Error:', error);
    
    return c.json<AuthResponse>({
      success: false,
      error: '토큰 갱신 중 오류가 발생했습니다.',
      code: 'SELLER_REFRESH_FAILED'
    }, 500);
  }
});

/**
 * POST /api/seller/forgot-password
 * 비밀번호 재설정 이메일 발송 요청
 *
 * Request body:
 * - email: 이메일
 *
 * Response:
 * - 항상 success: true (이메일 존재 여부 노출 방지)
 */
sellerRoutes.post('/forgot-password', cors(), rateLimit({ action: 'seller_forgot_password', max: 5, windowSec: 600 }), async (c) => {
  const { DB, RESEND_API_KEY, RESEND_FROM, FRONTEND_URL } = c.env;

  try {
    const body = await c.req.json<{ email: string }>();
    const email = (body?.email || '').trim();

    if (!email) {
      return c.json<AuthResponse>({
        success: false,
        error: '이메일을 입력해주세요.'
      }, 400);
    }

    await ensurePasswordResetTable(DB);

    // 이메일로 셀러 조회 (존재 여부는 응답에서 숨김)
    const seller = await DB.prepare('SELECT id, email, name FROM sellers WHERE email = ?')
      .bind(email).first<{ id: number; email: string; name: string }>();

    if (seller) {
      // 토큰 생성 및 저장 (1시간 유효)
      const token = generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await DB.prepare(`
        INSERT INTO password_reset_tokens (user_type, user_id, token, expires_at)
        VALUES ('seller', ?, ?, ?)
      `).bind(seller.id, token, expiresAt).run();

      const baseUrl = FRONTEND_URL || 'https://live.ur-team.com';
      const resetUrl = `${baseUrl}/seller/reset-password?token=${token}`;

      if (RESEND_API_KEY) {
        await sendEmail(
          {
            to: seller.email,
            subject: '[유어딜] 셀러 비밀번호 재설정 안내',
            html: getPasswordResetEmailHTML(resetUrl),
          },
          RESEND_API_KEY,
          RESEND_FROM
        ).catch((e) => console.error('[Seller ForgotPassword] Email send failed:', e));
      } else {
        console.warn('[Seller ForgotPassword] RESEND_API_KEY not configured; skipping email. resetUrl=', resetUrl);
      }
    } else {
      console.info('[Seller ForgotPassword] Unknown email (silent):', email);
    }

    // 이메일 존재 여부와 무관하게 동일 응답
    return c.json({
      success: true,
      message: '입력하신 이메일로 비밀번호 재설정 링크를 발송했습니다. 이메일을 확인해주세요.'
    });
  } catch (error) {
    console.error('[Seller ForgotPassword] Error:', error);
    // 에러도 동일 메시지로 반환하여 이메일 노출 방지
    return c.json({
      success: true,
      message: '입력하신 이메일로 비밀번호 재설정 링크를 발송했습니다. 이메일을 확인해주세요.'
    });
  }
});

/**
 * POST /api/seller/reset-password
 * 토큰 기반 비밀번호 재설정
 *
 * Request body:
 * - token: 재설정 토큰
 * - newPassword: 새 비밀번호
 */
sellerRoutes.post('/reset-password', cors(), rateLimit({ action: 'seller_reset_password', max: 10, windowSec: 600 }), async (c) => {
  const { DB } = c.env;

  try {
    const body = await c.req.json<{ token: string; newPassword: string }>();
    const token = (body?.token || '').trim();
    const newPassword = body?.newPassword || '';

    if (!token || !newPassword) {
      return c.json<AuthResponse>({
        success: false,
        error: '토큰과 새 비밀번호를 입력해주세요.'
      }, 400);
    }

    if (newPassword.length < 8) {
      return c.json<AuthResponse>({
        success: false,
        error: '비밀번호는 8자 이상이어야 합니다.'
      }, 400);
    }

    await ensurePasswordResetTable(DB);

    // 토큰 조회
    const row = await DB.prepare(`
      SELECT id, user_id, expires_at
      FROM password_reset_tokens
      WHERE token = ? AND user_type = 'seller'
    `).bind(token).first<{ id: number; user_id: number; expires_at: string }>();

    if (!row) {
      return c.json<AuthResponse>({
        success: false,
        error: '유효하지 않은 토큰입니다. 비밀번호 재설정을 다시 요청해주세요.',
        code: 'INVALID_RESET_TOKEN'
      }, 400);
    }

    // 만료 체크
    const expiresAt = new Date(row.expires_at).getTime();
    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      await DB.prepare('DELETE FROM password_reset_tokens WHERE id = ?').bind(row.id).run().catch(() => {});
      return c.json<AuthResponse>({
        success: false,
        error: '토큰이 만료되었습니다. 비밀번호 재설정을 다시 요청해주세요.',
        code: 'EXPIRED_RESET_TOKEN'
      }, 400);
    }

    // 비밀번호 해싱 및 업데이트
    const hash = await hashPassword(newPassword);
    await DB.prepare(`
      UPDATE sellers SET password_hash = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(hash, row.user_id).run();

    // 토큰 삭제 (단일 사용)
    await DB.prepare('DELETE FROM password_reset_tokens WHERE id = ?').bind(row.id).run().catch(() => {});

    return c.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.'
    });
  } catch (error) {
    console.error('[Seller ResetPassword] Error:', error);
    return c.json<AuthResponse>({
      success: false,
      error: '비밀번호 재설정 중 오류가 발생했습니다.',
      code: 'SELLER_RESET_PASSWORD_FAILED'
    }, 500);
  }
});

export default sellerRoutes;
