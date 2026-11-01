/**
 * 📥 **"받은 건 다시 안 준다"** — 계약 (2026-10-25 대표 지시 후 신설).
 *
 * ## 대표 질문
 * *"엑셀파일로 다운로드 받으면 받았다고 필터링이 될 수 있나? 이후에 수집한 DB인지 구별이 안가잖아."*
 *
 * ## 무엇이 있었나 (라이브 실측)
 * ```
 *                전체      연락 가능          한 파일      받을 방법이 없던 분량
 *   인플루언서  445,026   이메일 83,677       60,000      23,677 (28%)
 *   업체        491,162   이메일 63,504        2,000      61,504 (97%)
 *   매장후보    360,999   전화  256,997        2,000     254,997 (99%)
 * ```
 * 다운로드가 아무 표시를 안 남겼고, 수동 표시(`contacted_at`)는 **130만 행 중 5번** 눌렸다.
 * 정렬이 점수순 고정이라 **다시 받으면 같은 상위 N행**이 나왔다.
 *
 * ## 🩸 수집일로는 못 푼다 — 이 설계의 핵심 근거
 * 이메일 보유 인플루언서 85,214명의 수집↔측정 간격: `same_day 45,263 · d1_7 871 ·`
 * **`d7_plus 38,897(46%)`** `· unmeasured 191`. 절반이 수집 **한참 뒤**에 측정돼 그때
 * 이메일이 나왔다 ⇒ `collected_at > 지난 다운로드` 로 거르면 새로 쓸 수 있게 된 리드의
 * 절반을 영영 못 본다. 기준은 **행마다 "내가 받았는가"** 여야 한다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 실제 CSV/xls 바이트(D1·워커 없이 라우트를 못 돌린다) — **배선**과 **순수 로직**만 본다.
 * - 전송이 끊겼을 때 도장이 남는 것(설계상 그렇고, 복구는 배치 취소다).
 * - 대표가 파일을 실제로 쓰기 편한지.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readCode, readRaw } from '../helpers/source-text'
import {
  EXPORT_BATCH_ROWS, EXPORT_POOLS, NOT_EXPORTED_SQL, cancelExportBatch, exportBatchNote,
  exportBatchStamp, exportPoolOf, listExportBatches, runBatchExport, stampExported,
} from '@/features/marketing/api/pool-export-batch'

/**
 * 판정은 **주석을 뺀 실행되는 줄**로 — 이 파일의 설명이 단언에 걸리지 않게.
 * 🩸 첫 판은 `/\*…\*\/` 정규식을 **직접 썼다가** `worker/index.ts` 를 통째로 먹었다
 *   (라우트 패턴 `'/*'` 가 블록주석 시작으로 읽힌다). `source-text.ts` 가 그 함정을 네 번 밟고
 *   만든 SSOT 이고, **그 파일엔 `readRaw` + 줄 앵커를 쓰라고** 스스로 적어 뒀다.
 */
const code = readCode

