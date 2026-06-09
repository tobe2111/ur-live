/**
 * 🏭 2026-06-09 도매몰 메인 리디자인 Wave 2 — BACKEND.
 * (docs/design/wholesale-main.md)
 *
 * 본 파일이 담는 것:
 *   1. 메인 배너 캐러셀 — 공개 GET(캐시) + 어드민 CRUD.
 *   2. 프리미엄 전용관 — 어드민 상품 목록(GET) + 토글(POST). (카탈로그 필터/응답은 wholesale.routes 카탈로그에 이미 배선.)
 *   3. 제안/신고(proposals/reports) — 유통사 POST/GET + 어드민 큐/처리.
 *   4. 예치금 입금계좌(admin-settable) — 어드민 GET/PUT (platform_settings key/value).
 *
 * ⚠️ 모든 어드민 엔드포인트는 `/api/admin/...` 로 마운트(admin_token 인터셉터).
 *    공개 read 는 Cache-Control + CDN-Cache-Control 분리(서버비 절약). 금액/IDOR-safe, 서버검증, safeError+한글.
 *
 * 테이블(repair-schema + ensure-on-use 멱등):
 *   - wholesale_banners(id, image_url, link, title, sort, active, start_at, end_at, created_at)
 *   - wholesale_proposal_tickets(id, seller_id, type, target, subject, body, status, admin_memo, created_at, resolved_at)
 *   - products.is_premium INTEGER DEFAULT 0
 *   - platform_settings['wholesale_deposit_account']  (예치금 안내 계좌)
 *
 * 마운트(worker/index.ts):
 *   app.route('/api/wholesale', wholesaleMainPublicRoutes)        — 공개 배너(GET /banners) + 유통사 제안/신고(POST·GET /proposal-tickets)
 *   app.route('/api/admin/wholesale-banners', adminWholesaleBannerRoutes)
 *   app.route('/api/admin/wholesale-proposals', adminWholesaleProposalRoutes)
 *   app.route('/api/admin/wholesale-products', adminWholesaleProductRoutes)
 *   app.route('/api/admin/wholesale-deposit-account', adminWholesaleDepositAccountRoutes)
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { swallow } from '@/worker/utils/swallow'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { requireAdmin } from '@/worker/middleware/auth'
import { adminIpWhitelist, adminAuditMiddleware } from '@/worker/middleware/admin-security'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'

// ── 멱등 ensure (repair-schema 와 동일 DDL — cold isolate self-heal) ────────────
const _bannerEnsured = new WeakSet<object>()
async function ensureBannerSchema(DB: D1Database): Promise<void> {
  if (_bannerEnsured.has(DB)) return
  _bannerEnsured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_banners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_url TEXT NOT NULL,
    link TEXT,
    title TEXT,
    sort INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    start_at TEXT,
    end_at TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('wholesale-banners:ensure'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_banners_active ON wholesale_banners(active, sort, id)').run().catch(swallow('wholesale-banners:idx'))
}

const _proposalEnsured = new WeakSet<object>()
async function ensureProposalSchema(DB: D1Database): Promise<void> {
  if (_proposalEnsured.has(DB)) return
  _proposalEnsured.add(DB)
  // ⚠️ 기존 wholesale_proposals(어드민→유통사 상품제안) 와 별개 — wholesale_proposal_tickets 사용.
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_proposal_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'proposal',
    target TEXT,
    subject TEXT NOT NULL,
    body TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    admin_memo TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    resolved_at DATETIME
  )`).run().catch(swallow('wholesale-proposals:ensure'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_proposal_tickets_seller ON wholesale_proposal_tickets(seller_id, id DESC)').run().catch(swallow('wholesale-proposals:idx-seller'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_proposal_tickets_status ON wholesale_proposal_tickets(status, id DESC)').run().catch(swallow('wholesale-proposals:idx-status'))
}

const _premiumEnsured = new WeakSet<object>()
async function ensurePremiumColumn(DB: D1Database): Promise<void> {
  if (_premiumEnsured.has(DB)) return
  _premiumEnsured.add(DB)
  await DB.prepare('ALTER TABLE products ADD COLUMN is_premium INTEGER DEFAULT 0').run().catch(swallow('wholesale-premium:alter'))
}

// ── 셀러(유통사) JWT → seller_id (wholesale-deposit.routes distributorFrom 미러) ──
async function sellerIdFrom(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization?.startsWith('Bearer ')) return null
  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as { seller_id?: number }
    return payload.seller_id ?? null
  } catch {
    return null
  }
}

// URL 검증 — 길이 cap + http(s)/상대경로(/...)만 허용. 실패 시 null.
function cleanUrl(raw: unknown, max = 1000): string | null {
  const s = String(raw ?? '').trim().slice(0, max)
  if (!s) return null
  if (s.startsWith('/') || /^https?:\/\//i.test(s)) return s
  return null
}

const VALID_PROPOSAL_STATUS = new Set(['open', 'in_progress', 'resolved', 'rejected'])
const VALID_PROPOSAL_TYPE = new Set(['proposal', 'report'])

// ════════════════════════════════════════════════════════════════════════════
// 공개(+유통사) — /api/wholesale/*
// ════════════════════════════════════════════════════════════════════════════
const pub = new Hono<{ Bindings: Env }>()

// ── GET /banners — 활성·노출기간 배너(공개, 캐시) ─────────────────────────────
//   active=1 AND (start_at<=now) AND (end_at>=now) ORDER BY sort, id.
//   다른 공개 도매 GET 과 동일 캐시 분리: 브라우저 60s + edge 900s.
pub.get('/banners', async (c) => {
  const { DB } = c.env
  try {
    await ensureBannerSchema(DB)
    const { results } = await DB.prepare(
      `SELECT id, image_url, link, title, sort
       FROM wholesale_banners
       WHERE active = 1
         AND (start_at IS NULL OR start_at = '' OR start_at <= datetime('now'))
         AND (end_at   IS NULL OR end_at   = '' OR end_at   >= datetime('now'))
       ORDER BY sort ASC, id ASC
       LIMIT 30`
    ).all<{ id: number; image_url: string; link: string | null; title: string | null; sort: number }>()
      .catch(() => ({ results: [] as { id: number; image_url: string; link: string | null; title: string | null; sort: number }[] }))
    c.header('Cache-Control', 'public, max-age=60')
    c.header('CDN-Cache-Control', 'public, max-age=900')
    return c.json({ success: true, banners: results || [] })
  } catch (err) {
    return safeError(c, err, '배너 조회 중 오류가 발생했습니다', '[wholesale-banners]')
  }
})

// ── POST /proposal-tickets — 유통사 제안/신고 등록 ───────────────────────────
//   ⚠️ path 주의: 기존 GET /api/wholesale/proposals(어드민→유통사 상품제안)와 충돌 회피 위해
//      제안/신고 티켓은 `/proposal-tickets` 경로 사용(wholesaleRoutes 가 먼저 마운트되어 /proposals 선점).
pub.post('/proposal-tickets', rateLimit({ action: 'wholesale-proposal-create', max: 10, windowSec: 300 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureProposalSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const type = String(body.type || 'proposal').trim()
    if (!VALID_PROPOSAL_TYPE.has(type)) return c.json({ success: false, error: '유형이 올바르지 않습니다 (proposal/report)' }, 400)
    const subject = String(body.subject || '').trim().slice(0, 120)
    const text = String(body.body || '').trim().slice(0, 4000)
    const target = String(body.target || '').trim().slice(0, 200) || null
    if (!subject) return c.json({ success: false, error: '제목을 입력해주세요' }, 400)
    if (!text) return c.json({ success: false, error: '내용을 입력해주세요' }, 400)

    const ins = await DB.prepare(
      "INSERT INTO wholesale_proposal_tickets (seller_id, type, target, subject, body, status) VALUES (?, ?, ?, ?, ?, 'open')"
    ).bind(sellerId, type, target, subject, text).run()
    const id = Number(ins.meta?.last_row_id)
    if (!id) return c.json({ success: false, error: '등록 중 오류가 발생했습니다' }, 500)

    // 상호명 — 어드민 알림 가독성.
    const biz = await DB.prepare('SELECT COALESCE(business_name, name) AS nm FROM sellers WHERE id = ?').bind(sellerId).first<{ nm: string | null }>().catch(() => null)
    const bizName = biz?.nm || `유통사 #${sellerId}`
    const typeLabel = type === 'report' ? '신고' : '제안'
    createDashboardNotification(
      DB, 'admin', null, 'wholesale_proposal', '새 제안/신고',
      `${bizName} · ${typeLabel} · ${subject}`, '/admin/wholesale-proposals',
    ).catch(swallow('wholesale-proposals:notify-admin'))

    return c.json({ success: true, id, status: 'open' })
  } catch (err) {
    return safeError(c, err, '제안/신고 등록 중 오류가 발생했습니다', '[wholesale-proposals]')
  }
})

// ── GET /proposal-tickets — 내 제안/신고 내역(최신순) ────────────────────────
pub.get('/proposal-tickets', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureProposalSchema(DB)
    const { results } = await DB.prepare(
      `SELECT id, type, target, subject, body, status, admin_memo, created_at, resolved_at
       FROM wholesale_proposal_tickets WHERE seller_id = ? ORDER BY id DESC LIMIT 100`
    ).bind(sellerId).all()
    return c.json({ success: true, proposals: results ?? [] })
  } catch (err) {
    return safeError(c, err, '제안/신고 조회 중 오류가 발생했습니다', '[wholesale-proposals]')
  }
})

// ════════════════════════════════════════════════════════════════════════════
// 어드민 공통 보안 체인 헬퍼 (wholesale-deposit.routes 와 동일)
// ════════════════════════════════════════════════════════════════════════════
function adminApp(): Hono<{ Bindings: Env }> {
  const a = new Hono<{ Bindings: Env }>()
  a.use('*', adminIpWhitelist())
  a.use('*', requireAdmin())
  a.use('*', adminAuditMiddleware())
  return a
}

// ════════════════════════════════════════════════════════════════════════════
// 어드민 — 배너 CRUD  /api/admin/wholesale-banners/*
// ════════════════════════════════════════════════════════════════════════════
const adminBanner = adminApp()

adminBanner.get('/', async (c) => {
  const { DB } = c.env
  try {
    await ensureBannerSchema(DB)
    const { results } = await DB.prepare(
      `SELECT id, image_url, link, title, sort, active, start_at, end_at, created_at
       FROM wholesale_banners ORDER BY sort ASC, id ASC LIMIT 200`
    ).all()
    return c.json({ success: true, banners: results ?? [] })
  } catch (err) {
    return safeError(c, err, '배너 목록 조회 중 오류가 발생했습니다', '[admin-wholesale-banners]')
  }
})

adminBanner.post('/', rateLimit({ action: 'admin-wholesale-banner-create', max: 30, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  try {
    await ensureBannerSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const image_url = cleanUrl(body.image_url)
    if (!image_url) return c.json({ success: false, error: '이미지 URL이 올바르지 않습니다' }, 400)
    const link = cleanUrl(body.link)
    const title = String(body.title || '').trim().slice(0, 200) || null
    const sort = Number.isFinite(Number(body.sort)) ? Math.floor(Number(body.sort)) : 0
    const active = Number(body.active) === 0 ? 0 : 1
    const start_at = String(body.start_at || '').trim().slice(0, 40) || null
    const end_at = String(body.end_at || '').trim().slice(0, 40) || null
    const ins = await DB.prepare(
      'INSERT INTO wholesale_banners (image_url, link, title, sort, active, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(image_url, link, title, sort, active, start_at, end_at).run()
    const id = Number(ins.meta?.last_row_id)
    if (!id) return c.json({ success: false, error: '배너 생성 중 오류가 발생했습니다' }, 500)
    return c.json({ success: true, id })
  } catch (err) {
    return safeError(c, err, '배너 생성 중 오류가 발생했습니다', '[admin-wholesale-banners]')
  }
})

adminBanner.patch('/:id', rateLimit({ action: 'admin-wholesale-banner-update', max: 60, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 배너 ID' }, 400)
  try {
    await ensureBannerSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const sets: string[] = []
    const binds: (string | number | null)[] = []
    if ('image_url' in body) {
      const u = cleanUrl(body.image_url)
      if (!u) return c.json({ success: false, error: '이미지 URL이 올바르지 않습니다' }, 400)
      sets.push('image_url = ?'); binds.push(u)
    }
    if ('link' in body) { sets.push('link = ?'); binds.push(cleanUrl(body.link)) }
    if ('title' in body) { sets.push('title = ?'); binds.push(String(body.title || '').trim().slice(0, 200) || null) }
    if ('sort' in body) { sets.push('sort = ?'); binds.push(Number.isFinite(Number(body.sort)) ? Math.floor(Number(body.sort)) : 0) }
    if ('active' in body) { sets.push('active = ?'); binds.push(Number(body.active) === 0 ? 0 : 1) }
    if ('start_at' in body) { sets.push('start_at = ?'); binds.push(String(body.start_at || '').trim().slice(0, 40) || null) }
    if ('end_at' in body) { sets.push('end_at = ?'); binds.push(String(body.end_at || '').trim().slice(0, 40) || null) }
    if (!sets.length) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400)
    binds.push(id)
    const up = await DB.prepare(`UPDATE wholesale_banners SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run()
    if ((up.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '배너를 찾을 수 없습니다' }, 404)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '배너 수정 중 오류가 발생했습니다', '[admin-wholesale-banners]')
  }
})

adminBanner.delete('/:id', rateLimit({ action: 'admin-wholesale-banner-delete', max: 30, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 배너 ID' }, 400)
  try {
    await ensureBannerSchema(DB)
    const del = await DB.prepare('DELETE FROM wholesale_banners WHERE id = ?').bind(id).run()
    if ((del.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '배너를 찾을 수 없습니다' }, 404)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '배너 삭제 중 오류가 발생했습니다', '[admin-wholesale-banners]')
  }
})

// ════════════════════════════════════════════════════════════════════════════
// 어드민 — 제안/신고 큐  /api/admin/wholesale-proposals/*
// ════════════════════════════════════════════════════════════════════════════
const adminProposal = adminApp()

adminProposal.get('/', async (c) => {
  const { DB } = c.env
  try {
    await ensureProposalSchema(DB)
    const statusQ = String(c.req.query('status') || '').trim()
    const where = VALID_PROPOSAL_STATUS.has(statusQ) ? 'WHERE wp.status = ?' : ''
    const stmt = DB.prepare(
      `SELECT wp.id, wp.seller_id, s.name AS seller_name, s.business_name AS business_name,
              wp.type, wp.target, wp.subject, wp.body, wp.status, wp.admin_memo, wp.created_at, wp.resolved_at
       FROM wholesale_proposal_tickets wp
       LEFT JOIN sellers s ON s.id = wp.seller_id
       ${where}
       ORDER BY wp.id DESC LIMIT 200`
    )
    const { results } = where ? await stmt.bind(statusQ).all() : await stmt.all()
    return c.json({ success: true, proposals: results ?? [] })
  } catch (err) {
    return safeError(c, err, '제안/신고 조회 중 오류가 발생했습니다', '[admin-wholesale-proposals]')
  }
})

adminProposal.post('/:id/resolve', rateLimit({ action: 'admin-wholesale-proposal-resolve', max: 60, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
  try {
    await ensureProposalSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const status = String(body.status || '').trim()
    if (!VALID_PROPOSAL_STATUS.has(status)) return c.json({ success: false, error: '상태값이 올바르지 않습니다' }, 400)
    const memo = String(body.memo || '').trim().slice(0, 1000) || null
    // 처리완료/반려면 resolved_at 기록, 그 외(open/in_progress)는 NULL.
    const finalized = status === 'resolved' || status === 'rejected'

    const row = await DB.prepare('SELECT seller_id, subject FROM wholesale_proposal_tickets WHERE id = ?')
      .bind(id).first<{ seller_id: number; subject: string | null }>()
    if (!row) return c.json({ success: false, error: '제안/신고를 찾을 수 없습니다' }, 404)

    const up = await DB.prepare(
      `UPDATE wholesale_proposal_tickets
       SET status = ?, admin_memo = COALESCE(?, admin_memo), resolved_at = ${finalized ? "datetime('now')" : 'NULL'}
       WHERE id = ?`
    ).bind(status, memo, id).run()
    if ((up.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '제안/신고를 찾을 수 없습니다' }, 404)

    const statusLabel: Record<string, string> = { open: '접수', in_progress: '처리중', resolved: '처리완료', rejected: '반려' }
    createDashboardNotification(
      DB, 'seller', String(row.seller_id), 'wholesale_proposal_update', '제안/신고 처리 안내',
      `'${row.subject || ''}' 건이 ${statusLabel[status] || status} 처리되었습니다${memo ? ` (${memo})` : ''}`,
      '/wholesale/proposals',
    ).catch(swallow('wholesale-proposals:notify-seller'))

    return c.json({ success: true, status })
  } catch (err) {
    return safeError(c, err, '제안/신고 처리 중 오류가 발생했습니다', '[admin-wholesale-proposals]')
  }
})

// ════════════════════════════════════════════════════════════════════════════
// 어드민 — 프리미엄 전용관 토글  /api/admin/wholesale-products/*
// ════════════════════════════════════════════════════════════════════════════
const adminProduct = adminApp()

// GET /api/admin/wholesale-products?premium=&q=&page=&limit= — 도매(공급) 상품 목록 + 프리미엄 플래그.
//   어드민이 프리미엄 전용관 토글 + 검색용. is_supply_product=1 (도매 카탈로그) 만.
adminProduct.get('/', async (c) => {
  const { DB } = c.env
  try {
    await ensurePremiumColumn(DB)
    const premiumQ = String(c.req.query('premium') || '').trim() // '' | '0' | '1'
    const q = String(c.req.query('q') || '').trim().slice(0, 100)
    const page = Math.max(1, Number(c.req.query('page') || 1))
    const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') || 100)))
    const offset = (page - 1) * limit

    // 도매(공급) 카탈로그 = supplier 가 등록한 원본 상품(리셀 복사본 supply_source_id 제외).
    let where = 'p.is_supply_product = 1 AND p.supply_source_id IS NULL'
    const params: (string | number)[] = []
    if (premiumQ === '1') where += ' AND COALESCE(p.is_premium, 0) = 1'
    else if (premiumQ === '0') where += ' AND COALESCE(p.is_premium, 0) = 0'
    if (q) { where += ' AND (p.name LIKE ? OR s.business_name LIKE ?)'; const like = `%${q}%`; params.push(like, like) }

    const rows = await DB.prepare(
      `SELECT p.id, p.name, p.category, p.supply_price, p.is_active,
              COALESCE(p.is_premium, 0) AS is_premium,
              p.supplier_id, s.business_name AS supplier_name
         FROM products p
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         WHERE ${where}
         ORDER BY COALESCE(p.is_premium, 0) DESC, p.created_at DESC, p.id DESC
         LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all()

    const totalRow = await DB.prepare(
      `SELECT COUNT(*) AS cnt FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE ${where}`
    ).bind(...params).first<{ cnt: number }>().catch(() => null)
    const premiumRow = await DB.prepare(
      'SELECT COUNT(*) AS cnt FROM products p WHERE p.is_supply_product = 1 AND p.supply_source_id IS NULL AND COALESCE(p.is_premium, 0) = 1'
    ).first<{ cnt: number }>().catch(() => null)

    return c.json({ success: true, data: { items: rows.results ?? [], total: totalRow?.cnt ?? 0, premium_count: premiumRow?.cnt ?? 0, page, limit } })
  } catch (err) {
    return safeError(c, err, '도매 상품 목록 조회 중 오류가 발생했습니다', '[admin-wholesale-products]')
  }
})

adminProduct.post('/:id/premium', rateLimit({ action: 'admin-wholesale-premium-toggle', max: 60, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
  try {
    await ensurePremiumColumn(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const isPremium = Number(body.is_premium) === 1 ? 1 : 0
    const up = await DB.prepare('UPDATE products SET is_premium = ? WHERE id = ?').bind(isPremium, id).run()
    if ((up.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)
    return c.json({ success: true, id, is_premium: isPremium })
  } catch (err) {
    return safeError(c, err, '프리미엄 설정 중 오류가 발생했습니다', '[admin-wholesale-products]')
  }
})

// ════════════════════════════════════════════════════════════════════════════
// 어드민 — 예치금 입금계좌(admin-settable)  /api/admin/wholesale-deposit-account
// ════════════════════════════════════════════════════════════════════════════
//   platform_settings['wholesale_deposit_account'] key/value 1행. 단일 문자열(은행/계좌/예금주).
const DEPOSIT_ACCOUNT_KEY = 'wholesale_deposit_account'
const adminDepositAccount = adminApp()

adminDepositAccount.get('/', async (c) => {
  const { DB } = c.env
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = ?").bind(DEPOSIT_ACCOUNT_KEY).first<{ value: string }>().catch(() => null)
    return c.json({ success: true, deposit_account: row?.value ?? '' })
  } catch (err) {
    return safeError(c, err, '입금계좌 조회 중 오류가 발생했습니다', '[admin-wholesale-deposit-account]')
  }
})

adminDepositAccount.put('/', rateLimit({ action: 'admin-wholesale-deposit-account', max: 30, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  try {
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const value = String(body.deposit_account ?? '').trim().slice(0, 500)
    // UPSERT — 행 없으면 생성(repair-schema seed 와 동일 key). updated_at 갱신.
    await DB.prepare(
      `INSERT INTO platform_settings (key, value, description, updated_at)
       VALUES (?, ?, '도매몰 예치금 무통장입금 안내 계좌 (은행/계좌번호/예금주)', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).bind(DEPOSIT_ACCOUNT_KEY, value).run()
    return c.json({ success: true, deposit_account: value })
  } catch (err) {
    return safeError(c, err, '입금계좌 설정 중 오류가 발생했습니다', '[admin-wholesale-deposit-account]')
  }
})

/** 공개/유통사 read 에서 입금계좌 1줄 읽기(없으면 ''). deposit /me 안내박스 등 재사용. */
export async function loadWholesaleDepositAccount(DB: D1Database): Promise<string> {
  const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = ?").bind(DEPOSIT_ACCOUNT_KEY).first<{ value: string }>().catch(() => null)
  return row?.value ?? ''
}

export {
  pub as wholesaleMainPublicRoutes,
  adminBanner as adminWholesaleBannerRoutes,
  adminProposal as adminWholesaleProposalRoutes,
  adminProduct as adminWholesaleProductRoutes,
  adminDepositAccount as adminWholesaleDepositAccountRoutes,
}
