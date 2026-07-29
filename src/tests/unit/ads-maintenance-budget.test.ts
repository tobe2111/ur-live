import { describe, it, expect } from 'vitest'
import { budgetedDb, newOpBudget } from '@/features/marketing/api/maintenance-budget'
import { ddlChecksum } from '@/features/marketing/api/ads-schema-guard'
import { AD_INFLUENCER_DDL } from '@/features/marketing/api/influencer-discovery'
import { AD_QUALITY_DDL } from '@/features/marketing/api/influencer-quality'
import type { D1Database } from '@cloudflare/workers-types'

/**
 * 🧮 2026-07-28 자동 정비 무음 정지 근본수리의 불변식 잠금.
 *
 *   실사고: 정비 4단계를 한 인보케이션에서 돌렸는데 무료 플랜 실효 상한(~29 D1 연산)을 훨씬 넘겨
 *   매번 도중에 죽었고, 모든 D1 호출이 `.catch(() => null)` 이라 **결과 기록조차 실패**해
 *   어드민 화면엔 "07-26 이후 아무것도 안 돎"으로만 보였다(원인 불명 상태로 이틀).
 *
 *   여기서 고정하는 것:
 *     ① 예산 소진 후의 쿼리는 **실제 DB 를 건드리지 않는다**(no-op) — 한도 초과 자체를 안 만든다
 *     ② 소진은 `exhausted` 로 **관측 가능**해야 한다 — 이게 없으면 호출부가 "다 끝났다"로 오판해
 *        커서를 0 으로 되돌리고 영원히 같은 앞부분만 돈다(전화 스윕 커서 버그와 같은 클래스)
 *     ③ 한도 예외 문자열을 만나면 `limitHit` 으로 학습 상한 하향을 트리거한다
 *     ④ DDL 체크섬은 목록이 바뀌면 반드시 바뀐다 — 안 그러면 새 컬럼이 영원히 안 생긴다
 */

/** 호출을 세는 가짜 D1. */
function fakeDb(opts?: { throwLimitAfter?: number }) {
  const calls: string[] = []
  let n = 0
  const stmt = (sql: string): unknown => ({
    bind: () => stmt(sql),
    run: async () => { n++; calls.push(sql); if (opts?.throwLimitAfter && n > opts.throwLimitAfter) throw new Error('Too many subrequests by single Worker invocation'); return { success: true, meta: { changes: 1 } } },
    all: async () => { n++; calls.push(sql); if (opts?.throwLimitAfter && n > opts.throwLimitAfter) throw new Error('Too many subrequests by single Worker invocation'); return { success: true, results: [{ id: 1 }] } },
    first: async () => { n++; calls.push(sql); return { value: '7' } },
    raw: async () => { n++; calls.push(sql); return [] },
  })
  return {
    calls,
    db: {
      prepare: (sql: string) => stmt(sql),
      batch: async (s: unknown[]) => { n++; calls.push(`BATCH:${s.length}`); return [] },
    } as unknown as D1Database,
  }
}

describe('budgetedDb — 예산 소진 후 DB 무접촉(①)', () => {
  it('예산만큼만 실제 쿼리가 나가고, 그 뒤는 no-op 이다', async () => {
    const { db, calls } = fakeDb()
    const b = newOpBudget(3)
    const bdb = budgetedDb(db, b)
    for (let i = 0; i < 10; i++) await bdb.prepare('SELECT 1').bind(i).all()
    expect(calls.length).toBe(3)   // 실제 DB 는 3번만 — 나머지 7번은 no-op
    expect(b.used).toBe(3)
    expect(b.left).toBe(0)
  })

  it('batch 는 문장 수와 무관하게 1 연산으로 센다(플랫폼도 1 서브리퀘스트)', async () => {
    const { db, calls } = fakeDb()
    const b = newOpBudget(2)
    const bdb = budgetedDb(db, b)
    await bdb.batch([bdb.prepare('UPDATE x'), bdb.prepare('UPDATE y'), bdb.prepare('UPDATE z')])
    // prepare 자체는 연산이 아니다(터미널 메서드만 소비) → batch 1회만 소비
    expect(b.used).toBe(1)
    expect(calls).toEqual(['BATCH:3'])
  })

  it('소진되면 exhausted 로 관측된다(② — 커서 0 리셋 오판 방지의 근거)', async () => {
    const { db } = fakeDb()
    const b = newOpBudget(1)
    const bdb = budgetedDb(db, b)
    await bdb.prepare('SELECT 1').all()
    expect(b.exhausted).toBeFalsy()   // 아직 소진 아님
    const r = await bdb.prepare('SELECT 2').all() as { results: unknown[] }
    expect(b.exhausted).toBe(true)    // 여기서부터 소진
    expect(r.results).toEqual([])     // 빈 결과 — 호출부 루프가 정상 종료 조건으로 다룬다
  })

  it('한도 예외를 만나면 limitHit + 즉시 잔여 0(③)', async () => {
    const { db } = fakeDb({ throwLimitAfter: 1 })
    const b = newOpBudget(50)
    const bdb = budgetedDb(db, b)
    await bdb.prepare('SELECT 1').all()
    await bdb.prepare('SELECT 2').all() // 여기서 플랫폼 한도 예외
    expect(b.limitHit).toBe(true)
    expect(b.left).toBe(0)
    expect(b.exhausted).toBe(true)
  })

  it('한도 예외가 아닌 오류는 그대로 던진다(기존 호출부 catch 동작 불변)', async () => {
    const db = { prepare: () => ({ bind: () => ({ all: async () => { throw new Error('no such column: foo') } }) }) } as unknown as D1Database
    const b = newOpBudget(5)
    await expect(budgetedDb(db, b).prepare('SELECT foo').bind().all()).rejects.toThrow('no such column')
    expect(b.limitHit).toBeFalsy()
  })
})

describe('ddlChecksum — DDL 목록이 바뀌면 반드시 값이 바뀐다(④)', () => {
  it('같은 목록은 같은 값, 문장이 추가되면 달라진다', () => {
    const a = ['ALTER TABLE t ADD COLUMN a TEXT', 'ALTER TABLE t ADD COLUMN b TEXT']
    expect(ddlChecksum(a)).toBe(ddlChecksum([...a]))
    expect(ddlChecksum([...a, 'ALTER TABLE t ADD COLUMN c TEXT'])).not.toBe(ddlChecksum(a))
  })
  it('문장 내용/순서 변경도 감지한다', () => {
    const a = ['CREATE TABLE t (id INTEGER)', 'ALTER TABLE t ADD COLUMN a TEXT']
    expect(ddlChecksum([a[1], a[0]])).not.toBe(ddlChecksum(a))
    expect(ddlChecksum(['CREATE TABLE t (id INT)', a[1]])).not.toBe(ddlChecksum(a))
  })
  it('실제 DDL 목록은 비어있지 않다(빈 목록이면 스킵 로직이 무의미)', () => {
    expect(AD_INFLUENCER_DDL.length).toBeGreaterThan(10)
    expect(AD_QUALITY_DDL.length).toBeGreaterThan(0)
    expect(ddlChecksum(AD_INFLUENCER_DDL)).not.toBe(ddlChecksum(AD_QUALITY_DDL))
  })
})
