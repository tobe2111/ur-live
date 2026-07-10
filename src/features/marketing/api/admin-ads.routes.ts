/**
 * 🆕 2026-06-28 유어애즈(UR Ads) 운영 어드민 — 가입자 관리.
 *   기존 플랫폼 어드민 인증(requireAdmin) 위에서 ad_accounts 조회/잠금해제/정지.
 *   UR Ads 서비스 전용(유어딜/도매와 무관) — /api/admin/ads/*.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { ensureAdsAccountSchema, adminSetPassword } from './ads-account'
import { ensureEntitlementSchema, setPlan, type AdsPlan } from './ads-entitlements'
import { mediaStatus } from './media-gateway'
import { listServices, adminUpsertService, adminListOrders, adminUpdateOrder } from './ad-services'
import { adminListReviews, adminSetReviewStatus } from './ad-service-reviews'
import { intParam } from '@/shared/pagination'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// GET /api/admin/ads/stats — 요약
app.get('/stats', async (c) => {
  await ensureAdsAccountSchema(c.env.DB)
  const t = await c.env.DB.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN access_unlocked = 1 THEN 1 ELSE 0 END) AS unlocked,
      SUM(CASE WHEN status IS NOT NULL AND status != 'active' THEN 1 ELSE 0 END) AS suspended,
      SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS recent7
    FROM ad_accounts`).first<{ total: number; unlocked: number; suspended: number; recent7: number }>().catch(() => null)
  return c.json({ success: true, stats: { total: Number(t?.total) || 0, unlocked: Number(t?.unlocked) || 0, suspended: Number(t?.suspended) || 0, recent7: Number(t?.recent7) || 0 }, media: mediaStatus(c.env) })
})

// GET /api/admin/ads/accounts?q=&limit= — 가입자 목록(연동/알림 플래그 포함)
app.get('/accounts', async (c) => {
  await ensureAdsAccountSchema(c.env.DB)
  const limit = Math.min(300, Math.max(1, intParam(c.req.query('limit'), 100)))
  const q = (c.req.query('q') || '').trim().toLowerCase()
  const like = `%${q}%`
  const rows = (await (q
    ? c.env.DB.prepare(`SELECT id, email, company_name, phone, status, access_unlocked, created_at, last_login_at FROM ad_accounts
        WHERE LOWER(email) LIKE ? OR LOWER(COALESCE(company_name, '')) LIKE ? ORDER BY id DESC LIMIT ?`).bind(like, like, limit)
    : c.env.DB.prepare('SELECT id, email, company_name, phone, status, access_unlocked, created_at, last_login_at FROM ad_accounts ORDER BY id DESC LIMIT ?').bind(limit)
  ).all<{ id: number; email: string; company_name: string | null; phone: string | null; status: string | null; access_unlocked: number; created_at: string; last_login_at: string | null }>().catch(() => null))?.results || []
  // 연동/알림/플랜 플래그(테이블 미존재 가능 → best-effort).
  const connSet = new Set(((await c.env.DB.prepare('SELECT DISTINCT seller_id FROM ad_searchad_tenants').all<{ seller_id: number }>().catch(() => null))?.results || []).map(r => r.seller_id))
  const alertSet = new Set(((await c.env.DB.prepare('SELECT account_id FROM ad_alert_settings WHERE enabled = 1').all<{ account_id: number }>().catch(() => null))?.results || []).map(r => r.account_id))
  const planMap = new Map(((await c.env.DB.prepare('SELECT account_id, plan FROM ad_entitlements').all<{ account_id: number; plan: string }>().catch(() => null))?.results || []).map(r => [r.account_id, r.plan]))
  const accounts = rows.map(r => ({ ...r, connected: connSet.has(r.id), alert_on: alertSet.has(r.id), plan: planMap.get(r.id) || 'free' }))
  return c.json({ success: true, accounts })
})

// PATCH /api/admin/ads/accounts/:id — 잠금해제(access_unlocked) / 정지(status) 변경
app.patch('/accounts/:id', async (c) => {
  await ensureAdsAccountSchema(c.env.DB)
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const sets: string[] = []
  const binds: (string | number)[] = []
  if (body.access_unlocked !== undefined) { sets.push('access_unlocked = ?'); binds.push(body.access_unlocked ? 1 : 0) }
  if (body.status !== undefined) {
    const st = String(body.status)
    if (st !== 'active' && st !== 'suspended') return c.json({ success: false, error: '상태 값이 올바르지 않습니다' }, 400)
    sets.push('status = ?'); binds.push(st)
  }
  // 🆕 플랜 지정(엔타이틀먼트 뼈대) — 집행은 ADS_BILLING_ENFORCED='true' 일 때만.
  if (body.plan !== undefined) {
    const p = String(body.plan)
    if (p !== 'free' && p !== 'starter' && p !== 'pro') return c.json({ success: false, error: '플랜 값이 올바르지 않습니다' }, 400)
    await ensureEntitlementSchema(c.env.DB)
    await setPlan(c.env.DB, id, p as AdsPlan, body.period_end ? String(body.period_end) : null)
    if (!sets.length) return c.json({ success: true })
  }
  if (!sets.length) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400)
  await c.env.DB.prepare(`UPDATE ad_accounts SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run().catch(() => null)
  return c.json({ success: true })
})

// POST /api/admin/ads/accounts/:id/reset-password — 어드민 강제 비번 재설정(현재 비번 확인 없음)
//   가입자가 비번을 잊었거나 초기 세팅이 필요할 때 운영자가 콘솔에서 직접 지정. 새 비번은 요청 바디로만.
app.post('/accounts/:id/reset-password', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const newPassword = String(body.password || '')
  const r = await adminSetPassword(c.env.DB, id, newPassword)
  if (!r.ok) return c.json({ success: false, error: r.error }, r.status as 400 | 404)
  return c.json({ success: true })
})

// ── 마케팅 서비스몰 운영 — 상품 관리 + 주문 접수함 ──────────────────────────
// GET /api/admin/ads/services — 전체 상품(비활성 포함)
app.get('/services', async (c) => c.json({ success: true, services: await listServices(c.env.DB, true) }))

// POST /api/admin/ads/services — 상품 생성/수정(id 있으면 수정)
app.post('/services', async (c) => {
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await adminUpsertService(c.env.DB, {
    id: b.id ? Number(b.id) : undefined, category: String(b.category || ''), name: String(b.name || ''),
    subtitle: b.subtitle ? String(b.subtitle) : undefined, description: b.description ? String(b.description) : undefined,
    pricing: (b.pricing || {}) as Parameters<typeof adminUpsertService>[1]['pricing'],
    active: b.active === undefined ? undefined : !!b.active, sort_order: b.sort_order != null ? Number(b.sort_order) : undefined,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, id: r.id })
})

// GET /api/admin/ads/service-orders?status= — 주문 접수함
app.get('/service-orders', async (c) => {
  const status = (c.req.query('status') || '').trim() || undefined
  return c.json({ success: true, orders: await adminListOrders(c.env.DB, status) })
})

// PATCH /api/admin/ads/service-orders/:id — 상태/이행방식/메모
app.patch('/service-orders/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await adminUpdateOrder(c.env.DB, id, {
    status: b.status !== undefined ? String(b.status) : undefined,
    payment_status: b.payment_status !== undefined ? String(b.payment_status) : undefined,
    fulfillment_method: b.fulfillment_method !== undefined ? String(b.fulfillment_method) : undefined,
    admin_note: b.admin_note !== undefined ? String(b.admin_note) : undefined,
    supplier: b.supplier !== undefined ? String(b.supplier) : undefined,
    supplier_order_id: b.supplier_order_id !== undefined ? String(b.supplier_order_id) : undefined,
    supplier_cost: b.supplier_cost !== undefined ? Number(b.supplier_cost) : undefined,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true })
})

// GET /api/admin/ads/service-reviews — 리뷰 모더레이션 목록
app.get('/service-reviews', async (c) => c.json({ success: true, reviews: await adminListReviews(c.env.DB) }))

// PATCH /api/admin/ads/service-reviews/:id — 노출/숨김
app.patch('/service-reviews/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  await adminSetReviewStatus(c.env.DB, id, b.status === 'hidden' ? 'hidden' : 'visible')
  return c.json({ success: true })
})

export { app as adminAdsRoutes }
