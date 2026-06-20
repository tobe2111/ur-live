// ============================================================
// Auth Routes
// POST /api/auth/register
// POST /api/auth/login
// POST /api/auth/logout
// POST /api/auth/refresh
// GET  /api/auth/me
// ============================================================

import { Hono } from 'hono';
import { z } from 'zod';
import { rateLimit } from '../middleware/rate-limit';
import type { Env } from '../types/env';
import { QueryBuilder } from '../repositories/query-builder';
import { authMiddleware, createJwt, type AuthVariables } from '../middleware/auth.middleware';
// 🛡️ 2026-05-24: 카카오 사용자 (httpOnly 세션 쿠키 인증) 도 /profile PATCH 가능하게 —
//   기존 authMiddleware (Bearer JWT only) 는 403. requireAuth() 는 Bearer + 쿠키 둘 다 지원.
import { requireAuth, getCurrentUser } from '../middleware/auth';
import { generateId } from '../../shared/utils';
import { JWT_ACCESS_TOKEN_EXPIRY, JWT_REFRESH_TOKEN_EXPIRY } from '../../shared/constants';
// PBKDF2 password hashing — Cloudflare Workers compatible (100k iterations, SHA-256)
import { hashPassword, verifyPassword, validatePasswordComplexity } from '../../lib/password';
import { parseSessionCookie, clearSessionCookie } from '../utils/session';
import { verify as jwtVerify } from 'hono/jwt';
import { checkLockout, recordFailure, clearFailures } from '../utils/account-lockout';
import { withCircuitBreaker } from '../utils/circuit-breaker';
import { decryptAtRest } from '../utils/data-crypto';

const authRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(50),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /api/auth/register
authRouter.post('/register', rateLimit({ action: 'register', max: 5, windowSec: 3600 }), async (c) => {
  try {
    const body = await c.req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.issues[0]?.message }, 400);
    }
    const { email, password, name, phone } = parsed.data;

    // ── 비밀번호 복잡도 검증 (신규 가입 전용) ────────────────
    const complexity = validatePasswordComplexity(password);
    if (!complexity.ok) {
      return c.json({ success: false, error: complexity.error }, 400);
    }

    const qb = new QueryBuilder(c.env.DB);

    // Check existing
    const existing = await qb.queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return c.json({ success: false, error: '이미 사용 중인 이메일입니다' }, 409);
    }

    const passwordHash = await hashPassword(password);
    const userId = generateId();

    // 🛡️ 2026-05-01: production users 테이블에 toss_user_id 컬럼 없음 (Kakao 로그인 에러로 확인).
    //   Google/Kakao INSERT 와 동일한 패턴. id 도 INTEGER AUTOINCREMENT 가 아닌 TEXT 사용 시
    //   userId 명시.
    await qb.execute(
      `INSERT INTO users (id, email, password_hash, name, phone)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, email, passwordHash, name, phone ?? null]
    );

    const secret = c.env.JWT_SECRET;
    const accessToken = await createJwt(
      { sub: userId, email, role: 'BUYER' },
      secret,
      JWT_ACCESS_TOKEN_EXPIRY
    );
    const refreshToken = await createJwt(
      { sub: userId, email, role: 'BUYER' },
      secret,
      JWT_REFRESH_TOKEN_EXPIRY
    );

    // Store refresh token hash (PBKDF2)
    const tokenHash = await hashPassword(refreshToken);
    await qb.execute(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, datetime('now', '+30 days'))`,
      [generateId(), userId, tokenHash]
    );

    return c.json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: JWT_ACCESS_TOKEN_EXPIRY,
        user: { id: userId, email, name, role: 'BUYER' },
      },
    }, 201);
  } catch (err) {
    console.error('[AUTH] Register error:', err);
    return c.json({ success: false, error: 'Registration failed' }, 500);
  }
});

