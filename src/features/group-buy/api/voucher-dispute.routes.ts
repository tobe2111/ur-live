/**
 * 🎟️ 2026-06-22 (대표 — 사용처리 분쟁 "안 왔어요"): 매장이 사용처리된 이용권을 "실제로 안 왔다" 신고 → 정산 보류.
 *
 * 정합(중복 0): 기존 auto-settlement cron 은 `status='used' AND settlement_id IS NULL` 만 정산.
 *   ⚠️ vouchers.status 는 CHECK(IN 'unused','used','expired','refunded') — 'disputed' 추가 불가.
 *   → voucher.status 는 'used' 유지하고, **open 분쟁이 있는 voucher 를 정산 cron 에서 제외**(보류).
 *      (auto-settlement.ts + restaurant-settlement /calculate 에 NOT IN (open disputes) 추가.)
 *
 * 머니룰: 신고는 used+미정산+본인매장만(INSERT OR IGNORE 멱등). 해소(어드민)는 돈 이동 없는 두 길만:
 *   settle(분쟁 종료 → cron 이 정산) / reactivate(voucher used→unused, 손님 재사용). 실제 환불(돈)은 기존
 *   어드민 환불 플로우 — 여기선 status 플립으로 환불 위장 안 함.
 *
 * 라우트:
 *   셀러:  POST /api/voucher-dispute/report   { code }   — 신고(used→disputed)  [requireAuth+seller]
 *          GET  /api/voucher-dispute/mine                 — 내 매장 신고 내역
 *   어드민: GET  /api/admin/voucher-dispute              — open 신고 목록
 *          POST /api/admin/voucher-dispute/:id/resolve  { action: 'settle'|'reactivate', note? }
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAuth, requireAdmin, getCurrentUser } from '@/worker/middleware/auth'
import { safeError } from '@/worker/utils/safe-error'
import { ensureVoucherRedemptionsTable } from '@/worker/utils/voucher-redemption'

type Vars = { user?: { id: string | number; type?: string; role?: string } }

const _ensured = new WeakSet<object>()
async function ensureDisputeTable(DB: D1Database) {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS voucher_disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_id INTEGER NOT NULL,
      product_id INTEGER,
      seller_id INTEGER,
      reason TEXT,
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT (datetime('now')),
      resolved_at DATETIME,
      resolution TEXT,
      admin_note TEXT,
      customer_response TEXT,
      customer_response_at DATETIME,
      UNIQUE(voucher_id)
    )`).run()
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_voucher_disputes_status ON voucher_disputes(status, created_at)").run()
    // 🔁 2026-06-23 양방향 분쟁: 기존 테이블에 손님 응답 컬럼 보강(fail-soft, 이미 있으면 무시).
    for (const col of ['customer_response TEXT', 'customer_response_at DATETIME']) {
      await DB.prepare(`ALTER TABLE voucher_disputes ADD COLUMN ${col}`).run().catch(() => {})
    }
  } catch { /* ignore */ }
}

function isSeller(u: Vars['user']): boolean {
  return u?.type === 'seller' || u?.role === 'seller'
}

// ─────────────────────────────── 셀러 ───────────────────────────────
const sellerApp = new Hono<{ Bindings: Env; Variables: Vars }>()
sellerApp.use('*', requireAuth())

