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
import { grantInviteRewardForFirstPurchase, ensureInviteRewardsTable as ensureInviteRewardsShared } from '@/worker/utils/invite-reward'

const inviteRewardRoutes = new Hono<{ Bindings: Env }>()

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

async function ensureInviteRewardsTable(DB: D1Database) {
  if (_done_ensureInviteRewardsTable.has(DB)) return
  _done_ensureInviteRewardsTable.add(DB)
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS invite_rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inviter_user_id TEXT NOT NULL,
        invited_user_id TEXT NOT NULL,
        reward_amount INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','granted','expired')),
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(inviter_user_id, invited_user_id)
      )
    `).run()
    // 🔐 2026-06-11 (정합성 감사 🔴): 기존 테이블에 UNIQUE 없으면 보강 (이중 보상 차단).
    await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_rewards_pair ON invite_rewards(inviter_user_id, invited_user_id)').run().catch(() => {})
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
  // 🏁 2026-06-12: 본문 로직을 grantInviteRewardForFirstPurchase 헬퍼로 추출 —
  //   결제 확정 경로(payment /confirm, group-buy /join)가 server-side 로 같은 로직을 호출
  //   (기존엔 이 endpoint 호출자가 0 → 보상 영구 미지급). 응답 계약은 기존과 동일 유지.
  const body = await c.req.json<{ invited_user_id?: string }>().catch(() => ({ invited_user_id: undefined }))
  const invitedUserId = String(body.invited_user_id || user.id)

  const row = await queryFirst<{ id: string }>(
    DB, 'SELECT id FROM users WHERE id = ? OR firebase_uid = ?', [invitedUserId, invitedUserId],
  ).catch(() => null)
  if (!row) return c.json({ success: false, error: '초대받은 유저를 찾을 수 없습니다' }, 404)

  const result = await grantInviteRewardForFirstPurchase(DB, String(row.id))
  if (result.granted) {
    return c.json({ success: true, data: { inviter_user_id: result.inviterUserId, invited_user_id: String(row.id), reward_amount: result.amount } })
  }
  switch (result.reason) {
    case 'no_inviter': return c.json({ success: false, error: '초대자를 찾을 수 없습니다' }, 404)
    case 'not_first': return c.json({ success: false, error: '첫 구매 보상은 첫 번째 주문에만 적용됩니다' }, 400)
    case 'already_granted': return c.json({ success: false, error: '이미 보상이 지급되었습니다' }, 409)
    default: return c.json({ success: false, error: '보상 처리 중 오류가 발생했습니다' }, 500)
  }
})

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


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureInviteRewardsTable = new WeakSet<object>()
