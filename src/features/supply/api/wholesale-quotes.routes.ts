/**
 * 🏭 2026-06-08 유통스타트 도매몰 — 견적/발주서(Quote/PO) 워크플로 (BIZ-3).
 * (기존: 즉시 Toss 선결제만 존재. 대량/협상 주문은 견적요청 → 운영자 회신 → 수락 → (후속)주문전환 흐름 필요.)
 *
 * OEM/ODM 신청(oem-requests.ts)의 status-machine + admin-reply 패턴을 미러링.
 *
 * 흐름:
 *   유통회원 견적요청(requested)
 *     → 운영자(어드민) 단가/MOQ/유효기간 회신(quoted) + 유통회원 알림
 *       → 유통회원 수락(accepted) / 반려(rejected)
 *         → (v1: 수락 시 운영자에게 알림 — 운영자가 기존 주문 흐름으로 발주 생성)
 *            ⚠️ 자동 wholesale_order 전환은 후속 단계. 주문/결제 로직 중복 금지(toss-gateway / wholesale.routes SSOT).
 *
 * v1 스코프: 단일 라인 견적(single-line). multi-line 은 future — wholesale_quote_items 미생성.
 *            견적 1건 = 상품/요청 1건. 충분히 실무 커버(특정 상품 대량가 협상). 복수 품목은 후속.
 *
 * 마운트(오케스트레이터): app.route('/api/wholesale', wholesaleQuotesRoutes)
 *   → 유통회원: /api/wholesale/quotes*, 어드민: /api/wholesale/admin/quotes*
 */
import { Hono } from 'hono'
import { isViewerToken } from './sub-account-gate'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { swallow } from '@/worker/utils/swallow'
import { requireAdmin } from '@/worker/middleware/auth'
import { adminIpWhitelist, adminAuditMiddleware, writeAuditLog } from '@/worker/middleware/admin-security'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'

const app = new Hono<{ Bindings: Env }>()

// ── 견적 상태 머신 ────────────────────────────────────────────────────────────
//   requested : 유통회원 요청 접수 (초기)
//   quoted    : 운영자가 단가/MOQ/유효기간 회신 — 유통회원 수락 대기
//   accepted  : 유통회원 수락 — 운영자 발주 생성 대기 (후속: 주문 전환)
//   rejected  : 유통회원 반려 / 운영자 거절
//   expired   : valid_until 경과 (조회 시 파생 표시 — 저장 상태는 cron/후속에서 전환)
//   converted : 실제 wholesale_order 로 전환 완료 (order_id 세팅) — v1 미자동, 후속 단계
export const QUOTE_STATUSES = ['requested', 'quoted', 'accepted', 'rejected', 'expired', 'converted'] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export function normalizeQuoteStatus(v: unknown): QuoteStatus | null {
  const s = String(v || '').toLowerCase()
  return (QUOTE_STATUSES as readonly string[]).includes(s) ? (s as QuoteStatus) : null
}

// ── 스키마 ensure (멱등, WeakMap-promise — supply-visibility.ts 패턴) ─────────────
//   동시 cold 요청이 테이블 생성 전 쿼리해 500 나지 않도록 in-flight promise 공유.
const _ensuring = new WeakMap<object, Promise<void>>()

export async function ensureWholesaleQuotesSchema(DB: D1Database): Promise<void> {
  const existing = _ensuring.get(DB)
  if (existing) return existing
  const p = _ensureWholesaleQuotesSchema(DB)
  _ensuring.set(DB, p)
  try {
    await p
  } catch {
    _ensuring.delete(DB) // 실패 시 다음 호출이 재시도하도록 캐시 제거
  }
}

