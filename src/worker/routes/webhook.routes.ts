// ============================================================
// Toss Payments Webhook Handler
// POST /api/payments/webhook
//
// Security: HMAC-SHA256 signature verification
// Idempotency: webhook_events table prevents duplicate processing
// Always returns 200 OK to prevent Toss retry storms
// ============================================================

import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types/env';
import { OrderRepository } from '../repositories/order.repository';
import { WebhookEventRepository } from '../repositories/webhook.repository';
import type { TossWebhookPayload } from '../../shared/types';
import { arrayBufferToHex } from '../../shared/utils';
import { sendAlert } from '../utils/alerts';
import { rateLimit } from '../middleware/rate-limit';
import { swallow } from '../utils/swallow';
import { captureException } from '../utils/sentry';
import { maskPhone } from '../../lib/mask';
import { createDashboardNotification } from '../../features/notifications/api/dashboard-notifications.routes';

// ============================================================
// Order Notification Helper
// ============================================================

/**
 * Send an order status notification.
 *
 * Currently dispatches a Discord embed when DISCORD_WEBHOOK_URL is configured
 * in env.  Alimtalk (KakaoTalk) sending is wired via src/lib/aligo.ts but
 * requires ALIGO_API_KEY / ALIGO_USER_ID / ALIGO_SENDER_KEY to be set in env.
 *
 * @param orderRepo  - OrderRepository instance scoped to the current request
 * @param orderNumber - The platform order number (equals tossOrderId)
 * @param event      - 'cancelled' | 'failed'
 * @param env        - Worker Bindings (access to DISCORD_WEBHOOK_URL etc.)
 */
async function sendOrderNotification(
  orderRepo: OrderRepository,
  orderNumber: string,
  event: 'cancelled' | 'failed',
  env: Env
): Promise<void> {
  // Fetch order details so we have user contact info for future Alimtalk sends
  const orders = await orderRepo.findByOrderNumber(orderNumber).catch(() => []);
  const firstOrder = orders[0];

  const contactPhone = firstOrder?.shipping_phone ?? 'N/A';
  const userId = firstOrder?.user_id ?? 'N/A';

  if (process.env.NODE_ENV !== 'production') console.log(`[WEBHOOK] ORDER_NOTIFICATION event=${event}`, {
    orderNumber,
    userId,
    contactPhone: maskPhone(contactPhone),
    ordersCount: orders.length,
  });

  // Discord notification (configured via DISCORD_WEBHOOK_URL env var)
  const discordUrl = (env as any).DISCORD_WEBHOOK_URL;
  if (discordUrl) {
    const colorMap = { cancelled: 0xFFA500, failed: 0xFF0000 };
    const titleMap = { cancelled: 'Order Cancelled', failed: 'Payment Failed' };

    const embed = {
      title: `🔔 ${titleMap[event]}`,
      color: colorMap[event],
      fields: [
        { name: 'Order Number', value: orderNumber, inline: true },
        { name: 'User ID', value: userId, inline: true },
        { name: 'Orders Affected', value: String(orders.length), inline: true },
        { name: 'Timestamp', value: new Date().toISOString(), inline: false },
      ],
    };

    await fetch(discordUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (process.env.NODE_ENV !== 'production') console.log(`[WEBHOOK] Discord notification sent for ${event} order ${orderNumber}`);
  }
}

const webhookRouter = new Hono<{ Bindings: Env }>();

// v31 FIX: webhook intake rate-limit (per-IP). POST / 에만 직접 적용.
const webhookIntakeLimiter = rateLimit({ action: 'webhook_intake', max: 100, windowSec: 1 });

// ============================================================
// HMAC-SHA256 Signature Verification (Toss V2)
//
// Toss V2 webhook 사양 (docs.tosspayments.com/guides/webhook):
//   - 시그니처 헤더: "Toss-Signature" (legacy: "TossPayments-Signature")
//   - 타임스탬프 헤더: "Toss-Timestamp" (epoch seconds)
//   - 알고리즘: HMAC-SHA256(secret, rawBody)
//   - 포맷: "v1=<hex>" 또는 "v1,<hex>" — 여러 버전 공존 가능 (장기 키 로테이션 대비)
//   - 비교: hex (lowercase) — 일부 사례에서 base64 가능성 있어 양쪽 fallback
//
// 향후 Toss 가 헤더 이름을 변경/추가하면 여기 한 곳만 갱신하면 됨.
// ============================================================

const SIGNATURE_HEADER_CANDIDATES = [
  'Toss-Signature',
  'TossPayments-Signature',
  'TossPayments-Webhook-Signature',
] as const;

const TIMESTAMP_HEADER_CANDIDATES = [
  'Toss-Timestamp',
  'TossPayments-Timestamp',
  'TossPayments-Webhook-Timestamp',
] as const;

/** Toss 공식 webhook 송신 IP 대역 (docs 명시 시 추가 — 현재는 best-effort).
 *  허용 IP 목록은 별도 ENV (`TOSS_WEBHOOK_IP_ALLOWLIST`, CSV) 로도 주입 가능. */
function getTossIpAllowlist(env: Env): string[] {
  const csv = (env as unknown as { TOSS_WEBHOOK_IP_ALLOWLIST?: string }).TOSS_WEBHOOK_IP_ALLOWLIST;
  if (!csv) return [];
  return csv.split(',').map((s) => s.trim()).filter(Boolean);
}

function readFirstHeader(c: { req: { header: (n: string) => string | undefined } }, candidates: readonly string[]): { value: string | undefined; matched: string | null } {
  for (const name of candidates) {
    const v = c.req.header(name);
    if (v) return { value: v, matched: name };
  }
  return { value: undefined, matched: null };
}

function constantTimeEqualsHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function verifyTossSignature(
  rawBody: string,
  signatureHeader: string | undefined | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader) {
    console.warn('[WEBHOOK] Missing signature header');
    return false;
  }

  try {
    // Toss V2 포맷: "v1=<hex>" 우선. legacy/variant: "v1,<hex>" or 다중 ("v1=hex,v2=hex").
    //   "=" 가 base64 padding 으로 끝날 수 있으므로 split('=') 후 .slice(1).join('=') 사용.
    const tokens = signatureHeader.split(',').map((t) => t.trim()).filter(Boolean);
    const candidates: string[] = [];
    for (const tok of tokens) {
      // "v1=hex" / "v1,hex" / 그냥 "hex"
      const eqIdx = tok.indexOf('=');
      if (eqIdx > 0 && /^v\d+$/i.test(tok.slice(0, eqIdx))) {
        candidates.push(tok.slice(eqIdx + 1));
      } else {
        candidates.push(tok);
      }
    }
    if (candidates.length === 0) {
      console.warn('[WEBHOOK] Empty signature header tokens');
      return false;
    }

    // HMAC-SHA256 계산
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const computedHex = arrayBufferToHex(signature).toLowerCase();
    const computedB64 = bytesToBase64(signature);

    // 후보 시그니처 중 하나라도 매치되면 OK (hex 우선, base64 fallback)
    for (const received of candidates) {
      const recvLower = received.toLowerCase();
      if (constantTimeEqualsHex(recvLower, computedHex)) return true;
      if (constantTimeEqualsHex(received, computedB64)) return true;
    }

    // 미매치 — 디버깅용 길이/접두 정보만 로깅 (시그니처 자체는 노출하지 않음)
    console.warn('[WEBHOOK] Signature mismatch', {
      received_count: candidates.length,
      received_len: candidates[0]?.length ?? 0,
      expected_hex_len: computedHex.length,
      expected_b64_len: computedB64.length,
    });
    return false;
  } catch (err) {
    console.error('[WEBHOOK] Signature verification error:', err);
    return false;
  }
}

