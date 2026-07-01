import { describe, it, expect } from 'vitest'
import { reverseInviteRewardOnRefund } from '@/worker/utils/invite-reward'

/**
 * 🛡️ 2026-07-01 전수감사 머니 #3 — 초대보상 환불 회수(적립-역전 대칭) 테스트.
 *   불변식:
 *   1. 환불 후 초대받은 유저의 유효(비취소) 주문이 0 → 초대자 보상 회수 + granted→expired.
 *   2. 다른 유효 주문이 남아있으면 → 보상 유지(회수 안 함).
 *   3. granted 보상 자체가 없으면 → 무해한 no-op.
 *   4. CAS(granted→expired) changes==0(다른 경로가 이미 회수) → 이중 차감 없음.
 *   5. 회수액은 MAX(0, balance-amount) clamp + 장부(invite_reward_reversal) 음수 delta 기록.
 */

type DB = Parameters<typeof reverseInviteRewardOnRefund>[0]

interface MockState {
  rewardRow: { id: number; inviter_user_id: string; reward_amount: number } | null
  orderCount: number
  claimChanges?: number // UPDATE invite_rewards SET status='expired' 의 meta.changes
}

function makeDb(state: MockState) {
  const calls = { deductedFromInviter: null as number | null, ledgerDelta: null as number | null, claimAttempted: false }
  const db = {
    prepare(sql: string) {
      let params: unknown[] = []
      const stmt = {
        bind(...a: unknown[]) { params = a; return stmt },
        async first() {
          if (sql.includes('FROM invite_rewards') && sql.includes("status = 'granted'")) return state.rewardRow
          if (sql.includes('COUNT(*)') && sql.includes('FROM orders')) return { cnt: state.orderCount }
          return null
        },
        async run() {
          if (sql.includes("UPDATE invite_rewards SET status = 'expired'")) {
            calls.claimAttempted = true
            return { meta: { changes: state.claimChanges ?? 1 } }
          }
          if (sql.includes('UPDATE user_points SET balance = MAX(0')) {
            calls.deductedFromInviter = Number(params[0])
          }
          if (sql.includes('INSERT INTO point_transactions')) {
            calls.ledgerDelta = Number(params[2]) // (uid, type, amount, ...)
          }
          return { meta: { changes: 1 } }
        },
        async all() { return { results: [] } },
      }
      return stmt
    },
    async batch() { return [] },
  }
  return { db: db as unknown as DB, calls }
}

describe('reverseInviteRewardOnRefund — 초대보상 환불 회수', () => {
  it('유효주문 0 → 초대자 1,000딜 회수 + granted→expired + 장부 -1,000', async () => {
    const { db, calls } = makeDb({ rewardRow: { id: 7, inviter_user_id: 'A', reward_amount: 1000 }, orderCount: 0 })
    await reverseInviteRewardOnRefund(db, 'B')
    expect(calls.claimAttempted).toBe(true)
    expect(calls.deductedFromInviter).toBe(1000)
    expect(calls.ledgerDelta).toBe(-1000)
  })

  it('다른 유효 주문 존재(cnt>0) → 보상 유지(회수/차감 없음)', async () => {
    const { db, calls } = makeDb({ rewardRow: { id: 7, inviter_user_id: 'A', reward_amount: 1000 }, orderCount: 2 })
    await reverseInviteRewardOnRefund(db, 'B')
    expect(calls.claimAttempted).toBe(false)
    expect(calls.deductedFromInviter).toBeNull()
  })

  it('granted 보상 없음 → no-op(차감 없음)', async () => {
    const { db, calls } = makeDb({ rewardRow: null, orderCount: 0 })
    await reverseInviteRewardOnRefund(db, 'B')
    expect(calls.claimAttempted).toBe(false)
    expect(calls.deductedFromInviter).toBeNull()
  })

  it('CAS 경쟁: 다른 경로가 이미 회수(changes==0) → 이중 차감 없음', async () => {
    const { db, calls } = makeDb({ rewardRow: { id: 7, inviter_user_id: 'A', reward_amount: 1000 }, orderCount: 0, claimChanges: 0 })
    await reverseInviteRewardOnRefund(db, 'B')
    expect(calls.claimAttempted).toBe(true)
    expect(calls.deductedFromInviter).toBeNull()
  })

  it('빈 userId → 즉시 no-op', async () => {
    const { db, calls } = makeDb({ rewardRow: { id: 7, inviter_user_id: 'A', reward_amount: 1000 }, orderCount: 0 })
    await reverseInviteRewardOnRefund(db, '')
    expect(calls.claimAttempted).toBe(false)
  })
})
