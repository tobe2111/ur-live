/**
 * 🔤 처음 오는 기기는 Pretendard 를 앱이 조작 가능해진 뒤에 받는다 — 근거·실측은 index.html 의 그 스크립트 주석.
 *
 * 재생 실측(느린 4G · CPU 4배, 3회 중간값, 첫 방문): 조작 가능 홈 6.0 → 4.5s · 이용권 상세 4.9 → 3.9s ·
 * 교환권 3.9 → 3.5s, 첫 페인트 불변. 폰트 한 벌이 17개 woff2 · 약 420KB 를 최우선순위로 받아 앱 스크립트와
 * 회선을 나눠 쓰던 것을 load 이후로 미룬다.
 *
 * 이 테스트가 고정하는 것(인라인 스크립트를 **실제로 돌린다**):
 *   ① 처음 오는 사람(표식 없음): 시트를 바로 끈다(media=print) → load 이후 한가할 때 켠다(media=all)
 *   ② 한 번 받은 사람(표식 있음): 아무것도 안 바꾼다 — 종전과 똑같이 처음부터 Pretendard
 *   ③ 저장소가 막힌 브라우저: 아무것도 안 바꾼다(표식을 못 세우면 매번 미루게 되므로 종전 동작이 낫다)
 *   ④ load 가 끝내 안 와도 백스톱으로 켠다 — 안 켜지면 그 사람은 영영 Pretendard 를 못 본다
 *   ⑤ 폰트가 실제로 받아진 뒤에만 표식을 세운다(시트가 아직 등록 전이면 다시 확인)
 *   ⑥ 위치 — 링크 바로 뒤(파서가 body 에 닿기 전에 꺼야 렌더 차단이 풀린다)
 *
 * ⚠️ 못 막는 것: 실제 체감(브라우저 실측 — 배포 후 E4) · 첫 방문의 글꼴 교체가 눈에 띄는 정도.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'

const HTML = readFileSync('index.html', 'utf8')
const SCRIPT = (HTML.match(/<script>(\(function\(\)\{try\{var l=document\.getElementById\('ur-font-css'\)[\s\S]*?)<\/script>/) || [])[1] || ''

type Store = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }

function run(opts: { storage: Store | 'throws'; ready?: DocumentReadyState; loaded?: () => unknown[]; rules?: Array<{ range: string; url: string }>; text?: string }) {
  const doc = document.implementation.createHTMLDocument('t')
  doc.head.innerHTML = '<link id="ur-font-css" rel="stylesheet" href="/static/fonts/x.css">'
  if (opts.text) doc.body.textContent = opts.text
  if (opts.rules) {
    const cssRules = opts.rules.map((r) => ({ type: 5, style: { getPropertyValue: (k: string) => (k === 'src' ? `url(${r.url}) format("woff2")` : k === 'unicode-range' ? r.range : '') } }))
    Object.defineProperty(doc.getElementById('ur-font-css')!, 'sheet', { configurable: true, value: { cssRules } })
  }
  Object.defineProperty(doc, 'readyState', { configurable: true, get: () => opts.ready ?? 'loading' })
  const fontsLoad = vi.fn(() => Promise.resolve(opts.loaded ? opts.loaded() : [{}]))
  Object.defineProperty(doc, 'fonts', { configurable: true, value: { load: fontsLoad } })
  const listeners: Record<string, () => void> = {}
  const win = {
    requestIdleCallback: (f: () => void) => setTimeout(f, 1),
    addEventListener: (t: string, f: () => void) => { listeners[t] = f },
  }
  const storage = opts.storage === 'throws'
    ? { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    : opts.storage
  // eslint-disable-next-line no-new-func
  new Function('document', 'window', 'localStorage', 'addEventListener', 'setTimeout', SCRIPT)(
    doc, win, storage, win.addEventListener, setTimeout,
  )
  const link = doc.getElementById('ur-font-css') as HTMLLinkElement
  return { link, fire: (t: string) => listeners[t]?.(), fontsLoad }
}

function mem(init: Record<string, string> = {}): Store & { data: Record<string, string> } {
  const data = { ...init }
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v } }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('📦 켤 때 필요한 조각을 먼저 받고 한 번에 켠다(재배치 한 번)', () => {
  const RULES = [
    { range: 'U+AC00-AC2B, U+AC2D', url: 'https://cdn.example/sub.1.woff2' },   // '가'(AC00) 포함
    { range: 'U+D55C', url: 'https://cdn.example/sub.2.woff2' },                // '한'(D55C) — 화면에 없음
    { range: 'U+0041-005A', url: 'https://cdn.example/sub.3.woff2' },           // 'A'
  ]
  it('화면 글자가 쓰는 조각만 preload 하고, 다 받기 전엔 켜지 않는다', async () => {
    const r = run({ storage: mem(), rules: RULES, text: '가A' })
    r.fire('load')
    await vi.advanceTimersByTimeAsync(10)
    const pre = [...r.link.ownerDocument.head.querySelectorAll('link[rel="preload"]')] as HTMLLinkElement[]
    expect(pre.every((x) => (x as unknown as { as: string }).as === 'font')).toBe(true)
    expect(pre.map((x) => x.href).sort()).toEqual(['https://cdn.example/sub.1.woff2', 'https://cdn.example/sub.3.woff2'])
    expect(pre.every((x) => x.crossOrigin === 'anonymous'), '폰트 요청과 캐시 키가 달라 두 번 받는다').toBe(true)
    expect(r.link.media, '조각이 오기 전에 켰다 — 조각마다 다시 배치한다').toBe('print')
    pre[0].onload?.(new Event('load'))
    expect(r.link.media).toBe('print')
    pre[1].onerror?.(new Event('error'))  // 실패도 끝으로 친다(그 조각은 브라우저가 다시 받는다)
    expect(r.link.media).toBe('all')
  })
  it('조각이 끝내 안 와도 8초 뒤엔 켠다', async () => {
    const r = run({ storage: mem(), rules: RULES, text: '가' })
    r.fire('load')
    await vi.advanceTimersByTimeAsync(10)
    expect(r.link.media).toBe('print')
    await vi.advanceTimersByTimeAsync(8000)
    expect(r.link.media).toBe('all')
  })
  it('화면 글자는 textContent 로 읽는다 — innerText 는 레이아웃을 강제한다(재생 실측 0.37초 긴 작업)', () => {
    expect(SCRIPT).not.toMatch(/innerText/)
    expect(SCRIPT).toMatch(/document\.body\.textContent/)
  })
  it('글자 대조는 정렬+이분 탐색 — 글자×범위 이중 반복은 그 자체로 0.3초 긴 작업이었다', () => {
    expect(SCRIPT).not.toMatch(/for\(var c in cs\)/)
    expect(SCRIPT).toMatch(/cs\.sort\(/)
  })
  it('범위 경계 글자도 정확히 잡는다(이분 탐색 off-by-one)', async () => {
    const r = run({ storage: mem(), rules: [{ range: 'U+AC2C-AC2D', url: 'https://cdn.example/edge.woff2' }, { range: 'U+AC2E', url: 'https://cdn.example/miss.woff2' }], text: '\uAC2D\uAC00' })
    r.fire('load')
    await vi.advanceTimersByTimeAsync(10)
    const pre = [...r.link.ownerDocument.head.querySelectorAll('link[rel="preload"]')].map((x) => (x as HTMLLinkElement).href)
    expect(pre).toEqual(['https://cdn.example/edge.woff2'])
  })
  it('시트를 못 읽으면(규칙 없음) 종전대로 바로 켠다', async () => {
    const r = run({ storage: mem(), text: '가' })
    r.fire('load')
    await vi.advanceTimersByTimeAsync(10)
    expect(r.link.media).toBe('all')
  })
})

describe('🔤 첫 방문 폰트 미루기', () => {
  it('스크립트가 있고 링크 바로 뒤다(0건이면 아래가 전부 헛돈다)', () => {
    expect(SCRIPT.length).toBeGreaterThan(200)
    const link = HTML.indexOf('id="ur-font-css"')
    const script = HTML.indexOf("getElementById('ur-font-css')")
    expect(link).toBeGreaterThan(0)
    // 링크와 스크립트 사이엔 주석만 — 다른 태그가 끼면 파서가 그 사이에 렌더를 기다릴 수 있다
    const between = HTML.slice(HTML.indexOf('/>', link), script).replace(/<!--[\s\S]*?-->/g, '')
    expect(between).not.toMatch(/<(?!script)[a-z]/i)
    // href 는 그대로(Early Hints Link 헤더 · 자가호스팅 가드가 이 경로를 대조한다)
    expect(HTML).toMatch(/id="ur-font-css"\s+rel="stylesheet"\s+href="\/static\/fonts\/pretendard-dynamic-subset-v1\.3\.9\.css"/)
  })

  it('① 처음 오는 사람 — 바로 끄고, load 뒤 한가할 때 켜고, 받은 뒤 표식을 세운다', async () => {
    const st = mem()
    const r = run({ storage: st })
    expect(r.link.media).toBe('print')
    vi.advanceTimersByTime(5000)
    expect(r.link.media).toBe('print') // load 전엔 안 켠다
    r.fire('load')
    await vi.advanceTimersByTimeAsync(10)
    expect(r.link.media).toBe('all')
    await vi.advanceTimersByTimeAsync(10)
    expect(st.data.ur_font_warm).toBe('1')
  })

  it('① 문서가 이미 complete 면 load 를 기다리지 않는다', async () => {
    const r = run({ storage: mem(), ready: 'complete' })
    await vi.advanceTimersByTimeAsync(10)
    expect(r.link.media).toBe('all')
  })

  it('② 한 번 받은 사람 — 손대지 않는다', () => {
    const r = run({ storage: mem({ ur_font_warm: '1' }) })
    expect(r.link.media).toBe('')
    vi.advanceTimersByTime(20000)
    expect(r.link.media).toBe('')
  })

  it('③ 저장소가 막혔으면 손대지 않는다', () => {
    const r = run({ storage: 'throws' })
    expect(r.link.media).toBe('')
  })

  it('④ load 가 끝내 안 와도 백스톱으로 켠다', async () => {
    const r = run({ storage: mem() })
    await vi.advanceTimersByTimeAsync(12001)
    expect(r.link.media).toBe('all')
  })

  it('⑤ 시트가 아직 등록 전이라 빈 결과면 다시 확인하고, 받은 뒤에만 표식을 세운다', async () => {
    const st = mem()
    let calls = 0
    const r = run({ storage: st, ready: 'complete', loaded: () => (++calls < 3 ? [] : [{}]) })
    await vi.advanceTimersByTimeAsync(10)
    expect(st.data.ur_font_warm).toBeUndefined()
    await vi.advanceTimersByTimeAsync(2100)
    expect(r.fontsLoad.mock.calls.length).toBe(3)
    expect(st.data.ur_font_warm).toBe('1')
  })
})
