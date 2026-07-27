/**
 * 🆕 2026-06-28 유어애즈(UR Ads) 운영 어드민 — 가입자 관리.
 *   기존 플랫폼 어드민 인증(requireAdmin) 위에서 ad_accounts 조회/잠금해제/정지.
 *   UR Ads 서비스 전용(유어딜/도매와 무관) — /api/admin/ads/*.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { ensureAdsAccountSchema, adminSetPassword, ensureAccessRequestSchema } from './ads-account'
import { ensureEntitlementSchema, setPlan, type AdsPlan } from './ads-entitlements'
import { mediaStatus } from './media-gateway'
import { listServices, adminUpsertService, adminListOrders, adminUpdateOrder } from './ad-services'
import { adminListReviews, adminSetReviewStatus } from './ad-service-reviews'
import { adminListShortLinks, adminSetShortLinkActive } from './short-links'
import { intParam } from '@/shared/pagination'
import { adminAdsInfluencerRoutes } from './admin-ads-influencers.routes'

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

// GET /api/admin/ads/access-requests — 📥 입장 요청 대기열(계정 정보 조인, pending 우선)
app.get('/access-requests', async (c) => {
  await ensureAdsAccountSchema(c.env.DB); await ensureAccessRequestSchema(c.env.DB)
  const rows = (await c.env.DB.prepare(`SELECT r.id, r.account_id, r.note, r.status, r.created_at, a.email, a.company_name, a.phone
    FROM ad_access_requests r JOIN ad_accounts a ON a.id = r.account_id
    ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.id DESC LIMIT 100`).all().catch(() => null))?.results || []
  return c.json({ success: true, requests: rows })
})

// POST /api/admin/ads/access-requests/:id/decide {approve} — 승인=access_unlocked 1 + 안내 메일(best-effort)
app.post('/access-requests/:id/decide', async (c) => {
  await ensureAdsAccountSchema(c.env.DB); await ensureAccessRequestSchema(c.env.DB)
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const approve = !!body.approve
  // pending 만 결정 가능(CAS — 중복 클릭/동시 결정 멱등)
  const upd = await c.env.DB.prepare("UPDATE ad_access_requests SET status = ?, decided_at = datetime('now') WHERE id = ? AND status='pending'")
    .bind(approve ? 'approved' : 'rejected', id).run().catch(() => null)
  if (upd?.meta?.changes !== 1) return c.json({ success: false, error: '이미 처리된 요청입니다' }, 409)
  const req = await c.env.DB.prepare('SELECT account_id FROM ad_access_requests WHERE id = ?').bind(id).first<{ account_id: number }>().catch(() => null)
  if (approve && req) {
    await c.env.DB.prepare('UPDATE ad_accounts SET access_unlocked = 1 WHERE id = ?').bind(req.account_id).run().catch(() => null)
    // 승인 안내 메일 — Resend 키 있을 때만(best-effort, 실패해도 승인은 유효 — 재로그인 시 자동 입장).
    if (c.env.RESEND_API_KEY && c.env.RESEND_FROM) {
      const acc = await c.env.DB.prepare('SELECT email, company_name FROM ad_accounts WHERE id = ?').bind(req.account_id).first<{ email: string; company_name: string | null }>().catch(() => null)
      if (acc?.email && !acc.email.endsWith('@kakao.local')) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${c.env.RESEND_API_KEY}` },
          body: JSON.stringify({ from: c.env.RESEND_FROM, to: acc.email, subject: '[유어애즈] 입장이 승인되었습니다',
            text: `${acc.company_name || ''}님, 유어애즈 이용이 승인되었습니다.\n\n로그인하면 바로 대시보드로 들어갑니다: https://urdeal.kr/ads/login\n\n— 유어애즈 UR Ads` }),
        }).catch(() => null)
      }
    }
  }
  return c.json({ success: true, status: approve ? 'approved' : 'rejected' })
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

// GET /api/admin/ads/service-orders/:id/outreach-stats — 📈 주문-회신 어트리뷰션(근사)
//   주문 생성 이후 풀 전체의 이메일 아웃리치 성과(발송=contacted · 개봉=opened_at · 회신=replied_at).
//   ⚠️ 리드-주문 직접 연결이 아닌 기간 기반 근사(현재 발송은 사람이 수동 실행) — 라벨에 명시하고 노출.
//   주문별 발송분만 따로 돌리는 운영(이행 딥링크 → 발송 모드)에선 사실상 그 주문의 성과와 일치.
app.get('/service-orders/:id/outreach-stats', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const order = await c.env.DB.prepare('SELECT id, created_at, service_name FROM ad_service_orders WHERE id = ?')
    .bind(id).first<{ id: number; created_at: string; service_name: string }>().catch(() => null)
  if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
  const s = await c.env.DB.prepare(`SELECT
      COUNT(*) AS sent,
      SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) AS opened,
      SUM(CASE WHEN replied_at IS NOT NULL THEN 1 ELSE 0 END) AS replied,
      SUM(CASE WHEN email_status IN ('bounced','complained') THEN 1 ELSE 0 END) AS bounced
    FROM ad_influencer_leads
    WHERE account_id = 0 AND contact_channel = 'email' AND contacted_at IS NOT NULL AND contacted_at >= ?`)
    .bind(order.created_at).first<{ sent: number; opened: number; replied: number; bounced: number }>().catch(() => null)
  return c.json({ success: true, order_id: order.id, since: order.created_at, stats: s || { sent: 0, opened: 0, replied: 0, bounced: 0 } })
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

// ── 단축 링크 모더레이션 (피싱/스팸 신고 대응) ───────────────────────────────
// GET /api/admin/ads/short-links — 최근 링크(계정 포함)
app.get('/short-links', async (c) => c.json({ success: true, links: await adminListShortLinks(c.env.DB) }))

// PATCH /api/admin/ads/short-links/:id — 활성/비활성(비활성 = 즉시 404)
app.patch('/short-links/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  await adminSetShortLinkActive(c.env.DB, id, !!b.active)
  return c.json({ success: true })
})

// 🎯 인플루언서 공용 풀 어드민 — 별도 파일로 분리(파일크기 상한). 같은 /api/admin/ads 경로로 마운트.
app.route('/', adminAdsInfluencerRoutes)

export { app as adminAdsRoutes }
