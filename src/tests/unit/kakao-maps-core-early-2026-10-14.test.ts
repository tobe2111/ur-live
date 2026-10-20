/**
 * 🗺️ 지도는 SDK 본체(kakao.js)만 오면 그린다 — services.js 를 기다리지 않는다 (2026-10-14 · `/map` LCP)
 *
 * 라이브 실측: 카카오 로더는 kakao.js → services.js 를 **차례로** 받고 그 뒤에야 `load` 콜백을 부른다.
 * services.js 를 4초 붙잡아도 본체 직후(1.5초) `new kakao.maps.Map` 이 되고 타일 13장이 나갔다.
 * 느린 4G·CPU×4 재생에서 그 사이 2.2초가 지도 첫 그림을 막고 있었다.
 *
 *   ① 본체 스크립트가 실행되면 core 가 풀린다 — 전체 준비(full)는 아직 대기 중이어도
 *   ② 이미 본체가 있으면 즉시 풀린다 · full 이 먼저 끝나도 풀린다
 *   ③ 지도 생성은 core, 지오코더를 쓰는 두 곳은 full 을 기다린다(배선)
 * ⚠️ 못 보는 것: 카카오가 로더 순서·파일 경로(`/mapjsapi/js/main/`)를 바꾸는 것(외부 계약 — 그러면 full 로 풀려
 *    종전과 같다) · 실제 LCP(라이브 vitals `LCP:/map` 이 판정).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import { stripComments } from '../helpers/source-text'

type W = Window & { __urKakaoMaps?: Promise<void>; kakao?: any }

async function fresh() {
  vi.resetModules()
  return import('@/lib/kakao-sdk')
}

beforeEach(() => {
  const w = window as W
  delete w.kakao
  delete w.__urKakaoMaps
  document.head.querySelectorAll('script').forEach((s) => s.remove())
})

describe('① 본체만으로 풀린다', () => {
  it('kakao.js 가 실행되면 core 는 풀리고 full 은 아직이다', async () => {
    const w = window as W
    w.__urKakaoMaps = new Promise<void>(() => {}) // services 가 영영 안 오는 상황
    w.kakao = { maps: {} }
    const { ensureKakaoMapsCore, ensureKakaoMaps } = await fresh()
    let full = false
    ensureKakaoMaps().then(() => { full = true })
    let core = false
    const p = ensureKakaoMapsCore().then(() => { core = true })
    const s = document.createElement('script')
    s.src = 'https://t1.kakaocdn.net/mapjsapi/js/main/4.5.29/kakao.js'
    document.head.appendChild(s)
    await Promise.resolve()
    w.kakao.maps.Map = function () {}
    s.dispatchEvent(new Event('load'))
    await p
    expect(core).toBe(true)
    expect(full).toBe(false)
  })
  it('본체 태그가 이미 붙어 있어도(하드로드에 일찍 출발) 그 태그에 건다', async () => {
    const w = window as W
    w.__urKakaoMaps = new Promise<void>(() => {})
    w.kakao = { maps: {} }
    const s = document.createElement('script')
    s.src = 'https://t1.kakaocdn.net/mapjsapi/js/main/4.5.29/kakao.js'
    document.head.appendChild(s)
    const { ensureKakaoMapsCore } = await fresh()
    const p = ensureKakaoMapsCore()
    w.kakao.maps.Map = function () {}
    s.dispatchEvent(new Event('load'))
    await expect(p).resolves.toBeUndefined()
  })
})

describe('② 다른 길로도 풀린다', () => {
  it('본체가 이미 있으면 즉시', async () => {
    const w = window as W
    w.__urKakaoMaps = new Promise<void>(() => {})
    w.kakao = { maps: { Map: function () {} } }
    const { ensureKakaoMapsCore } = await fresh()
    await expect(ensureKakaoMapsCore()).resolves.toBeUndefined()
  })
  it('full 이 먼저 끝나도', async () => {
    const w = window as W
    w.__urKakaoMaps = Promise.resolve()
    w.kakao = { maps: {} }
    const { ensureKakaoMapsCore } = await fresh()
    await expect(ensureKakaoMapsCore()).resolves.toBeUndefined()
  })
})

describe('③ 배선', () => {
  const code = (f: string) => stripComments(fs.readFileSync(f, 'utf8'))
  it('지도 생성은 core 를 기다린다', () => {
    expect(code('src/pages/restaurant-map/useKakaoMap.ts')).toMatch(/ensureKakaoMapsCore\(\)\s*\.then\(\(\) => setSdkLoaded\(true\)\)/)
  })
  it('지역명(지오코더)은 full 을 기다린 뒤에만 붙는다', () => {
    const s = code('src/pages/restaurant-map/useViewportRegion.ts')
    expect(s).toMatch(/ensureKakaoMaps\(\)\.then\(\(\) => \{ if \(alive\) setServicesReady\(true\)/)
    expect(s).toMatch(/if \(!enabled \|\| !servicesReady\) return/)
  })
  it('지명 검색 이동도 services 가 없으면 full 을 기다린다', () => {
    expect(code('src/pages/restaurant-map/pan-to-region.ts')).toMatch(/if \(!w\.kakao\?\.maps\?\.services\) \{ try \{ await ensureKakaoMaps\(\)/)
  })
})
