/**
 * 🧊 2026-11-18 [UNLOCK_LOADING] KV 첫 화면 데이터의 지역 복사본 — 대표 승인 "해줘".
 * 라이브: 홈·숙소는 매번 `MAIN:kv-hit`(응답 0.22~0.49초), 지역 캐시를 쓰는 상세·이용권은 0.2초 안팎.
 * 지키는 것(진짜 함수 · 가짜 caches/KV):
 *  1. KV 에서 읽으면 **다른 키**(`/__ssr-kv-copy…`)로 1분짜리 복사본을 남긴다 — API 캐시 키는 건드리지 않는다.
 *  2. 다음 요청은 KV 를 묻지 않고 그 복사본을 쓴다(`kv-copy-hit`).
 *  3. KV 를 쓰지 않는 경로(상세 등)는 복사본도 보지 않는다.
 * 못 막는 것: 라이브 응답 시간 — 배포 뒤 `X-SSR-Status: MAIN:kv-copy-hit` 와 TTFB 로 판정.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchSsrPayload, KV_EDGE_COPY_PREFIX, KV_EDGE_COPY_MAX_AGE_S } from '@/worker/utils/ssr-payload'
import { SSR_KV_PATHS } from '@/worker/cron/cache-prewarm'

afterEach(() => vi.unstubAllGlobals())

function fakeCaches() {
  const store = new Map<string, Response>()
  const put = vi.fn(async (req: Request, res: Response) => { store.set(req.url, res.clone()) })
  const match = vi.fn(async (req: Request) => store.get(req.url)?.clone())
  return { store, put, match, api: { default: { put, match, delete: vi.fn() } } }
}

describe('KV 지역 복사본', () => {
  it('KV 에서 읽으면 다른 키로 1분 복사본을 남기고, 다음 요청은 KV 를 묻지 않는다', async () => {
    const c = fakeCaches(); vi.stubGlobal('caches', c.api)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"success":true}', { status: 200 })))
    const path = SSR_KV_PATHS[0]
    const kv = { get: vi.fn(async () => '{"success":true,"data":[1]}') }
    const pending: Promise<unknown>[] = []
    const r1 = await fetchSsrPayload({ slot: 'MAIN', path }, 'https://x.test', { CACHE_KV: kv }, (p) => { pending.push(p) })
    await Promise.all(pending)
    expect(r1.status).toBe('kv-hit')
    const keys = [...c.store.keys()]
    expect(keys).toEqual([`https://x.test${KV_EDGE_COPY_PREFIX}${path}`])
    expect(keys).not.toContain(`https://x.test${path}`) // API 캐시 키와 섞지 않는다
    expect(c.store.get(keys[0])!.headers.get('Cache-Control')).toBe(`public, max-age=${KV_EDGE_COPY_MAX_AGE_S}`)

    const r2 = await fetchSsrPayload({ slot: 'MAIN', path }, 'https://x.test', { CACHE_KV: kv }, () => {})
    expect(r2.status).toBe('kv-copy-hit')
    expect(kv.get).toHaveBeenCalledTimes(1)
    expect(r2.payload).toBe(r1.payload)
  })

  it('KV 를 안 쓰는 경로는 복사본도 보지 않는다', async () => {
    const c = fakeCaches(); vi.stubGlobal('caches', c.api)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"success":true}', { status: 200 })))
    await fetchSsrPayload({ slot: 'DETAIL', path: '/api/group-buy/products/1' }, 'https://x.test', {}, () => {})
    expect(c.match.mock.calls.map((a) => (a[0] as Request).url).some((u) => u.includes(KV_EDGE_COPY_PREFIX))).toBe(false)
  })
})
