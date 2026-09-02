/**
 * 📏 D1 읽기 계량기 — 2026-09-02 (9/1 계정 일일 읽기 한도 500만 행 초과 → 유어딜 API 전체 500).
 *
 * 이 테스트가 지키는 것:
 *   ① `all`/`run`/`batch` 의 `meta.rows_read` 가 계량기에 더해진다 · `first`/`raw`/`exec` 는 `qu` 로만 센다
 *   ② `batch` 는 D1 에 **원본 statement** 를 넘긴다(래퍼를 넘기면 D1 이 거부한다)
 *   ③ 동시에 도는 작업 두 개가 **각자** 계량된다(AsyncLocalStorage 귀속) — cron 인보케이션의 실제 모양
 *   ④ 작업이 던져도 그때까지 읽은 양이 남는다
 *   ⑤ 하트비트 페이로드에 `rr` 가 실리고, 긴 결과 요약이 그것을 밀어내지 못한다
 *   ⑥ 배선: scheduled.ts 의 safeCron 이 실제로 계량기 안에서 작업을 돌리고 하트비트에 넘긴다
 *   ⑦ 래퍼는 멱등(두 번 감싸지 않음)이고, leads-db 라우터를 그 위에 얹어도 batch 가 풀린다
 *
 * 못 막는 것: 실제 D1 의 rows_read 값 자체(런타임) — 그건 배포 후 하트비트로 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { meterD1, withMeteredEnv, readEnvMeter, newMeter, meterFields, isMeteredD1 } from '@/worker/utils/d1-read-meter'
import { installTaskMeteredEnv, runInMeter, currentMeter, initTaskMeter } from '@/worker/utils/d1-read-meter-als'
import { buildCronBeatRow } from '@/worker/utils/cron-heartbeat'
import { adsLeadsDb } from '@/shared/ads/leads-db'

/** rows_read 를 SQL 안의 `/*rr=N*​/` 힌트로 흉내 내는 가짜 D1. batch 는 받은 statement 가 원본인지 기록한다. */
function fakeD1(log: { batchGotRaw: boolean[] } = { batchGotRaw: [] }) {
  const RAWMARK = Symbol('raw')
  const meta = (sql: string) => {
    const m = /rr=(\d+)/.exec(sql)
    const w = /rw=(\d+)/.exec(sql)
    return { rows_read: m ? Number(m[1]) : 0, rows_written: w ? Number(w[1]) : 0 }
  }
  const stmtFor = (sql: string): Record<string | symbol, unknown> => ({
    [RAWMARK]: true,
    sql,
    bind: () => stmtFor(sql),
    all: async () => ({ results: [{ x: 1 }], success: true, meta: meta(sql) }),
    run: async () => ({ success: true, meta: meta(sql) }),
    first: async () => ({ x: 1 }),
    raw: async () => [[1]],
  })
  // 타입은 느슨하게 — 가짜 D1 이라 D1Database 전체 표면을 흉내 내지 않는다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    prepare: (sql: string) => stmtFor(sql),
    batch: async (stmts: Array<Record<string | symbol, unknown>>) => {
      log.batchGotRaw.push(stmts.every((s) => s[RAWMARK] === true))
      return stmts.map((s) => ({ success: true, meta: meta(String(s.sql)) }))
    },
    exec: async () => ({ count: 1, duration: 1 }),
    dump: async () => new ArrayBuffer(0),
  }
  return { db, log }
}

describe('d1-read-meter — 래퍼', () => {
  it('① all/run/batch 는 rows_read 를 더하고, first/raw/exec 는 qu 로만 센다', async () => {
    const { db } = fakeD1()
    const m = newMeter()
    const d = meterD1(db, () => m)
    await d.prepare('SELECT /*rr=120*/').all()
    await d.prepare('UPDATE /*rr=3 rw=2*/').bind(1).run()
    await d.batch([d.prepare('SELECT /*rr=10*/'), d.prepare('SELECT /*rr=5*/')])
    await d.prepare('SELECT COUNT(*) /*rr=99999*/').first()
    await d.prepare('SELECT /*rr=1*/').raw()
    await d.exec('PRAGMA x')
    expect(m).toEqual({ rr: 138, rw: 2, q: 4, qu: 3 })
  })

  it('② batch 는 D1 에 원본 statement 를 넘긴다', async () => {
    const { db, log } = fakeD1()
    const d = meterD1(db, () => newMeter())
    await d.batch([d.prepare('a').bind(1), d.prepare('b')])
    expect(log.batchGotRaw).toEqual([true])
  })

  it('⑦ 멱등 + 그 밖의 메서드(dump)는 원본에 위임 + sink 가 undefined 면 세지 않는다', async () => {
    const { db } = fakeD1()
    const d = meterD1(db, () => undefined)
    expect(isMeteredD1(d)).toBe(true)
    expect(meterD1(d, () => newMeter())).toBe(d)
    expect(await (d as unknown as { dump: () => Promise<ArrayBuffer> }).dump()).toBeInstanceOf(ArrayBuffer)
    await d.prepare('SELECT /*rr=7*/').all() // sink 없음 — 던지지 않아야 한다
  })

  it('⑦ leads-db 라우터를 계량 래퍼 위에 얹어도 batch 가 원본까지 풀린다', async () => {
    const main = fakeD1(); const ads = fakeD1()
    const m = newMeter()
    const env = withMeteredEnv({ DB: main.db, ADS_DB: ads.db }, m)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const router = adsLeadsDb(env as any) as any
    await router.batch([router.prepare('UPDATE ad_influencer_leads SET x=1 /*rr=4*/'), router.prepare('UPDATE ad_influencer_leads SET y=1 /*rr=6*/')])
    expect(ads.log.batchGotRaw).toEqual([true])
    expect(m.rr).toBe(10)
    expect(readEnvMeter(env)).toBe(m)
  })

  it('withMeteredEnv 는 원본 env 를 바꾸지 않고, D1 이 아닌 값은 그대로 둔다', () => {
    const { db } = fakeD1()
    const env = { DB: db, KV: { get: () => null }, ADS_DB: undefined }
    const wrapped = withMeteredEnv(env, newMeter())
    expect(isMeteredD1(env.DB)).toBe(false)
    expect(isMeteredD1(wrapped.DB)).toBe(true)
    expect(wrapped.KV).toBe(env.KV)
  })
})

