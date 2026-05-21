/**
 * Admin Settlements Routes — 정산 관리
 *
 * 🛡️ 2026-04-22 배치 143 (TD-006 부분): admin-management.routes.ts 에서 분리.
 * worker/index.ts 에서 adminApp.route('/', adminSettlementsRoutes) 으로 마운트.
 *
 * 엔드포인트:
 * - GET    /settlement/stats       — 정산 통계 (기간별)
 * - GET    /settlement/records     — 정산 레코드 목록
 * - PATCH  /settlement/:id/status  — 정산 상태 변경
 * - POST   /settlement/batch-complete — 일괄 정산 완료
 * - POST   /settlement/execute     — 자동 정산 실행 (실제/preview)
 * - GET    /settlement/export-csv  — CSV 내보내기
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { executeQuery, executeRun } from '@/worker/utils/database';
import { DEFAULT_COMMISSION_RATE } from '@/shared/constants';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';
import { requireAdminRole } from '@/worker/middleware/auth';
import { logAudit } from '../../../lib/audit-log';
import { rateLimit } from '@/worker/middleware/rate-limit';

export const adminSettlementsRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

interface SettlementOverviewRow {
  total_orders: number;
  total_sales: number;
  total_commission: number;
  total_seller_amount: number;
}

interface SettlementSellerRow {
  seller_id: number;
  seller_name: string | null;
  business_name: string | null;
  commission_rate: number;
  order_count: number;
  total_sales: number;
  commission_amount: number;
  seller_amount: number;
}

interface SettlementRecordRow {
  id: number;
  order_number: string;
  seller_id: number | null;
  seller_name: string | null;
  business_name: string | null;
  total_amount: number;
  commission_rate: number;
  commission_amount: number;
  seller_amount: number;
  settlement_status: string;
  settled_at: string | null;
  created_at: string;
  user_name: string | null;
}

adminSettlementsRoutes.get('/settlement/stats', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const period = c.req.query('period') || 'all';
    let df = '';
    if (period === 'today') df = `AND DATE(o.created_at, '+9 hours') = '${new Date().toISOString().split('T')[0]}'`;
    else if (period === 'week') df = "AND DATE(o.created_at, '+9 hours') >= DATE('now','+9 hours','-7 days')";
    else if (period === 'month') df = "AND DATE(o.created_at, '+9 hours') >= DATE('now','+9 hours','-30 days')";

    const safeFull = async <T>(q: string): Promise<T[] | null> => {
      try { return await executeQuery<T>(DB, q); } catch { return null; }
    };
    const safeFallback = async <T>(q: string): Promise<T[]> => {
      try { return await executeQuery<T>(DB, q); } catch { return []; }
    };

    let overview: SettlementOverviewRow[];
    const fullOverview = await safeFull<SettlementOverviewRow>(`
      SELECT COUNT(*) as total_orders,
             COALESCE(SUM(o.total_amount),0) as total_sales,
             COALESCE(SUM(o.total_amount*COALESCE(o.commission_rate,s.commission_rate,${DEFAULT_COMMISSION_RATE})/100),0) as total_commission,
             COALESCE(SUM(o.total_amount*(1-COALESCE(o.commission_rate,s.commission_rate,${DEFAULT_COMMISSION_RATE})/100)),0) as total_seller_amount
      FROM orders o LEFT JOIN sellers s ON o.seller_id=s.id
      WHERE o.status IN ('DONE','PAID','DELIVERED') ${df}`);
    if (fullOverview !== null) {
      overview = fullOverview;
    } else {
      overview = await safeFallback<SettlementOverviewRow>(`
        SELECT COUNT(*) as total_orders,
               COALESCE(SUM(o.total_amount),0) as total_sales,
               COALESCE(SUM(o.total_amount*${DEFAULT_COMMISSION_RATE}/100),0) as total_commission,
               COALESCE(SUM(o.total_amount*(1-${DEFAULT_COMMISSION_RATE}/100)),0) as total_seller_amount
        FROM orders o LEFT JOIN sellers s ON o.seller_id=s.id
        WHERE 1=1 ${df}`);
    }

    let sellers: SettlementSellerRow[];
    const fullSellers = await safeFull<SettlementSellerRow>(`
      SELECT s.id as seller_id, s.name as seller_name, s.business_name,
             COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE}) as commission_rate,
             COUNT(o.id) as order_count,
             COALESCE(SUM(COALESCE(o.total_amount, o.total_price, 0)),0) as total_sales,
             COALESCE(SUM(COALESCE(o.total_amount, o.total_price, 0)*COALESCE(o.commission_rate,s.commission_rate,${DEFAULT_COMMISSION_RATE})/100),0) as commission_amount,
             COALESCE(SUM(COALESCE(o.total_amount, o.total_price, 0)*(1-COALESCE(o.commission_rate,s.commission_rate,${DEFAULT_COMMISSION_RATE})/100)),0) as seller_amount,
             COALESCE(SUM(CASE WHEN COALESCE(o.settlement_status,'pending')='pending' THEN COALESCE(o.total_amount, o.total_price, 0)*(1-COALESCE(o.commission_rate,s.commission_rate,${DEFAULT_COMMISSION_RATE})/100) ELSE 0 END),0) as pending_amount,
             COALESCE(SUM(CASE WHEN COALESCE(o.settlement_status,'pending')='completed' THEN COALESCE(o.total_amount, o.total_price, 0)*(1-COALESCE(o.commission_rate,s.commission_rate,${DEFAULT_COMMISSION_RATE})/100) ELSE 0 END),0) as settled_amount
      FROM sellers s LEFT JOIN orders o ON s.id=o.seller_id AND o.status IN ('DONE','PAID','DELIVERED') ${df}
      GROUP BY s.id ORDER BY total_sales DESC`);
    if (fullSellers !== null) {
      sellers = fullSellers;
    } else {
      sellers = await safeFallback<SettlementSellerRow>(`
        SELECT s.id as seller_id, s.name as seller_name, s.business_name,
               ${DEFAULT_COMMISSION_RATE} as commission_rate,
               COUNT(o.id) as order_count,
               COALESCE(SUM(COALESCE(o.total_amount, o.total_price, 0)),0) as total_sales,
               COALESCE(SUM(COALESCE(o.total_amount, o.total_price, 0)*${DEFAULT_COMMISSION_RATE}/100),0) as commission_amount,
               COALESCE(SUM(COALESCE(o.total_amount, o.total_price, 0)*(1-${DEFAULT_COMMISSION_RATE}/100)),0) as seller_amount,
               COALESCE(SUM(CASE WHEN COALESCE(o.settlement_status,'pending')='pending' THEN COALESCE(o.total_amount, o.total_price, 0)*(1-${DEFAULT_COMMISSION_RATE}/100) ELSE 0 END),0) as pending_amount,
               COALESCE(SUM(CASE WHEN COALESCE(o.settlement_status,'pending')='completed' THEN COALESCE(o.total_amount, o.total_price, 0)*(1-${DEFAULT_COMMISSION_RATE}/100) ELSE 0 END),0) as settled_amount
        FROM sellers s LEFT JOIN orders o ON s.id=o.seller_id
        WHERE 1=1 ${df}
        GROUP BY s.id ORDER BY total_sales DESC`);
    }

    const defaultOverview = { total_orders: 0, total_sales: 0, total_commission: 0, total_seller_amount: 0 };
    return c.json({ success: true, data: { overview: overview[0] || defaultOverview, sellers } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSettlementsRoutes.get('/settlement/records', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const period = c.req.query('period') || 'all';
    const sellerId = c.req.query('seller_id');
    const status = c.req.query('status');

    const safe = async <T>(q: string, p: (string|number|null)[] = []): Promise<T[]> => {
      try { return await executeQuery<T>(DB, q, p); } catch { return []; }
    };

    const buildQuery = (withNewCols: boolean) => {
      let q = withNewCols
        ? `SELECT o.id, o.order_number, o.seller_id, COALESCE(s.name,'') as seller_name, COALESCE(s.business_name,'') as business_name,
                  o.total_amount as total_amount,
                  COALESCE(o.commission_rate,s.commission_rate,${DEFAULT_COMMISSION_RATE}) as commission_rate,
                  o.total_amount*COALESCE(o.commission_rate,s.commission_rate,${DEFAULT_COMMISSION_RATE})/100 as commission_amount,
                  o.total_amount*(1-COALESCE(o.commission_rate,s.commission_rate,${DEFAULT_COMMISSION_RATE})/100) as seller_amount,
                  COALESCE(o.settlement_status,'pending') as settlement_status,
                  o.settled_at, o.created_at, COALESCE(u.name,'') as user_name
           FROM orders o LEFT JOIN sellers s ON o.seller_id=s.id LEFT JOIN users u ON o.user_id=u.id
           WHERE o.status IN ('DONE','PAID','DELIVERED')`
        : `SELECT o.id, o.order_number, o.seller_id, COALESCE(s.name,'') as seller_name, COALESCE(s.business_name,'') as business_name,
                  o.total_amount as total_amount,
                  ${DEFAULT_COMMISSION_RATE} as commission_rate,
                  o.total_amount*${DEFAULT_COMMISSION_RATE}/100 as commission_amount,
                  o.total_amount*(1-${DEFAULT_COMMISSION_RATE}/100) as seller_amount,
                  'pending' as settlement_status,
                  NULL as settled_at, o.created_at, COALESCE(u.name,'') as user_name
           FROM orders o LEFT JOIN sellers s ON o.seller_id=s.id LEFT JOIN users u ON o.user_id=u.id
           WHERE 1=1`;
      const params: (string|number|null)[] = [];
      if (period === 'today') { q += " AND DATE(o.created_at, '+9 hours')=?"; params.push(new Date().toISOString().split('T')[0]); }
      else if (period === 'week') q += " AND DATE(o.created_at, '+9 hours')>=DATE('now','+9 hours','-7 days')";
      else if (period === 'month') q += " AND DATE(o.created_at, '+9 hours')>=DATE('now','+9 hours','-30 days')";
      if (sellerId) { q += ' AND o.seller_id=?'; params.push(sellerId); }
      if (withNewCols && status && status !== 'all') { q += " AND COALESCE(o.settlement_status,'pending')=?"; params.push(status); }
      q += ' ORDER BY o.created_at DESC LIMIT 1000';
      return { q, params };
    };

    let records: SettlementRecordRow[];
    try {
      const { q, params } = buildQuery(true);
      records = await executeQuery<SettlementRecordRow>(DB, q, params);
    } catch {
      const { q, params } = buildQuery(false);
      records = await safe<SettlementRecordRow>(q, params);
    }
    return c.json({ success: true, data: records });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSettlementsRoutes.patch('/settlement/:id/status', cors(), rateLimit({ action: 'admin_settlement_status', max: 30, windowSec: 60 }), requireAdminRole('finance'), async (c) => {
  try {
    const { DB } = c.env;
    const orderId = c.req.param('id');
    const { status } = await c.req.json<{ status: string }>();
    if (!['pending', 'completed'].includes(status))
      return c.json({ success: false, error: '유효하지 않은 상태입니다' }, 400);
    const prev = await DB.prepare(`SELECT settlement_status FROM orders WHERE id = ?`).bind(orderId).first<{ settlement_status: string | null }>();
    const settled_at = status === 'completed' ? new Date().toISOString() : null;
    await executeRun(DB,
      `UPDATE orders SET settlement_status = ?, settled_at = ? WHERE id = ?`,
      [status, settled_at, orderId]);
    const actor = (c as unknown as { get: (k: string) => { id?: string | number; email?: string } }).get('user');
    void logAudit(DB, {
      actor_id: String(actor?.id ?? 'unknown'),
      actor_email: actor?.email,
      action: 'settlement_status',
      resource_type: 'order',
      resource_id: String(orderId),
      old_value: JSON.stringify({ settlement_status: prev?.settlement_status }),
      new_value: JSON.stringify({ settlement_status: status }),
      ip: c.req.header('CF-Connecting-IP') ?? undefined,
    });
    return c.json({ success: true, data: { id: orderId, settlement_status: status } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSettlementsRoutes.post('/settlement/batch-complete', cors(), rateLimit({ action: 'admin_settlement_batch', max: 5, windowSec: 60 }), requireAdminRole('finance'), async (c) => {
  try {
    const { DB } = c.env;
    const { order_ids } = await c.req.json<{ order_ids: number[] }>();
    if (!Array.isArray(order_ids) || order_ids.length === 0)
      return c.json({ success: false, error: '주문 ID 목록이 필요합니다' }, 400);

    if (order_ids.length > 1000) {
      return c.json({ success: false, error: '한 번에 1000건 이하만 처리 가능합니다' }, 400);
    }

    const placeholders = order_ids.map(() => '?').join(',');
    const eligible = await executeQuery<{ id: number }>(DB,
      `SELECT id FROM orders
       WHERE id IN (${placeholders})
         AND status = 'DELIVERED'
         AND (settlement_status IS NULL OR settlement_status != 'completed')`,
      order_ids,
    );
    if ((eligible?.length ?? 0) !== order_ids.length) {
      return c.json({ success: false, error: '일부 주문은 정산 대상이 아닙니다 (DELIVERED 상태 + 미정산 주문만 가능)' }, 400);
    }

    const settled_at = new Date().toISOString();
    await executeRun(DB,
      `UPDATE orders SET settlement_status = 'completed', settled_at = ? WHERE id IN (${placeholders})`,
      [settled_at, ...order_ids]);
    const actor = (c as unknown as { get: (k: string) => { id?: string | number; email?: string } }).get('user');
    void logAudit(DB, {
      actor_id: String(actor?.id ?? 'unknown'),
      actor_email: actor?.email,
      action: 'settlement_batch',
      resource_type: 'order',
      resource_id: order_ids.join(','),
      new_value: JSON.stringify({ count: order_ids.length, order_ids }),
      ip: c.req.header('CF-Connecting-IP') ?? undefined,
    });
    return c.json({ success: true, data: { updated: order_ids.length } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSettlementsRoutes.post('/settlement/execute', cors(), rateLimit({ action: 'admin_settlement_execute', max: 5, windowSec: 60 }), requireAdminRole('finance'), async (c) => {
  try {
    const { DB } = c.env;
    const body = await c.req.json<{ period_start?: string; period_end?: string }>().catch(() => ({} as { period_start?: string; period_end?: string }));
    const { calculateAutoSettlement, executeSettlement } = await import('../../../lib/settlement-automation');

    const dryRun = c.req.query('dry_run') === 'true';

    if (dryRun) {
      const preview = await calculateAutoSettlement(
        DB, body.period_start, body.period_end, DEFAULT_COMMISSION_RATE
      );
      const totalSales = preview.reduce((s, r) => s + r.total_sales, 0);
      const totalCommission = preview.reduce((s, r) => s + r.commission_amount, 0);
      const totalSettlement = preview.reduce((s, r) => s + r.settlement_amount, 0);
      const totalOrders = preview.reduce((s, r) => s + r.total_orders, 0);
      return c.json({
        success: true,
        data: {
          dry_run: true,
          sellers: preview,
          total_orders: totalOrders,
          total_sales: totalSales,
          total_commission: totalCommission,
          total_settlement: totalSettlement,
        },
      });
    }

    const result = await executeSettlement(
      DB, body.period_start, body.period_end, DEFAULT_COMMISSION_RATE
    );

    for (const seller of result.sellers) {
      createDashboardNotification(DB, 'seller', String(seller.seller_id), 'settlement_completed', '정산 완료', `정산 금액: ${seller.settlement_amount}원`, '/seller/settlements').catch((_e) => { if (import.meta.env.DEV) console.warn(_e) });
    }

    // 🛡️ 2026-05-21: 정산 완료 알림톡 발송 (env 미설정 시 silent skip).
    //   sellers.phone 조회 → sendSystemAlimtalk(commerce_settlement_completed).
    c.executionCtx?.waitUntil((async () => {
      try {
        const { sendSystemAlimtalk } = await import('../../../lib/system-alimtalk');
        for (const seller of result.sellers) {
          const row = await DB.prepare("SELECT phone, business_name FROM sellers WHERE id = ?").bind(seller.seller_id).first<{ phone: string; business_name: string }>().catch(() => null);
          if (!row?.phone) continue;
          const amount = (seller.settlement_amount || 0).toLocaleString('ko-KR');
          const message = `[유어딜] ${row.business_name || ''} 정산이 완료되었습니다.\n정산 금액: ${amount}원\n자세한 내역: live.ur-team.com/seller/settlements`;
          await sendSystemAlimtalk(c.env as unknown as Record<string, unknown>, row.phone, 'seller_settlement_completed', message);
        }
      } catch (e) {
        if (import.meta.env?.DEV) console.warn('[settlement-alimtalk]', e);
      }
    })());

    return c.json({ success: true, data: result });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSettlementsRoutes.get('/settlement/export-csv', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const period = c.req.query('period') || 'all';
    const sellerId = c.req.query('seller_id');

    let query = `
      SELECT o.order_number, s.name as seller_name, s.business_name,
             o.total_amount,
             COALESCE(o.commission_rate, s.commission_rate, ${DEFAULT_COMMISSION_RATE}) as commission_rate,
             ROUND(o.total_amount * COALESCE(o.commission_rate, s.commission_rate, ${DEFAULT_COMMISSION_RATE}) / 100) as commission_amount,
             ROUND(o.total_amount * (1 - COALESCE(o.commission_rate, s.commission_rate, ${DEFAULT_COMMISSION_RATE}) / 100)) as seller_amount,
             COALESCE(o.settlement_status, 'pending') as settlement_status,
             o.settled_at, o.created_at, u.name as user_name
      FROM orders o
      LEFT JOIN sellers s ON o.seller_id = s.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.status IN ('DONE', 'PAID', 'DELIVERED')
    `;
    const params: (string | number | null)[] = [];
    if (period === 'today') { query += " AND DATE(o.created_at, '+9 hours') = ?"; params.push(new Date().toISOString().split('T')[0]); }
    else if (period === 'week') query += " AND DATE(o.created_at, '+9 hours') >= DATE('now','+9 hours','-7 days')";
    else if (period === 'month') query += " AND DATE(o.created_at, '+9 hours') >= DATE('now','+9 hours','-30 days')";
    if (sellerId) { query += ' AND o.seller_id = ?'; params.push(sellerId); }
    query += ' ORDER BY o.created_at DESC';

    const records = await executeQuery<SettlementRecordRow>(DB, query, params);

    const headers = ['주문번호', '판매자명', '사업자명', '구매자명', '주문금액', '수수료율', '수수료', '정산액', '정산상태', '정산일시', '주문일시'];
    const rows = records.map(r => [
      r.order_number,
      r.seller_name || '',
      r.business_name || '',
      r.user_name || '',
      r.total_amount,
      `${r.commission_rate}%`,
      r.commission_amount,
      r.seller_amount,
      r.settlement_status === 'completed' ? '완료' : '대기',
      r.settled_at ? new Date(r.settled_at).toLocaleString('ko-KR') : '-',
      new Date(r.created_at).toLocaleString('ko-KR'),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const bom = '﻿';
    return new Response(bom + csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="settlement_${period}_${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// 🛡️ 2026-05-18: 지급조서 — 비사업자 셀러 원천징수 내역 CSV export (국세청 양식 호환).
//   소득세법 §145 — 매월 다음달 10일까지 지급명세서 제출. 종합소득은 다음 해 2월 말.
//   본 endpoint 는 연/월 단위 조회 + CSV download (수동 국세청 제출용).
adminSettlementsRoutes.get('/tax-withholding/export', cors(), async (c) => {
  try {
    const year = Number(c.req.query('year')) || new Date().getFullYear();
    const month = c.req.query('month') ? Number(c.req.query('month')) : null;
    const reportableOnly = c.req.query('reportable_only') === '1';

    let sql = `
      SELECT t.id, t.seller_id, s.name as seller_name, s.business_name, s.business_number,
             s.phone as seller_phone, s.email as seller_email,
             t.payout_year, t.payout_month, t.gross_amount,
             t.withholding_rate, t.withholding_amount, t.net_amount,
             t.source_type, t.source_id, t.ytd_gross_amount, t.reportable,
             t.created_at
        FROM tax_withholding_log t
        LEFT JOIN sellers s ON s.id = t.seller_id
       WHERE t.payout_year = ?`;
    const params: unknown[] = [year];
    if (month) { sql += ' AND t.payout_month = ?'; params.push(month); }
    if (reportableOnly) sql += ' AND t.reportable = 1';
    sql += ' ORDER BY t.payout_month, t.seller_id, t.created_at';

    const rows = await c.env.DB.prepare(sql).bind(...params)
      .all<{
        id: number; seller_id: number; seller_name: string; business_name: string | null;
        business_number: string | null; seller_phone: string | null; seller_email: string | null;
        payout_year: number; payout_month: number;
        gross_amount: number; withholding_rate: number; withholding_amount: number;
        net_amount: number;
        source_type: string; source_id: string | null;
        ytd_gross_amount: number; reportable: number;
        created_at: string;
      }>().catch(() => ({ results: [] }));

    // CSV format: 국세청 표준 (탭 구분) 호환 + 사용자 친화 컬럼명.
    const headers = [
      'ID', '셀러ID', '셀러명', '상호', '사업자번호', '전화', '이메일',
      '지급연도', '지급월', '총지급액(원)', '원천징수율(%)', '원천징수액(원)', '실지급액(원)',
      '소득구분', '참조ID', '연누계지급액(원)', '종합소득합산여부', '발생일시',
    ];
    const csv = [
      headers.join(','),
      ...((rows.results || []).map(r => [
        r.id,
        r.seller_id,
        csvEscape(r.seller_name),
        csvEscape(r.business_name || ''),
        csvEscape(r.business_number || ''),
        csvEscape(r.seller_phone || ''),
        csvEscape(r.seller_email || ''),
        r.payout_year,
        r.payout_month,
        r.gross_amount,
        r.withholding_rate,
        r.withholding_amount,
        r.net_amount,
        r.source_type,
        csvEscape(r.source_id || ''),
        r.ytd_gross_amount,
        r.reportable ? '합산의무' : '분리과세',
        r.created_at,
      ].join(','))),
    ].join('\n');

    const filename = `tax-withholding-${year}${month ? `-${String(month).padStart(2, '0')}` : ''}.csv`;
    return new Response('﻿' + csv, {  // BOM 추가 (Excel 한글 깨짐 방지)
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// 지급조서 요약 (어드민 대시보드 — 연 누계 300만 초과 셀러 카운트 등).
adminSettlementsRoutes.get('/tax-withholding/summary', cors(), async (c) => {
  try {
    const year = Number(c.req.query('year')) || new Date().getFullYear();

    const summary = await c.env.DB.prepare(
      `SELECT
         COUNT(DISTINCT seller_id) as seller_count,
         COUNT(*) as payouts_count,
         COALESCE(SUM(gross_amount), 0) as total_gross,
         COALESCE(SUM(withholding_amount), 0) as total_withheld,
         COALESCE(SUM(net_amount), 0) as total_net,
         SUM(CASE WHEN reportable = 1 THEN 1 ELSE 0 END) as reportable_count
       FROM tax_withholding_log
      WHERE payout_year = ?`
    ).bind(year).first<{
      seller_count: number; payouts_count: number;
      total_gross: number; total_withheld: number; total_net: number;
      reportable_count: number;
    }>().catch(() => null);

    // 300만 초과 셀러 목록.
    const reportableSellers = await c.env.DB.prepare(
      `SELECT t.seller_id, s.name, s.business_name, s.business_number,
              SUM(t.gross_amount) as ytd_gross,
              SUM(t.withholding_amount) as ytd_withheld
         FROM tax_withholding_log t
         LEFT JOIN sellers s ON s.id = t.seller_id
        WHERE t.payout_year = ?
        GROUP BY t.seller_id
       HAVING ytd_gross > 3000000
        ORDER BY ytd_gross DESC LIMIT 100`
    ).bind(year).all<Record<string, unknown>>().catch(() => ({ results: [] }));

    return c.json({
      success: true,
      data: {
        year,
        ...(summary || { seller_count: 0, payouts_count: 0, total_gross: 0, total_withheld: 0, total_net: 0, reportable_count: 0 }),
        reportable_sellers: reportableSellers.results || [],
      },
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

function csvEscape(v: string): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default adminSettlementsRoutes;
