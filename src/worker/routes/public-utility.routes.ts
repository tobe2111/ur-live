/**
 * Public Utility Routes
 *
 * 인증 불필요한 공개 유틸리티 엔드포인트 — worker/index.ts 분할 (P1).
 *
 * - POST /api/csp-report           — CSP 위반 보고서 수집 (DB 저장)
 * - GET  /manifest.webmanifest     — PWA manifest (assets fetch + fallback)
 * - GET  /api/version              — 빌드 버전 + secret 존재 여부 (boolean)
 *
 * 작성일: 2026-04-26 (P1)
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'

export const publicUtilityRoutes = new Hono<{ Bindings: Env }>()

// 모듈 스코프 캐시 (60초)
let _cachedBuildVersion: { version: string; fetchedAt: number } | null = null

// ── POST /api/csp-report ─────────────────────────
publicUtilityRoutes.post('/api/csp-report', async (c) => {
  try {
    const report = await c.req.json().catch(() => null)
    if (import.meta.env.DEV && report) console.warn('[CSP violation]', report)
    if (report && c.env.DB) {
      try {
        await c.env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS csp_violations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            blocked_uri TEXT,
            violated_directive TEXT,
            document_uri TEXT,
            source_file TEXT,
            line_number INTEGER,
            user_agent TEXT,
            ip TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `).run()
        const body = (report as any)['csp-report'] || report
        await c.env.DB.prepare(`
          INSERT INTO csp_violations
            (blocked_uri, violated_directive, document_uri, source_file, line_number, user_agent, ip)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          String(body?.['blocked-uri'] || body?.blockedURL || '').slice(0, 500),
          String(body?.['violated-directive'] || body?.effectiveDirective || '').slice(0, 200),
          String(body?.['document-uri'] || body?.documentURL || '').slice(0, 500),
          String(body?.['source-file'] || body?.sourceFile || '').slice(0, 500),
          Number(body?.['line-number'] || body?.lineNumber || 0) || null,
          (c.req.header('User-Agent') || '').slice(0, 300),
          c.req.header('CF-Connecting-IP') || '',
        ).run()
      } catch { /* DB 실패도 CSP 에 영향 X */ }
    }
  } catch { /* swallow — parse errors don't surface */ }
  return c.body(null, 204)
})

