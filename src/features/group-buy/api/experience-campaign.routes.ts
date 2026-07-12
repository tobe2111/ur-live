/**
 * 🎁 2026-07-12 체험 캠페인 모듈 (trial-campaign-track-2026-07.md WP-A).
 *
 * "무료 응모·공정 추첨 체험단" — 매장(또는 어드민 대행)이 캠페인 개설 → 소비자 응모(중복차단)
 *   → 공정추첨(CSPRNG·시드/풀/당첨자 영구이력, B2G 증빙) → 선정자에게 **0원 체험권 자동발급**
 *   → QR 사용(방문데이터) → 캠페인별 성과 리포트.
 *
 * 머니 규칙(WP-A#4): 0원 발행 → 정산·커미션 무접촉. is_experience=1 마킹으로 auto-settlement 제외.
 *   사용시점 원장/커미션은 amount>0 게이트라 0원이면 자동 no-op.
 *
 * 우선순위(대표): 어드민 대행 생성(1순위·서초 산출물). 셀러 셀프 생성은 게이트(experience_campaign_seller_create) 뒤.
 * created_by(owner/admin/agency) 필드 선반영 — 8월 2단계(에이전시 위임 대리관리) 무마이그레이션 개방용.
 *
 * 라우트:
 *   공개:  GET  /api/experience-campaigns                 — 모집중 목록
 *          GET  /api/experience-campaigns/:id             — 상세
 *   유저:  POST /api/experience-campaigns/:id/apply       — 응모(1인1회) [requireAuth]
 *          GET  /api/experience-campaigns/:id/me          — 내 응모상태
 *          GET  /api/experience-campaigns/my/entries      — 내 응모 현황(전체)
 *   어드민: POST /api/admin/experience-campaigns          — 대행 생성
 *          GET  /api/admin/experience-campaigns           — 전체 목록
 *          GET  /api/admin/experience-campaigns/:id/entries — 응모자 목록
 *          POST /api/admin/experience-campaigns/:id/draw  — 추첨+0원발급(이력기록)
 *          GET  /api/admin/experience-campaigns/:id/report[.csv] — 리포트
 *          GET  /api/admin/experience-campaigns/:id/draws — 추첨 이력(B2G 감사)
 */
import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import { requireAuth, requireAdmin, requireSeller, getCurrentUser } from '@/worker/middleware/auth'
import { intParam } from '@/shared/pagination'
import { generateUniqueVoucherCode } from './helpers'

type Env = { DB: D1Database }

