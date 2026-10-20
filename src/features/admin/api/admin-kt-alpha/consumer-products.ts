import type { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { safeError } from '../../../../worker/utils/safe-error'

export function registerConsumerProducts(r: Hono<{ Bindings: Env }>) {
  // 7. PATCH /kt-alpha/consumer-products/visibility — 전체 노출 ON/OFF 토글.
  r.patch('/kt-alpha/consumer-products/visibility', cors(), async (c) => {
    try {
      type Body = { enabled?: boolean | number }
      const body = await c.req.json<Body>().catch(() => ({} as Body))
      const enabled = body?.enabled ? 1 : 0
      await c.env.DB.prepare(
        `UPDATE products SET is_active = ?, updated_at = datetime('now')
         WHERE kt_alpha_gift_code IS NOT NULL`
      ).bind(enabled).run()
      await c.env.DB.prepare(
        `INSERT INTO platform_settings (key, value, updated_at) VALUES ('kt_alpha_consumer_enabled', ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).bind(String(enabled)).run()
      return c.json({ success: true, data: { enabled } })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })

  // 8. GET /kt-alpha/consumer-products/stats — import 통계.
  r.get('/kt-alpha/consumer-products/stats', cors(), async (c) => {
    try {
      const stats = await c.env.DB.prepare(
        `SELECT COUNT(*) as total,
                COALESCE(SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END), 0) as visible,
                COALESCE(SUM(sold_count), 0) as total_sold,
                COALESCE(AVG(price), 0) as avg_price,
                COALESCE(MIN(price), 0) as min_price,
                COALESCE(MAX(price), 0) as max_price
           FROM products WHERE kt_alpha_gift_code IS NOT NULL`
      ).first<{ total: number; visible: number; total_sold: number; avg_price: number; min_price: number; max_price: number }>()
        .catch(() => null)

      const lastImport = await c.env.DB.prepare(
        `SELECT value FROM platform_settings WHERE key = 'kt_alpha_last_import_at'`
      ).first<{ value: string }>().catch(() => null)

      return c.json({
        success: true,
        data: {
          stats: stats || { total: 0, visible: 0, total_sold: 0, avg_price: 0, min_price: 0, max_price: 0 },
          last_import_at: lastImport?.value || null,
        },
      })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })
}
