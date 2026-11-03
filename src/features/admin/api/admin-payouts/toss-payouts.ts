/**
 * 💸 토스 지급대행 — 어드민 경로 (2026-11-03 대표 *"1번 일단 해주고"*, 게이트 기본 OFF)
 *   로직 SSOT: `worker/utils/toss-payouts.ts`. 결재 `docs/decisions/2026-11-03-settlement-structure.md`.
 *
 *   GET  /admin/payouts/toss/status         — 켜졌는지 · 토스 잔액(켜졌을 때만)
 *   POST /admin/payouts/:id/toss            — 승인된 매장 정산 1건을 토스에 보낸다
 *   POST /admin/payouts/toss/sync/:tossId   — 토스에 상태를 다시 물어 반영(웹훅이 늦을 때)
 *
 * 꺼져 있으면 셋 다 "꺼져 있다"만 말하고 아무것도 안 한다 → 종전 은행 이체 파일 흐름 그대로.
 * 웹훅(토스 → 유어딜)은 `features/payouts/api/toss-payout-webhook.routes.ts`(공개 경로)에 따로 있다.
 */
import type { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { requireAdminRole } from '../../../../worker/middleware/auth'
import { require2FA } from '../../../../worker/middleware/require-2fa'
import { auditLog } from '../../../../worker/middleware/audit-log'
import type { Env } from '../../../../worker/types/env'
import {
  getTossPayoutBalance, sendPayoutViaToss, syncTossPayout, tossPayoutsReady,
} from '../../../../worker/utils/toss-payouts'

const posInt = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null }

export function registerTossPayoutRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get('/admin/payouts/toss/status', requireAdminRole('finance'), async (c) => {
    try {
      const ready = await tossPayoutsReady(c.env.DB, c.env)
      if (!ready.ok) return c.json({ success: true, enabled: false, reason: ready.reason })
      const bal = await getTossPayoutBalance(c.env.DB, c.env)
      return c.json({ success: true, enabled: true, balance: bal.ok ? { available: bal.available, pending: bal.pending } : null, error: bal.ok ? undefined : bal.error })
    } catch (err) {
      return safeError(c, err, '토스 지급대행 상태를 불러오지 못했습니다', '[admin:toss-payouts:status]')
    }
  })

  app.post('/admin/payouts/:id/toss', requireAdminRole('finance'), require2FA(), auditLog('payouts.toss_send'), async (c) => {
    try {
      const id = posInt(c.req.param('id'))
      if (!id) return c.json({ success: false, error: '잘못된 정산 번호' }, 400)
      const admin = c.get('user' as never) as { id?: number } | undefined
      const r = await sendPayoutViaToss(c.env.DB, c.env, id, Number(admin?.id) || null)
      return r.ok ? c.json({ success: true, ...r }) : c.json({ success: false, error: r.error }, 400)
    } catch (err) {
      return safeError(c, err, '토스 지급 요청 중 오류가 발생했습니다', '[admin:toss-payouts:send]')
    }
  })

  app.post('/admin/payouts/toss/sync/:tossId', requireAdminRole('finance'), async (c) => {
    try {
      const tossId = String(c.req.param('tossId') || '').slice(0, 64)
      if (!tossId) return c.json({ success: false, error: '토스 지급 번호가 없습니다' }, 400)
      const r = await syncTossPayout(c.env.DB, c.env, tossId)
      return r.ok ? c.json({ success: true, status: r.status }) : c.json({ success: false, error: r.error }, 400)
    } catch (err) {
      return safeError(c, err, '토스 지급 상태 확인 중 오류가 발생했습니다', '[admin:toss-payouts:sync]')
    }
  })
}
