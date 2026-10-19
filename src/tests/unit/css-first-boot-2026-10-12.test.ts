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
  cssFirstApplies, routePreloadRel, cssFirstBootScript, earlyHintsLink, appendEdgeHeaders, DEFERRED_PRELOAD_REL, DEFERRED_ENTRY_TYPE, CSS_FIRST_BACKSTOP_MS,
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
  it.each(['/', '/pass/2919', '/group-buy/2888', '/vouchers/2192', '/u/jiwon1228', '/vouchers', '/stays/2887', '/stays'])('적용: %s', (p) => {
    expect(cssFirstApplies(p, PHONE)).toBe(true)
  })
  it.each(['/map', '/browse', '/u/me', '/u/jiwon1228/p/2887', '/user/profile', '/seller', '/admin'])(
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
    expect(worker).toMatch(/const cssFirst = cssFirstApplies\(url\.pathname, c\.req\.header\('user-agent'\) \|\| ''\);/)
    expect(worker).toMatch(/let rb = applyCssFirstBoot\(new HTMLRewriter\(\), nonce, cssFirst\)/)
  })
  it('워커가 넣는 라우트 청크도 같은 판정(cssFirst)으로 rel 을 고른다 — 갈리면 프리로드가 영영 안 풀리거나 CSS 와 다시 다툰다', () => {
    expect(worker).toMatch(/<link rel="\$\{routePreloadRel\(cssFirst\)\}" crossorigin href=/)
    expect(worker).not.toMatch(/el\.append\(`<link rel="modulepreload"/)
    expect(routePreloadRel(true)).toBe(DEFERRED_PRELOAD_REL)
    expect(routePreloadRel(false)).toBe('modulepreload')
  })
  it('부팅 스크립트는 head 맨 앞(prepend) — 스타일시트 뒤면 그 CSS 를 기다리느라 파싱을 막는다', () => {
    // 🎨 2026-10-14: 첫 화면 CSS <style> 과 묶어 한 번에 prepend — 부팅 스크립트가 그 묶음의 **맨 앞**이다.
    expect(mod).toMatch(/const head = cssFirstBootScript\(nonce, crit\) \+/)
    expect(mod).toMatch(/el\.prepend\(head, \{ html: true \}\)/)
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

describe('⑦ Link 헤더(Early Hints 원천) — 렌더 차단 CSS 만', () => {
  it('엔트리 CSS 를 preload as=style 로 싣는다 (2026-10-15: 폰트 CSS 는 손님 화면이 기기 글꼴로 바뀌어 없다)', () => {
    expect(earlyHintsLink(['/assets/index-AB.css'])).toBe(
      '</assets/index-AB.css>; rel=preload; as=style; crossorigin',
    )
  })
  it('미리 받기의 crossorigin 이 실제 <link> 와 같다 — 다르면 같은 CSS 를 두 번 받는다 (2026-10-14 라이브 실측)', () => {
    const parts = earlyHintsLink(['/assets/index-AB.css']).split(', ')
    // 엔트리 CSS 태그: Vite 가 crossorigin 을 단다(빌드 산출물 실측 `<link rel="stylesheet" crossorigin href="/assets/index-*.css">`)
    //   → 미리 받기도 crossorigin. Vite 설정이 이 속성을 끄는 날엔 이 단언과 함께 바꿀 것.
    expect(parts.find((x) => x.includes('/assets/index-AB.css'))).toMatch(/; crossorigin$/)
    const vite = readFileSync('vite.config.ts', 'utf-8')
    expect(vite).not.toMatch(/crossorigin\s*:\s*false|modulePreload[^\n]*crossorigin/i)
  })
  it('스크립트는 싣지 않는다(CSS 와 다시 다툰다)', () => {
    expect(earlyHintsLink(['/assets/index-AB.css'])).not.toMatch(/modulepreload|\.js>/)
  })
  it('없는 폰트 CSS 를 미리 받으라고 하지 않는다 (2026-10-15 기기 글꼴 전환 — 그 시트는 지웠다)', () => {
    expect(earlyHintsLink(['/assets/index-AB.css'])).not.toMatch(/\/static\/fonts\//)
    expect(readFileSync('index.html', 'utf-8')).not.toMatch(/id="ur-font-css"/)
  })
  it('워커가 모든 HTML 응답에 그 헤더를 단다 · 생성기가 ENTRY_CSS 를 낸다', () => {
    const w = stripComments(readFileSync('src/worker/index.ts', 'utf-8'))
    expect(w).toMatch(/appendEdgeHeaders\(c\.res\.headers, ENTRY_CSS, \(c\.req\.raw as \{ cf\?: \{ colo\?: string \} \}\)\.cf\?\.colo\)/)
    const g = readFileSync('scripts/generate-route-chunk-map.mjs', 'utf-8')
    expect(g).toMatch(/emit\(out, entry\.css, bootJs\)/)
    expect(g).toMatch(/export const ENTRY_CSS/)
  })
})

describe('⑧ 응답한 데이터센터를 Server-Timing 에 싣는다(실사용자 계측)', () => {
  it('Link + colo 를 append(덮지 않는다 — ssr-payload 가 먼저 set 한다)', () => {
    const h = new Headers({ 'Server-Timing': 'kv;dur=10' })
    appendEdgeHeaders(h, ['/assets/index-AB.css'], 'ICN')
    expect(h.get('Server-Timing')).toBe('kv;dur=10, colo;desc="ICN"')
    expect(h.get('Link')).toContain('/assets/index-AB.css')
  })
  it('이상한 값은 걸러 헤더를 깨지 않는다 · 없으면 안 단다', () => {
    const h = new Headers(); appendEdgeHeaders(h, [], 'I"CN\r\nx')
    expect(h.get('Server-Timing')).toBe('colo;desc="ICN"')
    const h2 = new Headers(); appendEdgeHeaders(h2, [], undefined)
    expect(h2.get('Server-Timing')).toBeNull()
  })
})

describe('⑨ 실사용자 계측 — 연결 시간(CONN) · 데이터센터별 TTFB', () => {
  const rep = stripComments(readFileSync('src/lib/web-vitals-report.ts', 'utf-8'))
  const api = readFileSync('src/worker/routes/analytics.routes.ts', 'utf-8')
  it('클라가 CONN(connectEnd) 과 colo:XXX 표본을 보낸다', () => {
    expect(rep).toMatch(/send\('CONN', Math\.max\(0, nav\.connectEnd\), page\)/)
    expect(rep).toMatch(/t\.name === 'colo'/)
    expect(rep).toMatch(/send\('TTFB', nav\.responseStart, `colo:\$\{colo\}`\)/)
  })
  it('서버가 CONN 을 받고(수집·요약 둘 다) colo 키를 보존한다', () => {
    expect(api).toMatch(/const validNames = \[[^\]]*'CONN'/)
    expect(api).toMatch(/for \(const name of \[[^\]]*'CONN'/)
    expect(api).toMatch(/\/\^colo:\(\[A-Z\]\{3,4\}\)\$\//)
  })
})

describe('⑤-2 서버가 그리는 첫 화면 = CSS 먼저 적용 표면 (2026-10-17)', () => {
  // 교환권 목록·숙소 상세가 서버 첫 화면을 얻은 뒤에도 이 목록이 안 따라와 첫 그림이 ~2.4초 늦었다.
  // ROOTS(첫 화면 CSS 를 만드는 모듈)마다 대표 경로를 하나씩 두고, 그 경로가 적용 표면인지 본다.
  const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
  const SAMPLE: Record<string, string> = {
    'src/worker/utils/home-first-screen.ts': '/',
    'src/worker/utils/detail-ssr-body.ts': '/pass/2919',
    'src/worker/utils/voucher-detail-ssr-body.ts': '/vouchers/2192',
    'src/worker/utils/curator-ssr-body.ts': '/u/jiwon1228',
    'src/worker/utils/stay-detail-ssr-body.ts': '/stays/2887',
    'src/worker/utils/vouchers-first-screen.ts': '/vouchers',
    'src/worker/utils/stays-first-screen.ts': '/stays', // 2026-10-19 — 숙소 목록도 서버 첫 화면을 얻었다
  }
  it('ROOTS 의 모든 첫 화면 모듈에 대표 경로가 있다(새 첫 화면이 생기면 여기서 멈춘다)', async () => {
    // @ts-expect-error — .mjs 생성기(타입 없음)
    const { ROOTS } = await import('../../../scripts/generate-critical-css.mjs')
    expect(ROOTS.length).toBeGreaterThan(0)
    for (const r of ROOTS as string[]) expect(SAMPLE[r], `대표 경로 없음: ${r}`).toBeTruthy()
  })
  it.each(Object.entries(SAMPLE))('%s → %s 는 CSS 먼저 적용', (_root, path) => {
    expect(cssFirstApplies(path, PHONE)).toBe(true)
  })
})
