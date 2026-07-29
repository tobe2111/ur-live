/**
 * 🚚 2026-06-29 (대표 — 도매 체크아웃 배송지) 판매사 배송지 주소록.
 *   기본 배송지 저장 + 수시 변경 + 최근 배송지 기록. 소비자 주소록과 분리(도매 전용 테이블).
 *   마운트: app.route('/api/wholesale', wholesaleShipAddressRoutes)
 *
 * - GET    /api/wholesale/ship-addresses        — 내 배송지 목록(기본 먼저, 최근 사용순)
 * - POST   /api/wholesale/ship-addresses        — 저장/갱신(중복 dedupe) + 기본 지정 옵션 + 최근사용 갱신
 * - DELETE /api/wholesale/ship-addresses/:id     — 삭제
 *
 * ⚠️ 주문 POST(wholesale.routes)는 무변경 — 체크아웃이 주문과 별개로 이 API 를 호출해 주소록 관리.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { swallow } from '@/worker/utils/swallow'
import { sellerIdFrom } from './wholesale-helpers'

const app = new Hono<{ Bindings: Env }>()

const RECENT_CAP = 12 // 판매사당 보관할 최근 배송지 최대 개수(기본 배송지는 항상 보존).

const _ensured = new WeakSet<object>()
async function ensureShipAddrTable(DB: D1Database) {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_ship_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    recipient_name TEXT,
    phone TEXT,
    postal_code TEXT,
    address TEXT,
    address_detail TEXT,
    message TEXT,
    is_default INTEGER DEFAULT 0,
    last_used_at DATETIME DEFAULT (datetime('now')),
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('wsa:create'))
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_wsa_seller ON wholesale_ship_addresses(seller_id, is_default, last_used_at)'
  ).run().catch(swallow('wsa:idx'))
}

type AddrBody = {
  recipient_name?: string; phone?: string; postal_code?: string;
  address?: string; address_detail?: string; message?: string; is_default?: boolean;
}

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

// ── GET /ship-addresses — 내 배송지 목록(기본 먼저, 최근 사용순) ─────────────────
app.get('/ship-addresses', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureShipAddrTable(DB)
    const { results } = await DB.prepare(
      `SELECT id, recipient_name, phone, postal_code, address, address_detail, message, is_default, last_used_at
         FROM wholesale_ship_addresses WHERE seller_id = ?
         ORDER BY is_default DESC, last_used_at DESC, id DESC LIMIT ${RECENT_CAP}`
    ).bind(sellerId).all().catch(() => ({ results: [] as unknown[] }))
    return c.json({ success: true, addresses: results ?? [] })
  } catch (err) {
    return safeError(c, err, '배송지 조회 중 오류가 발생했습니다', '[wholesale-ship-addr]')
  }
})

// ── POST /ship-addresses — 저장/갱신(dedupe) + 기본 지정 + 최근사용 갱신 ───────────
app.post('/ship-addresses', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureShipAddrTable(DB)
    const body = await c.req.json<AddrBody>().catch(() => ({} as AddrBody))
    const recipient = clean(body.recipient_name, 60)
    const phone = clean(body.phone, 30)
    const address = clean(body.address, 300)
    const detail = clean(body.address_detail, 200)
    const postal = clean(body.postal_code, 10)
    const message = clean(body.message, 100)
    if (!recipient || !phone || !address) {
      return c.json({ success: false, error: '받는 분·주소·연락처를 입력해주세요' }, 400)
    }
    const isDefault = body.is_default === true

    // 중복 dedupe — 같은 받는사람+연락처+주소+상세면 기존 행 갱신(최근사용·메시지), 아니면 INSERT.
    const existing = await DB.prepare(
      `SELECT id FROM wholesale_ship_addresses
         WHERE seller_id = ? AND recipient_name = ? AND phone = ? AND address = ? AND COALESCE(address_detail,'') = ?`
    ).bind(sellerId, recipient, phone, address, detail).first<{ id: number }>().catch(() => null)

    let id: number
    if (existing?.id) {
      await DB.prepare(
        `UPDATE wholesale_ship_addresses
            SET postal_code = ?, message = ?, last_used_at = datetime('now')
          WHERE id = ? AND seller_id = ?`
      ).bind(postal, message, existing.id, sellerId).run()
      id = existing.id
    } else {
      const res = await DB.prepare(
        `INSERT INTO wholesale_ship_addresses (seller_id, recipient_name, phone, postal_code, address, address_detail, message, is_default, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
      ).bind(sellerId, recipient, phone, postal, address, detail, message).run()
      id = Number(res.meta.last_row_id)
    }

    // 기본 배송지 지정 — 다른 행 해제 후 이 행만 default.
    if (isDefault) {
      await DB.prepare('UPDATE wholesale_ship_addresses SET is_default = 0 WHERE seller_id = ?').bind(sellerId).run().catch(swallow('wsa:cleardefault'))
      await DB.prepare('UPDATE wholesale_ship_addresses SET is_default = 1 WHERE id = ? AND seller_id = ?').bind(id, sellerId).run().catch(swallow('wsa:setdefault'))
    }

    // RECENT_CAP 초과분(기본 제외, 가장 오래된 것)부터 정리 — 주소록 무한 증식 방지(best-effort).
    await DB.prepare(
      `DELETE FROM wholesale_ship_addresses
        WHERE seller_id = ? AND is_default = 0 AND id NOT IN (
          SELECT id FROM wholesale_ship_addresses WHERE seller_id = ?
           ORDER BY is_default DESC, last_used_at DESC, id DESC LIMIT ${RECENT_CAP}
        )`
    ).bind(sellerId, sellerId).run().catch(swallow('wsa:prune'))

    return c.json({ success: true, id, is_default: isDefault })
  } catch (err) {
    return safeError(c, err, '배송지 저장 중 오류가 발생했습니다', '[wholesale-ship-addr]')
  }
})

// ── DELETE /ship-addresses/:id — 삭제 (본인 소유만) ───────────────────────────────
app.delete('/ship-addresses/:id', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
  try {
    await ensureShipAddrTable(DB)
    await DB.prepare('DELETE FROM wholesale_ship_addresses WHERE id = ? AND seller_id = ?').bind(id, sellerId).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '배송지 삭제 중 오류가 발생했습니다', '[wholesale-ship-addr]')
  }
})

export { app as wholesaleShipAddressRoutes }
