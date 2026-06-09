/**
 * 🏦 2026-06-09 유통스타트 도매몰 — 예치금(선불 deposit) 결제 모델.
 * (Toss 선결제/여신을 대체하는 B2B 충전식 결제)
 *
 * 흐름: 유통사가 무통장입금 → 충전 요청(pending) → 어드민이 입금확인(confirm) → 잔액 적립
 *       → 도매 주문 시 잔액에서 차감(Toss 미경유). 환불 시 잔액 복원.
 *
 * 💰 머니-크리티컬: 모든 적립/차감은 CAS 또는 D1.batch 로 원자적·멱등. 서버계산 금액만.
 *    절대 음수 잔액·재시도 시 이중적립 금지. 여신(credit) CAS 패턴(wholesale.routes ON_CREDIT) 미러.
 *
 * 마운트(worker/index.ts):
 *   app.route('/api/wholesale', wholesaleDepositRoutes)        — 유통사 (GET/POST deposits/*)
 *   app.route('/api/admin/wholesale-deposits', adminWholesaleDepositRoutes) — 어드민
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { swallow } from '@/worker/utils/swallow'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { requireAdmin } from '@/worker/middleware/auth'
import { adminIpWhitelist, adminAuditMiddleware } from '@/worker/middleware/admin-security'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'
import {
  ensureDepositSchema,
  loadDepositBalance,
  recentDepositTxns,
} from './wholesale-deposit-core'
import { loadWholesaleDepositAccount } from './wholesale-main.routes'

// ── 셀러(유통사) JWT → { sellerId, isDistributor } ───────────────────────────
//   wholesale.routes sellerIdFrom 미러 + is_distributor 플래그 추가(예치금 게이트).
async function distributorFrom(authorization: string | undefined, jwtSecret: string): Promise<{ sellerId: number; isDistributor: boolean } | null> {
  if (!authorization?.startsWith('Bearer ')) return null
  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as { seller_id?: number; is_distributor?: number | boolean }
    if (!payload.seller_id) return null
    return { sellerId: payload.seller_id, isDistributor: !!payload.is_distributor }
  } catch {
    return null
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 유통사(distributor) 엔드포인트 — /api/wholesale/deposits/*
// ════════════════════════════════════════════════════════════════════════════
const dist = new Hono<{ Bindings: Env }>()

// ── GET /deposits/me — 내 잔액 + 최근 거래내역 ───────────────────────────────
dist.get('/deposits/me', async (c) => {
  const auth = await distributorFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!auth) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureDepositSchema(DB)
    const balance = await loadDepositBalance(DB, auth.sellerId)
    const recent = await recentDepositTxns(DB, auth.sellerId, 20)
    // 🏭 Wave 2: 어드민 설정 입금계좌(platform_settings) — 입금 안내 박스가 실제 계좌를 표시(없으면 '').
    const deposit_account = await loadWholesaleDepositAccount(DB).catch(() => '')
    return c.json({ success: true, balance, recent_txns: recent, deposit_account })
  } catch (err) {
    return safeError(c, err, '예치금 조회 중 오류가 발생했습니다', '[wholesale-deposit]')
  }
})

// ── POST /deposits/charge-request — 무통장입금 충전 요청(pending) ─────────────
//   서버는 요청만 적립(잔액 변동 X). 어드민이 입금 확인 시 비로소 적립.
dist.post('/deposits/charge-request', rateLimit({ action: 'wholesale-deposit-request', max: 10, windowSec: 60 }), async (c) => {
  const auth = await distributorFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!auth) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureDepositSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const amount = Math.floor(Number(body.amount))
    // 💰 금액 검증 — 유한·정수·1,000~1억원. (클라 금액은 '요청'일 뿐 적립 X — 어드민 확인이 SSOT.)
    if (!Number.isFinite(amount) || amount < 1000 || amount > 100_000_000) {
      return c.json({ success: false, error: '충전 금액은 1,000원 이상 1억원 이하여야 합니다' }, 400)
    }
    const depositorName = String(body.depositor_name || '').trim().slice(0, 40) || null

    const ins = await DB.prepare(
      "INSERT INTO wholesale_deposit_requests (seller_id, amount, depositor_name, status) VALUES (?, ?, ?, 'pending')"
    ).bind(auth.sellerId, amount, depositorName).run()
    const requestId = Number(ins.meta?.last_row_id)
    if (!requestId) return c.json({ success: false, error: '충전 요청 생성 중 오류가 발생했습니다' }, 500)

    // 상호명(있으면) — 어드민 알림 가독성.
    const biz = await DB.prepare('SELECT name FROM sellers WHERE id = ?').bind(auth.sellerId).first<{ name: string | null }>().catch(() => null)
    const bizName = biz?.name || `유통사 #${auth.sellerId}`

    createDashboardNotification(
      DB, 'admin', null, 'wholesale_deposit_request', '예치금 충전 입금확인 요청',
      `${bizName} · ${amount.toLocaleString('ko-KR')}원 · 입금자 ${depositorName || '(미기재)'}`,
      '/admin/wholesale-deposits',
    ).catch(swallow('wholesale-deposit:notify-admin'))

    return c.json({ success: true, request_id: requestId, status: 'pending' })
  } catch (err) {
    return safeError(c, err, '충전 요청 중 오류가 발생했습니다', '[wholesale-deposit]')
  }
})

// ── GET /deposits/requests — 내 충전 요청 내역(최신순) ────────────────────────
dist.get('/deposits/requests', async (c) => {
  const auth = await distributorFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!auth) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureDepositSchema(DB)
    const { results } = await DB.prepare(
      `SELECT id, amount, depositor_name, status, admin_memo, created_at, confirmed_at
       FROM wholesale_deposit_requests WHERE seller_id = ? ORDER BY id DESC LIMIT 100`
    ).bind(auth.sellerId).all()
    return c.json({ success: true, requests: results ?? [] })
  } catch (err) {
    return safeError(c, err, '충전 요청 조회 중 오류가 발생했습니다', '[wholesale-deposit]')
  }
})

// ════════════════════════════════════════════════════════════════════════════
// 어드민 엔드포인트 — /api/admin/wholesale-deposits/*
// ════════════════════════════════════════════════════════════════════════════
const admin = new Hono<{ Bindings: Env }>()
//  distributor-admin.routes 와 동일 보안 체인(IP 화이트리스트 + requireAdmin + 감사로그).
admin.use('*', adminIpWhitelist())
admin.use('*', requireAdmin())
admin.use('*', adminAuditMiddleware())

// ── GET / — 충전 요청 목록(상호명 join) ──────────────────────────────────────
//   🏬 멀티-몰: ?mall_id= 가 주어진 경우에만 해당 몰(요청 유통사 계정의 sellers.mall_id)로 필터.
//   미지정 = 전 몰(기존 무필터 뷰 보존 — byte-identical). 각 행에 mall_id(+몰 이름)도 반환.
admin.get('/', async (c) => {
  const { DB } = c.env
  try {
    await ensureDepositSchema(DB)
    const status = c.req.query('status') === 'all' ? 'all' : 'pending'
    const mallQ = c.req.query('mall_id')
    const mallN = Math.floor(Number(mallQ))
    const mallId = (mallQ != null && mallQ !== '' && Number.isFinite(mallN) && mallN > 0) ? mallN : null
    const conds: string[] = []
    const binds: (string | number)[] = []
    if (status !== 'all') conds.push("r.status = 'pending'")
    if (mallId != null) { conds.push('COALESCE(s.mall_id,1) = ?'); binds.push(mallId) }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const { results } = await DB.prepare(
      `SELECT r.id, r.seller_id, s.name AS business_name, r.amount, r.depositor_name,
              r.status, r.admin_memo, r.created_at, r.confirmed_at,
              COALESCE(s.mall_id,1) AS mall_id, m.name AS mall_name
       FROM wholesale_deposit_requests r
       LEFT JOIN sellers s ON s.id = r.seller_id
       LEFT JOIN wholesale_malls m ON m.id = COALESCE(s.mall_id,1)
       ${where}
       ORDER BY r.id DESC LIMIT 200`
    ).bind(...binds).all()
    return c.json({ success: true, requests: results ?? [] })
  } catch (err) {
    return safeError(c, err, '충전 요청 조회 중 오류가 발생했습니다', '[admin-wholesale-deposit]')
  }
})

// ── POST /:id/confirm — 입금확인 → 잔액 적립 (💰 머니-크리티컬, 멱등 + 원자적) ──
admin.post('/:id/confirm', rateLimit({ action: 'admin-wholesale-deposit-confirm', max: 30, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청 ID' }, 400)
  try {
    await ensureDepositSchema(DB)
    // 요청 로드(금액·유통사 확보) — 금액은 요청 row 가 SSOT(클라 입력 신뢰 X).
    const reqRow = await DB.prepare(
      'SELECT id, seller_id, amount, status FROM wholesale_deposit_requests WHERE id = ?'
    ).bind(id).first<{ id: number; seller_id: number; amount: number; status: string }>()
    if (!reqRow) return c.json({ success: false, error: '충전 요청을 찾을 수 없습니다' }, 404)

    // 💰 STEP 1 — CAS: pending → confirmed. changes=0 이면 이미 처리됨 → 이중적립 절대 금지.
    const claim = await DB.prepare(
      "UPDATE wholesale_deposit_requests SET status='confirmed', confirmed_at=datetime('now') WHERE id=? AND status='pending'"
    ).bind(id).run()
    if ((claim.meta?.changes ?? 0) === 0) {
      // 이미 confirmed/rejected — 멱등 반환(no double credit).
      return c.json({ success: true, already: true })
    }

    const sellerId = reqRow.seller_id
    const amount = Math.floor(Number(reqRow.amount) || 0)
    if (amount <= 0) {
      // 방어: 금액 이상 → CAS 되돌려 pending 복구(적립 안 함).
      await DB.prepare("UPDATE wholesale_deposit_requests SET status='pending', confirmed_at=NULL WHERE id=? AND status='confirmed'").bind(id).run().catch(swallow('deposit:confirm-amount-rollback'))
      return c.json({ success: false, error: '충전 금액이 올바르지 않습니다' }, 400)
    }

    // 💰 STEP 2 — 잔액 행 보장 후 원자 적립 + 원장 기록.
    //   INSERT OR IGNORE 로 행 보장(별도 트랜잭션 — 멱등). 그 후 balance += amount.
    await DB.prepare('INSERT OR IGNORE INTO wholesale_deposits (seller_id, balance) VALUES (?, 0)').bind(sellerId).run()
    const up = await DB.prepare(
      "UPDATE wholesale_deposits SET balance = balance + ?, updated_at = datetime('now') WHERE seller_id = ?"
    ).bind(amount, sellerId).run()
    if ((up.meta?.changes ?? 0) === 0) {
      // 적립 실패(행 없음 — 비정상) → CAS 되돌림 + 에러. 적립 안 됨 = 안전(미적립).
      await DB.prepare("UPDATE wholesale_deposit_requests SET status='pending', confirmed_at=NULL WHERE id=? AND status='confirmed'").bind(id).run().catch(swallow('deposit:confirm-credit-rollback'))
      return c.json({ success: false, error: '잔액 적립 중 오류가 발생했습니다', code: 'CREDIT_FAILED' }, 500)
    }
    // 적립 후 잔액 read → 원장 balance_after.
    const balanceAfter = await loadDepositBalance(DB, sellerId)
    await DB.prepare(
      "INSERT INTO wholesale_deposit_txns (seller_id, type, amount, balance_after, ref_id, memo) VALUES (?, 'charge', ?, ?, ?, ?)"
    ).bind(sellerId, amount, balanceAfter, String(id), `예치금 충전 입금확인 #${id}`).run().catch(swallow('deposit:confirm-txn'))

    // STEP 3 — 유통사 알림.
    createDashboardNotification(
      DB, 'seller', String(sellerId), 'wholesale_deposit_confirmed', '예치금 충전 완료',
      `${amount.toLocaleString('ko-KR')}원이 충전되었습니다 (잔액 ${balanceAfter.toLocaleString('ko-KR')}원)`,
      '/wholesale/deposits',
    ).catch(swallow('deposit:confirm-notify'))

    return c.json({ success: true, credited: amount, balance: balanceAfter })
  } catch (err) {
    return safeError(c, err, '입금 확인 중 오류가 발생했습니다', '[admin-wholesale-deposit]')
  }
})

// ── POST /:id/reject — 충전 요청 거절 (잔액 변동 없음, CAS) ────────────────────
admin.post('/:id/reject', rateLimit({ action: 'admin-wholesale-deposit-reject', max: 30, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청 ID' }, 400)
  try {
    await ensureDepositSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const memo = String(body.memo || '').slice(0, 200) || null
    const reqRow = await DB.prepare('SELECT seller_id, amount FROM wholesale_deposit_requests WHERE id = ?')
      .bind(id).first<{ seller_id: number; amount: number }>()
    if (!reqRow) return c.json({ success: false, error: '충전 요청을 찾을 수 없습니다' }, 404)

    // 💰 CAS: pending → rejected. 이미 처리(confirmed/rejected)면 멱등. 잔액 변동 절대 없음.
    const claim = await DB.prepare(
      "UPDATE wholesale_deposit_requests SET status='rejected', admin_memo=?, confirmed_at=datetime('now') WHERE id=? AND status='pending'"
    ).bind(memo, id).run()
    if ((claim.meta?.changes ?? 0) === 0) return c.json({ success: true, already: true })

    createDashboardNotification(
      DB, 'seller', String(reqRow.seller_id), 'wholesale_deposit_rejected', '예치금 충전 요청 반려',
      `${(reqRow.amount || 0).toLocaleString('ko-KR')}원 충전 요청이 반려되었습니다${memo ? ` (${memo})` : ''}`,
      '/wholesale/deposits',
    ).catch(swallow('deposit:reject-notify'))

    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '충전 요청 반려 중 오류가 발생했습니다', '[admin-wholesale-deposit]')
  }
})

// ── POST /adjust — 잔액 수동 보정 (음수 가드, 원장 'adjust') ───────────────────
admin.post('/adjust', rateLimit({ action: 'admin-wholesale-deposit-adjust', max: 20, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  try {
    await ensureDepositSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const sellerId = Math.floor(Number(body.seller_id))
    const amount = Math.floor(Number(body.amount)) // signed: +적립 / -차감
    const memo = String(body.memo || '관리자 보정').slice(0, 200)
    if (!Number.isFinite(sellerId) || sellerId <= 0) return c.json({ success: false, error: '유통사 ID가 올바르지 않습니다' }, 400)
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100_000_000) {
      return c.json({ success: false, error: '보정 금액이 올바르지 않습니다' }, 400)
    }

    await DB.prepare('INSERT OR IGNORE INTO wholesale_deposits (seller_id, balance) VALUES (?, 0)').bind(sellerId).run()
    // 💰 음수 잔액 가드: 차감(음수) 시 balance + amount >= 0 인 경우에만 반영(CAS).
    const up = await DB.prepare(
      'UPDATE wholesale_deposits SET balance = balance + ?, updated_at = datetime(\'now\') WHERE seller_id = ? AND balance + ? >= 0'
    ).bind(amount, sellerId, amount).run()
    if ((up.meta?.changes ?? 0) === 0) {
      const cur = await loadDepositBalance(DB, sellerId)
      return c.json({ success: false, error: `보정 후 잔액이 음수가 됩니다 (현재 ${cur.toLocaleString('ko-KR')}원)`, code: 'WOULD_GO_NEGATIVE', balance: cur }, 400)
    }
    const balanceAfter = await loadDepositBalance(DB, sellerId)
    await DB.prepare(
      "INSERT INTO wholesale_deposit_txns (seller_id, type, amount, balance_after, memo) VALUES (?, 'adjust', ?, ?, ?)"
    ).bind(sellerId, amount, balanceAfter, memo).run().catch(swallow('deposit:adjust-txn'))

    return c.json({ success: true, balance: balanceAfter })
  } catch (err) {
    return safeError(c, err, '잔액 보정 중 오류가 발생했습니다', '[admin-wholesale-deposit]')
  }
})

export { dist as wholesaleDepositRoutes, admin as adminWholesaleDepositRoutes }
