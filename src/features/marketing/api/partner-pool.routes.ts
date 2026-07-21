/**
 * 🤝 유어애즈 — B2B 파트너(업체) 풀 어드민 (2026-07-21).
 *   격리 테이블 `ad_company_leads` 열람/큐레이션 + 수동입력 + CSV. /api/admin/partner-pool/*.
 *   메인 어드민 JWT(requireAdmin) — /api/admin/ads 와 동일하게 메인 워커가 직접 서빙(프록시 비위임).
 *   1단계(테이블·어드민·수동입력). 수집엔진(레인 A 네이버 지역검색 / B 레지스트리)은 후속 — 여기 없음.
 *   ⚠️ 수집 ≠ 발송 — 공개 비즈니스 연락처만. 자동 발송 경로 부존재(✉는 mailto 초안만).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { intParam } from '@/shared/pagination'
import {
  ensureCompanySchema, listCompanyLeads, saveCompanyLeads, updateCompanyLead, deleteCompanyLead, companyStats,
  COMPANY_CATEGORIES, COMPANY_STATUSES, COMPANY_CONTACT_CHANNELS, COMPANY_TIER_MIN, COMPANY_TIER_MAX,
  type CompanyLead,
} from './company-discovery'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// GET /api/admin/partner-pool?category=&subcategory=&region=&tier=&status=&hasContact=1&hasEmail=1&q=&limit=
app.get('/', async (c) => {
  const tierRaw = c.req.query('tier')
  const leads = await listCompanyLeads(c.env.DB, {
    category: c.req.query('category') || undefined,
    subcategory: c.req.query('subcategory') || undefined,
    region: (c.req.query('region') || '').trim() || undefined,
    tier: tierRaw != null && tierRaw !== '' ? intParam(tierRaw, 0) : undefined,
    status: c.req.query('status') || undefined,
    hasContact: c.req.query('hasContact') === '1',
    hasEmail: c.req.query('hasEmail') === '1',
    q: (c.req.query('q') || '').trim() || undefined,
    limit: Math.min(2000, Math.max(1, intParam(c.req.query('limit'), 500))),
  })
  return c.json({ success: true, leads })
})

// GET /api/admin/partner-pool/meta — UI 셀렉트용 분류/상태/채널/티어 어휘.
app.get('/meta', (c) => c.json({
  success: true,
  categories: COMPANY_CATEGORIES,
  statuses: COMPANY_STATUSES,
  channels: COMPANY_CONTACT_CHANNELS,
  tier: { min: COMPANY_TIER_MIN, max: COMPANY_TIER_MAX },
}))

// GET /api/admin/partner-pool/stats
app.get('/stats', async (c) => {
  const s = await companyStats(c.env.DB)
  return c.json({ success: true, ...s })
})

// POST /api/admin/partner-pool — 수동 업체 추가(대표 방배 리드 손입력). 멱등 저장(website/회사명|지역 키).
app.post('/', async (c) => {
  const b = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const company_name = String(b.company_name || '').trim()
  if (company_name.length < 2) return c.json({ success: false, error: '회사명을 입력하세요' }, 400)
  const lead: CompanyLead = {
    company_name,
    category: b.category ? String(b.category) : null,
    subcategory: b.subcategory ? String(b.subcategory) : null,
    tier: b.tier != null && b.tier !== '' ? Number(b.tier) : null,
    region: b.region ? String(b.region) : null,
    website: b.website ? String(b.website) : null,
    email: b.email ? String(b.email) : null,
    phone: b.phone ? String(b.phone) : null,
    address: b.address ? String(b.address) : null,
    description: b.description ? String(b.description) : null,
    source: 'manual',
    source_keyword: b.source_keyword ? String(b.source_keyword) : 'manual',
  }
  const saved = await saveCompanyLeads(c.env.DB, [lead]).catch(() => 0)
  return c.json({ success: saved > 0, saved })
})

// PATCH /api/admin/partner-pool/:id { status?, memo?, tier?, follow_up_at?, contact_channel? }
app.patch('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'INVALID_ID' }, 400)
  const b = await c.req.json().catch(() => ({})) as {
    status?: string; memo?: string; tier?: number | null; follow_up_at?: string | null; contact_channel?: string | null
  }
  const r = await updateCompanyLead(c.env.DB, id, b)
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

// DELETE /api/admin/partner-pool/:id
app.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'INVALID_ID' }, 400)
  const r = await deleteCompanyLead(c.env.DB, id)
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

// GET /api/admin/partner-pool/export?format=csv — 엑셀 호환(수식 인젝션 방어). 대표 동선표용.
app.get('/export', async (c) => {
  await ensureCompanySchema(c.env.DB)
  const rows = await listCompanyLeads(c.env.DB, { limit: 5000 })
  const esc = (v: unknown): string => {
    let s = v == null ? '' : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
    return s
  }
  const header = ['tier', 'category', 'subcategory', 'company_name', 'region', 'phone', 'email', 'website', 'address', 'status', 'contact_channel', 'follow_up_at', 'memo', 'source', 'source_keyword', 'collected_at']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([r.tier ?? '', r.category, r.subcategory, r.company_name, r.region, r.phone, r.email, r.website, r.address, r.status, r.contact_channel, r.follow_up_at, r.memo, r.source, r.source_keyword, (r.collected_at || '').slice(0, 10)].map(esc).join(','))
  }
  return new Response('﻿' + lines.join('\n'), {
    headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': 'attachment; filename="partner-leads.csv"' },
  })
})

export { app as partnerPoolRoutes }
