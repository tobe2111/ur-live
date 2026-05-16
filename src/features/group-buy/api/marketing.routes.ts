/**
 * 🛡️ 2026-05-16: 셀러 마케팅 (인플루언서 차단) + 인플루언서 정산 API.
 *
 * 셀러 (인증 필요):
 *   GET  /api/seller-marketing/me         — 마케팅 ON/OFF + 차단 목록 + 최근 attributions
 *   POST /api/seller-marketing/toggle     — marketing_enabled ON/OFF
 *   POST /api/seller-marketing/block      — 인플루언서 차단 (reason 필수)
 *   POST /api/seller-marketing/unblock    — 차단 해제
 *
 * 인플루언서 (인증 필요 — 일반 user 로그인):
 *   GET  /api/influencer-settlement/me    — 본인 잔액 + 최근 attributions
 *   PUT  /api/influencer-settlement/me    — 사업자번호 / tax_type / 계좌 정보
 */

import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireSeller, requireAuth } from '@/worker/middleware/auth'
import type { AuthUser } from '@/worker/middleware/auth'

const sellerApp = new Hono<{ Bindings: Env }>()
const influencerApp = new Hono<{ Bindings: Env }>()
const adminApp = new Hono<{ Bindings: Env }>()
const discoverApp = new Hono<{ Bindings: Env }>()

sellerApp.use('*', requireSeller())
influencerApp.use('*', requireAuth())
discoverApp.use('*', requireAuth())  // 일반 user 누구나 인플 = 카탈로그 접근
// adminApp 은 라우터에서 requireAdmin 적용 (worker/index.ts 마운트 시)

function getSellerId(c: { get: (k: string) => unknown }): number {
  return Number((c.get('user') as AuthUser).id)
}

// ───────── 셀러 측 ─────────

sellerApp.get('/me', async (c) => {
  const sellerId = getSellerId(c)
  const DB = c.env.DB
  const seller = await DB.prepare(
    "SELECT COALESCE(marketing_enabled, 1) AS marketing_enabled FROM sellers WHERE id = ?"
  ).bind(sellerId).first<{ marketing_enabled: number }>().catch(() => null)

  const blocked = await DB.prepare(
    `SELECT influencer_id, reason, blocked_at
     FROM seller_blocked_influencers
     WHERE seller_id = ? AND unblocked_at IS NULL
     ORDER BY blocked_at DESC
     LIMIT 100`
  ).bind(sellerId).all().catch(() => ({ results: [] }))

  // 최근 30일 referral attributions
  const recent = await DB.prepare(
    `SELECT influencer_id, COUNT(*) AS count, SUM(commission_amount) AS total_commission
     FROM influencer_attributions
     WHERE seller_id = ? AND created_at >= datetime('now', '-30 days')
     GROUP BY influencer_id
     ORDER BY total_commission DESC
     LIMIT 50`
  ).bind(sellerId).all().catch(() => ({ results: [] }))

  return c.json({
    success: true,
    data: {
      marketing_enabled: Number(seller?.marketing_enabled ?? 1) === 1,
      blocked: blocked.results || [],
      recent: recent.results || [],
    },
  })
})

sellerApp.post('/toggle', async (c) => {
  const sellerId = getSellerId(c)
  const body = await c.req.json<{ enabled: boolean }>().catch(() => ({ enabled: true }))
  const val = body.enabled ? 1 : 0
  try {
    await c.env.DB.prepare("ALTER TABLE sellers ADD COLUMN marketing_enabled INTEGER DEFAULT 1").run()
  } catch { /* exists */ }
  await c.env.DB.prepare("UPDATE sellers SET marketing_enabled = ? WHERE id = ?").bind(val, sellerId).run()
  return c.json({ success: true, marketing_enabled: !!val })
})

sellerApp.post('/block', async (c) => {
  const sellerId = getSellerId(c)
  const body = await c.req.json<{ influencer_id: string; reason: string }>().catch(() => ({ influencer_id: '', reason: '' }))
  const influencerId = String(body.influencer_id || '').trim()
  const reason = String(body.reason || '').trim().slice(0, 200)
  if (!influencerId || !/^[a-zA-Z0-9_\-:]{1,64}$/.test(influencerId)) {
    return c.json({ success: false, error: 'invalid influencer_id' }, 400)
  }
  if (!reason) return c.json({ success: false, error: '차단 사유 필수' }, 400)
  await c.env.DB.prepare(
    `INSERT INTO seller_blocked_influencers (seller_id, influencer_id, reason)
     VALUES (?, ?, ?)
     ON CONFLICT(seller_id, influencer_id) DO UPDATE SET
       reason = excluded.reason, blocked_at = datetime('now'), unblocked_at = NULL`
  ).bind(sellerId, influencerId, reason).run()
  return c.json({ success: true })
})

