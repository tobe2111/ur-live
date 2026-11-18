/**
 * 🧮 인플루언서 풀 통계 — 증분 집계 (2026-11-18 대표 *"증분 집계도 이어서 해줘"*).
 *
 * 진짜 SQLite(node:sqlite)에 라이브 칸 목록 그대로 표를 만들고 트리거를 깐 뒤, 무작위 넣기·고치기·지우기 수백 번을 돌려
 *   ① 트리거가 맞춘 숫자 == 같은 행을 처음부터 다시 센 값(전수 대조)
 *   ② 그 숫자 == **옛 화면 쿼리**(influencer-pool-stats.ts 의 집계 SQL 원문)가 내는 값 — 정의가 옛 값과 같다
 *   ③ 카테고리별 전환 · 14일 유입도 옛 쿼리와 같다
 *   ④ 자가 시험 batch 가 돌고 숫자를 안 바꾼다 · 트리거가 깨지면 내려가고 쓰기가 계속 된다
 *   ⑤ `7일 안 컨택` 쿼리가 부분 인덱스를 탄다 · 트리거가 읽는 칸이 전부 감시 목록에 있다 · REPLACE 쓰기 0건
 * ⚠️ 못 보는 것: D1 의 SQLite 가 node 와 다를 가능성(배포 후 `stats_source`·오류 키로 라이브 확인) · 라이브 쓰기량.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import * as C from '@/features/marketing/api/influencer-stats-counters'
import { personalEmailSqlClause } from '@/features/marketing/api/influencer-email-rules'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  const stmt = (sql: string) => {
    let binds: unknown[] = []
    const self = {
      sql, get binds() { return binds },
      bind: (...a: unknown[]) => { binds = a; return self },
      first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
      run: async () => { const r = db.prepare(sql).run(...(binds as never[])); return { meta: { changes: Number(r.changes) } } },
    }
    return self
  }
  // D1 batch = 한 트랜잭션(하나라도 실패하면 전부 되돌린다).
  const batch = async (list: Array<{ sql: string; binds: unknown[] }>) => {
    db.exec('BEGIN')
    try { for (const s of list) db.prepare(s.sql).run(...(s.binds as never[])); db.exec('COMMIT') } catch (e) { db.exec('ROLLBACK'); throw e }
    return []
  }
  return { prepare: stmt, batch } as unknown as D1Database
}

const SNAP = JSON.parse(readFileSync('src/shared/db/live-schema.snapshot.json', 'utf8')).tables.ad_influencer_leads as string
const LIVE_COLS = SNAP.split(',')
const REQUIRED: Record<string, string> = {
  id: 'INTEGER PRIMARY KEY AUTOINCREMENT', account_id: 'INTEGER NOT NULL', platform: "TEXT NOT NULL DEFAULT 'youtube'",
  channel_id: 'TEXT NOT NULL', name: 'TEXT NOT NULL', url: 'TEXT NOT NULL', subscriber_count: 'INTEGER NOT NULL DEFAULT 0',
  status: "TEXT NOT NULL DEFAULT 'new'", collected_at: "DATETIME DEFAULT (datetime('now'))",
}
function freshDb(): { db: Db; DB: D1Database } {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE ad_influencer_leads (${LIVE_COLS.map(c => `${c} ${REQUIRED[c] || ''}`).join(', ')}, UNIQUE(account_id, platform, channel_id))`)
  db.exec('CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT)')
  return { db, DB: d1(db) }
}

// 결정론적 난수(실패를 다시 돌려볼 수 있게).
function rng(seed: number) { return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff } }
const pick = <T,>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length)]
const VALUES: Record<string, unknown[]> = {
  account_id: [0, 0, 0, 0, 7],
  platform: ['youtube', 'naver_blog', 'naver_cafe', 'instagram'],
  email: [null, null, 'kim@gmail.com', 'biz@company.co.kr', 'me@naver.com', ''],
  instagram: [null, 'ig_x'], tiktok: [null, 'tt_x'], links: [null, '["https://x"]'],
  perf_checked_at: [null, '2026-11-01 00:00:00'],
  status: ['new', 'new', 'contacted', 'interested', 'contracted', 'rejected', 'hold'],
  email_status: [null, 'opened', 'bounced', 'complained', 'sent'],
  contact_channel: [null, 'email', 'dm', 'note', 'kakao', 'call', 'other'],
  consented_at: [null, '2026-11-02 00:00:00'], is_brand: [null, 0, 1], opted_out: [null, 0, 1],
  lead_score: [null, 10, 69, 70, 95], category: [null, '맛집', '운동', '여행', 'a|b'],
  category_source: [null, 'content', 'topic', 'keyword'], region: [null, '', '서울', '부산'],
  subscriber_count: [0, 0, 120], recruited_at: [null, '2026-11-03 00:00:00'],
}
// 지금에서 n일 + h시간 전(미래 시각이 나오지 않게 — 미래 행은 실제로 없다).
const daysAgo = (n: number, h = 1) => new Date(Date.now() - n * 86_400_000 - h * 3_600_000).toISOString().slice(0, 19).replace('T', ' ')

function randomOps(db: Db, seed: number, n: number) {
  const r = rng(seed)
  let ch = 0
  for (let i = 0; i < n; i++) {
    const ids = (db.prepare('SELECT id FROM ad_influencer_leads').all() as Array<{ id: number }>).map(x => x.id)
    const op = ids.length < 20 ? 0 : r()
    if (op < 0.45) {
      const row: Record<string, unknown> = { channel_id: `c${seed}_${ch++}`, name: 'n', url: 'u', collected_at: daysAgo(Math.floor(r() * 20), Math.floor(r() * 24)) }
      for (const k of Object.keys(VALUES)) row[k] = pick(r, VALUES[k])
      const keys = Object.keys(row)
      db.prepare(`INSERT INTO ad_influencer_leads (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...(keys.map(k => row[k]) as never[]))
    } else if (op < 0.9) {
      const id = pick(r, ids)
      const cols = Object.keys(VALUES).filter(() => r() < 0.3)
      if (r() < 0.1) cols.push('collected_at')
      if (!cols.length) cols.push('status')
      const vals = cols.map(c => (c === 'collected_at' ? daysAgo(Math.floor(r() * 20)) : pick(r, VALUES[c])))
      db.prepare(`UPDATE ad_influencer_leads SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`).run(...([...vals, id] as never[]))
    } else {
      db.prepare('DELETE FROM ad_influencer_leads WHERE id = ?').run(pick(r, ids))
    }
  }
}

const counters = (db: Db) => Object.fromEntries((db.prepare(`SELECT k, n FROM ${C.COUNTER_TABLE} WHERE k NOT LIKE '\\_\\_%' ESCAPE '\\' ORDER BY k`).all() as Array<{ k: string; n: number }>).filter(x => x.n !== 0).map(x => [x.k, x.n]))

const snapOf = (db: Db) => C.parseCounters(db.prepare(`SELECT k, n FROM ${C.COUNTER_TABLE}`).all() as Array<{ k: string; n: number }>)
/** 다 채울 때까지 조각을 센다(작은 폭으로 — 조각 경계를 많이 지나게). */
async function fill(DB: D1Database, db: Db, width = 37) {
  for (let i = 0; i < 10_000 && !snapOf(db).complete; i++) await C.runBootSteps(DB, 1, width)
  expect(snapOf(db).complete).toBe(true)
}
async function install(DB: D1Database, db: Db) {
  expect(await C.ensureStatsCounters(DB)).toBe(true)
  await fill(DB, db)
}
/** 같은 행을 처음부터 다시 센 값(쓰기 없이 다시 채운다). */
async function recount(DB: D1Database, db: Db) {
  await DB.batch(C.rebuildStatements().map(s => DB.prepare(s.sql).bind(...s.binds)))
  await fill(DB, db, 101)
  return counters(db)
}

