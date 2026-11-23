/**
 * 📞 전화 예약형 이용권 — 방문 계획 API (2026-11-23) · 규칙·저장: `worker/utils/visit-plan.ts`
 *   마운트: `app.route('/api', visitPlanRoutes)`
 *
 *   사장님  PUT  /api/seller/products/:id/call-booking   이 이용권은 "방문 전 전화 예약" (켜기/끄기)
 *           GET  /api/seller/products/:id/call-booking
 *           GET  /api/seller/visit-plans                 예약 대기·확정 손님(미사용 이용권)
 *           PUT  /api/seller/visit-plans/:voucherId      통화로 정한 날짜 적기
 *   손님    GET  /api/visit-plans/mine                   내 전화 예약형 이용권(매장 전화·내 계획)
 *           PUT  /api/visit-plans/:code                  예약한 날짜 적기 · 번호 알려주기 동의
 *
 * 🔒 소유권: 사장님은 `products.seller_id` 가 본인일 때만, 손님은 `vouchers.user_id` 가 본인일 때만.
 * 손님 번호는 `phoneVisible`(동의 + 방문 다음 날까지)을 통과한 행에만 싣는다.
 */
import { Hono } from 'hono'
import { requireUser, requireSeller, getCurrentUser } from '../../../worker/middleware/auth'
import type { Env } from '../../../worker/types/env'
import { safeError } from '../../../worker/utils/safe-error'
import { setSupplyMeta } from '../../../worker/utils/product-supply-meta'
import { notifySeller } from '../../../lib/notifications'
import {
  CALL_BOOKING_META_KEY, ensureVisitPlanTable, isCallBookingProduct, isVisitTime, kstToday, phoneVisible,
  saveVisitPlan, visitDateError, visitWhenLabel,
} from '../../../worker/utils/visit-plan'

export const visitPlanRoutes = new Hono<{ Bindings: Env }>()

async function ownedProduct(DB: D1Database, productId: number, sellerId: unknown): Promise<boolean> {
  const p = await DB.prepare('SELECT seller_id FROM products WHERE id = ?').bind(productId).first<{ seller_id: number | null }>().catch(() => null)
  return !!p && p.seller_id != null && String(p.seller_id) === String(sellerId)
}

/** 날짜·시간 입력 해석 — `null` 은 "지우기", `undefined` 는 "안 바꿈". 실패면 문장. */
function parseWhen(body: { visit_date?: unknown; visit_time?: unknown }): { error: string } | { visitDate?: string | null; visitTime?: string | null } {
  const out: { visitDate?: string | null; visitTime?: string | null } = {}
  if (body.visit_date !== undefined) {
    if (body.visit_date === null || body.visit_date === '') out.visitDate = null
    else { const e = visitDateError(body.visit_date); if (e) return { error: e }; out.visitDate = body.visit_date as string }
  }
  if (body.visit_time !== undefined) {
    if (body.visit_time === null || body.visit_time === '') out.visitTime = null
    else if (!isVisitTime(body.visit_time)) return { error: '시간을 다시 골라 주세요' }
    else out.visitTime = body.visit_time
  }
  return out
}

// ─── 사장님 ─────────────────────────────────────────────────────────

visitPlanRoutes.get('/seller/products/:id/call-booking', requireSeller(), async (c) => {
  const user = getCurrentUser(c)
  const productId = Number(c.req.param('id'))
  if (!user || user.type !== 'seller') return c.json({ success: false, error: 'Unauthorized' }, 401)
  if (!Number.isInteger(productId) || productId <= 0) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
  if (!(await ownedProduct(c.env.DB, productId, user.id))) return c.json({ success: false, error: '해당 상품의 권한이 없습니다.' }, 403)
  return c.json({ success: true, data: { enabled: await isCallBookingProduct(c.env.DB, productId) } })
})

visitPlanRoutes.put('/seller/products/:id/call-booking', requireSeller(), async (c) => {
  try {
    const user = getCurrentUser(c)
    const productId = Number(c.req.param('id'))
    if (!user || user.type !== 'seller') return c.json({ success: false, error: 'Unauthorized' }, 401)
    if (!Number.isInteger(productId) || productId <= 0) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    const body = await c.req.json<{ enabled?: unknown }>().catch(() => ({} as { enabled?: unknown }))
    if (typeof body.enabled !== 'boolean') return c.json({ success: false, error: 'enabled 는 true/false 입니다' }, 400)
    if (!(await ownedProduct(c.env.DB, productId, user.id))) return c.json({ success: false, error: '해당 상품의 권한이 없습니다.' }, 403)
    await setSupplyMeta(c.env.DB, productId, { [CALL_BOOKING_META_KEY]: body.enabled ? '1' : null })
    return c.json({ success: true, data: { enabled: body.enabled } })
  } catch (err) {
    return safeError(c, err, '예약 방식을 저장하지 못했습니다', '[visit-plans]')
  }
})

