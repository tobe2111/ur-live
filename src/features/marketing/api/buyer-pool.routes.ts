/**
 * 🌐 유통스타트 — 해외 수출 바이어 풀 어드민 (2026-07-20).
 *   requireAdmin 위에서 `overseas_buyer_leads` 풀 열람/큐레이션 + 타깃 관리 + 수동 수집 트리거 + CSV 내보내기.
 *   /api/admin/buyer-pool/*. 소비자/도매 트랜잭션 무관(격리 풀 전용) — 게이트 OFF 면 수집 no-op.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { intParam } from '@/shared/pagination'
import {
  ensureBuyerSchema, listBuyerLeads, updateBuyerLead, deleteBuyerLead,
  listBuyerTargets, addBuyerTarget, setBuyerTargetActive, runBuyerCollection,
} from './buyer-discovery'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// GET /api/admin/buyer-pool?status=&country=&category=&hasContact=1&q=&limit=
app.get('/', async (c) => {
  const rows = await listBuyerLeads(c.env.DB, {
    status: c.req.query('status') || undefined,
    country: c.req.query('country') || undefined,
    category: c.req.query('category') || undefined,
    hasContact: c.req.query('hasContact') === '1',
    q: (c.req.query('q') || '').trim() || undefined,
    limit: Math.min(1000, Math.max(1, intParam(c.req.query('limit'), 500))),
  })
  return c.json({ success: true, leads: rows })
})

// GET /api/admin/buyer-pool/stats — 총계 + 국가/카테고리 분포 + 컨택 보유율
app.get('/stats', async (c) => {
  await ensureBuyerSchema(c.env.DB)
  const t = await c.env.DB.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN email IS NOT NULL OR phone IS NOT NULL THEN 1 ELSE 0 END) AS with_contact,
      SUM(CASE WHEN status != 'new' THEN 1 ELSE 0 END) AS worked,
      SUM(CASE WHEN collected_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS recent7
    FROM overseas_buyer_leads`).first<{ total: number; with_contact: number; worked: number; recent7: number }>().catch(() => null)
  const byCountry = (await c.env.DB.prepare("SELECT COALESCE(country,'?') AS k, COUNT(*) AS n FROM overseas_buyer_leads GROUP BY country ORDER BY n DESC LIMIT 20").all<{ k: string; n: number }>().catch(() => null))?.results || []
  const byCategory = (await c.env.DB.prepare("SELECT COALESCE(category,'?') AS k, COUNT(*) AS n FROM overseas_buyer_leads GROUP BY category ORDER BY n DESC LIMIT 20").all<{ k: string; n: number }>().catch(() => null))?.results || []
  return c.json({
    success: true,
    stats: { total: Number(t?.total) || 0, with_contact: Number(t?.with_contact) || 0, worked: Number(t?.worked) || 0, recent7: Number(t?.recent7) || 0 },
    byCountry, byCategory,
    enabled: c.env.BUYER_AUTO_COLLECT_ENABLED === 'true',
    provider: c.env.BUYER_PROVIDER_KEY ? (c.env.BUYER_PROVIDER || 'apollo') : null,
    directories: (c.env.BUYER_DIRECTORY_URLS || '').split(',').map(s => s.trim()).filter(Boolean).length,
  })
})

// PATCH /api/admin/buyer-pool/:id { status?, memo?, follow_up_at? }
app.patch('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'INVALID_ID' }, 400)
  const b = await c.req.json().catch(() => ({})) as { status?: string; memo?: string; follow_up_at?: string | null }
  const r = await updateBuyerLead(c.env.DB, id, b)
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

// DELETE /api/admin/buyer-pool/:id
app.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'INVALID_ID' }, 400)
  const r = await deleteBuyerLead(c.env.DB, id)
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

// GET /api/admin/buyer-pool/targets — 발굴 타깃(카테고리×국가)
app.get('/targets', async (c) => {
  const targets = await listBuyerTargets(c.env.DB)
  return c.json({ success: true, targets })
})

// POST /api/admin/buyer-pool/targets { category, country, keyword? }
app.post('/targets', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { category?: string; country?: string; keyword?: string }
  const r = await addBuyerTarget(c.env.DB, b.category || '', b.country || '', b.keyword)
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

// PATCH /api/admin/buyer-pool/targets/:id { active }
app.patch('/targets/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'INVALID_ID' }, 400)
  const b = await c.req.json().catch(() => ({})) as { active?: boolean }
  await setBuyerTargetActive(c.env.DB, id, !!b.active)
  return c.json({ success: true })
})

// POST /api/admin/buyer-pool/collect — 수동 수집 1회(force). 게이트 OFF 여도 어드민 수동 트리거는 실행.
//   ⚠️ 등록된 공개 디렉토리/유료 provider 어댑터만 호출 — 소스 미설정이면 found:0(정상).
app.post('/collect', async (c) => {
  const r = await runBuyerCollection(c.env, { force: true }).catch((e) => ({ ran: false, reason: String(e), saved: 0, found: 0, targets: [], diag: { directory: 0, provider: 0 } }))
  return c.json({ success: true, result: r })
})

// GET /api/admin/buyer-pool/export?format=csv — 풀 다운로드(엑셀 호환 CSV, 수식 인젝션 방어)
app.get('/export', async (c) => {
  const rows = await listBuyerLeads(c.env.DB, { limit: 5000 })
  // CSV 셀 이스케이프 — 선행 = + - @ (수식 인젝션) 무력화 + 따옴표/개행 처리.
  const esc = (v: unknown): string => {
    let s = v == null ? '' : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
    return s
  }
  const header = ['company', 'country', 'category', 'website', 'email', 'phone', 'contact_name', 'status', 'source', 'source_keyword', 'collected_at']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([r.company, r.country, r.category, r.website, r.email, r.phone, r.contact_name, r.status, r.source, r.source_keyword, (r.collected_at || '').slice(0, 10)].map(esc).join(','))
  }
  return new Response('﻿' + lines.join('\n'), {
    headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': 'attachment; filename="overseas-buyers.csv"' },
  })
})

export { app as buyerPoolRoutes }
