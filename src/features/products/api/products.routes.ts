/**
 * Products API Routes
 * 
 * Endpoints:
 * - GET    /api/products                   - 상품 목록 조회
 * - GET    /api/products/search/popular    - 인기 검색어 조회
 * - GET    /api/products/search/suggestions - 검색 자동완성
 * - GET    /api/products/:id              - 상품 상세 조회
 * - GET    /api/products/:id/options      - 상품 옵션 목록 조회
 * - POST   /api/products                  - 상품 생성 (판매자 전용)
 * - PUT    /api/products/:id              - 상품 수정 (판매자 전용)
 * - DELETE /api/products/:id              - 상품 삭제 (판매자 전용)
 *
 * NOTE: app.route('/api/products', productsRoutes) 에 등록됨.
 * 내부 경로에 /api/products 를 절대 포함하지 말 것 (더블 prefix 방지).
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import { getFeatureFlags } from '@/worker/utils/feature-flags';
import { rateLimit } from '@/worker/middleware/rate-limit';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import { invalidateProductCache } from '@/lib/cache-invalidation';
import { safeError } from '@/worker/utils/safe-error';
import { validateImageUrl } from '@/worker/utils/validation';
import type { KVNamespace } from '@cloudflare/workers-types';
import { cacheGet } from '@/worker/utils/cache';
import { ProductService } from '../services/ProductService';
import type { ProductFilter, ProductCreateInput, ProductUpdateInput } from '../types';
import { seedDemoReviews } from '@/worker/utils/demo-review-generator';
import type { Env } from '@/worker/types/env';

// 🛡️ 2026-04-22: bare cors() 는 모든 origin 허용. 민감 routes 에 쓰지 말고 아래 tightCors 사용.
const tightCors = () => cors({ origin: [...ALLOWED_ORIGINS], credentials: true });

type Bindings = {
  DB: D1Database;
  SESSION_KV?: KVNamespace;
};

export const productsRoutes = new Hono<{ Bindings: Bindings }>();

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 2026-07-07 (대표 — "데모 상품 심어줘"): 링크샵 리디자인 확인용 데모 상품 시드 (키 게이트 공개).
//   admin 토큰 없이 호출하려고 key 로 게이트. ⚠️ 데모 도구 — 오픈 전 제거/보안 권장. 데모 상품(slug
//   'demo-linkshop-N')만 생성/삭제하며 seller_id 는 요청값. POST 시드(멱등) / DELETE 제거.
const DEMO_SEED_KEY = 'urdeal-demo-seed-2026';
const DEMO_LS_SLUG = 'demo-linkshop-';
// 🍽️ 동네딜(음식·매장) 실사진 — body.images 로 커스텀 가능(미전달 시 이 기본값).
const DEMO_LS_IMG = [
  '/api/media/uploads/demo/2026-07/bdec2dec-80c4-416c-a67e-a3c9f46790e4.jpg',
  '/api/media/uploads/demo/2026-07/d3975223-f7ef-4cce-bf87-c5968fd532a1.jpg',
  '/api/media/uploads/demo/2026-07/7e006052-e1ec-4bbb-a1cb-c3c34b6731b2.jpg',
  '/api/media/uploads/demo/2026-07/5765a2fb-1e16-4014-9164-aec141a8930c.png',
  '/api/media/uploads/demo/2026-07/00b287a9-3c7e-4906-b5fd-4a436bc3572a.webp',
  '/api/media/uploads/demo/2026-07/c5e4de89-ea9e-4c74-b5fd-eb0d80d7c250.jpg',
  '/api/media/uploads/demo/2026-07/bbc21baa-edd6-4e81-970c-63b27f55ef47.jpg',
  '/api/media/uploads/demo/2026-07/332880ae-61b9-45a1-991d-4e68f6a15482.jpg',
  '/api/media/uploads/demo/2026-07/997664fa-f6d3-4e2f-be14-8308aa28619f.jpg',
];
const DEMO_LS_SHOP = [
  { name: '프리미엄 한우 등심 500g 냉장', price: 69000, original: 89000 },
  { name: '국내산 참기름 선물세트 (500ml x2)', price: 38000, original: 0 },
  { name: '명란젓 500g 특상품 저염', price: 19900, original: 24900 },
  { name: '수제 어묵탕 밀키트 2인분', price: 15900, original: 0 },
  { name: '전통방식 쌀조청 850g', price: 12000, original: 0 },
  { name: '제주 손질 갈치 냉동 5팩', price: 27000, original: 32000 },
];
const DEMO_LS_VOU = [
  { name: '[성수] 소금집델리 브런치 이용권', price: 28000, original: 34000, rest: '소금집델리 성수' },
  { name: '[연남] 수제버거 세트 교환권', price: 18000, original: 0, rest: '연남버거하우스' },
];

productsRoutes.post('/demo-seed-linkshop', async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as { key?: string; seller_id?: number | string; images?: string[] };
    if (body.key !== DEMO_SEED_KEY) return c.json({ success: false, error: 'bad key' }, 403);
    const sellerId = Number(body.seller_id);
    if (!Number.isFinite(sellerId) || sellerId <= 0) return c.json({ success: false, error: 'seller_id 필요' }, 400);
    const DB = c.env.DB as D1Database;
    const existing = await DB.prepare(`SELECT COUNT(*) AS c FROM products WHERE slug LIKE ? AND seller_id = ?`)
      .bind(DEMO_LS_SLUG + '%', sellerId).first<{ c: number }>().catch(() => ({ c: 0 }));
    if ((existing?.c ?? 0) > 0) return c.json({ success: true, alreadySeeded: true, count: existing!.c });
    const imgs = Array.isArray(body.images) && body.images.length ? body.images.slice(0, 20) : DEMO_LS_IMG;
    let n = 0, imgI = 0;
    for (const p of DEMO_LS_SHOP) {
      const slug = DEMO_LS_SLUG + (++n);
      await DB.prepare(
        `INSERT INTO products (name, description, price, original_price, image_url, category, product_type, is_active, seller_id, stock, stock_quantity, slug, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'food', 'regular', 1, ?, 50, 50, ?, datetime('now'), datetime('now'))`
      ).bind(p.name, p.name + ' — 데모 상품', p.price, p.original || null, imgs[imgI++ % imgs.length], sellerId, slug).run().catch(() => {});
    }
    for (const v of DEMO_LS_VOU) {
      const slug = DEMO_LS_SLUG + (++n);
      await DB.prepare(
        `INSERT INTO products (name, description, price, original_price, image_url, category, product_type, is_active, seller_id, stock, stock_quantity, restaurant_name, slug, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'meal_voucher', 'regular', 1, ?, 50, 50, ?, ?, datetime('now'), datetime('now'))`
      ).bind(v.name, v.name + ' — 데모 이용권', v.price, v.original || null, imgs[imgI++ % imgs.length], sellerId, v.rest, slug).run().catch(() => {});
    }
    // 🎯 2026-07-07 (대표 폴리시 — "평점/리뷰도"): 시드된 데모에 매장특색 데모 리뷰 부착(신규 → ★평점).
    //   admin dongnedeal 시드와 동일 헬퍼(seedDemoReviews) 재사용 — LLM(키 있으면) 또는 결정론 폴백,
    //   상품별 리뷰 수 6~12 랜덤, review_count/avg_rating/sold_count 갱신(멱등: 리뷰 있으면 skip).
    //   외부 LLM 호출이라 응답 블록 방지 위해 waitUntil(ctx 없으면 동기 fallback).
    try {
      const seededRows = await DB.prepare(
        `SELECT id, name, category, restaurant_name FROM products WHERE slug LIKE ? AND seller_id = ?`
      ).bind(DEMO_LS_SLUG + '%', sellerId).all<{ id: number; name: string; category: string; restaurant_name: string | null }>().catch(() => ({ results: [] as { id: number; name: string; category: string; restaurant_name: string | null }[] }));
      const rows = seededRows.results || [];
      const seedReviews = () => Promise.all(rows.map((r) =>
        seedDemoReviews(c.env as unknown as Env, { id: r.id, name: r.name, category: r.category, storeName: r.restaurant_name }, 6 + Math.floor(Math.random() * 7)).catch(() => 0)
      ));
      try { c.executionCtx.waitUntil(seedReviews()); } catch { await seedReviews(); }
    } catch { /* 리뷰 시드 실패는 상품 시드 성공에 영향 없음 */ }
    return c.json({ success: true, seeded: n, seller_id: sellerId });
  } catch (e) {
    return c.json({ success: false, error: String((e as Error)?.message || e).slice(0, 120) }, 500);
  }
});

