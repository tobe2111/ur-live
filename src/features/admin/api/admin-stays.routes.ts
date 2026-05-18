/**
 * 🛡️ 2026-05-18: 숙소 공구 어드민 — 모니터링 + 분쟁/노쇼 처리 (PR 1 Foundation).
 *
 *   - GET   /admin/stays                       — 모든 숙소 상품 목록 + 운영 KPI
 *   - GET   /admin/stays/bookings              — 전체 예약 (필터링)
 *   - GET   /admin/stays/bookings/:id          — 예약 상세
 *   - PATCH /admin/stays/bookings/:id/refund   — 어드민 환불 처리
 *   - PATCH /admin/stays/bookings/:id/dispute  — 분쟁 마킹
 *   - PATCH /admin/stays/reviews/:id/hide      — 부적절 리뷰 숨김
 *   - GET   /admin/stays/kpi                   — 전체 숙소 KPI 집계
 *
 * 인증: adminApp.use('*', requireAdmin()) 으로 자동 보호.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { executeQuery, executeRun } from '@/worker/utils/database'
import { writeAuditLog } from '@/worker/middleware/admin-security'

type Bindings = { DB: D1Database; JWT_SECRET: string }
export const adminStaysRoutes = new Hono<{ Bindings: Bindings }>()

function safeAdminError(err: unknown, _env: Bindings): string {
  return import.meta.env.DEV ? (err as Error).message : 'Internal error'
}

// 1. 숙소 상품 전체 목록 + KPI
adminStaysRoutes.get('/stays', cors(), async (c) => {
  try {
    const rows = await executeQuery<Record<string, unknown>>(c.env.DB,
      `SELECT p.id, p.name, p.image_url, p.is_active, p.seller_id, p.created_at,
              s.name as seller_name, s.business_registration_status,
              psi.property_type, psi.region_sido, psi.region_sigungu, psi.star_rating,
              (SELECT COUNT(*) FROM product_stay_rooms r WHERE r.product_id = p.id AND r.is_active = 1) as room_count,
              (SELECT COUNT(*) FROM stay_bookings b WHERE b.product_id = p.id AND b.status IN ('confirmed','checked_in')) as active_bookings,
              (SELECT COUNT(*) FROM stay_bookings b WHERE b.product_id = p.id AND b.status = 'no_show') as no_show_count,
              (SELECT AVG(rating_overall) FROM stay_booking_reviews rev WHERE rev.product_id = p.id AND rev.is_visible = 1) as avg_rating
         FROM products p
         LEFT JOIN sellers s ON s.id = p.seller_id
         LEFT JOIN product_stay_info psi ON psi.product_id = p.id
        WHERE p.category = 'stay_voucher'
        ORDER BY p.created_at DESC
        LIMIT 200`
    ).catch(() => [])
    return c.json({ success: true, data: rows })
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500)
  }
})

// 2. 예약 목록 (필터: status / 기간 / 셀러)
adminStaysRoutes.get('/stays/bookings', cors(), async (c) => {
  try {
    const status = c.req.query('status') || ''
    const sellerId = c.req.query('seller_id')
    const from = c.req.query('from')
    const to = c.req.query('to')

    let sql = `
      SELECT b.*, p.name as product_name, r.name as room_name,
             s.name as seller_name, u.name as user_name, u.phone as user_phone
        FROM stay_bookings b
        LEFT JOIN products p ON p.id = b.product_id
        LEFT JOIN product_stay_rooms r ON r.id = b.room_id
        LEFT JOIN sellers s ON s.id = b.seller_id
        LEFT JOIN users u ON u.id = b.user_id
       WHERE 1=1`
    const params: unknown[] = []
    if (status) { sql += ' AND b.status = ?'; params.push(status) }
    if (sellerId) { sql += ' AND b.seller_id = ?'; params.push(Number(sellerId)) }
    if (from) { sql += ' AND b.check_in_date >= ?'; params.push(from) }
    if (to) { sql += ' AND b.check_in_date <= ?'; params.push(to) }
    sql += ' ORDER BY b.check_in_date DESC LIMIT 200'

    const rows = await executeQuery<Record<string, unknown>>(c.env.DB, sql, params).catch(() => [])
    return c.json({ success: true, data: rows })
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500)
  }
})

// 3. 예약 상세
adminStaysRoutes.get('/stays/bookings/:id', cors(), async (c) => {
  try {
    const id = Number(c.req.param('id'))
    const booking = await c.env.DB.prepare(
      `SELECT b.*, p.name as product_name, r.name as room_name,
              s.name as seller_name, u.name as user_name, u.phone as user_phone, u.email as user_email
         FROM stay_bookings b
         LEFT JOIN products p ON p.id = b.product_id
         LEFT JOIN product_stay_rooms r ON r.id = b.room_id
         LEFT JOIN sellers s ON s.id = b.seller_id
         LEFT JOIN users u ON u.id = b.user_id
        WHERE b.id = ?`
    ).bind(id).first<Record<string, unknown>>()
    if (!booking) return c.json({ success: false, error: '예약 없음' }, 404)

    const log = await c.env.DB.prepare(
      'SELECT * FROM stay_booking_status_log WHERE booking_id = ? ORDER BY created_at DESC'
    ).bind(id).all<Record<string, unknown>>().catch(() => ({ results: [] }))

    return c.json({ success: true, data: { booking, status_log: log.results || [] } })
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500)
  }
})

// 4. 어드민 환불 처리 (분쟁 해결 / 매장 사정)
adminStaysRoutes.patch('/stays/bookings/:id/refund', cors(), async (c) => {
  try {
    const id = Number(c.req.param('id'))
    const body = await c.req.json<{ refund_amount?: number; reason?: string }>()
    const reason = String(body.reason || '').trim().slice(0, 500)
    if (!reason) return c.json({ success: false, error: '환불 사유 필요' }, 400)

    const booking = await c.env.DB.prepare(
      'SELECT id, status, total_amount FROM stay_bookings WHERE id = ?'
    ).bind(id).first<{ id: number; status: string; total_amount: number }>()
    if (!booking) return c.json({ success: false, error: '예약 없음' }, 404)
    if (['refunded', 'cancelled'].includes(booking.status)) {
      return c.json({ success: false, error: '이미 환불/취소된 예약입니다' }, 400)
    }
    const refundAmount = body.refund_amount != null
      ? Math.max(0, Math.min(booking.total_amount, Math.floor(Number(body.refund_amount))))
      : booking.total_amount

    // 🛡️ 2026-05-18: 토스 카드 환불 자동 트리거.
    let refundActuallyDone = false
    let refundError: string | null = null
    const fullBooking = await c.env.DB.prepare(
      'SELECT order_id FROM stay_bookings WHERE id = ?'
    ).bind(id).first<{ order_id: number }>()
    if (fullBooking?.order_id) {
      const orderRow = await c.env.DB.prepare(
        'SELECT payment_key FROM orders WHERE id = ?'
      ).bind(fullBooking.order_id).first<{ payment_key: string | null }>().catch(() => null)
      if (orderRow?.payment_key) {
        const { tossCancelPayment } = await import('@/worker/utils/toss-refund')
        const result = await tossCancelPayment(c.env as unknown as { TOSS_SECRET_KEY?: string }, orderRow.payment_key, {
          reason: `어드민 환불: ${reason}`.slice(0, 200),
          amount: refundAmount < booking.total_amount ? refundAmount : undefined,
          idempotencyKey: `admin-stay-refund-${id}`,
        })
        refundActuallyDone = result.ok
        refundError = result.ok ? null : `${result.error_code}: ${result.error_message}`
      } else {
        refundError = 'payment_key 없음 (수동 환불 필요)'
      }
    }

    await executeRun(c.env.DB,
      `UPDATE stay_bookings
          SET status = 'refunded', refund_amount = ?,
              refunded_at = ${refundActuallyDone ? "datetime('now')" : 'NULL'},
              cancellation_reason = ?, updated_at = datetime('now')
        WHERE id = ?`,
      [refundAmount, reason, id])

    await executeRun(c.env.DB,
      `INSERT INTO stay_booking_status_log (booking_id, prev_status, new_status, changed_by_role, reason)
       VALUES (?, ?, 'refunded', 'admin', ?)`,
      [id, booking.status, refundError ? `${reason} (환불API 실패: ${refundError})` : reason]).catch(() => { /* noop */ })

    await writeAuditLog(c, {
      action: 'admin_refund_stay_booking',
      targetType: 'stay_booking',
      targetId: String(id),
      before: { status: booking.status },
      after: { status: 'refunded', refund_amount: refundAmount, reason, refund_done: refundActuallyDone, refund_error: refundError },
    })

    return c.json({
      success: true,
      message: refundActuallyDone
        ? `환불 처리됨 — 카드 ${refundAmount.toLocaleString()}원 환불 완료`
        : `환불 마킹됨 — ${refundError ? `카드 환불 실패 (${refundError})` : '수동 환불 필요'}`,
      data: { refund_done: refundActuallyDone, refund_error: refundError },
    })
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500)
  }
})

