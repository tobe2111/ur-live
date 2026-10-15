/**
 * 🗺️ 홈이 지도 화면 코드를 미리 받는다 〔2026-10-15〕
 *
 * 대표 *"1, 2 둘 다 진행"* — 2번. 홈 지도 알약을 누른 뒤 ~1초가 지도 화면 청크였다. 이 시험은
 * ① 홈이 다 뜨고 SDK 를 받은 **다음에** 지도 화면 코드를 받는지(같은 회선을 동시에 안 쓴다)
 * ② 데이터 절약이면 미리 안 받는지 ③ 누르는 순간에도 출발하되 **한 번만** 받는지
 * ④ 홈이 `import()` 를 직접 쓰지 않고 App.tsx 의 lazy 로더를 이름으로 부르는지(묶음기 봉투 불변) 를 본다.
 *
 * 못 막는 것: 실제 청크 바이트·체감 시간(라이브 측정) · 묶음기 봉투(화면별 바이트 예산 가드의 몫).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import { stripComments } from '../helpers/source-text'

const order: string[] = []
const ensure = vi.fn(() => { order.push('sdk'); return Promise.resolve() })
vi.mock('@/lib/kakao-sdk', () => ({ ensureKakaoMaps: ensure }))

const setConn = (c: unknown) => Object.defineProperty(navigator, 'connection', { value: c, configurable: true })
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)) }
Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'complete' })

beforeEach(() => { vi.resetModules(); ensure.mockClear(); order.length = 0; setConn(undefined) })

async function setup() {
  const rp = await import('@/lib/route-preload')
  const loader = vi.fn(() => { order.push('page'); return Promise.resolve({}) })
  rp.registerRoutePreload('map', loader)
  const w = await import('@/pages/mobile-home/map-warmup')
  return { loader, w }
}

describe('① SDK 다음에 지도 화면 코드', () => {
  it('홈이 다 뜬 뒤 SDK → 화면 코드 순서로 한 번', async () => {
    const { loader, w } = await setup()
    w.warmKakaoMapsAfterLoad()
    await new Promise((r) => setTimeout(r, 400)); await flush()
    expect(order).toEqual(['sdk', 'page'])
    expect(loader).toHaveBeenCalledTimes(1)
  })
  it('데이터 절약이면 둘 다 미리 안 받는다', async () => {
    setConn({ saveData: true })
    const { loader, w } = await setup()
    w.warmKakaoMapsAfterLoad()
    await new Promise((r) => setTimeout(r, 400)); await flush()
    expect(loader).not.toHaveBeenCalled()
  })
})

describe('② 누르는 순간에도 출발 — 한 번만', () => {
  it('알약을 누르면 받고, 뒤이은 한가할 때는 다시 안 받는다', async () => {
    const { loader, w } = await setup()
    w.preconnectMapTiles()
    expect(loader).toHaveBeenCalledTimes(1)
    w.warmKakaoMapsAfterLoad()
    await new Promise((r) => setTimeout(r, 400)); await flush()
    expect(loader).toHaveBeenCalledTimes(1)
  })
  it('실패하면 다음 기회에 다시 시도한다', async () => {
    const rp = await import('@/lib/route-preload')
    let n = 0
    rp.registerRoutePreload('x', () => { n++; return n === 1 ? Promise.reject(new Error('net')) : Promise.resolve() })
    rp.preloadRoute('x'); await flush(); rp.preloadRoute('x'); await flush()
    expect(n).toBe(2)
  })
})

describe('③ 배선 — 동적 import 는 App.tsx 한 곳', () => {
  const app = stripComments(fs.readFileSync('src/App.tsx', 'utf8'))
  const warm = stripComments(fs.readFileSync('src/pages/mobile-home/map-warmup.ts', 'utf8'))
  it('App.tsx 가 지도 lazy 와 같은 로더를 등록한다', () => {
    // 🚀 2026-10-15: 로더는 lazyPage 래퍼의 load 하나 — 받아 두면 지도 화면이 "준비됨" 이 된다(lib/boot-page).
    expect(app).toMatch(/const RestaurantMapPage = lazyPage\(\(\) => import\('\.\/pages\/RestaurantMapPage'\)\); registerRoutePreload\('map', RestaurantMapPage\.load\)/)
  })
  it('홈 미리 데우기는 지도 페이지를 직접 import 하지 않는다', () => {
    expect(warm).not.toMatch(/RestaurantMapPage/)
    expect(warm).toMatch(/preloadRoute\('map'\)/)
  })
})