sellerApp.post('/report', async (c) => {
  try {
    const DB = c.env.DB
    const user = getCurrentUser(c) as Vars['user']
    if (!user || !isSeller(user)) return c.json({ success: false, error: '셀러만 신고할 수 있습니다' }, 403)
    const body = await c.req.json<{ code?: string; voucherId?: number; reason?: string }>().catch(() => ({} as { code?: string; voucherId?: number; reason?: string }))
    const vid = Number(body.voucherId)
    if (!body.code && !Number.isFinite(vid)) return c.json({ success: false, error: '이용권 식별자가 필요합니다' }, 400)

    // 본인 매장 + 사용됨 + 미정산 voucher 조회 (voucherId 우선 — 코드 노출 없이 원장에서 신고).
    const where = Number.isFinite(vid) ? 'v.id = ?' : 'v.code = ?'
    const v = await DB.prepare(`
      SELECT v.id, v.user_id, v.product_id, p.seller_id, p.name AS product_name, p.restaurant_name
      FROM vouchers v JOIN products p ON p.id = v.product_id
      WHERE ${where} AND p.seller_id = ? AND v.status = 'used' AND v.settlement_id IS NULL
    `).bind(Number.isFinite(vid) ? vid : body.code, user.id).first<{ id: number; user_id: string | null; product_id: number; seller_id: number; product_name?: string; restaurant_name?: string }>().catch(() => null)
    if (!v) return c.json({ success: false, error: '신고 대상이 아닙니다 (사용 완료 + 정산 전 + 본인 매장만 가능)' }, 409)

    await ensureDisputeTable(DB)
    // 🛡️ voucher.status 는 CHECK 제약상 'disputed' 불가 → status 는 'used' 유지, 분쟁 레코드로 보류(cron 제외).
    //   INSERT OR IGNORE + UNIQUE(voucher_id) = 중복 신고 멱등.
    const ins = await DB.prepare(
      "INSERT OR IGNORE INTO voucher_disputes (voucher_id, product_id, seller_id, reason, status) VALUES (?, ?, ?, ?, 'open')"
    ).bind(v.id, v.product_id, v.seller_id, (body.reason || '미방문 신고').slice(0, 300)).run()
    const already = (ins.meta?.changes || 0) === 0
    // 🔁 양방향 분쟁: 새 신고일 때만 손님에게 확인 요청 알림(fail-soft). 손님은 앱에서 항변/인정 가능.
    if (!already && v.user_id) {
      const storeName = v.restaurant_name || v.product_name || '매장'
      await DB.prepare(
        "INSERT INTO notifications (user_id, type, title, message, created_at) VALUES (?, 'voucher_dispute', ?, ?, datetime('now'))"
      ).bind(v.user_id, '이용권 사용 확인 요청', `[${storeName}] 방문이 확인되지 않아 매장이 확인을 요청했어요. 실제로 이용하셨다면 '내 이용권'에서 알려주세요.`).run().catch(() => {})
    }
    return c.json({ success: true, data: { voucherId: v.id, status: 'disputed', already } })
  } catch (err) { return safeError(c, err, '신고 처리 실패', '[voucher-dispute]') }
})

sellerApp.get('/mine', async (c) => {
  try {
    const DB = c.env.DB
    const user = getCurrentUser(c) as Vars['user']
    if (!user || !isSeller(user)) return c.json({ success: false, error: '셀러만 접근 가능' }, 403)
    await ensureDisputeTable(DB)
    const { results } = await DB.prepare(
      "SELECT id, voucher_id, reason, status, created_at, resolved_at, resolution FROM voucher_disputes WHERE seller_id=? ORDER BY id DESC LIMIT 100"
    ).bind(user.id).all().catch(() => ({ results: [] }))
    return c.json({ success: true, data: results ?? [] })
  } catch (err) { return safeError(c, err, '신고 내역 조회 실패', '[voucher-dispute]') }
})

// ─────────────────────────────── 손님(항변) ───────────────────────────────
// 🔁 2026-06-23 양방향 분쟁: 같은 라우터(requireAuth '*' 공유) — isSeller 체크 없이 voucher 소유 검증.
//   GET /against-me: 내 이용권에 걸린 open 분쟁 / POST /:id/respond: 이용했어요(contest) / 취소(concede).
sellerApp.get('/against-me', async (c) => {
  try {
    const DB = c.env.DB
    const user = getCurrentUser(c) as Vars['user']
    if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    await ensureDisputeTable(DB)
    const { results } = await DB.prepare(`
      SELECT d.id, d.voucher_id, d.reason, d.status, d.customer_response, d.created_at,
             p.name AS product_name, p.restaurant_name
      FROM voucher_disputes d
      JOIN vouchers v ON v.id = d.voucher_id
      LEFT JOIN products p ON p.id = d.product_id
      WHERE v.user_id = ? AND d.status = 'open'
      ORDER BY d.id DESC LIMIT 50
    `).bind(user.id).all().catch(() => ({ results: [] }))
    return c.json({ success: true, data: results ?? [] })
  } catch (err) { return safeError(c, err, '이의 대상 조회 실패', '[voucher-dispute]') }
})

