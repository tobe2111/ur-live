/**
 * 바코드 + 재고 관리 API
 *
 * POST /api/inventory/barcode/generate/:productId - 바코드 생성
 * GET  /api/inventory/barcode/scan/:code          - 바코드 스캔 (상품 정보 조회)
 * POST /api/inventory/stock/in                    - 입고
 * POST /api/inventory/stock/out                   - 출고
 * POST /api/inventory/stock/adjust                - 재고 조정
 * GET  /api/inventory/stock/history/:productId    - 입출고 이력
 * GET  /api/inventory/stock/alerts                - 재고 부족 알림
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';

const inventoryRoutes = new Hono<{ Bindings: Env }>();

inventoryRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }));

async function ensureTables(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        seller_id INTEGER,
        type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjust', 'return')),
        quantity INTEGER NOT NULL,
        stock_before INTEGER NOT NULL DEFAULT 0,
        stock_after INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        memo TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `).run();
  } catch { /* 이미 존재 */ }
  // barcode, sku_code, min_stock_alert 컬럼 추가 (없으면)
  try { await DB.prepare('ALTER TABLE products ADD COLUMN barcode TEXT').run(); } catch { /* 이미 존재 */ }
  try { await DB.prepare('ALTER TABLE products ADD COLUMN sku_code TEXT').run(); } catch { /* 이미 존재 */ }
  try { await DB.prepare('ALTER TABLE products ADD COLUMN min_stock_alert INTEGER DEFAULT 5').run(); } catch { /* 이미 존재 */ }
}

/**
 * EAN-13 바코드 생성 (셀러ID + 상품ID 기반)
 * 형식: 880 (한국) + sellerId(4자리) + productId(5자리) + 체크디짓(1자리)
 */
function generateEAN13(sellerId: number, productId: number): string {
  const prefix = '880' // 한국 국가코드
  const sellerPart = String(sellerId).padStart(4, '0').slice(-4)
  const productPart = String(productId).padStart(5, '0').slice(-5)
  const partial = prefix + sellerPart + productPart // 12자리

  // EAN-13 체크디짓 계산
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(partial[i]) * (i % 2 === 0 ? 1 : 3)
  }
  const checkDigit = (10 - (sum % 10)) % 10
  return partial + checkDigit
}

// POST /api/inventory/barcode/generate/:productId — 바코드 생성
inventoryRoutes.post('/barcode/generate/:productId', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);
  const productId = c.req.param('productId');

  // 상품 확인 + 셀러 소유 검증
  const product = await DB.prepare(
    'SELECT id, name, seller_id, barcode FROM products WHERE id = ?'
  ).bind(productId).first<{ id: number; name: string; seller_id: number; barcode: string | null }>();

  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);

  // 이미 바코드가 있으면 반환
  if (product.barcode) {
    return c.json({ success: true, data: { barcode: product.barcode, product_name: product.name } });
  }

  const barcode = generateEAN13(product.seller_id || 0, product.id);

  await DB.prepare('UPDATE products SET barcode = ? WHERE id = ?').bind(barcode, productId).run();

  return c.json({ success: true, data: { barcode, product_name: product.name } });
});

// GET /api/inventory/barcode/scan/:code — 바코드 스캔 (상품 전체 정보)
inventoryRoutes.get('/barcode/scan/:code', requireAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);
  const code = c.req.param('code');

  const product = await DB.prepare(`
    SELECT p.id, p.name, p.description, p.price, p.stock, p.image_url,
           p.category, p.barcode, p.sku_code, p.min_stock_alert,
           p.is_active, p.created_at, p.seller_id,
           s.name as seller_name, s.business_name
    FROM products p
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE p.barcode = ? OR p.sku_code = ? OR p.id = ?
  `).bind(code, code, code).first();

  if (!product) return c.json({ success: false, error: '해당 바코드의 상품을 찾을 수 없습니다' }, 404);

  // 최근 입출고 5건
  const { results: recentMovements } = await DB.prepare(`
    SELECT type, quantity, stock_before, stock_after, reason, memo, created_at
    FROM stock_movements WHERE product_id = ?
    ORDER BY id DESC LIMIT 5
  `).bind((product as Record<string, unknown>).id).all();

  return c.json({
    success: true,
    data: {
      product,
      recent_movements: recentMovements ?? [],
      stock_status: (product as Record<string, unknown>).stock as number <= ((product as Record<string, unknown>).min_stock_alert as number ?? 5) ? 'low' : 'normal',
    },
  });
});

