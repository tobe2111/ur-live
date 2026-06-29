/**
 * Account Management API Routes
 * 
 * Endpoints:
 * - DELETE /api/account/delete - 계정 탈퇴
 * - GET    /api/account/check-restriction - 재가입 제한 확인
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import { clearSessionCookie } from '@/worker/utils/session';
import {
  deleteUserAccount,
  checkReregistrationRestriction,
  restoreUser,
  findRestorableAccount,
  type DeleteAccountRequest
} from '@/worker/services/delete-account.service';

type Bindings = {
  DB: D1Database;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_DATABASE_URL?: string;
  JWT_SECRET?: string;
  TOSS_SECRET_KEY?: string;
  TOSS_CLIENT_KEY?: string;
  SESSION_KV?: KVNamespace;
  CACHE_KV?: KVNamespace;
  RATE_LIMIT_KV?: KVNamespace;
  DISCORD_WEBHOOK_URL?: string;
};

export const accountRoutes = new Hono<{ Bindings: Bindings }>();
// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.

// 🛡️ 2026-06-12 (감사 1단계 — 알림 토글 실동작화): users.push_enabled / email_enabled
//   메모이즈 ensure (per-request DDL 금지 룰 — WeakSet 1회). repair-schema 에도 등록됨.
const _notifPrefColsEnsured = new WeakSet<D1Database>();
async function ensureNotificationPrefColumns(db: D1Database) {
  if (_notifPrefColsEnsured.has(db)) return;
  _notifPrefColsEnsured.add(db);
  try { await db.prepare('ALTER TABLE users ADD COLUMN push_enabled INTEGER DEFAULT 1').run(); } catch { /* exists */ }
  try { await db.prepare('ALTER TABLE users ADD COLUMN email_enabled INTEGER DEFAULT 1').run(); } catch { /* exists */ }
}

/**
 * GET /api/account/notification-prefs — 본인 알림 설정 조회.
 * 컬럼 NULL(기존 유저) 은 enabled(1) 취급 — opt-out 모델.
 */
accountRoutes.get('/notification-prefs', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) return c.json({ success: false, error: '인증이 필요합니다' }, 401);
    await ensureNotificationPrefColumns(c.env.DB);
    const row = await c.env.DB.prepare(
      'SELECT COALESCE(push_enabled, 1) AS push_enabled, COALESCE(email_enabled, 1) AS email_enabled FROM users WHERE id = ?'
    ).bind(user.id).first<{ push_enabled: number; email_enabled: number }>();
    return c.json({
      success: true,
      data: {
        push: row ? Number(row.push_enabled) !== 0 : true,
        email: row ? Number(row.email_enabled) !== 0 : true,
      },
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[account:notif-prefs:get]', err);
    return c.json({ success: false, error: '알림 설정 조회 중 오류가 발생했습니다' }, 500);
  }
});

/**
 * PATCH /api/account/notification-prefs — 본인 알림 설정 변경.
 * Body: { push?: boolean, email?: boolean } (최소 1개 필수, boolean 만 허용)
 */
accountRoutes.patch('/notification-prefs', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) return c.json({ success: false, error: '인증이 필요합니다' }, 401);
    const body = await c.req.json<{ push?: unknown; email?: unknown }>().catch(() => ({} as { push?: unknown; email?: unknown }));
    const sets: string[] = [];
    const binds: number[] = [];
    if (typeof body.push === 'boolean') { sets.push('push_enabled = ?'); binds.push(body.push ? 1 : 0); }
    if (typeof body.email === 'boolean') { sets.push('email_enabled = ?'); binds.push(body.email ? 1 : 0); }
    if (sets.length === 0) return c.json({ success: false, error: 'push 또는 email (boolean) 이 필요합니다' }, 400);
    await ensureNotificationPrefColumns(c.env.DB);
    await c.env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...binds, user.id).run();
    return c.json({ success: true });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[account:notif-prefs:patch]', err);
    return c.json({ success: false, error: '알림 설정 저장 중 오류가 발생했습니다' }, 500);
  }
});

/**
 * DELETE /api/account/delete
 * 사용자 계정 탈퇴 처리
 * 
 * Request Body:
 * {
 *   userId: string;
 *   reason?: string; // 선택적: 탈퇴 사유
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   message: string;
 *   deletedAt: string;
 * }
 */
