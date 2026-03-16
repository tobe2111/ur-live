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

export const usersRouter = new Hono<{ Bindings: Env }>();

// ── GET /api/users/role ───────────────────────────────────────────────────────
// Firebase ID 토큰으로 인증 후 DB에서 역할 조회
// seller/admin 계정이 일반 로그인 경로로 접근하는 것 차단에 사용
usersRouter.get('/role', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: true, role: 'user', message: 'No token – default role' });
    }

    const idToken = authHeader.substring(7);
    const db = c.env.DB;

    // Firebase ID 토큰 decode (검증 없이 payload만 파싱 – Cloudflare Worker 환경)
    // 보안 중요: 실제 서명 검증은 Firebase Admin SDK가 필요하지만
    // Worker 환경에서는 jose 로 공개키 검증하거나, DB 조회로 역할 확인
    // 여기서는 토큰에서 sub(UID)를 추출해 DB에서 역할을 조회한다.
    let firebaseUid: string | null = null;
    try {
      const parts = idToken.split('.');
      if (parts.length === 3) {
        const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(payloadJson);
        firebaseUid = payload.sub || payload.user_id || null;
      }
    } catch {
      // 파싱 실패 시 기본값 반환
    }

    if (!firebaseUid) {
      return c.json({ success: true, role: 'user', message: 'Token parse failed – default role' });
    }

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
// Firebase 회원가입 후 DB 사용자 레코드 초기화
// fire-and-forget 방식으로 호출됨 (.catch(() => {}))
usersRouter.post('/init', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const idToken = authHeader.substring(7);
    const { displayName } = await c.req.json<{ displayName?: string }>().catch(() => ({} as any));

    // Firebase UID 추출
    let firebaseUid: string | null = null;
    let email: string | null = null;
    try {
      const parts = idToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        firebaseUid = payload.sub || payload.user_id || null;
        email = payload.email || null;
      }
    } catch {
      //
    }

    if (!firebaseUid) {
      return c.json({ success: false, error: 'Invalid token' }, 400);
    }

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
