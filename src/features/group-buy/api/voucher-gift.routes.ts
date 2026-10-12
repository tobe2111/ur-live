/**
 * 🎁 이용권 선물(넘기기) API — `/api/group-buy/gifts/*` (2026-10-11 대표 "1,2,4 해줄래" 중 4번)
 *
 *   POST /                 { code, message? }  선물 링크 만들기(이미 있으면 그 링크) — 보낸 사람
 *   GET  /by-voucher/:code                     내 이용권의 보내는 중 선물 — 보낸 사람
 *   POST /:token/cancel                        회수(받기 전에만) — 보낸 사람
 *   GET  /:token                               받기 화면 정보(코드는 절대 안 보낸다) — 누구나
 *   POST /:token/accept                        받기 → 이용권 주인이 받는 사람으로 — 로그인
 *
 * 규칙·환불 차단: `worker/utils/voucher-gift.ts` 머리말.
 */
import { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import type { Env } from '@/worker/types/env'
import { resolveUserIdString } from '@/worker/utils/resolve-user-id'
import { safeError } from '@/worker/utils/safe-error'
import { ensureVoucherGiftTable, newGiftToken, GIFT_TOKEN_RE } from '@/worker/utils/voucher-gift'
import { notifyUser } from '@/lib/notifications'
import { generateVoucherCode } from './helpers'

export const voucherGiftRoutes = new Hono<{ Bindings: Env }>()

const CODE_RE = /^[A-Za-z0-9-]{4,64}$/
const MESSAGE_MAX = 100
const giftUrl = (token: string) => `https://urdeal.kr/gift/v/${token}`

type VoucherForGift = {
  id: number; user_id: string; order_id: number | null; status: string; expires_at: string | null
  gift_from_user_id: string | null; kt: string | null
}

async function myUid(c: { env: Env }, user: { id: number | string; isDbId?: boolean }) {
  const norm = await resolveUserIdString(c.env.DB, user.id, user.isDbId)
  const raw = String(user.id)
  return { norm, raw }
}

// ── POST / — 선물 링크 만들기 ──
voucherGiftRoutes.post('/', rateLimit({ action: 'voucher_gift_create', max: 20, windowSec: 600 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    let body: { code?: unknown; message?: unknown }
    try { body = await c.req.json() } catch { return c.json({ success: false, error: 'JSON 형식 오류' }, 400) }
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!CODE_RE.test(code)) return c.json({ success: false, error: '잘못된 이용권입니다' }, 400)
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, MESSAGE_MAX) : ''

    const { norm, raw } = await myUid(c, user)
    const v = await DB.prepare(`
      SELECT v.id, v.user_id, v.order_id, v.status, v.expires_at, v.gift_from_user_id,
             p.kt_alpha_gift_code AS kt
      FROM vouchers v LEFT JOIN products p ON p.id = v.product_id
      WHERE v.code = ? AND v.user_id IN (?, ?)
    `).bind(code, norm, raw).first<VoucherForGift>()
    if (!v) return c.json({ success: false, error: '이용권을 찾을 수 없어요' }, 404)
    if (v.status !== 'unused') return c.json({ success: false, error: '사용 가능한 이용권만 선물할 수 있어요' }, 400)
    if (v.kt) return c.json({ success: false, error: '교환권은 선물할 수 없어요' }, 400)
    if (v.gift_from_user_id) return c.json({ success: false, error: '선물 받은 이용권은 다시 선물할 수 없어요', code: 'ALREADY_GIFTED' }, 400)
    if (v.expires_at && Date.parse(String(v.expires_at).replace(' ', 'T') + (/[zZ]$/.test(v.expires_at) ? '' : 'Z')) <= Date.now()) {
      return c.json({ success: false, error: '만료된 이용권이에요' }, 400)
    }

    await ensureVoucherGiftTable(DB)
    const existing = await DB.prepare("SELECT token FROM voucher_gifts WHERE voucher_id = ? AND status = 'pending'")
      .bind(v.id).first<{ token: string }>()
    if (existing) {
      if (message) await DB.prepare("UPDATE voucher_gifts SET message = ? WHERE token = ? AND status = 'pending'").bind(message, existing.token).run()
      return c.json({ success: true, data: { token: existing.token, url: giftUrl(existing.token) } })
    }
    const token = newGiftToken()
    // 멱등 = UNIQUE 부분 인덱스 + INSERT OR IGNORE(머니 룰 #3 과 같은 모양). 동시 요청이면 먼저 들어간 링크를 돌려준다.
    await DB.prepare(`
      INSERT OR IGNORE INTO voucher_gifts (token, voucher_id, order_id, sender_user_id, message, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(token, v.id, v.order_id, String(v.user_id), message || null).run()
    const row = await DB.prepare("SELECT token FROM voucher_gifts WHERE voucher_id = ? AND status = 'pending'")
      .bind(v.id).first<{ token: string }>()
    if (!row) return c.json({ success: false, error: '선물 링크를 만들지 못했어요' }, 500)
    return c.json({ success: true, data: { token: row.token, url: giftUrl(row.token) } })
  } catch (err) {
    return safeError(c, err, '선물 링크를 만들지 못했어요', '[voucher-gift:create]')
  }
})

// ── GET /by-voucher/:code — 내 이용권에 보내는 중인 선물 ──
voucherGiftRoutes.get('/by-voucher/:code', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const code = c.req.param('code') || ''
  if (!CODE_RE.test(code)) return c.json({ success: false, error: '잘못된 이용권입니다' }, 400)
  const { DB } = c.env
  try {
    await ensureVoucherGiftTable(DB)
    const { norm, raw } = await myUid(c, user)
    const row = await DB.prepare(`
      SELECT g.token FROM voucher_gifts g JOIN vouchers v ON v.id = g.voucher_id
      WHERE v.code = ? AND g.status = 'pending' AND g.sender_user_id IN (?, ?)
    `).bind(code, norm, raw).first<{ token: string }>()
    return c.json({ success: true, data: row ? { token: row.token, url: giftUrl(row.token) } : null })
  } catch (err) {
    return safeError(c, err, '선물 정보를 불러오지 못했어요', '[voucher-gift:by-voucher]')
  }
})

// ── POST /:token/cancel — 받기 전 회수 ──
voucherGiftRoutes.post('/:token/cancel', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const token = c.req.param('token') || ''
  if (!GIFT_TOKEN_RE.test(token)) return c.json({ success: false, error: '잘못된 선물 링크예요' }, 400)
  const { DB } = c.env
  try {
    await ensureVoucherGiftTable(DB)
    const { norm, raw } = await myUid(c, user)
    const r = await DB.prepare(`
      UPDATE voucher_gifts SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
      WHERE token = ? AND status = 'pending' AND sender_user_id IN (?, ?)
    `).bind(token, norm, raw).run()
    if ((r.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '이미 받았거나 취소한 선물이에요' }, 409)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '선물 보내기를 취소하지 못했어요', '[voucher-gift:cancel]')
  }
})

// ── GET /:token — 받기 화면 ──
// 🔒 이용권 코드(=QR)는 받기 전에 절대 내보내지 않는다 — 링크만으로 남의 이용권을 쓸 수 있게 된다.
voucherGiftRoutes.get('/:token', rateLimit({ action: 'voucher_gift_view', max: 60, windowSec: 600 }), async (c) => {
  const token = c.req.param('token') || ''
  if (!GIFT_TOKEN_RE.test(token)) return c.json({ success: false, error: '잘못된 선물 링크예요' }, 400)
  const { DB } = c.env
  try {
    await ensureVoucherGiftTable(DB)
    const g = await DB.prepare(`
      SELECT g.status, g.message, g.voucher_id, g.sender_user_id,
             v.status AS voucher_status, v.user_id AS voucher_owner, v.expires_at,
             p.name AS product_name, p.image_url AS product_image, p.restaurant_name, p.restaurant_address,
             u.name AS sender_name
      FROM voucher_gifts g
      JOIN vouchers v ON v.id = g.voucher_id
      LEFT JOIN products p ON p.id = v.product_id
      LEFT JOIN users u ON CAST(u.id AS TEXT) = g.sender_user_id
      WHERE g.token = ?
    `).bind(token).first<{
      status: string; message: string | null; voucher_id: number; sender_user_id: string
      voucher_status: string; voucher_owner: string; expires_at: string | null
      product_name: string | null; product_image: string | null; restaurant_name: string | null
      restaurant_address: string | null; sender_name: string | null
    }>()
    if (!g) return c.json({ success: false, error: '없는 선물이에요' }, 404)
    // 보내는 중인데 보낸 사람이 그 사이 써 버렸거나 환불했으면 받을 수 없다.
    const receivable = g.status === 'pending' && g.voucher_status === 'unused' && String(g.voucher_owner) === String(g.sender_user_id)
    return c.json({
      success: true,
      data: {
        state: g.status === 'accepted' ? 'accepted' : g.status === 'cancelled' ? 'cancelled' : receivable ? 'pending' : 'unavailable',
        message: g.message,
        sender_name: g.sender_name,
        product_name: g.product_name,
        product_image: g.product_image,
        store_name: g.restaurant_name,
        store_address: g.restaurant_address,
        expires_at: g.expires_at,
      },
    })
  } catch (err) {
    return safeError(c, err, '선물 정보를 불러오지 못했어요', '[voucher-gift:view]')
  }
})

// ── POST /:token/accept — 받기 ──
// 순서(머니 룰 #1 claim-before-effect): ① 선물 CAS(pending→accepted) ② 이용권 주인 CAS(보낸 사람·unused 일 때만)
//   ②가 실패하면(그 사이 보낸 사람이 썼거나 환불) ①을 되돌려 'cancelled' 로 닫는다 — 반쯤 넘어간 상태가 남지 않는다.
voucherGiftRoutes.post('/:token/accept', rateLimit({ action: 'voucher_gift_accept', max: 10, windowSec: 600 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const token = c.req.param('token') || ''
  if (!GIFT_TOKEN_RE.test(token)) return c.json({ success: false, error: '잘못된 선물 링크예요' }, 400)
  const { DB } = c.env
  try {
    await ensureVoucherGiftTable(DB)
    const { norm } = await myUid(c, user)
    const g = await DB.prepare(`
      SELECT g.id, g.voucher_id, g.sender_user_id, g.status, p.name AS product_name, u.name AS recipient_name
      FROM voucher_gifts g
      JOIN vouchers v ON v.id = g.voucher_id
      LEFT JOIN products p ON p.id = v.product_id
      LEFT JOIN users u ON CAST(u.id AS TEXT) = ?
      WHERE g.token = ?
    `).bind(norm, token).first<{ id: number; voucher_id: number; sender_user_id: string; status: string; product_name: string | null; recipient_name: string | null }>()
    if (!g) return c.json({ success: false, error: '없는 선물이에요' }, 404)
    if (g.status !== 'pending') return c.json({ success: false, error: '이미 받았거나 취소된 선물이에요', code: 'NOT_PENDING' }, 409)
    if (String(g.sender_user_id) === norm || String(g.sender_user_id) === String(user.id)) {
      return c.json({ success: false, error: '내가 보낸 선물은 받을 수 없어요', code: 'SELF' }, 400)
    }

    const claim = await DB.prepare(`
      UPDATE voucher_gifts SET status = 'accepted', recipient_user_id = ?, accepted_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `).bind(norm, g.id).run()
    if ((claim.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '이미 받았거나 취소된 선물이에요', code: 'NOT_PENDING' }, 409)

    // 🔑 2026-10-12 대표 "선물하면 해당 이용권은 (보낸 사람이) 쓸 수 없게" — 주인만 바꾸면 **코드(=QR)는 그대로**라
    //   보낸 사람이 받기 전에 본 화면·캡처·`/v/코드` 링크로 매장에서 그대로 쓸 수 있었다(코드만으로 통하는 경로가 있다).
    //   ⇒ 받는 순간 코드를 새로 발급한다. 옛 코드는 어디서도 안 통한다. UNIQUE 충돌은 새 코드로 다시(1.1조 분의 1).
    let move: D1Result | null = null
    for (let attempt = 0; attempt < 3 && !move; attempt++) {
      try {
        move = await DB.prepare(`
          UPDATE vouchers SET user_id = ?, gift_from_user_id = ?, code = ?
          WHERE id = ? AND status = 'unused' AND user_id = ? AND gift_from_user_id IS NULL
            AND (expires_at IS NULL OR expires_at > datetime('now'))
        `).bind(norm, String(g.sender_user_id), generateVoucherCode(), g.voucher_id, String(g.sender_user_id)).run()
      } catch (e) {
        if (!/UNIQUE/i.test(String(e)) || attempt === 2) {
          // 반쯤 넘어간 상태를 남기지 않는다 — 선물을 받기 전으로 되돌린다(다시 시도할 수 있게).
          await DB.prepare("UPDATE voucher_gifts SET status = 'pending', recipient_user_id = NULL, accepted_at = NULL WHERE id = ? AND status = 'accepted'").bind(g.id).run().catch(() => null)
          throw e
        }
      }
    }
    if (!move || (move.meta?.changes ?? 0) === 0) {
      await DB.prepare("UPDATE voucher_gifts SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE id = ?").bind(g.id).run().catch(() => null)
      return c.json({ success: false, error: '더 이상 받을 수 없는 선물이에요(이미 사용·환불·만료됐어요)', code: 'UNAVAILABLE' }, 409)
    }

    const product = g.product_name || '이용권'
    const notify = notifyUser(DB, String(g.sender_user_id), 'gift_accepted', '🎁 선물이 전달됐어요',
      `${g.recipient_name || '친구'}님이 ${product}을(를) 받았어요`, '/my-vouchers')
    try { c.executionCtx.waitUntil(notify) } catch { await notify } // executionCtx 없는 환경(테스트)은 게터가 throw 한다
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '선물을 받지 못했어요', '[voucher-gift:accept]')
  }
})
