/**
 * 🎟️ 공구 제안 — 양방향 (2026-07-06 공구 엔진 §2-B)
 *   방향 B1: 인플루언서 → 매장 제안 → 매장 승인
 *   방향 B2: 매장 → 특정 인플루언서 협업 제안 → 인플루언서 승인
 *   상대방이 승인하면 그 조건으로 gb 세션 open(proposerId=인플루언서 = 우선/전용 링크 주체).
 *   ⚠️ 게이트 platform_settings.gb_engine_enabled. 잠금 파일 미변경(전용 라우트).
 */
import { Hono } from 'hono'
import type { Env } from '../../../worker/types/env'
import { requireAuth } from '../../../worker/middleware/auth'
import { getSellerIdFromToken } from '../../../lib/seller-shared'
import { isVoucherCategory } from '../../../shared/constants/voucher-categories'
import { validateGbSession, type GbSession } from '../../../shared/gb-session'
import { saveGbSession } from '../../../worker/utils/gb-session-store'
import { ensureGbProposalsTable, type GbProposalRow } from '../../../worker/utils/gb-proposals-store'

const app = new Hono<{ Bindings: Env }>()

function authUserId(c: { get?: (k: string) => unknown }): number | null {
  const user = c.get?.('user') as { id?: number } | undefined
  const raw = user?.id ?? c.get?.('userId')
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function gbEngineOn(db: D1Database): Promise<boolean> {
  const row = await db.prepare("SELECT value FROM platform_settings WHERE key = 'gb_engine_enabled'")
    .first<{ value: string }>().catch(() => null)
  return row?.value === 'true'
}

interface ProdRow { id: number; seller_id: number | null; price: number; category: string; name: string }
async function loadVoucher(db: D1Database, productId: number): Promise<ProdRow | null> {
  if (!Number.isFinite(productId) || productId <= 0) return null
  const p = await db.prepare('SELECT id, seller_id, price, category, name FROM products WHERE id = ? AND is_active = 1')
    .bind(productId).first<ProdRow>().catch(() => null)
  if (!p || !isVoucherCategory(p.category)) return null
  return p
}

/** 제안 조건 → GbSession 빌드 + 검증. */
function buildSession(row: Pick<GbProposalRow, 'deadline' | 'price' | 'promo_pct' | 'target' | 'influencer_id'>): GbSession {
  const startLater = false // 제안 승인은 즉시 시작(예약은 향후)
  return {
    mode: startLater ? 'scheduled' : 'live',
    startAt: null,
    deadline: row.deadline ?? null,
    price: row.price ?? null,
    promoPct: row.promo_pct ?? null,
    target: row.target ?? null,
    linkOnly: false,
    proposerId: String(row.influencer_id),
  }
}

// 승인 공통 — CAS(proposed→approved) 후 gb open. (side-effect 전 상태 선점 = 이중 승인 방지)
async function approveAndOpen(db: D1Database, row: GbProposalRow, note: string | null): Promise<{ ok: boolean; error?: string }> {
  const prod = await loadVoucher(db, row.product_id)
  if (!prod) return { ok: false, error: '상품을 찾을 수 없습니다' }
  const session = buildSession(row)
  const v = validateGbSession(session, Number(prod.price))
  if (!v.ok) return { ok: false, error: v.error }
  const cas = await db.prepare(
    "UPDATE gb_proposals SET status='approved', responded_at=datetime('now'), response_note=? WHERE id=? AND status='proposed'"
  ).bind(note, row.id).run().catch(() => null)
  if (!cas || cas.meta.changes === 0) return { ok: false, error: '이미 처리된 제안입니다' }
  await saveGbSession(db, row.product_id, session)
  return { ok: true }
}

// ─────────────── 인플루언서 측 (소비자 세션) ───────────────

// POST / — 인플루언서 → 매장 제안
app.post('/', requireAuth(), async (c) => {
  try {
    const db = c.env.DB
    if (!(await gbEngineOn(db))) return c.json({ success: false, error: '공구 엔진 비활성', code: 'GB_ENGINE_OFF' }, 403)
    const uid = authUserId(c)
    if (!uid) return c.json({ success: false, error: '로그인 필요' }, 401)
    await ensureGbProposalsTable(db)
    const b: { product_id?: number; deadline?: string; price?: number; promo_pct?: number; target?: number; message?: string } = await c.req.json().catch(() => ({}))
    const prod = await loadVoucher(db, Number(b.product_id))
    if (!prod) return c.json({ success: false, error: '이용권 상품을 찾을 수 없습니다' }, 404)
    const session = buildSession({ deadline: b.deadline ?? null, price: b.price ?? null, promo_pct: b.promo_pct ?? null, target: b.target ?? null, influencer_id: String(uid) })
    const v = validateGbSession(session, Number(prod.price))
    if (!v.ok) return c.json({ success: false, error: v.error }, 400)
    await db.prepare(
      "INSERT INTO gb_proposals (product_id, seller_id, influencer_id, proposed_by, deadline, price, promo_pct, target, message, status) VALUES (?,?,?,'influencer',?,?,?,?,?,'proposed')"
    ).bind(prod.id, prod.seller_id, String(uid), b.deadline ?? null, b.price ?? null, b.promo_pct ?? null, b.target ?? null, (b.message || '').slice(0, 500) || null).run()
    if (prod.seller_id) {
      const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
      createDashboardNotification(db, 'seller', String(prod.seller_id), 'gb_proposal', '새 공구 제안', `인플루언서가 "${prod.name}" 공구를 제안했어요`, '/seller/group-buy').catch(() => {})
    }
    return c.json({ success: true })
  } catch { return c.json({ success: false, error: '제안 중 오류가 발생했습니다' }, 500) }
})

// GET /mine — 내(인플루언서) 관련 제안 (내가 낸 것 + 매장이 내게 보낸 것)
app.get('/mine', requireAuth(), async (c) => {
  try {
    const db = c.env.DB
    const uid = authUserId(c)
    if (!uid) return c.json({ success: false, error: '로그인 필요' }, 401)
    await ensureGbProposalsTable(db)
    const { results } = await db.prepare(
      "SELECT gp.*, p.name AS product_name, p.image_url FROM gb_proposals gp LEFT JOIN products p ON gp.product_id = p.id WHERE gp.influencer_id = ? ORDER BY gp.created_at DESC LIMIT 100"
    ).bind(String(uid)).all().catch(() => ({ results: [] }))
    return c.json({ success: true, data: results || [] })
  } catch { return c.json({ success: false, error: '조회 오류' }, 500) }
})

// POST /:id/respond — 인플루언서가 '매장→인플' 제안에 응답 (approve|reject)
app.post('/:id/respond', requireAuth(), async (c) => {
  try {
    const db = c.env.DB
    if (!(await gbEngineOn(db))) return c.json({ success: false, error: '공구 엔진 비활성', code: 'GB_ENGINE_OFF' }, 403)
    const uid = authUserId(c)
    if (!uid) return c.json({ success: false, error: '로그인 필요' }, 401)
    await ensureGbProposalsTable(db)
    const id = Number(c.req.param('id'))
    const b: { action?: 'approve' | 'reject'; note?: string } = await c.req.json().catch(() => ({}))
    const row = await db.prepare("SELECT * FROM gb_proposals WHERE id = ? AND influencer_id = ? AND proposed_by = 'seller'")
      .bind(id, String(uid)).first<GbProposalRow>().catch(() => null)
    if (!row) return c.json({ success: false, error: '제안을 찾을 수 없습니다' }, 404)
    if (row.status !== 'proposed') return c.json({ success: false, error: '이미 처리된 제안입니다' }, 400)
    const note = (b.note || '').slice(0, 300) || null
    if (b.action === 'reject') {
      const cas = await db.prepare("UPDATE gb_proposals SET status='rejected', responded_at=datetime('now'), response_note=? WHERE id=? AND status='proposed'").bind(note, id).run().catch(() => null)
      if (!cas || cas.meta.changes === 0) return c.json({ success: false, error: '이미 처리됨' }, 400)
    } else {
      const r = await approveAndOpen(db, row, note)
      if (!r.ok) return c.json({ success: false, error: r.error }, 400)
    }
    if (row.seller_id) {
      const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
      createDashboardNotification(db, 'seller', String(row.seller_id), 'gb_proposal_response', b.action === 'reject' ? '공구 제안 거절됨' : '공구 제안 수락 · 공구 시작', '', '/seller/group-buy').catch(() => {})
    }
    return c.json({ success: true })
  } catch { return c.json({ success: false, error: '응답 오류' }, 500) }
})

// ─────────────── 매장 측 (셀러 JWT) ───────────────

// POST /seller — 매장 → 특정 인플루언서 협업 제안
app.post('/seller', async (c) => {
  try {
    const db = c.env.DB
    if (!(await gbEngineOn(db))) return c.json({ success: false, error: '공구 엔진 비활성', code: 'GB_ENGINE_OFF' }, 403)
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '로그인 필요' }, 401)
    await ensureGbProposalsTable(db)
    const b: { product_id?: number; influencer_handle?: string; deadline?: string; price?: number; promo_pct?: number; target?: number; message?: string } = await c.req.json().catch(() => ({}))
    const prod = await db.prepare("SELECT id, seller_id, price, category, name FROM products WHERE id = ? AND seller_id = ?")
      .bind(Number(b.product_id), sellerId).first<ProdRow>().catch(() => null)
    if (!prod || !isVoucherCategory(prod.category)) return c.json({ success: false, error: '내 이용권 상품이 아닙니다' }, 404)
    const handle = String(b.influencer_handle || '').replace(/^@/, '').trim()
    if (!handle) return c.json({ success: false, error: '인플루언서 핸들을 입력해주세요' }, 400)
    const inf = await db.prepare('SELECT id FROM users WHERE handle = ?').bind(handle).first<{ id: number }>().catch(() => null)
    if (!inf) return c.json({ success: false, error: '해당 핸들의 유저를 찾을 수 없습니다' }, 404)
    const session = buildSession({ deadline: b.deadline ?? null, price: b.price ?? null, promo_pct: b.promo_pct ?? null, target: b.target ?? null, influencer_id: String(inf.id) })
    const v = validateGbSession(session, Number(prod.price))
    if (!v.ok) return c.json({ success: false, error: v.error }, 400)
    await db.prepare(
      "INSERT INTO gb_proposals (product_id, seller_id, influencer_id, proposed_by, deadline, price, promo_pct, target, message, status) VALUES (?,?,?,'seller',?,?,?,?,?,'proposed')"
    ).bind(prod.id, Number(sellerId), String(inf.id), b.deadline ?? null, b.price ?? null, b.promo_pct ?? null, b.target ?? null, (b.message || '').slice(0, 500) || null).run()
    const { notifyUser } = await import('../../../lib/notifications')
    notifyUser(db, String(inf.id), 'gb_proposal', '공구 협업 제안', `"${prod.name}" 매장이 공구 협업을 제안했어요`, '/gb-market').catch(() => {})
    return c.json({ success: true })
  } catch { return c.json({ success: false, error: '제안 중 오류가 발생했습니다' }, 500) }
})

