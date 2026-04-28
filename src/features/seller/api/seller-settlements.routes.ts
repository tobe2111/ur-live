/**
 * 🛡️ 2026-04-28 TD-006 (split): Seller Settlements + Dashboard Stats (7 endpoints)
 *
 * 원본: seller-management.routes.ts (476-664).
 *
 * - GET  /settlements                — 정산 신청 목록
 * - POST /settlements/request        — 정산 신청
 * - GET  /settlements/stats          — 정산 통계
 * - GET  /settlements/summary        — 정산 요약
 * - GET  /dashboard/stats            — 대시보드 통계
 * - GET  /settlements/:id/download   — 정산서 다운로드
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verify } from 'hono/jwt'
import type { JWTPayload } from 'hono/utils/jwt/types'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'
import { swallow } from '@/worker/utils/swallow'

type Bindings = { DB: D1Database; JWT_SECRET: string }
interface SellerJWTPayload extends Record<string, unknown> { seller_id?: number }

interface SettlementStatsRow {
  total_settled: number
  pending_amount: number
  total_requests: number
}
interface SettlementRow {
  id: number
  seller_id: number
  amount: number
  status: string
  bank_name: string | null
  account_number: string | null
  account_holder: string | null
  created_at: string
}

export const sellerSettlementsRoutes = new Hono<{ Bindings: Bindings }>()
sellerSettlementsRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))
sellerSettlementsRoutes.get('/settlements', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    const rows = await db.prepare(
      'SELECT * FROM settlements WHERE seller_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(sellerId, limit, offset).all().catch(() => ({ results: [] }));
    const count = await db.prepare('SELECT COUNT(*) as total FROM settlements WHERE seller_id = ?')
      .bind(sellerId).first<{ total: number }>().catch(() => ({ total: 0 }));
    return c.json({ success: true, data: rows.results, total: count?.total ?? 0 });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

sellerSettlementsRoutes.post('/settlements/request', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);

    // 🛡️ 민감 액션 — 최근 15분 내 PIN 인증 필수
    const { isPinVerified } = await import('./seller-pin.routes');
    const pinOk = await isPinVerified(c.req.header('Cookie'), sellerId, c.env.JWT_SECRET);
    if (!pinOk) {
      return c.json({
        success: false,
        error: 'PIN 인증이 필요합니다',
        code: 'PIN_REQUIRED',
      }, 412);
    }

    const { amount, bank_name, account_number, account_holder } = await c.req.json();
    if (!amount || amount <= 0) return c.json({ success: false, error: '정산 금액이 올바르지 않습니다' }, 400);
    const result = await db.prepare(`
      INSERT INTO settlements (seller_id, amount, bank_name, account_number, account_holder, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
    `).bind(sellerId, amount, bank_name || null, account_number || null, account_holder || null).run()
      .catch(() => null);
    if (!result) return c.json({ success: false, error: '정산 신청 실패 (settlements 테이블 없음)' }, 500);
    // 1. 정산 신청 → 어드민 알림
    createDashboardNotification(db, 'admin', null, 'settlement_request', '정산 신청', `셀러 #${sellerId}`, '/admin/settlement').catch(swallow('seller:api:seller-management'));
    return c.json({ success: true, message: '정산 신청이 완료되었습니다', id: result.meta.last_row_id });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

sellerSettlementsRoutes.get('/settlements/stats', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);
    const stats = await db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_settled,
        SUM(CASE WHEN status = 'pending'   THEN amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'approved'  THEN amount ELSE 0 END) as approved_amount,
        SUM(CASE WHEN status = 'paid'      THEN amount ELSE 0 END) as paid_amount,
        COUNT(CASE WHEN status = 'pending'  THEN 1 END) as total_pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as total_approved,
        COUNT(CASE WHEN status = 'paid'     THEN 1 END) as total_paid,
        COUNT(*) as total_requests
      FROM settlements WHERE seller_id = ?
    `).bind(sellerId).first<SettlementStatsRow>().catch(() => null);
    const defaultStats = { total_settled: 0, pending_amount: 0, approved_amount: 0, paid_amount: 0, total_pending: 0, total_approved: 0, total_paid: 0, total_requests: 0 };
    return c.json({ success: true, data: stats ? { ...defaultStats, ...stats } : defaultStats });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /api/seller/settlements/summary ─────────────────────────────────────
// 셀러 정산 요약: 미정산 금액, 마지막 정산, 누적 정산
sellerSettlementsRoutes.get('/settlements/summary', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  const sellerId = await getSellerIdFromToken(authorization, c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 401);

  try {
    const { getSellerSettlementSummary } = await import('../../../lib/settlement-automation');
    const summary = await getSellerSettlementSummary(db, sellerId);
    return c.json({ success: true, data: summary });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /api/seller/dashboard/stats ─────────────────────────────────────────
// 셀러 대시보드 요약 통계 (SellerDashboardPage에서 호출)
sellerSettlementsRoutes.get('/dashboard/stats', async (c) => {
  const { DB } = c.env;
  const authorization = c.req.header('Authorization');
  const sellerId = await getSellerIdFromToken(authorization, c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

  try {
    const today = new Date().toISOString().slice(0, 10);
    const [orderStats, productStats, streamStats] = await Promise.all([
      DB.prepare(`
        SELECT COUNT(*) as total_orders,
               COALESCE(SUM(total_amount), 0) as total_revenue
        FROM orders WHERE seller_id = ? AND DATE(created_at) = ?
      `).bind(sellerId, today).first<{ total_orders: number; total_revenue: number }>(),
      DB.prepare(`
        SELECT COUNT(*) as total_products,
               SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_products
        FROM products WHERE seller_id = ?
      `).bind(sellerId).first<{ total_products: number; active_products: number }>(),
      DB.prepare(`
        SELECT COUNT(*) as total_streams,
               SUM(CASE WHEN status = 'live' THEN 1 ELSE 0 END) as live_streams
        FROM live_streams WHERE seller_id = ?
      `).bind(sellerId).first<{ total_streams: number; live_streams: number }>(),
    ]);

    return c.json({
      success: true,
      data: {
        today_orders: orderStats?.total_orders ?? 0,
        today_revenue: orderStats?.total_revenue ?? 0,
        total_products: productStats?.total_products ?? 0,
        active_products: productStats?.active_products ?? 0,
        total_streams: streamStats?.total_streams ?? 0,
        live_streams: streamStats?.live_streams ?? 0,
      },
    });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /api/seller/settlements/:id/download ─────────────────────────────────
// 정산 내역서 다운로드 (CSV/JSON)
sellerSettlementsRoutes.get('/settlements/:id/download', async (c) => {
  const { DB } = c.env;
  const authorization = c.req.header('Authorization');
  const sellerId = await getSellerIdFromToken(authorization, c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const settlementId = c.req.param('id');
  try {
    const settlement = await DB.prepare(
      `SELECT * FROM settlements WHERE id = ? AND seller_id = ?`
    ).bind(settlementId, sellerId).first<SettlementRow>();

    if (!settlement) return c.json({ success: false, error: '정산 내역을 찾을 수 없습니다' }, 404);

    // v34 CRITICAL FIX: 계좌번호 마스킹 (끝 4자리만 노출)
    // CSV 파일이 이메일/메신저로 공유되어도 plaintext 유출 방지
    const maskAccount = (acc: string | null | undefined): string => {
      if (!acc) return '';
      const s = String(acc);
      if (s.length <= 4) return '****';
      return '*'.repeat(Math.max(4, s.length - 4)) + s.slice(-4);
    };

    // CSV 형태로 반환
    const csv = [
      '정산ID,판매자ID,금액,상태,은행,계좌번호(마스킹),신청일',
      `${settlement.id},${settlement.seller_id},${settlement.amount},${settlement.status},${settlement.bank_name ?? ''},${maskAccount(settlement.account_number)},${settlement.created_at}`,
    ].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="settlement-${settlementId}.csv"`,
      },
    });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});
