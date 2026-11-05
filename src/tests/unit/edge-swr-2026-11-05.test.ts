/**
 * ⚡ 2026-11-05 대표 *"무료 수준에서 대기업 수준으로"* — 공개 캐시 **만료 직후** 손님을 원본(미국 D1)까지 기다리게 하지 않는다.
 *   Cache API 는 stale-while-revalidate 를 안 지킨다(만료 = 없음). 그래서 예비 사본이 창 안이면 즉시 내고, 뒤에서 같은 주소를
 *   `x-ur-revalidate: 1` 로 한 번 다시 받아 채운다.
 * 지키는 것: ① 창 안 → 즉시 `*-SWR` + 뒤에서 갱신 1번 ② 창 밖 → 종전대로 원본 ③ 갱신 요청은 SWR 을 건너뛰고 원본을 받아 채운다
 *   ④ 같은 주소 동시 갱신은 1번 ⑤ 내부 헤더는 손님에게 안 나간다 ⑥ 창 = 엣지 수명(ttl×3) + min(ttl,60초).
 * ⚠️ 못 보는 것: 실제 Pages 에서 자기 주소 fetch 가 워커로 다시 들어오는지(SSR 이 같은 수법을 이미 쓴다) · 실제 만료 타이밍.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import { publicCache, swrServable, swrExtraMs } from '@/worker/middleware/edge-cache'

const store = new Map<string, Response>()
const fakeCache = {
  match: async (k: Request) => { const r = store.get(k.url); return r ? r.clone() : undefined },
  put: async (k: Request, r: Response) => { store.set(k.url, r.clone()) },
}
let pending: Promise<unknown>[] = []
const ctx = { waitUntil: (p: Promise<unknown>) => { pending.push(p) }, passThroughOnException: () => {} }
let hits = 0
const fetchSpy = vi.fn()

function app() {
  const a = new Hono()
  a.get('/api/x', publicCache(30), (c) => { hits++; return c.json({ n: hits }) })
  return a
}
const A = app()
const call = (init: RequestInit = {}) => A.request('https://urdeal.kr/api/x', init, {}, ctx as never)
const drain = async () => { for (let i = 0; i < 10 && pending.length; i++) { const p = pending; pending = []; await Promise.all(p) } }
const expireFresh = () => { for (const k of [...store.keys()]) if (!k.includes('__ur_stale=1')) store.delete(k) }
const ageBackup = (ms: number) => {
  for (const k of [...store.keys()]) if (k.includes('__ur_stale=1')) {
    const r = store.get(k)!; const h = new Headers(r.headers); h.set('X-Ur-Stored-At', String(Date.now() - ms))
    store.set(k, new Response(r.body, { status: r.status, headers: h }))
  }
}

beforeEach(() => {
  store.clear(); pending = []; hits = 0; fetchSpy.mockReset()
  vi.stubGlobal('caches', { default: fakeCache })
  // 자기 주소 갱신 요청 → 같은 앱으로 돌려보낸다(Pages 에서 워커로 다시 들어오는 것을 흉내)
  fetchSpy.mockImplementation((url: string, init: RequestInit) => A.request(url, init, {}, ctx as never))
  vi.stubGlobal('fetch', fetchSpy)
})
afterEach(() => vi.unstubAllGlobals())

describe('공개 캐시 SWR', () => {
  it('① 창 안이면 옛 사본을 즉시 내고, 뒤에서 한 번 갱신해 채운다', async () => {
    await call(); await drain()                       // n=1 저장
    expireFresh()
    const r = await call()
    expect(r.headers.get('X-Cache-Status')).toBe('public-SWR')
    expect(await r.json()).toEqual({ n: 1 })         // 손님은 기다리지 않는다
    await drain()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(new Headers(fetchSpy.mock.calls[0][1].headers).get('x-ur-revalidate')).toBe('1')
    expect(hits).toBe(2)                              // 뒤에서 원본을 한 번 받았다
    const after = await call()
    expect(after.headers.get('X-Cache-Status')).toBe('public-HIT')
    expect(await after.json()).toEqual({ n: 2 })     // 다음 손님은 새 값
  })
  it('② 창 밖(오래된 사본)이면 종전대로 원본을 기다린다', async () => {
    await call(); await drain()
    expireFresh(); ageBackup(30 * 3 * 1000 + swrExtraMs(30) + 1000)
    const r = await call()
    expect(r.headers.get('X-Cache-Status')).not.toBe('public-SWR') // 원본 응답(MISS 표시는 저장본에만 붙는다)
    expect(await r.json()).toEqual({ n: 2 })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  it('③ 같은 주소를 동시에 두 번 열어도 갱신은 한 번', async () => {
    await call(); await drain()
    expireFresh()
    const [a, b] = await Promise.all([call(), call()])
    expect(a.headers.get('X-Cache-Status')).toBe('public-SWR')
    expect(b.headers.get('X-Cache-Status')).not.toBe('public-SWR') // 갱신이 도는 동안 두 번째는 원본(사본이 없을 때와 같다)
    await drain()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
  it('④ 내부 헤더(저장 시각)는 손님에게 안 나간다', async () => {
    const first = await call(); await drain()
    expect(first.headers.get('X-Ur-Stored-At')).toBeNull()
    expireFresh()
    const r = await call()
    expect(r.headers.get('X-Ur-Stored-At')).toBeNull()
    expect(r.headers.get('CDN-Cache-Control')).toBeNull()
  })
  it('⑤ 창 = 엣지 수명(ttl×3) + min(ttl, 60초) — 저장 시각이 없으면(옛 사본) SWR 안 한다', () => {
    const now = 1_000_000_000
    expect(swrServable(now - 90_000, 30, now)).toBe(true)          // 엣지 수명 끝
    expect(swrServable(now - 120_000, 30, now)).toBe(true)         // + 30초
    expect(swrServable(now - 120_001, 30, now)).toBe(false)
    expect(swrExtraMs(600)).toBe(60_000)                           // 긴 TTL 도 창은 60초까지만
    expect(swrServable(NaN, 30, now)).toBe(false)
    expect(swrServable(0, 30, now)).toBe(false)
  })
})
