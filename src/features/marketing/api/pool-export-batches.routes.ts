import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { intParam } from '@/shared/pagination'
import { adsLeadsDb } from '../../../shared/ads/leads-db'
import {
  EXPORT_POOLS, cancelExportBatch, exportPoolOf, listExportBatches,
} from './pool-export-batch'

/**
 * 🔓 **내보낸 묶음 되돌리기** — 세 풀 공용(2026-10-25 대표 지시의 짝).
 *
 * 도장(`exported_at`)은 "이 리드는 받았다" 는 뜻이고, 받은 건 다음 다운로드에서 빠진다.
 * 그래서 **다운로드가 끊기거나 파일을 잃으면 그 500명이 목록에서 사라진다** — 서버는
 * 전송 완료를 알 방법이 없다(브라우저가 받는다). 그 유일한 복구 경로가 이 라우트다.
 *
 * 배치 id = **도장 시각 그 자체**다(별도 표 없음 — 왜인지는 `pool-export-batch.ts` 머리말).
 *
 * ## ⚠️ 못 하는 것
 * - **어떤 필터로 받은 묶음인지는 모른다**(행수와 시각만 남는다). 취소는 그 시각의 행 전부를 되돌린다.
 * - 같은 초에 두 번 받았으면 한 배치로 합쳐져 **함께** 되돌아간다.
 */
const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

/** GET /api/admin/pool-export-batches?pool=influencer|company|store — 최근 묶음(시각·행수). */
app.get('/', async (c) => {
  const pool = exportPoolOf(c.req.query('pool'))
  if (!pool) return c.json({ success: false, error: `pool 은 ${Object.keys(EXPORT_POOLS).join('|')} 중 하나여야 합니다` }, 400)
  const batches = await listExportBatches(adsLeadsDb(c.env), pool, intParam(c.req.query('limit'), 50))
  return c.json({ success: true, pool, label: EXPORT_POOLS[pool].label, batches })
})

/**
 * POST /api/admin/pool-export-batches/cancel { pool, stamp } — 그 묶음의 도장만 지운다.
 * 되돌린 행은 즉시 다음 다운로드 대상이 된다.
 */
app.post('/cancel', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { pool?: unknown; stamp?: unknown }
  const pool = exportPoolOf(typeof b.pool === 'string' ? b.pool : undefined)
  if (!pool) return c.json({ success: false, error: `pool 은 ${Object.keys(EXPORT_POOLS).join('|')} 중 하나여야 합니다` }, 400)
  const restored = await cancelExportBatch(adsLeadsDb(c.env), pool, String(b.stamp ?? ''))
  // 0 이면 그 도장이 없거나 형식이 틀린 것 — 조용히 성공으로 보이지 않게 건수를 그대로 돌려준다.
  return c.json({ success: true, restored })
})

export { app as poolExportBatchRoutes }
