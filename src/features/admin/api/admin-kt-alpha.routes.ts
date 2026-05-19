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
      'kt_alpha_consumer_markup_pct', 'kt_alpha_consumer_category', 'kt_alpha_consumer_enabled',
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
      // 🛡️ 2026-05-19: 소비자 직판 마진 (kt_alpha_consumer_markup_pct).
      'kt_alpha_consumer_markup_pct', 'kt_alpha_consumer_category',
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

// 🛡️ 2026-05-19: 디버그용 — KT Alpha env 변수가 worker 에 어떻게 들어와있는지 확인.
//   값은 노출하지 않고 길이/prefix/dev_mode 만 반환 (어드민만 접근).
adminKtAlphaRoutes.get('/kt-alpha/debug', cors(), async (c) => {
  try {
    const env = c.env as unknown as { KT_ALPHA_AUTH_CODE?: string; KT_ALPHA_TOKEN_KEY?: string; KT_ALPHA_AUTH_TOKEN?: string; KT_ALPHA_DEV_MODE?: string }
    const auth = env.KT_ALPHA_AUTH_CODE || ''
    const tokenKey = env.KT_ALPHA_TOKEN_KEY || ''
    const authToken = env.KT_ALPHA_AUTH_TOKEN || ''
    const devMode = env.KT_ALPHA_DEV_MODE || ''
    // 실제 사용될 dev_yn 값 (giftishow-api.ts:234 와 동일 로직)
    const devYn = devMode === 'N' ? 'N' : 'Y'
    // 🛡️ 2026-05-19: 실제 KT Alpha 에 전송될 custom_auth_token 값 (변경 후 PDF 사양 반영).
    //   PDF v1.04 p.9: "custom_auth_token = Token Key (이미 암호화됨, 고객사는 암호화 필요 없음)"
    const customAuthToken = authToken || tokenKey || ''

    return c.json({
      success: true,
      data: {
        auth_code: {
          length: auth.length,
          prefix4: auth.slice(0, 4),
          suffix4: auth.slice(-4),
          starts_with_REAL: auth.startsWith('REAL'),
          starts_with_DEV: auth.startsWith('DEV'),
          has_whitespace: /\s/.test(auth),
        },
        token_key: {
          length: tokenKey.length,
          ends_with_eq: tokenKey.endsWith('=='),
          has_plus: tokenKey.includes('+'),
          has_space: tokenKey.includes(' '),
          has_whitespace: /\s/.test(tokenKey),
        },
        auth_token_set: authToken.length > 0,
        dev_mode_raw: devMode,
        dev_mode_length: devMode.length,
        dev_mode_charcodes: [...devMode].map(c => c.charCodeAt(0)),
        // 실제 KT Alpha API 에 전송될 값:
        will_send_dev_yn: devYn,
        will_send_dev_yn_explanation:
          devMode === 'N' ? '상용 모드 (REAL 키 호환)' :
          devMode === '' ? '미설정 → default Y (개발 모드, REAL 키와 호환 안 됨)' :
          `잘못된 값 "${devMode}" → default Y (REAL 키와 호환 안 됨)`,
        // 실제 custom_auth_token 으로 전송될 값의 메타.
        custom_auth_token_to_send: {
          length: customAuthToken.length,
          prefix4: customAuthToken.slice(0, 4),
          suffix4: customAuthToken.slice(-4),
          source: authToken ? 'KT_ALPHA_AUTH_TOKEN (override)' : tokenKey ? 'KT_ALPHA_TOKEN_KEY (default)' : 'NONE',
        },
      },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 🛡️ 2026-05-19: 디버그용 — KT Alpha API 한 페이지만 직접 호출 + raw 응답 반환.
//   sync timeout 으로 진짜 에러 확인 불가일 때 사용.
adminKtAlphaRoutes.get('/kt-alpha/debug-call', cors(), async (c) => {
  try {
    const env = c.env as unknown as { DB: D1Database; KT_ALPHA_AUTH_CODE?: string; KT_ALPHA_TOKEN_KEY?: string; KT_ALPHA_AUTH_TOKEN?: string; KT_ALPHA_DEV_MODE?: string }
    if (!env.KT_ALPHA_AUTH_CODE) {
      return c.json({ success: false, error: 'KT_ALPHA_AUTH_CODE 미설정' }, 500)
    }
    const tokenKey = env.KT_ALPHA_AUTH_TOKEN || env.KT_ALPHA_TOKEN_KEY
    if (!tokenKey) {
      return c.json({ success: false, error: 'KT_ALPHA_TOKEN_KEY/AUTH_TOKEN 미설정' }, 500)
    }
    const devYn = env.KT_ALPHA_DEV_MODE === 'N' ? 'N' : 'Y'

    // 0101 listGoods 1 페이지만 호출. start/size 쿼리로 지정 가능.
    const start = c.req.query('start') || '1'
    const size = c.req.query('size') || '5'
    const body = new URLSearchParams()
    body.append('api_code', '0101')
    body.append('custom_auth_code', env.KT_ALPHA_AUTH_CODE)
    body.append('custom_auth_token', tokenKey)
    body.append('dev_yn', devYn)
    body.append('start', start)
    body.append('size', size)

    const startTime = Date.now()
    const res = await fetch('https://bizapi.giftishow.com/bizApi/goods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
    })
    const elapsed = Date.now() - startTime
    const rawText = await res.text()
    let parsed: unknown = null
    try { parsed = JSON.parse(rawText) } catch { /* not JSON */ }

    return c.json({
      success: true,
      data: {
        http_status: res.status,
        http_ok: res.ok,
        elapsed_ms: elapsed,
        request: {
          url: 'https://bizapi.giftishow.com/bizApi/goods',
          method: 'POST',
          body_keys: ['api_code', 'custom_auth_code', 'custom_auth_token', 'dev_yn', 'start', 'size'],
          // 민감값 일부만 노출.
          api_code: '0101',
          custom_auth_code_prefix: env.KT_ALPHA_AUTH_CODE.slice(0, 4) + '...' + env.KT_ALPHA_AUTH_CODE.slice(-4),
          custom_auth_token_prefix: tokenKey.slice(0, 4) + '...' + tokenKey.slice(-4),
          dev_yn: devYn,
          start,
          size,
        },
        response_text: rawText.slice(0, 2000),  // 첫 2000자만
        response_json: parsed,
      },
    })
  } catch (err) {
    return c.json({
      success: false,
      error: (err as Error).message,
      stack: (err as Error).stack?.slice(0, 500),
    }, 500)
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
    type Body = { dry_run?: boolean; limit?: number; offset?: number; brand_code?: string }
    const body = await c.req.json<Body>().catch(() => ({} as Body))
    const dryRun = Boolean(body?.dry_run)
    const limit = Math.min(5000, Math.max(1, Number(body?.limit) || 5000))
    const offset = Math.max(0, Number(body?.offset) || 0)

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
    let sql = `SELECT gift_code, name, brand_name, real_price, sale_price,
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
        r.valid_period_days ? `\n📅 유효기간: ${r.valid_period_days}일 (KT Alpha B2B 정책)` : '',
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

      if (existingId) {
        updateStatements.push(c.env.DB.prepare(
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
          itemCategory, isActive, existingId,
        ))
        updated++
      } else {
        insertStatements.push(c.env.DB.prepare(
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
          itemCategory, isActive, adminSellerId,
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
        // chunked 처리용 메타.
        offset, limit,
        processed_in_this_call: processedCount,
        next_offset: hasMore ? nextOffset : null,
        has_more: hasMore,
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
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 🛡️ 2026-05-19: 9. 카테고리별 KT Alpha 상품 통계.
adminKtAlphaRoutes.get('/kt-alpha/categories', cors(), async (c) => {
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
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 🛡️ 2026-05-19: 10. KT Alpha 상품 삭제 (단건 / 카테고리 / 전체).
//   body: { gift_codes?: string[], category?: string, all?: true }
adminKtAlphaRoutes.post('/kt-alpha/products/delete', cors(), async (c) => {
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
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 🛡️ 2026-05-19: 11. 카테고리 일괄 변경 (rename / merge).
//   body: { from: string, to: string }
adminKtAlphaRoutes.post('/kt-alpha/categories/rename', cors(), async (c) => {
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
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})
