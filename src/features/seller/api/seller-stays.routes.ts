/**
 * 🛡️ 2026-05-18: 숙소 (stay_voucher) 공구 — 셀러 측 CRUD foundation.
 *
 * 본 파일은 PR 1 (Foundation) — 후속 PR 들이 활용할 핵심 endpoint 들:
 *   - GET    /stays                                  — 셀러의 숙소 상품 목록
 *   - POST   /stays                                  — 숙소 상품 생성 (products + stay_info)
 *   - GET    /stays/:productId                       — 상세 (stay_info + rooms + 최근 캘린더)
 *   - PUT    /stays/:productId                       — stay_info 수정
 *   - POST   /stays/:productId/rooms                 — 객실 추가
 *   - PUT    /stays/:productId/rooms/:roomId         — 객실 수정
 *   - DELETE /stays/:productId/rooms/:roomId         — 객실 삭제 (예약 없을 시)
 *   - GET    /stays/:productId/calendar              — 가용 캘린더 조회 (range)
 *   - PUT    /stays/:productId/calendar              — 캘린더 bulk update
 *   - GET    /stays/:productId/bookings              — 예약 목록 (셀러용)
 *   - PATCH  /stays/bookings/:bookingId/check-in     — 체크인 처리
 *   - PATCH  /stays/bookings/:bookingId/check-out    — 체크아웃 처리
 *   - PATCH  /stays/bookings/:bookingId/no-show      — 노쇼 처리
 *
 * 인증: src/worker/index.ts 에 mount 시 sellerApp.use('*', requireSeller()) 적용.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verify } from 'hono/jwt'
import type { SellerJWTPayload } from '@/lib/seller-shared'
import { swallow } from '@/worker/utils/swallow'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Vars = { sellerId?: number }

export const sellerStaysRoutes = new Hono<{ Bindings: Bindings; Variables: Vars }>()

// ─── 공통 헬퍼 — sellerId 추출 + 검증 ────────────────────────────────────
async function getSellerId(c: { env: Bindings; req: { header: (k: string) => string | undefined } }): Promise<number | null> {
  const auth = c.req.header('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return null
  try {
    const payload = await verify(auth.substring(7), c.env.JWT_SECRET, 'HS256') as SellerJWTPayload
    return Number(payload.seller_id) || null
  } catch { return null }
}

async function ensureOwnsProduct(c: { env: Bindings }, productId: number, sellerId: number): Promise<boolean> {
  const row = await c.env.DB.prepare('SELECT seller_id FROM products WHERE id = ?')
    .bind(productId).first<{ seller_id: number }>()
  return row?.seller_id === sellerId
}

function diffNights(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn).getTime()
  const b = new Date(checkOut).getTime()
  return Math.max(1, Math.round((b - a) / (24 * 3600 * 1000)))
}

// ─── 1. 셀러 숙소 상품 목록 ────────────────────────────────────────────
sellerStaysRoutes.get('/stays', cors(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const rows = await c.env.DB.prepare(
      `SELECT p.id, p.name, p.image_url, p.price, p.is_active, p.group_buy_status,
              psi.property_type, psi.region_sido, psi.region_sigungu,
              psi.star_rating, psi.total_rooms,
              (SELECT COUNT(*) FROM product_stay_rooms r WHERE r.product_id = p.id AND r.is_active = 1) as room_count,
              (SELECT COUNT(*) FROM stay_bookings sb WHERE sb.product_id = p.id AND sb.status IN ('confirmed','checked_in')) as active_bookings
         FROM products p
         LEFT JOIN product_stay_info psi ON psi.product_id = p.id
        WHERE p.seller_id = ?
          AND p.category = 'stay_voucher'
        ORDER BY p.created_at DESC`
    ).bind(sellerId).all<Record<string, unknown>>().catch(() => ({ results: [] }))
    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ─── 2. 숙소 상품 생성 (products + stay_info 동시) ─────────────────────
sellerStaysRoutes.post('/stays', cors(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const body = await c.req.json<Record<string, any>>()
    const {
      name, description, image_url,
      property_type, star_rating, total_rooms,
      check_in_time, check_out_time,
      address, address_detail, postal_code, region_sido, region_sigungu, latitude, longitude,
      amenities, room_amenities,
      cancellation_policy, custom_cancellation_text,
      house_rules, check_in_instructions,
      description_full, nearby_attractions,
      min_nights, max_nights, advance_booking_days,
    } = body

    if (!name || typeof name !== 'string' || name.length < 2) {
      return c.json({ success: false, error: '상품명은 2자 이상 필요합니다' }, 400)
    }

    // 1. products 테이블 INSERT (카테고리 강제 'stay_voucher')
    const insertProduct = await c.env.DB.prepare(
      `INSERT INTO products (
         seller_id, name, description, image_url, price,
         category, product_type, is_active,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, 0, 'stay_voucher', 'featured', 1,
                 datetime('now'), datetime('now'))`
    ).bind(sellerId, name, description || '', image_url || '').run()

    const productId = Number(insertProduct.meta.last_row_id)
    if (!productId) {
      return c.json({ success: false, error: '상품 생성 실패' }, 500)
    }

    // 2. product_stay_info INSERT (1:1)
    await c.env.DB.prepare(
      `INSERT INTO product_stay_info (
         product_id, property_type, star_rating, total_rooms,
         check_in_time, check_out_time,
         address, address_detail, postal_code, region_sido, region_sigungu,
         latitude, longitude,
         amenities, room_amenities,
         cancellation_policy, custom_cancellation_text,
         house_rules, check_in_instructions,
         description_full, nearby_attractions,
         min_nights, max_nights, advance_booking_days
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      productId,
      property_type || 'pension',
      star_rating || null,
      total_rooms || 1,
      check_in_time || '15:00',
      check_out_time || '11:00',
      address || null,
      address_detail || null,
      postal_code || null,
      region_sido || null,
      region_sigungu || null,
      latitude != null ? Number(latitude) : null,
      longitude != null ? Number(longitude) : null,
      typeof amenities === 'string' ? amenities : JSON.stringify(amenities || []),
      typeof room_amenities === 'string' ? room_amenities : JSON.stringify(room_amenities || []),
      cancellation_policy || 'standard',
      custom_cancellation_text || null,
      house_rules || null,
      check_in_instructions || null,
      description_full || null,
      typeof nearby_attractions === 'string' ? nearby_attractions : JSON.stringify(nearby_attractions || []),
      Math.max(1, Number(min_nights) || 1),
      max_nights != null ? Number(max_nights) : null,
      Math.max(1, Math.min(365, Number(advance_booking_days) || 90)),
    ).run().catch((e: Error) => { throw new Error(`stay_info INSERT 실패: ${e.message}`) })

    return c.json({ success: true, data: { product_id: productId } })
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Seller Stays] create error:', err)
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ─── 3. 숙소 상세 (stay_info + rooms + 최근 30일 캘린더) ────────────────
sellerStaysRoutes.get('/stays/:productId', cors(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const productId = Number(c.req.param('productId'))
    if (!Number.isFinite(productId)) return c.json({ success: false, error: 'Invalid productId' }, 400)
    if (!(await ensureOwnsProduct(c, productId, sellerId))) {
      return c.json({ success: false, error: '권한 없음' }, 403)
    }

    const product = await c.env.DB.prepare(
      `SELECT p.id, p.name, p.description, p.image_url, p.is_active, p.group_buy_status,
              psi.*
         FROM products p
         LEFT JOIN product_stay_info psi ON psi.product_id = p.id
        WHERE p.id = ?`
    ).bind(productId).first<Record<string, unknown>>()
    if (!product) return c.json({ success: false, error: '상품 없음' }, 404)

    const rooms = await c.env.DB.prepare(
      `SELECT * FROM product_stay_rooms WHERE product_id = ? ORDER BY display_order, id`
    ).bind(productId).all<Record<string, unknown>>().catch(() => ({ results: [] }))

    // 향후 60일 캘린더 (room_id 별 그룹)
    const today = new Date().toISOString().slice(0, 10)
    const calendar = await c.env.DB.prepare(
      `SELECT * FROM product_stay_calendar
        WHERE product_id = ? AND stay_date >= ?
        ORDER BY stay_date LIMIT 1000`
    ).bind(productId, today).all<Record<string, unknown>>().catch(() => ({ results: [] }))

    return c.json({
      success: true,
      data: {
        product,
        rooms: rooms.results || [],
        calendar: calendar.results || [],
      },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ─── 4. stay_info 수정 ─────────────────────────────────────────────────
sellerStaysRoutes.put('/stays/:productId', cors(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const productId = Number(c.req.param('productId'))
    if (!Number.isFinite(productId)) return c.json({ success: false, error: 'Invalid productId' }, 400)
    if (!(await ensureOwnsProduct(c, productId, sellerId))) {
      return c.json({ success: false, error: '권한 없음' }, 403)
    }
    const body = await c.req.json<Record<string, any>>()

    const fields = [
      'property_type','star_rating','total_rooms','check_in_time','check_out_time',
      'address','address_detail','postal_code','region_sido','region_sigungu',
      'latitude','longitude','amenities','room_amenities',
      'cancellation_policy','custom_cancellation_text','house_rules','check_in_instructions',
      'description_full','nearby_attractions','min_nights','max_nights','advance_booking_days',
    ]
    const setParts: string[] = ["updated_at = datetime('now')"]
    const params: unknown[] = []
    for (const f of fields) {
      if (body[f] !== undefined) {
        setParts.push(`${f} = ?`)
        const v = body[f]
        params.push((f === 'amenities' || f === 'room_amenities' || f === 'nearby_attractions') && typeof v !== 'string'
          ? JSON.stringify(v) : v)
      }
    }
    if (setParts.length === 1) return c.json({ success: false, error: '변경 사항 없음' }, 400)
    params.push(productId)

    await c.env.DB.prepare(
      `UPDATE product_stay_info SET ${setParts.join(', ')} WHERE product_id = ?`
    ).bind(...params).run()

    // products.name / description / image_url 도 같이 업데이트 가능.
    if (body.name || body.description !== undefined || body.image_url !== undefined) {
      const pSets: string[] = ["updated_at = datetime('now')"]
      const pParams: unknown[] = []
      if (body.name) { pSets.push('name = ?'); pParams.push(body.name) }
      if (body.description !== undefined) { pSets.push('description = ?'); pParams.push(body.description) }
      if (body.image_url !== undefined) { pSets.push('image_url = ?'); pParams.push(body.image_url) }
      pParams.push(productId)
      await c.env.DB.prepare(`UPDATE products SET ${pSets.join(', ')} WHERE id = ?`).bind(...pParams).run()
    }

    return c.json({ success: true })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ─── 5. 객실 추가 ──────────────────────────────────────────────────────
sellerStaysRoutes.post('/stays/:productId/rooms', cors(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const productId = Number(c.req.param('productId'))
    if (!Number.isFinite(productId)) return c.json({ success: false, error: 'Invalid productId' }, 400)
    if (!(await ensureOwnsProduct(c, productId, sellerId))) {
      return c.json({ success: false, error: '권한 없음' }, 403)
    }
    const body = await c.req.json<Record<string, any>>()
    const {
      name, description, display_order,
      base_guests, max_guests, extra_guest_fee, bed_config, room_size_sqm,
      base_price_weekday, base_price_weekend, base_price_holiday,
      total_inventory, amenities, image_urls,
    } = body

    if (!name || typeof name !== 'string') return c.json({ success: false, error: '객실명 필수' }, 400)
    if (!Number.isFinite(Number(base_price_weekday)) || Number(base_price_weekday) < 0) {
      return c.json({ success: false, error: '평일 가격이 올바르지 않습니다' }, 400)
    }
    if (!Number.isFinite(Number(base_price_weekend)) || Number(base_price_weekend) < 0) {
      return c.json({ success: false, error: '주말 가격이 올바르지 않습니다' }, 400)
    }

    const result = await c.env.DB.prepare(
      `INSERT INTO product_stay_rooms (
         product_id, name, description, display_order,
         base_guests, max_guests, extra_guest_fee, bed_config, room_size_sqm,
         base_price_weekday, base_price_weekend, base_price_holiday,
         total_inventory, amenities, image_urls, is_active
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).bind(
      productId, name, description || null, Number(display_order) || 0,
      Math.max(1, Number(base_guests) || 2),
      Math.max(1, Number(max_guests) || 2),
      Math.max(0, Number(extra_guest_fee) || 0),
      bed_config || null,
      room_size_sqm != null ? Number(room_size_sqm) : null,
      Math.floor(Number(base_price_weekday)),
      Math.floor(Number(base_price_weekend)),
      base_price_holiday != null ? Math.floor(Number(base_price_holiday)) : null,
      Math.max(1, Number(total_inventory) || 1),
      typeof amenities === 'string' ? amenities : JSON.stringify(amenities || []),
      typeof image_urls === 'string' ? image_urls : JSON.stringify(image_urls || []),
    ).run()

    return c.json({ success: true, data: { room_id: Number(result.meta.last_row_id) } })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ─── 6. 객실 수정 ──────────────────────────────────────────────────────
sellerStaysRoutes.put('/stays/:productId/rooms/:roomId', cors(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const productId = Number(c.req.param('productId'))
    const roomId = Number(c.req.param('roomId'))
    if (!Number.isFinite(productId) || !Number.isFinite(roomId)) {
      return c.json({ success: false, error: 'Invalid ID' }, 400)
    }
    if (!(await ensureOwnsProduct(c, productId, sellerId))) {
      return c.json({ success: false, error: '권한 없음' }, 403)
    }
    const body = await c.req.json<Record<string, any>>()

    const fields = [
      'name','description','display_order','base_guests','max_guests','extra_guest_fee',
      'bed_config','room_size_sqm',
      'base_price_weekday','base_price_weekend','base_price_holiday',
      'total_inventory','amenities','image_urls','is_active',
    ]
    const setParts: string[] = ["updated_at = datetime('now')"]
    const params: unknown[] = []
    for (const f of fields) {
      if (body[f] !== undefined) {
        setParts.push(`${f} = ?`)
        const v = body[f]
        params.push((f === 'amenities' || f === 'image_urls') && typeof v !== 'string'
          ? JSON.stringify(v)
          : (f === 'is_active' ? (v ? 1 : 0) : v))
      }
    }
    if (setParts.length === 1) return c.json({ success: false, error: '변경 사항 없음' }, 400)
    params.push(roomId, productId)

    await c.env.DB.prepare(
      `UPDATE product_stay_rooms SET ${setParts.join(', ')} WHERE id = ? AND product_id = ?`
    ).bind(...params).run()
    return c.json({ success: true })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ─── 7. 객실 삭제 (활성 예약 없을 시) ──────────────────────────────────
sellerStaysRoutes.delete('/stays/:productId/rooms/:roomId', cors(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const productId = Number(c.req.param('productId'))
    const roomId = Number(c.req.param('roomId'))
    if (!(await ensureOwnsProduct(c, productId, sellerId))) {
      return c.json({ success: false, error: '권한 없음' }, 403)
    }
    // 활성 예약 체크.
    const active = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM stay_bookings WHERE room_id = ? AND status IN ('pending','confirmed','checked_in')`
    ).bind(roomId).first<{ cnt: number }>()
    if (active && active.cnt > 0) {
      return c.json({ success: false, error: `진행 중인 예약 ${active.cnt}건 — 비활성화만 가능` }, 400)
    }
    await c.env.DB.prepare('DELETE FROM product_stay_rooms WHERE id = ? AND product_id = ?')
      .bind(roomId, productId).run()
    return c.json({ success: true })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ─── 8. 캘린더 조회 (range) ────────────────────────────────────────────
sellerStaysRoutes.get('/stays/:productId/calendar', cors(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const productId = Number(c.req.param('productId'))
    if (!(await ensureOwnsProduct(c, productId, sellerId))) {
      return c.json({ success: false, error: '권한 없음' }, 403)
    }
    const from = c.req.query('from') || new Date().toISOString().slice(0, 10)
    const to = c.req.query('to') || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)

    const rows = await c.env.DB.prepare(
      `SELECT * FROM product_stay_calendar
        WHERE product_id = ? AND stay_date BETWEEN ? AND ?
        ORDER BY stay_date, room_id`
    ).bind(productId, from, to).all<Record<string, unknown>>().catch(() => ({ results: [] }))
    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ─── 9. 캘린더 bulk update — 날짜 범위 + 객실 단위 ────────────────────
//   body: { room_id, dates: [{date, available_count, price_override?, is_blocked?, blocked_reason?}] }
sellerStaysRoutes.put('/stays/:productId/calendar', cors(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const productId = Number(c.req.param('productId'))
    if (!(await ensureOwnsProduct(c, productId, sellerId))) {
      return c.json({ success: false, error: '권한 없음' }, 403)
    }
    const body = await c.req.json<{ room_id?: number; dates?: Array<{ date: string; available_count?: number; price_override?: number; is_blocked?: boolean; blocked_reason?: string }> }>()
    const roomId = Number(body.room_id)
    const dates = Array.isArray(body.dates) ? body.dates : []
    if (!Number.isFinite(roomId) || dates.length === 0) {
      return c.json({ success: false, error: 'room_id + dates 필요' }, 400)
    }
    if (dates.length > 365) return c.json({ success: false, error: '한번에 최대 365일까지' }, 400)

    // room 소유 확인.
    const room = await c.env.DB.prepare('SELECT id FROM product_stay_rooms WHERE id = ? AND product_id = ?')
      .bind(roomId, productId).first<{ id: number }>()
    if (!room) return c.json({ success: false, error: '객실 없음' }, 404)

    // 1건씩 UPSERT (D1 batch 권장).
    for (const d of dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) continue
      const available = Math.max(0, Number(d.available_count) || 0)
      const priceOverride = d.price_override != null && Number.isFinite(Number(d.price_override))
        ? Math.floor(Number(d.price_override)) : null
      const blocked = d.is_blocked ? 1 : 0
      await c.env.DB.prepare(
        `INSERT INTO product_stay_calendar (room_id, product_id, stay_date, available_count, price_override, is_blocked, blocked_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(room_id, stay_date) DO UPDATE SET
           available_count = excluded.available_count,
           price_override = excluded.price_override,
           is_blocked = excluded.is_blocked,
           blocked_reason = excluded.blocked_reason,
           updated_at = datetime('now')`
      ).bind(roomId, productId, d.date, available, priceOverride, blocked, d.blocked_reason || null).run()
        .catch(swallow('seller:stays:calendar-upsert'))
    }
    return c.json({ success: true, data: { updated: dates.length } })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ─── 10. 셀러의 예약 목록 ──────────────────────────────────────────────
sellerStaysRoutes.get('/stays/:productId/bookings', cors(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const productId = Number(c.req.param('productId'))
    if (!(await ensureOwnsProduct(c, productId, sellerId))) {
      return c.json({ success: false, error: '권한 없음' }, 403)
    }
    const status = c.req.query('status') // 'confirmed', 'checked_in' 등
    const from = c.req.query('from')      // 'YYYY-MM-DD'
    const to = c.req.query('to')

    let sql = `SELECT b.*, r.name as room_name
                 FROM stay_bookings b
                 LEFT JOIN product_stay_rooms r ON r.id = b.room_id
                WHERE b.product_id = ? AND b.seller_id = ?`
    const params: unknown[] = [productId, sellerId]
    if (status) { sql += ' AND b.status = ?'; params.push(status) }
    if (from) { sql += ' AND b.check_in_date >= ?'; params.push(from) }
    if (to) { sql += ' AND b.check_in_date <= ?'; params.push(to) }
    sql += ' ORDER BY b.check_in_date DESC LIMIT 200'

    const rows = await c.env.DB.prepare(sql).bind(...params)
      .all<Record<string, unknown>>().catch(() => ({ results: [] }))
    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ─── 11-13. 예약 상태 전이 (check-in / check-out / no-show) ────────────
async function transitionBooking(
  c: { env: Bindings; req: { header: (k: string) => string | undefined; param: (k: string) => string } & { json?: () => Promise<unknown> }; json: (data: unknown, status?: number) => Response },
  targetStatus: string,
  allowFrom: string[]
) {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const bookingId = Number(c.req.param('bookingId'))
    if (!Number.isFinite(bookingId)) return c.json({ success: false, error: 'Invalid bookingId' }, 400)

    const booking = await c.env.DB.prepare(
      'SELECT id, seller_id, status FROM stay_bookings WHERE id = ?'
    ).bind(bookingId).first<{ id: number; seller_id: number; status: string }>()
    if (!booking) return c.json({ success: false, error: '예약 없음' }, 404)
    if (booking.seller_id !== sellerId) return c.json({ success: false, error: '권한 없음' }, 403)
    if (!allowFrom.includes(booking.status)) {
      return c.json({ success: false, error: `현재 상태 '${booking.status}' 에서 '${targetStatus}' 전이 불가` }, 400)
    }

    const setExtras: string[] = []
    const now = "datetime('now')"
    if (targetStatus === 'checked_in') {
      setExtras.push(`checked_in_at = ${now}`, `checked_in_by = ${sellerId}`)
    } else if (targetStatus === 'checked_out') {
      setExtras.push(`checked_out_at = ${now}`)
    } else if (targetStatus === 'no_show') {
      setExtras.push(`no_show_marked_at = ${now}`, `no_show_marked_by = ${sellerId}`)
    }

    await c.env.DB.prepare(
      `UPDATE stay_bookings
          SET status = ?, updated_at = datetime('now')${setExtras.length ? ', ' + setExtras.join(', ') : ''}
        WHERE id = ?`
    ).bind(targetStatus, bookingId).run()

    // 상태 이력 기록.
    await c.env.DB.prepare(
      `INSERT INTO stay_booking_status_log (booking_id, prev_status, new_status, changed_by_role, changed_by_id, reason)
       VALUES (?, ?, ?, 'seller', ?, NULL)`
    ).bind(bookingId, booking.status, targetStatus, sellerId).run().catch(swallow('stay:status-log'))

    return c.json({ success: true })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
}

sellerStaysRoutes.patch('/stays/bookings/:bookingId/check-in',
  cors(), (c) => transitionBooking(c, 'checked_in', ['confirmed']))
sellerStaysRoutes.patch('/stays/bookings/:bookingId/check-out',
  cors(), (c) => transitionBooking(c, 'checked_out', ['checked_in']))
sellerStaysRoutes.patch('/stays/bookings/:bookingId/no-show',
  cors(), (c) => transitionBooking(c, 'no_show', ['confirmed']))

// ─── 14. 어메니티 lookup (셀러 등록 폼에서 표시용) ──────────────────
sellerStaysRoutes.get('/stays-amenities', cors(), async (c) => {
  try {
    const rows = await c.env.DB.prepare(
      `SELECT code, label_ko, label_en, icon_emoji, category
         FROM stay_property_amenities
        WHERE is_active = 1 ORDER BY display_order, code`
    ).all<Record<string, unknown>>().catch(() => ({ results: [] }))
    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})
