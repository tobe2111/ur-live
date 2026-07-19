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
import { verifyPassword, hashPassword } from '@/lib/password';
import { validateRequired } from '@/worker/utils/validation';
import { executeQuery } from '@/worker/utils/database';
import { startDashboardSession, isDashboardSessionCurrent } from '@/worker/utils/dashboard-session';
import { filterAliveRefreshRows, rotationGraceExpiryIso } from '@/worker/utils/refresh-rotation';
import { maskEmail } from '@/lib/mask';
import { verifyTurnstile } from '@/worker/utils/turnstile';
import { checkLockout, recordFailure, clearFailures } from '@/worker/utils/account-lockout';
import { rateLimit, resetRateLimit } from '@/worker/middleware/rate-limit';

/**
 * refresh_tokens 보조 테이블 (admin/seller용) 생성.
 * 기존 /migrations/001_initial.sql 의 refresh_tokens 는 users.id(TEXT) FK 로
 * 묶여 있어 숫자 ID를 가진 admin/seller에 쓰기 어렵다. 별도 테이블로 분리.
 */
async function ensureAuthRefreshTokensTable(DB: D1Database) {
  if (_done_ensureAuthRefreshTokensTable.has(DB)) return
  _done_ensureAuthRefreshTokensTable.add(DB)
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL,          -- 'admin' | 'seller'
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run().catch(swallow('auth:api:admin'));
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user ON auth_refresh_tokens(user_type, user_id)'
  ).run().catch(swallow('auth:api:admin'));
}

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  TURNSTILE_SECRET?: string;
};

type AdminLoginRequest = {
  email: string;
  password: string;
};

export const adminRoutes = new Hono<{ Bindings: Bindings }>();

// 🆕 2026-06-17 관리자 로그인 이력 테이블 — per-request DDL 방지(WeakSet 메모이즈).
const _loginHistEnsured = new WeakSet<D1Database>();
async function ensureAdminLoginHistory(DB: D1Database): Promise<void> {
  if (_loginHistEnsured.has(DB)) return;
  _loginHistEnsured.add(DB);
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS admin_login_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT NOT NULL,
      email TEXT,
      ip TEXT,
      user_agent TEXT,
      success INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`).run();
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_admin_login_history_created ON admin_login_history(created_at DESC)`).run().catch(() => {});
  } catch (e) {
    _loginHistEnsured.delete(DB);
    console.error('[ensureAdminLoginHistory]', e);
  }
}

