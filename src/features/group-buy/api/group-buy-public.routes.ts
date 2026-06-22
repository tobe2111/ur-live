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
import { requireAuth, getCurrentUser, requireAdmin } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'
import { cacheGet } from '@/worker/utils/cache'
import { safeError } from '@/worker/utils/safe-error'
import { productDetailCols, productDetailColsHealed, withColumnPruning } from '@/shared/db/product-columns'
import { VOUCHER_CATEGORIES } from '@/shared/constants/voucher-categories'
import type { GroupBuyProductRow, VoucherRow } from '@/shared/db/group-buy-types'
import { ensureTables, maxTierDiscount, getMealVoucherCommissionRate, getSellerCommissionRate } from './helpers'
// 🍽️ 2026-06-17 (#5 대표 메뉴): products god-table 증식 차단용 K-V 사이드테이블에서 메뉴 읽기.
import { getSupplyMeta } from '../../../worker/utils/product-supply-meta'

// 🛡️ 2026-05-22 module-scope: gift_catalog JOIN 가능 여부 캐시.
//   null = 미확인, true = 가능, false = table 부재 → fallback 만 사용.
let _giftCatalogJoinable: boolean | null = null

// 🛡️ 2026-05-28: dominant_color 컬럼 존재 여부 캐시 (migration 0282 적용 전 graceful).
//   컬럼 없으면 SELECT 에서 제외 → "no such column" 으로 메인 피드 깨지는 것 방지.
//   schema-repair cron (매일 18 UTC) 또는 수동 repair-schema 후 컬럼 생김.
let _dominantColorCol: boolean | null = null

