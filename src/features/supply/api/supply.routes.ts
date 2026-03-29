/**
 * Supply Chain API Routes (셀러 공급 상품 시스템)
 *
 * GET  /api/supply/products              - 셀러: 공급 상품 목록 조회
 * POST /api/supply/sample-requests       - 셀러: 샘플 신청
 * GET  /api/supply/sample-requests       - 셀러: 내 샘플 신청 목록
 * POST /api/supply/register              - 셀러: 승인된 공급 상품을 내 스토어에 등록
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';

const supplyRoutes = new Hono<{ Bindings: Env }>();

supplyRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

// ── 공통: JWT에서 seller_id 추출 ─────────────────────────────────────────────
async function getSellerIdFromToken(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization?.startsWith('Bearer ')) return null;
  try {
    const token = authorization.substring(7);
    const { verify } = await import('hono/jwt');
    const payload = await verify(token, jwtSecret, 'HS256') as { seller_id?: number };
    return payload.seller_id ?? null;
  } catch {
    return null;
  }
}

// ── GET /api/supply/products ──────────────────────────────────────────────────
// 어드민이 등록한 공급 상품 목록 (셀러 로그인 필요)
// 각 상품에 현재 셀러의 샘플 신청 상태 포함
supplyRoutes.get('/products', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
  const offset = (page - 1) * limit;
  const search = c.req.query('search') || '';
  const category = c.req.query('category') || '';

  try {
    // is_supply_product / supply_price 컬럼이 없는 구버전 스키마 대응
    // 컬럼이 없으면 빈 목록 반환
    let where = "p.is_active = 1";
    const params: (string | number)[] = [];

    if (search) {
      where += " AND p.name LIKE ?";
      params.push(`%${search}%`);
    }
    if (category) {
      where += " AND p.category = ?";
      params.push(category);
    }

    // is_supply_product 컬럼 존재 여부를 먼저 확인
    const hasSupplyCol = await DB.prepare(
      "SELECT COUNT(*) as c FROM pragma_table_info('products') WHERE name='is_supply_product'"
    ).first<{ c: number }>().catch(() => null);

    if (!hasSupplyCol || hasSupplyCol.c === 0) {
      // 마이그레이션 0120 미실행 — 빈 목록 반환
      return c.json({ success: true, data: { items: [], total: 0, page, limit, has_more: false } });
    }

    where = "p.is_supply_product = 1 AND p.is_active = 1";
    if (search) { where += " AND p.name LIKE ?"; }
    if (category) { where += " AND p.category = ?"; }

    const rows = await DB.prepare(`
      SELECT
        p.id,
        p.name,
        p.description,
        p.price         AS retail_price,
        COALESCE(p.supply_price, 0) AS supply_price,
        p.image_url,
        p.stock,
        p.category,
        p.product_type,
        sr.id           AS request_id,
        sr.status       AS request_status,
        sr.seller_memo,
        sr.admin_memo,
        sr.created_at   AS request_created_at,
        sr.approved_at
      FROM products p
      LEFT JOIN sample_requests sr ON sr.product_id = p.id AND sr.seller_id = ?
      WHERE ${where}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(sellerId, ...params, limit, offset).all<{
      id: number;
      name: string;
      description: string | null;
      retail_price: number;
      supply_price: number;
      image_url: string | null;
      stock: number;
      category: string | null;
      product_type: string | null;
      request_id: number | null;
      request_status: string | null;
      seller_memo: string | null;
      admin_memo: string | null;
      request_created_at: string | null;
      approved_at: string | null;
    }>();

    const total = await DB.prepare(
      `SELECT COUNT(*) as count FROM products p WHERE ${where}`
    ).bind(...params).first<{ count: number }>();

    return c.json({
      success: true,
      data: {
        items: rows.results ?? [],
        total: total?.count ?? 0,
        page,
        limit,
        has_more: (total?.count ?? 0) > offset + limit,
      },
    });
  } catch (err) {
    console.error('[Supply] GET /products error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── POST /api/supply/sample-requests ─────────────────────────────────────────
// 셀러가 샘플 신청
supplyRoutes.post('/sample-requests', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  const body = await c.req.json<{ product_id: number; seller_memo?: string }>();

  if (!body.product_id) {
    return c.json({ success: false, error: '상품 ID가 필요합니다' }, 400);
  }

  try {
    // 마이그레이션 0120 미실행 확인
    const hasSupplyCol = await DB.prepare(
      "SELECT COUNT(*) as c FROM pragma_table_info('products') WHERE name='is_supply_product'"
    ).first<{ c: number }>().catch(() => null);
    if (!hasSupplyCol || hasSupplyCol.c === 0) {
      return c.json({ success: false, error: '공급가 시스템이 아직 활성화되지 않았습니다. 관리자에게 문의하세요.' }, 503);
    }

    // 공급 상품인지 확인
    const product = await DB.prepare(
      'SELECT id, name FROM products WHERE id = ? AND is_supply_product = 1 AND is_active = 1'
    ).bind(body.product_id).first<{ id: number; name: string }>();

    if (!product) {
      return c.json({ success: false, error: '해당 공급 상품을 찾을 수 없습니다' }, 404);
    }

    // 이미 신청했는지 확인
    const existing = await DB.prepare(
      'SELECT id, status FROM sample_requests WHERE seller_id = ? AND product_id = ?'
    ).bind(sellerId, body.product_id).first<{ id: number; status: string }>();

    if (existing) {
      return c.json({
        success: false,
        error: `이미 신청한 상품입니다 (상태: ${existing.status})`,
        data: existing,
      }, 409);
    }

    const result = await DB.prepare(`
      INSERT INTO sample_requests (seller_id, product_id, status, seller_memo, created_at, updated_at)
      VALUES (?, ?, 'PENDING', ?, datetime('now'), datetime('now'))
    `).bind(sellerId, body.product_id, body.seller_memo || null).run();

    return c.json({
      success: true,
      data: { id: result.meta.last_row_id, product_name: product.name, status: 'PENDING' },
      message: '샘플 신청이 완료되었습니다. 관리자 승인 후 상품 등록이 가능합니다.',
    }, 201);
  } catch (err) {
    console.error('[Supply] POST /sample-requests error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── GET /api/supply/sample-requests ──────────────────────────────────────────
// 셀러 본인의 샘플 신청 목록
supplyRoutes.get('/sample-requests', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  const status = c.req.query('status') || '';

  try {
    // 테이블 미존재 시 빈 배열 반환
    const hasTable = await DB.prepare(
      "SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name='sample_requests'"
    ).first<{ c: number }>().catch(() => null);
    if (!hasTable || hasTable.c === 0) {
      return c.json({ success: true, data: [] });
    }

    let where = 'sr.seller_id = ?';
    const params: (string | number)[] = [sellerId];

    if (status) {
      where += ' AND sr.status = ?';
      params.push(status);
    }

    const rows = await DB.prepare(`
      SELECT
        sr.id,
        sr.product_id,
        sr.status,
        sr.seller_memo,
        sr.admin_memo,
        sr.created_at,
        sr.approved_at,
        p.name        AS product_name,
        p.price       AS retail_price,
        p.supply_price,
        p.image_url   AS product_image,
        p.category
      FROM sample_requests sr
      JOIN products p ON sr.product_id = p.id
      WHERE ${where}
      ORDER BY sr.created_at DESC
    `).bind(...params).all<{
      id: number;
      product_id: number;
      status: string;
      seller_memo: string | null;
      admin_memo: string | null;
      created_at: string;
      approved_at: string | null;
      product_name: string;
      retail_price: number;
      supply_price: number;
      product_image: string | null;
      category: string | null;
    }>();

    return c.json({ success: true, data: rows.results ?? [] });
  } catch (err) {
    console.error('[Supply] GET /sample-requests error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── POST /api/supply/register ─────────────────────────────────────────────────
// 승인된 샘플 신청 상품을 셀러 본인 스토어에 등록
supplyRoutes.post('/register', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  const body = await c.req.json<{
    product_id: number;       // 원본 공급 상품 ID
    seller_price: number;     // 셀러가 설정하는 판매가
    stock?: number;           // 재고 (기본: 원본과 동일)
  }>();

  if (!body.product_id || !body.seller_price) {
    return c.json({ success: false, error: '상품 ID와 판매가는 필수입니다' }, 400);
  }
  if (body.seller_price <= 0) {
    return c.json({ success: false, error: '판매가는 0원 이상이어야 합니다' }, 400);
  }

  try {
    // 승인된 샘플 신청 확인
    const request = await DB.prepare(`
      SELECT sr.id, sr.status, p.name, p.description, p.image_url, p.category, p.supply_price, p.stock
      FROM sample_requests sr
      JOIN products p ON sr.product_id = p.id
      WHERE sr.seller_id = ? AND sr.product_id = ? AND sr.status = 'APPROVED'
    `).bind(sellerId, body.product_id).first<{
      id: number;
      status: string;
      name: string;
      description: string | null;
      image_url: string | null;
      category: string | null;
      supply_price: number;
      stock: number;
    }>();

    if (!request) {
      return c.json({ success: false, error: '승인된 샘플 신청을 찾을 수 없습니다' }, 404);
    }

    // 이미 등록된 상품인지 확인
    const alreadyRegistered = await DB.prepare(
      'SELECT id FROM products WHERE seller_id = ? AND supply_source_id = ?'
    ).bind(sellerId, body.product_id).first<{ id: number }>().catch(() => null);

    if (alreadyRegistered) {
      return c.json({ success: false, error: '이미 등록된 상품입니다' }, 409);
    }

    const stockToUse = body.stock ?? request.stock ?? 0;
    const slug = `${request.name.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').substring(0, 40)}-${Date.now()}`;

    // 셀러 스토어에 상품 등록
    const result = await DB.prepare(`
      INSERT INTO products (
        name, description, price, supply_price, stock, stock_quantity,
        image_url, category, product_type, is_active,
        seller_id, supply_source_id, slug,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'live', 1, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      request.name,
      request.description || '',
      body.seller_price,
      request.supply_price,
      stockToUse,
      stockToUse,
      request.image_url || '',
      request.category || 'lifestyle',
      sellerId,
      body.product_id,
      slug,
    ).run();

    return c.json({
      success: true,
      data: { id: result.meta.last_row_id, name: request.name, seller_price: body.seller_price },
      message: '상품이 등록되었습니다. 라이브에서 판매를 시작하세요!',
    }, 201);
  } catch (err) {
    console.error('[Supply] POST /register error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

export { supplyRoutes };
