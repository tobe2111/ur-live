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
import { safeError } from '../../../worker/utils/safe-error'
import { releaseStayInventory } from '../../../worker/utils/stay-inventory'

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
    // 🛡️ 2026-05-18: 판매 방식 필터 (date / voucher / 빈 값=전체).
    //   'both' 등록된 상품은 두 모드 검색 모두 노출.
    const saleMode = c.req.query('sale_mode') || ''
    if (saleMode === 'date') {
      sql += " AND psi.sale_mode IN ('date', 'both')"
    } else if (saleMode === 'voucher') {
      sql += " AND psi.sale_mode IN ('voucher', 'both')"
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
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[stays-public]')
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
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[stays-public]')
  }
})

// 가용성 — 특정 기간의 객실별 잔여 + 가격 계산
//   ?ref=USER_ID 시 인플루언서 할인 적용 가격도 반환 (referral_enabled + discount_pct > 0).
staysPublicRoutes.get('/stays/:productId/availability', cors(), async (c) => {
  try {
    const productId = Number(c.req.param('productId'))
    const checkIn = c.req.query('check_in') || ''
    const checkOut = c.req.query('check_out') || ''
    const refId = c.req.query('ref') || ''
    if (!Number.isFinite(productId)) return c.json({ success: false, error: 'Invalid productId' }, 400)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
      return c.json({ success: false, error: '체크인/체크아웃 날짜 형식 오류' }, 400)
    }
    const nights = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
    if (nights < 1) return c.json({ success: false, error: '체크아웃은 체크인 이후여야 합니다' }, 400)

    // 인플 referral 할인 정보.
    let discountPct = 0
    if (refId) {
      const info = await c.env.DB.prepare(
        `SELECT referral_enabled, influencer_discount_pct
           FROM product_stay_info WHERE product_id = ?`
      ).bind(productId).first<{ referral_enabled: number | null; influencer_discount_pct: number | null }>()
        .catch(() => null)
      if (info?.referral_enabled && (info.influencer_discount_pct || 0) > 0) {
        // referrer 유효 검증.
        const referrer = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?')
          .bind(refId).first<{ id: string }>().catch(() => null)
        if (referrer) discountPct = Math.min(50, Math.max(0, Number(info.influencer_discount_pct) || 0))
      }
    }

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

      // 🛡️ 2026-05-18: 인플 referral 시 할인 가격 계산.
      const discountedTotal = discountPct > 0 ? Math.floor(total * (100 - discountPct) / 100) : total
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
        discounted_price: discountedTotal,
        discount_pct: discountPct,
        nights,
        avg_per_night: nights > 0 ? Math.round(total / nights) : 0,
        avg_per_night_discounted: nights > 0 ? Math.round(discountedTotal / nights) : 0,
        dates,
      })
    }

    return c.json({
      success: true,
      data: {
        rooms: result, nights, check_in: checkIn, check_out: checkOut,
        referral: { active: discountPct > 0, discount_pct: discountPct, referrer_id: discountPct > 0 ? refId : null },
      },
    })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[stays-public]')
  }
})

