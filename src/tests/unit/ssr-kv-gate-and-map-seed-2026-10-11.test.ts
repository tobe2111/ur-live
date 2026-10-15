/**
 * 🚀 로딩 두 건 (2026-10-11 [UNLOCK_LOADING] — 대표 "둘 다 진행")
 *
 * ① **SSR 전역 KV 는 cron 이 쓰는 키만 읽는다.** KV 는 cron 만 쓰는데(`SSR_KV_PATHS`) 워커는 엣지가 miss 면
 *    **모든 슬롯**에서 KV 를 먼저 물었다 — 상세·유어샵 키는 아무도 안 써서 늘 miss 이고, 라이브에서
 *    `DETAIL:self-fetch-hit` 에 `kv;dur=95~104ms` 가 찍혔다(순수 대기). 에러도 결과 차이도 없어 아무도 몰랐다.
 * ② **지도(`/map`)도 첫 화면 시드를 받는다.** 지도는 처음부터 `sort=discount` 로 요청해서 홈 시드(무정렬)를
 *    못 쓰고 하드로드마다 한 왕복을 더 기다렸다. 워커가 같은 요청을 미리 받아 `__SSR_INITIAL_MAP__` 로 싣는다.
 *
 * 이 시험이 **못 보는 것**: 라이브 TTFB 실측(배포 뒤 `X-SSR-Status`·`Server-Timing` 으로 판정) ·
 *   axios 의 실제 직렬화(여기선 URLSearchParams 로 대조 — 이 값들엔 같은 결과) · 워커 HTMLRewriter 주입 자체.
 */
import { routeSurface } from '@/shared/route-surface'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderHook } from '@testing-library/react'
import { fetchSsrPayload, isKvWarmedPath } from '@/worker/utils/ssr-payload'
import { SSR_KV_PATHS } from '@/worker/cron/cache-prewarm'
import { MAP_SEED_PATH, MAP_SEED_SORT, mapFeedParams, isMapSeedRequest } from '@/shared/map-feed-seed'
import { stripComments } from '../helpers/source-text'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => new Promise(() => {})) } }))

const read = (p: string) => readFileSync(p, 'utf-8')
const code = (p: string) => stripComments(read(p))

function fakeKv() {
  const get = vi.fn(async (key: string) => (key === `ssr:${SSR_KV_PATHS[0]}` ? '{"success":true,"data":[]}' : null))
  return { get }
}

