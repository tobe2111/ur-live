/**
 * 🗺️ 2026-11-17 요청 제한 — 민감하지 않은 조회(GET)는 원본 DB 에 세지 않는다 (결재 2026-11-17 3번).
 *
 * 지키는 것:
 *  1. 민감하지 않은 GET 은 DB 를 한 번도 건드리지 않고도 한도를 지킨다(초과 시 429).
 *  2. 로그인류(이름 휴리스틱·sensitive 지정)와 바꾸는 요청(POST)은 종전대로 DB 에 센다.
 *
 * 못 막는 것: isolate 를 여러 개 거치는 분산 공격(그 경로는 원래 DB 오류 시 열어 두던 fail-open 이었다).
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { rateLimit } from '@/worker/middleware/rate-limit'

function fakeDb() {
  const calls: string[] = []
  const stmt = { bind: () => stmt, run: async () => { calls.push('run'); return { meta: {} } }, first: async () => { calls.push('first'); return { count: 1 } } }
  return { calls, DB: { prepare: (sql: string) => { calls.push(sql.trim().split(/\s+/)[0]); return stmt } } as unknown as D1Database }
}
async function hit(app: Hono, method: string, path: string, DB: D1Database, ip = '1.2.3.4') {
  return (await app.request(path, { method, headers: { 'CF-Connecting-IP': ip } }, { DB })).status
}

describe('요청 제한 — 조회는 메모리, 민감·변경은 DB', () => {
  it('민감하지 않은 GET: DB 0회 · 한도 넘으면 429', async () => {
    const { calls, DB } = fakeDb()
    const app = new Hono()
    app.get('/map', rateLimit({ action: 'kakao_proxy_t1', max: 3, windowSec: 60 }), (c) => c.text('ok'))
    const s = [] as number[]
    for (let i = 0; i < 4; i++) s.push(await hit(app, 'GET', '/map', DB))
    expect(s).toEqual([200, 200, 200, 429])
    expect(calls).toEqual([])
  })

  it('다른 IP 는 따로 센다', async () => {
    const { DB } = fakeDb()
    const app = new Hono()
    app.get('/map', rateLimit({ action: 'kakao_proxy_t2', max: 1, windowSec: 60 }), (c) => c.text('ok'))
    expect(await hit(app, 'GET', '/map', DB, '9.9.9.1')).toBe(200)
    expect(await hit(app, 'GET', '/map', DB, '9.9.9.2')).toBe(200)
    expect(await hit(app, 'GET', '/map', DB, '9.9.9.1')).toBe(429)
  })

  it('로그인류 GET 과 POST 는 종전대로 DB 에 센다', async () => {
    const a = fakeDb(); const app = new Hono()
    app.get('/l', rateLimit({ action: 'kakao-login', max: 5, windowSec: 60 }), (c) => c.text('ok'))
    await hit(app, 'GET', '/l', a.DB)
    expect(a.calls).toContain('INSERT')
    const b = fakeDb(); const app2 = new Hono()
    app2.post('/p', rateLimit({ action: 'donate_t', max: 5, windowSec: 60 }), (c) => c.text('ok'))
    await hit(app2, 'POST', '/p', b.DB)
    expect(b.calls).toContain('INSERT')
    const d = fakeDb(); const app3 = new Hono()
    app3.get('/s', rateLimit({ action: 'access_unlock', max: 5, windowSec: 60, sensitive: true }), (c) => c.text('ok'))
    await hit(app3, 'GET', '/s', d.DB)
    expect(d.calls).toContain('INSERT')
  })
})
