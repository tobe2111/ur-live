/**
 * 🧹 블로그 목록 JSON-LD 가 같은 글을 두 벌 내던 것 — 2026-10-14
 *
 * 대표 *"머지하고 또 개선점 찾아"*. 라이브 `/blog` 를 Googlebot UA 로 받아 **블록별로** 쟀다:
 *
 *     ld 블록 2개 · 총 20,078바이트 (문서 전체 31,475바이트 = 64%)
 *       블록0    799바이트  Organization + WebSite (브랜드)
 *       블록1 19,279바이트  Blog + BreadcrumbList
 *     headline 40회 (고유 20편) · Organization 노드 42개 · numberOfItems 선언 없음
 *
 * `Blog.blogPost` 와 `Blog.mainEntity.itemListElement[].item` 이 **같은 BlogPosting 객체를
 * 각각 통째로** 직렬화했다. 라이브 시드로 전후를 재니 **19,231 → 10,872바이트(−8,359 · 43%)**
 * (라이브 측정값 19,279 와 48바이트 차 — 재현이 맞다).
 *
 * ⚠️ **이 JSON 은 사람이 받는 응답에도 그대로 실린다** — 크롤러에게만 주면 구글 가이드 위반이므로
 *    그게 설계다. 즉 모든 방문자가 쓸모없는 8KB 를 더 받고 있었다. #73(`/pass` 가 서버 +
 *    react-helmet 두 벌)과 **같은 클래스의 다른 표면**이다.
 *
 * 🔑 **`mainEntity` 쪽을 남겼다** — 소비자 표면 전부(`surface-list-jsonld.ts`)가 `ItemList` +
 *    중첩 `item` + `numberOfItems` **한 벌**로 돌고 블로그만 밖에 있었다. 블로그를 그 모양에
 *    맞추는 것이 바이트도 줄이고 일관성도 되찾는다.
 *
 * ⚠️ **이 시험이 못 보는 것**: 구글이 `Blog.blogPost` 를 쓰고 있었는지(리치결과 판정은 서치콘솔 ·
 *    대표만 본다 — 다만 Article 리치결과는 **개별 글 페이지**에서 나오고 그쪽은 무접촉이다).
 */
import { describe, it, expect } from 'vitest'
import { buildBlogListJsonLd } from '@/features/blog/api/blog-ssr-meta'

const ORIGIN = 'https://urdeal.kr'
const CANON = `${ORIGIN}/blog`
const posts = (n: number) => Array.from({ length: n }, (_, i) => ({
  slug: `post-${i}`, title: `글 ${i}`, summary: '요약'.repeat(30), author: '유어딜 팀',
  published_at: '2026-09-24T09:51:07Z',
}))
const build = (n: number) => buildBlogListJsonLd(JSON.stringify({ data: posts(n) }), ORIGIN, CANON, '유어딜 블로그', '설명')
const parse = (s: string) => JSON.parse(s.replace(/<\\\//g, '</')) as { '@graph': Array<Record<string, unknown>> }

describe('① 같은 글을 두 벌 내지 않는다', () => {
  it('`blogPost` 가 없다 — `mainEntity.ItemList` 한 벌만', () => {
    const s = build(20)
    const blog = parse(s)['@graph'][0]
    expect(blog['@type']).toBe('Blog')
    expect('blogPost' in blog, '`blogPost` 가 되살아나면 20편이 다시 두 벌이 된다').toBe(false)
    expect((s.match(/"headline"/g) || []).length, 'headline 이 20회를 넘으면 중복이다').toBe(20)
  })

  it('항목은 그대로 20건 — 줄인 것은 중복뿐이다', () => {
    const list = parse(build(20))['@graph'][0].mainEntity as { numberOfItems: number; itemListElement: Array<Record<string, unknown>> }
    expect(list['@type' as keyof typeof list]).toBe('ItemList')
    expect(list.numberOfItems, '소비자 표면과 같은 권장 필드 — 종전엔 선언이 없었다').toBe(20)
    expect(list.itemListElement).toHaveLength(20)
    const first = list.itemListElement[0] as Record<string, unknown>
    expect(Object.keys(first).sort()).toEqual(['@type', 'item', 'position', 'url'])
    expect((first.item as Record<string, unknown>)['@type']).toBe('BlogPosting')
    expect(first.position).toBe(1)
    expect(first.url).toBe(`${ORIGIN}/blog/post-0`)
  })

  it('바이트가 실제로 준다 — 두 벌이면 1.6배 이상', () => {
    const after = build(20)
    const blog = parse(after)['@graph'][0]
    const list = blog.mainEntity as { itemListElement: Array<{ item: unknown }> }
    const before = JSON.stringify({ '@context': 'https://schema.org', '@graph': [
      { ...blog, blogPost: list.itemListElement.map((x) => x.item) }, parse(after)['@graph'][1]] })
    expect(before.length / after.length, '중복이 사라지면 전은 후의 1.6배 이상이어야 한다').toBeGreaterThan(1.6)
  })
})

describe('② 나머지는 종전 그대로', () => {
  it('Blog 가 제 필드를 다 갖는다 + 브랜드 노드는 `@id` 참조', () => {
    const blog = parse(build(5))['@graph'][0]
    for (const k of ['@type', 'name', 'description', 'url', 'publisher', 'isPartOf', 'mainEntity', 'breadcrumb']) {
      expect(blog, `Blog 에서 ${k} 가 사라졌다`).toHaveProperty(k)
    }
    expect(blog.publisher).toEqual({ '@id': `${ORIGIN}/#organization` })
    expect(blog.isPartOf).toEqual({ '@id': `${ORIGIN}/#website` })
    expect(blog.url).toBe(CANON)
  })

  it('빵부스러기는 그대로 — 그리고 매달린 `@id` 가 없다', () => {
    const g = parse(build(5))['@graph']
    expect(g).toHaveLength(2)
    const crumb = g[1]
    expect(crumb['@type']).toBe('BreadcrumbList')
    expect((g[0].breadcrumb as { '@id': string })['@id'], '참조가 같은 @graph 안의 노드를 가리켜야 한다').toBe(crumb['@id'])
  })

  it('시드가 없거나 글 0건이면 빵부스러기만 — 종전 동작', () => {
    for (const s of [buildBlogListJsonLd(null, ORIGIN, CANON, 'n', 'd'), build(0)]) {
      const g = parse(s)['@graph']
      expect(g).toHaveLength(1)
      expect(g[0]['@type']).toBe('BreadcrumbList')
    }
    expect(buildBlogListJsonLd('{{{', ORIGIN, CANON, 'n', 'd'), '파싱 실패는 빈 문자열').toBe('')
  })

  it('상한 20건 — 전량 덤프가 아니다', () => {
    const list = parse(build(40))['@graph'][0].mainEntity as { numberOfItems: number }
    expect(list.numberOfItems).toBe(20)
  })
})
