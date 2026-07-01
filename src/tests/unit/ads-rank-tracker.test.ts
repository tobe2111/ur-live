import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import { findShopRank } from '@/features/marketing/api/rank-tracker'
import { addWatch, listWatches } from '@/features/marketing/api/price-monitor'

/**
 * 🆕 2026-06-30 유어애즈 순위/가격 — 쇼핑검색 응답 파싱을 fetch 스텁으로 검증.
 *   findShopRank(페이지 넘김·mallName/link 매칭·300위 밖 null) + 가격워치 등록/상한.
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
// start 파라미터별로 items 페이지를 반환하는 shop.json 스텁.
function stubShop(pages: Record<number, { total: number; items: Array<{ title?: string; link?: string; mallName?: string; lprice?: string }> }>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const m = String(url).match(/start=(\d+)/)
    const start = m ? Number(m[1]) : 1
    const page = pages[start]
    if (!page) return { ok: true, status: 200, json: async () => ({ total: 0, items: [] }) }
    return { ok: true, status: 200, json: async () => page }
  }))
}
afterEach(() => vi.unstubAllGlobals())

const ID = 'cid', SEC = 'secret'

describe('rank-tracker — findShopRank(파싱)', () => {
  it('1페이지 내 mallName 매칭 → 순위 = start+index', async () => {
    stubShop({ 1: { total: 500, items: [
      { mallName: '경쟁A', link: 'http://a' },
      { mallName: '루미스토어', link: 'http://lumi' }, // index 1 → 2위
    ] } })
    const r = await findShopRank(ID, SEC, '이어폰', '루미스토어')
    expect(r).toMatchObject({ ok: true, rank: 2, total: 500 })
  })

  it('2페이지로 넘어가서 매칭(100+ 순위)', async () => {
    const fill = (n: number) => Array.from({ length: n }, (_, i) => ({ mallName: `m${i}`, link: `http://m${i}` }))
    stubShop({
      1: { total: 300, items: fill(100) },
      101: { total: 300, items: [...fill(4), { mallName: '내몰', link: 'http://mine' }] }, // start 101 + index 4 → 105위
    })
    const r = await findShopRank(ID, SEC, '이어폰', '내몰')
    expect(r.rank).toBe(105)
  })

  it('mallName 이 달라도 link(도메인)로 매칭', async () => {
    stubShop({ 1: { total: 10, items: [
      { mallName: '스토어팜', link: 'https://smartstore.naver.com/lumi/products/1' },
    ] } })
    const r = await findShopRank(ID, SEC, '이어폰', 'smartstore.naver.com/lumi')
    expect(r.rank).toBe(1)
  })

  it('상위 300위 밖 → rank null(못 찾음)', async () => {
    const fill = (n: number) => Array.from({ length: n }, (_, i) => ({ mallName: `x${i}`, link: `http://x${i}` }))
    stubShop({ 1: { total: 999, items: fill(100) }, 101: { total: 999, items: fill(100) }, 201: { total: 999, items: fill(100) } })
    const r = await findShopRank(ID, SEC, '이어폰', '없는몰')
    expect(r).toMatchObject({ ok: true, rank: null })
  })

  it('키 미설정 → NOT_CONFIGURED', async () => {
    expect((await findShopRank(undefined, SEC, 'x', 'y')).error).toBe('NOT_CONFIGURED')
  })
})

describe('price-monitor — addWatch(등록/상한)', () => {
  let DB: D1Database
  beforeEach(() => {
    DB = makeD1()
    stubShop({ 1: { total: 50, items: [{ mallName: '최저몰', link: 'http://x', lprice: '9900' }] } }) // 등록 즉시 1회 조회용
  })

  it('등록 성공 + 내 판매가 저장', async () => {
    const env = { DB, NAVER_CLIENT_ID: ID, NAVER_CLIENT_SECRET: SEC } as unknown as Parameters<typeof addWatch>[0]
    expect((await addWatch(env, 7, '무선이어폰', 15000)).ok).toBe(true)
    const list = await listWatches(DB, 7)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ query: '무선이어폰', my_price: 15000 })
  })

  it('2자 미만 검색어 거부', async () => {
    const env = { DB, NAVER_CLIENT_ID: ID, NAVER_CLIENT_SECRET: SEC } as unknown as Parameters<typeof addWatch>[0]
    expect((await addWatch(env, 7, 'x', null)).ok).toBe(false)
  })
})
