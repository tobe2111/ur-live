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

export const adminRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * POST /api/admin/login
 * 관리자 로그인
 */
adminRoutes.post('/login', cors(), async (c) => {
  const { DB, JWT_SECRET } = c.env;
  
  try {
    if (!JWT_SECRET) {
      console.error('[Admin Login] JWT_SECRET not configured');
      return c.json({ success: false, error: 'Server configuration error' }, 500);
    }

    const body = await c.req.json<AdminLoginRequest>();
    const { email, password } = body;
    
    const validationErrors = validateRequired(body, ['email', 'password']);
    if (validationErrors.length > 0) {
      return c.json({ success: false, error: '이메일과 비밀번호를 입력해주세요.' }, 400);
    }
    
    const admins = await executeQuery<any>(
      DB,
      'SELECT id, username, email, password_hash, name, role, created_at FROM admins WHERE email = ?',
      [email]
    );
    
    if (admins.length === 0) {
      console.warn('[Admin Login] Admin not found:', email);
      return c.json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
    }
    
    const admin = admins[0];
    const passwordHash = admin.password_hash as string;
    const isValid = await verifyPassword(password, passwordHash);
    
    if (!isValid) {
      console.warn('[Admin Login] Invalid password for:', email);
      return c.json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
    }
    
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: admin.id.toString(),
      email: admin.email,
      name: admin.name,
      username: admin.username,
      role: admin.role,
      type: 'admin',
      iat: now,
      exp: now + (7 * 24 * 60 * 60)
    };
    
    const token = await sign(payload, JWT_SECRET);
    const refreshPayload = { ...payload, exp: now + (30 * 24 * 60 * 60) };
    const refreshToken = await sign(refreshPayload, JWT_SECRET);
    
    return c.json({
      success: true,
      data: {
        accessToken: token,
        refreshToken,
        token, // backward compatibility
        admin: {
          id: admin.id as number,
          username: admin.username as string,
          email: admin.email as string,
          name: admin.name as string,
          role: admin.role as string
        }
      },
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('[Admin Login] Error:', error);
    return c.json({ success: false, error: '로그인 중 오류가 발생했습니다.' }, 500);
  }
});

/**
 * POST /api/admin/refresh
 * Refresh Token으로 새 Access Token 발급
 */
adminRoutes.post('/refresh', cors(), async (c) => {
  const { DB, JWT_SECRET } = c.env;
  
  try {
    if (!JWT_SECRET) {
      console.error('[Admin Refresh] JWT_SECRET not configured');
      return c.json({ success: false, error: 'Server configuration error' }, 500);
    }

    const body = await c.req.json<{ refreshToken: string }>();
    const { refreshToken } = body;
    
    if (!refreshToken) {
      return c.json({ success: false, error: 'Refresh Token이 필요합니다.' }, 400);
    }
    
    let payload: any;
    try {
      payload = await verify(refreshToken, JWT_SECRET, 'HS256');
    } catch (error) {
      console.warn('[Admin Refresh] Invalid refresh token:', error);
      return c.json({ success: false, error: 'Refresh Token이 유효하지 않거나 만료되었습니다.' }, 401);
    }
    
    if (payload.type !== 'admin') {
      console.warn('[Admin Refresh] Invalid token type:', payload.type);
      return c.json({ success: false, error: 'Admin Refresh Token이 아닙니다.' }, 401);
    }
    
    const adminId = payload.sub;
    const admins = await executeQuery<any>(
      DB,
      'SELECT id, username, email, name, role FROM admins WHERE id = ?',
      [adminId]
    );
    
    if (admins.length === 0) {
      console.warn('[Admin Refresh] Admin not found:', adminId);
      return c.json({ success: false, error: '계정을 찾을 수 없습니다.' }, 401);
    }
    
    const admin = admins[0];
    const now = Math.floor(Date.now() / 1000);
    const newPayload = {
      sub: admin.id.toString(),
      email: admin.email,
      name: admin.name,
      username: admin.username,
      role: admin.role,
      type: 'admin',
      iat: now,
      exp: now + (7 * 24 * 60 * 60)
    };
    
    const newAccessToken = await sign(newPayload, JWT_SECRET);
    const newRefreshPayload = { ...newPayload, exp: now + (30 * 24 * 60 * 60) };
    const newRefreshToken = await sign(newRefreshPayload, JWT_SECRET);
    
    return c.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        admin: {
          id: admin.id as number,
          username: admin.username as string,
          email: admin.email as string,
          name: admin.name as string,
          role: admin.role as string
        }
      },
      message: 'Token refreshed successfully'
    });
    
  } catch (error) {
    console.error('[Admin Refresh] Error:', error);
    return c.json({ success: false, error: '토큰 갱신 중 오류가 발생했습니다.' }, 500);
  }
});

export default adminRoutes;