// POST /api/auth/login
authRouter.post('/login', rateLimit({ action: 'login', max: 10, windowSec: 300 }), async (c) => {
  try {
    const body = await c.req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: 'Invalid credentials' }, 400);
    }
    const { email, password } = parsed.data;

    const qb = new QueryBuilder(c.env.DB);
    // Production users table doesn't have role/status columns
    const user = await qb.queryOne<{
      id: string; email: string; name: string;
      password_hash: string;
    }>('SELECT id, email, name, password_hash FROM users WHERE email = ?', [email]);

    if (!user) {
      return c.json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다' }, 401);
    }

    // 🛡️ 2026-04-22: 계정 잠금 확인 (brute force 방어)
    const lockStatus = await checkLockout(c.env.DB, 'user', String(user.id));
    if (lockStatus.locked) {
      return c.json({
        success: false,
        error: lockStatus.reason || '계정이 일시 잠금되었습니다.',
        code: 'ACCOUNT_LOCKED',
      }, 423);
    }

    const { valid, isLegacy } = await verifyPassword(password, user.password_hash);
    if (!valid) {
      await recordFailure(c.env.DB, 'user', String(user.id));
      return c.json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다' }, 401);
    }

    // 성공 시 실패 카운터 초기화
    await clearFailures(c.env.DB, 'user', String(user.id));

    // ── 점진적 마이그레이션: SHA-256 → PBKDF2 ────────────────
    // 로그인 성공 시 레거시 해시를 감지하면 PBKDF2로 자동 재해싱합니다.
    // 사용자는 아무 행동도 필요 없습니다.
    if (isLegacy) {
      try {
        const newHash = await hashPassword(password);
        await qb.execute(
          `UPDATE users
           SET password_hash = ?,
               updated_at = datetime('now')
           WHERE id = ?`,
          [newHash, user.id]
        );
        console.info('[AUTH] hash migrated to PBKDF2 for user:', user.id);
      } catch (migrateErr) {
        // 마이그레이션 실패는 로그인 자체를 막지 않음 (다음 로그인에 재시도)
        console.error('[AUTH] hash migration failed (non-fatal):', (migrateErr as Error)?.message || String(migrateErr));
      }
    }

    const secret = c.env.JWT_SECRET;
    // Production users table doesn't have role column — default to 'BUYER'
    const role = 'BUYER';
    const accessToken = await createJwt(
      { sub: user.id, email: user.email, role },
      secret,
      JWT_ACCESS_TOKEN_EXPIRY
    );
    const refreshToken = await createJwt(
      { sub: user.id, email: user.email, role },
      secret,
      JWT_REFRESH_TOKEN_EXPIRY
    );

    // Update last login
    await qb.execute('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?', [user.id]);

    return c.json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: JWT_ACCESS_TOKEN_EXPIRY,
        user: { id: user.id, email: user.email, name: user.name, role },
      },
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    return c.json({ success: false, error: 'Login failed' }, 500);
  }
});

// GET /api/auth/me — session cookie (preferred) or Bearer token (fallback)
authRouter.get('/me', async (c) => {
  // 1. Try session cookie first (user login via httpOnly cookie)
  const cookieHeader = c.req.header('Cookie');
  const sessionUser = await parseSessionCookie(cookieHeader, c.env.JWT_SECRET);

  if (sessionUser) {
    return c.json({
      success: true,
      data: {
        id: sessionUser.userId,
        name: sessionUser.name,
        email: sessionUser.email,
        profileImage: sessionUser.profileImage || null,
        role: sessionUser.role || 'user',
      },
    });
  }

  // 2. Fallback to Bearer token (existing authMiddleware logic)
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  // Delegate to existing authMiddleware inline
  const fakeNext = async () => {};
  await authMiddleware(c, fakeNext);

  const authedUser = c.get('user') as { id: string; email: string; role: string } | undefined;
  if (!authedUser) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const qb = new QueryBuilder(c.env.DB);
  // Production users table doesn't have role/status columns
  const user = await qb.queryOne<{
    id: string; email: string; name: string;
    phone: string | null; avatar_url: string | null;
  }>('SELECT id, email, name, phone, avatar_url FROM users WHERE id = ?', [authedUser.id]);

  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  return c.json({ success: true, data: { ...user, role: 'BUYER' } });
});

