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
  ensureCompanySchema, listCompanyLeads, saveCompanyLeads, updateCompanyLead, deleteCompanyLead, deleteCompanyLeads, companyStats,
  parsePartnerPaste, COMPANY_CATEGORIES, COMPANY_STATUSES, COMPANY_CONTACT_CHANNELS, COMPANY_TIER_MIN, COMPANY_TIER_MAX,
  type CompanyLead,
} from './company-discovery'
import { listCompanyKeywords, addCompanyKeyword } from './company-collect'

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
    includeHeld: c.req.query('includeHeld') === '1', // 연락처 없어 보류(active=0)된 리드까지 노출.
    heldOnly: c.req.query('heldOnly') === '1',        // 보류(active=0)만.
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
  // 🤝 레인 A 수집 상태 — 게이트 + 마지막 실행(ads_company_stats). ur-ads 서비스바인딩 존재여부.
  const runRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_company_stats'").first<{ value: string }>().catch(() => null)
  let run: unknown = null; try { run = runRow?.value ? JSON.parse(runRow.value) : null } catch { run = null }
  // 🏪 소스 ① 상가정보 수집 상태(ads_storeinfo_stats) — 게이트 + 마지막 실행.
  const siRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_storeinfo_stats'").first<{ value: string }>().catch(() => null)
  let storeinfoRun: unknown = null; try { storeinfoRun = siRow?.value ? JSON.parse(siRow.value) : null } catch { storeinfoRun = null }
  // 🛒 통신판매 수집 상태(ads_commerce_stats) — 원본 응답 필드 진단(이메일 필드 유무 확인용).
  const cmRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_commerce_stats'").first<{ value: string }>().catch(() => null)
  let commerceRun: Record<string, unknown> | null = null; try { commerceRun = cmRow?.value ? JSON.parse(cmRow.value) : null } catch { commerceRun = null }
  // 원본 첫 항목에서 필드명 목록 + 이메일 형태 값 존재여부를 뽑아 UI 에 노출(추측 대신 실제 확인).
  let commerceProbe: { keys?: string[]; hasEmail?: boolean; emailField?: string } | undefined
  const sample = (commerceRun?.diag as Record<string, unknown> | undefined)?.sample as Record<string, unknown> | undefined
  if (sample && typeof sample === 'object') {
    const keys = Object.keys(sample).slice(0, 40)
    // 이메일 필드 존재 = ① 키 이름이 이메일계열(eml/mail/emladr) 또는 ② 어떤 값이 이메일 형태.
    //   (대표자 이메일 rprsvEmladr 은 선택입력이라 첫 레코드 값이 비어도 필드는 존재 — 키로 판정.)
    const emailField = keys.find(k => /eml|email|mail/i.test(k))
    const hasEmailVal = Object.values(sample).some(v => /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i.test(String(v ?? '')))
    commerceProbe = { keys, hasEmail: !!emailField || hasEmailVal, emailField }
  }
  // 🏢 공정위 가맹(프랜차이즈) 수집 상태(ads_franchise_stats).
  const frRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_franchise_stats'").first<{ value: string }>().catch(() => null)
  let franchiseRun: unknown = null; try { franchiseRun = frRow?.value ? JSON.parse(frRow.value) : null } catch { franchiseRun = null }
  return c.json({
    success: true, ...s,
    collect: { gate: c.env.ADS_COMPANY_COLLECT_ENABLED === 'true', adsBinding: !!c.env.ADS?.fetch, run },
    storeinfo: { gate: c.env.ADS_STOREINFO_ENABLED === 'true', run: storeinfoRun },
    commerce: { gate: (c.env as { ADS_COMMERCE_ENABLED?: string }).ADS_COMMERCE_ENABLED === 'true', run: commerceRun, probe: commerceProbe },
    franchise: { gate: (c.env as { ADS_FRANCHISE_ENABLED?: string }).ADS_FRANCHISE_ENABLED === 'true', run: franchiseRun },
  })
})