sellerApp.post('/:id/respond', async (c) => {
  try {
    const DB = c.env.DB
    const user = getCurrentUser(c) as Vars['user']
    if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const id = parseInt(c.req.param('id'), 10)
    if (!Number.isFinite(id)) return c.json({ success: false, error: 'bad id' }, 400)
    const body = await c.req.json<{ action?: 'contest' | 'concede' }>().catch(() => ({} as { action?: string }))
    if (body.action !== 'contest' && body.action !== 'concede') return c.json({ success: false, error: "action 은 contest 또는 concede" }, 400)
    await ensureDisputeTable(DB)
    // 본인 voucher 의 open 분쟁만 (소유 검증).
    const d = await DB.prepare(`
      SELECT d.id, d.voucher_id, d.status
      FROM voucher_disputes d JOIN vouchers v ON v.id = d.voucher_id
      WHERE d.id = ? AND v.user_id = ?
    `).bind(id, user.id).first<{ id: number; voucher_id: number; status: string }>().catch(() => null)
    if (!d || d.status !== 'open') return c.json({ success: false, error: '응답할 분쟁이 없습니다' }, 409)

    if (body.action === 'concede') {
      // 손님이 "안 갔다" 인정 → voucher 재사용 복원(used→unused, 미정산만) + 분쟁 종료. 머니룰: 돈 이동 없음.
      await DB.prepare(
        "UPDATE vouchers SET status='unused', used_at=NULL WHERE id=? AND status='used' AND settlement_id IS NULL"
      ).bind(d.voucher_id).run().catch(() => {})
      await DB.prepare(
        "UPDATE voucher_disputes SET status='resolved', resolution='reactivate', customer_response='conceded', customer_response_at=datetime('now'), resolved_at=datetime('now') WHERE id=? AND status='open'"
      ).bind(id).run()
      return c.json({ success: true, data: { id, customer_response: 'conceded', resolved: true } })
    }
    // contest → 손님 항변 기록, open 유지(어드민이 양쪽 보고 판단).
    await DB.prepare(
      "UPDATE voucher_disputes SET customer_response='contested', customer_response_at=datetime('now') WHERE id=? AND status='open'"
    ).bind(id).run()
    return c.json({ success: true, data: { id, customer_response: 'contested', resolved: false } })
  } catch (err) { return safeError(c, err, '응답 처리 실패', '[voucher-dispute]') }
})

// ─────────────────────────────── 어드민 ───────────────────────────────
const adminApp = new Hono<{ Bindings: Env; Variables: Vars }>()
adminApp.use('*', requireAdmin())

adminApp.get('/', async (c) => {
  try {
    const DB = c.env.DB
    await ensureDisputeTable(DB)
    await ensureVoucherRedemptionsTable(DB)
    const { results } = await DB.prepare(`
      SELECT d.id, d.voucher_id, d.product_id, d.seller_id, d.reason, d.status, d.customer_response, d.created_at,
             v.code, v.status as voucher_status, p.name as product_name, p.restaurant_name,
             p.restaurant_lat AS store_lat, p.restaurant_lng AS store_lng,
             vr.used_lat, vr.used_lng
      FROM voucher_disputes d
      LEFT JOIN vouchers v ON v.id = d.voucher_id
      LEFT JOIN products p ON p.id = d.product_id
      LEFT JOIN voucher_redemptions vr ON vr.voucher_id = d.voucher_id
      WHERE d.status = 'open' ORDER BY d.id DESC LIMIT 200
    `).all().catch(() => ({ results: [] }))
    return c.json({ success: true, data: results ?? [] })
  } catch (err) { return safeError(c, err, '분쟁 목록 조회 실패', '[voucher-dispute]') }
})

adminApp.post('/:id/resolve', async (c) => {
  try {
    const DB = c.env.DB
    const id = parseInt(c.req.param('id'), 10)
    if (!Number.isFinite(id)) return c.json({ success: false, error: 'bad id' }, 400)
    const body = await c.req.json<{ action?: 'settle' | 'reactivate'; note?: string }>().catch(() => ({} as { action?: string; note?: string }))
    const action = body.action
    if (action !== 'settle' && action !== 'reactivate') return c.json({ success: false, error: 'action 은 settle 또는 reactivate' }, 400)
    await ensureDisputeTable(DB)
    const d = await DB.prepare("SELECT voucher_id, status FROM voucher_disputes WHERE id=?").bind(id).first<{ voucher_id: number; status: string }>().catch(() => null)
    if (!d || d.status !== 'open') return c.json({ success: false, error: '처리할 분쟁이 없습니다' }, 409)

    // 머니룰: 돈 이동 없는 전이만. voucher.status 는 'used' 유지(분쟁만 종료) → cron 이 정산.
    //   settle = 정상(분쟁만 종료, voucher used 유지) / reactivate = 손님 재사용(voucher used→unused).
    //   실제 환불(돈)이 필요하면 기존 어드민 환불 플로우로 — status 플립으로 환불 위장하지 않음.
    if (action === 'reactivate') {
      const vres = await DB.prepare(
        "UPDATE vouchers SET status='unused', used_at=NULL WHERE id=? AND status='used' AND settlement_id IS NULL"
      ).bind(d.voucher_id).run()
      if ((vres.meta?.changes || 0) !== 1) return c.json({ success: false, error: '이미 정산되었거나 상태가 변경되어 재사용 처리할 수 없습니다' }, 409)
    }
    await DB.prepare(
      "UPDATE voucher_disputes SET status='resolved', resolution=?, admin_note=?, resolved_at=datetime('now') WHERE id=?"
    ).bind(action, (body.note || '').slice(0, 500), id).run()
    return c.json({ success: true, data: { id, resolution: action } })
  } catch (err) { return safeError(c, err, '분쟁 처리 실패', '[voucher-dispute]') }
})

export const voucherDisputeRoutes = sellerApp
export const voucherDisputeAdminRoutes = adminApp
