/**
 * Products API Routes
 * 
 * Endpoints:
 * - GET    /api/products                   - 상품 목록 조회
 * - GET    /api/products/search/popular    - 인기 검색어 조회
 * - GET    /api/products/search/suggestions - 검색 자동완성
 * - GET    /api/products/:id              - 상품 상세 조회
 * - GET    /api/products/:id/options      - 상품 옵션 목록 조회
 * - POST   /api/products                  - 상품 생성 (판매자 전용)
 * - PUT    /api/products/:id              - 상품 수정 (판매자 전용)
 * - DELETE /api/products/:id              - 상품 삭제 (판매자 전용)
 *
 * NOTE: app.route('/api/products', productsRoutes) 에 등록됨.
 * 내부 경로에 /api/products 를 절대 포함하지 말 것 (더블 prefix 방지).
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import { ProductService } from '../services/ProductService';
import type { ProductFilter, ProductCreateInput, ProductUpdateInput } from '../types';

type Bindings = {
  DB: D1Database;
};

export const productsRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/products/search/popular
 * 인기 검색어 목록 (/api/search/popular 는 worker/index.ts에서 이 경로로 alias 등록됨)
 */
productsRoutes.get('/search/popular', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const result = await DB.prepare(`
      SELECT keyword, search_count
      FROM popular_searches
      ORDER BY search_count DESC
      LIMIT 10
    `).all().catch(() => ({ results: [] }));

    return c.json({
      success: true,
      data: result.results || [],
    });
  } catch (error) {
    return c.json({ success: true, data: [] });
  }
});

/**
 * GET /api/products/search/suggestions?q=...
 * 검색 자동완성 제안 (/api/search/suggestions 로 프론트에서 호출)
 */
productsRoutes.get('/search/suggestions', cors(), async (c) => {
  const { DB } = c.env;
  const q = c.req.query('q') || '';
  if (!q || q.length < 2) return c.json({ success: true, data: [] });

  try {
    const result = await DB.prepare(
      `SELECT DISTINCT name as suggestion FROM products
       WHERE name LIKE ? AND is_active = 1
       ORDER BY name ASC LIMIT 10`
    ).bind(`%${q}%`).all().catch(() => ({ results: [] }));

    return c.json({ success: true, data: (result.results || []).map((r: any) => r.suggestion) });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

/**
 * GET /api/products
 * 상품 목록 조회
 */
productsRoutes.get('/', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    // Query params 파싱
    // featured=true 이면 어드민이 등록한 ur특가 상품(product_type='featured')만 반환
    const featuredOnly = c.req.query('featured') === 'true';
    const filter: ProductFilter = {
      sellerId: c.req.query('seller_id') ? Number(c.req.query('seller_id')) : undefined,
      category: c.req.query('category'),
      status: c.req.query('status') as 'active' | 'inactive' | undefined,
      search: c.req.query('search'),
      minPrice: c.req.query('min_price') ? Number(c.req.query('min_price')) : undefined,
      maxPrice: c.req.query('max_price') ? Number(c.req.query('max_price')) : undefined,
      productType: featuredOnly ? 'featured' : undefined,
    };
    
    const pagination = {
      page: c.req.query('page') ? Number(c.req.query('page')) : 1,
      limit: Math.min(c.req.query('limit') ? Number(c.req.query('limit')) : 20, 100),
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
 * GET /api/products/:id/options
 * 상품 옵션 목록 조회 (useProduct.ts, OptionSelectModal.tsx에서 호출)
 */
productsRoutes.get('/:id/options', cors(), async (c) => {
  const { DB } = c.env;
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ success: false, error: 'Invalid product ID' }, 400);

  try {
    const result = await DB.prepare(
      `SELECT id, product_id, option_type, option_value, price_adjustment, stock_quantity, created_at
       FROM product_options
       WHERE product_id = ?
       ORDER BY option_type, option_value`
    ).bind(id).all().catch(() => ({ results: [] }));

    return c.json({ success: true, data: result.results || [] });
  } catch (err: any) {
    console.error('[Products API] Get options error:', err);
    return c.json({ success: false, error: 'Failed to fetch product options' }, 500);
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
productsRoutes.post('/', cors(), requireAuth(), async (c) => {
  const { DB } = c.env;

  try {
    // Authorization: seller or admin only
    const user = getCurrentUser(c);
    if (!user || (user.type !== 'seller' && user.type !== 'admin')) {
      return c.json({ success: false, error: '셀러 권한이 필요합니다.' }, 403);
    }

    const data: ProductCreateInput = await c.req.json();

    // 필수 필드 검증
    if (!data.name || !data.price || data.stock_quantity === undefined) {
      return c.json({
        success: false,
        error: 'Missing required fields: name, price, stock_quantity'
      }, 400);
    }

    // For sellers, force seller_id to the authenticated seller (prevent spoofing)
    if (user.type === 'seller') {
      data.seller_id = Number(user.id);
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
productsRoutes.put('/:id', cors(), requireAuth(), async (c) => {
  const { DB } = c.env;

  try {
    // Authorization: seller or admin only
    const user = getCurrentUser(c);
    if (!user || (user.type !== 'seller' && user.type !== 'admin')) {
      return c.json({ success: false, error: '셀러 권한이 필요합니다.' }, 403);
    }

    const id = Number(c.req.param('id'));
    const data: ProductUpdateInput = await c.req.json();

    if (isNaN(id)) {
      return c.json({
        success: false,
        error: 'Invalid product ID'
      }, 400);
    }

    // Ownership check (admins bypass)
    if (user.type !== 'admin') {
      const existing = await DB
        .prepare('SELECT seller_id FROM products WHERE id = ?')
        .bind(id)
        .first<{ seller_id: number }>();
      if (!existing) {
        return c.json({ success: false, error: '상품을 찾을 수 없습니다.' }, 404);
      }
      if (existing.seller_id !== Number(user.id)) {
        return c.json({ success: false, error: '다른 셀러의 상품은 수정할 수 없습니다.' }, 403);
      }
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
productsRoutes.delete('/:id', cors(), requireAuth(), async (c) => {
  const { DB } = c.env;

  try {
    // Authorization: seller or admin only
    const user = getCurrentUser(c);
    if (!user || (user.type !== 'seller' && user.type !== 'admin')) {
      return c.json({ success: false, error: '셀러 권한이 필요합니다.' }, 403);
    }

    const id = Number(c.req.param('id'));

    if (isNaN(id)) {
      return c.json({
        success: false,
        error: 'Invalid product ID'
      }, 400);
    }

    // Ownership check (admins bypass)
    if (user.type !== 'admin') {
      const existing = await DB
        .prepare('SELECT seller_id FROM products WHERE id = ?')
        .bind(id)
        .first<{ seller_id: number }>();
      if (!existing) {
        return c.json({ success: false, error: '상품을 찾을 수 없습니다.' }, 404);
      }
      if (existing.seller_id !== Number(user.id)) {
        return c.json({ success: false, error: '다른 셀러의 상품은 수정할 수 없습니다.' }, 403);
      }
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
