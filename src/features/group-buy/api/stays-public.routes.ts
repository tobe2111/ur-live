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