describe('① KV 는 cron 이 쓰는 키만 읽는다', () => {
  beforeEach(() => {
    vi.stubGlobal('caches', { default: { match: async () => undefined } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"success":true}', { status: 200 })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('워밍 목록은 cron 의 쓰기 목록 그대로다 (6키 — 비면 통과가 아니라 실패)', () => {
    expect(SSR_KV_PATHS.length).toBeGreaterThanOrEqual(5)
    for (const p of SSR_KV_PATHS) expect(isKvWarmedPath(p), p).toBe(true)
  })

  it('🔴 상세·유어샵 같은 안 쓰는 키는 KV 를 아예 묻지 않는다 (~100ms 대기 제거)', async () => {
    for (const path of ['/api/group-buy/products/2888', '/api/curator/jiwon1228', '/api/sellers/abc/public']) {
      const kv = fakeKv()
      const r = await fetchSsrPayload({ slot: 'DETAIL', path }, 'https://x.test', { CACHE_KV: kv })
      expect(kv.get, `${path} 에서 KV 를 물었다 — 늘 miss 인 대기`).not.toHaveBeenCalled()
      expect(r.timings.some((t) => t.startsWith('kv;'))).toBe(false)
      expect(r.status).toBe('self-fetch-hit')
    }
  })

  it('워밍된 키는 여전히 KV 에서 받는다 (콜드 콜로 0-RTT 유지)', async () => {
    const kv = fakeKv()
    const r = await fetchSsrPayload({ slot: 'MAIN', path: SSR_KV_PATHS[0] }, 'https://x.test', { CACHE_KV: kv })
    expect(kv.get).toHaveBeenCalledWith(`ssr:${SSR_KV_PATHS[0]}`, 'text')
    expect(r.status).toBe('kv-hit')
  })
})

describe('② 지도 첫 화면 시드', () => {
  it('화면이 보내는 첫 요청이 시드 경로와 byte-일치한다', () => {
    const qs = new URLSearchParams(mapFeedParams('all', 1, null, MAP_SEED_SORT, 50) as Record<string, string>).toString()
    expect(`/api/group-buy/products?${qs}`).toBe(MAP_SEED_PATH)
  })

  it('시드는 같은 요청일 때만 쓴다 (다른 요청의 답 = 거짓 목록)', () => {
    expect(isMapSeedRequest('all', null, MAP_SEED_SORT)).toBe(true)
    expect(isMapSeedRequest('all', { lat: 37.5, lng: 127 }, MAP_SEED_SORT)).toBe(false)
    expect(isMapSeedRequest('meal_voucher', null, MAP_SEED_SORT)).toBe(false)
    expect(isMapSeedRequest('all', null, 'price')).toBe(false)
    expect(isMapSeedRequest('all', null, '')).toBe(false)
  })

  it('cron 이 같은 경로를 엣지(HOT_PATHS)와 전역 KV 에 데운다', () => {
    const prewarm = read('src/worker/cron/cache-prewarm.ts')
    const hot = prewarm.slice(prewarm.indexOf('const HOT_PATHS'), prewarm.indexOf('] as const;'))
    expect(hot).toContain(`'${MAP_SEED_PATH}'`)
    expect(SSR_KV_PATHS).toContain(MAP_SEED_PATH)
  })

  it('워커가 /map(쿼리 없음)에서 MAP 슬롯으로 그 경로를 싣고, 청크도 병렬로 받는다', () => {
    const w = code('src/worker/index.ts')
    expect(w).toMatch(/url\.pathname === '\/map' && !url\.search\) \{\s*ssrTarget = \{ slot: 'MAP', path: MAP_SEED_PATH \}/)
    // 🧭 2026-10-15: 표면 판정은 공용 함수(shared/route-surface) — 워커가 그것을 부른다.
    expect(w).toContain("const chunkSurface = routeSurface(url.pathname, isMobileUserAgent(c.req.header('user-agent')), authed)")
    expect(routeSurface('/map', true, false)).toBe('map')
    const gen = code('scripts/generate-route-chunk-map.mjs')
    expect(gen).toMatch(/map: \['src\/pages\/RestaurantMapPage\.tsx'\]/)
  })

  it('지도의 위치 없는 기본 정렬이 시드 정렬이다 (바꾸면 시드가 안 맞는다)', () => {
    expect(code('src/pages/RestaurantMapPage.tsx')).toMatch(/useState<SortBy>\(\(\) => \(userLoc \? 'distance' : MAP_SEED_SORT\)\)/)
  })

  it('🔴 시드가 있으면 첫 렌더부터 카드가 있다 (요청을 기다리지 않는다)', async () => {
    const seed = { success: true, total: 338, data: [{ id: 1, name: '치즈돈가스' }, { id: 2, name: '네일' }] }
    const el = document.createElement('script')
    el.id = '__SSR_INITIAL_MAP__'
    el.type = 'application/json'
    el.textContent = JSON.stringify(seed)
    document.head.appendChild(el)
    try {
      const { useMapProducts } = await import('@/hooks/queries/useMapProducts')
      const { result } = renderHook(() => useMapProducts('all', null, { sort: MAP_SEED_SORT }))
      expect(result.current.isLoading).toBe(false)
      expect(result.current.data.map((r) => r.id)).toEqual([1, 2])
      expect(result.current.total).toBe(338)
    } finally {
      el.remove()
    }
  })
})
