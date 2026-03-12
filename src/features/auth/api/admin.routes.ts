/**
 * Admin Login API Routes
 * 
 * Endpoints:
 * - POST /api/admin/login - 관리자 로그인
 * - POST /api/admin/refresh - Access Token 갱신
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
  internalServerErrorResponse
} from '@/worker/utils/response';
import { validateRequired } from '@/worker/utils/validation';
import { executeQuery } from '@/worker/utils/database';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

type AdminLoginRequest = {
  email: string;
  password: string;
};

type AdminLoginResponse = {
  token: string;
  admin: {
    id: number;
    username: string;
    email: string;
    name: string;
    role: string;
  };
};

export const adminRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * POST /api/admin/login
 * 관리자 로그인
 * 
 * Request body:
 * - email: 이메일
 * - password: 비밀번호
 * 
 * Response:
 * - token: JWT access token
 * - admin: 관리자 정보
 */
adminRoutes.post('/login', cors(), async (c) => {
  const { DB, JWT_SECRET } = c.env;
  
  try {
    // JWT_SECRET 확인
    if (!JWT_SECRET) {
      console.error('[Admin Login] JWT_SECRET not configured');
      return internalServerErrorResponse(c, 'Server configuration error');
    }

    // Request body 파싱
    const body = await c.req.json<AdminLoginRequest>();
    const { email, password } = body;
    
    // Validation
    const validationErrors = validateRequired(body, ['email', 'password']);
    if (validationErrors.length > 0) {
      return badRequestResponse(c, '이메일과 비밀번호를 입력해주세요.');
    }
    
    console.log('[Admin Login] Attempting login for:', email);
    
    // 1. 이메일로 관리자 조회
    const admins = await executeQuery<any>(
      DB,
      'SELECT id, username, email, password_hash, name, role, created_at FROM admins WHERE email = ?',
      [email]
    );
    
    if (admins.length === 0) {
      console.warn('[Admin Login] Admin not found:', email);
      return unauthorizedResponse(c, '이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    
    const admin = admins[0];
    
    // 2. 비밀번호 검증
    const passwordHash = admin.password_hash as string;
    const isValid = await verifyPassword(password, passwordHash);
    
    if (!isValid) {
      console.warn('[Admin Login] Invalid password for:', email);
      return unauthorizedResponse(c, '이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    
    // 3. JWT 생성
    const payload = {
      sub: admin.id.toString(),
      email: admin.email,
      name: admin.name,
      username: admin.username,
      role: admin.role,
      type: 'admin',
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
    
    console.log('[Admin Login] ✅ Login successful for admin:', admin.id, 'role:', admin.role);
    
    // 4. 응답 반환
    return successResponse(c, {
      accessToken: token,
      refreshToken: refreshToken,
      token, // backward compatibility
      admin: {
        id: admin.id as number,
        username: admin.username as string,
        email: admin.email as string,
        name: admin.name as string,
        role: admin.role as string
      }
    }, 'Login successful');
    
  } catch (error) {
    console.error('[Admin Login] Error:', error);
    const errorMsg = (error as Error).message || 'Unknown error';
    return internalServerErrorResponse(c, '로그인 중 오류가 발생했습니다.');
  }
});

/**
 * POST /api/admin/refresh
 * Refresh Token으로 새 Access Token 발급
 * 
 * Request body:
 * - refreshToken: Refresh Token (JWT)
 * 
 * Response:
 * - accessToken: 새 Access Token (7일)
 * - refreshToken: 새 Refresh Token (30일)
 */
adminRoutes.post('/refresh', cors(), async (c) => {
  const { DB, JWT_SECRET } = c.env;
  
  try {
    if (!JWT_SECRET) {
      console.error('[Admin Refresh] JWT_SECRET not configured');
      return internalServerErrorResponse(c, 'Server configuration error');
    }

    const body = await c.req.json<{ refreshToken: string }>();
    const { refreshToken } = body;
    
    if (!refreshToken) {
      return badRequestResponse(c, 'Refresh Token이 필요합니다.');
    }
    
    console.log('[Admin Refresh] Attempting token refresh');
    
    // 1. Refresh Token 검증
    let payload: any;
    try {
      payload = await verify(refreshToken, JWT_SECRET);
    } catch (error) {
      console.warn('[Admin Refresh] Invalid refresh token:', error);
      return unauthorizedResponse(c, 'Refresh Token이 유효하지 않거나 만료되었습니다.');
    }
    
    // 2. Token 타입 확인
    if (payload.type !== 'admin') {
      console.warn('[Admin Refresh] Invalid token type:', payload.type);
      return unauthorizedResponse(c, 'Admin Refresh Token이 아닙니다.');
    }
    
    // 3. DB에서 관리자 정보 조회
    const adminId = payload.sub;
    const admins = await executeQuery<any>(
      DB,
      'SELECT id, username, email, name, role FROM admins WHERE id = ?',
      [adminId]
    );
    
    if (admins.length === 0) {
      console.warn('[Admin Refresh] Admin not found:', adminId);
      return unauthorizedResponse(c, '계정을 찾을 수 없습니다.');
    }
    
    const admin = admins[0];
    
    // 4. 새 Access Token 생성
    const newPayload = {
      sub: admin.id.toString(),
      email: admin.email,
      name: admin.name,
      username: admin.username,
      role: admin.role,
      type: 'admin',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7일
    };
    
    const newAccessToken = await sign(newPayload, JWT_SECRET);
    
    // 5. 새 Refresh Token 생성
    const newRefreshPayload = {
      ...newPayload,
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30일
    };
    const newRefreshToken = await sign(newRefreshPayload, JWT_SECRET);
    
    console.log('[Admin Refresh] ✅ Token refresh successful for admin:', admin.id);
    
    return successResponse(c, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      admin: {
        id: admin.id as number,
        username: admin.username as string,
        email: admin.email as string,
        name: admin.name as string,
        role: admin.role as string
      }
    }, 'Token refreshed successfully');
    
  } catch (error) {
    console.error('[Admin Refresh] Error:', error);
    return internalServerErrorResponse(c, '토큰 갱신 중 오류가 발생했습니다.');
  }
});

export default adminRoutes;
