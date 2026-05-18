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
import { withCircuitBreaker } from '../utils/circuit-breaker';
import { logInfo, logError, logWarn } from '../utils/logger';
import { sendAlert } from '../utils/alerts';

// AuthVariables compatible with auth.ts AuthUser
type AuthVariables = { user: AuthUser };

// Toss error code → 사용자 친화 메시지 맵 (v15-3)
// Toss가 반환하는 기술적 에러 코드를 한국어 안내 문구로 변환합니다.
const TOSS_ERROR_MESSAGES: Record<string, string> = {
  'REJECT_CARD_COMPANY': '카드사에서 결제를 거부했습니다. 다른 카드로 시도해주세요.',
  'INVALID_CARD_EXPIRATION': '카드 유효기간이 올바르지 않습니다.',
  'INVALID_CARD_INSTALLMENT_PLAN': '할부 개월 수가 올바르지 않습니다.',
  'EXCEED_MAX_DAILY_PAYMENT_COUNT': '일일 결제 한도를 초과했습니다.',
  'EXCEED_MAX_AUTH_COUNT': '인증 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.',
  'INSUFFICIENT_BALANCE': '잔액이 부족합니다.',
  'INVALID_PIN': '비밀번호가 올바르지 않습니다.',
  'ALREADY_PROCESSED_PAYMENT': '이미 처리된 결제입니다.',
  'INVALID_PASSWORD': '카드 비밀번호가 올바르지 않습니다.',
  'NOT_ENOUGH_BALANCE_FOR_INSTALLMENT': '할부에 필요한 잔액이 부족합니다.',
  'EXPIRED_CARD': '만료된 카드입니다.',
  'INVALID_CARD_NUMBER': '카드 번호가 올바르지 않습니다.',
  'CARD_PROCESSING_ERROR': '카드 처리 중 오류가 발생했습니다.',
  'UNAUTHORIZED_PAYMENT': '인증되지 않은 결제입니다.',
};

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
    const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);
    if (totalAmount !== amount) {
      console.error('[PAYMENTS] Amount mismatch — payment amount validation failed');
      // 🚨 fraud signal — 금액 변조 시도
      captureException(new Error('PAYMENT_AMOUNT_MISMATCH'), {
        tags: { area: 'payment', kind: 'amount_mismatch', severity: 'warning' },
        extra: { expected: totalAmount, received: amount, orderNumber, userId },
      }).catch(swallow('payment:sentry-amount-mismatch'));
      return c.json({ success: false, error: '결제 금액이 일치하지 않습니다' }, 400);
    }

    // Call Toss Payments API to confirm
    const tossSecretKey = c.env.TOSS_SECRET_KEY;
    if (!tossSecretKey) {
      return c.json({ success: false, error: 'Payment configuration error' }, 500);
    }

    // Idempotency-Key: paymentKey 기반으로 설정 (동일 결제의 중복 승인 요청 방지)
    // ⚠️ 결제는 critical path — fallback 없이, 회로가 열리면 명확한 사용자 메시지와 함께 거부.
    logInfo('toss.confirm.start', { orderId: orderNumber, amount: totalAmount, endpoint: '/api/payments/confirm' });
    let tossResponse: Response;
    try {
      tossResponse = await withCircuitBreaker(
        { name: 'toss-confirm', maxFailures: 10, resetTimeoutMs: 60_000 },
        () => fetch(`${TOSS_PAYMENT_URL}/payments/confirm`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(tossSecretKey + ':')}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': paymentKey,
          },
          body: JSON.stringify({
            paymentKey,
            orderId: orderNumber,
            amount: totalAmount,  // DB 검증된 금액 사용
          }),
        }),
      );
    } catch (e) {
      logError('toss.confirm.circuit_open', { orderId: orderNumber, error: (e as Error).message });
      return c.json({
        success: false,
        error: 'Toss 결제 시스템이 일시 중단됐습니다. 잠시 후 다시 시도해주세요.',
        code: 'CIRCUIT_OPEN',
      }, 503);
    }

    if (!tossResponse.ok) {
      const tossError = await tossResponse.json() as { code?: string; message?: string };
      console.error('[PAYMENTS] Toss confirmation failed:', tossError);

      if (tossError.code === 'ALREADY_PROCESSED_PAYMENT') {
        // Already confirmed - update order and return success
        await orderRepo.updateStatus(orderNumber, 'DONE', {
          toss_payment_key: paymentKey,
          toss_order_id: orderNumber,
        });
        const updatedOrders = await orderRepo.findByOrderNumber(orderNumber);
        return c.json({ success: true, data: { orders: updatedOrders } });
      }

      // v15-3: 사용자 친화 메시지로 Toss 에러 코드 변환
      const errorMessage = tossError.code
        ? (TOSS_ERROR_MESSAGES[tossError.code] || tossError.message || '결제 처리 중 오류가 발생했습니다.')
        : '결제 처리 중 오류가 발생했습니다.';

      return c.json({
        success: false,
        error: errorMessage,
        code: tossError.code,
      }, 400);
    }

    const tossData = await tossResponse.json() as {
      paymentKey: string;
      orderId: string;
      totalAmount: number;
      method: string;
      approvedAt: string;
      status: string;
    };

    // 토스 응답의 금액도 한 번 더 검증
    if (tossData.totalAmount !== totalAmount) {
      logError('toss.confirm.amount_mismatch', { orderId: orderNumber });
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
        if (!booking || booking.status === 'confirmed') continue

        // 상태 전환.
        await c.env.DB.prepare(
          `UPDATE stay_bookings SET status = 'confirmed', updated_at = datetime('now') WHERE id = ?`
        ).bind(stayBookingId).run()

        await c.env.DB.prepare(
          `INSERT INTO stay_booking_status_log (booking_id, prev_status, new_status, changed_by_role, reason)
           VALUES (?, ?, 'confirmed', 'system', '결제 승인 — toss confirm')`
        ).bind(stayBookingId, booking.status).run().catch(() => { /* noop */ })

        // 캘린더 available_count 차감.
        const nights = Math.round((new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) / 86400000)
        for (let i = 0; i < nights; i++) {
          const d = new Date(new Date(booking.check_in_date).getTime() + i * 86400000)
          const ds = d.toISOString().slice(0, 10)
          await c.env.DB.prepare(
            `INSERT OR IGNORE INTO product_stay_calendar (room_id, product_id, stay_date, available_count)
             SELECT ?, ?, ?, COALESCE((SELECT total_inventory FROM product_stay_rooms WHERE id = ?), 1)`
          ).bind(booking.room_id, booking.product_id, ds, booking.room_id).run().catch(() => { /* noop */ })
          await c.env.DB.prepare(
            `UPDATE product_stay_calendar
                SET available_count = MAX(0, available_count - 1), updated_at = datetime('now')
              WHERE room_id = ? AND stay_date = ?`
          ).bind(booking.room_id, ds).run().catch(() => { /* noop */ })
        }

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
          const doId = (c.env as { LIVE_STREAM: DurableObjectNamespace }).LIVE_STREAM.idFromName(String(liveStreamId))
          const stub = (c.env as { LIVE_STREAM: DurableObjectNamespace }).LIVE_STREAM.get(doId)

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
      },
    });
  } catch (err) {
    console.error('[PAYMENTS] Checkout session error:', err);
    return c.json({ success: false, error: 'Failed to create checkout session' }, 500);
  }
});

export { paymentsRouter };
