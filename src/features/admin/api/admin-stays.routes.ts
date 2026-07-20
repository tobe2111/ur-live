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


// ─── 🏨 2026-07-20 (대표 — "숙소 이용권 더미데이터" → "데모 채우기 카테고리로 통합"): 생성형 데모 숙소 시드 ──
//   동네딜 데모(DEMO_BIZ 생성형)와 동일 철학 — 스팟×유형 조합 문법으로 지역/개수 옵션 지원.
//   멱등/충돌 0: slug 'demo-stay-N' 최대 N 다음부터 누적. 이미지 = picsum(시드 고정, cf-image 등재 호스트).
//   ⚠️ 일정·인원은 시드 옵션 불필요(설계): 캘린더 행이 없으면 검색 가용성 통과(NOT EXISTS) = 전 날짜 예약
//   가능으로 취급되고, 객실 인원은 아래 문법이 2~6인을 자동 분산해 인원 필터 검색이 항상 유효.
const STAY_SPOTS = [
  { label: '가평', sido: '경기', sigungu: '가평군', addr: '경기 가평군 청평면 호반로', lat: 37.7452, lng: 127.4223 },
  { label: '강릉', sido: '강원', sigungu: '강릉시', addr: '강원 강릉시 창해로', lat: 37.7911, lng: 128.9183 },
  { label: '제주 애월', sido: '제주', sigungu: '제주시', addr: '제주 제주시 애월읍 애월해안로', lat: 33.4658, lng: 126.3272 },
  { label: '부산 해운대', sido: '부산', sigungu: '해운대구', addr: '부산 해운대구 해운대해변로', lat: 35.1587, lng: 129.1604 },
  { label: '전주', sido: '전북', sigungu: '전주시', addr: '전북 전주시 완산구 은행로', lat: 35.8155, lng: 127.1534 },
  { label: '속초', sido: '강원', sigungu: '속초시', addr: '강원 속초시 미시령로', lat: 38.2070, lng: 128.5189 },
  { label: '여수', sido: '전남', sigungu: '여수시', addr: '전남 여수시 돌산읍 돌산로', lat: 34.7365, lng: 127.7469 },
  { label: '경주', sido: '경북', sigungu: '경주시', addr: '경북 경주시 보문로', lat: 35.8419, lng: 129.2846 },
  { label: '양양', sido: '강원', sigungu: '양양군', addr: '강원 양양군 현남면 인구길', lat: 37.9670, lng: 128.7622 },
  { label: '춘천', sido: '강원', sigungu: '춘천시', addr: '강원 춘천시 남산면 남이섬길', lat: 37.8813, lng: 127.7300 },
  { label: '통영', sido: '경남', sigungu: '통영시', addr: '경남 통영시 도남로', lat: 34.8368, lng: 128.4207 },
  { label: '서울 성수', sido: '서울', sigungu: '성동구', addr: '서울 성동구 연무장길', lat: 37.5446, lng: 127.0561 },
]
const STAY_TYPES = [
  { type: 'pension', label: '펜션', mods: ['숲속 풀빌라', '계곡 앞', '프라이빗 스파', '노을뷰'], desc: '독채형 펜션 — 바비큐 테라스와 프라이빗한 휴식.' },
  { type: 'hotel', label: '호텔', mods: ['오션뷰', '시티', '부티크', '스카이라운지'], desc: '접근성 좋은 호텔 — 깔끔한 룸 컨디션과 24시간 프런트.' },
  { type: 'guesthouse', label: '스테이', mods: ['감성', '한옥', '북스테이', '골목 안'], desc: '감성 숙소 — 조용한 골목에서 즐기는 로컬 감성.' },
  { type: 'resort', label: '리조트', mods: ['패밀리', '온수풀', '마운틴뷰'], desc: '가족 단위 리조트 — 온수풀·사우나 등 부대시설 완비.' },
  { type: 'glamping', label: '글램핑', mods: ['별빛', '리버뷰', '불멍'], desc: '장비 없이 즐기는 글램핑 — 개별 화로와 냉난방 텐트.' },
]