productsRoutes.post('/demo-seed-linkshop/clear', async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as { key?: string; seller_id?: number | string };
    if (body.key !== DEMO_SEED_KEY) return c.json({ success: false, error: 'bad key' }, 403);
    const DB = c.env.DB as D1Database;
    const sellerId = Number(body.seller_id);
    const rows = await DB.prepare(`SELECT id FROM products WHERE slug LIKE ?${Number.isFinite(sellerId) && sellerId > 0 ? ' AND seller_id = ?' : ''}`)
      .bind(...(Number.isFinite(sellerId) && sellerId > 0 ? [DEMO_LS_SLUG + '%', sellerId] : [DEMO_LS_SLUG + '%'])).all<{ id: number }>().catch(() => ({ results: [] as { id: number }[] }));
    let deleted = 0, retired = 0;
    for (const r of (rows.results || [])) {
      for (const t of ['product_reviews', 'cart_items', 'wishlists']) await DB.prepare(`DELETE FROM ${t} WHERE product_id = ?`).bind(r.id).run().catch(() => {});
      try { const d = await DB.prepare(`DELETE FROM products WHERE id = ?`).bind(r.id).run(); if (d.meta?.changes) { deleted++; continue; } } catch { /* FK */ }
      await DB.prepare(`UPDATE products SET is_active = 0, slug = 'retired-' || slug || '-' || id WHERE id = ?`).bind(r.id).run().catch(() => {});
      retired++;
    }
    return c.json({ success: true, deleted, retired });
  } catch (e) {
    return c.json({ success: false, error: String((e as Error)?.message || e).slice(0, 120) }, 500);
  }
});

