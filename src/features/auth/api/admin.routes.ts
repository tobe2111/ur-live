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
import { rateLimit } from '@/worker/middleware/rate-limit';
import { verifyPassword, hashPassword } from '@/lib/password';
import { validateRequired } from '@/worker/utils/validation';
import { executeQuery } from '@/worker/utils/database';
import { maskEmail } from '@/lib/mask';
import { checkLockout, recordFailure, clearFailures } from '@/worker/utils/account-lockout';

/**
 * refresh_tokens 보조 테이블 (admin/seller용) 생성.
 * 기존 /migrations/001_initial.sql 의 refresh_tokens 는 users.id(TEXT) FK 로
 * 묶여 있어 숫자 ID를 가진 admin/seller에 쓰기 어렵다. 별도 테이블로 분리.
 */
async function ensureAuthRefreshTokensTable(DB: D1Database) {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL,          -- 'admin' | 'seller'
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run().catch(() => {});
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user ON auth_refresh_tokens(user_type, user_id)'
  ).run().catch(() => {});
}

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
adminRoutes.post('/login', cors(), rateLimit({ action: 'admin_login', max: 5, windowSec: 300 }), async (c) => {
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

    // 누락 가능한 컬럼 자동 추가 (idempotent)
    try { await DB.prepare("ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'admin'").run() } catch { /* already exists */ }
    try { await DB.prepare("ALTER TABLE admins ADD COLUMN is_active INTEGER DEFAULT 1").run() } catch { /* already exists */ }

    const admins = await executeQuery<any>(
      DB,
      'SELECT id, username, email, password_hash, name, role, created_at FROM admins WHERE email = ?',
      [email]
    );
    
    if (admins.length === 0) {
      if (import.meta.env.DEV) console.warn('[Admin Login] Admin not found:', maskEmail(email));
      return c.json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
    }

    const admin = admins[0];

    // 🛡️ 2026-04-22: 계정 잠금 확인 (brute force 방어)
    const lockStatus = await checkLockout(DB, 'admin', String(admin.id));
    if (lockStatus.locked) {
      return c.json({
        success: false,
        error: lockStatus.reason || '계정이 일시 잠금되었습니다.',
        code: 'ACCOUNT_LOCKED',
      }, 423);
    }

    const passwordHash = admin.password_hash as string;
    const { valid } = await verifyPassword(password, passwordHash);

    if (!valid) {
      if (import.meta.env.DEV) console.warn('[Admin Login] Invalid password for:', maskEmail(email));
      await recordFailure(DB, 'admin', String(admin.id));
      return c.json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
    }

    // 🛡️ 성공 시 실패 카운터 초기화
    await clearFailures(DB, 'admin', String(admin.id));
    
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

    // ── refresh token 해시 저장 (rotation/revocation 기반) ────
    try {
      await ensureAuthRefreshTokensTable(DB);
      const refreshHash = await hashPassword(refreshToken);
      await DB.prepare(
        `INSERT INTO auth_refresh_tokens (user_type, user_id, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`
      ).bind(
        'admin',
        admin.id,
        refreshHash,
        new Date((now + 30 * 24 * 3600) * 1000).toISOString()
      ).run();
    } catch (e) {
      // 저장 실패는 로그인을 막지 않음 (가용성 우선) — 다음 refresh 시 재시도
      console.error('[Admin Login] refresh token persist failed:', e);
    }

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

    // ── 저장된 refresh 해시와 비교 (rotation/revocation) ──────
    // 마이그레이션 기간 호환: 저장된 행이 전혀 없으면 JWT 서명만으로도 통과시킨다.
    try {
      await ensureAuthRefreshTokensTable(DB);
      const rows = await DB.prepare(
        `SELECT id, token_hash, expires_at
         FROM auth_refresh_tokens
         WHERE user_type = 'admin' AND user_id = ?`
      ).bind(Number(adminId)).all<{ id: number; token_hash: string; expires_at: string }>();

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
          console.warn('[Admin Refresh] refresh token not recognized (revoked or reused)');
          return c.json({ success: false, error: 'Refresh Token이 유효하지 않습니다.' }, 401);
        }
        // rotate: 사용한 토큰 행 삭제
        await DB.prepare('DELETE FROM auth_refresh_tokens WHERE id = ?').bind(matchedId).run().catch(() => {});
      }
    } catch (e) {
      console.error('[Admin Refresh] token store verify failed:', e);
      // 가용성: 저장소 오류로 인한 차단은 하지 않음
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

    // 새 refresh 저장
    try {
      const refreshHash = await hashPassword(newRefreshToken);
      await DB.prepare(
        `INSERT INTO auth_refresh_tokens (user_type, user_id, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`
      ).bind(
        'admin',
        admin.id,
        refreshHash,
        new Date((now + 30 * 24 * 3600) * 1000).toISOString()
      ).run();
    } catch (e) {
      console.error('[Admin Refresh] new refresh persist failed:', e);
    }
    
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
