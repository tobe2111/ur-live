/** 🏭 distributor-admin: 등급별 마진율 (byte-identical 분해). */
import type { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { writeAuditLog } from '@/worker/middleware/admin-security'
import { ensureGrades, type Env } from './helpers'

export function registerGradesRoutes(app: Hono<{ Bindings: Env }>) {
  // ── GET /grades ──────────────────────────────────────────────────────────────
  app.get('/grades', async (c) => {
    try {
      await ensureGrades(c.env.DB)
      const { results } = await c.env.DB.prepare(
        `SELECT grade, label, margin_pct, sort_order, is_special, active, updated_at
         FROM distributor_grades ORDER BY sort_order ASC`
      ).all()
      return c.json({ success: true, grades: results ?? [] })
    } catch (err) {
      return safeError(c, err, '등급 조회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // ── PUT /grades/:grade ───────────────────────────────────────────────────────
  app.put('/grades/:grade', async (c) => {
    try {
      await ensureGrades(c.env.DB)
      const grade = c.req.param('grade').toUpperCase()
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
      const margin = Number(body.margin_pct)
      if (!Number.isFinite(margin) || margin < 0 || margin > 100) {
        return c.json({ success: false, error: '마진율은 0~100% 사이여야 합니다' }, 400)
      }
      const label = typeof body.label === 'string' ? body.label.slice(0, 40) : null
      const active = body.active === false ? 0 : 1
      // 변경 전 값 캡처 (감사로그 before).
      const prevGrade = await c.env.DB.prepare(
        'SELECT margin_pct, label, active FROM distributor_grades WHERE grade = ?'
      ).bind(grade).first<{ margin_pct: number; label: string | null; active: number }>().catch(() => null)
      const res = await c.env.DB.prepare(
        `UPDATE distributor_grades SET margin_pct=?, label=COALESCE(?,label), active=?, updated_at=datetime('now') WHERE grade=?`
      ).bind(margin, label, active, grade).run()
      if (!res.meta.changes) return c.json({ success: false, error: '존재하지 않는 등급입니다' }, 404)
      await writeAuditLog(c, {
        action: 'wholesale_grade_margin_change',
        targetType: 'distributor_grade',
        targetId: grade,
        before: { margin_pct: prevGrade?.margin_pct ?? null, label: prevGrade?.label ?? null, active: prevGrade?.active ?? null },
        after: { margin_pct: margin, label: label ?? prevGrade?.label ?? null, active },
      }).catch(() => { /* audit 실패해도 성공 처리 */ })
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '등급 수정 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })
}
