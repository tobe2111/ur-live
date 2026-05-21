/**
 * 🛡️ 2026-05-19: KT Alpha (기프티쇼) 상품 카탈로그 sync.
 *
 *   매일 03:00 UTC (KST 12:00) 실행:
 *     - GET 0101 listGoods 전체 페이지 순회
 *     - gift_catalog 테이블에 UPSERT (gift_code PK 기준)
 *     - 더 이상 SALE 아닌 상품은 is_active=0 처리
 *     - platform_settings 의 sync 통계 갱신
 *
 *   추가로 0301 비즈머니 잔액도 1회 호출 → 어드민 모니터링.
 *
 *   안전:
 *     - KT_ALPHA_AUTH_CODE 미설정 시 skip
 *     - API 오류 시 catch + 마지막 sync 시각 유지
 *     - 1회 sync 최대 50 페이지 (5000개) — 한도
 */
type Env = {
  DB: D1Database
  KT_ALPHA_AUTH_CODE?: string
  KT_ALPHA_TOKEN_KEY?: string
  KT_ALPHA_AUTH_TOKEN?: string
  KT_ALPHA_DEV_MODE?: string
}

export async function runKtAlphaCatalogSync(env: Env): Promise<{
  synced: number; deactivated: number; balance: number | null; recategorized?: number; error?: string;
}> {
  if (!env.KT_ALPHA_AUTH_CODE) {
    return { synced: 0, deactivated: 0, balance: null, error: 'KT_ALPHA_AUTH_CODE 미설정 — skip' }
  }

  try {
    const { fetchAllGoods, goodsItemToCatalogRow, getBizMoneyBalance } = await import('../utils/giftishow-api')

    // 1. 전체 상품 fetch.
    const allItems = await fetchAllGoods(env, { pageSize: 100, maxPages: 50 })
    const fetchedCodes = new Set<string>()
    let synced = 0

    // 🛡️ 2026-05-19: D1 batch INSERT 로 변경 (24개 페이지/2260개 상품 sync 시 30초 timeout 회피).
    //   sequential await 5-10ms × 2260 = 11-23초 → batch 50개씩 chunk = 약 2-3초.
    const upsertSql = `INSERT INTO gift_catalog (
       gift_code, goods_no, name, brand_code, brand_name, brand_icon_url,
       sale_price, discount_price, real_price, discount_rate,
       image_url_small, image_url_large, desc_image_url,
       goods_type_name, goods_type_detail, category_seq, affiliate_id, affiliate_name,
       valid_period_type, valid_period_days, valid_period_until,
       goods_state, is_active, search_keywords, content, content_add_desc, popular,
       sync_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              datetime('now'), datetime('now'))
     ON CONFLICT(gift_code) DO UPDATE SET
       name = excluded.name, brand_code = excluded.brand_code, brand_name = excluded.brand_name,
       brand_icon_url = excluded.brand_icon_url, sale_price = excluded.sale_price,
       discount_price = excluded.discount_price, real_price = excluded.real_price,
       discount_rate = excluded.discount_rate, image_url_small = excluded.image_url_small,
       image_url_large = excluded.image_url_large, desc_image_url = excluded.desc_image_url,
       goods_type_name = excluded.goods_type_name, goods_type_detail = excluded.goods_type_detail,
       category_seq = excluded.category_seq, affiliate_id = excluded.affiliate_id,
       affiliate_name = excluded.affiliate_name, valid_period_type = excluded.valid_period_type,
       valid_period_days = excluded.valid_period_days, valid_period_until = excluded.valid_period_until,
       goods_state = excluded.goods_state, is_active = excluded.is_active,
       search_keywords = excluded.search_keywords, content = excluded.content,
       content_add_desc = excluded.content_add_desc, popular = excluded.popular,
       sync_at = datetime('now'), updated_at = datetime('now')`

    const BATCH_SIZE = 50
    for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
      const chunk = allItems.slice(i, i + BATCH_SIZE)
      const statements = chunk.map((item) => {
        const row = goodsItemToCatalogRow(item)
        fetchedCodes.add(String(row.gift_code))
        return env.DB.prepare(upsertSql).bind(
          row.gift_code, row.goods_no, row.name, row.brand_code, row.brand_name, row.brand_icon_url,
          row.sale_price, row.discount_price, row.real_price, row.discount_rate,
          row.image_url_small, row.image_url_large, row.desc_image_url,
          row.goods_type_name, row.goods_type_detail, row.category_seq, row.affiliate_id, row.affiliate_name,
          row.valid_period_type, row.valid_period_days, row.valid_period_until,
          row.goods_state, row.is_active, row.search_keywords, row.content, row.content_add_desc, row.popular,
        )
      })
      try {
        await env.DB.batch(statements)
        synced += chunk.length
      } catch (e) {
        // batch 실패 시 개별 시도 (fail-soft).
        for (const stmt of statements) {
          try { await stmt.run(); synced++ } catch { /* skip */ }
        }
        console.error('[kt-alpha sync] batch failed, fell back to individual:', String(e).slice(0, 200))
      }
    }

    // 2. fetch 안 된 row 들은 is_active=0 (단종/일시 중지).
    let deactivated = 0
    if (fetchedCodes.size > 0) {
      // 안전: 한 번에 너무 많은 placeholders 회피 — chunk.
      const allCurrent = await env.DB.prepare(
        'SELECT gift_code FROM gift_catalog WHERE is_active = 1'
      ).all<{ gift_code: string }>().catch(() => ({ results: [] }))

      const toDeactivate = (allCurrent.results || []).filter((r) => !fetchedCodes.has(r.gift_code))
      for (const r of toDeactivate) {
        await env.DB.prepare(
          `UPDATE gift_catalog SET is_active = 0, goods_state = 'SUS', updated_at = datetime('now') WHERE gift_code = ?`
        ).bind(r.gift_code).run().catch(() => { /* noop */ })
        deactivated++
      }
    }

    // 3. 비즈머니 잔액 조회 + 저장.
    let balance: number | null = null
    try {
      const userIdRow = await env.DB.prepare(
        "SELECT value FROM platform_settings WHERE key = 'kt_alpha_user_id'"
      ).first<{ value: string }>()
      if (userIdRow?.value) {
        const bal = await getBizMoneyBalance(env, userIdRow.value)
        balance = bal.balance
        // 🛡️ 2026-05-21: UPSERT — UPDATE 만 쓰면 row 없을 때 silent no-op (사용자 신고 원인).
        await env.DB.prepare(
          `INSERT INTO platform_settings (key, value, updated_at)
           VALUES ('kt_alpha_biz_money_balance', ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
        ).bind(String(balance)).run().catch(() => { /* noop */ })
        await env.DB.prepare(
          `INSERT INTO platform_settings (key, value, updated_at)
           VALUES ('kt_alpha_biz_money_check_at', datetime('now'), datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = datetime('now'), updated_at = datetime('now')`
        ).run().catch(() => { /* noop */ })

        // 🛡️ 2026-05-19: 잔액 부족 알림 — 10만 원 이하 시 어드민에게 dashboard 알림.
        //   중복 방지: 24시간 내 같은 type 발송 안 함.
        if (balance < 100_000) {
          const recentAlert = await env.DB.prepare(
            `SELECT id FROM dashboard_notifications
              WHERE type = 'kt_alpha_balance_low' AND created_at > datetime('now', '-24 hours') LIMIT 1`
          ).first().catch(() => null)
          if (!recentAlert) {
            await env.DB.prepare(
              `INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
               VALUES ('admin', NULL, 'kt_alpha_balance_low', ?, ?, '/admin/kt-alpha', datetime('now'))`
            ).bind(
              `⚠️ KT Alpha 비즈머니 잔액 부족 ₩${balance.toLocaleString()}`,
              `교환권 발송 차단 위험 — 기프티쇼 콘솔에서 충전 필요${balance === 0 ? ' (현재 0원, 즉시 차단됨)' : ''}`,
            ).run().catch(() => { /* table 없으면 silent */ })
          }
        }
      }
    } catch (e) {
      console.error('[kt-alpha balance check]', String(e).slice(0, 200))
    }

    // 4. sync 통계 저장.
    await env.DB.prepare(
      `UPDATE platform_settings SET value = datetime('now'), updated_at = datetime('now') WHERE key = 'kt_alpha_last_sync_at'`
    ).run().catch(() => { /* noop */ })
    await env.DB.prepare(
      `UPDATE platform_settings SET value = ?, updated_at = datetime('now') WHERE key = 'kt_alpha_last_sync_count'`
    ).bind(String(synced)).run().catch(() => { /* noop */ })

    // 🛡️ 2026-05-20: gift_catalog → products.category 자동 동기화 (운영자 액션 자동화).
    //   사용자 요청: "운영자 액션 권장 이거 그냥 너가 해주면 안돼?"
    //   기존: 어드민이 /admin/kt-alpha "카테고리 자동 재분류" 버튼 수동 클릭 필요.
    //   변경: cron 매 sync 시 자동 — UPDATE products SET category = gift_catalog.goods_type_detail
    //         WHERE products.gift_code = gift_catalog.gift_code AND products.category IN ('voucher', '', NULL).
    //   기존 명시 분류 (category != 'voucher') 는 건드리지 않음.
    let recategorized = 0
    try {
      const r = await env.DB.prepare(
        `UPDATE products
            SET category = (
              SELECT goods_type_detail FROM gift_catalog gc
              WHERE gc.gift_code = products.gift_code
                AND gc.goods_type_detail IS NOT NULL
                AND gc.goods_type_detail != ''
            ),
            updated_at = datetime('now')
          WHERE deal_only = 1
            AND COALESCE(category, '') IN ('', 'voucher')
            AND gift_code IS NOT NULL
            AND gift_code IN (SELECT gift_code FROM gift_catalog WHERE goods_type_detail IS NOT NULL AND goods_type_detail != '')`
      ).run().catch(() => null)
      recategorized = (r?.meta?.changes ?? 0) as number
    } catch { /* noop */ }

    if (recategorized > 0) {
      console.info(`[kt-alpha sync] auto-recategorized ${recategorized} products from gift_catalog.goods_type_detail`)
    }

    return { synced, deactivated, balance, recategorized }
  } catch (err) {
    // 🛡️ 2026-05-19: sync 실패 → 어드민 알림 (24h 중복 방지).
    const errMsg = (err as Error).message.slice(0, 200)
    try {
      const recent = await env.DB.prepare(
        `SELECT id FROM dashboard_notifications
          WHERE type = 'kt_alpha_sync_failed' AND created_at > datetime('now', '-24 hours') LIMIT 1`
      ).first().catch(() => null)
      if (!recent) {
        await env.DB.prepare(
          `INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
           VALUES ('admin', NULL, 'kt_alpha_sync_failed', ?, ?, '/admin/kt-alpha', datetime('now'))`
        ).bind(
          '⚠️ KT Alpha 카탈로그 sync 실패',
          `${errMsg} — 어드민 페이지에서 수동 sync 시도 필요`,
        ).run().catch(() => { /* noop */ })
      }
    } catch { /* noop */ }
    return { synced: 0, deactivated: 0, balance: null, error: errMsg }
  }
}
