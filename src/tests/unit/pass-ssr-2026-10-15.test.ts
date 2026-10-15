/**
 * 🧊 이용권 상세 서버 렌더 3단계 — 워커가 리액트 그대로 그린 상세를 첫 화면으로 보낸다 (2026-10-15).
 *
 * 지키는 것
 *   ① 폰 · `/pass/:id` 에서만 그린다(PC 는 상단 네비가 더해져 밀리므로 종전 손그림).
 *   ② 같은 시드면 엣지 캐시에서 꺼내고 서버 렌더 번들을 **부르지도 않는다**.
 *   ③ 번들이 없거나(스텁) 이상하게 짧으면 '' — 호출부가 종전 첫 화면으로 폴백(무회귀).
 *   ④ 앱이 붙기 전에 누른 '구매하기' 를 기억했다가 붙자마자 창을 연다.
 *   ⑤ 배선 — 워커 분기 · 빌드 순서(서버 렌더 번들이 워커보다 먼저) · CI 단계.
 * 못 보는 것: 실제 번들이 그리는 내용(→ `scripts/check-pass-ssr-smoke.mjs`, CI 에서 빌드 뒤) · 라이브 속도(→ 배포 뒤 실측).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { readCode } from '@/tests/helpers/source-text'
import { BOOT_FIRST_SCREEN_ID } from '@/lib/boot-first-screen'
import { consumeEarlyTap } from '@/lib/early-tap'

const render = vi.fn((_p: unknown, _path: string) => `<div class="gbd">${'가'.repeat(3000)}<button data-early-tap="buy">구매하기</button></div>`)
vi.mock('virtual:pass-ssr', () => ({ get renderPassDetail() { return render } }))

const { passDetailSsr, isPassSsrPath, earlyTapScript, PASS_SSR_NODE_ID } = await import('@/worker/utils/pass-ssr')

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
const opts = (o: Partial<Parameters<typeof passDetailSsr>[0]> = {}) => ({ payload, pathname: '/pass/2919', userAgent: PHONE, nonce: 'abc123', origin: 'https://urdeal.kr', ...o })

beforeEach(() => { render.mockClear(); vi.unstubAllGlobals() })

describe('① 폰 · /pass/:id 에서만', () => {
  it.each([['/pass/2919', true], ['/pass/2919/x', false], ['/vouchers/1', false], ['/group-buy/2919', false], ['/pass/', false]])('%s → %s', (p, want) => {
    expect(isPassSsrPath(p)).toBe(want)
  })
  it('PC UA 면 그리지 않는다', async () => {
    expect(await passDetailSsr(opts({ userAgent: DESKTOP }))).toBe('')
    expect(render).not.toHaveBeenCalled()
  })
  it('시드가 깨졌거나 이름이 없으면 그리지 않는다', async () => {
    expect(await passDetailSsr(opts({ payload: '{' }))).toBe('')
    expect(await passDetailSsr(opts({ payload: JSON.stringify({ data: { id: 1 } }) }))).toBe('')
  })
})

describe('② 첫 화면 노드 + 누름 기억 스크립트', () => {
  it('노드 id 는 클라 부팅이 붙잡는 id 와 같다', () => {
    expect(PASS_SSR_NODE_ID).toBe(BOOT_FIRST_SCREEN_ID)
  })
  it('그린 HTML 을 노드로 감싸고 nonce 붙은 스크립트를 뒤에 둔다', async () => {
    const out = await passDetailSsr(opts())
    expect(out.startsWith(`<div id="${BOOT_FIRST_SCREEN_ID}">`)).toBe(true)
    expect(out).toContain('<script nonce="abc123">')
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ id: 2919 }), '/pass/2919')
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
    expect(a).toBe(b)
    expect(render).toHaveBeenCalledTimes(1)
    expect(c.put).toHaveBeenCalledTimes(1)
  })
  it('시드가 바뀌면(가격) 키가 바뀌어 다시 그린다', async () => {
    const c = fakeCache(); vi.stubGlobal('caches', { default: c })
    await passDetailSsr(opts())
    await passDetailSsr(opts({ payload: payload.replace('31000', '29000') }))
    expect(render).toHaveBeenCalledTimes(2)
  })
  it('이상하게 짧은 결과는 쓰지도 저장하지도 않는다', async () => {
    const c = fakeCache(); vi.stubGlobal('caches', { default: c })
    render.mockImplementationOnce(() => '<div>loading</div>')
    expect(await passDetailSsr(opts())).toBe('')
    expect(c.put).not.toHaveBeenCalled()
  })
  it('렌더가 던지면 "" (폴백)', async () => {
    render.mockImplementationOnce(() => { throw new Error('boom') })
    expect(await passDetailSsr(opts())).toBe('')
  })
})

describe('④ 앱이 붙기 전 누름', () => {
  it('스크립트가 data-early-tap 버튼 누름을 기록하고, consumeEarlyTap 이 한 번만 꺼낸다', () => {
    document.body.innerHTML = `<div id="${BOOT_FIRST_SCREEN_ID}"><button data-early-tap="buy"><span id="in">구매하기</span></button><a id="link" href="#x">가게</a></div>`
    const js = earlyTapScript('n').replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
    new Function(js)()
    document.getElementById('link')!.click()
    expect((window as unknown as { __urEarlyTap?: string }).__urEarlyTap).toBeUndefined()
    document.getElementById('in')!.click()
    expect(consumeEarlyTap('back')).toBe(false)
    expect(consumeEarlyTap('buy')).toBe(true)
    expect(consumeEarlyTap('buy')).toBe(false)
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
    expect(readCode('src/worker/index.ts')).toMatch(/\(await passDetailSsr\(\{[^}]*\}\)\) \|\| buildDetailFirstScreen\(ssrPayload, urdealLoaderHtml, url\.search\)/)
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
