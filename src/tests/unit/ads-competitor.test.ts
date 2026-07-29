import { describe, it, expect } from 'vitest'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import { aggregateCompetitors, type ShopItem } from '@/features/marketing/api/competitor-tracker'
import { signAdsToken, ensureAdsAccountSchema } from '@/features/marketing/api/ads-account'
import { marketingRoutes } from '@/features/marketing/api/marketing.routes'

/**
 * 🆕 2026-06-30 유어애즈 경쟁사 분석 — 순수 집계 + 라우트 가드.
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

// 서버측 베타 게이트(access_unlocked) 통과용 — unlock·active 계정 시딩.
async function seedUnlocked(DB: D1Database, id: number): Promise<void> {
  await ensureAdsAccountSchema(DB)
  await DB.prepare("INSERT OR IGNORE INTO ad_accounts (id, email, password_hash, company_name, status, access_unlocked) VALUES (?, ?, 'x', 'co', 'active', 1)").bind(id, 'u' + id + '@x.com').run()
}

const items = (rows: Array<[number, string, number]>): ShopItem[] =>
  rows.map(([rank, mall, price]) => ({ rank, mall, title: `${mall} 상품`, price, link: `https://${mall}.com/p` }))

describe('UR Ads 경쟁사 분석 — aggregateCompetitors(순수)', () => {
  it('내 순위 탐지 + 나보다 위/아래 플래그 + 내 몰 제외', () => {
    const list = items([
      [1, '경쟁A', 9000],
      [2, '경쟁B', 8000],
      [5, '루미스토어', 10000], // 내 몰
      [8, '경쟁C', 12000],
    ])
    const { myRank, competitors } = aggregateCompetitors(list, '루미스토어')
    expect(myRank).toBe(5)
    expect(competitors.map(c => c.mall)).toEqual(['경쟁A', '경쟁B', '경쟁C']) // 내 몰 제외, bestRank 오름차순
    expect(competitors.find(c => c.mall === '경쟁A')?.aboveMe).toBe(true)   // 1 < 5
    expect(competitors.find(c => c.mall === '경쟁C')?.aboveMe).toBe(false)  // 8 > 5
  })

  it('같은 몰 여러 상품 → bestRank/최저가/노출수 집계', () => {
    const list = items([
      [3, '경쟁A', 9000],
      [10, '경쟁A', 7000], // 더 싼 가격, 더 낮은 순위
      [4, '경쟁B', 5000],
    ])
    const { competitors } = aggregateCompetitors(list, '없는몰')
    const a = competitors.find(c => c.mall === '경쟁A')!
    expect(a.bestRank).toBe(3)     // 최고 순위
    expect(a.count).toBe(2)        // 노출 상품 2개
    expect(a.minPrice).toBe(7000)  // 최저가
  })

  it('내 몰 미노출(300위 밖)이면 myRank=null, aboveMe 전부 false', () => {
    const { myRank, competitors } = aggregateCompetitors(items([[1, '경쟁A', 100], [2, '경쟁B', 200]]), '루미')
    expect(myRank).toBeNull()
    expect(competitors.every(c => c.aboveMe === false)).toBe(true)
  })

  it('가격 0(미표기) 상품만 있는 몰 → minPrice 0(Infinity 누출 방지)', () => {
    const { competitors } = aggregateCompetitors(items([[1, '경쟁A', 0]]), '루미')
    expect(competitors[0].minPrice).toBe(0)
  })

  it('도메인(link)으로도 내 몰 매칭', () => {
    const list: ShopItem[] = [
      { rank: 1, mall: '스토어팜', title: '상품', price: 100, link: 'https://smartstore.naver.com/lumi/products/1' },
      { rank: 2, mall: '경쟁A', title: '상품', price: 200, link: 'https://a.com' },
    ]
    const { myRank } = aggregateCompetitors(list, 'smartstore.naver.com/lumi')
    expect(myRank).toBe(1) // mallName 이 달라도 link 에 내 도메인 포함 → 매칭
  })
})

describe('UR Ads 경쟁사 분석 — 라우트 가드', () => {
  it('미인증 401 / 파라미터 누락 400 / 키 미설정 503', async () => {
    const DB = makeD1()
    const env = { DB, JWT_SECRET: JWT } as unknown as Parameters<typeof marketingRoutes.request>[2]
    const token = await signAdsToken(7, JWT)
    await seedUnlocked(DB, 7)
    const auth = { Authorization: 'Bearer ' + token }
    expect((await marketingRoutes.request('/rank/competitors?keyword=신발&mall=lumi', {}, env)).status).toBe(401)
    expect((await marketingRoutes.request('/rank/competitors?keyword=&mall=x', { headers: auth }, env)).status).toBe(400) // 키워드 없음
    // 키워드+몰 있으나 NAVER 키 미설정 → 503 NOT_CONFIGURED
    const res = await marketingRoutes.request('/rank/competitors?keyword=신발&mall=lumi', { headers: auth }, env)
    expect(res.status).toBe(503)
    expect((await res.json() as { code: string }).code).toBe('NOT_CONFIGURED')
  })
})
