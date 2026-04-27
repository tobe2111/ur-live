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
import { verifyPassword, hashPassword, validatePasswordComplexity } from '@/lib/password';
import { sendEmail } from '@/services/email';
import type { AuthResponse } from '../types';
import {
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  internalServerErrorResponse
} from '@/worker/utils/response';
import { maskEmail } from '@/lib/mask';
import { checkLockout, recordFailure, clearFailures } from '@/worker/utils/account-lockout';

import { swallow } from '@/worker/utils/swallow';
type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  FRONTEND_URL?: string;
};

/**
 * refresh_tokens 보조 테이블 (admin/seller용) 생성.
 * admin.routes.ts의 동명 함수와 동일 스키마. 멱등(IF NOT EXISTS).
 */
async function ensureAuthRefreshTokensTable(DB: D1Database) {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run().catch(swallow('auth:api:seller'));
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user ON auth_refresh_tokens(user_type, user_id)'
  ).run().catch(swallow('auth:api:seller'));
}

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
  `).run().catch(swallow('auth:api:seller'));
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)'
  ).run().catch(swallow('auth:api:seller'));
}

/** 32자 hex 토큰 생성 (Web Crypto) */
function generateResetToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 비밀번호 재설정 이메일 HTML */
function getPasswordResetEmailHTML(resetUrl: string): string {
  // 🛡️ 2026-04-22: GDPR/반스팸법 준수 — 모든 마케팅/시스템 이메일에 unsubscribe 링크 + 발신자 정보 포함.
  // 비밀번호 재설정은 거래성(transactional)이라 unsubscribe 의무는 약하나 footer 표준화.
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
      <hr style="border:none;border-top:1px solid #e5e5e7;margin:32px 0 16px;">
      <p style="font-size:11px;color:#999;line-height:1.5;text-align:center;">
        본 메일은 비밀번호 재설정 요청에 의한 발송입니다.<br>
        <strong>리스터코퍼레이션</strong> | 사업자등록번호: 783-87-03224<br>
        문의: <a href="mailto:contact@ur-team.com" style="color:#666;">contact@ur-team.com</a><br>
        <a href="https://live.ur-team.com/account/notifications" style="color:#666;">알림 설정 변경</a>
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
    
    // 누락 가능한 컬럼 자동 추가 (idempotent — 이미 있으면 throw → catch)
    try { await DB.prepare("ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'").run() } catch { /* already exists */ }
    try { await DB.prepare("ALTER TABLE sellers ADD COLUMN commission_rate REAL DEFAULT 10.00").run() } catch { /* already exists */ }
    try { await DB.prepare("ALTER TABLE sellers ADD COLUMN business_number TEXT").run() } catch { /* already exists */ }
    try { await DB.prepare("ALTER TABLE sellers ADD COLUMN phone TEXT").run() } catch { /* already exists */ }
    try { await DB.prepare("ALTER TABLE sellers ADD COLUMN business_name TEXT").run() } catch { /* already exists */ }

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
      if (import.meta.env.DEV) console.warn('[Seller Login] Seller not found:', maskEmail(email));
      // 🛡️ 2026-04-22: 타이밍 공격 방어 — 존재하지 않는 계정에도 verifyPassword 실행
      await verifyPassword(password, '$2b$10$CwTycUXWue0Thq9StjUM0uJ8mS8bL7JmJg0jVRjyZj3X5kQKqRHqO').catch(swallow('auth:api:seller'));
      return c.json<AuthResponse>({
        success: false,
        error: '이메일 또는 비밀번호가 올바르지 않습니다.'
      }, 401);
    }

    // 2. 계정 상태 확인
    if (seller.status === 'suspended') {
      if (import.meta.env.DEV) console.warn('[Seller Login] Account suspended:', maskEmail(email));
      return c.json<AuthResponse>({
        success: false,
        error: '정지된 계정입니다. 관리자에게 문의하세요.',
        code: 'ACCOUNT_SUSPENDED'
      }, 403);
    }

    if (seller.status === 'pending') {
      if (import.meta.env.DEV) console.warn('[Seller Login] Account pending approval:', maskEmail(email));
      return c.json<AuthResponse>({
        success: false,
        error: '승인 대기 중인 계정입니다. 관리자 승인 후 이용 가능합니다.',
        code: 'ACCOUNT_PENDING'
      }, 403);
    }

    // 🛡️ 2026-04-22: 계정 잠금 확인 (brute force 방어)
    const lockStatus = await checkLockout(DB, 'seller', String(seller.id));
    if (lockStatus.locked) {
      return c.json<AuthResponse>({
        success: false,
        error: lockStatus.reason || '계정이 일시 잠금되었습니다.',
        code: 'ACCOUNT_LOCKED',
      }, 423); // 423 Locked
    }

    // 3. 비밀번호 검증
    const passwordHash = seller.password_hash as string;
    const { valid } = await verifyPassword(password, passwordHash);

    if (!valid) {
      if (import.meta.env.DEV) console.warn('[Seller Login] Invalid password for:', maskEmail(email));
      // 🛡️ 실패 카운터 증가
      await recordFailure(DB, 'seller', String(seller.id));
      return c.json<AuthResponse>({
        success: false,
        error: '이메일 또는 비밀번호가 올바르지 않습니다.'
      }, 401);
    }

    // 🛡️ 성공 시 실패 카운터 초기화
    await clearFailures(DB, 'seller', String(seller.id));
    
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
    const nowSec = Math.floor(Date.now() / 1000);
    const refreshPayload = {
      ...payload,
      exp: nowSec + (30 * 24 * 60 * 60) // 30일
    };
    const refreshToken = await sign(refreshPayload, JWT_SECRET);

    // ── refresh token 해시 저장 (rotation 기반) ─────────────
    try {
      await ensureAuthRefreshTokensTable(DB);
      const refreshHash = await hashPassword(refreshToken);
      await DB.prepare(
        `INSERT INTO auth_refresh_tokens (user_type, user_id, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`
      ).bind(
        'seller',
        seller.id,
        refreshHash,
        new Date((nowSec + 30 * 24 * 3600) * 1000).toISOString()
      ).run();
    } catch (e) {
      console.error('[Seller Login] refresh token persist failed:', e);
    }
    
    // 🛡️ 2026-04-22 Phase 1: httpOnly 쿠키 추가 발급 (기존 Bearer 병행)
    // 클라이언트 변경 없이 쿠키가 자동으로 브라우저에 저장됨.
    // Phase 2 에서 클라이언트가 localStorage 대신 쿠키 의존으로 전환 예정.
    let sellerCookie = '';
    try {
      const { createSessionCookie } = await import('../../../worker/utils/session');
      sellerCookie = await createSessionCookie(
        seller.id as number,
        seller.name as string,
        seller.email as string,
        null,
        JWT_SECRET,
        'seller',
      );
    } catch {}

    // 5. 응답 반환 (frontend expects accessToken & refreshToken)
    const res = c.json({
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
    if (sellerCookie) res.headers.append('Set-Cookie', sellerCookie);
    return res;
    
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

    // 4.5 저장된 refresh 해시 검증 + rotation
    try {
      await ensureAuthRefreshTokensTable(DB);
      const rows = await DB.prepare(
        `SELECT id, token_hash, expires_at
         FROM auth_refresh_tokens
         WHERE user_type = 'seller' AND user_id = ?`
      ).bind(Number(sellerId)).all<{ id: number; token_hash: string; expires_at: string }>();

      const candidates = rows.results || [];
      if (candidates.length > 0) {
        let matchedId: number | null = null;
        for (const row of candidates) {
          const { valid } = await verifyPassword(refreshToken, row.token_hash);
          if (valid) {
            matchedId = row.id;
            break;
          }
        }
        if (matchedId === null) {
          console.warn('[Seller Refresh] refresh token not recognized (revoked or reused)');
          return c.json<AuthResponse>({
            success: false,
            error: 'Refresh Token이 유효하지 않습니다.',
            code: 'INVALID_REFRESH_TOKEN'
          }, 401);
        }
        // v27 FIX: 구 토큰 삭제가 실패하면 rotation 중단 (구+신 동시 유효 방지)
        const deleteResult = await DB.prepare(
          'DELETE FROM auth_refresh_tokens WHERE id = ?'
        ).bind(matchedId).run();
        if (!deleteResult.meta?.changes) {
          console.warn('[Seller Refresh] old token delete failed (changes=0) — aborting rotation');
          return c.json<AuthResponse>({
            success: false,
            error: '토큰 갱신에 실패했습니다. 다시 로그인해주세요.',
            code: 'TOKEN_ROTATION_FAILED'
          }, 401);
        }
      }
    } catch (e) {
      console.error('[Seller Refresh] token store verify failed:', e);
      return c.json<AuthResponse>({
        success: false,
        error: '토큰 검증에 실패했습니다.',
        code: 'TOKEN_VERIFY_FAILED'
      }, 500);
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
    const nowSec2 = Math.floor(Date.now() / 1000);
    const newRefreshPayload = {
      ...newPayload,
      exp: nowSec2 + (30 * 24 * 60 * 60) // 30일
    };
    const newRefreshToken = await sign(newRefreshPayload, JWT_SECRET);

    // 새 refresh 해시 저장
    try {
      const newHash = await hashPassword(newRefreshToken);
      await DB.prepare(
        `INSERT INTO auth_refresh_tokens (user_type, user_id, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`
      ).bind(
        'seller',
        seller.id,
        newHash,
        new Date((nowSec2 + 30 * 24 * 3600) * 1000).toISOString()
      ).run();
    } catch (e) {
      console.error('[Seller Refresh] new refresh persist failed:', e);
    }
    
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
sellerRoutes.post('/forgot-password', cors(), rateLimit({ action: 'seller_forgot_password', max: 2, windowSec: 3600 }), async (c) => {
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
      // 🛡️ token URL-encode (URL 특수문자 방어) + baseUrl 검증
      const resetUrl = `${baseUrl.replace(/\/+$/, '')}/seller/reset-password?token=${encodeURIComponent(token)}`;

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
        if (import.meta.env.DEV) console.warn('[Seller ForgotPassword] RESEND_API_KEY not configured; skipping email. resetUrl=', resetUrl);
      }
    } else {
      if (import.meta.env.DEV) console.info('[Seller ForgotPassword] Unknown email (silent):', maskEmail(email));
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

    const pwCheck = validatePasswordComplexity(newPassword);
    if (!pwCheck.ok) {
      return c.json<AuthResponse>({
        success: false,
        error: pwCheck.error
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
      await DB.prepare('DELETE FROM password_reset_tokens WHERE id = ?').bind(row.id).run().catch(swallow('auth:api:seller'));
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
    await DB.prepare('DELETE FROM password_reset_tokens WHERE id = ?').bind(row.id).run().catch(swallow('auth:api:seller'));

    // 🛡️ 2026-04-22: 비번 변경 시 기존 refresh token 전부 revoke.
    // 탈취된 토큰 유지 문제 방지 — 비번을 바꿨는데도 공격자가 기존 토큰으로 접근 가능하던 버그.
    await DB.prepare(
      "DELETE FROM auth_refresh_tokens WHERE user_type = 'seller' AND user_id = ?"
    ).bind(row.user_id).run().catch(swallow('auth:api:seller'));

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
