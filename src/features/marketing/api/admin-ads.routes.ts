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
import { adminListShortLinks, adminSetShortLinkActive } from './short-links'
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

// ── 🎯 인플루언서 공용 풀(자동 수집) 어드민 (2026-07-20, Phase E) ───────────────
//   수집 엔진은 ur-ads 워커 cron. 여기(메인 어드민)는 결과 열람/큐레이션 + 키워드 관리 + 수동 트리거만.
//   ⚠️ 메인 번들 경량 유지 위해 수집/발굴 코드는 import 안 하고 전부 inline SQL(공용 풀 = account_id 0).
const POOL = 0

async function ensureKeywordTable(DB: D1Database) {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_discovery_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT NOT NULL UNIQUE, category TEXT,
    active INTEGER NOT NULL DEFAULT 1, hits INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'seed',
    created_at DATETIME DEFAULT (datetime('now')))`).run().catch(() => null)
}

// GET /api/admin/ads/influencer-pool?platform=&category=&hasContact=1&q=&limit=
app.get('/influencer-pool', async (c) => {
  const where = ['account_id = ?']; const binds: (string | number)[] = [POOL]
  const platform = (c.req.query('platform') || '').trim()
  if (['youtube', 'naver_blog', 'instagram', 'tiktok'].includes(platform)) { where.push('platform = ?'); binds.push(platform) }
  const category = (c.req.query('category') || '').trim()
  if (category) { where.push('category = ?'); binds.push(category) }
  if (c.req.query('hasContact') === '1') where.push('(email IS NOT NULL OR instagram IS NOT NULL OR tiktok IS NOT NULL OR links IS NOT NULL)')
  if (c.req.query('hasEmail') === '1') where.push('email IS NOT NULL')      // 아웃리치 리스트용(이메일 보유만)
  if (c.req.query('hasInstagram') === '1') where.push('instagram IS NOT NULL')
  const q = (c.req.query('q') || '').trim().toLowerCase()
  if (q) { where.push('(LOWER(name) LIKE ? OR LOWER(COALESCE(handle,\'\')) LIKE ?)'); binds.push(`%${q}%`, `%${q}%`) }
  const limit = Math.min(500, Math.max(1, intParam(c.req.query('limit'), 200)))
  const rows = await c.env.DB.prepare(`SELECT id, platform, channel_id, handle, name, url, subscriber_count, view_count, video_count, country, thumbnail, email, instagram, tiktok, links, description, status, memo, category, source_keyword, collected_at
    FROM ad_influencer_leads WHERE ${where.join(' AND ')} ORDER BY subscriber_count DESC, id DESC LIMIT ?`)
    .bind(...binds, limit).all().catch(() => null)
  return c.json({ success: true, leads: rows?.results || [] })
})

// GET /api/admin/ads/influencer-pool/stats — 누적/최근 실행 통계 + 플랫폼별 카운트
app.get('/influencer-pool/stats', async (c) => {
  const agg = await c.env.DB.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN platform='youtube' THEN 1 ELSE 0 END) AS youtube,
      SUM(CASE WHEN platform='naver_blog' THEN 1 ELSE 0 END) AS naver_blog,
      SUM(CASE WHEN email IS NOT NULL OR instagram IS NOT NULL OR tiktok IS NOT NULL OR links IS NOT NULL THEN 1 ELSE 0 END) AS with_contact,
      SUM(CASE WHEN collected_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS recent7
    FROM ad_influencer_leads WHERE account_id = ?`).bind(POOL).first().catch(() => null)
  const stRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_autocollect_stats'").first<{ value: string }>().catch(() => null)
  let run: unknown = null; try { run = stRow?.value ? JSON.parse(stRow.value) : null } catch { run = null }
  return c.json({ success: true, stats: agg || {}, run, gate: c.env.ADS_AUTO_COLLECT_ENABLED === 'true' })
})

// PATCH /api/admin/ads/influencer-pool/:id { status?, memo? } — 큐레이션
app.patch('/influencer-pool/:id', async (c) => {
  const id = Number(c.req.param('id')); if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const sets: string[] = []; const binds: (string | number)[] = []
  if (typeof b.status === 'string' && ['new', 'contacted', 'rejected'].includes(b.status)) { sets.push('status = ?'); binds.push(b.status) }
  if (typeof b.memo === 'string') { sets.push('memo = ?'); binds.push(b.memo.slice(0, 500)) }
  if (!sets.length) return c.json({ success: false, error: '변경 항목 없음' }, 400)
  await c.env.DB.prepare(`UPDATE ad_influencer_leads SET ${sets.join(', ')} WHERE id = ? AND account_id = ?`).bind(...binds, id, POOL).run().catch(() => null)
  return c.json({ success: true })
})

// DELETE /api/admin/ads/influencer-pool/:id
app.delete('/influencer-pool/:id', async (c) => {
  const id = Number(c.req.param('id')); if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  await c.env.DB.prepare('DELETE FROM ad_influencer_leads WHERE id = ? AND account_id = ?').bind(id, POOL).run().catch(() => null)
  return c.json({ success: true })
})

// GET /api/admin/ads/influencer-pool/keywords — 수집 키워드 목록(활성/후보)
app.get('/influencer-pool/keywords', async (c) => {
  await ensureKeywordTable(c.env.DB)
  const r = await c.env.DB.prepare('SELECT id, keyword, category, active, hits, source, created_at FROM ad_discovery_keywords ORDER BY active DESC, hits DESC, id ASC LIMIT 1000').all().catch(() => null)
  return c.json({ success: true, keywords: r?.results || [] })
})

// POST /api/admin/ads/influencer-pool/keywords { keyword, category? } — 키워드 추가
app.post('/influencer-pool/keywords', async (c) => {
  await ensureKeywordTable(c.env.DB)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const kw = String(b.keyword || '').trim()
  if (kw.length < 2 || kw.length > 40) return c.json({ success: false, error: '키워드는 2~40자' }, 400)
  await c.env.DB.prepare("INSERT OR IGNORE INTO ad_discovery_keywords (keyword, category, active, source) VALUES (?, ?, 1, 'manual')")
    .bind(kw, String(b.category || '수동').slice(0, 40)).run().catch(() => null)
  return c.json({ success: true })
})

// PATCH /api/admin/ads/influencer-pool/keywords/:id { active } — 활성/비활성
app.patch('/influencer-pool/keywords/:id', async (c) => {
  const id = Number(c.req.param('id')); if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  await c.env.DB.prepare('UPDATE ad_discovery_keywords SET active = ? WHERE id = ?').bind(b.active ? 1 : 0, id).run().catch(() => null)
  return c.json({ success: true })
})

// POST /api/admin/ads/influencer-pool/collect — 수동 수집(ur-ads 워커에 서비스바인딩으로 위임 → 메인 번들 무영향)
app.post('/influencer-pool/collect', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  try {
    const res = await ads.fetch(new Request('https://ur-ads/__ads/collect', { method: 'POST' }))
    const data = await res.json().catch(() => null) as { ok?: boolean; stats?: unknown } | null
    if (!res.ok || !data?.ok) return c.json({ success: false, error: '수집 실행 실패' }, 502)
    return c.json({ success: true, stats: data.stats })
  } catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

export { app as adminAdsRoutes }
