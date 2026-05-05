/**
 * Product Bundle Routes
 *
 * 🛡️ 2026-04-23 배치 169: 번들(세트) 상품 기능
 *
 * 번들 = 여러 상품을 묶어서 할인 판매. 셀러가 생성/관리, 구매자는 1-click 으로
 * 번들 전체를 장바구니에 추가. 라이브 방송 중 "오늘만 세트 할인!" 용도.
 *
 * ── DB 테이블 ──
 *   product_bundles:       번들 메타 (이름, 셀러, 할인, 활성 상태)
 *   product_bundle_items:  번들에 포함된 상품 목록 (상품 ID, 수량)
 *
 * ── 엔드포인트 ──
 *   GET    /api/bundles                       — 공개: 활성 번들 목록
 *   GET    /api/bundles/:id                   — 공개: 번들 상세 (상품 포함)
 *   GET    /api/seller/bundles                — 셀러: 내 번들 목록
 *   POST   /api/seller/bundles                — 셀러: 번들 생성
 *   PATCH  /api/seller/bundles/:id            — 셀러: 번들 수정
 *   DELETE /api/seller/bundles/:id            — 셀러: 번들 삭제
 *   POST   /api/bundles/:id/add-to-cart       — 구매자: 번들 전체를 장바구니에 추가
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { executeQuery } from '@/worker/utils/database';

// ── Types ───────────────────────────────────────────────────────────
interface BundleRow {
  id: number; name: string; description: string | null; seller_id: number
  discount_type: string; discount_value: number; is_active: number
  image_url: string | null; created_at: string; updated_at: string
}
interface BundleItemRow {
  id: number; bundle_id: number; product_id: number; quantity: number
  product_name?: string; product_price?: number; product_image?: string
}

// ── Helper: 셀러 ID 추출 ───────────────────────────────────────────
async function getSellerIdFromToken(authHeader: string | undefined, secret: string): Promise<number | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(authHeader.slice(7), secret, 'HS256') as { id?: number; type?: string }
    if (payload?.type === 'seller' && payload?.id) return payload.id
    return null
  } catch { return null }
}

// ── Routers ─────────────────────────────────────────────────────────
export const bundlePublicRoutes = new Hono<{ Bindings: Env }>();
export const bundleSellerRoutes = new Hono<{ Bindings: Env }>();
export const bundleCartRoutes = new Hono<{ Bindings: Env }>();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Public Routes
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

bundlePublicRoutes.get('/', cors(), async (c) => {
  try {
    const DB = c.env.DB
    const sellerId = c.req.query('seller_id')
    let sql = `SELECT b.*, s.name as seller_name,
      (SELECT COUNT(*) FROM product_bundle_items WHERE bundle_id = b.id) as item_count
      FROM product_bundles b
      LEFT JOIN sellers s ON s.id = b.seller_id
      WHERE b.is_active = 1`
    const params: unknown[] = []
    if (sellerId) { sql += ' AND b.seller_id = ?'; params.push(Number(sellerId)) }
    sql += ' ORDER BY b.created_at DESC LIMIT 50'
    const rows = await executeQuery<BundleRow & { seller_name: string; item_count: number }>(DB, sql, params)
    return c.json({ success: true, data: rows })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

bundlePublicRoutes.get('/:id', cors(), async (c) => {
  try {
    const DB = c.env.DB
    const bundleId = Number(c.req.param('id'))
    const bundle = await DB.prepare(
      `SELECT b.*, s.name as seller_name FROM product_bundles b
       LEFT JOIN sellers s ON s.id = b.seller_id WHERE b.id = ?`
    ).bind(bundleId).first<BundleRow & { seller_name: string }>()
    if (!bundle) return c.json({ success: false, error: 'Bundle not found' }, 404)

    const items = await executeQuery<BundleItemRow>(DB,
      `SELECT bi.*, p.name as product_name, p.price as product_price, p.image_url as product_image
       FROM product_bundle_items bi
       JOIN products p ON p.id = bi.product_id
       WHERE bi.bundle_id = ?
       ORDER BY bi.id`,
      [bundleId]
    )

    const originalTotal = items.reduce((sum, i) => sum + (i.product_price || 0) * i.quantity, 0)
    let bundlePrice = originalTotal
    if (bundle.discount_type === 'percent') {
      bundlePrice = Math.round(originalTotal * (1 - bundle.discount_value / 100))
    } else if (bundle.discount_type === 'fixed') {
      bundlePrice = Math.max(0, originalTotal - bundle.discount_value)
    }

    return c.json({
      success: true,
      data: { ...bundle, items, original_total: originalTotal, bundle_price: bundlePrice },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Seller Routes
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

bundleSellerRoutes.get('/', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '인증이 필요합니다' }, 401)
  try {
    const rows = await executeQuery<BundleRow & { item_count: number }>(c.env.DB,
      `SELECT b.*,
        (SELECT COUNT(*) FROM product_bundle_items WHERE bundle_id = b.id) as item_count
       FROM product_bundles b WHERE b.seller_id = ? ORDER BY b.created_at DESC`,
      [sellerId]
    )
    return c.json({ success: true, data: rows })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

bundleSellerRoutes.post('/', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '인증이 필요합니다' }, 401)
  try {
    const body = await c.req.json<{
      name: string; description?: string; discount_type: 'percent' | 'fixed'
      discount_value: number; image_url?: string
      items: Array<{ product_id: number; quantity: number }>
    }>()

    if (!body.name?.trim()) return c.json({ success: false, error: '번들 이름을 입력하세요' }, 400)
    if (!body.items?.length || body.items.length < 2) return c.json({ success: false, error: '최소 2개 상품이 필요합니다' }, 400)
    if (!Number.isFinite(body.discount_value) || body.discount_value < 0) return c.json({ success: false, error: '할인 값이 올바르지 않습니다' }, 400)
    if (body.discount_type === 'percent' && body.discount_value > 90) return c.json({ success: false, error: '최대 90% 할인까지 가능합니다' }, 400)

    // 상품이 셀러 소유인지 확인
    const productIds = body.items.map(i => i.product_id)
    const placeholders = productIds.map(() => '?').join(',')
    const ownedProducts = await executeQuery<{ id: number }>(c.env.DB,
      `SELECT id FROM products WHERE id IN (${placeholders}) AND seller_id = ?`,
      [...productIds, sellerId]
    )
    if (ownedProducts.length !== new Set(productIds).size) {
      return c.json({ success: false, error: '본인 소유 상품만 번들에 추가할 수 있습니다' }, 403)
    }

    const DB = c.env.DB
    const result = await DB.prepare(
      `INSERT INTO product_bundles (name, description, seller_id, discount_type, discount_value, image_url, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
    ).bind(body.name.trim(), body.description?.trim() || null, sellerId, body.discount_type, body.discount_value, body.image_url || null).run()

    const bundleId = result.meta.last_row_id
    if (body.items.length > 0) {
      await DB.batch(body.items.map(item =>
        DB.prepare(`INSERT INTO product_bundle_items (bundle_id, product_id, quantity) VALUES (?, ?, ?)`)
          .bind(bundleId, item.product_id, Math.max(1, item.quantity))
      ))
    }

    return c.json({ success: true, data: { id: bundleId }, message: '번들이 생성되었습니다' }, 201)
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

bundleSellerRoutes.patch('/:id', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '인증이 필요합니다' }, 401)
  const bundleId = Number(c.req.param('id'))
  try {
    const existing = await c.env.DB.prepare(
      'SELECT seller_id FROM product_bundles WHERE id = ?'
    ).bind(bundleId).first<{ seller_id: number }>()
    if (!existing) return c.json({ success: false, error: '번들을 찾을 수 없습니다' }, 404)
    if (existing.seller_id !== sellerId) return c.json({ success: false, error: '권한이 없습니다' }, 403)

    const body = await c.req.json<{
      name?: string; description?: string; discount_type?: string; discount_value?: number
      is_active?: boolean; image_url?: string
      items?: Array<{ product_id: number; quantity: number }>
    }>()

    const sets: string[] = ['updated_at = datetime(\'now\')']
    const params: unknown[] = []
    if (body.name) { sets.push('name = ?'); params.push(body.name.trim()) }
    if (body.description !== undefined) { sets.push('description = ?'); params.push(body.description?.trim() || null) }
    if (body.discount_type) { sets.push('discount_type = ?'); params.push(body.discount_type) }
    if (body.discount_value !== undefined) { sets.push('discount_value = ?'); params.push(body.discount_value) }
    if (body.is_active !== undefined) { sets.push('is_active = ?'); params.push(body.is_active ? 1 : 0) }
    if (body.image_url !== undefined) { sets.push('image_url = ?'); params.push(body.image_url || null) }

    params.push(bundleId)
    await c.env.DB.prepare(`UPDATE product_bundles SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run()

    if (body.items && body.items.length >= 2) {
      await c.env.DB.prepare('DELETE FROM product_bundle_items WHERE bundle_id = ?').bind(bundleId).run()
      await c.env.DB.batch(body.items.map(item =>
        c.env.DB.prepare('INSERT INTO product_bundle_items (bundle_id, product_id, quantity) VALUES (?, ?, ?)')
          .bind(bundleId, item.product_id, Math.max(1, item.quantity))
      ))
    }

    return c.json({ success: true, message: '번들이 수정되었습니다' })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

bundleSellerRoutes.delete('/:id', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '인증이 필요합니다' }, 401)
  const bundleId = Number(c.req.param('id'))
  try {
    const existing = await c.env.DB.prepare(
      'SELECT seller_id FROM product_bundles WHERE id = ?'
    ).bind(bundleId).first<{ seller_id: number }>()
    if (!existing) return c.json({ success: false, error: '번들을 찾을 수 없습니다' }, 404)
    if (existing.seller_id !== sellerId) return c.json({ success: false, error: '권한이 없습니다' }, 403)

    await c.env.DB.prepare('DELETE FROM product_bundle_items WHERE bundle_id = ?').bind(bundleId).run()
    await c.env.DB.prepare('DELETE FROM product_bundles WHERE id = ?').bind(bundleId).run()
    return c.json({ success: true, message: '번들이 삭제되었습니다' })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cart Integration — POST /api/bundles/:id/add-to-cart
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

bundleCartRoutes.post('/:id/add-to-cart', cors(), async (c) => {
  try {
    const bundleId = Number(c.req.param('id'))
    const DB = c.env.DB

    // 번들 존재 + 활성 확인
    const bundle = await DB.prepare(
      'SELECT * FROM product_bundles WHERE id = ? AND is_active = 1'
    ).bind(bundleId).first<BundleRow>()
    if (!bundle) return c.json({ success: false, error: '번들을 찾을 수 없습니다' }, 404)

    // 번들 아이템 + 상품 정보
    const items = await executeQuery<BundleItemRow & { stock: number; is_active: number }>(DB,
      `SELECT bi.*, p.name as product_name, p.price as product_price, p.image_url as product_image,
              COALESCE(p.stock, 0) as stock, p.is_active
       FROM product_bundle_items bi
       JOIN products p ON p.id = bi.product_id
       WHERE bi.bundle_id = ?`,
      [bundleId]
    )

    // 재고 확인
    const outOfStock = items.filter(i => i.stock < i.quantity || !i.is_active)
    if (outOfStock.length > 0) {
      return c.json({
        success: false,
        error: `${outOfStock[0].product_name} 재고가 부족합니다`,
        code: 'OUT_OF_STOCK',
      }, 409)
    }

    // 번들 가격 계산
    const originalTotal = items.reduce((sum, i) => sum + (i.product_price || 0) * i.quantity, 0)
    let bundlePrice = originalTotal
    if (bundle.discount_type === 'percent') {
      bundlePrice = Math.round(originalTotal * (1 - bundle.discount_value / 100))
    } else if (bundle.discount_type === 'fixed') {
      bundlePrice = Math.max(0, originalTotal - bundle.discount_value)
    }

    return c.json({
      success: true,
      data: {
        bundle_id: bundleId,
        bundle_name: bundle.name,
        seller_id: bundle.seller_id,
        items: items.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          product_price: i.product_price,
          product_image: i.product_image,
          quantity: i.quantity,
        })),
        original_total: originalTotal,
        bundle_price: bundlePrice,
        discount_amount: originalTotal - bundlePrice,
        discount_type: bundle.discount_type,
        discount_value: bundle.discount_value,
      },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

export default bundlePublicRoutes;
