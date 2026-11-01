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
 * - prerender 가 산출물을 **옳게** 쓰는지(그건 `#root` 치환 로직의 몫).
 * - `renderToPipeableStream`(스트림) 경로의 런타임 동작 — 여기서는 `renderToString` 이다.
 *   ⚠️ 둘 다 같은 폴백을 그리므로 이 결함 클래스는 양쪽에서 같이 잡힌다.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'

// 🛡️ `scripts/prerender-main.mjs` 와 **같은** no-op 스토리지 스텁. 그 스크립트가 2026-06-04 에
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
