/**
 * Admin Misc Routes — 후원정산 + 딜충전 + 수수료 설정 + 감사로그
 *
 * 🛡️ 2026-04-22 배치 155 (TD-006 부분): admin-management.routes.ts 에서 분리.
 *
 * 엔드포인트:
 * - GET    /donations/settlements       — 전체 정산 신청 목록
 * - GET    /donations/stats             — 후원 통계
 * - PATCH  /donations/settlements/:id   — 정산 완료/거부
 * - GET    /deals/stats                 — 딜 충전 통계
 * - GET    /deals/charges               — 딜 충전 내역
 * - GET    /deals/users                 — 딜 사용자별 요약
 * - GET    /settings/commission         — 플랫폼 수수료 설정
 * - PUT    /settings/commission         — 수수료 변경
 * - GET    /audit-logs                  — 감사 로그
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { executeQuery } from '@/worker/utils/database';
import { writeAuditLog } from '@/worker/middleware/admin-security';

export const adminMiscRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

interface CountRow { count: number }
interface AuditLogRow {
  id: number;
  admin_id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string | null;
  before_value: string | null;
  after_value: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

// ─── 후원 정산 관리 ────────────────────────────────────────────

adminMiscRoutes.get('/donations/settlements', cors(), async (c) => {
  const { DB } = c.env;
  const status = c.req.query('status') || '';
  try {
    let query = `
      SELECT ds.id, ds.seller_id, s.name AS seller_name, s.business_name,
             ds.total_amount, ds.commission_amount, ds.settlement_amount,
             ds.donation_count, ds.status, ds.requested_at, ds.settled_at,
             ds.admin_memo, ds.bank_info, ds.created_at
      FROM donation_settlements ds
      JOIN sellers s ON ds.seller_id = s.id
    `;
    const params: (string | number)[] = [];
    if (status) { query += ' WHERE ds.status = ?'; params.push(status); }
    query += ' ORDER BY ds.created_at DESC LIMIT 200';

    const { results } = await DB.prepare(query).bind(...params).all();
    return c.json({ success: true, data: results ?? [] });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

adminMiscRoutes.get('/donations/stats', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const [totalDonations, pendingSettlements, totalCommission] = await Promise.all([
      DB.prepare(`SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total FROM donations WHERE status='DONE'`)
        .first<{ cnt: number; total: number }>().catch(() => ({ cnt: 0, total: 0 })),
      DB.prepare(`SELECT COUNT(*) AS cnt, COALESCE(SUM(settlement_amount),0) AS total FROM donation_settlements WHERE status='REQUESTED'`)
        .first<{ cnt: number; total: number }>().catch(() => ({ cnt: 0, total: 0 })),
      DB.prepare(`SELECT COALESCE(SUM(commission_amount),0) AS total FROM donations WHERE status='DONE'`)
        .first<{ total: number }>().catch(() => ({ total: 0 })),
    ]);
    return c.json({
      success: true,
      data: {
        total_donations: totalDonations?.cnt ?? 0,
        total_amount: totalDonations?.total ?? 0,
        pending_settlements: pendingSettlements?.cnt ?? 0,
        pending_settlement_amount: pendingSettlements?.total ?? 0,
        total_commission: totalCommission?.total ?? 0,
      },
    });
  } catch {
    return c.json({ success: true, data: { total_donations: 0, total_amount: 0, pending_settlements: 0, pending_settlement_amount: 0, total_commission: 0 } });
  }
});

adminMiscRoutes.patch('/donations/settlements/:id', cors(), async (c) => {
  const { DB } = c.env;
  const settleId = c.req.param('id');
  try {
    const body = await c.req.json<{ action: 'done' | 'reject'; admin_memo?: string }>();
    if (!['done', 'reject'].includes(body.action)) {
      return c.json({ success: false, error: 'action은 done 또는 reject이어야 합니다' }, 400);
    }
    const existing = await DB.prepare(
      `SELECT id, status FROM donation_settlements WHERE id = ?`
    ).bind(settleId).first<{ id: number; status: string }>();
    if (!existing) return c.json({ success: false, error: '정산 신청을 찾을 수 없습니다' }, 404);
    if (existing.status !== 'REQUESTED') {
      return c.json({ success: false, error: `이미 처리된 정산입니다 (${existing.status})` }, 409);
    }
    const newStatus = body.action === 'done' ? 'DONE' : 'REJECTED';
    const settledAt = body.action === 'done' ? `datetime('now')` : 'NULL';
    await DB.prepare(`
      UPDATE donation_settlements
      SET status = ?, admin_memo = ?, settled_at = ${settledAt}, updated_at = datetime('now')
      WHERE id = ?
    `).bind(newStatus, body.admin_memo || null, settleId).run();
    return c.json({
      success: true,
      data: { id: settleId, status: newStatus },
      message: body.action === 'done' ? '정산이 완료 처리되었습니다.' : '정산이 거부되었습니다.',
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ─── 딜 충전 모니터링 ────────────────────────────────────────────

adminMiscRoutes.get('/deals/stats', async (c) => {
  const { DB } = c.env;
  try {
    const totals = await DB.prepare(`
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0) as total_charged_amount,
        COALESCE(SUM(commission_amount), 0) as total_commission,
        COALESCE(SUM(points_amount), 0) as total_points_issued,
        COUNT(DISTINCT user_id) as unique_users
      FROM point_transactions
      WHERE type = 'charge' AND payment_key IS NOT NULL
    `).first();

    const today = await DB.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as amount, COALESCE(SUM(commission_amount), 0) as commission
      FROM point_transactions
      WHERE type = 'charge' AND payment_key IS NOT NULL
        AND created_at >= date('now')
    `).first();

    const thisMonth = await DB.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as amount, COALESCE(SUM(commission_amount), 0) as commission
      FROM point_transactions
      WHERE type = 'charge' AND payment_key IS NOT NULL
        AND created_at >= date('now', 'start of month')
    `).first();

    const donations = await DB.prepare(`
      SELECT COUNT(*) as total_donations, COALESCE(SUM(amount), 0) as total_donated
      FROM point_transactions
      WHERE type = 'donate'
    `).first();

    return c.json({
      success: true,
      data: {
        totals: totals ?? {},
        today: today ?? {},
        thisMonth: thisMonth ?? {},
        donations: donations ?? {},
      },
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminMiscRoutes.get('/deals/charges', async (c) => {
  const { DB } = c.env;
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(10, Number(c.req.query('limit')) || 20));
  const offset = (page - 1) * limit;
  const search = c.req.query('search') || '';

  try {
    let whereClause = "WHERE pt.type = 'charge' AND pt.payment_key IS NOT NULL";
    const binds: any[] = [];

    if (search) {
      whereClause += ' AND (pt.user_id LIKE ? OR pt.order_id LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
      binds.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countResult = await DB.prepare(
      `SELECT COUNT(*) as total FROM point_transactions pt LEFT JOIN users u ON CAST(pt.user_id AS TEXT) = CAST(u.id AS TEXT) ${whereClause}`
    ).bind(...binds).first<{ total: number }>();

    const { results } = await DB.prepare(`
      SELECT
        pt.id, pt.user_id, pt.amount, pt.commission_amount,
        pt.points_amount, pt.balance_after, pt.description,
        pt.payment_key, pt.order_id, pt.created_at,
        up.balance as current_balance,
        up.total_charged as user_total_charged,
        up.total_donated as user_total_donated,
        u.name as user_name,
        u.email as user_email,
        u.profile_image as user_profile_image
      FROM point_transactions pt
      LEFT JOIN user_points up ON pt.user_id = up.user_id
      LEFT JOIN users u ON CAST(pt.user_id AS TEXT) = CAST(u.id AS TEXT)
      ${whereClause}
      ORDER BY pt.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...binds, limit, offset).all();

    return c.json({
      success: true,
      data: results ?? [],
      pagination: {
        page, limit,
        total: countResult?.total ?? 0,
        totalPages: Math.ceil((countResult?.total ?? 0) / limit),
      },
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminMiscRoutes.get('/deals/users', async (c) => {
  const { DB } = c.env;
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(10, Number(c.req.query('limit')) || 20));
  const offset = (page - 1) * limit;
  const sort = c.req.query('sort') || 'total_charged';
  const allowedSorts = ['total_charged', 'total_donated', 'balance', 'last_charged'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'total_charged';

  try {
    const countResult = await DB.prepare(
      'SELECT COUNT(*) as total FROM user_points WHERE total_charged > 0'
    ).first<{ total: number }>();

    const { results } = await DB.prepare(`
      SELECT
        up.user_id,
        up.balance,
        up.total_charged,
        up.total_donated,
        up.created_at as first_charge_date,
        up.updated_at as last_activity,
        (SELECT COUNT(*) FROM point_transactions WHERE user_id = up.user_id AND type = 'charge' AND payment_key IS NOT NULL) as charge_count,
        (SELECT MAX(created_at) FROM point_transactions WHERE user_id = up.user_id AND type = 'charge' AND payment_key IS NOT NULL) as last_charged,
        u.name as user_name,
        u.email as user_email,
        u.profile_image as user_profile_image
      FROM user_points up
      LEFT JOIN users u ON CAST(up.user_id AS TEXT) = CAST(u.id AS TEXT)
      WHERE up.total_charged > 0
      ORDER BY ${sortCol} DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    return c.json({
      success: true,
      data: results ?? [],
      pagination: {
        page, limit,
        total: countResult?.total ?? 0,
        totalPages: Math.ceil((countResult?.total ?? 0) / limit),
      },
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ─── 플랫폼 수수료 설정 ────────────────────────────────────────

adminMiscRoutes.get('/settings/commission', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    try {
      await DB.prepare(`CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
      await DB.prepare(`INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES ('commission_rate_default', '5', '라이브 판매 수수료율 (%)')`).run();
      await DB.prepare(`INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES ('commission_rate_donation', '15', '후원 수수료율 (%)')`).run();
      await DB.prepare(`INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES ('commission_rate_meal_voucher', '5', '식사권 수수료율 (%)')`).run();
      await DB.prepare(`UPDATE platform_settings SET description = '라이브 판매 수수료율 (%)', value = '5' WHERE key = 'commission_rate_default' AND (description LIKE '%후원%' OR description LIKE '%상품%' OR CAST(value AS INTEGER) = 15)`).run();
      await DB.prepare(`UPDATE platform_settings SET value = '5' WHERE key = 'commission_rate_meal_voucher' AND value = '10'`).run();
    } catch { /* exists */ }

    const { results } = await DB.prepare("SELECT * FROM platform_settings WHERE key LIKE 'commission_%' ORDER BY key").all();
    return c.json({ success: true, data: results ?? [] });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminMiscRoutes.put('/settings/commission', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const { key, value } = await c.req.json<{ key: string; value: string }>();

    if (!key || value === undefined) return c.json({ success: false, error: '키와 값이 필요합니다' }, 400);
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 100) return c.json({ success: false, error: '수수료율은 0~100 사이여야 합니다' }, 400);

    const ALLOWED_KEYS = ['commission_rate_default', 'commission_rate_donation', 'commission_rate_meal_voucher',
      'commission_rate_live',
      'review_reward_text', 'review_reward_image', 'review_reward_video',
      'affiliate_commission_rate'];
    if (!ALLOWED_KEYS.includes(key)) {
      return c.json({ success: false, error: `변경 불가능한 key: ${key}` }, 400);
    }

    const prevRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = ?").bind(key).first<{ value: string }>();
    const prevValue = prevRow?.value ?? null;

    await DB.prepare("UPDATE platform_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?").bind(value, key).run();

    await writeAuditLog(c, {
      action: 'platform_settings.update',
      targetType: 'platform_setting',
      targetId: key,
      before: { value: prevValue },
      after: { value }
    });

    return c.json({ success: true, message: `${key} 값이 ${value}로 변경되었습니다` });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ─── 감사 로그 ─────────────────────────────────────────────────

