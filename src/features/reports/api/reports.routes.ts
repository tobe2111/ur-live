/**
 * CS 신고 API
 *
 * POST /api/reports       — 신고 접수 (유저/셀러/상품/스트림/리뷰/댓글)
 * GET  /api/reports/my    — 내가 접수한 신고 목록
 */

import { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import type { Env } from '@/worker/types/env'
export const reportsRoutes = new Hono<{ Bindings: Env }>()

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

async function ensureTable(DB: D1Database) {
  if (_done_ensureTable) return
  _done_ensureTable = true
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS user_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_user_id TEXT NOT NULL,
        target_type TEXT NOT NULL CHECK(target_type IN ('seller', 'user', 'product', 'stream', 'review', 'comment')),
        target_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'reviewing', 'resolved', 'rejected')),
        admin_note TEXT,
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
  } catch { /* already exists */ }
}

reportsRoutes.post(
  '/',
  rateLimit({ action: 'user_report', max: 5, windowSec: 300 }),
  requireAuth(),
  async (c) => {
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const body = await c.req.json<{
      target_type: string
      target_id: string
      reason: string
      description?: string
    }>().catch(() => null)

    if (!body) {
      return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    }

    const validTypes = ['seller', 'user', 'product', 'stream', 'review', 'comment']
    if (!validTypes.includes(body.target_type)) {
      return c.json({ success: false, error: '유효하지 않은 신고 대상' }, 400)
    }
    if (!body.target_id || String(body.target_id).length > 100) {
      return c.json({ success: false, error: '유효하지 않은 신고 대상 ID' }, 400)
    }
    if (!body.reason || body.reason.length > 500) {
      return c.json({ success: false, error: '신고 사유는 1-500자로 작성해주세요' }, 400)
    }
    if (body.description && body.description.length > 2000) {
      return c.json({ success: false, error: '상세 설명은 2000자 이하로 작성해주세요' }, 400)
    }

    await ensureTable(c.env.DB)

    await c.env.DB.prepare(
      'INSERT INTO user_reports (reporter_user_id, target_type, target_id, reason, description) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      String(user.id),
      body.target_type,
      String(body.target_id),
      body.reason,
      body.description || null,
    ).run()

    return c.json({ success: true, message: '신고가 접수되었습니다. 검토 후 조치하겠습니다.' })
  }
)

reportsRoutes.get('/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)

  await ensureTable(c.env.DB)

  const { results } = await c.env.DB.prepare(
    'SELECT id, target_type, target_id, reason, status, created_at, resolved_at FROM user_reports WHERE reporter_user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(String(user.id)).all()

  return c.json({ success: true, data: results ?? [] })
})


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureTable = false
