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
import { swallow } from '../../../worker/utils/swallow'
import type { Env } from '@/worker/types/env'
import { requireSeller, requireAuth } from '@/worker/middleware/auth'
import type { AuthUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'

// 🛡️ 2026-05-20: Hono `c.get('user'/'seller')` 가 ContextVariableMap 미선언으로 'never' 가 됨.
//   각 미들웨어 (requireAuth/requireSeller) 가 ctx 에 박는 형태를 Variables 로 명시.
type MarketingVars = {
  user?: { id: string | number; email?: string }
  seller?: { id: number; email?: string }
}
const sellerApp = new Hono<{ Bindings: Env; Variables: MarketingVars }>()
const influencerApp = new Hono<{ Bindings: Env; Variables: MarketingVars }>()
const adminApp = new Hono<{ Bindings: Env; Variables: MarketingVars }>()
const discoverApp = new Hono<{ Bindings: Env; Variables: MarketingVars }>()

sellerApp.use('*', requireSeller())
influencerApp.use('*', requireAuth())
discoverApp.use('*', requireAuth())  // 일반 user 누구나 인플 = 카탈로그 접근
// adminApp 은 라우터에서 requireAdmin 적용 (worker/index.ts 마운트 시)

function getSellerId(c: { get: (k: string) => unknown }): number {
  return Number((c.get('user') as AuthUser).id)
}

// ───────── 셀러 측 ─────────

// 🛡️ 2026-05-16: 매장 매출 실시간 대시보드 — 오늘/이번주/이번달 + voucher 사용률 + 인플 referral 비중
sellerApp.get('/realtime-stats', async (c) => {
  const sellerId = getSellerId(c)
  const DB = c.env.DB

  // 1) 매출 (오늘 / 7일 / 30일) — orders 테이블 기반
  const today = await DB.prepare(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS amt
     FROM orders WHERE seller_id = ? AND status = 'PAID'
       AND DATE(created_at) = DATE('now', 'localtime')`
  ).bind(sellerId).first<{ cnt: number; amt: number }>().catch(() => ({ cnt: 0, amt: 0 }))

  const week = await DB.prepare(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS amt
     FROM orders WHERE seller_id = ? AND status = 'PAID'
       AND created_at >= datetime('now', '-7 days')`
  ).bind(sellerId).first<{ cnt: number; amt: number }>().catch(() => ({ cnt: 0, amt: 0 }))

  const month = await DB.prepare(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS amt
     FROM orders WHERE seller_id = ? AND status = 'PAID'
       AND created_at >= datetime('now', '-30 days')`
  ).bind(sellerId).first<{ cnt: number; amt: number }>().catch(() => ({ cnt: 0, amt: 0 }))

  // 2) voucher 사용률 (지난 30일 발급 voucher 중 사용된 비율)
  const voucherStats = await DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN v.status = 'used' THEN 1 ELSE 0 END) AS used,
       SUM(CASE WHEN v.status = 'expired' THEN 1 ELSE 0 END) AS expired,
       SUM(CASE WHEN v.status = 'unused' THEN 1 ELSE 0 END) AS unused
     FROM vouchers v
     JOIN products p ON p.id = v.product_id
     WHERE p.seller_id = ? AND v.created_at >= datetime('now', '-30 days')`
  ).bind(sellerId).first<{ total: number; used: number; expired: number; unused: number }>().catch(() => ({ total: 0, used: 0, expired: 0, unused: 0 }))

  // 3) 인플 referral 매출 비중 (지난 30일)
  const referralStats = await DB.prepare(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(commission_amount), 0) AS total_commission
     FROM influencer_attributions
     WHERE seller_id = ? AND created_at >= datetime('now', '-30 days') AND status != 'clawed_back'`
  ).bind(sellerId).first<{ cnt: number; total_commission: number }>().catch(() => ({ cnt: 0, total_commission: 0 }))

  // 4) 최근 사용 voucher 10개 (실시간 활동 표시)
  const recentUses = await DB.prepare(
    `SELECT v.id, v.code, v.used_at, p.name AS product_name, v.applied_price
     FROM vouchers v
     JOIN products p ON p.id = v.product_id
     WHERE p.seller_id = ? AND v.status = 'used'
     ORDER BY v.used_at DESC LIMIT 10`
  ).bind(sellerId).all().catch(() => ({ results: [] as any[] }))

  // 5) 일별 매출 추세 (지난 14일)
  const daily = await DB.prepare(
    `SELECT DATE(created_at) AS d, COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS amt
     FROM orders WHERE seller_id = ? AND status = 'PAID'
       AND created_at >= datetime('now', '-14 days')
     GROUP BY DATE(created_at) ORDER BY d DESC`
  ).bind(sellerId).all().catch(() => ({ results: [] as any[] }))

  return c.json({
    success: true,
    data: {
      today, week, month,
      voucher_stats: voucherStats,
      referral_stats: referralStats,
      recent_uses: recentUses.results || [],
      daily: daily.results || [],
    },
  })
})

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

// 🛡️ 2026-05-16: 본인 ranking 조회 (지역별 / 전국)
influencerApp.get('/my-rank', async (c) => {
  const userId = String((c.get('user') as AuthUser).id)
  const DB = c.env.DB
  // 이번 달 commission 기준 ranking (단순화)
  try {
    const all = await DB.prepare(
      `SELECT influencer_id, COALESCE(SUM(commission_amount), 0) AS total
       FROM influencer_attributions
       WHERE status != 'clawed_back'
         AND created_at >= datetime('now', 'start of month')
       GROUP BY influencer_id
       ORDER BY total DESC`
    ).all<{ influencer_id: string; total: number }>().catch(() => ({ results: [] as any[] }))
    const rank = (all.results || []).findIndex(r => r.influencer_id === userId) + 1
    const my = (all.results || []).find(r => r.influencer_id === userId)
    return c.json({
      success: true,
      data: {
        national_rank: rank > 0 ? rank : null,
        national_total_participants: (all.results || []).length,
        my_commission: my?.total ?? 0,
      },
    })
  } catch {
    return c.json({ success: false }, 503)
  }
})

influencerApp.put('/me', async (c) => {
  const userId = String((c.get('user') as AuthUser).id)
  // 🛡️ 2026-05-20: `.catch(() => ({}))` 가 T | {} 로 추론되어 모든 필드 접근 시 TS2339.
  //   해결: `({}) as T` 로 단언 → 호출처에서 그대로 destructure.
  type MeBody = {
    business_number?: string
    tax_type?: 'business_income' | 'other_income' | 'unreported'
    bank_name?: string
    bank_account?: string
    account_holder?: string
    payout_method?: 'cash' | 'deal'
    ranking_public?: boolean
  }
  const body = await c.req.json<MeBody>().catch(() => ({} as MeBody))

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
    if (body.ranking_public !== undefined) { sets.push('ranking_public = ?'); binds.push(body.ranking_public ? 1 : 0) }
    if (sets.length === 0) return c.json({ success: false, error: 'nothing to update' }, 400)
    sets.push("updated_at = datetime('now')")
    binds.push(userId)
    await c.env.DB.prepare(`UPDATE influencer_balances SET ${sets.join(', ')} WHERE influencer_id = ?`).bind(...binds).run()
  }
  return c.json({ success: true })
})

// ───────── 매장 ↔ 인플 협업 deal (Phase 2) ─────────

// 매장이 인플에게 우대 commission 제안
sellerApp.post('/deals/propose', async (c) => {
  const sellerId = getSellerId(c)
  const body = await c.req.json<{ influencer_id: string; commission_pct: number; ends_at?: string; message?: string }>().catch(() => ({} as any))
  const influencerId = String(body.influencer_id || '').trim()
  const pct = Number(body.commission_pct)
  if (!influencerId || !/^[a-zA-Z0-9_\-:]{1,64}$/.test(influencerId)) {
    return c.json({ success: false, error: 'invalid influencer_id' }, 400)
  }
  // platform cap 확인
  const capRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'max_influencer_commission_pct'").first<{ value: string }>().catch(() => null)
  const cap = Number(capRow?.value ?? 2)
  if (!Number.isFinite(pct) || pct <= 0 || pct > cap) {
    return c.json({ success: false, error: `commission % 은 0 ~ ${cap} 범위` }, 400)
  }
  await c.env.DB.prepare(
    `INSERT INTO seller_influencer_deals (seller_id, influencer_id, commission_pct, ends_at, status, proposed_by, message)
     VALUES (?, ?, ?, ?, 'proposed', 'seller', ?)
     ON CONFLICT(seller_id, influencer_id) DO UPDATE SET
       commission_pct = excluded.commission_pct,
       ends_at = excluded.ends_at,
       status = 'proposed',
       proposed_by = 'seller',
       message = excluded.message,
       created_at = datetime('now'),
       responded_at = NULL`
  ).bind(sellerId, influencerId, pct, body.ends_at || null, body.message || null).run()
  return c.json({ success: true })
})

sellerApp.get('/deals', async (c) => {
  const sellerId = getSellerId(c)
  const { results } = await c.env.DB.prepare(
    `SELECT id, influencer_id, commission_pct, starts_at, ends_at, status, proposed_by, message, created_at, responded_at
     FROM seller_influencer_deals WHERE seller_id = ?
     ORDER BY created_at DESC LIMIT 100`
  ).bind(sellerId).all().catch(() => ({ results: [] as any[] }))
  return c.json({ success: true, data: results || [] })
})

sellerApp.post('/deals/:id/respond', async (c) => {
  const sellerId = getSellerId(c)
  const dealId = Number(c.req.param('id'))
  const body = await c.req.json<{ action: 'accept' | 'reject' }>().catch(() => ({ action: 'reject' as const }))
  const newStatus = body.action === 'accept' ? 'active' : 'rejected'
  const result = await c.env.DB.prepare(
    `UPDATE seller_influencer_deals SET status = ?, responded_at = datetime('now')
     WHERE id = ? AND seller_id = ? AND status = 'proposed' AND proposed_by = 'influencer'`
  ).bind(newStatus, dealId, sellerId).run()
  if (!result.meta?.changes) return c.json({ success: false, error: 'not found or already responded' }, 404)
  return c.json({ success: true, status: newStatus })
})

// 인플이 매장에 우대 협업 신청
influencerApp.post('/deals/propose', async (c) => {
  const userId = String((c.get('user') as AuthUser).id)
  const body = await c.req.json<{ seller_id: number; commission_pct: number; ends_at?: string; message?: string }>().catch(() => ({} as any))
  const sellerId = Number(body.seller_id)
  const pct = Number(body.commission_pct)
  if (!Number.isFinite(sellerId) || sellerId <= 0) return c.json({ success: false, error: 'invalid seller_id' }, 400)
  const capRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'max_influencer_commission_pct'").first<{ value: string }>().catch(() => null)
  const cap = Number(capRow?.value ?? 2)
  if (!Number.isFinite(pct) || pct <= 0 || pct > cap) return c.json({ success: false, error: `0 ~ ${cap}` }, 400)
  await c.env.DB.prepare(
    `INSERT INTO seller_influencer_deals (seller_id, influencer_id, commission_pct, ends_at, status, proposed_by, message)
     VALUES (?, ?, ?, ?, 'proposed', 'influencer', ?)
     ON CONFLICT(seller_id, influencer_id) DO UPDATE SET
       commission_pct = excluded.commission_pct, ends_at = excluded.ends_at, status = 'proposed', proposed_by = 'influencer',
       message = excluded.message, created_at = datetime('now'), responded_at = NULL`
  ).bind(sellerId, userId, pct, body.ends_at || null, body.message || null).run()
  return c.json({ success: true })
})

// 🛡️ 2026-05-16: 인플루언서 성과표 — referral 매출 / 전환율 / 매장별 ranking / 일별 추세
influencerApp.get('/analytics', async (c) => {
  const userId = String((c.get('user') as AuthUser).id)
  const DB = c.env.DB

  // 1) 총 commission (status 별)
  const summary = await DB.prepare(
    `SELECT
       COUNT(*) AS total_attributions,
       COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) AS pending,
       COALESCE(SUM(CASE WHEN status = 'available' THEN commission_amount ELSE 0 END), 0) AS available,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0) AS paid,
       COALESCE(SUM(CASE WHEN status = 'clawed_back' THEN commission_amount ELSE 0 END), 0) AS clawed_back,
       COALESCE(SUM(commission_amount), 0) AS total
     FROM influencer_attributions WHERE influencer_id = ?`
  ).bind(userId).first().catch(() => null)

  // 2) 매장별 ranking (Top 10)
  const topSellers = await DB.prepare(
    `SELECT a.seller_id, s.name AS seller_name,
            COUNT(*) AS attribution_count,
            COALESCE(SUM(a.commission_amount), 0) AS total_commission
     FROM influencer_attributions a
     LEFT JOIN sellers s ON s.id = a.seller_id
     WHERE a.influencer_id = ? AND a.status != 'clawed_back'
     GROUP BY a.seller_id
     ORDER BY total_commission DESC
     LIMIT 10`
  ).bind(userId).all().catch(() => ({ results: [] as any[] }))

  // 3) 일별 추세 (지난 30일)
  const daily = await DB.prepare(
    `SELECT DATE(created_at) AS d, COUNT(*) AS cnt, COALESCE(SUM(commission_amount), 0) AS amt
     FROM influencer_attributions
     WHERE influencer_id = ? AND created_at >= datetime('now', '-30 days')
     GROUP BY DATE(created_at)
     ORDER BY d DESC`
  ).bind(userId).all().catch(() => ({ results: [] as any[] }))

  // 4) Top product
  const topProducts = await DB.prepare(
    `SELECT a.product_id, p.name AS product_name, p.restaurant_name,
            COUNT(*) AS attribution_count,
            COALESCE(SUM(a.commission_amount), 0) AS total_commission
     FROM influencer_attributions a
     LEFT JOIN products p ON p.id = a.product_id
     WHERE a.influencer_id = ? AND a.status != 'clawed_back'
     GROUP BY a.product_id
     ORDER BY total_commission DESC
     LIMIT 10`
  ).bind(userId).all().catch(() => ({ results: [] as any[] }))

  return c.json({
    success: true,
    data: {
      summary: summary || { total_attributions: 0, pending: 0, available: 0, paid: 0, clawed_back: 0, total: 0 },
      top_sellers: topSellers.results || [],
      top_products: topProducts.results || [],
      daily: daily.results || [],
    },
  })
})

// 인플 측 — 내가 영입한 매장 + 받은/보낸 deal 목록
influencerApp.get('/my-stores', async (c) => {
  const userId = String((c.get('user') as AuthUser).id)
  // 내가 영입한 매장 (referred_by_influencer = me)
  const referred = await c.env.DB.prepare(
    `SELECT s.id, s.name, s.referral_bonus_until,
            (SELECT COALESCE(SUM(commission_amount), 0) FROM influencer_attributions
             WHERE influencer_id = ? AND seller_id = s.id) AS total_commission
     FROM sellers s
     WHERE s.referred_by_influencer = ?
     ORDER BY s.id DESC LIMIT 100`
  ).bind(userId, userId).all().catch(() => ({ results: [] as any[] }))
  // 협업 deals
  const deals = await c.env.DB.prepare(
    `SELECT d.id, d.seller_id, s.name AS seller_name, d.commission_pct, d.starts_at, d.ends_at, d.status, d.proposed_by, d.message, d.created_at
     FROM seller_influencer_deals d
     LEFT JOIN sellers s ON s.id = d.seller_id
     WHERE d.influencer_id = ?
     ORDER BY d.created_at DESC LIMIT 100`
  ).bind(userId).all().catch(() => ({ results: [] as any[] }))
  return c.json({ success: true, data: { referred: referred.results || [], deals: deals.results || [] } })
})

// ───────── 인플 지역 ranking (공개) ─────────

// 🛡️ 2026-05-16: 인플루언서 매장 영입 + commission 매출 ranking — 지역/기간/기준 별
const rankingApp = new Hono<{ Bindings: Env; Variables: MarketingVars }>()

// 공개 endpoint — IP 당 분당 30회 (봇 / 폭증 트래픽 방어)
rankingApp.use('*', rateLimit({ action: 'influencer_rankings', max: 30, windowSec: 60 }))

rankingApp.get('/', async (c) => {
  const DB = c.env.DB
  const region = c.req.query('region') || 'all'         // 'all' / 'seoul' / 'gangnam' / etc.
  const period = c.req.query('period') || 'month'       // 'month' (이번 달) / 'all' (누적)
  const metric = c.req.query('metric') || 'commission'  // 'commission' / 'count'

  // 🛡️ 2026-05-16: KV 캐시 5분 — 공개 endpoint 봇 / 폭증 트래픽 방어
  const kv = (c.env as { SESSION_KV?: KVNamespace }).SESSION_KV
  const cacheKey = `infl_ranking:${region}:${period}:${metric}`
  if (kv) {
    try {
      const cached = await kv.get(cacheKey)
      if (cached) return c.json(JSON.parse(cached))
    } catch { /* miss */ }
  }

  // 기간 필터
  const timeFilter = period === 'month'
    ? "AND a.created_at >= datetime('now', 'start of month')"
    : ''

  // 지역 필터 — products.restaurant_address LIKE 매칭
  const regionMap: Record<string, string> = {
    seoul: '서울', busan: '부산', incheon: '인천', daegu: '대구', daejeon: '대전',
    gwangju: '광주', ulsan: '울산', sejong: '세종', gyeonggi: '경기',
    gangnam: '강남구', seocho: '서초구', mapo: '마포구', jongno: '종로구', yongsan: '용산구',
    songpa: '송파구', gangdong: '강동구', seongdong: '성동구', gwangjin: '광진구',
  }
  const regionKw = regionMap[region]
  const regionFilter = regionKw ? `AND p.restaurant_address LIKE '%${regionKw}%'` : ''

  const orderBy = metric === 'count' ? 'attribution_count' : 'total_commission'

  try {
    const { results } = await DB.prepare(
      `SELECT a.influencer_id,
              COUNT(*) AS attribution_count,
              COALESCE(SUM(a.commission_amount), 0) AS total_commission,
              COUNT(DISTINCT a.seller_id) AS seller_count,
              COUNT(DISTINCT a.product_id) AS product_count
       FROM influencer_attributions a
       LEFT JOIN products p ON p.id = a.product_id
       WHERE a.status != 'clawed_back'
         ${timeFilter}
         ${regionFilter}
       GROUP BY a.influencer_id
       ORDER BY ${orderBy} DESC
       LIMIT 100`
    ).all<{ influencer_id: string; attribution_count: number; total_commission: number; seller_count: number; product_count: number }>()

    // 익명화 여부 처리 — influencer_balances.ranking_public = 0 인 인플은 익명화
    const publicMap = new Map<string, boolean>()
    try {
      const ids = (results || []).map(r => r.influencer_id)
      if (ids.length > 0) {
        const ph = ids.map(() => '?').join(',')
        const { results: privs } = await DB.prepare(
          `SELECT influencer_id, COALESCE(ranking_public, 1) AS ranking_public FROM influencer_balances WHERE influencer_id IN (${ph})`
        ).bind(...ids).all<{ influencer_id: string; ranking_public: number }>()
        for (const p of (privs || [])) publicMap.set(p.influencer_id, Number(p.ranking_public) === 1)
      }
    } catch { /* ranking_public 컬럼 미존재 시 default public */ }

    const ranked = (results || []).map((r, i) => {
      const isPublic = publicMap.get(r.influencer_id) ?? true
      return {
        rank: i + 1,
        influencer_id: isPublic ? r.influencer_id : null,
        display_name: isPublic ? r.influencer_id : `익명 인플 #${(i + 1).toString().padStart(3, '0')}`,
        attribution_count: r.attribution_count,
        total_commission: r.total_commission,
        seller_count: r.seller_count,
        product_count: r.product_count,
      }
    })

    const response = { success: true, data: ranked, region, period, metric }
    // KV 캐시 저장 (5분)
    if (kv) {
      try { await kv.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 }) } catch { /* silent */ }
    }
    return c.json(response)
  } catch (e) {
    return c.json({ success: false, error: 'ranking_unavailable' }, 503)
  }
})

