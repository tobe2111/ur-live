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
import { verifyPassword } from '@/lib/password';
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
};

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
sellerRoutes.post('/login', cors(), async (c) => {
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
    
    console.log('[Seller Login] Attempting login for:', email);
    
    // 1. 이메일로 셀러 조회
    const seller = await DB.prepare(`
      SELECT 
        id, username, email, password_hash, name, 
        business_name, business_number, phone, status, commission_rate,
        created_at, updated_at
      FROM sellers 
      WHERE email = ?
    `).bind(email).first();
    
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
    const isValid = await verifyPassword(password, passwordHash);
    
    if (!isValid) {
      console.warn('[Seller Login] Invalid password for:', email);
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
    
    console.log('[Seller Login] ✅ Login successful for seller:', seller.id);
    
    // 5. 응답 반환 (frontend expects accessToken & refreshToken)
    return c.json<AuthResponse<SellerLoginResponse>>({
      success: true,
      data: {
        accessToken: token, // ✅ Changed from 'token' to 'accessToken'
        refreshToken: refreshToken, // ✅ Added refreshToken
        token, // ✅ Keep for backward compatibility
        seller: {
          id: seller.id as number,
          username: seller.username as string,
          email: seller.email as string,
          name: seller.name as string,
          business_name: seller.business_name as string,
          status: seller.status as string,
          commission_rate: seller.commission_rate as number
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
    
    console.log('[Seller Refresh] Attempting token refresh');
    
    // 1. Refresh Token 검증
    let payload: any;
    try {
      payload = await verify(refreshToken, JWT_SECRET);
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
    
    // 3. DB에서 셀러 정보 조회 (계정 상태 확인)
    const sellerId = payload.seller_id || payload.sub;
    const seller = await DB.prepare(`
      SELECT id, email, name, username, status, business_name, commission_rate
      FROM sellers 
      WHERE id = ?
    `).bind(sellerId).first();
    
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
    
    if (seller.status !== 'active') {
      console.warn('[Seller Refresh] Account not active:', sellerId);
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
    
    console.log('[Seller Refresh] ✅ Token refresh successful for seller:', seller.id);
    
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
          commission_rate: seller.commission_rate as number
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

export default sellerRoutes;
