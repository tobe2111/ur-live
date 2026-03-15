// ============================================================
// Product Routes
// GET /api/products
// GET /api/products/:id
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { ProductRepository } from '../repositories/product.repository';
import type { AuthVariables } from '../middleware/auth.middleware';

const productsRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/products
productsRouter.get('/', async (c) => {
  try {
    const repo = new ProductRepository(c.env.DB);
    const {
      seller_id,
      category_id,
      search,
      page = '1',
      limit = '20',
    } = c.req.query();

    const { products, total } = await repo.findMany({
      seller_id,
      category_id,
      status: 'ACTIVE',
      search,
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
    });

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);

    return c.json({
      success: true,
      data: {
        items: products,
        total,
        page: pageNum,
        limit: limitNum,
        has_next: pageNum * limitNum < total,
      },
    });
  } catch (err) {
    console.error('[PRODUCTS] List error:', err);
    return c.json({ success: false, error: 'Failed to fetch products' }, 500);
  }
});

// GET /api/products/:id
productsRouter.get('/:id', async (c) => {
  try {
    const repo = new ProductRepository(c.env.DB);
    const product = await repo.findById(c.req.param('id'));

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
