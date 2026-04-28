/**
 * 🛡️ 2026-04-28: 라이브 펀딩 API (MVP — 공개 read-only)
 *
 * 셀러용 CRUD 는 후속 PR.
 *
 * - GET /api/funding              — 진행중·마감 펀딩 목록 (?status, ?category)
 * - GET /api/funding/:id          — 펀딩 상세 + 리워드 등급
 * - GET /api/funding/:id/progress — 진행률 (실시간 polling 용)
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { calcFundingProgress, type FundingStatus } from '@/lib/live-funding'

type Bindings = { DB: D1Database }

export const fundingRoutes = new Hono<{ Bindings: Bindings }>()
fundingRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))

interface FundingRow {
  id: number
  seller_id: number
  title: string
  description: string | null
  thumbnail_url: string | null
  category: string | null
  target_amount: number
  current_amount: number
  starts_at: string | null
  ends_at: string
  expected_ship_at: string | null
  status: FundingStatus
  backer_count: number
  created_at: string
  seller_name?: string
  seller_avatar?: string | null
}

interface RewardRow {
  id: number
  funding_id: number
  title: string
  description: string | null
  amount: number
  stock: number | null
  claimed: number
  display_order: number
}

// ── GET /api/funding ──────────────────────────────────────────────
fundingRoutes.get('/', async (c) => {
  const status = c.req.query('status') || 'live'
  const category = c.req.query('category')

  const params: unknown[] = []
  let where = `WHERE 1=1`
  if (status === 'all') {
    // no filter
  } else {
    where += ` AND f.status = ?`
    params.push(status)
  }
  if (category) {
    where += ` AND f.category = ?`
    params.push(category)
  }

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT f.*, s.name as seller_name, s.profile_image as seller_avatar
      FROM live_fundings f
      LEFT JOIN sellers s ON s.id = f.seller_id
      ${where}
      ORDER BY
        CASE WHEN f.status = 'live' THEN 0 ELSE 1 END,
        f.created_at DESC
      LIMIT 50
    `).bind(...params).all<FundingRow>()

    return c.json({ success: true, data: results || [] })
  } catch (err) {
    if ((err as Error).message?.includes('no such table')) {
      return c.json({ success: true, data: [] })
    }
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ── GET /api/funding/:id ─────────────────────────────────────────
fundingRoutes.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)

  try {
    const funding = await c.env.DB.prepare(`
      SELECT f.*, s.name as seller_name, s.profile_image as seller_avatar
      FROM live_fundings f
      LEFT JOIN sellers s ON s.id = f.seller_id
      WHERE f.id = ?
    `).bind(id).first<FundingRow>()
    if (!funding) return c.json({ success: false, error: '펀딩을 찾을 수 없습니다' }, 404)

    const { results: rewards } = await c.env.DB.prepare(`
      SELECT id, funding_id, title, description, amount, stock, claimed, display_order
      FROM funding_rewards
      WHERE funding_id = ?
      ORDER BY display_order ASC, amount ASC
    `).bind(id).all<RewardRow>()

    const progress = calcFundingProgress(
      funding.current_amount,
      funding.target_amount,
      Date.parse(funding.ends_at),
    )

    return c.json({
      success: true,
      data: { ...funding, rewards: rewards || [], progress },
    })
  } catch (err) {
    if ((err as Error).message?.includes('no such table')) {
      return c.json({ success: false, error: '펀딩 시스템이 아직 활성화되지 않았어요' }, 503)
    }
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ── GET /api/funding/:id/progress ────────────────────────────────
fundingRoutes.get('/:id/progress', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)

  try {
    const f = await c.env.DB.prepare(
      'SELECT current_amount, target_amount, ends_at, status, backer_count FROM live_fundings WHERE id = ?'
    ).bind(id).first<{
      current_amount: number; target_amount: number; ends_at: string;
      status: FundingStatus; backer_count: number;
    }>()
    if (!f) return c.json({ success: false, error: '펀딩을 찾을 수 없습니다' }, 404)

    const progress = calcFundingProgress(
      f.current_amount, f.target_amount, Date.parse(f.ends_at)
    )
    return c.json({
      success: true,
      data: { ...progress, current_amount: f.current_amount, target_amount: f.target_amount, backer_count: f.backer_count, status: f.status }
    })
  } catch (err) {
    if ((err as Error).message?.includes('no such table')) {
      return c.json({ success: false, error: 'not available' }, 503)
    }
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})
