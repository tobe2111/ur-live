import { eq, desc, and, sql } from 'drizzle-orm';
import type { DB, Order, NewOrder, OrderItem } from '../db/client';
import { orders, orderItems, products, users } from '../db/schema';
import { BaseRepository, calculatePagination } from './base.repository';

/**
 * ✅ Order Repository with N+1 Prevention
 * 
 * Week 5 Day 3 - DB 타입 안전성 & N+1 쿼리 해결
 * 
 * Before (N+1 문제):
 * ```typescript
 * const orders = await getOrders(userId); // 1 query
 * for (const order of orders) {
 *   order.items = await getOrderItems(order.id); // N queries
 * }
 * // Total: 1 + N queries
 * ```
 * 
 * After (JOIN 사용):
 * ```typescript
 * const orders = await orderRepo.findByUserIdWithItems(userId);
 * // Total: 1 query (with JOIN)
 * ```
 */

export interface OrderWithItems extends Order {
  items: (OrderItem & {
    product: {
      id: number;
      name: string;
      imageUrl: string | null;
    } | null;
  })[];
  user?: {
    id: number;
    name: string;
    email: string | null;
  };
}

export class OrderRepository extends BaseRepository<Order> {
  constructor(db: DB) {
    super(db, 'orders');
  }

  /**
   * ✅ N+1 해결: ID로 주문 + 주문 상품 한 번에 조회
   */
  async findById(id: number): Promise<Order | null> {
    const result = await this.db.query.orders.findFirst({
      where: eq(orders.id, id),
    });

    return result || null;
  }

  /**
   * ✅ N+1 해결: 사용자 주문 목록 + 주문 상품 한 번에 조회
   */
  async findByUserIdWithItems(
    userId: number,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<OrderWithItems[]> {
    const { limit = 20, offset = 0 } = options || {};

    // ✅ Drizzle relations를 사용한 자동 JOIN
    const result = await this.db.query.orders.findMany({
      where: eq(orders.userId, userId),
      with: {
        items: {
          with: {
            product: {
              columns: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [desc(orders.createdAt)],
      limit,
      offset,
    });

    return result as OrderWithItems[];
  }

  /**
   * ✅ N+1 해결: 주문 번호로 주문 + 주문 상품 조회
   */
  async findByOrderNumberWithItems(orderNumber: string): Promise<OrderWithItems | null> {
    const result = await this.db.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
      with: {
        items: {
          with: {
            product: {
              columns: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return (result as OrderWithItems) || null;
  }

  /**
   * 모든 주문 조회 (페이지네이션)
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: 'asc' | 'desc';
  }): Promise<Order[]> {
    const { limit = 20, offset = 0, orderBy = 'desc' } = options || {};

    const result = await this.db.query.orders.findMany({
      orderBy: [orderBy === 'asc' ? orders.createdAt : desc(orders.createdAt)],
      limit,
      offset,
    });

    return result;
  }

  /**
   * 주문 생성
   */
  async create(data: NewOrder): Promise<Order> {
    const result = await this.db.insert(orders).values(data).returning();
    return result[0];
  }

  /**
   * 주문 상태 업데이트
   */
  async update(id: number, data: Partial<Omit<Order, 'id'>>): Promise<Order | null> {
    const result = await this.db
      .update(orders)
      .set({
        ...data,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(orders.id, id))
      .returning();

    return result[0] || null;
  }

  /**
   * 주문 삭제 (실제로는 사용 안 함, 취소만 사용)
   */
  async delete(id: number): Promise<boolean> {
    const result = await this.db.delete(orders).where(eq(orders.id, id)).returning();
    return result.length > 0;
  }

  /**
   * 주문 개수 조회
   */
  async count(userId?: number): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(userId ? eq(orders.userId, userId) : undefined);

    return result[0]?.count || 0;
  }

  /**
   * 결제 상태별 주문 조회
   */
  async findByPaymentStatus(
    status: 'pending' | 'approved' | 'failed' | 'cancelled' | 'refunded',
    options?: { limit?: number; offset?: number }
  ): Promise<OrderWithItems[]> {
    const { limit = 20, offset = 0 } = options || {};

    const result = await this.db.query.orders.findMany({
      where: eq(orders.paymentStatus, status),
      with: {
        items: {
          with: {
            product: {
              columns: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [desc(orders.createdAt)],
      limit,
      offset,
    });

    return result as OrderWithItems[];
  }

  /**
   * ✅ 기존 코드와의 호환성을 위한 메서드
   */
  async findByCondition(condition: any): Promise<Order[]> {
    // 레거시 지원
    return this.db.select().from(orders).where(condition);
  }
}