describe('d1-read-meter — 작업별 귀속(AsyncLocalStorage)', () => {
  it('ALS 는 런타임 문자열 import 로 온다(정적 node: import 는 Pages 배포 번들러를 죽인다)', async () => {
    expect(await initTaskMeter()).toBe(true)
    const src = readFileSync('src/worker/utils/d1-read-meter-als.ts', 'utf8')
    expect(src).not.toMatch(/from 'node:async_hooks'/)
    expect(src).toMatch(/const spec = 'node:async_hooks'/)
    expect(readFileSync('src/worker/scheduled.ts', 'utf8')).toMatch(/await initTaskMeter\(\);\s*\/\/[^\n]*\n\s*env = installTaskMeteredEnv\(env\);/)
  })
  it('③ 동시에 도는 작업 두 개가 각자 계량된다', async () => {
    const { db } = fakeD1()
    const env = installTaskMeteredEnv({ DB: db })
    const a = newMeter(); const b = newMeter()
    const job = (rr: number, n: number) => async () => {
      for (let i = 0; i < n; i++) { await env.DB.prepare(`SELECT /*rr=${rr}*/`).all(); await new Promise((r) => setTimeout(r, 1)) }
      return currentMeter()
    }
    const [ma, mb] = await Promise.all([runInMeter(a, job(100, 3)), runInMeter(b, job(7, 5))])
    expect(ma).toBe(a); expect(mb).toBe(b)
    expect(a).toMatchObject({ rr: 300, q: 3 })
    expect(b).toMatchObject({ rr: 35, q: 5 })
    // 작업 밖의 쿼리는 아무 계량기에도 안 들어간다
    await env.DB.prepare('SELECT /*rr=1000*/').all()
    expect(a.rr + b.rr).toBe(335)
  })

  it('④ 작업이 던져도 그때까지 읽은 양이 남는다', async () => {
    const { db } = fakeD1()
    const env = installTaskMeteredEnv({ DB: db })
    const m = newMeter()
    await expect(runInMeter(m, async () => {
      await env.DB.prepare('SELECT /*rr=50*/').all()
      throw new Error('boom')
    })).rejects.toThrow('boom')
    expect(m.rr).toBe(50)
  })
})

describe('d1-read-meter — 하트비트 페이로드', () => {
  it('⑤ rr 가 실리고, 0 이어도 남으며, 긴 결과 요약이 밀어내지 못한다', () => {
    const zero = JSON.parse(buildCronBeatRow('x', true, 1, undefined, undefined, undefined, newMeter()).value)
    expect(zero.rr).toBe(0)
    expect('rw' in zero).toBe(false)
    const longNote = { error: 'e'.repeat(500), a: 1 }
    const v = buildCronBeatRow('x', true, 1, '0 * * * *', longNote, undefined, { rr: 123456, rw: 9, q: 4, qu: 2 }).value
    const parsed = JSON.parse(v.endsWith('}') ? v : v + '"}')
    expect(parsed.rr).toBe(123456); expect(parsed.rw).toBe(9); expect(parsed.q).toBe(4); expect(parsed.qu).toBe(2)
    // 계량기 없는 옛 호출은 모양이 그대로다
    expect('rr' in JSON.parse(buildCronBeatRow('x', true, 1).value)).toBe(false)
    expect(meterFields(undefined)).toEqual({})
  })
})

describe('d1-read-meter — 배선(scheduled.ts)', () => {
  const src = readFileSync('src/worker/scheduled.ts', 'utf8')
  it('⑥ env 의 D1 이 계량 래퍼로 바뀌고 safeCron 이 계량기 안에서 작업을 돌린다', () => {
    expect(src).toMatch(/env = installTaskMeteredEnv\(env\);/)
    const fn = src.slice(src.indexOf('const safeCron = async'), src.indexOf('const slotCron'))
    expect(fn).toMatch(/const meter = newMeter\(\)/)
    expect(fn).toMatch(/out = await runInMeter\(meter, task\)/)
    expect(fn).toMatch(/recordCronBeat\(env, name, ok, Date\.now\(\) - t0, cron, out, gapMin, meter\)/)
  })
  it('⑥ 계량 설치가 작업 등록보다 앞에 있다(뒤에 있으면 클로저가 원본 env 를 잡는다)', () => {
    expect(src.indexOf('env = installTaskMeteredEnv(env)')).toBeLessThan(src.indexOf('const safeCron = async'))
  })
})
