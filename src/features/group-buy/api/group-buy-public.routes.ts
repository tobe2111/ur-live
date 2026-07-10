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
import { normalizeKakaoPlaceUrl } from '@/shared/kakao-place-url'
import { safeError } from '@/worker/utils/safe-error'
import { productDetailCols, productDetailColsHealed, withColumnPruning } from '@/shared/db/product-columns'
import { VOUCHER_CATEGORIES } from '@/shared/constants/voucher-categories'
import type { GroupBuyProductRow, VoucherRow } from '@/shared/db/group-buy-types'
import { ensureTables, maxTierDiscount, getMealVoucherCommissionRate, getSellerCommissionRate } from './helpers'
// 🍽️ 2026-06-17 (#5 대표 메뉴): products god-table 증식 차단용 K-V 사이드테이블에서 메뉴 읽기.
import { getSupplyMeta } from '../../../worker/utils/product-supply-meta'
import { intParam } from '@/shared/pagination'

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
    // ❌ 2026-07-02 [UNLOCK_LOADING] (대표 확정 "동네딜에는 안 섞는다 — 완전 분리 유지"): 06-17 에
    //   추가됐던 general(배송형) 명시 지원 제거 — 어떤 소비자 UI 도 안 쓰던 휴면 분기였고, 동네딜=로컬
    //   이용권 전용. 배송형은 쇼핑(/browse) 전용. 가드: scripts/check-dongnedeal-separation.mjs
    const categories = categoryParam === 'all'
      ? validCategories
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
    // 🎯 2026-07-04 [UNLOCK_LOADING] (대표 "데모 이용권 노출은 항상 후순위"): 어떤 정렬이든 1차 키 =
    //   데모-후순위(slug demo-deal-*). 실 사업자/플랫폼 상품이 항상 먼저, 데모는 뒤 채움용.
    //   캐시키/헤더/필드 전부 불변 — 응답 내 행 순서만. materialized cron 도 동일 정렬(짝 수정).
    const DEMO_LAST = "(CASE WHEN COALESCE(p.slug,'') LIKE 'demo-deal-%' THEN 1 ELSE 0 END)"
    // 🌍 2026-07-08 (대표 "수천개 늘 때 미리 — 업체들 근본 방식"): 지오 스케일 파라미터(additive, 검증 float 인라인).
    //   near=lat,lng → 거리순 랭킹. bbox=swLat,swLng,neLat,neLng → 보이는 지도영역만 반환(스케일 핵심 — 전국
    //   전체 대신 뷰포트만 로드). 검증된 숫자만 SQL 에 들어가므로 인젝션 불가. 기본 요청(파라미터 없음)엔 미영향
    //   → 키/materialized/SSR 0-RTT 불변. (공간 인덱스 idx_products_geo 로 스케일 시 빠른 조회.)
    const fnum = (v: string, lo: number, hi: number): number | null => { const n = parseFloat(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null }
    const np = (c.req.query('near') || '').split(',')
    const nearLat = np.length === 2 ? fnum(np[0], -90, 90) : null
    const nearLng = np.length === 2 ? fnum(np[1], -180, 180) : null
    const hasNear = nearLat != null && nearLng != null
    const bp = (c.req.query('bbox') || '').split(',')
    let bbox: { swLat: number; swLng: number; neLat: number; neLng: number } | null = null
    if (bp.length === 4) {
      const a = fnum(bp[0], -90, 90), b = fnum(bp[1], -180, 180), cc = fnum(bp[2], -90, 90), d = fnum(bp[3], -180, 180)
      if (a != null && b != null && cc != null && d != null && a <= cc && b <= d) bbox = { swLat: a, swLng: b, neLat: cc, neLng: d }
    }
    const hasBbox = !!bbox
    // near 있으면 거리 오름차순(제곱거리 — sqrt 불필요, 정렬만), 없으면 기존 정렬.
    const baseOrder = hasNear
      ? `((p.restaurant_lat-(${nearLat}))*(p.restaurant_lat-(${nearLat})) + (p.restaurant_lng-(${nearLng}))*(p.restaurant_lng-(${nearLng}))) ASC`
      : (ALLOWED_GB_SORT[sortParam] || 'p.created_at DESC')
    const orderBy = `${DEMO_LAST}, ${baseOrder}`
    const bboxWhere = hasBbox
      ? `AND p.restaurant_lat BETWEEN ${bbox!.swLat} AND ${bbox!.neLat} AND p.restaurant_lng BETWEEN ${bbox!.swLng} AND ${bbox!.neLng}`
      : ''
    const pageNum = Math.max(1, intParam(c.req.query('page'), 1))
    const pageLimit = Math.min(hasBbox ? 500 : 100, Math.max(1, intParam(c.req.query('limit'), 50)))  // bbox 는 뷰포트 전체 → 상한 ↑
    const offset = (pageNum - 1) * pageLimit
    // 🗺️ 2026-06-18 [UNLOCK_LOADING]: "내 동네 딜" 지역 필터. region = 시군구코드(5자리) 또는 행정동코드(~10자리).
    //   기본 요청(region 없음)은 키/쿼리/materialized 전부 불변 → SSR 0-RTT 보존. region 붙은 요청만 분기.
    const regionRaw = (c.req.query('region') || '').trim()
    const regionParam = /^\d{5,12}$/.test(regionRaw) ? regionRaw : ''
    const hasRegion = !!regionParam
    // hasFilters=false 인 "정확한 기본 요청"만 기존 경로(키/materialized/LIMIT 50). 그 외는 분기.
    const hasFilters = !!ALLOWED_GB_SORT[sortParam] || pageNum > 1 || c.req.query('limit') != null || hasRegion || hasNear || hasBbox
    const limitClause = hasFilters ? `${pageLimit} OFFSET ${offset}` : '50'
    // near/bbox 는 좌표를 ~0.02°(≈2km)로 라운딩해 캐시키 카디널리티 억제(에지 캐시 적중률 유지).
    const rnd = (n: number) => (Math.round(n / 0.02) * 0.02).toFixed(2)
    const geoKey = hasBbox
      ? `b${[bbox!.swLat, bbox!.swLng, bbox!.neLat, bbox!.neLng].map(rnd).join('_')}`
      : hasNear ? `n${rnd(nearLat!)}_${rnd(nearLng!)}` : 'geoall'
    const cacheKey = hasFilters
      ? `group_buy_products:${status}:${categories.join(',')}:s${sortParam || 'def'}:p${pageNum}:l${pageLimit}:r${regionParam || 'all'}:${geoKey}`
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
          p.restaurant_name, p.restaurant_address, p.slug,
          p.restaurant_lat, p.restaurant_lng,
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
                  AND NOT (COALESCE(p.is_supply_product,0) = 1 AND COALESCE(p.supply_source_id,0) = 0)
                  ${regionWhere}
                  ${bboxWhere}
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
              AND NOT (COALESCE(p.is_supply_product,0) = 1 AND COALESCE(p.supply_source_id,0) = 0)
              ${regionWhere}
              ${bboxWhere}
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

    // 🎯 2026-07-02 [UNLOCK_LOADING] (대표 신고 "홈이 미완성으로 먼저 뜨고 응모 버튼이 나중에 등장"):
    //   추첨(fcfs) 정보 body enrich — 기존엔 카드가 별도 /api/fcfs/active 클라 fetch 를 기다려
    //   [배지·응모 버튼 없음 → 등장] 2단 페인트였음. 피드 응답에 서버에서 합쳐 SSR/엣지캐시 첫
    //   페인트부터 완성형(카운트 실시간 보정은 클라 훅이 후속). 2026-05-30 current_price enrich 와
    //   동일 additive 패턴 — 캐시키/캐시 헤더/tiers parse/기존 필드 전부 불변, fail-soft(실패 시 기존 응답).
    let withFcfs = mapped
    try {
      const ids = mapped.map((p) => Number(p.id)).filter((n) => Number.isFinite(n) && n > 0)
      if (ids.length > 0) {
        const ph2 = ids.map(() => '?').join(',')
        const { results: fcfsMeta } = await DB.prepare(
          `SELECT product_id, key, value FROM product_supply_meta WHERE (key LIKE 'fcfs_%' OR key = 'prelaunch') AND product_id IN (${ph2})`,
        ).bind(...ids).all<{ product_id: number; key: string; value: string | null }>()
        const cfgById = new Map<number, Record<string, string>>()
        for (const m of fcfsMeta || []) {
          const rec = cfgById.get(m.product_id) || {}
          rec[m.key] = m.value ?? ''
          cfgById.set(m.product_id, rec)
        }
        const enabledIds = [...cfgById.entries()].filter(([, r]) => r.fcfs_enabled === '1').map(([id]) => id)
        if (enabledIds.length > 0) {
          const ph3 = enabledIds.map(() => '?').join(',')
          const { results: cnts } = await DB.prepare(
            `SELECT product_id, COUNT(*) as n FROM fcfs_applications
              WHERE product_id IN (${ph3}) AND status IN ('applied','selected') GROUP BY product_id`,
          ).bind(...enabledIds).all<{ product_id: number; n: number }>().catch(() => ({ results: [] as { product_id: number; n: number }[] }))
          const cntById = new Map((cnts || []).map((r) => [r.product_id, r.n]))
          const enabledSet = new Set(enabledIds)
          withFcfs = mapped.map((p) => {
            const pid = Number(p.id)
            if (!enabledSet.has(pid)) return p
            const rec = cfgById.get(pid) || {}
            const seed = Math.max(0, parseInt(rec.fcfs_applied_seed || '0', 10) || 0)
            return {
              ...p,
              // 🏷️ 2026-07-05 (대표 "옵션으로 선택") — 오픈 예정형 데모: 카드 '오픈 예정' 배지 + 상세 CTA 분기.
              ...(rec.prelaunch === '1' ? { prelaunch: true } : {}),
              fcfs: {
                enabled: true,
                prelaunch: rec.prelaunch === '1',
                spots: Math.max(0, parseInt(rec.fcfs_spots || '0', 10) || 0),
                appliedDisplay: seed + (cntById.get(pid) || 0),
                deadline: rec.fcfs_deadline || null,
                // 🎯 2026-07-04 (대표 "데모 항상 후순위"): 클라 '선착순 상위노출' boost 가 데모를
                //   끌어올리지 않게 demo 플래그 — RestaurantMapPage displayList 가 non-demo 만 boost.
                demo: String((p as { slug?: string }).slug || '').startsWith('demo-deal-'),
              },
            }
          })
        }
      }
    } catch { /* fail-soft — 클라 useFcfs 훅이 폴백 */ }

    // 🏪 2026-07-05 온누리 가맹 뱃지 (B2G — "온누리 사용 가능 표시" 약속): seller_meta.onnuri_merchant='1'
    //   인 매장 상품에 onnuri_merchant: true 를 additive enrich — fcfs/current_price enrich 와 동일 패턴
    //   (캐시키/헤더/기존 필드 불변, fail-soft).
    let withOnnuri = withFcfs
    try {
      const sellerIds = [...new Set(withFcfs.map((p) => Number((p as { seller_id?: number }).seller_id)).filter((n) => Number.isFinite(n) && n > 0))]
      if (sellerIds.length > 0) {
        const { getSellerMeta } = await import('../../../worker/utils/seller-meta')
        const metaMap = await getSellerMeta(DB, sellerIds)
        const onnuriSet = new Set([...metaMap.entries()].filter(([, r]) => r.onnuri_merchant === '1').map(([sid]) => sid))
        if (onnuriSet.size > 0) {
          withOnnuri = withFcfs.map((p) => (onnuriSet.has(Number((p as { seller_id?: number }).seller_id)) ? { ...p, onnuri_merchant: true } : p))
        }
      }
    } catch { /* fail-soft */ }

    return c.json({ success: true, data: withOnnuri })
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
      AND NOT (COALESCE(p.is_supply_product, 0) = 1 AND COALESCE(p.supply_source_id, 0) = 0)
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
    // 🧱 2026-06-26 서비스 분리(도매↔유어딜): 승인된 도매 원본상품(is_supply_product=1 AND supply_source_id 없음)은
    //   group_buy_status DEFAULT 'active' 를 상속해 아래 OR 절을 통과 → 소비자 공구 상세로 누수(리스트는 category
    //   격리로 안전했으나 단건 ID 경로는 미격리, SSR DETAIL 슬롯까지 전파). 리스트 fix(findAll/count/FTS)와 동일
    //   additive 필터로 차단 — 판매사 재판매 복제본(supply_source_id SET)·플랫폼상품·일반 소비자상품은 그대로 통과.
    const baseWhere = `WHERE p.id = ?
      AND NOT (COALESCE(p.is_supply_product, 0) = 1 AND COALESCE(p.supply_source_id, 0) = 0)
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

    // 🍽️ 2026-06-17 (#5 대표 메뉴) + 🔗 2026-06-21 (셀러 링크샵 handle): 병렬 조회.
    //   기존 순차 await 2개(supply meta → seller handle)를 Promise.all 로 묶어 라운드트립 1회 제거
    //   → 상세 콜드 로딩 단축(대표 신고 "로딩 좀 김") + SSR self-fetch 2000ms 타임아웃 여유 확보.
    // 🔗 셀러 프로필 → 유저 링크샵(/u/{handle}) 연결: sellers.linked_user_id, 미백필 시 같은 email 의 user 로 폴백
    //   (curator.routes 의 email 매칭 backfill 과 동일 패턴 — 읽기전용 네비 결정이라 저위험). handle 있으면 클라가
    //   /u/{handle} 로(CuratorPage 가 linked_seller 면 셀러 storefront inline 렌더 — 콘텐츠 동일, URL 통일).
    //   없으면 클라가 /profile 폴백. worker/index.ts:2090 의 /profile→/u 301 과 정합(인앱 클릭이 301 우회하던 불일치 해소).
    const [metaMap, handleRow] = await Promise.all([
      getSupplyMeta(DB, [Number(id)]).catch(() => null),
      DB.prepare(
        `SELECT u.handle AS handle
           FROM products p
           JOIN sellers s ON s.id = p.seller_id
           JOIN users u ON (
                 u.id = s.linked_user_id
              OR (s.linked_user_id IS NULL AND s.email IS NOT NULL AND s.email != '' AND u.email = s.email)
           )
          WHERE p.id = ? AND u.handle IS NOT NULL AND u.handle != '' LIMIT 1`
      ).bind(id).first<{ handle: string }>().catch(() => null),
    ])
    let menu: Array<{ name: string; desc?: string; price?: string; image?: string; hot?: boolean }> | undefined
    try {
      const raw = metaMap?.get(Number(id))?.menu
      if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) menu = arr }
    } catch { /* meta 데이터 invalid — 메뉴 없음 */ }
    const seller_handle = (handleRow?.handle && handleRow.handle.toLowerCase() !== 'me') ? handleRow.handle : null
    // 🛡️ 2026-07-01 (대표 "1인당 결제 최대 한도" — 셀러가 등록 시 설정): product_supply_meta.max_per_person.
    //   0/미설정=무제한. 클라 스텝퍼 cap + 서버 주문검증(group-buy.routes)이 함께 사용.
    const mppRaw = metaMap?.get(Number(id))?.max_per_person
    const max_per_person = mppRaw != null && Number.isFinite(Number(mppRaw)) && Number(mppRaw) > 0 ? Math.floor(Number(mppRaw)) : null
    // 🎯 2026-07-01 (대표 "카카오맵 매장 페이지 연결"): 등록 시 캡처한 place_url (있으면 상세 지도가 직접 연결).
    const kakao_place_url = normalizeKakaoPlaceUrl(metaMap?.get(Number(id))?.kakao_place_url)
    const prelaunch = metaMap?.get(Number(id))?.prelaunch === '1'  // 🏷️ 오픈 예정형(상세 배지·구매 CTA 분기)
    // 🏪 2026-07-05 온누리 가맹 뱃지 (B2G): seller_meta.onnuri_merchant='1' 이면 상세에 additive 동봉.
    let onnuri_merchant = false
    try {
      const sid = Number((product as { seller_id?: number }).seller_id)
      if (Number.isFinite(sid) && sid > 0) {
        const { getSellerMeta } = await import('../../../worker/utils/seller-meta')
        const sm = await getSellerMeta(DB, [sid])
        onnuri_merchant = sm.get(sid)?.onnuri_merchant === '1'
      }
    } catch { /* fail-soft */ }

    return c.json({
      success: true,
      data: {
        ...product,
        group_buy_tiers: parsedTiers,  // string → array (호환: 클라이언트 useMemo 가 둘 다 handle)
        current_discount_pct: fixedDiscountPct,  // 🛡️ 2026-05-30: 단일가 — 인원 무관 고정
        next_tier: null,                          // 🛡️ 2026-05-30: 동적 인하 제거 (즉시판매)
        next_tier_remaining: null,
        ...(seller_handle ? { seller_handle } : {}),  // 🔗 셀러 링크샵 handle (있을 때만)
        ...(menu ? { menu } : {}),                // 🍽️ #5: 대표 메뉴 (있을 때만)
        ...(max_per_person ? { max_per_person } : {}),  // 🎯 1인당 구매 한도 (있을 때만)
        ...(prelaunch ? { prelaunch: true } : {}),  // 🏷️ 오픈 예정형
        ...(kakao_place_url ? { kakao_place_url } : {}),  // 🎯 카카오 장소 페이지 URL (있을 때만)
        ...(onnuri_merchant ? { onnuri_merchant: true } : {}),  // 🏪 온누리 가맹 매장 (있을 때만)
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
      // 🖼️ 2026-06-21 (대표 신고 — 교환권 카드 썸네일 미표시): voucher_orders.goods_image_url 는 발송 INSERT
      //   (kt-alpha-auto-send)가 저장하지 않아 항상 NULL → 카드가 플레이스홀더만 렌더. gift_catalog(동기화된
      //   기프티쇼 카탈로그, key gift_code = vo.goods_code)에서 이미지를 COALESCE 로 치유 → 기존/신규 전부 해결.
      //   gift_catalog 미존재 환경은 catalog 없이 폴백(기프티콘 카드는 그대로 노출, 이미지만 생략 — 회귀 0).
      const ktSelect = (withCatalog: boolean) => `
        SELECT vo.id, vo.goods_code, vo.goods_name,
               ${withCatalog
                 ? `COALESCE(NULLIF(vo.goods_image_url, ''), (SELECT COALESCE(NULLIF(gc.image_url_large, ''), NULLIF(gc.image_url_small, '')) FROM gift_catalog gc WHERE gc.gift_code = vo.goods_code LIMIT 1))`
                 : `vo.goods_image_url`} AS goods_image_url,
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
        LIMIT 100`
      let ktRes: { results?: any[] } | null = await DB.prepare(ktSelect(true)).bind(Number(user.id)).all<any>().catch(() => null)
      if (!ktRes) ktRes = await DB.prepare(ktSelect(false)).bind(Number(user.id)).all<any>().catch(() => ({ results: [] as any[] }))
      ktAlphaItems = (ktRes?.results || []).map((vo: any) => ({
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
  //   본인 미사용 이용권을 현장에서 직접 사용. CAS(claim-before-credit) 일회성 — 동시/중복 차단.
  //   라이브 '사용완료' 화면 데이터 반환(매장명·used_at). 60초 내 cancel 가능(아래). 돈 이동 X(에스크로는 Phase 2).
  router.post('/vouchers/:code/self-redeem', requireAuth(), async (c) => {
    const { DB } = c.env
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const code = c.req.param('code')
    if (!code) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    try {
      // 🛰️ 2026-06-23 사용 위치(소프트 증거, 게이트 X) — body 에 있으면만 기록.
      // 🎟️ 2026-07-02 (대표 — 매장별 사용 방식 선택): store_code 모드면 매장 확인코드 동봉 필수.
      const body = await c.req.json<{ lat?: number; lng?: number; store_code?: string }>().catch(() => ({} as { lat?: number; lng?: number; store_code?: string }))

      // 🎟️ 모드 게이트 — CAS 이전에 매장 설정 확인. scan_only=셀프 차단 / store_code=코드 일치 필수.
      //   미설정 매장 = self_free(기존 동작). 조회 실패도 fail-open(self_free).
      const pre = await DB.prepare(
        'SELECT v.id, v.status, p.seller_id FROM vouchers v JOIN products p ON p.id = v.product_id WHERE v.code=? AND v.user_id=?'
      ).bind(code, user.id).first<{ id: number; status: string; seller_id: number | null }>().catch(() => null)
      if (!pre) return c.json({ success: false, error: '이용권을 찾을 수 없습니다' }, 404)
      let redemptionMode: 'scan_only' | 'store_code' | 'self_free' = 'self_free'
      if (pre.seller_id != null && pre.status === 'unused') {
        try {
          const { getRedemptionSettings } = await import('../../../worker/utils/redemption-settings')
          const s = await getRedemptionSettings(DB, Number(pre.seller_id))
          redemptionMode = s.mode
          if (redemptionMode === 'scan_only') {
            return c.json({ success: false, code: 'SCAN_ONLY_MODE', error: '이 매장은 직원 확인 방식이에요. 직원에게 QR 화면을 보여주세요.' }, 403)
          }
          if (redemptionMode === 'store_code') {
            const input = String(body.store_code || '').trim()
            if (!input || !s.store_code || input !== s.store_code) {
              return c.json({ success: false, code: 'STORE_CODE_REQUIRED', error: '매장에 비치된 확인코드 4자리를 입력해주세요.' }, 403)
            }
          }
        } catch { /* fail-open — 기존 self_free 동작 */ }
      }

      // 🛡️ 머니룰: claim-before-credit — 미사용+본인 일 때만 원자적 used 선점.
      const res = await DB.prepare(
        "UPDATE vouchers SET status='used', used_at=datetime('now') WHERE code=? AND user_id=? AND status='unused'"
      ).bind(code, user.id).run()
      const claimed = (res.meta?.changes || 0) === 1

      const row = await DB.prepare(`
        SELECT v.id, v.code, v.status, v.used_at, v.product_id, v.applied_price, p.name as product_name, p.restaurant_name, p.seller_id
        FROM vouchers v JOIN products p ON p.id = v.product_id
        WHERE v.code=? AND v.user_id=?
      `).bind(code, user.id).first<{ id: number; code: string; status: string; used_at: string; applied_price?: number | null; product_name?: string; restaurant_name?: string; seller_id?: number | null }>().catch(() => null)

      if (!row) return c.json({ success: false, error: '이용권을 찾을 수 없습니다' }, 404)
      if (!claimed && row.status !== 'used') {
        return c.json({ success: false, error: row.status === 'refunded' ? '환불된 이용권입니다' : '이미 처리되었거나 사용할 수 없는 이용권입니다' }, 409)
      }
      // 🛰️ 사용 위치 소프트 기록(증거용) — 방금 사용한 건만(멱등 재사용엔 덮지 않음).
      if (claimed && row.id != null) {
        try {
          const { recordVoucherRedemptionLocation } = await import('../../../worker/utils/voucher-redemption')
          await recordVoucherRedemptionLocation(DB, Number(row.id), body.lat, body.lng)
        } catch { /* best-effort */ }
      }
      // 🔔 2026-07-02: 셀프 사용 즉시 사장님 대시보드 알림 — 카운터 크로스체크(위조·취소 악용 억제).
      if (claimed && row.seller_id != null) {
        const notifyJob = (async () => {
          try {
            const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
            const amt = Number(row.applied_price || 0)
            await createDashboardNotification(DB, 'seller', String(row.seller_id), 'voucher_self_redeemed',
              '🎟️ 이용권 셀프 사용', `${row.product_name || '이용권'}${amt > 0 ? ` · ${amt.toLocaleString('ko-KR')}원` : ''} — 손님이 방금 사용 처리했어요`,
              '/seller/scan')
          } catch { /* best-effort */ }
        })()
        c.executionCtx?.waitUntil?.(notifyJob)
      }
      // claimed === true (방금 사용) 또는 이미 used(멱등 반환)
      const usedAtMs = row.used_at ? Date.parse(row.used_at.replace(' ', 'T') + 'Z') : Date.now()
      // 🎟️ 셀프취소(60초)는 self_free 모드에서만 — store_code 모드는 2단계 입력이라 오탭이 거의 불가,
      //   취소 권한은 매장(사장님 스캔 화면)으로. 취소창 0 = "보여주고 나가서 취소" 악용 차단.
      const cancelableUntil = redemptionMode === 'self_free' ? usedAtMs + 60_000 : usedAtMs
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
      // 🎟️ 2026-07-02 모드 게이트: 셀프취소는 self_free 매장에서만 — store_code/scan_only 매장은
      //   취소 권한이 매장(사장님)에 있음("보여주고 나가서 60초 내 취소" 악용 차단).
      const pre = await DB.prepare(
        'SELECT p.seller_id, v.applied_price, p.name as product_name FROM vouchers v JOIN products p ON p.id = v.product_id WHERE v.code=? AND v.user_id=?'
      ).bind(code, user.id).first<{ seller_id: number | null; applied_price: number | null; product_name?: string }>().catch(() => null)
      if (pre?.seller_id != null) {
        try {
          const { getRedemptionSettings } = await import('../../../worker/utils/redemption-settings')
          const s = await getRedemptionSettings(DB, Number(pre.seller_id))
          if (s.mode !== 'self_free') {
            return c.json({ success: false, error: '이 매장은 셀프 취소가 불가해요. 직원에게 문의해주세요.' }, 403)
          }
        } catch { /* fail-open — 기존 동작 */ }
      }
      // CAS: 본인 + used + used_at 60초 이내 + 아직 정산 전(settlement_id IS NULL) 일 때만 되돌림.
      //   기존 auto-settlement(used 7일 후 정산)와 정합 — 정산된 건 절대 취소 불가(60초 ≪ 7일이라 안전, 명시 가드).
      const res = await DB.prepare(
        "UPDATE vouchers SET status='unused', used_at=NULL WHERE code=? AND user_id=? AND status='used' AND used_at >= datetime('now','-60 seconds') AND settlement_id IS NULL"
      ).bind(code, user.id).run()
      if ((res.meta?.changes || 0) !== 1) {
        return c.json({ success: false, error: '취소 가능 시간(60초)이 지났습니다' }, 409)
      }
      // 🔔 취소도 사장님에게 즉시 알림 — "사용완료 보여주고 취소" 수법의 가시화(악용 억제 핵심).
      if (pre?.seller_id != null) {
        const notifyJob = (async () => {
          try {
            const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
            await createDashboardNotification(DB, 'seller', String(pre.seller_id), 'voucher_redeem_cancelled',
              '↩️ 셀프 사용 취소됨', `${pre.product_name || '이용권'} — 손님이 방금 사용을 취소했어요. 매장에서 확인해보세요.`,
              '/seller/scan')
          } catch { /* best-effort */ }
        })()
        c.executionCtx?.waitUntil?.(notifyJob)
      }
      return c.json({ success: true, data: { code, status: 'unused' } })
    } catch (err) {
      return safeError(c, err, '취소 중 오류가 발생했습니다', '[cancel-redeem]')
    }
  })

  // ── GET /vouchers/:code/redemption-info — 🎟️ 2026-07-06 (대표 "이용권 페이지에 사용방법을 사장님
  //   설정과 동일하게"): 소비자가 사용 *전에* 이 매장의 사용 방식을 알 수 있게 모드만 반환.
  //   scan_only=직원 스캔 / store_code=카운터 확인코드 입력 / self_free=바로 셀프 사용.
  //   ⚠️ store_code 값(카운터 비밀코드)은 반환하지 않음 — 현장에서만 확인(원격 오사용 차단, 게이트와 동일 철학). ──
  router.get('/vouchers/:code/redemption-info', requireAuth(), async (c) => {
    const { DB } = c.env
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const code = c.req.param('code')
    if (!code) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    try {
      // 본인 소유 이용권만 — self-redeem 게이트와 동일한 voucher→product→seller 해석.
      const pre = await DB.prepare(
        'SELECT p.seller_id FROM vouchers v JOIN products p ON p.id = v.product_id WHERE v.code=? AND v.user_id=?'
      ).bind(code, user.id).first<{ seller_id: number | null }>().catch(() => null)
      if (!pre) return c.json({ success: false, error: '이용권을 찾을 수 없습니다' }, 404)
      let mode: 'scan_only' | 'store_code' | 'self_free' = 'self_free'  // 미설정/조회실패 = 기존 동작
      let conditions: string[] = []
      if (pre.seller_id != null) {
        try {
          const { getRedemptionSettings } = await import('../../../worker/utils/redemption-settings')
          mode = (await getRedemptionSettings(DB, Number(pre.seller_id))).mode
        } catch { /* fail-open — self_free */ }
        // 🎟️ 2026-07-06 매장별 사용조건(사장님이 선택) → 소비자 '이용 안내'에 표준 문구로 표시.
        try {
          const { getSellerMeta } = await import('../../../worker/utils/seller-meta')
          const { resolveUsageConditions } = await import('../../../shared/voucher-usage-conditions')
          const raw = (await getSellerMeta(DB, [Number(pre.seller_id)]))?.get(Number(pre.seller_id))
          const keys = JSON.parse(String(raw?.voucher_usage_conditions || '[]'))
          conditions = resolveUsageConditions(Array.isArray(keys) ? keys : [], String(raw?.voucher_usage_custom || ''))
        } catch { /* 미설정 */ }
      }
      return c.json({ success: true, data: { mode, conditions } })
    } catch (err) {
      return safeError(c, err, '사용 방식 조회 중 오류가 발생했습니다', '[redemption-info]')
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
