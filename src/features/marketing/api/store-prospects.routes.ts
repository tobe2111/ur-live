/**
 * 🏪 매장 후보(store_prospects) 어드민 — 유어딜 입점 대상 매장 발굴/큐레이션. /api/admin/store-prospects/*.
 *   메인 어드민 JWT(requireAdmin). 소스: 지방행정 인허가정보(localdata-collect, ur-ads 위임).
 *   ⚠️ 수집 ≠ 발송 — 공개 인허가 정보만. 자동 발송 경로 부존재.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { intParam } from '@/shared/pagination'
import {
  listProspects, countProspects, prospectStats, updateProspect,
  LICENSE_CATEGORIES, PROSPECT_STATUSES, PROSPECT_CONTACT_CHANNELS,
  type ProspectFilter,
} from './store-prospects'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// GET /api/admin/store-prospects?category=&region=&status=&newOpen=1&includeClosed=1&hasPhone=1&q=&limit=
app.get('/', async (c) => {
  const limit = Math.min(500, Math.max(1, intParam(c.req.query('limit'), 100)))
  const offset = Math.max(0, intParam(c.req.query('offset'), 0))
  const filter: ProspectFilter = {
    category: c.req.query('category') || undefined,
    region: (c.req.query('region') || '').trim() || undefined,
    status: c.req.query('status') || undefined,
    newOpenOnly: c.req.query('newOpen') === '1',
    includeClosed: c.req.query('includeClosed') === '1',
    hasPhone: c.req.query('hasPhone') === '1',
    hasEmail: c.req.query('hasEmail') === '1',
    q: (c.req.query('q') || '').trim() || undefined,
  }
  const [prospects, total] = await Promise.all([
    listProspects(c.env.DB, { ...filter, limit, offset }),
    countProspects(c.env.DB, filter),
  ])
  return c.json({ success: true, prospects, total, limit, offset })
})

// GET /api/admin/store-prospects/meta
app.get('/meta', (c) => c.json({
  success: true,
  categories: LICENSE_CATEGORIES,
  statuses: PROSPECT_STATUSES,
  channels: PROSPECT_CONTACT_CHANNELS,
}))

// GET /api/admin/store-prospects/stats — 통계 + 수집 게이트/최근실행.
app.get('/stats', async (c) => {
  const s = await prospectStats(c.env.DB)
  const readJson = async (k: string): Promise<unknown> => {
    const row = await c.env.DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(k).first<{ value: string }>().catch(() => null)
    try { return row?.value ? JSON.parse(row.value) : null } catch { return null }
  }
  const run = await readJson('ads_localdata_stats')
  const neisRun = await readJson('ads_neis_stats')
  const hiraRun = await readJson('ads_hira_stats')
  // 📧 보강 레인 스냅샷(2026-07-28 신설) — 매장 이메일이 0 인 이유를 **묻지 않고 볼 수 있게**.
  const enrichRun = await readJson('ads_prospect_enrich_stats')
  // 🚩 게이트는 **cron 이 도는 워커(ur-ads) env** 가 진실이다. 여기서 `c.env.*` 를 읽으면
  //   **메인 워커** 값이라 실제와 어긋난다 — 라이브 실측(2026-07-28): 화면은 `gate:false` 인데
  //   `run.last_run` 은 그날 크론 시각이었다(= 실제로는 켜져서 돌고 있었다). 파트너풀 상태줄은
  //   이미 `/__ads/health` 로 실값을 묻는데 매장 쪽만 안 물어 **거짓 OFF** 를 보여줬다.
  //   ⚠️ 대표가 이걸 보고 "안 켜져 있네" 로 오판하면 진짜 원인(=예산 고갈)을 영영 못 찾는다.
  let g: Record<string, boolean> | null = null
  if (c.env.ADS?.fetch) {
    try {
      const hr = await c.env.ADS.fetch(new Request('https://ur-ads/__ads/health'))
      g = ((await hr.json().catch(() => null)) as { gates?: Record<string, boolean> } | null)?.gates ?? null
    } catch { /* health 실패 시 메인 env 폴백 */ }
  }
  const gate = (k: string, fallback: boolean): boolean => (g && typeof g[k] === 'boolean') ? g[k] : fallback
  return c.json({
    success: true, ...s,
    collect: { gate: gate('localdata', (c.env as { ADS_LOCALDATA_ENABLED?: string }).ADS_LOCALDATA_ENABLED === 'true'), adsBinding: !!c.env.ADS?.fetch, run },
    neis: { gate: gate('neis', (c.env as { ADS_NEIS_ENABLED?: string }).ADS_NEIS_ENABLED === 'true'), run: neisRun },
    hira: { gate: gate('hira', (c.env as { ADS_HIRA_ENABLED?: string }).ADS_HIRA_ENABLED === 'true'), run: hiraRun },
    enrich: { run: enrichRun }, // 킬스위치는 ADS_ENRICH_DISABLED(전역) — 별도 게이트 없음
  })
})

