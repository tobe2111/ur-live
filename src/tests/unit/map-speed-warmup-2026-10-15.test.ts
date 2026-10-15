/**
 * 🗺️ 지도 속도 — 홈에서 SDK 미리 데우기 · GTM 을 load 뒤로 〔2026-10-15〕
 *
 * 대표 *"지도 부분 다시 확인해봐 속도"*. 실측(느린 4G·CPU 4배):
 *   ① 홈 지도 알약 → 지도: 화면 코드 ~1.0초 뒤에야 sdk.js → kakao.js → services.js 가 **줄줄이** 출발해
 *      타일이 3.0~3.2초에 시작했다(세 파일 합쳐 ~38KB — 바이트가 아니라 왕복이 비용).
 *   ② `/map` 직접: GTM 153KB 가 5.0초에 출발 — 타일 다운로드(4.3~9초) 한복판에서 회선을 나눠 썼다.
 * 이 시험은 ① SDK 를 **load 뒤에만**, 데이터 절약이면 **안** 받는지 ② 알약을 누를 때 타일 호스트에
 *   crossorigin 없이 한 번만 연결하는지 ③ 알약이 그 둘을 실제로 배선했는지 ④ GTM 이 load 뒤로 갔는지 를 본다.
 *
 * 못 막는 것: 실제 체감 시간(라이브 측정만 판정) · 카카오가 SDK 를 바꾸는 것(외부 계약).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import { stripComments } from '../helpers/source-text'

const ensure = vi.fn(() => Promise.resolve())
vi.mock('@/lib/kakao-sdk', () => ({ ensureKakaoMaps: ensure }))

function setReadyState(v: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => v })
}
const setConn = (c: unknown) => Object.defineProperty(navigator, 'connection', { value: c, configurable: true })
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)) }

beforeEach(() => { vi.resetModules(); ensure.mockClear(); setConn(undefined) })
afterEach(() => { setReadyState('complete'); vi.useRealTimers() })

describe('① 홈이 다 뜬 뒤에만 SDK 를 받는다', () => {
  it('load 전에는 안 받고, load 뒤 한가할 때 받는다', async () => {
    setReadyState('loading')
    const { warmKakaoMapsAfterLoad } = await import('@/pages/mobile-home/map-warmup')
    warmKakaoMapsAfterLoad()
    await new Promise((r) => setTimeout(r, 400))
    expect(ensure).not.toHaveBeenCalled()
    setReadyState('complete')
    window.dispatchEvent(new Event('load'))
    await new Promise((r) => setTimeout(r, 400))
    await flush()
    expect(ensure).toHaveBeenCalledTimes(1)
  })
  it('데이터 절약 모드면 받지 않는다', async () => {
    setConn({ saveData: true })
    setReadyState('complete')
    const { warmKakaoMapsAfterLoad } = await import('@/pages/mobile-home/map-warmup')
    warmKakaoMapsAfterLoad()
    await new Promise((r) => setTimeout(r, 400))
    await flush()
    expect(ensure).not.toHaveBeenCalled()
  })
  it('홈을 떠나면(취소) 받지 않는다', async () => {
    setReadyState('loading')
    const { warmKakaoMapsAfterLoad } = await import('@/pages/mobile-home/map-warmup')
    warmKakaoMapsAfterLoad()()
    setReadyState('complete')
    window.dispatchEvent(new Event('load'))
    await new Promise((r) => setTimeout(r, 400))
    await flush()
    expect(ensure).not.toHaveBeenCalled()
  })
  it('SDK 모듈은 동적 import — 홈 첫 화면 묶음에 카카오 SDK 를 싣지 않는다', () => {
    const src = stripComments(fs.readFileSync('src/pages/mobile-home/map-warmup.ts', 'utf8'))
    expect(src).toMatch(/import\('@\/lib\/kakao-sdk'\)/)
    expect(src).not.toMatch(/^import[^\n]*['"]@\/lib\/kakao-sdk['"]/m)
  })
})

describe('② 누르는 순간 타일 호스트에 미리 연결', () => {
  it('crossorigin 없이 mts.kakaocdn.net 에 한 번만', async () => {
    document.head.querySelectorAll('link[rel="preconnect"]').forEach((l) => l.remove())
    const { preconnectMapTiles } = await import('@/pages/mobile-home/map-warmup')
    preconnectMapTiles(); preconnectMapTiles()
    const links = [...document.head.querySelectorAll('link[rel="preconnect"]')].filter((l) => (l as HTMLLinkElement).href.startsWith('https://mts.kakaocdn.net'))
    expect(links).toHaveLength(1)
    expect(links[0].hasAttribute('crossorigin')).toBe(false)
  })
})

describe('③ 지도 알약 배선', () => {
  const pill = stripComments(fs.readFileSync('src/pages/mobile-home/MapPill.tsx', 'utf8'))
  it('마운트 때 미리 데우기를 예약하고 취소 함수를 돌려준다', () => {
    expect(pill).toMatch(/useEffect\(\(\)\s*=>\s*warmKakaoMapsAfterLoad\(\),\s*\[\]\)/)
  })
  it('누르는 순간 타일 호스트 연결', () => {
    expect(pill).toMatch(/onPointerDown=\{preconnectMapTiles\}/)
  })
})

describe('④ GTM 은 load 뒤 — 지도 타일과 회선을 나눠 쓰지 않는다', () => {
  const main = stripComments(fs.readFileSync('src/main.tsx', 'utf8'))
  const gtm = main.slice(main.indexOf('const loadGTM'), main.indexOf('const loadGTM') + 900)
  it('loadGTM 블록을 찾았다(헛도는 가드 방지)', () => {
    expect(main.indexOf('const loadGTM')).toBeGreaterThan(0)
  })
  it('runAfterLoad 로 예약한다', () => {
    expect(gtm).toMatch(/runAfterLoad\(startGTM/)
  })
  it('requestIdleCallback 으로 바로 예약하지 않는다(부팅 중 빈틈에 끼어든다)', () => {
    expect(gtm).not.toMatch(/requestIdleCallback\(loadGTM/)
  })
  it('두 번 로드되지 않는다(백스톱과 경합)', () => {
    expect(gtm).toMatch(/if \(gtmStarted\) return/)
  })
})

describe('⑤ SDK 가 목록보다 먼저 와도 타일은 한 벌만', () => {
  const hook = stripComments(fs.readFileSync('src/pages/restaurant-map/useKakaoMap.ts', 'utf8'))
  const page = stripComments(fs.readFileSync('src/pages/RestaurantMapPage.tsx', 'utf8'))
  const init = hook.slice(hook.indexOf('const initMap = useCallback'), hook.indexOf('const initMap = useCallback') + 400)
  it('지도 생성은 첫 목록이 도착할 때까지 미룬다(이미 만든 지도엔 영향 없음)', () => {
    expect(init).toMatch(/if \(!mapInstance\.current && !dataReady && !createGateExpired\) return/)
  })
  it('목록이 영영 안 오면 4초 뒤 그냥 만든다(빈 회색 방지)', () => {
    expect(hook).toMatch(/setTimeout\(\(\) => setCreateGateExpired\(true\), 4000\)/)
  })
  it('initMap 이 그 두 값이 바뀔 때 다시 돈다', () => {
    expect(hook).toMatch(/serverClusters, dataReady, createGateExpired\]\)/)
  })
  it('지도 화면이 목록 로딩 상태를 넘긴다', () => {
    expect(page).toMatch(/dataReady: !loading/)
  })
})
