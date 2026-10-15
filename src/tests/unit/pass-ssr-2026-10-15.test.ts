/**
 * 🧊 이용권 상세 서버 렌더 3단계 — 워커가 **앱 전체**를 그려 `#root` 에 넣고, 브라우저가 그 화면을 **이어받는다** (2026-10-15).
 *
 * 지키는 것
 *   ① 폰 · `/pass/:id` 에서만 그린다(서버는 화면 폭을 모른다 — 좁은 화면으로 그리므로 PC 는 종전 손그림).
 *   ② 같은 시드·주소면 엣지 캐시에서 꺼내고 서버 렌더 번들을 **부르지도 않는다**. 주소(쿼리)가 다르면 다시 그린다.
 *   ③ 번들이 없거나(스텁) 이상하게 짧으면 null — 호출부가 종전 첫 화면으로 폴백(무회귀).
 *   ④ 앱이 붙기 전에 누른 '구매하기' 를 기억했다가 붙자마자 창을 연다. 붙은 뒤엔 가로채지 않는다.
 *   ⑤ 배선 — 워커가 `#root` 에 표식을 달고 스크립트를 **바깥**에 둔다 · 브라우저가 표식을 보고 이어받는다 · 빌드 순서 · CI.
 * 못 보는 것: 실제 번들이 그리는 내용(→ `scripts/check-pass-ssr-smoke.mjs`, CI 에서 빌드 뒤) · 이어받기가 안 갈리는지
 *   (→ `app-hydrate-2026-10-15.test.tsx`) · 라이브 속도와 갈림 수(→ 배포 뒤 실측 · HYD 표본).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { readCode } from '@/tests/helpers/source-text'
import { BOOT_FIRST_SCREEN_ID } from '@/lib/boot-first-screen'
import { consumeEarlyTap } from '@/lib/early-tap'

const render = vi.fn(async (_p: unknown, _url: string) => `<div class="gbd">${'가'.repeat(6000)}<button data-early-tap="buy">구매하기</button></div>`)
vi.mock('virtual:pass-ssr', () => ({ get renderPassApp() { return render } }))

const { passDetailSsr, isPassSsrPath, earlyTapScript, SSR_APP_ATTR, SSR_APP_VALUE, localeCorePreload } = await import('@/worker/utils/pass-ssr')

const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36'
const payload = JSON.stringify({ success: true, data: { id: 2919, name: '달빛한스푼 닭도리탕', price: 31000 } })

function fakeCache() {
  const store = new Map<string, string>()
  return {
    store,
    match: vi.fn(async (r: Request) => (store.has(r.url) ? new Response(store.get(r.url)) : undefined)),
    put: vi.fn(async (r: Request, res: Response) => { store.set(r.url, await res.text()) }),
  }
}
const opts = (o: Partial<Parameters<typeof passDetailSsr>[0]> = {}) => ({ payload, pathname: '/pass/2919', search: '', userAgent: PHONE, nonce: 'abc123', origin: 'https://urdeal.kr', ...o })

beforeEach(() => { render.mockClear(); vi.unstubAllGlobals() })

describe('① 폰 · /pass/:id 에서만', () => {
  it.each([['/pass/2919', true], ['/pass/2919/x', false], ['/vouchers/1', false], ['/group-buy/2919', false], ['/pass/', false]])('%s → %s', (p, want) => {
    expect(isPassSsrPath(p)).toBe(want)
  })
  it('PC UA 면 그리지 않는다', async () => {
    expect(await passDetailSsr(opts({ userAgent: DESKTOP }))).toBeNull()
    expect(render).not.toHaveBeenCalled()
  })
  it('시드가 깨졌거나 이름이 없으면 그리지 않는다', async () => {
    expect(await passDetailSsr(opts({ payload: '{' }))).toBeNull()
    expect(await passDetailSsr(opts({ payload: JSON.stringify({ data: { id: 1 } }) }))).toBeNull()
  })
})

describe('② #root 에 넣을 앱 HTML + 바깥에 둘 스크립트', () => {
  it('그린 HTML 을 그대로(감싸지 않고) 돌려준다 — 감싸면 React 가 모르는 노드라 이어받기가 갈린다', async () => {
    const out = (await passDetailSsr(opts({ search: '?ref=7' })))!
    expect(out.root.startsWith('<div class="gbd">')).toBe(true)
    expect(out.root).not.toContain('<script')
    expect(out.after).toContain('<script nonce="abc123">')
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ id: 2919 }), '/pass/2919?ref=7')
  })
  it('표식은 브라우저가 이어받기를 판정하는 값과 같다', () => {
    expect(`${SSR_APP_ATTR}=${SSR_APP_VALUE}`).toBe('data-ssr=app')
    expect(readCode('src/main.tsx')).toMatch(/rootElement\.getAttribute\('data-ssr'\) === 'app'/)
  })
  it('한국어 core 문구 미리받기 — rel 은 받은 값(CSS 먼저 부팅이면 지연 rel), 파일이 없으면 빈 문자열', () => {
    expect(localeCorePreload('modulepreload', '/assets/locale-ko-x.js')).toBe('<link rel="modulepreload" crossorigin href="/assets/locale-ko-x.js">')
    expect(localeCorePreload('ur-modulepreload', '/assets/locale-ko-x.js')).toContain('rel="ur-modulepreload"')
    expect(localeCorePreload('modulepreload', '')).toBe('')
    expect(localeCorePreload('a" onload="x', '/a.js')).not.toContain('"x')
  })
  it('워커가 그 링크를 라우트 청크 미리받기 옆(head)에 같은 rel 규칙으로 단다 — body 에 두면 CSS 먼저 부팅이 못 깨운다', () => {
    const w = readCode('src/worker/index.ts')
    const head = w.slice(w.indexOf("if (routeChunks) {"), w.indexOf('if (ssrPayload) {', w.indexOf("if (routeChunks) {")))
    expect(head).toMatch(/el\.append\(localeCorePreload\(routePreloadRel\(cssFirst\)\), \{ html: true \}\)/)
    expect(readCode('src/worker/utils/pass-ssr.ts')).not.toMatch(/after: localeCorePreload/)
  })
  it('생성기가 매니페스트에서 한국어 core 문구 청크 이름을 뽑는다', () => {
    const g = readFileSync('scripts/generate-route-chunk-map.mjs', 'utf8')
    expect(g).toMatch(/LOCALE_CORE_KEY = 'public\/locales\/ko\/translation\.json\?i18n-core'/)
    expect(g).toMatch(/export const LOCALE_CORE: string = \$\{JSON\.stringify\(localeCore\)\}/)
    expect(readCode('src/i18n.ts')).toMatch(/ko: \(\) => import\('\.\.\/public\/locales\/ko\/translation\.json\?i18n-core'\)/)
  })
  it('nonce 에 이상한 글자가 와도 속성을 깨지 못한다', () => {
    expect(earlyTapScript('a"><script>x')).toMatch(/^<script nonce="ascriptx">/)
  })
})

describe('③ 캐시 — 같은 시드면 번들을 부르지 않는다', () => {
  it('두 번째 요청은 캐시에서', async () => {
    const c = fakeCache(); vi.stubGlobal('caches', { default: c })
    const a = await passDetailSsr(opts())
    const b = await passDetailSsr(opts())
    expect(a).toEqual(b)
    expect(render).toHaveBeenCalledTimes(1)
    expect(c.put).toHaveBeenCalledTimes(1)
  })
  it('주소(쿼리)가 다르면 다시 그린다 — 그리는 내용이 쿼리에 따라 갈릴 수 있다', async () => {
    const c = fakeCache(); vi.stubGlobal('caches', { default: c })
    await passDetailSsr(opts())
    await passDetailSsr(opts({ search: '?new=1' }))
    expect(render).toHaveBeenCalledTimes(2)
  })
  it('시드가 바뀌면(가격) 키가 바뀌어 다시 그린다', async () => {
    const c = fakeCache(); vi.stubGlobal('caches', { default: c })
    await passDetailSsr(opts())
    await passDetailSsr(opts({ payload: payload.replace('31000', '29000') }))
    expect(render).toHaveBeenCalledTimes(2)
  })
  it('이상하게 짧은 결과는 쓰지도 저장하지도 않는다', async () => {
    const c = fakeCache(); vi.stubGlobal('caches', { default: c })
    render.mockImplementationOnce(async () => '<div>loading</div>')
    expect(await passDetailSsr(opts())).toBeNull()
    expect(c.put).not.toHaveBeenCalled()
  })
  it('렌더가 던지면 null (폴백)', async () => {
    render.mockImplementationOnce(async () => { throw new Error('boom') })
    expect(await passDetailSsr(opts())).toBeNull()
  })
})

describe('④ 앱이 붙기 전 누름', () => {
  it('스크립트가 data-early-tap 버튼 누름을 기록하고 전파를 멈추며, consumeEarlyTap 이 한 번만 꺼낸다', () => {
    const w = window as unknown as { __urEarlyTap?: string | null; __urHydrated?: boolean }
    delete w.__urEarlyTap; delete w.__urHydrated
    document.body.innerHTML = `<div id="root"><button data-early-tap="buy"><span id="in">구매하기</span></button><a id="link" href="#x">가게</a></div><button id="out" data-early-tap="buy">밖</button>`
    const reactSaw = vi.fn()
    document.getElementById('root')!.addEventListener('click', reactSaw) // React 는 #root 에서 듣는다
    const js = earlyTapScript('n').replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
    new Function(js)()
    document.getElementById('link')!.click()
    expect(w.__urEarlyTap).toBeUndefined()
    document.getElementById('out')!.click() // #root 밖은 건드리지 않는다
    expect(w.__urEarlyTap).toBeUndefined()
    document.getElementById('in')!.click()
    expect(reactSaw, '이어받는 React 가 같은 클릭을 또 받으면 창이 두 번 토글된다').toHaveBeenCalledTimes(1) // 링크 클릭만
    expect(consumeEarlyTap('back')).toBe(false)
    expect(consumeEarlyTap('buy')).toBe(true)
    expect(consumeEarlyTap('buy')).toBe(false)
    // 꺼낸 뒤(= 버튼이 이어받아진 뒤)엔 가로채지 않는다 — React 가 직접 받는다
    document.getElementById('in')!.click()
    expect(w.__urEarlyTap).toBeNull()
    expect(reactSaw).toHaveBeenCalledTimes(2)
    document.body.innerHTML = ''
  })
  it('구매 바가 버튼에 표시를 달고, 마운트 때 꺼내 창을 연다', () => {
    const bar = readCode('src/pages/group-buy/DealBottomBar.tsx')
    expect(bar).toMatch(/\[EARLY_TAP_ATTR\]: isPrelaunch \|\| !isJoinable \? undefined : 'buy'/)
    expect(bar).toMatch(/consumeEarlyTap\('buy'\) && isJoinable && !isPrelaunch\) setOpen\(true\)/)
  })
})

describe('⑤ 배선', () => {
  it('워커 상세 분기가 서버 렌더를 먼저, 실패하면 종전 손그림', () => {
    const w = readCode('src/worker/index.ts')
    expect(w).toMatch(/const appSsr = await passDetailSsr\(\{[^}]*search: url\.search[^}]*\}\)/)
    expect(w).toMatch(/const firstScreen = appSsr \? '' : buildDetailFirstScreen\(ssrPayload, urdealLoaderHtml, url\.search\)/)
  })
  it('워커가 #root 에 표식을 달고, 스크립트는 #root 바깥(after)에 둔다', () => {
    const w = readCode('src/worker/index.ts')
    expect(w).toMatch(/if \(appSsr\) \{ el\.setAttribute\(SSR_APP_ATTR, SSR_APP_VALUE\); el\.after\(appSsr\.after, \{ html: true \}\); \}/)
    expect(w).toMatch(/el\.setInnerContent\(appSsr \? appSsr\.root : /)
  })
  it('브라우저는 표식이 있고 문구가 준비되면 이어받는다(아니면 종전처럼 새로 그린다)', () => {
    const m = readCode('src/main.tsx')
    expect(m).toMatch(/await waitAtMost\(i18nReady, 3000\)\) && i18n\.language === 'ko'\) \{/)
    expect(m).toMatch(/ReactDOM\.hydrateRoot\(rootElement, <ThemeProvider><App \/><\/ThemeProvider>/)
    expect(m).toMatch(/reportHydration\(mismatches\)/)
  })
  it('배포 빌드가 서버 렌더 번들을 워커보다 먼저 만든다', () => {
    const b = JSON.parse(readFileSync('package.json', 'utf8')).scripts.build as string
    const i = b.indexOf('build:ssr-pass'), j = b.indexOf('build:worker')
    expect(i, 'build 에 build:ssr-pass 가 없다 — 워커가 스텁을 묶어 서버 렌더가 조용히 꺼진다').toBeGreaterThan(-1)
    expect(i).toBeLessThan(j)
  })
  it('CI(Verify)도 워커 빌드 전에 번들을 만들고 스모크를 돈다', () => {
    const v = readFileSync('.github/workflows/verify.yml', 'utf8')
    const a = v.indexOf('run: npm run build:ssr-pass'), b = v.indexOf('run: npm run build:worker'), s = v.indexOf('check-pass-ssr-smoke.mjs')
    expect(a).toBeGreaterThan(-1); expect(a).toBeLessThan(b); expect(s).toBeGreaterThan(a)
  })
  it('워커 빌드가 virtual:pass-ssr 를 실제 번들로 푼다', () => {
    const w = readCode('scripts/build-worker.js')
    expect(w).toMatch(/onResolve\(\{ filter: \/\^virtual:pass-ssr\$\/ \}/)
    expect(w).toMatch(/plugins: \[passSsrPlugin\]/)
    expect(w).toMatch(/'__SSR_BUILD__': JSON\.stringify/)
  })
})
