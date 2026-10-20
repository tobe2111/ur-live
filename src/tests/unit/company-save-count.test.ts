import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { saveCompanyLeadsCounted } from '@/features/marketing/api/company-save'
import type { CompanyLead } from '@/features/marketing/api/company-discovery'

/**
 * 🔢 **신규 판정을 전수 스캔에서 인덱스 탐색으로** — 2026-08-27, 라이브 실측이 원인을 특정했다.
 *
 * ## 무엇이 문제였나
 * 저장 관문이 신규 수를 알려고 **저장 전후로 `SELECT COUNT(*)`** 를 돌렸다. `ON CONFLICT DO UPDATE` 라
 * `changes()` 로는 신규/재확인을 못 가르기 때문이고 **의도는 옳았다**. 비용이 문제였다:
 * ```
 *   저장 1회 = 372,730행 전수 × 2   ·   하루 219회 = 1.63억 행/일
 *   D1 무료 한도는 하루 500만 행 → 33배 초과. 업체 DB 읽기의 거의 전부가 이 카운트였다.
 * ```
 *
 * ## 이 테스트가 지키는 것 — **싸진 것보다 "값이 같은 것"이 중요하다**
 * 비용 절감은 되돌려-검증으로 못 잡는다(느려도 통과한다). 잡아야 하는 건 **계산이 틀어지는 것**이다:
 * 신규를 과대 보고하면 "수집 잘 된다"는 착시가 생기고, 과소 보고하면 "수집 죽었다"로 오독된다.
 * 둘 다 이 레포가 실제로 겪은 오독이다.
 *
 * ## 못 막는 것
 * - 실제 D1 의 `IN (...)` 바인딩 상한(100). 청크가 50 이라 여유가 있지만 **청크를 키우면 깨진다** —
 *   그래서 아래에 청크 크기 상한 가드를 둔다.
 * - 라이브 읽기량이 실제로 줄었는지 — 배포 후 D1 분석(rowsRead)으로만 확인된다.
 */
const src = readFileSync('src/features/marketing/api/company-save.ts', 'utf8')
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** 최소 D1 스텁 — `company_key` 집합을 들고 IN 조회·INSERT 를 흉내 낸다. */
function fakeDb(existing: string[] = []) {
  const keys = new Set(existing)
  const q: string[] = []
  const mk = (sql: string) => {
    const st = {
      args: [] as unknown[],
      bind(...v: unknown[]) { st.args = v; return st },
      async first<T>(): Promise<T | null> {
        q.push(sql)
        if (/COUNT\(\*\) AS n FROM ad_company_leads WHERE company_key IN/.test(sql)) {
          return { n: st.args.filter(a => keys.has(String(a))).length } as unknown as T
        }
        if (/COUNT\(\*\) AS n FROM ad_company_leads$/m.test(sql.trim())) throw new Error('전수 COUNT 는 없어야 한다')
        return null
      },
      async all<T>() { q.push(sql); return { results: [] as T[] } },
      async run() { q.push(sql); return { meta: { changes: 1 } } },
      _sql: sql,
    }
    return st
  }
  return {
    queries: q,
    prepare: mk,
    async batch(stmts: Array<{ _sql: string; args: unknown[] }>) {
      for (const s of stmts) {
        q.push(s._sql)
        if (/^INSERT INTO ad_company_leads/.test(s._sql.trim())) keys.add(String(s.args[0]))
      }
      return stmts.map(() => ({}))
    },
  }
}

const lead = (name: string, extra: Partial<CompanyLead> = {}): CompanyLead => ({
  company_name: name, category: '대행사', subcategory: '마케팅 대행사', tier: 1, region: '강남',
  website: `https://${encodeURIComponent(name)}.example.co.kr`, phone: '02-000-0000', email: null,
  address: null, description: null, source: 'webkr', source_keyword: '강남 마케팅 대행사', ...extra,
} as CompanyLead)

describe('신규 판정이 값으로 같다', () => {
  it('🩸 전부 처음 보는 업체면 전부 신규', async () => {
    const db = fakeDb()
    const r = await saveCompanyLeadsCounted(db as never, [lead('가마케팅'), lead('나마케팅'), lead('다마케팅')])
    expect(r.inserted).toBe(3)
    expect(r.upserted, '시도 수는 그대로 보고').toBe(3)
  })

  it('🩸 이미 있는 업체는 신규로 세지 않는다 — 과대 보고는 "수집 잘 된다" 착시를 만든다', async () => {
    // ⚠️ company_key 형식을 손으로 적지 말 것 — 처음에 그렇게 썼다가 이 테스트가 내 추측을 잡았다.
    //   **같은 DB 에 두 번 저장**하는 실제 흐름으로 확인한다(키 생성은 SSOT companyKey 에 맡긴다).
    const db = fakeDb()
    await saveCompanyLeadsCounted(db as never, [lead('가마케팅'), lead('나마케팅')])
    const r = await saveCompanyLeadsCounted(db as never, [lead('가마케팅')])
    expect(r.inserted, '이미 아는 업체').toBe(0)
    expect(r.upserted, '재확인은 세어야 "완주"와 "죽음"이 구분된다').toBe(1)
  })

  it('🩸 같은 청크 안의 중복 키를 신규 2건으로 세지 않는다', async () => {
    const db = fakeDb()
    // 같은 사이트(=같은 company_key)가 두 번 들어온 경우
    const r = await saveCompanyLeadsCounted(db as never, [lead('가마케팅'), lead('가마케팅', { email: 'a@b.co' })])
    expect(r.inserted, '고유키 기준 1건').toBe(1)
    expect(r.upserted, '문장은 둘 다 실행된다(뒤 문장이 이메일을 채운다)').toBe(2)
  })

  it('🩸 전수 COUNT 를 더 이상 돌리지 않는다 — 이게 이 변경의 전부다', async () => {
    const db = fakeDb()
    await saveCompanyLeadsCounted(db as never, [lead('가마케팅')])
    const fullScans = db.queries.filter(s => /COUNT\(\*\) AS n FROM ad_company_leads\s*$/.test(s))
    expect(fullScans.length, '전수 스캔 0').toBe(0)
    expect(db.queries.some(s => /company_key IN \(/.test(s)), '인덱스 탐색으로 대체').toBe(true)
    expect(code(src), '소스에도 전수 COUNT 가 남으면 안 된다')
      .not.toMatch(/SELECT COUNT\(\*\) AS n FROM ad_company_leads'/)
  })

  it('사전확인이 실패하면 0 이 아니라 시도 수로 폴백한다 — 0 은 "수집 죽음"으로 오독된다', async () => {
    const db = fakeDb()
    const orig = db.prepare
    db.prepare = ((sql: string) => {
      const st = orig(sql)
      if (/company_key IN \(/.test(sql)) st.first = async () => { throw new Error('d1 down') }
      return st
    }) as typeof db.prepare
    const r = await saveCompanyLeadsCounted(db as never, [lead('가마케팅'), lead('나마케팅')])
    expect(r.inserted).toBe(2)
  })

  it('🩸 청크가 D1 바인딩 상한(100) 안에 있다 — 키우면 IN 조회가 깨진다', () => {
    const m = code(src).match(/const CHUNK = (\d+)/)
    expect(m).toBeTruthy()
    expect(Number(m![1])).toBeLessThanOrEqual(100)
  })
})
