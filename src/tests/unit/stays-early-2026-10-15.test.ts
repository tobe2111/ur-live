/**
 * 🏨 숙소 목록 첫 검색을 HTML 도착 직후 보낸다 (2026-10-15 — 라이브 실측 3.4초 출발 · LCP ~7초).
 * 고정: ① index.html 인라인 스크립트를 **실제로 돌려** 만든 주소가 화면의 기본 질의와 바이트 일치
 *       ② 한국 시간 날짜(UTC 자정~오전 9시에도 오늘) ③ 한 번만 이어받는다 ④ 훅·페이지 배선.
 * ⚠️ 못 막는 것: 실제 ms(라이브) · 서버 응답 모양 변화(그때는 일반 경로로 다시 받는다).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { kstYmd, defaultStaysQs, takeStaysEarly } from '@/shared/stays-early'
import { stripComments } from '../helpers/source-text'

const html = readFileSync('index.html', 'utf8')
const inline = (() => {
  const m = html.match(/<script>\(function\(\)\{if\(!\/\^\\\/stays[\s\S]*?<\/script>/)
  return m ? m[0].replace(/^<script>/, '').replace(/<\/script>$/, '') : ''
})()

function runInline(pathname: string, search: string, now: number) {
  const calls: string[] = []
  const win: Record<string, unknown> = { fetch: (u: string) => { calls.push(u); return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) }) }, Promise }
  const RealDate = Date
  class FakeDate extends RealDate { constructor(v?: number) { super(v ?? now) } static now() { return now } }
  // eslint-disable-next-line no-new-func
  new Function('window', 'location', 'fetch', 'Date', inline)(win, { pathname, search }, win.fetch, FakeDate)
  return { calls, early: win.__urStaysEarly as { qs: string } | undefined }
}

afterEach(() => { (window as unknown as { __urStaysEarly?: unknown }).__urStaysEarly = undefined })

describe('숙소 첫 검색 조기 출발', () => {
  it('인라인 스크립트가 있다', () => { expect(inline.length).toBeGreaterThan(100) })
  it('인라인 주소 = 화면 기본 질의(바이트 일치) — 여러 시각에서', () => {
    for (const iso of ['2026-10-15T00:30:00Z', '2026-10-15T16:00:00Z', '2026-10-14T23:59:00Z']) {
      const now = Date.parse(iso)
      const { calls, early } = runInline('/stays', '', now)
      expect(early?.qs).toBe(defaultStaysQs(now))
      expect(calls).toEqual([`/api/group-buy/stays/search?${defaultStaysQs(now)}`])
    }
  })
  it('쿼리가 붙거나 다른 경로면 보내지 않는다', () => {
    expect(runInline('/stays', '?region=부산', Date.now()).calls).toEqual([])
    expect(runInline('/stays/12', '', Date.now()).calls).toEqual([])
    expect(runInline('/', '', Date.now()).calls).toEqual([])
  })
  it('날짜는 한국 시간 — UTC 15:00(한국 자정 지남)이면 다음 날', () => {
    const now = Date.parse('2026-10-15T15:30:00Z')
    expect(kstYmd(0, now)).toBe('2026-10-16')
    expect(kstYmd(1, now)).toBe('2026-10-17')
  })
  it('한 번만, 같은 주소일 때만 이어받는다', () => {
    const p = Promise.resolve(1)
    ;(window as unknown as { __urStaysEarly?: unknown }).__urStaysEarly = { qs: 'a', p }
    expect(takeStaysEarly('b')).toBeNull()
    expect(takeStaysEarly('a')).toBe(p)
    expect(takeStaysEarly('a')).toBeNull()
  })
  it('훅이 이어받고 실패하면 일반 경로로 / 페이지는 한국 시간', () => {
    const hook = stripComments(readFileSync('src/hooks/queries/useStaysSearch.ts', 'utf8'))
    expect(hook).toMatch(/const early = takeStaysEarly\(qs\)/)
    expect(hook).toMatch(/\.catch\(viaApi\)/)
    const page = stripComments(readFileSync('src/pages/StaysSearchPage.tsx', 'utf8'))
    expect(page).toMatch(/function todayIso\(\) \{ return kstYmd\(0\) \}/)
    expect(page).not.toMatch(/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/)
  })
})
