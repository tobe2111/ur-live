/**
 * 🧾 장부 조정 어드민 API (2026-11-18 대표 *"장부 조정 기능도 만들어줘"*) — 본체는 `worker/utils/ledger-correction.ts`.
 *   POST /api/admin/ledger/adjustments                  — 반대 방향 원장 한 줄(+ 선택: 지급 대기 행 금액 함께 감액)
 *   GET  /api/admin/ledger/adjustments                  — 조정 기록 목록
 *   POST /api/admin/ledger/attributions/:id/cancel      — 지급 전 중개사 몫·인플루언서 추천 몫 취소
 *   권한: finance 역할 + 2FA(켜 둔 계정) + 감사 로그.
 */
import type { Hono } from 'hono'
import type { Env } from '../../../../worker/types/env'
import { requireAdminRole, getCurrentUser } from '../../../../worker/middleware/auth'
import { require2FA } from '../../../../worker/middleware/require-2fa'
import { auditLog } from '../../../../worker/middleware/audit-log'
import { safeError } from '../../../../worker/utils/safe-error'
import { ADJUSTMENT_EVENT, cancelAttributionShare, postLedgerAdjustment } from '../../../../worker/utils/ledger-correction'

export function registerLedgerCorrectionRoutes(app: Hono<{ Bindings: Env }>): void {
  app.post('/admin/ledger/adjustments', requireAdminRole('finance'), require2FA(), auditLog('ledger.adjust'), async (c) => {
    try {
      const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
      const r = await postLedgerAdjustment(c.env.DB, {
        debitAccount: String(b.debit_account ?? ''),
        creditAccount: String(b.credit_account ?? ''),
        amount: Number(b.amount),
        reason: String(b.reason ?? ''),
        key: String(b.key ?? ''),
        adminId: getCurrentUser(c)?.id ?? null,
        payoutId: b.payout_id == null ? null : Number(b.payout_id),
      })
      if (!r.ok) return c.json({ success: false, code: r.code, error: r.error }, r.code === 'PAYOUT_NOT_FOUND' ? 404 : r.code === 'LEDGER_WRITE_FAILED' ? 500 : r.code.startsWith('PAYOUT_') ? 409 : 400)
      return c.json({ success: true, data: r })
    } catch (err) {
      return safeError(c, err, '장부 조정 중 오류가 발생했습니다', '[ledger-correction]')
    }
  })

  app.get('/admin/ledger/adjustments', requireAdminRole('finance'), async (c) => {
    try {
      const rows = await c.env.DB.prepare(
        `SELECT id, reference_id, amount, debit_account, credit_account, metadata, created_at FROM ledger_entries
          WHERE event_type IN ('${ADJUSTMENT_EVENT}', 'attribution_reversal') ORDER BY id DESC LIMIT 200`,
      ).all()
      return c.json({ success: true, data: rows.results ?? [] })
    } catch (err) {
      return safeError(c, err, '조정 기록을 불러오지 못했습니다', '[ledger-correction]')
    }
  })

  app.post('/admin/ledger/attributions/:id/cancel', requireAdminRole('finance'), require2FA(), auditLog('ledger.attribution_cancel'), async (c) => {
    try {
      const b = await c.req.json<{ reason?: string }>().catch(() => ({} as { reason?: string }))
      const r = await cancelAttributionShare(c.env.DB, { attributionId: Number(c.req.param('id')), reason: String(b.reason ?? '') })
      if (!r.ok) return c.json({ success: false, code: r.code, error: r.error }, r.code === 'NOT_FOUND' ? 404 : r.code === 'BAD_ID' || r.code === 'NO_REASON' ? 400 : 409)
      return c.json({ success: true, data: r })
    } catch (err) {
      return safeError(c, err, '적립 취소 중 오류가 발생했습니다', '[ledger-correction]')
    }
  })
}
