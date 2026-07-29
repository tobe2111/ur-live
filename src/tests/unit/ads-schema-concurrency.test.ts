import { describe, it, expect } from 'vitest'
import { ensureInfluencerSchema, AD_INFLUENCER_DDL } from '@/features/marketing/api/influencer-discovery'
import { ddlChecksum } from '@/features/marketing/api/ads-schema-guard'

/**
 * ⚠️ 2026-07-21 스키마 보강 동시성 — 배포마다 재발하던 "인플루언서 목록 빈 화면" 근본수리 잠금.
 *   병렬 요청(목록+통계)이 ALTER 완료 전에 신규 컬럼 SELECT → 'no such column'. 인-플라이트 Promise 로
 *   두 호출이 같은 완료를 await 하는지 검증(같은 DB → DDL 1회, 완료 전 반환 없음).
 */
/**
 * @param storedSum platform_settings 에 기록된 DDL 체크섬(2026-07-28 runDdlOnce) — null 이면 미기록 = DDL 실행.
 *   ⚠️ 이 가짜 DB 는 `.bind().first()` 를 반드시 지원해야 한다. 이전엔 `prepare().run()` 만 있어서
 *   체크섬 조회가 추가되자 `DB.prepare(...).bind is not a function` 으로 깨졌다.
 */
function mockDB(storedSum: string | null = null) {
  let ddl = 0
  let resolveGate: () => void = () => {}
  const gate = new Promise<void>(r => { resolveGate = r })
  const db = {
    _ddl: () => ddl,
    _open: () => resolveGate(), // CREATE TABLE 을 수동으로 완료시켜 경합 창을 제어
    prepare(sql: string) {
      const stmt = {
        bind: () => stmt,
        async first() { return /platform_settings/i.test(sql) && storedSum ? { value: storedSum } : null },
        async run() {
          if (/CREATE TABLE IF NOT EXISTS ad_influencer_leads/i.test(sql)) { ddl++; await gate } // 첫 DDL 을 gate 로 지연
          return { meta: { changes: 0 } }
        },
      }
      return stmt
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

  // 🧱 2026-07-28: 무료 플랜은 인보케이션당 D1 연산 상한(~29)이 있는데 이 DDL 만 16쿼리였다(전부 no-op).
  //   체크섬이 최신이면 **한 개도 실행하지 않는다**는 것이 예산 회수의 핵심 — 여기서 고정한다.
  it('체크섬이 최신이면 DDL 을 한 개도 실행하지 않는다(예산 회수)', async () => {
    const db = mockDB(ddlChecksum(AD_INFLUENCER_DDL))
    db._open() // gate 는 열어두되, 애초에 CREATE TABLE 이 호출되지 않아야 한다
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ensureInfluencerSchema(db as any)
    expect(db._ddl()).toBe(0)
  })
})
