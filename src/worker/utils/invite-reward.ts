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
import { adjustUserPoints, recordPointTransaction } from './point-ledger'

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

/**
 * 🔐 2026-07-01 (전수감사 머니 #3 — 적립-역전 대칭): 초대받은 유저의 결제가 환불되어
 * 유효(비취소) 주문이 0이 되면, 초대자에게 지급한 보상을 회수한다. 멱등·fail-soft.
 *
 * - 보류 조건: 환불 후에도 다른 유효 주문이 남아있으면 초대자는 여전히 실구매를 유도한 것이므로 회수 안 함.
 * - CAS(granted→expired)로 동시/중복 환불에도 1회만 회수(claim-before-debit).
 * - 회수 금액은 기존 clawback(affiliate/referral_bonus) 관례대로 MAX(0, ...) clamp(초대자 잔액 음수 방지).
 * - 호출: reverseOrderAncillaryOnRefund(=refundOrderFully·주문취소 경유) + 반품환불(returns.routes) 양경로.
 */
export async function reverseInviteRewardOnRefund(
  DB: D1Database,
  invitedUserId: string,
): Promise<void> {
  try {
    if (!invitedUserId) return
    await ensureInviteRewardsTable(DB)

    const row = await queryFirst<{ id: number; inviter_user_id: string; reward_amount: number }>(
      DB,
      "SELECT id, inviter_user_id, reward_amount FROM invite_rewards WHERE invited_user_id = ? AND status = 'granted'",
      [String(invitedUserId)],
    ).catch(() => null)
    if (!row) return

    // 환불 후 이 유저에게 유효(비취소) 주문이 남아있으면 보상 유지 (여전히 실구매자).
    //   호출 시점엔 현재 주문이 이미 REFUNDED 로 전이된 상태 → 이 count 에서 제외됨.
    const orderCount = await queryFirst<{ cnt: number }>(
      DB,
      "SELECT COUNT(*) as cnt FROM orders WHERE user_id = ? AND status NOT IN ('CANCELLED','FAILED','REFUNDED')",
      [String(invitedUserId)],
    ).catch(() => null)
    if (!orderCount || orderCount.cnt > 0) return

    // claim-before-debit: granted→expired CAS — 동시/중복 회수 중 1회만 진행.
    const claim = await executeRun(
      DB,
      "UPDATE invite_rewards SET status = 'expired' WHERE id = ? AND status = 'granted'",
      [row.id],
    )
    if (((claim as { meta?: { changes?: number } })?.meta?.changes ?? 0) === 0) return

    const amount = Math.max(0, Math.round(Number(row.reward_amount) || 0))
    if (amount <= 0) return

    // 초대자 포인트 회수 (MAX(0,...) clamp — 이미 소진했으면 가용분만, 음수 방지).
    await executeRun(
      DB,
      "UPDATE user_points SET balance = MAX(0, balance - ?), updated_at = datetime('now') WHERE user_id = ?",
      [amount, String(row.inviter_user_id)],
    ).catch(() => {})
    // 장부 기록 (best-effort, 음수 delta).
    await recordPointTransaction(DB, {
      userId: String(row.inviter_user_id),
      delta: -amount,
      type: 'invite_reward_reversal',
      description: '초대 보상 회수 (친구 주문 환불)',
    }).catch(() => {})
    // users.deal_balance best-effort 역전.
    await executeRun(
      DB,
      'UPDATE users SET deal_balance = MAX(0, COALESCE(deal_balance, 0) - ?) WHERE id = ?',
      [amount, String(row.inviter_user_id)],
    ).catch(() => {})
  } catch { /* fail-soft */ }
}
