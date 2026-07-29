/**
 * 🔎 2026-07-29 서버 메타 rewrite **배선** 불변식.
 *
 * `consumer-surface-seo.test.ts` 는 순수함수의 *값* 만 봤다. 여기서는 그 값이 실제로 어떤
 * `.on(selector)` 에 어떤 내용으로 흘러가는지를, HTMLRewriter 를 흉내 낸 가짜 객체로 확인한다.
 * (진짜 HTMLRewriter 는 Workers 런타임 전용이라 이 환경에서 실행할 수 없다.)
 *
 * ⚠️ 여전히 **못 막는 것**: `worker/index.ts` 가 `applySurfaceMeta` 를 *호출하지 않게* 되는 회귀.
 *    그건 배포 후 `curl https://urdeal.kr/vouchers | grep -c canonical` 로 본다.
 */
import { describe, it, expect } from 'vitest'
import { applySurfaceMeta, buildSellerSurfaceMeta } from '@/worker/utils/surface-ssr-meta'

/** HTMLRewriter 흉내 — `.on()` 호출을 기록하고 핸들러를 즉시 실행해 결과를 수집한다. */
function fakeRewriter() {
  const title: string[] = []
  const attrs: Array<{ selector: string; name: string; value: string }> = []
  const appended: string[] = []
  const selectors: string[] = []
  const rb = {
    on(selector: string, handlers: { element(el: unknown): void }) {
      selectors.push(selector)
      handlers.element({
        setInnerContent: (c: string) => title.push(c),
        setAttribute: (name: string, value: string) => attrs.push({ selector, name, value }),
        append: (c: string) => appended.push(c),
      })
      return rb
    },
  }
  return { rb, title, attrs, appended, selectors }
}

const META = {
  pageTitle: '교환권 - 유어딜',
  title: '교환권 - 유어딜',
  description: '설명',
  canonical: 'https://urdeal.kr/vouchers?category=%ED%8E%B8%EC%9D%98%EC%A0%90',
}

describe('applySurfaceMeta — 배선', () => {
  it('title·description·og·twitter·canonical 을 모두 덮어쓴다', () => {
    const f = fakeRewriter()
    applySurfaceMeta(f.rb, META)
    expect(f.title).toEqual(['교환권 - 유어딜'])
    const get = (sel: string) => f.attrs.find(a => a.selector === sel)?.value
    expect(get('meta[name="description"]')).toBe('설명')
    expect(get('meta[property="og:title"]')).toBe('교환권 - 유어딜')
    expect(get('meta[property="og:description"]')).toBe('설명')
    expect(get('meta[property="og:url"]')).toBe(META.canonical)
    expect(get('meta[name="twitter:title"]')).toBe('교환권 - 유어딜')
    expect(f.appended.join('')).toContain(`<link rel="canonical" href="${META.canonical}">`)
  })

  it('og:image 를 안 주면 사이트 기본 OG 카드를 건드리지 않는다 (목록 표면)', () => {
    const f = fakeRewriter()
    applySurfaceMeta(f.rb, META)
    expect(f.selectors).not.toContain('meta[property="og:image"]')
    expect(f.selectors).not.toContain('meta[name="twitter:image"]')
  })

  it('og:image 를 주면 og/twitter 양쪽을 교체한다 (링크샵·상세)', () => {
    const f = fakeRewriter()
    applySurfaceMeta(f.rb, { ...META, ogImage: 'https://urdeal.kr/api/og/curator/x' })
    const imgs = f.attrs.filter(a => a.name === 'content' && a.value.includes('/api/og/curator/x'))
    expect(imgs.map(i => i.selector).sort()).toEqual(['meta[name="twitter:image"]', 'meta[property="og:image"]'])
  })

  it('noindex 는 줄 때만 robots 를 바꾼다 (교환권 상세 대칭)', () => {
    const off = fakeRewriter()
    applySurfaceMeta(off.rb, META)
    expect(off.selectors).not.toContain('meta[name="robots"]')

    const on = fakeRewriter()
    applySurfaceMeta(on.rb, { ...META, noindex: true })
    expect(on.attrs.find(a => a.selector === 'meta[name="robots"]')?.value).toBe('noindex, follow')
  })

  it('jsonLd 는 canonical 과 같은 head 에 이어 붙는다', () => {
    const f = fakeRewriter()
    applySurfaceMeta(f.rb, { ...META, jsonLd: '{"@type":"Product"}' })
    const head = f.appended.join('')
    expect(head).toContain('rel="canonical"')
    expect(head).toContain('<script type="application/ld+json">{"@type":"Product"}</script>')
    expect(head.indexOf('canonical')).toBeLessThan(head.indexOf('ld+json'))
  })

  it('canonical 은 속성 이스케이프를 거친다 (마크업을 문자열로 만드는 자리)', () => {
    const f = fakeRewriter()
    applySurfaceMeta(f.rb, { ...META, canonical: 'https://urdeal.kr/a"><b>' })
    expect(f.appended.join('')).toContain('href="https://urdeal.kr/a&quot;&gt;&lt;b&gt;"')
  })
})

describe('buildSellerSurfaceMeta — 셀러 링크샵', () => {
  const payload = (d: unknown) => JSON.stringify({ success: true, data: d })

  it('표시 이름으로 제목을 만든다 (라이브 버그: /s/* 가 전부 "유어딜 홈" 메타였다)', () => {
    const m = buildSellerSurfaceMeta(payload({ name: '제아스컴퍼니', username: 'jea1612' }), 'https://urdeal.kr', '/s/jea1612')!
    expect(m.pageTitle).toBe('제아스컴퍼니 링크샵 - 유어딜')
    expect(m.canonical).toBe('https://urdeal.kr/s/jea1612')
    expect(m.ogType).toBe('profile')
  })

  it('name 이 없으면 business_name 으로 대체한다', () => {
    const m = buildSellerSurfaceMeta(payload({ business_name: '리스터코퍼레이션' }), 'https://urdeal.kr', '/s/x')!
    expect(m.pageTitle).toContain('리스터코퍼레이션')
  })

  it('bio 가 있으면 description 으로 쓰고 200자로 자른다', () => {
    const long = '가'.repeat(300)
    const m = buildSellerSurfaceMeta(payload({ name: 'A', bio: long }), 'https://urdeal.kr', '/s/a')!
    expect(m.description).toHaveLength(200)
  })

  it('이름을 못 구하면 null — 빈 제목으로 덮어써 더 나쁘게 만들지 않는다', () => {
    expect(buildSellerSurfaceMeta(payload({ username: 'x' }), 'https://urdeal.kr', '/s/x')).toBeNull()
    expect(buildSellerSurfaceMeta(payload({ name: '   ' }), 'https://urdeal.kr', '/s/x')).toBeNull()
  })

  it('깨진 페이로드에도 던지지 않는다 (기본 메타 유지)', () => {
    expect(buildSellerSurfaceMeta('not json', 'https://urdeal.kr', '/s/x')).toBeNull()
    expect(buildSellerSurfaceMeta('null', 'https://urdeal.kr', '/s/x')).toBeNull()
  })
})
