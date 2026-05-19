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
adminKtAlphaRoutes.post('/kt-alpha/bulk-import', cors(), async (c) => {
  try {
    type Body = { dry_run?: boolean; limit?: number; brand_code?: string }
    const body = await c.req.json<Body>().catch(() => ({} as Body))
    const dryRun = Boolean(body?.dry_run)
    const limit = Math.min(5000, Math.max(1, Number(body?.limit) || 5000))

    // 1. settings 로드.
    const settings = await c.env.DB.prepare(
      `SELECT key, value FROM platform_settings WHERE key IN
       ('kt_alpha_consumer_markup_pct', 'kt_alpha_admin_seller_id', 'kt_alpha_consumer_category', 'kt_alpha_consumer_enabled')`
    ).all<{ key: string; value: string }>().catch(() => ({ results: [] }))
    const sMap: Record<string, string> = {}
    for (const r of (settings.results || [])) sMap[r.key] = r.value

    const markupPct = Math.min(100, Math.max(0, Number(sMap.kt_alpha_consumer_markup_pct) || 20))
    const adminSellerId = Number(sMap.kt_alpha_admin_seller_id) || null
    const category = sMap.kt_alpha_consumer_category || 'voucher'
    const isActive = Number(sMap.kt_alpha_consumer_enabled) || 0   // 노출 ON/OFF 글로벌 flag

    // 2. gift_catalog 활성 row 조회.
    let sql = `SELECT gift_code, name, brand_name, real_price, sale_price,
                      image_url_small, image_url_large, desc_image_url,
                      content, content_add_desc, valid_period_type, valid_period_days,
                      goods_type_detail
                 FROM gift_catalog
                WHERE is_active = 1 AND goods_state = 'SALE'`
    const params: unknown[] = []
    if (body?.brand_code) { sql += ' AND brand_code = ?'; params.push(body.brand_code) }
    sql += ' ORDER BY popular ASC, sale_price ASC LIMIT ?'
    params.push(limit)
    const rows = await c.env.DB.prepare(sql).bind(...params).all<{
      gift_code: string; name: string; brand_name: string | null;
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

    for (const r of (rows.results || [])) {
      const price = Math.floor(r.real_price * (1 + markupPct / 100))
      const description = [
        `[${r.brand_name || '브랜드'}] ${r.name}`,
        r.content || '',
        r.content_add_desc || '',
        r.valid_period_days ? `\n📅 유효기간: ${r.valid_period_days}일 (KT Alpha B2B 정책)` : '',
        '\n⚠️ 본 상품은 본인 명의 휴대폰으로만 발송되며, 발송 후 환불/취소가 불가합니다.',
      ].filter(Boolean).join('\n')

      // 기존 product 있는지 체크.
      const existing = await c.env.DB.prepare(
        'SELECT id FROM products WHERE kt_alpha_gift_code = ?'
      ).bind(r.gift_code).first<{ id: number }>().catch(() => null)

      if (dryRun) {
        samples.push({
          gift_code: r.gift_code, name: r.name, price,
          action: existing ? 'update' : 'insert',
        })
        if (existing) updated++; else inserted++
        continue
      }

      if (existing) {
        await c.env.DB.prepare(
          `UPDATE products SET
             name = ?, description = ?, price = ?, original_price = ?,
             image_url = ?, detail_images = ?, category = ?,
             is_active = ?, deal_only = 1, auto_voucher_send = 1,
             updated_at = datetime('now')
           WHERE id = ?`
        ).bind(
          r.name, description, price, r.sale_price,
          r.image_url_large || r.image_url_small,
          r.desc_image_url ? JSON.stringify([r.desc_image_url]) : null,
          category,
          isActive,
          existing.id,
        ).run().catch(() => { /* per-item fail-soft */ })
        updated++
      } else {
        await c.env.DB.prepare(
          `INSERT INTO products (
             kt_alpha_gift_code, name, description, price, original_price,
             image_url, detail_images, stock, category,
             is_active, deal_only, auto_voucher_send, seller_id,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 999999, ?, ?, 1, 1, ?, datetime('now'), datetime('now'))`
        ).bind(
          r.gift_code, r.name, description, price, r.sale_price,
          r.image_url_large || r.image_url_small,
          r.desc_image_url ? JSON.stringify([r.desc_image_url]) : null,
          category, isActive, adminSellerId,
        ).run().catch(() => { skipped++ })
        inserted++
      }
    }

    // import 통계 저장.
    if (!dryRun) {
      await c.env.DB.prepare(
        `INSERT INTO platform_settings (key, value, updated_at) VALUES ('kt_alpha_last_import_at', datetime('now'), datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).run().catch(() => { /* noop */ })
    }

    return c.json({
      success: true,
      data: {
        dry_run: dryRun,
        inserted, updated, skipped,
        total: inserted + updated,
        markup_pct: markupPct,
        is_active: isActive,
        samples: dryRun ? samples.slice(0, 20) : undefined,
      },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 7. PATCH /kt-alpha/consumer-products/visibility — 전체 노출 ON/OFF 토글.
adminKtAlphaRoutes.patch('/kt-alpha/consumer-products/visibility', cors(), async (c) => {
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
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 8. GET /kt-alpha/consumer-products/stats — import 통계.
adminKtAlphaRoutes.get('/kt-alpha/consumer-products/stats', cors(), async (c) => {
  try {
    const stats = await c.env.DB.prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as visible,
              SUM(sold_count) as total_sold,
              COALESCE(AVG(price), 0) as avg_price,
              MIN(price) as min_price, MAX(price) as max_price
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
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})
