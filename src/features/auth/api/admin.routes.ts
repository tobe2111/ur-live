/**
 * Admin Login API Routes
 * 
 * Endpoints:
 * - POST /api/admin/login - 관리자 로그인
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign } from 'hono/jwt';
import { verifyPassword } from '@/lib/password';
import type { AuthResponse } from '../types';

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
      return c.json<AuthResponse>({ 
        success: false, 
        error: 'Server configuration error',
        code: 'MISSING_JWT_SECRET'
      }, 500);
    }

    // Request body 파싱
    const body = await c.req.json<AdminLoginRequest>();
    const { email, password } = body;
    
    // Validation
    if (!email || !password) {
      return c.json<AuthResponse>({ 
        success: false, 
        error: '이메일과 비밀번호를 입력해주세요.' 
      }, 400);
    }
    
    console.log('[Admin Login] Attempting login for:', email);
    
    // 1. 이메일로 관리자 조회
    const admin = await DB.prepare(`
      SELECT 
        id, username, email, password_hash, name, role, created_at
      FROM admins 
      WHERE email = ?
    `).bind(email).first();
    
    if (!admin) {
      console.warn('[Admin Login] Admin not found:', email);
      return c.json<AuthResponse>({ 
        success: false, 
        error: '이메일 또는 비밀번호가 올바르지 않습니다.' 
      }, 401);
    }
    
    // 2. 비밀번호 검증
    const passwordHash = admin.password_hash as string;
    const isValid = await verifyPassword(password, passwordHash);
    
    if (!isValid) {
      console.warn('[Admin Login] Invalid password for:', email);
      return c.json<AuthResponse>({ 
        success: false, 
        error: '이메일 또는 비밀번호가 올바르지 않습니다.' 
      }, 401);
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
    
    console.log('[Admin Login] ✅ Login successful for admin:', admin.id, 'role:', admin.role);
    
    // 4. 응답 반환
    return c.json<AuthResponse<AdminLoginResponse>>({
      success: true,
      data: {
        token,
        admin: {
          id: admin.id as number,
          username: admin.username as string,
          email: admin.email as string,
          name: admin.name as string,
          role: admin.role as string
        }
      }
    });
    
  } catch (error) {
    console.error('[Admin Login] Error:', error);
    
    const errorMsg = (error as Error).message || 'Unknown error';
    const statusCode = errorMsg.includes('Database') ? 500 : 500;
    
    return c.json<AuthResponse>({
      success: false,
      error: '로그인 중 오류가 발생했습니다.',
      code: 'ADMIN_LOGIN_FAILED'
    }, statusCode);
  }
});

export default adminRoutes;
