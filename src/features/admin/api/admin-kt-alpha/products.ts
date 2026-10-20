import type { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { safeError } from '../../../../worker/utils/safe-error'
// 🧹 2026-06-17: description 의 공급사 정책 괄호 제거 — cron(1회 자동) 과 공용 SSOT.
import { cleanupKtAlphaDescriptions } from '../../../../worker/utils/kt-alpha-cleanup'
import { intParam } from '@/shared/pagination'

export function registerProducts(r: Hono<{ Bindings: Env }>) {
  // 🛡️ 2026-05-19: 카테고리 분류 현황 조회 (어드민 UI 에서 목록 표시).
  // 🛡️ 2026-05-21: KT Alpha 전체 재싱크 + 진단 — "교환권이 더 많은데 다 안 불러왔지?".
  //   기본 sync 는 maxPages=50 (5000 cap). 더 많을 경우 maxPages 늘려서 강제 재싱크.
  //   응답: KT API 가 보고한 totalExpected + 실제 fetch 한 개수 + DB 저장 결과.
  // 🛡️ 2026-05-21: full-resync 영구 fix — Worker timeout 우회 (이전 무응답 버그).
  //   원인: 200 페이지 × 1초 = 200초+ → Worker wallclock 30초 한도 초과 → 클라이언트 응답 못 받음.
  //   영구: 페이지 분할 progressive — 1 호출당 N 페이지만 처리 + next_page 반환.
  //        클라이언트가 next_page null 될 때까지 자동 loop.
  //   장점: Worker timeout 0 가능성. 진행률 toast 노출. 어떤 페이지에서 실패해도 재시작 가능.
  r.post('/kt-alpha/sync-page', cors(), async (c) => {
    const env = c.env as unknown as { DB: D1Database; KT_ALPHA_AUTH_CODE?: string; KT_ALPHA_TOKEN_KEY?: string; KT_ALPHA_AUTH_TOKEN?: string; KT_ALPHA_DEV_MODE?: string }
    if (!env.KT_ALPHA_AUTH_CODE) return c.json({ success: false, error: 'KT_ALPHA_AUTH_CODE 미설정' }, 503)

    const startPage = Math.max(1, intParam(c.req.query('start_page'), 1))
    const pageCount = Math.max(1, Math.min(15, intParam(c.req.query('page_count'), 10)))
    const pageSize = 100

    try {
      const { listGoods, goodsItemToCatalogRow } = await import('../../../../worker/utils/giftishow-api')

      // 1) 페이지 범위 fetch (직렬, KT API 가 rate-limit 있을 수 있음).
      type Goods = Parameters<typeof goodsItemToCatalogRow>[0]
      const items: Goods[] = []
      let totalReported = 0
      let emptyReached = false
      for (let p = startPage; p < startPage + pageCount; p++) {
        const start = (p - 1) * pageSize + 1
        const res = await listGoods({ ...env, KT_ALPHA_DEV_MODE: 'N' }, { start, size: pageSize })
        if (p === startPage) totalReported = res.listNum ?? 0
        if (!res.goodsList || res.goodsList.length === 0) { emptyReached = true; break }
        items.push(...res.goodsList)
        if (res.goodsList.length < pageSize) { emptyReached = true; break }
      }

      // 2) DB upsert (batch 50).
      let synced = 0
      if (items.length > 0) {
        const statements = items.map(item => {
          const row = goodsItemToCatalogRow(item)
          return env.DB.prepare(`
            INSERT INTO gift_catalog (
              gift_code, goods_no, name, brand_code, brand_name, brand_icon_url,
              sale_price, discount_price, real_price, discount_rate,
              image_url_small, image_url_large, desc_image_url,
              goods_type_name, goods_type_detail, category_seq,
              affiliate_id, affiliate_name, valid_period_type, valid_period_days,
              goods_state, popular, is_active, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NOR', 0, 1, datetime('now'))
            ON CONFLICT(gift_code) DO UPDATE SET
              name = excluded.name, brand_code = excluded.brand_code, brand_name = excluded.brand_name,
              brand_icon_url = excluded.brand_icon_url, sale_price = excluded.sale_price,
              discount_price = excluded.discount_price, real_price = excluded.real_price,
              discount_rate = excluded.discount_rate, image_url_small = excluded.image_url_small,
              image_url_large = excluded.image_url_large, desc_image_url = excluded.desc_image_url,
              goods_type_name = excluded.goods_type_name, goods_type_detail = excluded.goods_type_detail,
              category_seq = excluded.category_seq, affiliate_id = excluded.affiliate_id,
              affiliate_name = excluded.affiliate_name, valid_period_type = excluded.valid_period_type,
              valid_period_days = excluded.valid_period_days, is_active = 1,
              updated_at = datetime('now')
          `).bind(
            row.gift_code, row.goods_no, row.name, row.brand_code, row.brand_name, row.brand_icon_url,
            row.sale_price, row.discount_price, row.real_price, row.discount_rate,
            row.image_url_small, row.image_url_large, row.desc_image_url,
            row.goods_type_name, row.goods_type_detail, row.category_seq,
            row.affiliate_id, row.affiliate_name, row.valid_period_type, row.valid_period_days,
          )
        })
        for (let i = 0; i < statements.length; i += 50) {
          const chunk = statements.slice(i, i + 50)
          try { await env.DB.batch(chunk); synced += chunk.length }
          catch { for (const s of chunk) { try { await s.run(); synced++ } catch { /* skip */ } } }
        }
      }

      // 3) 다음 페이지 — empty 면 종료, 아니면 다음 페이지 반환.
      const nextPage = emptyReached ? null
        : totalReported > 0
          ? (startPage + pageCount > Math.ceil(totalReported / pageSize) ? null : startPage + pageCount)
          : startPage + pageCount

      return c.json({
        success: true,
        data: {
          processed_pages: pageCount,
          processed_items: items.length,
          db_synced: synced,
          next_page: nextPage,
          total_reported: totalReported,
          done: nextPage === null,
        },
      })
    } catch (err) {
      // 🛡️ 2026-05-30: 내부 에러 메시지(DB/SDK) 클라 노출 차단 — safeError (DEV 에서만 _debug).
      return safeError(c, err, `sync-page 실패 (page ${startPage}-${startPage + pageCount - 1})`, '[kt-alpha]')
    }
  })

  // 🛡️ 2026-05-21: legacy alias — 기존 클라이언트 호환. 1 페이지만 처리하고 응답.
  //   클라이언트가 progressive loop 으로 다시 호출하는 패턴.
  r.post('/kt-alpha/full-resync', cors(), async (c) => {
    // start_page=1, page_count=10 로 위 endpoint 호출 (1차 페이지 처리).
    const url = new URL(c.req.url)
    url.pathname = '/api/admin/kt-alpha/sync-page'
    url.searchParams.set('start_page', '1')
    url.searchParams.set('page_count', '10')
    return c.json({
      success: true,
      data: {
        message: '⚠️ 이 endpoint 는 deprecated. 어드민 UI 의 "📦 전체 재싱크" 버튼을 사용하세요 (자동 progressive loop).',
        use_endpoint: 'POST /api/admin/kt-alpha/sync-page?start_page=N&page_count=10',
      },
    })
  })

  // 🧹 2026-06-17: description 의 공급사 정책 괄호 일괄 제거 (근본 수정 — prod DB 정정).
  r.post('/kt-alpha/cleanup-descriptions', cors(), async (c) => {
    try {
      const cleaned = await cleanupKtAlphaDescriptions(c.env.DB)
      return c.json({ success: true, data: { cleaned, message: `${cleaned}개 상품 설명에서 '(KT Alpha B2B 정책)' 표기를 제거했습니다.` } })
    } catch (err) {
      return safeError(c, err, '설명 정리 중 오류가 발생했습니다', '[kt-alpha-cleanup-desc]')
    }
  })

  // 🛡️ 2026-05-21: 사용자 요청 — "전체 즉시 실행" mega endpoint.
  //   1) products.category auto-classify (gift_catalog.goods_type_detail)
  //   2) products.brand_name + brand_icon_url backfill (gift_catalog)
  //   3) product_reviews.user_name backfill (users.name 마스킹)
  //   각 단계 fail-soft — 다른 단계 진행. 결과 카운트 반환.
  r.post('/kt-alpha/run-all-backfills', cors(), async (c) => {
    const DB = c.env.DB
    const results = {
      categorized: 0,
      brand_filled: 0,
      review_names: 0,
      descriptions_cleaned: 0,
      columns_added: [] as string[],
      errors: [] as string[],
    }

    // 🛡️ 2026-05-21 v2: 사용자 신고 "no such column: brand_name".
    //   원인: production 에 products.brand_name 컬럼 자체가 없음 (repair-schema cron 미실행).
    //   영구 fix: megabutton 자체가 누락 컬럼 ALTER ADD 한 후 UPDATE 실행.
    //   각 ALTER 는 idempotent (catch 처리 — already exists 면 noop).
    const altersToTry: Array<{ desc: string; sql: string }> = [
      { desc: 'products.brand_name', sql: `ALTER TABLE products ADD COLUMN brand_name TEXT` },
      { desc: 'products.brand_icon_url', sql: `ALTER TABLE products ADD COLUMN brand_icon_url TEXT` },
      { desc: 'products.kt_alpha_gift_code', sql: `ALTER TABLE products ADD COLUMN kt_alpha_gift_code TEXT` },
      { desc: 'product_reviews.user_name', sql: `ALTER TABLE product_reviews ADD COLUMN user_name TEXT` },
    ]
    for (const a of altersToTry) {
      try {
        await DB.prepare(a.sql).run()
        results.columns_added.push(a.desc)
      } catch {
        // 이미 존재 — 정상 (silent skip).
      }
    }

    // 1. products.category 자동 분류 (gift_catalog.goods_type_detail).
    try {
      const r = await DB.prepare(
        `UPDATE products
            SET category = (
              SELECT goods_type_detail FROM gift_catalog gc
              WHERE gc.gift_code = products.kt_alpha_gift_code
                AND gc.goods_type_detail IS NOT NULL AND gc.goods_type_detail != ''
            ),
            updated_at = datetime('now')
          WHERE deal_only = 1
            AND COALESCE(category, '') IN ('', 'voucher')
            AND kt_alpha_gift_code IS NOT NULL
            AND kt_alpha_gift_code IN (SELECT gift_code FROM gift_catalog WHERE goods_type_detail IS NOT NULL AND goods_type_detail != '')`
      ).run()
      results.categorized = (r.meta?.changes ?? 0) as number
    } catch (e) { results.errors.push(`categorize: ${(e as Error).message.slice(0, 100)}`) }

    // 2. products.brand_name + brand_icon_url backfill.
    try {
      const r = await DB.prepare(
        `UPDATE products
            SET brand_name = (SELECT brand_name FROM gift_catalog WHERE gift_code = products.kt_alpha_gift_code),
                brand_icon_url = (SELECT brand_icon_url FROM gift_catalog WHERE gift_code = products.kt_alpha_gift_code),
                updated_at = datetime('now')
          WHERE deal_only = 1
            AND (brand_name IS NULL OR brand_name = '')
            AND kt_alpha_gift_code IS NOT NULL
            AND kt_alpha_gift_code IN (SELECT gift_code FROM gift_catalog WHERE brand_name IS NOT NULL AND brand_name != '')`
      ).run()
      results.brand_filled = (r.meta?.changes ?? 0) as number
    } catch (e) { results.errors.push(`brand: ${(e as Error).message.slice(0, 100)}`) }

    // 3. product_reviews.user_name backfill (users.name 마스킹).
    try {
      await DB.prepare(`ALTER TABLE product_reviews ADD COLUMN user_name TEXT`).run().catch(() => null)
      const r = await DB.prepare(`
        UPDATE product_reviews
           SET user_name = (
             SELECT CASE
               WHEN name IS NULL OR name = '' THEN NULL
               WHEN LENGTH(name) = 1 THEN name
               WHEN LENGTH(name) = 2 THEN SUBSTR(name, 1, 1) || '*'
               ELSE SUBSTR(name, 1, 1) || '*' || SUBSTR(name, -1, 1)
             END
             FROM users WHERE id = product_reviews.user_id
           )
         WHERE (user_name IS NULL OR user_name = '')
           AND EXISTS (SELECT 1 FROM users WHERE id = product_reviews.user_id AND name IS NOT NULL AND name != '')
      `).run()
      results.review_names = (r.meta?.changes ?? 0) as number
    } catch (e) { results.errors.push(`reviews: ${(e as Error).message.slice(0, 100)}`) }

    // 4. 🧹 description 의 공급사 정책 괄호 "(KT Alpha B2B 정책)" 일괄 제거.
    try {
      results.descriptions_cleaned = await cleanupKtAlphaDescriptions(DB)
    } catch (e) { results.errors.push(`desc-cleanup: ${(e as Error).message.slice(0, 100)}`) }

    return c.json({ success: true, data: results })
  })
}