// 🛡️ 2026-05-18: 예약 생성 — date 모드 (날짜 지정) + voucher 모드 (기간 무관) 둘 다 지원.
//   date 모드: body.check_in_date / check_out_date + room_id 필수.
//   voucher 모드: body.voucher_type ('weekday' | 'weekend') 필수, 날짜 없음.
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
      // date 모드.
      check_in_date?: string; check_out_date?: string;
      // voucher 모드.
      sale_mode?: 'date' | 'voucher';
      voucher_type?: 'weekday' | 'weekend';
      voucher_nights?: number;       // 1박/2박 voucher 갯수 (default 1)
      // 공통.
      guest_count?: number; guest_name?: string; guest_phone?: string;
      guest_email?: string; special_request?: string;
      referrer_id?: string | number;  // 인플 referral
    }
    const body = await c.req.json<CreateBookingBody>().catch(() => ({} as CreateBookingBody))

    const productId = Number(body?.product_id)
    const roomId = Number(body?.room_id)
    const saleMode = body?.sale_mode === 'voucher' ? 'voucher' : 'date'
    const guestCount = Math.max(1, Number(body?.guest_count) || 1)
    const guestName = String(body?.guest_name || '').trim()
    const guestPhone = String(body?.guest_phone || '').trim()

    if (!Number.isFinite(productId) || !Number.isFinite(roomId)) {
      return c.json({ success: false, error: 'product_id / room_id 필요' }, 400)
    }
    if (!guestName || !guestPhone) return c.json({ success: false, error: '게스트 이름/전화번호 필수' }, 400)

    // 모드별 검증.
    const checkIn = saleMode === 'date' ? String(body?.check_in_date || '') : ''
    const checkOut = saleMode === 'date' ? String(body?.check_out_date || '') : ''
    const voucherType = saleMode === 'voucher' ? (body?.voucher_type === 'weekend' ? 'weekend' : 'weekday') : null
    const voucherNights = saleMode === 'voucher' ? Math.max(1, Math.min(7, Number(body?.voucher_nights) || 1)) : 0

    let nights = 0
    if (saleMode === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
        return c.json({ success: false, error: '체크인/체크아웃 날짜 형식 오류' }, 400)
      }
      nights = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
      if (nights < 1) return c.json({ success: false, error: '체크아웃은 체크인 이후여야 합니다' }, 400)
    } else {
      nights = voucherNights
    }

    // 객실 + 숙소 정보 조회 (sale_mode + voucher + referral 필드 포함).
    const room = await c.env.DB.prepare(
      `SELECT r.id, r.product_id, r.name, r.base_guests, r.max_guests, r.extra_guest_fee,
              r.base_price_weekday, r.base_price_weekend, r.base_price_holiday, r.total_inventory,
              p.seller_id, p.name as product_name,
              psi.min_nights, psi.advance_booking_days,
              psi.referral_enabled, psi.influencer_discount_pct, psi.influencer_commission_pct,
              psi.sale_mode, psi.voucher_validity_days,
              psi.voucher_weekday_only, psi.voucher_weekend_only
         FROM product_stay_rooms r
         INNER JOIN products p ON p.id = r.product_id
         LEFT JOIN product_stay_info psi ON psi.product_id = p.id
        WHERE r.id = ? AND r.product_id = ? AND r.is_active = 1`
    ).bind(roomId, productId).first<{
      id: number; product_id: number; name: string; base_guests: number; max_guests: number; extra_guest_fee: number;
      base_price_weekday: number; base_price_weekend: number; base_price_holiday: number | null; total_inventory: number;
      seller_id: number; product_name: string; min_nights: number | null; advance_booking_days: number | null;
      referral_enabled: number | null; influencer_discount_pct: number | null; influencer_commission_pct: number | null;
      sale_mode: string | null; voucher_validity_days: number | null;
      voucher_weekday_only: number | null; voucher_weekend_only: number | null;
    }>()
    if (!room) return c.json({ success: false, error: '객실 없음' }, 404)
    if (guestCount > room.max_guests) {
      return c.json({ success: false, error: `최대 ${room.max_guests}인까지 가능합니다` }, 400)
    }

    // 모드 호환성 검증 — 셀러가 허용한 모드인지.
    const allowedMode = room.sale_mode || 'date'
    if (allowedMode !== 'both' && allowedMode !== saleMode) {
      return c.json({ success: false, error: `이 숙소는 ${allowedMode === 'voucher' ? '숙소권 (날짜 미지정)' : '날짜 지정'} 모드만 지원합니다` }, 400)
    }
    if (saleMode === 'voucher') {
      if (voucherType === 'weekday' && room.voucher_weekend_only) {
        return c.json({ success: false, error: '주말권만 판매 중입니다' }, 400)
      }
      if (voucherType === 'weekend' && room.voucher_weekday_only) {
        return c.json({ success: false, error: '평일권만 판매 중입니다' }, 400)
      }
    }
    if (saleMode === 'date' && room.min_nights && nights < room.min_nights) {
      return c.json({ success: false, error: `최소 ${room.min_nights}박 이상 예약 가능합니다` }, 400)
    }

    // 가격 계산 — 모드별 분기.
    let roomTotal = 0
    if (saleMode === 'date') {
      // 날짜별 가용 + 가격 합산 (캘린더 우선).
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
        if (cal?.is_blocked) return c.json({ success: false, error: `${ds} 일자 차단됨` }, 400)
        const avail = cal?.available_count ?? room.total_inventory
        if (avail <= 0) return c.json({ success: false, error: `${ds} 일자 매진` }, 400)
        roomTotal += cal?.price_override ?? (isWeekend ? room.base_price_weekend : room.base_price_weekday)
      }
    } else {
      // voucher 모드 — 평일/주말 가격 × nights.
      const perNight = voucherType === 'weekend' ? room.base_price_weekend : room.base_price_weekday
      roomTotal = perNight * nights
    }

    // 추가 인원 요금.
    const extraGuests = Math.max(0, guestCount - room.base_guests)
    const extraGuestFee = extraGuests * room.extra_guest_fee * nights
    const subtotal = roomTotal + extraGuestFee

    // 🛡️ 2026-05-18: 인플루언서 referral 할인 + 커미션 계산.
    let discountAmount = 0
    let commissionAmount = 0
    let validatedReferrerId: string | null = null
    if (body?.referrer_id && room.referral_enabled && (room.influencer_discount_pct || 0) > 0) {
      const refId = String(body.referrer_id).trim()
      // self-referral 차단.
      if (refId !== String(userId)) {
        // referrer 가 유효한 user 인지 검증 (active 인플 또는 일반 사용자).
        const referrer = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?')
          .bind(refId).first<{ id: string }>().catch(() => null)
        if (referrer) {
          validatedReferrerId = refId
          const discountPct = Math.min(50, Math.max(0, Number(room.influencer_discount_pct) || 0))  // 50% 안전 상한
          discountAmount = Math.floor(subtotal * discountPct / 100)
          // 🛡️ 2026-05-22 정책 중앙화 — COMMISSION_DEFAULTS.STAYS_COMMISSION_CAP_PCT
          const { COMMISSION_DEFAULTS } = await import('../../../shared/constants/policy')
          const commissionPct = Math.min(COMMISSION_DEFAULTS.STAYS_COMMISSION_CAP_PCT, Math.max(0, Number(room.influencer_commission_pct) || 0))
          commissionAmount = Math.floor((subtotal - discountAmount) * commissionPct / 100)
        }
      }
    }

    const totalAmount = subtotal - discountAmount

    // 체크인 코드 생성 (8자리 영숫자).
    const code = generateCheckInCode()

    // 🏭 2026-06-05 (B1 견고화 — 미결제 pending 무제한 누적 방지, anti-abuse):
    //   재고는 confirm 에서 차감되고 오버부킹은 가드됨(이중예약 X). 여기선 활성 pending 상한만 둔다.
    //   30분 window = stay-pending-expire cron 의 만료 기준과 동일. 재고 미조작 → 누수 위험 0.
    const activePending = await c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM stay_bookings WHERE user_id = ? AND status = 'pending' AND created_at > datetime('now', '-30 minutes')`
    ).bind(userId).first<{ n: number }>().catch(() => null)
    if ((activePending?.n ?? 0) >= 8) {
      return c.json({ success: false, error: '진행 중인 미결제 예약이 많습니다. 기존 예약을 결제하거나 잠시 후 다시 시도해주세요.' }, 429)
    }

    // 예약 INSERT (status='pending', orders 는 별도 흐름에서 매칭).
    //   voucher 모드는 stay_check_in_date / out 가 NULL (사용 시 셀러와 협의).
    const orderResult = await c.env.DB.prepare(
      `INSERT INTO orders (
         user_id, seller_id, total_amount, status, payment_status,
         shipping_name, shipping_phone, created_at,
         stay_check_in_date, stay_check_out_date, stay_nights
       ) VALUES (?, ?, ?, 'PENDING', 'pending', ?, ?, datetime('now'), ?, ?, ?)`
    ).bind(
      userId, room.seller_id, totalAmount, guestName, guestPhone,
      saleMode === 'date' ? checkIn : null,
      saleMode === 'date' ? checkOut : null,
      nights,
    ).run().catch(() => null)

    const orderId = orderResult ? Number(orderResult.meta.last_row_id) : 0
    if (!orderId) {
      return c.json({ success: false, error: '주문 생성 실패' }, 500)
    }

    // voucher 모드는 유효기간 계산 (default 180일).
    const voucherValidityDays = Number(room.voucher_validity_days) || 180
    const voucherExpiresAt = saleMode === 'voucher'
      ? new Date(Date.now() + voucherValidityDays * 86400000).toISOString().slice(0, 19).replace('T', ' ')
      : null

    // 날짜 모드: check_in_date / check_out_date 저장. voucher: NULL.
    const bindCheckIn = saleMode === 'date' ? checkIn : null
    const bindCheckOut = saleMode === 'date' ? checkOut : null

    const bookingResult = await c.env.DB.prepare(
      `INSERT INTO stay_bookings (
         order_id, product_id, room_id, seller_id, user_id,
         check_in_date, check_out_date, nights,
         guest_count, guest_name, guest_phone, guest_email, special_request,
         room_total, extra_guest_fee, total_amount,
         status, check_in_code,
         referrer_id, discount_amount, influencer_commission_amount,
         sale_mode, voucher_type, voucher_expires_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      orderId, productId, roomId, room.seller_id, userId,
      bindCheckIn, bindCheckOut, nights,
      guestCount, guestName, guestPhone,
      body?.guest_email || null, body?.special_request || null,
      roomTotal, extraGuestFee, totalAmount, code,
      validatedReferrerId, discountAmount, commissionAmount,
      saleMode, voucherType, voucherExpiresAt,
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
        subtotal,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        room_total: roomTotal,
        extra_guest_fee: extraGuestFee,
        commission_amount: commissionAmount,
        referrer_id: validatedReferrerId,
        nights,
        check_in_code: code,
        sale_mode: saleMode,
        // date 모드:
        check_in_date: bindCheckIn,
        check_out_date: bindCheckOut,
        // voucher 모드:
        voucher_type: voucherType,
        voucher_expires_at: voucherExpiresAt,
      },
    })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[stays-public]')
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

