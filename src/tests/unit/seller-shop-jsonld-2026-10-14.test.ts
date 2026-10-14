/**
 * 🏪 **가게 유어샵의 구조화 데이터** — 2026-10-14
 *   (대표 *"또 개선점 찾아보자. SEO 와 GEO 부분에서"*)
 *
 * ## 실측 — 형제는 내는데 이 표면만 0건이었다 (Googlebot UA 로 `ld+json` 블록을 셌다)
 *
 *     /u/jiwon1228          블록 2 → [Organization, WebSite] + [BreadcrumbList, ProfilePage, ItemList]
 *     /s/store_muxlddtf74b  블록 1 → [Organization, WebSite]   ← 페이지 노드가 **없다**
 *     /s/store_mt9rvbhg1i6  블록 1 → 같음
 *     /profile/store_mux…   블록 1 → 같음 (같은 컴포넌트의 별칭)
 *
 * 즉 가게 유어샵은 **빵부스러기도 진열도 페이지 종류도** 없이 사이트 전역 브랜드 노드만 받았다.
 * `seller-noscript.ts` 머리말이 *"이 파일이 안 하는 것: 메타·OG·JSON-LD"* 로 적어 둔 그 구멍이다.
 *
 * 🔴 **2건이라서 작은 문제가 아니다** — `/s/:username` 은 **앞으로 등록되는 모든 매장**의 유어샵
 * URL 이다(`/store/new` 가 `linked_user_id` 를 비우므로 sitemap 이 `/u/` 가 아니라 `/s/` 로 갈린다).
 *
 * ## ⚠️ 이 시험이 **못 보는 것**
 * - 구글이 그 리치결과를 실제로 쓰는지(색인 수일~수주 · 서치콘솔은 **대표만** 본다).
 * - HTMLRewriter 런타임 배선(워커 전용 API 라 유닛 밖) — ③이 **소스로** 배선을 고정한다.
 * - 클라(`SellerPublicPage.tsx`)가 내는 `@type: 'Person'` 노드. 가게는 사람이 아니고 그 `url` 은
 *   **비정본** `/profile/:username` 인데, 그 파일은 **로딩 잠금표**라 대표 승인이 필요하다 ⇒
 *   인계 대기 항목. 🔑 크롤러에는 도달하지 않는다(봇 UA 는 스크립트 없는 문서를 받는다).
 */
import { describe, it, expect } from 'vitest'
import { buildSellerShopJsonLd, SURFACE_LIST_MAX } from '@/worker/utils/surface-list-jsonld'
import { buildSellerSurfaceMeta } from '@/worker/utils/surface-ssr-meta'
import { readCode } from '../helpers/source-text'

const ORIGIN = 'https://urdeal.kr'
const PATH = '/s/store_muxlddtf74b'

/** 라이브 `/api/sellers/:username/public` 응답 모양 그대로 (실측 키 23개 중 쓰는 것만). */
const seed = (over: Record<string, unknown> = {}, products?: unknown[]) => JSON.stringify({
  success: true,
  data: {
    id: 26, username: 'store_muxlddtf74b', name: '달빛한스푼', business_name: '달빛한스푼',
    bio: null, profile_image: null, business_address: null, website_url: null,
    sns_instagram: null, sns_youtube: null, sns_facebook: null, sns_twitter: null,
    products: products ?? [{
      id: 2919, name: '달빛한스푼 닭도리탕', price: 31000, original_price: 35000,
      discount_rate: 0, image_url: 'https://media.ur-team.com/uploads/seller/26/a.jpg',
      category: 'meal_voucher', deal_only: 0, restaurant_name: '달빛한스푼',
      stock: 99, group_buy_status: 'active',
    }],
    ...over,
  },
})

