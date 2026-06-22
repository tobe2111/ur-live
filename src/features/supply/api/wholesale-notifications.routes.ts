/**
 * 🏭 NOTI-1 (2026-06-08) 유통스타트 도매몰 — (a) 품절/재입고 알림 + (b) 주문별 메모 스레드.
 *
 * 배경:
 *  (a) 품절 상품을 사입하려던 유통사가 "재입고되면 알려주세요" 를 신청할 창구가 없었음.
 *      → wholesale_restock_subscriptions 에 (유통사, 상품) 구독을 기록. 실제 재입고 감지/통지는
 *        cron(`wholesale-restock-notify.ts`)이 담당(재고 갱신 site 를 hooking 하지 않음 — 결합도 ↓).
 *  (b) 도매주문에 대해 유통사 ↔ 공급자 ↔ 어드민이 소통할 스레드가 없었음(클레임은 RMA 전용).
 *      → wholesale_order_notes 에 주문별 메모를 누적. 작성/조회 시 주문 당사자(유통사 owner OR
 *        해당 주문에 라인이 있는 공급자)만 허용(IDOR 방지). 작성 시 상대 당사자에 대시보드 알림.
 *
 * 마운트: app.route('/api/wholesale', wholesaleNotificationsRoutes)  ← 오케스트레이터(worker/index.ts)가 처리.
 *   ⚠️ 경로는 wholesale.routes.ts / wholesale-claims.routes.ts 와 동일 prefix(/api/wholesale)에 합쳐지므로
 *      충돌 없는 path 사용:
 *      - POST   /api/wholesale/restock/subscribe          (유통사: 품절 상품 재입고 구독)
 *      - GET    /api/wholesale/restock/subscriptions      (유통사 본인 구독 목록)
 *      - DELETE /api/wholesale/restock/subscribe/:productId (구독 해제)
 *      - GET    /api/wholesale/orders/:id/notes            (주문 당사자: 메모 스레드 조회)
 *      - POST   /api/wholesale/orders/:id/notes            (주문 당사자: 메모 작성)
 *
 * 잠금 파일(worker/index.ts·scheduled.ts·repair-schema·settlement·wholesale.routes 등)은 미수정.
 * 스키마는 self-ensure(멱등) — repair-schema 등록은 리포트에 명시(후속 PR).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { swallow } from '@/worker/utils/swallow'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'

const app = new Hono<{ Bindings: Env }>()

// ── 멱등 ensure (wholesale-claims.ts WeakMap-promise 패턴) ──────────────────────
//   완료된 ensure 만 promise 로 캐시. 실패 시 캐시 제거(다음 호출 재시도).
const _ensuring = new WeakMap<object, Promise<void>>()

export async function ensureWholesaleNotificationsSchema(DB: D1Database): Promise<void> {
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
  // (a) 재입고 구독 — (유통사, 상품) 1:1. notified_at 채워지면 cron 이 통지 완료 처리.
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_restock_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_seller_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    notified_at DATETIME,
    UNIQUE(distributor_seller_id, product_id)
  )`).run().catch(swallow('wh-noti:create-restock'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wh_restock_distributor ON wholesale_restock_subscriptions(distributor_seller_id, created_at DESC)').run().catch(swallow('wh-noti:idx-restock-dist'))
  // cron 스캔(미통지 구독 → 재고>0 상품 조인)용 — product_id 선두 + notified_at NULL 필터.
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wh_restock_pending ON wholesale_restock_subscriptions(product_id, notified_at)').run().catch(swallow('wh-noti:idx-restock-pending'))

  // (b) 주문별 메모 스레드 — author_type: distributor|supplier|admin.
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_order_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wholesale_order_id INTEGER NOT NULL,
    author_type TEXT NOT NULL,
    author_id INTEGER,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('wh-noti:create-notes'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wh_order_notes_order ON wholesale_order_notes(wholesale_order_id, created_at)').run().catch(swallow('wh-noti:idx-notes-order'))
}

// ── 유통사/공급자(셀러 계열) JWT → seller_id ───────────────────────────────────
//   wholesale.routes.ts / wholesale-claims.routes.ts 와 동일하게 Bearer JWT 의 seller_id 신뢰.
//   (유통사·공급자 모두 seller_token 계열 — author_type 은 주문 당사자 판정으로 도출.)
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

const MAX_NOTE_LEN = 1000

// ════════════════════════════════════════════════════════════════════════════
//  (a) 재입고 알림
// ════════════════════════════════════════════════════════════════════════════

// ── POST /restock/subscribe — 품절 상품 재입고 구독 ────────────────────────────
app.post('/restock/subscribe', rateLimit({ action: 'wholesale-restock-sub', max: 40, windowSec: 600 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureWholesaleNotificationsSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const productId = Number(body.product_id)
    if (!Number.isFinite(productId) || productId <= 0) {
      return c.json({ success: false, error: '상품 정보가 올바르지 않습니다' }, 400)
    }

    // 품절(stock<=0)인 상품에만 구독 허용 — 재고 있는 상품은 바로 주문하면 됨.
    const prod = await DB.prepare('SELECT id, COALESCE(stock,0) AS stock FROM products WHERE id = ?')
      .bind(productId).first<{ id: number; stock: number }>().catch(() => null)
    if (!prod) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)
    if (Number(prod.stock) > 0) {
      return c.json({ success: false, error: '재고가 있는 상품이에요. 바로 주문할 수 있어요' }, 400)
    }

    // upsert — 이미 구독(미통지)이면 멱등, 이전에 통지됐으면 notified_at 리셋(재구독).
    await DB.prepare(`
      INSERT INTO wholesale_restock_subscriptions (distributor_seller_id, product_id, created_at, notified_at)
      VALUES (?, ?, datetime('now'), NULL)
      ON CONFLICT(distributor_seller_id, product_id)
      DO UPDATE SET created_at = datetime('now'), notified_at = NULL
    `).bind(sellerId, productId).run()

    return c.json({ success: true, subscribed: true })
  } catch (err) {
    return safeError(c, err, '재입고 알림 신청 중 오류가 발생했습니다', '[wholesale-noti]')
  }
})

// ── GET /restock/subscriptions — 본인 구독 목록 ────────────────────────────────
app.get('/restock/subscriptions', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureWholesaleNotificationsSchema(DB)
    const { results } = await DB.prepare(`
      SELECT s.product_id, s.created_at, s.notified_at,
             p.name AS product_name, p.image_url, COALESCE(p.stock,0) AS stock
      FROM wholesale_restock_subscriptions s
      LEFT JOIN products p ON p.id = s.product_id
      WHERE s.distributor_seller_id = ?
      ORDER BY s.created_at DESC LIMIT 200
    `).bind(sellerId).all()
    return c.json({ success: true, subscriptions: results ?? [] })
  } catch (err) {
    return safeError(c, err, '재입고 알림 목록 조회 중 오류가 발생했습니다', '[wholesale-noti]')
  }
})

// ── DELETE /restock/subscribe/:productId — 구독 해제 ───────────────────────────
app.delete('/restock/subscribe/:productId', rateLimit({ action: 'wholesale-restock-unsub', max: 60, windowSec: 600 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const productId = Number(c.req.param('productId'))
  if (!Number.isFinite(productId) || productId <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
  try {
    await ensureWholesaleNotificationsSchema(DB)
    await DB.prepare('DELETE FROM wholesale_restock_subscriptions WHERE distributor_seller_id = ? AND product_id = ?')
      .bind(sellerId, productId).run()
    return c.json({ success: true, subscribed: false })
  } catch (err) {
    return safeError(c, err, '재입고 알림 해제 중 오류가 발생했습니다', '[wholesale-noti]')
  }
})

// ════════════════════════════════════════════════════════════════════════════
//  (b) 주문별 메모 스레드
// ════════════════════════════════════════════════════════════════════════════

// 주문 당사자 판정 — 인증된 seller_id 가 이 주문의 유통사 owner 인지, 또는 라인을 가진 공급자인지.
//   반환: { type: 'distributor'|'supplier', supplierId?, distributorId } | null(당사자 아님).
async function resolveParty(
  DB: D1Database, wholesaleOrderId: number, sellerId: number,
): Promise<{ type: 'distributor' | 'supplier'; distributorId: number; supplierId?: number } | null> {
  const order = await DB.prepare('SELECT id, distributor_seller_id FROM wholesale_orders WHERE id = ?')
    .bind(wholesaleOrderId).first<{ id: number; distributor_seller_id: number }>().catch(() => null)
  if (!order) return null
  if (Number(order.distributor_seller_id) === sellerId) {
    return { type: 'distributor', distributorId: Number(order.distributor_seller_id) }
  }
  // 공급자 당사자 — 이 주문에 sellerId 의 공급 라인이 있는지(supplier_id 매칭).
  const line = await DB.prepare(
    'SELECT 1 AS ok FROM wholesale_order_items WHERE wholesale_order_id = ? AND supplier_id = ? LIMIT 1'
  ).bind(wholesaleOrderId, sellerId).first<{ ok: number }>().catch(() => null)
  if (line) {
    return { type: 'supplier', distributorId: Number(order.distributor_seller_id), supplierId: sellerId }
  }
  return null
}

// ── GET /orders/:id/notes — 주문 메모 스레드 조회 ──────────────────────────────
app.get('/orders/:id/notes', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const orderId = Number(c.req.param('id'))
  if (!Number.isFinite(orderId) || orderId <= 0) return c.json({ success: false, error: '잘못된 주문 ID' }, 400)
  try {
    await ensureWholesaleNotificationsSchema(DB)
    const party = await resolveParty(DB, orderId, sellerId)
    if (!party) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)

    const { results } = await DB.prepare(`
      SELECT id, author_type, author_id, body, created_at
      FROM wholesale_order_notes WHERE wholesale_order_id = ?
      ORDER BY created_at ASC, id ASC LIMIT 200
    `).bind(orderId).all()
    return c.json({ success: true, my_role: party.type, notes: results ?? [] })
  } catch (err) {
    return safeError(c, err, '메모 조회 중 오류가 발생했습니다', '[wholesale-noti]')
  }
})

// ── POST /orders/:id/notes — 주문 메모 작성 ────────────────────────────────────
app.post('/orders/:id/notes', rateLimit({ action: 'wholesale-order-note', max: 60, windowSec: 600 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const orderId = Number(c.req.param('id'))
  if (!Number.isFinite(orderId) || orderId <= 0) return c.json({ success: false, error: '잘못된 주문 ID' }, 400)
  try {
    await ensureWholesaleNotificationsSchema(DB)
    const party = await resolveParty(DB, orderId, sellerId)
    if (!party) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)

    const raw = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const bodyText = String(raw.body || '').trim().slice(0, MAX_NOTE_LEN)
    if (!bodyText) return c.json({ success: false, error: '내용을 입력해주세요' }, 400)

    const ins = await DB.prepare(`
      INSERT INTO wholesale_order_notes (wholesale_order_id, author_type, author_id, body)
      VALUES (?, ?, ?, ?)
    `).bind(orderId, party.type, sellerId, bodyText).run()
    const noteId = Number(ins.meta?.last_row_id)
    if (!noteId) return c.json({ success: false, error: '메모 등록 중 오류가 발생했습니다' }, 500)

    // 상대 당사자에 대시보드 알림(fail-soft). 작성자가 유통사면 공급자(들)에, 공급자면 유통사에.
    const authorLabel = party.type === 'distributor' ? '유통사' : '제조사'
    const preview = bodyText.length > 60 ? bodyText.slice(0, 60) + '…' : bodyText
    if (party.type === 'distributor') {
      // 주문에 라인을 가진 모든 공급자에 통지(중복 제거).
      const sups = await DB.prepare(
        'SELECT DISTINCT supplier_id FROM wholesale_order_items WHERE wholesale_order_id = ? AND supplier_id IS NOT NULL'
      ).bind(orderId).all<{ supplier_id: number }>().catch(() => ({ results: [] as { supplier_id: number }[] }))
      for (const s of (sups.results ?? [])) {
        createDashboardNotification(
          DB, 'supplier', String(s.supplier_id), 'wholesale_order_note',
          `도매 주문 #${orderId} 새 메모 (${authorLabel})`, preview, '/supplier/wholesale-orders',
        ).catch(swallow('wh-noti:notify-supplier'))
      }
    } else {
      // 공급자 작성 → 유통사(주문 owner)에 통지.
      createDashboardNotification(
        DB, 'seller', String(party.distributorId), 'wholesale_order_note',
        `도매 주문 #${orderId} 새 메모 (${authorLabel})`, preview, '/wholesale/orders',
      ).catch(swallow('wh-noti:notify-distributor'))
    }

    return c.json({
      success: true,
      note: { id: noteId, author_type: party.type, author_id: sellerId, body: bodyText, created_at: new Date().toISOString() },
    })
  } catch (err) {
    return safeError(c, err, '메모 등록 중 오류가 발생했습니다', '[wholesale-noti]')
  }
})

export { app as wholesaleNotificationsRoutes }
