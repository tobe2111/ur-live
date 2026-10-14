/**
 * 🗺️ 지도 타일 화질 — 느린 회선에서만 일반 화질 〔2026-10-14〕
 *
 * 대표 *"모두 순서대로 진행"* (개선점 보고 3번). 지도 LCP 요소가 지도 타일이고, 전국 보기 13장이
 * 고화질 687KB ↔ 일반 285KB 였다(라이브 실측, 느린 4G). 일반 화질은 레티나에서 흐리므로 **회선이 느리다고
 * 브라우저가 말할 때만** 쓴다. 이 시험은 ① 판정 규칙 ② `disableHD` 가 **첫 지도보다 먼저**(SDK 준비가 끝나는
 * 약속 안에서) 불리는지 ③ 빠른 회선·정보 없음(iOS)은 고화질 그대로인지 ④ 지도 화면이 SDK 래퍼를 동적 import
 * 로 한 번 더 기다리지 않는지 를 본다.
 *
 * 못 막는 것: 실제 타일 바이트·LCP(라이브 측정만 판정) · 카카오가 `disableHD` 를 바꾸는 것(외부 계약).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import { prefersLowResMapTiles } from '@/lib/kakao-sdk'
import { stripComments } from '../helpers/source-text'

type W = Window & { __urKakaoMaps?: Promise<void>; kakao?: unknown }

describe('① 판정 규칙', () => {
  it('정보가 없으면(iOS 사파리) 고화질', () => {
    expect(prefersLowResMapTiles({})).toBe(false)
    expect(prefersLowResMapTiles(undefined)).toBe(false)
  })
  it('빠른 4G 는 고화질', () => {
    expect(prefersLowResMapTiles({ connection: { effectiveType: '4g', downlink: 10 } })).toBe(false)
    expect(prefersLowResMapTiles({ connection: { effectiveType: '4g' } })).toBe(false)
  })
  it('데이터 절약 · 4G 미만 · 3Mbps 미만이면 일반 화질', () => {
    expect(prefersLowResMapTiles({ connection: { saveData: true, effectiveType: '4g', downlink: 10 } })).toBe(true)
    expect(prefersLowResMapTiles({ connection: { effectiveType: '3g' } })).toBe(true)
    expect(prefersLowResMapTiles({ connection: { effectiveType: '4g', downlink: 1.6 } })).toBe(true)
  })
  it('downlink 0(알 수 없음)은 느린 것으로 치지 않는다', () => {
    expect(prefersLowResMapTiles({ connection: { effectiveType: '4g', downlink: 0 } })).toBe(false)
  })
})

describe('② disableHD 는 SDK 약속 안에서 — 첫 지도보다 먼저', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_KAKAO_JAVASCRIPT_KEY', 'testkey123')
    delete (window as W).__urKakaoMaps
    delete (window as W).kakao
    document.head.querySelectorAll('script').forEach((s) => s.remove())
  })
  const setConn = (c: unknown) => Object.defineProperty(navigator, 'connection', { value: c, configurable: true })

  it('이른 약속 경로 — 느린 회선이면 resolve 전에 disableHD', async () => {
    setConn({ effectiveType: '3g' })
    const order: string[] = []
    ;(window as W).kakao = { maps: { disableHD: () => order.push('hd-off') } }
    ;(window as W).__urKakaoMaps = Promise.resolve()
    const { ensureKakaoMaps } = await import('@/lib/kakao-sdk')
    await ensureKakaoMaps().then(() => order.push('map'))
    expect(order).toEqual(['hd-off', 'map'])
  })
  it('정상 경로 — 느린 회선이면 resolve 전에 disableHD', async () => {
    setConn({ saveData: true })
    const order: string[] = []
    const { ensureKakaoMaps } = await import('@/lib/kakao-sdk')
    const p = ensureKakaoMaps().then(() => order.push('map'))
    await vi.waitFor(() => expect(document.head.querySelector('script[src*="dapi.kakao.com"]')).not.toBeNull())
    ;(window as W).kakao = { maps: { load: (cb: () => void) => cb(), disableHD: () => order.push('hd-off') } }
    document.head.querySelector('script[src*="dapi.kakao.com"]')!.dispatchEvent(new Event('load'))
    await p
    expect(order).toEqual(['hd-off', 'map'])
  })
  it('빠른 회선은 부르지 않는다', async () => {
    setConn({ effectiveType: '4g', downlink: 10 })
    const spy = vi.fn()
    ;(window as W).kakao = { maps: { disableHD: spy } }
    ;(window as W).__urKakaoMaps = Promise.resolve()
    const { ensureKakaoMaps } = await import('@/lib/kakao-sdk')
    await ensureKakaoMaps()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('④ 지도 화면은 SDK 래퍼를 정적으로', () => {
  it('useKakaoMap 에 동적 import 가 없다', () => {
    const s = stripComments(fs.readFileSync('src/pages/restaurant-map/useKakaoMap.ts', 'utf8'))
    // 2026-10-14 재조준: 지도 생성은 본체-준비 약속(`ensureKakaoMapsCore`)을 쓴다 — 불변식(정적 import)은 그대로.
    expect(s).toMatch(/^import \{ ensureKakaoMaps(?:Core)? \} from '@\/lib\/kakao-sdk'$/m)
    expect(s).not.toMatch(/import\(['"]@\/lib\/kakao-sdk['"]\)/)
  })
})
