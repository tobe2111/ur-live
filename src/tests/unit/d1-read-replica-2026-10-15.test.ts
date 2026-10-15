/**
 * 🌏 D1 읽기 복제본 (2026-10-15) — 가드.
 *
 * 지키는 것:
 *   ① 캐시할 공개 읽기(publicCache · 익명 edgeCache)의 **캐시 미스**에서만 복제본으로 읽는다.
 *   ② 로그인 요청(edgeCache 우회)·쓰기 요청은 원본 그대로 — 방금 쓴 것을 바로 읽어야 하는 자리다.
 *   ③ 원본 DB 하나에 래퍼는 **늘 같은 객체** — 요청마다 새 래퍼면 `ensureXxx(DB)` 의 WeakSet 기억(167곳)이
 *      매번 빗나가 요청마다 DDL 이 원본(미국 동부)으로 간다. 빨라지려다 더 느려진다.
 *   ④ 세션에 없는 `exec` 은 원본에 위임 — 안 하면 그걸 쓰는 코드가 터진다.
 *   ⑤ 원본 env 를 고치지 않는다(같은 isolate 의 다른 요청과 나눠 쓰는 객체다).
 *   ⑥ 세션 API 가 없으면 아무것도 바꾸지 않는다(모의 객체·옛 런타임 — 종전과 같다).
 *
 * 이 가드가 못 보는 것: 복제본이 실제로 가까운 지역에서 응답하는지 · 복제 지연의 실제 크기 — 그건
 *   배포 뒤 실사용 TTFB(데이터센터별)와 D1 응답의 served_by_region 으로만 판정된다.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import { readFileSync } from 'node:fs'
import { readReplicaDb, withReadReplicaEnv, isReadReplicaDb } from '@/worker/utils/d1-read-replica'
import { publicCache, edgeCache } from '@/worker/middleware/edge-cache'

type Call = { via: 'base' | 'session'; op: string; sql?: string; constraint?: string }

function fakeDb() {
  const calls: Call[] = []
  let sessions = 0
  const stmt = (via: Call['via'], sql: string) => ({
    sql,
    bind() { return this },
    async first() { calls.push({ via, op: 'first', sql }); return null },
    async all() { calls.push({ via, op: 'all', sql }); return { results: [], success: true, meta: {} } },
    async run() { calls.push({ via, op: 'run', sql }); return { success: true, meta: {} } },
  })
  const db = {
    prepare: (sql: string) => stmt('base', sql),
    batch: async (s: unknown[]) => { calls.push({ via: 'base', op: 'batch' }); return s.map(() => ({ results: [] })) },
    exec: async (sql: string) => { calls.push({ via: 'base', op: 'exec', sql }); return { count: 1, duration: 0 } },
    dump: async () => new ArrayBuffer(0),
    withSession(constraint: string) {
      sessions++
      calls.push({ via: 'base', op: 'withSession', constraint })
      return {
        prepare: (sql: string) => stmt('session', sql),
        batch: async (s: unknown[]) => { calls.push({ via: 'session', op: 'batch' }); return s.map(() => ({ results: [] })) },
        getBookmark: () => null,
      }
    },
  }
  return { db: db as unknown as D1Database, calls, sessions: () => sessions }
}

describe('🌏 readReplicaDb — 래퍼', () => {
  it('읽기·batch 는 세션으로, 첫 쿼리가 가장 가까운 복제본으로 가는 세션이다', async () => {
    const f = fakeDb()
    const r = readReplicaDb(f.db)
    await r.prepare('SELECT 1').all()
    await r.batch([r.prepare('SELECT 2')])
    expect(f.calls.filter((c) => c.op === 'all').map((c) => c.via)).toEqual(['session'])
    expect(f.calls.find((c) => c.op === 'batch')?.via).toBe('session')
    expect(f.calls.find((c) => c.op === 'withSession')?.constraint).toBe('first-unconstrained')
  })

  it('③ 같은 원본이면 늘 같은 래퍼 객체이고 세션도 하나다(WeakSet 기억이 빗나가지 않게)', async () => {
    const f = fakeDb()
    const a = readReplicaDb(f.db)
    const b = readReplicaDb(f.db)
    expect(a).toBe(b)
    await a.prepare('SELECT 1').first()
    await b.prepare('SELECT 1').first()
    expect(f.sessions()).toBe(1)
    const memo = new WeakSet<object>()
    memo.add(a)
    expect(memo.has(readReplicaDb(f.db))).toBe(true)
  })

  it('래퍼를 다시 감싸지 않는다', () => {
    const f = fakeDb()
    const a = readReplicaDb(f.db)
    expect(readReplicaDb(a)).toBe(a)
    expect(isReadReplicaDb(a)).toBe(true)
    expect(isReadReplicaDb(f.db)).toBe(false)
  })

  it('④ exec 은 원본으로 위임한다(세션에는 exec 이 없다)', async () => {
    const f = fakeDb()
    await readReplicaDb(f.db).exec('CREATE TABLE IF NOT EXISTS t (x)')
    expect(f.calls.find((c) => c.op === 'exec')?.via).toBe('base')
  })

  it('⑥ 세션 API 가 없으면 원본을 그대로 돌려준다', () => {
    const plain = { prepare: () => null, batch: async () => [], exec: async () => null } as unknown as D1Database
    expect(readReplicaDb(plain)).toBe(plain)
    const env = { DB: plain }
    expect(withReadReplicaEnv(env)).toBe(env)
  })

  it('⑤ 원본 env 는 고치지 않고 새 env 를 돌려준다', () => {
    const f = fakeDb()
    const env = { DB: f.db, OTHER: 1 }
    const next = withReadReplicaEnv(env)
    expect(next).not.toBe(env)
    expect(env.DB).toBe(f.db)
    expect(isReadReplicaDb(next.DB)).toBe(true)
    expect(next.OTHER).toBe(1)
  })
})

describe('🌏 edge-cache 미들웨어 배선 — 어느 요청에서만 복제본인가', () => {
  const g = globalThis as unknown as { caches?: unknown }
  let prev: unknown
  beforeAll(() => {
    prev = g.caches
    g.caches = { default: { match: async () => undefined, put: async () => undefined } }
  })
  afterAll(() => { g.caches = prev })

  const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext
  function appWith(mw: ReturnType<typeof publicCache>) {
    const app = new Hono<{ Bindings: { DB: D1Database } }>()
    app.use('/x', mw)
    app.all('/x', (c) => c.json({ replica: isReadReplicaDb(c.env.DB) }))
    return app
  }
  const run = async (app: Hono<{ Bindings: { DB: D1Database } }>, init: RequestInit, env: { DB: D1Database }) =>
    (await (await app.request('https://urdeal.kr/x', init, env, ctx)).json()) as { replica: boolean }

  it('① publicCache 캐시 미스(익명·로그인 모두 — 응답이 누구에게나 같다) → 복제본', async () => {
    const f = fakeDb()
    expect((await run(appWith(publicCache(60)), {}, { DB: f.db })).replica).toBe(true)
    expect((await run(appWith(publicCache(60)), { headers: { Authorization: 'Bearer x' } }, { DB: f.db })).replica).toBe(true)
  })

  it('① edgeCache 익명 → 복제본', async () => {
    const f = fakeDb()
    expect((await run(appWith(edgeCache(60)), {}, { DB: f.db })).replica).toBe(true)
  })

  it('② edgeCache 로그인(캐시 우회) → 원본 — 주인이 방금 고친 것을 바로 봐야 한다', async () => {
    const f = fakeDb()
    expect((await run(appWith(edgeCache(60)), { headers: { Authorization: 'Bearer x' } }, { DB: f.db })).replica).toBe(false)
    expect((await run(appWith(edgeCache(60)), { headers: { Cookie: 'ur_session=abc' } }, { DB: f.db })).replica).toBe(false)
  })

  it('② 쓰기 요청 → 원본', async () => {
    const f = fakeDb()
    expect((await run(appWith(publicCache(60)), { method: 'POST' }, { DB: f.db })).replica).toBe(false)
  })

  it('배선은 캐시 미스 경로(next 직전) 한 곳이다', () => {
    const src = readFileSync('src/worker/middleware/edge-cache.ts', 'utf8')
    expect(src).toMatch(/c\.env = withReadReplicaEnv\(c\.env\);\s*\n\s*await next\(\);/)
    expect(src.match(/withReadReplicaEnv\(/g)?.length).toBe(1)
  })
})
