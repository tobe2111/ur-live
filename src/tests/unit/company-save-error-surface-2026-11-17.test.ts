/**
 * 🩺 업체 저장이 0건일 때 **왜인지** 말한다 (2026-11-17 라이브 실측 — 프랜차이즈 레인 98회 × 600건 발견 · 저장 0).
 *
 * 2026-11-02 에 레인 쪽 catch 에 진단을 달았는데 원문이 한 번도 안 남았다 — 저장 함수 **안**의
 * `DB.batch(...).catch(() => null)` 이 먼저 삼켜서 예외가 위로 안 올라왔기 때문이다. 그래서 진단은 저장 함수가 직접 돌려준다:
 *   ① 묶음이 깨지면 `error` = 그 원문 ② 분류에서 전부 탈락하면 `error` = `ALL_REJECTED {사유: 건수}`.
 * ⚠️ 못 보는 것: 라이브에서 실제로 어느 쪽인지(배포 후 `franchise.run.diag.save_error` 로 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { saveCompanyLeadsCounted } from '@/features/marketing/api/company-save'

const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => any }
function d1(db: any, failBatch = false) {
  const prepare = (sql: string) => { let args: unknown[] = []; const st: any = {
    bind: (...a: unknown[]) => { args = a; return st },
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } } },
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  }; return st }
  return { prepare, exec: async (s: string) => db.exec(s),
    batch: async (sts: any[]) => { if (failBatch) throw new Error('D1_ERROR: too many SQL variables'); const o = []; for (const s of sts) o.push(await s.run()); return o } } as any
}
const lead = { company_name: '고혈압쭈꾸미', category: '창업', subcategory: '프랜차이즈본사', tier: 5, business_no: '6973401434', source: 'franchise', source_keyword: 'BRD_1' }

describe('저장 0 의 이유', () => {
  it('정상이면 error 없음', async () => {
    const r = await saveCompanyLeadsCounted(d1(new DatabaseSync(':memory:')), [lead as never], { requireContact: true })
    expect(r.upserted).toBe(1); expect(r.error).toBeUndefined()
  })
  it('묶음이 깨지면 그 원문', async () => {
    const r = await saveCompanyLeadsCounted(d1(new DatabaseSync(':memory:'), true), [lead as never], { requireContact: true })
    expect(r.upserted).toBe(0); expect(r.error).toContain('too many SQL variables')
  })
  it('전부 탈락이면 사유와 건수', async () => {
    const r = await saveCompanyLeadsCounted(d1(new DatabaseSync(':memory:')), [{ ...lead, company_name: '파트너 모집 공고' } as never], { requireContact: true })
    expect(r.error).toMatch(/^ALL_REJECTED \{"NOTICE_TITLE":1\}/)
  })
  it('프랜차이즈 레인이 그 error 를 진단줄에 옮긴다', () => {
    expect(readFileSync('src/features/marketing/api/franchise-collect.ts', 'utf8')).toMatch(/if \('error' in c && c\.error\) saveErr = saveErr \|\| `batch: \$\{c\.error\}`/)
  })
})