sellerApp.post('/unblock', async (c) => {
  const sellerId = getSellerId(c)
  const body = await c.req.json<{ influencer_id: string }>().catch(() => ({ influencer_id: '' }))
  const influencerId = String(body.influencer_id || '').trim()
  if (!influencerId) return c.json({ success: false, error: 'invalid' }, 400)
  await c.env.DB.prepare(
    "UPDATE seller_blocked_influencers SET unblocked_at = datetime('now') WHERE seller_id = ? AND influencer_id = ? AND unblocked_at IS NULL"
  ).bind(sellerId, influencerId).run()
  return c.json({ success: true })
})

// ───────── 인플루언서 측 ─────────

influencerApp.get('/me', async (c) => {
  const userId = String((c.get('user') as AuthUser).id)
  const DB = c.env.DB
  const balance = await DB.prepare(
    `SELECT pending_amount, available_amount, total_paid_out,
            business_number, tax_type, bank_name, bank_account, account_holder
     FROM influencer_balances WHERE influencer_id = ?`
  ).bind(userId).first().catch(() => null)

  const recent = await DB.prepare(
    `SELECT id, order_id, product_id, seller_id, commission_amount, status,
            created_at, available_at, paid_at
     FROM influencer_attributions
     WHERE influencer_id = ?
     ORDER BY created_at DESC
     LIMIT 50`
  ).bind(userId).all().catch(() => ({ results: [] }))

  return c.json({
    success: true,
    data: {
      balance: balance || { pending_amount: 0, available_amount: 0, total_paid_out: 0 },
      recent: recent.results || [],
    },
  })
})

