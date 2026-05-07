/**
 * 🛡️ 2026-05-07: 시스템 운영 모니터링 (admin 전용).
 *
 * - GET /api/admin/cron-failures      — Cron job 실패 목록 + 미해결 카운트
 * - PATCH /api/admin/cron-failures/:id/resolve  — 실패 해결 처리
 * - GET /api/admin/alimtalk-failures  — 알림톡 발송 실패 목록 + retry 상태
 * - POST /api/admin/alimtalk-failures/:id/retry — 즉시 재시도
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'

export const adminSystemMonitoringRoutes = new Hono<{ Bindings: Env }>()

// ── GET /cron-failures ──────────────────────────────────────────
adminSystemMonitoringRoutes.get('/cron-failures', async (c) => {
  const { DB } = c.env
  const resolved = c.req.query('resolved') === '1'
  try {
    const { results } = await DB.prepare(`
      SELECT id, job_name, error_message, severity, resolved, created_at
      FROM cron_failures
      WHERE resolved = ?
      ORDER BY created_at DESC LIMIT 100
    `).bind(resolved ? 1 : 0).all()

    const counts = await DB.prepare(`
      SELECT severity, COUNT(*) as cnt FROM cron_failures
      WHERE resolved = 0 GROUP BY severity
    `).all<{ severity: string; cnt: number }>().catch(() => ({ results: [] }))

    return c.json({
      success: true,
      data: {
        items: results || [],
        unresolved_counts: counts.results || [],
      },
    })
  } catch {
    // 테이블 없으면 빈 결과
    return c.json({ success: true, data: { items: [], unresolved_counts: [] } })
  }
})

adminSystemMonitoringRoutes.patch('/cron-failures/:id/resolve', async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
  try {
    await DB.prepare(`UPDATE cron_failures SET resolved = 1 WHERE id = ?`).bind(id).run()
    return c.json({ success: true })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ── GET /alimtalk-failures ──────────────────────────────────────
adminSystemMonitoringRoutes.get('/alimtalk-failures', async (c) => {
  const { DB } = c.env
  const resolved = c.req.query('resolved') === '1'
  try {
    const { results } = await DB.prepare(`
      SELECT id, phone, template_code, message, error, retry_count, max_retries,
             next_retry_at, resolved, created_at, updated_at
      FROM alimtalk_failures
      WHERE resolved = ?
      ORDER BY created_at DESC LIMIT 100
    `).bind(resolved ? 1 : 0).all()

    const stats = await DB.prepare(`
      SELECT
        COUNT(*) FILTER (WHERE resolved = 0 AND retry_count >= max_retries) AS abandoned,
        COUNT(*) FILTER (WHERE resolved = 0 AND retry_count < max_retries) AS pending,
        COUNT(*) FILTER (WHERE resolved = 1) AS succeeded
      FROM alimtalk_failures
      WHERE created_at >= datetime('now', '-7 days')
    `).first<{ abandoned: number; pending: number; succeeded: number }>().catch(() => null)

    return c.json({
      success: true,
      data: {
        items: results || [],
        stats: stats ?? { abandoned: 0, pending: 0, succeeded: 0 },
      },
    })
  } catch {
    return c.json({ success: true, data: { items: [], stats: { abandoned: 0, pending: 0, succeeded: 0 } } })
  }
})

adminSystemMonitoringRoutes.post('/alimtalk-failures/:id/retry', async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
  try {
    // next_retry_at 을 즉시로 변경 → 다음 cron tick (5분 이내) 에서 자동 retry
    await DB.prepare(`
      UPDATE alimtalk_failures
      SET next_retry_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND resolved = 0
    `).bind(id).run()
    return c.json({ success: true, message: '5분 이내 자동 재시도됩니다' })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})
