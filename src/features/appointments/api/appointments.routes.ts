/**
 * 🛡️ 2026-05-21: 자체 예약 캘린더 — 뷰티/액티비티/건강/펫 sub-1day 예약 시스템.
 *
 * 흐름:
 *   1. 셀러: POST /api/seller/products/:id/booking-slots — 가용 시간 슬롯 패턴 등록
 *   2. 유저: 결제 후 GET /api/products/:id/available-slots?date=YYYY-MM-DD — 슬롯 조회
 *   3. 유저: POST /api/appointments/book — 슬롯 예약 (order_id 기반)
 *   4. 매장: 알림톡 자동 발송 (Phase B-2 추가)
 *   5. 사용 후: PATCH /api/seller/appointments/:id/complete — 사장님 완료 처리
 *
 * 숙소 (stay_bookings) 는 별도 — 본 시스템은 시간 슬롯 기반.
 */
import { Hono } from 'hono'
import { requireAuth, requireSeller, getCurrentUser } from '../../../worker/middleware/auth'
import type { Env } from '../../../worker/types/env'

export const appointmentsRoutes = new Hono<{ Bindings: Env }>()

interface AppointmentBooking {
  id: number
  order_id: number | null
  user_id: string
  product_id: number
  seller_id: number
  booking_date: string
  start_time: string
  end_time: string
  status: string
  user_phone: string | null
  user_name: string | null
  notes: string | null
  created_at: string
}

interface BookingSlot {
  id: number
  product_id: number
  seller_id: number
  day_of_week: number
  start_time: string
  end_time: string
  capacity: number
  is_active: number
}

// ─── Seller: 슬롯 등록/조회/삭제 ─────────────────────────────────────

