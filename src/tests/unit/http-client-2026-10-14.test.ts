/**
 * 🪶 http-client — axios 대체가 **axios 와 같은 동작**을 하는가 〔2026-10-14〕
 *
 * 호출부 수백 곳이 axios 의 모양(`res.data` · `err.response?.status` · `err.code`)에 기대고 있고,
 * params 직렬화 문자열은 **엣지 캐시 키·cron 예열 키**다. 하나라도 어긋나면 에러 없이 캐시가 안 맞거나
 * 401 처리가 안 돈다. ⇒ 직렬화는 **진짜 axios 가 낸 문자열**을 그대로 박아 대조하고(2026-10-14 axios 1.20.0
 * `getUri` 실측), 전송·인터셉터는 가짜 XHR 로 동작을 잰다.
 *
 * 못 막는 것: 실제 브라우저 XHR 의 쿠키·CORS(가짜 XHR 이라 안 보인다) · 업로드 진행률의 실제 수치.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildURL, createHttp, isHttpError, HttpError } from '@/lib/http-client'

describe('① params 직렬화 = axios 1.20.0 getUri 실측값', () => {
  const D = new Date(Date.UTC(2026, 0, 2, 3, 4, 5))
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ['/api/products', { status: 'active', category: '커피/음료', sort: 'price_low', deal_only: 1 },
      '/api/products?status=active&category=%EC%BB%A4%ED%94%BC%2F%EC%9D%8C%EB%A3%8C&sort=price_low&deal_only=1'],
    ['/api/x', { a: 'a b,c:d$e', b: null, c: undefined, d: true, e: 0 }, '/api/x?a=a+b,c:d$e&d=true&e=0'],
    ['/api/x?z=1', { ids: [1, 2, null, 3] }, '/api/x?z=1&ids%5B%5D=1&ids%5B%5D=2&ids%5B%5D=3'],
    ['/api/x#h', { f: { g: 1, h: 'x' } }, '/api/x?f%5Bg%5D=1&f%5Bh%5D=x'],
    ['/api/x', { dt: D }, '/api/x?dt=2026-01-02T03:04:05.000Z'],
    ['/api/x', { q: "it's (ok)~!*" }, "/api/x?q=it's+(ok)~!*"],
    ['/api/x', { 'k[]': ['a', 'b'] }, '/api/x?k%5B%5D=a&k%5B%5D=b'],
    ['/api/x', {}, '/api/x'],
  ]
  for (const [u, p, want] of cases) it(`${u} ${JSON.stringify(p)}`, () => expect(buildURL(u, p)).toBe(want))
})

// ── 가짜 XHR ─────────────────────────────────────────────────────────────
type Fake = {
  method: string; url: string; headers: Record<string, string>; body: unknown; withCredentials: boolean
  timeout: number; responseType: string; aborted: boolean
}
let sent: Fake[] = []
let reply: (x: FakeXHR) => void = () => {}
class FakeXHR {
  method = ''; url = ''; headers: Record<string, string> = {}; body: unknown; withCredentials = false
  timeout = 0; responseType = ''; status = 0; statusText = ''; responseText = ''; response: unknown = null
  resHeaders = ''; aborted = false
  upload = { addEventListener() {} }
  onload?: () => void; onerror?: () => void; ontimeout?: () => void; onabort?: () => void
  open(m: string, u: string) { this.method = m; this.url = u }
  setRequestHeader(k: string, v: string) { this.headers[k] = v }
  addEventListener() {}
  getAllResponseHeaders() { return this.resHeaders }
  abort() { this.aborted = true }
  send(b: unknown) { this.body = b; sent.push(this as unknown as Fake); queueMicrotask(() => reply(this)) }
  respond(status: number, body: string, headers = 'content-type: application/json\r\nx-a: 1') {
    this.status = status; this.statusText = String(status); this.responseText = body; this.response = body
    this.resHeaders = headers; this.onload?.()
  }
}
const realXHR = globalThis.XMLHttpRequest
beforeEach(() => { sent = []; (globalThis as any).XMLHttpRequest = FakeXHR })
afterEach(() => { (globalThis as any).XMLHttpRequest = realXHR })

describe('② 전송 — 모양이 axios 와 같다', () => {
  it('baseURL · params · 기본 헤더 · JSON 파싱 · 응답 헤더 소문자', async () => {
    reply = x => x.respond(200, '{"ok":1}', 'Content-Type: application/json\r\nX-A: 1')
    const api = createHttp({ baseURL: '/', timeout: 15000, withCredentials: true, headers: { 'Content-Type': 'application/json' } })
    const r = await api.get('/api/x', { params: { a: 1 } })
    expect(r.data).toEqual({ ok: 1 })
    expect(r.status).toBe(200)
    expect(r.headers['x-a']).toBe('1')
    expect(sent[0].url).toBe('/api/x?a=1')
    expect(sent[0].method).toBe('GET')
    expect(sent[0].withCredentials).toBe(true)
    expect(sent[0].timeout).toBe(15000)
    // 데이터 없는 GET 엔 Content-Type 을 안 보낸다(axios 와 같다)
    expect(Object.keys(sent[0].headers).map(k => k.toLowerCase())).not.toContain('content-type')
    expect(sent[0].headers.Accept).toBe('application/json, text/plain, */*')
  })
  it('객체 본문은 JSON 문자열 · FormData 는 Content-Type 을 지워 브라우저에 맡긴다', async () => {
    reply = x => x.respond(200, '')
    const api = createHttp({ headers: { 'Content-Type': 'application/json' } })
    await api.post('/a', { x: 1 })
    expect(sent[0].body).toBe('{"x":1}')
    expect(sent[0].headers['Content-Type']).toBe('application/json')
    const fd = new FormData(); fd.append('f', 'v')
    await api.post('/b', fd)
    expect(sent[1].body).toBe(fd)
    expect(Object.keys(sent[1].headers).map(k => k.toLowerCase())).not.toContain('content-type')
  })
  it('파싱 안 되는 본문은 문자열 그대로(axios silentJSONParsing)', async () => {
    reply = x => x.respond(200, 'plain text')
    expect((await createHttp().get('/a')).data).toBe('plain text')
  })
  it('responseType 은 그대로 XHR 에 넘긴다(blob 다운로드)', async () => {
    reply = x => { x.response = new Blob(['a']); x.status = 200; x.onload?.() }
    const r = await createHttp().get('/csv', { responseType: 'blob' })
    expect(sent[0].responseType).toBe('blob')
    expect(r.data).toBeInstanceOf(Blob)
  })
})

