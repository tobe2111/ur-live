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

    // 📜 2026-07-05: 이메일 가입 폼(RegisterPage)이 보내던 동의 플래그 — 기존엔 서버가 읽지도
    //   저장하지도 않고 버렸음(감사 발견). terms_agreements 에 버전 포함 증적으로 기록.
    const { displayName, terms_agreed, privacy_agreed, marketing_agreed } = await c.req.json<{
      displayName?: string; terms_agreed?: boolean; privacy_agreed?: boolean; marketing_agreed?: boolean; age_confirmed?: boolean;
    }>().catch(() => ({} as any));

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

    // 📜 2026-07-05: 동의 로그 기록 (누가·언제·몇 버전) — fail-soft(가입 흐름 보호), 멱등(UNIQUE).
    try {
      if (terms_agreed !== undefined || privacy_agreed !== undefined || marketing_agreed !== undefined) {
        const { recordTermsAgreements } = await import('../utils/terms-agreements');
        const agreements: Array<{ doc_type: string; agreed: boolean }> = [];
        if (terms_agreed) agreements.push({ doc_type: 'service', agreed: true });
        if (privacy_agreed) agreements.push({ doc_type: 'privacy', agreed: true });
        if (marketing_agreed !== undefined) agreements.push({ doc_type: 'marketing', agreed: !!marketing_agreed });
        if (agreements.length > 0) {
          // subject_id: 세션(숫자 id) 유저는 그대로, firebase 유저는 firebase_uid 로 기록.
          await recordTermsAgreements(db, 'user', firebaseUid, agreements);
        }
        // users.terms_agreed_at (기존 dead column 실사용화 — 있으면 채움)
        if (terms_agreed) {
          await db.prepare(`UPDATE users SET terms_agreed_at = datetime('now') WHERE (id = ? OR firebase_uid = ?) AND terms_agreed_at IS NULL`)
            .bind(Number.isFinite(initNumericId) ? initNumericId : -1, firebaseUid)
            .run().catch(() => { /* 컬럼 부재 환경 graceful */ });
        }
      }
    } catch { /* fail-soft */ }

    return c.json({ success: true, message: 'User initialized' });
  } catch (err: any) {
    console.error('[/api/users/init] Error:', err);
    return c.json({ success: true, message: 'Init skipped' }); // fire-and-forget이므로 200 반환
  }
});
