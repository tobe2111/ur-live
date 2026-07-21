import { describe, it, expect } from 'vitest'
import { ensureInfluencerSchema } from '@/features/marketing/api/influencer-discovery'

/**
 * ⚠️ 2026-07-21 스키마 보강 동시성 — 배포마다 재발하던 "인플루언서 목록 빈 화면" 근본수리 잠금.
 *   병렬 요청(목록+통계)이 ALTER 완료 전에 신규 컬럼 SELECT → 'no such column'. 인-플라이트 Promise 로
 *   두 호출이 같은 완료를 await 하는지 검증(같은 DB → DDL 1회, 완료 전 반환 없음).
 */
function mockDB() {
  let ddl = 0
  let resolveGate: () => void = () => {}
  const gate = new Promise<void>(r => { resolveGate = r })
  const db = {
    _ddl: () => ddl,
    _open: () => resolveGate(), // CREATE TABLE 을 수동으로 완료시켜 경합 창을 제어
    prepare(sql: string) {
      return {
        async run() {
          if (/CREATE TABLE/i.test(sql)) { ddl++; await gate } // 첫 DDL 을 gate 로 지연
          return { meta: { changes: 0 } }
        },
      }
    },
  }
  return db
}

describe('ensureInfluencerSchema — 동시성', () => {
  it('같은 DB 병렬 호출 = DDL 1회 실행(캐시된 같은 Promise)', async () => {
    const db = mockDB()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p1 = ensureInfluencerSchema(db as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p2 = ensureInfluencerSchema(db as any)
    expect(p1).toBe(p2)          // 두 호출이 동일 Promise 를 공유 → 완료 전 skip 불가
    db._open()
    await Promise.all([p1, p2])
    expect(db._ddl()).toBe(1)    // CREATE TABLE 은 한 번만
  })

  it('완료 전에는 resolve 되지 않음(컬럼 존재 보장 후 진행)', async () => {
    const db = mockDB()
    let done = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = ensureInfluencerSchema(db as any).then(() => { done = true })
    await Promise.resolve() // 마이크로태스크 흘려보내도
    expect(done).toBe(false) // gate 열기 전엔 미완료
    db._open()
    await p
    expect(done).toBe(true)
  })
})
