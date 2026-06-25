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
import { requireAdminRole } from '../../../worker/middleware/auth'
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

// 🛡️ 2026-06-25: supplier_balances 테이블 ensure(멱등, WeakSet 메모) — 목록 쿼리가 LEFT JOIN
//   supplier_balances 를 쓰는데, 이 테이블은 첫 정산 or repair-schema 때만 생성됨. 정산 0건 + repair 미실행
//   fresh DB(=신규 도매몰)에선 'no such table' → GET /suppliers 500 → 제조사 목록 안 뜸 → 승인 자체 불가.
//   per-request DDL 금지 룰 준수(ensureXxx + WeakSet). 스키마는 repair-schema.routes.ts:1548 와 동일.
const _balancesEnsured = new WeakSet<object>();
async function ensureSupplierBalances(DB: D1Database): Promise<void> {
  if (_balancesEnsured.has(DB)) return;
  _balancesEnsured.add(DB);
  await DB.prepare(`CREATE TABLE IF NOT EXISTS supplier_balances (
    supplier_id INTEGER PRIMARY KEY,
    pending_amount INTEGER NOT NULL DEFAULT 0,
    available_amount INTEGER NOT NULL DEFAULT 0,
    paid_amount INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => { /* 이미 존재 */ });
}

// ── GET /suppliers — 목록 + 잔고 ──────────────────────────────────────────────
adminSuppliersRoutes.get('/suppliers', cors(), async (c) => {
  try {
    const { DB } = c.env;
    await ensureSupplierBalances(DB); // 🛡️ fresh DB 500 방지 (위 주석)
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
    // 🏬 2026-06-09 멀티-몰: ?mall_id= 가 주어지면 해당 몰만(옵션 — 기존 무필터 뷰 보존).
    //   COALESCE(s.mall_id,1) — 컬럼 미존재 isolate 에선 이 필터가 throw 할 수 있어 쿼리/카운트 모두 try-catch 로 fallback.
    const mallQ = c.req.query('mall_id');
    let mallId: number | null = null;
    if (mallQ != null && mallQ !== '') { const m = Math.floor(Number(mallQ)); if (Number.isFinite(m) && m > 0) mallId = m; }
    const whereWithMall = mallId != null ? `${where} AND COALESCE(s.mall_id,1) = ?` : where;
    const mallParams = mallId != null ? [...params, mallId] : params;

    // 🏭 2026-06-09 Wave 1: 대표자(representative)/담당자(manager_*) 인적사항 surface.
    //   repair-schema 미적용 isolate 대비 — 새 컬럼 없으면 fallback 쿼리로 재시도(기존 동작 보존).
    //   🏬 멀티-몰: mall_id + mall name join 도 primary 쿼리에만(컬럼 없으면 fallback 으로 강등).
    const baseTail =
      `      s.bank_name, s.bank_account, s.account_holder, s.commission_rate, s.status, s.created_at, s.business_license_url,
              COALESCE(b.pending_amount, 0)   AS pending_amount,
              COALESCE(b.available_amount, 0) AS available_amount,
              COALESCE(b.paid_amount, 0)      AS paid_amount,
              (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.is_supply_product = 1) AS product_count
         FROM suppliers s
         LEFT JOIN supplier_balances b ON b.supplier_id = s.id
         WHERE ${whereWithMall}
         ORDER BY (s.status = 'pending') DESC, s.created_at DESC
         LIMIT ? OFFSET ?`;
    let rows;
    try {
      rows = await DB.prepare(
        `SELECT s.id, s.business_name, s.business_number, s.representative, s.email, s.phone,
                s.representative_phone, s.manager_name, s.manager_phone, s.manager_email,
                COALESCE(s.mall_id,1) AS mall_id, m.name AS mall_name,
${baseTail.replace('FROM suppliers s\n         LEFT JOIN supplier_balances b ON b.supplier_id = s.id', "FROM suppliers s\n         LEFT JOIN supplier_balances b ON b.supplier_id = s.id\n         LEFT JOIN wholesale_malls m ON m.id = COALESCE(s.mall_id,1)")}`
      ).bind(...mallParams, limit, offset).all();
    } catch {
      // fallback: mall_id/manager 컬럼 없는 isolate — 몰 필터 제외(기존 무필터 동작 보존).
      rows = await DB.prepare(
        `SELECT s.id, s.business_name, s.business_number, s.representative, s.email, s.phone,
${baseTail.replace(whereWithMall, where)}`
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
    // 🛡️ 2026-06-25: supplier_payouts 는 첫 지급/repair-schema 때만 생성 → 미생성 신규몰에서 'no such table' 500.
    //   읽기전용 이력이라 미존재 = "지급 0건"으로 graceful degrade(.catch).
    const rows = await DB.prepare(
      'SELECT id, amount, settlement_count, status, bank_name, account_holder, note, created_at FROM supplier_payouts WHERE supplier_id = ? ORDER BY created_at DESC LIMIT 100'
    ).bind(id).all().catch(() => ({ results: [] as unknown[] }));
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

    // 🔔 2026-06-12 (감사 개선): 승인/거부 알림톡용 연락처 — 담당자 > 대표자 > 가입 phone 우선.
    const existing = await DB.prepare('SELECT id, business_name, status, phone, representative_phone, manager_phone FROM suppliers WHERE id = ?')
      .bind(id).first<{ id: number; business_name: string; status: string; phone: string | null; representative_phone: string | null; manager_phone: string | null }>();
    if (!existing) return c.json({ success: false, error: '제조사를 찾을 수 없습니다' }, 404);

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
    // 🛡️ 2026-06-25: status 변경 시 CAS — 사전 SELECT 만으론 동시 승인 못 막아 알림톡 2회. 기존 status 선점.
    const statusGuard = body.status ? ' AND status = ?' : '';
    const guardParams = body.status ? [existing.status] : [];
    const upd = await DB.prepare(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?${statusGuard}`).bind(...params, id, ...guardParams).run();
    if (body.status && (upd.meta?.changes ?? 0) === 0) {
      return c.json({ success: false, error: '이미 처리되었거나 상태가 변경된 요청입니다' }, 409);
    }

    await writeAuditLog(c, { action: 'supplier_account_update', targetType: 'supplier', targetId: String(id), after: { status: body.status, commission_rate: body.commission_rate } }).catch(() => {});

    if (body.status && body.status !== existing.status) {
      const map: Record<string, { type: string; title: string }> = {
        approved: { type: 'supplier_account_approved', title: '제조사 계정 승인됨' },
        suspended: { type: 'supplier_account_suspended', title: '제조사 계정 정지됨' },
        rejected: { type: 'supplier_account_rejected', title: '제조사 가입 거부됨' },
      };
      const n = map[body.status];
      if (n) createDashboardNotification(DB, 'supplier', String(id), n.type, n.title, existing.business_name, '/supplier').catch(() => {});

      // 🔔 2026-06-12 (감사 개선): 승인/거부는 접속 전 채널(알림톡)로도 — 벨은 접속해야 보임.
      //   셀러 승인(admin-sellers `sendSystemAlimtalk`)과 동일 패턴 — env 미설정 시 silent skip.
      const phone = existing.manager_phone || existing.representative_phone || existing.phone;
      if (phone && (body.status === 'approved' || body.status === 'rejected')) {
        const msg = body.status === 'approved'
          ? `[유통스타트] 제조사 승인 완료\n\n· 상호: ${existing.business_name}\n\n이제 로그인해 공급상품을 등록할 수 있습니다.\nhttps://utongstart.com/supplier/login`
          : `[유통스타트] 제조사 가입이 반려되었습니다\n\n· 상호: ${existing.business_name}\n\n자세한 내용은 jiwon@ur-team.com 으로 문의해주세요.`;
        import('../../../lib/system-alimtalk')
          .then(({ sendSystemAlimtalk }) => sendSystemAlimtalk(c.env, phone, body.status === 'approved' ? 'supplier_approved' : 'supplier_rejected', msg))
          .catch(() => { /* fail-soft — 알림 실패가 승인을 막지 않음 */ });
      }
    }

    return c.json({ success: true, data: { id: Number(id), status: body.status ?? existing.status }, message: '제조사 정보가 업데이트되었습니다.' });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] PATCH /suppliers/:id error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ── POST /suppliers/:id/payout — available 잔고 전액 지급 ──────────────────────
