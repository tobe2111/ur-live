/**
 * 🏭 DATA-1 (2026-06-08) — 도매몰 무결성(고아행) 리포트 어드민 API.
 *
 * 도매(공급) 모델은 FK 제약이 없어 참조 대상이 삭제되면 dangling 행이 남는다.
 * cron `wholesale-orphan-sweep` 이 매일 LEFT JOIN/NOT EXISTS 로 그런 고아행을 집계해
 * `wholesale_integrity_reports` 에 리포트를 남긴다. 이 라우터는 그 최신 리포트를 읽는다.
 *
 * - GET /api/admin/wholesale/integrity        — 최신 스윕 리포트 반환
 * - GET /api/admin/wholesale/integrity?run=1  — 즉시 재실행(handleWholesaleOrphanSweep) 후 반환
 *
 * ⚠️ flag-only: 이 API 와 cron 은 절대 삭제하지 않는다 — 고아행 정리는 어드민 수동 결정.
 * 마운트: app.route('/api/admin/wholesale/integrity', wholesaleIntegrityRoutes)
 */
import { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import {
  runWholesaleOrphanSweep,
  type OrphanCheck,
} from '@/worker/cron/wholesale-orphan-sweep'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

interface ReportRow {
  id: number
  run_at: string
  total_orphans: number
  checks_json: string
}

app.get('/', async (c) => {
  try {
    const DB = c.env.DB
    const wantRun = c.req.query('run') === '1'

    // ?run=1 → 즉시 스윕 재실행 (flag-only, 삭제 안 함) 후 그 결과를 그대로 반환.
    if (wantRun) {
      const result = await runWholesaleOrphanSweep(c.env)
      return c.json({
        success: true,
        ran: true,
        report: {
          run_at: result.run_at,
          total_orphans: result.total_orphans,
          checks: result.checks,
        },
        flag_only: true,
      })
    }

    // 최신 리포트 1행 조회. 테이블 미존재 시 빈 리포트 반환.
    const row = await DB.prepare(
      `SELECT id, run_at, total_orphans, checks_json
         FROM wholesale_integrity_reports
        ORDER BY run_at DESC, id DESC LIMIT 1`,
    ).first<ReportRow>().catch(() => null)

    if (!row) {
      return c.json({
        success: true,
        ran: false,
        report: null,
        flag_only: true,
      })
    }

    let checks: OrphanCheck[] = []
    try {
      const parsed = JSON.parse(row.checks_json)
      if (Array.isArray(parsed)) checks = parsed
    } catch {
      checks = []
    }

    return c.json({
      success: true,
      ran: false,
      report: {
        run_at: row.run_at,
        total_orphans: row.total_orphans ?? 0,
        checks,
      },
      flag_only: true,
    })
  } catch (err) {
    return safeError(c, err, '무결성 리포트 조회 중 오류가 발생했습니다', '[wholesale-integrity]')
  }
})

export { app as wholesaleIntegrityRoutes }
