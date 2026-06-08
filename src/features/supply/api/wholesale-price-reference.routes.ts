/**
 * 🏭 2026-06-08 BIZ-5 v1 — 어드민 상품 검수 화면용 "네이버쇼핑 최저가 참고값" 조회 (advisory only).
 *
 * - GET /api/admin/wholesale/price-reference?query=<상품명>&barcode=<옵션>
 *   네이버 쇼핑 검색 API(https://openapi.naver.com/v1/search/shop.json)를 워커에서 서버사이드 호출,
 *   최저가/중앙값 + 상위 매물을 반환. **참고용** — 절대 자동승인/차단에 쓰이지 않음(동명이품 오탐 방지).
 *
 * ⚠️ prod 제약: dev-container 의 naver-ad-scraper(localhost:3456)는 production Cloudflare Worker 에서
 *   접근 불가 → 공식 네이버 쇼핑 검색 API 만 사용. env NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 게이트.
 *   키 미설정 시 fail-open: { available:false, reason:'NAVER_API_KEY_MISSING', items:[] } (절대 throw/500 X).
 *
 * 마운트(오케스트레이터): app.route('/api/admin/wholesale', wholesalePriceReferenceRoutes)
 *   import: import { wholesalePriceReferenceRoutes } from '../features/supply/api/wholesale-price-reference.routes'
 *
 * 캐시: RATE_LIMIT_KV (정규화 쿼리 키, TTL ~12h) — 네이버 일일 quota(25k/day) 보호.
 *
 * 🔁 후속(out of scope): cron 주기 재검(wholesale-price-monitor) + price_drift_alert 는 별도 PR 로 deferred.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface NaverShopItem {
  title: string
  link: string
  image: string
  lprice: string
  hprice: string
  mallName: string
  productId: string
  productType: string
  brand: string
  maker: string
  category1?: string
  category2?: string
}
interface NaverShopResponse {
  total?: number
  items?: NaverShopItem[]
}
interface PriceRefItem {
  title: string
  lprice: number
  hprice: number | null
  mallName: string
  link: string
  image: string
  brand: string
  maker: string
}

const stripTags = (s: string): string =>
  (s || '').replace(/<\/?b>/gi, '').replace(/<[^>]+>/g, '').trim()

const toNum = (v: string | undefined): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function median(nums: number[]): number {
  const arr = nums.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (arr.length === 0) return 0
  const mid = Math.floor(arr.length / 2)
  return arr.length % 2 === 0 ? Math.round((arr[mid - 1] + arr[mid]) / 2) : arr[mid]
}

const CACHE_TTL_SEC = 12 * 60 * 60 // 12h — 네이버 일일 quota(25k/day) 보호
const CACHE_VERSION = 'v1'

function normalizeQueryKey(q: string): string {
  return `naverprice:${CACHE_VERSION}:${q.trim().toLowerCase().replace(/\s+/g, ' ')}`
}

// ── GET /price-reference ──────────────────────────────────────────────────────
// 어드민이지만 외부 API(네이버) 백킹 → rate-limit 적용. KV 캐시로 quota 보호.
app.get(
  '/price-reference',
  rateLimit({ action: 'wholesale-price-reference', max: 60, windowSec: 60 }),
  async (c) => {
    try {
      const rawQuery = (c.req.query('query') || '').trim()
      const barcode = (c.req.query('barcode') || '').trim()

      // barcode 우선(더 정밀), 없으면 상품명.
      const searchTerm = barcode || rawQuery

      if (!searchTerm || searchTerm.length < 1 || searchTerm.length > 100) {
        return c.json(
          { available: false, reason: 'INVALID_QUERY', items: [], query: searchTerm },
          400,
        )
      }

      const clientId = c.env.NAVER_CLIENT_ID
      const clientSecret = c.env.NAVER_CLIENT_SECRET
      // fail-open: 키 미설정 시 검수 플로우를 절대 막지 않음.
      if (!clientId || !clientSecret) {
        return c.json({
          available: false,
          reason: 'NAVER_API_KEY_MISSING',
          items: [],
          query: searchTerm,
        })
      }

      const kv = c.env.RATE_LIMIT_KV
      const cacheKey = normalizeQueryKey(searchTerm)

      // 1) 캐시 조회
      if (kv) {
        try {
          const cached = await kv.get(cacheKey)
          if (cached) {
            const parsed = JSON.parse(cached)
            return c.json({ ...parsed, cached: true })
          }
        } catch {
          // 캐시 읽기 실패는 무시하고 라이브 조회로 진행 (advisory).
        }
      }

      // 2) 네이버 쇼핑 검색 API 호출 (display=10, sort=asc 가격 오름차순)
      const url =
        'https://openapi.naver.com/v1/search/shop.json' +
        `?query=${encodeURIComponent(searchTerm)}&display=10&start=1&sort=asc`

      let upstream: Response
      try {
        upstream = await fetch(url, {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
            Accept: 'application/json',
          },
          // 외부 API hang 방지(advisory feature — 길게 잡지 않음).
          signal: AbortSignal.timeout(6000),
        })
      } catch (fetchErr) {
        // fail-open: upstream 네트워크 오류 → 빈 결과(검수 플로우 비차단).
        console.error('[wholesale-price-ref] naver fetch failed:', (fetchErr as Error)?.message)
        return c.json({
          available: false,
          reason: 'NAVER_UPSTREAM_ERROR',
          items: [],
          query: searchTerm,
        })
      }

      if (!upstream.ok) {
        console.error('[wholesale-price-ref] naver status:', upstream.status)
        return c.json({
          available: false,
          reason: `NAVER_UPSTREAM_${upstream.status}`,
          items: [],
          query: searchTerm,
        })
      }

      const data = (await upstream.json()) as NaverShopResponse
      const rawItems = Array.isArray(data.items) ? data.items : []

      const items: PriceRefItem[] = rawItems.map((it) => ({
        title: stripTags(it.title),
        lprice: toNum(it.lprice),
        hprice: it.hprice ? toNum(it.hprice) : null,
        mallName: it.mallName || '',
        link: it.link || '',
        image: it.image || '',
        brand: it.brand || '',
        maker: it.maker || '',
      }))

      const lprices = items.map((i) => i.lprice).filter((n) => n > 0)
      const min_lprice = lprices.length ? Math.min(...lprices) : 0
      const median_lprice = median(lprices)

      const payload = {
        available: true,
        query: searchTerm,
        used_barcode: !!barcode,
        min_lprice,
        median_lprice,
        items,
        cached: false,
        fetched_at: new Date().toISOString(),
      }

      // 3) 캐시 저장 (best-effort — 실패해도 응답엔 영향 X)
      if (kv) {
        try {
          await kv.put(cacheKey, JSON.stringify(payload), { expirationTtl: CACHE_TTL_SEC })
        } catch {
          // ignore cache write failure
        }
      }

      return c.json(payload)
    } catch (err) {
      // 예기치 못한 오류라도 advisory feature 는 검수 플로우를 500 으로 막지 않음 → fail-open.
      // (safeError 미사용: 일반 라우트는 safeError 로 500 반환하지만, 본 참고값 조회는 검수 UI 를
      //  절대 깨면 안 되므로 의도적으로 빈 결과 200 fail-open. 상세는 위 console.error 로 서버 로그.)
      console.error('[wholesale-price-ref] unexpected:', (err as Error)?.message)
      return c.json({
        available: false,
        reason: 'INTERNAL_ERROR',
        items: [],
        query: (c.req.query('query') || c.req.query('barcode') || '').trim(),
      })
    }
  },
)

export { app as wholesalePriceReferenceRoutes }
