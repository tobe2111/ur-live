import { describe, it, expect } from 'vitest'
import { idempotentWrite, IdempotencyConflictError } from '@/worker/utils/idempotency'

/**
 * 🛡️ 2026-06-01 idempotentWrite 테스트 (이중결제/중복처리 방지 핵심, 테스트 0개였음).
 *   결제 등 비멱등 side-effect 를 (key,user) 당 1회만 실행 — 캐시 replay / in-progress 409.
 */

function makeDB(opts: { insertChanges: number; existing?: { status: string; result: string | null } | null }) {
  const runs: string[] = []
  const firstFor = (sql: string) => {
    if (sql.includes('SELECT result, status')) return opts.existing ?? null
    return null
  }
  const db = {
    prepare(sql: string) {
      const api = {
        bind: (..._a: unknown[]) => api,
        first: async () => firstFor(sql),
        run: async () => {
          runs.push(sql)
          if (sql.includes('INSERT OR IGNORE')) return { meta: { changes: opts.insertChanges } }
          return { meta: { changes: 1 } }
        },
        all: async () => ({ results: [] }),
      }
      return api
    },
  }
  return { db: db as never, runs }
}

describe('idempotentWrite', () => {
  it('신규 키(race 승리): operation 1회 실행 + 결과 반환', async () => {
    const { db, runs } = makeDB({ insertChanges: 1 })
    let calls = 0
    const r = await idempotentWrite(db, 'k1', 'u1', async () => { calls++; return { paid: true } })
    expect(calls).toBe(1)
    expect(r).toEqual({ paid: true })
    expect(runs.some((s) => s.includes("status = 'done'"))).toBe(true) // 결과 저장
  })

  it('중복 키(이미 done): operation 미실행 + 캐시 결과 replay (이중결제 차단)', async () => {
    const { db } = makeDB({ insertChanges: 0, existing: { status: 'done', result: JSON.stringify({ paid: true, orderId: 9 }) } })
    let calls = 0
    const r = await idempotentWrite(db, 'k1', 'u1', async () => { calls++; return { paid: false } })
    expect(calls, 'operation 재실행 안 됨').toBe(0)
    expect(r).toEqual({ paid: true, orderId: 9 }) // 캐시된 결과
  })

  it('동시 처리 중(pending): IdempotencyConflictError (409)', async () => {
    const { db } = makeDB({ insertChanges: 0, existing: { status: 'pending', result: null } })
    await expect(idempotentWrite(db, 'k1', 'u1', async () => 'x')).rejects.toBeInstanceOf(IdempotencyConflictError)
  })

  it('만료/레이스로 기존행 없음: conflict', async () => {
    const { db } = makeDB({ insertChanges: 0, existing: null })
    await expect(idempotentWrite(db, 'k1', 'u1', async () => 'x')).rejects.toBeInstanceOf(IdempotencyConflictError)
  })

  it('key/userId 누락 → un-guarded 실행(방어적)', async () => {
    const { db } = makeDB({ insertChanges: 1 })
    let calls = 0
    const r = await idempotentWrite(db, '', 'u1', async () => { calls++; return 42 })
    expect(calls).toBe(1)
    expect(r).toBe(42)
  })

  it('operation 실패 시: 행 삭제(재시도 가능) + 에러 전파', async () => {
    const { db, runs } = makeDB({ insertChanges: 1 })
    await expect(idempotentWrite(db, 'k1', 'u1', async () => { throw new Error('payment failed') })).rejects.toThrow('payment failed')
    expect(runs.some((s) => s.includes('DELETE FROM idempotency_keys')), '실패 시 키 삭제 → 재시도 가능').toBe(true)
  })

  it('409 conflict 는 status 409 보유', () => {
    expect(new IdempotencyConflictError().status).toBe(409)
  })
})
