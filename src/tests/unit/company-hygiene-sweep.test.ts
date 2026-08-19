import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// node:sqlite 는 vite 가 번들 못 하므로 계산된 specifier + @vite-ignore 로 런타임 동적 로드.
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
  DatabaseSync: new (p: string) => {
    prepare: (sql: string) => {
      run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }
      get: (...a: never[]) => unknown
      all: (...a: never[]) => unknown[]
    }
    exec: (sql: string) => void
  }
}
import {
  sweepCompanyHygiene, HYGIENE_SUSPECT_SQL, PHONE_SHAPE_SUSPECT_SQL, HYGIENE_SWEEP_VERSION,
} from '@/features/marketing/api/company-hygiene-sweep'

/**
 * 🧹 **위생 백로그 스윕** — 실제 SQLite 로 검증한다.
 *
 * 술어가 `LIKE` 로 짜여 있어 **JS 로 흉내 내면 검증이 아니라 재구현**이 된다(같은 오해를 두 번 쓰는 셈).
 * SQLite 를 그대로 쓰면 라이브에서 도는 것과 같은 엔진이 판정한다.
 *
 * ## 이 테스트가 못 막는 것
 * - D1 과 SQLite 의 `LIKE` 차이(대소문자·`ESCAPE`) — 전화/엔티티 술어는 숫자·기호뿐이라 해당 없음.
 * - 레인이 **실제로 불리는지**(cron/알람 배선) — 배선 앵커로 파일 내용만 확인한다.
 */
function makeD1(db: InstanceType<typeof DatabaseSync>): D1Database {
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  return {
    prepare: (sql: string) => wrap(sql),
    batch: async (sts: Array<{ run: () => Promise<unknown> }>) => { for (const s of sts) await s.run(); return [] },
  } as unknown as D1Database
}

function freshDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE ad_company_leads (
    id INTEGER PRIMARY KEY, company_name TEXT, phone TEXT, email TEXT, website TEXT,
    category TEXT, contact_source TEXT, active INTEGER DEFAULT 1, merged_into INTEGER)`)
  db.exec('CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT)')
  return db
}

const digits = (s: string | null) => String(s || '').replace(/\D/g, '')

// 🔀 2026-08-19: 유어애즈 리드 DB 분리로 핸들이 `env.DB` → `adsLeadsDb(env)` 가 됐다.
//   여기서 보려는 것은 **'요청 스코프 DB 핸들을 넘기는가'** 이지 그 표현식의 철자가 아니다 —
//   철자로 고정하면 리팩토링이 배선 가드를 조용히 무력화한다(dashboard-session 에서 겪은 그 함정).
describe('☎️ 국번 술어 — 정상 번호는 건드리지 않고 결함만 잡는다', () => {
  const db = freshDb()
  /** 라이브에서 실제로 본 정상/결함 모양. 정상이 잡히면 멀쩡한 행을 매 회차 헛돌린다. */
  const OK = ['010-4233-5119', '02-555-1234', '02-1234-5678', '031-123-4567', '070-8888-1234',
    '1544-1234', '1600-0000', '1877-9737', '0505-123-4567', '051-123-4567', '064-733-1234']
  const BAD = ['0104-233-5119', '0316-123-456', '0708-888-1234', '01042335119',
    '0418-540-2114', '0512-345-678', '021-234-5678', '0505-1234567'.replace('-', ''), '154-41234']

  for (const [i, p] of [...OK, ...BAD].entries()) {
    db.prepare('INSERT INTO ad_company_leads (id, phone) VALUES (?, ?)').run(i + 1 as never, p as never)
  }
  const hit = new Set(
    (db.prepare(`SELECT phone FROM ad_company_leads WHERE phone IS NOT NULL AND phone != '' AND ${PHONE_SHAPE_SUSPECT_SQL}`)
      .all() as Array<{ phone: string }>).map(r => r.phone),
  )

  it('정상 모양은 하나도 안 잡힌다 (헛돌기 방지)', () => {
    expect(OK.filter(p => hit.has(p))).toEqual([])
  })

  it('결함 모양은 전부 잡힌다', () => {
    expect(BAD.filter(p => !hit.has(p))).toEqual([])
  })
})

describe('🧹 스윕 — 백로그를 한 바퀴 돌고 끝낸다', () => {
  it('결함을 고치고, 자릿수는 보존하고, 정상 행은 안 건드린다', async () => {
    const db = freshDb()
    const DB = makeD1(db)
    db.prepare('INSERT INTO ad_company_leads (id, company_name, phone) VALUES (?, ?, ?)').run(1 as never, '가나다' as never, '0104-233-5119' as never)
    db.prepare('INSERT INTO ad_company_leads (id, company_name, phone) VALUES (?, ?, ?)').run(2 as never, 'SM C&amp;C 성수' as never, '02-555-1234' as never)
    db.prepare('INSERT INTO ad_company_leads (id, company_name, phone) VALUES (?, ?, ?)').run(3 as never, '멀쩡' as never, '031-123-4567' as never)

    const r = await sweepCompanyHygiene(DB, 1_000_000)
    expect(r.done).toBe(true)
    expect(r.fixed).toBe(2)

    const rows = db.prepare('SELECT id, company_name, phone FROM ad_company_leads ORDER BY id').all() as Array<{ id: number; company_name: string; phone: string }>
    expect(rows[0].phone).toBe('010-4233-5119')
    expect(digits(rows[0].phone)).toBe(digits('0104-233-5119'))   // 숫자는 안 바꾼다
    expect(rows[1].company_name).toBe('SM C&C 성수')
    expect(rows[1].phone).toBe('02-555-1234')                      // 멀쩡한 값은 그대로
    expect(rows[2]).toEqual({ id: 3, company_name: '멀쩡', phone: '031-123-4567' })
  })

  it('완주하면 다음 회차는 아무 일도 안 한다(skipped)', async () => {
    const db = freshDb()
    const DB = makeD1(db)
    db.prepare('INSERT INTO ad_company_leads (id, phone) VALUES (1, ?)').run('0104-233-5119' as never)
    await sweepCompanyHygiene(DB, 1_000_000)
    const again = await sweepCompanyHygiene(DB, 1_000_000)
    expect(again.skipped).toBe(true)
    expect(again.scanned).toBe(0)
  })

  it('🔴 매칭 0 인 창을 완료로 읽지 않는다 — 결함이 뒤쪽에 몰려도 끝까지 간다', async () => {
    const db = freshDb()
    const DB = makeD1(db)
    // 앞 창(1~10)은 전부 정상, 결함은 뒤 창(10,001)에만 있다.
    db.prepare('INSERT INTO ad_company_leads (id, phone) VALUES (1, ?)').run('02-555-1234' as never)
    db.prepare('INSERT INTO ad_company_leads (id, phone) VALUES (10001, ?)').run('0104-233-5119' as never)

    const first = await sweepCompanyHygiene(DB, 1_000)
    expect(first.scanned).toBe(0)
    expect(first.done).toBe(false)          // 매칭이 없다고 끝내면 뒤쪽 결함이 영영 남는다

    let guard = 0
    let last = first
    while (!last.done && guard++ < 50) last = await sweepCompanyHygiene(DB, 1_000)
    expect(last.done).toBe(true)
    const row = db.prepare('SELECT phone FROM ad_company_leads WHERE id = 10001').get() as { phone: string }
    expect(row.phone).toBe('010-4233-5119')
  })

  it('세대(v)가 다르면 처음부터 다시 판다', async () => {
    const db = freshDb()
    const DB = makeD1(db)
    db.prepare('INSERT INTO ad_company_leads (id, phone) VALUES (1, ?)').run('0104-233-5119' as never)
    db.prepare('INSERT INTO platform_settings (key, value) VALUES (?, ?)')
      .run('ads_company_hygiene_sweep' as never, JSON.stringify({ v: HYGIENE_SWEEP_VERSION - 1, cursor: 999999, done: true }) as never)

    const r = await sweepCompanyHygiene(DB, 1_000_000)
    expect(r.skipped).toBeUndefined()
    expect(r.fixed).toBe(1)
  })
})

describe('🔌 배선 — 랩보다 먼저 돌고, 죽어도 재분류를 막지 않는다', () => {
  const lane = readFileSync('src/features/marketing/api/reclassify-lane.ts', 'utf8')

  it('reclassify 레인이 스윕을 부른다', () => {
    expect(lane).toMatch(/sweepCompanyHygiene\((?:adsLeadsDb\((?:c\.)?env\)|(?:c\.)?env\.DB)\)/)
  })

  it('fail-soft — 스윕 실패가 재분류를 못 막는다', () => {
    expect(lane).toMatch(/sweepCompanyHygiene\((?:adsLeadsDb\((?:c\.)?env\)|(?:c\.)?env\.DB)\)\.catch\(/)
  })

  it('패스 루프보다 앞에서 부른다(랩을 기다리지 않는 것이 요점)', () => {
    expect(lane.search(/sweepCompanyHygiene\((?:adsLeadsDb\((?:c\.)?env\)|(?:c\.)?env\.DB)\)/)).toBeLessThan(lane.indexOf('for (; passes <'))
  })

  it('진척이 하트비트에 남는다 — 안 보이면 판정을 못 한다', () => {
    expect(lane).toMatch(/hyg:/)
  })
})

describe('🧭 술어는 판정자가 아니라 좁히개다', () => {
  it('결함 후보 술어에 이름 엔티티와 전화 모양이 둘 다 들어 있다', () => {
    expect(HYGIENE_SUSPECT_SQL).toContain("company_name LIKE '%&%;%'")
    expect(HYGIENE_SUSPECT_SQL).toContain(PHONE_SHAPE_SUSPECT_SQL)
  })

  it('최종 판정은 hygieneStatements 하나뿐 — 스윕이 자체 UPDATE 를 만들지 않는다', () => {
    const src = readFileSync('src/features/marketing/api/company-hygiene-sweep.ts', 'utf8')
    // 스윕이 스스로 UPDATE 를 짜면 규칙이 두 벌이 되어 랩과 갈린다.
    expect(src).not.toMatch(/UPDATE ad_company_leads SET (?!.*platform_settings)/)
    expect(src).toMatch(/hygieneStatements\(r, sql => DB\.prepare\(sql\)\)/)
  })
})
