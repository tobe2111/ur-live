/**
 * 🛒 2026-06-12 네이버 커머스API — 판매사 스마트스토어 연동 라우트 (Phase A).
 *   마운트: app.route('/api/wholesale/naver', naverCommerceRoutes)
 *
 *   - POST   /connect      — 스토어 앱(client_id/secret) 연결 (토큰 발급으로 즉시 검증)
 *   - GET    /status       — 연결 상태 + 내보내기 이력 수
 *   - DELETE /connect      — 연결 해제 (자격증명 삭제)
 *   - GET    /categories?q= — 네이버 리프 카테고리 검색 (내보내기 폼용)
 *   - POST   /export       — 도매 상품 → 스마트스토어 상품 등록 (이미지 업로드 포함)
 *
 *   인증: Bearer seller_token (sellerIdFrom — wholesale.routes 패턴). viewer 직원 쓰기 차단.
 *   Phase B(별도): 주문 자동 수집 → 도매 자동 발주 → 송장 푸시 (드랍쉬핑 완성).
 */
import { Hono } from 'hono'
import { sellerIdFrom } from '@/worker/utils/seller-auth'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { isViewerToken } from './sub-account-gate'
import {
  ensureNaverConnectionSchema, loadNaverConnection, saveNaverConnection,
  issueNaverToken, searchNaverLeafCategories, uploadImageToNaver,
  buildNaverProductPayload, naverFetch,
} from '@/services/naver-commerce-core'

type D1Database = Env['DB']

const app = new Hono<{ Bindings: Env }>()

// 공유 헬퍼 (wholesale-board.routes 와 동일 패턴)
// sellerIdFrom: 공용 유틸 `@/worker/utils/seller-auth` 로 이동(상단 import) — 중복 정의 제거.

/** 유통회원(승인) 본인 확인 — is_distributor 필수. */
async function requireDistributor(c: { req: { header: (k: string) => string | undefined }; env: Env }): Promise<{ sellerId: number } | { error: string; status: 401 | 403 }> {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return { error: '로그인이 필요합니다', status: 401 }
  const row = await c.env.DB.prepare("SELECT is_distributor, status FROM sellers WHERE id = ?")
    .bind(sellerId).first<{ is_distributor: number | null; status: string | null }>().catch(() => null)
  if (!row || Number(row.is_distributor) !== 1) return { error: '판매사 전용 기능입니다', status: 403 }
  if (row.status !== 'approved' && row.status !== 'active') return { error: '판매사 승인 후 이용할 수 있습니다', status: 403 }
  return { sellerId }
}

// ── POST /connect — 자격증명 검증 후 암호화 저장 ──────────────────────────
app.post('/connect', rateLimit({ action: 'naver-connect', max: 10, windowSec: 600 }), async (c) => {
  try {
    const auth = await requireDistributor(c)
    if ('error' in auth) return c.json({ success: false, error: auth.error }, auth.status)
    if (await isViewerToken(c.req.header('Authorization'), c.env.JWT_SECRET)) {
      return c.json({ success: false, error: '조회 전용 직원 계정은 이 작업을 할 수 없습니다' }, 403)
    }
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const clientId = String(body.client_id || '').trim()
    const clientSecret = String(body.client_secret || '').trim()
    if (!/^[A-Za-z0-9]{10,64}$/.test(clientId)) return c.json({ success: false, error: '애플리케이션 ID 형식을 확인해주세요' }, 400)
    if (clientSecret.length < 20 || clientSecret.length > 128) return c.json({ success: false, error: '애플리케이션 시크릿을 확인해주세요' }, 400)

    // 실제 토큰 발급으로 자격증명 즉시 검증 — 잘못된 키가 저장되는 일 없음.
    const tok = await issueNaverToken(clientId, clientSecret)
    if (!tok.ok) return c.json({ success: false, error: tok.error }, 400)

    await saveNaverConnection(c.env.DB, auth.sellerId, clientId, clientSecret, c.env.DATA_ENCRYPTION_KEY)
    return c.json({ success: true, message: '스마트스토어가 연결되었습니다' })
  } catch (err) {
    return safeError(c, err, '스토어 연결 중 오류가 발생했습니다', '[naver-commerce]')
  }
})

