/**
 * 🏭 2026-06-10 (사용자 요청 — Sellpie 형 통합 게시판 + 찜리스트) — 도매몰 부가 기능.
 *
 * 마운트 (worker/index.ts):
 *   app.route('/api/wholesale/board', wholesaleBoardPublicRoutes)      — 공지/자료실 목록·상세 (공개 읽기)
 *   app.route('/api/wholesale/wishlist', wholesaleWishlistRoutes)      — 찜 (판매사 로그인 전용)
 *   app.route('/api/admin/wholesale-board', adminWholesaleBoardRoutes) — 게시글 CRUD (어드민)
 *
 * 테이블 (lazy DDL — D1 migration CI 부재, repair-schema 에도 동일 등록):
 *   wholesale_board_posts(id, board_type 'notice'|'archive', mall_id, title, body,
 *     product_id(자료실 연결 상품), is_pinned, view_count, created_at, updated_at)
 *   wholesale_wishlists(id, seller_id, product_id, mall_id, created_at, UNIQUE(seller_id, product_id))
 *
 * 신고/제안(최저가 미준수 등)은 기존 wholesale_proposal_tickets(/api/wholesale/proposal-tickets) 재사용.
 */
import { Hono } from 'hono'
import { sellerIdFrom } from '@/worker/utils/seller-auth'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { adminIpWhitelist, adminAuditMiddleware } from '@/worker/middleware/admin-security'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { swallow } from '@/worker/utils/swallow'
import { resolveMallId } from './wholesale-malls'
import { resolveDistributorPrice } from '@/lib/distributor-pricing'
import { loadGradeTable, loadSellerGrade } from './wholesale.routes'

type D1Database = Env['DB']

// ── 공유 헬퍼 (wholesale-main.routes 와 동일 패턴) ───────────────────────────
// sellerIdFrom: 공용 유틸 `@/worker/utils/seller-auth` 로 이동(상단 import) — 중복 정의 제거.

const VALID_BOARD_TYPE = new Set(['notice', 'archive', 'shipping'])

let _boardEnsured = false
async function ensureBoardSchema(DB: D1Database): Promise<void> {
  if (_boardEnsured) return
  _boardEnsured = true
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_board_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_type TEXT NOT NULL DEFAULT 'notice',
    mall_id INTEGER DEFAULT 1,
    title TEXT NOT NULL,
    body TEXT,
    product_id INTEGER,
    is_pinned INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
  )`).run().catch(swallow('wholesale-board:create'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_board_type ON wholesale_board_posts(board_type, is_pinned DESC, id DESC)').run().catch(swallow('wholesale-board:idx'))
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_wishlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    mall_id INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(seller_id, product_id)
  )`).run().catch(swallow('wholesale-wishlist:create'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_wishlists_seller ON wholesale_wishlists(seller_id, id DESC)').run().catch(swallow('wholesale-wishlist:idx'))
}

// ════════════════════════════════════════════════════════════════════════════
// 공개 — 게시판 읽기  /api/wholesale/board/*
// ════════════════════════════════════════════════════════════════════════════
const pub = new Hono<{ Bindings: Env }>()

// GET /posts?type=notice|archive&page=1 — 목록 (몰 스코프, 고정글 우선)
pub.get('/posts', async (c) => {
  const { DB } = c.env
  try {
    await ensureBoardSchema(DB)
    const type = String(c.req.query('type') || 'notice')
    if (!VALID_BOARD_TYPE.has(type)) return c.json({ success: false, error: '게시판 유형 오류' }, 400)
    const page = Math.max(1, Number(c.req.query('page') || 1) || 1)
    const limit = 20
    const mallId = await resolveMallId(c)
    const { results } = await DB.prepare(
      `SELECT b.id, b.board_type, b.title, b.is_pinned, b.view_count, b.created_at, b.product_id,
              p.name AS product_name, p.image_url AS product_image
       FROM wholesale_board_posts b
       LEFT JOIN products p ON p.id = b.product_id
       WHERE b.board_type = ? AND COALESCE(b.mall_id,1) = ?
       ORDER BY b.is_pinned DESC, b.id DESC LIMIT ? OFFSET ?`
    ).bind(type, mallId, limit + 1, (page - 1) * limit).all()
    const rows = (results ?? []) as Record<string, unknown>[]
    c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
    return c.json({ success: true, posts: rows.slice(0, limit), has_more: rows.length > limit })
  } catch (err) {
    return safeError(c, err, '게시글 목록 조회 중 오류가 발생했습니다', '[wholesale-board]')
  }
})

// GET /posts/:id — 상세 (+조회수). 자료실이면 연결 상품의 이미지 목록 동봉(다운로드용).
pub.get('/posts/:id', async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
  try {
    await ensureBoardSchema(DB)
    const post = await DB.prepare(
      `SELECT b.*, p.name AS product_name, p.image_url AS product_image, p.images AS product_images
       FROM wholesale_board_posts b
       LEFT JOIN products p ON p.id = b.product_id
       WHERE b.id = ?`
    ).bind(id).first<Record<string, unknown>>()
    if (!post) return c.json({ success: false, error: '게시글이 없습니다' }, 404)
    // 조회수 — fire-and-forget (응답 지연 0)
    if (c.executionCtx) c.executionCtx.waitUntil(
      DB.prepare('UPDATE wholesale_board_posts SET view_count = COALESCE(view_count,0) + 1 WHERE id = ?').bind(id).run().then(() => {}, swallow('wholesale-board:view'))
    )
    // 자료실: 다운로드 가능한 이미지 URL 목록 (대표 + 상세 images JSON)
    let downloads: string[] = []
    if (post.board_type === 'archive') {
      if (typeof post.product_image === 'string' && post.product_image) downloads.push(post.product_image)
      try {
        const more = JSON.parse(String(post.product_images || '[]'))
        if (Array.isArray(more)) downloads = downloads.concat(more.filter((u: unknown) => typeof u === 'string' && !!u))
      } catch { /* images JSON 아님 — 대표만 */ }
      downloads = [...new Set(downloads)].slice(0, 30)
    }
    return c.json({ success: true, post, downloads })
  } catch (err) {
    return safeError(c, err, '게시글 조회 중 오류가 발생했습니다', '[wholesale-board]')
  }
})