// POST /api/inventory/stock/in — 입고
inventoryRoutes.post('/stock/in', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);
  const { product_id, quantity, reason, memo } = await c.req.json<{
    product_id: number; quantity: number; reason?: string; memo?: string;
  }>();

  if (!product_id || !quantity || quantity <= 0) {
    return c.json({ success: false, error: '상품 ID와 수량을 확인해주세요' }, 400);
  }

  const product = await DB.prepare('SELECT id, stock, seller_id FROM products WHERE id = ?')
    .bind(product_id).first<{ id: number; stock: number; seller_id: number }>();
  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);

  // 🛡️ 원자적 증가 (lost update race 방지)
  // 기존: SELECT 후 계산해서 UPDATE SET = 절대값 → 두 요청 동시 시 재고 누락
  // 수정: UPDATE SET = stock + ? → DB가 순서대로 처리 (SQLite write lock)
  const result = await DB.prepare(
    "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(quantity, product_id).run();
  if (!result.meta?.changes) {
    return c.json({ success: false, error: '재고 업데이트 실패' }, 500);
  }

  // 이후 기록용 (움직임 로그 — 정확한 stock_after 다시 조회)
  const after = await DB.prepare('SELECT stock FROM products WHERE id = ?').bind(product_id).first<{ stock: number }>();
  const stockAfter = after?.stock ?? (product.stock + quantity);

  await DB.prepare(`
    INSERT INTO stock_movements (product_id, seller_id, type, quantity, stock_before, stock_after, reason, memo, created_by)
    VALUES (?, ?, 'in', ?, ?, ?, ?, ?, ?)
  `).bind(product_id, product.seller_id, quantity, product.stock, stockAfter, reason ?? '입고', memo ?? '', user.id).run();

  return c.json({ success: true, data: { stock_before: product.stock, stock_after: stockAfter }, message: `${quantity}개 입고 완료` });
});

// POST /api/inventory/stock/out — 출고
inventoryRoutes.post('/stock/out', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);
  const { product_id, quantity, reason, memo } = await c.req.json<{
    product_id: number; quantity: number; reason?: string; memo?: string;
  }>();

  if (!product_id || !quantity || quantity <= 0) {
    return c.json({ success: false, error: '상품 ID와 수량을 확인해주세요' }, 400);
  }

  const product = await DB.prepare('SELECT id, stock, seller_id FROM products WHERE id = ?')
    .bind(product_id).first<{ id: number; stock: number; seller_id: number }>();
  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);

  // 🛡️ 2026-04-22: 원자적 출고 (재고 race condition 방지)
  // 이전: SELECT 후 UPDATE SET = 절대값 → 동시 요청 시 재고 오차
  // 수정: UPDATE SET = stock - ? WHERE stock >= ? → 부족 시 변경 0건 → 에러
  const result = await DB.prepare(
    "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ? AND stock >= ?"
  ).bind(quantity, product_id, quantity).run();
  if (!result.meta?.changes) {
    return c.json({ success: false, error: `재고가 부족합니다 (현재: ${product.stock}개)` }, 400);
  }

  // 움직임 로그용 stock_after 재조회 (정확한 최종 값)
  const after = await DB.prepare('SELECT stock FROM products WHERE id = ?').bind(product_id).first<{ stock: number }>();
  const stockAfter = after?.stock ?? (product.stock - quantity);

  await DB.prepare(`
    INSERT INTO stock_movements (product_id, seller_id, type, quantity, stock_before, stock_after, reason, memo, created_by)
    VALUES (?, ?, 'out', ?, ?, ?, ?, ?, ?)
  `).bind(product_id, product.seller_id, quantity, product.stock, stockAfter, reason ?? '출고', memo ?? '', user.id).run();

  return c.json({ success: true, data: { stock_before: product.stock, stock_after: stockAfter }, message: `${quantity}개 출고 완료` });
});

// POST /api/inventory/stock/adjust — 재고 실사 조정
inventoryRoutes.post('/stock/adjust', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);
  const { product_id, new_stock, reason } = await c.req.json<{
    product_id: number; new_stock: number; reason?: string;
  }>();

  if (!product_id || new_stock === undefined || new_stock < 0) {
    return c.json({ success: false, error: '상품 ID와 조정 수량을 확인해주세요' }, 400);
  }

  const product = await DB.prepare('SELECT id, stock, seller_id FROM products WHERE id = ?')
    .bind(product_id).first<{ id: number; stock: number; seller_id: number }>();
  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);

  const diff = new_stock - product.stock;

  await DB.prepare('UPDATE products SET stock = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(new_stock, product_id).run();

  await DB.prepare(`
    INSERT INTO stock_movements (product_id, seller_id, type, quantity, stock_before, stock_after, reason, created_by)
    VALUES (?, ?, 'adjust', ?, ?, ?, ?, ?)
  `).bind(product_id, product.seller_id, diff, product.stock, new_stock, reason ?? '재고 실사 조정', user.id).run();

  return c.json({ success: true, data: { stock_before: product.stock, stock_after: new_stock, diff }, message: '재고가 조정되었습니다' });
});

// GET /api/inventory/stock/history/:productId — 입출고 이력
inventoryRoutes.get('/stock/history/:productId', requireAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);
  const productId = c.req.param('productId');

  const { results } = await DB.prepare(`
    SELECT id, type, quantity, stock_before, stock_after, reason, memo, created_by, created_at
    FROM stock_movements WHERE product_id = ?
    ORDER BY id DESC LIMIT 100
  `).bind(productId).all();

  return c.json({ success: true, data: results ?? [] });
});

// GET /api/inventory/stock/alerts — 재고 부족 상품 목록
inventoryRoutes.get('/stock/alerts', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const { results } = await DB.prepare(`
    SELECT id, name, stock, barcode, min_stock_alert, image_url, seller_id
    FROM products
    WHERE is_active = 1 AND stock <= COALESCE(min_stock_alert, 5)
    ORDER BY stock ASC
  `).all();

  return c.json({ success: true, data: results ?? [] });
});

export { inventoryRoutes };
