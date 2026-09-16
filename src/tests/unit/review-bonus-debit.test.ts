/**
 * 💸 후기 보너스 — 매장 부담 원장 차감 (2026-09-01)
 *
 * #1276 은 재원을 판정만 했다. 여기서 실제로 매장 정산에서 뺀다.
 * 이 테스트가 지키는 것은 **차감이 지급보다 먼저 일어나지 않는 것**과
 * **되돌릴 경로가 생기면 역전도 같이 생기는 것**이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { debitStoreForReviewBonus } from '@/features/group-buy/api/review-bonus-funding'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const routes = read('src/features/group-buy/api/review-bonus.routes.ts')

/** 가짜 D1 — 실제 동작(멱등·조건)을 돌려 본다. 문자열 검사만으로는 못 잡는다. */
function fakeDB(opts: { existing?: boolean } = {}) {
  const recorded: Array<Record<string, unknown>> = []
  const db = {
    recorded,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            first: async () => (sql.includes('FROM ledger_entries') && opts.existing ? { 1: 1 } : null),
            run: async () => { recorded.push({ sql, args }); return { meta: { changes: 1 } } },
            all: async () => ({ results: [] }),
          }
        },
        first: async () => null,
        run: async () => ({ meta: { changes: 1 } }),
      }
    },
  }
  return db as unknown as Parameters<typeof debitStoreForReviewBonus>[0] & { recorded: typeof recorded }
}

describe('후기 보너스 매장 차감 — 언제 빼고 언제 안 빼나', () => {
  it("유어딜 부담이면 안 뺀다 (게이트 OFF · 매장 미설정)", async () => {
    const db = fakeDB()
    expect(await debitStoreForReviewBonus(db, { submissionId: 1, sellerId: 14, amount: 1000, fundedBy: 'platform' })).toBe(false)
  })

  it('매장이 없으면 안 뺀다 (청구할 상대가 없다)', async () => {
    const db = fakeDB()
    expect(await debitStoreForReviewBonus(db, { submissionId: 1, sellerId: null, amount: 1000, fundedBy: 'owner' })).toBe(false)
  })

  it('0원·음수는 안 뺀다', async () => {
    const db = fakeDB()
    expect(await debitStoreForReviewBonus(db, { submissionId: 1, sellerId: 14, amount: 0, fundedBy: 'owner' })).toBe(false)
    expect(await debitStoreForReviewBonus(db, { submissionId: 1, sellerId: 14, amount: -500, fundedBy: 'owner' })).toBe(false)
  })

  it('이미 기록된 제출은 두 번 안 뺀다 (멱등)', async () => {
    const db = fakeDB({ existing: true })
    expect(await debitStoreForReviewBonus(db, { submissionId: 7, sellerId: 14, amount: 1000, fundedBy: 'owner' })).toBe(false)
  })

  it('매장 부담이면 뺀다', async () => {
    const db = fakeDB()
    expect(await debitStoreForReviewBonus(db, { submissionId: 7, sellerId: 14, amount: 3000, fundedBy: 'owner' })).toBe(true)
  })
})

describe('배선 — 순서와 역전', () => {
  it('차감은 지급(payBonus) 성공 뒤에 온다', () => {
    // 순서가 뒤집히면 **지급 없이 청구**된다. 그게 이 배선에서 제일 아픈 실수다.
    const payAt = routes.indexOf('const paid = await payBonus(')
    const debitAt = routes.indexOf('await debitStoreForReviewBonus(')
    expect(payAt).toBeGreaterThan(-1)
    expect(debitAt).toBeGreaterThan(payAt)
  })

  it('지급을 무르는 경로는 보상 트랜지션 하나뿐이다', () => {
    // 🔑 지급된 건을 되돌리는 경로가 새로 생기면 **차감 역전도 같이** 있어야 한다(머니 룰 #2).
    //    지금은 `payBonus` 실패 시 원복 하나뿐이고, 그건 원장 기록 **전에** 돈다.
    //    이 개수가 늘면 이 테스트가 빨간불이 되어 "역전 짝을 넣어라"를 강제한다.
    const offPaid = routes.match(/status = 'submitted'[^`]*?AND status = 'paid'/g) || []
    expect(offPaid.length, "'paid' 에서 되돌리는 경로가 늘었다 — 차감 역전을 함께 넣어라").toBe(1)
  })
})