// 🆕 2026-06-17 관리자 보안 PIN 컬럼 — per-request DDL 방지(WeakSet 메모이즈).
const _loginPinEnsured = new WeakSet<D1Database>();
async function ensureLoginPinColumn(DB: D1Database): Promise<void> {
  if (_loginPinEnsured.has(DB)) return;
  _loginPinEnsured.add(DB);
  try { await DB.prepare('ALTER TABLE admins ADD COLUMN login_pin_hash TEXT').run() } catch { /* exists */ }
}

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

    const body = await c.req.json<AdminLoginRequest & { turnstile_token?: string }>();
    const { email, password } = body;

    const validationErrors = validateRequired(body, ['email', 'password']);
    if (validationErrors.length > 0) {
      return c.json({ success: false, error: '이메일과 비밀번호를 입력해주세요.' }, 400);
    }

    // 🛡️ 2026-05-03: Turnstile (분산 봇 brute-force 방어). TURNSTILE_SECRET 미설정 시 fail-open.
    {
      const ip = c.req.header('cf-connecting-ip') || undefined;
      const ok = await verifyTurnstile(c.env.TURNSTILE_SECRET, body.turnstile_token, ip);
      if (!ok) {
        return c.json({ success: false, error: '봇 검증 실패. 페이지를 새로고침 후 다시 시도해주세요.' }, 403);
      }
    }

    // 누락 가능한 컬럼 자동 추가 (idempotent)
    try { await DB.prepare("ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'admin'").run() } catch { /* already exists */ }
    try { await DB.prepare("ALTER TABLE admins ADD COLUMN is_active INTEGER DEFAULT 1").run() } catch { /* already exists */ }

    // 🔐 2026-07-05 (대표 지시 — "삭제하면 로그인 못하게 막아야"): 비활성/삭제 계정 로그인 차단.
    //   기존엔 삭제가 email 을 _deleted_ 접미사로만 바꿔 원 email 매칭 실패에 의존했음(취약 — 접미사
    //   미부착/이메일변경 경합 시 우회). is_active=0(삭제 시 항상 set, 로그인이 ALTER 로 컬럼 보장)을
    //   직접 게이트해 확실히 차단. deactivated(is_active=0) 계정도 동일하게 로그인 불가(의도).
    const admins = await executeQuery<any>(
      DB,
      "SELECT id, username, email, password_hash, name, role, created_at FROM admins WHERE email = ? AND COALESCE(is_active, 1) = 1",
      [email]
    );

    if (admins.length === 0) {
      if (import.meta.env.DEV) console.warn('[Admin Login] Admin not found:', maskEmail(email));
      // 🛡️ 2026-04-22: 타이밍 공격 방어 — 존재하지 않는 계정에도 verifyPassword 실행해서
      // 응답 시간을 비슷하게 맞춤 (user enumeration 방어)
      await verifyPassword(password, '$2b$10$CwTycUXWue0Thq9StjUM0uJ8mS8bL7JmJg0jVRjyZj3X5kQKqRHqO').catch(swallow('auth:api:admin'));
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

    // 🆕 2026-06-17 보안 PIN 강제 (도매 파트너 + 슈퍼) + 로그인 이력(IP).
    //   - 관리자가 처음 설정한 6자리 PIN(login_pin_hash) 있으면 매 로그인 PIN 필수(없으면 pin_required → 토큰 미발급).
    //   - 강제 대상 역할인데 PIN 미설정이면 토큰은 발급하되 must_set_pin 플래그(프론트가 PIN 설정 유도).
    //   ⚠️ login_pin_hash 컬럼 미존재면 catch → null → 로그인 fail-safe.
    const reqIp = c.req.header('CF-Connecting-IP') || c.req.header('cf-connecting-ip') || null;
    let mustSetPin = false;
    {
      const ENFORCED_PIN_ROLES = ['super_admin', 'wholesale'];
      const pinRow = await DB.prepare('SELECT login_pin_hash FROM admins WHERE id = ?')
        .bind(admin.id).first<{ login_pin_hash: string | null }>().catch(() => null);
      const hasPin = !!(pinRow && pinRow.login_pin_hash);
      if (hasPin) {
        const pin = String((body as { pin?: string }).pin || '').trim();
        if (!/^\d{6}$/.test(pin)) {
          return c.json({ success: false, pin_required: true, message: '6자리 보안 PIN을 입력하세요' }, 200);
        }
        const { valid: pinOk } = await verifyPassword(pin, pinRow!.login_pin_hash as string);
        if (!pinOk) return c.json({ success: false, pin_required: true, error: '보안 PIN이 올바르지 않습니다' }, 401);
      } else if (ENFORCED_PIN_ROLES.includes(String(admin.role))) {
        mustSetPin = true;
      }
    }

    // 🔐 2026-07-11 (사전점검 보안감사 R3 ④): 로그인 TOTP 게이트 + finance/super 등록 강제 (must_set_pin 미러).
    //   - SSOT 축 = admins.totp_secret/totp_enabled 컬럼 — generic /api/2fa/* (twofa.routes.ts, Admin2FASetupPage
    //     가 사용) 가 쓰고 require-2fa.ts 미들웨어가 읽는 바로 그 축. 본 파일 하단의 admin_2fa 테이블 경로
    //     (/api/admin/2fa/setup·verify·validate)는 로그인이 /validate 를 호출한 적 없는 휴면(dead) 경로 —
    //     사용하지 않음(삭제 아님, 존치).
    //   - totp_enabled=1 계정: body.totp_code(6자리, 인증앱) 필수 — require-2fa.ts 의 verifyTOTP(±30s 창) 재사용.
    //     부재/형식오류 → ADMIN_2FA_REQUIRED, 불일치 → ADMIN_2FA_INVALID. 둘 다 401 + 토큰 미발급.
    //   - role ∈ {finance, super(레거시 super_admin 포함)} 인데 미등록(totp_enabled=0): 토큰은 오늘처럼 발급하되
    //     must_set_2fa 플래그 → 프론트가 /admin/2fa 설정 페이지로 유도(잠금 없음 — 단독 관리자 lock-out 방지).
    //     등록 완료 후부터 매 로그인 코드 필수. 그 외 역할 + 미등록: 현행 그대로(무변화).
    //   ⚠️ fail-safe: totp_* 컬럼 미존재(프로덕션 drift 가능 — twofa.routes 가 setup 시 ALTER 로 추가)면
    //     catch → null → 미등록 취급(로그인 차단 없음). admins 테이블 컬럼 추가 없음(read-only).
    let mustSet2fa = false;
    // 🔕 2026-07-19 대표 지시 "어드민 대시보드 2단계 인증 없애줘" — 로그인 TOTP 게이트 전면 비활성
    //   (totp_enabled 계정도 비번+PIN 만으로 로그인, must_set_2fa 유도 중단). 재도입 = 이 상수 false 로.
    const TOTP_LOGIN_GATE_DISABLED = true;
    if (!TOTP_LOGIN_GATE_DISABLED) {
      const totpRow = await DB.prepare('SELECT totp_secret, totp_enabled FROM admins WHERE id = ?')
        .bind(admin.id).first<{ totp_secret: string | null; totp_enabled: number }>().catch(() => null);
      if (totpRow?.totp_enabled && totpRow.totp_secret) {
        const totpCode = String((body as { totp_code?: string }).totp_code || '').trim();
        if (!/^\d{6}$/.test(totpCode)) {
          return c.json({
            success: false,
            totp_required: true,
            code: 'ADMIN_2FA_REQUIRED',
            message: '이 계정은 2단계 인증(OTP)이 설정되어 있습니다. 인증 앱의 6자리 코드를 입력하세요.',
          }, 401);
        }
        const { verifyTOTP } = await import('../../../worker/middleware/require-2fa');
        const totpOk = await verifyTOTP(totpRow.totp_secret, totpCode);
        if (!totpOk) {
          return c.json({
            success: false,
            totp_required: true,
            code: 'ADMIN_2FA_INVALID',
            error: 'OTP 코드가 올바르지 않습니다. 인증 앱의 최신 코드를 다시 입력하세요.',
          }, 401);
        }
      } else {
        const TOTP_ENFORCED_ROLES = ['finance', 'super', 'super_admin'];
        if (TOTP_ENFORCED_ROLES.includes(String(admin.role))) mustSet2fa = true;
      }
    }

    // 🛡️ 2026-06-24: 성공 로그인 → 이 IP 의 admin_login rate-limit 카운터 비움.
    //   "본인이 5분에 5번 로그인하면 전부 성공이어도 잠기는" 문제 방지. 실패 시도는
    //   위(잘못된 비번/PIN)에서 이미 반환되어 카운터에 남으므로 brute-force 방어 불변.
    //   응답 후 실행(waitUntil) — 로그인 임계경로에 DB write 추가 안 함.
    if (c.executionCtx) c.executionCtx.waitUntil(resetRateLimit(c, 'admin_login'));
    else await resetRateLimit(c, 'admin_login');

    // 🆕 로그인 이력(IP) 기록 — fail-soft (로그인 차단 안 함).
    try {
      await ensureAdminLoginHistory(DB);
      await DB.prepare(
        `INSERT INTO admin_login_history (admin_id, email, ip, user_agent, success) VALUES (?, ?, ?, ?, 1)`
      ).bind(String(admin.id), admin.email, reqIp, c.req.header('User-Agent') || null).run();
    } catch (e) { console.error('[Admin Login] login history write failed:', e); }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: admin.id.toString(),
      email: admin.email,
      name: admin.name,
      username: admin.username,
      role: admin.role,
      type: 'admin',
      iat: now,
      // 🛡️ 2026-04-22: admin access token 7d → 1d (breach window 축소)
      // refresh token 으로 rotate — UI 에서는 자동 재발급되어 UX 에 영향 없음
      exp: now + (24 * 60 * 60)
    };

    const token = await sign(payload, JWT_SECRET);
    const refreshPayload = { ...payload, exp: now + (30 * 24 * 60 * 60) };
    const refreshToken = await sign(refreshPayload, JWT_SECRET);

    // 🔐 단일 세션 강제 — 이 로그인(iat) 이전 발급된 admin 토큰 전부 무효화.
    await startDashboardSession(DB, 'admin', admin.id, payload.iat, { userAgent: c.req.header('User-Agent'), ip: reqIp });

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

    // 🛡️ 2026-04-22 Phase 1: httpOnly 쿠키 추가 (Bearer 병행)
    let adminCookie = '';
    let adminUdCookie = '';
    try {
      const { createSessionCookie } = await import('../../../worker/utils/session');
      adminCookie = await createSessionCookie(
        admin.id as number, admin.name as string, admin.email as string,
        null, JWT_SECRET, 'admin',
      );
      // 🔐 2026-06-17 쿠키 전환 Phase 1: ud_admin_token dual-write (GET 전용 읽기 — Bearer/localStorage 흐름 불변).
      const { authTokenSetCookie } = await import('../../../worker/utils/auth-cookies');
      adminUdCookie = authTokenSetCookie('ud_admin_token', token, new URL(c.req.url).hostname);
    } catch {}

    const res = c.json({
      success: true,
      data: {
        accessToken: token,
        refreshToken,
        token, // backward compatibility
        must_set_pin: mustSetPin, // 🆕 강제 대상(도매 파트너/슈퍼)인데 보안 PIN 미설정 → 프론트가 PIN 설정 유도
        must_set_2fa: mustSet2fa, // 🔐 R3 ④: finance/super 인데 2FA 미등록 → 프론트가 /admin/2fa 설정 유도 (must_set_pin 미러)
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
    if (adminCookie) res.headers.append('Set-Cookie', adminCookie);
    if (adminUdCookie) res.headers.append('Set-Cookie', adminUdCookie);
    return res;

  } catch (error) {
    console.error('[Admin Login] Error:', error);
    return c.json({ success: false, error: '로그인 중 오류가 발생했습니다.' }, 500);
  }
});