// PATCH /api/admin/store-prospects/:id — 큐레이션(상태/메모/채널/팔로업).
app.patch('/:id', async (c) => {
  const id = intParam(c.req.param('id'), 0)
  if (!id) return c.json({ success: false, error: 'invalid id' }, 400)
  const b = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const r = await updateProspect(c.env.DB, id, {
    status: b.status !== undefined ? String(b.status) : undefined,
    memo: b.memo !== undefined ? String(b.memo) : undefined,
    contact_channel: b.contact_channel !== undefined ? (b.contact_channel === null ? null : String(b.contact_channel)) : undefined,
    follow_up_at: b.follow_up_at !== undefined ? (b.follow_up_at === null ? null : String(b.follow_up_at)) : undefined,
  })
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

// POST /api/admin/store-prospects/collect — 인허가 변동분 수동 수집(ur-ads 위임). 게이트 무관(수동=의도).
app.post('/collect', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  const kick = async () => { try { await ads.fetch(new Request('https://ur-ads/__ads/collect-localdata', { method: 'POST' })) } catch { /* fail-soft */ } }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
  try { await kick(); return c.json({ success: true, started: false }) }
  catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

// POST /api/admin/store-prospects/collect-neis · /collect-hira — 학원(NEIS)·병원(심평원) 수동 수집(ur-ads 위임).
for (const [path, target] of [['/collect-neis', 'collect-neis'], ['/collect-hira', 'collect-hira']] as const) {
  app.post(path, async (c) => {
    const ads = c.env.ADS
    if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
    const kick = async () => { try { await ads.fetch(new Request(`https://ur-ads/__ads/${target}`, { method: 'POST' })) } catch { /* fail-soft */ } }
    if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
    try { await kick(); return c.json({ success: true, started: false }) }
    catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
  })
}

// POST /api/admin/store-prospects/enrich-contacts — 이메일 우선 연락처 보강(ur-ads 위임). 게이트 무관(수동).
app.post('/enrich-contacts', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  const kick = async () => { try { await ads.fetch(new Request('https://ur-ads/__ads/enrich-prospects', { method: 'POST' })) } catch { /* fail-soft */ } }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
  try { await kick(); return c.json({ success: true, started: false }) }
  catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

// GET /api/admin/store-prospects/new-open-digest — 🎉 개업 웰컴 큐(최근 개업 + 지역 집계).
app.get('/new-open-digest', async (c) => {
  const { newOpenDigest } = await import('./opening-briefing')
  const days = Math.min(90, Math.max(1, intParam(c.req.query('days'), 14)))
  const d = await newOpenDigest(c.env.DB, days, 30)
  return c.json({ success: true, ...d })
})

// GET /api/admin/store-prospects/:id/briefing — 📊 개업 컨설팅 브리핑(상권 수치 + 멘트 초안, 전부 자체 집계).
app.get('/:id/briefing', async (c) => {
  const id = intParam(c.req.param('id'), 0)
  if (!id) return c.json({ success: false, error: 'invalid id' }, 400)
  const { openingBriefing } = await import('./opening-briefing')
  const b = await openingBriefing(c.env.DB, id)
  if (!b) return c.json({ success: false, error: '매장을 찾을 수 없습니다' }, 404)
  return c.json({ success: true, ...b })
})

// GET /api/admin/store-prospects/export — 엑셀 호환 CSV(BOM + 수식 인젝션 방어). 인증 blob 다운로드용.
app.get('/export', async (c) => {
  const rows = await listProspects(c.env.DB, { includeClosed: false, limit: 2000 })
  const esc = (v: unknown): string => {
    let s = v == null ? '' : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
    return s
  }
  const header = ['category', 'biz_name', 'region', 'phone', 'email', 'website', 'addr_road', 'status', 'is_new_open', 'apv_perm_ymd', 'collected_at']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([r.category, r.biz_name, r.region, r.phone, r.email, r.website, r.addr_road, r.status, r.is_new_open ? '개업' : '', r.apv_perm_ymd, (r.collected_at || '').slice(0, 10)].map(esc).join(','))
  }
  return new Response('﻿' + lines.join('\n'), {
    headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': 'attachment; filename="store-prospects.csv"' },
  })
})

export const storeProspectsRoutes = app
