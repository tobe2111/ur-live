/**
 * 🍞 2026-10-12 — 지역·블로그 표면의 `BreadcrumbList`
 *
 * 배경(라이브 실측 — Googlebot UA 로 서버 HTML 을 받아 **파싱해서** 셌다): 색인 대상
 * **`/region` 44개 + `/blog` 23편 = 67페이지**가 `BreadcrumbList` **0건**이었다. 둘의 이유가 다르다:
 *   · 지역 — 경로가 **동적**(`/region/서울/중구`)이라 `crumbTrail` 의 표 조회(`CONSUMER_SURFACE_SEO`)가
 *     한 단계도 못 쌓고 `trail.length === 1` 에서 걸렸다. `ItemList` 는 나오는데 빵부스러기만 없었다.
 *   · 블로그 — 소비자 표면 중 **유일하게 다른 빌더**(`blog-ssr-meta.ts`)를 쓴다. 2026-10-11 의
 *     목록 처방이 그 파일까지 오지 않았다.
 * 결과는 검색결과 제목 아래에 빵부스러기 대신 **생 URL** 이 뜨는 것이다(대표가 보낸 야놀자 스크린샷의 그 줄).
 *
 * 🔑 **URL 은 canonical 과 같은 조립이어야 한다** — 빵부스러기가 canonical 아닌 URL 을 가리키면
 *    같은 페이지를 두 주소로 말하는 셈이다. 그래서 이 시험은 문자열을 손으로 적지 않고
 *    **`resolveRegionSeo` 의 canonical 과 대조**한다(두 벌이면 갈린다).
 *
 * ⚠️ 이 시험이 **못 보는 것**: 구글이 그 빵부스러기를 실제로 쓰는지(색인 수일~수주 · 서치콘솔은
 *    대표만 본다) · HTMLRewriter 배선의 런타임 동작(워커 전용 API 라 유닛 밖).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildSurfaceListJsonLd } from '../../worker/utils/surface-list-jsonld'
import { resolveRegionSeo } from '../../worker/utils/surface-ssr-meta'
import { buildBlogListJsonLd, buildBlogPostMeta } from '../../features/blog/api/blog-ssr-meta'
import { CONSUMER_SITE_NAME } from '../../shared/seo/consumer-surfaces'
import { stripComments } from '../helpers/source-text'

const O = 'https://urdeal.kr'

/** 재귀로 훑어 `BreadcrumbList` 만 모은다 — `@graph` 중첩 때문에 top-level 만 보면 놓친다. */
function crumbs(json: string): Array<Array<{ name: string; item: string }>> {
  const out: Array<Array<{ name: string; item: string }>> = []
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object') return
    const o = n as Record<string, unknown>
    if (o['@type'] === 'BreadcrumbList') {
      out.push((o.itemListElement as Array<{ name: string; item: string }>).map(x => ({ name: x.name, item: x.item })))
    }
    Object.values(o).forEach(walk)
  }
  walk(JSON.parse(json))
  return out
}

/** 정의된 `@id` 와 참조된 `@id` 를 모아 **매달린 참조**를 찾는다(사이트 전역 노드는 제외). */
function dangling(json: string): string[] {
  const ids = new Set<string>(); const refs = new Set<string>()
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object') return
    const o = n as Record<string, unknown>
    const id = o['@id']
    if (typeof id === 'string') (o['@type'] ? ids : refs).add(id)
    Object.values(o).forEach(walk)
  }
  walk(JSON.parse(json))
  return [...refs].filter(r => !ids.has(r) && !/#(organization|website)$/.test(r))
}

const meta = (path: string) => ({ title: 't', description: 'd', canonical: `${O}${path}` })
const chain = (json: string) => crumbs(json).map(c => c.map(x => x.name).join(' › '))

