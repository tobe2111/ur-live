/**
 * 🌐 유통스타트 — 해외 수출 바이어 파이프라인 어드민 (2026-07-20).
 *   격리 테이블 `overseas_buyer_leads` 자격심사·매칭 열람/큐레이션 + 발굴 타깃(수출카테고리×시장) 관리
 *   + 수동 수집 + 재스코어 + CSV. /api/admin/buyer-pool/*. 게이트 OFF 면 수집 no-op.
 *   ⚠️ 공개 비즈니스 컨택만 — 콜드 아웃리치는 국가별 규제 별도(수집 ≠ 발송).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { intParam } from '@/shared/pagination'
import {
  ensureBuyerSchema, listBuyerLeads, updateBuyerLead, deleteBuyerLead, rescoreBuyerLeads,
  listBuyerTargets, addBuyerTarget, setBuyerTargetActive, runBuyerCollection, INTENT_TIERS,
} from './buyer-discovery'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// GET /api/admin/buyer-pool?status=&country=&category=&intent=&minScore=&hasContact=1&q=&limit=
app.get('/', async (c) => {
  const minScoreRaw = c.req.query('minScore')
  const rows = await listBuyerLeads(c.env.DB, {
    status: c.req.query('status') || undefined,
    country: c.req.query('country') || undefined,
    category: c.req.query('category') || undefined,
    intent: c.req.query('intent') || undefined,
    minScore: minScoreRaw != null && minScoreRaw !== '' ? intParam(minScoreRaw, 0) : undefined,
    hasContact: c.req.query('hasContact') === '1',
    q: (c.req.query('q') || '').trim() || undefined,
    limit: Math.min(1000, Math.max(1, intParam(c.req.query('limit'), 500))),
  })
  return c.json({ success: true, leads: rows, intentTiers: INTENT_TIERS })
})

// GET /api/admin/buyer-pool/stats — 총계 + 핫리드(고스코어) + 의도/국가/카테고리 분포 + 소스 상태
app.get('/stats', async (c) => {
  await ensureBuyerSchema(c.env.DB)
  const t = await c.env.DB.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN COALESCE(match_score,0) >= 70 THEN 1 ELSE 0 END) AS hot,
      SUM(CASE WHEN imports_from_korea = 1 THEN 1 ELSE 0 END) AS proven,
      SUM(CASE WHEN email IS NOT NULL OR decision_maker_email IS NOT NULL OR phone IS NOT NULL THEN 1 ELSE 0 END) AS with_contact,
      SUM(CASE WHEN decision_maker_email IS NOT NULL THEN 1 ELSE 0 END) AS with_dm,
      SUM(CASE WHEN status NOT IN ('lead','lost') THEN 1 ELSE 0 END) AS active_pipeline,
      SUM(CASE WHEN collected_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS recent7
    FROM overseas_buyer_leads`).first<Record<string, number>>().catch(() => null)
  const byIntent = (await c.env.DB.prepare("SELECT COALESCE(intent_signal,'directory') AS k, COUNT(*) AS n FROM overseas_buyer_leads GROUP BY intent_signal ORDER BY n DESC").all<{ k: string; n: number }>().catch(() => null))?.results || []
  const byCountry = (await c.env.DB.prepare("SELECT COALESCE(country,'?') AS k, COUNT(*) AS n FROM overseas_buyer_leads GROUP BY country ORDER BY n DESC LIMIT 20").all<{ k: string; n: number }>().catch(() => null))?.results || []
  const byCategory = (await c.env.DB.prepare("SELECT COALESCE(category,'?') AS k, COUNT(*) AS n FROM overseas_buyer_leads GROUP BY category ORDER BY n DESC LIMIT 20").all<{ k: string; n: number }>().catch(() => null))?.results || []
  return c.json({
    success: true,
    stats: {
      total: Number(t?.total) || 0, hot: Number(t?.hot) || 0, proven: Number(t?.proven) || 0,
      with_contact: Number(t?.with_contact) || 0, with_dm: Number(t?.with_dm) || 0,
      active_pipeline: Number(t?.active_pipeline) || 0, recent7: Number(t?.recent7) || 0,
    },
    byIntent, byCountry, byCategory, intentTiers: INTENT_TIERS,
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

// GET /api/admin/buyer-pool/targets — 발굴 타깃(수출 카테고리×시장 = 매칭 기준 SSOT)
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

// PATCH /api/admin/buyer-pool/targets/:id { active } — 매칭 기준 변경 → 풀 자동 재스코어
app.patch('/targets/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'INVALID_ID' }, 400)
  const b = await c.req.json().catch(() => ({})) as { active?: boolean }
  await setBuyerTargetActive(c.env.DB, id, !!b.active)
  const rescored = await rescoreBuyerLeads(c.env.DB).catch(() => 0)
  return c.json({ success: true, rescored })
})

// POST /api/admin/buyer-pool/rescore — 매칭 스코어 전체 재계산
app.post('/rescore', async (c) => {
  const n = await rescoreBuyerLeads(c.env.DB).catch(() => 0)
  return c.json({ success: true, rescored: n })
})

// POST /api/admin/buyer-pool/collect — 수동 수집 1회(force). 소스 미설정이면 found:0(정상).
app.post('/collect', async (c) => {
  const r = await runBuyerCollection(c.env, { force: true }).catch((e) => ({ ran: false, reason: String(e), saved: 0, found: 0, targets: [], diag: { directory: 0, provider: 0 } }))
  return c.json({ success: true, result: r })
})

// GET /api/admin/buyer-pool/export?format=csv — 풀 다운로드(엑셀 호환, 수식 인젝션 방어)
app.get('/export', async (c) => {
  const rows = await listBuyerLeads(c.env.DB, { limit: 5000 })
  const esc = (v: unknown): string => {
    let s = v == null ? '' : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
    return s
  }
  const header = ['match_score', 'intent', 'company', 'country', 'target_market', 'category', 'imports_from_korea', 'website', 'email', 'phone', 'decision_maker', 'dm_title', 'dm_email', 'est_volume', 'status', 'source', 'collected_at']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([r.match_score ?? '', r.intent_signal, r.company, r.country, r.target_market, r.category, r.imports_from_korea ?? '', r.website, r.email, r.phone, r.decision_maker, r.decision_maker_title, r.decision_maker_email, r.est_volume, r.status, r.source, (r.collected_at || '').slice(0, 10)].map(esc).join(','))
  }
  return new Response('﻿' + lines.join('\n'), {
    headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': 'attachment; filename="overseas-buyers.csv"' },
  })
})

export { app as buyerPoolRoutes }
