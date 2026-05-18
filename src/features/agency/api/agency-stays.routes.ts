/**
 * 🛡️ 2026-05-18: 숙소 공구 에이전시 — 담당 셀러들의 숙소 모니터링 (PR 1 Foundation).
 *
 *   - GET /agency/stays                   — 담당 셀러들 숙소 목록 + KPI
 *   - GET /agency/stays/bookings          — 담당 셀러들 예약
 *   - GET /agency/stays/kpi               — 집계 KPI (occupancy, revenue, rating)
 *
 * 인증: agencyApp.use('*', requireAgency()) 으로 자동 보호.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verify } from 'hono/jwt'
import { executeQuery } from '@/worker/utils/database'

type Bindings = { DB: D1Database; JWT_SECRET: string }
export const agencyStaysRoutes = new Hono<{ Bindings: Bindings }>()

async function getAgencyId(c: { env: Bindings; req: { header: (k: string) => string | undefined } }): Promise<number | null> {
  const auth = c.req.header('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return null
  try {
    const payload = await verify(auth.substring(7), c.env.JWT_SECRET, 'HS256') as { agency_id?: number; user_id?: number }
    return Number(payload.agency_id ?? payload.user_id) || null
  } catch { return null }
}

// 1. 담당 셀러들의 숙소 목록 + KPI
agencyStaysRoutes.get('/stays', cors(), async (c) => {
  const agencyId = await getAgencyId(c)
  if (!agencyId) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    // 담당 셀러는 agency_sellers 테이블 또는 sellers.agency_id 컬럼 사용 (스키마에 따라).
    // 이 구현은 fallback — 두 테이블 모두 시도.
    const rows = await executeQuery<Record<string, unknown>>(c.env.DB,
      `SELECT p.id, p.name, p.image_url, p.is_active, p.seller_id,
              s.name as seller_name,
              psi.property_type, psi.region_sido, psi.region_sigungu, psi.star_rating,
              (SELECT COUNT(*) FROM product_stay_rooms r WHERE r.product_id = p.id AND r.is_active = 1) as room_count,
              (SELECT COUNT(*) FROM stay_bookings b WHERE b.product_id = p.id AND b.status IN ('confirmed','checked_in')) as active_bookings,
              (SELECT COALESCE(SUM(total_amount), 0) FROM stay_bookings b WHERE b.product_id = p.id AND b.status IN ('confirmed','checked_in','checked_out')) as total_revenue,
              (SELECT AVG(rating_overall) FROM stay_booking_reviews rev WHERE rev.product_id = p.id AND rev.is_visible = 1) as avg_rating
         FROM products p
         INNER JOIN sellers s ON s.id = p.seller_id
         LEFT JOIN product_stay_info psi ON psi.product_id = p.id
        WHERE p.category = 'stay_voucher'
          AND (s.agency_id = ? OR EXISTS (
            SELECT 1 FROM agency_sellers ag
             WHERE ag.agency_id = ? AND ag.seller_id = p.seller_id AND (ag.status IS NULL OR ag.status = 'active')
          ))
        ORDER BY p.created_at DESC
        LIMIT 200`,
      [agencyId, agencyId]
    ).catch(() => [])
    return c.json({ success: true, data: rows })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 2. 담당 셀러들의 예약 목록
agencyStaysRoutes.get('/stays/bookings', cors(), async (c) => {
  const agencyId = await getAgencyId(c)
  if (!agencyId) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const status = c.req.query('status')
    const from = c.req.query('from')
    const to = c.req.query('to')

    let sql = `
      SELECT b.id, b.product_id, b.room_id, b.seller_id, b.user_id,
             b.check_in_date, b.check_out_date, b.nights,
             b.guest_count, b.guest_name, b.total_amount, b.status,
             b.created_at,
             p.name as product_name, r.name as room_name,
             s.name as seller_name
        FROM stay_bookings b
        LEFT JOIN products p ON p.id = b.product_id
        LEFT JOIN product_stay_rooms r ON r.id = b.room_id
        INNER JOIN sellers s ON s.id = b.seller_id
       WHERE (s.agency_id = ? OR EXISTS (
         SELECT 1 FROM agency_sellers ag
          WHERE ag.agency_id = ? AND ag.seller_id = b.seller_id AND (ag.status IS NULL OR ag.status = 'active')
       ))`
    const params: unknown[] = [agencyId, agencyId]
    if (status) { sql += ' AND b.status = ?'; params.push(status) }
    if (from) { sql += ' AND b.check_in_date >= ?'; params.push(from) }
    if (to) { sql += ' AND b.check_in_date <= ?'; params.push(to) }
    sql += ' ORDER BY b.check_in_date DESC LIMIT 200'

    const rows = await executeQuery<Record<string, unknown>>(c.env.DB, sql, params).catch(() => [])
    return c.json({ success: true, data: rows })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 3. 집계 KPI
agencyStaysRoutes.get('/stays/kpi', cors(), async (c) => {
  const agencyId = await getAgencyId(c)
  if (!agencyId) return c.json({ success: false, error: '인증 필요' }, 401)
  try {
    const sellerFilter = `(s.agency_id = ? OR EXISTS (
        SELECT 1 FROM agency_sellers ag
         WHERE ag.agency_id = ? AND ag.seller_id = s.id AND (ag.status IS NULL OR ag.status = 'active')
      ))`

    const safe = async <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null)
    const [props, rooms, bookings, revenue, rating] = await Promise.all([
      safe(c.env.DB.prepare(
        `SELECT COUNT(*) as n FROM products p INNER JOIN sellers s ON s.id = p.seller_id
          WHERE p.category='stay_voucher' AND ${sellerFilter}`
      ).bind(agencyId, agencyId).first<{ n: number }>()),
      safe(c.env.DB.prepare(
        `SELECT COUNT(*) as n FROM product_stay_rooms r
           INNER JOIN products p ON p.id = r.product_id
           INNER JOIN sellers s ON s.id = p.seller_id
          WHERE r.is_active = 1 AND ${sellerFilter}`
      ).bind(agencyId, agencyId).first<{ n: number }>()),
      safe(c.env.DB.prepare(
        `SELECT COUNT(*) as n FROM stay_bookings b
           INNER JOIN sellers s ON s.id = b.seller_id
          WHERE ${sellerFilter}`
      ).bind(agencyId, agencyId).first<{ n: number }>()),
      safe(c.env.DB.prepare(
        `SELECT COALESCE(SUM(b.total_amount), 0) as n FROM stay_bookings b
           INNER JOIN sellers s ON s.id = b.seller_id
          WHERE b.status IN ('confirmed','checked_in','checked_out') AND ${sellerFilter}`
      ).bind(agencyId, agencyId).first<{ n: number }>()),
      safe(c.env.DB.prepare(
        `SELECT AVG(rev.rating_overall) as avg FROM stay_booking_reviews rev
           INNER JOIN products p ON p.id = rev.product_id
           INNER JOIN sellers s ON s.id = p.seller_id
          WHERE rev.is_visible = 1 AND ${sellerFilter}`
      ).bind(agencyId, agencyId).first<{ avg: number }>()),
    ])
    return c.json({
      success: true,
      data: {
        total_properties: props?.n || 0,
        total_rooms: rooms?.n || 0,
        total_bookings: bookings?.n || 0,
        total_revenue: revenue?.n || 0,
        avg_rating: rating?.avg || null,
      },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})
