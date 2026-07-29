/**
 * 🏭 유통스타트(도매몰) — 제조사(브랜드사)·판매사 후보 풀 어드민 (2026-07-28).
 *   격리 테이블 `supply_maker_leads` 열람/큐레이션 + 수집(카카오 로컬) + 판매사 후보 임포트(통신판매 원부) + CSV.
 *   /api/admin/maker-pool/*. **유어딜/유어애즈 파트너 풀과 완전 격리** — 서로의 행을 건드리지 않는다.
 *   ⚠️ 수집 ≠ 발송 — 공개 비즈니스 연락처만.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { intParam } from '@/shared/pagination'
import {
  ensureMakerSchema, listMakerLeads, countMakerLeads, makerStats, updateMakerLead, saveMakerLeads,
  MAKER_CATEGORIES, MAKER_STATUSES, MAKER_KINDS, MAKER_KIND_LABEL, type MakerLead,
} from './maker-leads'
import { runMakerCollect, runResellerImport } from './maker-collect'
import { enrichMakerLeads } from './maker-enrich'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// GET /api/admin/maker-pool?kind=&category=&status=&hasEmail=1&q=&limit=&offset=
app.get('/', async (c) => {
  const filter = {
    kind: c.req.query('kind') || undefined,
    category: c.req.query('category') || undefined,
    status: c.req.query('status') || undefined,
    hasContact: c.req.query('hasContact') === '1',
    hasEmail: c.req.query('hasEmail') === '1',
    q: (c.req.query('q') || '').trim() || undefined,
  }
  const limit = Math.min(500, Math.max(1, intParam(c.req.query('limit'), 100)))
  const offset = Math.max(0, intParam(c.req.query('offset'), 0))
  const [leads, total] = await Promise.all([
    listMakerLeads(c.env.DB, { ...filter, limit, offset }),
    countMakerLeads(c.env.DB, filter),
  ])
  return c.json({ success: true, leads, total, limit, offset })
})

// GET /api/admin/maker-pool/stats — 카드 + 수집/임포트 상태.
app.get('/stats', async (c) => {
  const s = await makerStats(c.env.DB)
  const readKey = async (k: string): Promise<unknown> => {
    const row = await c.env.DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(k).first<{ value: string }>().catch(() => null)
    try { return row?.value ? JSON.parse(row.value) : null } catch { return null }
  }
  const [collect, importRun, enrichLast] = await Promise.all([
    readKey('supply_maker_stats'), readKey('supply_reseller_import_stats'), readKey('supply_maker_enrich_last'),
  ])
  return c.json({
    success: true, ...s,
    collect: { gate: (c.env as { SUPPLY_MAKER_COLLECT_ENABLED?: string }).SUPPLY_MAKER_COLLECT_ENABLED === 'true', run: collect },
    importRun, enrichLast,
  })
})

// GET /api/admin/maker-pool/meta — 셀렉트 어휘.
app.get('/meta', (c) => c.json({
  success: true, categories: MAKER_CATEGORIES, statuses: MAKER_STATUSES,
  kinds: MAKER_KINDS.map(k => ({ k, label: MAKER_KIND_LABEL[k] })),
}))

// POST /api/admin/maker-pool/collect — 🏭 제조사 수집 1틱(수동 = 게이트 무관). 백그라운드.
app.post('/collect', async (c) => {
  const run = async () => { await runMakerCollect(c.env).catch(() => null) }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(run()); return c.json({ success: true, started: true }) }
  await run()
  return c.json({ success: true, started: false })
})

// POST /api/admin/maker-pool/enrich — 📧 이메일 보강(홈페이지 발견 → 게시 이메일 크롤). 백그라운드.
//   라운드는 서브리퀘스트 한도 안에서 스스로 멈추고 실효 상한을 학습한다 → 여러 라운드로 백로그를 순회.
app.post('/enrich', async (c) => {
  const rounds = Math.min(5, Math.max(1, intParam(c.req.query('rounds'), 2)))
  const run = async () => {
    for (let i = 0; i < rounds; i++) {
      const r = await enrichMakerLeads(c.env).catch(() => null)
      if (!r || r.limit_hit || r.processed === 0) break // 한도 도달/대상 소진이면 더 돌 이유 없음
    }
  }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(run()); return c.json({ success: true, started: true }) }
  await run()
  return c.json({ success: true, started: false })
})

// POST /api/admin/maker-pool/import-resellers — 📥 통신판매 원부 → 판매사 후보 복사(커서 이어받기).
//   여러 패스로 몰아 소진(2.5만 건). 원본(ad_company_leads)은 SELECT 만 — 서비스 분리 준수.
app.post('/import-resellers', async (c) => {
  const run = async () => {
    for (let i = 0; i < 20; i++) {
      const r = await runResellerImport(c.env, 500).catch(() => null)
      if (!r || r.done) break
    }
  }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(run()); return c.json({ success: true, started: true }) }
  await run()
  return c.json({ success: true, started: false })
})

// PATCH /api/admin/maker-pool/:id — 큐레이션(상태·메모·품목·브랜드).
app.patch('/:id', async (c) => {
  const id = intParam(c.req.param('id'), 0)
  if (!id) return c.json({ success: false, error: 'invalid id' }, 400)
  const b = await c.req.json().catch(() => ({})) as { status?: string; memo?: string; category?: string; brand_name?: string }
  const r = await updateMakerLead(c.env.DB, id, b)
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

// POST /api/admin/maker-pool — 수동 추가(대표가 직접 아는 브랜드사 손입력).
app.post('/', async (c) => {
  const b = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const company_name = String(b.company_name || '').trim()
  if (company_name.length < 2) return c.json({ success: false, error: '회사명을 입력하세요' }, 400)
  const lead: MakerLead = {
    company_name,
    kind: b.kind === 'reseller' ? 'reseller' : 'maker',
    category: b.category ? String(b.category) : null,
    brand_name: b.brand_name ? String(b.brand_name) : null,
    region: b.region ? String(b.region) : null,
    address: b.address ? String(b.address) : null,
    phone: b.phone ? String(b.phone) : null,
    email: b.email ? String(b.email) : null,
    website: b.website ? String(b.website) : null,
    business_no: b.business_no ? String(b.business_no) : null,
    contact_source: 'manual', source: 'manual',
  }
  const n = await saveMakerLeads(c.env.DB, [lead])
  return c.json({ success: n > 0 })
})

// GET /api/admin/maker-pool/export?format=csv — 엑셀 호환(BOM). 수식 인젝션 가드 포함.
app.get('/export', async (c) => {
  await ensureMakerSchema(c.env.DB)
  const rows = await listMakerLeads(c.env.DB, { kind: c.req.query('kind') || undefined, limit: 500 })
  const esc = (v: unknown): string => {
    const s = v == null ? '' : String(v)
    const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s // CSV 수식 인젝션 방어(check-csv-injection 준수)
    return `"${guarded.replace(/"/g, '""')}"`
  }
  const head = ['종류', '회사명', '브랜드', '품목', '지역', '전화', '이메일', '홈페이지', '주소', '사업자번호', '상태', '수집일']
  const body = rows.map(r => [
    MAKER_KIND_LABEL[(r.kind as 'maker' | 'reseller')] || r.kind, r.company_name, r.brand_name, r.category, r.region,
    r.phone, r.email, r.website, r.address, r.business_no, r.status, r.collected_at,
  ].map(esc).join(','))
  const csv = '﻿' + [head.map(esc).join(','), ...body].join('\r\n')
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="maker-leads.csv"' } })
})

export const makerPoolRoutes = app