// 5. 분쟁 마킹
adminStaysRoutes.patch('/stays/bookings/:id/dispute', cors(), async (c) => {
  try {
    const id = Number(c.req.param('id'))
    const body = await c.req.json<{ dispute_id?: number; reason?: string }>()
    const disputeId = body.dispute_id != null ? Number(body.dispute_id) : null
    const reason = String(body.reason || '').trim()

    const booking = await c.env.DB.prepare(
      'SELECT id, status FROM stay_bookings WHERE id = ?'
    ).bind(id).first<{ id: number; status: string }>()
    if (!booking) return c.json({ success: false, error: '예약 없음' }, 404)

    await executeRun(c.env.DB,
      `UPDATE stay_bookings
          SET status = 'dispute', dispute_id = ?, updated_at = datetime('now')
        WHERE id = ?`,
      [disputeId, id])

    await executeRun(c.env.DB,
      `INSERT INTO stay_booking_status_log (booking_id, prev_status, new_status, changed_by_role, reason)
       VALUES (?, ?, 'dispute', 'admin', ?)`,
      [id, booking.status, reason || null]).catch(() => { /* noop */ })

    return c.json({ success: true })
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500)
  }
})

// 6. 리뷰 숨김
adminStaysRoutes.patch('/stays/reviews/:id/hide', cors(), async (c) => {
  try {
    const id = Number(c.req.param('id'))
    await executeRun(c.env.DB,
      `UPDATE stay_booking_reviews SET is_visible = 0, updated_at = datetime('now') WHERE id = ?`,
      [id])
    await writeAuditLog(c, { action: 'hide_stay_review', targetType: 'stay_review', targetId: String(id) })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500)
  }
})

