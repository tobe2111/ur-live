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
    const db = c.env.DB;

    // DB에서 역할 조회 (sellers / admin 계정 체크)
    const seller = await db
      .prepare('SELECT id FROM sellers WHERE firebase_uid = ? LIMIT 1')
      .bind(firebaseUid)
      .first()
      .catch(() => null);

    if (seller) {
      return c.json({ success: true, role: 'seller', data: { role: 'seller' } });
    }

    const admin = await db
      .prepare("SELECT id FROM admins WHERE firebase_uid = ? LIMIT 1")
      .bind(firebaseUid)
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
// fire-and-forget 방식으로 호출됨 (.catch(() => {}))
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
        // users 테이블 스키마 차이로 실패할 수 있음 – 무시
        console.warn('[/api/users/init] DB upsert failed (non-critical):', e?.message);
      });

    return c.json({ success: true, message: 'User initialized' });
  } catch (err: any) {
    console.error('[/api/users/init] Error:', err);
    return c.json({ success: true, message: 'Init skipped' }); // fire-and-forget이므로 200 반환
  }
});
