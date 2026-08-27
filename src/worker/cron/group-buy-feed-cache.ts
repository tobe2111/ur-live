/**
 * 🛡️ 2026-05-22: 영구 perf 인프라 — group_buy_feed_cache 자동 갱신 cron.
 *
 * 의도:
 *   현재 (1만명 수준): KV 300s TTL 로 충분 — 이 cron 은 dormant (no-op).
 *   100만명 가시화 시: app 라우트에서 cache 테이블 fallback 활성 → cold-start D1 부하 차단.
 *
 * 동작:
 *   - 5분마다 실행 (wrangler.toml cron 등록 시점에 wire-up)
 *   - 모든 (status, category) 조합에 대해 D1 SELECT → JSON 직렬화 → UPSERT
 *   - 마이그레이션 0277 미적용 시 silent no-op (table 없음)
 *
 * 운영자 액션:
 *   - production D1 에 0277 적용 후, wrangler.toml 에 5분 cron 등록.
 *   - 응답 분기는 future PR (현재 단계는 인프라만 준비).
 */

import type { Env } from '../types/env'
import { swallow } from '../utils/swallow'
import { VOUCHER_CATEGORIES } from '../../shared/constants/voucher-categories'
import { sliceCardGallery } from '../../features/group-buy/api/card-gallery'

const STATUSES = ['active', 'achieved', 'expired', 'all'] as const

/**
 * ⚠️ 이 목록은 라이브 쿼리(`group-buy-public.routes` `buildCols`)와 **같아야 한다.**
 *   두 벌이면 갈린다 — 실제로 갈렸다: `dominant_color` 가 2026-05-28 에 라이브 쿼리에만 들어가고
 *   이 캐시엔 안 들어가서, **홈 기본 피드(=이 캐시가 서빙)에는 그 값이 한 번도 실린 적이 없다.**
 *   그 결과 카드는 매번 canvas 로 대표색을 다시 뽑고(메인스레드 비용) 서버에 다시 보고했다 —
 *   비용은 100% 내고 효과는 0% 였다(라이브 실측: 응답 50건 중 dominant_color 키 자체가 부재).
 */
const dominantColorFrag = (withDominant: boolean) => withDominant ? 'p.dominant_color,' : ''
const buildCols = (withDominant: boolean) => `
  p.id, p.name, p.price, p.original_price, p.image_url, p.category,
  p.group_buy_current, p.group_buy_target, p.group_buy_status,
  p.group_buy_deadline AS expires_at, p.group_buy_tiers,
  p.discount_rate, p.sold_count, p.avg_rating, p.review_count, p.deal_only,
  p.brand_name, p.brand_icon_url, p.created_at, p.seller_id,
  p.restaurant_name, p.restaurant_address, p.slug,
  p.restaurant_lat, p.restaurant_lng, p.images,
  ${dominantColorFrag(withDominant)}
  s.name AS seller_name, s.profile_image AS seller_avatar
`
/** 컬럼 부재 환경(migration 0282 미적용) graceful — 라우트와 동일하게 1회만 판정하고 기억한다. */
let _dominantColorCol: boolean | null = null

export async function handleGroupBuyFeedCache(env: Env): Promise<{
  refreshed: number
  skipped: boolean
}> {
  const DB = env.DB
  if (!DB) return { refreshed: 0, skipped: true }

  // 테이블 존재 확인 — 마이그 0277 미적용 환경 graceful skip
  try {
    const probe = await DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='group_buy_feed_cache' LIMIT 1"
    ).first()
    if (!probe) return { refreshed: 0, skipped: true }
  } catch {
    return { refreshed: 0, skipped: true }
  }

  let refreshed = 0
  const allCategories = ['all', ...VOUCHER_CATEGORIES] as const

  for (const status of STATUSES) {
    for (const categoryParam of allCategories) {
      try {
        const categories = categoryParam === 'all'
          ? (VOUCHER_CATEGORIES as readonly string[])
          : [categoryParam]
        const placeholders = categories.map(() => '?').join(',')

        const runFeed = () => DB.prepare(`
          SELECT ${buildCols(_dominantColorCol !== false)}
          FROM products p
          LEFT JOIN sellers s ON p.seller_id = s.id
          WHERE p.category IN (${placeholders}) AND p.is_active = 1
            AND (p.group_buy_status = ? OR ? = 'all')
            AND NOT (COALESCE(p.is_supply_product,0) = 1 AND COALESCE(p.supply_source_id,0) = 0)
          ORDER BY (CASE WHEN COALESCE(p.slug,'') LIKE 'demo-%' THEN 1 ELSE 0 END), p.created_at DESC
          LIMIT 50
        `).bind(...categories, status, status).all()

        let r
        try {
          r = await runFeed()
          if (_dominantColorCol === null) _dominantColorCol = true
        } catch (e) {
          // `no such column: dominant_color` 면 한 번만 내리고 재시도 — 그 뒤로는 기억해서 안 부딪힌다.
          if (_dominantColorCol !== false && /dominant_color/i.test(String((e as { message?: string })?.message ?? e))) {
            _dominantColorCol = false
            r = await runFeed()
          } else throw e
        }

        // 🖼️ 2026-08-19: 저장 시점에 자른다 — 라이브 쿼리와 **같은 SSOT**(`card-gallery`).
        //   안 자르면 캐시 row 가 원본 전량을 안고, 그 크기를 캐시 hit 마다 파싱한다.
        const rows = (r.results ?? []).map((row) => {
          const p = row as Record<string, unknown>
          const g = sliceCardGallery(p.images, p.image_url)
          return { ...p, images: g.length ? JSON.stringify(g) : null }
        })
        const json = JSON.stringify(rows)

        await DB.prepare(`
          INSERT INTO group_buy_feed_cache (status, category, product_json, row_count, computed_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(status, category) DO UPDATE SET
            product_json = excluded.product_json,
            row_count = excluded.row_count,
            computed_at = excluded.computed_at
        `).bind(status, categoryParam, json, rows.length).run()
          .catch(swallow(`cron:group-buy-feed-cache:upsert:${status}:${categoryParam}`))

        refreshed++
      } catch (e) {
        if ((globalThis as { console?: Console }).console) {
          console.warn(`[cron:group-buy-feed-cache] ${status}/${categoryParam} failed:`, e)
        }
      }
    }
  }

  return { refreshed, skipped: false }
}
