import type { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { safeError } from '../../../../worker/utils/safe-error'

export function registerDiagnostics(r: Hono<{ Bindings: Env }>) {
  r.get('/kt-alpha/categories/distribution', cors(), async (c) => {
    try {
      const rows = await c.env.DB.prepare(`
        SELECT COALESCE(category, '(미분류)') as category, COUNT(*) as cnt,
               SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_cnt
        FROM products
        WHERE kt_alpha_gift_code IS NOT NULL AND deal_only = 1
        GROUP BY category
        ORDER BY cnt DESC
      `).all<{ category: string; cnt: number; active_cnt: number }>().catch(() => ({ results: [] }))
      return c.json({ success: true, data: rows.results || [] })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })

  // 🛡️ 2026-05-21: 카테고리 분류 종합 진단 — 사용자 신고 "카테고리 분류 안 됨" 근본 원인 추적.
  //   "KT 기프티쇼 API 에서 분류를 해둔 정보들도 확보한 상태야?" 질문 답변.
  r.get('/kt-alpha/diagnostic', cors(), async (c) => {
    const DB = c.env.DB
    try {
      // 1) gift_catalog row count + goods_type_detail 분포 (KT Alpha API 에서 받은 분류).
      const catalogTotal = await DB.prepare(
        `SELECT COUNT(*) as cnt FROM gift_catalog`
      ).first<{ cnt: number }>().catch(() => null)

      const catalogActive = await DB.prepare(
        `SELECT COUNT(*) as cnt FROM gift_catalog WHERE is_active = 1`
      ).first<{ cnt: number }>().catch(() => null)

      const catalogTypeDist = await DB.prepare(
        `SELECT COALESCE(goods_type_detail, '(NULL)') as goods_type_detail, COUNT(*) as cnt
           FROM gift_catalog
          WHERE is_active = 1
          GROUP BY goods_type_detail
          ORDER BY cnt DESC LIMIT 30`
      ).all<{ goods_type_detail: string; cnt: number }>().catch(() => ({ results: [] }))

      const catalogBrandCount = await DB.prepare(
        `SELECT COUNT(DISTINCT brand_name) as cnt FROM gift_catalog WHERE brand_name IS NOT NULL`
      ).first<{ cnt: number }>().catch(() => null)

      // 2) products (deal_only=1) 분포.
      const productsTotal = await DB.prepare(
        `SELECT COUNT(*) as cnt FROM products WHERE deal_only = 1`
      ).first<{ cnt: number }>().catch(() => null)

      const productsActive = await DB.prepare(
        `SELECT COUNT(*) as cnt FROM products WHERE deal_only = 1 AND is_active = 1`
      ).first<{ cnt: number }>().catch(() => null)

      const productsCategoryDist = await DB.prepare(
        `SELECT COALESCE(category, '(NULL)') as category, COUNT(*) as cnt
           FROM products
          WHERE deal_only = 1 AND is_active = 1
          GROUP BY category
          ORDER BY cnt DESC LIMIT 20`
      ).all<{ category: string; cnt: number }>().catch(() => ({ results: [] }))

      // 3) products → gift_catalog 매칭율 (kt_alpha_gift_code).
      const matched = await DB.prepare(
        `SELECT COUNT(*) as cnt FROM products p
           INNER JOIN gift_catalog gc ON gc.gift_code = p.kt_alpha_gift_code
           WHERE p.deal_only = 1 AND p.is_active = 1`
      ).first<{ cnt: number }>().catch(() => null)

      const unmatched = await DB.prepare(
        `SELECT COUNT(*) as cnt FROM products
           WHERE deal_only = 1 AND is_active = 1
             AND (kt_alpha_gift_code IS NULL OR kt_alpha_gift_code NOT IN (SELECT gift_code FROM gift_catalog))`
      ).first<{ cnt: number }>().catch(() => null)

      // 4) 자동 분류 시 변경될 product 수 추정 (category='voucher' 인 것 중 goods_type_detail 있는 것).
      const wouldClassify = await DB.prepare(
        `SELECT COUNT(*) as cnt FROM products p
           INNER JOIN gift_catalog gc ON gc.gift_code = p.kt_alpha_gift_code
           WHERE p.deal_only = 1 AND p.is_active = 1
             AND COALESCE(p.category, '') IN ('', 'voucher')
             AND gc.goods_type_detail IS NOT NULL AND gc.goods_type_detail != ''`
      ).first<{ cnt: number }>().catch(() => null)

      // 5) brand_name 있는 products 비율 (LIKE 매칭 가능 대상).
      const productsWithBrand = await DB.prepare(
        `SELECT COUNT(*) as cnt FROM products
           WHERE deal_only = 1 AND is_active = 1 AND brand_name IS NOT NULL AND brand_name != ''`
      ).first<{ cnt: number }>().catch(() => null)

      return c.json({
        success: true,
        data: {
          kt_alpha_api: {
            name: 'KT 기프티쇼 (Giftishow)',
            provides_classification: 'goods_type_detail (편의점/카페 등) + goods_type_name (대분류)',
          },
          gift_catalog: {
            total_rows: catalogTotal?.cnt ?? 0,
            active_rows: catalogActive?.cnt ?? 0,
            distinct_brands: catalogBrandCount?.cnt ?? 0,
            goods_type_detail_distribution: catalogTypeDist.results || [],
            note: catalogTotal?.cnt
              ? `✅ ${catalogTotal.cnt}개 catalog row. KT Alpha API 분류 확보됨.`
              : '❌ gift_catalog 비어있음. /admin/kt-alpha "🔄 카탈로그 sync" 먼저 실행 필요.',
          },
          products: {
            total_voucher: productsTotal?.cnt ?? 0,
            active_voucher: productsActive?.cnt ?? 0,
            with_brand_name: productsWithBrand?.cnt ?? 0,
            category_distribution: productsCategoryDist.results || [],
          },
          join_status: {
            matched_to_catalog: matched?.cnt ?? 0,
            unmatched: unmatched?.cnt ?? 0,
            match_rate_pct: (productsActive?.cnt ?? 0) > 0
              ? Math.round(((matched?.cnt ?? 0) / (productsActive?.cnt ?? 1)) * 100)
              : 0,
          },
          auto_classify_preview: {
            would_be_reclassified: wouldClassify?.cnt ?? 0,
            hint: (wouldClassify?.cnt ?? 0) > 0
              ? `✅ "🗂️ 카테고리 자동 재분류" 클릭 시 ${wouldClassify?.cnt}개 reclassify 예상.`
              : (matched?.cnt ?? 0) === 0
              ? '❌ products.kt_alpha_gift_code 가 gift_catalog 와 매칭 안 됨. bulk-import 재실행 필요.'
              : '✅ 이미 모두 분류됨 또는 매칭된 것이 없음.',
          },
          runtime_classification: {
            endpoint: 'GET /api/vouchers/categories',
            strategy: '1) products.category 명시 → 2) gift_catalog JOIN → 3) brand+name LIKE → 4) 기타',
            note: 'auto-classify 실행 안 해도 runtime SQL CASE 로 분류해 표시',
          },
        },
      })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })
}
