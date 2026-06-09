/**
 * 🛡️ 2026-06-01 도매몰: 어드민 공급자(도매상) 관리 + 지급 실행.
 *   - GET   /suppliers            — 공급자 목록 + 잔고 (조회 시 성숙 자동 실행)
 *   - GET   /suppliers/:id/payouts — 지급 이력
 *   - PATCH /suppliers/:id         — 계정 승인/정지/거부 (status)
 *   - POST  /suppliers/:id/payout  — available 잔고 전액 지급
 *
 * adminApp(requireAdmin + IP whitelist + audit) 하위 마운트: adminApp.route('/', adminSuppliersRoutes)
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { writeAuditLog } from '@/worker/middleware/admin-security';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';
import { matureSupplierSettlements, payoutSupplier } from '@/features/supply/api/supply-settlement';

export const adminSuppliersRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  // 🏭 2026-06-07 (보안 audit, 사용자 승인): DEV 모드에서만 원본 메시지 노출.
  //   기존엔 production 외 모든 환경(staging/preview)에서 err.message 누출 → SQL/스택 노출 가능했음.
  const isDev = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'development';
  if (!isDev) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

// ── GET /suppliers — 목록 + 잔고 ──────────────────────────────────────────────
adminSuppliersRoutes.get('/suppliers', cors(), async (c) => {
  try {
    const { DB } = c.env;
    // 조회 시 성숙(환불창 지난 pending → available) 먼저 반영 — best-effort.
    await matureSupplierSettlements(DB).catch(() => 0);

    const status = String(c.req.query('status') || 'all'); // all | pending | approved | suspended | rejected
    const page = Math.max(1, Number(c.req.query('page') || 1));
    const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') || 100)));
    const offset = (page - 1) * limit;

    let where = '1=1';
    const params: (string | number)[] = [];
    if (['pending', 'approved', 'suspended', 'rejected'].includes(status)) {
      where = 's.status = ?'; params.push(status);
    }

    // 🏭 2026-06-09 Wave 1: 대표자(representative)/담당자(manager_*) 인적사항 surface.
    //   repair-schema 미적용 isolate 대비 — 새 컬럼 없으면 fallback 쿼리로 재시도(기존 동작 보존).
    const baseTail =
      `      s.bank_name, s.bank_account, s.account_holder, s.commission_rate, s.status, s.created_at, s.business_license_url,
              COALESCE(b.pending_amount, 0)   AS pending_amount,
              COALESCE(b.available_amount, 0) AS available_amount,
              COALESCE(b.paid_amount, 0)      AS paid_amount,
              (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.is_supply_product = 1) AS product_count
         FROM suppliers s
         LEFT JOIN supplier_balances b ON b.supplier_id = s.id
         WHERE ${where}
         ORDER BY (s.status = 'pending') DESC, s.created_at DESC
         LIMIT ? OFFSET ?`;
    let rows;
    try {
      rows = await DB.prepare(
        `SELECT s.id, s.business_name, s.business_number, s.representative, s.email, s.phone,
                s.representative_phone, s.manager_name, s.manager_phone, s.manager_email,
${baseTail}`
      ).bind(...params, limit, offset).all();
    } catch {
      rows = await DB.prepare(
        `SELECT s.id, s.business_name, s.business_number, s.representative, s.email, s.phone,
${baseTail}`
      ).bind(...params, limit, offset).all();
    }

    const total = await DB.prepare(`SELECT COUNT(*) AS count FROM suppliers s WHERE ${where}`).bind(...params).first<{ count: number }>();
    const pendingCount = await DB.prepare("SELECT COUNT(*) AS count FROM suppliers WHERE status = 'pending'").first<{ count: number }>().catch(() => null);

    return c.json({ success: true, data: { items: rows.results ?? [], total: total?.count ?? 0, pending_count: pendingCount?.count ?? 0, page, limit } });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] GET /suppliers error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ── GET /suppliers/:id/payouts — 지급 이력 ───────────────────────────────────
adminSuppliersRoutes.get('/suppliers/:id/payouts', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const id = c.req.param('id');
    if (!/^\d+$/.test(String(id))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const rows = await DB.prepare(
      'SELECT id, amount, settlement_count, status, bank_name, account_holder, note, created_at FROM supplier_payouts WHERE supplier_id = ? ORDER BY created_at DESC LIMIT 100'
    ).bind(id).all();
    return c.json({ success: true, data: { items: rows.results ?? [] } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ── PATCH /suppliers/:id — 계정 승인/정지/거부 ────────────────────────────────
adminSuppliersRoutes.patch('/suppliers/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const id = c.req.param('id');
    if (!/^\d+$/.test(String(id))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    type PatchBody = { status?: string; commission_rate?: number };
    const body = await c.req.json<PatchBody>().catch(() => ({} as PatchBody));

    const existing = await DB.prepare('SELECT id, business_name, status FROM suppliers WHERE id = ?')
      .bind(id).first<{ id: number; business_name: string; status: string }>();
    if (!existing) return c.json({ success: false, error: '공급자를 찾을 수 없습니다' }, 404);

    const sets: string[] = [];
    const params: (string | number)[] = [];
    if (body.status != null) {
      if (!['pending', 'approved', 'suspended', 'rejected'].includes(body.status)) {
        return c.json({ success: false, error: '허용되지 않는 status 값' }, 400);
      }
      sets.push('status = ?'); params.push(body.status);
    }
    if (body.commission_rate != null) {
      const r = Number(body.commission_rate);
      if (!Number.isFinite(r) || r < 0 || r > 100) return c.json({ success: false, error: '수수료율은 0~100 사이여야 합니다' }, 400);
      sets.push('commission_rate = ?'); params.push(r);
    }
    if (sets.length === 0) return c.json({ success: false, error: '변경할 내용이 없습니다' }, 400);

    sets.push("updated_at = datetime('now')");
    await DB.prepare(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id).run();

    await writeAuditLog(c, { action: 'supplier_account_update', targetType: 'supplier', targetId: String(id), after: { status: body.status, commission_rate: body.commission_rate } }).catch(() => {});

    if (body.status && body.status !== existing.status) {
      const map: Record<string, { type: string; title: string }> = {
        approved: { type: 'supplier_account_approved', title: '공급자 계정 승인됨' },
        suspended: { type: 'supplier_account_suspended', title: '공급자 계정 정지됨' },
        rejected: { type: 'supplier_account_rejected', title: '공급자 가입 거부됨' },
      };
      const n = map[body.status];
      if (n) createDashboardNotification(DB, 'supplier', String(id), n.type, n.title, existing.business_name, '/supplier').catch(() => {});
    }

    return c.json({ success: true, data: { id: Number(id), status: body.status ?? existing.status }, message: '공급자 정보가 업데이트되었습니다.' });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] PATCH /suppliers/:id error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ── POST /suppliers/:id/payout — available 잔고 전액 지급 ──────────────────────
adminSuppliersRoutes.post('/suppliers/:id/payout', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const id = c.req.param('id');
    if (!/^\d+$/.test(String(id))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const body = await c.req.json<{ note?: string }>().catch(() => ({} as { note?: string }));

    const sup = await DB.prepare('SELECT id, business_name, status FROM suppliers WHERE id = ?')
      .bind(id).first<{ id: number; business_name: string; status: string }>();
    if (!sup) return c.json({ success: false, error: '공급자를 찾을 수 없습니다' }, 404);

    const user = (c as unknown as { get: (k: string) => { id?: string | number } | undefined }).get('user');
    const result = await payoutSupplier(DB, Number(id), { adminId: String(user?.id ?? 'admin'), note: body.note });

    if (!result.ok) {
      const msg = result.error === 'no_available_balance' ? '지급 가능한 잔고가 없습니다'
        : result.error === 'already_paid' ? '이미 처리된 지급입니다'
        : result.error === 'daily_cap_exceeded' ? '오늘 정산 한도(기본 1억원)를 초과합니다. 내일 다시 시도하거나 한도를 조정하세요'
        : '지급 처리에 실패했습니다';
      return c.json({ success: false, error: msg, code: result.error }, 400);
    }

    await writeAuditLog(c, { action: 'supplier_payout', targetType: 'supplier', targetId: String(id), after: { amount: result.amount, settlement_count: result.settlement_count, payout_id: result.payout_id } }).catch(() => {});

    createDashboardNotification(DB, 'supplier', String(id), 'supplier_payout_done', '정산금 지급 완료',
      `${result.amount.toLocaleString('ko-KR')}원이 지급 처리되었습니다`, '/supplier').catch(() => {});

    return c.json({ success: true, data: result, message: `${result.amount.toLocaleString('ko-KR')}원 지급이 완료되었습니다.` });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] POST /suppliers/:id/payout error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminSuppliersRoutes;
