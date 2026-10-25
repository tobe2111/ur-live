/**
 * 💸 매장 후보 upsert 를 **값이 달라질 때만** 쓴다 (2026-10-24).
 *
 * ## 무엇이 문제였나 (라이브 실측)
 *
 * `saveProspects` 의 `ON CONFLICT … DO UPDATE` 에 **조건이 없었다.** 공공 원부 레인들은 전국을
 * 영원히 순회하는 설계(수집이 끝나면 '갱신 순환')라, 값이 한 글자도 안 바뀌어도 매 회차 같은 행을
 * 다시 썼다. 게다가 `last_verified_at = datetime('now')` 는 **항상** 바뀌므로 건너뛸 수가 없었다.
 *
 * ```
 *   collect-neis  회차당 rw=40,004  (8,000행 × 행당 5쓰기)
 *   오늘 쓰기      328,794  =  유어애즈 그날 쓰기 938,996 의 35%
 *   그 결과        신규 리드 0건   (140,635행을 32번째 다시 쓰는 중 — 누적 저장 4,549,277)
 * ```
 *
 * 쓰기 예산은 대표 확정 *"$5 이상 넘으면 절대 안돼"* 에 묶여 월 포함분에서 역산된다. 즉 그 35% 는
 * 남는 용량을 쓴 게 아니라 **이메일 보강처럼 값을 만드는 레인의 몫을 빼앗은 것**이다.
 *
 * ## 이 시험이 지키는 것 — 그리고 왜 문자열 검사가 아닌가
 *
 * 지키려는 성질은 "SQL 에 WHERE 가 있다" 가 아니라 **"쓰기가 실제로 줄고, 그러면서 변화는 안 놓친다"**
 * 두 가지다. 그래서 **진짜 `saveProspects` 를 실제 SQLite 위에서 돌려** `meta.changes` 를 센다.
 *
 * 🔒 가장 위험한 회귀는 **WHERE 가 SET 을 덜 덮는 것**이다 — 그러면 그 컬럼의 변화가 조용히 반영되지
 * 않고 **에러도 안 난다.** ①이 SET 컬럼을 전수로 돌려 하나씩 바꿔 보며 그걸 막는다(목록을 손으로
 * 적지 않고 **SQL 에서 파싱**하므로, SET 에 컬럼이 늘면 이 시험이 저절로 그 컬럼도 검사한다).
 *
 * ## 이 시험이 못 보는 것
 *
 * · D1 의 실제 과금 행 수(인덱스 쓰기 포함 — 여기서 세는 것은 `changes` 뿐이다)
 * · 라이브에서 정말 35% 가 줄는지 (판정은 배포 후 `cron_hb:ads:read-budget` 의 `written`/`top`)
 * · `node:sqlite` 와 D1 의 SQL 방언 차이(둘 다 SQLite 지만 버전이 다르다)
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { saveProspects, PROSPECT_DDL, type StoreProspect } from '@/features/marketing/api/store-prospects'

// ⚠️ `node:sqlite` 를 정적 import 하면 vite 가 번들하려 들어 **시험이 아예 안 돈다**(선례:
//   legacy-seller-lookup-owner-seat). `createRequire` 로 우회한다.
const require_ = createRequire(import.meta.url)
const { DatabaseSync } = require_('node:sqlite') as { DatabaseSync: new (p: string) => SqliteDb }

interface SqliteDb {
  exec(sql: string): void
  prepare(sql: string): { run(...a: unknown[]): { changes: number }; all(...a: unknown[]): unknown[] }
}

const SRC = readFileSync('src/features/marketing/api/store-prospects.ts', 'utf-8')

/** `saveProspects` 안의 upsert SQL 을 소스에서 그대로 뽑는다(손으로 베끼면 두 벌이 갈린다). */
function upsertSql(): string {
  const i = SRC.indexOf('INSERT INTO store_prospects (opn_svc_id')
  expect(i, 'upsert SQL 을 못 찾았다 — 이름이 바뀌었으면 이 시험도 재조준할 것').toBeGreaterThan(0)
  const j = SRC.indexOf('`', i)
  expect(j).toBeGreaterThan(i)
  return SRC.slice(i, j)
}

/** SET 절이 대입하는 컬럼 이름들(= 변화를 놓치면 안 되는 대상). `last_verified_at` 은 늘 바뀌므로 제외. */
function setColumns(sql: string): string[] {
  const set = sql.slice(sql.indexOf('DO UPDATE SET'), sql.indexOf('WHERE store_prospects'))
  const cols = [...set.matchAll(/^\s*([a-z_]+)\s*=/gm)].map(m => m[1]!).filter(c => c !== 'last_verified_at')
  return [...new Set(cols)]
}