// ── 공정 추첨 CSPRNG (fcfs.routes.ts 와 동일 방식 — SQLite RANDOM 불가, WebCrypto rejection sampling) ──
function cryptoInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % maxExclusive
  }
}
function cryptoShuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = cryptoInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
/** 공정성 증빙용 시드(hex) — 추첨 전 기록해 결과 재현/조작불가 증명. */
function drawSeedHex(): string {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

const _ensured = new WeakSet<object>()
async function ensureTables(DB: D1Database) {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS experience_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      slots INTEGER NOT NULL DEFAULT 1,
      apply_start DATETIME,
      apply_end DATETIME,
      mission TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_by TEXT NOT NULL DEFAULT 'admin',
      created_by_id TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      drawn_at DATETIME
    )`).run()
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_exp_camp_seller ON experience_campaigns(seller_id, status)").run()
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_exp_camp_status ON experience_campaigns(status, apply_end)").run()
    await DB.prepare(`CREATE TABLE IF NOT EXISTS experience_campaign_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'applied',
      voucher_id INTEGER,
      created_at DATETIME DEFAULT (datetime('now')),
      selected_at DATETIME,
      UNIQUE(campaign_id, user_id)
    )`).run()
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_exp_entry_campaign ON experience_campaign_entries(campaign_id, status)").run()
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_exp_entry_user ON experience_campaign_entries(user_id, status)").run()
    // 추첨 이력 (B2G 조작불가 증빙 — 시드/풀스냅샷/당첨자 영구보관)
    await DB.prepare(`CREATE TABLE IF NOT EXISTS experience_draw_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      admin_id TEXT,
      method TEXT NOT NULL,
      seed TEXT NOT NULL,
      pool_size INTEGER NOT NULL,
      requested_count INTEGER,
      pool_snapshot TEXT,
      winners TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    )`).run()
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_exp_draw_campaign ON experience_draw_logs(campaign_id, created_at)").run()
  } catch { /* ignore */ }
}

/** 캠페인 제공 이용권을 선정자에게 0원 발급 (order+voucher, is_experience=1). @returns voucher id or null */
async function issueExperienceVoucher(
  DB: D1Database,
  campaign: { id: number; seller_id: number; product_id: number },
  userId: string,
): Promise<number | null> {
  try {
    // 상품(제공 이용권) 정보 — 유효기간 산출(기본 +90일).
    const p = await DB.prepare('SELECT name, seller_id, voucher_validity_days FROM products WHERE id = ?')
      .bind(campaign.product_id).first<{ name: string; seller_id: number | null; voucher_validity_days: number | null }>()
      .catch(() => null)
    const validityDays = Number(p?.voucher_validity_days) > 0 ? Number(p!.voucher_validity_days) : 90
    const expiresAt = new Date(Date.now() + validityDays * 86400_000).toISOString()
    const orderNumber = `EXP-${campaign.id}-${userId}-${cryptoInt(0x7fffffff)}`

    // 0원 order (payment_method='experience' — 만료환불 cron 자연 skip). status='PAID' (사용 가능).
    const orderRow = await DB.prepare(`
      INSERT INTO orders (order_number, user_id, seller_id, subtotal, shipping_fee, discount_amount, total_amount, currency, status, payment_method)
      VALUES (?, ?, ?, 0, 0, 0, 0, 'KRW', 'PAID', 'experience')
      RETURNING id
    `).bind(orderNumber, userId, campaign.seller_id).first<{ id: number }>().catch(() => null)
    const orderId = orderRow?.id
    if (!orderId) return null

    const code = await generateUniqueVoucherCode(DB)
    const vRow = await DB.prepare(`
      INSERT INTO vouchers (order_id, product_id, user_id, code, expires_at, applied_discount_pct, applied_price, is_experience)
      VALUES (?, ?, ?, ?, ?, 100, 0, 1)
      RETURNING id
    `).bind(orderId, campaign.product_id, userId, code, expiresAt).first<{ id: number }>().catch(() => null)
    // order_item (정산 근거/주문상세 표시 — 0원)
    await DB.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, price, quantity, subtotal)
      VALUES (?, ?, ?, 0, 0, 1, 0)
    `).bind(orderId, campaign.product_id, p?.name || '체험권').run().catch(() => {})
    return vRow?.id ?? null
  } catch {
    return null
  }
}

async function notifyEntry(DB: D1Database, userId: string, title: string, message: string, link: string) {
  await DB.prepare(
    "INSERT INTO notifications (user_id, user_type, type, title, message, link, created_at) VALUES (?, 'user', 'experience_campaign', ?, ?, ?, datetime('now'))",
  ).bind(userId, title, message, link).run().catch(() => {})
}

// ══════════════════════════════════ 공개 + 유저 ══════════════════════════════════
const publicApp = new Hono<{ Bindings: Env }>()

publicApp.get('/', async (c) => {
  await ensureTables(c.env.DB)
  const rows = await c.env.DB.prepare(`
    SELECT ec.id, ec.title, ec.description, ec.slots, ec.apply_start, ec.apply_end, ec.mission, ec.status,
           ec.product_id, p.name AS product_name, p.restaurant_name, p.image_url, p.price,
           (SELECT COUNT(*) FROM experience_campaign_entries e WHERE e.campaign_id = ec.id) AS entry_count
    FROM experience_campaigns ec
    JOIN products p ON p.id = ec.product_id
    WHERE ec.status = 'open' AND (ec.apply_end IS NULL OR ec.apply_end > datetime('now'))
    ORDER BY ec.created_at DESC LIMIT 100
  `).all().catch(() => ({ results: [] }))
  return c.json({ success: true, campaigns: rows.results || [] })
})

publicApp.get('/:id', async (c) => {
  await ensureTables(c.env.DB)
  const id = intParam(c.req.param('id'), 0)
  const row = await c.env.DB.prepare(`
    SELECT ec.*, p.name AS product_name, p.restaurant_name, p.image_url, p.price
    FROM experience_campaigns ec JOIN products p ON p.id = ec.product_id WHERE ec.id = ?
  `).bind(id).first().catch(() => null)
  if (!row) return c.json({ success: false, error: 'not found' }, 404)
  const cnt = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM experience_campaign_entries WHERE campaign_id = ?')
    .bind(id).first<{ n: number }>().catch(() => ({ n: 0 }))
  return c.json({ success: true, campaign: { ...row, entry_count: cnt?.n ?? 0 } })
})

