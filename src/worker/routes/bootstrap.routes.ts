// ============================================================
// Bootstrap Routes — POST /api/_bootstrap/reset-dashboard-password
//
// 🔒 BOOTSTRAP: 대시보드 비밀번호 재설정
//   2026-04-22 배치 134: fixed 모드 제거 (배치 125 의 임시 동작).
//   로그인 복구 완료 후 보안 복원 — 이제 BOOTSTRAP_TOKEN secret 세팅 필수.
//   미세팅 시 404 로 엔드포인트 자체 숨김.
//
// 사용법:
//   curl -X POST https://live.ur-team.com/api/_bootstrap/reset-dashboard-password \
//     -H "X-Bootstrap-Token: <BOOTSTRAP_TOKEN>" \
//     -H "Content-Type: application/json" \
//     -d '{"email":"...","password":"...","role":"all|admin|seller|agency"}'
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { hashPassword } from '../../lib/password'

export const bootstrapRoutes = new Hono<{ Bindings: Env }>()

bootstrapRoutes.post('/api/_bootstrap/reset-dashboard-password', async (c) => {
  const expected = c.env.BOOTSTRAP_TOKEN;
  const provided = c.req.header('X-Bootstrap-Token');

  // BOOTSTRAP_TOKEN 미세팅 or 헤더 불일치 → 404 (엔드포인트 존재 감추기)
  if (!expected || !provided || expected !== provided) {
    return c.json({ error: 'Not Found' }, 404);
  }

  let body: { email?: string; password?: string; role?: string } = {};
  try { body = await c.req.json(); } catch { body = {}; }
  const { email, password, role = 'all' } = body;

  if (!email || !password) {
    return c.json({ success: false, error: 'email, password 필수' }, 400);
  }
  if (password.length < 6) {
    return c.json({ success: false, error: '비밀번호 6자 이상' }, 400);
  }

  // 서버 자체의 hashPassword() 사용 → verifyPassword 와 100% 호환
  const hash = await hashPassword(password);

  const DB = c.env.DB;
  const results: Record<string, { updated: number; status?: string }> = {};

  const targets = role === 'all' ? ['admins', 'sellers', 'agencies'] : [`${role}s`];

  for (const table of targets) {
    try {
      const activeValue = table === 'sellers' ? 'approved' : 'active';
      const sql = table === 'sellers'
        ? `UPDATE ${table} SET password_hash = ?, status = ?, is_active = 1 WHERE email = ?`
        : `UPDATE ${table} SET password_hash = ?, status = ? WHERE email = ?`;
      const res = await DB.prepare(sql).bind(hash, activeValue, email).run();
      results[table] = { updated: res.meta.changes ?? 0, status: activeValue };
    } catch (e: any) {
      results[table] = { updated: 0, status: `ERROR: ${e.message}` };
    }
  }

  try { await DB.prepare("DELETE FROM account_lockouts").run(); } catch {}

  return c.json({ success: true, results, hashLength: hash.length });
});