// Replay-attack defense.
// 🛡️ 2026-05-24 V2 docs audit: Toss V2 재전송 정책은 최대 7회 ~ 4096분 (3일 19시간) 후까지.
//   기존 30분은 너무 짧아 7번째 재전송 webhook 이 legitimate 인데도 replay 로 거부될 위험.
//   → 96시간 (4일) 안전 마진. 단, V2 docs 가 시그니처/타임스탬프 헤더를 명시하지 않으므로
//   실질적으로 이 검증은 헤더가 존재할 때만 작동 (graceful 정책 — verifyTossSignature 분기 참조).
const WEBHOOK_TIMESTAMP_TOLERANCE_SEC = 96 * 60 * 60;

function verifyTimestamp(timestampHeader: string | undefined | null): boolean {
  if (!timestampHeader) return false; // require timestamp in production
  const ts = parseInt(timestampHeader, 10);
  if (isNaN(ts)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return Math.abs(nowSec - ts) <= WEBHOOK_TIMESTAMP_TOLERANCE_SEC;
}

// ---- Main Webhook Endpoint ----
webhookRouter.post('/', webhookIntakeLimiter, async (c) => {
  const startTime = Date.now();

  // Always return 200 to prevent Toss retries
  // Process errors internally

  let webhookEventId: string | null = null;
  const orderRepo = new OrderRepository(c.env.DB);
  const webhookRepo = new WebhookEventRepository(c.env.DB);

  try {
    // 1. Read raw body — must happen before any other logic
    const rawBody = await c.req.text();

    // 2. Verify signature FIRST — reject before any DB access
    const isProduction = c.env.ENVIRONMENT === 'production';
    const webhookSecret = c.env.TOSS_WEBHOOK_SECRET;
    const callerIp = c.req.header('CF-Connecting-IP') ?? null;

    // 2a. (선택) IP allowlist — TOSS_WEBHOOK_IP_ALLOWLIST 가 설정되어 있을 때만 적용.
    //     defense-in-depth: 시그니처 검증 전 이른 차단으로 무차별 시도 비용 절감.
    const ipAllowlist = getTossIpAllowlist(c.env);
    if (ipAllowlist.length > 0 && callerIp && !ipAllowlist.includes(callerIp)) {
      console.warn('[WEBHOOK] ❌ IP_NOT_ALLOWED', { ip: callerIp });
      captureException(new Error('WEBHOOK_IP_NOT_ALLOWED'), {
        tags: { area: 'webhook', kind: 'ip_not_allowed', severity: 'warning' },
        extra: { ip: callerIp },
      }).catch(swallow('webhook:sentry-ip'));
      return c.json({ received: false, status: 'rejected', error: 'ip_not_allowed' }, 403);
    }

    // ⚠️ CRITICAL (2026-05-24 V2 docs audit):
    //   Toss V2 webhook docs (docs.tosspayments.com/guides/webhook) 에 HMAC 시그니처 / 헤더
    //   언급이 0건. Status Page webhook docs 는 "서명·인증 헤더 없음" 명시.
    //   → V2 webhook 은 시그니처를 안 보낼 가능성 매우 높음.
    //
    //   따라서 시그니처 검증은 *graceful* 정책:
    //     - 헤더 존재 + secret 설정 → 엄격히 검증 (불일치 401)
    //     - 헤더 없음 → 통과하되 경고 로깅. 다른 방어선이 작동:
    //         ① IP allowlist (TOSS_WEBHOOK_IP_ALLOWLIST)
    //         ② idempotency (webhook_events 테이블)
    //         ③ amount 재검증 (DB sum 과 webhook totalAmount 비교)
    //         ④ paid order → cancel 거부 (handlePaymentCancelled)
    //         ⑤ 결제 confirm 은 webhook 이 아니라 별도 /confirm API 로 동기 실행
    //
    //   Toss 가 시그니처를 추가하는 날이 와도 이 정책은 안전 (헤더 오면 검증).
    const { value: signatureHeader, matched: sigHeaderName } = readFirstHeader(c, SIGNATURE_HEADER_CANDIDATES);
    const { value: timestampHeader, matched: tsHeaderName } = readFirstHeader(c, TIMESTAMP_HEADER_CANDIDATES);

    if (signatureHeader && webhookSecret) {
      // 시그니처 헤더 + secret 둘 다 있을 때만 엄격 검증.
      const isValid = await verifyTossSignature(rawBody, signatureHeader, webhookSecret);
      if (!isValid) {
        console.error('[WEBHOOK] ❌ INVALID_SIGNATURE', {
          ip: callerIp,
          header_matched: sigHeaderName,
        });
        captureException(new Error('WEBHOOK_INVALID_SIGNATURE'), {
          tags: { area: 'webhook', kind: 'invalid_signature', severity: 'warning' },
          extra: { ip: callerIp, header_matched: sigHeaderName },
        }).catch(swallow('webhook:sentry-sig'));
        return c.json({ received: false, status: 'rejected', error: 'invalid_signature' }, 401);
      }
      // 시그니처가 valid 일 때만 timestamp 도 엄격 검증 (replay 방어).
      if (timestampHeader && !verifyTimestamp(timestampHeader)) {
        console.error('[WEBHOOK] ❌ INVALID_TIMESTAMP — possible replay attack', {
          timestamp: timestampHeader,
          header_matched: tsHeaderName,
          ip: callerIp,
        });
        captureException(new Error('WEBHOOK_INVALID_TIMESTAMP'), {
          tags: { area: 'webhook', kind: 'invalid_timestamp', severity: 'warning' },
          extra: { timestamp: timestampHeader, header_matched: tsHeaderName, ip: callerIp },
        }).catch(swallow('webhook:sentry-ts'));
        return c.json({ received: false, status: 'rejected', error: 'invalid_timestamp' }, 401);
      }
    } else if (isProduction) {
      // 시그니처 헤더 없음 — Toss V2 정상 동작 (docs 에 명시 안 됨).
      // 단, secret 이 설정되어 있는데 헤더가 안 오는 건 의심스러우니 한 번씩 로깅.
      if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] no signature header — falling back to IP/amount defenses', {
        has_secret: Boolean(webhookSecret),
        ip: callerIp,
      });
    } else if (!webhookSecret) {
      console.warn('[WEBHOOK] ⚠️ Non-production: webhook secret not set — verification skipped');
    }

    // 3. Parse payload
    let payload: TossWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as TossWebhookPayload;
    } catch {
      console.error('[WEBHOOK] Failed to parse payload');
      return c.json({ received: true, status: 'parse_error' }, 200);
    }

    const { eventType, data } = payload;
    const tossOrderId = data.orderId;   // This is our order_number
    const paymentKey = data.paymentKey;

    if (process.env.NODE_ENV !== 'production') {
      console.log('[WEBHOOK] RECEIVED', {
        eventType,
        tossOrderId,
        paymentKey: paymentKey ? paymentKey.slice(0, 8) + '...' : null,
        status: data.status,
        amount: data.totalAmount,
      });
    }

    // 4. Idempotency check - prevent duplicate processing
    const alreadyProcessed = await webhookRepo.isAlreadyProcessed(eventType, tossOrderId);
    if (alreadyProcessed) {
      if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] DUPLICATE_SKIPPED', { eventType, tossOrderId });
      return c.json({ received: true, status: 'duplicate_skipped' }, 200);
    }

    // 5. Record the event first (for audit trail)
    webhookEventId = await webhookRepo.record(
      eventType,
      payload,
      tossOrderId,
      tossOrderId  // order_number equals tossOrderId in Toss flow
    );

    // 6. Process by event type — Toss V2 docs 사양 일치.
    //    ref: docs.tosspayments.com/guides/webhook (이벤트 타입 8개)
    //    PAYMENT_STATUS_CHANGED → status 필드로 세분화 분기:
    //      DONE → confirmed, CANCELED/PARTIAL_CANCELED → cancelled, ABORTED/EXPIRED → failed,
    //      WAITING_FOR_DEPOSIT → virtual_account_issued, IN_PROGRESS / READY → no-op.
    //    DEPOSIT_CALLBACK → 가상계좌 입금 완료/취소 (별도 이벤트).
    //    CANCEL_STATUS_CHANGED → 취소 상태 변경 (전체/부분).
    //    METHOD_UPDATED / CUSTOMER_STATUS_CHANGED → 브랜드페이 (현재 미사용).
    //    payout.changed / seller.changed → 지급대행 (현재 미사용).
    //    ORDER_PAYMENT_STATUS_CHANGED → 링크페이 주문 (현재 미사용).
    //
    //    🛡️ legacy 이벤트 (payment.confirmed 등) 도 fallback 유지 — 옛 등록 webhook 호환.
    const status = String((data as { status?: string }).status || '').toUpperCase();
    switch (eventType as string) {
      // ─── Toss V2 docs 표준 이벤트 ──────────────────────────────
      case 'PAYMENT_STATUS_CHANGED':
        // status 로 세분화 분기.
        if (status === 'DONE') {
          await handlePaymentConfirmed(orderRepo, data, tossOrderId, paymentKey, c.env.DB, c.env);
        } else if (status === 'CANCELED' || status === 'PARTIAL_CANCELED') {
          await handlePaymentCancelled(orderRepo, data, tossOrderId, c.env, c.env.DB);
        } else if (status === 'ABORTED' || status === 'EXPIRED') {
          await handlePaymentFailed(orderRepo, data, tossOrderId, c.env);
        } else if (status === 'WAITING_FOR_DEPOSIT') {
          await handleVirtualAccountIssued(orderRepo, data, tossOrderId);
        } else {
          // IN_PROGRESS / READY 등 — audit only.
          if (process.env.NODE_ENV !== 'production') console.log('[Webhook] PAYMENT_STATUS_CHANGED transient:', { tossOrderId, status });
          await webhookRepo.markSkipped(webhookEventId, `payment_status_transient:${status}`);
          return c.json({ received: true, status: 'audited' }, 200);
        }
        break;

      case 'DEPOSIT_CALLBACK':
        // 가상계좌 입금 알림 — docs: 입금 / 입금 취소 둘 다 트리거.
        //   data.status 'DONE' → 입금 완료, 'CANCELED' → 입금 취소 (반환).
        if (status === 'DONE') {
          await handleVirtualAccountDeposited(orderRepo, data, tossOrderId, paymentKey, c.env.DB);
        } else if (status === 'CANCELED') {
          await handlePaymentCancelled(orderRepo, data, tossOrderId, c.env, c.env.DB);
        } else {
          if (process.env.NODE_ENV !== 'production') console.log('[Webhook] DEPOSIT_CALLBACK other:', { tossOrderId, status });
          await webhookRepo.markSkipped(webhookEventId, `deposit_callback_other:${status}`);
          return c.json({ received: true, status: 'audited' }, 200);
        }
        break;

      case 'CANCEL_STATUS_CHANGED':
        // 결제 취소 상태 (전체/부분).
        await handlePaymentCancelled(orderRepo, data, tossOrderId, c.env, c.env.DB);
        break;

      case 'METHOD_UPDATED':
      case 'CUSTOMER_STATUS_CHANGED':
      case 'payout.changed':
      case 'seller.changed':
      case 'ORDER_PAYMENT_STATUS_CHANGED':
        // 현재 미사용 (브랜드페이 / 지급대행 / 링크페이) — audit only.
        if (process.env.NODE_ENV !== 'production') console.log('[Webhook] unused event type:', { eventType, tossOrderId });
        await webhookRepo.markSkipped(webhookEventId, `unused_event:${eventType}`);
        return c.json({ received: true, status: 'audited' }, 200);

      // ─── Legacy 이벤트 (옛 등록 webhook 호환 — 점진 deprecated) ─
      case 'payment.confirmed':
        await handlePaymentConfirmed(orderRepo, data, tossOrderId, paymentKey, c.env.DB, c.env);
        break;
      case 'payment.cancelled':
      case 'payment.partial_canceled':
        await handlePaymentCancelled(orderRepo, data, tossOrderId, c.env, c.env.DB);
        break;
      case 'payment.failed':
        await handlePaymentFailed(orderRepo, data, tossOrderId, c.env);
        break;
      case 'payment.virtual_account_issued':
        await handleVirtualAccountIssued(orderRepo, data, tossOrderId);
        break;
      case 'payment.virtual_account_deposited':
        await handleVirtualAccountDeposited(orderRepo, data, tossOrderId, paymentKey, c.env.DB);
        break;
      case 'refund_completed':
        if (process.env.NODE_ENV !== 'production') console.log('[Webhook] refund_completed:', tossOrderId);
        await webhookRepo.markSkipped(webhookEventId, 'refund_completed_already_handled');
        return c.json({ received: true, status: 'audited' }, 200);
      case 'dispute_raised':
        await sendAlert(c.env, {
          severity: 'critical',
          title: '결제 분쟁 발생',
          message: `주문 ${tossOrderId}에 분쟁 제기됨`,
          context: { orderNumber: tossOrderId, paymentKey, payload },
        }).catch(swallow('webhook:dispute-alert-CRITICAL'));
        await webhookRepo.markSkipped(webhookEventId, 'dispute_requires_manual_handling');
        return c.json({ received: true, status: 'dispute_alerted' }, 200);

      default:
        // Unknown event — alert for investigation.
        if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] UNHANDLED_EVENT_TYPE', { eventType });
        await sendAlert(c.env, {
          severity: 'warn',
          title: `알 수 없는 Toss 이벤트: ${eventType}`,
          message: `${tossOrderId}에 대한 미지원 이벤트 수신`,
          context: { eventType, orderNumber: tossOrderId },
        }).catch(swallow('webhook:unknown-event-alert'));
        await webhookRepo.markSkipped(webhookEventId, `unknown_event:${eventType}`);
        return c.json({ received: true, status: 'unhandled' }, 200);
    }

    // 7. Mark as processed
    await webhookRepo.markProcessed(webhookEventId);

    const elapsed = Date.now() - startTime;
    if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] PROCESSED_SUCCESS', {
      eventType,
      tossOrderId,
      elapsed_ms: elapsed,
    });

    return c.json({ received: true, status: 'processed' }, 200);

  } catch (err) {
    // CRITICAL: Always return 200 even on errors
    // Log the error but don't let Toss retry (which could cause duplicate charges)
    const error = err instanceof Error ? err.message : String(err);
    console.error('[WEBHOOK] PROCESSING_ERROR', {
      error,
      webhookEventId,
      elapsed_ms: Date.now() - startTime,
    });

    if (webhookEventId) {
      try {
        const webhookRepo2 = new WebhookEventRepository(c.env.DB);
        await webhookRepo2.markFailed(webhookEventId, error);
      } catch (innerErr) {
        console.error('[WEBHOOK] Failed to mark event as failed:', innerErr);
      }
    }

    return c.json({ received: true, status: 'error' }, 200);
  }
});

