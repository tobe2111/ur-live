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
import { rateLimit } from '@/worker/middleware/rate-limit';
import { ensureAdminsRoleUnconstrained } from '@/worker/utils/ensure-admins-role';

export const adminAccountsRoutes = new Hono<{ Bindings: Env }>();

// 🛡️ 2026-06-14: 관리자 역할 — 전권 + 제한 권한 세분화 (사용자 요구: 제한된 접근 권한 분리).
//   super_admin: 전체 권한 / admin: 일반 운영 / ops: 주문·상품·배송 / cs: 고객 응대(주문 조회/반품) /
//   finance: 정산·출금·세금 / viewer: 읽기 전용. ops/cs/finance 는 worker auth.ts requireAdminRole 게이트와 정합.
//   wholesale: 🆕 도매(유통스타트) 전용 — 도매 도메인만 읽기·쓰기, 그 외 어드민 전부 차단(외부 동업자).
const VALID_ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'cs', 'finance', 'viewer', 'wholesale'];

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
      const currentUser = c.get('user' as never) as { id?: string | number; role?: string } | undefined;
      const currentAdminId = currentUser?.id;
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

    // 🆕 2026-06-17 (대표 신고 — 새 관리자 추가 400): name 은 프런트 폼에서 선택 입력이라
    //   비워도 400 안 나게 이메일 local part 로 fallback (username 과 동일 정책). 필수는 email/password/role.
    if (!email || !password || !role) {
      return c.json({ success: false, error: '필수 항목이 누락되었습니다 (email, password, role)' }, 400);
    }
    if (!VALID_ADMIN_ROLES.includes(role)) {
      return c.json({ success: false, error: `유효하지 않은 역할입니다. ${VALID_ADMIN_ROLES.join(', ')} 중 선택하세요` }, 400);
    }
    const resolvedName = (name && name.trim()) || email.split('@')[0];

    // 🆕 2026-06-17 (대표 요청): 새 관리자 추가는 완화 규칙(8자+ / 영문·숫자·특수 2종+) — 대문자 강제 X.
    const complexity = validatePasswordComplexity(password, { relaxed: true });
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

    // 🛠️ 2026-06-17: 옛 admins.role CHECK 가 제한역할(ops/cs/finance/viewer/wholesale) INSERT 를
    //   막아 500 나던 것 자가치유 — 제약 있으면 안전 재빌드(멱등, isolate 당 1회).
    await ensureAdminsRoleUnconstrained(DB);

    const passwordHash = await hashPassword(password);
    await executeRun(DB,
      `INSERT INTO admins (username, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [resolvedUsername, email, passwordHash, resolvedName, role]
    );

    await writeAuditLog(c, {
      action: 'create_admin',
      targetType: 'admin',
      targetId: email,
      after: { email, name: resolvedName, role }
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
      const currentUser = c.get('user' as never) as { id?: string | number; role?: string } | undefined;
      const currentAdminId = currentUser?.id;
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
      const currentUser = c.get('user' as never) as { id?: string | number; role?: string } | undefined;
      const currentAdminId = currentUser?.id;
      if (String(currentAdminId) === String(adminId) && current.role === 'super_admin') {
        return c.json({ success: false, error: 'super_admin은 자신의 역할을 변경할 수 없습니다' }, 403);
      }
      if (!VALID_ADMIN_ROLES.includes(role)) {
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

    // 🛠️ 2026-06-17: 역할 변경도 옛 CHECK 에 걸릴 수 있어 동일 자가치유(제약 있을 때만 재빌드).
    if (role !== undefined) await ensureAdminsRoleUnconstrained(DB);

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
      const currentUser = c.get('user' as never) as { id?: string | number; role?: string } | undefined;
      const currentAdminId = currentUser?.id;
      const currentAdmin = await DB.prepare(
        'SELECT role FROM admins WHERE id = ?'
      ).bind(currentAdminId).first<{ role: string }>();
      if (!currentAdmin || currentAdmin.role !== 'super_admin') {
        return c.json({ success: false, error: 'super_admin 권한이 필요합니다' }, 403);
      }
    }

    const adminId = c.req.param('id');

    const selfUser = c.get('user' as never) as { id?: string | number } | undefined;
    const selfAdminId = selfUser?.id;
    if (String(selfAdminId) === String(adminId)) {
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

    // 🛡️ 2026-05-07: HARD DELETE → SOFT DELETE 변경.
    //   영구 데이터 분실 방지. audit log / 결제 / 분쟁 대응 위해 admin row 자체는 보존.
    //   is_active=0 + status='deleted' 로 비활성화 (재사용 시 같은 이메일 재가입 충돌 방지).
    //   email 에 _deleted_<timestamp> 접미사로 unique constraint 회피.
    try {
      await executeRun(DB, `ALTER TABLE admins ADD COLUMN is_active INTEGER DEFAULT 1`, []);
    } catch { /* exists */ }
    try {
      await executeRun(DB, `ALTER TABLE admins ADD COLUMN status TEXT DEFAULT 'active'`, []);
    } catch { /* exists */ }
    try {
      await executeRun(DB, `ALTER TABLE admins ADD COLUMN deleted_at DATETIME`, []);
    } catch { /* exists */ }
    const ts = Date.now();
    await executeRun(DB,
      `UPDATE admins SET is_active = 0, status = 'deleted', deleted_at = datetime('now'),
       email = email || '_deleted_' || ?, username = username || '_deleted_' || ?
       WHERE id = ?`,
      [ts, ts, adminId]
    );

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

adminAccountsRoutes.post('/admins/:id/reset-password', cors(), rateLimit({ action: 'admin_reset_admin_password', max: 10, windowSec: 3600 }), async (c) => {
  try {
    const DB = c.env.DB;

    {
      const currentUser = c.get('user' as never) as { id?: string | number; role?: string } | undefined;
      const currentAdminId = currentUser?.id;
      const currentAdmin = await DB.prepare(
        'SELECT role FROM admins WHERE id = ?'
      ).bind(currentAdminId).first<{ role: string }>();
      if (!currentAdmin || currentAdmin.role !== 'super_admin') {
        return c.json({ success: false, error: 'super_admin 권한이 필요합니다' }, 403);
      }
    }

    const adminId = c.req.param('id');
    const { newPassword } = await c.req.json<{ newPassword: string }>();

    // 🆕 2026-06-17: 생성 경로와 동일한 완화 규칙(8자+/2종+, 대문자 강제 X) — 슈퍼가 파트너 임시비번을
    //   만들 때 빡센 규칙(대문자+특수문자+10자)에 막히던 불일치 해소. 생성(line 92)과 정합.
    const complexity = validatePasswordComplexity(newPassword ?? '', { relaxed: true });
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

// 🆕 2026-06-17: 로그인 보안 PIN 초기화 (super_admin 전용) — 도매 파트너 등이 6자리 PIN 분실 시 복구.
//   login_pin_hash = NULL → 다음 로그인 때 비밀번호만으로 통과하고, 강제 대상 역할(도매/슈퍼)은
//   must_set_pin 으로 다시 PIN 설정 화면에 유도됨(서버 login 핸들러가 재평가). 본인 PIN 은 본인 화면에서 변경.
adminAccountsRoutes.post('/admins/:id/reset-pin', cors(), rateLimit({ action: 'admin_reset_admin_pin', max: 20, windowSec: 3600 }), async (c) => {
  try {
    const DB = c.env.DB;

    {
      const currentUser = c.get('user' as never) as { id?: string | number; role?: string } | undefined;
      const currentAdminId = currentUser?.id;
      const currentAdmin = await DB.prepare(
        'SELECT role FROM admins WHERE id = ?'
      ).bind(currentAdminId).first<{ role: string }>();
      if (!currentAdmin || currentAdmin.role !== 'super_admin') {
        return c.json({ success: false, error: 'super_admin 권한이 필요합니다' }, 403);
      }
    }

    const adminId = c.req.param('id');
    const rows = await executeQuery<{ id: number; email: string }>(DB,
      `SELECT id, email FROM admins WHERE id = ?`, [adminId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '관리자를 찾을 수 없습니다' }, 404);
    }

    // login_pin_hash 컬럼 미존재(레거시 DB)면 초기화할 PIN 자체가 없음 → 멱등 성공.
    await DB.prepare(`UPDATE admins SET login_pin_hash = NULL WHERE id = ?`)
      .bind(adminId).run()
      .catch((_e) => { if (import.meta.env.DEV) console.warn('[Admin] reset-pin (no column?)', _e); });

    await writeAuditLog(c, {
      action: 'reset_admin_pin',
      targetType: 'admin',
      targetId: adminId,
      after: { pin_reset: true }
    });

    return c.json({ success: true, message: '보안 PIN이 초기화되었습니다. 해당 관리자는 다음 로그인 시 새 PIN을 설정합니다.' });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] reset pin error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminAccountsRoutes;
