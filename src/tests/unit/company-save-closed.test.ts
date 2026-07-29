/**
 * 🪦 폐업 업체는 접촉 풀에 남지 않는다 — 저장 관문(`company-save.ts`) 계약 (2026-07-29 신설).
 *
 *   왜 테스트가 필요한가: upsert 의 `ON CONFLICT ... active = CASE WHEN 이메일/전화 있으면 1` 규칙은
 *   **그 자체로는 옳다**(연락처가 생기면 접촉 가능해진다). 그래서 폐업 처리를 그 규칙 *안*에 넣으면
 *   서로를 덮어쓴다 — 폐업인데 이메일이 있으면 되살아난다. 실제로 라이브가 그 상태였다:
 *   표본 2,000건 중 폐업 203건, 그중 72건이 이메일을 달고 `active=1`.
 *   ⇒ 폐업 해제는 **upsert 뒤에 오는 별도 UPDATE** 여야 한다. 이 순서가 계약이다.
 */
import { describe, it, expect } from 'vitest'
import { saveCompanyLeads } from '@/features/marketing/api/company-discovery'

/** 발행된 SQL 을 순서대로 기록하는 최소 D1(이 테스트가 보는 건 '무엇을 어떤 순서로 쐈나'다). */
function makeDB() {
  const log: { sql: string; args: unknown[] }[] = []
  const prepare = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; log.push({ sql, args }); return api },
      first: async () => (/COUNT\(\*\)/i.test(sql) ? { n: 0 } : null),
      run: async () => ({ meta: { changes: 1 } }),
      all: async () => ({ results: [] }),
    }
    if (!/\?/.test(sql)) log.push({ sql, args })
    return api
  }
  return { db: { prepare, batch: async () => [{}] } as unknown as D1Database, log }
}

const lead = (over: Record<string, unknown> = {}) => ({
  company_name: '테스트상회', category: '온라인판매', subcategory: '통신판매', tier: 4,
  email: 'ceo@shop.co.kr', source: 'commerce', source_keyword: '2006-광진03112', ...over,
})

describe('저장 관문 — 폐업 처리', () => {
  it('폐업 리드는 upsert **뒤에** active=0 UPDATE 가 따라온다(이메일이 있어도 되살아나지 않게)', async () => {
    const { db, log } = makeDB()
    await saveCompanyLeads(db, [lead({ closed: true })], { requireContact: true })

    const ins = log.findIndex(l => /INSERT INTO ad_company_leads/i.test(l.sql))
    const upd = log.findIndex(l => /UPDATE ad_company_leads SET active = 0/i.test(l.sql))
    expect(ins).toBeGreaterThanOrEqual(0)
    expect(upd).toBeGreaterThan(ins) // 순서가 곧 정합성 — 앞서면 upsert 가 다시 1 로 올린다
    expect(log[upd].args).toHaveLength(1) // 폐업인 그 한 건만 대상
  })

  it('폐업이 아니면 그 UPDATE 자체가 없다(멀쩡한 리드를 건드리지 않는다)', async () => {
    const { db, log } = makeDB()
    await saveCompanyLeads(db, [lead()], { requireContact: true })
    expect(log.some(l => /UPDATE ad_company_leads SET active = 0/i.test(l.sql))).toBe(false)
  })

  it('폐업 업체도 **저장은 된다** — 삭제가 아니라 보류다(재개업 시 등록부가 되살린다)', async () => {
    const { db, log } = makeDB()
    await saveCompanyLeads(db, [lead({ closed: true })], { requireContact: true })
    const ins = log.find(l => /INSERT INTO ad_company_leads/i.test(l.sql))
    expect(ins?.args).toContain('테스트상회')
  })

  it('섞여 있으면 폐업분만 골라 넣는다', async () => {
    const { db, log } = makeDB()
    await saveCompanyLeads(db, [
      lead({ company_name: '살아있는상회' }),
      lead({ company_name: '문닫은상회', closed: true }),
      lead({ company_name: '또문닫은상회', closed: true }),
    ], { requireContact: true })
    const upd = log.find(l => /UPDATE ad_company_leads SET active = 0/i.test(l.sql))
    expect(upd?.args).toHaveLength(2)
  })
})
