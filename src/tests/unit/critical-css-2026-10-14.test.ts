/**
 * 🎨 첫 화면 전용 CSS — 근거·실측은 `scripts/generate-critical-css.mjs` 머리말.
 *
 * 이 테스트가 고정하는 것:
 *   ① 워커가 `#root` 첫 화면을 그리는 모듈이 **전부** 생성기의 ROOTS 에 있다(빠지면 그 화면 클래스가 CSS 에 없다)
 *   ② 생성기가 지금 소스로 만든 CSS 가 상한 안·인라인 가능하다(2026-11-03 부터 산출물은 커밋하지 않는다 —
 *      빌드가 매번 만든다. 추적 파일은 빈 자리표시자: `critical-css-placeholder-2026-11-03.test.ts`)
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
import {
  applyCssFirstBoot, cssFirstBootScript, criticalCssUsable, CRITICAL_BACKSTOP_MS, CSS_FIRST_BACKSTOP_MS, CRITICAL_STYLE_ID,
} from '@/worker/utils/css-first-boot'
import { PASS_HEAD } from '@/shared/pass-head'
import { STRIP_CLS } from '@/shared/home-strip-banners'
// @ts-expect-error — .mjs 생성기(타입 없음)
import { ROOTS, importClosure, loaderBlock, positivePart, CRITICAL_CSS_MAX_BYTES, CRITICAL_SURFACE_MAX_BYTES, tokensCssOf } from '../../../scripts/generate-critical-css.mjs'

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
    expect(loaderBlock()).toMatch(/brandLoaderMarkup\(/) // ⏳ 2026-11-02 로더 = SSOT 문자열(막대·화면 모양)
  })
})

/** 지금 소스로 만든 첫 화면 CSS — 별도 node 프로세스(esbuild 는 jsdom 안에서 돌지 않는다). 빌드가 만드는 것과 같은 함수다. */
const CRITICAL_CSS = execFileSync(process.execPath, ['--no-warnings', '-e',
  "import('./scripts/generate-critical-css.mjs').then(m=>m.generateCriticalCss()).then(r=>process.stdout.write(r.css))"],
  { encoding: 'utf8', maxBuffer: 8 << 20, timeout: 60_000 })