const userApp = new Hono<{ Bindings: Env }>()
userApp.use('*', requireAuth())

userApp.post('/:id/apply', async (c) => {
  await ensureTables(c.env.DB)
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'unauth' }, 401)
  const id = intParam(c.req.param('id'), 0)
  const camp = await c.env.DB.prepare(
    "SELECT id, status, apply_start, apply_end FROM experience_campaigns WHERE id = ?",
  ).bind(id).first<{ id: number; status: string; apply_start: string | null; apply_end: string | null }>().catch(() => null)
  if (!camp || camp.status !== 'open') return c.json({ success: false, error: '모집이 종료된 캠페인입니다' }, 400)
  const now = Date.now()
  if (camp.apply_start && new Date(camp.apply_start).getTime() > now) return c.json({ success: false, error: '아직 응모 기간이 아닙니다' }, 400)
  if (camp.apply_end && new Date(camp.apply_end).getTime() < now) return c.json({ success: false, error: '응모가 마감되었습니다' }, 400)
  // 응모 — UNIQUE(campaign_id,user_id) 중복차단.
  const r = await c.env.DB.prepare(
    "INSERT OR IGNORE INTO experience_campaign_entries (campaign_id, user_id, status) VALUES (?, ?, 'applied')",
  ).bind(id, String(user.id)).run().catch(() => null)
  if (!r || r.meta.changes === 0) return c.json({ success: false, error: '이미 응모하셨습니다', code: 'ALREADY_APPLIED' }, 409)
  return c.json({ success: true })
})

userApp.get('/:id/me', async (c) => {
  await ensureTables(c.env.DB)
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'unauth' }, 401)
  const id = intParam(c.req.param('id'), 0)
  const row = await c.env.DB.prepare(
    "SELECT status, voucher_id, created_at, selected_at FROM experience_campaign_entries WHERE campaign_id = ? AND user_id = ?",
  ).bind(id, String(user.id)).first().catch(() => null)
  return c.json({ success: true, entry: row || null })
})

userApp.get('/my/entries', async (c) => {
  await ensureTables(c.env.DB)
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'unauth' }, 401)
  const rows = await c.env.DB.prepare(`
    SELECT e.campaign_id, e.status, e.voucher_id, e.created_at, e.selected_at,
           ec.title, ec.product_id, p.name AS product_name, p.restaurant_name, p.image_url
    FROM experience_campaign_entries e
    JOIN experience_campaigns ec ON ec.id = e.campaign_id
    JOIN products p ON p.id = ec.product_id
    WHERE e.user_id = ? ORDER BY e.created_at DESC LIMIT 100
  `).bind(String(user.id)).all().catch(() => ({ results: [] }))
  return c.json({ success: true, entries: rows.results || [] })
})

// ══════════════════════════════════ 어드민 (대행 생성 = 1순위) ══════════════════════════════════
const adminApp = new Hono<{ Bindings: Env }>()
adminApp.use('*', requireAdmin())

adminApp.post('/', async (c) => {
  await ensureTables(c.env.DB)
  const admin = getCurrentUser(c)
  const b = await c.req.json<{ seller_id?: unknown; product_id?: unknown; title?: unknown; description?: unknown; slots?: unknown; apply_start?: unknown; apply_end?: unknown; mission?: unknown }>().catch(() => ({} as Record<string, unknown>))
  const sellerId = intParam(b.seller_id, 0)
  const productId = intParam(b.product_id, 0)
  const title = typeof b.title === 'string' ? b.title.trim().slice(0, 200) : ''
  const slots = Math.max(1, intParam(b.slots, 1))
  if (!sellerId || !productId || !title) return c.json({ success: false, error: 'seller_id, product_id, title 필수' }, 400)
  // 상품이 해당 매장 소유인지 검증(IDOR/데이터정합).
  const prod = await c.env.DB.prepare('SELECT id FROM products WHERE id = ? AND seller_id = ?')
    .bind(productId, sellerId).first().catch(() => null)
  if (!prod) return c.json({ success: false, error: '해당 매장의 상품이 아닙니다' }, 400)
  const r = await c.env.DB.prepare(`
    INSERT INTO experience_campaigns (seller_id, product_id, title, description, slots, apply_start, apply_end, mission, status, created_by, created_by_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 'admin', ?) RETURNING id
  `).bind(
    sellerId, productId, title,
    typeof b.description === 'string' ? b.description.slice(0, 2000) : null,
    slots,
    typeof b.apply_start === 'string' ? b.apply_start : null,
    typeof b.apply_end === 'string' ? b.apply_end : null,
    typeof b.mission === 'string' ? b.mission.slice(0, 1000) : null,
    admin ? String(admin.id) : null,
  ).first<{ id: number }>().catch(() => null)
  if (!r?.id) return c.json({ success: false, error: '생성 실패' }, 500)
  return c.json({ success: true, id: r.id })
})

