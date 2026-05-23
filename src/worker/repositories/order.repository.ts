/**
 * PRIMARY Order Repository — used by worker/routes/order.routes.ts
 *
 * Handles: order creation, stock management, payment confirmation, webhooks
 * Uses QueryBuilder pattern with batch operations.
 *
 * ⚠️ DO NOT confuse with features/orders/repositories/OrderRepository.ts
 * which handles: tracking, purchase confirmation, cron jobs
 */
// ============================================================
// Order Repository
// ============================================================

import type { D1Database } from '@cloudflare/workers-types';
import { QueryBuilder } from './query-builder';
import type { Order, OrderItem, OrderStatus, CreateOrderRequest } from '../../shared/types';
import { safeJsonParse } from '../../shared/utils';
import { statusesThatCanReach } from '../utils/state-machine';

export class OrderRepository {
  protected qb: QueryBuilder;

  constructor(db: D1Database) {
    this.qb = new QueryBuilder(db);
  }

  /**
   * Create a new order with items (atomic batch)
   */
  async createOrder(
    userId: string,
    request: CreateOrderRequest,
    items: {
      product_id: string;
      seller_id: string;
      product_name: string;
      product_thumbnail?: string;  // mapped to product_image on INSERT
      product_sku?: string;        // ignored on INSERT (column doesn't exist)
      unit_price: number;
      quantity: number;
      subtotal: number;
      options?: Record<string, string>;
    }[],
    subtotal: number,
    shippingFee: number
  ): Promise<Order> {
    // 🛡️ 2026-04-22: 할인 로직 구현. 이전엔 discount_amount=0 hardcode → 쿠폰/포인트 미반영.
    // request.discount_amount (쿠폰+포인트 합산) + 서버 검증 후 저장.
    // 서버 재계산: total_amount = subtotal + shipping - discount (음수 방지)
    const requestedDiscount = Number((request as any).discount_amount ?? 0);
    // 검증: 0 <= discount <= subtotal+shipping (음수 결제 방지)
    const safeDiscount = Math.max(0, Math.min(requestedDiscount, subtotal + shippingFee));
    const totalAmount = Math.max(0, subtotal + shippingFee - safeDiscount);

    // Step 1: INSERT order — id 생략하여 INTEGER PRIMARY KEY AUTOINCREMENT 호환
    // seller_id 처리: 빈 문자열/null → DB 스키마에 따라 분기
    //   - NOT NULL 스키마 (001_initial.sql): seller_id 컬럼 생략하면 DEFAULT 부재로 실패
    //   - nullable 스키마 (0128 migration): null 전달 OK
    // 안전 전략: seller_id가 있으면 포함, 없으면 INSERT 컬럼 자체를 제외
    const hasSellerId = !!request.seller_id;
    const hasStreamId = !!(request as any).live_stream_id;

    // 🛡️ 2026-05-22 영구 fix v2 — commission_rate snapshot:
    //   ① sellers.commission_rate SELECT (try/catch graceful — column 부재 OK).
    //   ② INSERT 1차: commission_rate 포함 시도.
    //   ③ 실패 (orders.commission_rate 컬럼 부재 등) → INSERT 2차: 컬럼 제외 fallback.
    //   ④ 둘 다 실패 시 throw (실제 INSERT 자체 깨짐).
    //   repair-schema 에서 orders.commission_rate 컬럼 ensure (멱등 ALTER) → 다음 cron 후 1차 성공.
    let commissionSnapshot: number | null = null;
    if (hasSellerId) {
      try {
        const sellerRow = await this.qb.queryOne<{ commission_rate: number | null }>(
          'SELECT commission_rate FROM sellers WHERE id = ?',
          [request.seller_id],
        );
        if (sellerRow?.commission_rate != null) {
          const v = Number(sellerRow.commission_rate);
          if (Number.isFinite(v) && v >= 0 && v <= 100) commissionSnapshot = v;
        }
      } catch { /* graceful — column missing or query failure */ }
    }

    const baseColumns = [
      'order_number', 'user_id',
      ...(hasSellerId ? ['seller_id'] : []),
      ...(hasStreamId ? ['live_stream_id'] : []),
      'subtotal', 'shipping_fee', 'discount_amount', 'total_amount', 'currency',
      'status', 'shipping_name', 'shipping_phone', 'shipping_address', 'shipping_memo',
      'idempotency_key', 'locale',
    ];
    const baseValues: any[] = [
      request.order_number,
      userId,
      ...(hasSellerId ? [request.seller_id] : []),
      ...(hasStreamId ? [(request as any).live_stream_id] : []),
      subtotal,
      shippingFee,
      safeDiscount,
      totalAmount,
      'KRW',
      'PENDING',
      request.shipping_name,
      request.shipping_phone,
      JSON.stringify(request.shipping_address),
      request.shipping_memo ?? null,
      request.idempotency_key,
      'ko',
    ];

    // 1차 시도 — commission_rate 포함 (commission_rate 컬럼 있는 production)
    let orderResult: { meta: { last_row_id?: number | string }; success: boolean } | null = null;
    const tryWithCommission = commissionSnapshot != null;
    if (tryWithCommission) {
      try {
        const cols = [...baseColumns, 'commission_rate'];
        const vals = [...baseValues, commissionSnapshot];
        const ph = cols.map(() => '?').join(', ');
        orderResult = await this.qb.execute(
          `INSERT INTO orders (${cols.join(', ')}) VALUES (${ph})`,
          vals,
        );
      } catch (err) {
        // 컬럼 부재 / type mismatch → 2차 fallback.
        if (typeof console !== 'undefined') {
          console.warn('[OrderRepository] INSERT with commission_rate failed, falling back without it:', (err as Error).message);
        }
      }
    }
    // 2차 — commission_rate 컬럼 없이 (graceful — DB DEFAULT 10 사용)
    if (!orderResult) {
      const ph = baseColumns.map(() => '?').join(', ');
      orderResult = await this.qb.execute(
        `INSERT INTO orders (${baseColumns.join(', ')}) VALUES (${ph})`,
        baseValues,
      );
    }

    // Step 2: 실제 order id 조회 (TEXT or INTEGER 스키마 모두 호환)
    // meta.last_row_id는 내부 rowid(정수)로, TEXT PRIMARY KEY 스키마에서는 실제 id와 다름
    const orderRow = await this.qb.queryOne<{ id: string }>(
      'SELECT id FROM orders WHERE idempotency_key = ?',
      [request.idempotency_key]
    );
    if (!orderRow) throw new Error('Order creation failed: could not retrieve order id');
    const orderId = String(orderRow.id);

    // Step 3: order_items 일괄 삽입 (id 생략 → 자동증가)
    // ✅ SCHEMA FIX: Production order_items has `product_image` (NOT product_thumbnail);
    //   no `product_sku` column. Required NOT NULL: product_name, price, quantity.
    if (items.length > 0) {
      const itemStmts = items.map(item => ({
        sql: `INSERT INTO order_items (
          order_id, product_id, seller_id,
          product_name, product_image,
          price, unit_price, quantity, subtotal, currency, options, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'KRW', ?, 'PENDING')`,
        params: [
          orderId,
          item.product_id,
          item.seller_id || null,
          item.product_name,
          item.product_thumbnail ?? null,  // UI uses product_thumbnail, DB column is product_image
          item.unit_price,       // price (NOT NULL)
          item.unit_price,       // unit_price
          item.quantity,
          item.subtotal,
          JSON.stringify(item.options ?? {}),
        ],
      }));

      await this.qb.batch(itemStmts);
    }

    const order = await this.findById(orderId);
    if (!order) throw new Error('Order creation failed');
    return order;
  }

