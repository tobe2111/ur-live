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
      'SELECT id, status, total_amount, room_id, check_in_date, check_out_date FROM stay_bookings WHERE id = ?'
    ).bind(id).first<{ id: number; status: string; total_amount: number; room_id: number; check_in_date: string; check_out_date: string }>()
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

    // 🛡️ 2026-06-01 머니플로우 감사 fix: Toss 환불 실패 시 status='refunded' 로 거짓표기 금지.
    //   실제 환불 성공 시에만 'refunded', 실패면 'cancelled' (유저 경로 stays-public 과 동일 정합).
    const nextStatus = refundActuallyDone ? 'refunded' : 'cancelled'
    await executeRun(c.env.DB,
      `UPDATE stay_bookings
          SET status = ?, refund_amount = ?,
              refunded_at = ${refundActuallyDone ? "datetime('now')" : 'NULL'},
              cancellation_reason = ?, updated_at = datetime('now')
        WHERE id = ?`,
      [nextStatus, refundAmount, reason, id])

    // 🛡️ 2026-05-31: 환불 성공 시 인플 affiliate 커미션 reverse — 환불 매출 출금 누수 차단.
    if (refundActuallyDone && fullBooking?.order_id) {
      await c.env.DB.prepare(
        "UPDATE affiliate_earnings SET status = 'refunded' WHERE order_id = ? AND COALESCE(status, 'pending') IN ('granted', 'pending', 'holding')"
      ).bind(fullBooking.order_id).run().catch(() => null)
    }

    // 🛡️ 2026-05-31: confirmed 였던 예약만 객실 야간 재고 복원 (취소 시 영구 unavailable 방지).
    if (booking.status === 'confirmed') {
      const { releaseStayInventory } = await import('@/worker/utils/stay-inventory')
      await releaseStayInventory(c.env.DB, booking.room_id, booking.check_in_date, booking.check_out_date)
    }

    await executeRun(c.env.DB,
      `INSERT INTO stay_booking_status_log (booking_id, prev_status, new_status, changed_by_role, reason)
       VALUES (?, ?, ?, 'admin', ?)`,
      [id, booking.status, nextStatus, refundError ? `${reason} (환불API 실패: ${refundError})` : reason]).catch(() => { /* noop */ })

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

// ─── 🏨 2026-07-20 (대표 — "숙소 이용권 더미데이터"): 데모 숙소 시드 ─────────────────
//   멱등: slug 'demo-stay-N' 존재하면 skip(재실행 안전). 동네딜 데모(demo-deal-N)와 동일 철학 —
//   유저에겐 실제 숙소처럼 보이고, 데모 식별은 slug 로만. 이미지 = picsum.photos(시드 고정 —
//   cf-image EXTERNAL_PROXY 등재 호스트). 삭제: DELETE /stays/seed-demo (데모만 비활성).
const DEMO_STAYS = [
  { slug: 'demo-stay-1', name: '가평 숲속 풀빌라 펜션', type: 'pension', sido: '경기', sigungu: '가평군', addr: '경기 가평군 청평면 호반로 1223', lat: 37.7452, lng: 127.4223, star: null,
    desc: '북한강이 내려다보이는 숲속 독채 풀빌라. 전 객실 개별 수영장 + 바비큐 테라스.',
    rooms: [ { name: '스탠다드 풀빌라', bg: 2, mg: 4, wd: 129000, we: 189000 }, { name: '프리미엄 풀빌라 스위트', bg: 2, mg: 6, wd: 219000, we: 299000 } ] },
  { slug: 'demo-stay-2', name: '강릉 오션뷰 스테이', type: 'hotel', sido: '강원', sigungu: '강릉시', addr: '강원 강릉시 창해로 307', lat: 37.7911, lng: 128.9183, star: 4,
    desc: '경포해변 도보 3분, 전 객실 바다 전망. 조식 포함 플랜과 루프탑 인피니티 스파.',
    rooms: [ { name: '오션뷰 더블', bg: 2, mg: 2, wd: 89000, we: 129000 }, { name: '패밀리 트윈', bg: 2, mg: 4, wd: 119000, we: 159000 } ] },
  { slug: 'demo-stay-3', name: '제주 애월 감성 독채', type: 'pension', sido: '제주', sigungu: '제주시', addr: '제주 제주시 애월읍 애월해안로 632', lat: 33.4658, lng: 126.3272, star: null,
    desc: '애월 바다 앞 돌담 독채 스테이. 노을 명소 한담해변 도보 5분, 감성 자쿠지 포함.',
    rooms: [ { name: '독채 A (자쿠지)', bg: 2, mg: 4, wd: 149000, we: 199000 }, { name: '독채 B (오션뷰)', bg: 2, mg: 5, wd: 169000, we: 229000 } ] },
  { slug: 'demo-stay-4', name: '부산 해운대 시티호텔', type: 'hotel', sido: '부산', sigungu: '해운대구', addr: '부산 해운대구 해운대해변로 264', lat: 35.1587, lng: 129.1604, star: 4,
    desc: '해운대해수욕장 도보 1분. 시티뷰/오션뷰 선택, 24시간 프런트와 발레파킹.',
    rooms: [ { name: '스탠다드 더블', bg: 2, mg: 2, wd: 79000, we: 109000 }, { name: '디럭스 오션뷰', bg: 2, mg: 3, wd: 109000, we: 149000 } ] },
  { slug: 'demo-stay-5', name: '전주 한옥마을 고즈넉 스테이', type: 'guesthouse', sido: '전북', sigungu: '전주시', addr: '전북 전주시 완산구 은행로 39', lat: 35.8155, lng: 127.1534, star: null,
    desc: '한옥마을 중심 골목의 전통 한옥 스테이. 온돌방·툇마루·전통차 웰컴 세트.',
    rooms: [ { name: '온돌방', bg: 2, mg: 3, wd: 99000, we: 139000 }, { name: '별채 (독채)', bg: 2, mg: 4, wd: 139000, we: 179000 } ] },
  { slug: 'demo-stay-6', name: '속초 설악 리조트', type: 'resort', sido: '강원', sigungu: '속초시', addr: '강원 속초시 미시령로 2983', lat: 38.2070, lng: 128.5189, star: 4,
    desc: '설악산 케이블카 5분 거리. 온수풀·사우나·키즈존을 갖춘 패밀리 리조트.',
    rooms: [ { name: '패밀리 스위트', bg: 2, mg: 4, wd: 99000, we: 149000 }, { name: '설악뷰 스위트', bg: 2, mg: 5, wd: 159000, we: 219000 } ] },
]