adminApp.get('/', async (c) => {
  await ensureTables(c.env.DB)
  const rows = await c.env.DB.prepare(`
    SELECT ec.*, p.name AS product_name, p.restaurant_name,
           (SELECT COUNT(*) FROM experience_campaign_entries e WHERE e.campaign_id = ec.id) AS entry_count,
           (SELECT COUNT(*) FROM experience_campaign_entries e WHERE e.campaign_id = ec.id AND e.status = 'selected') AS selected_count
    FROM experience_campaigns ec JOIN products p ON p.id = ec.product_id
    ORDER BY ec.created_at DESC LIMIT 200
  `).all().catch(() => ({ results: [] }))
  return c.json({ success: true, campaigns: rows.results || [] })
})

adminApp.get('/:id/entries', async (c) => {
  await ensureTables(c.env.DB)
  const id = intParam(c.req.param('id'), 0)
  const rows = await c.env.DB.prepare(`
    SELECT e.id, e.user_id, e.status, e.voucher_id, e.created_at, e.selected_at, u.name AS user_name
    FROM experience_campaign_entries e LEFT JOIN users u ON u.id = e.user_id
    WHERE e.campaign_id = ? ORDER BY e.created_at ASC LIMIT 1000
  `).bind(id).all().catch(() => ({ results: [] }))
  return c.json({ success: true, entries: rows.results || [] })
})

adminApp.post('/:id/draw', async (c) => {
  await ensureTables(c.env.DB)
  const admin = getCurrentUser(c)
  const id = intParam(c.req.param('id'), 0)
  const b = await c.req.json<{ count?: unknown }>().catch(() => ({} as { count?: unknown }))
  const camp = await c.env.DB.prepare(
    "SELECT id, seller_id, product_id, slots, status, title FROM experience_campaigns WHERE id = ?",
  ).bind(id).first<{ id: number; seller_id: number; product_id: number; slots: number; status: string; title: string }>().catch(() => null)
  if (!camp) return c.json({ success: false, error: 'not found' }, 404)
  // 상태 CAS — 이중 추첨 방지.
  const claim = await c.env.DB.prepare(
    "UPDATE experience_campaigns SET status='drawn', drawn_at=datetime('now') WHERE id=? AND status='open'",
  ).bind(id).run().catch(() => null)
  if (!claim || claim.meta.changes === 0) return c.json({ success: false, error: '이미 추첨된 캠페인입니다' }, 409)

  const count = Math.max(1, intParam(b.count, camp.slots))
  const pool = await c.env.DB.prepare(
    "SELECT user_id FROM experience_campaign_entries WHERE campaign_id = ? AND status = 'applied'",
  ).bind(id).all<{ user_id: string }>().catch(() => ({ results: [] as { user_id: string }[] }))
  const poolIds = (pool.results || []).map((r) => r.user_id)
  const seed = drawSeedHex()
  const winners = cryptoShuffle(poolIds).slice(0, Math.min(count, poolIds.length))

  // 추첨 이력 영구기록 (시드·풀·당첨자 — B2G 증빙).
  await c.env.DB.prepare(
    "INSERT INTO experience_draw_logs (campaign_id, admin_id, method, seed, pool_size, requested_count, pool_snapshot, winners) VALUES (?, ?, 'random', ?, ?, ?, ?, ?)",
  ).bind(id, admin ? String(admin.id) : null, seed, poolIds.length, count, JSON.stringify(poolIds), JSON.stringify(winners)).run().catch(() => {})

  // 선정 처리 + 0원 체험권 발급 + 알림.
  let issued = 0
  for (const uid of winners) {
    const vid = await issueExperienceVoucher(c.env.DB, camp, uid)
    await c.env.DB.prepare(
      "UPDATE experience_campaign_entries SET status='selected', voucher_id=?, selected_at=datetime('now') WHERE campaign_id=? AND user_id=?",
    ).bind(vid, id, uid).run().catch(() => {})
    if (vid) issued++
    await notifyEntry(c.env.DB, uid, '🎉 체험단 선정!', `[${camp.title}] 체험단에 선정되셨어요! 체험권이 이용권 지갑에 발급되었습니다.`, '/my-vouchers')
  }
  // 미선정 알림.
  for (const uid of poolIds.filter((u) => !winners.includes(u))) {
    await notifyEntry(c.env.DB, uid, '체험단 결과 안내', `[${camp.title}] 아쉽게도 이번엔 선정되지 않으셨어요. 다음 기회에!`, '/my-vouchers')
  }
  return c.json({ success: true, pool_size: poolIds.length, winners: winners.length, vouchers_issued: issued, seed })
})

