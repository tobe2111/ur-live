/**
 * Seller Login API Routes
 * 
 * Endpoints:
 * - POST /api/seller/login - 셀러 로그인
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign } from 'hono/jwt';
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

export default sellerRoutes;
