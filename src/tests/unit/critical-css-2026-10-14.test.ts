/**
 * 🎨 첫 화면 전용 CSS — 근거·실측은 `scripts/generate-critical-css.mjs` 머리말.
 *
 * 이 테스트가 고정하는 것:
 *   ① 워커가 `#root` 첫 화면을 그리는 모듈이 **전부** 생성기의 ROOTS 에 있다(빠지면 그 화면 클래스가 CSS 에 없다)
 *   ② 커밋된 산출물이 **지금 소스로 다시 만든 것과 같다**(첫 화면 모듈을 고치고 재생성을 잊으면 빨간불)
 *   ③ 첫 화면이 쓰는 대표 클래스(로더 · 상세 머리 · 배너)가 실제로 그 CSS 에 있다
 *   ④ 재작성기 — CSS 가 있으면 `<style>` + 앱 CSS 링크 `media=print`, 비었으면 **종전과 같다**
 *   ⑤ 부팅 스크립트 — 앱 CSS 가 오면 **스크립트보다 먼저** `media=all`, 백스톱은 길게
 *
 * ⚠️ 못 막는 것: 첫 화면 HTML 의 클래스가 **어느 소스에도 글자 그대로 없는** 경우(문자열 이어 붙이기) —
 *   그런 클래스는 앱 CSS 에도 안 생기므로 이 기능 전에도 깨져 있던 것이다. 실제 체감(브라우저) — 배포 후 E4.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { CRITICAL_CSS } from '@/worker/generated/critical-css'
import {
  applyCssFirstBoot, cssFirstBootScript, criticalCssUsable, CRITICAL_BACKSTOP_MS, CSS_FIRST_BACKSTOP_MS, CRITICAL_STYLE_ID,
} from '@/worker/utils/css-first-boot'
import { PASS_HEAD } from '@/shared/pass-head'
import { STRIP_CLS } from '@/shared/home-strip-banners'
// @ts-expect-error — .mjs 생성기(타입 없음)
import { ROOTS, importClosure, loaderBlock, positivePart, CRITICAL_CSS_MAX_BYTES } from '../../../scripts/generate-critical-css.mjs'

/** Tailwind 클래스 → CSS 셀렉터 글자(이스케이프). */
function sel(cls: string) {
  return '.' + cls.replace(/([:[\]/#.%(),!&>*+=])/g, '\\$1')
}

describe('① 워커의 첫 화면 모듈이 전부 ROOTS 에 있다', () => {
  it('worker/index.ts 가 import 하는 first-screen · ssr-body 모듈 ⊂ ROOTS', () => {
    const w = readFileSync('src/worker/index.ts', 'utf-8')
    const mods = [...w.matchAll(/from '\.\/utils\/([\w-]*(?:first-screen|ssr-body))'/g)].map((m) => `src/worker/utils/${m[1]}.ts`)
    expect(mods.length, '정규식이 아무것도 못 잡으면 이 검사는 헛돈다').toBeGreaterThanOrEqual(5)
    for (const m of mods) expect(ROOTS, `${m} 가 ROOTS 에 없다 — 그 화면의 클래스가 첫 화면 CSS 에 안 들어간다`).toContain(m)
  })
  it('폐쇄가 상수 파일까지 따라간다(상세 머리 · 배너 클래스는 shared 에 산다)', () => {
    const files: string[] = importClosure()
    expect(files).toContain('src/shared/pass-head.ts')
    expect(files).toContain('src/shared/home-strip-banners.ts')
    expect(files.length).toBeGreaterThanOrEqual(20)
  })
  it('로더 블록을 떼어 낸다', () => {
    expect(loaderBlock()).toMatch(/ur-loader-breathe/)
  })
})

describe('② 산출물이 최신이다', () => {
  it('지금 소스로 다시 만든 CSS 와 커밋된 것이 같다', () => {
    // 별도 node 프로세스 — esbuild 는 jsdom 안에서 돌지 않는다.
    const css = execFileSync(process.execPath, ['--no-warnings', '-e',
      "import('./scripts/generate-critical-css.mjs').then(m=>m.generateCriticalCss()).then(r=>process.stdout.write(r.css))"],
      { encoding: 'utf8', maxBuffer: 8 << 20 })
    expect(css === CRITICAL_CSS, '첫 화면 CSS 가 낡았다 — `node scripts/generate-critical-css.mjs` 로 다시 만들어 커밋할 것').toBe(true)
  }, 60_000)
  it('상한 안 · 인라인 가능', () => {
    expect(CRITICAL_CSS.length).toBeGreaterThan(10_000)
    expect(CRITICAL_CSS.length).toBeLessThanOrEqual(CRITICAL_CSS_MAX_BYTES)
    expect(criticalCssUsable(CRITICAL_CSS)).toBe(true)
  })
})

describe('③ 첫 화면 클래스가 실제로 들어 있다', () => {
  const css = CRITICAL_CSS
  const pick = (v: unknown): string[] => (typeof v === 'string' ? v.split(/\s+/) : v && typeof v === 'object' ? Object.values(v).flatMap(pick) : [])
  // 셀렉터 이스케이프가 까다로운 임의 변형(`[&>span]:…`)은 뺀다 — 모양만 다르고 결론은 같다.
  const simple = (c: string) => c && !c.includes('&') && !c.startsWith('[')
  it('로더(워커 정적 로더 · 위상 동기 클래스)', () => {
    for (const c of ['ur-loader-breathe', 'ur-loader-sweep', 'ur-udal-hop', 'bg-brand', 'select-none']) expect(css, c).toContain(sel(c))
  })
  it('이용권 상세 머리(PASS_HEAD) 클래스 전부', () => {
    const cls = pick(PASS_HEAD).filter(simple)
    expect(cls.length).toBeGreaterThan(3)
    for (const c of cls) expect(css, c).toContain(sel(c))
  })
  it('홈 배너(STRIP_CLS) 클래스 전부', () => {
    const cls = pick(STRIP_CLS).filter(simple)
    expect(cls.length).toBeGreaterThan(3)
    for (const c of cls) expect(css, c).toContain(sel(c))
  })
  it('대시보드 껍데기 전용 규칙은 빠졌다', () => {
    // 셀렉터가 대시보드 클래스로 **시작하는** 규칙(= 그 껍데기 안에서만 쓰는 것). `:not(.admin-light-theme *)` 는 제외 조건이라 남는다.
    const splitTop = (list: string) => {
      const out: string[] = []; let d = 0, cur = ''
      for (const ch of list) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = '' } else cur += ch }
      return [...out, cur]
    }
    const lists = [...css.matchAll(/(?:^|\})([^{}@]+)\{/g)].map((m) => m[1])
    expect(lists.length).toBeGreaterThan(200)
    const dashOnly = lists.filter((l) => splitTop(l).every((x) => /\.(?:admin|seller|agency)-light-theme\b/.test(positivePart(x))))
    expect(dashOnly, '대시보드 껍데기에서만 쓰는 규칙이 첫 화면 CSS 에 실렸다').toEqual([])
  })
  it('🩸 다크 변형은 남는다 — 제외 조건(:not(.admin-light-theme *))을 품은 셀렉터를 대시보드 전용으로 오판하지 않는다', () => {
    expect(css).toContain(sel('dark:text-white'))
    expect(positivePart('.dark\\:x:is(.dark *):not(.light-island *):not(.admin-light-theme *)')).toBe('.dark\\:x:is(.dark *)')
    expect(positivePart('.admin-light-theme .x')).toBe('.admin-light-theme .x')
  })
})

/** HTMLRewriter 흉내 — `.on(selector, handler)` 를 기록한다. */
function fakeRewriter() {
  const on: Array<[string, { element: (el: unknown) => void }]> = []
  const rw = { on(s: string, h: { element: (el: unknown) => void }) { on.push([s, h]); return rw } }
  return { rw: rw as unknown as HTMLRewriter, on }
}
function fakeEl(attrs: Record<string, string>) {
  const set: Record<string, string> = {}
  let prepended = ''
  return {
    getAttribute: (k: string) => attrs[k] ?? null,
    setAttribute: (k: string, v: string) => { set[k] = v },
    prepend: (h: string) => { prepended = h },
    get set() { return set }, get prepended() { return prepended },
  }
}

describe('④ 재작성기', () => {
  it('CSS 가 있으면 <style> 을 head 맨 앞에(부팅 스크립트 뒤) · 앱 CSS 만 media=print', () => {
    const { rw, on } = fakeRewriter()
    applyCssFirstBoot(rw, 'n', true, '.a{color:red}')
    const head = on.find(([s]) => s === 'head')![1]
    const h = fakeEl({}); head.element(h)
    expect(h.prepended.indexOf('<script')).toBe(0)
    expect(h.prepended).toContain(`<style id="${CRITICAL_STYLE_ID}">.a{color:red}</style>`)
    const link = on.find(([s]) => s === 'link[rel="stylesheet"]')![1]
    const app = fakeEl({ href: '/assets/index-AB12.css' }); link.element(app)
    expect(app.set.media).toBe('print')
    const font = fakeEl({ href: '/static/fonts/pretendard-dynamic-subset-v1.3.9.css' }); link.element(font)
    expect(font.set.media, '폰트 CSS 는 자기 스크립트가 다룬다 — 건드리지 않는다').toBeUndefined()
  })
  it('CSS 가 비었으면 종전과 같다(<style> 없음 · 링크 손대지 않음)', () => {
    const { rw, on } = fakeRewriter()
    applyCssFirstBoot(rw, 'n', true, '')
    expect(on.some(([s]) => s === 'link[rel="stylesheet"]')).toBe(false)
    const h = fakeEl({}); on.find(([s]) => s === 'head')![1].element(h)
    expect(h.prepended).not.toContain('<style')
  })
  it('</style 이 든 CSS 는 넣지 않는다', () => {
    expect(criticalCssUsable('a{}</style><script>')).toBe(false)
  })
  it('적용 표면이 아니면 아무것도 걸지 않는다', () => {
    const { rw, on } = fakeRewriter()
    applyCssFirstBoot(rw, 'n', false, '.a{}')
    expect(on).toHaveLength(0)
  })
})

describe('⑤ 부팅 스크립트 — 앱 CSS 가 오면 먼저 붙이고 그다음 스크립트', () => {
  let doc: Document
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  function setup(critical: boolean) {
    doc = document.implementation.createHTMLDocument('t')
    doc.head.innerHTML = `<link rel="stylesheet" ${critical ? 'media="print"' : ''} href="/assets/index-AbC.css">
      <script type="ur-module" src="/assets/index-Z.js"></script>`
    Object.defineProperty(doc, 'readyState', { configurable: true, get: () => 'complete' })
    const js = cssFirstBootScript('n', critical).replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
    // eslint-disable-next-line no-new-func
    new Function('document', js)(doc)
  }
  const link = () => doc.head.querySelector('link[rel="stylesheet"]') as HTMLLinkElement
  const entries = () => doc.head.querySelectorAll('script[type="module"]').length

  it('앱 CSS load → media=all 이 되고 엔트리가 출발한다', () => {
    setup(true)
    expect(link().media).toBe('print')
    expect(entries()).toBe(0)
    link().dispatchEvent(new Event('load'))
    expect(link().media).toBe('all')
    expect(entries()).toBe(1)
  })
  it('백스톱은 길다 — 종전 3초엔 출발하지 않는다(앱 CSS 없이 React 가 그리면 스타일이 깨진다)', () => {
    setup(true)
    vi.advanceTimersByTime(CSS_FIRST_BACKSTOP_MS + 100)
    expect(entries()).toBe(0)
    vi.advanceTimersByTime(CRITICAL_BACKSTOP_MS)
    expect(entries()).toBe(1)
    expect(link().media).toBe('all')
  })
  it('첫 화면 CSS 가 없으면 종전 백스톱', () => {
    setup(false)
    vi.advanceTimersByTime(CSS_FIRST_BACKSTOP_MS + 100)
    expect(entries()).toBe(1)
  })
})
