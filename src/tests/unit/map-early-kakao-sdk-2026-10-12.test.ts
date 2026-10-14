/**
 * 🗺️ 지도(/map) 하드로드 — 카카오 지도 SDK 를 HTML 도착 직후 출발시킨다 (2026-10-12 대표 *"처음 접속하는
 * 디바이스 유저는 너무 느려"* · *"대기업급 속도"*).
 *
 * 배경(라이브 녹화 재생 · 느린 4G · CPU 4배): 지도의 가장 큰 그림은 **지도 타일**인데, 그 앞이 전부 직렬이었다 —
 *   [앱 부팅 → 지도 청크 → sdk.js(5.2s) → kakao.js → 타일(7.9s~)] ⇒ LCP 12초.
 * index.html 의 인라인 스크립트가 sdk.js 를 0.25초에 출발시키고, `lib/kakao-sdk.ts` 가 그 약속을 이어받는다.
 *
 * 이 테스트가 고정하는 것:
 *   ① 인라인 스크립트를 **실제로 돌려서** /map 에서만 출발하고 다른 경로에선 아무것도 안 하는가
 *   ② 키가 비었거나 빌드 치환이 안 됐으면(`%VITE_…%`) 출발하지 않는가 — 잘못된 키로 요청하면 401 만 받는다
 *   ③ 실패하면 자기 <script> 를 지우고 거절하는가 — 안 지우면 정상 경로가 그 죽은 태그를 "로드 중"으로 재사용해 영영 멈춘다
 *   ④ preconnect 는 crossorigin 없이 실제 호스트(kakaocdn)로 — no-cors 스크립트·이미지는 그 풀만 쓴다
 *   ⑤ ensureKakaoMaps 가 이른 약속을 이어받고, 거절되면 정상 경로로 다시 시도하는가
 *
 * ⚠️ 못 막는 것: 실제 체감 시간(브라우저 실측 — 배포 후 E4) · 카카오가 SDK 주소를 바꾸는 것(외부 계약).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

const HTML = readFileSync('index.html', 'utf8')
const SCRIPT = (() => {
  const m = HTML.match(/<script>(\(function\(\)\{if\(!\/\^\\\/map[\s\S]*?)<\/script>/)
  return m ? m[1] : ''
})()

type W = { __urKakaoMaps?: Promise<void>; kakao?: unknown }
function run(path: string, key = 'testkey123') {
  const doc = document.implementation.createHTMLDocument('t')
  const win: W & { location: { pathname: string } } = { location: { pathname: path } }
  const js = SCRIPT.replace('%VITE_KAKAO_JAVASCRIPT_KEY%', key)
  // eslint-disable-next-line no-new-func
  new Function('document', 'location', 'window', js)(doc, win.location, win)
  const script = doc.head.querySelector('script') as HTMLScriptElement | null
  const pre = [...doc.head.querySelectorAll('link[rel="preconnect"]')] as HTMLLinkElement[]
  return { doc, win, script, pre }
}

describe('index.html 지도 SDK 조기 출발', () => {
  it('스크립트가 index.html 에 있다(0건이면 아래 시험이 전부 헛돈다)', () => {
    expect(SCRIPT.length).toBeGreaterThan(200)
    // <head> 맨 앞쪽 — 스타일시트보다 앞이어야 CSS 를 기다리지 않고 바로 돈다
    expect(HTML.indexOf('__urKakaoMaps')).toBeLessThan(HTML.indexOf('rel="stylesheet"'))
  })

  it('① /map 에서만 출발한다', () => {
    const a = run('/map')
    expect(a.script?.src).toMatch(/^https:\/\/dapi\.kakao\.com\/v2\/maps\/sdk\.js\?appkey=testkey123&autoload=false&libraries=services$/)
    expect(a.script?.async).toBe(true)
    expect(a.win.__urKakaoMaps).toBeInstanceOf(Promise)
    expect(run('/map/').script).not.toBeNull()
    for (const p of ['/', '/vouchers', '/pass/1', '/map/x', '/mapx', '/u/map']) {
      const r = run(p)
      expect(r.script, p).toBeNull()
      expect(r.pre.length, p).toBe(0)
      expect(r.win.__urKakaoMaps, p).toBeUndefined()
    }
  })

  it('② 키가 비었거나 치환이 안 됐으면 출발하지 않는다', () => {
    expect(run('/map', '').script).toBeNull()
    expect(run('/map', '%VITE_KAKAO_JAVASCRIPT_KEY%').script).toBeNull()
  })

  it('③ 실패하면 자기 태그를 지우고 거절한다', async () => {
    const e = run('/map')
    e.script!.onerror!(new Event('error'))
    await expect(e.win.__urKakaoMaps).rejects.toThrow()
    expect(e.doc.head.querySelector('script')).toBeNull()

    const m = run('/map') // 로드는 됐는데 kakao.maps 가 없다
    m.script!.onload!(new Event('load'))
    await expect(m.win.__urKakaoMaps).rejects.toThrow()
    expect(m.doc.head.querySelector('script')).toBeNull()
  })

  it('③-2 성공하면 kakao.maps.load 를 거쳐 풀린다', async () => {
    const r = run('/map')
    const load = vi.fn((cb: () => void) => cb())
    r.win.kakao = { maps: { load } }
    r.script!.onload!(new Event('load'))
    await expect(r.win.__urKakaoMaps).resolves.toBeUndefined()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('④ preconnect — crossorigin 없이 실제 쓰는 호스트로', () => {
    const { pre } = run('/map')
    expect(pre.map((l) => l.href).sort()).toEqual(['https://dapi.kakao.com/', 'https://mts.kakaocdn.net/', 'https://t1.kakaocdn.net/'])
    for (const l of pre) expect(l.hasAttribute('crossorigin')).toBe(false)
  })
})

describe('⑤ ensureKakaoMaps 가 이른 약속을 이어받는다', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_KAKAO_JAVASCRIPT_KEY', 'testkey123')
    delete (window as W).__urKakaoMaps
    delete (window as W).kakao
    document.head.querySelectorAll('script').forEach((s) => s.remove())
  })

  it('이른 약속이 있으면 새 <script> 를 만들지 않는다', async () => {
    ;(window as W).__urKakaoMaps = Promise.resolve()
    const { ensureKakaoMaps } = await import('@/lib/kakao-sdk')
    await ensureKakaoMaps()
    expect(document.head.querySelectorAll('script[src*="dapi.kakao.com"]').length).toBe(0)
    expect((window as W).__urKakaoMaps).toBeUndefined() // 한 번만 이어받는다
  })

  it('이른 약속이 거절되면 정상 경로로 다시 시도한다', async () => {
    ;(window as W).__urKakaoMaps = Promise.reject(new Error('x'))
    const { ensureKakaoMaps } = await import('@/lib/kakao-sdk')
    const p = ensureKakaoMaps()
    await vi.waitFor(() => expect(document.head.querySelectorAll('script[src*="dapi.kakao.com"]').length).toBe(1))
    const s = document.head.querySelector('script[src*="dapi.kakao.com"]') as HTMLScriptElement
    ;(window as W).kakao = { maps: { load: (cb: () => void) => cb() } }
    s.dispatchEvent(new Event('load'))
    await expect(p).resolves.toBeUndefined()
  })
})