/** 옛 화면 쿼리 원문(소스에서 그대로 꺼낸다 — 정의가 갈라지면 여기서 빨강). */
const POOL_SRC = readFileSync('src/features/marketing/api/influencer-pool-stats.ts', 'utf8')
const oldSql = (name: 'agg' | 'catFunnel' | 'byDay') => {
  const rx = { agg: /const agg = await DB\.prepare\(`([\s\S]*?)`\)\.bind/, catFunnel: /const catFunnel = await DB\.prepare\(`([\s\S]*?)`\)/, byDay: /const byDay = \(\(await DB\.prepare\(`([\s\S]*?)`\)\.bind/ }[name]
  const m = POOL_SRC.match(rx)
  expect(m, `옛 ${name} 쿼리를 소스에서 못 찾았다`).toBeTruthy()
  return m![1].replace(/\$\{personalEmailSqlClause\(\)\}/, personalEmailSqlClause())
}

describe('① 트리거가 맞춘 숫자 == 처음부터 다시 센 값', () => {
  for (const seed of [1, 2, 3]) {
    it(`다 채운 뒤 무작위 쓰기 400회 (seed ${seed})`, async () => {
      const { db, DB } = freshDb()
      randomOps(db, seed * 100, 80)      // 트리거 설치 전에 이미 있던 행
      await install(DB, db)
      randomOps(db, seed, 400)
      const byTrigger = counters(db)
      expect(Object.keys(byTrigger).length).toBeGreaterThan(20)
      expect(byTrigger).toEqual(await recount(DB, db))
    })
    it(`채우는 도중에 쓰기가 끼어들어도 같다 — 안 센 행 고치기·지우기·새 행 (seed ${seed})`, async () => {
      const { db, DB } = freshDb()
      randomOps(db, seed * 100 + 7, 150)
      expect(await C.ensureStatsCounters(DB)).toBe(true)
      for (let i = 0; i < 10_000 && !snapOf(db).complete; i++) {
        await C.runBootSteps(DB, 1, 23)
        randomOps(db, seed * 1000 + i, 6)  // 조각 사이마다 쓰기
      }
      expect(snapOf(db).complete).toBe(true)
      randomOps(db, seed + 50, 100)
      expect(counters(db)).toEqual(await recount(DB, db))
    })
  }
  it('두 isolate 가 같은 조각을 잡아도 한 번만 센다', async () => {
    const { db, DB } = freshDb()
    randomOps(db, 77, 120)
    expect(await C.ensureStatsCounters(DB)).toBe(true)
    const max = (db.prepare('SELECT MAX(id) m FROM ad_influencer_leads').get() as { m: number }).m
    const run = (t: number) => DB.batch(C.bootStepStatements(0, max, t, 1_000_000).map(s => DB.prepare(s.sql).bind(...s.binds)))
    await run(111)
    const once = counters(db)
    await run(222) // 진 쪽 — 커서가 이미 넘어갔다
    expect(counters(db)).toEqual(once)
    expect(snapOf(db).complete).toBe(true)
    expect(once).toEqual(await recount(DB, db))
  })
  it('어긋나면 다시 채우기로 돌아가고, 다시 채우면 맞는다', async () => {
    const { db, DB } = freshDb()
    randomOps(db, 88, 200)
    await install(DB, db)
    expect(await C.checkDrift(DB, 5)).toBe(false)
    expect(snapOf(db).checkedAt).toBe(5)
    db.prepare(`UPDATE ${C.COUNTER_TABLE} SET n = n + 3 WHERE k = 'total'`).run()
    expect(await C.checkDrift(DB, 6)).toBe(true)
    expect(snapOf(db).complete).toBe(false)
    randomOps(db, 89, 50)
    await fill(DB, db)
    const got = counters(db)
    expect(got).toEqual(await recount(DB, db))
  })
})

describe('② 정의가 옛 화면 쿼리와 같다', () => {
  it('전체 집계 키마다 옛 집계 SQL 값과 같다', async () => {
    const { db, DB } = freshDb()
    await install(DB, db)
    randomOps(db, 9, 500)
    const old = db.prepare(oldSql('agg').replace(/(--[^\n]*)/g, '')).get(0) as Record<string, number>
    const snap = C.parseCounters(db.prepare(`SELECT k, n FROM ${C.COUNTER_TABLE}`).all() as Array<{ k: string; n: number }>)
    for (const [k] of C.STATE_COUNTERS) expect([k, snap.state[k]]).toEqual([k, Number(old[k]) || 0])
    expect(snap.complete).toBe(true)
  })
  it('카테고리별 전환이 옛 쿼리와 같다', async () => {
    const { db, DB } = freshDb()
    await install(DB, db)
    randomOps(db, 11, 500)
    const old = db.prepare(oldSql('catFunnel')).all(0) as Array<Record<string, unknown>>
    const snap = C.parseCounters(db.prepare(`SELECT k, n FROM ${C.COUNTER_TABLE}`).all() as Array<{ k: string; n: number }>)
    const mine = C.topCategoryFunnel(snap.categories)
    const norm = (a: Array<Record<string, unknown>>) => a.map(x => ({ category: x.category, total: Number(x.total), reached: Number(x.reached), replied: Number(x.replied), contracted: Number(x.contracted), consented: Number(x.consented) })).sort((p, q) => String(p.category) < String(q.category) ? -1 : 1)
    expect(mine.length).toBeGreaterThan(0)
    expect(norm(mine)).toEqual(norm(old))
  })
  it('14일 유입이 옛 쿼리와 같다(창 안의 온전한 날)', async () => {
    const { db, DB } = freshDb()
    await install(DB, db)
    randomOps(db, 13, 500)
    const old = db.prepare(oldSql('byDay')).all(0) as Array<{ d: string; n: number; reachable: number }>
    const today = (db.prepare("SELECT DATE('now','+9 hours') d").get() as { d: string }).d
    const snap = C.parseCounters(db.prepare(`SELECT k, n FROM ${C.COUNTER_TABLE}`).all() as Array<{ k: string; n: number }>)
    const mine = C.lastDays(snap.days, today)
    expect(mine).toHaveLength(14)
    expect(mine[0].d).toBe(today)
    // 옛 쿼리는 '지금-14일' 에서 자르므로 맨 끝 날은 일부만 들어간다 — 끝 하루를 빼고 비교한다.
    for (const row of old.slice(0, 12)) {
      const m = mine.find(x => x.d === row.d)
      expect([row.d, m?.n, m?.reachable]).toEqual([row.d, Number(row.n), Number(row.reachable)])
    }
  })
})

describe('③ 수집을 절대 멈추지 않게', () => {
  it('자가 시험 batch 가 돌고, 숫자를 안 바꾸고, 시험 행을 안 남긴다', async () => {
    const { db, DB } = freshDb()
    await install(DB, db)
    randomOps(db, 21, 200)
    const before = counters(db)
    await DB.batch(C.selfTestStatements().map(s => DB.prepare(s.sql).bind(...s.binds)))
    expect(counters(db)).toEqual(before)
    expect(db.prepare('SELECT COUNT(*) n FROM ad_influencer_leads WHERE account_id = -1').get()).toEqual({ n: 0 })
  })
  it('트리거를 못 깔거나 자가 시험이 깨지면 트리거 0개로 물러나고, 쓰기가 계속 된다', async () => {
    // 라이브 표에 감시 칸 하나가 없는 상황을 흉내 낸다(칸 이름 변경·되돌림 등).
    const db = new DatabaseSync(':memory:')
    const cols = LIVE_COLS.filter(c => c !== 'recruited_at')
    db.exec(`CREATE TABLE ad_influencer_leads (${cols.map(c => `${c} ${REQUIRED[c] || ''}`).join(', ')}, UNIQUE(account_id, platform, channel_id))`)
    db.exec('CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT)')
    const DB = d1(db)
    expect(await C.ensureStatsCounters(DB)).toBe(false)
    const left = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type = 'trigger'").get() as { n: number }
    expect(left.n).toBe(0)
    db.prepare("INSERT INTO ad_influencer_leads (account_id, channel_id, name, url) VALUES (0, 'z', 'n', 'u')").run()
    db.prepare("UPDATE ad_influencer_leads SET status = 'hold' WHERE channel_id = 'z'").run()
    const err = db.prepare('SELECT value FROM platform_settings WHERE key = ?').get(C.COUNTER_ERROR_KEY) as { value: string }
    expect(['ensure', 'selftest']).toContain(JSON.parse(err.value).stage)
  })
  it('코드가 리드 id 를 고치는 곳이 없다(트리거가 NEW.id 하나로 구간을 판정한다)', () => {
    const bad: string[] = []
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!p.includes('tests')) walk(p) } else if (/\.(ts|tsx|mjs)$/.test(f)) { const t = readFileSync(p, 'utf8'); if (/UPDATE\s+ad_influencer_leads\s+SET\s+(?:[^`]*?,\s*)?id\s*=/i.test(t)) bad.push(p) } } }
    walk('src')
    expect(bad).toEqual([])
  })
  it('트리거를 새로 깔면 처음부터 다시 채운다(그동안의 쓰기가 숫자표에 없다)', async () => {
    const { db, DB } = freshDb()
    randomOps(db, 31, 60)
    await install(DB, db)
    for (const n of C.TRIGGER_NAMES) db.exec(`DROP TRIGGER ${n}`)
    randomOps(db, 32, 60)                  // 트리거가 없던 동안의 쓰기
    const DB2 = d1(db) // 새 isolate
    expect(await C.ensureStatsCounters(DB2)).toBe(true)
    expect(snapOf(db).complete).toBe(false)
    await fill(DB2, db)
    expect(counters(db)).toEqual(await recount(DB2, db))
  })
})

describe('④ 구조', () => {
  it('`7일 안 컨택` 쿼리가 부분 인덱스만 읽는다', async () => {
    const { db, DB } = freshDb()
    await install(DB, db)
    const plan = (db.prepare(`EXPLAIN QUERY PLAN ${C.CONTACT_TODO_SQL}`).all() as Array<{ detail: string }>).map(x => x.detail).join(' | ')
    expect(plan).toMatch(/idx_ad_inf_leads_contact_todo/)
  })
  it('트리거가 읽는 칸이 전부 감시 목록에 있다(빠지면 그 칸이 바뀔 때 숫자가 안 움직인다)', () => {
    const upd = C.counterDdl()[2]
    const used = new Set([...upd.matchAll(/\b(?:NEW|OLD)\.([a-z_]+)/g)].map(m => m[1]))
    // id 는 감시 대상이 아니다 — 채우기 구간 판정에만 쓰고, 코드가 id 를 고치는 곳은 없다(아래 시험).
    expect([...used].filter(c => c !== 'id' && !(C.WATCHED_COLUMNS as readonly string[]).includes(c))).toEqual([])
    for (const c of C.WATCHED_COLUMNS) expect(LIVE_COLS).toContain(c)
  })
  it('D1 한도 안이다 — 문장 길이 100KB · 묶음(UNION) 5줄 · 함수 인자 127개 (라이브 실측 · node 는 더 관대해 여기서만 잡힌다)', () => {
    const all = [...C.counterDdl(), ...C.rebuildStatements().map(x => x.sql), ...C.bootStepStatements(0, 10, 1).map(x => x.sql), C.DRIFT_SQL, C.CONTACT_TODO_SQL, C.CONTACT_TODO_INDEX]
    for (const s of all) {
      expect(s.length).toBeLessThan(90_000)
      expect((s.match(/\bUNION\b/gi) || []).length + 1, s.slice(0, 80)).toBeLessThanOrEqual(C.D1_MAX_COMPOUND_TERMS)
    }
    // 한 함수 호출의 인자 수: 트리거의 json_array 짝 수 · 조각 세기의 json_object(키·값 두 개씩)
    expect(C.UPDATE_TRIGGER_ARGS).toBeLessThanOrEqual(C.D1_MAX_FUNCTION_ARGS - 20) // 여유 20 — 숫자를 더 넣으면 여기서 먼저 빨강
    expect(C.STATE_COUNTERS.length * 2).toBeLessThanOrEqual(C.D1_MAX_FUNCTION_ARGS - 20)
  })
  it('리드 표에 REPLACE 쓰기가 없다(지우는 쪽 트리거를 안 태운다)', () => {
    const bad: string[] = []
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!p.includes('tests')) walk(p) } else if (/\.(ts|tsx|mjs)$/.test(f)) { const s = readFileSync(p, 'utf8'); if (/(INSERT\s+OR\s+REPLACE|REPLACE)\s+INTO\s+ad_influencer_leads\b/i.test(s)) bad.push(p) } } }
    walk('src')
    expect(bad).toEqual([])
  })
  it('숫자표는 리드 DB 로 간다(트리거와 같은 DB)', async () => {
    const { ADS_LEADS_TABLES, touchesAdsLeadsTable } = await import('@/shared/ads/leads-db')
    expect(ADS_LEADS_TABLES as readonly string[]).toContain(C.COUNTER_TABLE)
    expect(touchesAdsLeadsTable(`SELECT k, n FROM ${C.COUNTER_TABLE}`)).toBe(true)
  })
  it('통계 빌더가 숫자표를 먼저 쓰고, 준비 전이면 옛 경로로 간다', () => {
    expect(POOL_SRC).toMatch(/const fast = await buildFromCounters\(DB, opts\.bg\)/)
    expect(POOL_SRC).toMatch(/if \(!snap\.complete\) return null/)
    expect(POOL_SRC).toMatch(/stats_source: fast \? 'counter' : 'scan'/)
  })
})
