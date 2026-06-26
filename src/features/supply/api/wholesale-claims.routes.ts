/**
 * 🏭 BIZ-1 (2026-06-08) 유통스타트 도매몰 — 판매사(바이어) 발의 CLAIM / RMA(반품·하자신고).
 *
 * 배경: 기존엔 공급자/어드민만 환불 가능 → 판매사(도매 바이어)는 하자/오배송/수량부족을
 *   신고할 창구가 없었음. 이 라우터가 판매사 발의 클레임 접수 + 어드민 검수 워크플로를 제공.
 *
 * 실제 환불 집행은 *중복 구현하지 않고* 기존 어드민 환불 엔드포인트
 *   POST /api/admin/distributor/orders/:id/refund 를 그대로 사용한다(approve 결정만 기록).
 *
 * 정산 HOLD 연동: 클레임 open 시 해당 도매주문(source='wholesale')의 미지급 정산 row 에
 *   held_at=now 를 찍어 성숙(matureSupplierSettlements)에서 제외 → 분쟁 중 공급자 지급을 보류.
 *   reject/resolve(무환불) 시 held_at 을 NULL 로 풀어 정상 성숙 재개. approve 는 hold 유지(어드민이
 *   환불 집행 후 wholesale-settlement 역전이 정산을 정리).
 *
 * 마운트: app.route('/api/wholesale', wholesaleClaimsRoutes)  ← 오케스트레이터가 처리.
 *   ⚠️ 경로는 wholesale.routes.ts 와 동일 prefix(/api/wholesale) 에 합쳐지므로 충돌 없는 path 사용:
 *      - POST  /api/wholesale/claims               (판매사 발의)
 *      - GET   /api/wholesale/claims               (판매사 본인 목록)
 *      - GET   /api/wholesale/admin/claims         (어드민 목록 + status 필터)
 *      - PATCH /api/wholesale/admin/claims/:id     (어드민 검수)
 */
import { Hono } from 'hono'
import { sanitizeString } from '@/worker/utils/validation'
import { isViewerToken } from './sub-account-gate'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { requireAdmin } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { swallow } from '@/worker/utils/swallow'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'

const app = new Hono<{ Bindings: Env }>()

// ── 클레임 사유 코드 (RMA 표준) ────────────────────────────────────────────────
export const CLAIM_REASON_CODES = ['defective', 'wrong_item', 'damaged', 'shortage', 'other'] as const
export type ClaimReasonCode = (typeof CLAIM_REASON_CODES)[number]

// ── 상태 머신 ────────────────────────────────────────────────────────────────
//   open → reviewing → (approved | rejected | resolved)
//   approved: 어드민이 환불 집행 결정(정산 hold 유지). rejected: 반려(hold 해제).
//   resolved: 환불 없이 해결(교환/재발송 등 — hold 해제).
const CLAIM_STATUSES = ['open', 'reviewing', 'approved', 'rejected', 'resolved'] as const
type ClaimStatus = (typeof CLAIM_STATUSES)[number]

// 어드민 action → 목표 status + hold 정책.
const ACTION_MAP: Record<string, { status: ClaimStatus; clearHold: boolean; terminal: boolean }> = {
  reviewing: { status: 'reviewing', clearHold: false, terminal: false },
  approve:   { status: 'approved',  clearHold: false, terminal: true  }, // hold 유지 — 어드민이 별도 환불 집행
  reject:    { status: 'rejected',  clearHold: true,  terminal: true  }, // hold 해제 — 정상 성숙 재개
  resolve:   { status: 'resolved',  clearHold: true,  terminal: true  }, // 무환불 해결 — hold 해제
}

// ── 멱등 ensure (supply-visibility.ts WeakMap-promise 패턴) ────────────────────
//   완료된 ensure 만 promise 로 캐시. 실패 시 캐시 제거(다음 호출 재시도) → 컬럼 없는 채 영구통과 방지.
const _ensuring = new WeakMap<object, Promise<void>>()