// 🛡️ 2026-05-19: 다객실 한 번에 결제 (multi-room single payment).
//   가족/친구 단위 예약 — 1 order_id, N stay_bookings.
//
//   제약:
//     - 모든 items 가 같은 product_id (= 같은 seller).
//     - items 최대 10개 (단일 결제 한도).
//     - 모든 items 가 같은 sale_mode (혼합 불가).
//     - 각 item 마다 별도 booking row + 캘린더 차감 + 체크인 코드.
//     - 1 order 의 total_amount 는 모든 item 의 합.
//
//   응답: { order_id, bookings: [...], total_amount, items: [...] }
staysPublicRoutes.post('/stays/bookings/create-multi', cors(), async (c) => {
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

    type Item = {
      room_id: number;
      check_in_date?: string; check_out_date?: string;       // date 모드
      voucher_type?: 'weekday' | 'weekend'; voucher_nights?: number;  // voucher 모드
      guest_count?: number;
    }
    type Body = {
      product_id?: number;
      sale_mode?: 'date' | 'voucher';
      guest_name?: string; guest_phone?: string; guest_email?: string;
      special_request?: string; referrer_id?: string | number;
      items?: Item[];
    }
    const body = await c.req.json<Body>().catch(() => ({} as Body))
    const productId = Number(body?.product_id)
    const saleMode = body?.sale_mode === 'voucher' ? 'voucher' : 'date'
    const guestName = String(body?.guest_name || '').trim()
    const guestPhone = String(body?.guest_phone || '').trim()
    const items = Array.isArray(body?.items) ? body.items : []

    if (!Number.isFinite(productId)) return c.json({ success: false, error: 'product_id 필요' }, 400)
    if (items.length === 0) return c.json({ success: false, error: 'items 비어 있음' }, 400)
    if (items.length > 10) return c.json({ success: false, error: '최대 10개 객실까지 한 번에 결제 가능' }, 400)
    if (!guestName || !guestPhone) return c.json({ success: false, error: '게스트 이름/전화번호 필수' }, 400)

    // 1. 한 번에 모든 객실 조회 (모두 같은 product 인지 검증).
    const roomIds = items.map((it) => Number(it.room_id)).filter((id) => Number.isFinite(id))
    if (roomIds.length !== items.length) return c.json({ success: false, error: '모든 item 에 room_id 필요' }, 400)

    const placeholders = roomIds.map(() => '?').join(',')
    const rooms = await c.env.DB.prepare(
      `SELECT r.id, r.product_id, r.name, r.base_guests, r.max_guests, r.extra_guest_fee,
              r.base_price_weekday, r.base_price_weekend, r.total_inventory,
              p.seller_id,
              psi.min_nights, psi.referral_enabled,
              psi.influencer_discount_pct, psi.influencer_commission_pct,
              psi.sale_mode, psi.voucher_validity_days,
              psi.voucher_weekday_only, psi.voucher_weekend_only
         FROM product_stay_rooms r
         INNER JOIN products p ON p.id = r.product_id
         LEFT JOIN product_stay_info psi ON psi.product_id = p.id
        WHERE r.id IN (${placeholders}) AND r.product_id = ? AND r.is_active = 1`
    ).bind(...roomIds, productId).all<{
      id: number; product_id: number; name: string; base_guests: number; max_guests: number; extra_guest_fee: number;
      base_price_weekday: number; base_price_weekend: number; total_inventory: number;
      seller_id: number; min_nights: number | null; referral_enabled: number | null;
      influencer_discount_pct: number | null; influencer_commission_pct: number | null;
      sale_mode: string | null; voucher_validity_days: number | null;
      voucher_weekday_only: number | null; voucher_weekend_only: number | null;
    }>().catch(() => ({ results: [] }))

    const roomMap = new Map((rooms.results || []).map((r) => [r.id, r]))
    if (roomMap.size !== items.length) {
      return c.json({ success: false, error: '일부 객실이 존재하지 않거나 다른 숙소 소속입니다' }, 400)
    }

    // 모든 객실이 같은 product → 같은 seller.
    const firstRoom = (rooms.results || [])[0]
    const sellerId = firstRoom.seller_id
    const allowedMode = firstRoom.sale_mode || 'date'
    if (allowedMode !== 'both' && allowedMode !== saleMode) {
      return c.json({ success: false, error: `이 숙소는 ${allowedMode === 'voucher' ? '숙소권' : '날짜 지정'} 모드만 지원합니다` }, 400)
    }

    // 2. 각 item 별 가격 계산 + 검증.
    type Prepared = {
      item: Item; room: typeof firstRoom; nights: number;
      roomTotal: number; extraGuestFee: number; subtotal: number;
      checkIn: string; checkOut: string;
      voucherType: 'weekday' | 'weekend' | null; voucherExpiresAt: string | null;
      guestCount: number;
    }
    const prepared: Prepared[] = []
    for (const it of items) {
      const room = roomMap.get(Number(it.room_id))!
      const guestCount = Math.max(1, Number(it.guest_count) || 1)
      if (guestCount > room.max_guests) {
        return c.json({ success: false, error: `${room.name}: 최대 ${room.max_guests}인` }, 400)
      }

      let nights = 0
      let checkIn = ''; let checkOut = ''
      let voucherType: 'weekday' | 'weekend' | null = null
      let voucherExpiresAt: string | null = null

      if (saleMode === 'date') {
        checkIn = String(it.check_in_date || '')
        checkOut = String(it.check_out_date || '')
        if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
          return c.json({ success: false, error: `${room.name}: 날짜 형식 오류` }, 400)
        }
        nights = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
        if (nights < 1) return c.json({ success: false, error: `${room.name}: 체크아웃은 체크인 이후` }, 400)
        if (room.min_nights && nights < room.min_nights) {
          return c.json({ success: false, error: `${room.name}: 최소 ${room.min_nights}박` }, 400)
        }
      } else {
        voucherType = it.voucher_type === 'weekend' ? 'weekend' : 'weekday'
        nights = Math.max(1, Math.min(7, Number(it.voucher_nights) || 1))
        if (voucherType === 'weekday' && room.voucher_weekend_only) return c.json({ success: false, error: `${room.name}: 주말권만 판매 중` }, 400)
        if (voucherType === 'weekend' && room.voucher_weekday_only) return c.json({ success: false, error: `${room.name}: 평일권만 판매 중` }, 400)
        const days = Number(room.voucher_validity_days) || 180
        voucherExpiresAt = new Date(Date.now() + days * 86400000).toISOString().slice(0, 19).replace('T', ' ')
      }

      // 가격 계산.
      let roomTotal = 0
      if (saleMode === 'date') {
        for (let i = 0; i < nights; i++) {
          const d = new Date(new Date(checkIn).getTime() + i * 86400000)
          const ds = d.toISOString().slice(0, 10)
          const isWeekend = d.getDay() === 5 || d.getDay() === 6
          const cal = await c.env.DB.prepare(
            `SELECT available_count, price_override, is_blocked
               FROM product_stay_calendar WHERE room_id = ? AND stay_date = ?`
          ).bind(room.id, ds).first<{ available_count: number; price_override: number | null; is_blocked: number }>()
            .catch(() => null)
          if (cal?.is_blocked) return c.json({ success: false, error: `${room.name} ${ds}: 차단됨` }, 400)
          const avail = cal?.available_count ?? room.total_inventory
          if (avail <= 0) return c.json({ success: false, error: `${room.name} ${ds}: 매진` }, 400)
          roomTotal += cal?.price_override ?? (isWeekend ? room.base_price_weekend : room.base_price_weekday)
        }
      } else {
        const perNight = voucherType === 'weekend' ? room.base_price_weekend : room.base_price_weekday
        roomTotal = perNight * nights
      }

      const extra = Math.max(0, guestCount - room.base_guests) * room.extra_guest_fee * nights
      prepared.push({
        item: it, room, nights, roomTotal, extraGuestFee: extra,
        subtotal: roomTotal + extra, checkIn, checkOut,
        voucherType, voucherExpiresAt, guestCount,
      })
    }

    const grandSubtotal = prepared.reduce((s, p) => s + p.subtotal, 0)

    // 3. Referral — 1 order 단위로 적용 (모든 booking 에 분산은 안 함, order 합계 기준).
    let discountAmount = 0
    let commissionAmount = 0
    let validatedReferrerId: string | null = null
    if (body?.referrer_id && firstRoom.referral_enabled && (firstRoom.influencer_discount_pct || 0) > 0) {
      const refId = String(body.referrer_id).trim()
      if (refId !== String(userId)) {
        const referrer = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(refId).first<{ id: string }>().catch(() => null)
        if (referrer) {
          validatedReferrerId = refId
          const discountPct = Math.min(50, Math.max(0, Number(firstRoom.influencer_discount_pct) || 0))
          discountAmount = Math.floor(grandSubtotal * discountPct / 100)
          // 🛡️ 2026-05-22 정책 중앙화 — COMMISSION_DEFAULTS.STAYS_COMMISSION_CAP_PCT
          const { COMMISSION_DEFAULTS } = await import('../../../shared/constants/policy')
          const commissionPct = Math.min(COMMISSION_DEFAULTS.STAYS_COMMISSION_CAP_PCT, Math.max(0, Number(firstRoom.influencer_commission_pct) || 0))
          commissionAmount = Math.floor((grandSubtotal - discountAmount) * commissionPct / 100)
        }
      }
    }
    const totalAmount = grandSubtotal - discountAmount

    // 🏭 2026-06-05 (B1 견고화 — 미결제 pending 무제한 누적 방지, anti-abuse): 활성 pending 상한.
    const activePendingMulti = await c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM stay_bookings WHERE user_id = ? AND status = 'pending' AND created_at > datetime('now', '-30 minutes')`
    ).bind(userId).first<{ n: number }>().catch(() => null)
    if ((activePendingMulti?.n ?? 0) >= 8) {
      return c.json({ success: false, error: '진행 중인 미결제 예약이 많습니다. 기존 예약을 결제하거나 잠시 후 다시 시도해주세요.' }, 429)
    }

    // 4. orders INSERT (한 개).
    const totalNights = prepared.reduce((s, p) => s + p.nights, 0)
    const orderResult = await c.env.DB.prepare(
      `INSERT INTO orders (
         user_id, seller_id, total_amount, status, payment_status,
         shipping_name, shipping_phone, created_at,
         stay_check_in_date, stay_check_out_date, stay_nights
       ) VALUES (?, ?, ?, 'PENDING', 'pending', ?, ?, datetime('now'), ?, ?, ?)`
    ).bind(
      userId, sellerId, totalAmount, guestName, guestPhone,
      saleMode === 'date' ? prepared[0].checkIn : null,
      saleMode === 'date' ? prepared[0].checkOut : null,
      totalNights,
    ).run().catch(() => null)
    const orderId = orderResult ? Number(orderResult.meta.last_row_id) : 0
    if (!orderId) return c.json({ success: false, error: '주문 생성 실패' }, 500)

    // 5. 각 item 별 stay_bookings INSERT.
    //   discount/commission 는 비례 분배 (proportional).
    const bookings: Array<{ booking_id: number; room_id: number; subtotal: number; check_in_code: string }> = []
    for (const p of prepared) {
      const share = grandSubtotal > 0 ? p.subtotal / grandSubtotal : 1 / prepared.length
      const itemDiscount = Math.floor(discountAmount * share)
      const itemCommission = Math.floor(commissionAmount * share)
      const itemTotal = p.subtotal - itemDiscount
      const code = generateCheckInCode()

      const br = await c.env.DB.prepare(
        `INSERT INTO stay_bookings (
           order_id, product_id, room_id, seller_id, user_id,
           check_in_date, check_out_date, nights,
           guest_count, guest_name, guest_phone, guest_email, special_request,
           room_total, extra_guest_fee, total_amount,
           status, check_in_code,
           referrer_id, discount_amount, influencer_commission_amount,
           sale_mode, voucher_type, voucher_expires_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        orderId, productId, p.room.id, sellerId, userId,
        saleMode === 'date' ? p.checkIn : null,
        saleMode === 'date' ? p.checkOut : null,
        p.nights,
        p.guestCount, guestName, guestPhone,
        body?.guest_email || null, body?.special_request || null,
        p.roomTotal, p.extraGuestFee, itemTotal, code,
        validatedReferrerId, itemDiscount, itemCommission,
        saleMode, p.voucherType, p.voucherExpiresAt,
      ).run().catch((e: Error) => { throw new Error(`booking 생성 실패 (room ${p.room.id}): ${e.message}`) })

      const bid = Number(br.meta.last_row_id)
      bookings.push({ booking_id: bid, room_id: p.room.id, subtotal: itemTotal, check_in_code: code })

      await c.env.DB.prepare(
        `INSERT INTO stay_booking_status_log (booking_id, prev_status, new_status, changed_by_role, changed_by_id, reason)
         VALUES (?, NULL, 'pending', 'user', ?, '다객실 예약 생성')`
      ).bind(bid, userId).run().catch(() => { /* noop */ })
    }

    // 6. orders.stay_booking_id 는 첫 booking 기준 백필 (legacy 호환 — 다객실은 별도 stay_bookings 쿼리).
    if (bookings.length > 0) {
      await c.env.DB.prepare('UPDATE orders SET stay_booking_id = ? WHERE id = ?')
        .bind(bookings[0].booking_id, orderId).run().catch(() => { /* noop */ })
    }

    return c.json({
      success: true,
      data: {
        order_id: orderId,
        bookings,
        total_amount: totalAmount,
        subtotal: grandSubtotal,
        discount_amount: discountAmount,
        commission_amount: commissionAmount,
        referrer_id: validatedReferrerId,
        sale_mode: saleMode,
        items_count: prepared.length,
      },
    })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[stays-public]')
  }
})