accountRoutes.delete('/delete', requireAuth(), async (c) => {
  try {
    const authenticatedUser = getCurrentUser(c);
    if (!authenticatedUser) {
      return c.json({ success: false, message: '인증이 필요합니다.' }, 401);
    }

    // 🛡️ 2026-05-01: DELETE 요청은 body 없을 수 있음. c.req.json() 이 throw 하면
    //   "Unexpected end of JSON input" 사용자 신고. 안전 파싱.
    let body: Partial<DeleteAccountRequest> = {};
    try {
      body = await c.req.json<DeleteAccountRequest>();
    } catch {
      // body 없거나 invalid JSON — 빈 객체로 진행 (reason 은 optional)
    }
    const { reason } = body;

    // userId는 반드시 인증된 사용자 본인의 ID만 사용 — 요청 body userId 무시
    const userId = String(authenticatedUser.id);

    // 계정 삭제 처리
    const result = await deleteUserAccount({ userId, reason }, c.env.DB);

    // 🔑 2026-06-29 (로그아웃 근본수정 — 탈퇴 시 세션 무효화): 소비자 탈퇴는 row 를 soft-delete/익명화
    //   하지만 이미 발급된 httpOnly ur_session JWT 는 만료 전까지 유효 → 탈퇴 직후에도 그 쿠키로 재인증되는
    //   잔존 소비자 세션 위험(클라는 httpOnly 쿠키를 JS 로 못 지움). 200 응답에서 *삭제된 신원*(소비자) 의
    //   세션쿠키만 Max-Age=0 으로 무효화. 역할 세션(seller/admin/agency/제조사 — ud_* / ur_*_session)은
    //   별 신원이라 건드리지 않음(같은 기기의 다른 역할 로그인을 부당하게 끊지 않음).
    try {
      c.header('Set-Cookie', clearSessionCookie('user'), { append: true });
    } catch { /* 헤더 set 실패는 탈퇴 결과에 영향 없음 */ }

    return c.json(result, 200);
  } catch (error) {
    const errMsg = (error as Error).message || 'unknown';
    console.error('[Account Delete] Error:', errMsg);

    // 🛡️ 2026-05-01: 진단 위해 detail 필드에 원본 메시지 노출.
    //   message 는 사용자 친화 / detail 은 개발자 진단.
    return c.json({
      success: false,
      message: '회원 탈퇴 처리 중 오류가 발생했습니다.',
      error: errMsg,
      detail: errMsg,
    }, 500);
  }
});

/**
 * GET /api/account/check-restriction
 * 재가입 제한 확인
 * 
 * Query params:
 * - email: 확인할 이메일
 * 
 * Response:
 * {
 *   restricted: boolean;
 *   availableAt?: string; // ISO 8601 date string
 * }
 */
accountRoutes.get('/check-restriction', async (c) => {
  try {
    const email = c.req.query('email');

    if (!email) {
      return c.json({
        success: false,
        message: '이메일이 필요합니다.'
      }, 400);
    }

    const result = await checkReregistrationRestriction(email, c.env.DB);

    return c.json(result, 200);
  } catch (error) {
    console.error('[Account Restriction] Error:', error);
    
    return c.json({
      success: false,
      message: '재가입 제한 확인 중 오류가 발생했습니다.'
    }, 500);
  }
});

/**
 * 🛡️ 2026-05-01: GET /api/account/restorable?kakao_id=XXX
 *   카카오 OAuth 후 prompt 가 표시될 때 복원 가능 계정 체크.
 *   인증 불필요 (kakao_id 만으로 readonly 체크).
 */
accountRoutes.get('/restorable', async (c) => {
  const kakaoId = c.req.query('kakao_id')
  if (!kakaoId) return c.json({ success: false, error: 'kakao_id required' }, 400)

  const found = await findRestorableAccount(kakaoId, c.env.DB)
  if (!found) return c.json({ success: true, restorable: false })

  return c.json({
    success: true,
    restorable: true,
    data: {
      original_name: found.original_name,
      deleted_at: found.deleted_at,
      reregister_available_at: found.reregister_available_at,
    },
  })
})

/**
 * 🛡️ 2026-05-01: POST /api/account/restore
 *   사용자가 동의 화면에서 "복원하기" 클릭 시 호출.
 *   세션 cookie 가 이미 발급된 상태 (방금 카카오 로그인 끝남).
 */
accountRoutes.post('/restore', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'unauth' }, 401)

  // 현재 로그인된 사용자의 kakao_id 조회 (방금 만들어진 신규 row)
  const current = await c.env.DB
    .prepare('SELECT kakao_id, name, email, profile_image FROM users WHERE id = ?')
    .bind(user.id)
    .first<{ kakao_id: string | null; name: string; email: string | null; profile_image: string | null }>()

  if (!current?.kakao_id) {
    return c.json({ success: false, error: '카카오 계정이 아닙니다' }, 400)
  }

  const result = await restoreUser(
    current.kakao_id,
    current.name,
    current.email,
    current.profile_image,
    c.env.DB
  )

  if (!result.success) {
    return c.json({ success: false, error: result.error || '복원 실패' }, 400)
  }

  return c.json({ success: true, data: { restored_user_id: result.userId } })
})

/**
 * GET /api/account/health
 * Health check for account routes
 */
accountRoutes.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'account-management',
    version: '1.0.0',
    endpoints: [
      'DELETE /api/account/delete',
      'GET /api/account/check-restriction',
      'GET /api/account/restorable',
      'POST /api/account/restore',
    ]
  });
});
