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
import { getFeatureFlags } from '@/worker/utils/feature-flags';
import { rateLimit } from '@/worker/middleware/rate-limit';
import { logError } from '@/worker/utils/logger';
import { ALLOWED_ORIGINS } from '../../../shared/constants';
import { invalidateProductCache } from '../../../lib/cache-invalidation';
import { validateImageUrl } from '../../../worker/utils/validation';
import type { KVNamespace } from '@cloudflare/workers-types';
import { ProductService } from '../services/ProductService';
import type { ProductFilter, ProductCreateInput, ProductUpdateInput } from '../types';

// 🛡️ 2026-04-22: bare cors() 는 모든 origin 허용. 민감 routes 에 쓰지 말고 아래 tightCors 사용.
const tightCors = () => cors({ origin: [...ALLOWED_ORIGINS], credentials: true });

type Bindings = {
  DB: D1Database;
  SESSION_KV?: KVNamespace;
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
  // Kill switch: serve empty suggestions during traffic spikes to cut DB load
  const flags = await getFeatureFlags(c.env.SESSION_KV, c.env.DB);
  if (!flags.enable_search_suggestions) {
    return c.json({ success: true, data: [] });
  }

  const { DB } = c.env;
  const q = c.req.query('q') || '';
  if (!q || q.length < 2) return c.json({ success: true, data: [] });
  // Defensive: cap query length to prevent DoS via giant LIKE patterns.
  if (q.length > 200) return c.json({ success: true, data: [] });

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
    // Defensive: cap search string length (200) to prevent giant LIKE DoS.
    const rawSearch = c.req.query('search');
    const safeSearch = rawSearch && rawSearch.length <= 200 ? rawSearch : undefined;
    const rawSort = c.req.query('sort');
    const allowedSorts = ['newest', 'popular', 'price_low', 'price_high', 'rating', 'ranking'] as const;
    const sort = rawSort && (allowedSorts as readonly string[]).includes(rawSort)
      ? (rawSort as typeof allowedSorts[number])
      : undefined;
    const filter: ProductFilter = {
      sellerId: c.req.query('seller_id') ? Number(c.req.query('seller_id')) : undefined,
      category: c.req.query('category'),
      status: c.req.query('status') as 'active' | 'inactive' | undefined,
      search: safeSearch,
      minPrice: c.req.query('min_price') ? Number(c.req.query('min_price')) : undefined,
      maxPrice: c.req.query('max_price') ? Number(c.req.query('max_price')) : undefined,
      productType: featuredOnly ? 'featured' : undefined,
      sort,
    };

    const pagination = {
      page: c.req.query('page') ? Number(c.req.query('page')) : 1,
      limit: Math.min(c.req.query('limit') ? Number(c.req.query('limit')) : 20, 100),
    };

    // SESSION_KV 캐시 체크 (공개 목록 — 인증 불필요, 60초 TTL)
    const kv: KVNamespace | undefined = (c.env as { SESSION_KV?: KVNamespace }).SESSION_KV;
    const cacheKey = `cache:products:list:${pagination.page}:${pagination.limit}:${filter.category || ''}:${safeSearch || ''}:${filter.sellerId || ''}:${featuredOnly ? 'featured' : ''}:${sort || ''}`;
    if (kv) {
      const cached = await kv.get(cacheKey, 'text');
      if (cached) return c.json(JSON.parse(cached));
    }

    const service = new ProductService(DB);
    const result = await service.getProducts(filter, pagination);

    const responseData = {
      success: true,
      data: result.data,
      pagination: result.pagination
    };

    // 결과를 KV에 캐시 (60초)
    if (kv) {
      c.executionCtx.waitUntil(kv.put(cacheKey, JSON.stringify(responseData), { expirationTtl: 60 }));
    }

    return c.json(responseData);

  } catch (error) {
    logError('products.list.error', { error: (error as Error)?.message });
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
    logError('products.options.error', { error: (err as Error)?.message });
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
    logError('products.detail.error', { error: (error as Error)?.message });

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
productsRoutes.post('/', tightCors(), rateLimit({ action: 'product_create', max: 20, windowSec: 300 }), requireAuth(), async (c) => {
  const { DB } = c.env;

  try {
    // Authorization: admin only (정책: 상품 등록은 어드민 전용.
    // 셀러는 라이브 방송 중 기존 상품을 연결해 판매)
    const user = getCurrentUser(c);
    if (!user || user.type !== 'admin') {
      return c.json({ success: false, error: '어드민 권한이 필요합니다.' }, 403);
    }

    const data: ProductCreateInput = await c.req.json();

    // 필수 필드 검증
    if (!data.name || !data.price || data.stock_quantity === undefined) {
      return c.json({
        success: false,
        error: 'Missing required fields: name, price, stock_quantity'
      }, 400);
    }

    // 숫자 범위 검증 (H10: 음수/초대형/NaN 방지)
    const price = Number(data.price);
    const stock = Number(data.stock_quantity);
    if (!Number.isFinite(price) || price < 0 || price > 100_000_000) {
      return c.json({
        success: false,
        error: '가격은 0~1억원 범위여야 합니다.'
      }, 400);
    }
    if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
      return c.json({
        success: false,
        error: '재고는 0~100만 정수여야 합니다.'
      }, 400);
    }
    data.price = price;
    data.stock_quantity = stock;

    // 🛡️ 2026-04-22: image_url 검증 (javascript:, data:, file://, 내부 IP SSRF 방어)
    if (data.image_url) {
      const imgCheck = validateImageUrl(data.image_url);
      if (!imgCheck.valid) {
        return c.json({ success: false, error: `image_url: ${imgCheck.error}` }, 400);
      }
    }
    if (data.thumbnail_url) {
      const thCheck = validateImageUrl(data.thumbnail_url);
      if (!thCheck.valid) {
        return c.json({ success: false, error: `thumbnail_url: ${thCheck.error}` }, 400);
      }
    }

    // 어드민 전용 엔드포인트이므로 seller_id 는 요청 body 값을 신뢰 (어드민이 명시)
    // 셀러 상품 등록은 별도 POST /api/seller/products 경로 사용

    const service = new ProductService(DB);
    const product = await service.createProduct(data);

    // 🔄 Edge cache 무효화 — 신규 상품 즉시 목록에 반영
    c.executionCtx.waitUntil(invalidateProductCache(product?.id));

    return c.json({
      success: true,
      data: product
    }, 201);
    
  } catch (error) {
    logError('products.create.error', { error: (error as Error)?.message });
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
productsRoutes.put('/:id', tightCors(), requireAuth(), async (c) => {
  const { DB } = c.env;

  try {
    // Authorization: admin only (정책: 상품 CRUD 는 어드민 전용)
    const user = getCurrentUser(c);
    if (!user || user.type !== 'admin') {
      return c.json({ success: false, error: '어드민 권한이 필요합니다.' }, 403);
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

    // 🔄 Edge cache 무효화 — 수정된 가격/정보 즉시 반영
    c.executionCtx.waitUntil(invalidateProductCache(id));

    return c.json({
      success: true,
      data: product
    });

  } catch (error) {
    logError('products.update.error', { error: (error as Error)?.message });

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
productsRoutes.delete('/:id', tightCors(), requireAuth(), async (c) => {
  const { DB } = c.env;

  try {
    // Authorization: admin only (정책: 상품 CRUD 는 어드민 전용)
    const user = getCurrentUser(c);
    if (!user || user.type !== 'admin') {
      return c.json({ success: false, error: '어드민 권한이 필요합니다.' }, 403);
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

    // 🔄 Edge cache 무효화 — 삭제된 상품 즉시 목록에서 제거
    c.executionCtx.waitUntil(invalidateProductCache(id));

    return c.json({
      success: true,
      message: 'Product deleted successfully'
    });
    
  } catch (error) {
    logError('products.delete.error', { error: (error as Error)?.message });

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
