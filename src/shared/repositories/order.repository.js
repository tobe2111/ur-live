import { eq, desc, sql } from 'drizzle-orm';
import { orders } from '../db/schema';
import { BaseRepository } from './base.repository';
export class OrderRepository extends BaseRepository {
    constructor(db) {
        super(db, 'orders');
    }
    /**
     * ✅ N+1 해결: ID로 주문 + 주문 상품 한 번에 조회
     */
    async findById(id) {
        const result = await this.db.query.orders.findFirst({
            where: eq(orders.id, id),
        });
        return result || null;
    }
    /**
     * ✅ N+1 해결: 사용자 주문 목록 + 주문 상품 한 번에 조회
     */
    async findByUserIdWithItems(userId, options) {
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
        return result;
    }
    /**
     * ✅ N+1 해결: 주문 번호로 주문 + 주문 상품 조회
     */
    async findByOrderNumberWithItems(orderNumber) {
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
        return result || null;
    }
    /**
     * 모든 주문 조회 (페이지네이션)
     */
    async findAll(options) {
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
    async create(data) {
        const result = await this.db.insert(orders).values(data).returning();
        return result[0];
    }
    /**
     * 주문 상태 업데이트
     */
    async update(id, data) {
        const result = await this.db
            .update(orders)
            .set({
            ...data,
            updatedAt: sql `CURRENT_TIMESTAMP`,
        })
            .where(eq(orders.id, id))
            .returning();
        return result[0] || null;
    }
    /**
     * 주문 삭제 (실제로는 사용 안 함, 취소만 사용)
     */
    async delete(id) {
        const result = await this.db.delete(orders).where(eq(orders.id, id)).returning();
        return result.length > 0;
    }
    /**
     * 주문 개수 조회
     */
    // @ts-ignore - signature differs from base
    async count(userId) {
        const result = await this.db
            .select({ count: sql `count(*)` })
            .from(orders)
            .where(userId ? eq(orders.userId, userId) : undefined);
        return result[0]?.count || 0;
    }
    /**
     * 결제 상태별 주문 조회
     */
    async findByPaymentStatus(status, options) {
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
        return result;
    }
    /**
     * ✅ 기존 코드와의 호환성을 위한 메서드
     */
    async findByCondition(condition) {
        // 레거시 지원
        return this.db.select().from(orders).where(condition);
    }
}
