/**
 * 🛒 2026-06-12 쿠팡 오픈API — 유통사 연동 라우트 (스마트스토어 naver-commerce.routes 와 쌍둥이).
 *   마운트: app.route('/api/wholesale/coupang', coupangCommerceRoutes)
 *
 *   - POST   /connect          — Wing 키(access/secret/업체코드/Wing ID) 연결 (출고지 조회로 즉시 검증)
 *   - GET    /status           — 연결 상태 + 내보내기 수
 *   - DELETE /connect          — 해제
 *   - GET    /shipping-places  — 출고지/반품지 목록 (내보내기 모달용)
 *   - POST   /export           — 도매 상품 → 쿠팡 상품 등록 (카테고리 자동 추천 + 고시정보 자동)
 *
 *   인증: Bearer seller_token (유통회원 승인 계정), viewer 403, rate limit.
 *   ⚠️ 실계정 E2E 1회 필요 — 경로/필드는 COUPANG_PATHS 상수에 집중, 에러는 쿠팡 메시지 그대로 표면화.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { isViewerToken } from './sub-account-gate'
import {
  ensureCoupangConnectionSchema, loadCoupangConnection, saveCoupangConnection,
  listOutboundPlaces, listReturnCenters, predictCategory, fetchCategoryNotices,
  buildCoupangProductPayload, coupangFetch, COUPANG_PATHS,
} from './coupang-core'

const app = new Hono<{ Bindings: Env }>()

async function sellerIdFrom(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization?.startsWith('Bearer ')) return null
  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as { seller_id?: number }
    return payload.seller_id ?? null
  } catch { return null }
}

async function requireDistributor(c: { req: { header: (k: string) => string | undefined }; env: Env }): Promise<{ sellerId: number } | { error: string; status: 401 | 403 }> {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return { error: '로그인이 필요합니다', status: 401 }
  const row = await c.env.DB.prepare('SELECT is_distributor, status FROM sellers WHERE id = ?')
    .bind(sellerId).first<{ is_distributor: number | null; status: string | null }>().catch(() => null)
  if (!row || Number(row.is_distributor) !== 1) return { error: '유통회원 전용 기능입니다', status: 403 }
  if (row.status !== 'approved' && row.status !== 'active') return { error: '유통회원 승인 후 이용할 수 있습니다', status: 403 }
  return { sellerId }
}

// ── POST /connect ─────────────────────────────────────────────────────────
app.post('/connect', rateLimit({ action: 'coupang-connect', max: 10, windowSec: 600 }), async (c) => {
  try {
    const auth = await requireDistributor(c)
    if ('error' in auth) return c.json({ success: false, error: auth.error }, auth.status)
    if (await isViewerToken(c.req.header('Authorization'), c.env.JWT_SECRET)) {
      return c.json({ success: false, error: '조회 전용 직원 계정은 이 작업을 할 수 없습니다' }, 403)
    }
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const accessKey = String(body.access_key || '').trim()
    const secretKey = String(body.secret_key || '').trim()
    const vendorId = String(body.vendor_id || '').trim().toUpperCase()
    const vendorUserId = String(body.vendor_user_id || '').trim().slice(0, 60) || null
    if (!/^[a-f0-9-]{20,50}$/i.test(accessKey)) return c.json({ success: false, error: 'Access Key 형식을 확인해주세요' }, 400)
    if (secretKey.length < 20 || secretKey.length > 128) return c.json({ success: false, error: 'Secret Key 를 확인해주세요' }, 400)
    if (!/^A\d{8}$/.test(vendorId)) return c.json({ success: false, error: '업체코드(Vendor ID, 예: A00012345) 형식을 확인해주세요' }, 400)

    // 출고지 목록 조회로 자격증명 즉시 검증 — 내보내기에도 필요한 호출이라 일석이조.
    const probe = await listOutboundPlaces({ access_key: accessKey, secret_key: secretKey, vendor_id: vendorId, vendor_user_id: vendorUserId })
    if (!probe.ok) return c.json({ success: false, error: probe.error ? `쿠팡 인증 실패: ${probe.error}` : '쿠팡 인증 실패 — 키를 확인해주세요' }, 400)

    await saveCoupangConnection(c.env.DB, auth.sellerId, accessKey, secretKey, vendorId, vendorUserId, c.env.DATA_ENCRYPTION_KEY)
    return c.json({ success: true, message: '쿠팡 계정이 연결되었습니다', outbound_count: probe.items?.length ?? 0 })
  } catch (err) {
    return safeError(c, err, '쿠팡 연결 중 오류가 발생했습니다', '[coupang-commerce]')
  }
})

// ── GET /status ───────────────────────────────────────────────────────────
app.get('/status', async (c) => {
  try {
    const auth = await requireDistributor(c)
    if ('error' in auth) return c.json({ success: false, error: auth.error }, auth.status)
    await ensureCoupangConnectionSchema(c.env.DB)
    const row = await c.env.DB.prepare(
      "SELECT access_key, vendor_id, connected_at, last_export_at FROM coupang_connections WHERE owner_type = 'distributor' AND owner_id = ?"
    ).bind(auth.sellerId).first<{ access_key: string; vendor_id: string; connected_at: string; last_export_at: string | null }>().catch(() => null)
    const exports = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM coupang_product_exports WHERE owner_id = ?')
      .bind(auth.sellerId).first<{ n: number }>().catch(() => null)
    return c.json({
      success: true,
      connected: !!row,
      access_key_masked: row ? `****${row.access_key.slice(-4)}` : null,
      vendor_id: row?.vendor_id || null,
      connected_at: row?.connected_at || null,
      last_export_at: row?.last_export_at || null,
      export_count: Number(exports?.n) || 0,
    })
  } catch (err) {
    return safeError(c, err, '연결 상태 조회 중 오류가 발생했습니다', '[coupang-commerce]')
  }
})

// ── DELETE /connect ───────────────────────────────────────────────────────
app.delete('/connect', async (c) => {
  try {
    const auth = await requireDistributor(c)
    if ('error' in auth) return c.json({ success: false, error: auth.error }, auth.status)
    if (await isViewerToken(c.req.header('Authorization'), c.env.JWT_SECRET)) {
      return c.json({ success: false, error: '조회 전용 직원 계정은 이 작업을 할 수 없습니다' }, 403)
    }
    await ensureCoupangConnectionSchema(c.env.DB)
    await c.env.DB.prepare("DELETE FROM coupang_connections WHERE owner_type = 'distributor' AND owner_id = ?").bind(auth.sellerId).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '연결 해제 중 오류가 발생했습니다', '[coupang-commerce]')
  }
})

// ── GET /shipping-places — 출고지/반품지 (내보내기 모달) ───────────────────
app.get('/shipping-places', rateLimit({ action: 'coupang-places', max: 30, windowSec: 60 }), async (c) => {
  try {
    const auth = await requireDistributor(c)
    if ('error' in auth) return c.json({ success: false, error: auth.error }, auth.status)
    const conn = await loadCoupangConnection(c.env.DB, auth.sellerId, c.env.DATA_ENCRYPTION_KEY)
    if (!conn) return c.json({ success: false, error: '먼저 쿠팡 계정을 연결해주세요', code: 'NOT_CONNECTED' }, 400)
    const [outbound, returns] = await Promise.all([listOutboundPlaces(conn), listReturnCenters(conn)])
    if (!outbound.ok) return c.json({ success: false, error: outbound.error }, 502)
    return c.json({
      success: true,
      outbound: outbound.items || [],
      returns: returns.ok ? (returns.items || []).map(r => ({ code: r.code, name: r.name })) : [],
      returns_error: returns.ok ? null : returns.error,
    })
  } catch (err) {
    return safeError(c, err, '배송지 조회 중 오류가 발생했습니다', '[coupang-commerce]')
  }
})

// ── POST /export — 도매 상품 → 쿠팡 등록 ──────────────────────────────────
app.post('/export', rateLimit({ action: 'coupang-export', max: 30, windowSec: 600 }), async (c) => {
  try {
    const auth = await requireDistributor(c)
    if ('error' in auth) return c.json({ success: false, error: auth.error }, auth.status)
    if (await isViewerToken(c.req.header('Authorization'), c.env.JWT_SECRET)) {
      return c.json({ success: false, error: '조회 전용 직원 계정은 이 작업을 할 수 없습니다' }, 403)
    }
    const conn = await loadCoupangConnection(c.env.DB, auth.sellerId, c.env.DATA_ENCRYPTION_KEY)
    if (!conn) return c.json({ success: false, error: '먼저 쿠팡 계정을 연결해주세요', code: 'NOT_CONNECTED' }, 400)
    if (!conn.vendor_user_id) return c.json({ success: false, error: '연결 정보에 Wing 로그인 ID 가 없습니다 — 다시 연결해주세요' }, 400)

    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const productId = Number(body.product_id)
    const salePrice = Math.floor(Number(body.sale_price))
    const stockQuantity = Math.floor(Number(body.stock_quantity))
    const shippingFee = Math.max(0, Math.floor(Number(body.shipping_fee)) || 0)
    const outboundCode = String(body.outbound_code || '').trim()
    const returnCenterCode = String(body.return_center_code || '').trim()
    const brand = String(body.brand || '').trim().slice(0, 50)
    if (!Number.isFinite(productId) || productId <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
    if (!Number.isFinite(salePrice) || salePrice < 100) return c.json({ success: false, error: '판매가는 100원 이상이어야 합니다' }, 400)
    if (!Number.isFinite(stockQuantity) || stockQuantity < 1 || stockQuantity > 99999) return c.json({ success: false, error: '재고 수량(1~99,999)을 확인해주세요' }, 400)
    if (!outboundCode) return c.json({ success: false, error: '출고지를 선택해주세요' }, 400)
    if (!returnCenterCode) return c.json({ success: false, error: '반품지를 선택해주세요' }, 400)

    // 공급상품 검증 + 역마진 방어 (스마트스토어 내보내기와 동일 가드).
    const prod = await c.env.DB.prepare(`
      SELECT id, name, description, image_url, COALESCE(supply_price,0) AS supply_price, COALESCE(price,0) AS retail_price
      FROM products WHERE id = ? AND is_supply_product = 1 AND is_active = 1 AND COALESCE(supply_price,0) > 0
    `).bind(productId).first<{ id: number; name: string; description: string | null; image_url: string | null; supply_price: number; retail_price: number }>().catch(() => null)
    if (!prod) return c.json({ success: false, error: '내보낼 수 있는 공급상품이 아닙니다' }, 404)
    if (!prod.image_url) return c.json({ success: false, error: '대표 이미지가 없는 상품은 내보낼 수 없습니다' }, 400)
    if (salePrice < prod.supply_price) {
      return c.json({ success: false, error: '판매가가 공급원가보다 낮습니다 — 가격을 확인해주세요', code: 'BELOW_COST' }, 400)
    }

    // 1) 카테고리 자동 추천 → 2) 고시정보 메타 → 3) 반품지 주소(서버 재조회 — 클라 변조 차단)
    const cat = await predictCategory(conn, prod.name, brand || undefined)
    if (!cat.ok || !cat.code) return c.json({ success: false, error: cat.error || '카테고리 추천 실패' }, 502)
    const [noticesRes, returnsRes] = await Promise.all([fetchCategoryNotices(conn, cat.code), listReturnCenters(conn)])
    const returnCenter = (returnsRes.items || []).find(r => r.code === returnCenterCode)
    if (!returnCenter) return c.json({ success: false, error: '선택한 반품지를 찾을 수 없습니다 — 새로고침 후 다시 선택해주세요' }, 400)

    const imageAbs = prod.image_url.startsWith('http') ? prod.image_url : `https://live.ur-team.com${prod.image_url}`
    const detailHtml = `<p>${(prod.description || prod.name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p><p>※ 원산지: 상세설명 및 상품 라벨 참조</p>`
    const payload = buildCoupangProductPayload({
      vendorId: conn.vendor_id,
      vendorUserId: conn.vendor_user_id,
      displayCategoryCode: cat.code,
      name: prod.name,
      brand: brand || '기타',
      salePrice,
      originalPrice: Math.max(salePrice, Math.floor(prod.retail_price) || salePrice),
      stock: stockQuantity,
      imageUrl: imageAbs,
      detailHtml,
      outboundShippingPlaceCode: outboundCode,
      returnCenterCode,
      returnChargeName: returnCenter.name,
      returnAddress: { zipCode: returnCenter.zip_code, address: returnCenter.address, addressDetail: returnCenter.address_detail, phone: returnCenter.phone },
      deliveryChargeType: shippingFee > 0 ? 'NOT_FREE' : 'FREE',
      deliveryCharge: shippingFee,
      notices: noticesRes.ok ? (noticesRes.notices || []) : [],
    })
    const r = await coupangFetch(conn, 'POST', COUPANG_PATHS.products, { body: payload })
    if (!r.ok) return c.json({ success: false, error: r.error || '쿠팡 상품 등록 실패' }, 502)
    const created = r.data as { data?: number | string } | null
    const coupangProductId = created?.data != null ? String(created.data) : ''

    await c.env.DB.prepare(`
      INSERT INTO coupang_product_exports (owner_id, product_id, coupang_product_id, sale_price)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(owner_id, product_id) DO UPDATE SET coupang_product_id = excluded.coupang_product_id,
        sale_price = excluded.sale_price, status = 'created', created_at = datetime('now')
    `).bind(auth.sellerId, productId, coupangProductId || null, salePrice).run().catch(() => { /* 이력 실패가 성공을 안 가림 */ })
    await c.env.DB.prepare("UPDATE coupang_connections SET last_export_at = datetime('now') WHERE owner_type = 'distributor' AND owner_id = ?")
      .bind(auth.sellerId).run().catch(() => { /* best-effort */ })

    return c.json({ success: true, coupang_product_id: coupangProductId || null, category_code: cat.code, message: '쿠팡에 상품 등록을 요청했습니다 (쿠팡 검수 후 노출)' })
  } catch (err) {
    return safeError(c, err, '쿠팡 내보내기 중 오류가 발생했습니다', '[coupang-commerce]')
  }
})

export { app as coupangCommerceRoutes }