interface SellerPlanRow {
  voucher_id: number; code: string; product_name: string | null; bought_at: string
  buyer_name: string | null; buyer_phone: string | null
  visit_date: string | null; visit_time: string | null; share_phone: number | null
}

visitPlanRoutes.get('/seller/visit-plans', requireSeller(), async (c) => {
  try {
    const user = getCurrentUser(c)
    if (!user || user.type !== 'seller') return c.json({ success: false, error: 'Unauthorized' }, 401)
    const DB = c.env.DB
    await ensureVisitPlanTable(DB)
    const { results } = await DB.prepare(
      `SELECT v.id AS voucher_id, v.code, p.name AS product_name, v.created_at AS bought_at,
              u.name AS buyer_name, u.phone AS buyer_phone,
              vp.visit_date, vp.visit_time, vp.share_phone
         FROM vouchers v
         JOIN products p ON p.id = v.product_id
         JOIN product_supply_meta m ON m.product_id = p.id AND m.key = ? AND m.value = '1'
         LEFT JOIN users u ON CAST(u.id AS TEXT) = v.user_id
         LEFT JOIN voucher_visit_plans vp ON vp.voucher_id = v.id
        WHERE p.seller_id = ? AND v.status = 'unused'
        ORDER BY (vp.visit_date IS NULL) DESC, vp.visit_date ASC, v.id DESC
        LIMIT 200`,
    ).bind(CALL_BOOKING_META_KEY, user.id).all<SellerPlanRow>()
    const today = kstToday()
    const data = (results || []).map((r) => {
      const show = phoneVisible({ sharePhone: r.share_phone === 1, visitDate: r.visit_date }, today)
      return {
        voucher_id: r.voucher_id,
        // 코드는 끝 4자리만 — 목록에서 손님을 가려내는 용도이지 사용 처리 수단이 아니다(사용은 현장 QR).
        code_tail: String(r.code || '').slice(-4),
        product_name: r.product_name, bought_at: r.bought_at,
        buyer_name: r.buyer_name,
        buyer_phone: show ? r.buyer_phone : null,
        phone_shared: show && !!r.buyer_phone,
        visit_date: r.visit_date, visit_time: r.visit_time,
      }
    })
    return c.json({ success: true, data })
  } catch (err) {
    return safeError(c, err, '예약 손님을 불러오지 못했습니다', '[visit-plans]')
  }
})

visitPlanRoutes.put('/seller/visit-plans/:voucherId', requireSeller(), async (c) => {
  try {
    const user = getCurrentUser(c)
    const voucherId = Number(c.req.param('voucherId'))
    if (!user || user.type !== 'seller') return c.json({ success: false, error: 'Unauthorized' }, 401)
    if (!Number.isInteger(voucherId) || voucherId <= 0) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    const when = parseWhen(await c.req.json<{ visit_date?: unknown; visit_time?: unknown }>().catch(() => ({})))
    if ('error' in when) return c.json({ success: false, error: when.error }, 400)
    const DB = c.env.DB
    const v = await DB.prepare(
      `SELECT v.user_id, v.status, v.product_id, p.seller_id, p.name AS product_name, p.restaurant_name
         FROM vouchers v JOIN products p ON p.id = v.product_id WHERE v.id = ?`,
    ).bind(voucherId).first<{ user_id: string; status: string; product_id: number; seller_id: number | null; product_name: string | null; restaurant_name: string | null }>()
    if (!v || v.seller_id == null || String(v.seller_id) !== String(user.id)) return c.json({ success: false, error: '해당 이용권의 권한이 없습니다.' }, 403)
    if (v.status !== 'unused') return c.json({ success: false, error: '이미 사용했거나 끝난 이용권이에요' }, 409)
    if (!(await isCallBookingProduct(DB, v.product_id))) return c.json({ success: false, error: '전화 예약형 이용권이 아니에요' }, 400)
    const plan = await saveVisitPlan(DB, voucherId, when, 'seller') // 동의(sharePhone)는 사장님이 못 바꾼다
    if (plan.visitDate && when.visitDate !== undefined) {
      await DB.prepare(
        `INSERT INTO notifications (user_id, user_type, type, title, message, link, created_at)
         VALUES (?, 'user', ?, ?, ?, '/my-vouchers', datetime('now'))`,
      ).bind(v.user_id, `visit_plan_set_${voucherId}`, '📅 방문 예약이 정해졌어요',
        `${v.restaurant_name || '매장'} · ${visitWhenLabel(plan.visitDate, plan.visitTime)} — ${v.product_name || '이용권'}`).run().catch(() => null)
    }
    return c.json({ success: true, data: { visit_date: plan.visitDate, visit_time: plan.visitTime } })
  } catch (err) {
    return safeError(c, err, '예약 날짜를 저장하지 못했습니다', '[visit-plans]')
  }
})