/**
 * POST /api/admin/refresh
 * Refresh Token으로 새 Access Token 발급
 */
adminRoutes.post('/refresh', cors(), rateLimit({ action: 'admin_refresh', max: 20, windowSec: 300 }), async (c) => {
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
    // 🔐 2026-07-05: 삭제/비활성 계정은 refresh 로 세션 재발급 불가 — is_active 게이트(삭제 즉시 무효화).
    const admins = await executeQuery<any>(
      DB,
      'SELECT id, username, email, name, role FROM admins WHERE id = ? AND COALESCE(is_active, 1) = 1',
      [adminId]
    );

    if (admins.length === 0) {
      console.warn('[Admin Refresh] Admin not found or deactivated:', adminId);
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
        // 🛡️ 2026-07-04: 행 단위 만료 강제 — 이전엔 expires_at 을 조회만 하고 검사하지 않았음
        //   (JWT exp 에만 의존). 아래 회전-유예(grace)를 도입하며 유예 지난 행이 계속 통하지
        //   않도록 여기서 걸러낸다.
        const nowMs = Date.now();
        const alive = filterAliveRefreshRows(candidates, nowMs);
        let matchedId: number | null = null;
        for (const row of alive) {
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
        // 🛡️ 2026-07-04 (대표 "수시로 로그아웃"): rotate 즉시삭제 → **60초 유예**로 변경.
        //   즉시 삭제하면 여러 탭이 같은 refresh 로 동시 갱신할 때 진 쪽이 'not recognized' 401
        //   → 강제 로그아웃 + clearAuthData 가 이긴 탭의 새 토큰까지 삭제 → 전 탭 연쇄 로그아웃.
        //   유예 내 재사용은 각자 새 토큰을 받고(경합 무해화), 유예 후엔 위 alive 필터가 차단
        //   (rotation/재사용-탐지 의미 보존). 클라 짝: api.ts 인터셉터의 '저장소 변화 감지 재시도'.
        await DB.prepare(
          `UPDATE auth_refresh_tokens SET expires_at = ? WHERE id = ? AND expires_at > ?`,
        ).bind(
          rotationGraceExpiryIso(nowMs), matchedId, rotationGraceExpiryIso(nowMs),
        ).run().catch(swallow('auth:api:admin'));
        // 유예 지난 행 정리 (best-effort)
        await DB.prepare(
          `DELETE FROM auth_refresh_tokens WHERE user_type = 'admin' AND user_id = ? AND expires_at <= ?`,
        ).bind(Number(adminId), new Date(nowMs).toISOString()).run().catch(swallow('auth:api:admin'));
      }
    } catch (e) {
      console.error('[Admin Refresh] token store verify failed:', e);
      // 가용성: 저장소 오류로 인한 차단은 하지 않음
    }

    // 🔐 단일 세션 강제 — 더 늦은 로그인이 무효화한 refresh 로는 갱신 거부(옛 기기 우회 차단).
    if (!(await isDashboardSessionCurrent(DB, 'admin', adminId, payload.iat))) {
      return c.json({ success: false, error: '다른 기기에서 로그인되어 세션이 만료되었습니다. 다시 로그인해주세요.', code: 'SESSION_SUPERSEDED' }, 401);
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
      // 🛡️ 2026-04-22: admin access token 1d (refresh 로 갱신)
      exp: now + (24 * 60 * 60)
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

// ============================================================
// 🛡️ Admin 2FA/TOTP — 배치 86 (2026-04-22)
// POST /api/admin/2fa/setup   — TOTP secret 생성 + QR URI 반환
// POST /api/admin/2fa/verify  — 6자리 OTP 검증 후 활성화
// POST /api/admin/2fa/validate — 로그인 후 2FA 검증 (로그인 플로우에서 호출)
// ============================================================

import { requireAdmin } from '@/worker/middleware/auth';

import { swallow } from '@/worker/utils/swallow';

// 🆕 2026-06-17 보안 PIN 설정/변경 — 로그인된 관리자가 6자리 PIN 설정(해시 저장). 이후 매 로그인 필수.
adminRoutes.post('/set-login-pin', cors(), rateLimit({ action: 'admin_set_pin', max: 10, windowSec: 600 }), requireAdmin() as any, async (c) => {
  const { DB } = c.env;
  const user = (c as unknown as { get: (k: string) => unknown }).get('user') as { id?: string | number } | undefined;
  if (!user?.id) return c.json({ success: false, error: 'Unauthorized' }, 401);
  let pin = '';
  let currentPin = '';
  try {
    const body = (await c.req.json<{ pin?: string; current_pin?: string }>()) || {};
    pin = String(body.pin || '').trim();
    currentPin = String(body.current_pin || '').trim();
  } catch { /* invalid json */ }
  if (!/^\d{6}$/.test(pin)) return c.json({ success: false, error: '6자리 숫자 PIN을 입력하세요' }, 400);
  // 너무 단순한 PIN 차단 (같은 숫자 6개 / 순차).
  if (/^(\d)\1{5}$/.test(pin) || ['123456', '654321', '012345', '111111'].includes(pin)) {
    return c.json({ success: false, error: '너무 단순한 PIN 입니다. 다른 6자리를 사용하세요' }, 400);
  }
  try {
    await ensureLoginPinColumn(DB);
    // 🔐 2026-07-11 (사전점검 보안감사 R3): 이미 PIN 이 설정된 계정은 기존 PIN(current_pin) 검증
    //   후에만 변경 가능 — 토큰 탈취자가 PIN 을 무단 재설정하는 경로 차단(단계적 재인증).
    //   최초 설정(login_pin_hash IS NULL)은 현행 옵트인 흐름 그대로(current_pin 불요).
    //   검증은 로그인 PIN 검증(:180)과 동일하게 verifyPassword(bcrypt) 재사용.
    const existingRow = await DB.prepare('SELECT login_pin_hash FROM admins WHERE id = ?')
      .bind(user.id).first<{ login_pin_hash: string | null }>();
    if (existingRow?.login_pin_hash) {
      if (!/^\d{6}$/.test(currentPin)) {
        return c.json({ success: false, error: '기존 보안 PIN(current_pin)을 입력해야 변경할 수 있습니다', code: 'CURRENT_PIN_REQUIRED' }, 400);
      }
      const { valid: currentOk } = await verifyPassword(currentPin, existingRow.login_pin_hash);
      if (!currentOk) {
        return c.json({ success: false, error: '기존 보안 PIN이 올바르지 않습니다', code: 'CURRENT_PIN_MISMATCH' }, 403);
      }
    }
    const hash = await hashPassword(pin);
    await DB.prepare('UPDATE admins SET login_pin_hash = ? WHERE id = ?').bind(hash, user.id).run();
    return c.json({ success: true, message: '보안 PIN이 설정되었습니다. 다음 로그인부터 사용됩니다.' });
  } catch (e) {
    console.error('[Admin set-login-pin] error:', e);
    return c.json({ success: false, error: 'PIN 설정 실패' }, 500);
  }
});

// Setup: TOTP secret 생성 → QR 코드용 URI 반환
adminRoutes.post('/2fa/setup', cors(), rateLimit({ action: 'admin_2fa_setup', max: 10, windowSec: 600 }), requireAdmin() as any, async (c) => {
  const { DB } = c.env;
  const user = (c as any).get('user') as { id: string | number; email: string } | undefined;
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

  try {
    const { generateTOTPSecret, buildTOTPUri } = await import('../../../worker/utils/totp');

    // 이미 활성화된 경우 재설정 불가 (기��� secret 유지)
    try {
      await DB.prepare(`
        CREATE TABLE IF NOT EXISTS admin_2fa (
          admin_id INTEGER PRIMARY KEY,
          totp_secret TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          activated_at TEXT
        )
      `).run();
    } catch {}

    const existing = await DB.prepare(
      'SELECT is_active FROM admin_2fa WHERE admin_id = ? AND is_active = 1'
    ).bind(user.id).first();
    if (existing) {
      return c.json({ success: false, error: '2FA 가 이미 활성화되어 있습니다. 비활성화 후 다시 설정하세요.' }, 400);
    }

    const secret = generateTOTPSecret();
    const uri = buildTOTPUri(secret, user.email);

    // secret 저장 (아직 비활성)
    await DB.prepare(`
      INSERT INTO admin_2fa (admin_id, totp_secret, is_active) VALUES (?, ?, 0)
      ON CONFLICT(admin_id) DO UPDATE SET totp_secret = ?, is_active = 0, activated_at = NULL
    `).bind(user.id, secret, secret).run();

    return c.json({ success: true, data: { secret, uri } });
  } catch (err) {
    console.error('[Admin 2FA] Setup error:', err);
    return c.json({ success: false, error: '2FA 설정 실패' }, 500);
  }
});

// Verify: 최초 활성화 시 OTP 확인
adminRoutes.post('/2fa/verify', cors(), rateLimit({ action: 'admin_2fa_verify', max: 10, windowSec: 600 }), requireAdmin() as any, async (c) => {
  const { DB } = c.env;
  const user = (c as any).get('user') as { id: string | number; email: string } | undefined;
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const { code } = await c.req.json<{ code: string }>();
  if (!code || typeof code !== 'string' || code.length !== 6) {
    return c.json({ success: false, error: '6자리 인증 코드를 입력하세요' }, 400);
  }

  try {
    const { verifyTOTP } = await import('../../../worker/utils/totp');

    const row = await DB.prepare(
      'SELECT totp_secret, is_active FROM admin_2fa WHERE admin_id = ?'
    ).bind(user.id).first<{ totp_secret: string; is_active: number }>();
    if (!row) return c.json({ success: false, error: '2FA 를 먼저 설정하세요 (POST /2fa/setup)' }, 400);
    if (row.is_active) return c.json({ success: false, error: '2FA 가 이미 활성화되어 있습니다' }, 400);

    const valid = await verifyTOTP(row.totp_secret, code);
    if (!valid) return c.json({ success: false, error: '인증 코드가 유효하지 않습니다' }, 401);

    await DB.prepare(
      "UPDATE admin_2fa SET is_active = 1, activated_at = datetime('now') WHERE admin_id = ?"
    ).bind(user.id).run();

    return c.json({ success: true, message: '2FA 가 활성���되었습니다' });
  } catch (err) {
    console.error('[Admin 2FA] Verify error:', err);
    return c.json({ success: false, error: '2FA 검증 실패' }, 500);
  }
});

// Validate: 로그인 후 2FA 검증 (클라이언트가 로그인 성공 후 호출)
adminRoutes.post('/2fa/validate', cors(), rateLimit({ action: 'admin_2fa_validate', max: 10, windowSec: 600 }), requireAdmin() as any, async (c) => {
  const { DB } = c.env;
  const user = (c as any).get('user') as { id: string | number; email: string } | undefined;
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const { code } = await c.req.json<{ code: string }>();
  if (!code || typeof code !== 'string' || code.length !== 6) {
    return c.json({ success: false, error: '6자리 인증 코드를 입력하세요' }, 400);
  }

  try {
    const { verifyTOTP } = await import('../../../worker/utils/totp');

    const row = await DB.prepare(
      'SELECT totp_secret, is_active FROM admin_2fa WHERE admin_id = ? AND is_active = 1'
    ).bind(user.id).first<{ totp_secret: string; is_active: number }>();
    if (!row) return c.json({ success: true, twofa_required: false, message: '2FA 미설정 — 통과' });

    const valid = await verifyTOTP(row.totp_secret, code);
    if (!valid) return c.json({ success: false, error: '인증 코드가 유효하지 않습니다' }, 401);

    return c.json({ success: true, twofa_validated: true, message: '2FA 인증 완료' });
  } catch (err) {
    console.error('[Admin 2FA] Validate error:', err);
    return c.json({ success: false, error: '2FA 검증 실패' }, 500);
  }
});

export default adminRoutes;


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureAuthRefreshTokensTable = new WeakSet<object>()
