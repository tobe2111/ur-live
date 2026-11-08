/**
 * ⚡ 2026-11-05 — 로그인 화면(마이 · 내 이용권)의 데이터를 **HTML 이 오자마자** 출발시키고, 앱은 같은 주소를 처음 부를 때 꺼내 쓴다.
 * 지키는 것: ① 세션 쿠키 없으면 아무것도 안 넣는다 ② 한 번만 쓴다 ③ 인증 헤더 요청·15초 지남·2xx 아님은 **쓰지 않고 종전대로**
 *   ④ 미리 받는 주소가 화면 코드의 주소와 글자까지 같다(다르면 조용히 헛받기만 한다 — 이 시험이 그걸 막는다).
 * ⚠️ 못 보는 것: 실제 폰에서 아낀 시간(배포 후 RUM 마이 LCP p75 로 판정).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { earlyDataPaths, earlyDataScript, EARLY_DATA } from '@/worker/utils/early-data'
import { takeEarlyData, EARLY_DATA_MAX_AGE_MS } from '@/lib/http-client'

type W = { __urWarm?: Record<string, { at: number; p: Promise<{ s: number; t: string; ct: string } | null> }> }
const w = window as unknown as W
const cfg = (extra: Record<string, unknown> = {}) => ({ method: 'get', headers: {}, ...extra }) as never
const put = (path: string, s = 200, t = '{"ok":1}', at = Date.now()) => {
  w.__urWarm = w.__urWarm || {}
  w.__urWarm[path] = { at, p: Promise.resolve({ s, t, ct: 'application/json' }) }
}

beforeEach(() => { w.__urWarm = {} })

describe('서버 — 무엇을 미리 받나', () => {
  it('① 세션 쿠키가 없으면 비어 있다 · 있으면 화면별 목록', () => {
    expect(earlyDataPaths('/user/profile', false)).toEqual([])
    expect(earlyDataPaths('/user/profile', true)).toContain('/api/vouchers/my')
    expect(earlyDataPaths('/my-vouchers/', true)).toContain('/api/vouchers/my')
    expect(earlyDataPaths('/', true)).toEqual([])
    expect(earlyDataScript([], 'n')).toBe('')
    const s = earlyDataScript(['/api/auth/me'], 'abc')
    expect(s).toMatch(/^<script nonce="abc">/)
    expect(s).toContain('"/api/auth/me"')
    expect(s).toContain("credentials:'include'")
  })
  it('④ 미리 받는 주소는 화면 코드에 글자 그대로 있다', () => {
    const files: string[] = []
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!/tests|worker|features/.test(p)) walk(p) } else if (/\.tsx?$/.test(f)) files.push(p) } }
    walk('src')
    const all = files.map((f) => readFileSync(f, 'utf8')).join('\n')
    for (const p of new Set(Object.values(EARLY_DATA).flat())) expect(all, p).toContain(`'${p}'`)
  })
})

describe('앱 — 꺼내 쓰기', () => {
  it('② 한 번만 쓴다', async () => {
    put('/api/vouchers/my', 200, '{"data":[1]}')
    const r = await takeEarlyData(cfg(), '/api/vouchers/my')
    expect(r?.data).toEqual({ data: [1] })
    expect(takeEarlyData(cfg(), '/api/vouchers/my')).toBeNull()
  })
  it('③ 인증 헤더 · 오래됨 · 2xx 아님 · GET 아님은 쓰지 않는다(종전대로 요청)', async () => {
    put('/a'); expect(takeEarlyData(cfg({ headers: { Authorization: 'Bearer x' } }), '/a')).toBeNull()
    put('/b', 200, '{}', Date.now() - EARLY_DATA_MAX_AGE_MS - 1); expect(takeEarlyData(cfg(), '/b')).toBeNull()
    put('/c', 401); expect(await takeEarlyData(cfg(), '/c')).toBeNull()
    put('/d'); expect(takeEarlyData(cfg({ method: 'post' }), '/d')).toBeNull()
    expect(takeEarlyData(cfg(), '/none')).toBeNull()
  })
  it('실패한 미리받기(null)는 종전 요청으로 넘어간다', async () => {
    w.__urWarm = { '/x': { at: Date.now(), p: Promise.resolve(null) } }
    expect(await takeEarlyData(cfg(), '/x')).toBeNull()
  })
  it('요청 계층이 실제로 이 함수를 먼저 거친다', () => {
    const src = readFileSync('src/lib/http-client.ts', 'utf8')
    expect(src).toMatch(/function dispatch\(config: InternalRequestConfig\): Promise<HttpResponse> \{\s*const early = takeEarlyData\(/)
    expect(readFileSync('src/worker/index.ts', 'utf8')).toMatch(/applyEarlyData\(applyCssFirstBoot\(new HTMLRewriter\(\), nonce, cssFirst(?:, criticalCssFor\(url\.pathname\))?\), url\.pathname, authed, nonce\)/)
  })
})
void vi