// PATCH /api/auth/profile — 프로필(이름, 전화번호) 수정
// 🛡️ 2026-05-24: requireAuth() 사용 — Bearer JWT + httpOnly 세션 쿠키 둘 다 허용.
//   카카오 로그인 사용자는 쿠키 인증 → 기존 authMiddleware (Bearer only) 로는 403 발생.
authRouter.patch('/profile', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const id = user.id;
  const db = c.env.DB;
  try {
    const body = await c.req.json<{ name?: string; phone?: string }>();

    // Defensive validation: bounded string sizes, basic phone shape
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.length === 0 || body.name.length > 100) {
        return c.json({ success: false, error: '이름은 1자 이상 100자 이하여야 합니다' }, 400);
      }
    }
    if (body.phone !== undefined && body.phone !== null && body.phone !== '') {
      if (typeof body.phone !== 'string' || body.phone.length > 20) {
        return c.json({ success: false, error: '전화번호 형식이 올바르지 않습니다' }, 400);
      }
      const cleanedPhone = body.phone.replace(/[-\s]/g, '');
      if (!/^[0-9+]+$/.test(cleanedPhone) || cleanedPhone.length < 9 || cleanedPhone.length > 15) {
        return c.json({ success: false, error: '전화번호 형식이 올바르지 않습니다' }, 400);
      }
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
    if (body.phone !== undefined) { fields.push('phone = ?'); values.push(body.phone); }
    if (fields.length === 0) return c.json({ success: false, error: '수정할 항목이 없습니다' }, 400);

    // 🛡️ 2026-05-24: updated_at 컬럼이 옛 DB 에 누락된 경우 graceful — 1차 시도 실패 시 updated_at 빼고 재시도.
    const sqlWithTs = `UPDATE users SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`;
    const sqlNoTs = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    try {
      await db.prepare(sqlWithTs).bind(...values, id).run();
    } catch (e1) {
      const msg = String((e1 as Error)?.message || '');
      if (/no such column.*updated_at/i.test(msg)) {
        console.warn('[auth/profile] users.updated_at missing — retrying without timestamp. Call /api/_internal/repair-schema to add it.');
        await db.prepare(sqlNoTs).bind(...values, id).run();
      } else {
        throw e1;
      }
    }
    const updated = await db.prepare('SELECT id, email, name, phone, avatar_url FROM users WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: updated });
  } catch (err: unknown) {
    // 🛡️ 2026-05-22: production 정보 누출 방지 — 상세 에러는 로그만, 응답은 generic.
    //   2026-05-24: DEV 모드만 _debug 에 actual SQL 에러 노출 (진단 가속).
    console.error('[auth/profile] update failed:', err);
    const isDev = c.env.ENVIRONMENT !== 'production';
    const errMsg = (err as Error)?.message || String(err);
    // 🛡️ 같은 에러 반복 방지 — phone / 컬럼 누락이면 사용자에게 안내 (운영자 액션 필요).
    if (/no such column/i.test(errMsg)) {
      return c.json({
        success: false,
        error: '프로필 컬럼이 누락되어 저장할 수 없어요. 관리자에게 문의해주세요. (CODE: SCHEMA_MISSING)',
        ...(isDev && { _debug: errMsg }),
      }, 500);
    }
    return c.json({
      success: false,
      error: '프로필 업데이트 중 오류가 발생했습니다',
      ...(isDev && { _debug: errMsg }),
    }, 500);
  }
});

