import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
  DatabaseSync: new (p: string) => { exec: (sql: string) => void; prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } }
}
import {
  decideRegistryFastPath, registrySourcesSql, fastPathWhere,
  FASTPATH_MIN_SAMPLE, FASTPATH_BULK,
} from '@/features/marketing/api/reclassify-registry-fastpath'
import { REGISTRY_CATEGORY_SOURCES } from '@/features/marketing/api/company-classify'

/**
 * ⚡ **등록부 벌크 전진** — 한 바퀴 38일 → 2일.
 *
 * 이 최적화의 위험은 하나다: **건너뛰면 안 되는 행을 건너뛰는 것.** 그래서 여기서 고정하는 것의
 * 대부분은 "빠른가"가 아니라 **"무엇을 절대 안 건너뛰는가"** 다.
 *
 * ## 못 막는 것
 * - 벌크 크기(5,000)가 회차 마감선 안에 들어가는지 — 라이브 소요시간을 봐야 안다.
 * - D1 이 이 UPDATE 를 한 문장으로 감당하는지 — 실패하면 커서를 안 옮기도록 짜 두었다(아래 배선 검사).
 */
describe('decideRegistryFastPath — 근거 없으면 안 건너뛴다', () => {
  it('표본이 얇으면 거부', () => {
    const d = decideRegistryFastPath(FASTPATH_MIN_SAMPLE - 1, 0)
    expect(d.allow).toBe(false)
    expect(d.reason).toContain('표본 부족')
  })
  it('🔒 한 건이라도 바뀌면 거부 — 규칙이 등록부를 흔드는 순간 저절로 꺼진다', () => {
    expect(decideRegistryFastPath(2250, 1).allow).toBe(false)
  })
  it('🩸 실측 형상(2,250건 전부 불변)이면 허용', () => {
    const d = decideRegistryFastPath(2250, 0)
    expect(d.allow).toBe(true)
  })
  it('0/0 은 허용하지 않는다 — "안 바뀌었다"가 아니라 "안 봤다"이다', () => {
    expect(decideRegistryFastPath(0, 0).allow).toBe(false)
  })
})

describe('fastPathWhere — 절대 건너뛰지 않는 것', () => {
  function db() {
    const d = new DatabaseSync(':memory:')
    d.exec(`CREATE TABLE ad_company_leads (
      id INTEGER PRIMARY KEY, company_name TEXT, source TEXT, category TEXT,
      classify_confidence TEXT, classified_v INTEGER, merged_into INTEGER)`)
    return d
  }
  const reg = Array.from(REGISTRY_CATEGORY_SOURCES)[0]
  const ins = (d: ReturnType<typeof db>, id: number, o: Record<string, unknown>) => {
    const row = { source: reg, category: '음식점', classify_confidence: 'registry', classified_v: 8, merged_into: null, ...o }
    d.prepare('INSERT INTO ad_company_leads (id, company_name, source, category, classify_confidence, classified_v, merged_into) VALUES (?,?,?,?,?,?,?)')
      .run(id as never, ('c' + id) as never, row.source as never, row.category as never, row.classify_confidence as never, row.classified_v as never, row.merged_into as never)
  }
  const picked = (d: ReturnType<typeof db>) =>
    (d.prepare(`SELECT id FROM ad_company_leads WHERE ${fastPathWhere(registrySourcesSql())} ORDER BY id`).all(9 as never, 0 as never) as Array<{ id: number }>).map(r => r.id)

  it('🔒 첫 분류(등록부 분기로 판정된 적 없는 행)는 절대 안 건너뛴다', () => {
    const d = db()
    ins(d, 1, {})                                   // 이미 registry 로 판정됨 → 대상
    ins(d, 2, { classify_confidence: null })        // 한 번도 판정 안 됨 → 제외
    ins(d, 3, { classify_confidence: 'evidence' })  // 다른 분기로 판정됨 → 제외
    expect(picked(d)).toEqual([1])
  })

  it('🔒 category 가 빈 행은 제외 — 등록부 분기 조건 자체가 다르다', () => {
    const d = db()
    ins(d, 1, {}); ins(d, 2, { category: null })
    expect(picked(d)).toEqual([1])
  })

  it('🔒 등록부가 아닌 소스(webkr·local)는 제외 — 그게 정작 재판정이 필요한 쪽이다', () => {
    const d = db()
    ins(d, 1, {}); ins(d, 2, { source: 'webkr' }); ins(d, 3, { source: 'local' })
    expect(picked(d)).toEqual([1])
  })

  it('🔒 이미 최신 버전인 행과 병합된 행은 제외', () => {
    const d = db()
    ins(d, 1, {}); ins(d, 2, { classified_v: 9 }); ins(d, 3, { merged_into: 1 })
    expect(picked(d)).toEqual([1])
  })

  it('커서보다 앞은 제외(id > cursor)', () => {
    const d = db()
    ins(d, 1, {}); ins(d, 5, {}); ins(d, 9, {})
    const rows = (d.prepare(`SELECT id FROM ad_company_leads WHERE ${fastPathWhere(registrySourcesSql())} ORDER BY id`).all(9 as never, 5 as never) as Array<{ id: number }>).map(r => r.id)
    expect(rows).toEqual([9])
  })

  it('소스 목록이 SQL 로 안전하게 인용된다', () => {
    const sql = registrySourcesSql()
    expect(sql).toContain("'")
    expect(sql.split(',').length).toBe(REGISTRY_CATEGORY_SOURCES.size)
  })
})

describe('🔌 배선 — 위험한 순서를 고정한다', () => {
  const src = readFileSync('src/features/marketing/api/reclassify-registry-fastpath.ts', 'utf8')
  const block = src.slice(src.indexOf('export async function advanceRegistryFastPath'))

  it('🩸 범위를 UPDATE **전에** 잰다 — 뒤에 재면 조건이 거짓이 되어 못 구한다', () => {
    expect(block.indexOf('SELECT MAX(id)')).toBeLessThan(block.indexOf('UPDATE ad_company_leads SET classified_v'))
  })
  it('🩸 UPDATE 가 실패하면 커서를 안 옮긴다 — 옮기면 그 구간이 영영 미분류로 남는다', () => {
    expect(block).toContain('if (done) { return { cursor: Number(span.m)')
  })
  it('우선순위 티어에서는 벌크를 안 한다(두 상태가 섞인다)', () => {
    const caller = readFileSync('src/features/marketing/api/company-discovery.ts', 'utf8')
    expect(caller).toContain('prioDone ? await advanceRegistryFastPath(')
  })
  it('벌크 크기가 목표(2일 안팎)와 맞는다', () => {
    // 279,041행 ÷ (FASTPATH_BULK × 24회/일)
    expect(279041 / (FASTPATH_BULK * 24)).toBeLessThan(4)
    expect(FASTPATH_BULK).toBeLessThanOrEqual(20000)   // 회차 마감선 보호
  })
})
