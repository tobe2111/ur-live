/**
 * 📊 파트너 풀 · 매장후보 풀 구글시트 연동 — 어드민 API (`/api/admin/ads/pool-sheets*`, 2026-11-04).
 *
 *   GET  /pool-sheets?pool=company|store   상태(시트 주소·공유할 이메일·마지막 회차·진행률) — ur-ads 에 묻는다(SA 이메일이 거기만 있다)
 *   PUT  /pool-sheets {pool, url}          시트 주소 저장(빈 값 = 연동 해제). 바꾸면 처음부터 다시 쓴다
 *   POST /pool-sheets/sync {pool}          지금 한 회차 돌리기(ur-ads 위임, 동기 응답)
 *
 *   인증은 마운트한 `admin-ads.routes.ts` 의 `requireAdmin()` 이 건다.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { isSheetPool, setPoolSheetId } from './pool-sheets-sync'

export const adminPoolSheetsRoutes = new Hono<{ Bindings: Env }>()

async function askAds(env: Env, path: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const ads = env.ADS
  if (!ads?.fetch) return { status: 503, body: { ok: false, error: 'ur-ads 서비스바인딩 미설정' } }
  try {
    const r = await ads.fetch(new Request(`https://ur-ads${path}`, init))
    return { status: r.status, body: await r.json().catch(() => null) as Record<string, unknown> | null }
  } catch { return { status: 502, body: { ok: false, error: 'ur-ads 위임 오류' } } }
}

adminPoolSheetsRoutes.get('/pool-sheets', async (c) => {
  const pool = c.req.query('pool')
  if (!isSheetPool(pool)) return c.json({ success: false, error: 'pool 은 company 또는 store' }, 400)
  const r = await askAds(c.env, `/__ads/pool-sheets-status?pool=${pool}`)
  if (!r.body?.ok) return c.json({ success: false, error: String(r.body?.error || '상태 조회 실패') }, 502)
  return c.json({ success: true, ...r.body })
})

adminPoolSheetsRoutes.put('/pool-sheets', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { pool?: unknown; url?: unknown }
  if (!isSheetPool(b.pool)) return c.json({ success: false, error: 'pool 은 company 또는 store' }, 400)
  const r = await setPoolSheetId(c.env, b.pool, String(b.url ?? '').slice(0, 500))
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, sheetId: r.sheetId })
})

adminPoolSheetsRoutes.post('/pool-sheets/sync', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { pool?: unknown }
  if (!isSheetPool(b.pool)) return c.json({ success: false, error: 'pool 은 company 또는 store' }, 400)
  const r = await askAds(c.env, `/__ads/pool-sheets-sync?pool=${b.pool}`, { method: 'POST' })
  const j = r.body || {}
  if (j.ok && j.skipped === 'not_configured') return c.json({ success: false, error: '시트 주소를 먼저 저장해 주세요' }, 400)
  // 🚧 ur-ads 진입 차단기(`lane-gate.ts`)는 200 + skipped 로 답한다 — 그걸 "0줄 성공" 으로 옮기면 안 된다(2026-11-04 실측).
  if (j.ok && (j.skipped === 'budget' || j.skipped === 'runaway')) return c.json({ success: false, error: '오늘 유어애즈 읽기 한도를 다 써서 쉬는 중입니다 — 한도가 풀리면 매시간 자동으로 이어 씁니다' }, 409)
  if (j.ok && j.skipped === 'paused') return c.json({ success: false, error: '유어애즈 레인이 수동 정지 중입니다(ADS_LANES_PAUSED)' }, 409)
  if (j.ok && j.skipped) return c.json({ success: false, error: `실행 안 됨: ${String(j.skipped)}` }, 409)
  if (j.ok) return c.json({ success: true, rows: j.rows ?? 0, partial: !!j.partial, next: j.next ?? null, total: j.total ?? null })
  return c.json({ success: false, error: String(j.error || '동기화 실패') }, 400)
})