export async function ensureWholesaleClaimsSchema(DB: D1Database): Promise<void> {
  const existing = _ensuring.get(DB)
  if (existing) return existing
  const p = _doEnsure(DB)
  _ensuring.set(DB, p)
  try {
    await p
  } catch {
    _ensuring.delete(DB) // 실패 시 다음 호출이 재시도
  }
}

async function _doEnsure(DB: D1Database): Promise<void> {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wholesale_order_id INTEGER NOT NULL,
    wholesale_order_item_id INTEGER,
    distributor_seller_id INTEGER NOT NULL,
    supplier_id INTEGER,
    reason_code TEXT NOT NULL,
    reason_text TEXT,
    evidence_url TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    admin_memo TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now')),
    resolved_at DATETIME
  )`).run().catch(swallow('wh-claims:create-table'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wh_claims_distributor ON wholesale_claims(distributor_seller_id, created_at DESC)').run().catch(swallow('wh-claims:idx-dist'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wh_claims_supplier ON wholesale_claims(supplier_id)').run().catch(swallow('wh-claims:idx-sup'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wh_claims_status ON wholesale_claims(status, created_at DESC)').run().catch(swallow('wh-claims:idx-status'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wh_claims_order ON wholesale_claims(wholesale_order_id)').run().catch(swallow('wh-claims:idx-order'))

  // 정산 HOLD 컬럼 (additive) — supplier_settlements.held_at. ALTER 는 존재 시 무시.
  await DB.prepare("ALTER TABLE supplier_settlements ADD COLUMN held_at DATETIME").run().catch(() => { /* 이미 존재 — 무시 */ })
}

// ── 판매사(셀러) JWT → seller_id ──────────────────────────────────────────────
//   wholesale.routes.ts 와 동일하게 seller_token Bearer JWT 의 seller_id 를 신뢰.
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

// ── 정산 HOLD 헬퍼 ─────────────────────────────────────────────────────────────
/** 도매주문의 미지급(wholesale, pending/available) 정산에 held_at 설정 — 분쟁 중 지급 보류. */
async function holdSettlements(DB: D1Database, wholesaleOrderId: number): Promise<number> {
  const r = await DB.prepare(
    "UPDATE supplier_settlements SET held_at = datetime('now') WHERE order_id = ? AND source = 'wholesale' AND status IN ('pending','available') AND held_at IS NULL"
  ).bind(wholesaleOrderId).run().catch(() => null)
  return r?.meta?.changes ?? 0
}

/** 도매주문의 hold 해제 — held_at NULL 로 되돌려 정상 성숙 재개. */
async function releaseHold(DB: D1Database, wholesaleOrderId: number): Promise<number> {
  const r = await DB.prepare(
    "UPDATE supplier_settlements SET held_at = NULL WHERE order_id = ? AND source = 'wholesale' AND held_at IS NOT NULL"
  ).bind(wholesaleOrderId).run().catch(() => null)
  return r?.meta?.changes ?? 0
}

// ── POST /claims — 판매사 발의 ─────────────────────────────────────────────────
app.post('/claims', rateLimit({ action: 'wholesale-claim', max: 20, windowSec: 600 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  // 🛡️ 감사 🟡#5: 조회 전용(viewer) 직원 계정은 클레임 생성 불가.
  if (await isViewerToken(c.req.header('Authorization'), c.env.JWT_SECRET)) {
    return c.json({ success: false, error: '조회 전용 직원 계정은 이 작업을 할 수 없습니다' }, 403)
  }
  const { DB } = c.env
  try {
    await ensureWholesaleClaimsSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))

    const wholesaleOrderId = Number(body.wholesale_order_id)
    const reasonCode = String(body.reason_code || '').trim()
    const reasonText = sanitizeString(String(body.reason_text || '')).trim().slice(0, 1000)
    const evidenceUrl = String(body.evidence_url || '').trim().slice(0, 500)
    const rawItemId = body.wholesale_order_item_id
    const itemId = rawItemId == null || rawItemId === '' ? null : Number(rawItemId)

    if (!Number.isFinite(wholesaleOrderId) || wholesaleOrderId <= 0) {
      return c.json({ success: false, error: '주문 정보가 올바르지 않습니다' }, 400)
    }
    if (!(CLAIM_REASON_CODES as readonly string[]).includes(reasonCode)) {
      return c.json({ success: false, error: '클레임 사유를 선택해주세요' }, 400)
    }
    if (itemId != null && (!Number.isFinite(itemId) || itemId <= 0)) {
      return c.json({ success: false, error: '주문 항목 정보가 올바르지 않습니다' }, 400)
    }
    // evidence_url 은 선택값이지만 들어오면 http(s) 만 허용(스킴 인젝션 차단).
    if (evidenceUrl && !/^https?:\/\//i.test(evidenceUrl)) {
      return c.json({ success: false, error: '증빙 URL 형식이 올바르지 않습니다' }, 400)
    }

    // 소유권 검증 — 이 주문이 인증된 판매사 본인 것인지(IDOR 방지).
    const order = await DB.prepare(
      'SELECT id, status FROM wholesale_orders WHERE id = ? AND distributor_seller_id = ?'
    ).bind(wholesaleOrderId, sellerId).first<{ id: number; status: string }>().catch(() => null)
    if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
    // 결제된(또는 그 이후) 주문만 클레임 가능 — 미결제/만료/이미환불완료엔 의미 없음.
    if (!['PAID', 'SHIPPED', 'PARTIAL_REFUNDED', 'DONE'].includes(order.status)) {
      return c.json({ success: false, error: '클레임을 제기할 수 없는 주문 상태입니다' }, 400)
    }

    // 항목 검증 + supplier_id 해석. 항목 지정 시 그 항목이 이 주문 소속인지 확인.
    let supplierId: number | null = null
    if (itemId != null) {
      const item = await DB.prepare(
        'SELECT id, supplier_id FROM wholesale_order_items WHERE id = ? AND wholesale_order_id = ?'
      ).bind(itemId, wholesaleOrderId).first<{ id: number; supplier_id: number | null }>().catch(() => null)
      if (!item) return c.json({ success: false, error: '주문 항목을 찾을 수 없습니다' }, 404)
      supplierId = item.supplier_id ?? null
    } else {
      // 항목 미지정(주문 전체) — 단일 공급자 주문이면 supplier 해석, 복수면 null(어드민이 검수).
      const sup = await DB.prepare(
        "SELECT supplier_id, COUNT(DISTINCT supplier_id) AS cnt FROM wholesale_order_items WHERE wholesale_order_id = ? AND supplier_id IS NOT NULL"
      ).bind(wholesaleOrderId).first<{ supplier_id: number | null; cnt: number }>().catch(() => null)
      if (sup && Number(sup.cnt) === 1) supplierId = sup.supplier_id ?? null
    }

    // 🛡️ 2026-06-25 (전수조사): 같은 주문(+라인)에 이미 처리중(open/reviewing) 클레임이 있으면 중복접수 차단 —
    //   기존엔 존재검사 0 이라 재제출마다 새 open 클레임 + holdSettlements + 어드민 알림 반복(큐 스팸·반복 보류).
    //   (완전 race-proof 는 partial UNIQUE 필요 — TECHNICAL_DEBT 기록. 이 체크가 재제출=지배적 케이스 차단.)
    const activeClaim = await DB.prepare(
      "SELECT id FROM wholesale_claims WHERE wholesale_order_id = ? AND COALESCE(wholesale_order_item_id, 0) = COALESCE(?, 0) AND distributor_seller_id = ? AND status IN ('open','reviewing') LIMIT 1"
    ).bind(wholesaleOrderId, itemId, sellerId).first<{ id: number }>().catch(() => null)
    if (activeClaim) return c.json({ success: true, claim_id: activeClaim.id, already: true })

    const ins = await DB.prepare(`
      INSERT INTO wholesale_claims
        (wholesale_order_id, wholesale_order_item_id, distributor_seller_id, supplier_id, reason_code, reason_text, evidence_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open')
    `).bind(wholesaleOrderId, itemId, sellerId, supplierId, reasonCode, reasonText || null, evidenceUrl || null).run()
    const claimId = Number(ins.meta?.last_row_id)
    if (!claimId) return c.json({ success: false, error: '클레임 접수 중 오류가 발생했습니다' }, 500)

    // 정산 HOLD — 분쟁 중 공급자 지급 보류 (성숙 cron 이 held_at IS NOT NULL 스킵).
    const held = await holdSettlements(DB, wholesaleOrderId)

    // 어드민 검수 큐 알림.
    createDashboardNotification(
      DB, 'admin', null, 'wholesale_claim_opened', '도매 클레임 접수',
      `주문 #${wholesaleOrderId} · 사유 ${reasonCode}${held > 0 ? ` (정산 ${held}건 보류)` : ''}`,
      '/admin/wholesale-claims',
    ).catch(swallow('wh-claims:notify-admin'))

    return c.json({ success: true, claim_id: claimId, status: 'open', held_settlements: held })
  } catch (err) {
    return safeError(c, err, '클레임 접수 중 오류가 발생했습니다', '[wholesale-claims]')
  }
})

