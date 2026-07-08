import type { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { autoSeedFakeReviews } from '../../../../worker/utils/auto-seed-fake-reviews'
import { safeError } from '../../../../worker/utils/safe-error'
import { intParam } from '@/shared/pagination'

export function registerCatalog(r: Hono<{ Bindings: Env }>) {
  // 5. GET /catalog — gift_catalog 조회.
  r.get('/kt-alpha/catalog', cors(), async (c) => {
    try {
      const q = c.req.query('q') || ''
      const brand = c.req.query('brand') || ''
      const limit = Math.min(100, intParam(c.req.query('limit'), 30))
      const offset = Math.max(0, intParam(c.req.query('offset'), 0))

      let sql = `SELECT gift_code, name, brand_name, sale_price, discount_price, real_price,
                        discount_rate, image_url_small, image_url_large, goods_state, is_active,
                        valid_period_type, valid_period_days, valid_period_until,
                        goods_type_detail, popular
                   FROM gift_catalog WHERE 1=1`
      const params: unknown[] = []
      if (q) { sql += ' AND (name LIKE ? OR search_keywords LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
      if (brand) { sql += ' AND brand_code = ?'; params.push(brand) }
      sql += ' ORDER BY is_active DESC, popular ASC, sale_price ASC LIMIT ? OFFSET ?'
      params.push(limit, offset)

      const rows = await c.env.DB.prepare(sql).bind(...params).all<Record<string, unknown>>()
        .catch(() => ({ results: [] }))
      return c.json({ success: true, data: rows.results || [] })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })

  // 🛡️ 2026-05-19: 6. POST /kt-alpha/bulk-import — gift_catalog → products 자동 등록.
  //
  //   동작:
  //     1. gift_catalog active 전체 (is_active=1 AND goods_state='SALE') 조회
  //     2. 이미 link 된 product (kt_alpha_gift_code) 는 가격/이미지/이름만 update
  //     3. 신규 row 는 products INSERT (deal_only=1, auto_voucher_send=1)
  //     4. 가격 = real_price × (1 + consumer_markup_pct/100)
  //
  //   options:
  //     - dry_run=1 → 실제 INSERT 안 하고 계획만 반환
  //     - limit=N → 한 번에 N 개만 (단계적 rollout)
  //     - category_filter → 특정 brand 만 import
  r.post('/kt-alpha/bulk-import', cors(), async (c) => {
    try {
      type Body = {
        dry_run?: boolean; limit?: number; offset?: number; brand_code?: string
        // 🛡️ 2026-05-23: 신규 import 상품에 자동 허위리뷰 시드 (사용자 명령 옵션 B).
        auto_seed_reviews?: boolean    // default true
        seed_min?: number              // 최소 리뷰 수 (default 5)
        seed_max?: number              // 최대 리뷰 수 (default 25)
        seed_rating_min?: number       // 최소 별점 (default 4.3)
        seed_rating_max?: number       // 최대 별점 (default 4.8)
      }
      const body = await c.req.json<Body>().catch(() => ({} as Body))
      const dryRun = Boolean(body?.dry_run)
      const limit = Math.min(5000, Math.max(1, intParam(body?.limit, 5000)))
      const offset = Math.max(0, intParam(body?.offset, 0))
      const autoSeedReviews = body?.auto_seed_reviews !== false   // default true
      const seedMin = Math.max(0, Math.min(100, Number(body?.seed_min) || 5))
      const seedMax = Math.max(seedMin, Math.min(500, Number(body?.seed_max) || 25))
      const seedRatingMin = Math.max(1, Math.min(5, Number(body?.seed_rating_min) || 4.3))
      const seedRatingMax = Math.max(seedRatingMin, Math.min(5, Number(body?.seed_rating_max) || 4.8))

      // 1. settings 로드.
      const settings = await c.env.DB.prepare(
        `SELECT key, value FROM platform_settings WHERE key IN
         ('kt_alpha_consumer_markup_pct', 'kt_alpha_admin_seller_id', 'kt_alpha_consumer_category', 'kt_alpha_consumer_enabled')`
      ).all<{ key: string; value: string }>().catch(() => ({ results: [] }))
      const sMap: Record<string, string> = {}
      for (const r of (settings.results || [])) sMap[r.key] = r.value

      const markupPct = Math.min(100, Math.max(0, Number(sMap.kt_alpha_consumer_markup_pct) || 20))
      const adminSellerId = Number(sMap.kt_alpha_admin_seller_id) || null
      // 🛡️ 2026-05-19: 카테고리 = gift_catalog 의 goods_type_detail (편의점/카페/도서 등) 자동.
      //   설정 (kt_alpha_consumer_category) 는 fallback 으로만 사용.
      const fallbackCategory = sMap.kt_alpha_consumer_category || 'voucher'
      const isActive = Number(sMap.kt_alpha_consumer_enabled) || 0   // 노출 ON/OFF 글로벌 flag

      // 2. gift_catalog 활성 row 조회.
      let sql = `SELECT gift_code, name, brand_name, brand_icon_url, real_price, sale_price,
                        image_url_small, image_url_large, desc_image_url,
                        content, content_add_desc, valid_period_type, valid_period_days,
                        goods_type_detail
                   FROM gift_catalog
                  WHERE is_active = 1 AND goods_state = 'SALE'`
      const params: unknown[] = []
      if (body?.brand_code) { sql += ' AND brand_code = ?'; params.push(body.brand_code) }
      sql += ' ORDER BY popular ASC, sale_price ASC, gift_code ASC LIMIT ? OFFSET ?'
      params.push(limit, offset)
      const rows = await c.env.DB.prepare(sql).bind(...params).all<{
        gift_code: string; name: string; brand_name: string | null; brand_icon_url: string | null;
        real_price: number; sale_price: number;
        image_url_small: string | null; image_url_large: string | null; desc_image_url: string | null;
        content: string | null; content_add_desc: string | null;
        valid_period_type: string | null; valid_period_days: number | null;
        goods_type_detail: string | null;
      }>().catch(() => ({ results: [] }))

      let inserted = 0
      let updated = 0
      let skipped = 0
      const samples: Array<{ gift_code: string; name: string; price: number; action: string }> = []

      // 🛡️ 2026-05-19: 기존 products 미리 한번에 조회 (2260개 × 개별 SELECT 회피).
      const existingMap = new Map<string, number>()
      try {
        const existing = await c.env.DB.prepare(
          'SELECT id, kt_alpha_gift_code FROM products WHERE kt_alpha_gift_code IS NOT NULL'
        ).all<{ id: number; kt_alpha_gift_code: string }>()
        for (const e of (existing.results || [])) {
          existingMap.set(e.kt_alpha_gift_code, e.id)
        }
      } catch { /* fall back to per-item check */ }

      // 모든 SQL 문 미리 생성 → batch 처리.
      type Stmt = D1PreparedStatement
      const updateStatements: Stmt[] = []
      const insertStatements: Stmt[] = []

      for (const r of (rows.results || [])) {
        const price = Math.floor(r.real_price * (1 + markupPct / 100))
        const description = [
          `[${r.brand_name || '브랜드'}] ${r.name}`,
          r.content || '',
          r.content_add_desc || '',
          r.valid_period_days ? `\n📅 유효기간: ${r.valid_period_days}일` : '',
          '\n⚠️ 본 상품은 본인 명의 휴대폰으로만 발송되며, 발송 후 환불/취소가 불가합니다.',
        ].filter(Boolean).join('\n')

        const existingId = existingMap.get(r.gift_code)
        const action: 'update' | 'insert' = existingId ? 'update' : 'insert'

        if (dryRun) {
          if (samples.length < 20) {
            samples.push({ gift_code: r.gift_code, name: r.name, price, action })
          }
          if (action === 'update') updated++; else inserted++
          continue
        }

        // 카테고리 = goods_type_detail (편의점/카페/도서 등) → 없으면 fallback.
        const itemCategory = r.goods_type_detail || fallbackCategory

        // 🛡️ 2026-05-19: detail_images 보강 — desc_image_url 없으면 big image 라도 표시.
        const detailImages: string[] = []
        if (r.desc_image_url) detailImages.push(r.desc_image_url)
        if (r.image_url_large && !detailImages.includes(r.image_url_large)) detailImages.push(r.image_url_large)
        if (r.image_url_small && !detailImages.includes(r.image_url_small) && detailImages.length === 0) {
          detailImages.push(r.image_url_small)
        }
        const detailImagesJson = detailImages.length > 0 ? JSON.stringify(detailImages) : null

        if (existingId) {
          updateStatements.push(c.env.DB.prepare(
            `UPDATE products SET
               name = ?, description = ?, price = ?, original_price = ?,
               image_url = ?, detail_images = ?, category = ?, brand_name = ?, brand_icon_url = ?,
               is_active = ?, deal_only = 1, auto_voucher_send = 1,
               updated_at = datetime('now')
             WHERE id = ?`
          ).bind(
            r.name, description, price, r.sale_price,
            r.image_url_large || r.image_url_small,
            detailImagesJson,
            itemCategory, r.brand_name || null, r.brand_icon_url || null, isActive, existingId,
          ))
          updated++
        } else {
          insertStatements.push(c.env.DB.prepare(
            `INSERT INTO products (
               kt_alpha_gift_code, name, description, price, original_price,
               image_url, detail_images, stock, category, brand_name, brand_icon_url,
               is_active, deal_only, auto_voucher_send, seller_id,
               created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, 999999, ?, ?, ?, ?, 1, 1, ?, datetime('now'), datetime('now'))`
          ).bind(
            r.gift_code, r.name, description, price, r.sale_price,
            r.image_url_large || r.image_url_small,
            detailImagesJson,
            itemCategory, r.brand_name || null, r.brand_icon_url || null, isActive, adminSellerId,
          ))
          inserted++
        }
      }

      // batch 실행 (50개 chunk).
      if (!dryRun) {
        const BATCH = 50
        const allStmts = [...insertStatements, ...updateStatements]
        for (let i = 0; i < allStmts.length; i += BATCH) {
          const chunk = allStmts.slice(i, i + BATCH)
          try {
            await c.env.DB.batch(chunk)
          } catch {
            // fail-soft fallback: 개별 시도.
            for (const stmt of chunk) {
              try { await stmt.run() } catch { skipped++ }
            }
          }
        }
      }

      // import 통계 저장.
      if (!dryRun) {
        await c.env.DB.prepare(
          `INSERT INTO platform_settings (key, value, updated_at) VALUES ('kt_alpha_last_import_at', datetime('now'), datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
        ).run().catch(() => { /* noop */ })
      }

      // 🛡️ 2026-05-24: 자동 허위리뷰 시드 — 공용 util (auto-seed-fake-reviews.ts) 호출.
      //   이전 인라인 구현 (75줄) 을 util 로 추출 → 공구/쇼핑/교환권 동일 로직 공유.
      //   이 import 에서 새로 insert 된 상품의 gift_code 만 대상 (idempotent).
      let seededProducts = 0
      let seededReviews = 0
      if (!dryRun && autoSeedReviews && inserted > 0) {
        try {
          const importedCodes = (rows.results || []).map(r => r.gift_code).filter(Boolean)
          if (importedCodes.length > 0) {
            const ph = importedCodes.map(() => '?').join(',')
            const targetProducts = await c.env.DB.prepare(
              `SELECT id FROM products WHERE kt_alpha_gift_code IN (${ph}) LIMIT 5000`
            ).bind(...importedCodes).all<{ id: number }>().catch(() => ({ results: [] as Array<{ id: number }> }))
            const ids = (targetProducts.results || []).map(r => r.id)
            const seedResult = await autoSeedFakeReviews(c.env, ids, {
              seedMin, seedMax, seedRatingMin, seedRatingMax,
            })
            seededProducts = seedResult.seeded_products
            seededReviews = seedResult.seeded_reviews
          }
        } catch (e) {
          if (typeof console !== 'undefined') console.error('[kt-alpha auto-seed-reviews] failed:', e)
        }
      }

      // 다음 호출에 사용할 offset 계산 (rows.results 개수 < limit 이면 끝).
      const processedCount = (rows.results || []).length
      const hasMore = processedCount === limit
      const nextOffset = offset + processedCount

      return c.json({
        success: true,
        data: {
          dry_run: dryRun,
          inserted, updated, skipped,
          total: inserted + updated,
          markup_pct: markupPct,
          is_active: isActive,
          samples: dryRun ? samples.slice(0, 20) : undefined,
          // 🛡️ 2026-05-23 auto-seed-reviews 결과.
          auto_seed_reviews: autoSeedReviews,
          seeded_products: seededProducts,
          seeded_reviews: seededReviews,
          // chunked 처리용 메타.
          offset, limit,
          processed_in_this_call: processedCount,
          next_offset: hasMore ? nextOffset : null,
          has_more: hasMore,
        },
      })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })
}
