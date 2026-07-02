import { describe, it, expect, beforeEach } from 'vitest'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import { getPlan, setPlan, checkCapacity, meterDaily, PLAN_LIMITS } from '@/features/marketing/api/ads-entitlements'
import type { Env } from '@/worker/types/env'

/**
 * 🆕 2026-07-01 유어애즈 엔타이틀먼트 뼈대 — 킬스위치·플랜 해석·한도 검사 잠금.
 *   핵심 불변식: ADS_BILLING_ENFORCED !== 'true' 면 **무조건 무제한(현행 동일)**.
 */
function makeD1(): D1Database {
  const db = new DatabaseSync(':memory:')
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => { const r = db.prepare(sql).all(...(args as never[])); return { results: r } },
    }
    return api
  }
  return { prepare: (sql: string) => wrap(sql) } as unknown as D1Database
}
const envOf = (DB: D1Database, enforced: boolean): Env =>
  ({ DB, ...(enforced ? { ADS_BILLING_ENFORCED: 'true' } : {}) }) as unknown as Env

describe('ads-entitlements', () => {
  let DB: D1Database
  beforeEach(() => { DB = makeD1() })

  it('플랜 해석: 행 없음 → free / 지정 → 반영 / 만료 → free 강등', async () => {
    expect(await getPlan(DB, 1)).toBe('free')
    await setPlan(DB, 1, 'pro')
    expect(await getPlan(DB, 1)).toBe('pro')
    await setPlan(DB, 1, 'starter', '2000-01-01T00:00:00Z') // 과거 만료
    expect(await getPlan(DB, 1)).toBe('free')
  })

  it('🔒 킬스위치 OFF(기본) — 한도 무관 무조건 통과(현행 동일)', async () => {
    const env = envOf(DB, false)
    expect((await checkCapacity(env, 1, 'autobid_rules', 999999)).ok).toBe(true)
    expect((await checkCapacity(env, 1, 'clickguard_sites', 999999)).ok).toBe(true)
    // 미터링도 카운트만 적재하고 통과
    for (let i = 0; i < 10; i++) expect((await meterDaily(env, 1, 'ai_per_day')).ok).toBe(true)
  })

  it('킬스위치 ON — free 한도에서 차단 + pro(-1)는 무제한', async () => {
    const env = envOf(DB, true)
    const freeLimit = PLAN_LIMITS.free.autobid_rules
    expect((await checkCapacity(env, 1, 'autobid_rules', freeLimit - 1)).ok).toBe(true)
    const blocked = await checkCapacity(env, 1, 'autobid_rules', freeLimit)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.plan).toBe('free')
    await setPlan(DB, 1, 'pro')
    expect((await checkCapacity(env, 1, 'autobid_rules', 100000)).ok).toBe(true) // -1 = 무제한
  })

  it('킬스위치 ON — AI 일일 미터링 한도 초과 시 차단', async () => {
    const env = envOf(DB, true)
    const limit = PLAN_LIMITS.free.ai_per_day
    for (let i = 0; i < limit; i++) expect((await meterDaily(env, 1, 'ai_per_day')).ok).toBe(true)
    expect((await meterDaily(env, 1, 'ai_per_day')).ok).toBe(false) // limit+1 번째
  })
})
