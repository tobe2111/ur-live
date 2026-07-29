/**
 * 📢 공고 스캐너 어드민 — 나라장터 입찰 + 기업마당 지원사업. /api/admin/gov-notices/*. 메인 어드민 JWT.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { intParam } from '@/shared/pagination'
import { listNotices, noticeStats, updateNotice, NOTICE_STATUSES } from './gov-notices'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

app.get('/', async (c) => {
  const notices = await listNotices(c.env.DB, {
    source: c.req.query('source') || undefined,
    status: c.req.query('status') || undefined,
    q: (c.req.query('q') || '').trim() || undefined,
    limit: Math.min(1000, Math.max(1, intParam(c.req.query('limit'), 300))),
  })
  return c.json({ success: true, notices })
})

app.get('/meta', (c) => c.json({ success: true, statuses: NOTICE_STATUSES }))

app.get('/stats', async (c) => {
  const stats = await noticeStats(c.env.DB)
  const runRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_notice_stats'").first<{ value: string }>().catch(() => null)
  let run: unknown = null; try { run = runRow?.value ? JSON.parse(runRow.value) : null } catch { run = null }
  return c.json({ success: true, stats, collect: { gate: (c.env as { ADS_NOTICE_ENABLED?: string }).ADS_NOTICE_ENABLED === 'true', adsBinding: !!c.env.ADS?.fetch, run } })
})

app.patch('/:id', async (c) => {
  const id = intParam(c.req.param('id'), 0)
  if (!id) return c.json({ success: false, error: 'invalid id' }, 400)
  const b = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const r = await updateNotice(c.env.DB, id, {
    status: b.status !== undefined ? String(b.status) : undefined,
    memo: b.memo !== undefined ? String(b.memo) : undefined,
  })
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

app.post('/collect', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정' }, 503)
  const kick = async () => { try { await ads.fetch(new Request('https://ur-ads/__ads/scan-notices', { method: 'POST' })) } catch { /* fail-soft */ } }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
  try { await kick(); return c.json({ success: true, started: false }) }
  catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

export const govNoticesRoutes = app
