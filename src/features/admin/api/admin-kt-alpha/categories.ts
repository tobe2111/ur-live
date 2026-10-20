import type { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { safeError } from '../../../../worker/utils/safe-error'

export function registerCategories(r: Hono<{ Bindings: Env }>) {
  // 🛡️ 2026-05-19: 9. 카테고리별 KT Alpha 상품 통계.
  r.get('/kt-alpha/categories', cors(), async (c) => {
    try {
      const rows = await c.env.DB.prepare(
        `SELECT COALESCE(category, '(미분류)') as category,
                COUNT(*) as total,
                SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as visible,
                SUM(sold_count) as sold,
                COALESCE(MIN(price), 0) as min_price,
                COALESCE(MAX(price), 0) as max_price
           FROM products
          WHERE kt_alpha_gift_code IS NOT NULL
          GROUP BY category
          ORDER BY total DESC`
      ).all<{ category: string; total: number; visible: number; sold: number; min_price: number; max_price: number }>()
        .catch(() => ({ results: [] }))
      return c.json({ success: true, data: rows.results || [] })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })

  // 🛡️ 2026-05-19: 10. KT Alpha 상품 삭제 (단건 / 카테고리 / 전체).
  //   body: { gift_codes?: string[], category?: string, all?: true }
  r.post('/kt-alpha/products/delete', cors(), async (c) => {
    try {
      type Body = { gift_codes?: string[]; category?: string; all?: boolean }
      const body = await c.req.json<Body>().catch(() => ({} as Body))

      if (body?.all === true) {
        const r = await c.env.DB.prepare(
          `DELETE FROM products WHERE kt_alpha_gift_code IS NOT NULL`
        ).run()
        return c.json({ success: true, data: { deleted: r.meta.changes || 0, scope: 'all' } })
      }

      if (body?.category) {
        const r = await c.env.DB.prepare(
          `DELETE FROM products WHERE kt_alpha_gift_code IS NOT NULL AND category = ?`
        ).bind(body.category).run()
        return c.json({ success: true, data: { deleted: r.meta.changes || 0, scope: 'category', category: body.category } })
      }

      if (Array.isArray(body?.gift_codes) && body.gift_codes.length > 0) {
        const codes = body.gift_codes.slice(0, 1000)  // 안전 한도
        const placeholders = codes.map(() => '?').join(',')
        const r = await c.env.DB.prepare(
          `DELETE FROM products WHERE kt_alpha_gift_code IN (${placeholders})`
        ).bind(...codes).run()
        return c.json({ success: true, data: { deleted: r.meta.changes || 0, scope: 'codes', count: codes.length } })
      }

      return c.json({ success: false, error: 'gift_codes / category / all 중 하나 필요' }, 400)
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })

  // 🛡️ 2026-05-19: 11. 카테고리 일괄 변경 (rename / merge).
  //   body: { from: string, to: string }
  r.post('/kt-alpha/categories/rename', cors(), async (c) => {
    try {
      type Body = { from?: string; to?: string }
      const body = await c.req.json<Body>().catch(() => ({} as Body))
      if (!body?.from || !body?.to) {
        return c.json({ success: false, error: 'from + to 필요' }, 400)
      }
      const r = await c.env.DB.prepare(
        `UPDATE products SET category = ?, updated_at = datetime('now')
          WHERE kt_alpha_gift_code IS NOT NULL AND category = ?`
      ).bind(body.to, body.from).run()
      return c.json({ success: true, data: { updated: r.meta.changes || 0, from: body.from, to: body.to } })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })

  // 🛡️ 2026-05-19 (사용자 신고: '/vouchers?category=voucher' 만 보임):
  //   원인: bulk-import 시 gift_catalog.goods_type_detail 가 NULL 이면 fallback 'voucher' 사용.
  //   해결: 모든 KT Alpha 상품을 gift_catalog 의 최신 분류 + brand_name 키워드로 재분류.
  //
  //   처리 우선순위:
  //     1) gift_catalog.goods_type_detail (KT Alpha API 가 제공한 소분류 — 정확)
  //     2) gift_catalog.goods_type_name (대분류 fallback)
  //     3) brand_name 키워드 매칭 (예: '스타벅스' → '카페/베이커리')
  //     4) (기타) 미분류 그대로 유지
  r.post('/kt-alpha/categories/auto-classify', cors(), async (c) => {
    const DB = c.env.DB

    // 브랜드 키워드 → 카테고리 매핑 (KT Alpha 표준명 기준).
    const BRAND_TO_CATEGORY: Array<[RegExp, string]> = [
      [/스타벅스|이디야|투썸|커피빈|할리스|폴바셋|엔젤리너스|파스쿠찌|커피|coffee|cafe/i, '카페/베이커리'],
      [/파리바게뜨|뚜레쥬르|던킨|크리스피크림|배스킨라빈스|bake/i, '카페/베이커리'],
      [/GS25|CU|세븐일레븐|이마트24|미니스톱|convenience/i, '편의점/마트'],
      [/이마트|홈플러스|롯데마트|코스트코|mart/i, '편의점/마트'],
      [/롯데백화점|신세계|현대백화점|갤러리아|AK플라자|department/i, '백화점/쇼핑'],
      [/올리브영|아리따움|이니스프리|에뛰드|뷰티|cosmetic|beauty/i, '뷰티/패션'],
      [/ABC마트|나이키|아디다스|fashion/i, '뷰티/패션'],
      [/교보문고|예스24|알라딘|책|book/i, '도서/문화'],
      [/CGV|롯데시네마|메가박스|영화|movie|cinema/i, '도서/문화'],
      [/도미노|피자헛|미스터피자|피자/i, '외식/배달'],
      [/BHC|BBQ|교촌|굽네|네네|호식이|치킨/i, '외식/배달'],
      [/맥도날드|버거킹|롯데리아|KFC|맘스터치|버거/i, '외식/배달'],
      [/김밥천국|김가네|김밥/i, '외식/배달'],
      [/배달의민족|배민|쿠팡이츠|요기요/i, '외식/배달'],
      [/SK주유소|GS칼텍스|S-OIL|현대오일뱅크|주유/i, '주유/생활'],
      [/컬쳐랜드|해피머니|구글플레이|넷플릭스|모바일|digital/i, '모바일/디지털'],
    ]

    function classifyByBrand(brand: string | null): string | null {
      if (!brand) return null
      for (const [re, cat] of BRAND_TO_CATEGORY) {
        if (re.test(brand)) return cat
      }
      return null
    }

    try {
      // 🛡️ 2026-05-21: production 에서 kt_alpha_gift_code 미populated 인 voucher 상품 다수 발견 →
      //   WHERE 절 완화: deal_only=1 인 모든 상품 + brand_name + name 으로도 매칭 가능하게.
      //   분류 순서: gift_catalog.goods_type_detail → goods_type_name → brand_name keyword → product name keyword.
      const rows = await DB.prepare(`
        SELECT p.id, p.name AS product_name, p.brand_name, p.category AS current_category,
               gc.goods_type_detail, gc.goods_type_name
        FROM products p
        LEFT JOIN gift_catalog gc ON gc.gift_code = p.kt_alpha_gift_code
        WHERE p.deal_only = 1 AND p.is_active = 1
      `).all<{
        id: number
        product_name: string | null
        brand_name: string | null
        current_category: string | null
        goods_type_detail: string | null
        goods_type_name: string | null
      }>().catch(() => ({ results: [] as Array<{
        id: number
        product_name: string | null
        brand_name: string | null
        current_category: string | null
        goods_type_detail: string | null
        goods_type_name: string | null
      }> }))

      const items = rows.results || []
      const updates: Array<{ id: number; newCategory: string }> = []
      const counts: Record<string, number> = {}
      let unchanged = 0

      for (const it of items) {
        // 🛡️ 2026-05-21: 우선순위 — goods_type_detail > goods_type_name > brand_name > product_name.
        //   brand_name 도 null 이면 product_name 으로 매칭 시도 (gift_code 없는 voucher 대응).
        const fromCatalog = it.goods_type_detail || it.goods_type_name || null
        const fromBrand = classifyByBrand(it.brand_name)
        const fromName = classifyByBrand(it.product_name)
        const newCat = fromCatalog || fromBrand || fromName
        if (!newCat) continue  // 매칭 안 됨 — 그대로 유지
        if (newCat === it.current_category) {
          unchanged++
          continue
        }
        updates.push({ id: it.id, newCategory: newCat })
        counts[newCat] = (counts[newCat] || 0) + 1
      }

      // 일괄 UPDATE — batch (50/chunk).
      let updated = 0
      const BATCH = 50
      for (let i = 0; i < updates.length; i += BATCH) {
        const chunk = updates.slice(i, i + BATCH)
        const stmts = chunk.map(u =>
          DB.prepare(`UPDATE products SET category = ?, updated_at = datetime('now') WHERE id = ?`)
            .bind(u.newCategory, u.id)
        )
        try {
          await DB.batch(stmts)
          updated += chunk.length
        } catch (e) {
          if (import.meta.env?.DEV) console.warn('[auto-classify] batch failed', e)
        }
      }

      return c.json({
        success: true,
        data: {
          total_examined: items.length,
          updated,
          unchanged,
          unmatched: items.length - updated - unchanged,
          by_category: counts,
        },
      })
    } catch (err) {
      if (import.meta.env?.DEV) console.error('[admin:kt-alpha:auto-classify]', err)
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })
}
