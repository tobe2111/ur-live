// ============================================================
// Payment Routes
// POST /api/payments/confirm          - Confirm payment (client redirect)
// POST /api/payments/webhook          - Toss webhook (server-side)
// POST /api/payments/checkout-session - Create checkout session
// ============================================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { OrderRepository } from '../repositories/order.repository';
import { requireAuth, type AuthUser } from '../middleware/auth';
import { webhookRouter } from './webhook.routes';
import { TOSS_PAYMENT_URL } from '../../shared/constants';
import { sendSellerAlimtalk } from '../../features/alimtalk/send';
import { swallow } from '../utils/swallow';
import { buildOrderConfirmMessage } from '../../features/alimtalk/aligo';
import { captureException } from '../utils/sentry';
import { adjustUserPoints } from '../utils/point-ledger';
import { withCircuitBreaker } from '../utils/circuit-breaker';
import { logInfo, logError, logWarn } from '../utils/logger';
import { sendAlert } from '../utils/alerts';

// AuthVariables compatible with auth.ts AuthUser
type AuthVariables = { user: AuthUser };

// 🛡️ 2026-05-24: SSOT — Toss V2 docs 사양 완전 일치 (100+ 코드 cover).
//   ref: src/worker/utils/toss-error-messages.ts
import { getTossErrorMessage } from '../utils/toss-error-messages';

const paymentsRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// ---- Webhook (PUBLIC - no auth needed, signature-protected) ----
paymentsRouter.route('/webhook', webhookRouter);

// Apply Firebase+JWT auth to protected endpoints
paymentsRouter.use('/confirm', requireAuth());
paymentsRouter.use('/checkout-session', requireAuth());

const confirmSchema = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(6).max(64).regex(/^[a-zA-Z0-9\-_]+$/, 'Invalid orderId format'),
  amount: z.number().int().positive(),
});

/**
 * POST /api/payments/confirm
 * Called after client-side Toss widget completes payment.
 * 토스페이먼츠 결제 승인 API를 호출하여 결제를 확정합니다.
 *
 * 플로우:
 * 1. orderId로 DB 주문 조회 + 소유자 검증
 * 2. DB 저장 금액과 클라이언트 금액 비교 (금액 변조 방지)
 * 3. 토스 결제 승인 API 호출 (Idempotency-Key = paymentKey)
 * 4. 주문 상태 DONE 전환 + 재고 차감
 */
