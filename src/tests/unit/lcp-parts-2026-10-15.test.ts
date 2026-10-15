/**
 * 🔬 LCP 구간 분해 (2026-10-15) — 가드.
 *
 * LCP 숫자 하나로는 무엇을 고칠지 모른다. 실사용 폰에서 [첫 바이트 · 사진 발견 지연 · 사진 받기 · 그리기]
 * 네 구간을 재서 보낸다. 지키는 것:
 *   ① 네 구간의 합 = LCP(구간이 서로 겹치거나 빈틈이 생기면 어느 구간이 늦은지 거짓말을 한다)
 *   ② 글자가 LCP 면 사진 구간은 0
 *   ③ 교차 출처라 requestStart 가 0 이어도 startTime 으로 잰다(0 이면 발견 지연이 음수가 된다)
 *   ④ 서버는 합이 안 맞거나 음수인 표본을 **전부** 버린다(한 구간만 저장하면 표본끼리 섞여 숫자가 무의미해진다)
 *   ⑤ 클라가 실제로 보내고, 서버가 실제로 저장하고, summary 가 실제로 보여준다(배선 셋 — 하나라도 빠지면 조용히 0건)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { lcpParts } from '@/lib/web-vitals-report'
import { lcpPartSamples, LCP_PART_NAMES } from '@/worker/routes/analytics.routes'

const sum = (p: { ttfb: number; delay: number; load: number; render: number }) => p.ttfb + p.delay + p.load + p.render

describe('🔬 lcpParts — 구간 나누기', () => {
  it('① 사진 LCP — 네 구간의 합이 LCP 이고 각 구간이 맞는 자리에 간다', () => {
    const p = lcpParts(2400, 600, { startTime: 900, requestStart: 950, responseEnd: 1800 })
    expect(p).toEqual({ ttfb: 600, delay: 350, load: 850, render: 600 })
    expect(sum(p)).toBe(2400)
  })

  it('② 글자 LCP — 사진 구간 0, 첫 바이트 뒤는 전부 그리기', () => {
    const p = lcpParts(1500, 400, null)
    expect(p).toEqual({ ttfb: 400, delay: 0, load: 0, render: 1100 })
  })

  it('③ 교차 출처(requestStart 0)는 startTime 으로', () => {
    const p = lcpParts(2000, 500, { startTime: 700, requestStart: 0, responseEnd: 1200 })
    expect(p.delay).toBe(200)
    expect(p.load).toBe(500)
    expect(sum(p)).toBe(2000)
  })

  it('미리받기로 첫 바이트보다 먼저 시작한 사진은 발견 지연 0(음수 금지)', () => {
    const p = lcpParts(1800, 500, { startTime: 300, requestStart: 320, responseEnd: 900 })
    expect(p.delay).toBe(0)
    expect(Object.values(p).every((v) => v >= 0)).toBe(true)
    expect(sum(p)).toBe(1800)
  })

  it('이상한 시각(LCP 뒤에 끝난 사진)도 합이 LCP 를 넘지 않는다', () => {
    const p = lcpParts(1000, 300, { startTime: 400, requestStart: 400, responseEnd: 5000 })
    expect(sum(p)).toBe(1000)
    expect(Object.values(p).every((v) => v >= 0)).toBe(true)
  })
})

describe('🔬 서버 — 표본 검증', () => {
  it('④ 맞는 표본은 네 이름으로 저장한다', () => {
    expect(lcpPartSamples(2400, { ttfb: 600, delay: 350, load: 850, render: 600 }))
      .toEqual([['LCP_TTFB', 600], ['LCP_DELAY', 350], ['LCP_LOAD', 850], ['LCP_RENDER', 600]])
  })
  it('④ 합이 안 맞거나 음수·누락이면 전부 버린다', () => {
    expect(lcpPartSamples(2400, { ttfb: 600, delay: 350, load: 850, render: 100 })).toEqual([])
    expect(lcpPartSamples(2400, { ttfb: -1, delay: 951, load: 850, render: 600 })).toEqual([])
    expect(lcpPartSamples(2400, { ttfb: 600, delay: 350, load: 850 })).toEqual([])
    expect(lcpPartSamples(2400, undefined)).toEqual([])
  })
})

describe('🔬 배선', () => {
  it('SRV(워커 문서 생성 시간)를 보내고 서버가 받는다 — 첫 바이트를 서버·거리로 가른다', () => {
    const c = readFileSync('src/lib/web-vitals-report.ts', 'utf8')
    const sv = readFileSync('src/worker/routes/analytics.routes.ts', 'utf8')
    expect(c).toMatch(/find\(\(t\) => t\.name === 'total'\)\?\.duration/)
    expect(c).toMatch(/send\('SRV', srv, page\)/)
    expect(sv).toMatch(/const validNames = \[[^\]]*'SRV'/)
  })
  const client = readFileSync('src/lib/web-vitals-report.ts', 'utf8')
  const server = readFileSync('src/worker/routes/analytics.routes.ts', 'utf8')
  it('⑤ 클라가 LCP 와 함께 구간을 보낸다', () => {
    expect(client).toMatch(/send\('LCP', lcpValue, page, parts\)/)
    expect(client).toMatch(/parts = lcpParts\(lcpValue, nav\.responseStart/)
  })
  it('⑤ 서버가 LCP 표본과 같은 결정으로 구간을 저장한다', () => {
    expect(server).toMatch(/for \(const \[n, v\] of lcpPartSamples\(body\.value, body\.parts\)\) await appendSample\(kv, `vitals:\$\{day\}:\$\{n\}:\$\{page\}`, v\)/)
  })
  it('⑤ summary 가 구간을 보여준다', () => {
    expect(server).toMatch(/'SRV', \.\.\.LCP_PART_NAMES\]\) \{/)
    expect(LCP_PART_NAMES).toEqual(['LCP_TTFB', 'LCP_DELAY', 'LCP_LOAD', 'LCP_RENDER'])
  })
})
