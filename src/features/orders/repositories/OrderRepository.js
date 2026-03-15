/**
 * Order Repository
 */
export class OrderRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * 주문 ID로 조회
     */
    async findById(id) {
        const result = await this.db.prepare(`
      SELECT * FROM orders WHERE id = ?
    `).bind(id).first();
        return result || null;
    }
    /**
     * 주문 번호로 조회
     */
    async findByOrderNumber(orderNumber) {
        const result = await this.db.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(orderNumber).first();
        return result || null;
    }
    /**
     * 필터 조건으로 주문 목록 조회
     */
    async findAll(filter, limit = 20, offset = 0) {
        let query = `SELECT * FROM orders WHERE 1=1`;
        const params = [];
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
        const result = await this.db.prepare(query).bind(...params).all();
        return result.results || [];
    }
    /**
     * 주문 생성
     * ✅ BUG #20 FIX: The live DB schema (initial migration 0001) uses `total_price`
     * as the column name, NOT `total_amount`.  The old INSERT used `total_amount`
     * which caused a "table orders has no column named total_amount" SQL error,
     * silently rolling back every order creation in production.
     *
     * ✅ BUG #26 FIX: No idempotency check on order creation meant that a network
     * retry (e.g. slow 3G, page reload on PaymentSuccessPage) would insert a
     * duplicate order row with the same order_number, charging the customer twice
     * or creating phantom orders.  We now check for an existing order_number
     * before inserting; if found we return the existing order instead of failing.
     */
    async create(data) {
        // 주문 번호 생성
        const orderNumber = data.order_number || `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        // ✅ BUG #26 FIX: Idempotency check — return existing order if order_number already exists
        const existing = await this.findByOrderNumber(orderNumber);
        if (existing) {
            console.warn('[OrderRepository] Duplicate order_number detected, returning existing order:', orderNumber);
            return existing;
        }
        // ✅ BUG #20 FIX: Use `total_price` to match the actual DB schema column
        const orderResult = await this.db.prepare(`
      INSERT INTO orders (
        order_number, user_id, seller_id, total_price, status,
        payment_method, shipping_address, shipping_name, shipping_phone,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(orderNumber, data.user_id, data.seller_id, data.total_amount, // OrderCreateInput field stays as total_amount for API compat
        data.payment_method || null, data.shipping_address || null, data.shipping_name || null, data.shipping_phone || null).run();
        const orderId = orderResult.meta.last_row_id;
        // 주문 아이템 생성 (배치 INSERT로 최적화)
        if (data.items.length > 0) {
            const values = data.items.map(() => '(?, ?, ?, ?, datetime(\'now\'))').join(', ');
            const bindings = data.items.flatMap(item => [orderId, item.product_id, item.quantity, item.price]);
            await this.db.prepare(`
        INSERT INTO order_items (
          order_id, product_id, quantity, price, created_at
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
     * 주문 상태 업데이트
     */
    async updateStatus(id, status) {
        await this.db.prepare(`
      UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(status, id).run();
        const order = await this.findById(id);
        if (!order) {
            throw new Error('Order not found after update');
        }
        return order;
    }
    /**
     * 주문 아이템 조회
     */
    async findItems(orderId) {
        const result = await this.db.prepare(`
      SELECT oi.*, p.name as product_name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(orderId).all();
        return result.results || [];
    }
}
