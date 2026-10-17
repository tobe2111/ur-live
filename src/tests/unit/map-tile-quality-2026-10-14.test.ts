/**
 * 🗺️ 지도 타일 화질 — 언제나 고화질 〔2026-10-14 신설 → 2026-10-15 반전〕
 *
 * 2026-10-14 에 느린 회선에서만 `kakao.maps.disableHD()` 로 일반 화질 타일을 받게 했다가,
 * 2026-10-15 대표 *"화질은 줄일 수 없어"* → *"저화질도 되돌려줘"* 로 걷어냈다.
 * 이 시험은 ① 지도 코드 어디에서도 `disableHD` 를 부르지 않는지 ② 느린 회선·데이터 절약이어도
 * SDK 준비가 화질을 내리지 않는지(실제 실행) ③ 지도 화면이 SDK 래퍼를 동적 import 로 한 번 더
 * 기다리지 않는지 를 본다.
 *
 * 못 막는 것: 카카오가 기본 화질을 바꾸는 것(외부 계약) · 실제 타일 바이트(라이브 측정만 판정).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { stripComments } from '../helpers/source-text'

type W = Window & { __urKakaoMaps?: Promise<void>; kakao?: unknown }

describe('① 소스 어디에서도 disableHD 를 부르지 않는다', () => {
  it('src/ · index.html 실행 코드에 disableHD 호출 0', () => {
    const files = execFileSync('git', ['ls-files', 'src', 'index.html'], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => /\.(ts|tsx|js|mjs|html)$/.test(f) && !f.startsWith('src/tests/'))
    expect(files.length).toBeGreaterThan(500) // 목록이 비면 통과가 아니라 고장
    const hits = files.filter((f) => fs.existsSync(f) && /disableHD\s*\(/.test(stripComments(fs.readFileSync(f, 'utf8'))))
    expect(hits).toEqual([])
  })
  it('kakao-sdk 에서 회선 기반 화질 선택 함수가 사라졌다', () => {
    const s = stripComments(fs.readFileSync('src/lib/kakao-sdk.ts', 'utf8'))
    expect(s).not.toMatch(/prefersLowResMapTiles|applyTileQuality/)
  })
})

describe('② 느린 회선이어도 SDK 준비가 화질을 내리지 않는다', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_KAKAO_JAVASCRIPT_KEY', 'testkey123')
    delete (window as W).__urKakaoMaps
    delete (window as W).kakao
    document.head.querySelectorAll('script').forEach((s) => s.remove())
  })
  const setConn = (c: unknown) => Object.defineProperty(navigator, 'connection', { value: c, configurable: true })

  it('이른 약속 경로 — 데이터 절약 · 3G 여도 disableHD 를 안 부른다', async () => {
    setConn({ saveData: true, effectiveType: '3g', downlink: 0.5 })
    const spy = vi.fn()
    ;(window as W).kakao = { maps: { disableHD: spy } }
    ;(window as W).__urKakaoMaps = Promise.resolve()
    const { ensureKakaoMaps } = await import('@/lib/kakao-sdk')
    await ensureKakaoMaps()
    expect(spy).not.toHaveBeenCalled()
  })
  it('정상 경로 — 데이터 절약이어도 disableHD 를 안 부른다', async () => {
    setConn({ saveData: true })
    const spy = vi.fn()
    const { ensureKakaoMaps } = await import('@/lib/kakao-sdk')
    const p = ensureKakaoMaps()
    await vi.waitFor(() => expect(document.head.querySelector('script[src*="dapi.kakao.com"]')).not.toBeNull())
    ;(window as W).kakao = { maps: { load: (cb: () => void) => cb(), disableHD: spy } }
    document.head.querySelector('script[src*="dapi.kakao.com"]')!.dispatchEvent(new Event('load'))
    await p
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('③ 지도 화면은 SDK 래퍼를 정적으로', () => {
  it('useKakaoMap 에 동적 import 가 없다', () => {
    const s = stripComments(fs.readFileSync('src/pages/restaurant-map/useKakaoMap.ts', 'utf8'))
    // 2026-10-14 재조준: 지도 생성은 본체-준비 약속(`ensureKakaoMapsCore`)을 쓴다 — 불변식(정적 import)은 그대로.
    expect(s).toMatch(/^import \{ ensureKakaoMaps(?:Core)? \} from '@\/lib\/kakao-sdk'$/m)
    expect(s).not.toMatch(/import\(['"]@\/lib\/kakao-sdk['"]\)/)
  })
})
