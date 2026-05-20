/**
 * Product Service
 * 비즈니스 로직 계층
 */

import { ProductRepository } from '../repositories/ProductRepository';
import type { 
  Product, 
  ProductFilter, 
  ProductCreateInput, 
  ProductUpdateInput,
  PaginationParams,
  PaginatedResponse 
} from '../types';

export class ProductService {
  private repository: ProductRepository;
  
  constructor(db: D1Database) {
    this.repository = new ProductRepository(db);
  }
  
  /**
   * 상품 상세 조회
   */
  async getProduct(id: number): Promise<Product> {
    const product = await this.repository.findById(id);
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    return product;
  }
  
  /**
   * 상품 목록 조회 (페이지네이션)
   */
  async getProducts(
    filter: ProductFilter,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<Product>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const offset = (page - 1) * limit;

    // 🛡️ 2026-05-20: search 가 있으면 FTS5 + bm25 ranking (한국어 trigram, migration 0275).
    //   기존: findAll 의 LIKE 만 사용 → 한국어 부분매칭 약함 + ranking 없음.
    //   영구 패턴: search → searchByText, 일반 list → findAll.
    //   total count 는 가볍게 추정 (FTS5 는 count 가 비용 큼 → 단일 page 결과 < limit 면 total = offset + len).
    if (filter.search && filter.search.trim().length >= 1) {
      const { search: q, ...rest } = filter;
      const products = await this.repository.searchByText(q, rest, offset, limit);
      // FTS5 검색은 정확한 count 가 비싸므로 추정. 마지막 페이지 판단만 정확하면 충분.
      const estimatedTotal = products.length < limit ? offset + products.length : offset + limit + 1;
      return {
        data: products,
        pagination: {
          page,
          limit,
          total: estimatedTotal,
          totalPages: Math.ceil(estimatedTotal / limit),
        },
      };
    }

    const [products, total] = await Promise.all([
      this.repository.findAll(filter, offset, limit),
      this.repository.count(filter)
    ]);
    
    return {
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
  
  /**
   * 상품 생성
   */
  async createProduct(data: ProductCreateInput): Promise<Product> {
    // 비즈니스 로직 검증
    if (data.price <= 0) {
      throw new Error('Price must be greater than 0');
    }
    
    if (data.stock_quantity < 0) {
      throw new Error('Stock quantity cannot be negative');
    }
    
    return await this.repository.create(data);
  }
  
  /**
   * 상품 업데이트
   */
  async updateProduct(id: number, data: ProductUpdateInput): Promise<Product> {
    // 상품 존재 확인
    await this.getProduct(id);
    
    // 비즈니스 로직 검증
    if (data.price !== undefined && data.price <= 0) {
      throw new Error('Price must be greater than 0');
    }
    
    if (data.stock_quantity !== undefined && data.stock_quantity < 0) {
      throw new Error('Stock quantity cannot be negative');
    }
    
    return await this.repository.update(id, data);
  }
  
  /**
   * 상품 삭제
   */
  async deleteProduct(id: number): Promise<void> {
    // 상품 존재 확인
    await this.getProduct(id);
    
    await this.repository.delete(id);
  }
  
  /**
   * 재고 감소
   */
  async decreaseStock(id: number, quantity: number): Promise<Product> {
    const product = await this.getProduct(id);
    
    if (product.stock_quantity < quantity) {
      throw new Error('Insufficient stock');
    }
    
    return await this.repository.update(id, {
      stock_quantity: product.stock_quantity - quantity
    });
  }
  
  /**
   * 재고 증가
   */
  async increaseStock(id: number, quantity: number): Promise<Product> {
    const product = await this.getProduct(id);
    
    return await this.repository.update(id, {
      stock_quantity: product.stock_quantity + quantity
    });
  }
}