// ============================================================
// Event Handlers
// ============================================================

/**
 * payment.confirmed - Toss confirmed the payment
 * Update all orders with this order_number to DONE/PAID
 */
async function handlePaymentConfirmed(
  orderRepo: OrderRepository,
  data: TossWebhookPayload['data'],
  orderNumber: string,
  paymentKey: string,
  DB?: D1Database,
  env?: Env,
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] PAYMENT_CONFIRMED', {
    orderNumber,
    amount: data.totalAmount,
    method: data.method,
  });

  // Check idempotency: already PAID/DONE?
  const alreadyDone = await orderRepo.isAlreadyProcessed(orderNumber, 'DONE');
  const alreadyPaid = await orderRepo.isAlreadyProcessed(orderNumber, 'PAID');
  if (alreadyDone || alreadyPaid) {
    if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] ORDER_ALREADY_CONFIRMED', { orderNumber });
    return;
  }

  // 🛡️ SECURITY: Verify webhook amount matches the original order amount.
  // Multi-seller checkouts split into multiple `orders` rows under one order_number,
  // so we sum total_amount across all rows and compare to the webhook payload.
  // If a forged/replayed webhook arrives with a tampered totalAmount it is rejected
  // before status flips to PAID/DONE.
  if (DB) {
    try {
      const expectedRow = await DB.prepare(
        'SELECT COALESCE(SUM(total_amount), 0) AS expected FROM orders WHERE order_number = ?'
      ).bind(orderNumber).first<{ expected: number }>();
      const expectedAmount = Number(expectedRow?.expected ?? 0);
      const webhookAmount = Number(data.totalAmount ?? 0);
      // Allow exact match only — Toss returns integer KRW amounts.
      if (expectedAmount > 0 && webhookAmount !== expectedAmount) {
        console.error('[WEBHOOK] ❌ AMOUNT_MISMATCH — refusing to confirm', {
          orderNumber,
          expectedAmount,
          webhookAmount,
        });
        captureException(new Error('WEBHOOK_AMOUNT_MISMATCH'), {
          tags: { area: 'webhook', kind: 'amount_mismatch', severity: 'critical' },
          extra: { orderNumber, expectedAmount, webhookAmount },
        }).catch(swallow('webhook:sentry-amount'));
        return; // do NOT confirm — leave order in current state for manual review
      }
    } catch (err) {
      console.error('[WEBHOOK] amount verification query failed:', err);
      // Fail-closed: do not confirm if we cannot verify the amount
      return;
    }
  }

  // v24 FIX: UPDATE orders + UPDATE order_items를 D1 batch로 묶어 atomic 처리.
  // 기존 updateStatus + 루프 reduceStock은 중간 실패 시 orders=DONE이지만
  // order_items는 PENDING 상태가 남는 불일치 발생 가능.
  const result = await orderRepo.confirmPaymentAtomic(orderNumber, {
    toss_payment_key: paymentKey,
    toss_order_id: orderNumber,
    payment_method: data.method,
    paid_at: data.approvedAt ?? new Date().toISOString(),
  });

  if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] PAYMENT_CONFIRMED_COMPLETE', {
    orderNumber,
    ordersUpdated: result.confirmed,
  });

  // 🛡️ 2026-05-05: 디지털 상품 access_token 발급 (Phase 1)
  //   주문에 product_kind != 'physical' 인 항목이 있으면 digital_product_access 발급.
  //   best-effort — 실패해도 결제는 성공 (수동 복구 가능).
  if (DB && result.confirmed > 0) {
    try {
      const digitalItems = await DB.prepare(`
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
          // crypto.randomUUID() — Cloudflare Workers 지원
          const token = crypto.randomUUID();
          const expiresAt = item.access_duration_days
            ? `datetime('now', '+${Number(item.access_duration_days)} days')`
            : 'NULL';
          return DB.prepare(`
            INSERT OR IGNORE INTO digital_product_access
            (user_id, product_id, order_id, order_item_id, access_token, expires_at, status)
            VALUES (?, ?, ?, ?, ?, ${expiresAt}, 'active')
          `).bind(item.user_id, item.product_id, item.order_id, item.order_item_id, token);
        });
        await DB.batch(stmts);
        // 알림 발송 — 디지털 상품 구매 후 마이페이지 접근 안내
        const userId = digitalItems.results[0].user_id;
        await DB.prepare(`
          INSERT INTO notifications (user_id, user_type, type, title, message, link)
          VALUES (?, 'user', 'digital_purchase', ?, ?, '/my/digital')
        `).bind(userId, '디지털 상품 구매 완료', '마이페이지 → 디지털 보관함에서 다운로드/시청 가능합니다').run().catch(swallow('webhook:digital-notification'));
      }
    } catch (err) {
      if (DB) console.error('[WEBHOOK] digital access grant failed:', err);
    }
  }

  // 🔐 2026-06-11 [UNLOCK] (사용자 승인 — 머니 감사 Med-C): 커미션 적립 (에이전시/영입자/공급자).
  //   /confirm 에만 있던 적립을 webhook 확정 경로에도 추가 — 브라우저가 confirm 못 보내고 webhook
  //   만 도착해도 커미션 누락 없음. 3종 모두 order_id 멱등 → /confirm 과 둘 다 와도 안전(이중적립 X).
  if (DB && result.confirmed > 0) {
    try {
      const wOrders = await DB.prepare(
        'SELECT id, seller_id, total_amount FROM orders WHERE order_number = ?'
      ).bind(orderNumber).all<{ id: number; seller_id: number | null; total_amount: number | null }>().catch(() => ({ results: [] as { id: number; seller_id: number | null; total_amount: number | null }[] }))
      const { creditOrderCommissions } = await import('../utils/order-commissions')
      await creditOrderCommissions(DB, wOrders.results || [])
    } catch (e) {
      console.error('[WEBHOOK] commission credit failed:', String(e).slice(0, 200))
    }
  }

  // 💸 2026-06-26 [UNLOCK] (대표 승인 "3건 다 고쳐" — 소비자 감사): webhook 확정 경로 side-effect 누락 보강.
  //   /confirm 에만 있던 ① 혼합결제 딜 차감 ② KT-Alpha 교환권 발송 을 webhook 에도 추가 — 브라우저가
  //   confirm 못 보내고 webhook 만 도착해도 딜 미차감/교환권 미발송이 없게. confirmPaymentAtomic CAS
  //   (result.confirmed>0)가 confirm↔webhook 단일실행을 보장 → 이중차감/이중발송 없음(KT 는 per-order 멱등도).
  //   ⚠️ Toss 시그니처/금액검증/confirmPaymentAtomic 무수정 — side-effect 배선만.
  if (DB && result.confirmed > 0) {
    // ① 혼합결제(Toss+딜) 딜 사용분 차감 — payment.routes `/confirm` 과 동일 로직(adjustUserPoints CAS guardBalance).
    try {
      const { adjustUserPoints } = await import('../utils/point-ledger')
      const dealRows = await DB.prepare(
        'SELECT id, user_id, deal_used FROM orders WHERE order_number = ?'
      ).bind(orderNumber).all<{ id: string | number; user_id: string | number | null; deal_used: number | null }>().catch(() => ({ results: [] as Array<{ id: string | number; user_id: string | number | null; deal_used: number | null }> }))
      for (const r of (dealRows?.results ?? [])) {
        const used = Math.max(0, Math.round(Number(r.deal_used ?? 0)))
        if (used > 0 && r.user_id != null) {
          const res = await adjustUserPoints(DB, {
            userId: r.user_id, delta: -used, type: 'order_payment',
            description: `주문 결제 딜 사용 (#${r.id})`, orderId: r.id, guardBalance: true,
          })
          if (!res.ok && res.reason === 'insufficient') {
            const balRow = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?').bind(String(r.user_id)).first<{ balance: number }>().catch(() => null)
            const avail = Math.max(0, Number(balRow?.balance ?? 0))
            if (avail > 0) {
              await adjustUserPoints(DB, { userId: r.user_id, delta: -avail, type: 'order_payment', description: `주문 결제 딜 사용(부분 — 잔액부족) (#${r.id})`, orderId: r.id, guardBalance: true }).catch(() => {})
            }
          }
        }
      }
    } catch (e) {
      captureException(e as Error, { tags: { area: 'webhook', kind: 'deal_deduct' } }).catch(swallow('webhook:deal-deduct'))
    }

    // ② KT-Alpha 교환권 자동 발송 — auto_voucher_send=1 상품. autoSendKtAlpha 는 per-order 멱등(이미 발송 시 skip).
    if (env) {
      try {
        const ktOrders = await DB.prepare(
          'SELECT id, user_id, shipping_phone FROM orders WHERE order_number = ?'
        ).bind(orderNumber).all<{ id: number; user_id: string | number | null; shipping_phone: string | null }>().catch(() => ({ results: [] as Array<{ id: number; user_id: string | number | null; shipping_phone: string | null }> }))
        const ktList = ktOrders?.results ?? []
        if (ktList.length > 0) {
          const firstUser = ktList.find(o => o.user_id != null)?.user_id ?? ''
          const { autoSendKtAlphaVouchersForOrders } = await import('../utils/kt-alpha-auto-send')
          await autoSendKtAlphaVouchersForOrders(
            env as unknown as Parameters<typeof autoSendKtAlphaVouchersForOrders>[0],
            ktList.map(o => ({ id: Number(o.id), shipping_phone: o.shipping_phone ?? undefined, user_id: o.user_id })),
            String(firstUser),
          )
        }
      } catch (e) {
        console.error('[WEBHOOK] KT-Alpha send failed:', String(e).slice(0, 200))
      }
    }
  }

  // 🔔 2026-06-26 [UNLOCK] (대표 승인 "모두 해줘" — 소비자 감사 D): 결제완료 buyer 인앱 알림 — webhook 경로.
  //   /confirm 의 동일 'order_paid' 알림과 confirmPaymentAtomic CAS(result.confirmed>0)로 단일실행
  //   (confirm↔webhook 중 이긴 쪽만 도달 → 이중알림 없음). 셀러만 통보되고 buyer 무통보이던 누락 보강.
  //   ⚠️ Toss 시그니처/금액검증/confirmPaymentAtomic 무수정 — notifyUser side-effect 배선만.
  if (DB && result.confirmed > 0) {
    try {
      const { notifyUser } = await import('../../lib/notifications')
      const orow = await DB.prepare(
        'SELECT user_id FROM orders WHERE order_number = ? AND user_id IS NOT NULL LIMIT 1'
      ).bind(orderNumber).first<{ user_id: string | number | null }>().catch(() => null)
      if (orow?.user_id) {
        await notifyUser(
          DB, String(orow.user_id), 'order_paid',
          '✅ 결제가 완료됐어요', `주문 ${orderNumber} — ₩${Number(data.totalAmount ?? 0).toLocaleString('ko-KR')} 결제 완료`,
          '/my-orders',
        ).catch(() => {})
      }
    } catch (e) {
      console.error('[WEBHOOK] order_paid buyer notification failed:', String(e).slice(0, 200))
    }
    // 🔔 2026-07-01 [UNLOCK]: 셀러 '결제 확정' 대시보드 알림 — webhook 경로. 이전엔 /confirm(payment.routes:463)
    //   에만 있어, confirmPaymentAtomic CAS 로 webhook 이 이기면 셀러가 '💳 결제 확정' 벨을 못 받던
    //   비대칭(2026-06-26 buyer 알림은 대칭화됐으나 셀러 반쪽 누락) 보강. result.confirmed>0(단일실행)
    //   가드 하에서만 → 이중알림 없음. ⚠️ Toss 시그니처/금액검증/confirmPaymentAtomic 무수정 — 알림 배선만.
    try {
      const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
      const { results: sellerRows } = await DB.prepare(
        'SELECT seller_id, total_amount, order_number FROM orders WHERE order_number = ? AND seller_id IS NOT NULL'
      ).bind(orderNumber).all<{ seller_id: number | null; total_amount: number | null; order_number: string }>()
      for (const row of (sellerRows ?? [])) {
        if (!row.seller_id) continue
        await createDashboardNotification(
          DB, 'seller', String(row.seller_id), 'order_paid',
          '💳 결제 확정', `주문 ${row.order_number} — ₩${Number(row.total_amount ?? 0).toLocaleString('ko-KR')} 결제가 확정되었습니다`,
          '/seller/orders',
        ).catch(() => {})
      }
    } catch (e) {
      console.error('[WEBHOOK] seller order_paid notification failed:', String(e).slice(0, 200))
    }
  }

  // 🛡️ 2026-04-28 (TD-007 자동화): auction winner-paid 자동 처리.
  //   결제한 user 가 낙찰한 ended auction 이 있고 current_price 가 결제 amount 와
  //   같으면 해당 auction_holds 를 'consumed' 마킹. best-effort (실패해도 결제는 성공).
  if (DB) {
    try {
      const orders = await orderRepo.findByOrderNumber(orderNumber);
      const order = orders[0];
      if (order && order.user_id) {
        const consumeResult = await DB.prepare(`
          UPDATE auction_holds
          SET status = 'consumed', released_at = datetime('now')
          WHERE user_id = ? AND status = 'active'
            AND auction_id IN (
              SELECT id FROM live_auctions
              WHERE winner_user_id = ? AND status = 'ended' AND current_price = ?
            )
        `).bind(order.user_id, String(order.user_id), data.totalAmount).run();
        const changes = (consumeResult.meta as { changes?: number })?.changes ?? 0;
        if (changes > 0 && process.env.NODE_ENV !== 'production') {
          console.log('[WEBHOOK] AUCTION_HOLD_CONSUMED', { orderNumber, user_id: order.user_id, changes });
        }
      }
    } catch (e) {
      console.warn('[WEBHOOK] auction hold consume best-effort failed:', (e as Error).message);
    }
  }
}