influencerApp.put('/me', async (c) => {
  const userId = String((c.get('user') as AuthUser).id)
  const body = await c.req.json<{
    business_number?: string
    tax_type?: 'business_income' | 'other_income' | 'unreported'
    bank_name?: string
    bank_account?: string
    account_holder?: string
    payout_method?: 'cash' | 'deal'
  }>().catch(() => ({}))

  // 사업자번호 형식 (10자리 숫자, 선택)
  if (body.business_number && !/^\d{10}$/.test(body.business_number.replace(/-/g, ''))) {
    return c.json({ success: false, error: '사업자번호는 10자리 숫자' }, 400)
  }
  // tax_type whitelist
  if (body.tax_type && !['business_income', 'other_income', 'unreported'].includes(body.tax_type)) {
    return c.json({ success: false, error: 'invalid tax_type' }, 400)
  }
  // payout_method whitelist
  if (body.payout_method && !['cash', 'deal'].includes(body.payout_method)) {
    return c.json({ success: false, error: 'invalid payout_method' }, 400)
  }
  // 계좌번호 (숫자 + 하이픈만)
  if (body.bank_account && !/^[\d-]{5,30}$/.test(body.bank_account)) {
    return c.json({ success: false, error: '잘못된 계좌번호 형식' }, 400)
  }

  // UPSERT
  const existing = await c.env.DB.prepare("SELECT influencer_id FROM influencer_balances WHERE influencer_id = ?").bind(userId).first().catch(() => null)
  if (!existing) {
    await c.env.DB.prepare(
      `INSERT INTO influencer_balances (influencer_id, business_number, tax_type, bank_name, bank_account, account_holder, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      userId,
      body.business_number || null,
      body.tax_type || 'other_income',
      body.bank_name || null,
      body.bank_account || null,
      body.account_holder || null,
    ).run()
  } else {
    const sets: string[] = []
    const binds: unknown[] = []
    if (body.business_number !== undefined) { sets.push('business_number = ?'); binds.push(body.business_number || null) }
    if (body.tax_type !== undefined) { sets.push('tax_type = ?'); binds.push(body.tax_type) }
    if (body.bank_name !== undefined) { sets.push('bank_name = ?'); binds.push(body.bank_name || null) }
    if (body.bank_account !== undefined) { sets.push('bank_account = ?'); binds.push(body.bank_account || null) }
    if (body.account_holder !== undefined) { sets.push('account_holder = ?'); binds.push(body.account_holder || null) }
    if (body.payout_method !== undefined) { sets.push('payout_method = ?'); binds.push(body.payout_method) }
    if (sets.length === 0) return c.json({ success: false, error: 'nothing to update' }, 400)
    sets.push("updated_at = datetime('now')")
    binds.push(userId)
    await c.env.DB.prepare(`UPDATE influencer_balances SET ${sets.join(', ')} WHERE influencer_id = ?`).bind(...binds).run()
  }
  return c.json({ success: true })
})

// ───────── 어드민 — 인플 송금 처리 ─────────

adminApp.get('/payouts', async (c) => {
  const DB = c.env.DB
  // 송금 대기: available_amount >= minimum
  const minRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'influencer_payout_min'").first<{ value: string }>().catch(() => null)
  const payoutMin = Number(minRow?.value ?? 100000)
  const { results } = await DB.prepare(
    `SELECT influencer_id, available_amount, total_paid_out, payout_method,
            business_number, tax_type, bank_name, bank_account, account_holder, updated_at
     FROM influencer_balances
     WHERE available_amount >= ?
     ORDER BY available_amount DESC
     LIMIT 200`
  ).bind(payoutMin).all().catch(() => ({ results: [] as any[] }))
  return c.json({ success: true, data: { payout_min: payoutMin, list: results || [] } })
})

adminApp.post('/payouts/process', async (c) => {
  const body = await c.req.json<{ influencer_id: string; method: 'cash' | 'deal'; net_amount?: number }>().catch(() => ({ influencer_id: '', method: 'cash' as const, net_amount: undefined }))
  const influencerId = String(body.influencer_id || '').trim()
  if (!influencerId) return c.json({ success: false, error: 'invalid' }, 400)
  const DB = c.env.DB
  const balance = await DB.prepare(
    "SELECT available_amount FROM influencer_balances WHERE influencer_id = ?"
  ).bind(influencerId).first<{ available_amount: number }>().catch(() => null)
  if (!balance || balance.available_amount <= 0) return c.json({ success: false, error: '잔액 없음' }, 400)
  const amount = balance.available_amount

  if (body.method === 'deal') {
    // 딜 보너스 % 적용
    const bonusRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'influencer_deal_bonus_pct'").first<{ value: string }>().catch(() => null)
    const bonusPct = Number(bonusRow?.value ?? 20)
    const dealAmount = Math.floor(amount * (100 + bonusPct) / 100)
    try { await DB.prepare("CREATE TABLE IF NOT EXISTS user_points (user_id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run() } catch {}
    await DB.prepare(
      `INSERT INTO user_points (user_id, balance, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?, updated_at = datetime('now')`
    ).bind(influencerId, dealAmount, dealAmount).run().catch(() => {})
    await DB.prepare(
      `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description)
       VALUES (?, 'influencer_payout', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?)`
    ).bind(influencerId, dealAmount, dealAmount, influencerId, `인플 정산 (딜 +${bonusPct}% 보너스)`).run().catch(() => {})
  }
  // 둘 다 — balance 차감 + total_paid_out 누적 + attribution paid 처리
  await c.env.DB.prepare(
    `UPDATE influencer_balances SET available_amount = 0, total_paid_out = total_paid_out + ?, updated_at = datetime('now') WHERE influencer_id = ?`
  ).bind(amount, influencerId).run()
  await c.env.DB.prepare(
    `UPDATE influencer_attributions SET status = 'paid', paid_at = datetime('now')
     WHERE influencer_id = ? AND status = 'available' AND paid_at IS NULL`
  ).bind(influencerId).run()
  return c.json({ success: true, amount })
})

// ───────── 카탈로그 (인플이 ?ref= 링크 생성) ─────────

discoverApp.get('/products', async (c) => {
  const DB = c.env.DB
  const cat = c.req.query('category') || 'all'
  const validCats = ['meal_voucher','beauty_voucher','health_voucher','pet_voucher','stay_voucher','activity_voucher']
  const placeholders = cat === 'all' ? validCats.map(() => '?').join(',') : '?'
  const params = cat === 'all' ? validCats : [cat]
  const { results } = await DB.prepare(
    `SELECT p.id, p.name, p.price, p.original_price, p.image_url, p.category,
            p.group_buy_target, p.group_buy_current, p.group_buy_deadline, p.group_buy_status,
            p.restaurant_name, COALESCE(p.referral_disabled, 0) AS referral_disabled,
            s.name AS seller_name, COALESCE(s.marketing_enabled, 1) AS marketing_enabled
     FROM products p
     LEFT JOIN sellers s ON s.id = p.seller_id
     WHERE p.category IN (${placeholders}) AND p.is_active = 1
       AND p.group_buy_status = 'active'
     ORDER BY p.created_at DESC LIMIT 100`
  ).bind(...params).all().catch(() => ({ results: [] as any[] }))
  // 인플 referral 가능한 것만 (marketing_enabled = 1, referral_disabled = 0)
  const eligible = (results || []).filter((r: { marketing_enabled?: number; referral_disabled?: number }) =>
    Number(r.marketing_enabled ?? 1) === 1 && Number(r.referral_disabled ?? 0) === 0
  )
  return c.json({ success: true, data: eligible })
})

export { sellerApp as sellerMarketingRoutes, influencerApp as influencerSettlementRoutes, adminApp as adminPayoutRoutes, discoverApp as influencerDiscoverRoutes }