// ── GET /claims — 판매사 본인 클레임 목록 ──────────────────────────────────────
app.get('/claims', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureWholesaleClaimsSchema(DB)
    const { results } = await DB.prepare(`
      SELECT id, wholesale_order_id, wholesale_order_item_id, supplier_id, reason_code, reason_text,
             evidence_url, status, admin_memo, created_at, updated_at, resolved_at
      FROM wholesale_claims WHERE distributor_seller_id = ?
      ORDER BY created_at DESC LIMIT 100
    `).bind(sellerId).all()
    return c.json({ success: true, claims: results ?? [] })
  } catch (err) {
    return safeError(c, err, '클레임 조회 중 오류가 발생했습니다', '[wholesale-claims]')
  }
})

// ── GET /admin/claims — 어드민 목록 (status 필터) ──────────────────────────────
app.get('/admin/claims', requireAdmin(), async (c) => {
  const { DB } = c.env
  try {
    await ensureWholesaleClaimsSchema(DB)
    const status = c.req.query('status') || ''
    const where = status && (CLAIM_STATUSES as readonly string[]).includes(status) ? 'WHERE wc.status = ?' : ''
    const binds = where ? [status] : []
    // 판매사/공급자 식별 정보를 조인(라이트 표기용). 공급자 신원은 어드민에만 노출(OK).
    const { results } = await DB.prepare(`
      SELECT wc.id, wc.wholesale_order_id, wc.wholesale_order_item_id, wc.distributor_seller_id, wc.supplier_id,
             wc.reason_code, wc.reason_text, wc.evidence_url, wc.status, wc.admin_memo,
             wc.created_at, wc.updated_at, wc.resolved_at,
             s.business_name AS distributor_name, s.username AS distributor_username,
             sup.business_name AS supplier_name,
             o.subtotal AS order_subtotal, o.refunded_amount AS order_refunded, o.status AS order_status
      FROM wholesale_claims wc
      LEFT JOIN sellers s ON s.id = wc.distributor_seller_id
      LEFT JOIN suppliers sup ON sup.id = wc.supplier_id
      LEFT JOIN wholesale_orders o ON o.id = wc.wholesale_order_id
      ${where}
      ORDER BY CASE wc.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, wc.created_at DESC
      LIMIT 200
    `).bind(...binds).all()
    return c.json({ success: true, claims: results ?? [] })
  } catch (err) {
    return safeError(c, err, '클레임 목록 조회 중 오류가 발생했습니다', '[wholesale-claims]')
  }
})

