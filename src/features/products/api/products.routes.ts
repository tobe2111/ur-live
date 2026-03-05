/**
 * Products API Routes
 * 
 * Endpoints:
 * - GET    /api/products         - 상품 목록 조회
 * - GET    /api/products/:id     - 상품 상세 조회
 * - POST   /api/products         - 상품 생성 (판매자 전용)
 * - PUT    /api/products/:id     - 상품 수정 (판매자 전용)
 * - DELETE /api/products/:id     - 상품 삭제 (판매자 전용)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ProductService } from '../services/ProductService';
import type { ProductFilter, ProductCreateInput, ProductUpdateInput } from '../types';

type Bindings = {
  DB: D1Database;
};

export const productsRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/products
 * 상품 목록 조회
 */
productsRoutes.get('/', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    // Query params 파싱
    const filter: ProductFilter = {
      sellerId: c.req.query('seller_id') ? Number(c.req.query('seller_id')) : undefined,
      category: c.req.query('category'),
      status: c.req.query('status') as 'active' | 'inactive' | undefined,
      search: c.req.query('search'),
      minPrice: c.req.query('min_price') ? Number(c.req.query('min_price')) : undefined,
      maxPrice: c.req.query('max_price') ? Number(c.req.query('max_price')) : undefined,
    };
    
    const pagination = {
      page: c.req.query('page') ? Number(c.req.query('page')) : 1,
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : 20,
    };
    
    const service = new ProductService(DB);
    const result = await service.getProducts(filter, pagination);
    
    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
    
  } catch (error) {
    console.error('[Products API] Get list error:', error);
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500);
  }
});

/**
 * GET /api/products/:id
 * 상품 상세 조회
 */
productsRoutes.get('/:id', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const id = Number(c.req.param('id'));
    
    if (isNaN(id)) {
      return c.json({
        success: false,
        error: 'Invalid product ID'
      }, 400);
    }
    
    const service = new ProductService(DB);
    const product = await service.getProduct(id);
    
    return c.json({
      success: true,
      data: product
    });
    
  } catch (error) {
    console.error('[Products API] Get detail error:', error);
    
    if ((error as Error).message === 'Product not found') {
      return c.json({
        success: false,
        error: 'Product not found'
      }, 404);
    }
    
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500);
  }
});

/**
 * POST /api/products
 * 상품 생성 (판매자 전용)
 */
productsRoutes.post('/', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const data: ProductCreateInput = await c.req.json();
    
    // 필수 필드 검증
    if (!data.name || !data.price || data.stock_quantity === undefined) {
      return c.json({
        success: false,
        error: 'Missing required fields: name, price, stock_quantity'
      }, 400);
    }
    
    const service = new ProductService(DB);
    const product = await service.createProduct(data);
    
    return c.json({
      success: true,
      data: product
    }, 201);
    
  } catch (error) {
    console.error('[Products API] Create error:', error);
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500);
  }
});

/**
 * PUT /api/products/:id
 * 상품 수정 (판매자 전용)
 */
productsRoutes.put('/:id', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const id = Number(c.req.param('id'));
    const data: ProductUpdateInput = await c.req.json();
    
    if (isNaN(id)) {
      return c.json({
        success: false,
        error: 'Invalid product ID'
      }, 400);
    }
    
    const service = new ProductService(DB);
    const product = await service.updateProduct(id, data);
    
    return c.json({
      success: true,
      data: product
    });
    
  } catch (error) {
    console.error('[Products API] Update error:', error);
    
    if ((error as Error).message === 'Product not found') {
      return c.json({
        success: false,
        error: 'Product not found'
      }, 404);
    }
    
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500);
  }
});

/**
 * DELETE /api/products/:id
 * 상품 삭제 (판매자 전용)
 */
productsRoutes.delete('/:id', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const id = Number(c.req.param('id'));
    
    if (isNaN(id)) {
      return c.json({
        success: false,
        error: 'Invalid product ID'
      }, 400);
    }
    
    const service = new ProductService(DB);
    await service.deleteProduct(id);
    
    return c.json({
      success: true,
      message: 'Product deleted successfully'
    });
    
  } catch (error) {
    console.error('[Products API] Delete error:', error);
    
    if ((error as Error).message === 'Product not found') {
      return c.json({
        success: false,
        error: 'Product not found'
      }, 404);
    }
    
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500);
  }
});

export default productsRoutes;
