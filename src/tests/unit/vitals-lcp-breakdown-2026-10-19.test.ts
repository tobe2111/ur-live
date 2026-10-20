/**
 * 🔬 2026-10-19 — 실사용 LCP 를 넷으로 쪼개 남긴다 (대표 "개선 제안 … 가장 이상적으로").
 *
 * 왜: SLO 가 홈 LCP p75 3.5초(기준 2.5초)를 사흘째 경보하는데, 저장하는 것이 숫자 하나라 **어디를 고칠지**
 *   고를 근거가 없었다. 실험실(느린 4G·CPU 4배) 홈 LCP 는 1.2~1.4초라 실사용과 거리가 멀다.
 *
 * 지키는 것:
 *   ① 넷의 합 = LCP · 글자 LCP 는 사진 칸이 0 · 순서가 뒤집힌 값은 0 으로 자른다(음수 금지)
 *   ② 서버는 이상한 값을 버리고, 쪼개기 키(LCPB)는 SLO 판정 접두(`LCP:`)와 **안 섞인다**
 *   ③ 측정 정의 둘 — 미리 그려 둔 페이지는 연 순간부터 · 그려지기 전에 숨은 탭은 버린다
 *   ④ 경보가 그 화면의 쪼개기 한 줄을 붙인다
 * ⚠️ 못 보는 것: 실제 브라우저의 PerformanceObserver 값(jsdom 밖) · 표본이 모이기까지 며칠.
 */
import { describe, it, expect } from 'vitest'
import { lcpBreakdown } from '@/lib/web-vitals-report'
import { lcpPartsTuple, summarizeLcpParts, describeLcpParts } from '@/worker/utils/lcp-parts'
import { readCode } from '../helpers/source-text'

describe('① lcpBreakdown — 넷의 합이 LCP', () => {
  it('사진 LCP', () => {
    const b = lcpBreakdown(2500, 600, { requestStart: 1500, startTime: 1400, responseEnd: 2100 }, true)
    expect(b).toEqual({ ttfb: 600, lrd: 900, ld: 600, erd: 400, img: 1 })
    expect(b.ttfb + b.lrd + b.ld + b.erd).toBe(2500)
  })
  it('글자 LCP — 사진 칸은 0', () => {
    const b = lcpBreakdown(1800, 500, null, false)
    expect(b).toEqual({ ttfb: 500, lrd: 0, ld: 0, erd: 1300, img: 0 })
  })
  it('캐시에서 온 사진(시작이 첫 바이트보다 앞) — 음수가 안 나온다', () => {
    const b = lcpBreakdown(1000, 700, { requestStart: 0, startTime: 0, responseEnd: 50 }, true)
    for (const v of [b.ttfb, b.lrd, b.ld, b.erd]) expect(v).toBeGreaterThanOrEqual(0)
    expect(b.ttfb + b.lrd + b.ld + b.erd).toBe(1000)
  })
})

describe('② 서버 — 검증 · 요약 · 키 분리', () => {
  it('이상한 값은 버린다', () => {
    expect(lcpPartsTuple({ ttfb: 1, lrd: 2, ld: 3, erd: 4, img: 1 })).toEqual([1, 2, 3, 4, 1])
    expect(lcpPartsTuple({ ttfb: -1, lrd: 2, ld: 3, erd: 4 })).toBeNull()
    expect(lcpPartsTuple({ ttfb: 'x', lrd: 2, ld: 3, erd: 4 })).toBeNull()
    expect(lcpPartsTuple(null)).toBeNull()
  })
  it('요약은 부분별 p75 와 사진 비율', () => {
    const rows = [[100, 0, 0, 900, 0], [200, 300, 400, 100, 1], [300, 600, 800, 200, 1], [400, 900, 1200, 300, 1]]
    const s = summarizeLcpParts(rows)!
    expect(s).toMatchObject({ ttfb: 400, lrd: 900, ld: 1200, samples: 4, imgShare: 0.75 })
    expect(describeLcpParts(s)).toContain('사진 받기 1200')
    expect(summarizeLcpParts([])).toBeNull()
  })
  it('쪼개기 키는 LCPB — SLO 판정이 읽는 `{날}:LCP:` 접두에 안 걸린다', () => {
    const route = readCode('src/worker/routes/analytics.routes.ts')
    expect(route).toMatch(/`vitals:\$\{day\}:LCPB:\$\{page\}`/)
    expect('vitals:2026-10-19:LCPB:/'.startsWith('vitals:2026-10-19:LCP:')).toBe(false)
    // 데이터센터 표본에는 붙이지 않는다
    expect(route).toMatch(/body\.name === 'LCP' && !coloM/)
  })
})

describe('③ 측정 정의', () => {
  const src = readCode('src/lib/web-vitals-report.ts')
  it('미리 그려 둔(prerender) 페이지는 연 순간(activationStart)부터 잰다', () => {
    expect(src).toMatch(/lcpValue - activation/)
  })
  it('그려지기 전에 숨은 탭의 LCP 는 버린다', () => {
    expect(src).toMatch(/if \(hiddenAt <= lcpValue\) return/)
  })
  it('쪼개기는 LCP 와 같은 보고에 실린다(따로 보내면 표본이 따로 뽑혀 합이 안 맞는다)', () => {
    expect(src).toMatch(/send\('LCP', lcp, page, parts \? \{ parts \} : undefined\)/)
  })
})

describe('④ 경보가 쪼개기를 붙인다', () => {
  it('LCP 위반 줄 아래에 그 화면의 쪼개기 한 줄', () => {
    const cron = readCode('src/worker/cron/vitals-slo.ts')
    expect(cron).toMatch(/f\.metric !== 'LCP'/)
    expect(cron).toMatch(/lcpPartsLine\(kv, nowMs, f\.page\)/)
  })
})
