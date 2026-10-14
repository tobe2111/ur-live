/**
 * 🧬 서버가 이미 낸 `@type` 을 클라가 **다시 내지 않는다** (2026-10-14).
 *
 * 실측(아이폰 UA 로 **실제 렌더**해서 `script[type="application/ld+json"]` 을 센 값 —
 * `[data-rh]` 가 helmet 이 넣은 클라 노드):
 *
 *     /pass/2823           blocks 4 · rh 2 → 중복 `Product` · `BreadcrumbList`
 *     /products/2917       blocks 3 · rh 1 → 중복 `Product`
 *     /region/서울          blocks 3 · rh 1 → 중복 `BreadcrumbList`
 *     /region              blocks 3 · rh 1 → 중복 `BreadcrumbList`
 *     /blog/what-is-urdeal blocks 3 · rh 1 → 중복 `BreadcrumbList`
 *
 * `/pass/:id` 가 가장 나쁘다 — 서버 `Product` 는 `aggregateRating` 을 갖고 클라 것은 안 갖는다.
 *
 * 🔑 **검색엔진은 영향 없다**(실측): Googlebot 스마트폰 UA 로 10초를 기다려도 `blocks 2 · rh 0` 이고
 *    그 문서엔 앱 엔트리 `<script>` 와 스타일시트가 **아예 없다**(script/link 태그 15개 전수 확인).
 *    영향받는 것은 JS 를 렌더하면서 `BOT_UA_REGEX` 에 없는 클라이언트 — **AI 검색봇**이다(GEO 축).
 *
 * ## ⚠️ 이 시험이 못 보는 것
 *
 * - AI 엔진이 중복을 **실제로 어떻게 처리하는지**(외부 동작 · 관측 불가)
 * - 라이브에서 정말 줄었는지 — 배포 후 렌더 실측이 유일한 판정(E4)
 * - 서버·클라 노드의 **내용** 불일치(종류가 같을 때 클라를 버릴 뿐이다)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { readFileSync } from 'node:fs'
import SEO from '../../components/SEO'
import { topLevelTypes, dropServerDuplicates, serverJsonLdTypes } from '../../shared/seo/jsonld-dedupe'
import { stripComments } from '../helpers/source-text'

const code = (p: string) => stripComments(readFileSync(p, 'utf8'))
const SEO_SRC = 'src/components/SEO.tsx'

describe('① topLevelTypes — 그 자체로 선언한 종류만', () => {
  it('단일 노드 · 배열 · @graph 를 모두 센다', () => {
    expect(topLevelTypes({ '@type': 'Product' })).toEqual(['Product'])
    expect(topLevelTypes([{ '@type': 'Product' }, { '@type': 'BreadcrumbList' }]))
      .toEqual(['Product', 'BreadcrumbList'])
    expect(topLevelTypes({ '@graph': [{ '@type': 'Organization' }, { '@type': 'WebSite' }] }))
      .toEqual(['Organization', 'WebSite'])
    expect(topLevelTypes({ '@type': ['Product', 'Offer'] })).toEqual(['Product', 'Offer'])
  })

  it('🔴 중첩 종류는 세지 않는다 (세면 과잉 삭제가 된다)', () => {
    const server = { '@type': 'Product', offers: { '@type': 'Offer' }, address: { '@type': 'PostalAddress' } }
    expect(topLevelTypes(server), '안쪽 Offer·PostalAddress 가 잡혔다').toEqual(['Product'])
  })

  it('쓰레기 입력에 던지지 않는다', () => {
    for (const x of [null, undefined, 0, '', 'Product', [], {}, [null]])
      expect(() => topLevelTypes(x)).not.toThrow()
    expect(topLevelTypes(null)).toEqual([])
  })
})

describe('② dropServerDuplicates — 겹치는 것만 버린다', () => {
  it('서버가 낸 종류의 클라 노드를 버리고 나머지는 남긴다', () => {
    const out = dropServerDuplicates(
      [{ '@type': 'Product' }, { '@type': 'FAQPage' }],
      new Set(['Product', 'BreadcrumbList']),
    )
    expect(out.map(topLevelTypes).flat()).toEqual(['FAQPage'])
  })

  it('🔒 fail-open — 서버 집합이 비면 원본 그대로', () => {
    const client = [{ '@type': 'Product' }, { '@type': 'BreadcrumbList' }]
    expect(dropServerDuplicates(client, new Set())).toHaveLength(2)
  })

  it('🔒 종류를 못 읽은 노드는 남긴다 (판단 근거가 없으면 지우지 않는다)', () => {
    const out = dropServerDuplicates([{ foo: 1 } as Record<string, unknown>], new Set(['Product']))
    expect(out).toHaveLength(1)
  })

  it('여러 종류를 가진 노드는 **전부** 겹칠 때만 버린다', () => {
    const node = { '@graph': [{ '@type': 'Product' }, { '@type': 'FAQPage' }] }
    expect(dropServerDuplicates([node], new Set(['Product'])), '일부만 겹쳐도 버렸다').toHaveLength(1)
    expect(dropServerDuplicates([node], new Set(['Product', 'FAQPage']))).toHaveLength(0)
  })

  it('단일 노드 · undefined 도 받는다', () => {
    expect(dropServerDuplicates({ '@type': 'Product' }, new Set(['Product']))).toHaveLength(0)
    expect(dropServerDuplicates(undefined, new Set(['Product']))).toHaveLength(0)
  })
})

describe('③ serverJsonLdTypes — [data-rh] 는 서버 노드가 아니다', () => {
  beforeEach(() => { document.head.innerHTML = '' })

  const plant = (json: string, rh = false) => {
    const el = document.createElement('script')
    el.type = 'application/ld+json'
    if (rh) el.setAttribute('data-rh', 'true')
    el.textContent = json
    document.head.appendChild(el)
  }

  it('서버 노드만 센다', () => {
    plant('{"@type":"Product"}')
    plant('{"@type":"FAQPage"}', true)
    expect([...serverJsonLdTypes(document)].sort()).toEqual(['Product'])
  })

  it('@graph 서버 노드를 센다 (브랜드 블록이 그 모양이다)', () => {
    plant('{"@graph":[{"@type":"Organization"},{"@type":"WebSite"}]}')
    expect([...serverJsonLdTypes(document)].sort()).toEqual(['Organization', 'WebSite'])
  })

  it('깨진 블록 하나가 나머지를 못 쓰게 만들지 않는다', () => {
    plant('{ 깨짐')
    plant('{"@type":"Product"}')
    expect([...serverJsonLdTypes(document)]).toEqual(['Product'])
  })

  it('문서가 없으면 빈 집합 (fail-open 으로 이어진다)', () => {
    expect(serverJsonLdTypes(undefined).size).toBe(0)
    expect(serverJsonLdTypes(null).size).toBe(0)
  })
})

describe('④ SEO 컴포넌트를 실제로 렌더해서 판정한다', () => {
  afterEach(() => { cleanup(); document.head.innerHTML = '' })

  const plantServer = (json: string) => {
    const el = document.createElement('script')
    el.type = 'application/ld+json'
    el.textContent = json
    document.head.appendChild(el)
  }

  const renderSeo = async (jsonLd: unknown) => {
    render(
      <HelmetProvider>
        <SEO title="t" jsonLd={jsonLd as Record<string, unknown>[]} />
      </HelmetProvider>,
    )
    await new Promise((r) => setTimeout(r, 60))
    const all = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    return { all, rh: all.filter((e) => e.hasAttribute('data-rh')) }
  }

  // 🔑 **양성 통제가 먼저다.** 이게 없으면 "클라 노드가 0개" 가 *걸러져서* 인지
  //   *helmet 이 애초에 안 쓴* 것인지 구분되지 않는다 — 이 시험의 첫 판이 정확히 그래서 헛돌았다.
  it('양성 통제 — 서버 노드가 없으면 클라 노드가 **뜬다**', async () => {
    const { rh } = await renderSeo([{ '@type': 'FAQPage' }])
    expect(rh, 'helmet 이 JSON-LD 를 안 쓴다 — 이 환경에서는 ④를 믿을 수 없다').toHaveLength(1)
  })

  it('서버가 이미 낸 종류는 클라가 안 낸다', async () => {
    plantServer('{"@type":"FAQPage"}')
    const { all, rh } = await renderSeo([{ '@type': 'FAQPage' }])
    expect(rh, '서버가 이미 낸 종류를 클라가 또 냈다').toHaveLength(0)
    expect(all, '서버 노드가 사라졌다').toHaveLength(1)
  })

  it('겹치지 않는 종류는 그대로 낸다 (과잉 삭제 금지)', async () => {
    plantServer('{"@type":"BreadcrumbList"}')
    const { rh } = await renderSeo([{ '@type': 'FAQPage' }])
    expect(rh, '겹치지 않는데 지웠다').toHaveLength(1)
  })

  it('실측 모양 그대로 — 서버 @graph + Product, 클라 Product + BreadcrumbList', async () => {
    plantServer('{"@graph":[{"@type":"Organization"},{"@type":"WebSite"}]}')
    plantServer('{"@type":"Product","aggregateRating":{"@type":"AggregateRating"}}')
    const { rh } = await renderSeo([{ '@type': 'Product' }, { '@type': 'BreadcrumbList' }])
    // 서버에 `Product` 는 있고 `BreadcrumbList` 는 없다 ⇒ 하나만 남아야 한다.
    expect(rh).toHaveLength(1)
    expect(rh[0]!.textContent).toContain('BreadcrumbList')
  })
})

describe('⑤ 배선 — 거르는 경로가 끊기지 않았다', () => {
  const s = () => code(SEO_SRC)

  it('렌더가 `usableJsonLd` 를 지난다 (원본 jsonLd 를 직접 map 하지 않는다)', () => {
    expect(s(), '거르는 함수를 안 쓴다').toContain('usableJsonLd(jsonLd)')
    expect(s(), 'jsonLd 를 직접 렌더하는 경로가 남았다').not.toMatch(/jsonLd\.map\(/)
    expect(s(), 'jsonLd 를 직접 렌더하는 경로가 남았다').not.toMatch(/JSON\.stringify\(jsonLd\)/)
  })

  it('SSR·프리렌더에서는 거르지 않는다 (문서가 없다)', () => {
    expect(s(), 'document 유무 확인이 사라졌다').toMatch(/typeof document !== 'undefined'/)
  })

  it('🔒 SPA 이동 뒤에는 거르지 않는다 (모듈 로드 시점 경로와 비교한다)', () => {
    expect(s(), '기준 경로를 모듈 로드 때 안 잡는다').toMatch(/const INITIAL_PATH = /)
    expect(s(), '첫 로드 경로 비교가 사라졌다 — 다른 페이지의 서버 노드와 비교하게 된다')
      .toMatch(/location\.pathname === INITIAL_PATH/)
  })

  it('🩸 종류를 **메모하지 않는다** (메모가 이 시험을 헛돌게 만들었다)', () => {
    // 첫 판은 `serverLd` 에 캐시했는데, 서버 노드가 없던 첫 렌더에서 빈 집합이 굳어
    // 두 번째 렌더에서 아무것도 안 걸렀고 **그래도 초록**이었다(④의 양성 통제가 그래서 생겼다).
    expect(s(), '종류 캐시가 되살아났다 — 첫 렌더 시점에 판정이 매달린다')
      .not.toMatch(/serverLd|cachedServerTypes|typesOnce/)
  })
})
