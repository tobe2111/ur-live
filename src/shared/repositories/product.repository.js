import { eq, desc, like, and, sql } from 'drizzle-orm';
import { products } from '../db/schema';
import { BaseRepository } from './base.repository';
export class ProductRepository extends BaseRepository {
    constructor(db) {
        super(db, 'products');
    }
    /**
     * ✅ N+1 해결: 상품 + 옵션 한 번에 조회
     */
    async findById(id) {
        const result = await this.db.query.products.findFirst({
            where: eq(products.id, id),
        });
        return result || null;
    }
    /**
     * ✅ N+1 해결: 상품 + 옵션 한 번에 조회
     */
    async findByIdWithOptions(id) {
        const result = await this.db.query.products.findFirst({
            where: eq(products.id, id),
            with: {
                options: true,
            },
        });
        return result || null;
    }
    /**
     * ✅ N+1 해결: 활성 상품 목록 + 옵션
     */
    async findActiveProductsWithOptions(options) {
        const { limit = 20, offset = 0, category } = options || {};
        const result = await this.db.query.products.findMany({
            where: and(eq(products.isActive, true), category ? eq(products.category, category) : undefined),
            with: {
                options: true,
            },
            orderBy: [desc(products.createdAt)],
            limit,
            offset,
        });
        return result;
    }
    /**
     * 모든 상품 조회
     */
    async findAll(options) {
        const { limit = 20, offset = 0, orderBy = 'desc' } = options || {};
        const result = await this.db.query.products.findMany({
            orderBy: [orderBy === 'asc' ? products.createdAt : desc(products.createdAt)],
            limit,
            offset,
        });
        return result;
    }
    /**
     * 상품 검색
     */
    async search(query, options) {
        const { limit = 20, offset = 0 } = options || {};
        const result = await this.db.query.products.findMany({
            where: and(eq(products.isActive, true), like(products.name, `%${query}%`)),
            with: {
                options: true,
            },
            limit,
            offset,
        });
        return result;
    }
    /**
     * 카테고리별 상품 조회
     */
    async findByCategory(category, options) {
        const { limit = 20, offset = 0 } = options || {};
        const result = await this.db.query.products.findMany({
            where: and(eq(products.isActive, true), eq(products.category, category)),
            with: {
                options: true,
            },
            orderBy: [desc(products.createdAt)],
            limit,
            offset,
        });
        return result;
    }
    /**
     * 라이브 스트림 상품 조회
     */
    async findByLiveStreamId(liveStreamId) {
        const result = await this.db.query.products.findMany({
            where: and(eq(products.liveStreamId, liveStreamId), eq(products.isActive, true)),
            with: {
                options: true,
            },
            orderBy: [desc(products.createdAt)],
        });
        return result;
    }
    /**
     * 상품 생성
     */
    async create(data) {
        const result = await this.db.insert(products).values(data).returning();
        return result[0];
    }
    /**
     * 상품 업데이트
     */
    async update(id, data) {
        const result = await this.db
            .update(products)
            .set({
            ...data,
            updatedAt: sql `CURRENT_TIMESTAMP`,
        })
            .where(eq(products.id, id))
            .returning();
        return result[0] || null;
    }
    /**
     * 상품 삭제 (soft delete)
     */
    async delete(id) {
        const result = await this.db
            .update(products)
            .set({ isActive: false })
            .where(eq(products.id, id))
            .returning();
        return result.length > 0;
    }
    /**
     * 재고 업데이트
     */
    async updateStock(id, quantity) {
        const result = await this.db
            .update(products)
            .set({
            stock: sql `${products.stock} + ${quantity}`,
            updatedAt: sql `CURRENT_TIMESTAMP`,
        })
            .where(eq(products.id, id))
            .returning();
        return result[0] || null;
    }
    /**
     * 상품 개수 조회
     */
    // @ts-ignore - signature differs from base
    async count(category) {
        const result = await this.db
            .select({ count: sql `count(*)` })
            .from(products)
            .where(and(eq(products.isActive, true), category ? eq(products.category, category) : undefined));
        return result[0]?.count || 0;
    }
    /**
     * ✅ 기존 코드와의 호환성을 위한 메서드
     */
    async findByCondition(condition) {
        return this.db.select().from(products).where(condition);
    }
}
