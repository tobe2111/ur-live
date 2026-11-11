/**
 * ⚡ 재방문 즉시 표시 — 첫 방문에 저장 (2026-11-11 · 대표 *"계속 최적화"*)
 *
 * 실측(폰 4G·CPU 4배, 같은 브라우저로 홈 연속 방문): 1차 FCP 1.15s → 2차 0.89s(아직 네트워크) → 3차 0.24s(저장본).
 * SW 가 첫 문서 요청이 끝난 뒤 설치돼 그 화면을 못 보기 때문이다. 켜지는 순간(activate) 열린 창의 주소를 같은 울타리로
 * 걸러 저장본이 없을 때만 한 번 받아 둔다 → 2차부터 즉시.
 * 지키는 것: ① 허용 경로만 데운다(울타리 그대로) ② 저장본이 있으면 다시 받지 않는다 ③ 최대 3개 ④ 데우기 실패가 활성화를 막지 않는다.
 * 못 보는 것: 실제 브라우저에서 2차 방문이 저장본으로 뜨는지(배포 뒤 실측), 인앱 브라우저(카카오톡)의 SW 지원 여부.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('public/shell-sw.js', 'utf8')
const ORIGIN = 'https://urdeal.kr'

type Listener = (e: { waitUntil: (p: Promise<unknown>) => void }) => void
function boot(windows: string[], opts: { cached?: string[]; fetchFails?: boolean } = {}) {
  const listeners: Record<string, Listener> = {}
  const store = new Map<string, unknown>()
  for (const k of opts.cached || []) store.set(k, { ok: true })
  const fetched: string[] = []
  const cache = {
    match: async (req: { url: string } | string) => store.get(typeof req === 'string' ? req : req.url) ?? undefined,
    put: async (req: { url: string } | string, res: unknown) => { store.set(typeof req === 'string' ? req : req.url, res) },
    keys: async () => [...store.keys()].map((url) => ({ url })),
    delete: async () => true,
  }
  const self: Record<string, unknown> = {
    location: { origin: ORIGIN },
    addEventListener: (t: string, f: Listener) => { listeners[t] = f },
    clients: { claim: async () => {}, matchAll: async () => windows.map((url) => ({ url })) },
    registration: {},
  }
  const caches = { open: async () => cache, keys: async () => [], delete: async () => true }
  const fetchFn = async (url: string) => {
    fetched.push(url)
    if (opts.fetchFails) throw new Error('offline')
    return { status: 200, redirected: false, headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }), clone() { return this } }
  }
  class Req { url: string; constructor(u: string) { this.url = u } }
  class Res { body: unknown; constructor(b: unknown) { this.body = b } async json() { return JSON.parse(String(this.body)) } }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('self', 'caches', 'fetch', 'Response', 'Request', 'URL', 'Headers', SRC)(self, caches, fetchFn, Res, Req, URL, Headers)
  const activate = async () => { let p: Promise<unknown> = Promise.resolve(); listeners.activate({ waitUntil: (x) => { p = x } }); await p }
  return { activate, fetched, store, policy: self.__urShellPolicy as { warmMax: number } }
}

describe('첫 방문 데우기', () => {
  it('① 열린 창이 허용 경로면 그 화면을 한 번 받아 저장한다', async () => {
    const b = boot([`${ORIGIN}/`])
    await b.activate()
    expect(b.fetched).toEqual([`${ORIGIN}/`])
    expect([...b.store.keys()].some((k) => k === `${ORIGIN}/#guest`)).toBe(true)
  })
  it('① 허용 밖·쿼리 있는 주소·금지 경로는 받지 않는다', async () => {
    const b = boot([`${ORIGIN}/auth/kakao/start`, `${ORIGIN}/?ref=3`, `${ORIGIN}/admin`, `${ORIGIN}/checkout`])
    await b.activate()
    expect(b.fetched).toEqual([])
  })
  it('② 저장본이 이미 있으면 다시 받지 않는다', async () => {
    const b = boot([`${ORIGIN}/`], { cached: [`${ORIGIN}/#guest`] })
    await b.activate()
    expect(b.fetched).toEqual([])
  })
  it('③ 창이 많아도 최대 3개', async () => {
    const b = boot([`${ORIGIN}/`, `${ORIGIN}/vouchers`, `${ORIGIN}/stays`, `${ORIGIN}/life`, `${ORIGIN}/pass/1`])
    await b.activate()
    expect(b.policy.warmMax).toBe(3)
    expect(b.fetched.length).toBe(3)
  })
  it('④ 데우기가 실패해도 활성화는 끝난다', async () => {
    const b = boot([`${ORIGIN}/`], { fetchFails: true })
    await expect(b.activate()).resolves.toBeUndefined()
  })
})