adminApp.get('/:id/draws', async (c) => {
  await ensureTables(c.env.DB)
  const id = intParam(c.req.param('id'), 0)
  const rows = await c.env.DB.prepare(
    "SELECT id, admin_id, method, seed, pool_size, requested_count, winners, created_at FROM experience_draw_logs WHERE campaign_id = ? ORDER BY created_at DESC",
  ).bind(id).all().catch(() => ({ results: [] }))
  return c.json({ success: true, draws: rows.results || [] })
})

// 캠페인 리포트 — 응모→방문(체험권 사용)→링크 전환(affiliate_earnings ⋈ 선정자).
async function buildReport(DB: D1Database, id: number) {
  const camp = await DB.prepare("SELECT id, title, seller_id, product_id, slots, created_at FROM experience_campaigns WHERE id = ?").bind(id).first().catch(() => null)
  const agg = await DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM experience_campaign_entries WHERE campaign_id = ?) AS applied,
      (SELECT COUNT(*) FROM experience_campaign_entries WHERE campaign_id = ? AND status='selected') AS selected,
      (SELECT COUNT(*) FROM experience_campaign_entries e JOIN vouchers v ON v.id = e.voucher_id
         WHERE e.campaign_id = ? AND v.status='used') AS visited,
      (SELECT COALESCE(SUM(ae.commission),0) FROM affiliate_earnings ae
         WHERE ae.referrer_id IN (SELECT user_id FROM experience_campaign_entries WHERE campaign_id = ? AND status='selected')
           AND ae.created_at >= (SELECT created_at FROM experience_campaigns WHERE id = ?)) AS conversion_commission,
      (SELECT COUNT(*) FROM affiliate_earnings ae
         WHERE ae.referrer_id IN (SELECT user_id FROM experience_campaign_entries WHERE campaign_id = ? AND status='selected')
           AND ae.created_at >= (SELECT created_at FROM experience_campaigns WHERE id = ?)) AS conversion_orders
  `).bind(id, id, id, id, id, id, id).first().catch(() => null)
  return { campaign: camp, metrics: agg }
}

adminApp.get('/:id/report', async (c) => {
  await ensureTables(c.env.DB)
  const id = intParam(c.req.param('id'), 0)
  return c.json({ success: true, ...(await buildReport(c.env.DB, id)) })
})

adminApp.get('/:id/report.csv', async (c) => {
  await ensureTables(c.env.DB)
  const id = intParam(c.req.param('id'), 0)
  const { campaign, metrics } = await buildReport(c.env.DB, id) as { campaign: Record<string, unknown> | null; metrics: Record<string, unknown> | null }
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    const g = /^[=+\-@\t\r]/.test(s) ? "'" + s : s // 수식 인젝션 가드
    return /[",\n]/.test(g) ? `"${g.replace(/"/g, '""')}"` : g
  }
  const rows = [
    ['캠페인ID', 'title', '응모', '선정', '방문(체험권사용)', '전환주문수', '전환커미션(원)'],
    [id, campaign?.title, metrics?.applied, metrics?.selected, metrics?.visited, metrics?.conversion_orders, metrics?.conversion_commission],
  ]
  const csv = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="campaign-${id}-report.csv"` } })
})

// ══════════════════════════════════ 셀러 셀프 생성 (2순위 · 게이트 뒤) ══════════════════════════════════
// 게이트: platform_settings.experience_campaign_seller_create='true' 일 때만 생성 허용(기본 OFF).
// 어드민 대행생성(1순위)은 게이트 무관. 셀러는 자기 매장(seller_id) 캠페인만 생성/조회/추첨.
const sellerApp = new Hono<{ Bindings: Env }>()
sellerApp.use('*', requireSeller())

async function sellerCreateEnabled(DB: D1Database): Promise<boolean> {
  const r = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'experience_campaign_seller_create'")
    .first<{ value: string }>().catch(() => null)
  return r?.value === 'true'
}

sellerApp.post('/', async (c) => {
  await ensureTables(c.env.DB)
  if (!(await sellerCreateEnabled(c.env.DB))) {
    return c.json({ success: false, error: '셀러 셀프 캠페인 개설은 준비 중입니다 (관리자 문의).' }, 403)
  }
  const sellerId = Number((getCurrentUser(c) as { id: string | number }).id)
  const b = await c.req.json<{ product_id?: unknown; title?: unknown; description?: unknown; slots?: unknown; apply_start?: unknown; apply_end?: unknown; mission?: unknown }>().catch(() => ({} as Record<string, unknown>))
  const productId = intParam(b.product_id, 0)
  const title = typeof b.title === 'string' ? b.title.trim().slice(0, 200) : ''
  const slots = Math.max(1, intParam(b.slots, 1))
  if (!productId || !title) return c.json({ success: false, error: 'product_id, title 필수' }, 400)
  // 본인 매장 상품만 (IDOR 방지 — 셀러는 seller_id 를 body 로 못 넘김, 세션 값 강제).
  const prod = await c.env.DB.prepare('SELECT id FROM products WHERE id = ? AND seller_id = ?')
    .bind(productId, sellerId).first().catch(() => null)
  if (!prod) return c.json({ success: false, error: '본인 매장의 상품이 아닙니다' }, 400)
  const r = await c.env.DB.prepare(`
    INSERT INTO experience_campaigns (seller_id, product_id, title, description, slots, apply_start, apply_end, mission, status, created_by, created_by_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 'owner', ?) RETURNING id
  `).bind(
    sellerId, productId, title,
    typeof b.description === 'string' ? b.description.slice(0, 2000) : null,
    slots,
    typeof b.apply_start === 'string' ? b.apply_start : null,
    typeof b.apply_end === 'string' ? b.apply_end : null,
    typeof b.mission === 'string' ? b.mission.slice(0, 1000) : null,
    String(sellerId),
  ).first<{ id: number }>().catch(() => null)
  if (!r?.id) return c.json({ success: false, error: '생성 실패' }, 500)
  return c.json({ success: true, id: r.id })
})

sellerApp.get('/', async (c) => {
  await ensureTables(c.env.DB)
  const sellerId = Number((getCurrentUser(c) as { id: string | number }).id)
  const rows = await c.env.DB.prepare(`
    SELECT ec.*, p.name AS product_name, p.restaurant_name,
           (SELECT COUNT(*) FROM experience_campaign_entries e WHERE e.campaign_id = ec.id) AS entry_count,
           (SELECT COUNT(*) FROM experience_campaign_entries e WHERE e.campaign_id = ec.id AND e.status = 'selected') AS selected_count
    FROM experience_campaigns ec JOIN products p ON p.id = ec.product_id
    WHERE ec.seller_id = ? ORDER BY ec.created_at DESC LIMIT 200
  `).bind(sellerId).all().catch(() => ({ results: [] }))
  return c.json({ success: true, campaigns: rows.results || [], seller_create_enabled: await sellerCreateEnabled(c.env.DB) })
})

sellerApp.get('/:id/entries', async (c) => {
  await ensureTables(c.env.DB)
  const sellerId = Number((getCurrentUser(c) as { id: string | number }).id)
  const id = intParam(c.req.param('id'), 0)
  // 소유권 확인 — 본인 캠페인만.
  const own = await c.env.DB.prepare('SELECT id FROM experience_campaigns WHERE id = ? AND seller_id = ?').bind(id, sellerId).first().catch(() => null)
  if (!own) return c.json({ success: false, error: 'not found' }, 404)
  const rows = await c.env.DB.prepare(`
    SELECT e.id, e.user_id, e.status, e.voucher_id, e.created_at, e.selected_at, u.name AS user_name
    FROM experience_campaign_entries e LEFT JOIN users u ON u.id = e.user_id
    WHERE e.campaign_id = ? ORDER BY e.created_at ASC LIMIT 1000
  `).bind(id).all().catch(() => ({ results: [] }))
  return c.json({ success: true, entries: rows.results || [] })
})

sellerApp.post('/:id/draw', async (c) => {
  await ensureTables(c.env.DB)
  const sellerId = Number((getCurrentUser(c) as { id: string | number }).id)
  const id = intParam(c.req.param('id'), 0)
  const b = await c.req.json<{ count?: unknown }>().catch(() => ({} as { count?: unknown }))
  const camp = await c.env.DB.prepare(
    "SELECT id, seller_id, product_id, slots, status, title FROM experience_campaigns WHERE id = ? AND seller_id = ?",
  ).bind(id, sellerId).first<{ id: number; seller_id: number; product_id: number; slots: number; status: string; title: string }>().catch(() => null)
  if (!camp) return c.json({ success: false, error: 'not found' }, 404)
  const claim = await c.env.DB.prepare(
    "UPDATE experience_campaigns SET status='drawn', drawn_at=datetime('now') WHERE id=? AND seller_id=? AND status='open'",
  ).bind(id, sellerId).run().catch(() => null)
  if (!claim || claim.meta.changes === 0) return c.json({ success: false, error: '이미 추첨된 캠페인입니다' }, 409)
  const count = Math.max(1, intParam(b.count, camp.slots))
  const pool = await c.env.DB.prepare(
    "SELECT user_id FROM experience_campaign_entries WHERE campaign_id = ? AND status = 'applied'",
  ).bind(id).all<{ user_id: string }>().catch(() => ({ results: [] as { user_id: string }[] }))
  const poolIds = (pool.results || []).map((r) => r.user_id)
  const seed = drawSeedHex()
  const winners = cryptoShuffle(poolIds).slice(0, Math.min(count, poolIds.length))
  await c.env.DB.prepare(
    "INSERT INTO experience_draw_logs (campaign_id, admin_id, method, seed, pool_size, requested_count, pool_snapshot, winners) VALUES (?, ?, 'random', ?, ?, ?, ?, ?)",
  ).bind(id, `seller:${sellerId}`, seed, poolIds.length, count, JSON.stringify(poolIds), JSON.stringify(winners)).run().catch(() => {})
  let issued = 0
  for (const uid of winners) {
    const vid = await issueExperienceVoucher(c.env.DB, camp, uid)
    await c.env.DB.prepare(
      "UPDATE experience_campaign_entries SET status='selected', voucher_id=?, selected_at=datetime('now') WHERE campaign_id=? AND user_id=?",
    ).bind(vid, id, uid).run().catch(() => {})
    if (vid) issued++
    await notifyEntry(c.env.DB, uid, '🎉 체험단 선정!', `[${camp.title}] 체험단에 선정되셨어요! 체험권이 이용권 지갑에 발급되었습니다.`, '/my-vouchers')
  }
  for (const uid of poolIds.filter((u) => !winners.includes(u))) {
    await notifyEntry(c.env.DB, uid, '체험단 결과 안내', `[${camp.title}] 아쉽게도 이번엔 선정되지 않으셨어요. 다음 기회에!`, '/my-vouchers')
  }
  return c.json({ success: true, pool_size: poolIds.length, winners: winners.length, vouchers_issued: issued, seed })
})

sellerApp.get('/:id/report', async (c) => {
  await ensureTables(c.env.DB)
  const sellerId = Number((getCurrentUser(c) as { id: string | number }).id)
  const id = intParam(c.req.param('id'), 0)
  const own = await c.env.DB.prepare('SELECT id FROM experience_campaigns WHERE id = ? AND seller_id = ?').bind(id, sellerId).first().catch(() => null)
  if (!own) return c.json({ success: false, error: 'not found' }, 404)
  return c.json({ success: true, ...(await buildReport(c.env.DB, id)) })
})

// 공개+유저 결합 export (공개 먼저, 유저는 requireAuth) + 어드민/셀러 별도.
export const experienceCampaignPublicRoutes = new Hono<{ Bindings: Env }>()
experienceCampaignPublicRoutes.route('/', publicApp)
experienceCampaignPublicRoutes.route('/', userApp)
export const experienceCampaignAdminRoutes = adminApp
export const experienceCampaignSellerRoutes = sellerApp