async function _ensureWholesaleQuotesSchema(DB: D1Database): Promise<void> {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_seller_id INTEGER NOT NULL,
    supplier_id INTEGER,
    product_id INTEGER,
    title TEXT NOT NULL,
    request_text TEXT,
    requested_qty INTEGER NOT NULL DEFAULT 1,
    target_unit_price INTEGER,
    status TEXT NOT NULL DEFAULT 'requested',
    quoted_unit_price INTEGER,
    quoted_moq INTEGER,
    quote_memo TEXT,
    valid_until TEXT,
    order_id INTEGER,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('wq:create'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wq_distributor ON wholesale_quotes(distributor_seller_id, created_at DESC)')
    .run().catch(swallow('wq:idx-distributor'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wq_supplier ON wholesale_quotes(supplier_id, created_at DESC)')
    .run().catch(swallow('wq:idx-supplier'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wq_status ON wholesale_quotes(status, created_at DESC)')
    .run().catch(swallow('wq:idx-status'))
}

// ── 셀러(유통사) JWT → seller_id (wholesale.routes.ts 패턴) ─────────────────────
async function sellerIdFrom(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization?.startsWith('Bearer ')) return null
  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as { seller_id?: number }
    return payload.seller_id ?? null
  } catch {
    return null
  }
}

/** 유효한 정수(>=min)면 floor, 아니면 null. */
function intOrNull(v: unknown, min = 0): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n >= min ? Math.floor(n) : null
}

// ════════════════════════════════════════════════════════════════════════════
//  유통회원(distributor) 견적 엔드포인트 — Bearer seller_token
// ════════════════════════════════════════════════════════════════════════════

// POST /quotes — 견적 요청 생성 (status='requested')
app.post('/quotes', rateLimit({ action: 'wholesale-quote', max: 30, windowSec: 3600 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  // 🛡️ 감사 🟡#5: 조회 전용(viewer) 직원 계정은 견적 요청 불가.
  if (await isViewerToken(c.req.header('Authorization'), c.env.JWT_SECRET)) {
    return c.json({ success: false, error: '조회 전용 직원 계정은 이 작업을 할 수 없습니다' }, 403)
  }
  const { DB } = c.env
  try {
    await ensureWholesaleQuotesSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const title = String(body.title || '').trim().slice(0, 200)
    if (!title) return c.json({ success: false, error: '견적 제목을 입력해주세요' }, 400)
    const requestText = body.request_text ? String(body.request_text).slice(0, 2000) : null
    const requestedQtyRaw = intOrNull(body.requested_qty, 1)
    const requestedQty = requestedQtyRaw && requestedQtyRaw > 0 ? requestedQtyRaw : 1
    const targetUnitPrice = intOrNull(body.target_unit_price, 0)
    const productId = intOrNull(body.product_id, 1)
    const supplierId = intOrNull(body.supplier_id, 1)

    // 상품 지정 시 존재 검증(선택) — 공급상품 한정.
    if (productId !== null) {
      const exists = await DB.prepare('SELECT 1 FROM products WHERE id = ?').bind(productId).first().catch(() => null)
      if (!exists) return c.json({ success: false, error: '존재하지 않는 상품입니다' }, 400)
    }

    const ins = await DB.prepare(
      `INSERT INTO wholesale_quotes
         (distributor_seller_id, supplier_id, product_id, title, request_text, requested_qty, target_unit_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'requested')`
    ).bind(sellerId, supplierId, productId, title, requestText, requestedQty, targetUnitPrice).run()

    // 운영자에게 신규 견적요청 알림 (best-effort).
    await createDashboardNotification(
      DB, 'admin', null, 'wholesale_quote_requested',
      '신규 견적요청', `${title} (수량 ${requestedQty})`, '/admin/wholesale-quotes',
    ).catch(() => { /* 알림 실패해도 접수 성공 */ })

    return c.json({
      success: true,
      id: Number(ins.meta?.last_row_id),
      message: '견적요청이 접수되었습니다. 운영자가 단가를 회신합니다.',
    }, 201)
  } catch (err) {
    return safeError(c, err, '견적요청 중 오류가 발생했습니다', '[wholesale-quotes]')
  }
})

// GET /quotes — 내 견적 목록
app.get('/quotes', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureWholesaleQuotesSchema(DB)
    const { results } = await DB.prepare(`
      SELECT q.id, q.product_id, q.title, q.request_text, q.requested_qty, q.target_unit_price,
             q.status, q.quoted_unit_price, q.quoted_moq, q.quote_memo, q.valid_until,
             q.order_id, q.created_at, q.updated_at,
             p.name AS product_name
      FROM wholesale_quotes q
      LEFT JOIN products p ON p.id = q.product_id
      WHERE q.distributor_seller_id = ?
      ORDER BY q.created_at DESC LIMIT 200
    `).bind(sellerId).all()
    // valid_until 경과 + 미수락이면 응답에서 expired 파생 표시 (저장 상태 불변 — 후속 cron 전환 대상).
    const now = new Date().toISOString().slice(0, 10)
    const quotes = (results || []).map((r: any) => {
      const expired = r.status === 'quoted' && r.valid_until && String(r.valid_until).slice(0, 10) < now
      return { ...r, effective_status: expired ? 'expired' : r.status }
    })
    return c.json({ success: true, quotes })
  } catch (err) {
    return safeError(c, err, '견적 조회 중 오류가 발생했습니다', '[wholesale-quotes]')
  }
})

// POST /quotes/:id/accept — 유통회원이 회신된 견적(quoted) 수락 → accepted
app.post('/quotes/:id/accept', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureWholesaleQuotesSchema(DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
    // 소유권 검증 + quoted 상태만 수락 가능 (CAS).
    const row = await DB.prepare(
      'SELECT id, distributor_seller_id, status, title, valid_until FROM wholesale_quotes WHERE id = ?'
    ).bind(id).first<{ id: number; distributor_seller_id: number; status: string; title: string; valid_until: string | null }>()
    if (!row) return c.json({ success: false, error: '견적을 찾을 수 없습니다' }, 404)
    if (row.distributor_seller_id !== sellerId) return c.json({ success: false, error: '권한이 없습니다' }, 403)
    if (row.status !== 'quoted') return c.json({ success: false, error: '회신된 견적만 수락할 수 있습니다' }, 409)
    const today = new Date().toISOString().slice(0, 10)
    if (row.valid_until && String(row.valid_until).slice(0, 10) < today) {
      return c.json({ success: false, error: '견적 유효기간이 지났습니다' }, 409)
    }
    const res = await DB.prepare(
      "UPDATE wholesale_quotes SET status='accepted', updated_at=datetime('now') WHERE id = ? AND status='quoted'"
    ).bind(id).run()
    if (!res.meta.changes) return c.json({ success: false, error: '이미 처리된 견적입니다' }, 409)

    // 운영자에게 수락 알림 — 운영자가 기존 발주 흐름으로 주문 생성 (v1: 자동전환 X).
    await createDashboardNotification(
      DB, 'admin', null, 'wholesale_quote_accepted',
      '견적 수락됨 — 발주 생성 필요', `${row.title}`, '/admin/wholesale-quotes',
    ).catch(() => {})

    return c.json({ success: true, message: '견적을 수락했습니다. 운영자가 발주를 진행합니다.' })
  } catch (err) {
    return safeError(c, err, '견적 수락 중 오류가 발생했습니다', '[wholesale-quotes]')
  }
})

