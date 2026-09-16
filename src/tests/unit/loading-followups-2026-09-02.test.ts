/**
 * 🧭 로딩 후속 2건 (2026-09-02 대표 "모두 다 진행") — ① 실사용자 지표가 실제로 쌓이는가 ② 지도가 히어로와 경쟁하지 않는가.
 *
 * ## 실측이 가리킨 것
 *   - `/api/analytics/summary` 4일치: LCP 표본 **0**, TTFB 만 하루 1건. 원인 둘 — 서버 표본율 1% + 클라가 LCP 를
 *     `visibilitychange→hidden` 에서만 보내는데 카카오 인앱/사파리는 그 이벤트가 안 온다.
 *   - 클릭 프로브: 카카오 지도 SDK 0.28초 · 타일 1.3초 — 히어로 사진과 같은 순간. `rootMargin: 300px` 가 폰 첫 화면에서
 *     마운트 즉시 교차 판정이었다.
 *
 * ## 못 막는 것
 *   - 실제 표본이 쌓이는지(배포 뒤 `/api/analytics/summary?day=` 에 LCP 행이 생기는지로 판정).
 *   - idle 콜백의 실제 지연(브라우저 몫).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const code = (p: string) =>
  readFileSync(p, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

describe('① 실사용자 vitals 가 쌓인다', () => {
  it('서버 표본율이 0.2~0.5 사이다 (1% 는 하루 1건, 100% 는 KV 쓰기 낭비)', () => {
    const s = code('src/worker/routes/analytics.routes.ts')
    const m = s.match(/const VITALS_SAMPLE_RATE = ([0-9.]+)/)
    expect(m, 'VITALS_SAMPLE_RATE 를 못 찾았다').toBeTruthy()
    const rate = Number(m![1])
    expect(rate).toBeGreaterThanOrEqual(0.2)
    expect(rate).toBeLessThanOrEqual(0.5)
  })
  it('LCP 를 hidden 뿐 아니라 pagehide 와 10초 폴백으로도 보낸다 (한 번만)', () => {
    const s = code('src/lib/web-vitals-report.ts')
    const at = s.indexOf("type: 'largest-contentful-paint'")
    expect(at).toBeGreaterThan(0)
    const win = s.slice(at, at + 900)
    expect(win).toMatch(/addEventListener\('pagehide', flush, \{ once: true \}\)/)
    expect(win).toMatch(/setTimeout\(flush, 10000\)/)
    expect(win).toMatch(/if \(sent \|\| lcpValue <= 0\) return/)
    expect(win).toMatch(/send\('LCP', lcpValue, page\)/)
  })
})

describe('② 지도는 히어로 뒤에', () => {
  const s = code('src/components/RestaurantMiniMap.tsx')
  it('관측 여백이 150px 이하다 (300 은 폰 첫 화면에서 즉시 발화)', () => {
    const m = s.match(/rootMargin: '(\d+)px'/)
    expect(m).toBeTruthy()
    expect(Number(m![1])).toBeLessThanOrEqual(150)
  })
  it('교차해도 SDK 는 idle 에 부른다 (즉시 setShouldLoadSdk 금지)', () => {
    const at = s.indexOf('new IntersectionObserver(')
    const win = s.slice(at - 400, at + 500)
    expect(win).toMatch(/requestIdleCallback\(run, \{ timeout: 2500 \}\)/)
    expect(win).toMatch(/if \(e\.isIntersecting\) \{\s*arm\(\)/)
    expect(win).not.toMatch(/if \(e\.isIntersecting\) \{\s*setShouldLoadSdk\(true\)/)
  })
  it('lazy 자체는 그대로다 (스크롤 안 오면 SDK 0 fetch — 잠금표 보호 대상)', () => {
    expect(s).toMatch(/const \[shouldLoadSdk, setShouldLoadSdk\] = useState\(false\)/)
    expect(s).toMatch(/if \(!shouldLoadSdk\) return/)
  })
})