// ════════════════════════════════════════════════════════════════════════════
// 찜리스트 — 판매사 로그인 전용  /api/wholesale/wishlist/*
// ════════════════════════════════════════════════════════════════════════════
const wish = new Hono<{ Bindings: Env }>()

// GET / — 내 찜 (상품 카드 정보 포함)
wish.get('/', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureBoardSchema(DB)
    // ⚠️ supply_price(제조사 공급원가)·supplier_id 는 응답에 노출 X — 등급 공급가(distributor_price) 산출용으로만 SELECT.
    const { results } = await DB.prepare(
      `SELECT w.product_id, w.created_at,
              p.name, p.image_url, p.category, p.brand_name, p.price AS retail_price, p.is_active,
              COALESCE(p.supply_price, 0) AS supply_price, p.supply_margin_override_pct AS margin_override,
              COALESCE(p.is_supply_product, 0) AS is_supply_product, COALESCE(p.stock, 0) AS stock
       FROM wholesale_wishlists w
       LEFT JOIN products p ON p.id = w.product_id
       WHERE w.seller_id = ?
       ORDER BY w.id DESC LIMIT 200`
    ).bind(sellerId).all<{
      product_id: number; created_at: string; name: string | null; image_url: string | null
      category: string | null; brand_name: string | null; retail_price: number | null; is_active: number | null
      supply_price: number; margin_override: number | null; is_supply_product: number; stock: number
    }>()
    const rows = results ?? []
    // 🏷️ 등급 공급가 enrich — 카탈로그와 동일 SSOT(resolveDistributorPrice). 공급상품이고 원가>0 일 때만.
    const [sg, table] = await Promise.all([loadSellerGrade(DB, sellerId), loadGradeTable(DB)])
    const items = rows.map((r) => {
      const distributor_price = r.is_supply_product && r.supply_price > 0
        ? resolveDistributorPrice({ baseSupplyPrice: r.supply_price, retailPrice: r.retail_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override }).price
        : null
      return {
        product_id: r.product_id, created_at: r.created_at, name: r.name, image_url: r.image_url,
        category: r.category, brand_name: r.brand_name, retail_price: r.retail_price || null,
        is_active: r.is_active, stock: r.stock, distributor_price,
      }
    })
    return c.json({ success: true, items })
  } catch (err) {
    return safeError(c, err, '찜 목록 조회 중 오류가 발생했습니다', '[wholesale-wishlist]')
  }
})

