/**
 * SECONDARY Order Repository — used by features/orders/api/orders.routes.ts
 *
 * Handles: delivery tracking, purchase confirmation, auto-confirm cron, delivery sync
 * These endpoints are NOT in the primary order.routes.ts
 *
 * ⚠️ The primary repository is at worker/repositories/order.repository.ts
 */

import type { Order, OrderItem, OrderFilter, OrderCreateInput } from '../types';

export class OrderRepository {
  constructor(private db: D1Database) {}
  
  /**
   * 주문 ID로 조회
   */
  async findById(id: number): Promise<Order | null> {
    const result = await this.db.prepare(`
      SELECT * FROM orders WHERE id = ?
    `).bind(id).first<Order>();
    
    return result || null;
  }
  
  /**
   * 주문 번호로 조회
   */
  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    const result = await this.db.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(orderNumber).first<Order>();
    
    return result || null;
  }
  
  /**
   * 필터 조건으로 주문 목록 조회
   */
  async findAll(filter: OrderFilter, limit: number = 20, offset: number = 0): Promise<Order[]> {
    let query = `SELECT * FROM orders WHERE 1=1`;
    const params: any[] = [];
    
    if (filter.userId) {
      query += ` AND user_id = ?`;
      params.push(filter.userId);
    }
    
    if (filter.sellerId) {
      query += ` AND seller_id = ?`;
      params.push(filter.sellerId);
    }
    
    if (filter.status) {
      query += ` AND status = ?`;
      params.push(filter.status);
    }
    
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const result = await this.db.prepare(query).bind(...params).all<Order>();
    return result.results || [];
  }
  
  /**
   * 주문 생성
   * ✅ SCHEMA FIX: Production DB uses `total_amount` (NOT `total_price`).
   * See src/shared/db/production-schema.ts.
   *
   * ✅ BUG #26 FIX: No idempotency check on order creation meant that a network
   * retry (e.g. slow 3G, page reload on PaymentSuccessPage) would insert a
   * duplicate order row with the same order_number, charging the customer twice
   * or creating phantom orders.  We now check for an existing order_number
   * before inserting; if found we return the existing order instead of failing.
   *
   * ✅ BUG #16/#17/#30 FIX: Orders must be created with status='PENDING' (uppercase)
   * to match the dashboards/seller order views.  Lowercase 'pending' made orders
   * invisible to the seller/admin UI.  We also now decrement product stock
   * atomically before the INSERT to prevent overselling under concurrent load.
   */
  async create(data: OrderCreateInput): Promise<Order> {
    // 주문 번호 생성
    const orderNumber = data.order_number || `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // ✅ BUG #26 FIX: Idempotency check — return existing order if order_number already exists
    const existing = await this.findByOrderNumber(orderNumber);
    if (existing) {
      console.warn('[OrderRepository] Duplicate order_number detected, returning existing order:', orderNumber);
      return existing;
    }

    // ✅ BUG #17 FIX: Atomically reserve stock BEFORE creating the order.
    // D1 doesn't support SELECT FOR UPDATE, but a conditional UPDATE
    // (`WHERE stock >= ?`) is atomic.  If any item is oversold, abort.
    if (data.items.length > 0) {
      const stockStmts = data.items.map(item => (
        this.db.prepare(
          `UPDATE products SET stock = stock - ?, updated_at = datetime('now')
           WHERE id = ? AND stock >= ?`
        ).bind(item.quantity, item.product_id, item.quantity)
      ));
      const stockResults = await this.db.batch(stockStmts);
      for (let i = 0; i < stockResults.length; i++) {
        if ((stockResults[i]?.meta?.changes ?? 0) === 0) {
          throw new Error(`재고가 부족합니다 (상품 ID: ${data.items[i].product_id})`);
        }
      }
    }

    // ✅ SCHEMA FIX: Use `total_amount` to match the actual DB schema column
    // ✅ BUG #16/#30 FIX: status='PENDING' (uppercase) to match dashboard filters
    const orderResult = await this.db.prepare(`
      INSERT INTO orders (
        order_number, user_id, seller_id, total_amount, status,
        payment_method, shipping_address, shipping_name, shipping_phone,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      orderNumber,
      data.user_id,
      data.seller_id,
      data.total_amount,
      data.payment_method || null,
      typeof data.shipping_address === 'object' ? JSON.stringify(data.shipping_address) : (data.shipping_address || null),
      data.shipping_name || null,
      data.shipping_phone || null
    ).run();

    const orderId = orderResult.meta.last_row_id as number;

    // 주문 아이템 생성 (배치 INSERT로 최적화)
    // ✅ SCHEMA FIX: order_items has NOT NULL product_name — must lookup product names
    if (data.items.length > 0) {
      // Batch-fetch product names for all items (required NOT NULL column)
      const productIds = data.items.map(i => i.product_id);
      const placeholders = productIds.map(() => '?').join(',');
      const { results: productRows = [] } = await this.db
        .prepare(`SELECT id, name FROM products WHERE id IN (${placeholders})`)
        .bind(...productIds)
        .all<{ id: number; name: string }>();
      const nameMap = new Map<number, string>(productRows.map(p => [Number(p.id), String(p.name ?? '')]));

      const values = data.items.map(() => '(?, ?, ?, ?, ?)').join(', ');
      const bindings = data.items.flatMap(item => [
        orderId,
        item.product_id,
        nameMap.get(Number(item.product_id)) ?? `Product ${item.product_id}`,
        item.quantity,
        item.price,
      ]);

      await this.db.prepare(`
        INSERT INTO order_items (
          order_id, product_id, product_name, quantity, price
        ) VALUES ${values}
      `).bind(...bindings).run();
    }

    const order = await this.findById(orderId);

    if (!order) {
      throw new Error('Failed to create order');
    }

    return order;
  }
  
  /**
   * 주문 상태 업데이트 (CAS — state machine 기반)
   *
   * ✅ CONCURRENCY FIX: 이전에는 무조건 UPDATE 하여 PAID → PENDING 같은
   * 역행 전환이 가능했습니다. 이제 state machine의 허용된 이전 상태 집합만
   * 매칭되도록 CAS UPDATE를 사용합니다.
   */
  async updateStatus(id: number, status: Order['status']): Promise<Order> {
    const { transitionOrderStatus, canTransition } = await import('../../../worker/utils/state-machine');

    const ok = await transitionOrderStatus(this.db as unknown as D1Database, id, String(status));
    if (!ok) {
      // Transition rejected — fetch current row for diagnostics
      const current = await this.findById(id);
      if (!current) throw new Error('Order not found');
      if (canTransition(current.status, String(status))) {
        // Somehow state machine reports legal but DB didn't change — rare race
        throw new Error('Order status update failed (concurrent change)');
      }
      throw new Error(
        `Invalid status transition: ${current.status} → ${status}`
      );
    }

    const order = await this.findById(id);
    if (!order) {
      throw new Error('Order not found after update');
    }
    return order;
  }
  
  /**
   * 주문 아이템 조회
   */
  async findItems(orderId: number): Promise<OrderItem[]> {
    const result = await this.db.prepare(`
      SELECT oi.*, p.name as product_name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(orderId).all<OrderItem>();
    
    return result.results || [];
  }
}
