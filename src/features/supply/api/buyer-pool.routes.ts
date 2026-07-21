/**
 * 🌐 유통스타트 — 해외 수출 바이어 파이프라인 어드민 (2026-07-20).
 *   격리 테이블 `overseas_buyer_leads` 자격심사·매칭 열람/큐레이션 + 발굴 타깃 관리 + 무료 수집 + 재스코어 + CSV.
 *   /api/admin/buyer-pool/*. 유어딜 무관 — 유통스타트(도매) 워커에 마운트(소비자 번들 DCE). 게이트 OFF 면 no-op.
 *   ⚠️ 공개 비즈니스 컨택만 — 콜드 아웃리치는 국가별 규제 별도(수집 ≠ 발송).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { intParam } from '@/shared/pagination'
import {
  ensureBuyerSchema, listBuyerLeads, updateBuyerLead, deleteBuyerLead, rescoreBuyerLeads,
  listBuyerTargets, addBuyerTarget, setBuyerTargetActive, runBuyerCollection, saveBuyerLeads,
  INTENT_TIERS, type BuyerLead,
} from './buyer-discovery'
import { parseBulkBuyers, parseBuyKoreaInquiries, parseB2BLeadList, parseDatedLeadList } from './buyer-parsers'

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

// POST /api/admin/buyer-pool — 수동 바이어 추가(LinkedIn/buyKorea 손수 발굴분). 멱등 저장 + 자동 스코어.
app.post('/', async (c) => {
  const b = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const company = String(b.company || '').trim()
  if (company.length < 2) return c.json({ success: false, error: '회사명을 입력하세요' }, 400)
  const intent = String(b.intent_signal || 'directory')
  const ik = b.imports_from_korea
  const lead: BuyerLead = {
    source: 'manual',
    intent_signal: Object.keys(INTENT_TIERS).includes(intent) ? intent : 'directory',
    company,
    country: b.country ? String(b.country).slice(0, 60) : null,
    target_market: b.target_market ? String(b.target_market).slice(0, 60) : null,
    category: b.category ? String(b.category).slice(0, 60) : null,
    imports_from_korea: ik === 1 || ik === true || ik === '1' ? 1 : (ik === 0 || ik === false || ik === '0' ? 0 : null),
    website: b.website ? String(b.website).slice(0, 200) : null,
    email: b.email ? String(b.email).slice(0, 120) : null,
    phone: b.phone ? String(b.phone).slice(0, 40) : null,
    decision_maker: b.decision_maker ? String(b.decision_maker).slice(0, 80) : null,
    decision_maker_title: b.decision_maker_title ? String(b.decision_maker_title).slice(0, 80) : null,
    decision_maker_email: b.decision_maker_email ? String(b.decision_maker_email).slice(0, 120) : null,
    est_volume: b.est_volume ? String(b.est_volume).slice(0, 60) : null,
    description: b.description ? String(b.description).slice(0, 800) : '',
    source_keyword: 'manual',
  }
  const saved = await saveBuyerLeads(c.env.DB, [lead]).catch(() => 0)
  return c.json({ success: true, saved })
})

// POST /api/admin/buyer-pool/import { text } — 붙여넣기 일괄 추가. buyKorea 인콰이어리 페이지 통째 복붙 또는
//   헤더 있는 표(CSV/TSV) 자동 판별. 멱등 + 자동 스코어.
app.post('/import', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { text?: string }
  const text = String(b.text || '')
  // 자동 판별: B2B 링크 리스트 → plain-text 리스트(Ctrl+A/V, 링크 없음) → buyKorea 상세(회사명 표) → 일반 CSV/TSV.
  let leads = parseB2BLeadList(text)
  if (!leads.length) leads = parseDatedLeadList(text)
  if (!leads.length) leads = parseBuyKoreaInquiries(text)
  if (!leads.length) leads = parseBulkBuyers(text)
  if (!leads.length) {
    const sample = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 6)
    return c.json({ success: false, error: 'buyKorea·tradeKorea 등 구매리드 리스트/상세를 복사(Ctrl+A → Ctrl+C)해 붙여넣거나, 헤더(회사명 포함) 있는 표를 붙여넣어 주세요', parsed: 0, saved: 0, _debug: { lines: text.split(/\r?\n/).filter(l => l.trim()).length, sample } }, 400)
  }
  const saved = await saveBuyerLeads(c.env.DB, leads).catch(() => 0)
  return c.json({ success: true, parsed: leads.length, saved })
})

// GET /api/admin/buyer-pool/stats
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
    feeds: (c.env.BUYER_FEED_URLS || '').split(',').map(s => s.trim()).filter(Boolean).length,
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

// GET /api/admin/buyer-pool/targets
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

// POST /api/admin/buyer-pool/rescore
app.post('/rescore', async (c) => {
  const n = await rescoreBuyerLeads(c.env.DB).catch(() => 0)
  return c.json({ success: true, rescored: n })
})

// POST /api/admin/buyer-pool/collect — 무료 수집 1회(force). 피드 미설정이면 found:0(정상).
app.post('/collect', async (c) => {
  const r = await runBuyerCollection(c.env, { force: true }).catch((e) => ({ ran: false, reason: String(e), saved: 0, found: 0, targets: [], diag: { feed: 0 } }))
  return c.json({ success: true, result: r })
})

// GET /api/admin/buyer-pool/export?format=csv — 엑셀 호환(수식 인젝션 방어)
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
