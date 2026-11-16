/**
 * 📰 이용권 상세 크롤러 본문에 '다녀온 사람들' 제목 (2026-11-16 대표 "응 계속 진행해줘" — 검색 유입 점검)
 *
 * 실측: `/pass/2919` 크롤러 본문 173자 — 가게 설명이 상품명과 같아 버려지고 남는 게 가격·주소뿐이었다.
 * 가게마다 이미 모은 실제 후기 제목(공개분)을 최대 5개 싣는다. 지어낸 문구 0(규율).
 * ⚠️ 못 보는 것: 실제 검색 순위 변화(색인 갱신까지 수일~수주) · 네이버가 noscript 를 얼마나 쓰는지.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { exec: (s: string) => void; prepare: (sql: string) => { run: (...a: never[]) => unknown; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import { creatorLine } from '@/worker/utils/crawler-noscript-rows'
import { buildDetailNoscript } from '@/worker/utils/crawler-noscript'
import { buildDetailMeta } from '@/features/group-buy/api/detail-meta-enrich'
import { storeKeyFor } from '@/features/creator-content/api/content-db'

function makeD1() {
  const db = new DatabaseSync(':memory:')
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => ({ meta: { changes: 0 } }),
      first: async () => db.prepare(sql).get(...(args as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  return { db, D1: { prepare: (s: string) => wrap(s) } as unknown as D1Database }
}

describe('크롤러 본문 — 다녀온 사람들', () => {
  it('제목(작성자)을 쉼표로 최대 5개 · 없으면 빈 줄 · HTML 은 이스케이프', () => {
    expect(creatorLine([{ title: '방배카페골목_달빛 한 스푼', author: '맛집러' }, { title: '<b>닭도리탕</b>' }])).toBe('다녀온 사람들: 방배카페골목_달빛 한 스푼(맛집러), &lt;b&gt;닭도리탕&lt;/b&gt;')
    expect(creatorLine([])).toBe('')
    expect(creatorLine(Array.from({ length: 8 }, (_, i) => ({ title: `t${i}` }))).split(', ').length).toBe(5)
  })
  it('상세 본문에 들어간다', () => {
    const html = buildDetailNoscript({ name: '닭도리탕', price: 31000, original_price: 35000, creator_titles: [{ title: '방배카페골목_달빛 한 스푼' }] })
    expect(html).toContain('다녀온 사람들: 방배카페골목_달빛 한 스푼')
  })
  it('상세 API 가 가게의 공개 제목만(고정 먼저) 싣는다 · 표가 없어도 상세는 그대로', async () => {
    const { db, D1 } = makeD1()
    expect((await buildDetailMeta(D1, 1, null, null, { name: '달빛한스푼', address: '서울 서초구 방배중앙로 165' })).creator_titles).toEqual([])
    db.exec(`CREATE TABLE store_creator_content (id INTEGER PRIMARY KEY, store_key TEXT, title TEXT, author_name TEXT, platform TEXT, status TEXT, pinned INTEGER DEFAULT 0, position INTEGER DEFAULT 0)`)
    const k = storeKeyFor('달빛한스푼', '서울 서초구 방배중앙로 165')
    db.exec(`INSERT INTO store_creator_content (store_key,title,author_name,platform,status,pinned) VALUES
      ('${k}','숨김 글','a','naver_blog','hidden',0), ('${k}','보통 글','b','naver_blog','visible',0), ('${k}','고정 영상','c','youtube','visible',1), ('다른|키','남의 가게','d','naver_blog','visible',1)`)
    const m = await buildDetailMeta(D1, 1, null, null, { name: '달빛한스푼', address: '서울 서초구 방배중앙로 165' })
    expect(m.creator_titles.map((x) => x.title)).toEqual(['고정 영상', '보통 글'])
  })
  it('상세 라우트가 가게 이름·주소를 넘기고 응답에 싣는다', () => {
    const r = readFileSync('src/features/group-buy/api/group-buy-public.routes.ts', 'utf8')
    expect(r).toContain('{ name: (product as { restaurant_name?: string | null }).restaurant_name, address: (product as { restaurant_address?: string | null }).restaurant_address }')
    expect(r).toContain('...(creator_titles.length ? { creator_titles } : {})')
  })
})