// ── GET /status ───────────────────────────────────────────────────────────
app.get('/status', async (c) => {
  try {
    const auth = await requireDistributor(c)
    if ('error' in auth) return c.json({ success: false, error: auth.error }, auth.status)
    await ensureNaverConnectionSchema(c.env.DB)
    const row = await c.env.DB.prepare(
      // 🛡️ 2026-06-25: owner_type 누락 시 같은 id 의 supplier 연결을 distributor 에게 노출(UNIQUE(owner_type,seller_id)). 스코프 명시.
      'SELECT client_id, connected_at, last_verified_at, last_export_at FROM naver_commerce_connections WHERE owner_type = ? AND seller_id = ?'
    ).bind('distributor', auth.sellerId).first<{ client_id: string; connected_at: string; last_verified_at: string | null; last_export_at: string | null }>().catch(() => null)
    const exports = await c.env.DB.prepare(
      'SELECT COUNT(*) AS n FROM naver_product_exports WHERE seller_id = ?'
    ).bind(auth.sellerId).first<{ n: number }>().catch(() => null)
    return c.json({
      success: true,
      connected: !!row,
      // client_id 는 마스킹 노출 (식별용 끝 4자리)
      client_id_masked: row ? `****${row.client_id.slice(-4)}` : null,
      connected_at: row?.connected_at || null,
      last_export_at: row?.last_export_at || null,
      export_count: Number(exports?.n) || 0,
    })
  } catch (err) {
    return safeError(c, err, '연결 상태 조회 중 오류가 발생했습니다', '[naver-commerce]')
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
    await ensureNaverConnectionSchema(c.env.DB)
    // 🛡️ 2026-06-26 [보안] owner_type 스코프 — GET /status·load/save 와 달리 DELETE 만 owner_type 누락이라
    //   같은 숫자 id 의 제조사(owner_type='supplier') 네이버 연결까지 삭제 가능했음(cross-tenant). 연결 테이블은
    //   UNIQUE(owner_type, seller_id) — distributor 스코프 명시.
    await c.env.DB.prepare("DELETE FROM naver_commerce_connections WHERE owner_type = 'distributor' AND seller_id = ?").bind(auth.sellerId).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '연결 해제 중 오류가 발생했습니다', '[naver-commerce]')
  }
})

// ── GET /categories?q= — 리프 카테고리 검색 (내보내기 폼) ─────────────────
app.get('/categories', rateLimit({ action: 'naver-categories', max: 60, windowSec: 60 }), async (c) => {
  try {
    const auth = await requireDistributor(c)
    if ('error' in auth) return c.json({ success: false, error: auth.error }, auth.status)
    const q = String(c.req.query('q') || '').trim().slice(0, 50)
    if (q.length < 2) return c.json({ success: true, items: [] })
    const conn = await loadNaverConnection(c.env.DB, auth.sellerId, c.env.DATA_ENCRYPTION_KEY)
    if (!conn) return c.json({ success: false, error: '먼저 스마트스토어를 연결해주세요', code: 'NOT_CONNECTED' }, 400)
    const r = await searchNaverLeafCategories(conn, q)
    if (!r.ok) return c.json({ success: false, error: r.error }, 502)
    return c.json({ success: true, items: r.items })
  } catch (err) {
    return safeError(c, err, '카테고리 검색 중 오류가 발생했습니다', '[naver-commerce]')
  }
})

