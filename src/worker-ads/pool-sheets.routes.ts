/**
 * 📊 파트너 풀 · 매장후보 풀 구글시트 미러 — ur-ads 쪽 진입점 (2026-11-04).
 *
 *   서비스계정 키(`GSHEETS_SA_KEY`)는 **이 워커 env 에만** 있다. 그래서 동기화 실행과 "어느 이메일에 공유해야 하나"
 *   (`GSHEETS_SA_EMAIL`)는 메인 어드민이 여기에 물어본다. 본문은 `pool-sheets-sync.ts`.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'

export const poolSheetsRoutes = new Hono<{ Bindings: Env }>()

poolSheetsRoutes.get('/__ads/pool-sheets-status', async (c) => {
  const m = await import('@/features/marketing/api/pool-sheets-sync')
  const pool = c.req.query('pool')
  if (!m.isSheetPool(pool)) return c.json({ ok: false, error: 'pool 은 company 또는 store' }, 400)
  const st = await m.poolSheetStatus(c.env, pool)
  return c.json({ ok: true, ...st, saEmail: c.env.GSHEETS_SA_EMAIL || null, gate: c.env.ADS_SHEETS_SYNC_ENABLED === 'true' })
})

poolSheetsRoutes.post('/__ads/pool-sheets-sync', async (c) => {
  const m = await import('@/features/marketing/api/pool-sheets-sync')
  const pool = c.req.query('pool')
  if (!m.isSheetPool(pool)) return c.json({ ok: false, error: 'pool 은 company 또는 store' }, 400)
  const r = await m.syncPoolToSheets(c.env, pool, 'manual')
  return c.json(r, r.ok ? 200 : 400)
})
