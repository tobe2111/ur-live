/**
 * 🏠 생활 업체 소개 페이지 `/life/biz/:id` 서버 메타·sitemap (2026-10-26 대표 "4번도 해줘").
 *
 * 지키는 것: ① 카톡 카드·검색 제목이 업체 이름·업종을 말한다 ② 얇은 업체(소개 짧음·후기 0)는 noindex 이고
 * sitemap 도 같은 조건으로 거른다(색인 요청 ↔ noindex 모순 금지) ③ 별점은 후기가 있을 때만(0점 업체 금지)
 * ④ 지어내지 않는다(주소·전화·가격대 없음) ⑤ 화면 `<SEO>` 와 서버가 같은 함수 ⑥ 없는 업체는 404+noindex.
 * ⚠️ 못 보는 것: 실제 카톡 카드(카카오가 그린다) · 구글이 색인하는지.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { buildLifeBizMeta, buildLifeBizNoscript } from '@/worker/utils/life-biz-ssr'
import { LIFE_BIZ_MIN_INTRO, lifeBizIndexable, lifeBizDescription } from '@/shared/seo/life-biz-seo'
import { shouldNoindexMissingEntity } from '@/worker/utils/surface-ssr-meta'
import { readCode } from '../helpers/source-text'
import { categoryDef } from '@/shared/home-service-categories'

const read = (p: string) => readFileSync(p, 'utf8')
const O = 'https://urdeal.kr'

const RICH = {
  id: 7, name: '망원 방역', verified: true,
  intro: '음식점·카페 전문 방역 15년. 야간 작업 가능하고 재방문 무상으로 해 드려요.',
  categories: ['store_pest', 'home_pest'], areas: [{ sido: '서울', sigungu: '마포구' }, { sido: '서울', sigungu: '서대문구' }],
  reviews: { avg: 4.666, count: 3, recent: [{ rating: 5, body: '깔끔 <b>최고</b> & 빠름', reviewer: '김○○' }] },
  chosen_count: 4,
}
const THIN = { id: 8, name: '새 업체', intro: '잘해요', categories: ['move'], areas: [], reviews: { avg: null, count: 0, recent: [] } }
const env = (d: unknown) => ({ success: true, data: d })

describe('서버 메타', () => {
  const m = buildLifeBizMeta(env(RICH), O, '/life/biz/7')!
  it('제목·카드가 업체 이름과 업종을 말한다', () => {
    expect(m.pageTitle).toContain('망원 방역')
    expect(m.pageTitle).toContain(categoryDef('store_pest')!.label)
    expect(m.title).toMatch(/★4\.7/)
    expect(m.canonical).toBe(`${O}/life/biz/7`)
    expect(m.noindex).toBe(false)
  })
  it('설명에 별점·지역·소개가 들어간다', () => {
    expect(m.description).toContain('★4.7(후기 3)')
    expect(m.description).toContain('서울 마포구')
    expect(m.description).toContain('방역 15년')
    expect(m.description.length).toBeLessThanOrEqual(160)
  })
  it('JSON-LD — LocalBusiness 에 지어낸 필드가 없다 · 별점은 실제 후기', () => {
    const ld = JSON.parse(m.jsonLd!)
    const biz = ld['@graph'].find((n: { '@type': string }) => n['@type'] === 'LocalBusiness')
    expect(biz.name).toBe('망원 방역')
    expect(biz.aggregateRating).toMatchObject({ ratingValue: 4.7, reviewCount: 3 })
    for (const k of ['address', 'telephone', 'priceRange', 'geo', 'openingHours']) expect(biz[k]).toBeUndefined()
    const crumb = ld['@graph'].find((n: { '@type': string }) => n['@type'] === 'BreadcrumbList')
    expect(crumb.itemListElement.at(-1).item).toBe(`${O}/life/biz/7`)
  })
  it('얇은 업체는 noindex · 별점 없음', () => {
    const t = buildLifeBizMeta(env(THIN), O, '/life/biz/8')!
    expect(t.noindex).toBe(true)
    expect(t.title).not.toContain('★')
    expect(JSON.parse(t.jsonLd!)['@graph'].find((n: { '@type': string }) => n['@type'] === 'LocalBusiness').aggregateRating).toBeUndefined()
  })
  it('후기 1건이면 소개가 짧아도 색인 · 소개가 기준 이상이면 후기 0이어도 색인', () => {
    expect(lifeBizIndexable({ ...THIN, reviews: { avg: 5, count: 1 } })).toBe(true)
    expect(lifeBizIndexable({ ...THIN, intro: '가'.repeat(LIFE_BIZ_MIN_INTRO) })).toBe(true)
    expect(lifeBizIndexable({ ...THIN, intro: ` ${'가'.repeat(LIFE_BIZ_MIN_INTRO - 1)}  ` })).toBe(false)
  })
  it('모양이 다른 시드는 그리지 않는다', () => {
    expect(buildLifeBizMeta({ success: false }, O, '/life/biz/1')).toBeNull()
    expect(buildLifeBizMeta(env({ id: 1, name: '' }), O, '/life/biz/1')).toBeNull()
  })
  it('빈 소개도 설명이 비지 않는다', () => {
    expect(lifeBizDescription({ name: 'x', intro: '' })).toContain('견적을 요청하면')
  })
})

describe('크롤러 본문', () => {
  const ns = buildLifeBizNoscript(env(RICH))
  it('이름·소개·업종 링크·후기를 싣고 탈출한다', () => {
    expect(ns.startsWith('<noscript>')).toBe(true)
    expect(ns).toContain('<h1>망원 방역</h1>')
    expect(ns).toContain('href="/life/request/store_pest"')
    expect(ns).toContain('깔끔 &lt;b&gt;최고&lt;/b&gt; &amp; 빠름')
    expect(ns).not.toContain('<b>최고')
  })
  it('시드가 없으면 빈 문자열(종전 로더)', () => {
    expect(buildLifeBizNoscript(null)).toBe('')
  })
})

describe('배선', () => {
  const w = readCode('src/worker/index.ts')
  it('워커가 /life/biz/:id 를 LIFEBIZ 슬롯으로 공개 API 에 붙인다', () => {
    expect(w).toMatch(/\/\^\\\/life\\\/biz\\\/\\d\{1,9\}\$\/\.test\(url\.pathname\)\) \{ ssrTarget = \{ slot: 'LIFEBIZ', path: `\/api\/home-service\/pros\/\$\{url\.pathname\.slice\(10\)\}`/)
    expect('/life/biz/'.length).toBe(10)
    expect(w).toContain("if (ssrSlot === 'LIFEBIZ' && ssrPayload) { const lb = buildLifeBizMeta(")
    expect(w).toContain("ssrSlot === 'LIFEBIZ' ? buildLifeBizNoscript(ssrPayload)")
  })
  it('없는 업체는 404 + noindex', () => {
    expect(shouldNoindexMissingEntity('LIFEBIZ', 'self-fetch-404')).toBe(true)
    expect(shouldNoindexMissingEntity('LIFEBIZ', 'self-fetch-timeout')).toBe(false)
  })
  it('화면 <SEO> 가 서버와 같은 함수를 쓴다', () => {
    const p = readCode('src/pages/life/LifeBizPage.tsx')
    expect(p).toContain('title={withSiteName(lifeBizTitle(b))}')
    expect(p).toContain('description={lifeBizDescription(b)}')
    expect(p).toContain('noindex={!lifeBizIndexable(b)}')
    expect(p).toContain("'__SSR_INITIAL_LIFEBIZ__'")
  })
  it('공개 API 는 전화번호를 꺼내지 않는다', () => {
    const r = read('src/features/home-service/api/home-service.routes.ts')
    const blk = r.slice(r.indexOf("homeServiceRoutes.get('/pros/:id'"), r.indexOf("homeServiceRoutes.get('/share/:token'"))
    expect(blk.length).toBeGreaterThan(500)
    expect(blk).not.toMatch(/phone/i)
  })
})

describe('sitemap — 색인 조건이 화면 noindex 와 같다', () => {
  const src = read('src/worker/routes/sitemap.routes.ts')
  const i = src.indexOf('SELECT p.seller_id FROM home_service_pros')
  const sqlTpl = src.slice(src.lastIndexOf('`', i), src.indexOf('`', i) + 1)
  it('상수와 열린 상태 SSOT 를 쓴다', () => {
    expect(i).toBeGreaterThan(0)
    expect(sqlTpl).toContain('${LIFE_BIZ_MIN_INTRO}')
    expect(sqlTpl).toContain('${PRO_OPEN_STATUS_SQL}')
    expect(src).toContain('`/life/biz/${r.seller_id}`')
  })
  it('진짜 SQLite 로 — 내용 있는 업체만 나온다', () => {
    const require = createRequire(import.meta.url)
    const { DatabaseSync } = require('node:sqlite')
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE sellers (id INTEGER, status TEXT); CREATE TABLE home_service_pros (seller_id INTEGER, active INTEGER, intro TEXT);
      CREATE TABLE home_service_reviews (seller_id INTEGER, hidden INTEGER);
      INSERT INTO sellers VALUES (1,'approved'),(2,'approved'),(3,'approved'),(4,'suspended'),(5,'pending'),(6,'approved');
      INSERT INTO home_service_pros VALUES (1,1,'${'가'.repeat(LIFE_BIZ_MIN_INTRO)}'),(2,1,'짧아요'),(3,1,NULL),(4,1,'${'가'.repeat(40)}'),(5,1,'\n\n${'가'.repeat(LIFE_BIZ_MIN_INTRO - 1)}\n'),(6,0,'${'가'.repeat(40)}');
      INSERT INTO home_service_reviews VALUES (3,0),(2,1);`)
    const sql = sqlTpl.slice(1, -1)
      .replace('${PRO_OPEN_STATUS_SQL}', "('pending', 'approved', 'active')")
      .replace('${LIFE_BIZ_MIN_INTRO}', String(LIFE_BIZ_MIN_INTRO))
    const ids = (db.prepare(sql).all() as { seller_id: number }[]).map((r) => r.seller_id).sort()
    // 1: 소개 기준 충족 · 3: 후기 있음 · 2: 숨김 후기만 · 4: 정지 · 5: 공백 빼면 기준 미달 · 6: 비활성
    expect(ids).toEqual([1, 3])
  })
})