appointmentsRoutes.post('/seller/products/:id/booking-slots', requireSeller(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') return c.json({ success: false, error: 'Unauthorized' }, 401)
  const productId = parseInt(c.req.param('id') || '', 10)
  if (!Number.isFinite(productId)) return c.json({ success: false, error: 'Invalid id' }, 400)
  const body = await c.req.json<{ slots: Array<{ day_of_week: number; start_time: string; end_time: string; capacity?: number }> }>().catch(() => ({ slots: [] }))
  if (!Array.isArray(body.slots) || body.slots.length === 0) {
    return c.json({ success: false, error: '슬롯을 1개 이상 입력하세요.' }, 400)
  }
  const { DB } = c.env

  // 소유권 검증
  const product = await DB.prepare('SELECT seller_id FROM products WHERE id = ?').bind(productId).first<{ seller_id: number }>()
  if (!product || String(product.seller_id) !== String(user.id)) {
    return c.json({ success: false, error: '해당 상품의 권한이 없습니다.' }, 403)
  }

  // 유효성 검증 + INSERT
  let inserted = 0
  for (const s of body.slots) {
    if (!Number.isInteger(s.day_of_week) || s.day_of_week < 0 || s.day_of_week > 6) continue
    if (!/^\d{2}:\d{2}$/.test(s.start_time) || !/^\d{2}:\d{2}$/.test(s.end_time)) continue
    if (s.start_time >= s.end_time) continue
    const capacity = Math.max(1, Math.min(100, s.capacity || 1))
    try {
      await DB.prepare(
        `INSERT INTO product_booking_slots (product_id, seller_id, day_of_week, start_time, end_time, capacity, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
      ).bind(productId, user.id, s.day_of_week, s.start_time, s.end_time, capacity).run()
      inserted++
    } catch { /* skip duplicate or constraint */ }
  }

  // products.booking_required=1 자동 설정 (슬롯이 있으면 예약 시스템 활성)
  await DB.prepare(`UPDATE products SET booking_required = 1 WHERE id = ?`).bind(productId).run().catch(() => null)

  return c.json({ success: true, data: { inserted } })
})

appointmentsRoutes.get('/seller/products/:id/booking-slots', requireSeller(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') return c.json({ success: false, error: 'Unauthorized' }, 401)
  const productId = parseInt(c.req.param('id') || '', 10)
  if (!Number.isFinite(productId)) return c.json({ success: false, error: 'Invalid id' }, 400)
  const { DB } = c.env
  const rows = await DB.prepare(
    `SELECT id, day_of_week, start_time, end_time, capacity, is_active
       FROM product_booking_slots
      WHERE product_id = ? AND seller_id = ?
      ORDER BY day_of_week ASC, start_time ASC`,
  ).bind(productId, user.id).all<BookingSlot>().catch(() => ({ results: [] as BookingSlot[] }))
  return c.json({ success: true, data: rows.results || [] })
})

appointmentsRoutes.delete('/seller/products/:id/booking-slots/:slotId', requireSeller(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') return c.json({ success: false, error: 'Unauthorized' }, 401)
  const slotId = parseInt(c.req.param('slotId') || '', 10)
  if (!Number.isFinite(slotId)) return c.json({ success: false, error: 'Invalid id' }, 400)
  const { DB } = c.env
  await DB.prepare(`DELETE FROM product_booking_slots WHERE id = ? AND seller_id = ?`).bind(slotId, user.id).run()
  return c.json({ success: true })
})

// ─── User: 가용 슬롯 조회 ────────────────────────────────────────────

appointmentsRoutes.get('/products/:id/available-slots', async (c) => {
  const productId = parseInt(c.req.param('id') || '', 10)
  if (!Number.isFinite(productId)) return c.json({ success: false, error: 'Invalid id' }, 400)
  const date = c.req.query('date') || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ success: false, error: 'Invalid date (YYYY-MM-DD)' }, 400)
  const { DB } = c.env

  // 요일 계산
  const dow = new Date(date + 'T00:00:00Z').getUTCDay()

  // 해당 요일의 활성 슬롯 패턴
  const slots = await DB.prepare(
    `SELECT id, start_time, end_time, capacity
       FROM product_booking_slots
      WHERE product_id = ? AND day_of_week = ? AND is_active = 1
      ORDER BY start_time ASC`,
  ).bind(productId, dow).all<{ id: number; start_time: string; end_time: string; capacity: number }>().catch(() => ({ results: [] as Array<{ id: number; start_time: string; end_time: string; capacity: number }> }))

  // 같은 날짜에 이미 잡힌 예약 카운트 (start_time 기준 그룹)
  const booked = await DB.prepare(
    `SELECT start_time, COUNT(*) as cnt
       FROM appointment_bookings
      WHERE product_id = ? AND booking_date = ? AND status = 'confirmed'
      GROUP BY start_time`,
  ).bind(productId, date).all<{ start_time: string; cnt: number }>().catch(() => ({ results: [] as Array<{ start_time: string; cnt: number }> }))

  const bookedMap = new Map((booked.results || []).map(r => [r.start_time, r.cnt]))
  const available = (slots.results || []).map(s => ({
    ...s,
    booked_count: bookedMap.get(s.start_time) || 0,
    remaining: s.capacity - (bookedMap.get(s.start_time) || 0),
  })).filter(s => s.remaining > 0)

  return c.json({ success: true, data: { date, day_of_week: dow, slots: available } })
})

// ─── User: 예약 ──────────────────────────────────────────────────────

appointmentsRoutes.post('/appointments/book', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const body = await c.req.json<{ product_id: number; order_id?: number; booking_date: string; start_time: string; end_time: string; user_phone?: string; user_name?: string; notes?: string }>().catch(() => ({}) as { product_id?: number; order_id?: number; booking_date?: string; start_time?: string; end_time?: string; user_phone?: string; user_name?: string; notes?: string })
  const productId = Number(body.product_id)
  const orderId = body.order_id != null ? Number(body.order_id) : null
  const bookingDate = body.booking_date || ''
  const startTime = body.start_time || ''
  const endTime = body.end_time || ''

  if (!Number.isFinite(productId)) return c.json({ success: false, error: 'product_id 필수' }, 400)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) return c.json({ success: false, error: '날짜 형식: YYYY-MM-DD' }, 400)
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return c.json({ success: false, error: '시간 형식: HH:MM' }, 400)
  if (startTime >= endTime) return c.json({ success: false, error: '시작 시간이 종료보다 빨라야 합니다.' }, 400)
  // 과거 날짜 차단
  if (bookingDate < new Date().toISOString().slice(0, 10)) {
    return c.json({ success: false, error: '과거 날짜는 예약할 수 없습니다.' }, 400)
  }

  const { DB } = c.env

  // 상품 + seller_id 조회
  const product = await DB.prepare('SELECT seller_id, name FROM products WHERE id = ?').bind(productId).first<{ seller_id: number; name: string }>()
  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다.' }, 404)

  // 슬롯 capacity 검증 (요일 기준)
  const dow = new Date(bookingDate + 'T00:00:00Z').getUTCDay()
  const slot = await DB.prepare(
    `SELECT capacity FROM product_booking_slots
      WHERE product_id = ? AND day_of_week = ? AND start_time = ? AND is_active = 1
      LIMIT 1`,
  ).bind(productId, dow, startTime).first<{ capacity: number }>()
  if (!slot) return c.json({ success: false, error: '해당 시간 슬롯이 없습니다.' }, 400)

  // 🛡️ 2026-05-21: race condition 영구 차단 — INSERT WHERE atomic check.
  //   단순 SELECT + INSERT 사이에 다른 user 가 동시 결제 시 capacity 초과 가능.
  //   D1 의 INSERT ... WHERE (SELECT COUNT) < ? 패턴 — atomic 보장.
  //   meta.changes === 0 이면 capacity 초과로 INSERT 실패 (409).
  try {
    const result = await DB.prepare(
      `INSERT INTO appointment_bookings
         (order_id, user_id, product_id, seller_id, booking_date, start_time, end_time, status, user_phone, user_name, notes)
       SELECT ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?
        WHERE (SELECT COUNT(*) FROM appointment_bookings
                WHERE product_id = ? AND booking_date = ? AND start_time = ? AND status = 'confirmed') < ?`,
    ).bind(
      orderId, user.id, productId, product.seller_id, bookingDate, startTime, endTime,
      body.user_phone || null, body.user_name || null, body.notes || null,
      productId, bookingDate, startTime, slot.capacity,
    ).run()

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: '해당 슬롯이 마감되었습니다.' }, 409)
    }

    const appointmentId = result.meta.last_row_id as number

    // 🛡️ 2026-05-21: 예약 확정 알림톡 — 매장 + 유저 양쪽.
    //   waitUntil 비동기 (응답 지연 0). env 미설정 시 silent skip.
    c.executionCtx?.waitUntil((async () => {
      try {
        const { sendSystemAlimtalk } = await import('../../../lib/system-alimtalk')
        const env = c.env as unknown as Record<string, unknown>
        // 매장 phone
        const sellerRow = await DB.prepare('SELECT phone FROM sellers WHERE id = ?').bind(product.seller_id).first<{ phone: string }>().catch(() => null)
        if (sellerRow?.phone) {
          const msg = `[유어딜] 신규 예약 — ${product.name}\n${bookingDate} ${startTime}~${endTime}\n고객: ${body.user_name || ''} ${body.user_phone || ''}`
          await sendSystemAlimtalk(env, sellerRow.phone, 'appointment_seller_new', msg)
        }
        // 유저 phone (users.phone 자동 조회)
        const userRow = await DB.prepare('SELECT phone FROM users WHERE id = ?').bind(String(user.id)).first<{ phone: string }>().catch(() => null)
        const userPhone = body.user_phone || userRow?.phone
        if (userPhone) {
          const msg = `[유어딜] 예약 확정 — ${product.name}\n일시: ${bookingDate} ${startTime}~${endTime}\n예약 확인 / 변경: live.ur-team.com/my-appointments`
          await sendSystemAlimtalk(env, userPhone, 'appointment_user_confirmed', msg)
        }
      } catch (e) {
        if (import.meta.env?.DEV) console.warn('[appointment alimtalk]', e)
      }
    })())

    return c.json({ success: true, data: { appointment_id: appointmentId, booking_date: bookingDate, start_time: startTime } })
  } catch (e: unknown) {
    // UNIQUE 위반 (같은 유저가 같은 슬롯 중복 예약)
    if (String((e as Error).message).includes('UNIQUE') || String((e as Error).message).includes('SQLITE_CONSTRAINT')) {
      return c.json({ success: false, error: '이미 같은 슬롯에 예약하셨습니다.' }, 409)
    }
    throw e
  }
})

// 🛡️ 2026-05-21: 취소 정책 — 시작 시간 12시간 전까지 무조건 환불, 이후엔 정책 가이드.
const CANCEL_DEADLINE_HOURS = 12

// ─── User: 내 예약 목록 ──────────────────────────────────────────────

appointmentsRoutes.get('/appointments/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const { DB } = c.env
  const rows = await DB.prepare(
    `SELECT a.*, p.name as product_name, p.image_url, p.restaurant_name, p.restaurant_address, p.restaurant_phone
       FROM appointment_bookings a
       LEFT JOIN products p ON p.id = a.product_id
      WHERE a.user_id = ?
      ORDER BY a.booking_date DESC, a.start_time DESC
      LIMIT 50`,
  ).bind(String(user.id)).all().catch(() => ({ results: [] }))
  return c.json({ success: true, data: rows.results || [] })
})

// ─── User: 예약 취소 ─────────────────────────────────────────────────

appointmentsRoutes.patch('/appointments/:id/cancel', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const id = parseInt(c.req.param('id') || '', 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400)
  const body = await c.req.json<{ cancel_reason?: string }>().catch(() => ({} as { cancel_reason?: string }))
  const { DB } = c.env

  const apt = await DB.prepare(
    'SELECT user_id, status, booking_date, start_time FROM appointment_bookings WHERE id = ?',
  ).bind(id).first<{ user_id: string; status: string; booking_date: string; start_time: string }>()
  if (!apt) return c.json({ success: false, error: 'Not found' }, 404)
  if (String(apt.user_id) !== String(user.id) && user.type !== 'admin') {
    return c.json({ success: false, error: '권한이 없습니다.' }, 403)
  }
  if (apt.status !== 'confirmed') {
    return c.json({ success: false, error: '이미 처리된 예약입니다.' }, 409)
  }

  // 🛡️ 취소 정책 — 시작 시간 12시간 이내 취소는 admin 만 가능 (사용자는 환불 불가 안내).
  const startMs = new Date(`${apt.booking_date}T${apt.start_time}:00+09:00`).getTime()
  const hoursUntil = (startMs - Date.now()) / 3_600_000
  const lateCancel = hoursUntil < CANCEL_DEADLINE_HOURS
  if (lateCancel && user.type !== 'admin') {
    return c.json({
      success: false,
      error: `예약 시작 ${CANCEL_DEADLINE_HOURS}시간 이내 취소 시 환불이 불가합니다. 매장에 직접 연락 후 어드민에 문의해주세요.`,
      late_cancel: true,
    }, 409)
  }

  await DB.prepare(
    `UPDATE appointment_bookings SET status = 'cancelled', cancelled_at = datetime('now'), cancel_reason = ? WHERE id = ?`,
  ).bind(body.cancel_reason || '사용자 취소', id).run()

  return c.json({ success: true, data: { refund_eligible: !lateCancel } })
})

// ─── Seller: 받은 예약 목록 ──────────────────────────────────────────

appointmentsRoutes.get('/seller/appointments', requireSeller(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') return c.json({ success: false, error: 'Unauthorized' }, 401)
  const status = c.req.query('status') || ''
  const date = c.req.query('date') || ''
  const { DB } = c.env
  const conds: string[] = ['a.seller_id = ?']
  const params: unknown[] = [user.id]
  if (status) { conds.push('a.status = ?'); params.push(status) }
  if (date) { conds.push('a.booking_date = ?'); params.push(date) }
  const rows = await DB.prepare(
    `SELECT a.*, p.name as product_name, p.restaurant_name
       FROM appointment_bookings a
       LEFT JOIN products p ON p.id = a.product_id
      WHERE ${conds.join(' AND ')}
      ORDER BY a.booking_date DESC, a.start_time ASC
      LIMIT 100`,
  ).bind(...params).all().catch(() => ({ results: [] }))
  return c.json({ success: true, data: rows.results || [] })
})

// ─── Seller: 완료 / 노쇼 처리 ────────────────────────────────────────

appointmentsRoutes.patch('/seller/appointments/:id/complete', requireSeller(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') return c.json({ success: false, error: 'Unauthorized' }, 401)
  const id = parseInt(c.req.param('id') || '', 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400)
  const { DB } = c.env
  const apt = await DB.prepare('SELECT seller_id, status FROM appointment_bookings WHERE id = ?').bind(id).first<{ seller_id: number; status: string }>()
  if (!apt) return c.json({ success: false, error: 'Not found' }, 404)
  if (String(apt.seller_id) !== String(user.id)) return c.json({ success: false, error: 'Forbidden' }, 403)
  if (apt.status !== 'confirmed') return c.json({ success: false, error: 'Already processed' }, 409)
  await DB.prepare(`UPDATE appointment_bookings SET status = 'completed', completed_at = datetime('now') WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

appointmentsRoutes.patch('/seller/appointments/:id/no-show', requireSeller(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') return c.json({ success: false, error: 'Unauthorized' }, 401)
  const id = parseInt(c.req.param('id') || '', 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400)
  const { DB } = c.env
  const apt = await DB.prepare('SELECT seller_id, status FROM appointment_bookings WHERE id = ?').bind(id).first<{ seller_id: number; status: string }>()
  if (!apt) return c.json({ success: false, error: 'Not found' }, 404)
  if (String(apt.seller_id) !== String(user.id)) return c.json({ success: false, error: 'Forbidden' }, 403)
  if (apt.status !== 'confirmed') return c.json({ success: false, error: 'Already processed' }, 409)
  await DB.prepare(`UPDATE appointment_bookings SET status = 'no_show', completed_at = datetime('now') WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

export type { AppointmentBooking, BookingSlot }
