/**
 * 🛡️ 2026-05-18: 숙소 공구 — 사용자 측 public endpoints (PR 1 Foundation).
 *
 *   - GET /stays/search                     — 지역/날짜/인원 필터 검색
 *   - GET /stays/:productId                 — 상세 (info + rooms + 평점/리뷰)
 *   - GET /stays/:productId/availability    — 특정 날짜 범위 가용 객실 조회
 *   - GET /stays/:productId/reviews         — 리뷰 목록
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = { DB: D1Database }
export const staysPublicRoutes = new Hono<{ Bindings: Bindings }>()

// 검색 — 지역 / 날짜 / 인원 / 가격대 필터
staysPublicRoutes.get('/stays/search', cors(), async (c) => {
  try {
    const region = c.req.query('region') || ''
    const checkIn = c.req.query('check_in') || ''
    const checkOut = c.req.query('check_out') || ''
    const guests = Math.max(1, Number(c.req.query('guests')) || 1)
    const propertyType = c.req.query('property_type') || ''
    const minPrice = Number(c.req.query('min_price')) || 0
    const maxPrice = Number(c.req.query('max_price')) || 0
    const sort = c.req.query('sort') || 'recent' // recent / price_asc / price_desc / rating

    let sql = `
      SELECT p.id, p.name, p.image_url, p.seller_id,
             psi.property_type, psi.star_rating, psi.region_sido, psi.region_sigungu,
             psi.address, psi.latitude, psi.longitude, psi.amenities,
             (SELECT MIN(base_price_weekday) FROM product_stay_rooms r WHERE r.product_id = p.id AND r.is_active = 1) as price_from,
             (SELECT MAX(max_guests) FROM product_stay_rooms r WHERE r.product_id = p.id AND r.is_active = 1) as max_guests,
             (SELECT AVG(rating_overall) FROM stay_booking_reviews rev WHERE rev.product_id = p.id AND rev.is_visible = 1) as avg_rating,
             (SELECT COUNT(*) FROM stay_booking_reviews rev WHERE rev.product_id = p.id AND rev.is_visible = 1) as review_count
        FROM products p
        INNER JOIN product_stay_info psi ON psi.product_id = p.id
       WHERE p.category = 'stay_voucher'
         AND p.is_active = 1
    `
    const params: unknown[] = []
    if (region) {
      sql += ' AND (psi.region_sido = ? OR psi.region_sigungu = ?)'
      params.push(region, region)
    }
    if (propertyType) {
      sql += ' AND psi.property_type = ?'
      params.push(propertyType)
    }
    if (guests > 1) {
      sql += ' AND EXISTS (SELECT 1 FROM product_stay_rooms r WHERE r.product_id = p.id AND r.max_guests >= ? AND r.is_active = 1)'
      params.push(guests)
    }
    if (minPrice > 0 && maxPrice > 0) {
      sql += ' AND EXISTS (SELECT 1 FROM product_stay_rooms r WHERE r.product_id = p.id AND r.base_price_weekday BETWEEN ? AND ? AND r.is_active = 1)'
      params.push(minPrice, maxPrice)
    }

    // 날짜 가용성 (어느 객실이든 해당 기간 available_count >= 1)
    if (checkIn && checkOut && /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && /^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
      sql += `
        AND EXISTS (
          SELECT 1 FROM product_stay_rooms r2 WHERE r2.product_id = p.id AND r2.is_active = 1
            AND NOT EXISTS (
              SELECT 1 FROM product_stay_calendar cal
               WHERE cal.room_id = r2.id
                 AND cal.stay_date >= ? AND cal.stay_date < ?
                 AND (cal.available_count <= 0 OR cal.is_blocked = 1)
            )
        )`
      params.push(checkIn, checkOut)
    }

    if (sort === 'price_asc') sql += ' ORDER BY price_from ASC NULLS LAST'
    else if (sort === 'price_desc') sql += ' ORDER BY price_from DESC NULLS LAST'
    else if (sort === 'rating') sql += ' ORDER BY avg_rating DESC NULLS LAST, review_count DESC'
    else sql += ' ORDER BY p.created_at DESC'

    sql += ' LIMIT 50'

    const rows = await c.env.DB.prepare(sql).bind(...params)
      .all<Record<string, unknown>>().catch(() => ({ results: [] }))
    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 상세
staysPublicRoutes.get('/stays/:productId', cors(), async (c) => {
  try {
    const productId = Number(c.req.param('productId'))
    if (!Number.isFinite(productId)) return c.json({ success: false, error: 'Invalid productId' }, 400)

    const product = await c.env.DB.prepare(
      `SELECT p.id, p.name, p.description, p.image_url, p.is_active, p.seller_id,
              psi.*,
              s.name as seller_name,
              (SELECT AVG(rating_overall) FROM stay_booking_reviews rev WHERE rev.product_id = p.id AND rev.is_visible = 1) as avg_rating,
              (SELECT COUNT(*) FROM stay_booking_reviews rev WHERE rev.product_id = p.id AND rev.is_visible = 1) as review_count
         FROM products p
         INNER JOIN product_stay_info psi ON psi.product_id = p.id
         LEFT JOIN sellers s ON s.id = p.seller_id
        WHERE p.id = ? AND p.is_active = 1`
    ).bind(productId).first<Record<string, unknown>>()
    if (!product) return c.json({ success: false, error: '숙소 없음' }, 404)

    const rooms = await c.env.DB.prepare(
      `SELECT * FROM product_stay_rooms
        WHERE product_id = ? AND is_active = 1
        ORDER BY base_price_weekday`
    ).bind(productId).all<Record<string, unknown>>().catch(() => ({ results: [] }))

    return c.json({
      success: true,
      data: { product, rooms: rooms.results || [] },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 가용성 — 특정 기간의 객실별 잔여 + 가격 계산
staysPublicRoutes.get('/stays/:productId/availability', cors(), async (c) => {
  try {
    const productId = Number(c.req.param('productId'))
    const checkIn = c.req.query('check_in') || ''
    const checkOut = c.req.query('check_out') || ''
    if (!Number.isFinite(productId)) return c.json({ success: false, error: 'Invalid productId' }, 400)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
      return c.json({ success: false, error: '체크인/체크아웃 날짜 형식 오류' }, 400)
    }
    const nights = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
    if (nights < 1) return c.json({ success: false, error: '체크아웃은 체크인 이후여야 합니다' }, 400)

    const rooms = await c.env.DB.prepare(
      `SELECT id, name, base_guests, max_guests, extra_guest_fee, bed_config,
              base_price_weekday, base_price_weekend, base_price_holiday,
              total_inventory, amenities, image_urls
         FROM product_stay_rooms
        WHERE product_id = ? AND is_active = 1`
    ).bind(productId).all<{
      id: number; name: string; base_guests: number; max_guests: number; extra_guest_fee: number;
      bed_config: string | null;
      base_price_weekday: number; base_price_weekend: number; base_price_holiday: number | null;
      total_inventory: number; amenities: string | null; image_urls: string | null;
    }>().catch(() => ({ results: [] }))

    // 각 객실의 기간 가용 + 가격 계산.
    const result: Array<Record<string, unknown>> = []
    for (const r of (rooms.results || [])) {
      // 캘린더 row 조회 (이 객실 + 기간).
      const cal = await c.env.DB.prepare(
        `SELECT stay_date, available_count, price_override, is_blocked
           FROM product_stay_calendar
          WHERE room_id = ? AND stay_date >= ? AND stay_date < ?
          ORDER BY stay_date`
      ).bind(r.id, checkIn, checkOut).all<{
        stay_date: string; available_count: number; price_override: number | null; is_blocked: number;
      }>().catch(() => ({ results: [] }))
      const calMap = new Map((cal.results || []).map((x) => [x.stay_date, x]))

      // 날짜별 가격/가용 계산.
      let total = 0
      let minAvailable = r.total_inventory
      let unavailable = false
      const dates: Array<{ date: string; price: number; available: number; weekend: boolean }> = []
      for (let i = 0; i < nights; i++) {
        const d = new Date(new Date(checkIn).getTime() + i * 86400000)
        const ds = d.toISOString().slice(0, 10)
        const dow = d.getDay()
        const isWeekend = dow === 5 || dow === 6  // 금/토 (체크인 기준)
        const calRow = calMap.get(ds)
        if (calRow?.is_blocked) { unavailable = true; break }
        const avail = calRow?.available_count ?? r.total_inventory
        if (avail <= 0) { unavailable = true; break }
        minAvailable = Math.min(minAvailable, avail)
        const price = calRow?.price_override ?? (isWeekend ? r.base_price_weekend : r.base_price_weekday)
        total += price
        dates.push({ date: ds, price, available: avail, weekend: isWeekend })
      }

      result.push({
        room_id: r.id,
        name: r.name,
        bed_config: r.bed_config,
        base_guests: r.base_guests,
        max_guests: r.max_guests,
        extra_guest_fee: r.extra_guest_fee,
        amenities: r.amenities,
        image_urls: r.image_urls,
        available: !unavailable,
        available_count: unavailable ? 0 : minAvailable,
        total_price: total,
        nights,
        avg_per_night: nights > 0 ? Math.round(total / nights) : 0,
        dates,
      })
    }

    return c.json({ success: true, data: { rooms: result, nights, check_in: checkIn, check_out: checkOut } })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 🛡️ 2026-05-18: 예약 생성 (PR 3) — 사용자 결제 흐름의 첫 단계.
//   body: { product_id, room_id, check_in_date, check_out_date, guest_count, guest_name, guest_phone, guest_email?, special_request? }
//   응답: { booking_id, total_amount, check_in_code }
//   동작: orders 결제는 별도 흐름 — 이 endpoint 는 예약만 생성 (status='pending').
//   결제 완료 시 (PR 6) → status='confirmed' + 캘린더 available_count 차감.
staysPublicRoutes.post('/stays/bookings/create', cors(), async (c) => {
  try {
    const auth = c.req.header('Authorization') || ''
    if (!auth.startsWith('Bearer ')) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    let userId: number | null = null
    try {
      const { verify } = await import('hono/jwt')
      const payload = await verify(auth.substring(7), (c.env as unknown as { JWT_SECRET: string }).JWT_SECRET, 'HS256') as { user_id?: number; sub?: string }
      userId = Number(payload.user_id ?? payload.sub) || null
    } catch { return c.json({ success: false, error: '토큰 무효' }, 401) }
    if (!userId) return c.json({ success: false, error: '사용자 정보 없음' }, 401)

    type CreateBookingBody = {
      product_id?: number; room_id?: number;
      check_in_date?: string; check_out_date?: string;
      guest_count?: number; guest_name?: string; guest_phone?: string;
      guest_email?: string; special_request?: string;
    }
    const body = await c.req.json<CreateBookingBody>().catch(() => ({} as CreateBookingBody))

    const productId = Number(body?.product_id)
    const roomId = Number(body?.room_id)
    const checkIn = String(body?.check_in_date || '')
    const checkOut = String(body?.check_out_date || '')
    const guestCount = Math.max(1, Number(body?.guest_count) || 1)
    const guestName = String(body?.guest_name || '').trim()
    const guestPhone = String(body?.guest_phone || '').trim()

    if (!Number.isFinite(productId) || !Number.isFinite(roomId)) {
      return c.json({ success: false, error: 'product_id / room_id 필요' }, 400)
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
      return c.json({ success: false, error: '체크인/체크아웃 날짜 형식 오류' }, 400)
    }
    const nights = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
    if (nights < 1) return c.json({ success: false, error: '체크아웃은 체크인 이후여야 합니다' }, 400)
    if (!guestName || !guestPhone) return c.json({ success: false, error: '게스트 이름/전화번호 필수' }, 400)

    // 객실 + 숙소 정보 조회.
    const room = await c.env.DB.prepare(
      `SELECT r.id, r.product_id, r.name, r.base_guests, r.max_guests, r.extra_guest_fee,
              r.base_price_weekday, r.base_price_weekend, r.base_price_holiday, r.total_inventory,
              p.seller_id, p.name as product_name,
              psi.min_nights, psi.advance_booking_days
         FROM product_stay_rooms r
         INNER JOIN products p ON p.id = r.product_id
         LEFT JOIN product_stay_info psi ON psi.product_id = p.id
        WHERE r.id = ? AND r.product_id = ? AND r.is_active = 1`
    ).bind(roomId, productId).first<{
      id: number; product_id: number; name: string; base_guests: number; max_guests: number; extra_guest_fee: number;
      base_price_weekday: number; base_price_weekend: number; base_price_holiday: number | null; total_inventory: number;
      seller_id: number; product_name: string; min_nights: number | null; advance_booking_days: number | null;
    }>()
    if (!room) return c.json({ success: false, error: '객실 없음' }, 404)
    if (guestCount > room.max_guests) {
      return c.json({ success: false, error: `최대 ${room.max_guests}인까지 가능합니다` }, 400)
    }
    if (room.min_nights && nights < room.min_nights) {
      return c.json({ success: false, error: `최소 ${room.min_nights}박 이상 예약 가능합니다` }, 400)
    }

    // 날짜별 가용 + 가격 합산.
    let roomTotal = 0
    for (let i = 0; i < nights; i++) {
      const d = new Date(new Date(checkIn).getTime() + i * 86400000)
      const ds = d.toISOString().slice(0, 10)
      const dow = d.getDay()
      const isWeekend = dow === 5 || dow === 6
      const cal = await c.env.DB.prepare(
        `SELECT available_count, price_override, is_blocked
           FROM product_stay_calendar WHERE room_id = ? AND stay_date = ?`
      ).bind(roomId, ds).first<{ available_count: number; price_override: number | null; is_blocked: number }>()
        .catch(() => null)
      if (cal?.is_blocked) {
        return c.json({ success: false, error: `${ds} 일자 차단됨` }, 400)
      }
      const avail = cal?.available_count ?? room.total_inventory
      if (avail <= 0) {
        return c.json({ success: false, error: `${ds} 일자 매진` }, 400)
      }
      roomTotal += cal?.price_override ?? (isWeekend ? room.base_price_weekend : room.base_price_weekday)
    }

    // 추가 인원 요금.
    const extraGuests = Math.max(0, guestCount - room.base_guests)
    const extraGuestFee = extraGuests * room.extra_guest_fee * nights
    const totalAmount = roomTotal + extraGuestFee

    // 체크인 코드 생성 (8자리 영숫자).
    const code = generateCheckInCode()

    // 예약 INSERT (status='pending', orders 는 별도 흐름에서 매칭).
    // orders.id 는 결제 흐름에서 채워짐 — 본 endpoint 는 미리 row 만 생성.
    const orderResult = await c.env.DB.prepare(
      `INSERT INTO orders (
         user_id, seller_id, total_amount, status, payment_status,
         shipping_name, shipping_phone, created_at,
         stay_check_in_date, stay_check_out_date, stay_nights
       ) VALUES (?, ?, ?, 'PENDING', 'pending', ?, ?, datetime('now'), ?, ?, ?)`
    ).bind(userId, room.seller_id, totalAmount, guestName, guestPhone, checkIn, checkOut, nights).run()
      .catch(() => null)

    const orderId = orderResult ? Number(orderResult.meta.last_row_id) : 0
    if (!orderId) {
      return c.json({ success: false, error: '주문 생성 실패' }, 500)
    }

    const bookingResult = await c.env.DB.prepare(
      `INSERT INTO stay_bookings (
         order_id, product_id, room_id, seller_id, user_id,
         check_in_date, check_out_date, nights,
         guest_count, guest_name, guest_phone, guest_email, special_request,
         room_total, extra_guest_fee, total_amount,
         status, check_in_code
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).bind(
      orderId, productId, roomId, room.seller_id, userId,
      checkIn, checkOut, nights,
      guestCount, guestName, guestPhone,
      body?.guest_email || null, body?.special_request || null,
      roomTotal, extraGuestFee, totalAmount, code,
    ).run().catch((e: Error) => { throw new Error(`예약 생성 실패: ${e.message}`) })
    const bookingId = Number(bookingResult.meta.last_row_id)

    // orders 의 stay_booking_id 백필.
    await c.env.DB.prepare(`UPDATE orders SET stay_booking_id = ? WHERE id = ?`).bind(bookingId, orderId).run()
      .catch(() => { /* noop */ })

    // 상태 이력.
    await c.env.DB.prepare(
      `INSERT INTO stay_booking_status_log (booking_id, prev_status, new_status, changed_by_role, changed_by_id, reason)
       VALUES (?, NULL, 'pending', 'user', ?, '예약 생성')`
    ).bind(bookingId, userId).run().catch(() => { /* noop */ })

    return c.json({
      success: true,
      data: {
        booking_id: bookingId,
        order_id: orderId,
        total_amount: totalAmount,
        room_total: roomTotal,
        extra_guest_fee: extraGuestFee,
        nights,
        check_in_code: code,
        check_in_date: checkIn,
        check_out_date: checkOut,
      },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

function generateCheckInCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // I/O/1/0 제외 (가독성)
  let out = ''
  for (let i = 0; i < 8; i++) {
    if (i === 4) out += '-'
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

// 🛡️ 2026-05-18 (PR 6): 사용자 예약 취소 — 취소 정책 따른 환불 비율 자동 계산.
staysPublicRoutes.patch('/stays/bookings/:id/cancel', cors(), async (c) => {
  try {
    const auth = c.req.header('Authorization') || ''
    if (!auth.startsWith('Bearer ')) return c.json({ success: false, error: '인증 필요' }, 401)
    const { verify } = await import('hono/jwt')
    const payload = await verify(auth.substring(7), (c.env as unknown as { JWT_SECRET: string }).JWT_SECRET, 'HS256') as { user_id?: number; sub?: string }
    const userId = Number(payload.user_id ?? payload.sub) || null
    if (!userId) return c.json({ success: false, error: '토큰 무효' }, 401)

    const id = Number(c.req.param('id'))
    const cancelBody = await c.req.json<{ reason?: string }>().catch(() => ({} as { reason?: string }))
    const reason = cancelBody?.reason

    const booking = await c.env.DB.prepare(
      `SELECT b.id, b.user_id, b.status, b.total_amount, b.check_in_date, b.product_id, b.order_id,
              psi.cancellation_policy
         FROM stay_bookings b
         LEFT JOIN product_stay_info psi ON psi.product_id = b.product_id
        WHERE b.id = ?`
    ).bind(id).first<{
      id: number; user_id: number; status: string; total_amount: number;
      check_in_date: string; product_id: number; order_id: number;
      cancellation_policy: string | null;
    }>()
    if (!booking) return c.json({ success: false, error: '예약 없음' }, 404)
    if (booking.user_id !== userId) return c.json({ success: false, error: '권한 없음' }, 403)
    if (!['confirmed', 'pending'].includes(booking.status)) {
      return c.json({ success: false, error: `상태 '${booking.status}' 에서 취소 불가` }, 400)
    }

    // 취소 정책 따른 환불 비율 계산.
    const hoursUntil = (new Date(booking.check_in_date).getTime() - Date.now()) / 3600000
    let refundRate = 0
    const policy = booking.cancellation_policy || 'standard'
    if (policy === 'flexible') {
      refundRate = hoursUntil >= 24 ? 1.0 : 0
    } else if (policy === 'standard') {
      refundRate = hoursUntil >= 48 ? 1.0 : (hoursUntil >= 24 ? 0.5 : 0)
    } else if (policy === 'strict') {
      refundRate = hoursUntil >= 72 ? 0.5 : 0
    } else if (policy === 'non_refundable') {
      refundRate = 0
    }
    const refundAmount = Math.floor(booking.total_amount * refundRate)

    // 🛡️ 2026-05-18: 토스 카드 환불 자동 트리거 — refund_amount > 0 인 경우.
    let refundActuallyDone = false
    let refundError: string | null = null
    if (refundAmount > 0) {
      // orders.payment_key 조회.
      const orderRow = await c.env.DB.prepare(
        'SELECT payment_key FROM orders WHERE id = ?'
      ).bind(booking.order_id).first<{ payment_key: string | null }>().catch(() => null)

      if (orderRow?.payment_key) {
        const { tossCancelPayment } = await import('@/worker/utils/toss-refund')
        const result = await tossCancelPayment(c.env as unknown as { TOSS_SECRET_KEY?: string }, orderRow.payment_key, {
          reason: `예약 취소 (정책 ${policy}, ${(refundRate * 100).toFixed(0)}% 환불) — ${reason || '사용자 요청'}`.slice(0, 200),
          amount: refundRate < 1.0 ? refundAmount : undefined,  // 부분 환불일 때만 amount 명시
          idempotencyKey: `stay-cancel-${id}`,
        })
        refundActuallyDone = result.ok
        refundError = result.ok ? null : `${result.error_code}: ${result.error_message}`
      } else {
        refundError = 'payment_key 없음 (수동 환불 필요)'
      }
    }

    await c.env.DB.prepare(
      `UPDATE stay_bookings
          SET status = 'cancelled',
              cancelled_at = datetime('now'),
              cancellation_reason = ?,
              refund_amount = ?,
              refunded_at = ${refundActuallyDone ? "datetime('now')" : 'NULL'},
              updated_at = datetime('now')
        WHERE id = ?`
    ).bind(reason || '사용자 취소', refundAmount, id).run()

    await c.env.DB.prepare(
      `INSERT INTO stay_booking_status_log (booking_id, prev_status, new_status, changed_by_role, changed_by_id, reason)
       VALUES (?, ?, ?, 'user', ?, ?)`
    ).bind(
      id, booking.status,
      refundActuallyDone ? 'refunded' : 'cancelled',
      userId,
      `정책 ${policy}, 환불율 ${(refundRate * 100).toFixed(0)}%${refundError ? `, 환불실패: ${refundError}` : ''}`,
    ).run().catch(() => { /* noop */ })

    return c.json({
      success: true,
      data: {
        refund_amount: refundAmount,
        refund_rate: refundRate,
        refund_done: refundActuallyDone,
        refund_error: refundError,
        policy,
        hours_until_check_in: Math.round(hoursUntil),
      },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 🛡️ 2026-05-18 (PR 6): 리뷰 작성 — 체크아웃 완료 예약만.
staysPublicRoutes.post('/stays/bookings/:id/review', cors(), async (c) => {
  try {
    const auth = c.req.header('Authorization') || ''
    if (!auth.startsWith('Bearer ')) return c.json({ success: false, error: '인증 필요' }, 401)
    const { verify } = await import('hono/jwt')
    const payload = await verify(auth.substring(7), (c.env as unknown as { JWT_SECRET: string }).JWT_SECRET, 'HS256') as { user_id?: number; sub?: string }
    const userId = Number(payload.user_id ?? payload.sub) || null
    if (!userId) return c.json({ success: false, error: '토큰 무효' }, 401)

    const bookingId = Number(c.req.param('id'))
    type ReviewBody = {
      rating_overall?: number; rating_cleanliness?: number; rating_location?: number;
      rating_service?: number; rating_facility?: number; rating_value?: number;
      title?: string; comment?: string; photos?: string[];
    }
    const body = await c.req.json<ReviewBody>().catch(() => ({} as ReviewBody))

    const booking = await c.env.DB.prepare(
      'SELECT id, user_id, product_id, status FROM stay_bookings WHERE id = ?'
    ).bind(bookingId).first<{ id: number; user_id: number; product_id: number; status: string }>()
    if (!booking) return c.json({ success: false, error: '예약 없음' }, 404)
    if (booking.user_id !== userId) return c.json({ success: false, error: '권한 없음' }, 403)
    if (booking.status !== 'checked_out') {
      return c.json({ success: false, error: '체크아웃 완료된 예약만 리뷰 작성 가능' }, 400)
    }

    // 평점 검증 (1-5 범위).
    const r = (v: unknown): number | null => {
      const n = Number(v)
      return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null
    }
    const ratingOverall = r(body.rating_overall)
    if (ratingOverall === null) return c.json({ success: false, error: '전체 평점 필요 (1-5)' }, 400)

    // 중복 체크 (booking_id UNIQUE).
    const dup = await c.env.DB.prepare('SELECT id FROM stay_booking_reviews WHERE booking_id = ?').bind(bookingId).first()
    if (dup) return c.json({ success: false, error: '이미 리뷰가 작성되었습니다' }, 400)

    const photosJson = JSON.stringify(Array.isArray(body.photos) ? body.photos.slice(0, 10) : [])

    await c.env.DB.prepare(
      `INSERT INTO stay_booking_reviews (
         booking_id, product_id, user_id,
         rating_cleanliness, rating_location, rating_service, rating_facility, rating_value, rating_overall,
         title, comment, photos
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      bookingId, booking.product_id, userId,
      r(body.rating_cleanliness), r(body.rating_location), r(body.rating_service),
      r(body.rating_facility), r(body.rating_value), ratingOverall,
      (body.title || '').slice(0, 200), (body.comment || '').slice(0, 5000), photosJson,
    ).run()

    return c.json({ success: true, message: '리뷰가 등록되었습니다' })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 사용자 본인 예약 목록 (마이페이지용).
staysPublicRoutes.get('/stays/my-bookings', cors(), async (c) => {
  try {
    const auth = c.req.header('Authorization') || ''
    if (!auth.startsWith('Bearer ')) return c.json({ success: false, error: '인증 필요' }, 401)
    const { verify } = await import('hono/jwt')
    const payload = await verify(auth.substring(7), (c.env as unknown as { JWT_SECRET: string }).JWT_SECRET, 'HS256') as { user_id?: number; sub?: string }
    const userId = Number(payload.user_id ?? payload.sub) || null
    if (!userId) return c.json({ success: false, error: '토큰 무효' }, 401)

    const rows = await c.env.DB.prepare(
      `SELECT b.*, p.name as product_name, r.name as room_name, p.image_url
         FROM stay_bookings b
         LEFT JOIN products p ON p.id = b.product_id
         LEFT JOIN product_stay_rooms r ON r.id = b.room_id
        WHERE b.user_id = ?
        ORDER BY b.check_in_date DESC LIMIT 100`
    ).bind(userId).all<Record<string, unknown>>().catch(() => ({ results: [] }))
    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 리뷰 목록
staysPublicRoutes.get('/stays/:productId/reviews', cors(), async (c) => {
  try {
    const productId = Number(c.req.param('productId'))
    if (!Number.isFinite(productId)) return c.json({ success: false, error: 'Invalid productId' }, 400)
    const sort = c.req.query('sort') || 'recent' // recent / rating

    let order = 'created_at DESC'
    if (sort === 'rating_desc') order = 'rating_overall DESC, created_at DESC'
    if (sort === 'rating_asc') order = 'rating_overall ASC, created_at DESC'
    if (sort === 'helpful') order = 'helpful_count DESC, created_at DESC'

    const rows = await c.env.DB.prepare(
      `SELECT r.id, r.user_id, r.title, r.comment, r.photos,
              r.rating_overall, r.rating_cleanliness, r.rating_location,
              r.rating_service, r.rating_facility, r.rating_value,
              r.seller_reply, r.seller_replied_at,
              r.helpful_count, r.created_at,
              u.name as user_name,
              b.check_in_date, b.nights
         FROM stay_booking_reviews r
         LEFT JOIN users u ON u.id = r.user_id
         LEFT JOIN stay_bookings b ON b.id = r.booking_id
        WHERE r.product_id = ? AND r.is_visible = 1
        ORDER BY ${order}
        LIMIT 50`
    ).bind(productId).all<Record<string, unknown>>().catch(() => ({ results: [] }))

    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})
