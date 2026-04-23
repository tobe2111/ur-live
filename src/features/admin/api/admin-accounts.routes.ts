/**
 * Admin Accounts Routes — 관리자 계정 CRUD
 *
 * 🛡️ 2026-04-22 배치 151 (TD-006 부분): admin-management.routes.ts 에서 분리.
 *
 * 엔드포인트:
 * - GET    /admins                   — 관리자 목록
 * - POST   /admins                   — 관리자 생성 (super_admin 전용)
 * - PATCH  /admins/:id               — 관리자 수정 (super_admin 전용)
 * - DELETE /admins/:id               — 관리자 삭제 (super_admin 전용, 자기 삭제 금지, 마지막 super_admin 보호)
 * - POST   /admins/:id/reset-password — 비밀번호 재설정
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { executeQuery, executeRun } from '@/worker/utils/database';
import { writeAuditLog } from '@/worker/middleware/admin-security';
import { hashPassword, validatePasswordComplexity } from '@/lib/password';

export const adminAccountsRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

interface AdminRow {
  id: number;
  username: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}
interface CountRow { count: number }

adminAccountsRoutes.get('/admins', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const admins = await executeQuery<AdminRow>(DB,
      `SELECT id, username, email, name, role, created_at
       FROM admins
       ORDER BY created_at DESC`
    );
    return c.json({ success: true, data: admins });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] list admins error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminAccountsRoutes.post('/admins', cors(), async (c) => {
  try {
    const DB = c.env.DB;

    // SECURITY: only super_admin can create admins
    {
      const jwtPayload = c.get('jwtPayload' as never) as { sub?: string; id?: number } | undefined;
      const currentAdminId = jwtPayload?.id || jwtPayload?.sub;
      const currentAdmin = await DB.prepare(
        'SELECT role FROM admins WHERE id = ?'
      ).bind(currentAdminId).first<{ role: string }>();
      if (!currentAdmin || currentAdmin.role !== 'super_admin') {
        return c.json({ success: false, error: 'super_admin 권한이 필요합니다' }, 403);
      }
    }

    const { email, password, name, role, username } = await c.req.json<{
      email: string; password: string; name: string; role: string; username?: string;
    }>();

    if (!email || !password || !name || !role) {
      return c.json({ success: false, error: '필수 항목이 누락되었습니다 (email, password, name, role)' }, 400);
    }
    if (!['super_admin', 'admin', 'viewer'].includes(role)) {
      return c.json({ success: false, error: '유효하지 않은 역할입니다. super_admin, admin, viewer 중 선택하세요' }, 400);
    }

    const complexity = validatePasswordComplexity(password);
    if (!complexity.ok) {
      return c.json({ success: false, error: complexity.error ?? '비밀번호 복잡도 부족' }, 400);
    }

    const existing = await executeQuery<{ id: number }>(DB,
      `SELECT id FROM admins WHERE email = ?`, [email]
    );
    if (existing.length > 0) {
      return c.json({ success: false, error: '이미 존재하는 이메일입니다' }, 409);
    }

    const resolvedUsername = (username && username.trim()) || email.split('@')[0];

    const passwordHash = await hashPassword(password);
    await executeRun(DB,
      `INSERT INTO admins (username, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [resolvedUsername, email, passwordHash, name, role]
    );

    await writeAuditLog(c, {
      action: 'create_admin',
      targetType: 'admin',
      targetId: email,
      after: { email, name, role }
    });

    return c.json({ success: true, message: '관리자가 생성되었습니다' });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] create admin error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminAccountsRoutes.patch('/admins/:id', cors(), async (c) => {
  try {
    const DB = c.env.DB;

    {
      const jwtPayload = c.get('jwtPayload' as never) as { sub?: string; id?: number } | undefined;
      const currentAdminId = jwtPayload?.id || jwtPayload?.sub;
      const currentAdmin = await DB.prepare(
        'SELECT role FROM admins WHERE id = ?'
      ).bind(currentAdminId).first<{ role: string }>();
      if (!currentAdmin || currentAdmin.role !== 'super_admin') {
        return c.json({ success: false, error: 'super_admin 권한이 필요합니다' }, 403);
      }
    }

    const adminId = c.req.param('id');
    const { name, role, email } = await c.req.json<{
      name?: string; role?: string; email?: string;
    }>();

    const rows = await executeQuery<AdminRow>(DB,
      `SELECT id, username, email, name, role, created_at FROM admins WHERE id = ?`, [adminId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '관리자를 찾을 수 없습니다' }, 404);
    }

    const current = rows[0];

    if (role && role !== current.role) {
      const jwtPayload = c.get('jwtPayload' as never) as { sub?: string; id?: number } | undefined;
      const currentAdminId = jwtPayload?.id || jwtPayload?.sub;
      if (String(currentAdminId) === String(adminId) && current.role === 'super_admin') {
        return c.json({ success: false, error: 'super_admin은 자신의 역할을 변경할 수 없습니다' }, 403);
      }
      if (!['super_admin', 'admin', 'viewer'].includes(role)) {
        return c.json({ success: false, error: '유효하지 않은 역할입니다' }, 400);
      }
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    if (name !== undefined) { updates.push('name = ?'); params.push(name); before.name = current.name; after.name = name; }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); before.role = current.role; after.role = role; }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); before.email = current.email; after.email = email; }

    if (updates.length === 0) {
      return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400);
    }

    params.push(adminId);
    await executeRun(DB, `UPDATE admins SET ${updates.join(', ')} WHERE id = ?`, params);

    await writeAuditLog(c, {
      action: 'update_admin',
      targetType: 'admin',
      targetId: adminId,
      before, after
    });

    return c.json({ success: true, message: '관리자 정보가 업데이트되었습니다' });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] update admin error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminAccountsRoutes.delete('/admins/:id', cors(), async (c) => {
  try {
    const DB = c.env.DB;

    {
      const jwtPayload = c.get('jwtPayload' as never) as { sub?: string; id?: number } | undefined;
      const currentAdminId = jwtPayload?.id || jwtPayload?.sub;
      const currentAdmin = await DB.prepare(
        'SELECT role FROM admins WHERE id = ?'
      ).bind(currentAdminId).first<{ role: string }>();
      if (!currentAdmin || currentAdmin.role !== 'super_admin') {
        return c.json({ success: false, error: 'super_admin 권한이 필요합니다' }, 403);
      }
    }

    const adminId = c.req.param('id');

    const jwtPayload = c.get('jwtPayload' as never) as { sub?: string; id?: number } | undefined;
    const currentAdminId = jwtPayload?.id || jwtPayload?.sub;
    if (String(currentAdminId) === String(adminId)) {
      return c.json({ success: false, error: '자기 자신을 삭제할 수 없습니다' }, 403);
    }

    const rows = await executeQuery<AdminRow>(DB,
      `SELECT id, username, email, name, role, created_at FROM admins WHERE id = ?`, [adminId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '관리자를 찾을 수 없습니다' }, 404);
    }

    if (rows[0].role === 'super_admin') {
      const superAdminCount = await executeQuery<CountRow>(DB,
        `SELECT COUNT(*) as count FROM admins WHERE role = 'super_admin'`
      );
      if ((superAdminCount[0]?.count || 0) <= 1) {
        return c.json({ success: false, error: '마지막 super_admin은 삭제할 수 없습니다' }, 403);
      }
    }

    await executeRun(DB, `DELETE FROM admins WHERE id = ?`, [adminId]);

    await writeAuditLog(c, {
      action: 'delete_admin',
      targetType: 'admin',
      targetId: adminId,
      before: { email: rows[0].email, name: rows[0].name, role: rows[0].role }
    });

    return c.json({ success: true, message: '관리자가 삭제되었습니다' });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] delete admin error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminAccountsRoutes.post('/admins/:id/reset-password', cors(), async (c) => {
  try {
    const DB = c.env.DB;

    {
      const jwtPayload = c.get('jwtPayload' as never) as { sub?: string; id?: number } | undefined;
      const currentAdminId = jwtPayload?.id || jwtPayload?.sub;
      const currentAdmin = await DB.prepare(
        'SELECT role FROM admins WHERE id = ?'
      ).bind(currentAdminId).first<{ role: string }>();
      if (!currentAdmin || currentAdmin.role !== 'super_admin') {
        return c.json({ success: false, error: 'super_admin 권한이 필요합니다' }, 403);
      }
    }

    const adminId = c.req.param('id');
    const { newPassword } = await c.req.json<{ newPassword: string }>();

    const complexity = validatePasswordComplexity(newPassword ?? '');
    if (!complexity.ok) {
      return c.json({ success: false, error: complexity.error ?? '비밀번호 복잡도 부족' }, 400);
    }

    const rows = await executeQuery<{ id: number }>(DB,
      `SELECT id FROM admins WHERE id = ?`, [adminId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '관리자를 찾을 수 없습니다' }, 404);
    }

    const passwordHash = await hashPassword(newPassword);
    await executeRun(DB, `UPDATE admins SET password_hash = ? WHERE id = ?`, [passwordHash, adminId]);

    await DB.prepare(
      "DELETE FROM auth_refresh_tokens WHERE user_type = 'admin' AND user_id = ?"
    ).bind(Number(adminId)).run().catch((_e) => { if (import.meta.env.DEV) console.warn(_e) });

    await writeAuditLog(c, {
      action: 'reset_admin_password',
      targetType: 'admin',
      targetId: adminId,
      after: { password_reset: true }
    });

    return c.json({ success: true, message: '비밀번호가 재설정되었습니다' });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] reset password error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminAccountsRoutes;
