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
  listProspects, prospectStats, updateProspect,
  LICENSE_UPJONG, PROSPECT_STATUSES, PROSPECT_CONTACT_CHANNELS,
} from './store-prospects'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// GET /api/admin/store-prospects?category=&region=&status=&newOpen=1&includeClosed=1&hasPhone=1&q=&limit=
app.get('/', async (c) => {
  const prospects = await listProspects(c.env.DB, {
    category: c.req.query('category') || undefined,
    region: (c.req.query('region') || '').trim() || undefined,
    status: c.req.query('status') || undefined,
    newOpenOnly: c.req.query('newOpen') === '1',
    includeClosed: c.req.query('includeClosed') === '1',
    hasPhone: c.req.query('hasPhone') === '1',
    q: (c.req.query('q') || '').trim() || undefined,
    limit: Math.min(2000, Math.max(1, intParam(c.req.query('limit'), 500))),
  })
  return c.json({ success: true, prospects })
})

// GET /api/admin/store-prospects/meta
app.get('/meta', (c) => c.json({
  success: true,
  categories: Object.values(LICENSE_UPJONG),
  statuses: PROSPECT_STATUSES,
  channels: PROSPECT_CONTACT_CHANNELS,
}))

// GET /api/admin/store-prospects/stats — 통계 + 수집 게이트/최근실행.
app.get('/stats', async (c) => {
  const s = await prospectStats(c.env.DB)
  const runRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_localdata_stats'").first<{ value: string }>().catch(() => null)
  let run: unknown = null; try { run = runRow?.value ? JSON.parse(runRow.value) : null } catch { run = null }
  return c.json({ success: true, ...s, collect: { gate: (c.env as { ADS_LOCALDATA_ENABLED?: string }).ADS_LOCALDATA_ENABLED === 'true', adsBinding: !!c.env.ADS?.fetch, run } })
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

export const storeProspectsRoutes = app