// ── PATCH /admin/claims/:id — 어드민 검수 ──────────────────────────────────────
app.patch('/admin/claims/:id', requireAdmin(), rateLimit({ action: 'admin-wholesale-claim', max: 60, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 클레임 ID' }, 400)
  try {
    await ensureWholesaleClaimsSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const action = String(body.action || '').trim()
    const adminMemo = String(body.admin_memo || '').trim().slice(0, 1000)
    const map = ACTION_MAP[action]
    if (!map) return c.json({ success: false, error: '잘못된 처리 동작입니다' }, 400)

    const claim = await DB.prepare(
      'SELECT id, wholesale_order_id, distributor_seller_id, supplier_id, status FROM wholesale_claims WHERE id = ?'
    ).bind(id).first<{ id: number; wholesale_order_id: number; distributor_seller_id: number; supplier_id: number | null; status: string }>().catch(() => null)
    if (!claim) return c.json({ success: false, error: '클레임을 찾을 수 없습니다' }, 404)
    // 종결 상태(approved/rejected/resolved)에서는 재전이 금지.
    if (['approved', 'rejected', 'resolved'].includes(claim.status)) {
      return c.json({ success: false, error: '이미 종결된 클레임입니다' }, 409)
    }
    // open 에서 바로 종결 가능(reviewing 경유는 선택). reviewing→reviewing 멱등은 차단(no-op).
    if (action === 'reviewing' && claim.status === 'reviewing') {
      return c.json({ success: true, claim_id: id, status: 'reviewing', already: true })
    }

    // CAS — 현재 status 가 기대값일 때만 전환(동시 검수 중복 차단). open|reviewing 에서만 전환.
    const setResolvedAt = map.terminal ? ", resolved_at = datetime('now')" : ''
    const upd = await DB.prepare(
      `UPDATE wholesale_claims SET status = ?, admin_memo = COALESCE(NULLIF(?, ''), admin_memo), updated_at = datetime('now')${setResolvedAt}
       WHERE id = ? AND status IN ('open','reviewing')`
    ).bind(map.status, adminMemo, id).run()
    if ((upd.meta?.changes ?? 0) === 0) {
      return c.json({ success: false, error: '클레임 상태를 변경할 수 없습니다' }, 409)
    }

    // HOLD 정책 — reject/resolve(무환불) 시 해제, approve 시 유지(환불 집행이 정산 정리).
    let released = 0
    if (map.clearHold) released = await releaseHold(DB, claim.wholesale_order_id)

    // 감사 로그 (admin_audit_logs) — admin-security writeAuditLog 직접 호출.
    try {
      const { writeAuditLog } = await import('../../../worker/middleware/admin-security')
      await writeAuditLog(c, {
        action: `wholesale_claim_${map.status}`, targetType: 'wholesale_claim', targetId: id,
        before: { status: claim.status }, after: { status: map.status, released_hold: released, memo: adminMemo || null },
      })
    } catch { /* audit best-effort */ }

    // 알림 — 판매사(seller) 에 결과 통지. approve 면 공급자에도 환불 예정 통지.
    const REASON_LABEL: Record<ClaimStatus, string> = {
      open: '접수', reviewing: '검토 중', approved: '승인(환불 예정)', rejected: '반려', resolved: '해결',
    }
    createDashboardNotification(
      DB, 'seller', String(claim.distributor_seller_id), 'wholesale_claim_update',
      `도매 클레임 ${REASON_LABEL[map.status]}`,
      `주문 #${claim.wholesale_order_id} 클레임이 ${REASON_LABEL[map.status]} 처리되었습니다.${adminMemo ? ` 메모: ${adminMemo}` : ''}`,
      '/wholesale/orders',
    ).catch(swallow('wh-claims:notify-seller'))
    if (map.status === 'approved' && claim.supplier_id) {
      createDashboardNotification(
        DB, 'supplier', String(claim.supplier_id), 'wholesale_claim_approved',
        '도매 클레임 승인', `주문 #${claim.wholesale_order_id} 클레임이 승인되어 환불이 진행됩니다.`,
        '/supplier/wholesale-orders',
      ).catch(swallow('wh-claims:notify-supplier'))
    }

    return c.json({
      success: true, claim_id: id, status: map.status, released_hold: released,
      // approve 는 별도 환불 집행 필요 — 어드민 UI 가 환불 엔드포인트를 호출하도록 힌트.
      requires_refund: map.status === 'approved',
      refund_endpoint: map.status === 'approved' ? `/api/admin/distributor/orders/${claim.wholesale_order_id}/refund` : undefined,
    })
  } catch (err) {
    return safeError(c, err, '클레임 처리 중 오류가 발생했습니다', '[wholesale-claims]')
  }
})

export { app as wholesaleClaimsRoutes }
