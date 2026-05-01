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
import { ALLOWED_ORIGINS } from '@/shared/constants';
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
accountRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }));

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
