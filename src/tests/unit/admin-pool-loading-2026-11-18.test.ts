/**
 * ⏱️ 파트너 풀 · 인플루언서 풀 어드민 로딩 (2026-11-18 대표 *"로딩이 너무 길고 · 인플루언서 풀에 매일 수집량 그래프가 사라졌어"*).
 *
 * 라이브 실측(같은 날): 인플루언서 통계 3.5~9.1초 · 회당 약 240만 행 / 파트너 목록 첫 페이지 0.78초 · 136만 행.
 * 지키는 것
 *   ① 인플루언서 통계의 무거운 집계는 캐시를 쓰고(30분), `fresh` 면 건너뛰고, 낡아도 2시간 안이면 먼저 주고 뒤에서 갱신
 *   ② 오늘 유입은 캐시 밖에서 실시간으로 14일 표에 덮인다(그래프의 마지막 막대가 굳지 않게)
 *   ③ 14일 유입 쿼리가 `collected_at` 인덱스를 탄다(`+account_id` — 진짜 SQLite 로 플랜 확인)
 *   ④ 파트너 목록 정렬과 인덱스가 글자까지 같고, 진짜 SQLite 에서 임시 정렬 없이 인덱스로 읽는다
 *   ⑤ 화면: 첫 로드·폴링은 캐시, 데이터를 바꾼 뒤(loadMeta)만 `fresh=1`
 * ⚠️ 못 보는 것: 라이브 D1 의 실제 읽기량·시간(배포 후 같은 방법으로 다시 잰다) · D1 플래너가 node:sqlite 와 다를 가능성.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { getInfluencerStatsCached, INFLUENCER_STATS_TTL_MS, INFLUENCER_STATS_CACHE_KEY } from '@/features/marketing/api/influencer-stats-cache'
import { mergeTodayInflow } from '@/features/marketing/api/influencer-pool-stats'
import { COMPANY_INDEX_DDL } from '@/features/marketing/api/company-ddl-indexes'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>
function d1(db: Db) {
  const stmt = (sql: string) => {
    let binds: unknown[] = []
    const self = {
      bind: (...a: unknown[]) => { binds = a; return self },
      first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
      run: async () => { const r = db.prepare(sql).run(...(binds as never[])); return { meta: { changes: Number(r.changes) } } },
    }
    return self
  }
  return { prepare: stmt } as unknown as D1Database
}
const src = (p: string) => readFileSync(p, 'utf8')

describe('① 인플루언서 통계 캐시', () => {
  const db = new DatabaseSync(':memory:'); db.exec('CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT)')
  const DB = d1(db)
  const NOW = 1_800_000_000_000
  it('처음엔 계산하고 저장 · 수명 안에선 다시 안 계산', async () => {
    let calls = 0
    const a = await getInfluencerStatsCached(DB, false, async () => ({ v: ++calls }), undefined, NOW)
    expect(a.stats).toEqual({ v: 1 })
    const b = await getInfluencerStatsCached(DB, false, async () => ({ v: ++calls }), undefined, NOW + 60_000)
    expect(b.stats).toEqual({ v: 1 }); expect(calls).toBe(1)
    expect(db.prepare('SELECT COUNT(*) n FROM platform_settings WHERE key = ?').get(INFLUENCER_STATS_CACHE_KEY)).toEqual({ n: 1 })
  })
  it('fresh 면 캐시를 건너뛴다', async () => {
    let calls = 0
    const r = await getInfluencerStatsCached(DB, true, async () => ({ v: 100 + ++calls }))
    expect(r.stats).toEqual({ v: 101 }); expect(calls).toBe(1)
  })
  it('수명이 지났어도 2시간 안이면 낡은 값을 먼저 주고 갱신은 뒤로', async () => {
    db.prepare('INSERT OR REPLACE INTO platform_settings VALUES (?, ?)').run(INFLUENCER_STATS_CACHE_KEY, JSON.stringify({ at: NOW, data: { v: 'old' } }))
    const later: Promise<unknown>[] = []
    const r = await getInfluencerStatsCached(DB, false, async () => ({ v: 'new' }), p => later.push(p), NOW + INFLUENCER_STATS_TTL_MS + 1000)
    expect(r.stats).toEqual({ v: 'old' }); expect(later).toHaveLength(1)
    await Promise.all(later)
    expect(JSON.parse((db.prepare('SELECT value FROM platform_settings WHERE key = ?').get(INFLUENCER_STATS_CACHE_KEY) as { value: string }).value).data).toEqual({ v: 'new' })
  })
  it('통계 빌더가 캐시를 거치고 오늘 값을 실시간으로 덮는다 · 라우트가 fresh·waitUntil 을 넘긴다', () => {
    const s = src('src/features/marketing/api/influencer-pool-stats.ts')
    expect(s).toMatch(/getInfluencerStatsCached<Heavy>\(DB, !!opts\.fresh, \(\) => computeHeavy\(DB\), opts\.bg\)/)
    expect(s).toMatch(/const byDay = mergeTodayInflow\(heavy\.byDay, today\)/)
    expect(s).toMatch(/\.\.\.\(today \? \{ today: today\.n \} : \{\}\)/)
    expect(src('src/features/marketing/api/pool-timeline.routes.ts')).toMatch(/buildInfluencerPoolStats\(c\.env, \{ fresh: c\.req\.query\('fresh'\) === '1', bg \}\)/)
  })
})

describe('② 오늘 유입 덮어쓰기', () => {
  const days = [{ d: '2026-11-18', n: 10, reachable: 1 }, { d: '2026-11-17', n: 50, reachable: 5 }]
  it('오늘 줄을 실시간 값으로 바꾼다', () => {
    expect(mergeTodayInflow(days, { d: '2026-11-18', n: 99, reachable: 9 })[0]).toEqual({ d: '2026-11-18', n: 99, reachable: 9 })
  })
  it('자정을 넘겨 캐시에 오늘 줄이 없으면 맨 앞에 넣는다 · 14일을 넘지 않는다', () => {
    const r = mergeTodayInflow(days, { d: '2026-11-19', n: 3, reachable: 0 })
    expect(r.map(x => x.d)).toEqual(['2026-11-19', '2026-11-18', '2026-11-17'])
    const many = Array.from({ length: 14 }, (_, i) => ({ d: `2026-10-${String(30 - i).padStart(2, '0')}`, n: 1, reachable: 0 }))
    expect(mergeTodayInflow(many, { d: '2026-10-31', n: 1, reachable: 0 })).toHaveLength(14)
  })
  it('실시간 값을 못 구하면 캐시 표 그대로(그래프가 사라지지 않는다)', () => expect(mergeTodayInflow(days, null)).toBe(days))
})

describe('③ 14일 유입이 collected_at 인덱스를 탄다', () => {
  it('진짜 SQLite 플랜', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE ad_influencer_leads (id INTEGER PRIMARY KEY, account_id INTEGER, collected_at TEXT, email TEXT);
      CREATE INDEX idx_ad_inf_leads_acct ON ad_influencer_leads(account_id, id);
      CREATE INDEX idx_ad_inf_leads_collected_at ON ad_influencer_leads(collected_at);`)
    const s = src('src/features/marketing/api/influencer-pool-stats.ts')
    const q = s.slice(s.indexOf("const byDay = ((await DB.prepare(`") + "const byDay = ((await DB.prepare(`".length, s.indexOf('GROUP BY d ORDER BY d DESC LIMIT 14`)') + 'GROUP BY d ORDER BY d DESC LIMIT 14'.length)
    expect(q).toMatch(/WHERE \+account_id = \?/)
    const plan = (db.prepare('EXPLAIN QUERY PLAN ' + q).all(0) as Array<{ detail: string }>).map(r => r.detail).join(' | ')
    expect(plan).toMatch(/idx_ad_inf_leads_collected_at/)
  })
})

describe('④ 파트너 목록 정렬 인덱스', () => {
  const idx = COMPANY_INDEX_DDL.find(x => x.includes('idx_company_leads_list_order'))!
  it('인덱스가 있고 정렬 키가 목록 쿼리와 같다', () => {
    expect(idx).toBeTruthy()
    const list = src('src/features/marketing/api/company-discovery.ts')
    expect(list).toContain('ORDER BY active DESC, (tier IS NULL) ASC, tier ASC, collected_at DESC, id DESC LIMIT ? OFFSET ?')
    expect(idx.replace(/\s+/g, ' ').replace(/\( /g, '(')).toContain('(active DESC, (tier IS NULL), tier, collected_at DESC, id DESC) WHERE merged_into IS NULL')
  })
  it('진짜 SQLite — 보류 포함·active=1 둘 다 임시 정렬 없이 인덱스로', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE ad_company_leads (id INTEGER PRIMARY KEY, active INTEGER, tier INTEGER, collected_at TEXT, merged_into INTEGER, category TEXT)')
    db.exec(idx)
    const order = 'ORDER BY active DESC, (tier IS NULL) ASC, tier ASC, collected_at DESC, id DESC LIMIT 50 OFFSET 0'
    for (const where of ['1=1 AND merged_into IS NULL', '1=1 AND merged_into IS NULL AND active = 1']) {
      const plan = (db.prepare(`EXPLAIN QUERY PLAN SELECT id FROM ad_company_leads WHERE ${where} ${order}`).all() as Array<{ detail: string }>).map(r => r.detail).join(' | ')
      expect(plan, where).toMatch(/idx_company_leads_list_order/)
      expect(plan, where).not.toMatch(/TEMP B-TREE/)
    }
  })
})

describe('⑤ 화면 — 첫 로드·폴링은 캐시, 바꾼 뒤에만 fresh', () => {
  it('loadStats(fresh) · loadMeta 는 fresh', () => {
    const s = src('src/pages/admin/influencer-pool/usePoolMeta.ts')
    expect(s).toMatch(/influencer-pool\/stats\$\{fresh \? '\?fresh=1' : ''\}/)
    expect(s).toMatch(/loadStats\(true\), loadKeywords\(\)/)
    expect(src('src/pages/admin/AdminInfluencerPoolPage.tsx')).toMatch(/useEffect\(\(\) => \{ loadStats\(\) \}, \[loadStats\]\)/)
  })
})

describe('⑥ 오늘의 컨택 — 이메일 줄·전화 줄을 따로, 인덱스 순서로', async () => {
  const { contactListQueries } = await import('@/features/marketing/api/contact-list-queries')
  const q = contactListQueries(10)
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE ad_company_leads (id INTEGER PRIMARY KEY, company_name TEXT, category TEXT, subcategory TEXT, tier INTEGER, region TEXT, email TEXT, phone TEXT, website TEXT, active INTEGER, merged_into INTEGER, status TEXT, collected_at TEXT);
    CREATE INDEX idx_company_leads_active ON ad_company_leads(active, tier, id);
    CREATE TABLE store_prospects (id INTEGER PRIMARY KEY, biz_name TEXT, category TEXT, region TEXT, email TEXT, phone TEXT, website TEXT, is_new_open INTEGER, apv_perm_ymd TEXT, active INTEGER, status TEXT);
    CREATE INDEX idx_prospects_active ON store_prospects(active, category, id);
    CREATE INDEX idx_prospects_newopen ON store_prospects(is_new_open, apv_perm_ymd);`)
  db.exec(COMPANY_INDEX_DDL.find(x => x.includes('idx_company_leads_list_order'))!)
  const plan = (sql: string) => (db.prepare('EXPLAIN QUERY PLAN ' + sql).all(10) as Array<{ detail: string }>).map(r => r.detail).join(' | ')
  it('업체 두 줄은 목록 정렬 인덱스로 · 임시 정렬 없음', () => {
    for (const k of ['companyEmail', 'companyPhone'] as const) {
      expect(plan(q[k]), k).toMatch(/idx_company_leads_list_order/)
      expect(plan(q[k]), k).not.toMatch(/TEMP B-TREE/)
    }
  })
  it('매장 전화 줄은 개업·인허가 인덱스 순서로(active 인덱스를 타지 않게 +active)', () => {
    expect(plan(q.storePhone)).toMatch(/idx_prospects_newopen/)
    expect(q.storePhone).toMatch(/\+active = 1/)
    expect(q.storeEmail).toMatch(/\+active = 1/)
  })
  it('진짜 SQLite — 결과는 이메일 그룹 먼저, 모자라면 전화로 채운다(라우트 배선)', () => {
    const r = src('src/features/marketing/api/partner-pool.routes.ts')
    expect(r).toMatch(/const companies = \[\.\.\.coEmail, \.\.\.await pick\(q\.companyPhone, limit - coEmail\.length\)\]/)
    expect(r).toMatch(/const stores = \[\.\.\.stEmail, \.\.\.await pick\(q\.storePhone, limit - stEmail\.length\)\]/)
    expect(r).not.toMatch(/ORDER BY \(CASE WHEN email IS NOT NULL AND email != '' THEN 0 ELSE 1 END\)/)
  })
})
