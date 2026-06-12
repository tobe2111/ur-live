/**
 * 🏁 2026-06-12 (전 플로우 감사 — "약속 미이행" 🟡): 초대 1,000딜 보상 공용 헬퍼.
 *
 * 배경: POST /api/invite/reward 는 존재했지만 **호출자가 0** — MyReferralCard 가
 * "첫 구매 하면 1,000딜!" 을 광고하면서 보상은 영원히 미지급이었음.
 * 결제 확정 경로(payment /confirm, group-buy /join)에서 server-side 로 호출하도록
 * 라우트 본문을 이 헬퍼로 추출. 멱등: invite_rewards UNIQUE(inviter,invited) claim.
 *
 * fail-soft: 어떤 실패도 throw 하지 않음 — 결제 흐름 보호 (호출측 waitUntil 권장).
 */
import { executeRun, queryFirst } from './database'
import { adjustUserPoints } from './point-ledger'

const _done_ensure = new WeakSet<D1Database>()
export async function ensureInviteRewardsTable(DB: D1Database): Promise<void> {
  if (_done_ensure.has(DB)) return
  _done_ensure.add(DB)
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
    await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_rewards_pair ON invite_rewards(inviter_user_id, invited_user_id)').run().catch(() => {})
  } catch { /* exists */ }
}

export interface InviteRewardResult {
  granted: boolean
  reason?: string
  inviterUserId?: string
  amount?: number
}

/** 첫 구매자의 초대자에게 1,000딜(설정값) 지급 — 멱등·fail-soft. */
export async function grantInviteRewardForFirstPurchase(
  DB: D1Database,
  invitedUserId: string,
): Promise<InviteRewardResult> {
  try {
    if (!invitedUserId) return { granted: false, reason: 'no_user' }
    await ensureInviteRewardsTable(DB)

    // 초대자 = referral_tree.parent_id (SSOT — users.referred_by 는 프로덕션에 없음)
    const tree = await queryFirst<{ parent_id: string | null }>(
      DB, 'SELECT parent_id FROM referral_tree WHERE user_id = ?', [String(invitedUserId)],
    ).catch(() => null)
    const inviterUserId = tree?.parent_id ? String(tree.parent_id) : null
    if (!inviterUserId) return { granted: false, reason: 'no_inviter' }
    if (inviterUserId === String(invitedUserId)) return { granted: false, reason: 'self' }

    // 첫 주문만 (환불/취소 제외 정확히 1건 — 호출 시점에 현재 주문이 이미 INSERT 된 상태)
    const orderCount = await queryFirst<{ cnt: number }>(
      DB,
      "SELECT COUNT(*) as cnt FROM orders WHERE user_id = ? AND status NOT IN ('CANCELLED','FAILED','REFUNDED')",
      [String(invitedUserId)],
    ).catch(() => null)
    if (!orderCount || orderCount.cnt !== 1) return { granted: false, reason: 'not_first' }

    let rewardAmount = 1000
    try {
      const setting = await queryFirst<{ value: string }>(
        DB, "SELECT value FROM platform_settings WHERE key = 'invite_reward_amount'", [],
      )
      const parsed = setting?.value ? parseInt(setting.value, 10) : NaN
      if (parsed > 0) rewardAmount = parsed
    } catch { /* default */ }

    // claim-before-credit: UNIQUE 선점 — 동시/중복 호출 중 1회만 적립
    const claim = await executeRun(
      DB,
      "INSERT OR IGNORE INTO invite_rewards (inviter_user_id, invited_user_id, reward_amount, status) VALUES (?, ?, ?, 'granted')",
      [inviterUserId, String(invitedUserId), rewardAmount],
    )
    if (((claim as { meta?: { changes?: number } })?.meta?.changes ?? 0) === 0) {
      return { granted: false, reason: 'already_granted' }
    }

    // 💸 2026-06-12 (4차 감사 D1): 잔액변경 + point_transactions 장부 동시 기록 (adjustUserPoints SSOT).
    //   기존 UPSERT(balance+total_charged) 와 금액/동작 동일 — 장부만 추가.
    const adjusted = await adjustUserPoints(DB, {
      userId: inviterUserId,
      delta: rewardAmount,
      type: 'invite_reward',
      description: '친구 초대 첫 구매 보상',
      bumpTotalCharged: true,
    })
    if (!adjusted.ok) return { granted: false, reason: 'error' }
    // users.deal_balance best-effort (컬럼 없을 수 있음)
    await executeRun(
      DB, 'UPDATE users SET deal_balance = COALESCE(deal_balance, 0) + ? WHERE id = ?',
      [rewardAmount, inviterUserId],
    ).catch(() => {})

    // 초대자에게 인앱 알림 (best-effort)
    await DB.prepare(
      `INSERT INTO user_notifications (user_id, type, title, message, link)
       VALUES (?, 'invite_reward', ?, ?, '/my-deal-history')`
    ).bind(
      inviterUserId,
      `🎁 친구 초대 보상 +${rewardAmount.toLocaleString('ko-KR')}딜`,
      '초대한 친구가 첫 구매를 완료했어요!',
    ).run().catch(() => {})

    return { granted: true, inviterUserId, amount: rewardAmount }
  } catch {
    return { granted: false, reason: 'error' }
  }
}
