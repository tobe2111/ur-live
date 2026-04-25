/**
 * 셀러 후원 관리 API
 *
 * GET  /api/seller/donations                  - 받은 후원 목록
 * GET  /api/seller/donations/summary          - 후원 요약 (총액, 정산 가능액)
 * POST /api/seller/donations/settlements      - 정산 신청
 * GET  /api/seller/donations/settlements      - 정산 신청 내역
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verify } from 'hono/jwt';
import type { Env } from '@/worker/types/env';

const sellerDonationsRoutes = new Hono<{ Bindings: Env }>();

sellerDonationsRoutes.use('*', cors({
  origin: ['https://live.ur-team.com', 'https://ur-live.pages.dev', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

async function getSellerIdFromToken(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization?.startsWith('Bearer ')) return null;
  try {
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as { seller_id?: number };
    return payload.seller_id ?? null;
  } catch {
    return null;
  }
}

// ── GET /api/seller/donations/summary ────────────────────────────────────────
// 후원 요약: 총 수령액, 정산 완료액, 정산 가능액 (10일 경과 후)
sellerDonationsRoutes.get('/donations/summary', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  try {
    const [total, settled, available] = await Promise.all([
      // 전체 후원 수령액 (handle both schema versions: seller_amount or credit_amount, status or payment_status)
      DB.prepare(
        `SELECT COALESCE(SUM(COALESCE(credit_amount, 0)), 0) AS total FROM donations
         WHERE seller_id = ? AND payment_status = 'completed'`
      ).bind(sellerId).first<{ total: number }>().catch(() => ({ total: 0 })),
      // 정산 완료 금액
      DB.prepare(
        `SELECT COALESCE(SUM(settlement_amount), 0) AS total FROM donation_settlements
         WHERE seller_id = ? AND status = 'DONE'`
      ).bind(sellerId).first<{ total: number }>().catch(() => ({ total: 0 })),
      // 정산 가능 금액 (10일 경과 + 아직 정산 신청 안 한 것)
      DB.prepare(`
        SELECT COALESCE(SUM(COALESCE(d.credit_amount, 0)), 0) AS total
        FROM donations d
        WHERE d.seller_id = ?
          AND d.payment_status = 'completed'
          AND DATE(d.created_at) <= DATE('now', '-10 days')
          AND d.id NOT IN (
            SELECT value FROM json_each(
              (SELECT COALESCE(GROUP_CONCAT(donation_ids), '[]')
               FROM donation_settlements
               WHERE seller_id = ? AND status IN ('REQUESTED', 'DONE'))
            )
          )
      `).bind(sellerId, sellerId).first<{ total: number }>().catch(() => ({ total: 0 })),
    ]);

    return c.json({
      success: true,
      data: {
        total_received: total?.total ?? 0,
        total_settled: settled?.total ?? 0,
        available_amount: available?.total ?? 0,
        pending_settlement: (total?.total ?? 0) - (settled?.total ?? 0),
      },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /api/seller/donations ─────────────────────────────────────────────────
// 받은 후원 목록
sellerDonationsRoutes.get('/donations', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  const limit = Math.min((parseInt(c.req.query('limit') || '50', 10) || 50), 200);
  const offset = (parseInt(c.req.query('offset') || '0', 10) || 0);

  try {
    const [rows, countRow] = await Promise.all([
      DB.prepare(`
        SELECT d.id, d.live_stream_id AS stream_id, ls.title AS stream_title,
               d.donor_name, d.amount, COALESCE(d.credit_amount, 0) AS seller_amount,
               COALESCE(d.commission_amount, 0) AS commission_amount, COALESCE(d.commission_rate, 0) AS commission_rate,
               d.message, 0 AS is_anonymous,
               d.payment_status AS status, d.created_at,
               CASE WHEN DATE(d.created_at) <= DATE('now', '-10 days') THEN 1 ELSE 0 END AS can_settle
        FROM donations d
        LEFT JOIN live_streams ls ON d.live_stream_id = ls.id
        WHERE d.seller_id = ? AND d.payment_status = 'completed'
        ORDER BY d.created_at DESC LIMIT ? OFFSET ?
      `).bind(sellerId, limit, offset).all(),
      DB.prepare(
        `SELECT COUNT(*) AS total FROM donations WHERE seller_id = ? AND payment_status = 'completed'`
      ).bind(sellerId).first<{ total: number }>(),
    ]);

    return c.json({
      success: true,
      data: rows.results ?? [],
      pagination: { total: countRow?.total ?? 0, limit, offset },
    });
  } catch {
    return c.json({ success: true, data: [], pagination: { total: 0, limit, offset } });
  }
});

// ── POST /api/seller/donations/settlements ────────────────────────────────────
// 정산 신청 (10일 경과 후원만 포함)
sellerDonationsRoutes.post('/donations/settlements', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const body = await c.req.json<{ bank_info: string }>().catch(() => ({ bank_info: '' }));

  const { DB } = c.env;

  try {
    // 정산 가능한 후원 조회 (10일 경과, 아직 정산 신청 안 된 것)
    const { results: eligible } = await DB.prepare(`
      SELECT d.id, COALESCE(d.credit_amount, 0) AS seller_amount,
             COALESCE(d.commission_amount, 0) AS commission_amount, d.amount
      FROM donations d
      WHERE d.seller_id = ?
        AND d.payment_status = 'completed'
        AND DATE(d.created_at) <= DATE('now', '-10 days')
    `).bind(sellerId).all<{ id: number; seller_amount: number; commission_amount: number; amount: number }>();

    if (!eligible || eligible.length === 0) {
      return c.json({ success: false, error: '정산 가능한 후원이 없습니다 (후원일로부터 10일 이후 신청 가능)' }, 400);
    }

    // 이미 진행 중인 정산 신청이 있는지 확인
    const pending = await DB.prepare(
      `SELECT id FROM donation_settlements WHERE seller_id = ? AND status = 'REQUESTED' LIMIT 1`
    ).bind(sellerId).first().catch(() => null);
    if (pending) {
      return c.json({ success: false, error: '이미 처리 중인 정산 신청이 있습니다' }, 409);
    }

    const totalAmount = eligible.reduce((s, d) => s + d.amount, 0);
    const commissionAmount = eligible.reduce((s, d) => s + d.commission_amount, 0);
    const settlementAmount = eligible.reduce((s, d) => s + d.seller_amount, 0);
    const donationIds = JSON.stringify(eligible.map(d => d.id));

    const result = await DB.prepare(`
      INSERT INTO donation_settlements
        (seller_id, total_amount, commission_amount, settlement_amount, donation_count,
         status, bank_info, donation_ids, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'REQUESTED', ?, ?, datetime('now'), datetime('now'))
    `).bind(
      sellerId, totalAmount, commissionAmount, settlementAmount,
      eligible.length, body.bank_info || null, donationIds,
    ).run();

    return c.json({
      success: true,
      data: {
        id: result.meta.last_row_id,
        total_amount: totalAmount,
        commission_amount: commissionAmount,
        settlement_amount: settlementAmount,
        donation_count: eligible.length,
      },
      message: `${settlementAmount.toLocaleString()}원 정산 신청이 완료되었습니다.`,
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /api/seller/donations/settlements ─────────────────────────────────────
// 정산 신청 내역
sellerDonationsRoutes.get('/donations/settlements', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  try {
    const { results } = await DB.prepare(`
      SELECT id, total_amount, commission_amount, settlement_amount, donation_count,
             status, requested_at, settled_at, admin_memo, bank_info, created_at
      FROM donation_settlements
      WHERE seller_id = ?
      ORDER BY created_at DESC LIMIT 50
    `).bind(sellerId).all();

    return c.json({ success: true, data: results ?? [] });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

export { sellerDonationsRoutes };
