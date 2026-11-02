// @vitest-environment node
/**
 * 🧱 서버 렌더(prerender)가 `window` 를 읽지 않는다 — 2026-11-01.
 *
 * ## 왜 — 매 빌드가 죽는데 빌드는 초록이었다
 * `npm run build` 의 prerender 단계가 **몇 달간 매번** 죽고 있었다(실측 재현):
 *
 *     [prerender-main] 렌더 시작 (allReady 모드)...
 *     ReferenceError: window is not defined
 *         at Hs (dist/server/entry-server.mjs:1:11431)     ← App.tsx 의 PageLoader
 *     Node.js v22.23.4                                      ← 처리 안 된 예외로 프로세스 사망
 *     [build] prerender skip (graceful)                     ← 그래도 빌드는 exit 0
 *
 * 원인은 `App.tsx` 의 Suspense 폴백이 **렌더 중에** `window.location.pathname` 을 읽은 것이다.
 * lazy 라우트의 폴백이라 서버가 홈을 그릴 때 거의 언제나 걸렸다.
 *
 * 🩸 그런데 왜 아무 신호가 없었나 — **세 겹이 겹쳐 조용했다**(전부 실측):
 *   ① `entry-server.tsx` 의 안전판 로그(`onShellError`·`onError`·타임아웃 warn)는
 *      `vite.config.ts` 의 `terserOptions.compress.drop_console: true` 가 **전부 제거**한다
 *      (빌드된 번들에 `'shell 렌더 실패'` 문자열 **0건**). 그래서 "관측만" 하기로 한 로그가 죽어 있었다.
 *   ② 그 `onShellError` 가 부른 `renderToString` 폴백이 **같은 에러를 다시** 던지는데, 그 자리는
 *      React 의 콜백 안이라 `main().catch` 밖이다 → 처리 안 된 예외로 프로세스가 죽는다
 *      (그래서 `[prerender-main] 실패:` 줄도 없다).
 *   ③ `package.json` 의 `|| echo '[build] prerender skip (graceful)'` 가 exit code 를 삼킨다.
 *
 * ## 이 시험이 하는 일
 * prerender 와 **같은 조건**(node 환경 = `window` 없음 + 같은 스토리지 스텁)에서 App 을 실제로
 * 렌더한다. 문자열 검사가 아니라 **동작 판정**이다 — 어느 컴포넌트가 렌더 중에 `window`·`document`
 * 를 읽든, 그 모듈이 평가 중에 읽든, 여기서 터진다.
 *
 * ## 이 시험이 **못** 보는 것
 * - 빌드된 번들(terser·청크 분할) 고유의 문제 — 여기서는 소스를 렌더한다.
 * - `renderToPipeableStream`(스트림) 경로의 런타임 동작 — 여기서는 `renderToString` 이다.
 *   ⚠️ 둘 다 같은 폴백을 그리므로 이 결함 클래스는 양쪽에서 같이 잡힌다.
 *
 * ## 🔁 2026-11-01 후속 — 그 단계는 이제 **검사기**다 (산출물 없음)
 * 위 수리로 로그가 살아나자 두 번째 결함이 드러났다: 호출부가 2번째 인자로 `null` 을 넘기는데
 * 받는 쪽은 `renderAppComplete(url, timeoutMs = 20000)` 이다(기본값은 `undefined` 에만 적용) →
 * `setTimeout(…, null)` = **0ms** → 즉시 `renderToString` 폴백. 즉 2026-07-05 가 "스피너만
 * 구워진다" 를 고치려 만든 `allReady` 경로가 **한 번도 돈 적이 없었다**(실측 `#root` 1,298B 에
 * `role="status"` = BrandLoader).
 *
 * 그리고 라이브는 그 산출물을 **100% 버린다**(실측): 워커가 `#root` 를 모든 HTML 응답에서
 * 교체하고(catch-all `else` 포함) `/index.html` 은 Pages 가 **308 → `/`**, 검색 크롤러는 봇 셸을
 * 받는다. 인자를 빼면 `allReady` 가 실제로 돌지만(107ms · 20,192자 · 에러 0 · Suspense 실패 1→0)
 * `index.html` 이 **28,568 → 47,860B(+19.3KB)** 가 되고 그 19KB 를 매 응답에서 워커가 파싱한 뒤
 * 버린다. ⇒ **둘을 같이** 했다: `allReady` 를 켜고(검사 범위 = 앱 트리 전체) 산출물은 쓰지 않는다.
 *
 * ⇒ `scripts/prerender-main.mjs` → **`scripts/check-ssr-render-window.mjs`**(이름도 바꿨다 —
 *   prerender 를 안 하는 파일이 그 이름을 갖고 있으면 다음 세션이 낡은 지도를 믿는다).
 *   아래 두 번째 `describe` 가 **그 검사기의 계약**을 고정한다. 이 시험(소스 렌더)과 그 검사기
 *   (빌드 산출물 렌더)는 **다른 층**이라 둘 다 필요하다 — 이쪽은 1.9초에 PR 에서, 그쪽은 번들에서.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { readCode, readRaw, sliceFrom } from '../helpers/source-text'

// 🛡️ `scripts/check-ssr-render-window.mjs` 와 **같은** no-op 스토리지 스텁. 그 스크립트가 2026-06-04 에
//   "한 컴포넌트만 localStorage 를 읽어도 SSR 전체가 조용히 스피너가 된다" 를 고치며 넣은 것이라,
//   여기서도 같은 조건을 만들어야 *그 스크립트가 보는 것*을 잰다.
const noopStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {},
  key: () => null, get length() { return 0 },
}
const g = globalThis as Record<string, unknown>
if (typeof g.localStorage === 'undefined') g.localStorage = noopStorage
if (typeof g.sessionStorage === 'undefined') g.sessionStorage = noopStorage
if (typeof g.matchMedia === 'undefined') {
  g.matchMedia = () => ({
    matches: false, media: '', onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent() { return false },
  })
}

/** prerender 가 그리는 경로(`/`) + 폴백 색을 가르는 다크 표면 둘 다 본다. */
const ROUTES = ['/', '/videos', '/seller'] as const

