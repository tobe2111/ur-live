// ============================================================
// Users Routes
// GET  /api/users/role  - Firebase ID 토큰에서 사용자 역할 반환
// POST /api/users/init  - 회원가입 후 사용자 초기화 (Firebase UID → DB)
//
// 이 엔드포인트들은 프론트엔드(useAuthKR, useAuthWorld)에서
// /api/users/* 로 직접 호출하므로 kakaoRoutes 내부가 아닌
// 최상위 /api/users/* 경로로 반드시 등록되어야 한다.
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth, getCurrentUser, optionalAuth } from '../middleware/auth';

import { swallow } from '../utils/swallow';
export const usersRouter = new Hono<{ Bindings: Env }>();

// ── GET /api/users/role ───────────────────────────────────────────────────────
// Firebase ID 토큰으로 인증 후 DB에서 역할 조회 (서명 검증 포함)
usersRouter.get('/role', optionalAuth(), async (c) => {
  try {
    // optionalAuth()가 서명 검증을 처리함 — 미인증 시 기본 'user' 반환
    const authUser = getCurrentUser(c);
    if (!authUser) {
      return c.json({ success: true, role: 'user', message: 'No valid token – default role' });
    }

    const firebaseUid = String(authUser.id);
    const numericId = parseInt(firebaseUid, 10);
    const email = authUser.email ?? null;
    const db = c.env.DB;

    // DB에서 역할 조회 — production sellers/admins 테이블은 firebase_uid/user_id 컬럼이 없음.
    // username(=이메일) 또는 id(숫자 JWT sub) 기준으로 조회.
    const seller = await db
      .prepare(
        'SELECT id FROM sellers WHERE (? IS NOT NULL AND (username = ? OR email = ?)) OR (? IS NOT NULL AND id = ?) LIMIT 1'
      )
      .bind(email, email, email, Number.isFinite(numericId) ? numericId : null, Number.isFinite(numericId) ? numericId : null)
      .first()
      .catch(() => null);

    if (seller) {
      return c.json({ success: true, role: 'seller', data: { role: 'seller' } });
    }

    const admin = await db
      .prepare(
        'SELECT id FROM admins WHERE (? IS NOT NULL AND (username = ? OR email = ?)) OR (? IS NOT NULL AND id = ?) LIMIT 1'
      )
      .bind(email, email, email, Number.isFinite(numericId) ? numericId : null, Number.isFinite(numericId) ? numericId : null)
      .first()
      .catch(() => null);

    if (admin) {
      return c.json({ success: true, role: 'admin', data: { role: 'admin' } });
    }

    return c.json({ success: true, role: 'user', data: { role: 'user' } });
  } catch (err: any) {
    console.error('[/api/users/role] Error:', err);
    // 오류 시 안전하게 user 역할 반환 (로그인 차단하지 않음)
    return c.json({ success: true, role: 'user', data: { role: 'user' } });
  }
});

// ── POST /api/users/init ──────────────────────────────────────────────────────
// Firebase 회원가입 후 DB 사용자 레코드 초기화 (서명 검증 포함)
// fire-and-forget 방식으로 호출됨 (.catch(swallow('worker:routes:users')))
usersRouter.post('/init', requireAuth(), async (c) => {
  try {
    const authUser = getCurrentUser(c);
    if (!authUser) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const { displayName } = await c.req.json<{ displayName?: string }>().catch(() => ({} as any));

    // 서명 검증된 토큰에서 UID/이메일 사용
    const firebaseUid = String(authUser.id);
    const email = authUser.email ?? null;

    const db = c.env.DB;

    // users 테이블에 upsert
    // Session cookie users already have a numeric DB ID — skip upsert for them
    const initNumericId = parseInt(firebaseUid, 10);
    if (Number.isFinite(initNumericId)) {
      // Numeric ID means user already exists via session cookie auth — just touch updated_at
      await db
        .prepare(`UPDATE users SET updated_at = datetime('now'), name = COALESCE(?, name) WHERE id = ?`)
        .bind(displayName || null, initNumericId)
        .run()
        .catch((e: any) => {
          console.warn('[/api/users/init] DB update failed (non-critical):', e?.message);
        });
    } else {
      await db
        .prepare(
          `INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
           VALUES (?, ?, ?, datetime('now'), datetime('now'))
           ON CONFLICT(firebase_uid) DO UPDATE SET
             updated_at = datetime('now'),
             name = COALESCE(excluded.name, name)`
        )
        .bind(firebaseUid, email, displayName || null)
        .run()
        .catch((e: any) => {
          console.warn('[/api/users/init] DB upsert failed (non-critical):', e?.message);
        });
    }

    return c.json({ success: true, message: 'User initialized' });
  } catch (err: any) {
    console.error('[/api/users/init] Error:', err);
    return c.json({ success: true, message: 'Init skipped' }); // fire-and-forget이므로 200 반환
  }
});
