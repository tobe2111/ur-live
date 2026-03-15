/**
 * Account Management API Routes
 *
 * Endpoints:
 * - DELETE /api/account/delete - 계정 탈퇴
 * - GET    /api/account/check-restriction - 재가입 제한 확인
 */
import { Hono } from 'hono';
import { deleteUserAccount, checkReregistrationRestriction } from '@/worker/services/delete-account.service';
export const accountRoutes = new Hono();
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
accountRoutes.delete('/delete', async (c) => {
    try {
        console.log('[Account Delete] Request received');
        const body = await c.req.json();
        const { userId, reason } = body;
        if (!userId) {
            return c.json({
                success: false,
                message: '사용자 ID가 필요합니다.'
            }, 400);
        }
        console.log('[Account Delete] Processing for userId:', userId);
        // 계정 삭제 처리
        const result = await deleteUserAccount({ userId, reason });
        console.log('[Account Delete] Success:', result);
        return c.json(result, 200);
    }
    catch (error) {
        console.error('[Account Delete] Error:', error);
        return c.json({
            success: false,
            message: error instanceof Error ? error.message : '회원 탈퇴 처리 중 오류가 발생했습니다.'
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
        console.log('[Account Restriction] Checking for email:', email);
        const result = await checkReregistrationRestriction(email);
        return c.json(result, 200);
    }
    catch (error) {
        console.error('[Account Restriction] Error:', error);
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