// 🛡️ 2026-06-12 (전수조사 4차 B-1): 숙소 결제 페이지용 주문 요약 조회.
//   /checkout?order_id=N&stay=1 분기 (StayCheckout) 가 서버 금액/예약 내역을 표시할 때 사용.
//   금액은 항상 서버 orders.total_amount — 클라이언트 재계산 금지.
staysPublicRoutes.get('/stays/orders/:orderId', cors(), async (c) => {
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

    const orderId = Number(c.req.param('orderId'))
    if (!Number.isFinite(orderId)) return c.json({ success: false, error: 'Invalid orderId' }, 400)

    const order = await c.env.DB.prepare(
      `SELECT id, user_id, total_amount, status, payment_status, stay_booking_id
         FROM orders WHERE id = ?`
    ).bind(orderId).first<{
      id: number; user_id: number | string; total_amount: number;
      status: string; payment_status: string; stay_booking_id: number | null;
    }>()
    if (!order) return c.json({ success: false, error: '주문 없음' }, 404)
    if (String(order.user_id) !== String(userId)) return c.json({ success: false, error: '권한 없음' }, 403)
    if (!order.stay_booking_id) return c.json({ success: false, error: '숙소 예약 주문이 아닙니다' }, 400)

    const bookings = await c.env.DB.prepare(
      `SELECT b.id, b.room_id, b.check_in_date, b.check_out_date, b.nights,
              b.guest_count, b.guest_name, b.status, b.total_amount,
              b.sale_mode, b.voucher_type, b.voucher_expires_at,
              p.name as product_name, p.image_url, r.name as room_name
         FROM stay_bookings b
         LEFT JOIN products p ON p.id = b.product_id
         LEFT JOIN product_stay_rooms r ON r.id = b.room_id
        WHERE b.order_id = ?
        ORDER BY b.id`
    ).bind(orderId).all<Record<string, unknown>>().catch(() => ({ results: [] }))

    return c.json({
      success: true,
      data: {
        order: {
          id: order.id,
          total_amount: order.total_amount,
          status: order.status,
          payment_status: order.payment_status,
        },
        bookings: bookings.results || [],
      },
    })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[stays-public]')
  }
})