  /**
   * Find order by ID with items
   */
  async findById(orderId: string): Promise<Order | null> {
    const row = await this.qb.queryOne<Record<string, unknown>>(
      `SELECT o.*, s.name as seller_name, s.phone as seller_phone, s.kakao_chat_url as seller_kakao_chat_url
       FROM orders o
       LEFT JOIN sellers s ON o.seller_id = s.id
       WHERE o.id = ?`,
      [orderId]
    );
    if (!row) return null;

    const items = await this.qb.queryMany<Record<string, unknown>>(
      'SELECT id, order_id, product_id, product_name, quantity, unit_price, total_price, options FROM order_items WHERE order_id = ? ORDER BY id',
      [orderId]
    );

    return this.mapOrder(row, items);
  }

  /**
   * Find orders by order_number (multi-seller: multiple orders per checkout)
   */
  async findByOrderNumber(orderNumber: string): Promise<Order[]> {
    const rows = await this.qb.queryMany<Record<string, unknown>>(
      `SELECT o.*, s.name as seller_name, s.phone as seller_phone, s.kakao_chat_url as seller_kakao_chat_url
       FROM orders o
       LEFT JOIN sellers s ON o.seller_id = s.id
       WHERE o.order_number = ?
       ORDER BY o.created_at`,
      [orderNumber]
    );

    const orders = await Promise.all(
      rows.map(async row => {
        const items = await this.qb.queryMany<Record<string, unknown>>(
          'SELECT id, order_id, product_id, product_name, quantity, unit_price, total_price, options FROM order_items WHERE order_id = ? ORDER BY id',
          [row['id']]
        );
        return this.mapOrder(row, items);
      })
    );

    return orders;
  }

