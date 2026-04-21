// ============================================================
// Product Routes
// GET /api/products
// GET /api/products/:id
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { ProductRepository } from '../repositories/product.repository';
import type { AuthVariables } from '../middleware/auth.middleware';
import { cacheGet, buildCacheKey } from '../utils/cache';

const productsRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/products
productsRouter.get('/', async (c) => {
  try {
    const {
      seller_id,
      category_id,
      search,
      page = '1',
      limit = '20',
    } = c.req.query();

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);

    // Only cache anonymous, non-search listings — searches have too much key cardinality
    const cacheable = !search;
    const cacheKey = buildCacheKey('products', {
      page: pageNum,
      limit: limitNum,
      seller: seller_id,
      category: category_id,
    });

    const payload = await (cacheable
      ? cacheGet(
          c.env.SESSION_KV,
          cacheKey,
          async () => {
            const repo = new ProductRepository(c.env.DB);
            const { products, total } = await repo.findMany({
              seller_id,
              category_id,
              status: 'ACTIVE',
              search,
              page: pageNum,
              limit: limitNum,
            });
            return {
              items: products,
              total,
              page: pageNum,
              limit: limitNum,
              has_next: pageNum * limitNum < total,
            };
          },
          { ttl: 60, staleWhileRevalidate: 30 }
        )
      : (async () => {
          const repo = new ProductRepository(c.env.DB);
          const { products, total } = await repo.findMany({
            seller_id,
            category_id,
            status: 'ACTIVE',
            search,
            page: pageNum,
            limit: limitNum,
          });
          return {
            items: products,
            total,
            page: pageNum,
            limit: limitNum,
            has_next: pageNum * limitNum < total,
          };
        })());

    return c.json({ success: true, data: payload });
  } catch (err) {
    console.error('[PRODUCTS] List error:', err);
    return c.json({ success: false, error: 'Failed to fetch products' }, 500);
  }
});

// GET /api/products/:id
productsRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const product = await cacheGet(
      c.env.SESSION_KV,
      `product:${id}`,
      async () => {
        const repo = new ProductRepository(c.env.DB);
        return repo.findById(id);
      },
      { ttl: 60, staleWhileRevalidate: 60 }
    );

    if (!product) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    return c.json({ success: true, data: product });
  } catch (err) {
    console.error('[PRODUCTS] Detail error:', err);
    return c.json({ success: false, error: 'Failed to fetch product' }, 500);
  }
});

export { productsRouter };