adminStaysRoutes.post('/stays/seed-demo', cors(), async (c) => {
  try {
    const { DB } = c.env
    let created = 0, skipped = 0
    for (const s of DEMO_STAYS) {
      const exists = await DB.prepare(`SELECT id FROM products WHERE slug = ?`).bind(s.slug).first<{ id: number }>()
      if (exists?.id) { skipped++; continue }
      const img = `https://picsum.photos/seed/${s.slug}/800/600`
      const ins = await DB.prepare(
        `INSERT INTO products (seller_id, name, description, image_url, price, category, product_type, is_active, slug, created_at, updated_at)
         VALUES (NULL, ?, ?, ?, 0, 'stay_voucher', 'featured', 1, ?, datetime('now'), datetime('now'))`
      ).bind(s.name, s.desc, img, s.slug).run()
      const pid = Number(ins.meta.last_row_id)
      if (!pid) continue
      await DB.prepare(
        `INSERT INTO product_stay_info (
           product_id, property_type, star_rating, total_rooms, check_in_time, check_out_time,
           address, region_sido, region_sigungu, latitude, longitude,
           amenities, room_amenities, cancellation_policy, description_full,
           min_nights, advance_booking_days)
         VALUES (?, ?, ?, ?, '15:00', '11:00', ?, ?, ?, ?, ?, ?, ?, 'standard', ?, 1, 90)`
      ).bind(
        pid, s.type, s.star, s.rooms.length, s.addr, s.sido, s.sigungu, s.lat, s.lng,
        JSON.stringify(['무료 주차', '와이파이', '조식']), JSON.stringify(['에어컨', '냉장고', '무료 세면용품']), s.desc,
      ).run()
      let order = 0
      for (const r of s.rooms) {
        await DB.prepare(
          `INSERT INTO product_stay_rooms (
             product_id, name, description, display_order, base_guests, max_guests, extra_guest_fee,
             base_price_weekday, base_price_weekend, total_inventory, amenities, image_urls, is_active)
           VALUES (?, ?, NULL, ?, ?, ?, 20000, ?, ?, 3, ?, ?, 1)`
        ).bind(
          pid, r.name, order++, r.bg, r.mg, r.wd, r.we,
          JSON.stringify(['에어컨', '냉장고']), JSON.stringify([`https://picsum.photos/seed/${s.slug}-r${order}/800/600`]),
        ).run()
      }
      created++
    }
    return c.json({ success: true, data: { created, skipped, total: DEMO_STAYS.length } })
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500)
  }
})

// DELETE /stays/seed-demo — 데모 숙소만 비활성(soft-retire, 참조 보존)
adminStaysRoutes.delete('/stays/seed-demo', cors(), async (c) => {
  try {
    const { DB } = c.env
    const r = await DB.prepare(
      `UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE slug LIKE 'demo-stay-%' AND is_active = 1`
    ).run()
    return c.json({ success: true, data: { retired: r.meta.changes || 0 } })
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500)
  }
})