function graph(raw: string) {
  const meta = buildSellerSurfaceMeta(raw, ORIGIN, PATH)
  expect(meta, '메타 빌더가 null — 시드 모양을 다시 볼 것').toBeTruthy()
  const ld = buildSellerShopJsonLd(raw, ORIGIN, meta!)
  return { meta: meta!, ld, nodes: ld ? (JSON.parse(ld)['@graph'] as Array<Record<string, unknown>>) : [] }
}
const typeOf = (n: Record<string, unknown>) => String(n['@type'])

describe('① 진짜 빌더를 돌려 판정한다 — 형제(/u)와 같은 틀', () => {
  it('BreadcrumbList · ProfilePage · ItemList 셋을 낸다', () => {
    const { nodes } = graph(seed())
    expect(nodes.map(typeOf)).toEqual(['BreadcrumbList', 'ProfilePage', 'ItemList'])
  })

  it('빵부스러기는 **두 단계**이고 둘 다 실재하는 URL 이다', () => {
    const { nodes, meta } = graph(seed())
    const items = (nodes[0] as { itemListElement: Array<{ position: number; name: string; item: string }> }).itemListElement
    expect(items.map(i => i.position)).toEqual([1, 2])
    expect(items[1]!.name).toBe('달빛한스푼')
    expect(items[1]!.item).toBe(meta.canonical)
    // 🔴 `유어샵` 을 중간에 끼우면 `/s` 라는 **없는 URL** 을 가리킨다(형제 빌더가 `/u` 로 적어 둔 함정).
    expect(items.map(i => i.item)).not.toContain(`${ORIGIN}/s`)
    expect(items.map(i => i.name)).not.toContain('유어샵')
  })

  it('가게는 **Organization** 이다 — Person 이라 말하지 않는다', () => {
    const { nodes } = graph(seed())
    const page = nodes[1] as { mainEntity: Record<string, unknown> }
    expect(page.mainEntity['@type']).toBe('Organization')
    expect(JSON.stringify(nodes), '가게를 사람으로 적재하게 된다').not.toContain('"Person"')
  })

  it('정본은 메타가 고른 그 값이다 — `/profile/` 별칭으로 들어와도 같은 하나', () => {
    const a = graph(seed())
    const metaB = buildSellerSurfaceMeta(seed(), ORIGIN, '/profile/store_muxlddtf74b')!
    const b = JSON.parse(buildSellerShopJsonLd(seed(), ORIGIN, metaB))['@graph'] as Array<Record<string, unknown>>
    expect(a.meta.canonical).toBe(`${ORIGIN}${PATH}`)
    expect(String((b[1] as { url: string }).url)).toBe(a.meta.canonical)
    expect(String((b[1] as { '@id': string })['@id'])).toBe(a.meta.canonical)
  })

  it('항목 URL 은 정본 SSOT 를 지난다 (`/pass/:id` — 손으로 조립하지 않는다)', () => {
    const { nodes } = graph(seed())
    const list = nodes[2] as { numberOfItems: number; itemListElement: Array<{ url: string; position: number }> }
    expect(list.numberOfItems).toBe(1)
    expect(list.itemListElement[0]!.url).toBe(`${ORIGIN}/pass/2919`)
    expect(list.itemListElement.map(i => i.position)).toEqual([1])
  })

  it('🔴 교환권(deal_only=1)은 항목에서 빠진다 — 그 상세는 noindex 다', () => {
    const { nodes } = graph(seed({}, [
      { id: 1, name: '교환권', price: 300, category: 'convenience', deal_only: 1 },
      { id: 2919, name: '닭도리탕', price: 31000, category: 'meal_voucher', deal_only: 0 },
    ]))
    const urls = (nodes[2] as { itemListElement: Array<{ url: string }> }).itemListElement.map(i => i.url)
    expect(urls).toEqual([`${ORIGIN}/pass/2919`])
    expect(JSON.stringify(nodes)).not.toContain('/vouchers/1')
  })

  it('상한을 넘기지 않고 position 이 1..N 연속이다', () => {
    const many = Array.from({ length: SURFACE_LIST_MAX + 7 }, (_, i) => ({
      id: 3000 + i, name: `상품 ${i}`, price: 1000 + i, category: 'meal_voucher', deal_only: 0,
    }))
    const { nodes } = graph(seed({}, many))
    const list = nodes[2] as { numberOfItems: number; itemListElement: Array<{ position: number }> }
    expect(list.itemListElement.length).toBe(SURFACE_LIST_MAX)
    expect(list.numberOfItems).toBe(SURFACE_LIST_MAX)
    expect(list.itemListElement.map(i => i.position))
      .toEqual(Array.from({ length: SURFACE_LIST_MAX }, (_, i) => i + 1))
  })
})

