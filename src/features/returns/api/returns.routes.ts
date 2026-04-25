/**
 * 반품/환불 API Routes
 *
 * User endpoints:
 *   POST /request         - 반품 신청
 *   GET  /my              - 내 반품 내역
 *   PUT  /:id/shipping    - 반품 배송 정보 등록
 *
 * Seller endpoints:
 *   GET  /seller          - 셀러 반품 목록
 *   PUT  /:id/approve     - 반품 승인
 *   PUT  /:id/reject      - 반품 거부
 *   PUT  /:id/inspect     - 검수 완료
 *   PUT  /:id/refund      - 환불 처리
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import { rateLimit } from '@/worker/middleware/rate-limit';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import { tossCancelPayment } from '@/worker/utils/toss-payments';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';
import { logError } from '@/worker/utils/logger';

const returnsRoutes = new Hono<{ Bindings: Env }>();

returnsRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }));

// ── Auto-create table ────────────────────────────────────────────────────────

async function ensureTable(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        order_number TEXT NOT NULL,
        user_id TEXT NOT NULL,
        seller_id INTEGER,
        status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','shipped','received','inspected','refunded','cancelled')),
        reason TEXT NOT NULL,
        detail_reason TEXT,
        return_shipping_company TEXT,
        return_tracking_number TEXT,
        inspection_result TEXT CHECK (inspection_result IN ('approved','rejected')),
        inspection_notes TEXT,
        refund_amount INTEGER NOT NULL DEFAULT 0,
        refund_method TEXT DEFAULT 'original',
        requested_at DATETIME DEFAULT (datetime('now')),
        approved_at DATETIME,
        shipped_at DATETIME,
        received_at DATETIME,
        inspected_at DATETIME,
        refunded_at DATETIME,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )
    `).run();
  } catch { /* already exists */ }
  try {
    await DB.prepare('CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id)').run();
  } catch { /* */ }
  try {
    await DB.prepare('CREATE INDEX IF NOT EXISTS idx_returns_user ON returns(user_id)').run();
  } catch { /* */ }
  try {
    await DB.prepare('CREATE INDEX IF NOT EXISTS idx_returns_seller ON returns(seller_id, status)').run();
  } catch { /* */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
// User Endpoints
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /request — 반품 신청
 * Body: { order_id, reason, detail_reason? }
 */
returnsRoutes.post('/request', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const body = await c.req.json<{
    order_id: number;
    reason: string;
    detail_reason?: string;
  }>();

  if (!body.order_id || !body.reason) {
    return c.json({ success: false, error: '주문 ID와 반품 사유는 필수입니다' }, 400);
  }

  // 1. 주문 조회 + 소유자 확인
  const order = await DB.prepare(
    'SELECT id, order_number, user_id, seller_id, status, total_amount, delivered_at FROM orders WHERE id = ?'
  ).bind(body.order_id).first<{
    id: number;
    order_number: string;
    user_id: string;
    seller_id: number | null;
    status: string;
    total_amount: number | null;
    delivered_at: string | null;
  }>();

  if (!order) {
    return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);
  }

  if (String(order.user_id) !== String(user.id)) {
    return c.json({ success: false, error: '본인의 주문만 반품 신청할 수 있습니다' }, 403);
  }

  // 2. DELIVERED 상태 확인
  if (order.status.toUpperCase() !== 'DELIVERED') {
    return c.json({ success: false, error: '배송완료된 주문만 반품 신청이 가능합니다' }, 400);
  }

  // 3. 7일 이내 확인
  if (order.delivered_at) {
    const deliveredDate = new Date(order.delivered_at);
    const now = new Date();
    const diffDays = (now.getTime() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) {
      return c.json({ success: false, error: '배송완료 후 7일 이내에만 반품 신청이 가능합니다' }, 400);
    }
  }

  // 4. 중복 신청 확인
  const existing = await DB.prepare(
    "SELECT id FROM returns WHERE order_id = ? AND status NOT IN ('rejected','cancelled')"
  ).bind(body.order_id).first();

  if (existing) {
    return c.json({ success: false, error: '이미 반품 신청이 진행 중입니다' }, 400);
  }

  // 5. 반품 생성
  const refundAmount = order.total_amount ?? 0;

  const result = await DB.prepare(`
    INSERT INTO returns (order_id, order_number, user_id, seller_id, status, reason, detail_reason, refund_amount)
    VALUES (?, ?, ?, ?, 'requested', ?, ?, ?)
  `).bind(
    body.order_id,
    order.order_number,
    String(user.id),
    order.seller_id,
    body.reason,
    body.detail_reason ?? null,
    refundAmount
  ).run();

  // 5. 반품 신청 → 어드민 + 셀러 알림
  createDashboardNotification(DB, 'admin', null, 'return_request', '반품 신청', `주문: ${order.order_number}`, '/admin/orders').catch(() => {});
  if (order.seller_id) {
    createDashboardNotification(DB, 'seller', String(order.seller_id), 'return_request', '반품 신청 접수', `주문: ${order.order_number}`, '/seller/orders').catch(() => {});
  }

  return c.json({
    success: true,
    message: '반품 신청이 완료되었습니다',
    data: { id: result.meta.last_row_id },
  });
});

