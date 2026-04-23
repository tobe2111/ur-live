/**
 * Admin Users Routes — 유저 관리
 *
 * 🛡️ 2026-04-22 배치 154 (TD-006 부분): admin-management.routes.ts 에서 분리.
 *
 * 엔드포인트:
 * - GET   /users                 — 유저 목록 (검색 + 페이지네이션)
 * - GET   /users/:id             — 유저 상세 (주문·리뷰 통계 포함)
 * - PATCH /users/:id/status      — 유저 상태 변경 (active/suspended/banned)
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { executeQuery, executeRun } from '@/worker/utils/database';
import { writeAuditLog } from '@/worker/middleware/admin-security';

export const adminUsersRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

interface CountRow { count: number }
interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  provider: string | null;
  status: string | null;
  created_at: string;
  deal_balance: number | null;
}
interface UserDetailRow extends UserRow {
  order_count: number;
  total_spent: number;
  review_count: number;
}

adminUsersRoutes.get('/users', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50')));
    const offset = (page - 1) * limit;
    const search = c.req.query('search');

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push('(u.name LIKE ? OR u.email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await executeQuery<CountRow>(DB,
      `SELECT COUNT(*) as count FROM users u ${where}`, params
    );
    const total = countRows[0]?.count || 0;

    const users = await executeQuery<UserRow>(DB,
      `SELECT u.id, u.name, u.email, u.phone, u.created_at
       FROM users u
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return c.json({
      success: true,
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] users list error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminUsersRoutes.patch('/users/:id/status', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const userId = c.req.param('id');
    const { status } = await c.req.json<{ status: string }>();

    if (!['active', 'suspended', 'banned'].includes(status)) {
      return c.json({ success: false, error: '유효하지 않은 상태입니다. active, suspended, banned 중 선택하세요' }, 400);
    }

    const rows = await executeQuery<{ id: string; status: string }>(DB,
      `SELECT id, status FROM users WHERE id = ?`, [userId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '사용자를 찾을 수 없습니다' }, 404);
    }

    await executeRun(DB, `UPDATE users SET status = ? WHERE id = ?`, [status, userId]);

    await writeAuditLog(c, {
      action: 'update_user_status',
      targetType: 'user',
      targetId: userId,
      before: { status: rows[0].status },
      after: { status }
    });

    return c.json({ success: true, message: '사용자 상태가 변경되었습니다', data: { id: userId, status } });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] user status error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminUsersRoutes.get('/users/:id', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const userId = c.req.param('id');

    const users = await executeQuery<UserRow>(DB,
      `SELECT id, name, email, phone, created_at
       FROM users WHERE id = ?`, [userId]
    );
    if (users.length === 0) {
      return c.json({ success: false, error: '사용자를 찾을 수 없습니다' }, 404);
    }

    const orderStats = await executeQuery<{ order_count: number; total_spent: number }>(DB,
      `SELECT COUNT(*) as order_count, COALESCE(SUM(total_amount), 0) as total_spent
       FROM orders WHERE user_id = ? AND status IN ('PAID','DONE','SHIPPING','DELIVERED')`,
      [userId]
    );

    const reviewStats = await executeQuery<CountRow>(DB,
      `SELECT COUNT(*) as count FROM reviews WHERE user_id = ?`, [userId]
    );

    const user = users[0];
    const detail: UserDetailRow = {
      ...user,
      order_count: orderStats[0]?.order_count || 0,
      total_spent: orderStats[0]?.total_spent || 0,
      review_count: reviewStats[0]?.count || 0
    };

    return c.json({ success: true, data: detail });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] user detail error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminUsersRoutes;
