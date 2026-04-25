/**
 * Seller Auth — POST /login
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign } from 'hono/jwt';
import { rateLimit } from '@/worker/middleware/rate-limit';
import { verifyPassword, hashPassword } from '@/lib/password';
import type { AuthResponse } from '../types';
import { maskEmail } from '@/lib/mask';
import { checkLockout, recordFailure, clearFailures } from '@/worker/utils/account-lockout';
import { createSessionCookie } from '../../../worker/utils/session';
import type { Bindings } from './seller-auth-helpers';
import { ensureAuthRefreshTokensTable } from './seller-auth-helpers';
import { logError } from '@/worker/utils/logger';

export const sellerAuthLoginRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * POST /login
 * 셀러 로그인 (email + password)
 */
sellerAuthLoginRoutes.post('/login', cors(), rateLimit({ action: 'seller_login', max: 10, windowSec: 300 }), async (c) => {
  const { DB, JWT_SECRET } = c.env;

  try {
    // JWT_SECRET 확인
    if (!JWT_SECRET) {
      logError('seller.login.missingJwtSecret');
      return c.json<AuthResponse>({
        success: false,
        error: 'Server configuration error',
        code: 'MISSING_JWT_SECRET'
      }, 500);
    }

    // Request body 파싱
    const body = await c.req.json<{ email: string; password: string }>();
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
      await verifyPassword(password, '$2b$10$CwTycUXWue0Thq9StjUM0uJ8mS8bL7JmJg0jVRjyZj3X5kQKqRHqO').catch(() => {});
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
      logError('seller.login.refreshTokenPersistFailed', { error: (e as Error)?.message });
    }

    // 🛡️ 2026-04-22 Phase 1: httpOnly 쿠키 추가 발급 (기존 Bearer 병행)
    // 클라이언트 변경 없이 쿠키가 자동으로 브라우저에 저장됨.
    // Phase 2 에서 클라이언트가 localStorage 대신 쿠키 의존으로 전환 예정.
    let sellerCookie = '';
    try {
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
    logError('seller.login.error', { error: (error as Error)?.message });

    const errorMsg = (error as Error).message || 'Unknown error';
    const statusCode = errorMsg.includes('Database') ? 500 : 500;

    return c.json<AuthResponse>({
      success: false,
      error: '로그인 중 오류가 발생했습니다.',
      code: 'SELLER_LOGIN_FAILED'
    }, statusCode);
  }
});