/**
 * POST /api/products/dominant-color
 * 카드 이미지 도미넌트 컬러 lazy 백필 — 클라이언트가 canvas 1x1 로 추출한 색을 보고.
 *
 * 보안:
 *   - hex "#RRGGBB" 형식만 허용 (정규식 검증)
 *   - dominant_color IS NULL 일 때만 UPDATE (first-write-wins — 변조 영향 = 1회 placeholder 색뿐)
 *   - rate limit (IP 당 분당 30회)
 *   - 최대 50개 batch
 * 인증 불필요 (cosmetic placeholder, 비민감). cf-image/서버 이미지 처리 0.
 */
productsRoutes.post('/dominant-color', rateLimit({ action: 'dominant_color', max: 30, windowSec: 60 }), async (c) => {
  try {
    const { DB } = c.env;
    const body = await c.req.json<{ items?: { id: number; color: string }[] }>().catch(() => ({ items: [] }));
    const hexRe = /^#[0-9a-fA-F]{6}$/;
    const valid = (Array.isArray(body.items) ? body.items : [])
      .slice(0, 50)
      .filter((it) => it && Number.isInteger(it.id) && it.id > 0 && typeof it.color === 'string' && hexRe.test(it.color));
    if (valid.length === 0) return c.json({ success: true, updated: 0 });
    const stmts = valid.map((it) =>
      DB.prepare('UPDATE products SET dominant_color = ? WHERE id = ? AND dominant_color IS NULL').bind(it.color, it.id),
    );
    await DB.batch(stmts);
    return c.json({ success: true, updated: valid.length });
  } catch (err) {
    // 🛡️ 2026-05-28: dominant_color 컬럼 미생성(migration 0282 전) 이면 graceful no-op.
    //   schema-repair cron(매일 18 UTC) 후 컬럼 생기면 자동 동작. 500 spam 방지.
    if (/no such column/i.test(String((err as { message?: string })?.message ?? err))) {
      return c.json({ success: true, updated: 0 });
    }
    return c.json({ success: false, error: '색상 저장 실패' }, 500);
  }
});

/**
 * GET /api/products/search/popular
 * 인기 검색어 목록 (/api/search/popular 는 worker/index.ts에서 이 경로로 alias 등록됨)
 */
productsRoutes.get('/search/popular', cors(), async (c) => {
  const { DB, SESSION_KV } = c.env;
  try {
    // ✅ PERF: KV cache 10분 — 검색창 keystroke 마다 D1 hit 방지
    const data = await cacheGet(
      SESSION_KV,
      'popular-searches',
      async () => {
        const result = await DB.prepare(`
          SELECT keyword, search_count
          FROM popular_searches
          ORDER BY search_count DESC
          LIMIT 10
        `).all().catch(() => ({ results: [] }));
        return result.results || [];
      },
      { ttl: 600 }
    );

    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: true, data: [] });
  }
});