describe('🍞 지역 표면 빵부스러기', () => {
  it('① 시/도·시군구 단계가 쌓인다 (종전 0건)', () => {
    expect(chain(buildSurfaceListJsonLd('/region/서울', '', O, meta('/region/서울'), null)))
      .toEqual([`${CONSUMER_SITE_NAME} › 지역 › 서울`])
    expect(chain(buildSurfaceListJsonLd('/region/서울/중구', '', O, meta('/region/서울/중구'), null)))
      .toEqual([`${CONSUMER_SITE_NAME} › 지역 › 서울 › 중구`])
  })

  it('② 허브(`/region`)도 단계를 받는다 — 실재하는 페이지다', () => {
    expect(chain(buildSurfaceListJsonLd('/region', '', O, meta('/region'), null)))
      .toEqual([`${CONSUMER_SITE_NAME} › 지역`])
    // 🔴 중간 단계가 **없는 URL** 을 가리키면 안 된다(유어샵의 `/u` 가 그 사례) — 리졸버로 확인.
    const hub = resolveRegionSeo('/region', O)
    expect(hub, '`/region` 허브가 사라졌다 — 중간 단계가 없는 URL 을 가리킨다').not.toBeNull()
    expect(hub?.canonical).toBe(`${O}/region`)
    expect(hub?.noindex).not.toBe(true)
  })

  it('③ 단계 URL 이 canonical 과 **같은 조립**이다 (정규화·인코딩 포함)', () => {
    for (const path of ['/region/서울', '/region/서울/중구', '/region/강원특별자치도']) {
      const seo = resolveRegionSeo(path, O)
      expect(seo?.canonical, path).toBeTruthy()
      const last = crumbs(buildSurfaceListJsonLd(path, '', O, meta(path), null))[0].at(-1)!
      expect(last.item, `${path} 의 마지막 단계가 canonical 과 다르다`).toBe(seo!.canonical)
    }
  })

  it('④ 정규화된 이름을 쓴다 — `강원특별자치도` → `강원`', () => {
    expect(chain(buildSurfaceListJsonLd('/region/강원특별자치도', '', O, meta('/region/강원특별자치도'), null)))
      .toEqual([`${CONSUMER_SITE_NAME} › 지역 › 강원`])
  })

  it('⑤ 모르는 지역은 noindex → 아무것도 안 낸다 (도어웨이에 리치결과를 주지 않는다)', () => {
    const seo = resolveRegionSeo('/region/없는도', O)
    expect(seo?.noindex).toBe(true)
    expect(buildSurfaceListJsonLd('/region/없는도', '', O, { ...meta('/region/없는도'), noindex: true }, null)).toBe('')
  })

  it('⑦ 목록 표면도 체인을 한 벌만 싣고 본문 노드는 `@id` 로 가리킨다', () => {
    for (const path of ['/vouchers', '/browse', '/stays', '/region/서울']) {
      const json = buildSurfaceListJsonLd(path, '', O, meta(path), null)
      expect(crumbs(json).length, `${path}: 같은 BreadcrumbList 가 둘이다`).toBe(1)
      expect(dangling(json), `${path}: 정의되지 않은 @id 를 가리킨다`).toEqual([])
      // 본문 노드가 참조를 **실제로** 들고 있어야 연결이 선다(참조만 지우면 고아 체인이 된다).
      const g = (JSON.parse(json) as { '@graph': Array<Record<string, unknown>> })['@graph']
      const page = g.find(n => n['@type'] === 'CollectionPage' || n['@type'] === 'WebPage')!
      expect((page.breadcrumb as { '@id'?: string })?.['@id'], `${path}: 본문 노드에 breadcrumb 참조가 없다`)
        .toBe(`${O}${path}#breadcrumb`)
    }
  })

  it('⑥ 기존 표면은 그대로다 (회귀 0)', () => {
    expect(chain(buildSurfaceListJsonLd('/vouchers', '', O, meta('/vouchers'), null)))
      .toContain(`${CONSUMER_SITE_NAME} › 교환권`)
    // 홈은 체인이 자기 하나뿐 → 빵부스러기를 안 낸다(정보가 0).
    expect(chain(buildSurfaceListJsonLd('/', '', O, meta('/'), null))).toEqual([])
  })
})

describe('🍞 블로그 빵부스러기', () => {
  const seedList = JSON.stringify({ data: [{ slug: 'a-b', title: '제목', summary: '요약', published_at: '2026-01-01' }] })
  const seedPost = JSON.stringify({ data: { slug: 'a-b', title: '제목', summary: '요약', published_at: '2026-01-01' } })

  it('① 목록은 두 단계 · 상세는 세 단계', () => {
    const list = buildBlogListJsonLd(seedList, O, `${O}/blog`, 'n', 'd')
    expect(chain(list)).toEqual([`${CONSUMER_SITE_NAME} › 블로그`])
    const post = buildBlogPostMeta(seedPost, O)
    expect(chain(post!.jsonLd)).toEqual([`${CONSUMER_SITE_NAME} › 블로그 › 제목`])
    expect(crumbs(post!.jsonLd)[0].at(-1)!.item).toBe(`${O}/blog/a-b`)
  })

  it('② 시드가 없어도(콜드 timeout) 빵부스러기는 나온다 — 종전엔 통째로 0건이었다', () => {
    const cold = buildBlogListJsonLd(null, O, `${O}/blog`, 'n', 'd')
    expect(cold).not.toBe('')
    expect(chain(cold)).toEqual([`${CONSUMER_SITE_NAME} › 블로그`])
  })

  it('③ 같은 체인을 두 벌 싣지 않고, 매달린 `@id` 도 없다', () => {
    for (const json of [
      buildBlogListJsonLd(seedList, O, `${O}/blog`, 'n', 'd'),
      buildBlogListJsonLd(null, O, `${O}/blog`, 'n', 'd'),
      buildBlogPostMeta(seedPost, O)!.jsonLd,
    ]) {
      expect(crumbs(json).length, '같은 문서에 BreadcrumbList 가 둘이다').toBe(1)
      expect(dangling(json), '정의되지 않은 @id 를 가리킨다').toEqual([])
    }
  })

  it('④ 사이트 이름을 손으로 적지 않는다 (SSOT 경유 — 두 벌이면 갈린다)', () => {
    const src = stripComments(readFileSync('src/features/blog/api/blog-ssr-meta.ts', 'utf-8'))
    expect(src).toContain('CONSUMER_SITE_NAME')
    expect(src, '사이트 이름이 리터럴로 박혔다').not.toMatch(/name:\s*'유어딜'\s*,\s*url:/)
  })
})