describe('🧱 서버 렌더가 `window` 를 읽지 않는다 (prerender 가 매 빌드 죽던 것)', () => {
  it('🔴 전제 — 이 시험은 `window` 가 **없는** 환경에서 돈다 (있으면 아무것도 판정하지 못한다)', () => {
    expect(typeof window, 'jsdom 으로 돌고 있다 — `@vitest-environment node` 가 사라졌는지 확인').toBe('undefined')
  })

  for (const route of ROUTES) {
    it(`🔴 \`${route}\` 를 서버에서 렌더해도 \`is not defined\` 가 0건이다`, async () => {
      const App = (await import('@/App')).default

      // React 는 렌더 중 오류를 console.error 로도 흘린다(경계가 삼킨 것까지). 둘 다 본다.
      const seen: string[] = []
      const spyErr = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { seen.push(a.map(String).join(' ')) })
      const spyWarn = vi.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => { seen.push(a.map(String).join(' ')) })

      let thrown: unknown = null
      let html = ''
      try {
        html = renderToString(<App Router={StaticRouter as never} routerProps={{ location: route }} />)
      } catch (e) { thrown = e } finally {
        spyErr.mockRestore()
        spyWarn.mockRestore()
      }

      expect(thrown && String((thrown as Error).message), '서버 렌더가 던졌다').toBeFalsy()

      // 🔑 측정 대상 0건이면 통과가 아니라 실패 — 렌더가 빈 문자열이면 위 단언은 공짜로 통과한다.
      expect(html.length, '렌더 결과가 비었다 — 이 시험이 헛돈다').toBeGreaterThan(300)

      const notDefined = seen.filter((m) => /is not defined/.test(m))
      expect(notDefined, `렌더 중 전역 접근: ${notDefined[0]?.slice(0, 300) ?? ''}`).toEqual([])

      // React 가 경계에서 삼킨 오류는 `<template data-msg="...">` 로 마크업에 박힌다.
      expect(html, 'Suspense 경계가 오류를 삼킨 잔재가 있다').not.toMatch(/data-msg="[^"]*is not defined/)
    })
  }

  it('🔴 `App.tsx` 폴백이 경로를 **라우터에서** 받는다 (렌더 중 `window.location` 금지)', async () => {
    const { readCode } = await import('../helpers/source-text')
    const app = readCode('src/App.tsx')
    const line = app.split('\n').find((l) => l.includes('const PageLoader =')) ?? ''
    expect(line, '`PageLoader` 정의을 못 찾았다 — 이 검사가 헛돈다').toContain('BootFirstScreenLoader')
    expect(line, '폴백이 다시 렌더 중 `window` 를 읽는다').not.toMatch(/window\./)
    // 호출부가 라우터 location 을 넘긴다 — 형제 `isDashboardLoaderSurface` 와 같은 출처.
    expect(app, '폴백 호출부가 라우터 경로를 안 넘긴다').toMatch(/<PageLoader\s+pathname=\{location\.pathname\}/)
  })

  it('🔴 `tests/setup.ts` 가 node 환경을 견딘다 (안 그러면 위 렌더 시험이 통째로 불가능하다)', async () => {
    const { readCode } = await import('../helpers/source-text')
    const setup = readCode('tests/setup.ts')
    expect(setup, 'window 유무 분기가 사라졌다').toMatch(/typeof window !== 'undefined' \? window : \{\}/)
    expect(setup, '`global.window.*` 직접 대입이 돌아왔다 — node 환경에서 TypeError').not.toMatch(/global\.window\./)
  })
})