describe('② 생성기 산출물', () => {
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
  it('로더 — 스타일을 문자열 안에 실어 첫 화면 CSS 에 기대지 않는다(2026-11-02 막대·화면 모양)', () => {
    // 종전엔 ur-loader-breathe/sweep·ur-udal-hop 이 이 CSS 에 있어야 했다. 지금 로더는 `<style>` 를 같이 싣는다 —
    // 그래서 여기서 볼 것은 '로더가 쓰는 토큰' 이 첫 화면 CSS 에 있느냐다(--brand · --rule).
    expect(css).toMatch(/--brand:/)
    expect(css).toMatch(/--rule:/)
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
  it('CSS 가 비었으면 <style> 은 없지만 앱 CSS 링크는 그래도 media=print(⏳ 2026-11-09 로더-먼저 — 로더는 자기 스타일을 든다)', () => {
    const { rw, on } = fakeRewriter()
    applyCssFirstBoot(rw, 'n', true, '')
    expect(on.some(([s]) => s === 'link[rel="stylesheet"]')).toBe(true)
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

describe('🏠 2026-11-05 홈 전용 첫 화면 CSS', () => {
  const HOME_CSS = execFileSync(process.execPath, ['--no-warnings', '-e',
    "import('./scripts/generate-critical-css.mjs').then(async m=>{const r=await m.generateCriticalCss();process.stdout.write(await m.generateHomeCriticalCss(r.css))})"],
    { encoding: 'utf8', maxBuffer: 8 << 20, timeout: 90_000 })
  it('전체판보다 확실히 작다(합친 열 화면 → 홈만)', () => {
    expect(HOME_CSS.length).toBeGreaterThan(10_000)
    expect(HOME_CSS.length).toBeLessThan(CRITICAL_CSS.length * 0.7)
    expect(criticalCssUsable(HOME_CSS)).toBe(true)
  })
  it('홈 배너(STRIP_CLS) 클래스 · 토큰 · 다크 변형은 남는다', () => {
    const pick = (v: unknown): string[] => (typeof v === 'string' ? v.split(/\s+/) : v && typeof v === 'object' ? Object.values(v).flatMap(pick) : [])
    for (const c of pick(STRIP_CLS).filter((c) => c && !c.includes('&') && !c.startsWith('['))) expect(HOME_CSS, c).toContain(sel(c))
    expect(HOME_CSS).toMatch(/--brand:/)
    expect(HOME_CSS).toMatch(/\.dark/)
  })
  it('이용권 상세 머리(PASS_HEAD) 전용 클래스는 빠진다 — 홈만 남긴 것이 맞다', () => {
    const pick = (v: unknown): string[] => (typeof v === 'string' ? v.split(/\s+/) : v && typeof v === 'object' ? Object.values(v).flatMap(pick) : [])
    const only = pick(PASS_HEAD).filter((c) => c && !c.includes('&') && !c.startsWith('[') && CRITICAL_CSS.includes(sel(c)) && !HOME_CSS.includes(sel(c)))
    expect(only.length, '상세 전용 클래스가 하나도 안 빠졌다면 홈판이 헛돈 것').toBeGreaterThan(0)
  })
  it('워커는 / 에서만 홈판을 쓴다(비면 전체판)', async () => {
    const { criticalCssFor } = await import('@/worker/utils/css-first-boot')
    expect(criticalCssFor('/', 'FULL', 'HOME')).toBe('HOME')
    expect(criticalCssFor('/pass/1', 'FULL', 'HOME')).toBe('FULL')
    expect(criticalCssFor('/', 'FULL', '')).toBe('FULL')
  })
})

describe('🧩 2026-11-08 표면별 첫 화면 CSS', () => {
  const SURF = JSON.parse(execFileSync(process.execPath, ['--no-warnings', '-e',
    "import('./scripts/generate-critical-css.mjs').then(async m=>{const r=await m.generateCriticalCss();const o={};for(const [k,v] of Object.entries(m.SURFACE_ROOTS))o[k]=(await m.generateSurfaceCriticalCss(r.css,v)).length;process.stdout.write(JSON.stringify({o,keys:Object.keys(m.SURFACE_ROOTS),rt:m.runtimeClasses()}))})"],
    { encoding: 'utf8', maxBuffer: 8 << 20, timeout: 180_000 }))
  it('모든 첫 화면 ROOT 가 어느 표면에 속한다 · 표면마다 전체판의 70% 미만', () => {
    const covered = new Set(Object.values(SURF.keys.map((k: string) => k)))
    expect(covered.size).toBe(19) // 🧭 2026-11-10 안내 랜딩(landing) · 🧺 장바구니(cart) · 🔔 알림(notifications) · ❓ FAQ(faq) · 🔎 검색(search) · 🏠 2026-11-08 생활(life) · 🗺️ 지역(region) · 🎬 2026-11-09 유어쇼츠(urshorts) · 🗺️ 지도(map) 추가
    for (const [k, n] of Object.entries(SURF.o as Record<string, number>)) {
      expect(n, k).toBeGreaterThan(10_000)
      expect(n, k).toBeLessThan(CRITICAL_CSS.length * 0.7)
    }
  })
  it('🎨 토큰판(tokensCssOf) — :root 와 .dark 변수 블록만, --brand/--rule 포함, 4KB 아래 (2026-11-09 로더가 투명하던 사고)', () => {
    const t = tokensCssOf(CRITICAL_CSS)
    expect(t.length).toBeGreaterThan(500)
    expect(t.length).toBeLessThan(4000)
    expect(t).toContain('--brand')
    expect(t).toContain('--rule')
    expect(t).toMatch(/\.dark,\[data-theme=dark\]\{--bg/)
    // 변수 선언 블록만이다 — 클래스 규칙이 섞이면 "토큰판" 이 아니다
    expect(t.replace(/\{[^}]*\}/g, '').replace(/:root|\.dark,\[data-theme=dark\]|\[data-theme=dark\],\.dark|\s/g, '')).toBe('')
    // 연달아 선 두 블록(:root}.dark{) 의 둘째도 잡는다 — 첫 판의 정규식이 앞 `}` 를 소비해 빠뜨렸다
    expect(tokensCssOf(':root{--a: 1}.dark,[data-theme=dark]{--a: 2}.x{color:red}')).toBe(':root{--a: 1}.dark,[data-theme=dark]{--a: 2}')
    // 생성물에도 실린다
    const gen = readFileSync('scripts/generate-critical-css.mjs', 'utf8')
    expect(gen).toContain('export const CRITICAL_CSS_TOKENS: string = ${JSON.stringify(tokens)}')
    expect(readFileSync('src/worker/generated/critical-css.ts', 'utf8')).toMatch(/export const CRITICAL_CSS_TOKENS: string = ''/)
  })
  it('🧱 상한은 표면별 40,000B(손님이 실제로 받는 인라인 CSS) · 전체판은 정신 건강 상한 160,000B (2026-11-09 대표 승인)', () => {
    expect(CRITICAL_SURFACE_MAX_BYTES).toBe(40_000)
    expect(CRITICAL_CSS_MAX_BYTES).toBe(160_000)
    for (const [k, n] of Object.entries(SURF.o)) expect(n as number, `${k} 표면 CSS 가 표면 상한을 넘는다`).toBeLessThanOrEqual(CRITICAL_SURFACE_MAX_BYTES)
    // 생성기 자신이 표면 상한을 강제한다(시험만 보는 상한은 빌드를 못 막는다)
    expect(readFileSync('scripts/generate-critical-css.mjs', 'utf8')).toMatch(/if \(v\.length > CRITICAL_SURFACE_MAX_BYTES\) throw/)
  })
  it('실행 중 붙는 클래스(다크·키보드)를 모은다 — 그 조건의 규칙이 첫 화면에서 빠지지 않게', () => {
    expect(SURF.rt).toEqual(expect.arrayContaining(['dark', 'keyboard-open']))
  })
  it('워커의 경로 → 표면 판정이 생성기 표면 이름과 같다', async () => {
    const { criticalSurfaceOf, criticalCssFor } = await import('@/worker/utils/css-first-boot')
    const cases: Array<[string, string | null]> = [
      ['/', 'home'], ['/pass/12', 'detail'], ['/group-buy/12', 'detail'], ['/vouchers/3', 'voucherDetail'], ['/stays/9', 'stayDetail'],
      ['/vouchers', 'vouchers'], ['/stays', 'stays'], ['/blog', 'blogList'], ['/blog/what-is-urdeal', 'blogDetail'],
      ['/user/profile', 'guest'], ['/u/me', 'guest'], ['/u/jiwon', 'curator'], ['/life', 'life'], ['/region/%EC%84%9C%EC%9A%B8', 'region'], ['/urshorts', 'urshorts'], ['/map', 'map'], ['/search', 'search'], ['/faq', 'faq'], ['/notifications', 'notifications'], ['/cart', 'cart'], ['/about', 'landing'], ['/partners', 'landing'], ['/influencer', 'landing'], ['/checkout', null],
    ]
    for (const [p, k] of cases) expect(criticalSurfaceOf(p), p).toBe(k)
    const named = new Set(cases.map(([, k]) => k).filter(Boolean))
    expect([...named].sort()).toEqual([...SURF.keys].sort())
    expect(criticalCssFor('/pass/1', 'FULL', 'HOME', { detail: 'D' })).toBe('D')
    expect(criticalCssFor('/pass/1', 'FULL', 'HOME', {})).toBe('FULL')
    expect(criticalCssFor('/checkout', 'FULL', 'HOME', { detail: 'D' })).toBe('') // ⏳ 2026-11-09 첫 화면 없는 표면은 인라인 0(로더가 자기 스타일)
  })
})
