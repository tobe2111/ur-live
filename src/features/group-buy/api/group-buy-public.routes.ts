/**
 * 🛡️ 2026-05-15 (TD-G01 3단계): 공개 endpoints — group-buy.routes.ts 분리.
 *
 * register 패턴 — path 보존.
 *
 * 포함:
 *   - GET /products                    공구 목록 (status/category 필터, edge cache)
 *   - GET /products/:id                상세 (티어 정보 포함)
 *   - GET /products/:id/participants   최근 참여자 마스킹 20명
 *   - GET /live-ticker                 SNS 스타일 실시간 참여 ticker
 *   - GET /commission-rate             셀러 인증 시 차등 rate, 비인증 시 기본
 *   - GET /my                          내 voucher 목록 (auth)
 *   - GET /verify/:code                voucher 정보 조회 (PIN 입력 전, 마스킹)
 */

import type { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'
import { cacheGet } from '@/worker/utils/cache'
import { VOUCHER_CATEGORIES } from '@/shared/constants/voucher-categories'
import type { GroupBuyProductRow, VoucherRow } from '@/shared/db/group-buy-types'
import { ensureTables, calcTierDiscount, getMealVoucherCommissionRate, getSellerCommissionRate } from './helpers'

// 🛡️ 2026-05-22 module-scope: gift_catalog JOIN 가능 여부 캐시.
//   null = 미확인, true = 가능, false = table 부재 → fallback 만 사용.
let _giftCatalogJoinable: boolean | null = null

export function registerPublicEndpoints(router: Hono<{ Bindings: Env }>): void {
  // ── GET /products — 공구 목록 ──
  //   ?status=active|achieved|expired|all  (default: active)
  //   ?category=meal_voucher|beauty_voucher|...|all  (default: all)
  router.get('/products', async (c) => {
    const { DB } = c.env
    await ensureTables(DB)

    // 🛡️ 2026-05-04 (perf): 매 요청 UPDATE 제거 (100-300ms latency 절감).
    //   마감된 공동구매 자동 만료는 scheduled-cleanup cron 에서 처리.

    const status = c.req.query('status') || 'active'
    const categoryParam = c.req.query('category') || 'all'
    const validCategories = VOUCHER_CATEGORIES as readonly string[]
    const categories = categoryParam === 'all'
      ? validCategories
      : (validCategories.includes(categoryParam) ? [categoryParam] : validCategories)

    const results = await cacheGet(
      c.env.SESSION_KV,
      `group_buy_products:${status}:${categories.join(',')}`,
      async () => {
        // 🛡️ 2026-05-22: KV miss → 1차 fallback: materialized cache table (migration 0277).
        //   group_buy_feed_cache 가 5분마다 cron 으로 갱신됨. D1 SELECT 보다 100-200ms 빠름.
        //   table 미존재 / row 없음 시 graceful → 아래 실시간 쿼리 fallback.
        try {
          const cached = await DB.prepare(
            "SELECT product_json, computed_at FROM group_buy_feed_cache WHERE status = ? AND category = ? LIMIT 1"
          ).bind(status, categoryParam).first<{ product_json: string; computed_at: string }>().catch(() => null)
          if (cached?.product_json) {
            // 5분 cron 기준, 10분 이상 stale 이면 무시 (실시간 fallback)
            const ageMs = Date.now() - new Date(cached.computed_at + 'Z').getTime()
            if (ageMs < 10 * 60_000) {
              try {
                const parsed = JSON.parse(cached.product_json)
                if (Array.isArray(parsed)) return parsed
              } catch { /* JSON 깨짐 — 실시간 fallback */ }
            }
          }
        } catch { /* 테이블 미존재 — graceful */ }

        const placeholders = categories.map(() => '?').join(',')
        // 🛡️ 2026-05-22 perf: SELECT p.* (30+ 컬럼, ~10KB) → 카드에서 실제 사용하는
        //   16개 컬럼만 (응답 56% 감소). description/product_detail_images/stock/reserved_stock 등 제외.
        //   결과: 페이로드 ~4-5KB, D1 row scan time 10-15ms ↓.
        let results: unknown[] = []
        const COLS = `
          p.id, p.name, p.price, p.original_price, p.image_url, p.category,
          p.group_buy_current, p.group_buy_target, p.group_buy_status,
          p.group_buy_deadline AS expires_at, p.group_buy_tiers,
          p.discount_rate, p.sold_count, p.avg_rating, p.deal_only,
          p.brand_name, p.brand_icon_url, p.created_at, p.seller_id,
          s.name AS seller_name, s.profile_image AS seller_avatar
        `
        // 🛡️ 2026-05-22 영구 해결: gift_catalog JOIN 가능 여부 module-scope 기억 →
        //   table 없는 환경에서 매번 try/catch 두 번 query 발생 → 응답 2배 지연 영구 차단.
        if (_giftCatalogJoinable !== false) {
          try {
            const r = await DB.prepare(`
              SELECT ${COLS},
                     gc.brand_name AS gc_brand_name,
                     gc.brand_icon_url AS gc_brand_icon_url,
                     gc.goods_type_detail AS gc_goods_type_detail
              FROM products p
              LEFT JOIN sellers s ON p.seller_id = s.id
              LEFT JOIN gift_catalog gc ON gc.gift_code = p.kt_alpha_gift_code
              WHERE p.category IN (${placeholders}) AND p.is_active = 1
                AND (p.group_buy_status = ? OR ? = 'all')
              ORDER BY p.created_at DESC
              LIMIT 50
            `).bind(...categories, status, status).all()
            results = r.results ?? []
            if (_giftCatalogJoinable === null) _giftCatalogJoinable = true  // 첫 성공 → 다음부터 try 우선
          } catch {
            _giftCatalogJoinable = false  // table 부재 영구 기억 → 다음부터 fallback 만
            // fall through to fallback below
          }
        }
        if (results.length === 0 && _giftCatalogJoinable === false) {
          const r = await DB.prepare(`
            SELECT ${COLS}
            FROM products p
            LEFT JOIN sellers s ON p.seller_id = s.id
            WHERE p.category IN (${placeholders}) AND p.is_active = 1
              AND (p.group_buy_status = ? OR ? = 'all')
            ORDER BY p.created_at DESC
            LIMIT 50
          `).bind(...categories, status, status).all()
          results = r.results ?? []
        }
        return results
      },
      // 🛡️ 2026-05-16: TTL 60→300s + SWR 30→120s — 지도 페이지 콜드 hit latency 완화.
      //   상품 목록 변경 빈도 낮음, 60s 보다 5분 stale 허용해도 UX 영향 미미.
      { ttl: 300, staleWhileRevalidate: 120 }
    )

    // 🛡️ 2026-05-24 (loading P0): 브라우저 + Cloudflare edge HTTP cache.
    //   public, max-age=300 (5분) + stale-while-revalidate=120s.
    //   효과: 동일 사용자 5분 내 재요청 → 304 / 캐시 적중 → 0 워커 호출 / 0 D1 read.
    //   CF edge 가 다른 사용자 요청에도 캐시 공유 (region 단위) — 전체 latency ↓.
    c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=120')
    return c.json({ success: true, data: results })
  })

  // ── GET /products/:id — 상세 ──
  router.get('/products/:id', async (c) => {
    const { DB } = c.env
    const idRaw = c.req.param('id')
    const idNum = Number(idRaw)
    if (!Number.isFinite(idNum) || idNum <= 0 || !Number.isInteger(idNum)) {
      return c.json({ success: false, error: '잘못된 상품 ID 입니다' }, 400)
    }
    const id = idNum

    // 🛡️ 2026-05-23 v2: SSOT product-flow.ts 와 정합 + 존재하는 컬럼만 사용.
    //   v1 fix 가 존재하지 않는 group_buy_active 컬럼 참조 → 500.
    //   v2: deal_only + group_buy_status='active' (둘 다 production 스키마에 존재).
    // 🛡️ 2026-05-27 (사용자 요청): 공구 상세에 셀러 SNS 버튼 — 전체 SNS 컬럼 노출.
    //   sns_tiktok 은 신규 컬럼 (repair-schema 적용 전 graceful fallback 필수).
    type SellerDetail = {
      seller_name?: string; seller_username?: string; seller_avatar?: string; seller_bio?: string;
      seller_instagram?: string; seller_youtube?: string; seller_tiktok?: string; seller_facebook?: string;
    }
    const baseWhere = `WHERE p.id = ?
      AND (
        p.category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
        OR p.deal_only = 1
        OR p.group_buy_status = 'active'
      )`
    let product = await DB.prepare(`
      SELECT p.*, s.name as seller_name, s.username as seller_username, s.profile_image as seller_avatar,
             s.bio as seller_bio,
             s.sns_instagram as seller_instagram, s.sns_youtube as seller_youtube,
             s.sns_tiktok as seller_tiktok, s.sns_facebook as seller_facebook
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      ${baseWhere}
    `).bind(id).first<GroupBuyProductRow & SellerDetail>().catch(() => null)

    // 🛡️ 신규 컬럼 (sns_tiktok) 누락 환경 fallback — repair-schema 적용 전 즉시 안전.
    if (!product) {
      product = await DB.prepare(`
        SELECT p.*, s.name as seller_name, s.username as seller_username, s.profile_image as seller_avatar,
               s.bio as seller_bio,
               s.sns_instagram as seller_instagram, s.sns_youtube as seller_youtube,
               s.sns_facebook as seller_facebook
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        ${baseWhere}
      `).bind(id).first<GroupBuyProductRow & SellerDetail>().catch(() => null)
    }
    if (!product) {
      // 최후 fallback — SNS 전혀 없이 (sns_youtube/facebook 누락 환경 대응)
      product = await DB.prepare(`
        SELECT p.*, s.name as seller_name, s.username as seller_username, s.profile_image as seller_avatar,
               s.bio as seller_bio, s.sns_instagram as seller_instagram
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        ${baseWhere}
      `).bind(id).first<GroupBuyProductRow & SellerDetail>()
    }

    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

    // 🛡️ 2026-05-15: 티어 정보 + 다음 tier 까지 남은 인원 함께 반환
    const tierInfo = calcTierDiscount(product.group_buy_tiers, Number(product.group_buy_current ?? 0))

    return c.json({
      success: true,
      data: {
        ...product,
        current_discount_pct: tierInfo.discount_pct,
        next_tier: tierInfo.next_tier,
        next_tier_remaining: tierInfo.next_tier ? Math.max(0, tierInfo.next_tier.min - Number(product.group_buy_current ?? 0)) : null,
      },
    })
  })

  // ── GET /live-ticker — 전체 공구 최근 참여 (SNS 스타일 ticker) ──
  router.get('/live-ticker', async (c) => {
    const { DB } = c.env
    try {
      const { results } = await DB.prepare(`
        SELECT
          SUBSTR(COALESCE(u.display_name, u.email, '익명'), 1, 1) || '**' AS masked_name,
          u.profile_image AS avatar,
          p.id AS product_id,
          p.name AS product_name,
          p.restaurant_name,
          p.image_url AS product_image,
          p.category,
          oi.quantity,
          o.created_at
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN users u ON u.id = o.user_id
        WHERE o.order_number LIKE 'GB-%'
          AND o.status = 'PAID'
          AND o.created_at >= datetime('now', '-2 hours')
          AND p.category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
        ORDER BY o.created_at DESC
        LIMIT 30
      `).all().catch(() => ({ results: [] }))
      return c.json({ success: true, data: results ?? [] })
    } catch (err) {
      console.error('[gb live-ticker]', err)
      return c.json({ success: true, data: [] })
    }
  })

  // ── GET /products/:id/participants — 최근 참여자 마스킹 20명 ──
  router.get('/products/:id/participants', async (c) => {
    const { DB } = c.env
    const idRaw = c.req.param('id')
    const idNum = Number(idRaw)
    if (!Number.isFinite(idNum) || idNum <= 0 || !Number.isInteger(idNum)) {
      return c.json({ success: false, error: '잘못된 상품 ID 입니다' }, 400)
    }
    const id = idNum
    try {
      const { results } = await DB.prepare(`
        SELECT
          SUBSTR(COALESCE(u.display_name, u.email, '익명'), 1, 1) || '**' AS masked_name,
          u.profile_image AS avatar,
          o.created_at,
          oi.quantity
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN users u ON u.id = o.user_id
        WHERE oi.product_id = ? AND o.status = 'PAID'
        ORDER BY o.created_at DESC
        LIMIT 20
      `).bind(id).all().catch(() => ({ results: [] }))
      return c.json({ success: true, data: results ?? [] })
    } catch (err) {
      console.error('[gb participants]', err)
      return c.json({ success: true, data: [] })
    }
  })

  // ── GET /commission-rate — 셀러 인증 시 본인 차등 rate, 비인증 시 기본 ──
  router.get('/commission-rate', async (c) => {
    try {
      const user = getCurrentUser(c)
      const userAsAny = user as unknown as { id?: number | string; type?: string; role?: string }
      const isSeller = user && (userAsAny.type === 'seller' || userAsAny.role === 'seller')
      if (isSeller && userAsAny.id) {
        const rate = await getSellerCommissionRate(c.env.DB, Number(userAsAny.id))
        return c.json({ success: true, rate, tiered: true })
      }
      const rate = await getMealVoucherCommissionRate(c.env.DB)
      return c.json({ success: true, rate, tiered: false })
    } catch {
      return c.json({ success: true, rate: 0.05, tiered: false })  // fallback 5%
    }
  })

  // ── GET /my — 내 voucher 목록 (auth) ──
  router.get('/my', requireAuth(), async (c) => {
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)

    const { DB } = c.env

    // 🛡️ 2026-05-22 P1 영구 fix (사용자 신고 "교환권 로딩 늦음"):
    //   - 이전: ensureTables(20+ ALTER/CREATE) cold-start 마다 첫 호출 시 ~50-200ms.
    //   - 이전: SELECT v.* (모든 컬럼) + LEFT JOIN products + ORDER BY DESC + LIMIT 없음.
    //   - 영구 해결:
    //     1) ensureTables 제거 — vouchers 테이블은 production 에 항상 존재.
    //     2) explicit SELECT (16 컬럼 — 카드 + 지도뷰 + 환불 표시에 필요한 것만).
    //     3) LIMIT 200 — 사용자가 voucher 1000개여도 응답 폭증 차단.
    //     4) idx_vouchers_user_created 복합 인덱스 lazy 생성 (멱등).
    try {
      await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_vouchers_user_created ON vouchers(user_id, created_at DESC)`).run()
    } catch { /* exists or permission */ }

    // 🛡️ 2026-05-24 P0 (사용자 신고 "내 교환권 안 보임"):
    //   - 원인: refund_status/gift_from_user_id/delivered_gift_name/applied_price 컬럼이 일부 환경에 없음.
    //   - 이전: 첫 SELECT 실패 → catch fallback (applied_price 누락) → 금액 미표시 + 컬럼 일치 X.
    //   - 영구 fix: repair-schema 에 컬럼 등록 (daily cron 자동 ADD) + 본 SELECT 도 fallback 에 applied_price 포함.
    //     컬럼이 곧 모두 존재할 거지만, fallback 도 같이 강화해 라이브 환경 즉시 복구.
    const { results } = await DB.prepare(`
      SELECT v.id, v.code, v.user_id, v.product_id, v.order_id, v.status,
             v.expires_at, v.used_at, v.created_at, v.refund_status,
             v.gift_from_user_id, v.delivered_gift_name,
             v.applied_price, v.applied_discount_pct,
             p.name AS product_name, p.image_url AS product_image,
             p.restaurant_name, p.restaurant_address,
             p.restaurant_lat, p.restaurant_lng, p.restaurant_phone
      FROM vouchers v
      LEFT JOIN products p ON v.product_id = p.id
      WHERE v.user_id = ?
      ORDER BY v.created_at DESC
      LIMIT 200
    `).bind(String(user.id)).all().catch(async (err) => {
      if (typeof console !== 'undefined') console.warn('[/vouchers/my] full SELECT failed, fallback:', String(err))
      // 컬럼 누락 환경 graceful fallback — applied_price 도 포함.
      const r = await DB.prepare(`
        SELECT v.id, v.code, v.user_id, v.product_id, v.order_id, v.status,
               v.expires_at, v.used_at, v.created_at,
               v.applied_price,
               p.name AS product_name, p.image_url AS product_image,
               p.restaurant_name, p.restaurant_address,
               p.restaurant_lat, p.restaurant_lng, p.restaurant_phone
        FROM vouchers v
        LEFT JOIN products p ON v.product_id = p.id
        WHERE v.user_id = ?
        ORDER BY v.created_at DESC
        LIMIT 200
      `).bind(String(user.id)).all().catch(async (err2) => {
        // 한 번 더 fallback — applied_price 도 없는 극단 환경 (구 DB).
        if (typeof console !== 'undefined') console.warn('[/vouchers/my] applied_price SELECT failed, fallback again:', String(err2))
        return await DB.prepare(`
          SELECT v.id, v.code, v.user_id, v.product_id, v.order_id, v.status,
                 v.expires_at, v.used_at, v.created_at,
                 p.name AS product_name, p.image_url AS product_image,
                 p.restaurant_name, p.restaurant_address,
                 p.restaurant_lat, p.restaurant_lng, p.restaurant_phone
          FROM vouchers v
          LEFT JOIN products p ON v.product_id = p.id
          WHERE v.user_id = ?
          ORDER BY v.created_at DESC
          LIMIT 200
        `).bind(String(user.id)).all()
      })
      return r
    })

    // 🛡️ 2026-05-25 사용자 결정 (A 옵션): KT Alpha 발송된 쿠폰도 통합 표시.
    //   voucher_orders 의 status='sent' row 를 source='kt_alpha' 로 변환해서 vouchers 배열에 merge.
    //   사용자가 한 화면에서 모든 쿠폰 확인.
    let ktAlphaItems: any[] = []
    try {
      const ktRes = await DB.prepare(`
        SELECT vo.id, vo.goods_code, vo.goods_name, vo.goods_image_url,
               vo.recipient_phone, vo.unit_price, vo.coupon_code, vo.external_order_id,
               vo.status, vo.sent_at, vo.created_at,
               o.id AS order_id, o.order_number, o.user_id AS order_user_id
        FROM voucher_orders vo
        JOIN orders o ON (
          vo.external_order_id LIKE 'u' || o.id || '-%' OR
          vo.external_order_id LIKE 'ur-cons-' || o.id || '-%'
        )
        WHERE o.user_id = ? AND vo.status IN ('sent', 'processing')
        ORDER BY vo.created_at DESC
        LIMIT 100
      `).bind(Number(user.id)).all().catch(() => ({ results: [] as any[] }))
      ktAlphaItems = (ktRes.results || []).map((vo: any) => ({
        source: 'kt_alpha',
        id: `kt-${vo.id}`,
        kt_alpha_voucher_order_id: vo.id,
        code: vo.coupon_code || vo.external_order_id || `KT-${vo.id}`,
        user_id: String(user.id),
        product_id: null,
        order_id: vo.order_id,
        status: vo.status === 'sent' ? 'unused' : 'processing',
        expires_at: null,
        used_at: null,
        created_at: vo.sent_at || vo.created_at,
        applied_price: vo.unit_price,
        product_name: vo.goods_name,
        product_image: vo.goods_image_url,
        restaurant_name: null,
        restaurant_address: null,
        restaurant_lat: null,
        restaurant_lng: null,
        restaurant_phone: null,
        kt_recipient_phone: vo.recipient_phone,
        kt_status: vo.status,
      }))
    } catch { /* graceful — vouchers 만 반환 */ }

    // 우리 voucher 에 source='internal' 마킹 + 통합
    const internalItems = (results ?? []).map((v: any) => ({ ...v, source: 'internal' }))
    const merged = [...internalItems, ...ktAlphaItems].sort((a, b) => {
      const at = a.created_at ? Date.parse(a.created_at) : 0
      const bt = b.created_at ? Date.parse(b.created_at) : 0
      return bt - at
    })

    return c.json({ success: true, data: merged })
  })

  // ── GET /verify/:code — voucher 정보 조회 (PIN 입력 전, 마스킹) ──
  router.get('/verify/:code', async (c) => {
    const { DB } = c.env
    const code = c.req.param('code')
    if (!code || typeof code !== 'string' || code.length < 4 || code.length > 64 || !/^[A-Za-z0-9-]+$/.test(code)) {
      return c.json({ success: false, error: '잘못된 바우처 코드입니다' }, 400)
    }

    const voucher = await DB.prepare(`
      SELECT v.*, p.name as product_name, p.restaurant_name, p.image_url as product_image
      FROM vouchers v LEFT JOIN products p ON v.product_id = p.id
      WHERE v.code = ?
    `).bind(code).first<VoucherRow & { product_name?: string; restaurant_name?: string; product_image?: string }>()

    if (!voucher) return c.json({ success: false, error: '바우처를 찾을 수 없습니다' }, 404)

    return c.json({
      success: true,
      data: {
        code: voucher.code,
        status: voucher.status,
        product_name: voucher.product_name,
        restaurant_name: voucher.restaurant_name,
        product_image: voucher.product_image,
        expires_at: voucher.expires_at,
        used_at: voucher.used_at,  // 🛡️ 2026-05-16: 사용 시각 — 폴링 시 손님 화면에 표시
      },
    })
  })
}