/**
 * 🔬 그 검사기의 계약 — 2026-11-01.
 *
 * 왜 소스를 읽어 단언하나: 이 시험은 **소스를 렌더**하고 검사기는 **빌드 산출물을 렌더**한다.
 * 여기서 그 스크립트를 실행할 수는 없다(`dist/server/entry-server.mjs` 가 필요하고, 그걸
 * 요구하면 PR 유닛이 빌드에 묶인다). ⇒ 실행은 `verify.yml` 이 하고, **계약**을 여기서 고정한다.
 */
describe('🔬 SSR 스모크 검사기 계약 (산출물을 쓰지 않는다)', () => {
  const guard = () => readCode('scripts/check-ssr-render-window.mjs')
  const pkg = () => JSON.parse(readRaw('package.json')) as { scripts: Record<string, string> }

  it('🔴 `index.html` 을 쓰지 않는다 (라이브가 100% 버리는 19KB 를 굽지 않는다)', () => {
    const code = guard()
    // 🔑 쓰기 자체가 없어야 한다 — 경로만 지우면 다음 세션이 다른 파일에 쓰기 시작한다.
    expect(code).not.toMatch(/writeFileSync|writeFile\s*\(|createWriteStream/)
    expect(code).not.toMatch(/dist\/client\/index\.html/)
  })

  it('🔴 `renderAppComplete` 를 **인자 없이** 부른다 (2번째 인자는 timeoutMs 다 — 원 결함)', () => {
    const code = guard()
    expect(code).toMatch(/renderAppComplete\('\/'\)/)
    // ⚠️ 두 번째 인자를 주면 그것이 타임아웃이 된다. `null`·`undefined`·숫자 전부 금지 —
    //    기본값(20000)을 쓰는 것이 유일하게 옳다(값을 적으면 두 벌이 갈린다).
    expect(code).not.toMatch(/renderAppComplete\(\s*'[^']*'\s*,/)
  })

  it('🔴 `renderApp`(renderToString) 폴백을 쓰지 않는다 (검사 범위가 조용히 좁아진다)', () => {
    const code = guard()
    // 종전 `serverEntry.renderAppComplete || serverEntry.renderApp` 는 구버전 번들 대비였는데,
    // 둘은 **같은 빌드**에서 나오므로 폴백은 "lazy 모듈을 안 보는 모드" 로 조용히 떨어지는 길이다.
    expect(code).not.toMatch(/\|\|\s*serverEntry\.renderApp\b/)
    expect(code).toMatch(/typeof serverEntry\.renderAppComplete !== 'function'/)
  })

  it('🔴 폴백을 **썼는지** 감시한다 (그게 원 결함의 유일한 신호다)', () => {
    const code = guard()
    // 🩸 2026-11-01: 첫 판이 **장치의 존재**만 봐서 헛돌았다 — 가로채기(`process.stderr.write =`)와
    //   판정 정규식은 남겨 두고 **모으는 줄만** 지우면 통과했다(주입이 잡았다). 체인을 본다:
    //   ① 가로채기 블록 안에서 `[entry-server]` 를 골라 `ssrLogs` 에 **담고** ② 판정이 그걸 **읽는다**.
    const intercept = sliceFrom(code, 'process.stderr.write =', 'async function main')
    expect(intercept).toContain('[entry-server]')
    expect(intercept).toMatch(/ssrLogs\.push/)
    expect(code).toMatch(/ssrLogs\.filter\(/)
    expect(code).toMatch(/타임아웃\|폴백|폴백\|타임아웃/)
  })

  it('🔴 글자수 하한이 있다 (빈 렌더가 "통과" 가 되지 않게)', () => {
    const m = guard().match(/const MIN_CHARS = (\d+)/)
    expect(m).toBeTruthy()
    // 실측: allReady 20,192자 ↔ 폴백(로더) 3,077자. 하한은 그 사이여야 폴백을 반드시 잡는다.
    const min = Number(m![1])
    expect(min).toBeGreaterThan(3077)
    expect(min).toBeLessThan(20192)
  })

  it('🔴 PR 게이트가 strict 로 돌린다 (안 그러면 다시 로그 속 침묵이다)', () => {
    const yml = readRaw('.github/workflows/verify.yml')
    const step = yml.slice(yml.indexOf('SSR 스모크'))
    expect(step.length).toBeGreaterThan(0)
    expect(step).toMatch(/check-ssr-render-window\.mjs --strict/)
    // build:ssr 이 먼저 돌아야 산출물이 있다.
    expect(step).toMatch(/npm run build:ssr/)
  })

  it('🔴 반대 방향 — 빌드 체인은 실패를 삼킨다 (배포를 막지 않는다)', () => {
    const build = pkg().scripts.build
    expect(build).toContain('npm run check:ssr-render')
    // `|| echo …` 가 exit code 를 삼켜야 한다. 이것이 없으면 의존성 하나가 모듈 평가 중
    // window 를 읽는 날 main 배포가 통째로 멎는다(머리말 🧭).
    expect(build).toMatch(/npm run check:ssr-render \|\| echo/)
    expect(build).not.toMatch(/check:ssr-render --strict/)
  })

  it('🔴 스토리지 스텁이 이 시험과 같다 (갈리면 한쪽만 통과한다)', () => {
    const code = guard()
    for (const key of ['localStorage', 'sessionStorage', 'matchMedia']) {
      expect(code).toContain(`typeof globalThis.${key} === 'undefined'`)
    }
  })

  it('🔴 하네스의 `#root` 비우기가 속성을 허용한다 (리터럴이면 헛돈다)', () => {
    const vp = readCode('scripts/visual-preview.mjs')
    // 실제 태그는 `<div id="root" role="application" aria-label="…">` 다.
    expect(vp).toMatch(/<div id="root"\[\^>\]\*>/)
    expect(vp).not.toMatch(/<div id="root">\[/)
  })

  it('🔴 `entry-server` 머리말이 "lazy 는 safe" 로 돌아가지 않는다 (거짓이 된 문장)', () => {
    const raw = readRaw('src/entry-server.tsx')
    // allReady 는 lazy 모듈을 끝까지 평가한다 — 그 오해가 이 결함의 사각지대였다.
    expect(raw).toMatch(/lazy import 페이지도 안전하지 않다/)
  })
})
