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
import type { Env } from '@/worker/types/env'
import { executeQuery, executeRun } from '@/worker/utils/database'
import { writeAuditLog } from '@/worker/middleware/admin-security'
import { rehostImageToR2 } from '@/worker/utils/rehost-image'

// 🛡️ 2026-07-20: 데모 숙소 시드가 kakaoPlaceLookup / fetchNaverImageUrl(전체 Env 기대)를
//   호출하는데 로컬 Bindings 가 { DB, JWT_SECRET } 로 좁아 c.env 타입 불일치(배포 차단 TS2345/2559).
//   자매 파일(admin-products.routes.ts new Hono<{ Bindings: Env }>)과 동일하게 전체 Env 사용.
type Bindings = Env
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
        const { tossCancelPayment } = await import('../../../worker/utils/toss-refund') // ⚠️ 상대경로 필수 — 워커 런타임엔 `@/` 별칭이 없다(crash, CLAUDE.md 2026-04-22)
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
      const { releaseStayInventory } = await import('../../../worker/utils/stay-inventory') // ⚠️ 상대경로 필수 — 워커 런타임엔 `@/` 별칭이 없다(crash, CLAUDE.md 2026-04-22)
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
  { type: 'pension', label: '펜션', kakao: '펜션', mods: ['숲속 풀빌라', '계곡 앞', '프라이빗 스파', '노을뷰'], desc: '테라스에서 바비큐를 할 수 있는 독채형 펜션입니다. 옆 동과 떨어져 있어 조용히 쉬기 좋아요.' },
  { type: 'hotel', label: '호텔', kakao: '호텔', mods: ['오션뷰', '시티', '부티크', '스카이라운지'], desc: '역과 시내에서 가까워 이동이 편합니다. 룸 컨디션이 깔끔하고 프런트는 24시간 운영해요.' },
  { type: 'guesthouse', label: '스테이', kakao: '게스트하우스', mods: ['감성', '한옥', '북스테이', '골목 안'], desc: '조용한 골목 안에 있는 작은 스테이입니다. 동네를 천천히 걸어 보기 좋은 자리예요.' },
  { type: 'resort', label: '리조트', kakao: '리조트', mods: ['패밀리', '온수풀', '마운틴뷰'], desc: '온수풀과 사우나를 갖춰 아이와 함께 가기 좋습니다. 부대시설만으로 하루가 채워져요.' },
  { type: 'glamping', label: '글램핑', kakao: '글램핑', mods: ['별빛', '리버뷰', '불멍'], desc: '장비를 챙길 필요가 없는 글램핑입니다. 개별 화로가 있고 텐트에 냉난방이 들어와요.' },
]
// 🏨 2026-07-21 (대표 "시설 설정 안 됨" — 이상적): 업종별 대표 시설 세트(5~6개). 상세 시설 아이콘 매핑
//   (StayDetailPage amenityMeta)이 한글 키워드로 인식. 공통 + 유형 특색.
const STAY_AMENITIES: Record<string, string[]> = {
  pension: ['무료 주차', '와이파이', '바비큐', '취사 가능', '에어컨', '개별 테라스'],
  hotel: ['무료 주차', '와이파이', '조식', '24시간 프런트', '에어컨', '엘리베이터'],
  guesthouse: ['무료 주차', '와이파이', '조식', '공용 라운지', '에어컨'],
  resort: ['무료 주차', '와이파이', '조식', '온수풀', '사우나', '피트니스'],
  glamping: ['무료 주차', '와이파이', '개별 화로', '바비큐', '냉난방', '샤워실'],
}

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
    // 🏨 2026-07-20 v2 (대표 — "다른 데모처럼 실제처럼"): 동네딜 데모와 동일한 실제화 2단 —
    //   ① 카카오 실숙소 매칭(kakaoPlaceLookup 랜덤 — 실제 있는 펜션/호텔만 데모화, 실명·실주소·실좌표)
    //   ② 네이버 실사진(fetchNaverImageUrl — 매장명 우선, 실패 시 "{지역} {유형}" 일반 검색, 최후 picsum).
    //   실숙소 못 찾으면 skip(지어내지 않음 — 동네딜과 동일 규칙). ⚠️ 외부호출 한도 → 클라가 6개씩 청크.
    const { kakaoPlaceLookup } = await import('./admin-products.routes')
    const { fetchDemoPhotos } = await import('../../../worker/utils/demo-photo-set')
    // 🛡️ 이 파일의 로컬 Bindings 타입은 최소(DB/JWT)만 선언 — 런타임 c.env 엔 KAKAO/NAVER 키가 실재
    //   (같은 워커, admin-products 시드가 동일 키 사용). 헬퍼 파라미터 타입으로 1회 캐스팅.
    const extEnv = c.env as unknown as { KAKAO_REST_API_KEY?: string } & Parameters<typeof fetchDemoPhotos>[0]
    // 🎯 시드된 숙소 — 응답 후 매장특색 리뷰(seedDemoReviews, stay 토픽) 배선용.
    const seededStays: Array<{ id: number; name: string; category: string; storeName: string | null; price: number }> = []
    // 🩹 v3 자동 치유 (2026-07-20 대표 — "좌표가 없고, 가격도 이름도 안 정해져 불완전"): v2 시드가
    //   product_stay_info 에만 좌표/주소를 넣고 목록·카드가 읽는 products 레벨(restaurant_* / price)을
    //   안 채웠음. 기존 시드분을 stay_info + 최저 객실가에서 복사 치유(멱등 — 치유 대상만 매칭, 재실행 무해).
    //   products.name 도 숙소명 그대로였던 것 → 동네딜 규칙(제목=오퍼만, 매장명=restaurant_name 전담)으로 개명.
    let healed = 0
    try {
      const healRows = await DB.prepare(
        `SELECT p.id, p.name,
                psi.address AS psi_address, psi.latitude AS psi_lat, psi.longitude AS psi_lng,
                (SELECT MIN(r.base_price_weekday) FROM product_stay_rooms r WHERE r.product_id = p.id AND r.is_active = 1) AS min_wd,
                (SELECT r2.name FROM product_stay_rooms r2 WHERE r2.product_id = p.id AND r2.is_active = 1 ORDER BY r2.display_order ASC LIMIT 1) AS room_name
         FROM products p JOIN product_stay_info psi ON psi.product_id = p.id
         WHERE p.slug LIKE 'demo-stay-%'
           AND (p.restaurant_lat IS NULL OR p.restaurant_name IS NULL OR COALESCE(p.price, 0) <= 0)`
      ).all<{ id: number; name: string; psi_address: string | null; psi_lat: number | null; psi_lng: number | null; min_wd: number | null; room_name: string | null }>()
      for (const h of (healRows.results || [])) {
        const minWd = Number(h.min_wd) || 0
        const offerName = h.room_name ? `평일 1박 숙박권 (${h.room_name})` : '평일 1박 숙박권'
        const orig = minWd > 0 ? Math.round(minWd * 1.3 / 1000) * 1000 : 0
        // 한 UPDATE 안의 컬럼 참조는 전부 갱신 전 값 → restaurant_name IS NULL(=아직 숙소명이 제목) 조건이 정확.
        const r = await DB.prepare(
          `UPDATE products SET
             restaurant_name = COALESCE(restaurant_name, name),
             restaurant_address = COALESCE(restaurant_address, ?),
             restaurant_lat = COALESCE(restaurant_lat, ?),
             restaurant_lng = COALESCE(restaurant_lng, ?),
             price = CASE WHEN COALESCE(price, 0) <= 0 AND ? > 0 THEN ? ELSE price END,
             original_price = CASE WHEN COALESCE(original_price, 0) <= 0 AND ? > 0 THEN ? ELSE original_price END,
             name = CASE WHEN restaurant_name IS NULL OR name = restaurant_name THEN ? ELSE name END,
             updated_at = datetime('now')
           WHERE id = ?`
        ).bind(h.psi_address, h.psi_lat, h.psi_lng, minWd, minWd, orig, orig, offerName, h.id).run().catch(() => null)
        if (r && (r.meta.changes || 0) > 0) healed++
      }
    } catch { /* restaurant_lat 컬럼 미존재 환경 등 — 치유는 best-effort, 시드 진행 */ }
    // 🏨 시설 백필 (2026-07-21 대표 "기존 숙소도 시설 채워져?"): 옛 시드가 시설 3개(주차/와이파이/조식)만
    //   넣은 기존 데모를 업종별 5~6개 풍부 세트(STAY_AMENITIES)로 갱신. 4개 미만인 것만 대상(멱등 — 이미
    //   풍부하면 skip, 관리자 수기 편집분도 대개 4개+ 라 무접촉). property_type 로 세트 선택.
    let amenityHealed = 0
    try {
      const thin = await DB.prepare(
        `SELECT psi.product_id AS pid, psi.property_type AS ptype, psi.amenities AS amen
           FROM product_stay_info psi JOIN products p ON p.id = psi.product_id
          WHERE p.slug LIKE 'demo-stay-%' AND COALESCE(p.is_active,1) = 1`
      ).all<{ pid: number; ptype: string | null; amen: string | null }>()
        .catch(() => ({ results: [] as { pid: number; ptype: string | null; amen: string | null }[] }))
      for (const row of (thin.results || [])) {
        let cur: string[] = []
        try { const v = JSON.parse(row.amen || '[]'); if (Array.isArray(v)) cur = v.filter((x) => typeof x === 'string') } catch { /* bad json → 교체 */ }
        if (cur.length >= 4) continue  // 이미 풍부 — 무접촉
        const rich = STAY_AMENITIES[row.ptype || ''] || STAY_AMENITIES.hotel
        const r = await DB.prepare(`UPDATE product_stay_info SET amenities = ? WHERE product_id = ?`)
          .bind(JSON.stringify(rich), row.pid).run().catch(() => null)
        if (r && (r.meta.changes || 0) > 0) amenityHealed++
      }
    } catch { /* best-effort — 시설 백필 실패가 시드를 막지 않음 */ }
    // 🖼️ v4 사진·카카오링크 자동 치유 (2026-07-21 대표 "카카오맵 무조건 + 사진 3~5장"): 갤러리(images)
    //   없는 기존 데모 숙소를 요청당 3개까지 실사진 3~5장 + kakao_place_url 백필(외부호출 한도 보호 —
    //   신규 생성 6개×4~5콜 뒤에도 50 한도 안). placeId 는 저장된 kakao_place_url 에서 추출, 없으면
    //   숙소 실명으로 재조회(정확일치일 때만 링크 신뢰 — 오매칭 방지, 사진은 네이버 스코어링 폴백).
    let photoHealed = 0
    try {
      const needPhoto = await DB.prepare(
        `SELECT p.id, p.restaurant_name, p.image_url, p.restaurant_address AS addr,
                psi.latitude AS lat, psi.longitude AS lng
           FROM products p JOIN product_stay_info psi ON psi.product_id = p.id
          WHERE p.slug LIKE 'demo-stay-%'
            AND (p.images IS NULL OR p.images = '' OR p.images = '[]')
          LIMIT 3`
      ).all<{ id: number; restaurant_name: string | null; image_url: string | null; addr: string | null; lat: number | null; lng: number | null }>()
      const rows = needPhoto.results || []
      if (rows.length > 0) {
        const { getSupplyMeta, setSupplyMeta } = await import('../../../worker/utils/product-supply-meta')
        const metaMap = await getSupplyMeta(DB, rows.map((r) => r.id))
        for (const row of rows) {
          if (!row.restaurant_name) continue
          let placeRef: string | null = metaMap.get(row.id)?.kakao_place_url || null
          if (!placeRef) {
            const found = await kakaoPlaceLookup(extEnv, row.restaurant_name, 0,
              row.lat != null && row.lng != null ? { x: String(row.lng), y: String(row.lat) } : null)
            if (found?.name === row.restaurant_name && found.placeUrl) {
              placeRef = found.placeUrl
              await setSupplyMeta(DB, row.id, { kakao_place_url: found.placeUrl }).catch(() => {})
            }
          }
          const imgs = await fetchDemoPhotos(extEnv, {
            placeId: placeRef,
            nameQuery: row.restaurant_name,
            address: row.addr,  // 🖼️ 네이버 지도 대표사진 검색 정확도
            count: 3 + Math.floor(Math.random() * 3),
          }).catch(() => [] as string[])
          if (imgs.length === 0) continue
          // 대표가 placeholder(picsum/없음)면 실사진 1번째로 교체, 실사진이면 유지하고 갤러리에 병합.
          const isPlaceholder = !row.image_url || /picsum\.photos/.test(row.image_url)
          const gallery = (isPlaceholder ? imgs : Array.from(new Set([row.image_url as string, ...imgs]))).slice(0, 5)
          await DB.prepare(`UPDATE products SET images = ?, image_url = ?, updated_at = datetime('now') WHERE id = ?`)
            .bind(JSON.stringify(gallery), gallery[0], row.id).run().catch(() => {})
          photoHealed++
        }
      }
    } catch { /* images 컬럼 미존재 환경 등 — best-effort */ }
    let created = 0, skipped = 0, realPhotos = 0, skippedNoPhoto = 0
    for (let i = 0; i < count; i++) {
      const spot = spots[(n + 1 + i) % spots.length]
      const ty = STAY_TYPES[(n + 1 + i) % STAY_TYPES.length]
      // ① 실숙소 매칭 — 스팟 좌표 반경 20km 거리순 + 랜덤 후보(같은 지역 재시드에도 다른 실숙소).
      const place = await kakaoPlaceLookup(extEnv, `${spot.label} ${ty.kakao}`, -1, { x: String(spot.lng), y: String(spot.lat) })
      if (!place?.name || place.lat == null || place.lng == null) { skipped++; continue }
      // 같은 실숙소 중복 시드 방지(이름 정확일치).
      const dup = await DB.prepare(`SELECT id FROM products WHERE category = 'stay_voucher' AND name = ? LIMIT 1`)
        .bind(place.name).first<{ id: number }>().catch(() => null)
      if (dup?.id) { skipped++; continue }
      n++
      const slug = `demo-stay-${n}`
      // ② 실사진 3~5장(랜덤 — 2026-07-20 대표 "사진 3~5장, 랜덤으로" + "카카오 플레이스 사진도 함께"):
      //   fetchDemoPhotos = 카카오 플레이스 등록 사진(그 숙소 실제 사진, 관련도 100%) 우선 →
      //   부족분 네이버 매장명 스코어링 → 지역+유형 일반 폴백. 전부 실패 시 picsum.
      const wantPhotos = 3 + Math.floor(Math.random() * 3)
      const imgs = await fetchDemoPhotos(extEnv, {
        placeId: place.placeId,
        nameQuery: place.name,
        address: place.address || spot.addr,  // 🖼️ 네이버 지도 대표사진 검색 정확도
        fallbackQuery: `${spot.label} ${ty.kakao}`,
        count: wantPhotos,
      }).catch(() => [] as string[])
      if (imgs.length) realPhotos++
      // 🚫 2026-08-08 대표 "사진 없으면 자체가 안올려져야지" — picsum 더미 폴백 폐기. 사유: 동명 테스트.
      if (imgs.length === 0) { skippedNoPhoto++; continue }
      // 🩹 2026-07-21 전수조사 #2: 숙소 커버도 R2 재호스팅(동네딜 시드와 대칭 — 숙소는 그간 커버를
      //   raw 외부 URL 로만 저장해 네이버 핫링크/삭제 시 카드에서 깨졌음). MEDIA_BUCKET 있으면 /api/media,
      //   없으면 null → 원본 폴백(현행과 동일). 커버 1장만(서브리퀘스트 예산 — 갤러리는 cron 이관).
      const coverHosted = imgs[0] ? await rehostImageToR2(extEnv as unknown as { MEDIA_BUCKET?: R2Bucket }, imgs[0], 'demo-stay-seed').catch(() => null) : null
      const img = coverHosted || imgs[0]  // imgs 비면 위에서 continue — picsum 더미 폴백 폐기(2026-08-08)
      const desc = ty.desc  // 접두사 없음 — 지역·유형은 배지와 주소 줄이 이미 말해 준다
      // 객실 2종 — 인원 2~6 자동 분산(인원 필터 검색이 항상 유효하게) + 주중/주말가.
      //   products INSERT 보다 먼저 계산: 대표가(price)=최저 객실 주중가, 오퍼명이 객실명을 참조.
      const mod = ty.mods[n % ty.mods.length]
      const baseWd = 69000 + ((n % 6) * 20000)
      const rooms = [
        { name: `스탠다드 ${ty.label === '글램핑' ? '텐트' : '룸'}`, bg: 2, mg: 2 + ((n % 2) * 2), wd: baseWd, we: Math.round(baseWd * 1.4 / 1000) * 1000 },
        { name: `프리미엄 ${mod}${ty.label === '펜션' ? ' 독채' : ' 스위트'}`, bg: 2, mg: 4 + (n % 3), wd: baseWd + 60000, we: Math.round((baseWd + 60000) * 1.4 / 1000) * 1000 },
      ]
      // 🏷️ v3 (동네딜 규칙 미러): 제목 = 오퍼만, 숙소명 = restaurant_name 전담. 가격 = 최저 객실 주중가.
      const offerName = `평일 1박 숙박권 (${rooms[0].name})`
      const price = rooms[0].wd
      const origPrice = Math.round(price * 1.3 / 1000) * 1000
      const stayPhone = place.phone || null  // 📞 2026-07-21 (대표 "다 넣어줘"): 카카오 실전화 캡처
      let ins
      try {
        ins = await DB.prepare(
          `INSERT INTO products (seller_id, name, description, image_url, price, original_price, category, product_type,
             is_active, restaurant_name, restaurant_address, restaurant_phone, restaurant_lat, restaurant_lng, slug, created_at, updated_at)
           VALUES (NULL, ?, ?, ?, ?, ?, 'stay_voucher', 'featured', 1, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        ).bind(offerName, desc, img, price, origPrice, place.name, place.address || spot.addr, stayPhone, place.lat, place.lng, slug).run()
      } catch {
        // 🛡️ restaurant_lat/lng 컬럼 미존재 환경 폴백 — 좌표 없이 시드(동네딜 시드와 동일 방어).
        ins = await DB.prepare(
          `INSERT INTO products (seller_id, name, description, image_url, price, original_price, category, product_type,
             is_active, restaurant_name, restaurant_address, restaurant_phone, slug, created_at, updated_at)
           VALUES (NULL, ?, ?, ?, ?, ?, 'stay_voucher', 'featured', 1, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        ).bind(offerName, desc, img, price, origPrice, place.name, place.address || spot.addr, stayPhone, slug).run()
      }
      const pid = Number(ins.meta.last_row_id)
      if (!pid) continue
      // 🖼️ 다중 사진(2장+) → products.images(JSON, PRODUCT_DETAIL_FIELDS 기포함 — 상세 갤러리 소비).
      //   컬럼 미존재 환경은 조용히 skip(best-effort).
      if (imgs.length > 1) {
        await DB.prepare(`UPDATE products SET images = ? WHERE id = ?`)
          .bind(JSON.stringify(imgs.slice(0, 5)), pid).run().catch(() => {})
      }
      // 🎭 2026-08-03 (대표 "숙박 데모도 추첨 가능해야지 · 같은 규칙으로"): 추첨 응모 설정.
      //   없으면 배지 렌더 `{fcfs && <FcfsBadge/>}` 가 아무것도 안 그려 소비자 눈엔 진짜 숙박권이 된다.
      await (await import('../../../worker/utils/demo-raffle')).seedDemoRaffle(DB, pid)
      // 카카오 place URL — products 컬럼 아님(예산제) → product_supply_meta 사이드테이블(동네딜 시드와 동일).
      if (place.placeUrl) {
        const { setSupplyMeta } = await import('../../../worker/utils/product-supply-meta')
        await setSupplyMeta(DB, pid, {
          kakao_place_url: place.placeUrl,
          ...(place.categoryName ? { kakao_category: place.categoryName } : {}),
        }).catch(() => {})
      }
      const star = ty.type === 'hotel' || ty.type === 'resort' ? 3 + (n % 3) : null
      await DB.prepare(
        `INSERT INTO product_stay_info (
           product_id, property_type, star_rating, total_rooms, check_in_time, check_out_time,
           address, region_sido, region_sigungu, latitude, longitude,
           amenities, room_amenities, cancellation_policy, description_full,
           min_nights, advance_booking_days)
         VALUES (?, ?, ?, 2, '15:00', '11:00', ?, ?, ?, ?, ?, ?, ?, 'standard', ?, 1, 90)`
      ).bind(
        pid, ty.type, star, place.address || `${spot.addr}`, spot.sido, spot.sigungu, place.lat, place.lng,
        JSON.stringify(STAY_AMENITIES[ty.type] || ['무료 주차', '와이파이', '에어컨']),
        JSON.stringify(['에어컨', '냉장고', 'TV', '무료 세면용품', '헤어드라이어']), desc,
      ).run()
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
          // 🖼️ 객실 사진 — 확보한 실사진을 객실별로 로테이션 분배(스탠다드=1번째부터, 프리미엄=2번째부터).
          JSON.stringify(['에어컨', '냉장고']),
          JSON.stringify(imgs.length ? [imgs[(order - 1) % imgs.length], ...(imgs.length > 2 ? [imgs[(order + 1) % imgs.length]] : [])] : [img]),
        ).run()
      }
      // 🎯 매장특색 리뷰 대상 — 오퍼명이 다양화 패스에서 바뀌므로 숙소명(place.name)으로 grounding.
      seededStays.push({ id: pid, name: place.name, category: 'stay_voucher', storeName: place.name, price })
      created++
    }
    // 🎲 v3.1 오퍼 다양화 (2026-07-20 대표 — "모두 스탠다드 숙박권으로 떠서 어색"): 우리가 생성한
    //   오퍼명 패턴('평일/주말 1박 숙박권…') 행 전체를 id%3 규칙으로 [스탠다드 평일권 / 프리미엄 평일권 /
    //   스탠다드 주말권] 고루 로테이션 + 가격을 해당 객실·요일가로 동기(멱등 수렴 — 목표명과 같으면 skip,
    //   수동 개명 행은 패턴 밖이라 불침범). 신규 생성분도 이 패스가 같은 요청 안에서 다양화.
    let varied = 0
    try {
      const roomSub = (col: string, off: number) =>
        `(SELECT r.${col} FROM product_stay_rooms r WHERE r.product_id = p.id AND r.is_active = 1 ORDER BY r.display_order ASC LIMIT 1 OFFSET ${off})`
      const vRows = await DB.prepare(
        `SELECT p.id, p.name,
                ${roomSub('name', 0)} AS r1_name, ${roomSub('base_price_weekday', 0)} AS r1_wd, ${roomSub('base_price_weekend', 0)} AS r1_we,
                ${roomSub('name', 1)} AS r2_name, ${roomSub('base_price_weekday', 1)} AS r2_wd
         FROM products p
         WHERE p.slug LIKE 'demo-stay-%' AND (p.name LIKE '평일 1박 숙박권%' OR p.name LIKE '주말 1박 숙박권%')`
      ).all<{ id: number; name: string; r1_name: string | null; r1_wd: number | null; r1_we: number | null; r2_name: string | null; r2_wd: number | null }>()
      for (const v of (vRows.results || [])) {
        if (!v.r1_name) continue
        const tmpl = v.id % 3
        const usePremium = tmpl === 1 && !!v.r2_name
        const roomName = usePremium ? String(v.r2_name) : String(v.r1_name)
        const wantName = tmpl === 2 ? `주말 1박 숙박권 (${roomName})` : `평일 1박 숙박권 (${roomName})`
        const wantPrice = Number(tmpl === 2 ? v.r1_we : usePremium ? v.r2_wd : v.r1_wd) || 0
        if (v.name === wantName) continue
        const orig = wantPrice > 0 ? Math.round(wantPrice * 1.3 / 1000) * 1000 : 0
        const r = await DB.prepare(
          `UPDATE products SET name = ?,
             price = CASE WHEN ? > 0 THEN ? ELSE price END,
             original_price = CASE WHEN ? > 0 THEN ? ELSE original_price END,
             updated_at = datetime('now')
           WHERE id = ?`
        ).bind(wantName, wantPrice, wantPrice, orig, orig, v.id).run().catch(() => null)
        if (r && (r.meta.changes || 0) > 0) varied++
      }
    } catch { /* best-effort — 다양화 실패가 시드를 막지 않음 */ }
    // ⭐ 매장특색 리뷰/평점 (2026-07-20 대표 "리뷰/평점도 이용권 수준 퀄리티로") — 동네딜과 **동일**
    //   seedDemoReviews(stay 토픽: 객실/뷰/체크인/조식 풀 + Claude Haiku grounding). 신규 시드분 +
    //   기존 리뷰 없는 데모 숙소까지 함께 채움(리뷰 있으면 seedDemoReviews 가 자체 skip → 멱등).
    //   응답 후 waitUntil(외부 LLM 호출이라 응답 블록 방지). review_count>0 채워 generic cron 무관.
    let reviewed = 0
    try {
      const noRev = await DB.prepare(
        `SELECT p.id, p.name, p.restaurant_name, COALESCE(p.price,0) AS price
           FROM products p
          WHERE p.slug LIKE 'demo-stay-%' AND COALESCE(p.is_active,1) = 1
            AND (p.review_count IS NULL OR p.review_count = 0)
            AND NOT EXISTS (SELECT 1 FROM product_reviews r WHERE r.product_id = p.id)
          LIMIT 60`
      ).all<{ id: number; name: string; restaurant_name: string | null; price: number }>().catch(() => ({ results: [] as { id: number; name: string; restaurant_name: string | null; price: number }[] }))
      const byId = new Map<number, { id: number; name: string; category: string; storeName: string | null; price: number }>()
      for (const s of seededStays) byId.set(s.id, s)
      for (const r of (noRev.results || [])) {
        if (!byId.has(r.id)) byId.set(r.id, { id: r.id, name: r.restaurant_name || r.name, category: 'stay_voucher', storeName: r.restaurant_name, price: r.price })
      }
      const targets = Array.from(byId.values())
      reviewed = targets.length
      if (targets.length > 0) {
        const run = import('../../../worker/utils/demo-review-generator').then((m) => {
          const seenShared = new Set<string>()
          return Promise.all(targets.map((p) => m.seedDemoReviews(c.env as unknown as Parameters<typeof m.seedDemoReviews>[0], p, 6 + Math.floor(Math.random() * 7), seenShared).catch(() => 0)))
        }).catch(() => {})
        if (c.executionCtx?.waitUntil) c.executionCtx.waitUntil(run); else await run
      }
    } catch { /* best-effort — 리뷰 실패가 시드를 막지 않음 */ }
    return c.json({ success: true, data: { created, skipped, realPhotos, skippedNoPhoto, healed, photoHealed, varied, reviewed, requested: count, region: regionQ || null } })
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
