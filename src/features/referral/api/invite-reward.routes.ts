/**
 * 초대 보상 API
 *
 * POST /api/invite/reward  — 초대받은 유저가 첫 구매 시 호출 → 초대자에게 딜 포인트 지급
 * GET  /api/invite/my      — 내가 초대한 내역 + 보상 내역
 */

import { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'
import { executeRun, executeQuery, queryFirst } from '@/worker/utils/database'
import { ensureUserPointsTable } from '@/worker/utils/ensure-tables'

const inviteRewardRoutes = new Hono<{ Bindings: Env }>()

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

async function ensureInviteRewardsTable(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS invite_rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inviter_user_id TEXT NOT NULL,
        invited_user_id TEXT NOT NULL,
        reward_amount INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','granted','expired')),
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run()
  } catch { /* table already exists */ }
}

/**
 * POST /reward — 초대받은 유저 첫 구매 시 초대자 보상
 * Body: { invited_user_id }
 *
 * 초대자 조회 방법:
 *  1. invited user의 referred_by 컬럼 (users 테이블)
 *  2. 또는 요청 body에 inviter_user_id 직접 전달
 */
inviteRewardRoutes.post('/reward', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)

  const { DB } = c.env
  await ensureInviteRewardsTable(DB)

  const body = await c.req.json<{ invited_user_id?: string }>().catch(() => ({ invited_user_id: undefined }))
  const invitedUserId = body.invited_user_id || String(user.id)

  // 1. Confirm invited user exists (production users schema has no referred_by column)
  let invitedUser: { id: string } | null = null
  try {
    const row = await queryFirst<{ id: string }>(
      DB,
      'SELECT id FROM users WHERE id = ? OR firebase_uid = ?',
      [invitedUserId, invitedUserId],
    )
    invitedUser = row ? { id: String(row.id) } : null
  } catch {
    invitedUser = null
  }
  if (!invitedUser) {
    return c.json({ success: false, error: '초대받은 유저를 찾을 수 없습니다' }, 404)
  }

  // Find inviter via referral_tree (source of truth — users.referred_by does not exist in production)
  let inviterUserId: string | null = null
  try {
    const tree = await queryFirst<{ parent_id: string | null }>(
      DB,
      'SELECT parent_id FROM referral_tree WHERE user_id = ?',
      [String(invitedUser.id)],
    )
    if (tree?.parent_id) inviterUserId = String(tree.parent_id)
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[invite-reward] referral_tree lookup failed', e)
  }

  if (!inviterUserId) {
    return c.json({ success: false, error: '초대자를 찾을 수 없습니다' }, 404)
  }

  // 2. Check if reward already granted for this pair
  const existing = await queryFirst<{ id: number }>(
    DB,
    'SELECT id FROM invite_rewards WHERE inviter_user_id = ? AND invited_user_id = ?',
    [inviterUserId, String(invitedUser.id)],
  )
  if (existing) {
    return c.json({ success: false, error: '이미 보상이 지급되었습니다' }, 409)
  }

  // 3. Check this is the invited user's FIRST order
  // ✅ SECURITY FIX (H7): Exclude REFUNDED orders too (refund reversal double-
  //    rewarding). Also require cnt === 1 (strict first-order) so no reward
  //    if a second/repeat order sneaks in.
  const orderCount = await queryFirst<{ cnt: number }>(
    DB,
    "SELECT COUNT(*) as cnt FROM orders WHERE user_id = ? AND status NOT IN ('CANCELLED','FAILED','REFUNDED')",
    [String(invitedUser.id)],
  )
  if (!orderCount || orderCount.cnt !== 1) {
    return c.json({ success: false, error: '첫 구매 보상은 첫 번째 주문에만 적용됩니다' }, 400)
  }

  // 4. Get reward amount from platform_settings
  let rewardAmount = 1000
  try {
    const setting = await queryFirst<{ value: string }>(
      DB,
      "SELECT value FROM platform_settings WHERE key = 'invite_reward_amount'",
      [],
    )
    if (setting?.value) {
      const parsed = parseInt(setting.value, 10)
      if (parsed > 0) rewardAmount = parsed
    }
  } catch { /* use default */ }

  // 5. Grant deal points to inviter via user_points table
  // (production users table doesn't have deal_balance column)
  try {
    await ensureUserPointsTable(DB)
    const existing = await queryFirst<{ balance: number }>(
      DB,
      'SELECT balance FROM user_points WHERE user_id = ?',
      [inviterUserId],
    )
    if (existing) {
      await executeRun(
        DB,
        "UPDATE user_points SET balance = balance + ?, total_charged = total_charged + ?, updated_at = datetime('now') WHERE user_id = ?",
        [rewardAmount, rewardAmount, inviterUserId],
      )
    } else {
      await executeRun(
        DB,
        'INSERT INTO user_points (user_id, balance, total_charged) VALUES (?, ?, ?)',
        [inviterUserId, rewardAmount, rewardAmount],
      )
    }
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[invite-reward] user_points grant failed', e)
  }
  // Best-effort update to users.deal_balance (may not exist in production)
  try {
    await executeRun(
      DB,
      'UPDATE users SET deal_balance = COALESCE(deal_balance, 0) + ? WHERE id = ?',
      [rewardAmount, inviterUserId],
    )
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[deal_balance]', e)
  }

  // 6. Create invite_rewards record
  await executeRun(
    DB,
    "INSERT INTO invite_rewards (inviter_user_id, invited_user_id, reward_amount, status) VALUES (?, ?, ?, 'granted')",
    [inviterUserId, String(invitedUser.id), rewardAmount],
  )

  return c.json({
    success: true,
    data: {
      inviter_user_id: inviterUserId,
      invited_user_id: String(invitedUser.id),
      reward_amount: rewardAmount,
      status: 'granted',
    },
  })
})

/**
 * GET /my — 내 초대 보상 내역
 */
inviteRewardRoutes.get('/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)

  const { DB } = c.env
  await ensureInviteRewardsTable(DB)

  const userId = String(user.id)

  // Rewards I earned (as inviter)
  const earned = await executeQuery<{
    id: number
    invited_user_id: string
    reward_amount: number
    status: string
    created_at: string
  }>(
    DB,
    `SELECT ir.id, ir.invited_user_id, ir.reward_amount, ir.status, ir.created_at
     FROM invite_rewards ir
     WHERE ir.inviter_user_id = ?
     ORDER BY ir.created_at DESC`,
    [userId],
  )

  // Total earned
  const totalRow = await queryFirst<{ total: number }>(
    DB,
    "SELECT COALESCE(SUM(reward_amount), 0) as total FROM invite_rewards WHERE inviter_user_id = ? AND status = 'granted'",
    [userId],
  )

  return c.json({
    success: true,
    data: {
      rewards: earned,
      total_earned: totalRow?.total ?? 0,
      count: earned.length,
    },
  })
})

export { inviteRewardRoutes }