// POST /quotes/:id/reject — 유통회원이 견적 반려 → rejected
app.post('/quotes/:id/reject', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureWholesaleQuotesSchema(DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
    const row = await DB.prepare(
      'SELECT id, distributor_seller_id, status, title FROM wholesale_quotes WHERE id = ?'
    ).bind(id).first<{ id: number; distributor_seller_id: number; status: string; title: string }>()
    if (!row) return c.json({ success: false, error: '견적을 찾을 수 없습니다' }, 404)
    if (row.distributor_seller_id !== sellerId) return c.json({ success: false, error: '권한이 없습니다' }, 403)
    // requested(미회신) 또는 quoted(회신됨) 상태에서만 반려 가능.
    if (row.status !== 'quoted' && row.status !== 'requested') {
      return c.json({ success: false, error: '반려할 수 없는 상태입니다' }, 409)
    }
    const res = await DB.prepare(
      "UPDATE wholesale_quotes SET status='rejected', updated_at=datetime('now') WHERE id = ? AND status IN ('quoted','requested')"
    ).bind(id).run()
    if (!res.meta.changes) return c.json({ success: false, error: '이미 처리된 견적입니다' }, 409)

    await createDashboardNotification(
      DB, 'admin', null, 'wholesale_quote_rejected',
      '견적 반려됨', `${row.title}`, '/admin/wholesale-quotes',
    ).catch(() => {})

    return c.json({ success: true, message: '견적을 반려했습니다.' })
  } catch (err) {
    return safeError(c, err, '견적 반려 중 오류가 발생했습니다', '[wholesale-quotes]')
  }
})

// ════════════════════════════════════════════════════════════════════════════
//  어드민/운영자 견적 엔드포인트 — requireAdmin + 감사로그 (distributor-admin.routes 체인 미러)
//  마운트 경로: /api/wholesale/admin/quotes*
// ════════════════════════════════════════════════════════════════════════════
const admin = new Hono<{ Bindings: Env }>()
// adminIpWhitelist 는 ADMIN_IP_WHITELIST 미설정 시 fail-open(전체 허용) — 잠김 위험 없음.
admin.use('*', adminIpWhitelist())
admin.use('*', requireAdmin())
admin.use('*', adminAuditMiddleware())