export function registerPublicEndpoints(router: Hono<{ Bindings: Env }>): void {
  // 🛡️ 2026-06-04 진단 — /group-buy 카드 로딩 느림 ground truth (추측 금지 룰).
  //   feed_cache 존재/신선도 + 라이브 쿼리 실측 시간 + 상품 수 + 엣지캐시 키 반환.
  router.get('/_diag', async (c) => {
    const { DB } = c.env
    const out: Record<string, unknown> = {}
    try {
      const t0 = Date.now()
      await ensureTables(DB)
      out.ensureTables_ms = Date.now() - t0
    } catch (e) { out.ensureTables_err = String((e as Error)?.message || e) }
    // feed_cache 상태
    try {
      const row = await DB.prepare("SELECT row_count, computed_at FROM group_buy_feed_cache WHERE status='active' AND category='all' LIMIT 1").first<{ row_count: number; computed_at: string }>().catch(() => null)
      out.feed_cache = row ? { row_count: row.row_count, computed_at: row.computed_at, age_sec: Math.round((Date.now() - new Date(row.computed_at + 'Z').getTime()) / 1000) } : 'EMPTY (cron 미동작/테이블없음 → 매번 라이브쿼리)'
    } catch (e) { out.feed_cache_err = String((e as Error)?.message || e) }
    // 라이브 피드 쿼리 실측 (status=active, 전체 카테고리)
    try {
      const cats = (VOUCHER_CATEGORIES as readonly string[])
      const ph = cats.map(() => '?').join(',')
      const t1 = Date.now()
      const r = await DB.prepare(`SELECT p.id FROM products p LEFT JOIN sellers s ON p.seller_id=s.id WHERE p.category IN (${ph}) AND p.is_active=1 AND (p.group_buy_status='active' OR 'active'='all') ORDER BY p.created_at DESC LIMIT 50`).bind(...cats).all()
      out.live_query_ms = Date.now() - t1
      out.live_query_rows = (r.results || []).length
    } catch (e) { out.live_query_err = String((e as Error)?.message || e) }
    // 🏭 실제 피드와 동일 필터(category IN VOUCHER_CATEGORIES)로 동네딜 상품의 image_url + 호스트 뽑기.
    try {
      const cats2 = (VOUCHER_CATEGORIES as readonly string[])
      const ph2 = cats2.map(() => '?').join(',')
      const imgs = await DB.prepare(`SELECT id, name, image_url FROM products p WHERE p.category IN (${ph2}) AND p.is_active=1 AND p.group_buy_status='active' ORDER BY p.created_at DESC LIMIT 10`).bind(...cats2).all<{ id: number; name: string; image_url: string | null }>()
      out.product_images = (imgs.results || []).map(p => {
        let host = ''
        try { host = p.image_url ? new URL(p.image_url).host : '(none)' } catch { host = '(invalid)' }
        return { id: p.id, name: p.name, host, image_url: p.image_url }
      })
    } catch (e) { out.product_images_err = String((e as Error)?.message || e) }
    out.note = 'product_images[].host 가 cfImage 프록시 목록에 없으면 원본 풀사이즈 로드(느림). feed_cache EMPTY 면 cron 문제(부차).'
    return c.json({ success: true, diag: out })
  })

  // ── GET /products — 공구 목록 ──
  //   ?status=active|achieved|expired|all  (default: active)
  //   ?category=meal_voucher|beauty_voucher|...|all  (default: all)
  router.get('/products', async (c) => {
    const { DB } = c.env
    // 🛡️ 2026-06-04 (근본 perf): ensureTables 가 cold isolate 에서 ~6s 블록(_diag 측정 5972ms) →
    //   SSR self-fetch(1.5s 제한) 타임아웃 → 동네딜 SSR 미주입 → 카드 콜드 로딩(교환권/쇼핑은 빠른 이유:
    //   /api/products 는 이미 ensureTables 제거). 핫패스에서 비차단(waitUntil)으로 전환 — 테이블/컬럼은
    //   production 에 이미 존재(수개월 운영), 누락분은 쿼리 graceful fallback(_dominantColorCol 등)이 처리.
    try { c.executionCtx?.waitUntil?.(ensureTables(DB).catch(() => {})) } catch { /* no ctx — skip */ }

    // 🛡️ 2026-05-04 (perf): 매 요청 UPDATE 제거 (100-300ms latency 절감).
    //   마감된 공동구매 자동 만료는 scheduled-cleanup cron 에서 처리.

    const status = c.req.query('status') || 'active'
    const categoryParam = c.req.query('category') || 'all'
    const validCategories = VOUCHER_CATEGORIES as readonly string[]
    // 🧭 2026-06-17 [UNLOCK_LOADING] (사용자 요청 — 일반 상품 카테고리): general 은 VOUCHER_CATEGORIES 에
    //   없어 기존엔 항상 voucher 로 폴백 → 클라 필터에서 0개로 사라지는 구조적 빈 카테고리였음.
    //   이제 general 도 명시 지원(해당 카테고리 요청 시에만 — 기본 'all' 피드/캐시키/SSR 는 voucher 그대로 불변).
    const categories = categoryParam === 'all'
      ? validCategories
      : categoryParam === 'general'
        ? ['general']
        : (validCategories.includes(categoryParam) ? [categoryParam] : validCategories)

    // 🏭 2026-06-05 [UNLOCK_LOADING] (사용자 승인 — 동네딜 필터 근본수정): sort + 페이지네이션 서버사이드.
    //   기존: 클라가 항상 ?status=active(파라미터 없음)로 받아 최신 50개만 → 카테고리/정렬/검색을 클라에서
    //   처리 → 활성 공구 50개 초과 시 안 잡힘 + "인기순"이 50개 안에서만 정렬. 이제 서버가 정렬/페이지 적용.
    //   ⚠️ 기본 요청(파라미터 없음)은 키·쿼리·materialized·LIMIT 50 전부 그대로 → SSR 0-RTT/캐시 불변.
    //   필터/정렬/페이지가 붙은 요청만 새 캐시키 + 라이브쿼리(정렬/LIMIT/OFFSET)로 분기.
    const ALLOWED_GB_SORT: Record<string, string> = {
      popular: 'p.group_buy_current DESC, p.created_at DESC',
      newest: 'p.created_at DESC',
      deadline: 'p.group_buy_deadline ASC',
      discount: 'p.discount_rate DESC, p.created_at DESC',
    }
    const sortParam = c.req.query('sort') || ''
    const orderBy = ALLOWED_GB_SORT[sortParam] || 'p.created_at DESC'
    const pageNum = Math.max(1, parseInt(c.req.query('page') || '1', 10))
    const pageLimit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)))
    const offset = (pageNum - 1) * pageLimit
    // 🗺️ 2026-06-18 [UNLOCK_LOADING]: "내 동네 딜" 지역 필터. region = 시군구코드(5자리) 또는 행정동코드(~10자리).
    //   기본 요청(region 없음)은 키/쿼리/materialized 전부 불변 → SSR 0-RTT 보존. region 붙은 요청만 분기.
    const regionRaw = (c.req.query('region') || '').trim()
    const regionParam = /^\d{5,12}$/.test(regionRaw) ? regionRaw : ''
    const hasRegion = !!regionParam
    // hasFilters=false 인 "정확한 기본 요청"만 기존 경로(키/materialized/LIMIT 50). 그 외는 분기.
    const hasFilters = !!ALLOWED_GB_SORT[sortParam] || pageNum > 1 || c.req.query('limit') != null || hasRegion
    const limitClause = hasFilters ? `${pageLimit} OFFSET ${offset}` : '50'
    const cacheKey = hasFilters
      ? `group_buy_products:${status}:${categories.join(',')}:s${sortParam || 'def'}:p${pageNum}:l${pageLimit}:r${regionParam || 'all'}`
      : `group_buy_products:${status}:${categories.join(',')}`

    const results = await cacheGet(
      c.env.SESSION_KV,
      cacheKey,
      async () => {
        // 🛡️ 2026-05-22: KV miss → 1차 fallback: materialized cache table (migration 0277).
        //   group_buy_feed_cache 가 5분마다 cron 으로 갱신됨. D1 SELECT 보다 100-200ms 빠름.
        //   table 미존재 / row 없음 시 graceful → 아래 실시간 쿼리 fallback.
        // 🏭 2026-06-05: materialized 는 status+category 기준(정렬/페이지 무관)이라 기본요청에만 사용.
        if (!hasFilters) try {
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
        // 🗺️ "내 동네 딜" — product_regions INNER JOIN(태깅된 매장만) + 시군구/행정동 코드 prefix 매칭.
        const regionJoin = hasRegion ? 'JOIN product_regions pr ON pr.product_id = p.id' : ''
        const regionWhere = hasRegion ? 'AND pr.region_dong_code LIKE ?' : ''
        const regionBind: string[] = hasRegion ? [`${regionParam}%`] : []
        // 🛡️ 2026-05-22 perf: SELECT p.* (30+ 컬럼, ~10KB) → 카드에서 실제 사용하는
        //   16개 컬럼만 (응답 56% 감소). description/product_detail_images/stock/reserved_stock 등 제외.
        //   결과: 페이로드 ~4-5KB, D1 row scan time 10-15ms ↓.
        let results: unknown[] = []
        // 🛡️ 2026-05-28: dominant_color 는 컬럼 부재 가능 (migration 0282 적용 전) → 조건부 포함.
        //   부재 시 "no such column" 으로 메인 피드 깨지는 것 방지 — 같은 요청 내 1회 재시도 후 제외.
        const isMissingDominant = (e: unknown) => /no such column.*dominant_color|dominant_color/i.test(String((e as { message?: string })?.message ?? e))
        const buildCols = () => `
          p.id, p.name, p.price, p.original_price, p.image_url, p.category,
          p.group_buy_current, p.group_buy_target, p.group_buy_status,
          p.group_buy_deadline AS expires_at, p.group_buy_tiers,
          p.discount_rate, p.sold_count, p.avg_rating, p.deal_only,
          p.brand_name, p.brand_icon_url, p.created_at, p.seller_id,
          p.restaurant_name, p.restaurant_address,
          ${_dominantColorCol === false ? '' : 'p.dominant_color,'}
          s.name AS seller_name, s.profile_image AS seller_avatar
        `
        // 🛡️ 2026-05-22 영구 해결: gift_catalog JOIN 가능 여부 module-scope 기억 →
        //   table 없는 환경에서 매번 try/catch 두 번 query 발생 → 응답 2배 지연 영구 차단.
        const runFeed = async () => {
          if (_giftCatalogJoinable !== false) {
            try {
              const r = await DB.prepare(`
                SELECT ${buildCols()},
                       gc.brand_name AS gc_brand_name,
                       gc.brand_icon_url AS gc_brand_icon_url,
                       gc.goods_type_detail AS gc_goods_type_detail
                FROM products p
                LEFT JOIN sellers s ON p.seller_id = s.id
                ${regionJoin}
                LEFT JOIN gift_catalog gc ON gc.gift_code = p.kt_alpha_gift_code
                WHERE p.category IN (${placeholders}) AND p.is_active = 1
                  AND (p.group_buy_status = ? OR ? = 'all')
                  ${regionWhere}
                ORDER BY ${orderBy}
                LIMIT ${limitClause}
              `).bind(...categories, status, status, ...regionBind).all()
              if (_giftCatalogJoinable === null) _giftCatalogJoinable = true  // 첫 성공 → 다음부터 try 우선
              return r.results ?? []
            } catch (e) {
              if (isMissingDominant(e)) throw e  // 컬럼 부재 → 상위에서 flag off 후 재시도
              _giftCatalogJoinable = false  // table 부재 영구 기억 → 다음부터 fallback 만
            }
          }
          const r = await DB.prepare(`
            SELECT ${buildCols()}
            FROM products p
            LEFT JOIN sellers s ON p.seller_id = s.id
            ${regionJoin}
            WHERE p.category IN (${placeholders}) AND p.is_active = 1
              AND (p.group_buy_status = ? OR ? = 'all')
              ${regionWhere}
            ORDER BY ${orderBy}
            LIMIT ${limitClause}
          `).bind(...categories, status, status, ...regionBind).all()
          return r.results ?? []
        }
        try {
          results = await runFeed()
        } catch (e) {
          if (isMissingDominant(e) && _dominantColorCol !== false) {
            _dominantColorCol = false  // 영구 기억 → 다음 요청부터 제외
            results = await runFeed()   // 같은 요청 재시도 (dominant_color 제외)
          } else {
            throw e
          }
        }
        return results
      },
      // 🛡️ 2026-05-16: TTL 60→300s + SWR 30→120s — 지도 페이지 콜드 hit latency 완화.
      //   상품 목록 변경 빈도 낮음, 60s 보다 5분 stale 허용해도 UX 영향 미미.
      { ttl: 300, staleWhileRevalidate: 120 }
    )

    // 🛡️ 2026-05-24 (loading P0): 브라우저 + Cloudflare edge HTTP cache.
    //   stale-while-revalidate=120s.
    //   효과: 동일 사용자 5분 내 재요청 → 304 / 캐시 적중 → 0 워커 호출 / 0 D1 read.
    //   CF edge 가 다른 사용자 요청에도 캐시 공유 (region 단위) — 전체 latency ↓.
    // 🛡️ 2026-05-27 (loading P1): Cache-Control / CDN-Cache-Control 분리.
    //   - 브라우저 60s: 새 공구 신선도 (이전 300s → 1분으로 단축)
    //   - CF edge 900s: edge hit rate 유지 (D1 worker 비용 ↑ 없음)
    //   publicCache middleware (edge-cache.ts:155-162) 와 동일 패턴.
    c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
    c.header('CDN-Cache-Control', 'public, max-age=900, stale-while-revalidate=120')

    // 🛡️ 2026-05-27 (사용자 보고 — 별점 신규 영구 fix):
    //   공구 list 응답의 review_count=0 상품 → background lazy seed.
    //   /api/products list 와 동일 패턴 (autoSeedFakeReviews 가 idempotent).
    try {
      const seedTargetIds = (results as Array<{ id?: number; review_count?: number }>)
        .filter(p => Number(p?.review_count || 0) === 0)
        .map(p => Number(p?.id))
        .filter(id => Number.isFinite(id) && id > 0)
      if (seedTargetIds.length > 0 && c.executionCtx) {
        c.executionCtx.waitUntil(
          (async () => {
            try {
              const { autoSeedFakeReviews } = await import('../../../worker/utils/auto-seed-fake-reviews')
              await autoSeedFakeReviews(c.env, seedTargetIds, { seedMin: 5, seedMax: 15 })
            } catch (err) {
              if (typeof console !== 'undefined') console.warn('[gb list] lazy seed failed:', String(err))
            }
          })(),
        )
      }
    } catch { /* graceful */ }

    // 🛡️ 2026-05-30: 즉시판매 단일가 모델 (A2) — 카드도 최대 tier 할인 반영한 공구가 전송.
    //   AS-IS: 리스트는 price(기준가) 만 보내 카드가 tier 미반영 → 상세(할인가)와 불일치.
    //   current_price = round(price × (1 - maxTier)) 주입. 카드는 current_price ?? price 사용.
    //   캐시 헤더(Cache-Control/CDN-Cache-Control) 불변 — body enrich 만. design/groupbuy-instant-sale.md
    const mapped = (results as Array<Record<string, unknown>>).map((p) => {
      const md = maxTierDiscount((p.group_buy_tiers as string | null) ?? null)
      if (md <= 0) return p
      const base = Number(p.price) || 0
      return { ...p, current_price: Math.round(base * (1 - md / 100)), current_discount_pct: md }
    })

    return c.json({ success: true, data: mapped })
  })

  // 🛡️ 2026-06-10 (사용자 신고 — 교환권 상세 500 전수 재현): 어드민 전용 단계별 진단.
  //   프로덕션 로그 접근 없이 브라우저 콘솔에서 원인 즉시 식별용. 각 SELECT 의 실제 에러 문자열 반환
  //   (requireAdmin 게이트 — 공개 누출 없음). 원인 확정 후 제거 가능.
  router.get('/products/:id/_diag', requireAdmin(), async (c) => {
    const { DB } = c.env
    const id = Number(c.req.param('id'))
    const out: Record<string, unknown> = { id }
    const tryStep = async (name: string, fn: () => Promise<unknown>) => {
      const t0 = Date.now()
      try { out[name] = { ok: true, ms: Date.now() - t0, value: await fn() } }
      catch (e) { out[name] = { ok: false, ms: Date.now() - t0, error: String((e as Error)?.message || e) } }
    }
    const baseWhere = `WHERE p.id = ?
      AND (
        p.category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
        OR p.deal_only = 1
        OR p.group_buy_status = 'active'
      )`
    await tryStep('q1_full_sns', async () => {
      const r = await DB.prepare(`SELECT p.id, s.sns_tiktok FROM products p LEFT JOIN sellers s ON p.seller_id = s.id ${baseWhere}`).bind(id).first()
      return r ? 'row' : 'null'
    })
    await tryStep('q2_no_tiktok', async () => {
      const r = await DB.prepare(`SELECT p.id, s.sns_youtube, s.sns_facebook FROM products p LEFT JOIN sellers s ON p.seller_id = s.id ${baseWhere}`).bind(id).first()
      return r ? 'row' : 'null'
    })
    await tryStep('q3_minimal', async () => {
      const r = await DB.prepare(`SELECT ${productDetailColsHealed('p')}, s.name as seller_name, s.username as seller_username, s.profile_image as seller_avatar, s.bio as seller_bio, s.sns_instagram as seller_instagram FROM products p LEFT JOIN sellers s ON p.seller_id = s.id ${baseWhere}`).bind(id).first()
      if (!r) return 'null'
      return { keys: Object.keys(r).length, tiers_type: typeof (r as Record<string, unknown>).group_buy_tiers }
    })
    await tryStep('q4_product_only', async () => {
      const r = await DB.prepare('SELECT id, category, deal_only, group_buy_status, seller_id FROM products WHERE id = ?').bind(id).first()
      return r || 'null'
    })
    return c.json({ success: true, diag: out })
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
    // 🛡️ 2026-06-10 [LOADING_ADDITIVE] (사용자 신고 — 특정 상품 상세 500): 핸들러 전체 try/catch.
    //   이 라우트만 무가드(타 라우트는 전부 catch) → 마지막 fallback SELECT 가 던지면 원인 안 보이는 500.
    //   실제 에러를 콘솔(wrangler tail/Logpush)에 남기고 generic 응답 — 캐시/tiers parse 로직 불변.
    try {

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
    // 🛡️ 2026-06-10 자가치유: 명시 목록 중 prod 미존재 컬럼('no such column')을 자동 제외 후 재시도.
    //   스모크가 잡은 잔여 500 의 영구 해결 — 어떤 환경 편차에도 상세가 죽지 않음.
    const product = await withColumnPruning(async (): Promise<(GroupBuyProductRow & SellerDetail) | null> => {
    let prod: (GroupBuyProductRow & SellerDetail) | null = null
    prod = await DB.prepare(`
      SELECT ${productDetailColsHealed('p')}, s.name as seller_name, s.username as seller_username, s.profile_image as seller_avatar,
             s.bio as seller_bio,
             s.sns_instagram as seller_instagram, s.sns_youtube as seller_youtube,
             s.sns_tiktok as seller_tiktok, s.sns_facebook as seller_facebook
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      ${baseWhere}
    `).bind(id).first<GroupBuyProductRow & SellerDetail>().catch(() => null)

    // 🛡️ 신규 컬럼 (sns_tiktok) 누락 환경 fallback — repair-schema 적용 전 즉시 안전.
    if (!prod) {
      prod = await DB.prepare(`
        SELECT ${productDetailColsHealed('p')}, s.name as seller_name, s.username as seller_username, s.profile_image as seller_avatar,
               s.bio as seller_bio,
               s.sns_instagram as seller_instagram, s.sns_youtube as seller_youtube,
               s.sns_facebook as seller_facebook
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        ${baseWhere}
      `).bind(id).first<GroupBuyProductRow & SellerDetail>().catch(() => null)
    }
    if (!prod) {
      // 최후 fallback — SNS 전혀 없이 (sns_youtube/facebook 누락 환경 대응)
      prod = await DB.prepare(`
        SELECT ${productDetailColsHealed('p')}, s.name as seller_name, s.username as seller_username, s.profile_image as seller_avatar,
               s.bio as seller_bio, s.sns_instagram as seller_instagram
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        ${baseWhere}
      `).bind(id).first<GroupBuyProductRow & SellerDetail>()
    }
    return prod
    })

    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

    // 🛡️ 2026-05-30: 즉시판매 단일가 모델 (A2) — 인원 무관 최대 tier 할인을 고정 적용.
    //   AS-IS(calcTierDiscount, 인원 기반 동적 인하 + next_tier 안내) 제거 → 모두 동일 공구가.
    //   상세 unitPrice = price × (1 - current_discount_pct) 는 클라이언트에서 그대로 → 단일가.
    //   design/groupbuy-instant-sale.md
    const fixedDiscountPct = maxTierDiscount(product.group_buy_tiers)

    // 🛡️ 2026-05-27 (loading P1): tiers JSON 을 서버에서 미리 parse — 클라이언트 JSON.parse 제거 + 응답 이스케이프 절감.
    let parsedTiers: Array<{ min: number; discount_pct: number }> | null = null
    try {
      if (product.group_buy_tiers) {
        const arr = JSON.parse(product.group_buy_tiers as unknown as string) as unknown
        if (Array.isArray(arr)) {
          parsedTiers = (arr as Array<{ min: number; discount_pct: number }>).sort((a, b) => a.min - b.min)
        }
      }
    } catch { /* invalid JSON — null */ }

    // 🍽️ 2026-06-17 (#5 대표 메뉴): product_supply_meta 'menu' (JSON 배열) enrich. 없으면 undefined → 상세 섹션 숨김.
    let menu: Array<{ name: string; desc?: string; price?: string; image?: string; hot?: boolean }> | undefined
    try {
      const metaMap = await getSupplyMeta(DB, [Number(id)])
      const raw = metaMap.get(Number(id))?.menu
      if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) menu = arr }
    } catch { /* meta 테이블/데이터 없음 — 메뉴 없음 */ }

    return c.json({
      success: true,
      data: {
        ...product,
        group_buy_tiers: parsedTiers,  // string → array (호환: 클라이언트 useMemo 가 둘 다 handle)
        current_discount_pct: fixedDiscountPct,  // 🛡️ 2026-05-30: 단일가 — 인원 무관 고정
        next_tier: null,                          // 🛡️ 2026-05-30: 동적 인하 제거 (즉시판매)
        next_tier_remaining: null,
        ...(menu ? { menu } : {}),                // 🍽️ #5: 대표 메뉴 (있을 때만)
      },
    })
    } catch (err) {
      console.error('[group-buy-detail] product', id, err)
      return safeError(c, err, '상품 조회 중 오류가 발생했습니다', '[group-buy-detail]')
    }
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
        AND (p.kt_alpha_gift_code IS NULL OR p.kt_alpha_gift_code = '')
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
        WHERE o.user_id = ? AND vo.status IN ('sent', 'processing', 'failed')
        ORDER BY vo.created_at DESC
        LIMIT 100
      `).bind(Number(user.id)).all().catch(() => ({ results: [] as any[] }))
      ktAlphaItems = (ktRes.results || []).map((vo: any) => ({
        source: 'kt_alpha',
        id: `kt-${vo.id}`,
        kt_alpha_voucher_order_id: vo.id,
        code: vo.coupon_code || vo.external_order_id || `KT-${vo.id}`,
        kt_pin: vo.coupon_code || null,  // 🔢 #4: PIN 모드 발급분만 채워짐 → 카드가 바코드 렌더
        user_id: String(user.id),
        product_id: null,
        order_id: vo.order_id,
        // 🔔 2026-06-17: failed 도 노출(유저가 '결제됐는데 안 옴' 인지). card 는 kt_status 로 실패 UI.
        //   failed→'unused'(목록 노출) / sent→'unused' / processing→'processing'(전송중, 그룹서 숨김).
        status: (vo.status === 'sent' || vo.status === 'failed') ? 'unused' : 'processing',
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

  // ── POST /vouchers/:code/self-redeem — 🎟️ 2026-06-20 소비자 셀프 사용처리 (대표 — 카운터 느슨/정산 검문) ──
  //   본인 미사용 공구권을 현장에서 직접 사용. CAS(claim-before-credit) 일회성 — 동시/중복 차단.
  //   라이브 '사용완료' 화면 데이터 반환(매장명·used_at). 60초 내 cancel 가능(아래). 돈 이동 X(에스크로는 Phase 2).
  router.post('/vouchers/:code/self-redeem', requireAuth(), async (c) => {
    const { DB } = c.env
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const code = c.req.param('code')
    if (!code) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    try {
      // 🛡️ 머니룰: claim-before-credit — 미사용+본인 일 때만 원자적 used 선점.
      const res = await DB.prepare(
        "UPDATE vouchers SET status='used', used_at=datetime('now') WHERE code=? AND user_id=? AND status='unused'"
      ).bind(code, user.id).run()
      const claimed = (res.meta?.changes || 0) === 1

      const row = await DB.prepare(`
        SELECT v.id, v.code, v.status, v.used_at, v.product_id, p.name as product_name, p.restaurant_name
        FROM vouchers v JOIN products p ON p.id = v.product_id
        WHERE v.code=? AND v.user_id=?
      `).bind(code, user.id).first<{ id: number; code: string; status: string; used_at: string; product_name?: string; restaurant_name?: string }>().catch(() => null)

      if (!row) return c.json({ success: false, error: '공구권을 찾을 수 없습니다' }, 404)
      if (!claimed && row.status !== 'used') {
        return c.json({ success: false, error: row.status === 'refunded' ? '환불된 공구권입니다' : '이미 처리되었거나 사용할 수 없는 공구권입니다' }, 409)
      }
      // claimed === true (방금 사용) 또는 이미 used(멱등 반환)
      const usedAtMs = row.used_at ? Date.parse(row.used_at.replace(' ', 'T') + 'Z') : Date.now()
      const cancelableUntil = usedAtMs + 60_000
      return c.json({
        success: true,
        data: {
          code: row.code,
          storeName: row.restaurant_name || row.product_name || '매장',
          usedAt: row.used_at,
          justRedeemed: claimed,
          cancelableUntil, // 이 시각(ms) 이전엔 취소 가능
        },
      })
    } catch (err) {
      return safeError(c, err, '사용 처리 중 오류가 발생했습니다', '[self-redeem]')
    }
  })

  // ── POST /vouchers/:code/cancel-redeem — 60초 내 실수 취소 (used → unused) ──
  router.post('/vouchers/:code/cancel-redeem', requireAuth(), async (c) => {
    const { DB } = c.env
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const code = c.req.param('code')
    if (!code) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    try {
      // CAS: 본인 + used + used_at 60초 이내 + 아직 정산 전(settlement_id IS NULL) 일 때만 되돌림.
      //   기존 auto-settlement(used 7일 후 정산)와 정합 — 정산된 건 절대 취소 불가(60초 ≪ 7일이라 안전, 명시 가드).
      const res = await DB.prepare(
        "UPDATE vouchers SET status='unused', used_at=NULL WHERE code=? AND user_id=? AND status='used' AND used_at >= datetime('now','-60 seconds') AND settlement_id IS NULL"
      ).bind(code, user.id).run()
      if ((res.meta?.changes || 0) !== 1) {
        return c.json({ success: false, error: '취소 가능 시간(60초)이 지났습니다' }, 409)
      }
      return c.json({ success: true, data: { code, status: 'unused' } })
    } catch (err) {
      return safeError(c, err, '취소 중 오류가 발생했습니다', '[cancel-redeem]')
    }
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