// 7. 전체 KPI 집계 (어드민 대시보드)
adminStaysRoutes.get('/stays/kpi', cors(), async (c) => {
  try {
    const safe = async <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null)
    const [totalProps, activeProps, totalRooms, totalBookings, confirmedBookings, noShowBookings, totalRevenue, avgRating] = await Promise.all([
      safe(c.env.DB.prepare(`SELECT COUNT(*) as n FROM products WHERE category='stay_voucher'`).first<{ n: number }>()),
      safe(c.env.DB.prepare(`SELECT COUNT(*) as n FROM products WHERE category='stay_voucher' AND is_active=1`).first<{ n: number }>()),
      safe(c.env.DB.prepare(`SELECT COUNT(*) as n FROM product_stay_rooms WHERE is_active=1`).first<{ n: number }>()),
      safe(c.env.DB.prepare(`SELECT COUNT(*) as n FROM stay_bookings`).first<{ n: number }>()),
      safe(c.env.DB.prepare(`SELECT COUNT(*) as n FROM stay_bookings WHERE status IN ('confirmed','checked_in','checked_out')`).first<{ n: number }>()),
      safe(c.env.DB.prepare(`SELECT COUNT(*) as n FROM stay_bookings WHERE status='no_show'`).first<{ n: number }>()),
      safe(c.env.DB.prepare(`SELECT COALESCE(SUM(total_amount), 0) as n FROM stay_bookings WHERE status IN ('confirmed','checked_in','checked_out')`).first<{ n: number }>()),
      safe(c.env.DB.prepare(`SELECT AVG(rating_overall) as avg FROM stay_booking_reviews WHERE is_visible=1`).first<{ avg: number }>()),
    ])
    return c.json({
      success: true,
      data: {
        total_properties: totalProps?.n || 0,
        active_properties: activeProps?.n || 0,
        total_rooms: totalRooms?.n || 0,
        total_bookings: totalBookings?.n || 0,
        confirmed_bookings: confirmedBookings?.n || 0,
        no_show_bookings: noShowBookings?.n || 0,
        total_revenue: totalRevenue?.n || 0,
        avg_rating: avgRating?.avg || null,
      },
    })
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500)
  }
})