/**
 * GET /api/products/search/suggestions?q=...
 * 검색 자동완성 제안 (/api/search/suggestions 로 프론트에서 호출)
 */
productsRoutes.get('/search/suggestions', cors(), async (c) => {
  // Kill switch: serve empty suggestions during traffic spikes to cut DB load
  const flags = await getFeatureFlags(c.env.SESSION_KV, c.env.DB);
  if (!flags.enable_search_suggestions) {
    return c.json({ success: true, data: [] });
  }

  const { DB } = c.env;
  const q = c.req.query('q') || '';
  if (!q || q.length < 2) return c.json({ success: true, data: [] });
  // Defensive: cap query length to prevent DoS via giant LIKE patterns.
  if (q.length > 200) return c.json({ success: true, data: [] });

  try {
    // 🛡️ 2026-05-19: popular_searches + products.name 통합 자동완성.
    //   1) popular_searches 의 prefix 매칭 (인기순) — 인기 키워드 우선.
    //   2) products.name LIKE (전역) — 부족분 채움.
    //   중복 제거 + 총 10개 cap.
    const popular = await DB.prepare(
      `SELECT keyword FROM popular_searches WHERE keyword LIKE ? ORDER BY search_count DESC LIMIT 6`
    ).bind(`${q}%`).all<{ keyword: string }>().catch(() => ({ results: [] }))
    const productNames = await DB.prepare(
      `SELECT DISTINCT name FROM products WHERE name LIKE ? AND is_active = 1 AND NOT (COALESCE(is_supply_product,0) = 1 AND COALESCE(supply_source_id,0) = 0) ORDER BY sold_count DESC, name ASC LIMIT 10`
    ).bind(`%${q}%`).all<{ name: string }>().catch(() => ({ results: [] }))

    const seen = new Set<string>()
    const merged: string[] = []
    for (const r of (popular.results || [])) {
      if (r.keyword && !seen.has(r.keyword)) { seen.add(r.keyword); merged.push(r.keyword) }
    }
    for (const r of (productNames.results || [])) {
      if (r.name && !seen.has(r.name)) { seen.add(r.name); merged.push(r.name) }
      if (merged.length >= 10) break
    }
    return c.json({ success: true, data: merged.slice(0, 10) });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

// 🛡️ 2026-05-19: alias — /api/search/suggestions 와 /api/search/popular 호출 매칭.
//   worker/index.ts:813 의 app.route('/api/search', featureProductsRoutes) 로 인해
//   '/search/suggestions' 는 /api/search/search/suggestions 가 됨 (불일치).
//   같은 handler 를 '/suggestions' 와 '/popular' 에 추가 등록하여 /api/search/* 매칭 보장.
productsRoutes.get('/suggestions', cors(), async (c) => {
  const flags = await getFeatureFlags(c.env.SESSION_KV, c.env.DB);
  if (!flags.enable_search_suggestions) return c.json({ success: true, data: [] });
  const { DB } = c.env;
  const q = c.req.query('q') || '';
  if (!q || q.length < 2) return c.json({ success: true, data: [] });
  if (q.length > 200) return c.json({ success: true, data: [] });
  try {
    const result = await DB.prepare(
      `SELECT DISTINCT name as suggestion FROM products
       WHERE name LIKE ? AND is_active = 1
         AND NOT (COALESCE(is_supply_product,0) = 1 AND COALESCE(supply_source_id,0) = 0)
       ORDER BY name ASC LIMIT 10`
    ).bind(`%${q}%`).all().catch(() => ({ results: [] }));
    return c.json({ success: true, data: (result.results || []).map((r: any) => r.suggestion) });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

productsRoutes.get('/popular', cors(), async (c) => {
  const { DB, SESSION_KV } = c.env;
  try {
    const data = await cacheGet(
      SESSION_KV, 'popular-searches',
      async () => {
        const result = await DB.prepare(
          `SELECT keyword, search_count FROM popular_searches ORDER BY search_count DESC LIMIT 10`
        ).all().catch(() => ({ results: [] }));
        return result.results || [];
      },
      { ttl: 600 }
    );
    return c.json({ success: true, data });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

/**
 * GET /api/products
 * 상품 목록 조회
 */
productsRoutes.get('/', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    // Query params 파싱
    // featured=true 이면 어드민이 등록한 ur특가 상품(product_type='featured')만 반환
    const featuredOnly = c.req.query('featured') === 'true';
    // Defensive: cap search string length (200) to prevent giant LIKE DoS.
    // 🛡️ 2026-05-19: 'q' query param 도 허용 (SearchPage / useSearch hook 호환).
    const rawSearch = c.req.query('search') || c.req.query('q');
    const safeSearch = rawSearch && rawSearch.length <= 200 ? rawSearch : undefined;
    const rawSort = c.req.query('sort');
    const allowedSorts = ['newest', 'popular', 'price_low', 'price_high', 'rating', 'ranking', 'discount'] as const;
    const sort = rawSort && (allowedSorts as readonly string[]).includes(rawSort)
      ? (rawSort as typeof allowedSorts[number])
      : undefined;
    const filter: ProductFilter = {
      sellerId: c.req.query('seller_id') ? Number(c.req.query('seller_id')) : undefined,
      category: c.req.query('category'),
      brand: c.req.query('brand'),
      status: c.req.query('status') as 'active' | 'inactive' | undefined,
      search: safeSearch,
      minPrice: c.req.query('min_price') ? Number(c.req.query('min_price')) : undefined,
      maxPrice: c.req.query('max_price') ? Number(c.req.query('max_price')) : undefined,
      productType: featuredOnly ? 'featured' : undefined,
      sort,
      // 🛡️ 2026-05-19: /browse 는 exclude_deal_only=1, /vouchers 는 deal_only=1.
      dealOnly: c.req.query('deal_only') === '1',
      excludeDealOnly: c.req.query('exclude_deal_only') === '1',
    };
    
    const pagination = {
      page: c.req.query('page') ? Number(c.req.query('page')) : 1,
      limit: Math.min(c.req.query('limit') ? Number(c.req.query('limit')) : 20, 500),
    };

    // 🚀 KV cache (60s) — list 변동은 셀러 신규 등록/삭제 시 invalidate (invalidateProductCache)
    //    short TTL 로 무효화 누락 시에도 1분 내 자연 갱신.
    const KV = (c.env as any).SESSION_KV;
    const cacheKey = `products_list:${JSON.stringify({ filter, pagination })}`;
    const result = await cacheGet(KV, cacheKey, async () => {
      const service = new ProductService(DB);
      return await service.getProducts(filter, pagination);
    }, { ttl: 60, staleWhileRevalidate: 30 });

    // 🛡️ 2026-05-19: 검색 로그 + 인기 검색어 자동 갱신 (background, fire-and-forget).
    //   search_logs INSERT + popular_searches UPSERT.
    //   API 응답 지연 안 시키려 await 안 함 (best-effort).
    const resultsCount = Array.isArray(result.data) ? result.data.length : 0
    if (safeSearch) {
      try {
        const { ProductRepository } = await import('../repositories/ProductRepository')
        const repo = new ProductRepository(DB)
        // user_id 우선순위: authenticated user > anonymous null
        void repo.logSearch(null, safeSearch, resultsCount).catch(() => { /* silent */ })
      } catch { /* graceful */ }
    }

    // 🛡️ 2026-05-27 (사용자 보고 — 별점 신규 영구 fix):
    //   list 응답의 review_count=0 상품 → background lazy seed.
    //   이전: daily cron 1회 → 신규 상품 24시간 동안 "신규" 표시.
    //   변경: list fetch 시 즉시 seed trigger. 다음 fetch (60s TTL 후) 부터 별점 반영.
    //   autoSeedFakeReviews 가 idempotent (review_count > 0 면 skip) — 부담 미미.
    //   waitUntil 로 응답 지연 0.
    try {
      const productsData = Array.isArray(result.data) ? (result.data as Array<{ id?: number; review_count?: number }>) : []
      const seedTargetIds = productsData
        .filter(p => Number(p?.review_count || 0) === 0)
        .map(p => Number(p?.id))
        .filter(id => Number.isFinite(id) && id > 0)
      if (seedTargetIds.length > 0 && c.executionCtx) {
        c.executionCtx.waitUntil(
          (async () => {
            try {
              const { autoSeedFakeReviews } = await import('../../../worker/utils/auto-seed-fake-reviews')
              await autoSeedFakeReviews(c.env as unknown as Parameters<typeof autoSeedFakeReviews>[0], seedTargetIds, { seedMin: 5, seedMax: 15 })
            } catch (err) {
              if (typeof console !== 'undefined') console.warn('[products list] lazy seed failed:', String(err))
            }
          })(),
        )
      }
    } catch { /* graceful */ }

    // 🛡️ 2026-05-19: 검색 결과 0 건 + 검색어 있음 → 오타 보정 제안.
    //   popular_searches 와 Levenshtein distance ≤ 2 인 후보 찾아 응답에 동봉.
    //   "혹시 'X' 를 찾으세요?" UX. 일반 list 조회 시는 호출 안 됨.
    let suggested_query: string | null = null
    if (safeSearch && resultsCount === 0) {
      try {
        const popular = await DB.prepare(
          'SELECT keyword FROM popular_searches ORDER BY search_count DESC LIMIT 100'
        ).all<{ keyword: string }>()
        const candidates = (popular.results || []).map(r => r.keyword)
        const { findClosestKeyword } = await import('../../../lib/levenshtein')
        suggested_query = findClosestKeyword(safeSearch, candidates, 2)
      } catch { /* graceful */ }
    }

    // 🛡️ 2026-05-24 (loading P0): 브라우저 + Cloudflare edge HTTP cache.
    //   검색 (safeSearch 있음) / 인증 후 응답이 변하는 case 는 캐시 회피 (private).
    //   일반 목록 (카테고리/페이지) → public.
    // 🛡️ 2026-05-27 (loading P1): Cache-Control / CDN-Cache-Control 분리 — publicCache middleware 동일 패턴.
    //   브라우저 60s (신선도) + CF edge 900s (worker invocation 그대로, 비용 0).
    if (safeSearch) {
      c.header('Cache-Control', 'private, no-cache')
    } else {
      c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
      c.header('CDN-Cache-Control', 'public, max-age=900, stale-while-revalidate=120')
    }
    return c.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      ...(suggested_query ? { suggested_query } : {}),
    });
    
  } catch (error) {
    return safeError(c, error, '상품 목록을 불러오지 못했습니다', '[products]');
  }
});

/**
 * GET /api/products/count
 * 🧭 2026-06-10 (사용자 요청 — 홈 '교환권 더보기 (1/14)' 표시): 필터별 정확한 전체 개수.
 *   list 응답의 total 은 COUNT 제거 최적화(2026-05-30)로 추정치 — 핫패스는 그대로 두고
 *   이 전용 endpoint 만 가끔 COUNT (브라우저 5분 + CF edge 15분 캐시 → 실 COUNT 빈도 미미).
 *   ⚠️ '/:id' 보다 먼저 등록 (라우트 매칭 순서).
 */
productsRoutes.get('/count', cors(), async (c) => {
  const { DB } = c.env;
  try {
    // list(findAll)와 동일 가시성 기준: is_active=1 + 정지 셀러 상품 제외 + 도매 마스터 제외(소비자 비노출).
    const conds = [
      'is_active = 1',
      'NOT EXISTS (SELECT 1 FROM sellers s WHERE s.id = products.seller_id AND s.is_active = 0)',
      'NOT (COALESCE(is_supply_product, 0) = 1 AND COALESCE(supply_source_id, 0) = 0)',
    ];
    const binds: unknown[] = [];
    if (c.req.query('deal_only') === '1') conds.push('deal_only = 1');
    if (c.req.query('exclude_deal_only') === '1') conds.push('COALESCE(deal_only, 0) = 0');
    const cat = c.req.query('category');
    if (cat && cat.length <= 100) { conds.push('category = ?'); binds.push(cat); }
    const brand = c.req.query('brand');
    if (brand && brand.length <= 100) { conds.push('brand_name = ?'); binds.push(brand); }
    const row = await DB.prepare(`SELECT COUNT(*) AS n FROM products WHERE ${conds.join(' AND ')}`)
      .bind(...binds).first<{ n: number }>();
    c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=300');
    c.header('CDN-Cache-Control', 'public, max-age=900, stale-while-revalidate=300');
    return c.json({ success: true, total: row?.n ?? 0 });
  } catch (error) {
    return safeError(c, error, '상품 수 조회 중 오류가 발생했습니다', '[products]');
  }
});

/**
 * GET /api/products/:id/options
 * 상품 옵션 목록 조회 (useProduct.ts, OptionSelectModal.tsx에서 호출)
 */
productsRoutes.get('/:id/options', cors(), async (c) => {
  const { DB } = c.env;
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ success: false, error: 'Invalid product ID' }, 400);

  try {
    const KV = (c.env as any).SESSION_KV;
    const data = await cacheGet(KV, `product_options:${id}`, async () => {
      const result = await DB.prepare(
        `SELECT id, product_id, option_type, option_value, price_adjustment, stock_quantity, created_at
         FROM product_options
         WHERE product_id = ?
         ORDER BY option_type, option_value`
      ).bind(id).all().catch(() => ({ results: [] as unknown[] }));
      return result.results || [];
    }, { ttl: 600 }); // 10분 캐시 — 옵션은 자주 안 바뀜

    return c.json({ success: true, data });
  } catch (err: any) {
    console.error('[Products API] Get options error:', err);
    return c.json({ success: false, error: 'Failed to fetch product options' }, 500);
  }
});

/**
 * GET /api/products/:id
 * 상품 상세 조회
 */
productsRoutes.get('/:id', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const id = Number(c.req.param('id'));
    
    if (isNaN(id)) {
      return c.json({
        success: false,
        error: 'Invalid product ID'
      }, 400);
    }
    
    // 🚀 KV cache (60s) — stock/price 변동은 PUT /:id 에서 invalidateProductCache 호출.
    //    short TTL 로 무효화 누락 시에도 1분 내 자연 갱신.
    const KV = (c.env as any).SESSION_KV;
    const product = await cacheGet(KV, `product_detail:${id}`, async () => {
      // 🧱 2026-06-26 서비스 분리(도매↔유어딜): 도매 원본상품(is_supply_product=1 AND supply_source_id 없음)은
      //   소비자 상품 상세 비노출. findById 는 create/update 와 공유라 WHERE 필터 불가 → 라우트 가드.
      //   컬럼 미존재 env 는 fail-open(.catch null — 그 env 엔 도매 원본 자체가 없음). 404 결과도 캐시됨.
      const sup = await DB.prepare('SELECT is_supply_product, supply_source_id FROM products WHERE id = ?')
        .bind(id).first<{ is_supply_product: number | null; supply_source_id: number | null }>().catch(() => null);
      if (sup && Number(sup.is_supply_product) === 1 && (sup.supply_source_id === null || Number(sup.supply_source_id) === 0)) {
        throw new Error('Product not found');
      }
      const service = new ProductService(DB);
      return await service.getProduct(id);
    }, { ttl: 60, staleWhileRevalidate: 30 });

    return c.json({
      success: true,
      data: product
    });
    
  } catch (error) {
    console.error('[Products API] Get detail error:', error);
    
    if ((error as Error).message === 'Product not found') {
      return c.json({
        success: false,
        error: 'Product not found'
      }, 404);
    }
    
    return safeError(c, error, '상품 처리 중 오류가 발생했습니다', '[products]');
  }
});

/**
 * POST /api/products
 * 상품 생성 (판매자 전용)
 */
productsRoutes.post('/', tightCors(), rateLimit({ action: 'product_create', max: 20, windowSec: 300 }), requireAuth(), async (c) => {
  const { DB } = c.env;

  try {
    // Authorization: admin only (정책: 상품 등록은 어드민 전용.
    // 셀러는 라이브 방송 중 기존 상품을 연결해 판매)
    const user = getCurrentUser(c);
    if (!user || user.type !== 'admin') {
      return c.json({ success: false, error: '어드민 권한이 필요합니다.' }, 403);
    }

    const data: ProductCreateInput = await c.req.json();

    // 필수 필드 검증
    if (!data.name || !data.price || data.stock_quantity === undefined) {
      return c.json({
        success: false,
        error: 'Missing required fields: name, price, stock_quantity'
      }, 400);
    }

    // 숫자 범위 검증 (H10: 음수/초대형/NaN 방지)
    const price = Number(data.price);
    const stock = Number(data.stock_quantity);
    if (!Number.isFinite(price) || price < 0 || price > 100_000_000) {
      return c.json({
        success: false,
        error: '가격은 0~1억원 범위여야 합니다.'
      }, 400);
    }
    if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
      return c.json({
        success: false,
        error: '재고는 0~100만 정수여야 합니다.'
      }, 400);
    }
    data.price = price;
    data.stock_quantity = stock;

    // 🛡️ 2026-04-22: image_url 검증 (javascript:, data:, file://, 내부 IP SSRF 방어)
    if ((data as any).image_url) {
      const imgCheck = validateImageUrl((data as any).image_url);
      if (!imgCheck.valid) {
        return c.json({ success: false, error: `image_url: ${imgCheck.error}` }, 400);
      }
    }
    if ((data as any).thumbnail_url) {
      const thCheck = validateImageUrl((data as any).thumbnail_url);
      if (!thCheck.valid) {
        return c.json({ success: false, error: `thumbnail_url: ${thCheck.error}` }, 400);
      }
    }

    // 어드민 전용 엔드포인트이므로 seller_id 는 요청 body 값을 신뢰 (어드민이 명시)
    // 셀러 상품 등록은 별도 POST /api/seller/products 경로 사용

    const service = new ProductService(DB);
    const product = await service.createProduct(data);

    // 🔄 Edge cache 무효화 — 신규 상품 즉시 목록에 반영
    c.executionCtx.waitUntil(invalidateProductCache(product?.id));

    return c.json({
      success: true,
      data: product
    }, 201);
    
  } catch (error) {
    console.error('[Products API] Create error:', error);
    return safeError(c, error, '상품 처리 중 오류가 발생했습니다', '[products]');
  }
});