/** D1 흉내 — `prepare().bind().run()` 과 `batch()` 만 쓴다(그 둘이 `saveProspects` 가 쓰는 전부다). */
function makeD1(db: SqliteDb) {
  const mk = (sql: string) => {
    let binds: unknown[] = []
    const st = {
      bind: (...a: unknown[]) => { binds = a; return st },
      run: async () => { const r = db.prepare(sql).run(...binds); return { meta: { changes: r.changes } } },
      all: async () => ({ results: db.prepare(sql).all(...binds) }),
      first: async () => (db.prepare(sql).all(...binds)[0] ?? null),
    }
    return st
  }
  return {
    prepare: mk,
    batch: async (stmts: Array<{ run: () => Promise<{ meta: { changes: number } }> }>) =>
      Promise.all(stmts.map(s => s.run())),
    exec: async () => ({}),
  } as unknown as D1Database
}

function freshDb(): { db: SqliteDb; d1: D1Database } {
  const db = new DatabaseSync(':memory:')
  // platform_settings — `runDdlOnce` 가 체크섬을 거기 쓴다.
  db.exec('CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value TEXT)')
  // ⚠️ DDL 하나씩 try — `PROSPECT_DDL` 은 CREATE 에 이미 있는 컬럼의 `ALTER … ADD` 를 함께 들고 있다
  //   (라이브는 그 실패를 삼키는 관용구이고, `node:sqlite` 는 던진다). 라이브와 같은 모양으로 둔다.
  let applied = 0
  for (const sql of PROSPECT_DDL) { try { db.exec(sql); applied++ } catch { /* 이미 있으면 통과 */ } }
  expect(applied, 'DDL 이 하나도 안 먹었다(통과가 아니라 고장)').toBeGreaterThanOrEqual(3)
  return { db, d1: makeD1(db) }
}

const base = (over: Partial<StoreProspect> = {}): StoreProspect => ({
  opn_svc_id: 'neis_academy', opn_sf_team_code: 'B10', mgt_no: 'M1', biz_name: '테스트학원',
  category: '학원', uptae: '보습', addr_road: '서울 강남 1길', addr_lot: '역삼동 1', phone: '02-111-2222',
  website: null, local_code: 'L1', region: '강남', trd_state: '01', trd_state_nm: '영업중',
  apv_perm_ymd: '20200101', last_mod_ts: '20260101', lon: 127, lat: 37,
  ...over,
} as StoreProspect)

const TODAY = '20261024'