describe('③ 에러 — 호출부가 읽는 필드', () => {
  it('2xx 밖이면 reject · isAxiosError · response.status/data · config', async () => {
    reply = x => x.respond(401, '{"code":"SESSION_SUPERSEDED"}')
    const e = await createHttp().get('/a').catch(err => err)
    expect(isHttpError(e)).toBe(true)
    expect(e.isAxiosError).toBe(true)
    expect(e.response.status).toBe(401)
    expect(e.response.data.code).toBe('SESSION_SUPERSEDED')
    expect(e.config.url).toBe('/a')
    expect(e.code).toBe('ERR_BAD_REQUEST')
  })
  it('validateStatus 로 4xx 를 받아들일 수 있다', async () => {
    reply = x => x.respond(404, '{}')
    const r = await createHttp().get('/a', { validateStatus: () => true })
    expect(r.status).toBe(404)
  })
  it('시간 초과는 ECONNABORTED · 네트워크 오류는 응답 없음', async () => {
    reply = x => x.ontimeout?.()
    const t = await createHttp().get('/a', { timeout: 5 }).catch(e => e)
    expect(t.code).toBe(HttpError.ECONNABORTED)
    expect(t.response).toBeUndefined()
    reply = x => x.onerror?.()
    const n = await createHttp().get('/a').catch(e => e)
    expect(n.code).toBe('ERR_NETWORK')
    expect(n.response).toBeUndefined()
  })
  it('signal 로 취소된다', async () => {
    reply = () => {}
    const ac = new AbortController()
    const p = createHttp().get('/a', { signal: ac.signal }).catch(e => e)
    await new Promise(r => setTimeout(r, 0))   // 전송까지 간 뒤 취소
    ac.abort()
    const e = await p
    expect(e.code).toBe('ERR_CANCELED')
    expect(sent[0].aborted).toBe(true)
  })
  it('이미 취소된 signal 이면 보내지도 않는다', async () => {
    const ac = new AbortController(); ac.abort()
    const e = await createHttp().get('/a', { signal: ac.signal }).catch(err => err)
    expect(e.code).toBe('ERR_CANCELED')
    expect(sent.length).toBe(0)
  })
})