// `node:sqlite` 를 그냥 import 하면 vite 가 번들하려다 **시험이 아예 안 돈다**(선례: legacy-seller-lookup).
const req = createRequire(import.meta.url)
type Sqlite = { exec(s: string): void; prepare(s: string): { all(...a: unknown[]): unknown[]; run(...a: unknown[]): { changes: number } } }
function db(): Sqlite {
  const { DatabaseSync } = req('node:sqlite') as { DatabaseSync: new (p: string) => Sqlite }
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE ad_influencer_leads (id INTEGER PRIMARY KEY, email TEXT, exported_at TEXT)`)
  // `runDdlOnce` 의 "1회만" 게이트가 읽고 쓰는 표(라이브에선 main DB 에 있다).
  d.exec(`CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value TEXT)`)
  return d
}
/** 진짜 함수를 돌리기 위한 최소 D1 흉내 — `prepare().bind().run()/.all()/.first()`. */
function d1(d: Sqlite) {
  return {
    prepare(sql: string) {
      // ⚠️ **async 여야 한다** — `runDdlOnce` 가 `.run().catch(…)` 를 건다(첫 판이 여기서 터졌다).
      //    DDL(`ALTER TABLE … ADD COLUMN exported_at`)은 픽스처에 이미 그 컬럼이 있어 던지고,
      //    그 예외는 `runDdlOnce` 의 `.catch(() => null)` 이 삼킨다 — 라이브와 같은 동작이다.
      const mk = (binds: unknown[]) => ({
        run: async () => { const r = d.prepare(sql).run(...binds); return { meta: { changes: r.changes } } },
        all: async <T>() => ({ results: d.prepare(sql).all(...binds) as T[] }),
        first: async <T>() => (d.prepare(sql).all(...binds)[0] ?? null) as T | null,
      })
      return { bind: (...b: unknown[]) => mk(b), ...mk([]) }
    },
  } as never
}

describe('📥 내보낸 리드 도장 — 순수 로직', () => {
  it('① 도장 값은 D1 타임스탬프 규약(UTC-naive)과 같은 모양이다', () => {
    const s = exportBatchStamp(new Date('2026-10-25T12:34:56.789Z'))
    expect(s).toBe('2026-10-25 12:34:56')
    // `Z`/`T` 가 들어가면 `datetime('now')` 로 찍힌 다른 컬럼과 비교·정렬이 어긋난다.
    expect(s).not.toMatch(/[TZ]/)
  })

  it('②-1 화이트리스트 밖 풀 이름은 통과하지 않는다 (표 이름이 SQL 에 문자열로 들어간다)', () => {
    expect(exportPoolOf('influencer')).toBe('influencer')
    expect(exportPoolOf('company')).toBe('company')
    expect(exportPoolOf('store')).toBe('store')
    for (const bad of ['users', 'ad_influencer_leads', '', undefined, 'constructor', '__proto__']) {
      expect(exportPoolOf(bad as string | undefined), `${String(bad)} 가 통과했다`).toBeNull()
    }
  })

  it('②-2 표 이름은 세 개뿐이고 전부 리드 표다 (라우터가 엉뚱한 DB 로 보내지 않게)', () => {
    expect(Object.values(EXPORT_POOLS).map(p => p.table).sort())
      .toEqual(['ad_company_leads', 'ad_influencer_leads', 'store_prospects'])
  })

  it('③ 묶음 크기는 500 — 대표 확정값', () => expect(EXPORT_BATCH_ROWS).toBe(500))
})

describe('📥 도장 — 실제 SQLite 로 동작 판정', () => {
  it('④ 모은 행에 도장이 찍히고, **이미 찍힌 행은 덮어쓰지 않는다**', async () => {
    const raw = db(); const D = d1(raw) as never
    raw.prepare('INSERT INTO ad_influencer_leads (id, email) VALUES (?, ?)').run(1, 'a@x.com')
    raw.prepare('INSERT INTO ad_influencer_leads (id, email) VALUES (?, ?)').run(2, 'b@x.com')
    raw.prepare('INSERT INTO ad_influencer_leads (id, email) VALUES (?, ?)').run(3, 'c@x.com')

    const first = await stampExported(D, 'influencer', [1, 2], '2026-10-25 10:00:00')
    expect(first).toBe(2)
    // 1·2 는 이미 찍혔으니 두 번째 묶음은 3만 가져간다 — 첫 배치의 소유권이 유지된다.
    const second = await stampExported(D, 'influencer', [1, 2, 3], '2026-10-25 11:00:00')
    expect(second).toBe(1)
    const rows = raw.prepare('SELECT id, exported_at FROM ad_influencer_leads ORDER BY id').all() as { id: number; exported_at: string }[]
    expect(rows.map(r => r.exported_at)).toEqual(['2026-10-25 10:00:00', '2026-10-25 10:00:00', '2026-10-25 11:00:00'])
  })

  it('⑤ 배치 목록 = 도장 시각별 묶음 (별도 표 없이 GROUP BY 가 이력이다)', async () => {
    const raw = db(); const D = d1(raw) as never
    for (const [id, st] of [[1, 'A'], [2, 'A'], [3, 'B'], [4, null]] as [number, string | null][]) {
      raw.prepare('INSERT INTO ad_influencer_leads (id, exported_at) VALUES (?, ?)').run(id, st)
    }
    const b = await listExportBatches(D, 'influencer')
    expect(b).toEqual([{ stamp: 'B', rows: 1 }, { stamp: 'A', rows: 2 }]) // 최근 순
  })

  it('⑥ 취소는 **그 묶음만** 되돌린다 (다운로드가 끊겼을 때의 유일한 복구 경로)', async () => {
    const raw = db(); const D = d1(raw) as never
    for (const [id, st] of [[1, '2026-10-25 10:00:00'], [2, '2026-10-25 10:00:00'], [3, '2026-10-25 11:00:00']] as [number, string][]) {
      raw.prepare('INSERT INTO ad_influencer_leads (id, exported_at) VALUES (?, ?)').run(id, st)
    }
    expect(await cancelExportBatch(D, 'influencer', '2026-10-25 10:00:00')).toBe(2)
    const left = raw.prepare('SELECT COUNT(*) AS n FROM ad_influencer_leads WHERE exported_at IS NOT NULL').all() as { n: number }[]
    expect(left[0].n).toBe(1) // 11:00 묶음은 그대로
  })

  /**
   * ⑦ 🩸 **첫 판은 "지키는 척"만 했다** — 되돌려-검증에서 살아남았다.
   *   `['', 'x', "' OR 1=1 --", …]` 는 **어느 행의 도장과도 안 맞아** 형식 검사를 없애도
   *   반환값이 똑같이 0 이었다. 반환값으로는 이 검사의 효과를 **관측할 수 없다.**
   *
   *   실제로 달라지는 것은 **DB 를 건드리는가**다: 검사가 있으면 445,026행 표에 UPDATE 를
   *   아예 안 보내고(쓰기 0), 없으면 쓸모없는 전수 스캔 UPDATE 가 나간다.
   *   ⇒ 판정을 `prepare` 호출 수로 옮긴다.
   */
  it('⑦ 도장 형식이 아닌 값은 **DB 를 건드리지 않는다** (쓸모없는 전수 UPDATE 차단)', async () => {
    const raw = db()
    const calls: string[] = []
    const inner = d1(raw) as unknown as { prepare(sql: string): unknown }
    const D = { prepare: (sql: string) => { calls.push(sql); return inner.prepare(sql) } } as never
    raw.prepare('INSERT INTO ad_influencer_leads (id, exported_at) VALUES (?, ?)').run(1, '2026-10-25 10:00:00')
    for (const bad of ['', 'x', "' OR 1=1 --", '2026-10-25', '2026-10-25T10:00:00Z', '  ']) {
      expect(await cancelExportBatch(D, 'influencer', bad), `${bad} 가 통과했다`).toBe(0)
    }
    expect(calls, `형식이 틀린 도장 ${calls.length}건이 DB 까지 갔다`).toEqual([])
    // 그리고 제대로 된 도장은 당연히 통한다 — 검사가 전부를 막아 버리면 되돌리기 자체가 죽는다.
    expect(await cancelExportBatch(D, 'influencer', '2026-10-25 10:00:00')).toBe(1)
    expect(calls.length, '정상 도장이 DB 에 도달하지 않았다').toBeGreaterThan(0)
  })
})

describe('📥 묶음 오케스트레이션 — runBatchExport', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }))

  it('⑧ newOnly 면 상한이 묶음(500)이고 도장·안내가 함께 나간다', async () => {
    const raw = db(); const D = d1(raw) as never
    for (const r of rows(3)) raw.prepare('INSERT INTO ad_influencer_leads (id) VALUES (?)').run(r.id)
    let askedLimit = -1, askedNotExported: boolean | null = null
    const out = await runBatchExport({
      DB: D, pool: 'influencer', newOnly: true, fullCap: 2000,
      list: async (limit, notExported) => { askedLimit = limit; askedNotExported = notExported; return rows(3) },
      count: async () => 77,
    })
    expect(askedLimit).toBe(EXPORT_BATCH_ROWS)
    expect(askedNotExported).toBe(true)
    expect(out.cap).toBe(EXPORT_BATCH_ROWS)
    expect(out.notes).toHaveLength(1)
    expect(out.notes[0]).toContain('3건')   // 도장 찍힌 수
    expect(out.notes[0]).toContain('77건')  // 남은 미다운로드
    const stamped = raw.prepare('SELECT COUNT(*) AS n FROM ad_influencer_leads WHERE exported_at IS NOT NULL').all() as { n: number }[]
    expect(stamped[0].n).toBe(3)
  })

  it('⑨ newOnly=false(전체 덤프)는 **도장을 찍지 않는다** — 사본 한 번이 전 리드를 소진시키면 안 된다', async () => {
    const raw = db(); const D = d1(raw) as never
    for (const r of rows(3)) raw.prepare('INSERT INTO ad_influencer_leads (id) VALUES (?)').run(r.id)
    const out = await runBatchExport({
      DB: D, pool: 'influencer', newOnly: false, fullCap: 2000,
      list: async (limit, notExported) => { expect(limit).toBe(2000); expect(notExported).toBe(false); return rows(3) },
      count: async () => { throw new Error('전체 덤프는 남은 건수를 세지 않는다') },
    })
    expect(out.cap).toBe(2000)
    expect(out.notes).toEqual([])
    const stamped = raw.prepare('SELECT COUNT(*) AS n FROM ad_influencer_leads WHERE exported_at IS NOT NULL').all() as { n: number }[]
    expect(stamped[0].n).toBe(0)
  })

  it('⑩ 행이 0건이면 도장도 안내도 없다 (빈 파일이 묶음을 소진하지 않게)', async () => {
    const raw = db(); const D = d1(raw) as never
    const out = await runBatchExport({
      DB: D, pool: 'influencer', newOnly: true, fullCap: 2000,
      list: async () => [], count: async () => { throw new Error('0건이면 세지 않는다') },
    })
    expect(out.notes).toEqual([])
  })

  it('⑪ 남은 건수는 **도장 뒤에** 센다 — 파일에 적는 값이 곧 다음 회차 분량', async () => {
    const raw = db(); const D = d1(raw) as never
    for (let i = 1; i <= 5; i++) raw.prepare('INSERT INTO ad_influencer_leads (id) VALUES (?)').run(i)
    const seen: number[] = []
    await runBatchExport({
      DB: D, pool: 'influencer', newOnly: true, fullCap: 2000,
      list: async () => [{ id: 1 }, { id: 2 }],
      count: async () => {
        const r = raw.prepare('SELECT COUNT(*) AS n FROM ad_influencer_leads WHERE exported_at IS NULL').all() as { n: number }[]
        seen.push(r[0].n); return r[0].n
      },
    })
    expect(seen).toEqual([3]) // 5 − 도장 2 = 3. 도장 전에 셌으면 5 가 나온다.
  })
})

describe('📥 배선 — 세 풀이 같은 기준을 쓴다', () => {
  const INF_EXPORT = code('src/features/marketing/api/influencer-pool-export.ts')
  const INF_ROUTE = code('src/features/marketing/api/admin-ads-influencers.routes.ts')
  const PARTNER = code('src/features/marketing/api/partner-pool.routes.ts')
  const STORE = code('src/features/marketing/api/store-prospects.routes.ts')
  const COMPANY_DB = code('src/features/marketing/api/company-discovery.ts')
  const STORE_DB = code('src/features/marketing/api/store-prospects.ts')

  it('⑫ 미다운로드 조건은 SSOT 한 벌 — 세 WHERE 빌더가 손으로 적지 않는다', () => {
    expect(NOT_EXPORTED_SQL).toBe('exported_at IS NULL')
    for (const [n, s] of [['인플루언서', INF_EXPORT], ['업체', COMPANY_DB], ['매장', STORE_DB]] as const) {
      expect(s, `${n} 가 SSOT 를 안 쓴다`).toContain('NOT_EXPORTED_SQL')
      // 손으로 적은 사본이 있으면 한쪽만 고쳐질 때 조용히 갈린다.
      expect(s.includes("'exported_at IS NULL'") || s.includes('"exported_at IS NULL"'),
        `${n} 에 조건 사본이 있다`).toBe(false)
    }
  })

  it('⑬ 두 CSV 라우트는 묶음 로직을 손으로 다시 짜지 않는다 (문구·순서가 갈리지 않게)', () => {
    for (const [n, s] of [['업체', PARTNER], ['매장', STORE]] as const) {
      expect(s, `${n} 가 runBatchExport 를 안 쓴다`).toContain('runBatchExport(')
      expect(s, `${n} 가 도장을 직접 찍는다`).not.toContain('stampExported(')
    }
  })

  it('⑭ 인플루언서: newOnly 면 상한이 묶음이고, 전체 덤프는 종전 6만을 유지한다', () => {
    expect(INF_EXPORT).toMatch(/CAP\s*=\s*opts\?\.newOnly\s*\?\s*EXPORT_BATCH_ROWS\s*:\s*60000/)
    // 도장은 **모은 행 전부**(`rows`)에 — 중복제거로 빠진 행도 같은 주소가 파일에 실려 나갔다.
    expect(INF_EXPORT).toMatch(/stampExported\(DB,\s*'influencer',\s*rows\.map/)
  })

  it('⑮ 인플루언서 라우트: 연락 대상은 기본 묶음, 전체 덤프는 기본 OFF', () => {
    expect(INF_ROUTE).toMatch(/newOnly:\s*c\.req\.query\('newOnly'\)\s*\?\s*c\.req\.query\('newOnly'\)\s*===\s*'1'\s*:\s*c\.req\.query\('contactable'\)\s*===\s*'1'/)
  })

  it('⑯ 🩸 업체 전체 덤프 상한이 **실제 클램프와 같다** — 안 같으면 절단 고지가 영원히 안 뜬다', () => {
    const cap = /const EXPORT_MAX = (\d+)/.exec(PARTNER)
    expect(cap, '업체 EXPORT_MAX 를 못 찾았다').not.toBeNull()
    const clamp = /const limit = Math\.min\((\d+),/.exec(COMPANY_DB.slice(COMPANY_DB.indexOf('listCompanyLeads')))
    expect(clamp, 'listCompanyLeads 의 클램프를 못 찾았다').not.toBeNull()
    // 2026-10-25 까지 5,000 ↔ 2,000 이라 `rows.length >= cap` 이 **한 번도 참이 안 됐다**(무음 캡).
    expect(cap![1]).toBe(clamp![1])
  })

  it('⑰ 안내 문구는 한 벌 — 세 곳에 따로 쓰면 "몇 명 남았나"가 풀마다 달라진다', () => {
    const note = exportBatchNote(500, '2026-10-25 10:00:00', 83177)
    expect(note).toContain('500건')
    expect(note).toContain('83177건')
    expect(note).toContain(String(EXPORT_BATCH_ROWS))
    expect(PARTNER + STORE, 'CSV 라우트가 안내를 손으로 쓴다').not.toContain('"내보냄" 표시를 했습니다')
  })

  it('⑱ 되돌리기 경로가 실재한다 — 없으면 끊긴 다운로드 한 번이 영구 손실이다', () => {
    const ROUTE = code('src/features/marketing/api/pool-export-batches.routes.ts')
    expect(ROUTE).toContain('cancelExportBatch(')
    expect(ROUTE).toContain("app.use('*', requireAdmin())") // 어드민 전용 — 전 행을 되돌릴 수 있는 문이다
    // ⚠️ `worker/index.ts` 는 `readCode` 금지(`source-text.ts` 의 경고) — 줄 앵커로 본다.
    expect(readRaw('src/worker/index.ts'))
      .toMatch(/^app\.route\('\/api\/admin\/pool-export-batches', poolExportBatchRoutes\)/m)
    // 화면이 없으면 라우트만 있고 아무도 못 되돌린다.
    const UI = code('src/pages/admin/PoolExportBatches.tsx')
    expect(UI).toContain('/api/admin/pool-export-batches/cancel')
    for (const [n, p] of [['인플루언서', 'src/pages/admin/AdminInfluencerPoolPage.tsx'],
      ['업체', 'src/pages/admin/AdminPartnerPoolPage.tsx'], ['매장', 'src/pages/admin/AdminStoreProspectsPage.tsx']] as const) {
      expect(code(p), `${n} 화면에 되돌리기 입구가 없다`).toMatch(/<PoolExport(Batches|Buttons)\b/)
    }
  })

  it('⑲ 세 풀 모두 `exported_at` 컬럼 보강을 거친다 (미보강 DB 에서 조용히 빈 파일이 되지 않게)', () => {
    expect(INF_EXPORT).toMatch(/ensureExportStamp\(DB,\s*'influencer'\)/)
    // 업체·매장은 `runBatchExport` → `stampExported` → `ensureExportStamp` 사슬을 탄다.
    const SSOT = code('src/features/marketing/api/pool-export-batch.ts')
    expect(SSOT).toMatch(/await ensureExportStamp\(args\.DB, args\.pool\)|await ensureExportStamp\(DB, pool\)/)
    expect(SSOT).toContain('ADD COLUMN exported_at TEXT')
  })
})