/**
 * payment.cancelled - Payment was cancelled
 * Restore stock for all orders
 */
async function handlePaymentCancelled(
  orderRepo: OrderRepository,
  data: TossWebhookPayload['data'],
  orderNumber: string,
  env: Env,
  DB: D1Database
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] PAYMENT_CANCELLED', {
    orderNumber,
    cancelReason: data.failureMessage,
  });

  const orders = await orderRepo.findByOrderNumber(orderNumber);

  // ✅ SECURITY FIX (Payment C3): Reject cancel transition from paid/shipping/delivered.
  // A cancel webhook should only apply to orders that never completed payment
  // (PENDING / AWAITING_PAYMENT). Orders already PAID/DONE/SHIPPING/DELIVERED must
  // go through the refund API — otherwise an attacker who can forge a cancel
  // webhook could reverse status + restore stock while keeping the goods.
  const paidTerminalStatuses = ['PAID', 'DONE', 'SHIPPING', 'DELIVERED'];
  const hasPaidOrder = orders.some(o =>
    paidTerminalStatuses.includes((o.status || '').toUpperCase())
  );
  if (hasPaidOrder) {
    console.warn('[WEBHOOK] CANCEL_REJECTED_PAID_ORDER', {
      orderNumber,
      statuses: orders.map(o => o.status),
    });
    return; // skip — do not update status or restore stock
  }

  // ✅ CONCURRENCY FIX (Cron C2): atomically CAS each order to CANCELLED to prevent
  // double stock-restore (webhook + scheduled-cleanup may race). Only restore
  // stock for orders that actually transitioned in THIS call.
  const cancelledAt = data.cancelledAt ?? new Date().toISOString();
  const cancelReason = data.failureMessage ?? 'Payment cancelled';
  for (const order of orders) {
    // 🛡️ 2026-04-22: payment_status='cancelled' 동기화 (status 와 함께)
    const casResult = await DB.prepare(
      `UPDATE orders
       SET status = 'CANCELLED',
           payment_status = 'cancelled',
           cancelled_at = ?, cancel_reason = ?, updated_at = datetime('now')
       WHERE id = ?
         AND status NOT IN ('CANCELLED', 'REFUNDED', 'FAILED')`
    ).bind(cancelledAt, cancelReason, order.id).run();

    if ((casResult.meta?.changes ?? 0) === 0) {
      // Already cancelled/refunded/failed by another path — skip stock restore
      if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] STOCK_RESTORE_SKIPPED_ALREADY_TRANSITIONED', {
        orderId: order.id,
      });
      continue;
    }

    // Only restore stock when we actually transitioned the status
    await orderRepo.restoreStock(order.id);
    if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] STOCK_RESTORED', { orderId: order.id, sellerId: order.seller_id });
  }

  // ✅ SECURITY FIX (Payment C7): Reverse any referral commissions granted for
  // these orders so a cancel/refund cannot leave the inviter with free deals.
  // 🛡️ 2026-04-22: CAS 로 이중 회수 방어 — granted 인 commission 만 개별 전환 → 포인트 차감.
  // 이전: UPDATE 후 SELECT status='withdrawn' 하면 과거 회수분까지 포함 → 중복 차감 가능.
  try {
    for (const order of orders) {
      const orderId = order.id;
      const toRevoke = await DB.prepare(
        "SELECT id, user_id, amount FROM referral_commissions WHERE order_id = ? AND status = 'granted'"
      ).bind(orderId).all<{ id: number; user_id: string; amount: number }>().catch(() => ({ results: [] as Array<{ id: number; user_id: string; amount: number }> }));

      for (const co of (toRevoke.results || [])) {
        const cas = await DB.prepare(
          "UPDATE referral_commissions SET status = 'withdrawn', withdrawn_at = datetime('now') WHERE id = ? AND status = 'granted'"
        ).bind(co.id).run().catch(() => null);
        if (cas && (cas.meta?.changes ?? 0) > 0) {
          await DB.prepare(
            'UPDATE user_points SET balance = MAX(0, balance - ?) WHERE user_id = ?'
          ).bind(co.amount, co.user_id).run().catch((err) => {
            // 🛡️ 에러는 조용히 삼키지 말고 로깅 (감사 로그 누락 방어)
            console.error('[WEBHOOK] user_points debit failed:', { user_id: co.user_id, amount: co.amount, err });
          });
        }
      }
    }
  } catch (e) {
    console.error('[WEBHOOK] Commission reversal error:', e);
  }

  // v26 FIX: 결제 취소 시 coupon_uses 복원 (쿠폰 재사용 가능하게)
  // 상대 경로 사용 — esbuild worker 번들은 `@/` path alias를 dynamic import에서 resolve 안 함
  try {
    const { restoreCouponsForOrders } = await import('../../features/coupons/api/coupons.routes');
    const restored = await restoreCouponsForOrders(DB, orders.map(o => o.id));
    if (restored > 0 && process.env.NODE_ENV !== 'production') {
      console.log('[WEBHOOK] COUPON_RESTORED', { orderNumber, restored });
    }
  } catch (e) {
    console.warn('[WEBHOOK] Coupon restore skipped:', e);
  }

  // Send order cancellation notification
  await sendOrderNotification(orderRepo, orderNumber, 'cancelled', env)
    .catch(err => console.error('[WEBHOOK] Notification failed:', err));

  // 🔔 2026-07-01 [UNLOCK]: Toss webhook 취소 → buyer 인앱 알림. 기존 sendOrderNotification 은
  //   Discord 전용(운영 채널)이라 앱 알림함엔 취소 기록이 없었음. 앱-발화 취소(order.routes)는 이미
  //   notifyUser 하지만 Toss 측/비동기 취소는 이 webhook 만 도달 → 구매자 무통보. ⚠️ 결제취소/환불/
  //   커미션역전/쿠폰복원 로직 무수정 — notifyUser side-effect 1블록 추가만.
  try {
    const { notifyUser } = await import('../../lib/notifications');
    const orow = await DB.prepare(
      'SELECT user_id FROM orders WHERE order_number = ? AND user_id IS NOT NULL LIMIT 1'
    ).bind(orderNumber).first<{ user_id: string | number | null }>().catch(() => null);
    if (orow?.user_id) {
      await notifyUser(DB, String(orow.user_id), 'order_cancelled', '주문이 취소되었습니다', `주문 ${orderNumber}이(가) 취소되었습니다. 환불은 결제수단에 따라 처리됩니다.`, '/my-orders').catch(() => {});
    }
  } catch (e) {
    console.error('[WEBHOOK] order_cancelled buyer notification failed:', String(e).slice(0, 200));
  }

  if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] PAYMENT_CANCELLED_COMPLETE', {
    orderNumber,
    ordersUpdated: orders.length,
  });
}

