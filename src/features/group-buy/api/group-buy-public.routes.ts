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
        const placeholders = categories.map(() => '?').join(',')
        const { results } = await DB.prepare(`
          SELECT p.*, s.name as seller_name, s.profile_image as seller_avatar
          FROM products p
          LEFT JOIN sellers s ON p.seller_id = s.id
          WHERE p.category IN (${placeholders}) AND p.is_active = 1
            AND (p.group_buy_status = ? OR ? = 'all')
          ORDER BY p.created_at DESC
          LIMIT 50
        `).bind(...categories, status, status).all()
        return results ?? []
      },
      // 🛡️ 2026-05-16: TTL 60→300s + SWR 30→120s — 지도 페이지 콜드 hit latency 완화.
      //   상품 목록 변경 빈도 낮음, 60s 보다 5분 stale 허용해도 UX 영향 미미.
      { ttl: 300, staleWhileRevalidate: 120 }
    )

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

    const product = await DB.prepare(`
      SELECT p.*, s.name as seller_name, s.profile_image as seller_avatar,
             s.bio as seller_bio, s.sns_instagram as seller_instagram
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE p.id = ? AND p.category IN ('meal_voucher','beauty_voucher','health_voucher','pet_voucher','stay_voucher','activity_voucher')
    `).bind(id).first<GroupBuyProductRow & { seller_name?: string; seller_avatar?: string; seller_bio?: string; seller_instagram?: string }>()

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
          AND p.category IN ('meal_voucher','beauty_voucher','health_voucher','pet_voucher','stay_voucher','activity_voucher')
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
    await ensureTables(DB)

    // 🛡️ 2026-05-15: lat/lng 추가 — VoucherMap 지도 뷰 용
    const { results } = await DB.prepare(`
      SELECT v.*, p.name as product_name, p.restaurant_name, p.restaurant_address,
             p.restaurant_lat, p.restaurant_lng, p.restaurant_phone,
             p.image_url as product_image
      FROM vouchers v
      LEFT JOIN products p ON v.product_id = p.id
      WHERE v.user_id = ?
      ORDER BY v.created_at DESC
    `).bind(String(user.id)).all()

    return c.json({ success: true, data: results ?? [] })
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
      },
    })
  })
}
