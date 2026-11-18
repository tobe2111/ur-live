/**
 * 🩹 2026-11-18 — 화면 요청이 터지면 JSON 이 아니라 앱 화면을 준다 (Sentry JAVASCRIPT-REACT-38).
 *
 * 그날 GET `/` 하나가 Cloudflare 런타임 내부 일시 오류(`internal error; reference=…`)로 예외를 던졌고,
 * 전역 오류 처리기가 **화면 요청에도 JSON 500** 을 돌려줘서 손님은 홈 대신 영어 오류 글자를 봤다.
 * 그 오류 자체는 플랫폼 쪽이라 막을 수 없다 — 막을 수 있는 건 손님이 보는 것이다.
 *
 * 이 시험은 진짜 Hono 앱에 진짜 처리기를 달고 일부러 던진다:
 *   R1 화면 요청 → SPA 셸(200, HTML)  · R2 셸도 못 받으면 한국어 안내(503 + Retry-After)
 *   R3 API·비GET·파일 요청 → 종전 그대로 JSON(앱의 api 클라이언트가 JSON 을 기대한다)
 *   R4 4xx 는 손대지 않는다(없는 화면을 셸로 덮으면 404 가 사라진다)
 * ⚠️ 못 보는 것: 실제 Pages 의 ASSETS 바인딩 동작(여기선 흉내) · 오류가 바깥 미들웨어(CSP 등)를 거치는지.
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { globalErrorHandler, isPageRequest } from '@/worker/middleware/error-handler'

const SHELL = '<!doctype html><html><body><div id="root"></div></body></html>'

function makeApp(kind: 'internal' | 'notfound' = 'internal') {
  const app = new Hono()
  app.onError(globalErrorHandler as never)
  app.all('*', () => {
    if (kind === 'notfound') throw new HTTPException(404, { message: 'nope' })
    throw new Error('internal error; reference = 71930j2jahb3mlg6tdbidun4')
  })
  return app
}
const assetsOk = { ASSETS: { fetch: async () => new Response(SHELL, { headers: { 'content-type': 'text/html; charset=utf-8' } }) } }
const assetsDown = { ASSETS: { fetch: async () => { throw new Error('internal error; reference = x') } } }
const HTML = { accept: 'text/html,application/xhtml+xml' }

describe('🔴 R1 — 화면 요청이 터지면 앱 셸을 준다', () => {
  it('GET / → 200 HTML 셸 (JSON 아님)', async () => {
    const res = await makeApp().request('/', { headers: HTML }, assetsOk)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toBe(SHELL)
    expect(res.headers.get('cache-control')).toContain('no-store')
  })
  it('딥 링크(/group-buy/12)도 같은 셸', async () => {
    const res = await makeApp().request('/group-buy/12', { headers: HTML }, assetsOk)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(SHELL)
  })
})

describe('🔴 R2 — 셸도 못 받으면 한국어 안내 + 자동 재시도', () => {
  it('ASSETS 가 터지면 503 안내 페이지', async () => {
    const res = await makeApp().request('/', { headers: HTML }, assetsDown)
    expect(res.status).toBe(503)
    expect(res.headers.get('retry-after')).toBe('5')
    const body = await res.text()
    expect(body).toContain('잠시 연결이 불안정해요')
    expect(body).toContain('http-equiv="refresh"')
  })
  it('ASSETS 바인딩이 없어도 안내 페이지(JSON 아님)', async () => {
    const res = await makeApp().request('/', { headers: HTML }, {})
    expect(res.status).toBe(503)
    expect(res.headers.get('content-type')).toContain('text/html')
  })
})

describe('🔴 R3 — 화면이 아닌 요청은 종전 그대로 JSON', () => {
  it('API 는 JSON 500', async () => {
    const res = await makeApp().request('/api/products', { headers: HTML }, assetsOk)
    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toContain('application/json')
  })
  it('POST 화면 경로도 JSON', async () => {
    const res = await makeApp().request('/', { method: 'POST', headers: HTML }, assetsOk)
    expect(res.headers.get('content-type')).toContain('application/json')
  })
  it('text/html 을 안 받는 요청(fetch 기본)은 JSON', async () => {
    const res = await makeApp().request('/', { headers: { accept: '*/*' } }, assetsOk)
    expect(res.headers.get('content-type')).toContain('application/json')
  })
  it('판정표', () => {
    expect(isPageRequest('GET', '/', 'text/html')).toBe(true)
    expect(isPageRequest('GET', '/u/abc', 'text/html,*/*')).toBe(true)
    expect(isPageRequest('GET', '/sitemap.xml', 'text/html')).toBe(false)
    expect(isPageRequest('GET', '/assets/x.js', 'text/html')).toBe(false)
    expect(isPageRequest('GET', '/auth/kakao/callback', 'text/html')).toBe(false)
    expect(isPageRequest('HEAD', '/', 'text/html')).toBe(false)
  })
})

describe('🔴 R4 — 4xx 는 손대지 않는다', () => {
  it('404 는 셸로 덮지 않는다', async () => {
    const res = await makeApp('notfound').request('/', { headers: HTML }, assetsOk)
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
  })
})
