import { eq, desc, like, and, sql } from 'drizzle-orm';
import type { DB, Product, NewProduct, ProductOption } from '../db/client';
import { products, productOptions } from '../db/schema';
import { BaseRepository } from './base.repository';

/**
 * ✅ Product Repository with N+1 Prevention
 * 
 * Week 5 Day 3 - DB 타입 안전성 & N+1 쿼리 해결
 */

export interface ProductWithOptions extends Product {
  options: ProductOption[];
}

export class ProductRepository extends BaseRepository<Product> {
  constructor(db: DB) {
    super(db, 'products');
  }

  /**
   * ✅ N+1 해결: 상품 + 옵션 한 번에 조회
   */
  async findById(id: number): Promise<Product | null> {
    const result = await this.db.query.products.findFirst({
      where: eq(products.id, id),
    });

    return result || null;
  }

  /**
   * ✅ N+1 해결: 상품 + 옵션 한 번에 조회
   */
  async findByIdWithOptions(id: number): Promise<ProductWithOptions | null> {
    const result = await this.db.query.products.findFirst({
      where: eq(products.id, id),
      with: {
        options: true,
      },
    });

    return (result as ProductWithOptions) || null;
  }

  /**
   * ✅ N+1 해결: 활성 상품 목록 + 옵션
   */
  async findActiveProductsWithOptions(options?: {
    limit?: number;
    offset?: number;
    category?: string;
  }): Promise<ProductWithOptions[]> {
    const { limit = 20, offset = 0, category } = options || {};

    const result = await this.db.query.products.findMany({
      where: and(
        eq(products.isActive, true),
        category ? eq(products.category, category) : undefined
      ),
      with: {
        options: true,
      },
      orderBy: [desc(products.createdAt)],
      limit,
      offset,
    });

    return result as ProductWithOptions[];
  }

  /**
   * 모든 상품 조회
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: 'asc' | 'desc';
  }): Promise<Product[]> {
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
  async search(query: string, options?: { limit?: number; offset?: number }): Promise<ProductWithOptions[]> {
    const { limit = 20, offset = 0 } = options || {};

    const result = await this.db.query.products.findMany({
      where: and(
        eq(products.isActive, true),
        like(products.name, `%${query}%`)
      ),
      with: {
        options: true,
      },
      limit,
      offset,
    });

    return result as ProductWithOptions[];
  }

  /**
   * 카테고리별 상품 조회
   */
  async findByCategory(
    category: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductWithOptions[]> {
    const { limit = 20, offset = 0 } = options || {};

    const result = await this.db.query.products.findMany({
      where: and(
        eq(products.isActive, true),
        eq(products.category, category)
      ),
      with: {
        options: true,
      },
      orderBy: [desc(products.createdAt)],
      limit,
      offset,
    });

    return result as ProductWithOptions[];
  }

  /**
   * 라이브 스트림 상품 조회
   */
  async findByLiveStreamId(liveStreamId: number): Promise<ProductWithOptions[]> {
    const result = await this.db.query.products.findMany({
      where: and(
        eq(products.liveStreamId, liveStreamId),
        eq(products.isActive, true)
      ),
      with: {
        options: true,
      },
      orderBy: [desc(products.createdAt)],
    });

    return result as ProductWithOptions[];
  }

  /**
   * 상품 생성
   */
  async create(data: NewProduct): Promise<Product> {
    const result = await this.db.insert(products).values(data).returning();
    return result[0];
  }

  /**
   * 상품 업데이트
   */
  async update(id: number, data: Partial<Omit<Product, 'id'>>): Promise<Product | null> {
    const result = await this.db
      .update(products)
      .set({
        ...data,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(products.id, id))
      .returning();

    return result[0] || null;
  }

  /**
   * 상품 삭제 (soft delete)
   */
  async delete(id: number): Promise<boolean> {
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
  async updateStock(id: number, quantity: number): Promise<Product | null> {
    const result = await this.db
      .update(products)
      .set({
        stock: sql`${products.stock} + ${quantity}`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(products.id, id))
      .returning();

    return result[0] || null;
  }

  /**
   * 상품 개수 조회
   */
  async count(category?: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          category ? eq(products.category, category) : undefined
        )
      );

    return result[0]?.count || 0;
  }

  /**
   * ✅ 기존 코드와의 호환성을 위한 메서드
   */
  async findByCondition(condition: any): Promise<Product[]> {
    return this.db.select().from(products).where(condition);
  }
}
