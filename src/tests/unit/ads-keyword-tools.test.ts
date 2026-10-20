import { describe, it, expect, vi, afterEach } from 'vitest'
import { keywordTrend, keywordShopping, keywordAutocomplete, categoryDemographics, brandReputation, shoppingCategoryTrends } from '@/features/marketing/api/keyword-tools'

/**
 * 🆕 2026-06-30 유어애즈 키워드 도구 — 네이버 오픈API 응답 파싱을 fetch 스텁으로 검증.
 *   실호출 없이 파싱/정규화 로직(증감률·태그제거·share%·중복제거·날짜표준화)을 잠금.
 */
const ID = 'cid', SEC = 'secret'
// URL(부분일치)→응답 JSON 매핑으로 fetch 스텁.
function stub(map: Array<{ match: string; status?: number; json: unknown }>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url)
    const hit = map.find(m => u.includes(m.match))
    if (!hit) return { ok: false, status: 404, json: async () => ({}) }
    return { ok: (hit.status ?? 200) < 400, status: hit.status ?? 200, json: async () => hit.json }
  }))
}
afterEach(() => vi.unstubAllGlobals())

describe('keyword-tools — 파싱(fetch 스텁)', () => {
  it('keywordTrend: 증감률 = (마지막-처음)/처음', async () => {
    stub([{ match: '/v1/datalab/search', json: { results: [{ title: '무선이어폰', data: [{ period: '2026-01-01', ratio: 50 }, { period: '2026-03-01', ratio: 75 }] }] } }])
    const r = await keywordTrend(ID, SEC, ['무선이어폰'])
    expect(r.ok).toBe(true)
    expect(r.results![0]).toMatchObject({ keyword: '무선이어폰', latest: 75, changePct: 50 })
  })

  it('keywordShopping: 태그 제거 + 가격 0 필터 + total', async () => {
    stub([{ match: '/v1/search/shop.json', json: { total: 1234, items: [
      { title: '<b>무선</b>이어폰', lprice: '19900', mallName: '루미' },
      { title: '무료상품', lprice: '0', mallName: 'X' }, // 가격 0 → 제외
    ] } }])
    const r = await keywordShopping(ID, SEC, '이어폰')
    expect(r.data!.total).toBe(1234)
    expect(r.data!.items).toHaveLength(1)
    expect(r.data!.items[0]).toMatchObject({ title: '무선이어폰', lprice: 19900, mallName: '루미' })
  })

  it('keywordAutocomplete: 중첩배열 파싱 + 자기 자신/중복 제거', async () => {
    stub([{ match: 'ac.search.naver.com', json: { items: [[['이어폰'], ['무선이어폰'], ['이어폰 추천'], ['무선이어폰']]] } }])
    const r = await keywordAutocomplete('이어폰')
    expect(r.suggestions).toEqual(['무선이어폰', '이어폰 추천']) // '이어폰'(자기자신)·중복 제거
  })

  it('keywordAutocomplete: 호출 실패 → best-effort 빈 배열', async () => {
    stub([{ match: 'ac.search.naver.com', status: 500, json: {} }])
    const r = await keywordAutocomplete('이어폰')
    expect(r.ok).toBe(true)
    expect(r.suggestions).toEqual([])
  })

  it('categoryDemographics: 그룹 평균 → share% 정규화 + 라벨 매핑 + 내림차순', async () => {
    // device 차원만 데이터, 나머지는 빈 응답. group ratio 평균: pc=(20+40)/2=30, mo=(80+60)/2=70 → share 30/70%.
    stub([
      { match: '/category/device', json: { results: [{ data: [
        { group: 'pc', ratio: 20 }, { group: 'mo', ratio: 80 },
        { group: 'pc', ratio: 40 }, { group: 'mo', ratio: 60 },
      ] }] } },
      { match: '/category/gender', json: { results: [{ data: [] }] } },
      { match: '/category/age', json: { results: [{ data: [] }] } },
    ])
    const r = await categoryDemographics(ID, SEC, '50000002')
    expect(r.ok).toBe(true)
    expect(r.data!.device).toEqual([{ label: '모바일', pct: 70 }, { label: 'PC', pct: 30 }])
  })

  it('categoryDemographics: 잘못된 cid → 400성 에러', async () => {
    const r = await categoryDemographics(ID, SEC, 'bad')
    expect(r.ok).toBe(false)
  })

  it('brandReputation: 블로그 날짜(YYYYMMDD)·뉴스(RFC822) 표준화 + 총 언급 합산', async () => {
    stub([
      { match: '/v1/search/blog.json', json: { total: 10, items: [{ title: '<b>브랜드</b> 후기', link: 'http://b', postdate: '20260615', bloggername: '블로거A' }] } },
      { match: '/v1/search/cafearticle.json', json: { total: 5, items: [{ title: '카페글', link: 'http://c', cafename: '카페B' }] } },
      { match: '/v1/search/news.json', json: { total: 3, items: [{ title: '뉴스', link: 'http://n', pubDate: 'Mon, 15 Jun 2026 09:00:00 +0900' }] } },
    ])
    const r = await brandReputation(ID, SEC, '브랜드')
    expect(r.data!.totalMentions).toBe(18) // 10+5+3
    const blog = r.data!.channels.find(c => c.channel === 'blog')!
    expect(blog.items[0]).toMatchObject({ title: '브랜드 후기', date: '2026-06-15', source: '블로거A' })
    expect(r.data!.channels.find(c => c.channel === 'news')!.items[0].date).toBe('2026-06-15')
  })

  it('shoppingCategoryTrends: 카테고리별 증감률 내림차순 + cid 매핑 (청크 분할·병합)', async () => {
    // 쇼핑인사이트 분야 API 는 요청당 최대 3개 → 함수가 3개씩 분할 호출. 실제 네이버처럼
    //   각 청크는 그 청크가 요청한 카테고리만 반환하도록 body 인지형 mock 으로 검증(중복 없음).
    const dataByName: Record<string, Array<{ period: string; ratio: number }>> = {
      '식품': [{ period: '2025-07', ratio: 100 }, { period: '2026-06', ratio: 80 }],        // -20%
      '화장품/미용': [{ period: '2025-07', ratio: 50 }, { period: '2026-06', ratio: 100 }], // +100%
    }
    vi.stubGlobal('fetch', vi.fn(async (url: string, opts?: { body?: string }) => {
      if (!String(url).includes('/v1/datalab/shopping/categories')) return { ok: false, status: 404, json: async () => ({}) }
      const body = JSON.parse(opts?.body || '{}') as { category?: Array<{ name: string }> }
      const results = (body.category || []).filter(c => dataByName[c.name]).map(c => ({ title: c.name, data: dataByName[c.name] }))
      return { ok: true, status: 200, json: async () => ({ results }) }
    }))
    const r = await shoppingCategoryTrends(ID, SEC)
    expect(r.ok).toBe(true)
    expect(r.results!.map(c => c.name)).toEqual(['화장품/미용', '식품']) // 증감률 내림차순, 중복 0
    expect(r.results![0]).toMatchObject({ changePct: 100, cid: '50000002' })
  })

  it('키 미설정 → NOT_CONFIGURED (전 함수 공통)', async () => {
    expect((await keywordTrend(undefined, SEC, ['x'])).error).toBe('NOT_CONFIGURED')
    expect((await keywordShopping(ID, undefined, 'xx')).error).toBe('NOT_CONFIGURED')
  })
})