adminSuppliersRoutes.post('/suppliers/:id/payout', cors(), requireAdminRole('finance'), async (c) => {
  try {
    const { DB } = c.env;
    const id = c.req.param('id');
    if (!/^\d+$/.test(String(id))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const body = await c.req.json<{ note?: string }>().catch(() => ({} as { note?: string }));

    const sup = await DB.prepare('SELECT id, business_name, status FROM suppliers WHERE id = ?')
      .bind(id).first<{ id: number; business_name: string; status: string }>();
    if (!sup) return c.json({ success: false, error: '제조사를 찾을 수 없습니다' }, 404);

    const user = (c as unknown as { get: (k: string) => { id?: string | number } | undefined }).get('user');
    const result = await payoutSupplier(DB, Number(id), { adminId: String(user?.id ?? 'admin'), note: body.note });

    if (!result.ok) {
      const msg = result.error === 'no_available_balance' ? '지급 가능한 잔고가 없습니다'
        : result.error === 'already_paid' ? '이미 처리된 지급입니다'
        : result.error === 'daily_cap_exceeded' ? '오늘 정산 한도(기본 1억원)를 초과합니다. 내일 다시 시도하거나 한도를 조정하세요'
        : result.error === 'reserved_for_withdrawal' ? '출금 신청 예약분이 있어 직접 지급할 수 없습니다. 출금 관리(출금 승인)에서 처리하세요'
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