// ───────── 인플 분쟁 신고 + 어드민 조정 ─────────

influencerApp.post('/disputes', async (c) => {
  const userId = String((c.get('user') as AuthUser).id)
  const body = await c.req.json<{ seller_id?: number; type: 'unfair_block' | 'commission_dispute' | 'other'; description: string }>().catch(() => ({} as any))
  if (!body.type || !['unfair_block', 'commission_dispute', 'other'].includes(body.type)) {
    return c.json({ success: false, error: 'invalid type' }, 400)
  }
  const desc = String(body.description || '').trim().slice(0, 1000)
  if (desc.length < 10) return c.json({ success: false, error: '신고 내용 10자 이상' }, 400)
  await c.env.DB.prepare(
    `INSERT INTO influencer_disputes (influencer_id, seller_id, type, description, status)
     VALUES (?, ?, ?, ?, 'open')`
  ).bind(userId, body.seller_id || null, body.type, desc).run()
  // 어드민 dashboard 알림
  try {
    await c.env.DB.prepare(
      `INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
       VALUES ('admin', 'all', 'influencer_dispute', ?, ?, '/admin/influencer-disputes', datetime('now'))`
    ).bind(`⚠️ 인플 분쟁 신고: ${body.type}`, desc.slice(0, 200)).run()
  } catch { /* silent */ }
  return c.json({ success: true })
})