// 🛡️ 2026-05-18: 숙소 결제 confirm — 토스 결제 페이지 returnUrl 에서 호출.
//   흐름:
//     1) /stays/:id 에서 예약 생성 → orders + stay_bookings (status='pending')
//     2) /checkout?order_id=...&stay=1 에서 토스 위젯 결제 (Toss orderId = 'STAY-{orders.id}')
//     3) 결제 성공 → returnUrl=/stays/checkout-return?order_id=...&paymentKey=...&amount=...
//     4) 클라이언트가 이 endpoint 호출 → 토스 confirm API + booking status='confirmed'
//     5) 캘린더 available_count 차감 (race condition 가드)
//   🛡️ 2026-06-12 (전수조사 4차 B-2 다객실 confirm 단일화): orders.stay_booking_id(첫 booking)만
//     confirmed 하던 것을 stay_bookings WHERE order_id=? 전체 루프로 — 각 booking CAS + 달력 차감.
//     단건 주문은 루프가 1건이라 기존 동작과 동일.
staysPublicRoutes.post('/stays/bookings/confirm', cors(), async (c) => {
  try {
    const auth = c.req.header('Authorization') || ''
    if (!auth.startsWith('Bearer ')) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const { verify } = await import('hono/jwt')
    const payload = await verify(auth.substring(7), (c.env as unknown as { JWT_SECRET: string }).JWT_SECRET, 'HS256') as { user_id?: number; sub?: string }
    const userId = Number(payload.user_id ?? payload.sub) || null
    if (!userId) return c.json({ success: false, error: '토큰 무효' }, 401)

    type ConfirmBody = { paymentKey?: string; orderId?: number; amount?: number }
    const body = await c.req.json<ConfirmBody>().catch(() => ({} as ConfirmBody))
    const paymentKey = String(body?.paymentKey || '').trim()
    const orderId = Number(body?.orderId)
    const clientAmount = Number(body?.amount)

    if (!paymentKey || !Number.isFinite(orderId)) {
      return c.json({ success: false, error: 'paymentKey + orderId 필요' }, 400)
    }

    // 1. orders + 해당 주문의 모든 stay_bookings 조회 (서버 신뢰 데이터 — 클라이언트 amount 검증 후 사용).
    const order = await c.env.DB.prepare(
      `SELECT id, user_id, total_amount, status, payment_status, stay_booking_id, payment_key
         FROM orders WHERE id = ?`
    ).bind(orderId).first<{
      id: number; user_id: number; total_amount: number; status: string; payment_status: string;
      stay_booking_id: number | null; payment_key: string | null;
    }>()
    if (!order) return c.json({ success: false, error: '주문 없음' }, 404)
    if (String(order.user_id) !== String(userId)) return c.json({ success: false, error: '권한 없음' }, 403)
    if (!order.stay_booking_id) return c.json({ success: false, error: '숙소 예약이 아닙니다' }, 400)

    // 🛡️ 2026-06-12 (B-2): 다객실 주문(create-multi) 포함 — 주문의 모든 booking 대상.
    type ConfirmBooking = {
      id: number; room_id: number | null; product_id: number | null;
      check_in_date: string | null; check_out_date: string | null;
      status: string; sale_mode: string | null;
    }
    const allBookingsRes = await c.env.DB.prepare(
      `SELECT id, room_id, product_id, check_in_date, check_out_date, status, sale_mode
         FROM stay_bookings WHERE order_id = ? ORDER BY id`
    ).bind(orderId).all<ConfirmBooking>().catch(() => ({ results: [] as ConfirmBooking[] }))
    const allBookings = allBookingsRes.results || []
    if (allBookings.length === 0) return c.json({ success: false, error: '숙소 예약이 아닙니다' }, 400)

    // 2. 멱등 — 이미 승인 + 모든 booking 이 pending 아님 → skip (재호출 안전).
    if (order.payment_status === 'approved' && allBookings.every((b) => b.status !== 'pending')) {
      return c.json({ success: true, message: '이미 결제 완료', data: { booking_id: order.stay_booking_id } })
    }

    // 3. 클라이언트 amount 검증 (서버 total_amount 와 일치).
    if (!Number.isFinite(clientAmount) || clientAmount !== order.total_amount) {
      return c.json({ success: false, error: '결제 금액 불일치 (변조 의심)' }, 400)
    }

    // 🛡️ 2026-05-22 옵션 B: toss-gateway 헬퍼 사용 — circuit / idempotency / 에러 표준화.
    // 🛡️ 2026-06-12 (B-1): Toss orderId 는 위젯 결제(requestPayment)와 동일한 'STAY-{orders.id}'.
    //   Toss orderId 최소 6자 요건 — 순수 숫자 orders.id 는 미충족. prefix 표준은 toss-gateway
    //   generateTossOrderId 의 'STAY' 와 동일 (결제 시작/승인 양쪽이 같은 문자열이어야 승인 성공).
    const tossOrderId = `STAY-${orderId}`
    const { confirmTossPayment } = await import('../../../worker/utils/toss-gateway')
    const tossResult = await confirmTossPayment({
      env: c.env as unknown as { TOSS_SECRET_KEY?: string },
      paymentKey,
      orderId: tossOrderId,
      amount: order.total_amount,
      idempotencyKey: `stay-confirm-${orderId}`,
    })

    if (!tossResult.ok) {
      // booking status 유지 (pending) — 사용자 재시도 가능.
      return c.json({ success: false, error: `${tossResult.code || tossResult.status}: ${tossResult.message}` },
        tossResult.status === 'CIRCUIT_OPEN' ? 503 : 400)
    }
    const tossData = tossResult.data as Record<string, unknown>

    // 🛡️ 2026-06-11 동시요청 race 가드: Toss 승인 후 각 booking 을 CAS 로 claim.
    //   기존 구멍: 같은 order 의 동시/더블탭 confirm 이 둘 다 idempotency 체크를 통과하고
    //   (Toss 는 idempotency-key 로 중복 승인 없음) 둘 다 캘린더 차감 루프를 실행 → available_count
    //   이중 차감(실제 오버부킹). pending→confirmed 를 원자적으로 잡은 thread 만 해당 booking 의
    //   캘린더 차감 진행. 진 thread(전부 changes==0)는 캘린더 재차감/side-effect 없이 멱등 성공 반환.
    //   🛡️ 2026-06-12 (B-2): 다객실 — booking 단위 CAS 라 동시요청이 booking 을 나눠 잡아도
    //   각 booking 의 달력 차감은 정확히 1회.
    const claimed: ConfirmBooking[] = []
    for (const b of allBookings) {
      if (b.status !== 'pending') continue
      const claim = await c.env.DB.prepare(
        `UPDATE stay_bookings SET status = 'confirmed', updated_at = datetime('now')
          WHERE id = ? AND status = 'pending'`
      ).bind(b.id).run().catch(() => null)
      if (claim && (claim.meta?.changes ?? 0) > 0) claimed.push(b)
    }
    if (claimed.length === 0) {
      return c.json({
        success: true,
        message: '이미 결제 처리 중',
        data: { booking_id: order.stay_booking_id, order_id: orderId },
      })
    }

    // 5. 캘린더 available_count 차감 — 원자적 오버부킹 가드 (claim 한 booking 별, date 모드만).
    //   🛡️ 2026-05-30: 기존 `MAX(0, available_count - 1)` clamp 는 재고 0 이어도 거부 안 해
    //   마지막 방 동시 예약 시 이중 confirmed (실제 오버부킹). `available_count > 0` 가드 +
    //   meta.changes 검사로 거부 → 부족 시 성공분 롤백 + cancelTossPayment 자동 환불.
    //   voucher 모드 booking(check_in_date NULL)은 달력 미차감 (기존 동작 동일).
    const secured: Array<{ room_id: number; ds: string }> = []
    let overbooked = false
    for (const b of claimed) {
      if (!b.check_in_date || !b.check_out_date) continue
      const nights = Math.round(
        (new Date(b.check_out_date).getTime() - new Date(b.check_in_date).getTime()) / 86400000,
      )
      for (let i = 0; i < nights; i++) {
        const d = new Date(new Date(b.check_in_date).getTime() + i * 86400000)
        const ds = d.toISOString().slice(0, 10)
        // UPSERT: row 없으면 INSERT (total_inventory), 있으면 가드 차감.
        await c.env.DB.prepare(
          `INSERT OR IGNORE INTO product_stay_calendar (room_id, product_id, stay_date, available_count)
           SELECT ?, ?, ?, COALESCE((SELECT total_inventory FROM product_stay_rooms WHERE id = ?), 1)`
        ).bind(b.room_id, b.product_id, ds, b.room_id).run().catch(() => { /* noop */ })
        const dec = await c.env.DB.prepare(
          `UPDATE product_stay_calendar
              SET available_count = available_count - 1, updated_at = datetime('now')
            WHERE room_id = ? AND stay_date = ? AND available_count > 0`
        ).bind(b.room_id, ds).run().catch(() => null)
        if (dec && (dec.meta?.changes ?? 0) > 0) {
          secured.push({ room_id: b.room_id as number, ds })
        } else {
          overbooked = true
          break
        }
      }
      if (overbooked) break
    }

    if (overbooked) {
      // 성공분 재고 롤백 (claim 한 모든 booking 분).
      for (const s of secured) {
        await c.env.DB.prepare(
          `UPDATE product_stay_calendar SET available_count = available_count + 1, updated_at = datetime('now')
            WHERE room_id = ? AND stay_date = ?`
        ).bind(s.room_id, s.ds).run().catch(() => { /* noop */ })
      }
      // 결제 자동 환불 (이미 토스 승인됨).
      try {
        const { cancelTossPayment } = await import('../../../worker/utils/toss-gateway')
        await cancelTossPayment({
          env: c.env as unknown as { TOSS_SECRET_KEY?: string },
          paymentKey,
          cancelReason: '객실 재고 부족(오버부킹) 자동 환불',
          idempotencyKey: `stay-overbook-refund-${orderId}`,
        })
      } catch { /* 환불 실패 — booking 은 취소 유지, 어드민/cron 재시도 */ }
      // 주문의 모든 booking 취소 처리 (부분 확정 잔존 방지) + order REFUNDED.
      await c.env.DB.prepare(
        `UPDATE stay_bookings SET status = 'cancelled', updated_at = datetime('now')
          WHERE order_id = ? AND status IN ('confirmed', 'pending')`
      ).bind(orderId).run().catch(() => { /* noop */ })
      await c.env.DB.prepare(
        `UPDATE orders SET status = 'REFUNDED', payment_status = 'refunded', updated_at = datetime('now') WHERE id = ?`
      ).bind(orderId).run().catch(() => { /* noop */ })
      // 🛡️ 2026-05-31: 오버부킹 자동 환불 시 인플 affiliate 커미션도 reverse (출금 누수 차단).
      await c.env.DB.prepare(
        "UPDATE affiliate_earnings SET status = 'refunded' WHERE order_id = ? AND COALESCE(status, 'pending') IN ('granted', 'pending', 'holding')"
      ).bind(orderId).run().catch(() => { /* noop */ })
      return c.json({
        success: false,
        error: '선택하신 날짜의 객실이 매진되었습니다. 결제는 자동 환불 처리됩니다.',
        code: 'STAY_OVERBOOKED',
      }, 409)
    }

    // 6. orders 상태 갱신 + booking 별 로그 — 독립 write 원자 배치 (booking confirmed 는 위 CAS claim 에서 이미 전이).
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE orders
            SET status = 'PAID',
                payment_status = 'approved',
                payment_key = ?,
                updated_at = datetime('now')
          WHERE id = ?`
      ).bind(paymentKey, orderId),
      ...claimed.map((b) =>
        c.env.DB.prepare(
          `INSERT INTO stay_booking_status_log (booking_id, prev_status, new_status, changed_by_role, changed_by_id, reason)
           VALUES (?, 'pending', 'confirmed', 'system', ?, '결제 승인 완료')`
        ).bind(b.id, userId),
      ),
    ]).catch(() => { /* noop — 멱등 체크(payment_status)로 재시도 가능 */ })

    // 🏁 2026-06-12 (전 플로우 감사 🟡): 숙소 예약 확정 시 셀러 통보가 전무했음 — 벨 알림 추가
    //   (응답 후 실행, fail-soft). 알림톡 등 확장은 셀러 알림 정책과 함께.
    const firstClaimed = claimed[0]
    const periodText = firstClaimed.check_in_date
      ? `${firstClaimed.check_in_date} ~ ${firstClaimed.check_out_date}`
      : '숙소권 (날짜 협의)'
    try {
      c.executionCtx?.waitUntil?.((async () => {
        try {
          const sellerRow = await c.env.DB.prepare('SELECT seller_id FROM orders WHERE id = ?')
            .bind(orderId).first<{ seller_id: number | null }>()
          if (sellerRow?.seller_id) {
            const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
            await createDashboardNotification(
              c.env.DB, 'seller', String(sellerRow.seller_id), 'stay_booking_paid',
              '🏡 숙소 예약 확정', `${periodText}${claimed.length > 1 ? ` · ${claimed.length}객실` : ''} · ₩${Number(order.total_amount).toLocaleString('ko-KR')}`,
              '/seller/stays/bookings',
            ).catch(() => {})
          }
        } catch { /* fail-soft */ }
      })())
    } catch { /* no ctx */ }

    return c.json({
      success: true,
      data: {
        booking_id: order.stay_booking_id,
        order_id: orderId,
        amount: order.total_amount,
        check_in: firstClaimed.check_in_date,
        check_out: firstClaimed.check_out_date,
        bookings_confirmed: claimed.length,
      },
    })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[stays-public]')
  }
})

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
      `SELECT b.id, b.user_id, b.status, b.total_amount, b.check_in_date, b.check_out_date,
              b.room_id, b.product_id, b.order_id,
              b.sale_mode, b.voucher_used_at, b.voucher_expires_at,
              psi.cancellation_policy
         FROM stay_bookings b
         LEFT JOIN product_stay_info psi ON psi.product_id = b.product_id
        WHERE b.id = ?`
    ).bind(id).first<{
      id: number; user_id: number; status: string; total_amount: number;
      check_in_date: string; check_out_date: string; room_id: number;
      product_id: number; order_id: number;
      sale_mode: string | null; voucher_used_at: string | null; voucher_expires_at: string | null;
      cancellation_policy: string | null;
    }>()
    if (!booking) return c.json({ success: false, error: '예약 없음' }, 404)
    if (booking.user_id !== userId) return c.json({ success: false, error: '권한 없음' }, 403)
    if (!['confirmed', 'pending'].includes(booking.status)) {
      return c.json({ success: false, error: `상태 '${booking.status}' 에서 취소 불가` }, 400)
    }

    // 🛡️ 2026-06-11 동시요청 race 가드: 취소 가능 상태를 원자적으로 claim.
    //   기존 구멍: 동시/더블탭 취소가 둘 다 위 상태 체크(987)를 통과하고 둘 다 releaseStayInventory
    //   (캘린더 +nights 복원)를 실행 → 객실 야간 재고 이중 복원(팬텀 재고/오버부킹). confirmed/pending
    //   에서 빠져나오는 thread 만 진행, 진 thread(changes==0)는 409 — 재고/환불 side-effect 미실행.
    //   (Toss 환불은 stay-cancel-${id} idempotency-key 로도 이중 방지되지만 재고 복원은 키가 없어 필수.)
    const cancelClaim = await c.env.DB.prepare(
      `UPDATE stay_bookings SET status = 'cancelled', updated_at = datetime('now')
        WHERE id = ? AND status IN ('confirmed', 'pending')`
    ).bind(id).run().catch(() => null)
    if (!cancelClaim || (cancelClaim.meta?.changes ?? 0) === 0) {
      return c.json({ success: false, error: '이미 취소 처리된 예약입니다' }, 409)
    }

    // 취소 정책 따른 환불 비율 계산.
    const hoursUntil = (new Date(booking.check_in_date).getTime() - Date.now()) / 3600000
    let refundRate = 0
    const policy = booking.cancellation_policy || 'standard'
    if (booking.sale_mode === 'voucher') {
      // 🛡️ 2026-06-12 (전수조사 4차 B-3): voucher 숙소권은 check_in_date 가 NULL 이라
      //   기존 hoursUntil 계산이 NaN → 모든 정책 분기 false → 무조건 0원 환불 + 숙소권 영구 무효.
      //   정책: **미사용 + 미만료** 숙소권의 셀프취소 = 100% 환불 (날짜 미지정 상품이라 노쇼/임박
      //   취소 손실 개념이 없음 — 달력 재고도 미차감). 사용 후 또는 만료 후엔 기존대로 0원.
      const notUsed = !booking.voucher_used_at
      const notExpired = !booking.voucher_expires_at || new Date(booking.voucher_expires_at).getTime() > Date.now()
      refundRate = notUsed && notExpired ? 1.0 : 0
    } else if (policy === 'flexible') {
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
        const { tossCancelPayment } = await import('../../../worker/utils/toss-refund')
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

    // 🛡️ 2026-05-18/31: bind 인자 계산을 명시적 변수로 분리 (audit script 가 JS ternary `?`
    //   를 placeholder 로 오인하지 않도록). 환불 성공 시 status='refunded' (어드민 경로와 정합).
    const nextStatus = refundActuallyDone ? 'refunded' : 'cancelled'

    await c.env.DB.prepare(
      `UPDATE stay_bookings
          SET status = ?,
              cancelled_at = datetime('now'),
              cancellation_reason = ?,
              refund_amount = ?,
              refunded_at = ${refundActuallyDone ? "datetime('now')" : 'NULL'},
              updated_at = datetime('now')
        WHERE id = ?`
    ).bind(nextStatus, reason || '사용자 취소', refundAmount, id).run()

    // 🛡️ 2026-05-31: 환불 성공 시 인플 affiliate 커미션 reverse — 환불 매출 출금 누수 차단.
    //   stays 인플 커미션은 affiliate_earnings(payment.routes 결제 confirm 시 적립, default status='pending').
    //   환불 발생 건만 'refunded' → curator 출금 잔액 SUM 에서 제외됨.
    if (refundActuallyDone) {
      await c.env.DB.prepare(
        "UPDATE affiliate_earnings SET status = 'refunded' WHERE order_id = ? AND COALESCE(status, 'pending') IN ('granted', 'pending', 'holding')"
      ).bind(booking.order_id).run().catch(() => null)
    }

    // 🛡️ 2026-05-31: confirmed 였던 예약은 차감된 객실 야간 재고 복원 (취소 시 영구 unavailable 방지).
    //   pending 은 미차감이므로 복원 안 함 (과다 증가 방지).
    if (booking.status === 'confirmed') {
      await releaseStayInventory(c.env.DB, booking.room_id, booking.check_in_date, booking.check_out_date)
    }
    const logReason = refundError
      ? `정책 ${policy}, 환불율 ${(refundRate * 100).toFixed(0)}%, 환불실패: ${refundError}`
      : `정책 ${policy}, 환불율 ${(refundRate * 100).toFixed(0)}%`
    await c.env.DB.prepare(
      `INSERT INTO stay_booking_status_log (booking_id, prev_status, new_status, changed_by_role, changed_by_id, reason)
       VALUES (?, ?, ?, 'user', ?, ?)`
    ).bind(id, booking.status, nextStatus, userId, logReason)
      .run().catch(() => { /* noop */ })

    return c.json({
      success: true,
      data: {
        refund_amount: refundAmount,
        refund_rate: refundRate,
        refund_done: refundActuallyDone,
        refund_error: refundError,
        policy: booking.sale_mode === 'voucher' ? 'voucher' : policy,
        hours_until_check_in: Number.isFinite(hoursUntil) ? Math.round(hoursUntil) : null,
      },
    })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[stays-public]')
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
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[stays-public]')
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

    // 🛡️ 2026-05-18: voucher 모드는 check_in_date 가 NULL — created_at 으로 fallback.
    const rows = await c.env.DB.prepare(
      `SELECT b.*, p.name as product_name, r.name as room_name, p.image_url
         FROM stay_bookings b
         LEFT JOIN products p ON p.id = b.product_id
         LEFT JOIN product_stay_rooms r ON r.id = b.room_id
        WHERE b.user_id = ?
        ORDER BY COALESCE(b.check_in_date, b.created_at) DESC LIMIT 100`
    ).bind(userId).all<Record<string, unknown>>().catch(() => ({ results: [] }))
    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[stays-public]')
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
              CASE WHEN u.name IS NULL OR u.name = '' THEN NULL
                   ELSE SUBSTR(u.name, 1, 1) || '**' END AS user_name,
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
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[stays-public]')
  }
})
