/**
 * ☎️📧 남의 연락처 · 가짜 연락처 정리 + 보류가 되살아나지 않게 (2026-11-17 대표 *"다 해줘"*).
 *
 * 지키는 것
 *   ① 가짜 연락처 판정 — 라이브에서 실측한 값이 걸리고, 진짜 번호·회사 메일은 안 걸린다
 *   ② 남의 연락처 = 업종 3개 이상에 걸친 같은 연락처 → 칸을 비우고 억제 표에 넣는다.
 *      같은 브랜드 지점 묶음(업종 1개)과 등록부 출처 전화는 그대로 둔다. 주 1회만 돈다.
 *   ③ (다음 PR) 규칙 보류(`hold_reason`)가 재수집·보강에 안 풀리게 — 칸이 라이브에 생긴 뒤 붙인다
 *   ④ 한 SQL 문장이 업체 DB 표와 리드 DB 표를 섞지 않는다(라우터가 한쪽 DB 로 보내 `no such table` 로 죽는다)
 *   ⑤ 위생 스윕이 조회 실패를 '결함 0' 으로 읽고 커서를 넘기지 않는다
 *
 * ⚠️ 못 보는 것: 라이브 D1 의 읽기량(주 1회 전화 집계가 테이블 1회 통과라는 것은 쿼리 모양으로만 안다) ·
 *   문턱(행 5 · 업종 3)이 진짜 같은 사장님의 여러 업종 가게를 잘못 거르는 경우(실측 상위 목록엔 없었다).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  isPlaceholderPhone, isPlaceholderEmail, sweepSharedContacts, kstWeekKey, SHARED_PHONE_KEY,
} from '@/features/marketing/api/company-contact-quality'
import { hygieneStatements } from '@/features/marketing/api/company-lead-hygiene'
import { HYGIENE_SUSPECT_SQL, HYGIENE_SWEEP_VERSION } from '@/features/marketing/api/company-hygiene-sweep'

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
  return {
    prepare: stmt,
    batch: async (list: Array<{ run: () => Promise<unknown> }>) => { const out = []; for (const s of list) out.push(await s.run()); return out },
  } as unknown as D1Database
}

describe('① 가짜 연락처 판정 — 라이브 실측 값', () => {
  it.each(['N/A', '010-0000-0000', '010-1234-5678', '010-1234-1234', '010-개인정보', '02-0000-0000', '02-1234-5678', '1111'])('%s → 가짜', p => {
    expect(isPlaceholderPhone(p)).toBe(true)
  })
  it.each(['031-709-8111', '1668-1646', '010-4233-5119', '02-3445-2030', '070-4667-2900', '052-5525-5255', '02-928-6446(팩스)'])('%s → 번호 모양은 진짜(남의 것 판정은 ②)', p => {
    expect(isPlaceholderPhone(p)).toBe(false)
  })
  it.each(['gmail.com@gmail.com', 'email@naver.com', '111@111.com', 'test@example.com', 'aaaa@daum.net', 'naver@naver.com', 'naver.com@naver.com', '0000@0000.co.kr'])('%s → 가짜', e => {
    expect(isPlaceholderEmail(e)).toBe(true)
  })
  it.each(['mail@hanbitlaw.co.kr', 'admin@startupbridgeva.com', 'hosting@gabia.com', 'obok5555@naver.com', 'info@company.co.kr', 'kim.admin@naver.com', 'lawus@lawus.co.kr', 'gi-corp@gi-corp.co.kr'])('%s → 가짜 아님', e => {
    expect(isPlaceholderEmail(e)).toBe(false)
  })
})

function seed(): Db {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE ad_company_leads (id INTEGER PRIMARY KEY, company_name TEXT, category TEXT, email TEXT, phone TEXT,
    contact_source TEXT, active INTEGER DEFAULT 1, merged_into INTEGER)`)
  db.exec('CREATE TABLE ad_email_suppress (email TEXT PRIMARY KEY, reason TEXT, created_at TEXT)')
  db.exec('CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT)')
  const ins = db.prepare('INSERT INTO ad_company_leads (id, company_name, category, email, phone, contact_source) VALUES (?, ?, ?, ?, ?, ?)')
  const cats = ['청소', '이사', '대행사', '창업', '맛집', '뷰티']
  let id = 1
  // 호스팅사 메일 — 업종 6개, 행 6 → 남의 것. 그중 하나는 전화도 있다(활성 유지), 나머지는 연락처가 없어진다(보류).
  for (const c of cats) ins.run(id++, `${c}업체`, c, 'hosting@gabia.com', id === 2 ? '02-3445-2030' : null, 'homepage')
  // 같은 브랜드 지점 — 업종 1개, 행 6 → 그대로
  for (let i = 0; i < 6; i++) ins.run(id++, `그린프로청소 ${i}점`, '청소', 'greencleanup@naver.com', null, 'homepage')
  // 위젯 전화 — 업종 5개 크롤 출처 5행 → 비움. 같은 번호의 등록부(commerce) 행은 남긴다.
  for (const c of cats.slice(0, 5)) ins.run(id++, `${c}가게`, c, null, '052-5525-5255', 'homepage')
  ins.run(id++, '신고한상점', '온라인판매', null, '052-5525-5255', 'commerce')
  // contact_source NULL 도 크롤 출처로 센다(`NULL NOT IN` 함정)
  for (const c of cats.slice(0, 5)) ins.run(id++, `${c}웹`, c, 'support@dable.io', null, null)
  return db
}

describe('② 남의 연락처 — 진짜 SQLite', async () => {
  const db = seed(); const DB = d1(db)
  const now = Date.UTC(2026, 10, 17, 3, 0)
  const r = await sweepSharedContacts(DB, now)
  const rows = (where: string) => db.prepare(`SELECT id, email, phone, active FROM ad_company_leads WHERE ${where} ORDER BY id`).all() as Array<{ id: number; email: string | null; phone: string | null; active: number }>

  it('호스팅사 메일은 비우고 억제 표에 넣는다 · 연락처가 없어진 행은 보류, 전화가 남은 행은 활성', () => {
    expect(r.error).toBeUndefined()
    expect(rows("company_name LIKE '%업체'").every(x => x.email === null)).toBe(true)
    expect(rows("company_name LIKE '%업체' AND phone IS NOT NULL").map(x => x.active)).toEqual([1])
    expect(rows("company_name LIKE '%업체' AND phone IS NULL").every(x => x.active === 0)).toBe(true)
    const sup = db.prepare("SELECT email, reason FROM ad_email_suppress ORDER BY email").all()
    expect(sup).toEqual([{ email: 'hosting@gabia.com', reason: 'shared_vendor' }, { email: 'support@dable.io', reason: 'shared_vendor' }])
  })
  it('contact_source 가 NULL 인 행도 센다', () => expect(rows("company_name LIKE '%웹'").every(x => x.email === null)).toBe(true))
  it('같은 브랜드 지점 묶음(업종 1개)은 건드리지 않는다', () => {
    expect(rows("company_name LIKE '그린프로청소%'").every(x => x.email === 'greencleanup@naver.com' && x.active === 1)).toBe(true)
  })
  it('위젯 전화는 크롤 출처에서만 비우고, 등록부 출처는 남긴다 · 차단 목록에 남는다', () => {
    expect(rows("company_name LIKE '%가게'").every(x => x.phone === null && x.active === 0)).toBe(true)
    expect(rows("company_name = '신고한상점'")[0].phone).toBe('052-5525-5255')
    const block = db.prepare('SELECT value FROM platform_settings WHERE key = ?').get(SHARED_PHONE_KEY) as { value: string }
    expect(JSON.parse(block.value)).toContain('052-5525-5255')
  })
  it('같은 주에는 다시 안 돈다 · 다음 주엔 돈다', async () => {
    expect((await sweepSharedContacts(DB, now + 3600_000)).skipped).toBe(true)
    expect((await sweepSharedContacts(DB, now + 7 * 86400_000)).skipped).toBeUndefined()
    expect(kstWeekKey(Date.UTC(2026, 10, 15, 15, 30))).toBe('2026-11-16') // KST 월 00:30 → 그 주
    expect(kstWeekKey(Date.UTC(2026, 10, 15, 14, 30))).toBe('2026-11-09') // KST 일 23:30 → 앞 주
  })
})

describe('위생 문장 — 가짜 연락처', () => {
  const stmts = (r: Record<string, unknown>) => hygieneStatements({ id: 1, company_name: 'x', phone: null, email: null, website: null, category: null, contact_source: null, ...r } as never,
    sql => ({ bind: (...a: unknown[]) => `${sql} :: ${a.join(',')}` }))
  it('가짜 전화·메일은 칸을 비운다(출처 무관)', () => {
    expect(stmts({ phone: '010-0000-0000', contact_source: 'commerce' }).some(s => /SET phone = NULL/.test(String(s)))).toBe(true)
    expect(stmts({ email: 'gmail.com@gmail.com', contact_source: 'commerce' }).some(s => /SET email = NULL/.test(String(s)))).toBe(true)
  })
  it('스윕 좁히개가 같은 행을 집는다 · 세대가 올라갔다', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE ad_company_leads (id INTEGER PRIMARY KEY, company_name TEXT, phone TEXT, email TEXT, active INTEGER, category TEXT, merged_into INTEGER)')
    db.prepare(`INSERT INTO ad_company_leads (id, company_name, phone, email, active, category) VALUES
      (1, 'a', 'N/A', NULL, 1, '청소'), (2, 'b', NULL, 'email@naver.com', 1, '청소'), (3, 'c', '010-0000-0000', NULL, 1, '청소'),
      (4, 'd', NULL, 'gmail.com@gmail.com', 1, '온라인판매'), (5, '정상', '02-3445-2030', 'info@ok.kr', 1, '청소')`).run()
    const ids = (db.prepare(`SELECT id FROM ad_company_leads WHERE ${HYGIENE_SUSPECT_SQL} ORDER BY id`).all() as Array<{ id: number }>).map(r => r.id)
    expect(ids).toEqual([1, 2, 3, 4])
    expect(HYGIENE_SWEEP_VERSION).toBeGreaterThanOrEqual(3)
  })
})

/** 문자열 리터럴만 뽑는다(주석 속 SQL 예시는 대상이 아니다). */
function sqlLiterals(src: string): Array<{ text: string; line: number }> {
  const out: Array<{ text: string; line: number }> = []
  const rx = /`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/gs
  let m: RegExpExecArray | null
  while ((m = rx.exec(src))) out.push({ text: m[0], line: src.slice(0, m.index).split('\n').length })
  return out
}
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? (n === 'tests' ? [] : walk(p)) : p.endsWith('.ts') ? [p] : [] })
}
const FILES = walk('src')

describe('④ 한 문장에 두 DB 의 표를 섞지 않는다', () => {
  it('업체 표(ad_company_*)와 리드 DB 표가 같은 SQL 에 없다', async () => {
    const { ADS_LEADS_TABLES, ADS_COMPANY_TABLES } = await import('@/shared/ads/leads-db')
    const company = new RegExp(`\\b(?:${ADS_COMPANY_TABLES.join('|')})\\b`)
    const others = ADS_LEADS_TABLES.filter(t => !(ADS_COMPANY_TABLES as readonly string[]).includes(t))
    const other = new RegExp(`\\b(?:${others.join('|')})\\b`)
    const offenders: string[] = []
    for (const f of FILES) for (const { text, line } of sqlLiterals(readFileSync(f, 'utf8'))) {
      if (/\b(SELECT|UPDATE|INSERT|DELETE)\b/.test(text) && company.test(text) && other.test(text)) offenders.push(`${f}:${line}`)
    }
    expect(offenders).toEqual([])
  })
})

describe('⑤ 위생 스윕 — 조회 실패에 커서를 안 넘긴다', () => {
  it('실패면 cursor 그대로 · done:false', () => {
    const s = readFileSync('src/features/marketing/api/company-hygiene-sweep.ts', 'utf8')
    expect(s).toMatch(/if \(!rowsRes\) return \{ scanned: 0, fixed: 0, cursor: st\.cursor, done: false \}/)
    expect(s).toMatch(/await ensureCompanySchema\(DB\)/)
  })
})

describe('⑥ 이메일 보강 — 생활·전문직 업종 줄(커서)', async () => {
  const P = await import('@/features/marketing/api/enrich-priority')
  const ids = (a: Array<{ id: number }>) => a.map(x => x.id)
  it('번갈아 세운다 · 겹치면 한 번만 · 한쪽이 비면 다른 쪽이 다 쓴다 · 상한', () => {
    expect(ids(P.interleaveTargets([{ id: 1 }, { id: 2 }], [{ id: 9 }, { id: 1 }, { id: 8 }], 10))).toEqual([1, 9, 2, 8])
    expect(ids(P.interleaveTargets([], [{ id: 5 }, { id: 6 }, { id: 7 }], 2))).toEqual([5, 6])
    expect(ids(P.interleaveTargets([{ id: 1 }, { id: 2 }, { id: 3 }], [], 10))).toEqual([1, 2, 3])
  })
  it('업종을 고르게 섞는다(한 업종이 앞자리를 다 먹지 않게)', () => {
    const rows = [{ id: 9, category: '이사' }, { id: 8, category: '이사' }, { id: 7, category: '청소' }, { id: 6, category: '청소' }]
    expect(ids(P.roundRobinByCategory(rows))).toEqual([9, 7, 8, 6])
  })
  it('커서: 큰 id 부터 연속으로 손댄 데까지만 · 0건 업종은 맨 위로', () => {
    const fetched = [{ id: 30, category: '이사' }, { id: 20, category: '이사' }, { id: 10, category: '이사' }, { id: 50, category: '청소' }]
    expect(P.nextPrioCursor({ 청소: 60, 방역·소독: 5 } as never, fetched, new Set([30, 10, 50]))).toEqual({ 이사: 30, 청소: 50 })
    expect(P.nextPrioCursor({ 이사: 40 }, fetched, new Set())).toEqual({ 이사: 40 }) // 아무것도 못 했으면 그대로
  })
  it('진짜 SQLite — 커서 아래·이메일 없음·7일 지남만, 업종마다 상한만큼', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE ad_company_leads (id INTEGER PRIMARY KEY, company_name TEXT, category TEXT, region TEXT, address TEXT, website TEXT,
      phone TEXT, email TEXT, source TEXT, source_keyword TEXT, status TEXT, merged_into INTEGER, enrich_checked_at TEXT, enrich_v INTEGER)`)
    const ins = db.prepare('INSERT INTO ad_company_leads (id, company_name, category, email, enrich_checked_at, enrich_v) VALUES (?, ?, ?, ?, ?, ?)')
    for (let i = 1; i <= 10; i++) ins.run(i, `이사${i}`, '이사', null, null, null)
    ins.run(11, '메일있음', '이사', 'a@b.kr', null, null)
    ins.run(12, '방금봄', '청소', null, new Date().toISOString().slice(0, 19).replace('T', ' '), 99)
    ins.run(13, '청소집', '청소', null, null, null)
    const q = P.priorityTargetsSql({ 이사: 9 }, 7)
    const got = (db.prepare(q.sql).all(...(q.binds as never[])) as Array<{ id: number }>).map(r => r.id)
    expect(got).toEqual([8, 7, 6, 13])
    expect(q.binds).toHaveLength(P.ENRICH_PRIORITY_CATEGORIES.length * 2)
  })
  it('업종 이름이 분류표와 같다(다르면 업종 줄이 영영 빈다)', async () => {
    const { COMPANY_CATEGORIES } = await import('@/features/marketing/api/company-discovery')
    for (const c of P.ENRICH_PRIORITY_CATEGORIES) expect(Object.keys(COMPANY_CATEGORIES), c).toContain(c)
  })
  it('보강 레인 배선 — 일반 쿼리엔 업종 조건이 없고(인덱스 유지), 두 줄을 번갈아 쓰고, 커서를 넘긴다', () => {
    const s = readFileSync('src/features/marketing/api/enrich-lane.ts', 'utf8')
    const general = s.slice(s.indexOf('const targets = (await DB.prepare('), s.indexOf('LIMIT ${targetCap}'))
    expect(general).not.toMatch(/category IN/)
    expect(s).toMatch(/const queue = interleaveTargets\(roundRobinByCategory\(prioRows\), targets, targetCap\)/)
    expect(s).toMatch(/runPooled\(queue, concurrency, handleLead, stopP2\)/)
    expect(s).toMatch(/nextPrioCursor\(prioCursor, prioRows, stampedIds\)/)
    expect(s).toMatch(/pendingStamps\.push\(id\); stampedIds\.add\(id\)/)
  })
})

