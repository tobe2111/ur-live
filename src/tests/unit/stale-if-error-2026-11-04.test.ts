/**
 * 🛟 2026-11-04 [UNLOCK_LOADING] 대표 *"대기업급 안정성을 보여주는 최적화가 필요해"* — 공개 캐시(`publicCache`/`edgeCache`)가
 *   원본 실패(5xx·예외) 때 **마지막 성공 응답(24시간 예비 사본)** 을 대신 낸다(stale-if-error).
 *   2026-09-01 D1 일일 읽기 한도 사고 때 소비자 API 가 통째로 500 이 됐던 모양을 막는다.
 * 지키는 것: ① 성공하면 예비 사본을 둔다 ② 원본 5xx 면 사본을 `*-STALE` 로 ③ 예외도 같다 ④ 사본이 없으면 종전처럼 오류
 *   ⑤ 4xx 는 사본으로 덮지 않는다(없는 것을 있다고 하지 않는다).
 * ⚠️ 못 보는 것: 실제 Cloudflare Cache API 의 보관·만료(로컬 흉내) · 200 인데 `success:false` 인 응답(그건 실패로 못 본다).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import { publicCache } from '@/worker/middleware/edge-cache'

const store = new Map<string, Response>()
const fakeCache = {
  match: async (k: Request) => { const r = store.get(k.url); return r ? r.clone() : undefined },
  put: async (k: Request, r: Response) => { store.set(k.url, r.clone()) },
}
let pending: Promise<unknown>[] = []
const ctx = { waitUntil: (p: Promise<unknown>) => { pending.push(p) }, passThroughOnException: () => {} }

beforeEach(() => { store.clear(); pending = []; vi.stubGlobal('caches', { default: fakeCache }) })
afterEach(() => vi.unstubAllGlobals())

function appWith(mode: { v: 'ok' | '500' | 'throw' | '404' }) {
  const app = new Hono()
  app.get('/api/x', publicCache(30), (c) => {
    if (mode.v === 'throw') throw new Error('D1 down')
    if (mode.v === '500') return c.json({ success: false }, 500)
    if (mode.v === '404') return c.json({ success: false }, 404)
    return c.json({ success: true, n: 1 })
  })
  app.onError((_e, c) => c.json({ success: false, error: 'boom' }, 500))
  return app
}
const call = async (app: Hono) => { const r = await app.request('https://urdeal.kr/api/x', {}, {}, ctx as never); await Promise.all(pending); return r }
/** 신선 캐시만 지우고 예비 사본은 남긴다 — "캐시 만료 뒤 원본 실패" 상황. */
const expireFresh = () => { for (const k of [...store.keys()]) if (!k.includes('__ur_stale=1')) store.delete(k) }

describe('공개 캐시 — 원본이 실패하면 마지막 성공 응답', () => {
  it('① 성공하면 예비 사본을 둔다', async () => {
    const mode = { v: 'ok' as const }
    await call(appWith(mode))
    expect([...store.keys()].some((k) => k.includes('__ur_stale=1'))).toBe(true)
  })
  it('② 캐시 만료 뒤 원본 500 → 예비 사본을 STALE 로', async () => {
    const mode: { v: 'ok' | '500' | 'throw' | '404' } = { v: 'ok' }
    const app = appWith(mode)
    await call(app)
    expireFresh(); mode.v = '500'
    const r = await call(app)
    expect(r.status).toBe(200)
    expect(r.headers.get('X-Cache-Status')).toBe('public-STALE')
    expect(await r.json()).toEqual({ success: true, n: 1 })
  })
  it('③ 핸들러가 던져도 같다', async () => {
    const mode: { v: 'ok' | '500' | 'throw' | '404' } = { v: 'ok' }
    const app = appWith(mode)
    await call(app)
    expireFresh(); mode.v = 'throw'
    const r = await call(app)
    expect(r.status).toBe(200)
    expect(r.headers.get('X-Cache-Status')).toBe('public-STALE')
  })
  it('④ 예비 사본이 없으면 종전처럼 오류', async () => {
    const r = await call(appWith({ v: '500' }))
    expect(r.status).toBe(500)
  })
  it('⑤ 4xx 는 사본으로 덮지 않는다', async () => {
    const mode: { v: 'ok' | '500' | 'throw' | '404' } = { v: 'ok' }
    const app = appWith(mode)
    await call(app)
    expireFresh(); mode.v = '404'
    const r = await call(app)
    expect(r.status).toBe(404)
  })
})