/**
 * GET /my — 내 반품 내역
 */
returnsRoutes.get('/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const returns = await DB.prepare(`
    SELECT r.*, o.total_amount as order_total, o.status as order_status
    FROM returns r
    LEFT JOIN orders o ON r.order_id = o.id
    WHERE r.user_id = ?
    ORDER BY r.requested_at DESC
  `).bind(String(user.id)).all();

  return c.json({ success: true, data: returns.results ?? [] });
});

/**
 * PUT /:id/shipping — 반품 배송 정보 등록
 * Body: { tracking_number, shipping_company }
 */
returnsRoutes.put('/:id/shipping', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const returnId = c.req.param('id');
  const body = await c.req.json<{
    tracking_number: string;
    shipping_company: string;
  }>();

  if (!body.tracking_number || !body.shipping_company) {
    return c.json({ success: false, error: '택배사와 송장번호는 필수입니다' }, 400);
  }

  // 반품 조회 + 소유자 확인
  const returnRecord = await DB.prepare(
    'SELECT id, user_id, status FROM returns WHERE id = ?'
  ).bind(returnId).first<{ id: number; user_id: string; status: string }>();

  if (!returnRecord) {
    return c.json({ success: false, error: '반품 내역을 찾을 수 없습니다' }, 404);
  }

  if (String(returnRecord.user_id) !== String(user.id)) {
    return c.json({ success: false, error: '본인의 반품만 수정할 수 있습니다' }, 403);
  }

  if (returnRecord.status !== 'approved') {
    return c.json({ success: false, error: '승인된 반품만 배송 정보를 등록할 수 있습니다' }, 400);
  }

  await DB.prepare(`
    UPDATE returns
    SET return_shipping_company = ?, return_tracking_number = ?, status = 'shipped', shipped_at = datetime('now')
    WHERE id = ?
  `).bind(body.shipping_company, body.tracking_number, returnId).run();

  return c.json({ success: true, message: '반품 배송 정보가 등록되었습니다' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Seller Endpoints
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /seller — 셀러 반품 목록
 */
returnsRoutes.get('/seller', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'seller') return c.json({ success: false, error: 'forbidden' }, 403);

  const { DB } = c.env;
  await ensureTable(DB);

  const sellerId = Number(user.id);

  const returns = await DB.prepare(`
    SELECT r.*, o.total_amount as order_total, o.status as order_status,
           o.shipping_name, o.shipping_phone, o.shipping_address
    FROM returns r
    LEFT JOIN orders o ON r.order_id = o.id
    WHERE r.seller_id = ?
    ORDER BY r.requested_at DESC
  `).bind(sellerId).all();

  return c.json({ success: true, data: returns.results ?? [] });
});

/**
 * PUT /:id/approve — 반품 승인
 */
returnsRoutes.put('/:id/approve', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'seller') return c.json({ success: false, error: 'forbidden' }, 403);
  const sellerId = Number(user.id);

  const { DB } = c.env;
  await ensureTable(DB);

  const returnId = c.req.param('id');

  const returnRecord = await DB.prepare(
    'SELECT id, seller_id, status FROM returns WHERE id = ?'
  ).bind(returnId).first<{ id: number; seller_id: number | null; status: string }>();

  if (!returnRecord) {
    return c.json({ success: false, error: '반품 내역을 찾을 수 없습니다' }, 404);
  }

  if (returnRecord.seller_id !== sellerId) {
    return c.json({ success: false, error: 'forbidden' }, 403);
  }

  if (returnRecord.status !== 'requested') {
    return c.json({ success: false, error: '요청 상태의 반품만 승인할 수 있습니다' }, 400);
  }

  await DB.prepare(`
    UPDATE returns SET status = 'approved', approved_at = datetime('now') WHERE id = ?
  `).bind(returnId).run();

  return c.json({ success: true, message: '반품이 승인되었습니다' });
});

/**
 * PUT /:id/reject — 반품 거부
 * Body: { rejection_reason }
 */
returnsRoutes.put('/:id/reject', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'seller') return c.json({ success: false, error: 'forbidden' }, 403);
  const sellerId = Number(user.id);

  const { DB } = c.env;
  await ensureTable(DB);

  const returnId = c.req.param('id');
  const body = await c.req.json<{ rejection_reason?: string }>();

  const returnRecord = await DB.prepare(
    'SELECT id, seller_id, status FROM returns WHERE id = ?'
  ).bind(returnId).first<{ id: number; seller_id: number | null; status: string }>();

  if (!returnRecord) {
    return c.json({ success: false, error: '반품 내역을 찾을 수 없습니다' }, 404);
  }

  if (returnRecord.seller_id !== sellerId) {
    return c.json({ success: false, error: 'forbidden' }, 403);
  }

  if (returnRecord.status !== 'requested') {
    return c.json({ success: false, error: '요청 상태의 반품만 거부할 수 있습니다' }, 400);
  }

  await DB.prepare(`
    UPDATE returns SET status = 'rejected', inspection_notes = ? WHERE id = ?
  `).bind(body.rejection_reason ?? '셀러 거부', returnId).run();

  return c.json({ success: true, message: '반품이 거부되었습니다' });
});

/**
 * PUT /:id/inspect — 검수 완료
 * Body: { inspection_result: 'approved'|'rejected', inspection_notes? }
 */
returnsRoutes.put('/:id/inspect', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'seller') return c.json({ success: false, error: 'forbidden' }, 403);
  const sellerId = Number(user.id);

  const { DB } = c.env;
  await ensureTable(DB);

  const returnId = c.req.param('id');
  const body = await c.req.json<{
    inspection_result: 'approved' | 'rejected';
    inspection_notes?: string;
  }>();

  if (!body.inspection_result || !['approved', 'rejected'].includes(body.inspection_result)) {
    return c.json({ success: false, error: '검수 결과는 approved 또는 rejected여야 합니다' }, 400);
  }

  const returnRecord = await DB.prepare(
    'SELECT id, seller_id, status FROM returns WHERE id = ?'
  ).bind(returnId).first<{ id: number; seller_id: number | null; status: string }>();

  if (!returnRecord) {
    return c.json({ success: false, error: '반품 내역을 찾을 수 없습니다' }, 404);
  }

  if (returnRecord.seller_id !== sellerId) {
    return c.json({ success: false, error: 'forbidden' }, 403);
  }

  if (!['shipped', 'received'].includes(returnRecord.status)) {
    return c.json({ success: false, error: '배송/수령된 반품만 검수할 수 있습니다' }, 400);
  }

  const newStatus = body.inspection_result === 'approved' ? 'inspected' : 'rejected';

  await DB.prepare(`
    UPDATE returns
    SET status = ?, inspection_result = ?, inspection_notes = ?, inspected_at = datetime('now')
    WHERE id = ?
  `).bind(newStatus, body.inspection_result, body.inspection_notes ?? null, returnId).run();

  return c.json({
    success: true,
    message: body.inspection_result === 'approved' ? '검수 승인되었습니다. 환불을 진행해주세요.' : '검수 반려되었습니다',
  });
});

/**
 * PUT /:id/refund — 환불 처리
 * Calls tossCancelPayment, restores stock, updates status
 */
returnsRoutes.put('/:id/refund', rateLimit({ action: 'refund', max: 3, windowSec: 3600 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'seller') return c.json({ success: false, error: 'forbidden' }, 403);
  const sellerId = Number(user.id);

  const { DB } = c.env;
  await ensureTable(DB);

  const returnId = c.req.param('id');

  const returnRecord = await DB.prepare(
    'SELECT id, order_id, user_id, seller_id, status, refund_amount, reason FROM returns WHERE id = ?'
  ).bind(returnId).first<{
    id: number; order_id: number; user_id: string; seller_id: number | null; status: string; refund_amount: number; reason: string;
  }>();

  if (!returnRecord) {
    return c.json({ success: false, error: '반품 내역을 찾을 수 없습니다' }, 404);
  }

  if (returnRecord.seller_id !== sellerId) {
    return c.json({ success: false, error: 'forbidden' }, 403);
  }

  if (returnRecord.status !== 'inspected') {
    return c.json({ success: false, error: '검수 완료된 반품만 환불 처리할 수 있습니다' }, 400);
  }

  // ── Voucher used-state check ──
  // 식사권 등 이미 사용된 바우처가 포함된 주문은 환불 불가
  try {
    const usedVouchers = await DB.prepare(
      "SELECT COUNT(*) as n FROM vouchers WHERE order_id = ? AND status = 'used'"
    ).bind(returnRecord.order_id).first<{ n: number }>();

    if (usedVouchers && usedVouchers.n > 0) {
      return c.json({
        success: false,
        error: `이미 사용된 식사권이 ${usedVouchers.n}개 있어 환불할 수 없습니다. 고객센터에 문의해주세요.`,
      }, 400);
    }
  } catch { /* vouchers table may not exist */ }

  // 1. 주문에서 payment_key 조회
  const order = await DB.prepare(
    'SELECT id, toss_payment_key, payment_key, total_amount FROM orders WHERE id = ?'
  ).bind(returnRecord.order_id).first<{
    id: number;
    toss_payment_key: string | null;
    payment_key: string | null;
    total_amount: number | null;
  }>();

  if (!order) {
    return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);
  }

  const paymentKey = order.toss_payment_key || order.payment_key;
  const orderAmount = order.total_amount || 0;

  if (returnRecord.refund_amount > orderAmount) {
    return c.json({ success: false, error: '환불 금액이 주문 금액을 초과합니다' }, 400);
  }

  // 2. Toss 결제 취소 (payment_key가 있는 경우만)
  if (paymentKey) {
    const cancelResult = await tossCancelPayment(
      paymentKey,
      c.env.TOSS_SECRET_KEY,
      `반품 환불: ${returnRecord.reason}`,
      returnRecord.refund_amount || undefined,
    );

    if (!cancelResult.success) {
      return c.json({
        success: false,
        error: `환불 처리 실패: ${'message' in cancelResult ? cancelResult.message : '알 수 없는 오류'}`,
      }, 500);
    }
  }

  // 4. 주문 상태 업데이트 (state machine CAS) — 이미 REFUNDED인 경우 false
  //    중복 승인 시 이중 복구/이중 환불을 차단하기 위해 transition 성공 시에만 재고 복구.
  const { transitionOrderStatus } = await import('../../../worker/utils/state-machine');
  const transitioned = await transitionOrderStatus(DB, returnRecord.order_id, 'REFUNDED', {
    extraSets: {
      refund_status: 'completed',
      refunded_at: new Date().toISOString(),
    },
  });

  if (!transitioned) {
    // 이미 REFUNDED 등 — return 테이블 상태만 최신화하고 조용히 성공 반환
    await DB.prepare(`UPDATE returns SET status = 'refunded', refunded_at = datetime('now') WHERE id = ?`)
      .bind(returnId).run();
    return c.json({ success: true, message: '이미 환불 처리된 주문입니다' });
  }

  // 3. 재고 복구 — transition이 성공한 경우에만 실행 (이중 복구 방지)
  try {
    const items = await DB.prepare(
      "SELECT product_id, quantity FROM order_items WHERE order_id = ? AND (status IS NULL OR status != 'CANCELLED')"
    ).bind(returnRecord.order_id).all<{ product_id: number; quantity: number }>();

    if (items.results && items.results.length > 0) {
      await DB.batch(
        items.results.map((item) =>
          DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
            .bind(item.quantity, item.product_id)
        )
      );
      await DB.prepare("UPDATE order_items SET status = 'CANCELLED' WHERE order_id = ?")
        .bind(returnRecord.order_id).run().catch(() => {});
    }
  } catch (err) {
    logError('returns.refund.stockRestoreFailed', { error: (err as Error)?.message });
  }

  // 5. 반품 상태 업데이트
  await DB.prepare(`
    UPDATE returns SET status = 'refunded', refunded_at = datetime('now') WHERE id = ?
  `).bind(returnId).run();

  // ── Reverse referral / affiliate commissions tied to this order ──
  // Best-effort: never block the refund if ledger updates fail.
  try {
    const commissions = await DB.prepare(
      "SELECT beneficiary_id, commission_amount FROM referral_commissions WHERE order_id = ? AND status = 'granted'"
    ).bind(returnRecord.order_id).all<{ beneficiary_id: string; commission_amount: number }>();

    if (commissions.results && commissions.results.length > 0) {
      for (const row of commissions.results) {
        await DB.prepare(
          "UPDATE user_points SET balance = MAX(0, balance - ?), updated_at = datetime('now') WHERE user_id = ?"
        ).bind(row.commission_amount, row.beneficiary_id).run().catch(() => {});
      }

      await DB.prepare(
        "UPDATE referral_commissions SET status = 'withdrawn' WHERE order_id = ? AND status = 'granted'"
      ).bind(returnRecord.order_id).run().catch(() => {});
    }
  } catch { /* ledger may not exist */ }

  try {
    const aff = await DB.prepare(
      "SELECT referrer_id, commission FROM affiliate_earnings WHERE order_id = ? AND status = 'granted'"
    ).bind(returnRecord.order_id).all<{ referrer_id: string; commission: number }>();

    if (aff.results && aff.results.length > 0) {
      for (const row of aff.results) {
        await DB.prepare(
          "UPDATE user_points SET balance = MAX(0, balance - ?), updated_at = datetime('now') WHERE user_id = ?"
        ).bind(row.commission, row.referrer_id).run().catch(() => {});
      }
      await DB.prepare(
        "UPDATE affiliate_earnings SET status = 'refunded' WHERE order_id = ? AND status = 'granted'"
      ).bind(returnRecord.order_id).run().catch(() => {});
    }
  } catch { /* table may not exist */ }

  // ── Settlement adjustment (restaurant vouchers) ──
  // If this order was already rolled into a completed settlement, record a clawback
  // and alert ops so finance can reconcile manually.
  try {
    const settlement = await DB.prepare(
      "SELECT id FROM restaurant_settlements WHERE id IN (SELECT settlement_id FROM vouchers WHERE order_id = ? AND settlement_id IS NOT NULL) AND status = 'completed'"
    ).bind(returnRecord.order_id).first<{ id: number }>();

    if (settlement) {
      // Ensure adjustments table exists (idempotent)
      await DB.prepare(`
        CREATE TABLE IF NOT EXISTS settlement_adjustments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          settlement_id INTEGER NOT NULL,
          order_id INTEGER,
          amount INTEGER NOT NULL,
          reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run().catch(() => {});

      await DB.prepare(
        "INSERT INTO settlement_adjustments (settlement_id, order_id, amount, reason) VALUES (?, ?, ?, ?)"
      ).bind(
        settlement.id,
        returnRecord.order_id,
        -(returnRecord.refund_amount || 0),
        'refund'
      ).run().catch(() => {});

      try {
        const { sendAlert } = await import('../../../worker/utils/alerts');
        await sendAlert(c.env, {
          severity: 'warn',
          title: 'Settlement clawback: refund after completed settlement',
          message: `Order ${returnRecord.order_id} refunded after settlement ${settlement.id} was completed. Manual reconciliation required.`,
          context: {
            order_id: returnRecord.order_id,
            settlement_id: settlement.id,
            refund_amount: returnRecord.refund_amount,
          },
        });
      } catch { /* alert failure is non-fatal */ }
    }
  } catch { /* table may not exist */ }

  // 6. 소비자에게 환불 완료 알림
  try {
    const { notifyUser } = await import('../../../lib/notifications');
    notifyUser(DB, returnRecord.user_id, 'refund_complete', '💰 환불 완료', `${returnRecord.refund_amount?.toLocaleString()}원이 환불되었습니다`, '/my-orders').catch(() => {});
  } catch {}

  return c.json({ success: true, message: '환불이 완료되었습니다' });
});

export { returnsRoutes };
