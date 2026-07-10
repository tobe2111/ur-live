/**
 * 유어애즈(/api/ads) 마케팅 서비스몰 라우터 — services/* (2026-07-02).
 *   카탈로그 조회 + 주문요청 접수(무결제). 이행은 정당한 마케팅 실행(어드민 처리). 인증 = ad_accounts.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { adsAccountIdFrom } from '../ads-account'
import { listServices, getService, createServiceOrder, listMyOrders, computeServicePrice } from '../ad-services'
import { listReviews, createReview, reviewSummary, reviewableOrderId } from '../ad-service-reviews'

const adsServicesRoutes = new Hono<{ Bindings: Env }>()

// GET /api/ads/services — 카탈로그(활성 상품)
adsServicesRoutes.get('/services', async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  return c.json({ success: true, services: await listServices(c.env.DB) })
})

// GET /api/ads/services/order-history — 내 주문 목록 (정적 경로 → /:id 보다 먼저)
adsServicesRoutes.get('/services/order-history', async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  return c.json({ success: true, orders: await listMyOrders(c.env.DB, id) })
})

// POST /api/ads/services/quote — 가격 미리보기(서버 권위 계산)
adsServicesRoutes.post('/services/quote', rateLimit({ action: 'ads-svc-quote', max: 60, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const svc = await getService(c.env.DB, Number(b.service_id))
  if (!svc) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)
  const price = computeServicePrice(svc.pricing, Number(b.quantity), Array.isArray(b.option_keys) ? (b.option_keys as unknown[]).map(String) : [])
  return c.json({ success: true, price })
})

// POST /api/ads/services/order — 주문요청 접수(무결제)
adsServicesRoutes.post('/services/order', rateLimit({ action: 'ads-svc-order', max: 20, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await createServiceOrder(c.env.DB, id, {
    serviceId: Number(b.service_id), quantity: Number(b.quantity), presetLabel: b.preset_label ? String(b.preset_label) : undefined,
    optionKeys: Array.isArray(b.option_keys) ? (b.option_keys as unknown[]).map(String) : [],
    contactKakao: b.contact_kakao ? String(b.contact_kakao) : undefined, contactPhone: b.contact_phone ? String(b.contact_phone) : undefined,
    targetUrl: b.target_url ? String(b.target_url) : undefined, memo: b.memo ? String(b.memo) : undefined,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, orderId: r.orderId, price: r.price })
})

// GET /api/ads/services/:id/reviews?page= — 상품 리뷰 목록(+요약, 작성 자격)
adsServicesRoutes.get('/services/:id/reviews', async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const sid = Number(c.req.param('id'))
  const [list, summary, canWrite] = await Promise.all([
    listReviews(c.env.DB, sid, Number(c.req.query('page')) || 1),
    reviewSummary(c.env.DB, sid),
    reviewableOrderId(c.env.DB, id, sid),
  ])
  return c.json({ success: true, ...list, summary, can_write: canWrite != null })
})

// POST /api/ads/services/:id/review — 리뷰 작성(완료 주문 고객만, 주문당 1회)
adsServicesRoutes.post('/services/:id/review', rateLimit({ action: 'ads-svc-review', max: 10, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await createReview(c.env.DB, id, Number(c.req.param('id')), { rating: Number(b.rating), title: String(b.title || ''), body: String(b.body || '') })
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true })
})

// GET /api/ads/services/:id — 상품 상세(맨 뒤 — 위 정적 경로 우선)
adsServicesRoutes.get('/services/:id', async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const svc = await getService(c.env.DB, Number(c.req.param('id')))
  if (!svc || !svc.active) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)
  return c.json({ success: true, service: svc })
})

export { adsServicesRoutes }