// GET /api/admin/partner-pool/keywords — 레인 A 지역검색 키워드 풀(방배/서초/강남 × 업종 시드).
app.get('/keywords', async (c) => c.json({ success: true, keywords: await listCompanyKeywords(c.env.DB) }))

// POST /api/admin/partner-pool/keywords { keyword, category?, subcategory?, region? }
app.post('/keywords', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { keyword?: string; category?: string; subcategory?: string; region?: string; tier?: number }
  const r = await addCompanyKeyword(c.env.DB, b.keyword || '', b.category, b.subcategory, b.region, b.tier)
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

// POST /api/admin/partner-pool/collect — 레인 A 수동 수집(ur-ads 워커에 서비스바인딩 위임 → 메인 번들 무영향).
//   백그라운드(waitUntil): 지역검색 순회는 수십 초 → 즉시 started 반환, 완료는 UI 가 stats(run.last_run) 폴링.
app.post('/collect', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  const kick = async () => { try { await ads.fetch(new Request('https://ur-ads/__ads/collect-company', { method: 'POST' })) } catch { /* fail-soft */ } }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
  try { await kick(); return c.json({ success: true, started: false }) }
  catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

// POST /api/admin/partner-pool/enrich — 보류(연락처 없음) 리드 이메일 보강(ur-ads 위임). 홈페이지 있는 것만.
app.post('/enrich', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정' }, 503)
  const kick = async () => { try { await ads.fetch(new Request('https://ur-ads/__ads/enrich-company', { method: 'POST' })) } catch { /* fail-soft */ } }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
  try { await kick(); return c.json({ success: true, started: false }) }
  catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

// 소스별 수동 수집 위임(ur-ads). 게이트 무관(수동=의도). storeinfo/commerce/franchise.
function delegateCollect(path: string) {
  return async (c: import('hono').Context<{ Bindings: Env }>) => {
    const ads = c.env.ADS
    if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
    const kick = async () => { try { await ads.fetch(new Request(`https://ur-ads/__ads/${path}`, { method: 'POST' })) } catch { /* fail-soft */ } }
    if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
    try { await kick(); return c.json({ success: true, started: false }) }
    catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
  }
}
app.post('/collect-storeinfo', delegateCollect('collect-storeinfo')) // 소스① 상가정보
app.post('/collect-commerce', delegateCollect('collect-commerce'))   // 통신판매사업자(전화+이메일)
app.post('/collect-franchise', delegateCollect('collect-franchise')) // 공정위 가맹정보(프랜차이즈 본사)

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

// POST /api/admin/partner-pool/import { text } — 레인 B(공정위 정보공개서)·C(상인회 명부) 붙여넣기 일괄 추가.
//   헤더(회사명 포함) 있는 CSV/TSV 자동 파싱 → 멱등 저장(company_key). 즉시 동작(API 키 대기 없음).
app.post('/import', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { text?: string }
  const leads = parsePartnerPaste(String(b.text || ''))
  if (!leads.length) return c.json({ success: false, error: '헤더(회사명 포함)가 있는 표(CSV/TSV)를 붙여넣어 주세요', parsed: 0, saved: 0 }, 400)
  const saved = await saveCompanyLeads(c.env.DB, leads).catch(() => 0)
  return c.json({ success: true, parsed: leads.length, saved })
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

// POST /api/admin/partner-pool/delete-bulk { ids: number[] } — 체크박스 선택 삭제(최대 500).
app.post('/delete-bulk', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { ids?: unknown }
  const ids = Array.isArray(b.ids) ? b.ids.map(n => Number(n)) : []
  if (!ids.length) return c.json({ success: false, error: '선택된 항목이 없습니다' }, 400)
  const deleted = await deleteCompanyLeads(c.env.DB, ids)
  return c.json({ success: true, deleted })
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