// GET /admin/quotes?status=&distributor_seller_id= — 견적 목록/필터
admin.get('/quotes', async (c) => {
  try {
    await ensureWholesaleQuotesSchema(c.env.DB)
    const status = normalizeQuoteStatus(c.req.query('status'))
    const distId = intOrNull(c.req.query('distributor_seller_id'), 1)
    const binds: unknown[] = []
    let where = '1=1'
    if (status) { where += ' AND q.status = ?'; binds.push(status) }
    if (distId !== null) { where += ' AND q.distributor_seller_id = ?'; binds.push(distId) }
    const { results } = await c.env.DB.prepare(`
      SELECT q.id, q.distributor_seller_id, q.supplier_id, q.product_id, q.title, q.request_text,
             q.requested_qty, q.target_unit_price, q.status, q.quoted_unit_price, q.quoted_moq,
             q.quote_memo, q.valid_until, q.order_id, q.created_at, q.updated_at,
             s.business_name AS distributor_business_name, s.name AS distributor_name, s.username AS distributor_username,
             p.name AS product_name,
             sup.business_name AS supplier_name
      FROM wholesale_quotes q
      LEFT JOIN sellers s ON s.id = q.distributor_seller_id
      LEFT JOIN products p ON p.id = q.product_id
      LEFT JOIN suppliers sup ON sup.id = q.supplier_id
      WHERE ${where}
      ORDER BY q.created_at DESC LIMIT 300
    `).bind(...binds).all()
    return c.json({ success: true, quotes: results ?? [] })
  } catch (err) {
    return safeError(c, err, '견적 조회 중 오류가 발생했습니다', '[wholesale-quotes-admin]')
  }
})

// PATCH /admin/quotes/:id/respond — 운영자 견적 회신 (단가/MOQ/유효기간/메모) → status='quoted'
admin.patch('/quotes/:id/respond', async (c) => {
  try {
    await ensureWholesaleQuotesSchema(c.env.DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))

    const quotedUnitPrice = intOrNull(body.quoted_unit_price, 0)
    if (quotedUnitPrice === null || quotedUnitPrice <= 0) {
      return c.json({ success: false, error: '회신 단가(quoted_unit_price)를 입력해주세요' }, 400)
    }
    const quotedMoq = intOrNull(body.quoted_moq, 1)
    const quoteMemo = body.quote_memo ? String(body.quote_memo).slice(0, 2000) : null
    let validUntil: string | null = null
    if (body.valid_until != null && String(body.valid_until).trim() !== '') {
      const v = String(body.valid_until).trim().slice(0, 10)
      // YYYY-MM-DD 형식 검증.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
        return c.json({ success: false, error: '유효기간 형식이 올바르지 않습니다 (YYYY-MM-DD)' }, 400)
      }
      validUntil = v
    }

    const row = await c.env.DB.prepare(
      'SELECT id, distributor_seller_id, status, title FROM wholesale_quotes WHERE id = ?'
    ).bind(id).first<{ id: number; distributor_seller_id: number; status: string; title: string }>()
    if (!row) return c.json({ success: false, error: '견적을 찾을 수 없습니다' }, 404)
    // 이미 수락/전환/반려된 견적은 회신 불가 (requested/quoted/expired 만 재회신 허용).
    if (!['requested', 'quoted', 'expired'].includes(row.status)) {
      return c.json({ success: false, error: '이미 처리된 견적은 회신할 수 없습니다' }, 409)
    }

    const res = await c.env.DB.prepare(
      `UPDATE wholesale_quotes
         SET quoted_unit_price = ?, quoted_moq = ?, quote_memo = ?, valid_until = ?,
             status = 'quoted', updated_at = datetime('now')
       WHERE id = ?`
    ).bind(quotedUnitPrice, quotedMoq, quoteMemo, validUntil, id).run()
    if (!res.meta.changes) return c.json({ success: false, error: '견적을 찾을 수 없습니다' }, 404)

    // 유통회원에게 견적 회신 알림.
    await createDashboardNotification(
      c.env.DB, 'seller', String(row.distributor_seller_id), 'wholesale_quote_quoted',
      '견적이 회신되었습니다', `${row.title} — 단가 ₩${quotedUnitPrice.toLocaleString('ko-KR')}`, '/wholesale/quotes',
    ).catch(() => {})

    await writeAuditLog(c, {
      action: 'wholesale_quote_respond',
      targetType: 'wholesale_quote',
      targetId: String(id),
      before: { status: row.status },
      after: { status: 'quoted', quoted_unit_price: quotedUnitPrice, quoted_moq: quotedMoq, valid_until: validUntil },
    }).catch(() => { /* audit 실패해도 성공 처리 */ })

    return c.json({ success: true, message: '견적을 회신했습니다.' })
  } catch (err) {
    return safeError(c, err, '견적 회신 중 오류가 발생했습니다', '[wholesale-quotes-admin]')
  }
})

app.route('/admin', admin)

export { app as wholesaleQuotesRoutes }
