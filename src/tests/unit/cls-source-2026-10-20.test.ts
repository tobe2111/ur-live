/**
 * 🔬 CLS 원인 표본(2026-10-20) — 실사용 홈 CLS p75 0.20 이 실험실에서 재현되지 않아,
 *   무엇이 밀렸는지를 실사용 표본으로 남긴다. 수집 · 검증 · 경보가 같은 모듈(`shared/cls-source`)을 쓴다.
 *
 * ⚠️ 이 시험이 못 보는 것: 실제 브라우저가 `sources` 를 채우는지(사파리는 layout-shift 자체가 없다) ·
 *   KV 쓰기 · 경보가 실제로 그 줄을 싣는지(cron 런타임).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { clsSourceString, describeNode, sanitizeClsSource, topClsSources, describeClsSources, CLS_SOURCE_MIN } from '@/shared/cls-source'
import { readCode } from '../helpers/source-text'

document.body.innerHTML = '<div id="p" class="ur-home-panel flex gap-8 items-start">대표 이름 홍길동</div>'
const el = document.getElementById('p')!

describe('CLS 원인 문자열', () => {
  it('요소 이름 · 위치 · 시각 · 화면 폭을 담는다', () => {
    const s = clsSourceString([{ node: el, previousRect: { y: 1090, height: 90 }, currentRect: { y: 0, height: 0 } }], 1980.4, 390)
    expect(s).toBe('div#p.ur-home-panel.flex|y1090→0|h90→0|t1980|w390')
  })
  it('2026-10-24 — 요소 폭 전후 · 스크롤 위치를 덧붙인다(폭이 줄어 밀렸나 vs 위가 접혔나)', () => {
    const s = clsSourceString([{ node: el, previousRect: { y: 114, height: 248, width: 300 }, currentRect: { y: 0, height: 243, width: 294 } }], 6891, 1920, 1302.6)
    expect(s).toBe('div#p.ur-home-panel.flex|y114→0|h248→243|t6891|w1920|W300→294|s1303')
    expect(sanitizeClsSource(s)).toBe(s)
  })
  it('화면 글자(사용자 데이터)를 담지 않는다', () => {
    const s = clsSourceString([{ node: el, previousRect: { y: 1, height: 1 }, currentRect: { y: 2, height: 1 } }], 1, 390)
    expect(s).not.toContain('홍길동')
    expect(describeNode(el)).toBe('div#p.ur-home-panel.flex')
  })
  it('요소가 없는 표본은 빈 문자열', () => {
    expect(clsSourceString([], 1, 390)).toBe('')
    expect(clsSourceString(undefined, 1, 390)).toBe('')
  })
  it('서버 검증 — 길이·글자 밖이면 버린다', () => {
    expect(sanitizeClsSource('div.a|y1→2|h1→1|t1|w390')).toBe('div.a|y1→2|h1→1|t1|w390')
    expect(sanitizeClsSource('<script>alert(1)</script>')).toBe('')
    expect(sanitizeClsSource('div 홍길동')).toBe('')
    expect(sanitizeClsSource(123)).toBe('')
    expect(sanitizeClsSource('a'.repeat(500)).length).toBeLessThanOrEqual(180)
  })
  it('자주 나온 요소 순으로 묶는다(위치·시각 무시)', () => {
    const rows = ['div.a|y1→2|t1|w390', 'div.b|y5→9|t2|w390', 'div.a|y3→4|t3|w412', 'div.a|y8→9|t4|w390']
    const top = topClsSources(rows)
    expect(top[0]).toMatchObject({ el: 'div.a', count: 3 })
    expect(top[1]).toMatchObject({ el: 'div.b', count: 1 })
    expect(describeClsSources(rows)).toContain('div.a ×3')
    expect(describeClsSources([])).toBe('')
  })
})

describe('배선', () => {
  it('클라가 가장 큰 밀림의 원인을 큰 표본에만 싣는다', () => {
    const src = readCode('src/lib/web-vitals-report.ts')
    expect(src).toMatch(/clsSourceString\(e\.sources/)
    expect(src).toMatch(/clsSourceString\(e\.sources, e\.startTime, window\.innerWidth, window\.scrollY\)/)
    expect(src).toMatch(/v >= CLS_SOURCE_MIN && worstSrc \? \{ src: worstSrc \}/)
    expect(CLS_SOURCE_MIN).toBeGreaterThanOrEqual(50)
  })
  it('서버가 검증 뒤 CLSS 키에만 저장한다(SLO 판정 키와 안 섞인다)', () => {
    const src = readCode('src/worker/routes/analytics.routes.ts')
    expect(src).toMatch(/sanitizeClsSource\(body\.src\)/)
    expect(src).toMatch(/vitals:\$\{day\}:CLSS:\$\{page\}/)
    expect(src).toMatch(/body\.value >= CLS_SOURCE_MIN/)
    expect('vitals:d:CLSS:/'.startsWith('vitals:d:CLS:')).toBe(false)
  })
  it('CLS 경보가 원인 줄을 함께 싣는다', () => {
    const src = readCode('src/worker/cron/vitals-slo.ts')
    expect(src).toMatch(/f\.metric === 'CLS'[\s\S]{0,120}clsSourcesLine/)
    expect(readFileSync('src/worker/cron/vitals-slo.ts', 'utf8')).toContain(':CLSS:')
  })
})
