/**
 * 🚦 처음 오는 기기에서 CSS 를 먼저 받는다 — 근거·실측은 `src/worker/utils/css-first-boot.ts` 머리말.
 *
 * 이 테스트가 고정하는 것:
 *   ① 부팅 스크립트를 **실제로 돌려서**(jsdom) CSS 신호 → modulepreload 복원 → 엔트리 실행 순서가 맞는가
 *   ② 백스톱 — CSS 신호가 끝내 안 와도 출발한다(이게 없으면 앱이 영영 안 뜬다)
 *   ③ 문서 파싱 중엔 엔트리를 넣지 않는다(#root 가 아직 없을 수 있다)
 *   ④ 워커 배선 — 재작성기·워커가 넣는 라우트 청크 둘 다 같은 inert rel 을 쓴다
 *
 * ⚠️ 못 막는 것: HTMLRewriter 런타임 동작(워커 전용 API) · 실제 체감 시간(브라우저 실측 — 배포 후 E4).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  cssFirstApplies, routePreloadRel, cssFirstBootScript, DEFERRED_PRELOAD_REL, DEFERRED_ENTRY_TYPE, CSS_FIRST_BACKSTOP_MS,
} from '@/worker/utils/css-first-boot'

function stripComments(s: string) {
  return s.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*')).join('\n')
}

/** 서빙되는 head 를 흉내 낸다: 부팅 스크립트 → CSS → (지연된) 프리로드 2 → (지연된) 엔트리. */
// 테스트마다 **새 문서** — 부팅 스크립트는 document 에 capture 리스너를 다는데, 전역 문서를 공유하면
// 앞 테스트의 리스너가 남아 같은 이벤트에 두 번 반응한다(실제로 그렇게 헛된 빨간불이 났다).
let doc: Document
function setupDom(readyState: DocumentReadyState = 'complete') {
  doc = document.implementation.createHTMLDocument('t')
  doc.head.innerHTML = `
    <link rel="stylesheet" href="/assets/index-AbC123.css">
    <link rel="${DEFERRED_PRELOAD_REL}" crossorigin href="/assets/react-core-x.js">
    <link rel="${DEFERRED_PRELOAD_REL}" crossorigin href="/assets/app-home-y.js">
    <script type="${DEFERRED_ENTRY_TYPE}" crossorigin src="/assets/index-Z.js"></script>`
  Object.defineProperty(doc, 'readyState', { configurable: true, get: () => readyState })
  const js = cssFirstBootScript('n').replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
  // eslint-disable-next-line no-new-func
  new Function('document', js)(doc)
}
const preloads = () => doc.head.querySelectorAll('link[rel="modulepreload"]').length
const entries = () => [...doc.head.querySelectorAll('script[type="module"]')].map((s) => s.getAttribute('src'))
const cssLoad = (type: 'load' | 'error' = 'load') =>
  doc.head.querySelector('link[rel="stylesheet"]')!.dispatchEvent(new Event(type))

describe('① CSS 가 오면 그때 스크립트가 출발한다', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers() })

  it('CSS 전엔 아무것도 받지 않는다', () => {
    setupDom()
    expect(preloads(), 'CSS 를 기다리지 않고 스크립트가 출발했다 — 회선을 다시 나눠 쓴다').toBe(0)
    expect(entries()).toEqual([])
  })

  it('CSS load → 프리로드 전부 복원 + 엔트리 실행(1회)', () => {
    setupDom()
    cssLoad()
    expect(preloads()).toBe(2)
    expect(entries()).toEqual(['/assets/index-Z.js'])
    cssLoad() // 두 번 와도 한 번만
    expect(entries()).toHaveLength(1)
    expect(preloads()).toBe(2)
  })

  it('CSS 가 실패해도(error) 출발한다', () => {
    setupDom()
    cssLoad('error')
    expect(entries()).toEqual(['/assets/index-Z.js'])
  })

  it('다른 스타일시트(폰트 CSS)의 load 로는 출발하지 않는다', () => {
    setupDom()
    const f = doc.createElement('link'); f.rel = 'stylesheet'; f.href = '/static/fonts/pretendard.css'
    doc.head.appendChild(f); f.dispatchEvent(new Event('load'))
    expect(entries()).toEqual([])
  })
})

describe('② 백스톱 — 신호가 끝내 안 와도 앱은 뜬다', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers() })
  it(`${CSS_FIRST_BACKSTOP_MS}ms 뒤 출발`, () => {
    setupDom()
    vi.advanceTimersByTime(CSS_FIRST_BACKSTOP_MS - 1)
    expect(entries()).toEqual([])
    vi.advanceTimersByTime(1)
    expect(entries()).toEqual(['/assets/index-Z.js'])
  })
  it('백스톱은 길지 않다(앱이 늦게 뜨는 상한)', () => {
    expect(CSS_FIRST_BACKSTOP_MS).toBeLessThanOrEqual(4000)
  })
})

