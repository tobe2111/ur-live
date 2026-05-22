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

const STATUSES = ['active', 'achieved', 'expired', 'all'] as const

const COLS = `
  p.id, p.name, p.price, p.original_price, p.image_url, p.category,
  p.group_buy_current, p.group_buy_target, p.group_buy_status,
  p.group_buy_deadline AS expires_at, p.group_buy_tiers,
  p.discount_rate, p.sold_count, p.avg_rating, p.deal_only,
  p.brand_name, p.brand_icon_url, p.created_at, p.seller_id,
  s.name AS seller_name, s.profile_image AS seller_avatar
`

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

        const r = await DB.prepare(`
          SELECT ${COLS}
          FROM products p
          LEFT JOIN sellers s ON p.seller_id = s.id
          WHERE p.category IN (${placeholders}) AND p.is_active = 1
            AND (p.group_buy_status = ? OR ? = 'all')
          ORDER BY p.created_at DESC
          LIMIT 50
        `).bind(...categories, status, status).all()

        const rows = r.results ?? []
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