// ── GET /manifest.webmanifest ────────────────────
publicUtilityRoutes.get('/manifest.webmanifest', async (c) => {
  try {
    const assets = (c.env as any).ASSETS
    if (assets) {
      const res = await assets.fetch(new Request(new URL('/manifest.webmanifest', c.req.url).toString()))
      if (res && res.ok) {
        const body = await res.text()
        return new Response(body, {
          headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      }
    }
  } catch { /* fall through to inline */ }
  // Fallback: 인라인 매니페스트
  return new Response(JSON.stringify({
    name: '유어딜',
    short_name: '유어딜',
    start_url: '/',
    display: 'standalone',
    background_color: '#020202',
    theme_color: '#020202',
    orientation: 'portrait',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
})

// ── GET /api/version ─────────────────────────────
publicUtilityRoutes.get('/api/version', async (c) => {
  // 공개 secret 존재 여부 boolean — 값 자체는 노출 안 됨. 500 진단용.
  const env = c.env as any
  const secrets = {
    JWT_SECRET: !!env.JWT_SECRET,
    REFRESH_TOKEN_SECRET: !!env.REFRESH_TOKEN_SECRET,
    KAKAO_REST_API_KEY: !!env.KAKAO_REST_API_KEY,
    FIREBASE_PRIVATE_KEY: !!env.FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL: !!env.FIREBASE_CLIENT_EMAIL,
    TOSS_SECRET_KEY: !!env.TOSS_SECRET_KEY,
    DB: !!env.DB,
  }
  try {
    const now = Date.now()
    if (_cachedBuildVersion && (now - _cachedBuildVersion.fetchedAt) < 60_000) {
      return c.json({ success: true, version: _cachedBuildVersion.version, secrets })
    }

    const origin = new URL(c.req.url).origin
    const htmlRes = await fetch(`${origin}/`, { cf: { cacheTtl: 30 } } as RequestInit)
    if (!htmlRes.ok) return c.json({ success: false, version: null, secrets }, 502)

    const html = await htmlRes.text()
    const match = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/)
    const version = match?.[1] || 'unknown'
    _cachedBuildVersion = { version, fetchedAt: now }
    return c.json({ success: true, version, secrets })
  } catch {
    return c.json({ success: false, version: null, secrets }, 502)
  }
})

// ── GET /api/flash-deals ────────────────────────
// 타임딜(플래시 딜) 상품 조회 — flash_deal_start/end 또는 sale_ends_at fallback
publicUtilityRoutes.get('/api/flash-deals', async (c) => {
  try {
    const DB = c.env.DB
    if (!DB) return c.json({ success: true, data: { deals: [], avg_discount_rate: 0, count: 0 } })

    // 컬럼 존재 여부 확인 (PRAGMA)
    let hasFlashDeal = false
    let hasSaleEndsAt = false
    try {
      const pragmaResult = await DB.prepare(`PRAGMA table_info(products)`).all<{ name: string }>()
      const cols = (pragmaResult?.results ?? []).map((r: { name: string }) => r.name)
      hasFlashDeal = cols.includes('flash_deal_start')
      hasSaleEndsAt = cols.includes('sale_ends_at')
    } catch { /* PRAGMA 실패 시 fallback */ }

    let deals: Record<string, unknown>[] = []
    let avgDiscountRate = 0

    if (hasFlashDeal) {
      const result = await DB.prepare(`
        SELECT id, name, price, original_price, image_url, sold_count, stock,
               flash_deal_start, flash_deal_end,
               CASE
                 WHEN original_price > 0 AND original_price > price
                 THEN CAST(ROUND((original_price - price) * 100.0 / original_price) AS INTEGER)
                 ELSE 0
               END AS computed_discount_rate
        FROM products
        WHERE is_active=1
          AND flash_deal_start IS NOT NULL
        ORDER BY flash_deal_end ASC
        LIMIT 20
      `).all<Record<string, unknown>>()
      deals = result?.results ?? []
    } else if (hasSaleEndsAt) {
      const result = await DB.prepare(`
        SELECT id, name, price, original_price, image_url, sold_count, stock,
               sale_ends_at AS flash_deal_end,
               CASE
                 WHEN original_price > 0 AND original_price > price
                 THEN CAST(ROUND((original_price - price) * 100.0 / original_price) AS INTEGER)
                 ELSE 0
               END AS computed_discount_rate
        FROM products
        WHERE is_active=1
          AND sale_ends_at IS NOT NULL
          AND sale_ends_at > datetime('now')
        ORDER BY sale_ends_at ASC
        LIMIT 20
      `).all<Record<string, unknown>>()
      deals = result?.results ?? []
    } else {
      // flash_deal/sale_ends_at 컬럼 없음 — 할인상품 중 상위 6개를 타임딜로 표시
      const result = await DB.prepare(`
        SELECT id, name, price, original_price, image_url, sold_count, stock,
               NULL AS flash_deal_end,
               CASE
                 WHEN original_price > 0 AND original_price > price
                 THEN CAST(ROUND((original_price - price) * 100.0 / original_price) AS INTEGER)
                 ELSE 0
               END AS computed_discount_rate
        FROM products
        WHERE is_active=1
          AND original_price IS NOT NULL
          AND original_price > price
        ORDER BY (original_price - price) DESC
        LIMIT 6
      `).all<Record<string, unknown>>()
      deals = result?.results ?? []
    }

    if (deals.length > 0) {
      const total = deals.reduce((sum, d) => sum + (Number(d.computed_discount_rate) || 0), 0)
      avgDiscountRate = Math.round(total / deals.length)
    }

    return c.json({
      success: true,
      data: {
        deals,
        avg_discount_rate: avgDiscountRate,
        count: deals.length,
      },
    })
  } catch (e) {
    if (import.meta.env.DEV) console.error('[flash-deals]', e)
    return c.json({ success: true, data: { deals: [], avg_discount_rate: 0, count: 0 } })
  }
})

// 🛡️ 2026-04-28: 메인페이지 perf — 6개 분리 호출 → 1개 통합
//   /api/streams x3 + /api/group-buy/products + /api/products x2 → /api/home/bundle
//   서버 측 D1 호출은 동일 (병렬), 클라이언트 round-trip 6→1 (50-300ms 절감)
publicUtilityRoutes.get('/api/home/bundle', async (c) => {
  const DB = c.env.DB
  const safeAll = async <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null)
  try {
    const [live, scheduled, ended, mealVouchers, featured, latest] = await Promise.all([
      safeAll(DB.prepare(
        // 🛡️ 2026-05-07: started_at 6시간 이내만 (외부 도구로 종료된 stale 'live' 데이터 숨김)
        // 🛡️ 2026-05-18: deleted_at IS NULL — 어드민 라이브 모니터링에서 삭제한 row 는 메인 페이지에서도 숨김.
        `SELECT id, title, youtube_video_id, viewer_count, current_viewers, status, seller_id,
                created_at, scheduled_at, started_at, current_product_id
         FROM live_streams
         WHERE status='live'
           AND (deleted_at IS NULL)
           AND (started_at IS NULL OR datetime(started_at) >= datetime('now', '-6 hours'))
         ORDER BY current_viewers DESC LIMIT 12`
      ).all<Record<string, unknown>>()),
      safeAll(DB.prepare(
        // 🛡️ 2026-05-07: scheduled_at 이 24시간 이상 지난 건 제외 (방치된 테스트 방송 숨김)
        // 🛡️ 2026-05-18: deleted_at IS NULL 추가.
        `SELECT id, title, youtube_video_id, status, seller_id, scheduled_at, created_at
         FROM live_streams
         WHERE status='scheduled'
           AND (deleted_at IS NULL)
           AND (scheduled_at IS NULL OR datetime(scheduled_at) >= datetime('now', '-1 day'))
         ORDER BY scheduled_at ASC LIMIT 8`
      ).all<Record<string, unknown>>()),
      safeAll(DB.prepare(
        // 🛡️ 2026-05-18: deleted_at IS NULL — 다시보기 피드도 어드민 soft-delete 반영.
        `SELECT id, title, youtube_video_id, status, seller_id, ended_at, created_at
         FROM live_streams WHERE status='ended' AND (deleted_at IS NULL) ORDER BY ended_at DESC LIMIT 6`
      ).all<Record<string, unknown>>()),
      safeAll(DB.prepare(
        `SELECT id, name, price, original_price, image_url, restaurant_name, restaurant_address,
                group_buy_target, group_buy_current, group_buy_deadline, category
         FROM products
         WHERE category='meal_voucher' AND is_active=1
           AND (group_buy_status='active' OR group_buy_status IS NULL)
         ORDER BY created_at DESC LIMIT 20`
      ).all<Record<string, unknown>>()),
      safeAll(DB.prepare(
        `SELECT id, name, price, original_price, image_url, category, seller_id,
                view_count, sold_count, avg_rating, review_count
         FROM products
         WHERE is_active=1
         ORDER BY view_count DESC, created_at DESC LIMIT 12`
      ).all<Record<string, unknown>>()),
      safeAll(DB.prepare(
        `SELECT id, name, price, original_price, image_url, category, seller_id, created_at
         FROM products
         WHERE is_active=1
         ORDER BY created_at DESC LIMIT 8`
      ).all<Record<string, unknown>>()),
    ])

    return c.json({
      success: true,
      data: {
        live: live?.results ?? [],
        scheduled: scheduled?.results ?? [],
        ended: ended?.results ?? [],
        meal_vouchers: mealVouchers?.results ?? [],
        featured: featured?.results ?? [],
        latest: latest?.results ?? [],
      },
    })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})

// 🛡️ 2026-05-19: 온라인 카테고리별 상품 그룹 — 메인 홈 카테고리 섹션용.
//   각 카테고리 마다 active 상품 8개씩.
publicUtilityRoutes.get('/api/home/categories', async (c) => {
  const DB = c.env.DB
  try {
    // 1) 활성 카테고리 + 카운트 (사이드바/탭용).
    const cats = await DB.prepare(
      `SELECT COALESCE(category, '(미분류)') as category, COUNT(*) as cnt
         FROM products
        WHERE is_active = 1 AND category IS NOT NULL AND category != ''
        GROUP BY category
        HAVING cnt > 0
        ORDER BY cnt DESC LIMIT 12`
    ).all<{ category: string; cnt: number }>().catch(() => ({ results: [] }))

    // 2) 각 카테고리별 인기 상품 top 8.
    const sections: Array<{ category: string; count: number; products: Record<string, unknown>[] }> = []
    for (const c of (cats.results || [])) {
      const items = await DB.prepare(
        `SELECT id, name, price, original_price, image_url, category, seller_id,
                view_count, sold_count, avg_rating, review_count, deal_only
           FROM products
          WHERE is_active = 1 AND category = ?
          ORDER BY sold_count DESC, view_count DESC, created_at DESC
          LIMIT 8`
      ).bind(c.category).all<Record<string, unknown>>().catch(() => ({ results: [] }))
      sections.push({ category: c.category, count: c.cnt, products: items.results || [] })
    }

    return c.json({ success: true, data: { sections } })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})
