/**
 * 맛집 추천 API
 *
 * 일반 유저가 맛집을 추천 → 어드민이 승인/반려 → 승인 시 딜포인트 지급
 *
 * 엔드포인트 (유저):
 *   POST /api/restaurants/recommend              - 맛집 추천 제출 (로그인 필수)
 *   GET  /api/restaurants/recommendations        - 승인된 맛집 목록 (공개)
 *
 * 엔드포인트 (어드민 — /api/admin 하위):
 *   GET  /restaurant-recommendations             - 전체 목록 (status 필터)
 *   POST /restaurant-recommendations/:id/approve - 승인 + 딜포인트 지급
 *   POST /restaurant-recommendations/:id/reject  - 반려
 *
 * 보상:
 *   - platform_settings key='restaurant_recommendation_reward' (기본 1000딜)
 *   - 어드민이 /api/admin/platform-settings 에서 조정 가능
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireAuth, requireAdmin, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { logError } from '@/worker/utils/logger'

// ── 유저용 라우터 ──────────────────────────────────────────────────────────────
export const restaurantRecommendRoutes = new Hono<{ Bindings: Env }>()

restaurantRecommendRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}))

let _tablesEnsured = false
async function ensureTables(DB: D1Database) {
  if (_tablesEnsured) return
  _tablesEnsured = true
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS restaurant_recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        address TEXT,
        category TEXT,
        description TEXT,
        image_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
        reward_points INTEGER DEFAULT 0,
        admin_note TEXT,
        created_at DATETIME DEFAULT (datetime('now')),
        reviewed_at DATETIME
      )
    `).run()
  } catch { /* exists */ }
  try {
    await DB.prepare(`
      INSERT OR IGNORE INTO platform_settings (key, value, description)
      VALUES ('restaurant_recommendation_reward', '1000', '맛집 추천 승인 시 지급 딜포인트')
    `).run()
  } catch { /* platform_settings may not exist yet — reward will use default */ }
}

async function getRewardPoints(DB: D1Database): Promise<number> {
  try {
    const row = await DB.prepare(
      "SELECT value FROM platform_settings WHERE key = 'restaurant_recommendation_reward'"
    ).first<{ value: string }>()
    if (row) return Math.max(0, Number(row.value))
  } catch { /* table may not exist */ }
  return 1000
}

// ── POST /api/restaurants/recommend ──────────────────────────────────────────
restaurantRecommendRoutes.post(
  '/recommend',
  rateLimit({ action: 'restaurant_recommend', max: 3, windowSec: 3600 }),
  requireAuth(),
  async (c) => {
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

    const { DB } = c.env
    await ensureTables(DB)

    const body = await c.req.json<{
      name: string
      address?: string
      category?: string
      description?: string
      image_url?: string
    }>()
    const name = body.name?.trim()

    if (!name || name.length > 100) {
      return c.json({ success: false, error: '식당 이름을 입력해주세요 (100자 이내)' }, 400)
    }

    const userId = String(user.id)

    // 최근 7일 내 동일 식당명 중복 제출 방지
    const dup = await DB.prepare(
      "SELECT id FROM restaurant_recommendations WHERE user_id = ? AND name = ? AND created_at > datetime('now', '-7 days')"
    ).bind(userId, name).first()
    if (dup) {
      return c.json({ success: false, error: '이미 최근에 같은 식당을 추천하셨습니다' }, 409)
    }

    await DB.prepare(
      'INSERT INTO restaurant_recommendations (user_id, name, address, category, description, image_url) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      userId,
      name,
      body.address?.trim() || null,
      body.category?.trim() || null,
      body.description?.trim() || null,
      body.image_url?.trim() || null,
    ).run()

    const rewardPoints = await getRewardPoints(DB)
    return c.json({
      success: true,
      message: `맛집 추천이 접수되었습니다. 승인 시 ${rewardPoints}딜을 드립니다!`,
    })
  }
)

// ── GET /api/restaurants/recommendations — 승인된 맛집 공개 목록 ──────────────
restaurantRecommendRoutes.get('/recommendations', async (c) => {
  const { DB } = c.env
  await ensureTables(DB)

  const limit = Math.min(Math.max(1, Number(c.req.query('limit')) || 20), 50)
  const offset = Math.max(0, Number(c.req.query('offset')) || 0)
  const category = c.req.query('category')

  let sql = "SELECT id, name, address, category, description, image_url, created_at FROM restaurant_recommendations WHERE status = 'approved'"
  const bindings: (string | number)[] = []
  if (category) {
    sql += ' AND category = ?'
    bindings.push(category)
  }
  sql += ' ORDER BY reviewed_at DESC LIMIT ? OFFSET ?'
  bindings.push(limit, offset)

  const { results } = await DB.prepare(sql).bind(...bindings).all()
  return c.json({ success: true, data: results })
})

