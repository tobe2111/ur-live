/**
 * ♻️ SSR 직전 사본(stale-while-revalidate) — 근거·실측은 `src/worker/utils/ssr-payload.ts` 의 `STALE_*` 주석.
 *
 * 진짜 `fetchSsrPayload` 를 Map 으로 흉내 낸 `caches.default` 위에서 돌린다:
 *   ① 사본이 없으면 종전대로 self-fetch 를 기다리고, 응답 뒤(waitUntil)에 사본을 남긴다
 *   ② 엣지가 비어도 사본이 있으면 **바로** 쓰고(stale-hit), 새로고침은 waitUntil 로만 돈다(응답이 안 기다린다)
 *   ③ 새로고침이 404 면 사본을 지운다(내려간 상품을 1시간 살려 두지 않는다)
 *   ④ waitUntil 이 없으면 사본을 안 쓴다(새로 채울 수 없는 사본이 1시간 돈다)
 *   ⑤ KV 로 예열되는 목록 경로는 대상이 아니다
 *   ⑥ 사본도 `</script` 이스케이프를 거친다(XSS)
 *   ⑦ 워커 배선 — 두 호출 모두 waitUntil 을 넘긴다
 * ⚠️ 못 막는 것: 실제 콜로 캐시 동작·TTFB(배포 후 `X-SSR-Status: …:stale-hit` 실측이 판정).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fetchSsrPayload, STALE_PREFIX } from '@/worker/utils/ssr-payload'

const ORIGIN = 'https://urdeal.kr'
const DETAIL = { slot: 'DETAIL', path: '/api/group-buy/products/2919' } as const

let store: Map<string, string>
let fetchMock: ReturnType<typeof vi.fn>
let pending: Promise<unknown>[]
const waitUntil = (p: Promise<unknown>) => { pending.push(p) }
const flush = async () => { while (pending.length) await pending.shift() }

beforeEach(() => {
  store = new Map()
  pending = []
  vi.stubGlobal('caches', {
    default: {
      match: async (req: Request) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined),
      put: async (req: Request, res: Response) => { store.set(req.url, await res.text()) },
      delete: async (req: Request) => store.delete(req.url),
    },
  })
  fetchMock = vi.fn(async () => new Response('{"success":true,"v":"fresh"}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllGlobals() })

const staleUrl = (p: string) => `${ORIGIN}${STALE_PREFIX}${p}`

describe('♻️ SSR 직전 사본', () => {
  it('① 사본이 없으면 self-fetch 를 기다리고, 뒤에 사본을 남긴다', async () => {
    const r = await fetchSsrPayload(DETAIL, ORIGIN, {}, waitUntil)
    expect(r.status).toBe('self-fetch-hit')
    expect(r.payload).toContain('fresh')
    await flush()
    expect(store.get(staleUrl(DETAIL.path))).toContain('fresh')
  })

  it('② 엣지가 비어도 사본이 있으면 바로 쓰고, 새로고침은 뒤에서만 돈다', async () => {
    store.set(staleUrl(DETAIL.path), '{"success":true,"v":"old"}')
    let release!: () => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>((res) => { release = () => res(new Response('{"success":true,"v":"new"}')) }))
    const r = await fetchSsrPayload(DETAIL, ORIGIN, {}, waitUntil) // fetch 가 안 끝났는데도 돌아온다
    expect(r.status).toBe('stale-hit')
    expect(r.payload).toContain('old')
    expect(r.timings.some((t) => t.startsWith('stale;'))).toBe(true)
    expect(r.timings.some((t) => t.startsWith('self;'))).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    release()
    await flush()
    expect(store.get(staleUrl(DETAIL.path))).toContain('new')
  })

  it('③ 새로고침이 404 면 사본을 지운다', async () => {
    store.set(staleUrl(DETAIL.path), '{"success":true,"v":"old"}')
    fetchMock.mockResolvedValueOnce(new Response('nf', { status: 404 }))
    const r = await fetchSsrPayload(DETAIL, ORIGIN, {}, waitUntil)
    expect(r.status).toBe('stale-hit')
    await flush()
    expect(store.has(staleUrl(DETAIL.path))).toBe(false)
  })

  it('④ waitUntil 이 없으면 사본을 쓰지도 남기지도 않는다', async () => {
    store.set(staleUrl(DETAIL.path), '{"success":true,"v":"old"}')
    const r = await fetchSsrPayload(DETAIL, ORIGIN, {})
    expect(r.status).toBe('self-fetch-hit')
    expect(r.payload).toContain('fresh')
    expect(store.get(staleUrl(DETAIL.path))).toContain('old')
  })

  it('⑤ KV 로 예열되는 목록 경로는 사본을 안 쓴다', async () => {
    const { SSR_KV_PATHS } = await import('@/worker/cron/cache-prewarm')
    const path = SSR_KV_PATHS[0]
    store.set(staleUrl(path), '{"success":true,"v":"old"}')
    const r = await fetchSsrPayload({ slot: 'MAIN', path }, ORIGIN, {}, waitUntil)
    expect(r.status).not.toBe('stale-hit')
  })

  it('⑥ 사본도 </script 이스케이프를 거친다', async () => {
    store.set(staleUrl(DETAIL.path), '{"x":"</script><b>"}')
    const r = await fetchSsrPayload(DETAIL, ORIGIN, {}, waitUntil)
    expect(r.payload).not.toContain('</script')
  })

  it('⑥-b 엣지 적중이 먼저다 — 사본보다 앞선다', async () => {
    store.set(`${ORIGIN}${DETAIL.path}`, '{"v":"edge"}')
    store.set(staleUrl(DETAIL.path), '{"v":"old"}')
    const r = await fetchSsrPayload(DETAIL, ORIGIN, {}, waitUntil)
    expect(r.status).toBe('edge-hit')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('⑦ 워커가 두 호출 모두에 waitUntil 을 넘긴다', () => {
    const src = readFileSync('src/worker/index.ts', 'utf8')
    expect(src).toMatch(/fetchSsrPayload\(ssrTarget, origin0, c\.env, ssrWaitUntil\(c\)\)/)
    expect(src).toMatch(/fetchSsrPayload\(ssrExtra, origin0, c\.env, ssrWaitUntil\(c\)\)/)
  })

  it('⏱️ 직전 사본은 24시간 보관한다(2026-10-15 대표 승인) — 1시간이면 덜 보는 상세가 늘 콜드였다', async () => {
    const m = await import('@/worker/utils/ssr-payload')
    expect(m.STALE_MAX_AGE_S).toBe(86400)
  })
})