describe('③ 문서 파싱 중이면 엔트리는 DOMContentLoaded 까지 기다린다', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers() })
  it('loading 중 CSS 가 와도 프리로드만 먼저, 엔트리는 파싱 뒤', () => {
    setupDom('loading')
    cssLoad()
    expect(preloads(), '프리로드는 바로 출발해야 한다').toBe(2)
    expect(entries(), '#root 가 없을 수 있는데 엔트리를 실행했다').toEqual([])
    doc.dispatchEvent(new Event('DOMContentLoaded'))
    expect(entries()).toEqual(['/assets/index-Z.js'])
  })
})

describe('⑤ 적용 표면 — 서버가 첫 화면을 그리는 곳(폰)만', () => {
  const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
  const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
  it.each(['/', '/pass/2919', '/group-buy/2888', '/vouchers/2192', '/u/jiwon1228'])('적용: %s', (p) => {
    expect(cssFirstApplies(p, PHONE)).toBe(true)
  })
  it.each(['/vouchers', '/map', '/browse', '/stays', '/u/me', '/u/jiwon1228/p/2887', '/user/profile', '/seller', '/admin'])(
    '미적용(첫 화면이 스크립트에 달림 — 실측상 나빠진다): %s', (p) => {
      expect(cssFirstApplies(p, PHONE)).toBe(false)
    })
  it('PC 브라우저엔 걸지 않는다(서버가 PC 첫 화면을 안 그린다)', () => {
    expect(cssFirstApplies('/', PC)).toBe(false)
    expect(cssFirstApplies('/pass/2919', PC)).toBe(false)
  })
})

describe('④ 워커 배선', () => {
  const worker = stripComments(readFileSync('src/worker/index.ts', 'utf-8'))
  const mod = stripComments(readFileSync('src/worker/utils/css-first-boot.ts', 'utf-8'))
  it('HTML 재작성기가 applyCssFirstBoot 로 시작하고, 적용 여부는 cssFirstApplies 한 곳이 정한다', () => {
    expect(worker).toMatch(/const cssFirst = cssFirstApplies\(url\.pathname, c\.req\.header\('user-agent'\) \|\| ''\); let rb = applyCssFirstBoot\(new HTMLRewriter\(\), nonce, cssFirst\)/)
  })
  it('워커가 넣는 라우트 청크도 같은 판정(cssFirst)으로 rel 을 고른다 — 갈리면 프리로드가 영영 안 풀리거나 CSS 와 다시 다툰다', () => {
    expect(worker).toMatch(/<link rel="\$\{routePreloadRel\(cssFirst\)\}" crossorigin href=/)
    expect(worker).not.toMatch(/el\.append\(`<link rel="modulepreload"/)
    expect(routePreloadRel(true)).toBe(DEFERRED_PRELOAD_REL)
    expect(routePreloadRel(false)).toBe('modulepreload')
  })
  it('부팅 스크립트는 head 맨 앞(prepend) — 스타일시트 뒤면 그 CSS 를 기다리느라 파싱을 막는다', () => {
    expect(mod).toMatch(/el\.prepend\(cssFirstBootScript\(nonce\)/)
  })
  it('부팅 스크립트에 nonce 가 붙는다(CSP strict-dynamic)', () => {
    expect(cssFirstBootScript('ABC')).toMatch(/^<script nonce="ABC">/)
  })
  it('엔트리 판정은 우리 /assets/ 스크립트만', () => {
    expect(mod).toMatch(/startsWith\('\/assets\/'\)/)
  })
})

describe('⑥ 첫 방문자가 보지 않는 셸 부품은 조건이 맞을 때만 마운트(app-components 151KB 를 부팅에서 뺀다)', () => {
  const app = stripComments(readFileSync('src/App.tsx', 'utf-8'))
  it.each([
    ['onboarding', 'OnboardingTrigger'],
    ['restore', 'RestoreAccountModal'],
    ['push', 'PushNotificationSetup'],
    ['sideBanner', 'SideBanner'],
  ])('%s → <%s> 앞에 문지기가 있다', (k, comp) => {
    expect(app, `${comp} 가 무조건 마운트된다 — 첫 방문자도 app-components 를 다시 받는다`).toMatch(
      new RegExp(`shellNeed\\.${k} && <Suspense fallback=\\{null\\}><${comp} />`),
    )
  })
  it('문지기 조건이 컴포넌트 자신의 조건과 같다', () => {
    expect(app).toMatch(/onboarding: qs\.includes\('new=1'\)/)
    expect(app).toMatch(/restore: qs\.includes\('restorable=1'\)/)
    expect(app).toMatch(/sideBanner:[^\n]*min-width: 1024px/)
  })
})
