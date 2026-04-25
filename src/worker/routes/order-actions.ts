import { Hono } from 'hono';
import { z } from 'zod';
import { rateLimit } from '../middleware/rate-limit';
import type { Env } from '../types/env';
import { OrderRepository } from '../repositories/order.repository';
import { ProductRepository } from '../repositories/product.repository';
import { QueryBuilder } from '../repositories/query-builder';
import { requireAuth, type AuthUser } from '../middleware/auth';
import { calculateShippingFee, generateId } from '../../shared/utils';
import type { CreateOrderRequest } from '../../shared/types';
import { tossCancelPayment } from '../utils/toss-payments';
import { createDashboardNotification } from '../../features/notifications/api/dashboard-notifications.routes';
import { getUserDbId, type AuthVariables } from './order-helpers';
import { logError, logWarn } from '../utils/logger';

export const orderActionsRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// POST /api/orders/refund  ← useOrder.ts에서 호출
// 환불 요청: Toss Cancel API 호출 후 DB 상태 CANCELLED + 재고 복구
orderActionsRouter.post('/refund', rateLimit({ action: 'order_refund', max: 5, windowSec: 3600 }), async (c) => {
  try {
    const firebaseUid = String(c.get('user').id);
    const userId = await getUserDbId(c.env.DB, firebaseUid);
    const body = await c.req.json<{
      order_id: string;
      reason: string;
      refund_amount?: number;
    }>();

    if (!body.order_id || !body.reason) {
      return c.json({ success: false, error: 'order_id, reason 필드가 필요합니다' }, 400);
    }

    const orderRepo = new OrderRepository(c.env.DB);
    const order = await orderRepo.findById(body.order_id);

    if (!order) {
      return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);
    }

    if (order.user_id !== userId) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const refundableStatuses = ['PAID', 'DONE', 'DELIVERED'];
    if (!refundableStatuses.includes(order.status)) {
      return c.json({
        success: false,
        error: `현재 상태(${order.status})에서는 환불 요청할 수 없습니다`,
      }, 400);
    }

    // 🛡️ 2026-04-22: payment_status 추가 검증 — 결제 미완료 주문 환불 차단
    // status 가 PAID 여도 payment_status 가 pending/failed 이면 Toss 호출 시 404/inconsistent → DB 오염.
    const payStatus = order.payment_status;
    if (payStatus && payStatus !== 'approved') {
      return c.json({
        success: false,
        error: `결제가 완료되지 않은 주문입니다 (payment_status: ${payStatus})`,
      }, 400);
    }

    // Toss 결제 취소 API 호출 (실제 환불)
    const payInfo = await orderRepo.getPaymentInfo(body.order_id);
    const paymentKey = payInfo?.toss_payment_key;

    if (!paymentKey) {
      return c.json({
        success: false,
        error: '결제 키를 찾을 수 없습니다. 고객센터에 문의해 주세요.',
        code: 'PAYMENT_KEY_MISSING',
      }, 422);
    }

    const tossSecretKey = c.env.TOSS_SECRET_KEY;
    if (!tossSecretKey) {
      return c.json({ success: false, error: 'Payment service unavailable' }, 503);
    }

    // 🛡️ 2026-04-22: Toss 호출 전 CAS 로 refunded_amount 예약 — 동시 환불 race 차단
    // 이전: Toss 먼저 호출 → DB 업데이트. 동시 2건 요청 시 양쪽 다 Toss 성공 후 합이 total 초과 가능.
    // 수정: CAS 로 DB 에 먼저 기록 (total_amount 초과 불가). Toss 실패 시 롤백.
    const refundAmount = body.refund_amount && body.refund_amount > 0 ? Math.round(body.refund_amount) : order.total_amount;
    if (refundAmount <= 0 || refundAmount > order.total_amount) {
      return c.json({ success: false, error: '환불 금액이 유효하지 않습니다' }, 400);
    }

    // CAS: refunded_amount + refund_amount <= total_amount 일 때만 업데이트
    const reserveResult = await c.env.DB.prepare(
      "UPDATE orders SET refunded_amount = COALESCE(refunded_amount, 0) + ? WHERE id = ? AND COALESCE(refunded_amount, 0) + ? <= total_amount"
    ).bind(refundAmount, body.order_id, refundAmount).run().catch(() => null);

    if (!reserveResult || (reserveResult.meta?.changes ?? 0) === 0) {
      return c.json({ success: false, error: '환불 가능 금액을 초과하거나 이미 처리 중입니다' }, 409);
    }

    const tossResult = await tossCancelPayment(
      paymentKey,
      tossSecretKey,
      `[환불요청] ${body.reason}`,
      body.refund_amount,
    );

    if (!tossResult.success) {
      // 🛡️ Toss 실패 시 예약한 refunded_amount 롤백
      await c.env.DB.prepare(
        "UPDATE orders SET refunded_amount = MAX(0, COALESCE(refunded_amount, 0) - ?) WHERE id = ?"
      ).bind(refundAmount, body.order_id).run().catch((e) => { logError('orders.refund.rollback_failed', { error: (e as Error)?.message, orderId: body.order_id }) });

      const tossErrorMessages: Record<string, string> = {
        ALREADY_CANCELED_PAYMENT: '이미 취소된 결제입니다',
        EXCEED_CANCEL_AMOUNT: '환불 금액이 결제 금액을 초과합니다',
        NOT_CANCELABLE_PAYMENT: '취소할 수 없는 결제입니다',
      };
      return c.json({
        success: false,
        error: tossErrorMessages[tossResult.code] ?? `환불 처리 실패: ${tossResult.message}`,
        code: tossResult.code,
      }, 422);
    }

    // DB 상태 업데이트 + 재고 복구
    await orderRepo.updateStatusById(body.order_id, 'CANCELLED', {
      cancel_reason: `[환불요청] ${body.reason}`,
      cancelled_at: new Date().toISOString(),
    });
    await orderRepo.restoreStock(body.order_id);

    // ✅ 환불 시 추천 커미션도 회수 (webhook path 동등화)
    // 🛡️ 2026-04-22: CAS 로 이중 회수 방어 — 이미 withdrawn 인 커미션은 포인트 재차감 안 됨.
    // 기존 버그: UPDATE 이후 SELECT WHERE status='withdrawn' 하면 과거 회수분까지 포함 → 중복 차감.
    // 수정: UPDATE 시점에 회수된 row 만 RETURNING-style 로 조회 (updated_at 범위로 필터).
    try {
      const revokeTs = new Date().toISOString();
      // 먼저 granted 인 commission 을 읽고 CAS 로 withdrawn 전환
      const toRevoke = await c.env.DB.prepare(
        "SELECT id, user_id, amount FROM referral_commissions WHERE order_id = ? AND status = 'granted'"
      ).bind(body.order_id).all<{ id: number; user_id: string; amount: number }>().catch(() => ({ results: [] as Array<{ id: number; user_id: string; amount: number }> }));

      for (const co of (toRevoke.results || [])) {
        const cas = await c.env.DB.prepare(
          "UPDATE referral_commissions SET status = 'withdrawn', withdrawn_at = ? WHERE id = ? AND status = 'granted'"
        ).bind(revokeTs, co.id).run().catch(() => null);
        // CAS 성공한 경우에만 포인트 차감 (다른 요청이 이미 처리했으면 skip)
        if (cas && (cas.meta?.changes ?? 0) > 0) {
          await c.env.DB.prepare(
            'UPDATE user_points SET balance = MAX(0, balance - ?) WHERE user_id = ?'
          ).bind(co.amount, co.user_id).run().catch(() => {});
        }
      }
    } catch (e) {
      logWarn('orders.refund.commission_reversal_failed', { error: (e as Error)?.message });
    }

    // 🛡️ 2026-04-22: 딜 포인트로 결제한 주문은 환불 금액만큼 포인트 환급
    try {
      const payMethod = order.payment_method;
      if (payMethod === 'deal_points' && refundAmount > 0) {
        await c.env.DB.prepare(
          'UPDATE user_points SET balance = balance + ? WHERE user_id = ?'
        ).bind(refundAmount, String(order.user_id)).run();
        await c.env.DB.prepare(
          "INSERT INTO point_transactions (user_id, type, amount, points_amount, description) VALUES (?, 'refund', ?, ?, ?)"
        ).bind(String(order.user_id), refundAmount, refundAmount, `[환불] 주문 환불 (order:${order.order_number || body.order_id})`).run().catch(() => {});
      }
    } catch (e) {
      logError('orders.refund.points_failed', { error: (e as Error)?.message });
    }

    // 유저에게 인앱 알림 (환불/주문 취소)
    try {
      const { notifyUser } = await import('../../lib/notifications');
      await notifyUser(c.env.DB, String(order.user_id), 'order_status', '\u274C 주문이 취소되었습니다.', `주문번호: ${order.order_number || body.order_id}`, '/my-orders');
    } catch {} // fire and forget

    const latestCancel = tossResult.data.cancels[tossResult.data.cancels.length - 1];

    return c.json({
      success: true,
      message: '환불이 처리되었습니다. 3~5 영업일 내 반환됩니다.',
      data: {
        order_id: body.order_id,
        cancel_amount: latestCancel?.cancelAmount ?? order.total_amount,
        cancelled_at: latestCancel?.canceledAt ?? new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[ORDERS] Refund error:', err);
    return c.json({ success: false, error: '환불 요청 처리에 실패했습니다' }, 500);
  }
});


// POST /api/orders/:id/cancel
orderActionsRouter.post('/:id/cancel', rateLimit({ action: 'order_cancel', max: 10, windowSec: 3600 }), async (c) => {
  try {
    const firebaseUid = String(c.get('user').id);
    const userId = await getUserDbId(c.env.DB, firebaseUid);
    const orderId = c.req.param('id')!;
    const body = await c.req.json<{ reason?: string; cancel_amount?: number }>();
    const reason = body.reason ?? '고객 요청';
    const cancelAmount = body.cancel_amount;

    const orderRepo = new OrderRepository(c.env.DB);

    const order = await orderRepo.findById(orderId);
    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    // ── 2. 권한 확인 ──────────────────────────────────────────
    if (order.user_id !== userId && c.get('user').type !== 'admin') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    // ── 3. 취소 가능 상태 검증 ────────────────────────────────
    const cancellableStatuses = ['PENDING', 'AWAITING_PAYMENT', 'PAID', 'DONE'];
    if (!cancellableStatuses.includes(order.status)) {
      return c.json({
        success: false,
        error: `현재 상태(${order.status})에서는 취소할 수 없습니다`,
      }, 400);
    }

    // ── 3-1. v26 CRITICAL: 부분 취소 금액 서버 검증 ────────────
    // 클라이언트 값 신뢰 금지 — Toss API 호출 전 반드시 범위 클램프
    if (cancelAmount !== undefined) {
      if (!Number.isFinite(cancelAmount) || !Number.isInteger(cancelAmount) || cancelAmount <= 0) {
        return c.json({ success: false, error: '유효한 취소 금액을 입력해주세요 (1원 이상 정수)' }, 400);
      }
      const alreadyRefunded = Number(order.refunded_amount ?? 0);
      const remaining = Number(order.total_amount ?? 0) - alreadyRefunded;
      if (cancelAmount > remaining) {
        return c.json({
          success: false,
          error: `취소 가능 금액을 초과합니다 (최대 ${remaining.toLocaleString()}원)`,
        }, 400);
      }
    }

    // ── 4. 결제 취소 (Toss Payments) ─────────────────────────
    // PAID / DONE 상태: 실제 결제가 이루어졌으므로 Toss Cancel API 호출
    const paymentMadeStatuses = ['PAID', 'DONE'];
    if (paymentMadeStatuses.includes(order.status)) {
      // toss_payment_key가 있어야 취소 가능
      const payInfo = await orderRepo.getPaymentInfo(orderId);
      const paymentKey = payInfo?.toss_payment_key;

      if (!paymentKey) {
        // payment key 없으면 이상 상태 — 취소 불가 처리
        return c.json({
          success: false,
          error: '결제 키를 찾을 수 없습니다. 고객센터에 문의해 주세요.',
          code: 'PAYMENT_KEY_MISSING',
        }, 422);
      }

      const tossSecretKey = c.env.TOSS_SECRET_KEY;
      if (!tossSecretKey) {
        logError('orders.cancel.toss_key_missing');
        return c.json({ success: false, error: 'Payment service unavailable' }, 503);
      }

      const tossResult = await tossCancelPayment(
        paymentKey,
        tossSecretKey,
        reason,
        cancelAmount,
      );

      if (!tossResult.success) {
        // Toss에서 취소 거부 → DB 상태는 변경하지 않고 오류 반환
        logError('orders.cancel.toss_failed', { code: tossResult.code, message: tossResult.message });

        // Toss 에러 코드에 따른 한국어 메시지 매핑
        const tossErrorMessages: Record<string, string> = {
          CANCEL_FAILED: '결제 취소 처리 중 오류가 발생했습니다',
          ALREADY_CANCELED_PAYMENT: '이미 취소된 결제입니다',
          EXCEED_CANCEL_AMOUNT: '취소 금액이 결제 금액을 초과합니다',
          INVALID_CANCEL_AMOUNT: '취소 금액이 유효하지 않습니다',
          NOT_CANCELABLE_PAYMENT: '취소할 수 없는 결제입니다',
          NOT_CANCELABLE_AMOUNT: '취소 불가능한 금액입니다',
          FORBIDDEN_CONSECUTIVE_REQUEST: '잠시 후 다시 시도해 주세요',
        };

        const userMessage = tossErrorMessages[tossResult.code]
          ?? `결제 취소 실패: ${tossResult.message}`;

        return c.json({
          success: false,
          error: userMessage,
          code: tossResult.code,
        }, 422);
      }

      // Toss 취소 성공 → DB 업데이트 (원자적 배치)
      await orderRepo.updateStatusById(orderId, 'CANCELLED', {
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason,
      });

      // 재고 복구
      await orderRepo.restoreStock(orderId);

      // ✅ 추천 커미션 회수 (cancel paid 경로)
      // 🛡️ 2026-04-22: CAS 로 이중 회수 방어 (refund 와 동일 패턴)
      try {
        const toRevoke = await c.env.DB.prepare(
          "SELECT id, user_id, amount FROM referral_commissions WHERE order_id = ? AND status = 'granted'"
        ).bind(orderId).all<{ id: number; user_id: string; amount: number }>().catch(() => ({ results: [] as Array<{ id: number; user_id: string; amount: number }> }));

        for (const co of (toRevoke.results || [])) {
          const cas = await c.env.DB.prepare(
            "UPDATE referral_commissions SET status = 'withdrawn', withdrawn_at = datetime('now') WHERE id = ? AND status = 'granted'"
          ).bind(co.id).run().catch(() => null);
          if (cas && (cas.meta?.changes ?? 0) > 0) {
            await c.env.DB.prepare(
              'UPDATE user_points SET balance = MAX(0, balance - ?) WHERE user_id = ?'
            ).bind(co.amount, co.user_id).run().catch((err) => {
              logError('orders.cancel.points_debit_failed', { error: (err as Error)?.message });
            });
          }
        }
      } catch (e) {
        logError('orders.cancel.commission_reversal_failed', { error: (e as Error)?.message });
      }

      // 🛡️ 2026-04-22: 딜 포인트로 결제한 주문은 포인트 환급 (payment_method='deal_points')
      try {
        const payMethod = order.payment_method;
        if (payMethod === 'deal_points') {
          const refundPoints = cancelAmount ?? Number(order.total_amount ?? 0);
          if (refundPoints > 0) {
            await c.env.DB.prepare(
              'UPDATE user_points SET balance = balance + ? WHERE user_id = ?'
            ).bind(refundPoints, String(order.user_id)).run();
            await c.env.DB.prepare(
              "INSERT INTO point_transactions (user_id, type, amount, points_amount, description) VALUES (?, 'refund', ?, ?, ?)"
            ).bind(String(order.user_id), refundPoints, refundPoints, `[환불] 주문 취소 (order:${order.order_number})`).run().catch(() => {});
          }
        }
      } catch (e) {
        logError('orders.cancel.points_failed', { error: (e as Error)?.message });
      }

      // 주문 취소 알림
      createDashboardNotification(c.env.DB, 'admin', null, 'order_cancelled', '주문 취소', `주문번호: ${order.order_number}`, '/admin/orders').catch(() => {});
      if (order.seller_id) {
        createDashboardNotification(c.env.DB, 'seller', String(order.seller_id), 'order_cancelled', '주문 취소', `주문번호: ${order.order_number}`, '/seller/orders').catch(() => {});
      }

      // 유저에게 인앱 알림 (주문 취소)
      try {
        const { notifyUser } = await import('../../lib/notifications');
        await notifyUser(c.env.DB, String(order.user_id), 'order_status', '\u274C 주문이 취소되었습니다.', `주문번호: ${order.order_number}`, '/my-orders');
      } catch {} // fire and forget

      const latestCancel = tossResult.data.cancels[tossResult.data.cancels.length - 1];

      if (import.meta.env.DEV) console.info('[ORDERS] Cancel success (paid):', {
        orderId,
        paymentKey,
        cancelAmount: latestCancel?.cancelAmount,
        tossStatus: tossResult.data.status,
      });

      return c.json({
        success: true,
        message: '주문 및 결제가 취소되었습니다',
        data: {
          order_id: orderId,
          cancel_amount: latestCancel?.cancelAmount ?? order.total_amount,
          cancelled_at: latestCancel?.canceledAt ?? new Date().toISOString(),
          toss_status: tossResult.data.status,
        },
      });
    }

    // ── 5. 미결제 주문 취소 (PENDING / AWAITING_PAYMENT) ─────
    // 결제가 일어나지 않았으므로 Toss API 불필요
    await orderRepo.updateStatusById(orderId, 'CANCELLED', {
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
    });

    // 주문 취소 알림
    createDashboardNotification(c.env.DB, 'admin', null, 'order_cancelled', '주문 취소', `주문번호: ${order.order_number}`, '/admin/orders').catch(() => {});
    if (order.seller_id) {
      createDashboardNotification(c.env.DB, 'seller', String(order.seller_id), 'order_cancelled', '주문 취소', `주문번호: ${order.order_number}`, '/seller/orders').catch(() => {});
    }

    // 유저에게 인앱 알림 (주문 취소)
    try {
      const { notifyUser } = await import('../../lib/notifications');
      await notifyUser(c.env.DB, String(order.user_id), 'order_status', '\u274C 주문이 취소되었습니다.', `주문번호: ${order.order_number}`, '/my-orders');
    } catch {} // fire and forget

    if (import.meta.env.DEV) console.info('[ORDERS] Cancel success (unpaid):', { orderId, status: order.status });

    return c.json({
      success: true,
      message: '주문이 취소되었습니다',
      data: {
        order_id: orderId,
        cancel_amount: 0,
        cancelled_at: new Date().toISOString(),
      },
    });

  } catch (err) {
    logError('orders.cancel.error', { error: (err as Error)?.message });
    return c.json({ success: false, error: 'Failed to cancel order' }, 500);
  }
});

