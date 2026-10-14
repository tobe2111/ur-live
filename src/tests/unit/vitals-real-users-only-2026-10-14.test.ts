/**
 * 🌏 실사용자 성능 지표에 **우리 측정 트래픽이 섞이지 않는다** 〔2026-10-14〕
 *
 * ## 무엇이 틀렸나
 * 어드민 속도 기록의 `LCP:/map` 이 5.5~10.9초였다. 같은 날 데이터센터별 표본을 보니 **전부 미국**
 * (EWR 8 · IAD 4 · ORD · ATL · DFW)이고 한국(ICN)은 0 이었다. 서비스는 한국 전용이다 —
 * 그 표본은 우리가 라이브를 재려고 미국 컨테이너에서 띄운 헤드리스 브라우저였고, 카카오 지도 타일이
 * 한국 CDN 이라 미국에서 받느라 느렸다. 그 숫자를 믿었으면 한국 사용자에겐 없을 수도 있는 병을 고쳤다.
 *
 * ## 두 겹
 * - 브라우저: `navigator.webdriver === true`(자동화 표준 표식)면 보내지 않는다 — 성능·퍼널 둘 다.
 * - 서버: `cf-ipcountry` 가 KR 이 아니면 성능 표본을 버린다. 헤더가 없으면 막지 않는다(판정 근거 없음).
 *
 * ## 못 막는 것
 * - 한국 IP 에서 돌린 자동화가 webdriver 표식을 숨기면 섞인다.
 * - 이미 쌓인 옛 표본은 그대로다(날짜가 바뀌면 빠진다).
 * - 퍼널(view/click/join/success)은 국가로 거르지 않는다 — 구매 이벤트는 해외 결제자도 실제 사람일 수 있다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const blobs: Blob[] = []

function setWebdriver(v: boolean) {
  Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => v })
}

beforeEach(() => {
  vi.resetModules()
  blobs.length = 0
  class FakePO { observe() {} disconnect() {} }
  vi.stubGlobal('PerformanceObserver', FakePO)
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: (_u: string, b: Blob) => { blobs.push(b); return true },
  })
  ;(window.location as { pathname: string }).pathname = '/map'
})
afterEach(() => { setWebdriver(false); vi.unstubAllGlobals() })

describe('① 자동화 브라우저는 보고하지 않는다', () => {
  it('webdriver 면 성능 표본을 한 건도 안 보낸다', async () => {
    setWebdriver(true)
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { requestStart: 10, responseStart: 50, connectEnd: 5, serverTiming: [] } as unknown as PerformanceEntry,
    ])
    const m = await import('@/lib/web-vitals-report')
    m.reportWebVitals()
    expect(blobs.length).toBe(0)
  })
  it('사람 브라우저는 그대로 보낸다(반대 방향 — 필터가 전부를 막지 않는다)', async () => {
    setWebdriver(false)
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { requestStart: 10, responseStart: 50, connectEnd: 5, serverTiming: [] } as unknown as PerformanceEntry,
    ])
    const m = await import('@/lib/web-vitals-report')
    m.reportWebVitals()
    expect(blobs.length).toBeGreaterThan(0)
  })
  it('webdriver 면 퍼널도 안 보낸다', async () => {
    setWebdriver(true)
    const m = await import('@/lib/web-vitals-report')
    m.reportFunnel('view', 1)
    expect(blobs.length).toBe(0)
    setWebdriver(false)
    m.reportFunnel('view', 1)
    expect(blobs.length).toBe(1)
  })
})

describe('② 서버는 한국 요청만 성능 표본으로 받는다', () => {
  it('국가 판정', async () => {
    const { isVitalsCountryAllowed } = await import('@/worker/routes/analytics.routes')
    expect(isVitalsCountryAllowed('KR')).toBe(true)
    expect(isVitalsCountryAllowed('kr')).toBe(true)
    expect(isVitalsCountryAllowed(undefined)).toBe(true)
    expect(isVitalsCountryAllowed('')).toBe(true)
    expect(isVitalsCountryAllowed('US')).toBe(false)
    expect(isVitalsCountryAllowed('JP')).toBe(false)
    expect(isVitalsCountryAllowed('XX')).toBe(false)
  })

  async function post(country: string | null) {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const puts: string[] = []
    const kv = {
      get: async () => null,
      put: async (k: string) => { puts.push(k) },
    }
    const { analyticsRoutes } = await import('@/worker/routes/analytics.routes')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (country) headers['cf-ipcountry'] = country
    const res = await analyticsRoutes.request('/vitals', {
      method: 'POST', headers, body: JSON.stringify({ name: 'LCP', value: 10948, page: '/map' }),
    }, { ANALYTICS_KV: kv } as never)
    return { body: await res.json() as Record<string, unknown>, puts }
  }

  it('미국에서 온 표본은 저장하지 않는다', async () => {
    const r = await post('US')
    expect(r.body.skipped).toBe('country')
    expect(r.puts.length).toBe(0)
  })
  it('한국에서 온 표본은 저장한다', async () => {
    const r = await post('KR')
    expect(r.body.ok).toBe(true)
    expect(r.puts.some((k) => k.startsWith('vitals:') && k.endsWith(':LCP:/map'))).toBe(true)
  })
  it('국가 헤더가 없으면 막지 않는다', async () => {
    const r = await post(null)
    expect(r.puts.some((k) => k.endsWith(':LCP:/map'))).toBe(true)
  })
})
