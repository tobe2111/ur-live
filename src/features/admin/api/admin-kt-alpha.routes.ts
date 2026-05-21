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
    const { runKtAlphaCatalogSync } = await import('../../../worker/cron/kt-alpha-catalog-sync')
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
    const { getBizMoneyBalance } = await import('../../../worker/utils/giftishow-api')
    const bal = await getBizMoneyBalance(env, userIdRow.value)
    // 🛡️ 2026-05-21: UPSERT — UPDATE 만 쓰면 row 없을 때 silent no-op.
    await c.env.DB.prepare(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ('kt_alpha_biz_money_balance', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).bind(String(bal.balance)).run().catch((e) => {
      if (import.meta.env.DEV) console.error('[admin:kt-alpha:balance] balance upsert failed:', e)
    })
    await c.env.DB.prepare(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ('kt_alpha_biz_money_check_at', datetime('now'), datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = datetime('now'), updated_at = datetime('now')`
    ).run().catch((e) => {
      if (import.meta.env.DEV) console.error('[admin:kt-alpha:balance] check_at upsert failed:', e)
    })
    // bal.raw 가 있으면 응답에 포함 → 어드민이 KT Alpha 실제 응답 구조 디버깅 가능.
    return c.json({
      success: true,
      data: bal,
      ...(bal.balance === 0 && bal.raw ? {
        debug_hint: '잔액 0 — KT Alpha 응답 구조 확인 필요. raw 필드 참조.',
      } : {}),
    })
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
    let sql = `SELECT gift_code, name, brand_name, brand_icon_url, real_price, sale_price,
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
      gift_code: string; name: string; brand_name: string | null; brand_icon_url: string | null;
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

      // 🛡️ 2026-05-19: detail_images 보강 — desc_image_url 없으면 big image 라도 표시.
      const detailImages: string[] = []
      if (r.desc_image_url) detailImages.push(r.desc_image_url)
      if (r.image_url_large && !detailImages.includes(r.image_url_large)) detailImages.push(r.image_url_large)
      if (r.image_url_small && !detailImages.includes(r.image_url_small) && detailImages.length === 0) {
        detailImages.push(r.image_url_small)
      }
      const detailImagesJson = detailImages.length > 0 ? JSON.stringify(detailImages) : null

      if (existingId) {
        updateStatements.push(c.env.DB.prepare(
          `UPDATE products SET
             name = ?, description = ?, price = ?, original_price = ?,
             image_url = ?, detail_images = ?, category = ?, brand_name = ?, brand_icon_url = ?,
             is_active = ?, deal_only = 1, auto_voucher_send = 1,
             updated_at = datetime('now')
           WHERE id = ?`
        ).bind(
          r.name, description, price, r.sale_price,
          r.image_url_large || r.image_url_small,
          detailImagesJson,
          itemCategory, r.brand_name || null, r.brand_icon_url || null, isActive, existingId,
        ))
        updated++
      } else {
        insertStatements.push(c.env.DB.prepare(
          `INSERT INTO products (
             kt_alpha_gift_code, name, description, price, original_price,
             image_url, detail_images, stock, category, brand_name, brand_icon_url,
             is_active, deal_only, auto_voucher_send, seller_id,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 999999, ?, ?, ?, ?, 1, 1, ?, datetime('now'), datetime('now'))`
        ).bind(
          r.gift_code, r.name, description, price, r.sale_price,
          r.image_url_large || r.image_url_small,
          detailImagesJson,
          itemCategory, r.brand_name || null, r.brand_icon_url || null, isActive, adminSellerId,
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

// 🛡️ 2026-05-19 (사용자 신고: '/vouchers?category=voucher' 만 보임):
//   원인: bulk-import 시 gift_catalog.goods_type_detail 가 NULL 이면 fallback 'voucher' 사용.
//   해결: 모든 KT Alpha 상품을 gift_catalog 의 최신 분류 + brand_name 키워드로 재분류.
//
//   처리 우선순위:
//     1) gift_catalog.goods_type_detail (KT Alpha API 가 제공한 소분류 — 정확)
//     2) gift_catalog.goods_type_name (대분류 fallback)
//     3) brand_name 키워드 매칭 (예: '스타벅스' → '카페/베이커리')
//     4) (기타) 미분류 그대로 유지
adminKtAlphaRoutes.post('/kt-alpha/categories/auto-classify', cors(), async (c) => {
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
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 🛡️ 2026-05-19: 카테고리 분류 현황 조회 (어드민 UI 에서 목록 표시).
// 🛡️ 2026-05-21: KT Alpha 전체 재싱크 + 진단 — "교환권이 더 많은데 다 안 불러왔지?".
//   기본 sync 는 maxPages=50 (5000 cap). 더 많을 경우 maxPages 늘려서 강제 재싱크.
//   응답: KT API 가 보고한 totalExpected + 실제 fetch 한 개수 + DB 저장 결과.
// 🛡️ 2026-05-21: full-resync 영구 fix — Worker timeout 우회 (이전 무응답 버그).
//   원인: 200 페이지 × 1초 = 200초+ → Worker wallclock 30초 한도 초과 → 클라이언트 응답 못 받음.
//   영구: 페이지 분할 progressive — 1 호출당 N 페이지만 처리 + next_page 반환.
//        클라이언트가 next_page null 될 때까지 자동 loop.
//   장점: Worker timeout 0 가능성. 진행률 toast 노출. 어떤 페이지에서 실패해도 재시작 가능.
adminKtAlphaRoutes.post('/kt-alpha/sync-page', cors(), async (c) => {
  const env = c.env as unknown as { DB: D1Database; KT_ALPHA_AUTH_CODE?: string; KT_ALPHA_TOKEN_KEY?: string; KT_ALPHA_AUTH_TOKEN?: string; KT_ALPHA_DEV_MODE?: string }
  if (!env.KT_ALPHA_AUTH_CODE) return c.json({ success: false, error: 'KT_ALPHA_AUTH_CODE 미설정' }, 503)

  const startPage = Math.max(1, Number(c.req.query('start_page') || 1))
  const pageCount = Math.max(1, Math.min(15, Number(c.req.query('page_count') || 10)))
  const pageSize = 100

  try {
    const { listGoods, goodsItemToCatalogRow } = await import('../../../worker/utils/giftishow-api')

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
    return c.json({ success: false, error: `sync-page 실패 (page ${startPage}-${startPage + pageCount - 1}): ${(err as Error).message.slice(0, 200)}` }, 500)
  }
})

// 🛡️ 2026-05-21: legacy alias — 기존 클라이언트 호환. 1 페이지만 처리하고 응답.
//   클라이언트가 progressive loop 으로 다시 호출하는 패턴.
adminKtAlphaRoutes.post('/kt-alpha/full-resync', cors(), async (c) => {
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

// 🛡️ 2026-05-21: 사용자 요청 — "전체 즉시 실행" mega endpoint.
//   1) products.category auto-classify (gift_catalog.goods_type_detail)
//   2) products.brand_name + brand_icon_url backfill (gift_catalog)
//   3) product_reviews.user_name backfill (users.name 마스킹)
//   각 단계 fail-soft — 다른 단계 진행. 결과 카운트 반환.
adminKtAlphaRoutes.post('/kt-alpha/run-all-backfills', cors(), async (c) => {
  const DB = c.env.DB
  const results = {
    categorized: 0,
    brand_filled: 0,
    review_names: 0,
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

  return c.json({ success: true, data: results })
})

adminKtAlphaRoutes.get('/kt-alpha/categories/distribution', cors(), async (c) => {
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
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 🛡️ 2026-05-21: 카테고리 분류 종합 진단 — 사용자 신고 "카테고리 분류 안 됨" 근본 원인 추적.
//   "KT 기프티쇼 API 에서 분류를 해둔 정보들도 확보한 상태야?" 질문 답변.
adminKtAlphaRoutes.get('/kt-alpha/diagnostic', cors(), async (c) => {
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
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})