/**
 * payment.failed - Payment failed
 * Update status to FAILED, notify user
 */
async function handlePaymentFailed(
  orderRepo: OrderRepository,
  data: TossWebhookPayload['data'],
  orderNumber: string,
  env: Env
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] PAYMENT_FAILED', {
    orderNumber,
    failureCode: data.failureCode,
    failureMessage: data.failureMessage,
  });

  // ✅ SCHEMA FIX: Removed webhook_processed_at / webhook_event_id (not in schema)
  await orderRepo.updateStatus(orderNumber, 'FAILED', {
    cancel_reason: `${data.failureCode ?? 'UNKNOWN'}: ${data.failureMessage ?? 'Payment failed'}`,
  });

  // Restore stock — reserveStock() was called at order creation (PENDING).
  const failedOrders = await orderRepo.findByOrderNumber(orderNumber);
  for (const order of failedOrders) {
    await orderRepo.restoreStock(order.id);
    if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] STOCK_RESTORED_ON_FAILURE', { orderId: order.id });
  }

  await sendOrderNotification(orderRepo, orderNumber, 'failed', env)
    .catch(err => console.error('[WEBHOOK] Notification failed:', err));

  // 🛡️ 2026-04-28: 어드민에 결제 실패 대시보드 알림
  createDashboardNotification(
    env.DB,
    'admin',
    null,
    'payment_failed',
    '결제 실패 (Toss)',
    `${orderNumber}: ${data.failureCode ?? 'UNKNOWN'} ${data.failureMessage ?? ''}`,
    '/admin/orders'
  ).catch(swallow('webhook:notify-payment-failed'));

  if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] PAYMENT_FAILED_COMPLETE', { orderNumber });
}

/**
 * payment.virtual_account_issued - Virtual account created, awaiting deposit
 */
async function handleVirtualAccountIssued(
  orderRepo: OrderRepository,
  data: TossWebhookPayload['data'],
  orderNumber: string
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] VIRTUAL_ACCOUNT_ISSUED', { orderNumber });

  // ✅ SCHEMA FIX: Removed webhook_processed_at / webhook_event_id (not in schema)
  await orderRepo.updateStatus(orderNumber, 'AWAITING_PAYMENT', {
    toss_order_id: orderNumber,
  });
}

/**
 * payment.virtual_account_deposited - Deposit received for virtual account
 */
async function handleVirtualAccountDeposited(
  orderRepo: OrderRepository,
  data: TossWebhookPayload['data'],
  orderNumber: string,
  paymentKey: string,
  DB?: D1Database
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') console.log('[WEBHOOK] VIRTUAL_ACCOUNT_DEPOSITED', { orderNumber });

  // Same as payment.confirmed — pass DB through so amount verification + digital
  // access grant + auction-hold consume run.
  await handlePaymentConfirmed(orderRepo, data, orderNumber, paymentKey, DB);
}

export { webhookRouter };
