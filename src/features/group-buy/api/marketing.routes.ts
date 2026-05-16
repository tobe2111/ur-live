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

sellerApp.use('*', requireSeller())
influencerApp.use('*', requireAuth())

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
  }>().catch(() => ({}))

  // 사업자번호 형식 (10자리 숫자, 선택)
  if (body.business_number && !/^\d{10}$/.test(body.business_number.replace(/-/g, ''))) {
    return c.json({ success: false, error: '사업자번호는 10자리 숫자' }, 400)
  }
  // tax_type whitelist
  if (body.tax_type && !['business_income', 'other_income', 'unreported'].includes(body.tax_type)) {
    return c.json({ success: false, error: 'invalid tax_type' }, 400)
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
    if (sets.length === 0) return c.json({ success: false, error: 'nothing to update' }, 400)
    sets.push("updated_at = datetime('now')")
    binds.push(userId)
    await c.env.DB.prepare(`UPDATE influencer_balances SET ${sets.join(', ')} WHERE influencer_id = ?`).bind(...binds).run()
  }
  return c.json({ success: true })
})

export { sellerApp as sellerMarketingRoutes, influencerApp as influencerSettlementRoutes }
