/**
 * Order Repository
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
   */
  async create(data: OrderCreateInput): Promise<Order> {
    // 주문 번호 생성
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // 주문 생성
    const orderResult = await this.db.prepare(`
      INSERT INTO orders (
        order_number, user_id, seller_id, total_amount, status,
        payment_method, shipping_address, shipping_name, shipping_phone,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      orderNumber,
      data.user_id,
      data.seller_id,
      data.total_amount,
      data.payment_method || null,
      data.shipping_address || null,
      data.shipping_name || null,
      data.shipping_phone || null
    ).run();
    
    const orderId = orderResult.meta.last_row_id as number;
    
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
  async updateStatus(id: number, status: Order['status']): Promise<Order> {
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