/**
 * PUT /api/products/:id
 * 상품 수정 (판매자 전용)
 */
productsRoutes.put('/:id', tightCors(), requireAuth(), async (c) => {
  const { DB } = c.env;

  try {
    // Authorization: admin only (정책: 상품 CRUD 는 어드민 전용)
    const user = getCurrentUser(c);
    if (!user || user.type !== 'admin') {
      return c.json({ success: false, error: '어드민 권한이 필요합니다.' }, 403);
    }

    const id = Number(c.req.param('id'));
    const data: ProductUpdateInput = await c.req.json();

    if (isNaN(id)) {
      return c.json({
        success: false,
        error: 'Invalid product ID'
      }, 400);
    }

    // Ownership check (admins bypass)
    if (user.type !== 'admin') {
      const existing = await DB
        .prepare('SELECT seller_id FROM products WHERE id = ?')
        .bind(id)
        .first<{ seller_id: number }>();
      if (!existing) {
        return c.json({ success: false, error: '상품을 찾을 수 없습니다.' }, 404);
      }
      if (existing.seller_id !== Number(user.id)) {
        return c.json({ success: false, error: '다른 셀러의 상품은 수정할 수 없습니다.' }, 403);
      }
    }

    const service = new ProductService(DB);
    const product = await service.updateProduct(id, data);

    // 🔄 Edge cache 무효화 — 수정된 가격/정보 즉시 반영
    c.executionCtx.waitUntil(invalidateProductCache(id));

    return c.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('[Products API] Update error:', error);
    
    if ((error as Error).message === 'Product not found') {
      return c.json({
        success: false,
        error: 'Product not found'
      }, 404);
    }
    
    return safeError(c, error, '상품 처리 중 오류가 발생했습니다', '[products]');
  }
});