  /**
   * Find orders by user ID with pagination
   */
  async findByUserId(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{ orders: Order[]; total: number }> {
    const offset = (page - 1) * limit;

    const countRow = await this.qb.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM orders WHERE user_id = ?',
      [userId]
    );
    const total = countRow?.count ?? 0;

    // 🛡️ 2026-05-14: sellers.kakao_chat_url 컬럼은 migration 0041/0128 으로 추가됐지만
    //   production D1 에 미적용 가능성 → SQL error → 500. fallback 쿼리로 보호.
    let rows: Record<string, unknown>[];
    try {
      rows = await this.qb.queryMany<Record<string, unknown>>(
        `SELECT o.*, s.name as seller_name, s.phone as seller_phone, s.kakao_chat_url as seller_kakao_chat_url
         FROM orders o
         LEFT JOIN sellers s ON o.seller_id = s.id
         WHERE o.user_id = ?
         ORDER BY o.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );
    } catch (e) {
      const msg = (e as Error).message || '';
      if (/no such column|kakao_chat_url|seller_phone/i.test(msg)) {
        // 컬럼 누락 시 최소 필수 컬럼만으로 fallback (kakao_chat_url + phone 제외)
        rows = await this.qb.queryMany<Record<string, unknown>>(
          `SELECT o.*, s.name as seller_name
           FROM orders o
           LEFT JOIN sellers s ON o.seller_id = s.id
           WHERE o.user_id = ?
           ORDER BY o.created_at DESC
           LIMIT ? OFFSET ?`,
          [userId, limit, offset]
        );
      } else {
        throw e;
      }
    }

    const orders = await Promise.all(
      rows.map(async row => {
        const items = await this.qb.queryMany<Record<string, unknown>>(
          'SELECT id, order_id, product_id, product_name, quantity, unit_price, total_price, options FROM order_items WHERE order_id = ? ORDER BY id',
          [row['id']]
        );
        return this.mapOrder(row, items);
      })
    );

    return { orders, total };
  }

  /**
   * Update order status
   */
  async updateStatus(
    orderNumber: string,
    status: OrderStatus,
    extra?: {
      toss_payment_key?: string;
      toss_order_id?: string;
      payment_method?: string;
      paid_at?: string;
      cancelled_at?: string;
      cancel_reason?: string;
      /** @deprecated — column doesn't exist in production schema. Tracked in webhook_events table. */
      webhook_processed_at?: string;
      /** @deprecated — column doesn't exist in production schema. Tracked in webhook_events table. */
      webhook_event_id?: string;
    }
  ): Promise<void> {
    const setFields: string[] = ['status = ?'];
    const params: unknown[] = [status];

    if (extra?.toss_payment_key) {
      setFields.push('toss_payment_key = ?');
      params.push(extra.toss_payment_key);
    }
    if (extra?.toss_order_id) {
      setFields.push('toss_order_id = ?');
      params.push(extra.toss_order_id);
    }
    if (extra?.payment_method) {
      setFields.push('payment_method = ?');
      params.push(extra.payment_method);
    }
    if (extra?.paid_at) {
      setFields.push('paid_at = ?');
      params.push(extra.paid_at);
    }
    if (extra?.cancelled_at) {
      setFields.push('cancelled_at = ?');
      params.push(extra.cancelled_at);
      setFields.push('cancel_reason = ?');
      params.push(extra.cancel_reason ?? null);
    }
    // ✅ SCHEMA FIX: webhook_processed_at / webhook_event_id columns don't
    // exist on `orders`. Idempotency is tracked in the `webhook_events` table.

    // ✅ CONCURRENCY: enforce state machine via `status IN (allowed_prev)` so
    // two concurrent transitions (e.g. webhook + cron) cannot rewrite each
    // other's work. If the transition is illegal we silently no-op (same
    // behaviour as before but without corrupting the order).
    const allowedPrev = statusesThatCanReach(String(status));
    if (allowedPrev.length === 0) {
      // No source state can reach `status` — abort silently.
      return;
    }
    const prevPlaceholders = allowedPrev.map(() => '?').join(',');

    params.push(orderNumber);

    await this.qb.execute(
      `UPDATE orders SET ${setFields.join(', ')}, updated_at = datetime('now')
       WHERE order_number = ?
         AND UPPER(status) IN (${prevPlaceholders})`,
      [...params, ...allowedPrev],
    );
  }

  /**
   * Update status of a single order (by ID)
   */
  async updateStatusById(
    orderId: string,
    status: OrderStatus,
    extra?: Parameters<typeof this.updateStatus>[2]
  ): Promise<void> {
    const setFields: string[] = ['status = ?'];
    const params: unknown[] = [status];

    if (extra?.toss_payment_key) {
      setFields.push('toss_payment_key = ?');
      params.push(extra.toss_payment_key);
    }
    if (extra?.toss_order_id) {
      setFields.push('toss_order_id = ?');
      params.push(extra.toss_order_id);
    }
    if (extra?.payment_method) {
      setFields.push('payment_method = ?');
      params.push(extra.payment_method);
    }
    if (extra?.paid_at) {
      setFields.push('paid_at = ?');
      params.push(extra.paid_at);
    }
    if (extra?.cancelled_at) {
      setFields.push('cancelled_at = ?');
      params.push(extra.cancelled_at);
      setFields.push('cancel_reason = ?');
      params.push(extra.cancel_reason ?? null);
    }
    // ✅ SCHEMA FIX: webhook_processed_at / webhook_event_id columns don't exist.

    // ✅ CONCURRENCY: enforce state machine (see updateStatus for rationale).
    const allowedPrev = statusesThatCanReach(String(status));
    if (allowedPrev.length === 0) return;
    const prevPlaceholders = allowedPrev.map(() => '?').join(',');

    params.push(orderId);

    await this.qb.execute(
      `UPDATE orders SET ${setFields.join(', ')}, updated_at = datetime('now')
       WHERE id = ?
         AND UPPER(status) IN (${prevPlaceholders})`,
      [...params, ...allowedPrev],
    );
  }

  /**
   * Restore stock for cancelled order items
   */
  async restoreStock(orderId: string): Promise<void> {
    const items = await this.qb.queryMany<{ product_id: string; quantity: number }>(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ? AND status != ?',
      [orderId, 'CANCELLED']
    );

    if (items.length === 0) return;

    const statements = items.map(item => ({
      sql: 'UPDATE products SET stock = stock + ? WHERE id = ?',
      params: [item.quantity, item.product_id],
    }));

    // Also update order items status
    statements.push({
      sql: 'UPDATE order_items SET status = ? WHERE order_id = ?',
      params: ['CANCELLED', orderId],
    });

    await this.qb.batch(statements);
  }

  /**
   * Reduce stock for cancelled order items
   * ──────────────────────────────────────────────────────────
   * ✅ CONCURRENCY-SAFE: 낙관적 잠금(Optimistic Lock) 방식
   *
   * D1은 SELECT FOR UPDATE를 지원하지 않으나, batch()는 원자적으로
   * 실행됩니다. 각 UPDATE에 `AND stock >= ?` 조건을 붙여
   * 재고가 충분한 경우에만 차감합니다.
   *
   * 반환값: { success: true } | { success: false; insufficientProduct: string }
   */
  async reserveStock(
    items: { product_id: string; quantity: number; product_name: string }[],
  ): Promise<{ success: true } | { success: false; insufficientProduct: string }> {
    if (items.length === 0) return { success: true };

    // D1 batch()는 원자적: 한 구문이라도 실패하면 전체 롤백
    // Conditional UPDATE: stock >= qty 조건 포함
    const statements = items.map(item => ({
      sql: `UPDATE products
            SET stock = stock - ?,
                updated_at = datetime('now')
            WHERE id = ?
              AND stock >= ?`,
      params: [item.quantity, item.product_id, item.quantity],
    }));

    const results = await this.qb.batch(statements);

    // rowsAffected === 0 → 재고 부족 또는 상품 비활성
    for (let i = 0; i < results.length; i++) {
      if ((results[i]?.meta?.changes ?? 0) === 0) {
        return {
          success: false,
          insufficientProduct: items[i]?.product_name ?? items[i]?.product_id ?? 'unknown',
        };
      }
    }

    // sold_count 업데이트는 별도로 시도 (구 스키마에 컬럼이 없을 수 있어 에러 무시)
    const soldCountStmts = items.map(item => ({
      sql: `UPDATE products SET sold_count = sold_count + ? WHERE id = ?`,
      params: [item.quantity, item.product_id],
    }));
    await this.qb.batch(soldCountStmts).catch(() => {
      // sold_count 컬럼이 없는 구 스키마에서는 무시 (stock 차감은 이미 완료)
      console.warn('[OrderRepository] sold_count update skipped (column may not exist)');
    });

    return { success: true };
  }

  /**
   * Mark order items as CONFIRMED when payment is confirmed.
   *
   * stock is already decremented by reserveStock() at order creation time.
   * This method only updates order_items.status — no additional stock change needed.
   */
  async reduceStock(orderId: string): Promise<void> {
    await this.qb.execute(
      'UPDATE order_items SET status = ? WHERE order_id = ?',
      ['CONFIRMED', orderId],
    );
  }

  /**
   * v24 FIX: atomic payment confirmation.
   * UPDATE orders + UPDATE order_items를 D1 batch로 묶어 all-or-nothing 보장.
   * 기존에는 updateStatus() 성공 후 루프로 reduceStock() 호출 → 중간 실패 시 불일치.
   */
  async confirmPaymentAtomic(
    orderNumber: string,
    paymentInfo: {
      toss_payment_key: string;
      toss_order_id?: string;
      payment_method?: string;
      paid_at: string;
    }
  ): Promise<{ orderIds: string[]; confirmed: number }> {
    const allowedPrev = statusesThatCanReach('DONE');
    if (allowedPrev.length === 0) return { orderIds: [], confirmed: 0 };
    const prevPlaceholders = allowedPrev.map(() => '?').join(',');

    // 먼저 해당 orderNumber의 orders id를 조회 (batch 전)
    const orderRows = await this.qb.queryMany<{ id: string }>(
      `SELECT id FROM orders WHERE order_number = ? AND UPPER(status) IN (${prevPlaceholders})`,
      [orderNumber, ...allowedPrev],
    );
    const orderIds = orderRows.map(r => r.id);
    if (orderIds.length === 0) return { orderIds: [], confirmed: 0 };

    // Batch: UPDATE orders + UPDATE order_items (atomic all-or-nothing)
    // 🛡️ 2026-04-22: payment_status='approved' 동기화 — 이전엔 status=DONE 이어도
    // payment_status 가 pending 인 채 남아서 환불/정산 로직 오작동.
    const statements: { sql: string; params?: unknown[] }[] = [
      {
        sql: `UPDATE orders
              SET status = 'DONE',
                  payment_status = 'approved',
                  toss_payment_key = ?,
                  toss_order_id = ?,
                  payment_method = ?,
                  paid_at = ?,
                  updated_at = datetime('now')
              WHERE order_number = ?
                AND UPPER(status) IN (${prevPlaceholders})`,
        params: [
          paymentInfo.toss_payment_key,
          paymentInfo.toss_order_id ?? orderNumber,
          paymentInfo.payment_method ?? null,
          paymentInfo.paid_at,
          orderNumber,
          ...allowedPrev,
        ],
      },
      ...orderIds.map(id => ({
        sql: 'UPDATE order_items SET status = ? WHERE order_id = ?',
        params: ['CONFIRMED', id],
      })),
    ];

    await this.qb.batch(statements);
    return { orderIds, confirmed: orderIds.length };
  }

  /**
   * Check if order already processed (idempotency)
   */
  async isAlreadyProcessed(orderNumber: string, status: OrderStatus): Promise<boolean> {
    const row = await this.qb.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM orders WHERE order_number = ? AND status = ?',
      [orderNumber, status]
    );
    return (row?.count ?? 0) > 0;
  }

  /**
   * Find order by idempotency key
   * ✅ BUG #43 FIX: Idempotency keys are per-user — scope the lookup to user_id
   * so user A can't accidentally (or maliciously) retrieve user B's order by
   * colliding on a guessable key. Callers must pass their own user_id.
   */
  async findByIdempotencyKey(key: string, userId: string): Promise<Order | null> {
    // 🛡️ 2026-05-23: SELECT 컬럼 production 스키마 매칭. 이전 코드가 존재하지 않는
    //   `address`, `address_detail`, `notes` 참조 → 'no such column: address' 500 에러.
    //   production OrdersTable (src/shared/db/production-schema.ts) 기준 정합 컬럼만 SELECT.
    const row = await this.qb.queryOne<Record<string, unknown>>(
      `SELECT id, order_number, user_id, seller_id, status, payment_status,
              total_amount, subtotal, shipping_fee, discount_amount, currency,
              shipping_address, shipping_name, shipping_phone, shipping_memo,
              toss_payment_key, payment_key, payment_method, idempotency_key,
              cancel_reason, cancelled_at, paid_at, shipped_at, delivered_at,
              courier, tracking_number, created_at, updated_at
       FROM orders WHERE idempotency_key = ? AND user_id = ?`,
      [key, userId]
    );
    if (!row) return null;
    return this.mapOrder(row, []);
  }

  /**
   * Get payment key for a given order (used for Toss cancel)
   * Returns { toss_payment_key, total_amount, status }
   */
  async getPaymentInfo(orderId: string): Promise<{
    toss_payment_key: string | null;
    total_amount: number;
    status: string;
  } | null> {
    return this.qb.queryOne<{
      toss_payment_key: string | null;
      total_amount: number;
      status: string;
    }>(
      'SELECT toss_payment_key, total_amount, status FROM orders WHERE id = ?',
      [orderId]
    );
  }

  /**
   * Mark order as cancel-failed with a reason (rollback marker)
   * ✅ SCHEMA FIX: `cancel_fail_reason` column doesn't exist in production.
   * Fall back to `cancel_reason` (with a "[CANCEL_FAILED]" prefix for auditability).
   */
  async markCancelFailed(orderId: string, reason: string): Promise<void> {
    await this.qb.execute(
      `UPDATE orders SET
         cancel_reason = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
      [`[CANCEL_FAILED] ${reason}`, orderId]
    );
  }

  private mapOrder(row: Record<string, unknown>, items: Record<string, unknown>[]): Order {
    return {
      id: String(row['id'] ?? ''),
      order_number: String(row['order_number'] ?? ''),
      user_id: String(row['user_id'] ?? ''),
      seller_id: String(row['seller_id'] ?? ''),
      toss_order_id: row['toss_order_id'] ? String(row['toss_order_id']) : undefined,
      toss_payment_key: row['toss_payment_key'] ? String(row['toss_payment_key']) : undefined,
      payment_method: row['payment_method'] ? String(row['payment_method']) : undefined,
      subtotal: Number(row['subtotal'] ?? 0),
      shipping_fee: Number(row['shipping_fee'] ?? 0),
      discount_amount: Number(row['discount_amount'] ?? 0),
      total_amount: Number(row['total_amount'] ?? 0),
      currency: String(row['currency'] ?? 'KRW'),
      status: String(row['status'] ?? 'PENDING') as OrderStatus,
      shipping_name: row['shipping_name'] ? String(row['shipping_name']) : undefined,
      shipping_phone: row['shipping_phone'] ? String(row['shipping_phone']) : undefined,
      shipping_address: row['shipping_address']
        ? safeJsonParse(String(row['shipping_address']), undefined)
        : undefined,
      shipping_memo: row['shipping_memo'] ? String(row['shipping_memo']) : undefined,
      tracking_number: row['tracking_number'] ? String(row['tracking_number']) : undefined,
      // ✅ SCHEMA FIX: Column is `courier` (not tracking_company). Alias for API compat.
      tracking_company: row['courier'] ? String(row['courier']) : undefined,
      cancelled_at: row['cancelled_at'] ? String(row['cancelled_at']) : undefined,
      cancel_reason: row['cancel_reason'] ? String(row['cancel_reason']) : undefined,
      paid_at: row['paid_at'] ? String(row['paid_at']) : undefined,
      shipped_at: row['shipped_at'] ? String(row['shipped_at']) : undefined,
      delivered_at: row['delivered_at'] ? String(row['delivered_at']) : undefined,
      seller_name: row['seller_name'] ? String(row['seller_name']) : undefined,
      seller_phone: row['seller_phone'] ? String(row['seller_phone']) : undefined,
      seller_kakao_chat_url: row['seller_kakao_chat_url'] ? String(row['seller_kakao_chat_url']) : undefined,
      created_at: String(row['created_at'] ?? ''),
      updated_at: String(row['updated_at'] ?? ''),
      items: items.map(item => ({
        id: String(item['id'] ?? ''),
        order_id: String(item['order_id'] ?? ''),
        product_id: String(item['product_id'] ?? ''),
        seller_id: String(item['seller_id'] ?? ''),
        product_name: String(item['product_name'] ?? ''),
        // ✅ SCHEMA FIX: DB column is `product_image` (not product_thumbnail).
        //   No `product_sku` column in production schema.
        product_thumbnail: item['product_image'] ? String(item['product_image']) : undefined,
        unit_price: Number(item['unit_price'] ?? 0),
        quantity: Number(item['quantity'] ?? 0),
        subtotal: Number(item['subtotal'] ?? 0),
        currency: String(item['currency'] ?? 'KRW'),
        options: safeJsonParse(String(item['options'] ?? '{}'), {}),
        status: String(item['status'] ?? 'PENDING'),
        created_at: String(item['created_at'] ?? ''),
      } satisfies OrderItem)),
    };
  }
}
