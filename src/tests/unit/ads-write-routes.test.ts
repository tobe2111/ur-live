import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import { marketingRoutes } from '@/features/marketing/api/marketing.routes'
import { signAdsToken } from '@/features/marketing/api/ads-account'
import { saveSearchAdConnection } from '@/features/marketing/api/searchad-connection'

/**
 * 🆕 2026-06-30 유어애즈 WRITE 라우트 레벨 테스트 — 캠페인 제어/제외키워드.
 *   인증·검증·NOT_CONNECTED·연결 후 정상경로(fetch 스텁)까지 route 통합 검증.
 */
function makeD1(): D1Database {
  const db = new DatabaseSync(':memory:')
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => { const r = db.prepare(sql).all(...(args as never[])); return { results: r } },
    }
    return api
  }
  return { prepare: (sql: string) => wrap(sql) } as unknown as D1Database
}
const JWT = 'test-jwt-secret-0123456789'
const KEK = 'k'.repeat(32)
type Ev = Parameters<typeof marketingRoutes.request>[2]
const req = (path: string, method: string, token: string | null, body?: unknown, env?: Ev) =>
  marketingRoutes.request(path, {
    method,
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }, env)

describe('WRITE 라우트 — 인증/검증(연결 전)', () => {
  let env: Ev, token: string
  beforeEach(async () => { env = { DB: makeD1(), JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: KEK } as unknown as Ev; token = await signAdsToken(7, JWT) })

  it('PATCH /searchad/campaign: 미인증 401 / 캠페인 없음 400 / 미연결 400', async () => {
    expect((await req('/searchad/campaign', 'PATCH', null, { campaign_id: 'c1', action: 'pause' }, env)).status).toBe(401)
    expect((await req('/searchad/campaign', 'PATCH', token, { action: 'pause' }, env)).status).toBe(400) // 캠페인 미지정
    const nc = await req('/searchad/campaign', 'PATCH', token, { campaign_id: 'c1', action: 'pause' }, env)
    expect(nc.status).toBe(400)
    expect((await nc.json() as { code: string }).code).toBe('NOT_CONNECTED')
  })

  it('POST /searchad/negative: 미인증 401 / 그룹 없음 400 / 키워드 없음 400 / 미연결 400', async () => {
    expect((await req('/searchad/negative', 'POST', null, { adgroup_id: 'g1', keywords: ['x'] }, env)).status).toBe(401)
    expect((await req('/searchad/negative', 'POST', token, { keywords: ['x'] }, env)).status).toBe(400) // 그룹 미지정
    expect((await req('/searchad/negative', 'POST', token, { adgroup_id: 'g1', keywords: [] }, env)).status).toBe(400) // 키워드 없음
    const nc = await req('/searchad/negative', 'POST', token, { adgroup_id: 'g1', keywords: ['무료배송'] }, env)
    expect((await nc.json() as { code: string }).code).toBe('NOT_CONNECTED')
  })
})

describe('WRITE 라우트 — 연결 후 정상경로(fetch 스텁)', () => {
  let env: Ev, token: string
  let calls: Array<{ url: string; method: string; body?: string }>
  beforeEach(async () => {
    const DB = makeD1()
    await saveSearchAdConnection(DB, 7, { customerId: '123', accessLicense: 'lic', secretKey: 'supersecretkey' }, KEK)
    env = { DB, JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: KEK } as unknown as Ev
    token = await signAdsToken(7, JWT)
    calls = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: { method?: string; body?: string }) => {
      calls.push({ url: String(url), method: init?.method || 'GET', body: init?.body })
      return { ok: true, status: 200, json: async () => ({}) }
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('캠페인 일시정지: 200 + PUT userLock 호출', async () => {
    const r = await req('/searchad/campaign', 'PATCH', token, { campaign_id: 'cmp-1', action: 'pause' }, env)
    expect(r.status).toBe(200)
    expect(calls.some(c => c.method === 'PUT' && c.url.includes('/ncc/campaigns/cmp-1') && c.url.includes('userLock'))).toBe(true)
  })

  it('예산 하드캡: 범위 밖은 400 + 외부호출 없음', async () => {
    const r = await req('/searchad/campaign', 'PATCH', token, { campaign_id: 'cmp-1', action: 'budget', daily_budget: 99 }, env)
    expect(r.status).toBe(400)
    expect(calls).toHaveLength(0) // 검증에서 컷 → PUT 안 나감
  })

  it('예산 정상: 200 + PUT budget', async () => {
    const r = await req('/searchad/campaign', 'PATCH', token, { campaign_id: 'cmp-1', action: 'budget', daily_budget: 50000 }, env)
    expect(r.status).toBe(200)
    expect(calls.some(c => c.method === 'PUT' && c.url.includes('fields=budget'))).toBe(true)
  })

  it('알 수 없는 action → 400', async () => {
    expect((await req('/searchad/campaign', 'PATCH', token, { campaign_id: 'cmp-1', action: 'delete' }, env)).status).toBe(400)
  })

  it('제외키워드 등록: 200 + POST restricted-keywords', async () => {
    const r = await req('/searchad/negative', 'POST', token, { adgroup_id: 'grp-1', keywords: ['무료배송', '체험단'] }, env)
    expect(r.status).toBe(200)
    expect(calls.some(c => c.method === 'POST' && c.url.includes('/ncc/restricted-keywords'))).toBe(true)
  })

  it('제외키워드 20개 초과 → 400(외부호출 없음)', async () => {
    const many = Array.from({ length: 21 }, (_, i) => `kw${i}`)
    const r = await req('/searchad/negative', 'POST', token, { adgroup_id: 'grp-1', keywords: many }, env)
    expect(r.status).toBe(400)
    expect(calls).toHaveLength(0)
  })
})
