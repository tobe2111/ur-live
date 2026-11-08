/**
 * 🧭 2026-11-08 대표 *"1~5 모두 진행"* — 2번: 첫 응답(TTFB)을 **서버 몫(SRV)** 과 **회선 몫(TTFB−SRV)** 으로 나눠 남긴다.
 *   실사용 표본이 하루 1~4건뿐이라 "느리다" 가 서버 탓인지 한국 밖 콜로 왕복 탓인지 갈리지 않았다.
 *   워커가 HTML 에 `Server-Timing: total;dur=N` 을 이미 싣는다 — 그 값을 같은 표본 저장소에 `SRV` 로 보낸다.
 * ⚠️ 못 보는 것: 표본 수(한국 방문량) — 그건 날이 지나야 쌓인다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'

const sent: Array<{ name: string; value: number; page: string }> = []
beforeEach(() => {
  vi.resetModules(); sent.length = 0
  class FakePO { observe() {} disconnect() {} }
  vi.stubGlobal('PerformanceObserver', FakePO)
  Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false })
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: (_u: string, b: Blob) => { void b.text().then((t) => sent.push(JSON.parse(t))); return true },
  })
  ;(window.location as { pathname: string }).pathname = '/'
})
afterEach(() => vi.unstubAllGlobals())

describe('SRV — 서버 몫', () => {
  it('Server-Timing total 을 SRV 로 보낸다(같은 페이지 키)', async () => {
    vi.spyOn(performance, 'getEntriesByType').mockImplementation((t: string) => t === 'navigation'
      ? [{ requestStart: 10, responseStart: 410, connectEnd: 5, serverTiming: [{ name: 'total', duration: 21, description: '' }, { name: 'colo', duration: 0, description: 'HKG' }] } as unknown as PerformanceEntry]
      : [])
    const m = await import('@/lib/web-vitals-report')
    m.reportWebVitals()
    await new Promise((r) => setTimeout(r, 0))
    expect(sent.find((x) => x.name === 'SRV')).toMatchObject({ value: 21, page: '/' })
    expect(sent.find((x) => x.name === 'TTFB' && x.page === '/')).toMatchObject({ value: 400 })
  })
  it('total 이 없으면 보내지 않는다(0 으로 위장 금지)', async () => {
    vi.spyOn(performance, 'getEntriesByType').mockImplementation((t: string) => t === 'navigation'
      ? [{ requestStart: 10, responseStart: 50, connectEnd: 5, serverTiming: [] } as unknown as PerformanceEntry] : [])
    const m = await import('@/lib/web-vitals-report')
    m.reportWebVitals()
    await new Promise((r) => setTimeout(r, 0))
    expect(sent.some((x) => x.name === 'SRV')).toBe(false)
  })
  it('서버가 SRV 를 받고 요약에 싣는다', () => {
    const src = readFileSync('src/worker/routes/analytics.routes.ts', 'utf8')
    expect(src.match(/\['LCP', 'FID', 'CLS', 'INP', 'TTFB', 'CONN', 'D1', 'SRV'\]/g)?.length).toBe(2)
  })
})