/**
 * DELETE /api/products/:id
 * 상품 삭제 (판매자 전용)
 */
productsRoutes.delete('/:id', tightCors(), requireAuth(), async (c) => {
  const { DB } = c.env;

  try {
    // Authorization: admin only (정책: 상품 CRUD 는 어드민 전용)
    const user = getCurrentUser(c);
    if (!user || user.type !== 'admin') {
      return c.json({ success: false, error: '어드민 권한이 필요합니다.' }, 403);
    }

    const id = Number(c.req.param('id'));

    if (isNaN(id)) {
      return c.json({
        success: false,
        error: 'Invalid product ID'
      }, 400);
    }

    // Ownership check (admins bypass)
    if (user.type !== 'admin') {
      const existing = await DB
        .prepare('SELECT seller_id FROM products WHERE id = ?')
        .bind(id)
        .first<{ seller_id: number }>();
      if (!existing) {
        return c.json({ success: false, error: '상품을 찾을 수 없습니다.' }, 404);
      }
      if (existing.seller_id !== Number(user.id)) {
        return c.json({ success: false, error: '다른 셀러의 상품은 수정할 수 없습니다.' }, 403);
      }
    }

    const service = new ProductService(DB);
    await service.deleteProduct(id);

    // 🔄 Edge cache 무효화 — 삭제된 상품 즉시 목록에서 제거
    c.executionCtx.waitUntil(invalidateProductCache(id));

    return c.json({
      success: true,
      message: 'Product deleted successfully'
    });
    
  } catch (error) {
    console.error('[Products API] Delete error:', error);
    
    if ((error as Error).message === 'Product not found') {
      return c.json({
        success: false,
        error: 'Product not found'
      }, 404);
    }
    
    return safeError(c, error, '상품 처리 중 오류가 발생했습니다', '[products]');
  }
});

export default productsRoutes;