adminApp.get('/disputes', async (c) => {
  const status = c.req.query('status') || 'open'
  const { results } = await c.env.DB.prepare(
    `SELECT d.id, d.influencer_id, d.seller_id, s.name AS seller_name,
            d.type, d.description, d.status, d.resolution, d.created_at, d.resolved_at
     FROM influencer_disputes d
     LEFT JOIN sellers s ON s.id = d.seller_id
     WHERE d.status = ?
     ORDER BY d.created_at DESC LIMIT 200`
  ).bind(status).all().catch(() => ({ results: [] as any[] }))
  return c.json({ success: true, data: results || [] })
})

adminApp.post('/disputes/:id/resolve', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<{ action: 'resolved' | 'rejected'; resolution: string; unblock_influencer?: boolean }>().catch(() => ({} as any))
  if (!['resolved', 'rejected'].includes(body.action)) return c.json({ success: false, error: 'invalid action' }, 400)
  const resolution = String(body.resolution || '').trim().slice(0, 500)
  if (!resolution) return c.json({ success: false, error: '조정 내용 필수' }, 400)

  const dispute = await c.env.DB.prepare("SELECT influencer_id, seller_id FROM influencer_disputes WHERE id = ?").bind(id).first<{ influencer_id: string; seller_id: number | null }>()
  if (!dispute) return c.json({ success: false, error: 'not found' }, 404)

  await c.env.DB.prepare(
    "UPDATE influencer_disputes SET status = ?, resolution = ?, resolved_at = datetime('now') WHERE id = ?"
  ).bind(body.action, resolution, id).run()

  // 차단 해제 옵션 — resolved 면서 unblock_influencer=true
  if (body.action === 'resolved' && body.unblock_influencer && dispute.seller_id) {
    await c.env.DB.prepare(
      "UPDATE seller_blocked_influencers SET unblocked_at = datetime('now') WHERE seller_id = ? AND influencer_id = ? AND unblocked_at IS NULL"
    ).bind(dispute.seller_id, dispute.influencer_id).run()
  }

  // 인플에게 결과 알림 (best-effort)
  try {
    await c.env.DB.prepare(
      `INSERT INTO user_notifications (user_id, type, title, message, link)
       VALUES (?, 'dispute_resolved', ?, ?, '/influencer/settlement')`
    ).bind(dispute.influencer_id, body.action === 'resolved' ? '분쟁 조정 완료' : '분쟁 거절됨', resolution).run()
  } catch { /* silent */ }

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
    ).bind(influencerId, dealAmount, dealAmount).run().catch(swallow('marketing:influencer-payout:balance'))
    await DB.prepare(
      `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description)
       VALUES (?, 'influencer_payout', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?)`
    ).bind(influencerId, dealAmount, dealAmount, influencerId, `인플 정산 (딜 +${bonusPct}% 보너스)`).run().catch(swallow('marketing:influencer-payout:tx'))
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
  const validCats = ['meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher']
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

export { sellerApp as sellerMarketingRoutes, influencerApp as influencerSettlementRoutes, adminApp as adminPayoutRoutes, discoverApp as influencerDiscoverRoutes, rankingApp as influencerRankingsRoutes }
