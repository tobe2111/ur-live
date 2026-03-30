// ============================================================
// Order Repository
// ============================================================

import type { D1Database } from '@cloudflare/workers-types';
import { QueryBuilder } from './query-builder';
import type { Order, OrderItem, OrderStatus, CreateOrderRequest } from '../../shared/types';
import { generateId, safeJsonParse } from '../../shared/utils';

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
      product_thumbnail?: string;
      product_sku?: string;
      unit_price: number;
      quantity: number;
      subtotal: number;
      options?: Record<string, string>;
    }[],
    subtotal: number,
    shippingFee: number
  ): Promise<Order> {
    const orderId = generateId();
    const totalAmount = subtotal + shippingFee;

    const orderStmt = {
      sql: `INSERT INTO orders (
        id, order_number, user_id, seller_id,
        subtotal, shipping_fee, discount_amount, total_amount, currency,
        status, shipping_name, shipping_phone, shipping_address, shipping_memo,
        idempotency_key, locale
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'KRW', 'PENDING', ?, ?, ?, ?, ?, 'ko')`,
      params: [
        orderId,
        request.order_number,
        userId,
        request.seller_id,
        subtotal,
        shippingFee,
        totalAmount,
        request.shipping_name,
        request.shipping_phone,
        JSON.stringify(request.shipping_address),
        request.shipping_memo ?? null,
        request.idempotency_key,
      ],
    };

    const itemStmts = items.map(item => ({
      sql: `INSERT INTO order_items (
        id, order_id, product_id, seller_id,
        product_name, product_thumbnail, product_sku,
        unit_price, quantity, subtotal, currency, options, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'KRW', ?, 'PENDING')`,
      params: [
        generateId(),
        orderId,
        item.product_id,
        item.seller_id,
        item.product_name,
        item.product_thumbnail ?? null,
        item.product_sku ?? null,
        item.unit_price,
        item.quantity,
        item.subtotal,
        JSON.stringify(item.options ?? {}),
      ],
    }));

    await this.qb.batch([orderStmt, ...itemStmts]);

    const order = await this.findById(orderId);
    if (!order) throw new Error('Order creation failed');
    return order;
  }

  /**
   * Find order by ID with items
   */
  async findById(orderId: string): Promise<Order | null> {
    const row = await this.qb.queryOne<Record<string, unknown>>(
      `SELECT o.*, s.name as seller_name
       FROM orders o
       LEFT JOIN sellers s ON o.seller_id = s.id
       WHERE o.id = ?`,
      [orderId]
    );
    if (!row) return null;

    const items = await this.qb.queryMany<Record<string, unknown>>(
      'SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at',
      [orderId]
    );

    return this.mapOrder(row, items);
  }

  /**
   * Find orders by order_number (multi-seller: multiple orders per checkout)
   */
  async findByOrderNumber(orderNumber: string): Promise<Order[]> {
    const rows = await this.qb.queryMany<Record<string, unknown>>(
      `SELECT o.*, s.name as seller_name
       FROM orders o
       LEFT JOIN sellers s ON o.seller_id = s.id
       WHERE o.order_number = ?
       ORDER BY o.created_at`,
      [orderNumber]
    );

    const orders = await Promise.all(
      rows.map(async row => {
        const items = await this.qb.queryMany<Record<string, unknown>>(
          'SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at',
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

    const rows = await this.qb.queryMany<Record<string, unknown>>(
      `SELECT o.*, s.name as seller_name
       FROM orders o
       LEFT JOIN sellers s ON o.seller_id = s.id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const orders = await Promise.all(
      rows.map(async row => {
        const items = await this.qb.queryMany<Record<string, unknown>>(
          'SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at',
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
      webhook_processed_at?: string;
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
    if (extra?.webhook_processed_at) {
      setFields.push('webhook_processed_at = ?');
      params.push(extra.webhook_processed_at);
    }
    if (extra?.webhook_event_id) {
      setFields.push('webhook_event_id = ?');
      params.push(extra.webhook_event_id);
    }

    params.push(orderNumber);

    await this.qb.execute(
      `UPDATE orders SET ${setFields.join(', ')} WHERE order_number = ?`,
      params
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
    if (extra?.webhook_processed_at) {
      setFields.push('webhook_processed_at = ?');
      params.push(extra.webhook_processed_at);
    }
    if (extra?.webhook_event_id) {
      setFields.push('webhook_event_id = ?');
      params.push(extra.webhook_event_id);
    }

    params.push(orderId);

    await this.qb.execute(
      `UPDATE orders SET ${setFields.join(', ')} WHERE id = ?`,
      params
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
      sql: 'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
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
   * 실행됩니다. 각 UPDATE에 `AND stock_quantity >= ?` 조건을 붙여
   * 재고가 충분한 경우에만 차감합니다.
   *
   * 반환값: { success: true } | { success: false; insufficientProduct: string }
   */
  async reserveStock(
    items: { product_id: string; quantity: number; product_name: string }[],
  ): Promise<{ success: true } | { success: false; insufficientProduct: string }> {
    if (items.length === 0) return { success: true };

    // D1 batch()는 원자적: 한 구문이라도 실패하면 전체 롤백
    // Conditional UPDATE: stock_quantity >= qty 조건 포함
    const statements = items.map(item => ({
      sql: `UPDATE products
            SET stock_quantity = stock_quantity - ?,
                sold_count     = sold_count + ?,
                updated_at     = datetime('now')
            WHERE id = ?
              AND stock_quantity >= ?
              AND status = 'ACTIVE'`,
      params: [item.quantity, item.quantity, item.product_id, item.quantity],
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

    return { success: true };
  }

  /**
   * Mark order items as CONFIRMED when payment is confirmed.
   *
   * stock_quantity is already decremented by reserveStock() at order creation time.
   * This method only updates order_items.status — no additional stock change needed.
   */
  async reduceStock(orderId: string): Promise<void> {
    await this.qb.execute(
      'UPDATE order_items SET status = ? WHERE order_id = ?',
      ['CONFIRMED', orderId],
    );
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
   */
  async findByIdempotencyKey(key: string): Promise<Order | null> {
    const row = await this.qb.queryOne<Record<string, unknown>>(
      'SELECT * FROM orders WHERE idempotency_key = ?',
      [key]
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
   */
  async markCancelFailed(orderId: string, reason: string): Promise<void> {
    await this.qb.execute(
      `UPDATE orders SET
         cancel_fail_reason = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
      [reason, orderId]
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
      tracking_company: row['tracking_company'] ? String(row['tracking_company']) : undefined,
      cancelled_at: row['cancelled_at'] ? String(row['cancelled_at']) : undefined,
      cancel_reason: row['cancel_reason'] ? String(row['cancel_reason']) : undefined,
      paid_at: row['paid_at'] ? String(row['paid_at']) : undefined,
      shipped_at: row['shipped_at'] ? String(row['shipped_at']) : undefined,
      delivered_at: row['delivered_at'] ? String(row['delivered_at']) : undefined,
      created_at: String(row['created_at'] ?? ''),
      updated_at: String(row['updated_at'] ?? ''),
      items: items.map(item => ({
        id: String(item['id'] ?? ''),
        order_id: String(item['order_id'] ?? ''),
        product_id: String(item['product_id'] ?? ''),
        seller_id: String(item['seller_id'] ?? ''),
        product_name: String(item['product_name'] ?? ''),
        product_thumbnail: item['product_thumbnail'] ? String(item['product_thumbnail']) : undefined,
        product_sku: item['product_sku'] ? String(item['product_sku']) : undefined,
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