describe('조건부 upsert — 쓰기가 줄고 변화는 안 놓친다', () => {
  it('① SET 되는 모든 컬럼이 WHERE 에도 있다 — 하나라도 빠지면 그 변화가 조용히 사라진다', () => {
    const sql = upsertSql()
    const where = sql.slice(sql.indexOf('WHERE store_prospects'))
    expect(where.length, 'WHERE 절이 없다 — 조건 없는 DO UPDATE 로 되돌아갔다').toBeGreaterThan(100)
    const cols = setColumns(sql)
    // 🔍 측정 0 = 통과 아님. 파싱이 비면 아래 루프가 아무것도 안 보고 초록이 뜬다.
    expect(cols.length, 'SET 컬럼 파싱이 비었다(통과가 아니라 고장)').toBeGreaterThanOrEqual(10)
    for (const c of cols) {
      expect(where, `SET 에 ${c} 가 있는데 WHERE 가 그 변화를 안 본다`).toContain(`excluded.${c}`)
    }
  })

  it('②-1 신규는 쓰고, 값이 같은 재투입은 **쓰지 않는다**', async () => {
    const { d1 } = freshDb()
    expect(await saveProspects(d1, [base()], TODAY)).toBe(1)   // INSERT
    expect(await saveProspects(d1, [base()], TODAY)).toBe(0)   // 건너뜀 — 여기가 이 수리의 전부다
    expect(await saveProspects(d1, [base()], TODAY)).toBe(0)
  })

  it('②-2 SET 컬럼 하나하나가 실제로 UPDATE 를 트리거한다(전수)', async () => {
    // 각 컬럼을 바꿔 보고 `changes = 1` 이 나오는지 본다. 목록은 SQL 에서 파싱한 것이라
    // SET 에 컬럼이 늘면 이 검사도 저절로 늘어난다.
    const changes: Record<string, Partial<StoreProspect>> = {
      biz_name: { biz_name: '이름바뀜' },
      trd_state: { trd_state: '03', trd_state_nm: '폐업' },   // 영업 → 폐업(active 도 함께 바뀐다)
      last_mod_ts: { last_mod_ts: '20261024' },
      addr_road: { addr_road: '서울 강남 2길' },
      addr_lot: { addr_lot: '역삼동 2' },
      phone: { phone: '02-333-4444' },
      region: { region: '서초' },
      website: { website: 'http://x.example' },               // NULL → 값(보존형)
    }
    for (const [label, over] of Object.entries(changes)) {
      const { d1 } = freshDb()
      expect(await saveProspects(d1, [base()], TODAY)).toBe(1)
      expect(await saveProspects(d1, [base()], TODAY)).toBe(0)
      expect(await saveProspects(d1, [base(over)], TODAY), `${label} 변화를 놓쳤다`).toBe(1)
    }
  })

  it('②-3 값이 바뀌면 **실제로 반영**된다 — 건너뛰기가 갱신을 먹지 않는다', async () => {
    const { db, d1 } = freshDb()
    await saveProspects(d1, [base()], TODAY)
    await saveProspects(d1, [base({ biz_name: '새이름', trd_state: '03', trd_state_nm: '폐업' })], TODAY)
    const row = db.prepare('SELECT biz_name, trd_state, active FROM store_prospects').all()[0] as Record<string, unknown>
    expect(row.biz_name).toBe('새이름')
    expect(row.trd_state).toBe('03')
    expect(row.active).toBe(0)        // 폐업 → active 0
  })

  it('②-4 하루가 지나면 값이 같아도 재검증 도장을 한 번 찍는다(is_new_open 이 날짜 기준이라 필요)', async () => {
    const { db, d1 } = freshDb()
    await saveProspects(d1, [base()], TODAY)
    expect(await saveProspects(d1, [base()], TODAY)).toBe(0)
    db.exec("UPDATE store_prospects SET last_verified_at = datetime('now','-2 day')")
    expect(await saveProspects(d1, [base()], TODAY), '하루 넘은 행은 도장을 찍어야 한다').toBe(1)
    expect(await saveProspects(d1, [base()], TODAY), '찍은 뒤엔 다시 건너뛴다').toBe(0)
  })

  it('③ 반환값은 보낸 개수가 아니라 **실제 변경 행 수**다(total_saved 가 32배 부풀던 원인)', () => {
    const body = SRC.slice(SRC.indexOf('export async function saveProspects'))
    expect(body, 'slice.length 를 다시 세고 있다 — 신규 0건이 또 안 보이게 된다').not.toMatch(/saved \+= slice\.length/)
    expect(body).toMatch(/saved \+=[\s\S]{0,120}meta\?\.changes/)
  })

  it('⑤ 이메일 보강 1단계는 **홈페이지가 있는 행만** 크롤한다(없으면 34.7만 건을 헛크롤)', () => {
    // 📉 2026-10-24 실측: 매장 353,228건 중 홈페이지 보유가 6,784(1.9%)뿐이다. 그 조건이 빠지면
    //   크롤할 대상이 아예 없는 34.7만 건을 돌며 회차 예산을 통째로 태운다(수율 0).
    const s = readFileSync('src/features/marketing/api/prospect-enrich.ts', 'utf-8')
    const i = s.indexOf('const withSite = (await DB.prepare(')
    expect(i, '1단계 선정 쿼리를 못 찾았다 — 이름이 바뀌었으면 이 시험도 재조준할 것').toBeGreaterThan(0)
    const q = s.slice(i, i + 700)
    expect(q, '홈페이지 보유 조건이 사라졌다').toMatch(/website IS NOT NULL AND website != ''/)
    expect(q, '이미 이메일이 있는 행을 다시 크롤한다').toMatch(/email IS NULL OR email = ''/)
  })

  it('④ 레인 다섯이 모두 이 함수를 지난다(한 곳만 고쳐 두면 나머지가 계속 태운다)', () => {
    const callers = [
      'localdata-collect', 'neis-academy-collect', 'hira-hospital-collect', 'store-kakao-collect',
    ]
    for (const c of callers) {
      const s = readFileSync(`src/features/marketing/api/${c}.ts`, 'utf-8')
      expect(s, `${c} 가 saveProspects 를 안 쓴다 — 자기 INSERT 를 들고 있으면 이 수리 밖이다`).toContain('saveProspects(')
    }
  })
})