adminMiscRoutes.get('/audit-logs', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50')));
    const offset = (page - 1) * limit;
    const adminId = c.req.query('admin_id');
    const action = c.req.query('action');
    const targetType = c.req.query('target_type');
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (adminId) { conditions.push('admin_id = ?'); params.push(adminId); }
    if (action) { conditions.push('action = ?'); params.push(action); }
    if (targetType) { conditions.push('target_type = ?'); params.push(targetType); }
    if (startDate) { conditions.push('created_at >= ?'); params.push(startDate); }
    if (endDate) { conditions.push('created_at <= ?'); params.push(endDate); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await executeQuery<CountRow>(DB,
      `SELECT COUNT(*) as count FROM admin_audit_logs ${where}`, params
    );
    const total = countRows[0]?.count || 0;

    const logs = await executeQuery<AuditLogRow>(DB,
      `SELECT id, admin_id, admin_email, action, target_type, target_id,
              before_value, after_value, ip, user_agent, created_at
       FROM admin_audit_logs ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return c.json({
      success: true,
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] audit-logs error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// 🛡️ 2026-05-19: 수동 cron trigger — 어드민 전용.
//   body: { name: 'restaurant-geocode' | 'kt-alpha-catalog-sync' }
//   화이트리스트 외 이름은 거부 (RCE 방지). 결과 JSON 으로 반환.
adminMiscRoutes.post('/_run-cron', cors(), async (c) => {
  try {
    const body = await c.req.json<{ name?: string }>().catch(() => ({} as { name?: string }));
    const name = String(body?.name || '');
    const start = Date.now();
    const env = c.env as unknown as { DB: D1Database; KAKAO_REST_API_KEY?: string; KT_ALPHA_AUTH_CODE?: string; KT_ALPHA_TOKEN_KEY?: string; KT_ALPHA_AUTH_TOKEN?: string; KT_ALPHA_DEV_MODE?: string };

    if (name === 'restaurant-geocode') {
      const { runRestaurantGeocode } = await import('../../../worker/cron/restaurant-geocode');
      const result = await runRestaurantGeocode(env);
      return c.json({ success: true, name, elapsed_ms: Date.now() - start, result });
    }

    if (name === 'kt-alpha-catalog-sync') {
      const { runKtAlphaCatalogSync } = await import('../../../worker/cron/kt-alpha-catalog-sync');
      const result = await runKtAlphaCatalogSync(env);
      return c.json({ success: true, name, elapsed_ms: Date.now() - start, result });
    }

    return c.json({
      success: false,
      error: `허용되지 않은 cron name: ${name}`,
      allowed: ['restaurant-geocode', 'kt-alpha-catalog-sync'],
    }, 400);
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminMiscRoutes;
