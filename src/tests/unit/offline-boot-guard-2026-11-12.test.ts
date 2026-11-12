/**
 * 📵 오프라인에서 부트 가드가 새로고침·복구 화면·캐시 삭제를 하지 않는다 (2026-11-12)
 *
 * 재방문 즉시 표시(shell-sw) 저장본은 신호 없이도 뜬다. 그런데 부품 하나만 못 받아도 `index.html` 부트 가드가
 * '새 배포' 로 읽고 `?__cb=` 로 새로고침해 — 쿼리 주소는 SW 가 안 다루므로 — **브라우저 오류 화면**이 됐다(라이브 실측).
 * 지키는 것: 오프라인이면 ① 청크 실패에 새로고침 0 · 예산 0 ② 12초 복구 화면을 덮지 않는다 ③ online 이 오면 한 번 새로고침.
 * 이 시험은 **index.html 의 첫 인라인 스크립트를 실제로 돌린다**(가짜 window).
 * 못 보는 것: 진짜 브라우저의 오프라인 판정(`navigator.onLine` 이 true 인 약한 신호는 종전 경로다).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'

const html = readFileSync('index.html', 'utf8')
const guardSrc = (html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/) || [])[1] || ''

function boot(onLine: boolean) {
  const listeners: Record<string, Array<(e: unknown) => void>> = {}
  const replace = vi.fn()
  const appended: unknown[] = []
  const store: Record<string, string> = {}
  const win: Record<string, unknown> = {
    addEventListener: (t: string, f: (e: unknown) => void) => { (listeners[t] ||= []).push(f) },
    removeEventListener: () => {},
  }
  const loc = { href: 'https://urdeal.kr/my-vouchers', origin: 'https://urdeal.kr', replace, reload: vi.fn() }
  const doc = {
    getElementById: () => null, querySelectorAll: () => [], createElement: () => ({ setAttribute() {}, set innerHTML(_v: string) {} }),
    body: { appendChild: (n: unknown) => { appended.push(n) } }, documentElement: { classList: { add() {}, remove() {} } }, readyState: 'loading', addEventListener: () => {},
  }
  const fake = {
    window: win, document: doc, location: loc, navigator: { onLine, serviceWorker: undefined, sendBeacon: () => true, userAgent: 'x' },
    sessionStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] } },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    performance: { getEntriesByType: () => [], now: () => 0 }, matchMedia: () => ({ matches: false }), fetch: () => Promise.resolve(), caches: undefined,
  }
  Object.assign(win, fake, { window: win })
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(...Object.keys(fake), 'with (window) {' + guardSrc + '}')(...Object.values(fake))
  const fire = (t: string, e: unknown) => (listeners[t] || []).forEach((f) => f(e))
  const chunkErr = { target: { tagName: 'SCRIPT', src: 'https://urdeal.kr/assets/locale-ko-abc.js' } }
  return { win, replace, appended, store, fire, chunkErr }
}

describe('📵 오프라인 부트 가드', () => {
  afterEach(() => { vi.useRealTimers() })
  it('① 오프라인 청크 실패 — 새로고침 0 · 예산 0 · ③ online 에 한 번', () => {
    vi.useFakeTimers()
    const b = boot(false)
    b.fire('error', b.chunkErr)
    vi.advanceTimersByTime(60_000)
    expect(b.replace).not.toHaveBeenCalled()
    expect(b.store['__ur_chunk_reload__']).toBeUndefined()
    b.fire('online', {})
    vi.advanceTimersByTime(400)
    expect(b.replace).toHaveBeenCalledTimes(1)
    expect(String(b.replace.mock.calls[0][0])).toContain('__cb=')
  })
  it('② 오프라인 — 복구 화면을 덮지 않는다', () => {
    vi.useFakeTimers()
    const b = boot(false)
    ;(b.win.__urShowStuckUI as (r: string) => void)('slow')
    expect(b.appended.length).toBe(0)
  })
  it('온라인 청크 실패는 종전대로 유예 뒤 새로고침', () => {
    vi.useFakeTimers()
    const b = boot(true)
    b.fire('error', b.chunkErr)
    vi.advanceTimersByTime(800)
    expect(b.replace).toHaveBeenCalledTimes(1)
  })
})