// ── POST /export — 도매 상품 → 스마트스토어 등록 ──────────────────────────
app.post('/export', rateLimit({ action: 'naver-export', max: 30, windowSec: 600 }), async (c) => {
  try {
    const auth = await requireDistributor(c)
    if ('error' in auth) return c.json({ success: false, error: auth.error }, auth.status)
    if (await isViewerToken(c.req.header('Authorization'), c.env.JWT_SECRET)) {
      return c.json({ success: false, error: '조회 전용 직원 계정은 이 작업을 할 수 없습니다' }, 403)
    }
    const conn = await loadNaverConnection(c.env.DB, auth.sellerId, c.env.DATA_ENCRYPTION_KEY)
    if (!conn) return c.json({ success: false, error: '먼저 스마트스토어를 연결해주세요', code: 'NOT_CONNECTED' }, 400)

    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const productId = Number(body.product_id)
    const salePrice = Math.floor(Number(body.sale_price))
    const stockQuantity = Math.floor(Number(body.stock_quantity))
    const leafCategoryId = String(body.leaf_category_id || '').trim()
    const asTelephone = String(body.as_telephone || '').trim().slice(0, 20)
    const shippingFee = Math.max(0, Math.floor(Number(body.shipping_fee)) || 0)
    if (!Number.isFinite(productId) || productId <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
    if (!Number.isFinite(salePrice) || salePrice < 100) return c.json({ success: false, error: '판매가는 100원 이상이어야 합니다' }, 400)
    if (!Number.isFinite(stockQuantity) || stockQuantity < 1 || stockQuantity > 99999) return c.json({ success: false, error: '재고 수량(1~99,999)을 확인해주세요' }, 400)
    if (!/^\d{1,12}$/.test(leafCategoryId)) return c.json({ success: false, error: '네이버 카테고리를 선택해주세요' }, 400)
    if (!/^[\d-]{8,20}$/.test(asTelephone)) return c.json({ success: false, error: 'A/S 연락처(전화번호)를 입력해주세요' }, 400)

    // 공급상품 확인 — 판매사가 카탈로그에서 볼 수 있는 활성 공급상품만 내보내기 가능.
    const prod = await c.env.DB.prepare(`
      SELECT id, name, description, image_url, COALESCE(supply_price,0) AS supply_price
      FROM products WHERE id = ? AND is_supply_product = 1 AND is_active = 1 AND COALESCE(supply_price,0) > 0
    `).bind(productId).first<{ id: number; name: string; description: string | null; image_url: string | null; supply_price: number }>().catch(() => null)
    if (!prod) return c.json({ success: false, error: '내보낼 수 있는 공급상품이 아닙니다' }, 404)
    if (!prod.image_url) return c.json({ success: false, error: '대표 이미지가 없는 상품은 내보낼 수 없습니다' }, 400)

    // 역마진 방어 — 판매가가 본인 등급 공급가보다 낮으면 경고성 차단 (강제 손해 방지).
    if (salePrice < prod.supply_price) {
      return c.json({ success: false, error: '판매가가 공급원가보다 낮습니다 — 가격을 확인해주세요', code: 'BELOW_COST' }, 400)
    }

    // 1) 이미지 → 네이버 업로드 (네이버는 자체 업로드 URL 만 허용)
    const imageAbs = prod.image_url.startsWith('http') ? prod.image_url : `https://live.ur-team.com${prod.image_url}`
    const img = await uploadImageToNaver(conn, imageAbs)
    if (!img.ok || !img.url) return c.json({ success: false, error: img.error || '이미지 업로드 실패' }, 502)

    // 2) 상품 등록
    const detailHtml = `<p>${escapeHtml(prod.description || prod.name)}</p><p>※ 원산지: 상세설명 및 상품 라벨 참조</p>`
    const payload = buildNaverProductPayload({
      name: prod.name,
      leafCategoryId,
      salePrice,
      stockQuantity,
      naverImageUrl: img.url,
      detailHtml,
      shippingFee,
      asTelephone,
      asGuide: '판매자에게 문의해주세요',
    })
    const r = await naverFetch(conn, '/v2/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!r.ok) return c.json({ success: false, error: r.error || '상품 등록 실패' }, 502)
    const created = r.data as { originProductNo?: number | string; smartstoreChannelProductNo?: number | string } | null
    const naverNo = String(created?.smartstoreChannelProductNo ?? created?.originProductNo ?? '')

    // 3) 이력 기록 (UNIQUE(seller,product) — 재내보내기는 갱신)
    await c.env.DB.prepare(`
      INSERT INTO naver_product_exports (seller_id, product_id, naver_product_no, sale_price)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(seller_id, product_id) DO UPDATE SET naver_product_no = excluded.naver_product_no,
        sale_price = excluded.sale_price, status = 'created', created_at = datetime('now')
    `).bind(auth.sellerId, productId, naverNo || null, salePrice).run().catch(() => { /* 이력 실패가 성공을 안 가림 */ })
    await c.env.DB.prepare("UPDATE naver_commerce_connections SET last_export_at = datetime('now') WHERE seller_id = ?")
      .bind(auth.sellerId).run().catch(() => { /* best-effort */ })

    return c.json({ success: true, naver_product_no: naverNo || null, message: '스마트스토어에 상품이 등록되었습니다' })
  } catch (err) {
    return safeError(c, err, '스마트스토어 내보내기 중 오류가 발생했습니다', '[naver-commerce]')
  }
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export { app as naverCommerceRoutes }
