import type { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { safeError } from '../../../../worker/utils/safe-error'

export function registerSettings(r: Hono<{ Bindings: Env }>) {
  // 1. GET /settings
  r.get('/kt-alpha/settings', cors(), async (c) => {
    try {
      const keys = [
        'kt_alpha_api_enabled', 'kt_alpha_dev_mode', 'kt_alpha_markup_pct',
        'kt_alpha_user_id', 'kt_alpha_callback_no',
        'kt_alpha_template_id', 'kt_alpha_banner_id',
        'kt_alpha_consumer_markup_pct', 'kt_alpha_consumer_category', 'kt_alpha_consumer_enabled',
        // 🛡️ 2026-05-24: GET 응답에 admin_seller_id 누락 -> frontend reload 시 빈값 -> 저장이 안 된 것처럼 보임. fix.
        'kt_alpha_admin_seller_id',
        'kt_alpha_biz_money_balance', 'kt_alpha_biz_money_check_at',
        'kt_alpha_last_sync_at', 'kt_alpha_last_sync_count',
      ]
      const placeholders = keys.map(() => '?').join(',')
      const rows = await c.env.DB.prepare(
        `SELECT key, value FROM platform_settings WHERE key IN (${placeholders})`
      ).bind(...keys).all<{ key: string; value: string }>().catch(() => ({ results: [] }))

      const settings: Record<string, string> = {}
      for (const r of (rows.results || [])) settings[r.key] = r.value

      // 카탈로그 통계.
      const catalogCount = await c.env.DB.prepare(
        `SELECT COUNT(*) as total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active FROM gift_catalog`
      ).first<{ total: number; active: number }>().catch(() => ({ total: 0, active: 0 }))

      // 발송 통계 (voucher_orders).
      const sendStats = await c.env.DB.prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
                COALESCE(SUM(total_amount), 0) as total_amount
           FROM voucher_orders WHERE source='kt_alpha'`
      ).first<{ total: number; sent: number; failed: number; total_amount: number }>()
        .catch(() => ({ total: 0, sent: 0, failed: 0, total_amount: 0 }))

      return c.json({
        success: true,
        data: {
          settings,
          catalog: { total: catalogCount?.total || 0, active: catalogCount?.active || 0 },
          send_stats: sendStats || { total: 0, sent: 0, failed: 0, total_amount: 0 },
        },
      })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })

  // 2. PATCH /settings — 어드민이 설정값 갱신.
  r.patch('/kt-alpha/settings', cors(), async (c) => {
    try {
      const body = await c.req.json<Record<string, string | number>>()

      // 화이트리스트.
      const allowed = new Set([
        'kt_alpha_api_enabled', 'kt_alpha_dev_mode',
        'kt_alpha_markup_pct', 'kt_alpha_user_id', 'kt_alpha_callback_no',
        'kt_alpha_template_id', 'kt_alpha_banner_id',
        // 🛡️ 2026-05-19: 소비자 직판 마진 (kt_alpha_consumer_markup_pct).
        'kt_alpha_consumer_markup_pct', 'kt_alpha_consumer_category',
        // 🛡️ 2026-05-24: voucher_orders.seller_id 충족용 — 미설정 시 INSERT 실패 silent skip.
        'kt_alpha_admin_seller_id',
      ])

      let updated = 0
      for (const [key, value] of Object.entries(body)) {
        if (!allowed.has(key)) continue
        // 마진율 범위 검증 — markup_pct (셀러) 와 consumer_markup_pct (소비자) 동일하게 0-50.
        if (key === 'kt_alpha_markup_pct' || key === 'kt_alpha_consumer_markup_pct') {
          const n = Number(value)
          if (!Number.isFinite(n) || n < 0 || n > 100) {
            return c.json({ success: false, error: `${key} 는 0-100 범위` }, 400)
          }
        }
        // dev_mode 검증.
        if (key === 'kt_alpha_dev_mode') {
          if (value !== '0' && value !== '1' && value !== 'Y' && value !== 'N') {
            return c.json({ success: false, error: 'dev_mode 는 0/1 또는 Y/N' }, 400)
          }
        }
        await c.env.DB.prepare(
          `INSERT INTO platform_settings (key, value, updated_at)
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
        ).bind(key, String(value)).run()
        updated++
      }

      return c.json({ success: true, updated })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })

  // 🛡️ 2026-05-27 (사용자 요청 — 가장 이상적): 마진 % 변경 후 기존 상품 가격 일괄 재계산.
  //   marker: kt_alpha_gift_code 가 있는 products (catalog 와 link 된 row).
  //   가격 = gift_catalog.real_price × (1 + kt_alpha_consumer_markup_pct/100)
  //   별도 endpoint — 어드민이 명시 trigger (마진 변경 직후 의도적으로).
  r.post('/kt-alpha/recalc-prices', cors(), async (c) => {
    try {
      const DB = (c.env as { DB: D1Database }).DB
      const settingsRow = await DB.prepare(
        `SELECT value FROM platform_settings WHERE key = 'kt_alpha_consumer_markup_pct'`
      ).first<{ value: string }>().catch(() => null)
      const markupPct = Math.min(100, Math.max(0, Number(settingsRow?.value) || 20))
      const multiplier = 1 + markupPct / 100

      // products.kt_alpha_gift_code = gift_catalog.gift_code 매칭 → real_price × multiplier
      const updateResult = await DB.prepare(`
        UPDATE products
        SET price = CAST(
          (SELECT real_price FROM gift_catalog gc WHERE gc.gift_code = products.kt_alpha_gift_code LIMIT 1) * ?
          AS INTEGER
        ),
        updated_at = datetime('now')
        WHERE kt_alpha_gift_code IS NOT NULL
          AND EXISTS (SELECT 1 FROM gift_catalog gc WHERE gc.gift_code = products.kt_alpha_gift_code)
      `).bind(multiplier).run()

      return c.json({
        success: true,
        updated_count: updateResult.meta?.changes ?? 0,
        markup_pct: markupPct,
        formula: `price = real_price × ${multiplier.toFixed(2)}`,
      })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })

  // 3. POST /sync — 수동 trigger.
  r.post('/kt-alpha/sync', cors(), async (c) => {
    try {
      const env = c.env as unknown as { DB: D1Database; KT_ALPHA_AUTH_CODE?: string; KT_ALPHA_TOKEN_KEY?: string; KT_ALPHA_AUTH_TOKEN?: string; KT_ALPHA_DEV_MODE?: string }
      const { runKtAlphaCatalogSync } = await import('../../../../worker/cron/kt-alpha-catalog-sync')
      const result = await runKtAlphaCatalogSync(env)
      return c.json({ success: true, data: result })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })
}