// ─── 손님 ───────────────────────────────────────────────────────────

visitPlanRoutes.get('/visit-plans/mine', requireUser(), async (c) => {
  try {
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const DB = c.env.DB
    await ensureVisitPlanTable(DB)
    const { results } = await DB.prepare(
      `SELECT v.code, p.restaurant_name, p.restaurant_phone, vp.visit_date, vp.visit_time, vp.share_phone
         FROM vouchers v
         JOIN products p ON p.id = v.product_id
         JOIN product_supply_meta m ON m.product_id = p.id AND m.key = ? AND m.value = '1'
         LEFT JOIN voucher_visit_plans vp ON vp.voucher_id = v.id
        WHERE v.user_id = ? AND v.status = 'unused'
        ORDER BY v.id DESC LIMIT 100`,
    ).bind(CALL_BOOKING_META_KEY, String(user.id)).all<{ code: string; restaurant_name: string | null; restaurant_phone: string | null; visit_date: string | null; visit_time: string | null; share_phone: number | null }>()
    return c.json({
      success: true,
      data: (results || []).map((r) => ({
        code: r.code, store_name: r.restaurant_name, store_phone: r.restaurant_phone,
        visit_date: r.visit_date, visit_time: r.visit_time, share_phone: r.share_phone === 1,
      })),
    })
  } catch (err) {
    return safeError(c, err, '예약 정보를 불러오지 못했습니다', '[visit-plans]')
  }
})

visitPlanRoutes.put('/visit-plans/:code', requireUser(), async (c) => {
  try {
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const code = c.req.param('code') || ''
    if (!/^[A-Za-z0-9-]{4,64}$/.test(code)) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    const body = await c.req.json<{ visit_date?: unknown; visit_time?: unknown; share_phone?: unknown }>().catch(() => ({} as { visit_date?: unknown; visit_time?: unknown; share_phone?: unknown }))
    const when = parseWhen(body)
    if ('error' in when) return c.json({ success: false, error: when.error }, 400)
    if (body.share_phone !== undefined && typeof body.share_phone !== 'boolean') return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    const DB = c.env.DB
    const v = await DB.prepare(
      `SELECT v.id, v.status, v.product_id, p.seller_id, p.name AS product_name
         FROM vouchers v JOIN products p ON p.id = v.product_id WHERE v.code = ? AND v.user_id = ?`,
    ).bind(code, String(user.id)).first<{ id: number; status: string; product_id: number; seller_id: number | null; product_name: string | null }>()
    if (!v) return c.json({ success: false, error: '이용권을 찾을 수 없습니다' }, 404)
    if (v.status !== 'unused') return c.json({ success: false, error: '이미 사용했거나 끝난 이용권이에요' }, 409)
    if (!(await isCallBookingProduct(DB, v.product_id))) return c.json({ success: false, error: '전화 예약형 이용권이 아니에요' }, 400)
    const plan = await saveVisitPlan(DB, v.id, { ...when, ...(typeof body.share_phone === 'boolean' ? { sharePhone: body.share_phone } : {}) }, 'user')
    if (v.seller_id != null && plan.visitDate && when.visitDate !== undefined) {
      await notifySeller(DB, v.seller_id, 'visit_plan_set', '📅 손님이 방문 날짜를 적었어요',
        `${visitWhenLabel(plan.visitDate, plan.visitTime)} — ${v.product_name || '이용권'}`, '/seller/bookings?tab=call')
    }
    return c.json({ success: true, data: { visit_date: plan.visitDate, visit_time: plan.visitTime, share_phone: plan.sharePhone } })
  } catch (err) {
    return safeError(c, err, '예약 정보를 저장하지 못했습니다', '[visit-plans]')
  }
})
