/**
 * 📉 유어애즈 D1 읽기 다이어트 — 2026-09-02 (9/1 계정 일일 읽기 한도 사고, 정적 감사 §3).
 *   ① 키워드 수율 재계산 6h 버킷 게이트(92회/일 → 4회/일)
 *   ② 유입 감시 sendable 두 축 — 교차 DB 한 문장이 라우터에서 조용히 죽던 결함 → 테이블당 한 문장(라우팅 실증)
 *   ③ 자기 링크 소음 후보 부분 인덱스 + `links IS NOT NULL` 명시 + 꼬리 조기 종료
 *   ④ 리마인드/온보딩 0건 모양 전수 → 부분 인덱스(ALTER 직후 생성)
 *   ⑤ collected_at 인덱스
 *   ⑥ 플래너 실증(node:sqlite) — 새 인덱스를 실제로 타는가(이웃 인덱스에 밀리지 않는가)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'module'
import { kwYieldBucket, recomputeKeywordContactYieldBucketed, KW_YIELD_STAMP_KEY, KW_YIELD_BUCKET_HOURS } from '@/features/marketing/api/influencer-keyword-yield'
import { readSendableTotals } from '@/features/marketing/api/inflow-watchdog'
import { adsLeadsDb } from '@/shared/ads/leads-db'

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const SCHEMA = readFileSync('src/features/marketing/api/influencer-schema.ts', 'utf8')
const MAINT = readFileSync('src/features/marketing/api/influencer-maintenance.ts', 'utf8')
const REMIND = readFileSync('src/features/marketing/api/consented-reminder.ts', 'utf8')
const ONBOARD = readFileSync('src/features/marketing/api/inbound-onboarding.ts', 'utf8')

describe('① 키워드 수율 6h 버킷', () => {
  it('버킷은 6시간 단위(UTC)', () => {
    expect(KW_YIELD_BUCKET_HOURS).toBe(6)
    expect(kwYieldBucket(Date.UTC(2026, 8, 2, 5, 59))).toBe('2026-09-02:0')
    expect(kwYieldBucket(Date.UTC(2026, 8, 2, 6, 0))).toBe('2026-09-02:1')
    expect(kwYieldBucket(Date.UTC(2026, 8, 2, 23, 59))).toBe('2026-09-02:3')
  })
  it('같은 버킷이면 전수 GROUP BY 를 안 돌리고, 다른 버킷이면 돌린 뒤 스탬프를 쓴다', async () => {
    const calls: string[] = []
    let stamp: string | null = null
    const db = { prepare: (sql: string) => {
      const c = sql.replace(/\s+/g, ' ').trim(); const stmt = {
        bind: (...a: unknown[]) => { if (c.startsWith('INSERT OR REPLACE INTO platform_settings')) stamp = String(a[1]); return stmt },
        first: async () => { calls.push(c); return c.includes('FROM platform_settings') ? (stamp ? { value: stamp } : null) : null },
        all: async () => { calls.push(c); return { results: [] } },
        run: async () => { calls.push(c); return {} },
      }; return stmt
    }, batch: async () => [] } as never
    const t = Date.UTC(2026, 8, 2, 1, 0)
    expect(await recomputeKeywordContactYieldBucketed(db, t)).toEqual({ keywords: 0, scanned: 0 })
    expect(calls.filter((c) => c.includes('GROUP BY source_keyword')).length).toBe(1)
    expect(stamp).toBe('2026-09-02:0')
    expect(await recomputeKeywordContactYieldBucketed(db, t + 60_000)).toEqual({ skipped: 'bucket', bucket: '2026-09-02:0' })
    expect(calls.filter((c) => c.includes('GROUP BY source_keyword')).length).toBe(1)
    expect(await recomputeKeywordContactYieldBucketed(db, t + 6 * 3600_000)).toEqual({ keywords: 0, scanned: 0 })
    expect(calls.filter((c) => c.includes('GROUP BY source_keyword')).length).toBe(2)
    expect(KW_YIELD_STAMP_KEY).toBe('ads_kw_yield_bucket')
  })
  it('배선 — 정비 reclassify 슬롯이 버킷 게이트를 부른다', () => {
    expect(MAINT).toMatch(/phase === 'reclassify'[^\n]*recomputeKeywordContactYieldBucketed\(DB\)/)
  })
})

describe('② 유입 감시 sendable — 라우터를 실제로 태운다', () => {
  function fakeDb(name: string, tables: string[], log: string[]) {
    const stmtFor = (sql: string) => ({
      bind: () => stmtFor(sql),
      first: async () => {
        // 문장에 등장하는 **모든** 리드 테이블을 본다 — 첫 FROM 만 보면 교차 문장(`FROM a, b`)을 못 잡는다(주입 검증이 그걸 잡았다).
        const named = [...new Set([...sql.matchAll(/\bad_\w+_leads\b/g)].map((m) => m[0]))]
        for (const t of named) log.push(`${name}:${t}`)
        const missing = named.find((t) => !tables.includes(t))
        if (missing) throw new Error(`no such table: ${missing}`)
        return { n: name === 'ads' ? 7 : 3 }
      },
      all: async () => ({ results: [] }), run: async () => ({}),
    })
    return { prepare: stmtFor, batch: async () => [] }
  }
  it('두 COUNT 가 각자 자기 DB 로 간다(교차 문장이면 company DB 에서 죽어 null 이었다)', async () => {
    const log: string[] = []
    const env = { DB: fakeDb('main', ['platform_settings'], log), ADS_DB: fakeDb('ads', ['ad_influencer_leads'], log), ADS_COMPANY_DB: fakeDb('company', ['ad_company_leads'], log) }
    const out = await readSendableTotals(adsLeadsDb(env as never) as never)
    expect(out).toEqual({ influencer: 7, company: 3 })
    expect(log.sort()).toEqual(['ads:ad_influencer_leads', 'company:ad_company_leads'])
  })
})

describe('③④⑤ 인덱스·쿼리 모양', () => {
  it('자기 링크 조회에 links IS NOT NULL 이 명시돼 있고 꼬리에서 끝난다', () => {
    const fn = MAINT.slice(MAINT.indexOf('async function cleanSelfLinkNoise'))
    expect(fn).toMatch(/platform = 'naver_blog' AND id > \? AND links IS NOT NULL AND links LIKE \?/)
    expect(fn).toMatch(/if \(rows\.length < PAGE\) \{ done = true; break \}/)
  })
  it('selflink 부분 인덱스는 DDL 의 마지막 ALTER 뒤에 있다(ALTER 컬럼 참조)', () => {
    const s = strip(SCHEMA)
    const lastAlter = s.lastIndexOf('ALTER TABLE ad_influencer_leads ADD COLUMN')
    const idx = s.indexOf('idx_ad_inf_leads_selflink')
    expect(idx).toBeGreaterThan(lastAlter)
    expect(s).toMatch(/idx_ad_inf_leads_selflink ON ad_influencer_leads\(account_id, id\)\s+WHERE platform = 'naver_blog' AND links IS NOT NULL/)
    expect(s).toContain('idx_ad_inf_leads_collected_at ON ad_influencer_leads(collected_at)')
  })
  it('리마인드/온보딩 부분 인덱스는 컬럼 ALTER 직후에 만든다', () => {
    const r = strip(REMIND); const o = strip(ONBOARD)
    expect(r.indexOf('idx_ad_inf_leads_remind_todo')).toBeGreaterThan(r.indexOf('ADD COLUMN reminded_at'))
    expect(o.indexOf('idx_ad_inf_leads_onboard_todo')).toBeGreaterThan(o.indexOf('ADD COLUMN onboarded_at'))
  })
})

describe('⑥ 플래너 실증 (node:sqlite)', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
  const ddl = (): string[] => {
    const out: string[] = []
    for (const m of strip(SCHEMA).matchAll(/'((?:CREATE|DROP|ALTER)[^']*ad_influencer_leads[^']*)'|`((?:CREATE|DROP|ALTER)[\s\S]*?ad_influencer_leads[\s\S]*?)`/g))
      out.push((m[1] || m[2]).replace(/\s+/g, ' ').trim())
    expect(out.length).toBeGreaterThan(4)
    return out
  }
  // ⚠️ 백틱 문장 안에 `'inbound'` 같은 작은따옴표가 있어 구분자를 섞어 잡으면 중간에서 끊긴다 — 구분자별로 따로 잡는다.
  const extra = (src: string): string[] => [...strip(src).matchAll(/`((?:ALTER|CREATE INDEX)[\s\S]*?ad_influencer_leads[\s\S]*?)`|'((?:ALTER|CREATE INDEX)[^']*ad_influencer_leads[^']*)'/g)].map((m) => (m[1] || m[2]).replace(/\s+/g, ' ').trim())
  const seed = () => {
    const db = new DatabaseSync(':memory:')
    for (const sql of [...ddl(), ...extra(REMIND), ...extra(ONBOARD)]) { try { db.exec(sql) } catch { /* 중복 ALTER 등 — 라이브와 같은 관용 */ } }
    for (const col of ['contact_channel TEXT', 'replied_at TEXT', 'email_status TEXT']) { try { db.exec(`ALTER TABLE ad_influencer_leads ADD COLUMN ${col}`) } catch { /* 있으면 통과 */ } }
    const ins = db.prepare('INSERT INTO ad_influencer_leads (id,account_id,platform,channel_id,name,url,email,links,source,consented_at,contacted_at,collected_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    let r = 7; const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648
    for (let i = 1; i <= 20000; i++)
      ins.run(i, 0, rnd() < 0.7 ? 'naver_blog' : 'youtube', 'c' + i, 'n' + i, 'https://u/' + i, rnd() < 0.15 ? `a${i}@b.com` : null,
        rnd() < 0.05 ? 'https://blog.naver.com/x' : null, rnd() < 0.01 ? 'inbound' : 'naver', rnd() < 0.02 ? '2026-08-01' : null, rnd() < 0.02 ? '2026-08-02' : null, '2026-08-0' + (1 + (i % 9)))
    return db
  }
  const plan = (db: InstanceType<typeof DatabaseSync>, sql: string) =>
    db.prepare('EXPLAIN QUERY PLAN ' + sql).all().map((x: Record<string, unknown>) => String(x.detail)).join(' | ')

  it('🔒 자기 링크 후보 조회가 부분 인덱스를 탄다', () => {
    const db = seed()
    expect(plan(db, `SELECT id, links FROM ad_influencer_leads WHERE account_id = 0 AND platform = 'naver_blog' AND id > 0 AND links IS NOT NULL AND links LIKE '%naver%' ORDER BY id ASC LIMIT 500`)).toContain('idx_ad_inf_leads_selflink')
    db.close()
  })
  it('🔒 리마인드·온보딩 대상 조회가 각자 부분 인덱스를 탄다(0건이어도 전수를 안 읽는다)', () => {
    const db = seed()
    expect(plan(db, `SELECT id FROM ad_influencer_leads WHERE account_id = 0 AND consented_at IS NOT NULL AND email IS NOT NULL AND contact_channel = 'email' AND contacted_at IS NOT NULL AND contacted_at <= datetime('now','-3 days') AND reminded_at IS NULL AND replied_at IS NULL AND status IN ('contacted') ORDER BY contacted_at ASC LIMIT 50`)).toContain('idx_ad_inf_leads_remind_todo')
    expect(plan(db, `SELECT id FROM ad_influencer_leads WHERE account_id = 0 AND source = 'inbound' AND consented_at IS NOT NULL AND email IS NOT NULL AND onboarded_at IS NULL AND consented_at <= datetime('now','-1 hours') ORDER BY consented_at ASC LIMIT 50`)).toContain('idx_ad_inf_leads_onboard_todo')
    db.close()
  })
  it('🔒 최근 창(collected_at) 집계가 인덱스를 탄다', () => {
    const db = seed()
    expect(plan(db, `SELECT date(collected_at,'+9 hours') d, COUNT(*) n FROM ad_influencer_leads WHERE collected_at >= datetime('now','-18 days') GROUP BY d`)).toContain('idx_ad_inf_leads_collected_at')
    db.close()
  })
})
