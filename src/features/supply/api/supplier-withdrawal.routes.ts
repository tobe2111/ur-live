/**
 * 🏦 2026-06-09 유통스타트 제조사(공급자) 정산금 출금 — 예치금 충전요청의 *역방향* 미러.
 *
 * 흐름: 제조사 정산 available 적립 → 출금 신청(requested, 잔액 원자 예약)
 *       → 어드민 송금 후 승인(approved/paid) / 반려(rejected, 예약 복원).
 *
 * 💰 머니-크리티컬: 모든 예약/복원/확정은 CAS(원자적 UPDATE … WHERE) 로만. 음수·초과인출 금지.
 *    (wholesale-deposit.routes 의 confirm/reject CAS 패턴 미러.)
 *
 * 마운트(worker/index.ts):
 *   app.route('/api/supplier', supplierWithdrawalRoutes)            — 제조사 (requireSupplier)
 *   adminApp.route('/wholesale-withdrawals', adminWholesaleWithdrawalRoutes) — 어드민 (requireAdmin 체인)
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { requireSupplier, requireAdminRole } from '@/worker/middleware/auth'
import { safeError } from '@/worker/utils/safe-error'
import { swallow } from '@/worker/utils/swallow'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'
import {
  ensureWithdrawalSchema,
  loadSpendable,
  reserveForWithdrawal,
  releaseReservation,
  settleWithdrawalLedger,
} from './supplier-withdrawal-core'

const MIN_WITHDRAWAL = 10_000 // 최소 출금 금액 (1만원).

function supplierIdOf(c: { get: (k: string) => unknown }): number | null {
  const user = c.get('user') as { id?: string | number } | undefined
  const id = Number(user?.id)
  return Number.isFinite(id) && id > 0 ? id : null
}

// ════════════════════════════════════════════════════════════════════════════
// 제조사(supplier) 엔드포인트 — /api/supplier/withdrawals/*
// ════════════════════════════════════════════════════════════════════════════
const sup = new Hono<{ Bindings: Env }>()
sup.use('*', requireSupplier())

// ── POST /withdrawals/request — 출금 신청(requested + 잔액 원자 예약) ───────────
sup.post('/withdrawals/request', rateLimit({ action: 'supplier-withdrawal-request', max: 10, windowSec: 60 }), async (c) => {
  const sid = supplierIdOf(c)
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureWithdrawalSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const amount = Math.floor(Number(body.amount))
    // 💰 금액 검증 — 유한·정수·최소 1만원 이상. (잔액 초과는 아래 서버재계산 + CAS 로 차단.)
    if (!Number.isFinite(amount) || amount <= 0) {
      return c.json({ success: false, error: '출금 금액이 올바르지 않습니다' }, 400)
    }
    if (amount < MIN_WITHDRAWAL) {
      return c.json({ success: false, error: `최소 출금 금액은 ${MIN_WITHDRAWAL.toLocaleString('ko-KR')}원입니다` }, 400)
    }

    // 💰 서버재계산 — 클라 금액은 신뢰 안 함. 실가용(available-reserved) 기준으로만 판단.
    const before = await loadSpendable(DB, sid)
    if (amount > before.spendable) {
      return c.json({ success: false, error: `출금 가능 잔액(${before.spendable.toLocaleString('ko-KR')}원)을 초과했습니다`, code: 'INSUFFICIENT', spendable: before.spendable }, 400)
    }

    // 신청 시점 계좌 스냅샷 + 상호.
    const supRow = await DB.prepare('SELECT business_name, bank_name, bank_account, account_holder FROM suppliers WHERE id = ?')
      .bind(sid).first<{ business_name: string | null; bank_name: string | null; bank_account: string | null; account_holder: string | null }>().catch(() => null)
    if (!supRow?.bank_name || !supRow?.bank_account || !supRow?.account_holder) {
      return c.json({ success: false, error: '먼저 정산 계좌(은행/계좌번호/예금주)를 등록해주세요', code: 'NO_BANK' }, 400)
    }

    // 💰 STEP 1 — 원자 예약: spendable >= amount 일 때만 reserved += amount. 동시 신청 초과인출 차단.
    const reserved = await reserveForWithdrawal(DB, sid, amount)
    if (!reserved.ok) {
      return c.json({ success: false, error: `출금 가능 잔액(${reserved.spendable.toLocaleString('ko-KR')}원)을 초과했습니다`, code: 'INSUFFICIENT', spendable: reserved.spendable }, 400)
    }

    // 💰 STEP 2 — 신청 row INSERT (계좌 스냅샷). 예약은 STEP 1 에서 이미 잔액에 반영됨.
    const ins = await DB.prepare(
      "INSERT INTO wholesale_settlement_withdrawals (supplier_id, amount, status, bank_name, bank_account, account_holder) VALUES (?, ?, 'requested', ?, ?, ?)"
    ).bind(sid, amount, supRow.bank_name, supRow.bank_account, supRow.account_holder).run().catch(() => null)
    const withdrawalId = Number(ins?.meta?.last_row_id)
    if (!withdrawalId) {
      // INSERT 실패 → 예약 즉시 복원(자금 안전: 잠긴 잔액 풀어줌).
      await releaseReservation(DB, sid, amount)
      return c.json({ success: false, error: '출금 신청 생성 중 오류가 발생했습니다' }, 500)
    }

    // STEP 3 — 어드민 송금 큐 알림.
    const bizName = supRow.business_name || `제조사 #${sid}`
    createDashboardNotification(
      DB, 'admin', null, 'supplier_withdrawal_request', '제조사 출금 신청',
      `${bizName} · ${amount.toLocaleString('ko-KR')}원 (${supRow.bank_name} ${supRow.account_holder})`,
      '/admin/wholesale-withdrawals',
    ).catch(swallow('supplier-withdrawal:notify-admin'))

    return c.json({ success: true, withdrawal_id: withdrawalId, status: 'requested', spendable: reserved.spendableAfter })
  } catch (err) {
    return safeError(c, err, '출금 신청 중 오류가 발생했습니다', '[supplier-withdrawal]')
  }
})

// ── GET /withdrawals — 내 출금 신청 내역(최신순) ──────────────────────────────
sup.get('/withdrawals', async (c) => {
  const sid = supplierIdOf(c)
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureWithdrawalSchema(DB)
    const { results } = await DB.prepare(
      `SELECT id, amount, status, bank_name, bank_account, account_holder, admin_memo, requested_at, processed_at
       FROM wholesale_settlement_withdrawals WHERE supplier_id = ? ORDER BY id DESC LIMIT 100`
    ).bind(sid).all()
    const balance = await loadSpendable(DB, sid)
    return c.json({ success: true, withdrawals: results ?? [], spendable: balance.spendable, available: balance.available, reserved: balance.reserved })
  } catch (err) {
    return safeError(c, err, '출금 내역 조회 중 오류가 발생했습니다', '[supplier-withdrawal]')
  }
})

// ════════════════════════════════════════════════════════════════════════════
// 어드민 엔드포인트 — /api/admin/wholesale-withdrawals/*
//   (adminApp 의 requireAdmin + IP whitelist + audit 체인 하위에 마운트되므로 별도 가드 불필요.)
// ════════════════════════════════════════════════════════════════════════════
const admin = new Hono<{ Bindings: Env }>()

// ── GET / — 출금 신청 목록(제조사 상호/사업자 join) ──────────────────────────
admin.get('/wholesale-withdrawals', cors(), async (c) => {
  const { DB } = c.env
  try {
    await ensureWithdrawalSchema(DB)
    const status = String(c.req.query('status') || 'requested') // requested | approved | paid | rejected | all
    const conds: string[] = []
    const binds: (string | number)[] = []
    if (['requested', 'approved', 'paid', 'rejected'].includes(status)) {
      conds.push('w.status = ?'); binds.push(status)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const { results } = await DB.prepare(
      `SELECT w.id, w.supplier_id, s.business_name, s.business_number, s.email,
              w.amount, w.status, w.bank_name, w.bank_account, w.account_holder,
              w.admin_memo, w.requested_at, w.processed_at
       FROM wholesale_settlement_withdrawals w
       LEFT JOIN suppliers s ON s.id = w.supplier_id
       ${where}
       ORDER BY w.id DESC LIMIT 200`
    ).bind(...binds).all()
    return c.json({ success: true, withdrawals: results ?? [] })
  } catch (err) {
    return safeError(c, err, '출금 신청 조회 중 오류가 발생했습니다', '[admin-wholesale-withdrawal]')
  }
})

// ── POST /:id/approve — 출금 승인(송금 완료) ── 💰 머니-크리티컬, 멱등 ──────────
//   예약(reserved)은 신청 시 이미 잔액에서 빠졌으므로, 승인은 'requested→paid' 전환 +
//   예약을 실제 available 차감으로 확정(settleWithdrawalLedger). 어드민이 은행 송금을 직접 수행.
admin.post('/wholesale-withdrawals/:id/approve', requireAdminRole('finance'), rateLimit({ action: 'admin-supplier-withdrawal-approve', max: 30, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청 ID' }, 400)
  try {
    await ensureWithdrawalSchema(DB)
    const row = await DB.prepare('SELECT id, supplier_id, amount, status FROM wholesale_settlement_withdrawals WHERE id = ?')
      .bind(id).first<{ id: number; supplier_id: number; amount: number; status: string }>()
    if (!row) return c.json({ success: false, error: '출금 신청을 찾을 수 없습니다' }, 404)

    // 💰 CAS: requested → paid. changes=0 이면 이미 처리됨(승인/반려) → 멱등(이중 확정 금지).
    const claim = await DB.prepare(
      "UPDATE wholesale_settlement_withdrawals SET status='paid', processed_at=datetime('now') WHERE id=? AND status='requested'"
    ).bind(id).run()
    if ((claim.meta?.changes ?? 0) === 0) {
      return c.json({ success: true, already: true })
    }

    const amount = Math.floor(Number(row.amount) || 0)
    // 💰 예약 → 실제 available 차감 확정(클로백 net-out row + 즉시 차감). 이 호출에서 1회만.
    await settleWithdrawalLedger(DB, row.supplier_id, id, amount)

    createDashboardNotification(
      DB, 'supplier', String(row.supplier_id), 'supplier_withdrawal_approved', '출금 완료',
      `${amount.toLocaleString('ko-KR')}원이 등록된 계좌로 송금되었습니다.`, '/supplier',
    ).catch(swallow('supplier-withdrawal:notify-approve'))

    return c.json({ success: true, status: 'paid', amount })
  } catch (err) {
    return safeError(c, err, '출금 승인 중 오류가 발생했습니다', '[admin-wholesale-withdrawal]')
  }
})

// ── POST /:id/reject — 출금 반려(예약 복원) ── 💰 머니-크리티컬, 멱등 ───────────
admin.post('/wholesale-withdrawals/:id/reject', requireAdminRole('finance'), rateLimit({ action: 'admin-supplier-withdrawal-reject', max: 30, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청 ID' }, 400)
  try {
    await ensureWithdrawalSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const memo = String(body.memo || '').slice(0, 200) || null
    const row = await DB.prepare('SELECT supplier_id, amount, status FROM wholesale_settlement_withdrawals WHERE id = ?')
      .bind(id).first<{ supplier_id: number; amount: number; status: string }>()
    if (!row) return c.json({ success: false, error: '출금 신청을 찾을 수 없습니다' }, 404)

    // 💰 CAS: requested → rejected. 이미 처리(paid/approved/rejected)면 멱등(예약 복원 1회만).
    const claim = await DB.prepare(
      "UPDATE wholesale_settlement_withdrawals SET status='rejected', admin_memo=?, processed_at=datetime('now') WHERE id=? AND status='requested'"
    ).bind(memo, id).run()
    if ((claim.meta?.changes ?? 0) === 0) {
      return c.json({ success: true, already: true })
    }

    // 💰 예약 복원 — 잠겼던 금액을 실가용으로 되돌림(이 전환 1회만).
    await releaseReservation(DB, row.supplier_id, Math.floor(Number(row.amount) || 0))

    createDashboardNotification(
      DB, 'supplier', String(row.supplier_id), 'supplier_withdrawal_rejected', '출금 신청 반려',
      `${(row.amount || 0).toLocaleString('ko-KR')}원 출금 신청이 반려되었습니다${memo ? ` (${memo})` : ''}. 잔액이 복원되었습니다.`,
      '/supplier',
    ).catch(swallow('supplier-withdrawal:notify-reject'))

    return c.json({ success: true, status: 'rejected' })
  } catch (err) {
    return safeError(c, err, '출금 반려 중 오류가 발생했습니다', '[admin-wholesale-withdrawal]')
  }
})

export { sup as supplierWithdrawalRoutes, admin as adminWholesaleWithdrawalRoutes }