describe('④ 인터셉터 — axios 와 같은 순서 · 재시도', () => {
  it('요청 인터셉터는 나중에 등록한 것이 먼저(axios 와 같다)', async () => {
    reply = x => x.respond(200, '{}')
    const order: string[] = []
    const api = createHttp()
    api.interceptors.request.use(c => { order.push('first'); return c })
    api.interceptors.request.use(async c => { order.push('second'); c.headers.Authorization = 'Bearer t'; return c })
    await api.get('/a')
    expect(order).toEqual(['second', 'first'])
    expect(sent[0].headers.Authorization).toBe('Bearer t')
  })
  it('응답 거절 핸들러가 api(config) 로 재시도한다(401 → 갱신 → 재요청 모양)', async () => {
    let n = 0
    reply = x => (n++ === 0 ? x.respond(401, '{}') : x.respond(200, '{"ok":true}'))
    const api = createHttp()
    api.interceptors.response.use(r => r, async err => {
      const cfg = err.config
      if (err.response?.status === 401 && !cfg._retry) { cfg._retry = true; cfg.headers.Authorization = 'Bearer new'; return api(cfg) }
      return Promise.reject(err)
    })
    const r = await api.get('/a')
    expect(r.data).toEqual({ ok: true })
    expect(sent.length).toBe(2)
    expect(sent[1].headers.Authorization).toBe('Bearer new')
  })
  it('요청 인터셉터가 던지면 응답 거절 핸들러로 간다', async () => {
    const api = createHttp()
    api.interceptors.request.use(() => { throw new Error('boom') })
    let seen = ''
    api.interceptors.response.use(r => r, e => { seen = e.message; return Promise.reject(e) })
    await api.get('/a').catch(() => {})
    expect(seen).toBe('boom')
    expect(sent.length).toBe(0)
  })
})

describe('⑤ 배선 — 앱 코드가 axios 를 다시 끌어오지 않는다', () => {
  const root = process.cwd()
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? (e.name === 'tests' || e.name === 'worker' ? [] : walk(path.join(d, e.name)))
      : /\.(tsx?|mjs|js)$/.test(e.name) ? [path.join(d, e.name)] : [])
  it("src(테스트·워커 제외)에 'axios' import 0건", () => {
    const files = walk(path.join(root, 'src'))
    expect(files.length).toBeGreaterThan(500)
    const hits = files.filter(f => /from\s+['"]axios['"]|import\(\s*['"]axios['"]\s*\)/.test(fs.readFileSync(f, 'utf8')))
    expect(hits).toEqual([])
  })
  it('api 인스턴스는 http-client 로 만든다', () => {
    const s = fs.readFileSync(path.join(root, 'src/lib/api.ts'), 'utf8')
    expect(s).toMatch(/const api = createHttp\(\{/)
    expect(s).toMatch(/from '\.\/http-client'/)
  })
})