// ── 어드민용 라우터 ─────────────────────────────────────────────────────────────
export const adminRestaurantRecommendRoutes = new Hono<{ Bindings: Env }>()

adminRestaurantRecommendRoutes.use('*', requireAdmin())

// GET /api/admin/restaurant-recommendations
adminRestaurantRecommendRoutes.get('/restaurant-recommendations', async (c) => {
  const { DB } = c.env
  await ensureTables(DB)

  const status = c.req.query('status') || 'pending'
  const limit = Math.min(Math.max(1, Number(c.req.query('limit')) || 50), 200)
  const offset = Math.max(0, Number(c.req.query('offset')) || 0)

  const allowed = ['pending', 'approved', 'rejected']
  const safeStatus = allowed.includes(status) ? status : 'pending'

  const { results } = await DB.prepare(`
    SELECT r.*, u.name AS user_name
    FROM restaurant_recommendations r
    LEFT JOIN users u ON r.user_id = CAST(u.id AS TEXT)
    WHERE r.status = ?
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(safeStatus, limit, offset).all()

  const rewardPoints = await getRewardPoints(DB)
  return c.json({ success: true, data: results, reward_points: rewardPoints })
})

// POST /api/admin/restaurant-recommendations/:id/approve
adminRestaurantRecommendRoutes.post('/restaurant-recommendations/:id/approve', async (c) => {
  const { DB } = c.env
  await ensureTables(DB)

  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '유효하지 않은 ID' }, 400)

  const rec = await DB.prepare(
    'SELECT id, user_id, name, status FROM restaurant_recommendations WHERE id = ?'
  ).bind(id).first<{ id: number; user_id: string; name: string; status: string }>()

  if (!rec) return c.json({ success: false, error: '추천이 존재하지 않습니다' }, 404)
  if (rec.status !== 'pending') return c.json({ success: false, error: '이미 처리된 추천입니다' }, 409)

  const rewardPoints = await getRewardPoints(DB)
  const body2 = await c.req.json<{ admin_note?: string }>().catch(() => ({ admin_note: '' }))
  const adminNote = body2.admin_note || null

  await DB.prepare(
    "UPDATE restaurant_recommendations SET status = 'approved', reward_points = ?, admin_note = ?, reviewed_at = datetime('now') WHERE id = ?"
  ).bind(rewardPoints, adminNote, id).run()

  // 딜포인트 지급 (원자적 UPSERT)
  if (rewardPoints > 0) {
    try {
      await DB.prepare(`
        INSERT INTO user_points (user_id, balance, total_charged, total_donated)
        VALUES (?, ?, 0, 0)
        ON CONFLICT(user_id) DO UPDATE SET
          balance = balance + excluded.balance,
          updated_at = CURRENT_TIMESTAMP
      `).bind(rec.user_id, rewardPoints).run()
    } catch (e) {
      logError('restaurant_recommend.approve.upsert_failed', { error: (e as Error)?.message })
    }
  }

  return c.json({ success: true, message: `승인 완료. ${rewardPoints}딜 지급.`, reward_points: rewardPoints })
})

// POST /api/admin/restaurant-recommendations/:id/reject
adminRestaurantRecommendRoutes.post('/restaurant-recommendations/:id/reject', async (c) => {
  const { DB } = c.env
  await ensureTables(DB)

  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '유효하지 않은 ID' }, 400)

  const rec = await DB.prepare(
    'SELECT id, status FROM restaurant_recommendations WHERE id = ?'
  ).bind(id).first<{ id: number; status: string }>()

  if (!rec) return c.json({ success: false, error: '추천이 존재하지 않습니다' }, 404)
  if (rec.status !== 'pending') return c.json({ success: false, error: '이미 처리된 추천입니다' }, 409)

  const body3 = await c.req.json<{ admin_note?: string }>().catch(() => ({ admin_note: '' }))
  const admin_note = body3.admin_note || null

  await DB.prepare(
    "UPDATE restaurant_recommendations SET status = 'rejected', admin_note = ?, reviewed_at = datetime('now') WHERE id = ?"
  ).bind(admin_note || null, id).run()

  return c.json({ success: true, message: '반려 처리 완료' })
})