describe('② 지어내지 않는다 (없는 값은 키 자체를 안 만든다)', () => {
  it('라이브 그대로(전부 null) — sameAs·image 키가 없다', () => {
    const { nodes } = graph(seed())
    const org = (nodes[1] as { mainEntity: Record<string, unknown> }).mainEntity
    expect(org).not.toHaveProperty('sameAs')
    expect(org).not.toHaveProperty('image')
    // 🔴 빈 배열도 안 낸다 — "계정이 있는데 비었다" 로 읽힌다.
    expect(JSON.stringify(nodes)).not.toContain('"sameAs":[]')
  })

  it('SNS·사이트가 있으면 sameAs 로 — http(s) 만', () => {
    const { nodes } = graph(seed({
      profile_image: 'https://media.ur-team.com/a.jpg',
      sns_instagram: 'https://instagram.com/x',
      website_url: 'ftp://bad',
      sns_youtube: '   ',
    }))
    const org = (nodes[1] as { mainEntity: Record<string, unknown> }).mainEntity
    expect(org.sameAs).toEqual(['https://instagram.com/x'])
    expect(org.image).toBe('https://media.ur-team.com/a.jpg')
  })

  it('진열이 없으면 ItemList 를 아예 안 낸다 (빈 목록을 선언하지 않는다)', () => {
    const { nodes } = graph(seed({}, []))
    expect(nodes.map(typeOf)).toEqual(['BreadcrumbList', 'ProfilePage'])
    expect(JSON.stringify(nodes)).not.toContain('ItemList')
  })

  it('이름이 없거나 파싱이 실패하면 `\'\'` — 종전과 byte-동일(무회귀)', () => {
    const meta = buildSellerSurfaceMeta(seed(), ORIGIN, PATH)!
    for (const raw of ['{{', '', '{"data":{}}', '{"data":{"name":"   "}}', 'null']) {
      expect(buildSellerShopJsonLd(raw, ORIGIN, meta), `raw=${raw}`).toBe('')
    }
  })

  it('`</script` 를 이스케이프한다 — 탐침 값으로 **동작**을 잰다', () => {
    const { ld } = graph(seed({ name: 'a</script><b>y', business_name: 'a</script><b>y' }))
    expect(ld).not.toContain('</script>')
    expect(ld).toContain('<\\/script')
    expect(() => JSON.parse(ld)).not.toThrow()
  })
})

describe('③ 배선 — 워커 SELLER 블록이 **실제로** 넘긴다', () => {
  const w = readCode('src/worker/index.ts')

  it('SELLER 블록이 jsonLd 를 넘긴다 (빌더만 있고 안 부르면 아무것도 안 바뀐다)', () => {
    expect(w, '배선이 없으면 이 PR 은 라이브에서 아무 일도 하지 않는다')
      .toMatch(/sellerMeta[\s\S]{0,200}buildSellerShopJsonLd\(ssrPayload, origin2, sellerMeta\)/)
  })

  it('import 가 있다', () => {
    expect(w).toContain('buildSellerShopJsonLd')
  })

  it('🔵 반대 방향 — 형제(CURATOR) 배선을 뺏어 쓰지 않았다', () => {
    expect(w, 'buildCuratorJsonLd 가 사라지면 개인 유어샵이 구조화 데이터를 잃는다')
      .toContain('buildCuratorJsonLd(')
  })
})