describe('⑦ 정리 결과가 어드민에 보인다', async () => {
  const { sweptWeek } = await import('@/features/marketing/api/company-contact-quality')
  it('결과를 JSON 으로 남기고, 첫 배포분(주 문자열)도 같은 주로 읽는다', () => {
    expect(sweptWeek('2026-11-16')).toBe('2026-11-16')
    expect(sweptWeek(JSON.stringify({ week: '2026-11-16', emails: 3 }))).toBe('2026-11-16')
    expect(sweptWeek(null)).toBeNull()
  })
  it('stats 가 두 키를 읽어 contactQuality 로 내보내고 화면이 그린다', () => {
    const r = readFileSync('src/features/marketing/api/partner-pool.routes.ts', 'utf8')
    expect(r).toMatch(/readKey\('ads_shared_contact_sweep'\), readKey\('ads_company_hygiene_sweep'\)/)
    expect(r).toMatch(/contactQuality: \{ shared: sharedSweep, hygiene: hygieneSweep \}/)
    expect(readFileSync('src/pages/admin/AdminPartnerPoolPage.tsx', 'utf8')).toMatch(/contactQuality=\{contactQuality\}/)
    expect(readFileSync('src/pages/admin/partner-pool/StatusLines.tsx', 'utf8')).toMatch(/contactQuality\.shared\?\.at/)
  })
})