adminStaysRoutes.post('/stays/seed-demo', cors(), async (c) => {
  try {
    const { DB } = c.env
    const body = (await c.req.json().catch(() => ({}))) as { region?: string; count?: number }
    const regionQ = String(body.region || '').trim()
    const count = Math.max(1, Math.min(24, Number(body.count) || 6))
    // 지역 옵션: label/sido 부분일치 스팟만(예 "강원"→강릉·속초·양양·춘천, "해운대"→부산 해운대). 미매칭 시 전체.
    const spotsAll = regionQ
      ? STAY_SPOTS.filter((s) => s.label.includes(regionQ) || s.sido.includes(regionQ) || regionQ.includes(s.label) || regionQ.includes(s.sido))
      : STAY_SPOTS
    const spots = spotsAll.length > 0 ? spotsAll : STAY_SPOTS
    // slug 누적 번호(demo-stay-N 최대 N 다음) — 재실행 충돌 0.
    const slugRows = await DB.prepare(`SELECT slug FROM products WHERE slug LIKE 'demo-stay-%'`)
      .all<{ slug: string }>().catch(() => ({ results: [] as { slug: string }[] }))
    let n = 0
    for (const r of (slugRows.results || [])) {
      const m = /^demo-stay-(\d+)$/.exec(r.slug || '')
      if (m) n = Math.max(n, Number(m[1]))
    }
    let created = 0
    for (let i = 0; i < count; i++) {
      n++
      const slug = `demo-stay-${n}`
      const spot = spots[(n + i) % spots.length]
      const ty = STAY_TYPES[n % STAY_TYPES.length]
      const mod = ty.mods[n % ty.mods.length]
      const name = `${spot.label} ${mod} ${ty.label}`
      const desc = `${spot.label}의 ${mod} ${ty.label}. ${ty.desc}`
      // 좌표 지터(±~1.5km) — 같은 스팟 반복 시 지도에서 겹치지 않게(결정적 — 번호 기반).
      const jLat = spot.lat + (((n * 7) % 21) - 10) * 0.0015
      const jLng = spot.lng + (((n * 13) % 21) - 10) * 0.0015
      const img = `https://picsum.photos/seed/${slug}/800/600`
      const ins = await DB.prepare(
        `INSERT INTO products (seller_id, name, description, image_url, price, category, product_type, is_active, slug, created_at, updated_at)
         VALUES (NULL, ?, ?, ?, 0, 'stay_voucher', 'featured', 1, ?, datetime('now'), datetime('now'))`
      ).bind(name, desc, img, slug).run()
      const pid = Number(ins.meta.last_row_id)
      if (!pid) continue
      const star = ty.type === 'hotel' || ty.type === 'resort' ? 3 + (n % 3) : null
      await DB.prepare(
        `INSERT INTO product_stay_info (
           product_id, property_type, star_rating, total_rooms, check_in_time, check_out_time,
           address, region_sido, region_sigungu, latitude, longitude,
           amenities, room_amenities, cancellation_policy, description_full,
           min_nights, advance_booking_days)
         VALUES (?, ?, ?, 2, '15:00', '11:00', ?, ?, ?, ?, ?, ?, ?, 'standard', ?, 1, 90)`
      ).bind(
        pid, ty.type, star, `${spot.addr} ${100 + (n % 80)}`, spot.sido, spot.sigungu, jLat, jLng,
        JSON.stringify(['무료 주차', '와이파이', ty.type === 'glamping' ? '개별 화로' : '조식']),
        JSON.stringify(['에어컨', '냉장고', '무료 세면용품']), desc,
      ).run()
      // 객실 2종 — 인원 2~6 자동 분산(인원 필터 검색이 항상 유효하게) + 주중/주말가.
      const baseWd = 69000 + ((n % 6) * 20000)
      const rooms = [
        { name: `스탠다드 ${ty.label === '글램핑' ? '텐트' : '룸'}`, bg: 2, mg: 2 + ((n % 2) * 2), wd: baseWd, we: Math.round(baseWd * 1.4 / 1000) * 1000 },
        { name: `프리미엄 ${mod}${ty.label === '펜션' ? ' 독채' : ' 스위트'}`, bg: 2, mg: 4 + (n % 3), wd: baseWd + 60000, we: Math.round((baseWd + 60000) * 1.4 / 1000) * 1000 },
      ]
      let order = 0
      for (const r of rooms) {
        order++
        await DB.prepare(
          `INSERT INTO product_stay_rooms (
             product_id, name, description, display_order, base_guests, max_guests, extra_guest_fee,
             base_price_weekday, base_price_weekend, total_inventory, amenities, image_urls, is_active)
           VALUES (?, ?, NULL, ?, ?, ?, 20000, ?, ?, 3, ?, ?, 1)`
        ).bind(
          pid, r.name, order, r.bg, r.mg, r.wd, r.we,
          JSON.stringify(['에어컨', '냉장고']), JSON.stringify([`https://picsum.photos/seed/${slug}-r${order}/800/600`]),
        ).run()
      }
      created++
    }
    return c.json({ success: true, data: { created, requested: count, region: regionQ || null } })
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
