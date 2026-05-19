/**
 * 🛡️ 2026-05-19: 어드민 — KT Alpha (기프티쇼) 관리.
 *
 *   GET    /admin/kt-alpha/settings    — 현재 설정 + 잔액 + sync 통계
 *   PATCH  /admin/kt-alpha/settings    — markup_pct / user_id / callback_no / dev_mode 등 설정 갱신
 *   POST   /admin/kt-alpha/sync        — 수동 sync 트리거 (cron 안 기다리고)
 *   POST   /admin/kt-alpha/balance     — 비즈머니 잔액 강제 갱신
 *   GET    /admin/kt-alpha/catalog     — gift_catalog 조회 (필터/페이징)
 *
 *   인증: adminApp.use('*', requireAdmin()) 가 처리.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'

export const adminKtAlphaRoutes = new Hono<{ Bindings: Env }>()

// 1. GET /settings
adminKtAlphaRoutes.get('/kt-alpha/settings', cors(), async (c) => {
  try {
    const keys = [
      'kt_alpha_api_enabled', 'kt_alpha_dev_mode', 'kt_alpha_markup_pct',
      'kt_alpha_user_id', 'kt_alpha_callback_no',
      'kt_alpha_template_id', 'kt_alpha_banner_id',
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
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 2. PATCH /settings — 어드민이 설정값 갱신.
adminKtAlphaRoutes.patch('/kt-alpha/settings', cors(), async (c) => {
  try {
    const body = await c.req.json<Record<string, string | number>>()

    // 화이트리스트.
    const allowed = new Set([
      'kt_alpha_api_enabled', 'kt_alpha_dev_mode',
      'kt_alpha_markup_pct', 'kt_alpha_user_id', 'kt_alpha_callback_no',
      'kt_alpha_template_id', 'kt_alpha_banner_id',
    ])

    let updated = 0
    for (const [key, value] of Object.entries(body)) {
      if (!allowed.has(key)) continue
      // markup_pct 검증.
      if (key === 'kt_alpha_markup_pct') {
        const n = Number(value)
        if (!Number.isFinite(n) || n < 0 || n > 50) {
          return c.json({ success: false, error: 'markup_pct 는 0-50 범위' }, 400)
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
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 3. POST /sync — 수동 trigger.
adminKtAlphaRoutes.post('/kt-alpha/sync', cors(), async (c) => {
  try {
    const env = c.env as unknown as { DB: D1Database; KT_ALPHA_AUTH_CODE?: string; KT_ALPHA_TOKEN_KEY?: string; KT_ALPHA_AUTH_TOKEN?: string; KT_ALPHA_DEV_MODE?: string }
    const { runKtAlphaCatalogSync } = await import('@/worker/cron/kt-alpha-catalog-sync')
    const result = await runKtAlphaCatalogSync(env)
    return c.json({ success: true, data: result })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 4. POST /balance — 비즈머니 잔액 즉시 갱신.
adminKtAlphaRoutes.post('/kt-alpha/balance', cors(), async (c) => {
  try {
    const env = c.env as unknown as { DB: D1Database; KT_ALPHA_AUTH_CODE?: string; KT_ALPHA_TOKEN_KEY?: string; KT_ALPHA_AUTH_TOKEN?: string; KT_ALPHA_DEV_MODE?: string }
    if (!env.KT_ALPHA_AUTH_CODE) {
      return c.json({ success: false, error: 'KT_ALPHA_AUTH_CODE 미설정' }, 503)
    }
    const userIdRow = await c.env.DB.prepare(
      "SELECT value FROM platform_settings WHERE key = 'kt_alpha_user_id'"
    ).first<{ value: string }>()
    if (!userIdRow?.value) {
      return c.json({ success: false, error: 'kt_alpha_user_id 설정 안 됨' }, 400)
    }
    const { getBizMoneyBalance } = await import('@/worker/utils/giftishow-api')
    const bal = await getBizMoneyBalance(env, userIdRow.value)
    await c.env.DB.prepare(
      `UPDATE platform_settings SET value = ?, updated_at = datetime('now') WHERE key = 'kt_alpha_biz_money_balance'`
    ).bind(String(bal.balance)).run().catch(() => { /* noop */ })
    await c.env.DB.prepare(
      `UPDATE platform_settings SET value = datetime('now'), updated_at = datetime('now') WHERE key = 'kt_alpha_biz_money_check_at'`
    ).run().catch(() => { /* noop */ })
    return c.json({ success: true, data: bal })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 5. GET /catalog — gift_catalog 조회.
adminKtAlphaRoutes.get('/kt-alpha/catalog', cors(), async (c) => {
  try {
    const q = c.req.query('q') || ''
    const brand = c.req.query('brand') || ''
    const limit = Math.min(100, Number(c.req.query('limit')) || 30)
    const offset = Math.max(0, Number(c.req.query('offset')) || 0)

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
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})
