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
import { rateLimit } from '@/worker/middleware/rate-limit';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import {
  deleteUserAccount,
  checkReregistrationRestriction,
  type DeleteAccountRequest
} from '@/worker/services/delete-account.service';
import { logError } from '@/worker/utils/logger';

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
accountRoutes.delete('/delete', rateLimit({ action: 'account_delete', max: 3, windowSec: 3600 }), requireAuth(), async (c) => {
  try {
    const authenticatedUser = getCurrentUser(c);
    if (!authenticatedUser) {
      return c.json({ success: false, message: '인증이 필요합니다.' }, 401);
    }

    const body = await c.req.json<DeleteAccountRequest>();
    const { reason } = body;

    // userId는 반드시 인증된 사용자 본인의 ID만 사용 — 요청 body userId 무시
    const userId = String(authenticatedUser.id);

    // 계정 삭제 처리
    const result = await deleteUserAccount({ userId, reason }, c.env.DB);

    return c.json(result, 200);
  } catch (error) {
    logError('account.delete.error', { error: (error as Error)?.message });

    return c.json({
      success: false,
      message: '회원 탈퇴 처리 중 오류가 발생했습니다.'
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
    logError('account.checkRestriction.error', { error: (error as Error)?.message });
    
    return c.json({
      success: false,
      message: '재가입 제한 확인 중 오류가 발생했습니다.'
    }, 500);
  }
});

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
      'GET /api/account/check-restriction'
    ]
  });
});
