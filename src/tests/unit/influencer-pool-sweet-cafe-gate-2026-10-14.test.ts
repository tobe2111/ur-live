/**
 * 🎯 인플루언서 풀 — 스위트스팟 블로그 하한 1천 + 카페 스위치 저장 경로 (2026-10-14 대표 *"네이버 카페는 이제 꺼줘.
 * 스윗스팟은 1천으로 해줘."*).
 *
 * ① 스위트스팟은 이웃 수가 없던 시절 규칙이라 **블로그를 숫자와 무관하게 전부** 넣었다(33만 명).
 *    지금은 블로그 70% 가 이웃 수를 갖고 있어 블로그도 숫자로 거른다 — 블로그 1천+, 유튜브 1만+, 둘 다 50만 미만.
 *    서버가 실제로 내는 WHERE 를 소스에서 뽑아 SQLite 에서 경계값으로 판정한다.
 *
 * ② 어드민 카페 스위치(`PATCH /influencer-pool/collect-gates`)가 **한 번도 저장되지 않았다** —
 *    먼저 마운트된 `PATCH /influencer-pool/:id` 가 `collect-gates` 를 id 로 잡아 "잘못된 ID" 400 을 냈다.
 *    에러 토스트만 뜨고 스위치는 그대로라, 눌러 본 사람만 안다. 실제 라우터를 **같은 마운트 순서로** 조립해
 *    요청을 보내고 설정이 저장되는지 본다(소스 순서 문자열 검사로는 Hono 의 매칭 규칙을 대신할 수 없다).
 *
 * ⚠️ 못 보는 것: 화면 토글의 실제 클릭 · 수집 워커가 그 설정을 읽는지(그건 `ads-collect-gates.test.ts`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'module'
import { Hono } from 'hono'
import { stripComments } from '../helpers/source-text'
import { adminAdsInfluencerRoutes } from '@/features/marketing/api/admin-ads-influencers.routes'
import { adminAdsPoolOpsRoutes } from '@/features/marketing/api/admin-ads-pool-ops.routes'
import { adminAdsCollectGatesRoutes } from '@/features/marketing/api/admin-ads-collect-gates.routes'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

const ROUTE = 'src/features/marketing/api/admin-ads-influencers.routes.ts'
const PARENT = 'src/features/marketing/api/admin-ads.routes.ts'

function sweetWhere(): string {
  const src = stripComments(readFileSync(ROUTE, 'utf8'))
  const m = /tier === 'sweet'\)\s*where\.push\((['"])(.+?)\1\)/.exec(src)
  expect(m, 'sweet 분기를 못 찾았다(헛도는 시험)').not.toBeNull()
  return m![2]!
}

function sweetIds(rows: Array<[string, number | null]>): number[] {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, platform TEXT, subscriber_count INTEGER)')
  const ins = db.prepare('INSERT INTO t (platform, subscriber_count) VALUES (?, ?)')
  for (const [p, n] of rows) ins.run(p, n)
  return (db.prepare(`SELECT id FROM t WHERE ${sweetWhere()} ORDER BY id`).all() as Array<{ id: number }>).map(r => r.id)
}

describe('스위트스팟 — 블로그 1천+ · 유튜브 1만+ · 50만 미만', () => {
  it('블로그는 1,000 부터 들어온다(999·미측정은 빠진다)', () => {
    expect(sweetIds([
      ['naver_blog', null], ['naver_blog', 0], ['naver_blog', 999], ['naver_blog', 1000], ['naver_blog', 5000],
    ])).toEqual([4, 5])
  })
  it('유튜브는 종전대로 1만부터 — 블로그 하한이 유튜브로 새지 않는다', () => {
    expect(sweetIds([['youtube', 1000], ['youtube', 9999], ['youtube', 10000]])).toEqual([3])
  })
  it('50만 이상은 매체와 무관하게 대형이라 빠진다', () => {
    expect(sweetIds([['youtube', 499999], ['youtube', 500000], ['naver_blog', 500000]])).toEqual([1])
  })
})

describe('카페 스위치 저장 — PATCH /influencer-pool/collect-gates', () => {
  /** 부모 라우터의 실제 마운트 순서(소스에서 읽는다 — 손으로 적으면 소스와 갈린다). */
  function mountOrder(): string[] {
    const src = stripComments(readFileSync(PARENT, 'utf8'))
    return [...src.matchAll(/app\.route\('\/',\s*(\w+)\)/g)].map(m => m[1]!)
  }

  it('같은 순서로 조립하면 설정이 저장된다(400 "잘못된 ID" 가 아니다)', async () => {
    const routers: Record<string, Hono<any>> = {
      adminAdsInfluencerRoutes, adminAdsPoolOpsRoutes, adminAdsCollectGatesRoutes,
    } as unknown as Record<string, Hono<any>>
    const order = mountOrder()
    expect(order).toEqual(expect.arrayContaining(Object.keys(routers)))

    const writes: unknown[][] = []
    const DB = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          run: async () => { if (/platform_settings/.test(sql)) writes.push(args); return { meta: { changes: 1 } } },
          first: async () => null,
          all: async () => ({ results: [] }),
        }),
      }),
    }
    const app = new Hono()
    for (const name of order) app.route('/', routers[name]!)
    const res = await app.request('/influencer-pool/collect-gates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cafe: false }),
    }, { DB })
    const body = await res.json() as { success: boolean; data?: { cafe?: { setting?: string } } }
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data?.cafe?.setting).toBe('off')
    expect(writes).toEqual([['ads_collect_cafe', 'off']])
  })
})