// GET /seller/list — 매장 관련 제안 (내가 받은 인플 제안 + 내가 보낸 인플 협업)
app.get('/seller/list', async (c) => {
  try {
    const db = c.env.DB
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '로그인 필요' }, 401)
    await ensureGbProposalsTable(db)
    const { results } = await db.prepare(
      "SELECT gp.*, p.name AS product_name, u.handle AS influencer_handle FROM gb_proposals gp LEFT JOIN products p ON gp.product_id = p.id LEFT JOIN users u ON CAST(gp.influencer_id AS INTEGER) = u.id WHERE gp.seller_id = ? ORDER BY gp.created_at DESC LIMIT 100"
    ).bind(Number(sellerId)).all().catch(() => ({ results: [] }))
    return c.json({ success: true, data: results || [] })
  } catch { return c.json({ success: false, error: '조회 오류' }, 500) }
})

// POST /seller/:id/respond — 매장이 '인플→매장' 제안에 응답 (approve|reject)
app.post('/seller/:id/respond', async (c) => {
  try {
    const db = c.env.DB
    if (!(await gbEngineOn(db))) return c.json({ success: false, error: '공구 엔진 비활성', code: 'GB_ENGINE_OFF' }, 403)
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '로그인 필요' }, 401)
    await ensureGbProposalsTable(db)
    const id = Number(c.req.param('id'))
    const b: { action?: 'approve' | 'reject'; note?: string } = await c.req.json().catch(() => ({}))
    const row = await db.prepare("SELECT * FROM gb_proposals WHERE id = ? AND seller_id = ? AND proposed_by = 'influencer'")
      .bind(id, Number(sellerId)).first<GbProposalRow>().catch(() => null)
    if (!row) return c.json({ success: false, error: '제안을 찾을 수 없습니다' }, 404)
    if (row.status !== 'proposed') return c.json({ success: false, error: '이미 처리된 제안입니다' }, 400)
    const note = (b.note || '').slice(0, 300) || null
    if (b.action === 'reject') {
      const cas = await db.prepare("UPDATE gb_proposals SET status='rejected', responded_at=datetime('now'), response_note=? WHERE id=? AND status='proposed'").bind(note, id).run().catch(() => null)
      if (!cas || cas.meta.changes === 0) return c.json({ success: false, error: '이미 처리됨' }, 400)
    } else {
      const r = await approveAndOpen(db, row, note)
      if (!r.ok) return c.json({ success: false, error: r.error }, 400)
    }
    const { notifyUser } = await import('../../../lib/notifications')
    notifyUser(db, String(row.influencer_id), 'gb_proposal_response', b.action === 'reject' ? '공구 제안 거절' : '공구 제안 수락 · 공구 시작', '', '/gb-market').catch(() => {})
    return c.json({ success: true })
  } catch { return c.json({ success: false, error: '응답 오류' }, 500) }
})

export { app as gbProposalsRoutes }