paymentsRouter.post('/confirm', async (c) => {
  try {
    const rawId = String(c.get('user').id);
    // 숫자 ID면 바로 사용 (세션 쿠키), 아니면 firebase_uid로 DB 조회
    let userId = rawId;
    const numId = parseInt(rawId);
    if (isNaN(numId) || String(numId) !== rawId) {
      try {
        const row = await c.env.DB.prepare('SELECT id FROM users WHERE firebase_uid = ? LIMIT 1')
          .bind(rawId).first<{ id: string | number }>();
        if (row?.id != null) userId = String(row.id);
      } catch {
        // firebase_uid 컬럼 없는 스키마 → 그대로 사용
      }
    }

    const body = await c.req.json();
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ success: false, error: 'Invalid request', details: parsed.error.flatten() }, 400);
    }

    const { paymentKey, orderId: orderNumber, amount } = parsed.data;

    const orderRepo = new OrderRepository(c.env.DB);
    const orders = await orderRepo.findByOrderNumber(orderNumber);

    if (orders.length === 0) {
      return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);
    }

    // 이미 결제 완료된 주문인 경우 중복 승인 방지
    const alreadyDone = orders.every(o => o.status === 'DONE' || o.status === 'PAID');
    if (alreadyDone) {
      return c.json({ success: true, data: { orders } });
    }

    // 🛡️ 2026-05-19: deal_only=1 상품은 Toss(카드) 결제 차단 — 클라이언트 우회 방어.
    //   해당 상품은 /api/points/pay (딜 교환) 만 사용 가능.
    const orderIds = orders.map(o => o.id).filter((id) => id != null && typeof id === 'number') as number[]
    if (orderIds.length > 0) {
      const ph = orderIds.map(() => '?').join(',')
      const dealOnly = await c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM order_items oi
           INNER JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id IN (${ph}) AND p.deal_only = 1`
      ).bind(...orderIds).first<{ cnt: number }>().catch(() => null)
      if (dealOnly && dealOnly.cnt > 0) {
        return c.json({
          success: false,
          error: '딜 교환 전용 상품 — 카드 결제 불가. 딜 결제를 이용해주세요.',
          code: 'DEAL_ONLY_PRODUCT',
        }, 400);
      }
    }

    // ✅ SECURITY FIX (Payment C4): Reject confirm when any order is already
    // cancelled/refunded/failed. Without this guard an attacker who cancelled
    // an order could still re-confirm it on Toss after the fact and bypass
    // the refund path.
    const forbidden = orders.filter(o =>
      ['CANCELLED', 'REFUNDED', 'FAILED'].includes((o.status || '').toUpperCase())
    );
    if (forbidden.length > 0) {
      return c.json({ success: false, error: '이미 취소/환불된 주문입니다.' }, 409);
    }

    // Security: verify user owns these orders (타입 안전 비교: DB는 INTEGER, auth는 STRING)
    const unauthorized = orders.find(o => String(o.user_id) !== String(userId));
    if (unauthorized) {
      console.error('[PAYMENTS] User mismatch — order ownership validation failed');
      // 🚨 fraud signal — Sentry 보고
      captureException(new Error('PAYMENT_USER_MISMATCH'), {
        tags: { area: 'payment', kind: 'user_mismatch', severity: 'warning' },
        extra: { authUserId: userId, orderUserId: unauthorized.user_id, orderNumber },
      }).catch(swallow('payment:sentry-user-mismatch'));
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    // DB에 저장된 금액으로 검증 (금액 변조 방지)
    // 🛡️ 2026-05-24: 진단 강화 — 실제 mismatch 시 server 가 본 값 / client 가 보낸 값 / 각 order 의
    //   total_amount 를 응답에 포함 (admin 디버깅용). production 에서는 _debug 표시 무방
    //   (사용자가 직접 조작할 수 없는 server-side 계산값이므로 보안 영향 X).
    const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);
    if (totalAmount !== amount) {
      const orderBreakdown = orders.map(o => ({ id: o.id, num: o.order_number, total: o.total_amount, status: o.status }));
      console.error('[PAYMENTS] Amount mismatch', { expected: totalAmount, received: amount, orderNumber, orders: orderBreakdown });
      captureException(new Error('PAYMENT_AMOUNT_MISMATCH'), {
        tags: { area: 'payment', kind: 'amount_mismatch', severity: 'warning' },
        extra: { expected: totalAmount, received: amount, orderNumber, userId, orderBreakdown },
      }).catch(swallow('payment:sentry-amount-mismatch'));
      return c.json({
        success: false,
        error: '결제 금액이 일치하지 않습니다',
        code: 'AMOUNT_MISMATCH',
        _debug: {
          db_total: totalAmount,
          client_amount: amount,
          diff: amount - totalAmount,
          orders: orderBreakdown,
          hint: orders.length > 1
            ? '같은 order_number 의 여러 row 가 SUM. seller 별로 order 가 분리됐을 수 있음. CheckoutPage 가 각 seller 마다 같은 discount 를 전송 → 각 order 의 total_amount 가 클라이언트 SUM 과 불일치.'
            : '단일 order 의 total_amount 와 client amount 가 다름. 쿠폰/딜 차감이 server-side 에서 다르게 적용됐을 가능성. /api/orders POST 시 discount_amount 가 정확한지 확인.',
        },
      }, 400);
    }

    // Call Toss Payments API to confirm
    const tossSecretKey = c.env.TOSS_SECRET_KEY;
    if (!tossSecretKey) {
      return c.json({ success: false, error: 'Payment configuration error' }, 500);
    }

    // 🛡️ 2026-06-04 [UNLOCK] (사용자 승인): 숙소 — Toss 승인 *전* 달력 예약(reserve-before-charge).
    //   기존: Toss 승인 후 달력 차감 → 오버부킹이면 자동환불. 그러나 '자동환불 실패' 시 '청구만 되고
    //   방은 반환' 불일치 잔여. 근본 수정: 방을 먼저 잡고(못 잡으면 청구 자체 안 함) Toss 승인.
    //   동시 confirm 이중차감은 booking status CAS(pending→confirmed)로 차단(이 thread 만 예약).
    //   ⚠️ Toss 금액검증/confirmTossPayment helper/client-key 미변경 — 달력 side-effect 순서만 이동.
    const stayReserved: Array<{ bookingId: number; roomId: number; prevStatus: string; dates: string[] }> = [];
    const releaseStays = async () => {
      // 🛡️ 2026-06-11 [UNLOCK]: 예약 해제도 단일 batch (복원 누락 부분실패 방지 + 왕복 1회).
      const stmts = stayReserved.flatMap(r => [
        ...r.dates.map(ds =>
          c.env.DB.prepare(
            `UPDATE product_stay_calendar SET available_count = available_count + 1, updated_at = datetime('now') WHERE room_id = ? AND stay_date = ?`
          ).bind(r.roomId, ds)
        ),
        c.env.DB.prepare(`UPDATE stay_bookings SET status = ?, updated_at = datetime('now') WHERE id = ?`)
          .bind(r.prevStatus, r.bookingId),
      ]);
      if (stmts.length > 0) await c.env.DB.batch(stmts).catch(() => { /* noop */ });
    };
    for (const order of orders) {
      const stayBookingId = (order as unknown as { stay_booking_id?: number | null }).stay_booking_id;
      if (!stayBookingId) continue;
      const booking = await c.env.DB.prepare(
        `SELECT id, product_id, room_id, check_in_date, check_out_date, status FROM stay_bookings WHERE id = ?`
      ).bind(stayBookingId).first<{ id: number; product_id: number; room_id: number; check_in_date: string; check_out_date: string; status: string }>().catch(() => null);
      if (!booking || booking.status === 'confirmed') continue; // 재confirm 멱등 — 이미 확정분 skip
      // CAS: 이 thread 만 예약 진행(동시 confirm 이중 예약/차감 차단).
      const bClaim = await c.env.DB.prepare(
        `UPDATE stay_bookings SET status = 'confirmed', updated_at = datetime('now') WHERE id = ? AND status = 'pending'`
      ).bind(stayBookingId).run().catch(() => null);
      if (!bClaim || (bClaim.meta?.changes ?? 0) === 0) continue; // 다른 thread 가 처리 중/완료
      const nights = Math.round((new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) / 86400000);
      // 🛡️ 2026-06-11 [UNLOCK] (사용자 승인): 야간당 2왕복(INSERT+UPDATE) 루프 → 일괄 2왕복 batch.
      //   가드 의미 동일 — UPDATE 의 available_count > 0 조건 + 결과별 meta.changes 검사로
      //   야간별 성공/실패 판정. 실패 야간 발견 시 성공분 전체 롤백(기존: 첫 실패에서 break 후
      //   성공분 롤백 — 최종 상태 동일). Toss 금액검증/confirmTossPayment/순서(승인 전 예약) 불변.
      const dateList: string[] = [];
      for (let i = 0; i < nights; i++) {
        dateList.push(new Date(new Date(booking.check_in_date).getTime() + i * 86400000).toISOString().slice(0, 10));
      }
      let secured: string[] = [];
      let overbooked = false;
      if (dateList.length > 0) {
        await c.env.DB.batch(dateList.map(ds =>
          c.env.DB.prepare(
            `INSERT OR IGNORE INTO product_stay_calendar (room_id, product_id, stay_date, available_count)
             SELECT ?, ?, ?, COALESCE((SELECT total_inventory FROM product_stay_rooms WHERE id = ?), 1)`
          ).bind(booking.room_id, booking.product_id, ds, booking.room_id)
        )).catch(() => { /* noop — UPDATE 가드가 최종 판정 */ });
        const decs = await c.env.DB.batch(dateList.map(ds =>
          c.env.DB.prepare(
            `UPDATE product_stay_calendar SET available_count = available_count - 1, updated_at = datetime('now')
              WHERE room_id = ? AND stay_date = ? AND available_count > 0`
          ).bind(booking.room_id, ds)
        )).catch(() => null);
        if (!decs) overbooked = true;
        else {
          secured = dateList.filter((_, i) => ((decs[i]?.meta?.changes ?? 0) > 0));
          if (secured.length < dateList.length) overbooked = true;
        }
      }
      if (overbooked) {
        // 이 booking 성공분 롤백 + booking 되돌림(pending) + 이전 예약 해제 → Toss 청구 전 중단(미회수 0).
        if (secured.length > 0) {
          await c.env.DB.batch(secured.map(ds =>
            c.env.DB.prepare(`UPDATE product_stay_calendar SET available_count = available_count + 1, updated_at = datetime('now') WHERE room_id = ? AND stay_date = ?`)
              .bind(booking.room_id, ds)
          )).catch(() => { /* noop */ });
        }
        await c.env.DB.prepare(`UPDATE stay_bookings SET status = 'pending', updated_at = datetime('now') WHERE id = ?`).bind(stayBookingId).run().catch(() => { /* noop */ });
        await releaseStays();
        logError('payment.stay_overbooked_precharge', { orderId: order.id, stayBookingId, roomId: booking.room_id });
        return c.json({ success: false, error: '선택하신 날짜의 객실이 매진되었습니다. 결제는 진행되지 않았습니다.', code: 'STAY_OVERBOOKED' }, 409);
      }
      stayReserved.push({ bookingId: stayBookingId, roomId: booking.room_id, prevStatus: booking.status, dates: secured });
      await c.env.DB.prepare(
        `INSERT INTO stay_booking_status_log (booking_id, prev_status, new_status, changed_by_role, reason)
         VALUES (?, 'pending', 'confirmed', 'system', '결제 승인 전 객실 예약')`
      ).bind(stayBookingId).run().catch(() => { /* noop */ });
    }

    // 🛡️ 2026-05-22 옵션 B: toss-gateway 헬퍼 사용 — 토스 fetch/idempotency/circuit/에러 표준화 1곳.
    //   주문 결제 — DB 검증된 totalAmount 사용 (defense-in-depth).
    logInfo('toss.confirm.start', { orderId: orderNumber, amount: totalAmount, endpoint: '/api/payments/confirm' });
    const { confirmTossPayment } = await import('../utils/toss-gateway')
    const tossResult = await confirmTossPayment({
      env: { TOSS_SECRET_KEY: tossSecretKey },
      paymentKey,
      orderId: orderNumber,
      amount: totalAmount,
    })

    if (!tossResult.ok) {
      logError('toss.confirm.failed', { orderId: orderNumber, code: tossResult.code, message: tossResult.message });
      // 🛡️ 2026-06-04: 결제 실패 → 미리 잡아둔 숙소 달력/예약 해제(방 반환).
      await releaseStays();
      // Toss 에러 코드 → 사용자 친화 메시지 (TOSS_ERROR_MESSAGES override).
      const friendly = getTossErrorMessage(tossResult.code) ?? tossResult.message
      return c.json(
        { success: false, error: friendly, code: tossResult.code },
        tossResult.status === 'CIRCUIT_OPEN' ? 503 : 400,
      )
    }

    // 🔐 2026-06-11 [UNLOCK] (사용자 승인 — 머니 감사 Med-A): ALREADY_PROCESSED_PAYMENT 분기의
    //   early-return 제거. 기존엔 updateStatus('DONE')만 하고 즉시 반환 → side-effect(reduceStock·
    //   에이전시/영입자/공급자/추천 커미션·KT 교환권 발송) 영구 생략. 정상 동시요청은 아래 CAS 가
    //   처리하므로 이 분기를 타는 유일 케이스가 "Toss 승인 직후 ~ CAS 직전 worker 크래시 → 재시도"
    //   = side-effect 가 한 번도 안 돈 상태. early-return 제거로 아래 confirmClaim CAS 에 위임:
    //   이미 DONE 이면 changes==0 멱등 반환 / 아직 PENDING(크래시) 이면 claim 후 side-effect 복구.
    //   tossResult.data 는 alreadyProcessed 에도 채워짐(toss-gateway:250/263/268) — tossData 안전.
    //   ⚠️ Toss confirm/금액검증/client-key 로직 무수정 — early-return 1블록 제거만.

    // 🛡️ 2026-05-24 docs 일치: TossPaymentObject (response 전체 필드 type 안전).
    //   특히 method 는 한국어 문자열 ('카드', '가상계좌' 등) — orders.payment_method 에 그대로 저장.
    const tossData = tossResult.data;

    // 토스 응답의 금액도 한 번 더 검증
    if (tossData.totalAmount !== totalAmount) {
      logError('toss.confirm.amount_mismatch', { orderId: orderNumber });
    }

    // 🛡️ 2026-07-01 [UNLOCK] (대표 승인 — 결제 전수조사): 가상계좌(무통장입금) 조기확정 방어.
    //   /confirm 은 Toss 응답 status 를 안 보고 무조건 DONE 으로 flip 했음 → 가상계좌는 confirm 시점에
    //   status='WAITING_FOR_DEPOSIT'(입금 전)로 응답하는데 그대로 주문확정·재고차감·딜차감·디지털발급·
    //   KT교환권 발송이 '입금 전에' 실행되는 구조적 위험. Toss 콘솔에서 가상계좌를 켜는 순간 조용히 깨짐.
    //   수정: 입금대기 응답이면 확정하지 않고 AWAITING_PAYMENT 로만 표시 + 모든 side-effect skip →
    //   실제 입금 시 DEPOSIT_CALLBACK webhook(handlePaymentConfirmed)이 완결. 미리 잡은 숙소 예약은
    //   되돌림(미결제 방 홀드 방지 — 위 tossResult 실패 경로와 동일 releaseStays).
    //   ⚠️ WAITING_FOR_DEPOSIT 한정 분기 — 카드/간편결제(DONE) 경로는 byte-불변.
    if (String((tossData as { status?: string }).status || '').toUpperCase() === 'WAITING_FOR_DEPOSIT') {
      await releaseStays();
      await c.env.DB.prepare(
        `UPDATE orders SET status = 'AWAITING_PAYMENT', payment_method = ?, toss_payment_key = ?, toss_order_id = ?, updated_at = datetime('now')
         WHERE order_number = ? AND status NOT IN ('DONE','PAID','CANCELLED','REFUNDED','FAILED')`
      ).bind(tossData.method ?? null, tossData.paymentKey ?? null, orderNumber, orderNumber).run().catch(() => null);
      logInfo('toss.confirm.awaiting_deposit', { orderId: orderNumber, method: tossData.method });
      const pendingOrders = await orderRepo.findByOrderNumber(orderNumber);
      return c.json({ success: true, data: { orders: pendingOrders, payment: tossData }, status: 'AWAITING_PAYMENT' });
    }

    // 🛡️ 2026-05-31 [UNLOCK] (사용자 승인): 동시 /confirm race 가드 (CAS).
    //   기존 read-then-write(alreadyDone SELECT) 는 두 동시요청이 모두 PENDING 을 읽고
    //   둘 다 reduceStock + agency/referral commission 적립 → 재고 2배 차감·커미션 중복.
    //   PENDING→DONE 전이를 원자적 UPDATE 로 claim — changes==0(이미 다른 요청이 처리)이면
    //   side-effect 재실행 없이 멱등 반환. webhook 경로(confirmPaymentAtomic)와 동일 원칙.
    //   (Toss confirm 은 이미 위에서 완료 — 멱등이라 이중과금 없음; 본 가드는 내부 정합용.)
    const confirmClaim = await c.env.DB.prepare(
      `UPDATE orders SET status = 'DONE', updated_at = datetime('now')
       WHERE order_number = ? AND status NOT IN ('DONE','PAID','CANCELLED','REFUNDED','FAILED')`
    ).bind(orderNumber).run().catch(() => null);
    if (!confirmClaim || (confirmClaim.meta?.changes ?? 0) === 0) {
      const updatedOrders = await orderRepo.findByOrderNumber(orderNumber);
      return c.json({ success: true, data: { orders: updatedOrders } });
    }

    // Update all orders to DONE
    // ⚠️  If this UPDATE fails after Toss confirmed the payment, the order
    //    will be stuck PENDING forever while the customer has been charged.
    //    Queue a reconciliation record + alert ops so we can recover.
    try {
      await orderRepo.updateStatus(orderNumber, 'DONE', {
        toss_payment_key: tossData.paymentKey,
        toss_order_id: orderNumber,
        payment_method: tossData.method,
        paid_at: tossData.approvedAt,
      });
    } catch (dbErr) {
      logError('toss.confirm.db_update_failed', {
        orderNumber,
        orderIds: orders.map(o => o.id),
        error: (dbErr as Error).message,
      });
      // Queue for reconciliation — table may not exist in every env, best-effort.
      await c.env.DB.prepare(`
        INSERT INTO webhook_events (id, source, event_type, payload, status, order_number, created_at)
        VALUES (?, 'internal', 'payment_update_retry', ?, 'FAILED', ?, datetime('now'))
      `).bind(
        `retry_${orderNumber}_${Date.now()}`,
        JSON.stringify({ paymentKey, orderIds: orders.map(o => o.id), totalAmount }),
        orderNumber,
      ).run().catch(swallow('payment:webhook-event-retry-log'));

      // Alert ops — critical: customer paid but DB didn't update.
      await sendAlert(c.env, {
        severity: 'critical',
        title: 'DB update failed after Toss confirm',
        message: `Order ${orderNumber} paid at Toss but status update failed.`,
        context: {
          orderNumber,
          orderIds: orders.map(o => o.id),
          error: String(dbErr).slice(0, 200),
        },
      }).catch(swallow('payment:send-alert-CRITICAL'));

      // Do not call reduceStock — order rows weren't updated either. Return
      // success to client so they see the payment-success page (the money is
      // at Toss); reconciliation cron will catch up.
      return c.json({
        success: true,
        data: { orders, payment: tossData },
        warning: 'PAYMENT_CONFIRMED_DB_DEFERRED',
      });
    }

    // Reduce stock
    for (const order of orders) {
      await orderRepo.reduceStock(order.id);
    }

    // 💸 2026-06-17 [UNLOCK] (대표 승인 "결제 성공 시점"): 혼합결제(Toss+딜) 의 '딜 사용분'을
    //   결제 성공 시점에 실제 잔액 차감. 위 confirmClaim 직후라 이 thread 만 1회 실행(멱등) —
    //   changes==0 동시요청은 이 코드 앞에서 early-return(라인 302) 되므로 이중차감 없음.
    //   total_amount 는 주문생성에서 이미 딜만큼 깎였고(Toss 는 그 금액 청구) — 여기선 잔액만 차감.
    //   adjustUserPoints CAS(guardBalance) 로 음수잔액 방지. fail-soft(경보로 추적, 결제확정 불막음).
    //   ⚠️ Toss confirm/금액검증/confirmClaim 무수정 — side-effect 차감 1블록 추가만.
    try {
      // 🐛 2026-07-01 [UNLOCK] (대표 승인 — 결제 전수조사 후속): `.bind(orderNumber)` 누락으로 D1 이
      //   바인딩 오류를 던지고 .catch 가 빈 배열로 삼켜 이 블록 전체가 무음 no-op 이던 버그 수정.
      //   (webhook 쪽 동일 블록은 bind 정상 — 그러나 /confirm 이 CAS 승자면 webhook 도 skip → 양쪽 미차감.)
      const dealRows = await c.env.DB.prepare(
        'SELECT id, user_id, deal_used FROM orders WHERE order_number = ?'
      ).bind(orderNumber).all<{ id: string | number; user_id: string | number | null; deal_used: number | null }>().catch(() => ({ results: [] as Array<{ id: string | number; user_id: string | number | null; deal_used: number | null }> }));
      for (const r of (dealRows?.results ?? [])) {
        const used = Math.max(0, Math.round(Number(r.deal_used ?? 0)));
        if (used > 0 && r.user_id != null) {
          const res = await adjustUserPoints(c.env.DB, {
            userId: r.user_id, delta: -used, type: 'order_payment',
            description: `주문 결제 딜 사용 (#${r.id})`, orderId: r.id, guardBalance: true,
          });
          if (!res.ok && res.reason === 'insufficient') {
            // 드문 레이스(주문생성~확정 사이 딜 소진) — 가능한 만큼(잔액 전부)만 차감(음수 방지) + 경보.
            const balRow = await c.env.DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
              .bind(String(r.user_id)).first<{ balance: number }>().catch(() => null);
            const avail = Math.max(0, Number(balRow?.balance ?? 0));
            if (avail > 0) {
              await adjustUserPoints(c.env.DB, { userId: r.user_id, delta: -avail, type: 'order_payment', description: `주문 결제 딜 사용(부분 — 잔액부족) (#${r.id})`, orderId: r.id, guardBalance: true }).catch(() => {});
            }
            captureException(new Error('ORDER_DEAL_DEDUCT_INSUFFICIENT'), {
              tags: { area: 'payment', kind: 'deal_deduct', severity: 'warning' },
              extra: { orderId: r.id, userId: r.user_id, requested: used, available: avail },
            }).catch(swallow('payment:deal-deduct-insufficient'));
          }
        }
      }
    } catch (dealErr) {
      captureException(dealErr as Error, { tags: { area: 'payment', kind: 'deal_deduct' } }).catch(swallow('payment:deal-deduct'));
    }

    // 🎫 2026-06-26 [UNLOCK] (대표 승인 "3건 다 고쳐" — 소비자 감사): 디지털 상품 access_token 발급을
    //   /confirm 에도 추가. 기존엔 webhook 에만 있어 정상 경로(브라우저→/confirm)로 결제 완료 시 보관함
    //   미발급 → webhook 지연/실패면 영구 미수령이었음. INSERT OR IGNORE + UNIQUE(order_item_id) 로
    //   webhook 과 둘 다 와도 멱등(이중발급 X). ⚠️ Toss confirm/금액검증/confirmClaim 무수정 — 발급 배선만.
    try {
      const digitalItems = await c.env.DB.prepare(`
        SELECT oi.id AS order_item_id, oi.order_id, oi.product_id, o.user_id,
               p.product_kind, p.access_duration_days
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE o.order_number = ?
          AND p.product_kind IS NOT NULL
          AND p.product_kind != 'physical'
      `).bind(orderNumber).all<{
        order_item_id: number; order_id: string; product_id: number;
        user_id: string; product_kind: string; access_duration_days: number | null;
      }>();
      if (digitalItems.results && digitalItems.results.length > 0) {
        const stmts = digitalItems.results.map(item => {
          const token = crypto.randomUUID();
          const expiresAt = item.access_duration_days
            ? `datetime('now', '+${Number(item.access_duration_days)} days')`
            : 'NULL';
          return c.env.DB.prepare(`
            INSERT OR IGNORE INTO digital_product_access
            (user_id, product_id, order_id, order_item_id, access_token, expires_at, status)
            VALUES (?, ?, ?, ?, ?, ${expiresAt}, 'active')
          `).bind(item.user_id, item.product_id, item.order_id, item.order_item_id, token);
        });
        await c.env.DB.batch(stmts);
        const digUserId = digitalItems.results[0].user_id;
        await c.env.DB.prepare(`
          INSERT INTO notifications (user_id, user_type, type, title, message, link)
          VALUES (?, 'user', 'digital_purchase', ?, ?, '/my/digital')
        `).bind(digUserId, '디지털 상품 구매 완료', '마이페이지 → 디지털 보관함에서 다운로드/시청 가능합니다').run().catch(swallow('payment:digital-notification'));
      }
    } catch (digErr) {
      captureException(digErr as Error, { tags: { area: 'payment', kind: 'digital_access' } }).catch(swallow('payment:digital-access'));
    }

    // 🏁 2026-06-12 [UNLOCK] (사용자 승인 "나머지 다 이상적으로 진행" — 전 플로우 감사 배선 3종):
    //   결제 확정 직후 side-effect 를 응답 후(waitUntil)로 — Toss confirm/금액검증/CAS 무변경.
    //   ① 큐레이터/추천 적립 소비: 주문 생성 시 저장된 order_referrer_intents → creditAffiliateFromIntent
    //      (기존 내부 fetch dead-call 의 근본수정 — 검증/멱등은 /track 과 동일 SSOT)
    //   ② 초대 1,000딜: 첫 구매 확정 시 초대자 보상 (UI 약속 미이행 마감 — UNIQUE claim 멱등)
    //   ③ 셀러 '결제 확정' 벨 알림: 기존엔 주문생성(PENDING) 시점 알림뿐 — 실결제 신호 부재였음
    {
      const _confirmSideFx = async () => {
        try {
          const { creditAffiliateFromIntent } = await import('../utils/affiliate-credit')
          for (const order of orders) {
            await creditAffiliateFromIntent(c.env.DB, c.env, Number(order.id)).catch(() => {})
          }
        } catch { /* fail-soft */ }
        try {
          const { grantInviteRewardForFirstPurchase } = await import('../utils/invite-reward')
          await grantInviteRewardForFirstPurchase(c.env.DB, String(userId))
        } catch { /* fail-soft */ }
        try {
          const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
          for (const order of orders) {
            const sellerId = (order as unknown as { seller_id?: number | null }).seller_id
            if (!sellerId) continue
            const amt = Number((order as unknown as { total_amount?: number | null }).total_amount ?? 0)
            await createDashboardNotification(
              c.env.DB, 'seller', String(sellerId), 'order_paid',
              '💳 결제 확정', `주문 ${order.order_number} — ₩${amt.toLocaleString('ko-KR')} 결제가 확정되었습니다`,
              '/seller/orders',
            ).catch(() => {})
          }
        } catch { /* fail-soft */ }

        // 🔔 2026-06-26 [UNLOCK] (대표 승인 "모두 해줘" — 소비자 감사 D): 결제완료 시 셀러·어드민만
        //   통보되고 buyer 인앱 알림이 없던 누락 보강. 결제성공화면(PaymentSuccessPage)과 별개로
        //   알림함에도 주문완료를 남김. confirmClaim CAS 통과한 1회만 도달(webhook 과 단일실행 — 양쪽 배선).
        //   ⚠️ Toss confirm/금액검증/CAS/재고/딜차감 전부 무변경 — notifyUser side-effect 1블록 추가만.
        try {
          const { notifyUser } = await import('../../lib/notifications')
          const totalAmt = orders.reduce((s, o) => s + Number((o as unknown as { total_amount?: number | null }).total_amount ?? 0), 0)
          const firstNum = (orders[0] as unknown as { order_number?: string })?.order_number
          if (firstNum) {
            await notifyUser(
              c.env.DB, String(userId), 'order_paid',
              '✅ 결제가 완료됐어요', `주문 ${firstNum}${orders.length > 1 ? ` 외 ${orders.length - 1}건` : ''} — ₩${totalAmt.toLocaleString('ko-KR')} 결제 완료`,
              '/my-orders',
            ).catch(() => {})
          }
        } catch { /* fail-soft */ }

        // 🏁 2026-06-26 [UNLOCK] (사용자 승인 "문제 4번 해결" — 결제완료 체감 단축):
        //   에이전시/영입자/도매 공급자 커미션 적립 3종을 confirm 응답을 막던 동기 실행에서
        //   이 waitUntil 블록(응답 후)으로 이동. 셋 다 이미 fail-soft + order_id 멱등이라
        //   응답 후 실행해도 정합성 영향 0 (재시도/중복 confirm 시 이중적립 없음).
        //   ⚠️ Toss confirm/금액검증/CAS/재고차감/딜차감은 위에서 동기 유지 — 무변경.
        //   실행 시점만 변경(적립 로직·역전 대칭·멱등 키 전부 불변).
        try {
          const { creditAgencyStoreIntroCommission } = await import('../utils/agency-store-intro-commission')
          for (const order of orders) {
            await creditAgencyStoreIntroCommission(c.env.DB, {
              id: Number(order.id),
              seller_id: (order as unknown as { seller_id?: number | null }).seller_id ?? null,
              total_amount: (order as unknown as { total_amount?: number | null }).total_amount ?? null,
            })
          }
        } catch (e) {
          logError('payment.agency_intro_commission_failed', { error: String(e).slice(0, 200) })
        }
        try {
          const { creditInfluencerStoreIntroCommission } = await import('../utils/influencer-store-intro-commission')
          for (const order of orders) {
            await creditInfluencerStoreIntroCommission(c.env.DB, {
              id: Number(order.id),
              seller_id: (order as unknown as { seller_id?: number | null }).seller_id ?? null,
              total_amount: (order as unknown as { total_amount?: number | null }).total_amount ?? null,
            })
          }
        } catch (e) {
          logError('payment.influencer_intro_commission_failed', { error: String(e).slice(0, 200) })
        }
        try {
          const { creditSupplierOnOrder } = await import('../../features/supply/api/supply-settlement')
          for (const order of orders) {
            await creditSupplierOnOrder(c.env.DB, Number(order.id))
          }
        } catch (e) {
          logError('payment.supplier_credit_failed', { error: String(e).slice(0, 200) })
        }

        // 🆕 2026-06-27 [UNLOCK] (대표 "배선하는 길로" 승인): fee-resolver 그림자 기록.
        //   FEE_RESOLVER_ENABLED='true' 일 때만 — 새 수수료 규칙 분배를 *계산만 해서* order_fee_breakdown
        //   에 기록(실제 정산/적립/위 커미션 전부 무변경). 스테이징 검증용. 기본 OFF=현행 100% 동일.
        //   ⚠️ Toss confirm/금액검증/CAS/재고/딜차감/위 커미션 전부 byte-불변 — additive 기록 1블록만.
        if (c.env.FEE_RESOLVER_ENABLED === 'true') {
          try {
            const { recordOrderFeeBreakdown } = await import('../utils/fee-breakdown-record')
            for (const order of orders) {
              await recordOrderFeeBreakdown(c.env.DB, {
                id: Number(order.id),
                seller_id: (order as unknown as { seller_id?: number | null }).seller_id ?? null,
                total_amount: (order as unknown as { total_amount?: number | null }).total_amount ?? null,
              }).catch(() => {})
            }
          } catch { /* fail-soft — 기록 실패가 결제 무영향 */ }
        }

        // 💸 2026-07-01 [UNLOCK] (대표 승인 "가장 이상적으로" — 정산 자동화 완성): 일반 쇼핑 주문
        //   셀러 매출을 이중원장에 net 크레딧 → 주간 자동 payout 에 포함(공구/이용권과 동일 경로 통일).
        //   기본 OFF(SHOPPING_LEDGER_ENABLED!=='true') — fee-resolver 그림자와 동일 2단 스위치.
        //   멱등 + 이용권/공구 주문 skip(이중적립 0), 역전은 order-refund(reverseOrderAncillaryOnRefund)에 배선.
        //   ⚠️ Toss confirm/금액검증/CAS/재고·딜차감/기존 side-effect 전부 byte-불변 — 게이트 블록 1개 추가만.
        if (c.env.SHOPPING_LEDGER_ENABLED === 'true') {
          try {
            const { creditSellerOrderToLedger } = await import('../utils/order-ledger-credit')
            for (const order of orders) {
              await creditSellerOrderToLedger(c.env.DB, Number(order.id)).catch(() => {})
            }
          } catch { /* fail-soft — 기록 실패가 결제 무영향 */ }
        }
      }
      let _fxDeferred = false
      try { if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(_confirmSideFx()); _fxDeferred = true } } catch { /* no ctx */ }
      if (!_fxDeferred) await _confirmSideFx()
    }

    // 🛡️ 2026-05-18: 숙소 예약 (orders.stay_booking_id) 가 있으면 stay_bookings status='confirmed'
    //   + 캘린더 available_count 차감 + 인플루언서 commission 지급 affiliate track.
    for (const order of orders) {
      const stayBookingId = (order as unknown as { stay_booking_id?: number | null }).stay_booking_id
      if (!stayBookingId) continue
      try {
        const booking = await c.env.DB.prepare(
          `SELECT id, product_id, room_id, seller_id, user_id, check_in_date, check_out_date, status,
                  referrer_id, influencer_commission_amount, total_amount
             FROM stay_bookings WHERE id = ?`
        ).bind(stayBookingId).first<{
          id: number; product_id: number; room_id: number; seller_id: number; user_id: number;
          check_in_date: string; check_out_date: string; status: string;
          referrer_id: string | null; influencer_commission_amount: number; total_amount: number;
        }>()
        // 🛡️ 2026-06-04 [UNLOCK]: 달력 차감·오버부킹 가드·status='confirmed' 는 Toss 승인 *전* 으로 이동(위 reserve 블록).
        //   여기선 확정된 예약(confirmed)에 대해 인플루언서 affiliate 적립만 수행(멱등). 미확정/취소는 skip.
        if (!booking || booking.status !== 'confirmed') continue

        // 🛡️ 2026-05-18: 인플루언서 attribution 자동 INSERT (referrer_id 있을 시).
        //   stay_bookings.referrer_id + influencer_commission_amount 가 있으면
        //   affiliate_earnings 에 row 생성 → 인플 누적 적립.
        //   self-referral 차단 (booking.referrer_id !== booking.user_id).
        if (booking.referrer_id
            && String(booking.referrer_id) !== String(booking.user_id)
            && booking.influencer_commission_amount > 0) {
          const existingAttr = await c.env.DB.prepare(
            'SELECT id FROM affiliate_earnings WHERE referrer_id = ? AND order_id = ?'
          ).bind(String(booking.referrer_id), order.id).first()
          if (!existingAttr) {
            // 상품명 정확히 조회 (notification 메시지용).
            const productInfo = await c.env.DB.prepare(
              'SELECT name FROM products WHERE id = ?'
            ).bind(booking.product_id).first<{ name: string }>().catch(() => null)
            const productName = productInfo?.name || `숙소 #${booking.product_id}`

            await c.env.DB.prepare(
              `INSERT INTO affiliate_earnings
                 (referrer_id, order_id, product_id, product_name, buyer_id, order_amount, commission, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
            ).bind(
              String(booking.referrer_id), order.id,
              booking.product_id, productName,
              String(booking.user_id),
              booking.total_amount, booking.influencer_commission_amount,
            ).run().catch((e) => {
              logError('payment.stay_referrer_insert_failed', {
                orderId: order.id, referrerId: booking.referrer_id, error: String(e).slice(0, 200),
              })
            })

            // 🏁 2026-06-11 [UNLOCK] (사용자 승인 — 참여하기와 동일 수술): referral 알림
            //   (notifications INSERT + phone/누적 SELECT + 알리고 외부 HTTP)이 결제 confirm 응답을
            //   막고 있었음 — 내용/순서/에러처리 그대로 응답 후(waitUntil)로만 이동.
            //   ⚠️ 적립(affiliate_earnings INSERT) 등 머니 경로는 위에서 동기 유지 — 무변경.
            {
              const _bg = async () => {
            // 🛡️ 2026-05-18: 인플에게 알림 (notifications + 카카오 알림톡).
            //   notifications INSERT — 앱 내 알림 (referrer_id 가 user_id 라고 가정).
            const refIdNum = Number(booking.referrer_id)
            if (Number.isFinite(refIdNum) && refIdNum > 0) {
              await c.env.DB.prepare(
                `INSERT INTO notifications (user_id, type, title, message, created_at)
                 VALUES (?, 'referral_commission_earned', ?, ?, datetime('now'))`
              ).bind(
                refIdNum,
                `💸 referral 적립 ₩${booking.influencer_commission_amount.toLocaleString()}`,
                `${productName} · 결제 ₩${booking.total_amount.toLocaleString()}`,
              ).run().catch(() => { /* table 없으면 silent */ })

              // 카카오 알림톡 (ALIGO env 설정 시).
              try {
                const env = c.env as unknown as Record<string, string | undefined>
                if (env.ALIGO_API_KEY && env.ALIGO_USER_ID && env.ALIGO_SENDER_KEY) {
                  const refUser = await c.env.DB.prepare('SELECT phone FROM users WHERE id = ?')
                    .bind(refIdNum).first<{ phone: string | null }>().catch(() => null)
                  const phone = (refUser?.phone || '').replace(/\D/g, '')
                  if (/^01\d{8,9}$/.test(phone)) {
                    const totalEarnedRow = await c.env.DB.prepare(
                      'SELECT COALESCE(SUM(commission), 0) as total FROM affiliate_earnings WHERE referrer_id = ?'
                    ).bind(String(refIdNum)).first<{ total: number }>().catch(() => null)
                    const totalEarned = totalEarnedRow?.total || 0
                    const message =
                      `[유어딜] referral 적립 안내\n\n` +
                      `회원님의 추천 링크로 결제가 발생했습니다.\n\n` +
                      `· 상품: ${productName}\n` +
                      `· 결제: ₩${booking.total_amount.toLocaleString()}\n` +
                      `· 적립: ₩${booking.influencer_commission_amount.toLocaleString()}\n\n` +
                      `누적 ₩${totalEarned.toLocaleString()} — 정산 페이지에서 환급 가능합니다.`
                    const { sendAlimtalk } = await import('../../lib/aligo')
                    await sendAlimtalk(
                      { ALIGO_API_KEY: env.ALIGO_API_KEY!, ALIGO_USER_ID: env.ALIGO_USER_ID! },
                      {
                        senderKey: env.ALIGO_SENDER_KEY!,
                        templateCode: env.ALIGO_REFERRAL_COMMISSION_EARNED || 'referral_commission_earned',
                        to: phone,
                        message,
                      },
                    ).catch(() => { /* silent fail — 메인 흐름 보호 */ })
                  }
                }
              } catch { /* fail-soft */ }
            }
              }
              let _deferred = false
              try { if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(_bg().catch(() => {})); _deferred = true } } catch { /* no ctx */ }
              if (!_deferred) await _bg().catch(() => {})
            }
          }
        }
      } catch (e) {
        logError('payment.stay_booking_confirm_failed', { orderId: order.id, stayBookingId, error: String(e).slice(0, 200) })
      }
    }

    const updatedOrders = await orderRepo.findByOrderNumber(orderNumber);

    logInfo('payment.confirmed', { orderId: orderNumber, method: tossData.method, count: updatedOrders.length });

    // 🛡️ 2026-05-13 (Phase A): 라이브 주문 social proof — 라이브 시청 중인 시청자들에게
    //   "🛍️ XX님이 [상품명] 구매!" 메시지 broadcast → conversion 자극 (FOMO 효과).
    //   best-effort: DO 미가용 / 라이브 외 주문이면 skip.
    //   🛡️ 2026-05-13 (Phase B): stock_update 추가 broadcast — 시청자 측 polling → DO push 전환.
    //     남은 재고 N개 실시간 표시 정확도 ↑.
    if ((c.env as { LIVE_STREAM?: DurableObjectNamespace }).LIVE_STREAM) {
      for (const order of updatedOrders) {
        const liveStreamId = (order as unknown as { live_stream_id?: number | null }).live_stream_id;
        if (!liveStreamId) continue;
        try {
          // 첫 상품 정보 + 익명화 사용자 + 남은 재고 (재고 차감 후 read)
          const firstItem = await c.env.DB.prepare(`
            SELECT oi.product_id, oi.product_name, oi.quantity FROM order_items oi WHERE oi.order_id = ? LIMIT 1
          `).bind(order.id).first<{ product_id: number; product_name: string; quantity: number }>();
          const buyer = (order as unknown as { shipping_name?: string }).shipping_name || '구매자'
          const maskedBuyer = buyer.length <= 1 ? buyer : `${buyer[0]}**`
          const productName = firstItem?.product_name || '상품'
          const doId = (c.env as unknown as { LIVE_STREAM: DurableObjectNamespace }).LIVE_STREAM.idFromName(String(liveStreamId))
          const stub = (c.env as unknown as { LIVE_STREAM: DurableObjectNamespace }).LIVE_STREAM.get(doId)

          // 1) order_proof — 사회적 증명 toast
          c.executionCtx.waitUntil(
            stub.fetch(new Request('https://internal/broadcast', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Auth': c.env.JWT_SECRET || '',
                'X-Auth-User-Type': 'system',
              },
              body: JSON.stringify({
                type: 'order_proof',
                data: { buyer: maskedBuyer, product: productName, amount: order.total_amount },
                timestamp: Date.now(),
              }),
            })).catch(() => { /* DO 미가용 — 결제는 이미 완료, 무시 */ })
          )

          // 2) stock_update — 재고 push (polling 대체)
          if (firstItem?.product_id) {
            const stockRow = await c.env.DB.prepare(
              `SELECT COALESCE(stock_quantity, stock, 0) as remaining_stock FROM products WHERE id = ? LIMIT 1`
            ).bind(firstItem.product_id).first<{ remaining_stock: number }>().catch(() => null);
            if (stockRow) {
              c.executionCtx.waitUntil(
                stub.fetch(new Request('https://internal/broadcast', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Auth': c.env.JWT_SECRET || '',
                    'X-Auth-User-Type': 'system',
                  },
                  body: JSON.stringify({
                    type: 'stock_update',
                    data: { product_id: firstItem.product_id, remaining: stockRow.remaining_stock },
                    timestamp: Date.now(),
                  }),
                })).catch(() => { /* DO 미가용 — 무시 */ })
              )
            }
          }
        } catch (err) {
          if (import.meta.env?.DEV) console.warn('[payment.confirm] order proof/stock broadcast failed:', err)
        }
      }
    }

    // ⚡ 2026-07-02 [UNLOCK] (대표 승인 — 결제 체감속도): KT 발송(외부 HTTP, prod 실측 1~4.5s) +
    //   다단계 추천 커미션(트리 DB 왕복 다수)을 응답 후(waitUntil)로 이동 — confirm 응답을 동기로
    //   막던 마지막 큰 두 블록. 내용/순서/에러처리 byte-불변, 실행 시점만. 안전판: 둘 다 fail-soft +
    //   KT 는 per-order 멱등 + kt-alpha-voucher-retry cron(failed 재시도 + 미발송 스위퍼) 백스톱,
    //   커미션은 confirmClaim CAS 로 단일실행 보장. ctx 없으면 동기 fallback.
    {
      const _postConfirmBg = async () => {
        // 🛡️ 2026-05-19: KT Alpha 교환권 자동 발송 (auto_voucher_send=1 상품 결제 성공 시).
        try {
          const { autoSendKtAlphaVouchersForOrders } = await import('../utils/kt-alpha-auto-send')
          await autoSendKtAlphaVouchersForOrders(
            c.env as unknown as Parameters<typeof autoSendKtAlphaVouchersForOrders>[0],
            updatedOrders.map(o => ({
              id: typeof o.id === 'number' ? o.id : parseInt(String(o.id), 10),
              shipping_phone: (o as unknown as { shipping_phone?: string }).shipping_phone,
              user_id: o.user_id,
            })),
            String(userId),
          )
        } catch (err) {
          logError('payment.kt_alpha_send_unexpected', { orderNumber, error: String(err).slice(0, 300) })
        }

        // ── 다단계 추천 커미션 계산 (fire-and-forget) ──────────────────────────
        // 결제 완료 후 구매자의 추천 트리를 확인하여 상위 추천인에게 커미션 지급
        // 🛡️ 2026-05-12: silent catch → logError + Sentry. 비결정적 누락은 결제 자체에 영향 없지만
        //   누락 발견을 위해 관측성 필수 (이전: console 도 없어 운영자가 알 길 없음).
        try {
          const { calculateMultiTierCommission } = await import('../../features/referral/api/referral-tree.routes');
          for (const order of updatedOrders) {
            const oid = typeof order.id === 'number' ? order.id : parseInt(String(order.id), 10);
            if (oid && order.total_amount) {
              await calculateMultiTierCommission(c.env.DB, oid, order.total_amount, String(userId));
            }
          }
        } catch (err) {
          logError('payment.referral_commission_failed', {
            orderNumber,
            orderIds: updatedOrders.map(o => o.id),
            userId: String(userId),
            error: String(err).slice(0, 300),
          });
          captureException(err as Error, {
            tags: { area: 'payment', kind: 'referral_commission', severity: 'warning' },
            extra: { orderNumber },
          }).catch(swallow('payment:sentry-referral'));
        }
      }
      let _pcDeferred = false
      try { if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(_postConfirmBg()); _pcDeferred = true } } catch { /* no ctx */ }
      if (!_pcDeferred) await _postConfirmBg()
    }

    // ── 알림톡 자동 발송 (주문 완료) ──────────────────────────────────────
    // 실패해도 결제 응답에 영향 없도록 fire-and-forget
    if (c.env.ALIGO_API_KEY && c.env.ALIGO_USER_ID) {
      for (const order of updatedOrders) {
        if (!order.seller_id || !order.shipping_phone) continue;
        const { subject, message } = buildOrderConfirmMessage({
          orderId: orderNumber,
          buyerName: order.shipping_name ?? '고객',
          buyerPhone: order.shipping_phone,
          productName: order.items?.[0]?.product_name ?? '상품',
          totalAmount: order.total_amount,
          sellerName: order.seller_name ?? '',
        });
        // 🛡️ 2026-05-12: console.warn → logError + Sentry. silent failure 가 셀러 미통보로 이어지면 배송 지연.
        sendSellerAlimtalk({
          DB: c.env.DB,
          aligoApiKey: c.env.ALIGO_API_KEY,
          aligoUserId: c.env.ALIGO_USER_ID,
          aligoSenderKey: c.env.ALIGO_SENDER_KEY ?? '',
          senderPhone: c.env.ALIGO_SENDER_PHONE,
          sellerId: Number(order.seller_id),
          receiver: order.shipping_phone,
          receiverName: order.shipping_name ?? '고객',
          templateCode: c.env.ALIGO_TPL_ORDER_CONFIRM ?? 'TBD',
          subject,
          message,
          orderId: orderNumber,
        }).catch(e => {
          logError('payment.alimtalk_send_failed', {
            orderNumber,
            sellerId: order.seller_id,
            receiver: order.shipping_phone?.slice(-4),
            error: String(e).slice(0, 300),
          });
          captureException(e as Error, {
            tags: { area: 'payment', kind: 'alimtalk_dispatch', severity: 'warning' },
            extra: { orderNumber, sellerId: order.seller_id },
          }).catch(swallow('payment:sentry-alimtalk'));
        });
      }
    }

    return c.json({ success: true, data: { orders: updatedOrders, payment: tossData } });

  } catch (err) {
    console.error('[PAYMENTS] Confirm error:', err);
    captureException(err as Error, {
      tags: { area: 'payment', kind: 'confirm_unexpected', severity: 'error' },
    }).catch(swallow('payment:sentry-confirm'));
    return c.json({ success: false, error: '결제 처리 중 오류가 발생했습니다' }, 500);
  }
});

/**
 * POST /api/payments/checkout-session
 * Returns checkout info including Toss client key and order details
 */
paymentsRouter.post('/checkout-session', async (c) => {
  try {
    // ✅ IDOR FIX: Resolve Firebase UID → DB integer id (same pattern as /confirm).
    // Previously compared o.user_id (INTEGER) to raw rawId (STRING) directly.
    const rawId = String(c.get('user').id);
    let dbUserId = rawId;
    const numId = parseInt(rawId);
    if (isNaN(numId) || String(numId) !== rawId) {
      try {
        const row = await c.env.DB.prepare('SELECT id FROM users WHERE firebase_uid = ? LIMIT 1')
          .bind(rawId).first<{ id: string | number }>();
        if (row?.id != null) dbUserId = String(row.id);
        else return c.json({ success: false, error: 'Unauthorized' }, 401);
      } catch {
        // fallback: keep raw id
      }
    }

    const { order_number } = await c.req.json<{ order_number: string }>();

    if (!order_number) {
      return c.json({ success: false, error: 'order_number is required' }, 400);
    }

    const orderRepo = new OrderRepository(c.env.DB);
    const orders = await orderRepo.findByOrderNumber(order_number);

    if (orders.length === 0) {
      return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);
    }

    if (orders.some(o => String(o.user_id) !== String(dbUserId))) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);
    const sellerNames = [...new Set(orders.map(o => o.seller_id))].join(', ');
    const firstItem = orders[0]?.items?.[0];
    const orderName = firstItem
      ? `${firstItem.product_name}${orders.reduce((sum, o) => sum + (o.items?.length ?? 0), 0) > 1 ? ` 외 ${orders.reduce((sum, o) => sum + (o.items?.length ?? 0), 0) - 1}건` : ''}`
      : '마켓플레이스 주문';

    if (!c.env.TOSS_CLIENT_KEY) {
      console.error('[PAYMENTS] TOSS_CLIENT_KEY is not configured');
      return c.json({ success: false, error: 'Payment service not configured' }, 500);
    }

    // 🛡️ 2026-05-19: 주문에 deal_only=1 상품 포함 여부 — 클라이언트에서 PG 카드 결제 차단용.
    const orderIds = orders.map(o => o.id).filter((id) => id != null && typeof id === 'number') as number[]
    let hasDealOnly = false
    if (orderIds.length > 0) {
      const ph = orderIds.map(() => '?').join(',')
      const dealCheck = await c.env.DB.prepare(
        `SELECT COUNT(*) as cnt
           FROM order_items oi
           INNER JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id IN (${ph}) AND p.deal_only = 1`
      ).bind(...orderIds).first<{ cnt: number }>().catch(() => null)
      hasDealOnly = Boolean(dealCheck && dealCheck.cnt > 0)
    }

    return c.json({
      success: true,
      data: {
        order_number,
        orders,
        total_amount: totalAmount,
        order_name: orderName,
        toss_client_key: c.env.TOSS_CLIENT_KEY,
        customer_name: orders[0]?.shipping_name ?? '',
        customer_phone: orders[0]?.shipping_phone ?? '',
        has_deal_only: hasDealOnly,
        payment_required: hasDealOnly ? 'deal_only' : 'any',
      },
    });
  } catch (err) {
    console.error('[PAYMENTS] Checkout session error:', err);
    return c.json({ success: false, error: 'Failed to create checkout session' }, 500);
  }
});

// 🛡️ 2026-05-22: 클라이언트에 server-side TOSS_CLIENT_KEY 노출 (build env sync 깨짐 영구 차단).
//   CheckoutPage / PointsChargePage 등이 이 응답의 clientKey 사용.
//   server TOSS_CLIENT_KEY 가 진실원천 — 운영자가 환경변수 한 곳만 관리.
//   인증 불필요 (clientKey 는 본질적으로 public — 브라우저에 노출되는 값).
paymentsRouter.get('/client-key', async (c) => {
  const { decideTossFlow } = await import('../utils/toss-gateway');
  const tossKey = (c.env as { TOSS_CLIENT_KEY?: string }).TOSS_CLIENT_KEY || '';
  const { flow, flowReason } = decideTossFlow(tossKey);
  const isTest = /^test_/.test(tossKey)
  const isLive = /^live_/.test(tossKey)
  // 🛡️ 2026-05-24 v2: variantKey 도 server-side 진실원천 — Cloudflare env 변경 시 즉시 반영
  //   (build 재배포 불필요). 콘솔 variant 이름 바뀔 때마다 빌드 안 해도 됨.
  //   미설정 시 빈 문자열 → 클라이언트가 variantKey 안 보냄 → Toss SDK 가 'DEFAULT' 자동 사용.
  const variantPayment = (c.env as { TOSS_VARIANT_PAYMENT?: string }).TOSS_VARIANT_PAYMENT || ''
  const variantAgreement = (c.env as { TOSS_VARIANT_AGREEMENT?: string }).TOSS_VARIANT_AGREEMENT || ''
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  c.header('Pragma', 'no-cache')
  return c.json({
    success: flow !== 'invalid',
    data: {
      clientKey: tossKey,
      flow,
      flow_reason: flowReason,
      key_type: isLive ? 'live' : isTest ? 'test' : 'unknown',
      key_prefix: tossKey.slice(0, 8),
      key_length: tossKey.length,
      // 🛡️ variantKey 진실원천 (server-side).
      variant_payment: variantPayment,
      variant_agreement: variantAgreement,
    },
  });
});

export { paymentsRouter };