// POST /api/auth/change-password — 비밀번호 변경
// 🛡️ 2026-05-24: requireAuth() — Bearer + 세션 쿠키 둘 다 허용 (카카오 사용자 호환).
//   password 없는 사용자는 안에서 별도 처리됨 (current_password 검증 실패).
authRouter.post('/change-password', rateLimit({ action: 'change_password', max: 5, windowSec: 3600 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const id = user.id;
  const db = c.env.DB;
  try {
    const body = await c.req.json<{ current_password: string; new_password: string }>();
    if (!body.current_password || !body.new_password) {
      return c.json({ success: false, error: '현재 비밀번호와 새 비밀번호를 입력해주세요' }, 400);
    }
    // 🛡️ 2026-04-22: 비밀번호 재사용 방어
    if (body.current_password === body.new_password) {
      return c.json({ success: false, error: '새 비밀번호는 현재 비밀번호와 달라야 합니다' }, 400);
    }
    const complexity = validatePasswordComplexity(body.new_password);
    if (!complexity.ok) {
      return c.json({ success: false, error: complexity.error }, 400);
    }
    const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(id).first<{ password_hash: string }>();
    if (!user) return c.json({ success: false, error: '사용자를 찾을 수 없습니다' }, 404);
    const { valid } = await verifyPassword(body.current_password, user.password_hash);
    if (!valid) return c.json({ success: false, error: '현재 비밀번호가 올바르지 않습니다' }, 400);
    const newHash = await hashPassword(body.new_password);
    await db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").bind(newHash, id).run();
    // 🛡️ 2026-04-22: 비밀번호 변경 시 기존 refresh token 전량 무효화 — 탈취된 세션 강제 로그아웃
    try {
      await db.prepare("DELETE FROM refresh_tokens WHERE user_id = ? AND user_type = 'user'").bind(id).run();
    } catch { /* table may not exist in older environments */ }
    return c.json({ success: true, message: '비밀번호가 변경되었습니다' });
  } catch (err: unknown) {
    // 🛡️ 2026-05-22: production 정보 누출 방지 — UNIQUE constraint 등 DB 메시지 노출 X.
    console.error('[auth/credential-update] failed:', (err as Error)?.message || String(err));
    return c.json({ success: false, error: '비밀번호 변경 중 오류가 발생했습니다' }, 500);
  }
});

// GET /api/auth/validate — 세션 유효성 검증 (useSessionValidation.ts에서 호출)
// Authorization: Bearer <token> 헤더가 유효하면 200, 없거나 만료되면 401 반환
authRouter.get('/validate', requireAuth(), async (c) => {
  const user = c.get('user');
  return c.json({ success: true, data: { valid: true, user } });
});

// GET /api/auth/session/health — 세션+카카오 토큰 상태 통합 체크
// 프론트가 마운트 시 호출해서 "로그인 됐는데 API 실패" 상황을 진단
authRouter.get('/session/health', async (c) => {
  const cookieHeader = c.req.header('Cookie');
  let sessionUser = await parseSessionCookie(cookieHeader, c.env.JWT_SECRET);

  // 🛡️ 2026-06-20 (iOS 로그인 안정화 — 근본수정): 세션 쿠키가 없으면 Bearer(user_token) 도 인정.
  //   iOS WebKit(사파리 ITP / 카톡 WKWebView)가 httpOnly 쿠키를 유실해도 localStorage user_token
  //   Bearer 로 session:true 판정 → 클라의 부당한 자동 로그아웃(wipe) 방지. (requireAuth 와 동일 우선순위)
  if (!sessionUser) {
    const authHeader = c.req.header('Authorization');
    const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (bearer) {
      try {
        const p = await jwtVerify(bearer, c.env.JWT_SECRET, 'HS256') as Record<string, unknown>;
        const sub = p?.sub;
        const type = (typeof p?.type === 'string' ? p.type : 'user');
        if (sub && type === 'user') {
          sessionUser = {
            userId: String(sub),
            name: (p.name as string) || '',
            email: (p.email as string) || '',
            type: 'user',
            role: 'user',
            isDbId: p.isDbId !== false,
            iat: typeof p.iat === 'number' ? p.iat : undefined,
          };
        }
      } catch { /* invalid/expired bearer — 익명 처리 */ }
    }
  }

  let kakaoValid = false;
  let kakaoNeedsReauth = false;
  if (sessionUser) {
    try {
      const row = await c.env.DB.prepare(
        'SELECT kakao_access_token, kakao_refresh_token FROM users WHERE id = ?'
      ).bind(sessionUser.userId).first<{ kakao_access_token: string | null; kakao_refresh_token: string | null }>();

      // 🛡️ 2026-04-22: at-rest 복호화 (legacy 평문 호환)
      const kek = (c.env as any).DATA_ENCRYPTION_KEY as string | undefined;
      const plainAccess = row?.kakao_access_token ? await decryptAtRest(row.kakao_access_token, kek).catch(() => row.kakao_access_token) : null;

      if (plainAccess) {
        // Wrap with circuit breaker — Kakao outages should not block session checks.
        // Fallback assumes token is still valid (optimistic) and does NOT force reauth,
        // because forcing reauth during a Kakao outage would kick every user out.
        const check = await withCircuitBreaker(
          { name: 'kakao-token-info', maxFailures: 5, resetTimeoutMs: 30_000 },
          () => fetch('https://kapi.kakao.com/v1/user/access_token_info', {
            headers: { 'Authorization': `Bearer ${plainAccess}` },
            // 🛡️ Kakao 느리면 3초 후 중단 (Worker CPU 보호)
            signal: AbortSignal.timeout(3000),
          }),
          () => new Response(null, { status: 200 }),
        );
        if (check.status === 200) kakaoValid = true;
        else if (!row?.kakao_refresh_token) kakaoNeedsReauth = true;
      } else {
        kakaoNeedsReauth = true;
      }
    } catch { kakaoNeedsReauth = true }
  }

  return c.json({
    success: true,
    data: {
      session: !!sessionUser,
      user: sessionUser || null,
      kakao: { valid: kakaoValid, needsReauth: kakaoNeedsReauth },
    },
  });
});

// POST /api/auth/logout — clear ALL session cookies (user + seller + admin + agency)
//   🛡️ 2026-05-01: 다른 사람 폰 로그인 cross-user leak 방어 — 모든 역할 cookie 청소.
//     이전: ur_session 만 청소 → ur_seller_session 등 다른 역할 cookie 잔존 →
//     새 사용자 /seller/* 진입 시 이전 사용자 seller session 으로 인증됨.
authRouter.post('/logout', async (c) => {
  c.header('Set-Cookie', clearSessionCookie('user'));
  c.header('Set-Cookie', clearSessionCookie('seller'), { append: true });
  c.header('Set-Cookie', clearSessionCookie('admin'), { append: true });
  c.header('Set-Cookie', clearSessionCookie('agency'), { append: true });
  return c.json({ success: true, message: 'Logged out' });
});

export { authRouter };
