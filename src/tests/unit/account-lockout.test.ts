import { describe, it, expect } from 'vitest'
import { checkLockout, recordFailure } from '@/worker/utils/account-lockout'

/**
 * 🛡️ 2026-06-01 account-lockout 테스트 (로그인 브루트포스 방어, 테스트 0개였음).
 *   정책: 10회→15분, 20회→1시간, 30회→24시간 잠금(2026-04-22 완화). IP rate-limit 과 병용.
 *   mock DB 로 recordFailure 가 계산하는 locked_until + checkLockout 분기 검증.
 */

function makeDB(opts: { selectFailureCount?: number | null; lockedUntil?: string | null }) {
  const runs: { sql: string; args: unknown[] }[] = []
  const firstFor = (sql: string) => {
    if (sql.includes('SELECT failure_count, locked_until')) {
      if (opts.selectFailureCount == null) return null
      return { failure_count: opts.selectFailureCount, locked_until: opts.lockedUntil ?? null }
    }
    if (sql.includes('SELECT failure_count')) {
      return opts.selectFailureCount == null ? null : { failure_count: opts.selectFailureCount }
    }
    return null
  }
  const db = {
    prepare(sql: string) {
      const make = (args: unknown[]) => ({
        first: async () => firstFor(sql),
        run: async () => { runs.push({ sql, args }); return { meta: {} } },
        all: async () => ({ results: [] }),
      })
      return { ...make([]), bind: (...args: unknown[]) => make(args) }
    },
  }
  return { db: db as never, runs }
}

function insertBind(runs: { sql: string; args: unknown[] }[]) {
  return runs.find((r) => r.sql.includes('INSERT INTO account_lockouts'))?.args
}

describe('recordFailure — 임계별 잠금 시간 정책', () => {
  it('9회 → 10회째: 잠금 시작(locked_until 설정됨)', async () => {
    const { db, runs } = makeDB({ selectFailureCount: 9 })
    await recordFailure(db, 'user', 'u1')
    const args = insertBind(runs)!
    expect(args[2]).toBe(10) // newCount
    expect(args[3], '10회 → 잠금').not.toBeNull()
  })

  it('10회 미만(예:5)은 잠금 안 함(locked_until null)', async () => {
    const { db, runs } = makeDB({ selectFailureCount: 5 })
    await recordFailure(db, 'seller', 's1')
    const args = insertBind(runs)!
    expect(args[2]).toBe(6)
    expect(args[3], '6회 → 미잠금').toBeNull()
  })

  it('잠금 시간 점증: 10회≈15분, 20회≈1시간, 30회≈24시간', async () => {
    const cases: [number, number][] = [[9, 15 * 60_000], [19, 60 * 60_000], [29, 24 * 60 * 60_000]]
    for (const [existing, expectMs] of cases) {
      const { db, runs } = makeDB({ selectFailureCount: existing })
      const t0 = Date.now()
      await recordFailure(db, 'user', `u-${existing}`)
      const lockedUntil = insertBind(runs)![3] as string
      const deltaMs = new Date(lockedUntil).getTime() - t0
      // 허용오차 5초
      expect(Math.abs(deltaMs - expectMs), `${existing + 1}회 잠금≈${expectMs}ms`).toBeLessThan(5000)
    }
  })

  it('첫 실패(기존 행 없음) → count 1, 미잠금', async () => {
    const { db, runs } = makeDB({ selectFailureCount: null })
    await recordFailure(db, 'admin', 'a1')
    const args = insertBind(runs)!
    expect(args[2]).toBe(1)
    expect(args[3]).toBeNull()
  })
})

describe('checkLockout — 잠금 상태 판정', () => {
  it('locked_until 미래 → locked', async () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString()
    const { db } = makeDB({ selectFailureCount: 12, lockedUntil: future })
    const r = await checkLockout(db, 'user', 'u1')
    expect(r.locked).toBe(true)
    expect(r.unlockAt).toBe(future)
  })

  it('locked_until 과거 → unlocked', async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    const { db } = makeDB({ selectFailureCount: 12, lockedUntil: past })
    expect((await checkLockout(db, 'user', 'u1')).locked).toBe(false)
  })

  it('행 없음/locked_until null → unlocked', async () => {
    expect((await checkLockout(makeDB({ selectFailureCount: null }).db, 'user', 'x')).locked).toBe(false)
    expect((await checkLockout(makeDB({ selectFailureCount: 3, lockedUntil: null }).db, 'user', 'y')).locked).toBe(false)
  })
})