// POST /:productId/toggle — 찜 토글 (멱등)
wish.post('/:productId/toggle', rateLimit({ action: 'wholesale-wishlist-toggle', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const productId = Number(c.req.param('productId'))
  if (!Number.isFinite(productId) || productId <= 0) return c.json({ success: false, error: '잘못된 상품' }, 400)
  const { DB } = c.env
  try {
    await ensureBoardSchema(DB)
    const del = await DB.prepare('DELETE FROM wholesale_wishlists WHERE seller_id = ? AND product_id = ?').bind(sellerId, productId).run()
    if ((del.meta?.changes ?? 0) > 0) return c.json({ success: true, wished: false })
    const mallId = await resolveMallId(c)
    await DB.prepare('INSERT OR IGNORE INTO wholesale_wishlists (seller_id, product_id, mall_id) VALUES (?, ?, ?)').bind(sellerId, productId, mallId).run()
    return c.json({ success: true, wished: true })
  } catch (err) {
    return safeError(c, err, '찜 처리 중 오류가 발생했습니다', '[wholesale-wishlist]')
  }
})

// ════════════════════════════════════════════════════════════════════════════
// 어드민 — 게시글 CRUD  /api/admin/wholesale-board/*
// ════════════════════════════════════════════════════════════════════════════
const adminBoard = new Hono<{ Bindings: Env }>()
adminBoard.use('*', adminIpWhitelist())
adminBoard.use('*', requireAdmin())
adminBoard.use('*', adminAuditMiddleware())

adminBoard.get('/', async (c) => {
  const { DB } = c.env
  try {
    await ensureBoardSchema(DB)
    const type = String(c.req.query('type') || '')
    const conds: string[] = []
    const binds: (string | number)[] = []
    if (VALID_BOARD_TYPE.has(type)) { conds.push('b.board_type = ?'); binds.push(type) }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const { results } = await DB.prepare(
      `SELECT b.*, p.name AS product_name FROM wholesale_board_posts b
       LEFT JOIN products p ON p.id = b.product_id ${where}
       ORDER BY b.id DESC LIMIT 200`
    ).bind(...binds).all()
    return c.json({ success: true, posts: results ?? [] })
  } catch (err) {
    return safeError(c, err, '게시글 조회 중 오류가 발생했습니다', '[admin-wholesale-board]')
  }
})

adminBoard.post('/', async (c) => {
  const { DB } = c.env
  try {
    await ensureBoardSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const type = String(body.board_type || 'notice')
    if (!VALID_BOARD_TYPE.has(type)) return c.json({ success: false, error: '게시판 유형 오류 (notice/archive)' }, 400)
    const title = String(body.title || '').trim().slice(0, 200)
    if (!title) return c.json({ success: false, error: '제목을 입력해주세요' }, 400)
    const text = String(body.body || '').trim().slice(0, 20000) || null
    const productId = Number(body.product_id) || null
    if (type === 'archive' && !productId) return c.json({ success: false, error: '자료실 게시글은 연결 상품 ID 가 필요합니다' }, 400)
    const mallId = Math.max(1, Number(body.mall_id) || 1)
    const pinned = body.is_pinned ? 1 : 0
    const ins = await DB.prepare(
      'INSERT INTO wholesale_board_posts (board_type, mall_id, title, body, product_id, is_pinned) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(type, mallId, title, text, productId, pinned).run()
    return c.json({ success: true, id: Number(ins.meta?.last_row_id) })
  } catch (err) {
    return safeError(c, err, '게시글 등록 중 오류가 발생했습니다', '[admin-wholesale-board]')
  }
})

adminBoard.patch('/:id', async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
  try {
    await ensureBoardSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const sets: string[] = []
    const binds: (string | number | null)[] = []
    if (body.title !== undefined) { const v = String(body.title).trim().slice(0, 200); if (!v) return c.json({ success: false, error: '제목 오류' }, 400); sets.push('title = ?'); binds.push(v) }
    if (body.body !== undefined) { sets.push('body = ?'); binds.push(String(body.body).trim().slice(0, 20000) || null) }
    if (body.product_id !== undefined) { sets.push('product_id = ?'); binds.push(Number(body.product_id) || null) }
    if (body.is_pinned !== undefined) { sets.push('is_pinned = ?'); binds.push(body.is_pinned ? 1 : 0) }
    if (sets.length === 0) return c.json({ success: false, error: '변경 사항 없음' }, 400)
    sets.push("updated_at = datetime('now')")
    binds.push(id)
    const r = await DB.prepare(`UPDATE wholesale_board_posts SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run()
    if ((r.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '게시글이 없습니다' }, 404)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '게시글 수정 중 오류가 발생했습니다', '[admin-wholesale-board]')
  }
})

adminBoard.delete('/:id', async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
  try {
    await ensureBoardSchema(DB)
    await DB.prepare('DELETE FROM wholesale_board_posts WHERE id = ?').bind(id).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '게시글 삭제 중 오류가 발생했습니다', '[admin-wholesale-board]')
  }
})

export {
  pub as wholesaleBoardPublicRoutes,
  wish as wholesaleWishlistRoutes,
  adminBoard as adminWholesaleBoardRoutes,
}
