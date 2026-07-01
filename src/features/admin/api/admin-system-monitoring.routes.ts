/**
 * 🛡️ 2026-05-07: 시스템 운영 모니터링 (admin 전용).
 *
 * - GET /api/admin/cron-failures      — Cron job 실패 목록 + 미해결 카운트
 * - PATCH /api/admin/cron-failures/:id/resolve  — 실패 해결 처리
 * - GET /api/admin/alimtalk-failures  — 알림톡 발송 실패 목록 + retry 상태
 * - POST /api/admin/alimtalk-failures/:id/retry — 즉시 재시도
 */
import { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import type { Env } from '@/worker/types/env'
import { isDocumentedRegistered } from '@/lib/alimtalk-templates'

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
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
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

    // 🔔 2026-07-01: 진단 — 미해결 실패를 template_code 별로 그룹핑 + 저장소 등록 여부 주석.
    //   registered:false 가 반복 실패하면 = Aligo 콘솔에 미등록/불일치 템플릿(운영자가 등록해야 함).
    //   (SMS 폴백이 없어 그동안 해당 알림톡은 전달 0 — 인앱/푸시로만 도달.)
    let byTemplate: Array<{ template_code: string; unresolved: number; abandoned: number; registered: boolean; last_error: string | null }> = []
    try {
      const { results: grp } = await DB.prepare(`
        SELECT template_code,
               COUNT(*) AS unresolved,
               SUM(CASE WHEN retry_count >= max_retries THEN 1 ELSE 0 END) AS abandoned,
               MAX(error) AS last_error
        FROM alimtalk_failures
        WHERE resolved = 0
        GROUP BY template_code
        ORDER BY unresolved DESC
      `).all<{ template_code: string; unresolved: number; abandoned: number; last_error: string | null }>()
      byTemplate = (grp || []).map(r => ({
        template_code: r.template_code,
        unresolved: Number(r.unresolved || 0),
        abandoned: Number(r.abandoned || 0),
        registered: isDocumentedRegistered(r.template_code),
        last_error: r.last_error ?? null,
      }))
    } catch { /* 그룹 쿼리 실패 — by_template 생략 */ }

    return c.json({
      success: true,
      data: {
        items: results || [],
        stats: stats ?? { abandoned: 0, pending: 0, succeeded: 0 },
        by_template: byTemplate,
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
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
  }
})
