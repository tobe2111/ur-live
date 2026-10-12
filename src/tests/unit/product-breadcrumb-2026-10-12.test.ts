/**
 * 🍞 쇼핑 상세(`/products/:id`)의 빵부스러기 — 2026-10-12
 *
 * 대표 *"다 개선하고 또 개선할 것 있는지 찾아줘"* 로 색인 대상 표면을 **전수로 다시 재니**
 * (Googlebot UA 로 서버 HTML 을 받아 JSON-LD 를 **파싱해서** 노드 타입을 셌다):
 *
 *     표면                 robots           BreadcrumbList
 *     /pass/2919           index, follow    O
 *     /stays/2887          index, follow    O
 *     /u/jiwon1228         index, follow    O
 *     /blog/:slug          index, follow    O   ← 같은 날 오전에 고쳤다
 *     /region/서울          index, follow    O   ← 〃
 *     `/products/2917`    index, follow    ← **X 였다**
 *     /                    index, follow    X   ← 루트라 **의도**(한 단계 빵부스러기는 무의미)
 *
 * 즉 색인 대상 상세 **넷 중 하나만** 빵부스러기가 없었다. 오전에 `/region` 44개와 `/blog` 23편을
 * 고치면서 쇼핑만 빠졌고, 그 자리는 `buildProductMeta` 가 `[product]` **하나만** 내보내고 있었다
 * (형제 `buildDetailMeta`·`buildStayDetailMeta` 는 둘 다 breadcrumb 를 낸다).
 * 빵부스러기가 없으면 검색결과 제목 아래에 경로 대신 **생 URL** 이 뜬다.
 *
 * ⚠️ **이 시험이 못 보는 것**: 구글이 그 빵부스러기를 실제로 리치결과에 쓰는지(색인 수일~수주 ·
 *    서치콘솔은 대표만 본다) · HTMLRewriter 런타임 배선(워커 전용 API 라 유닛 밖).
 */
import { describe, it, expect } from 'vitest'
import { buildProductMeta, buildDetailMeta, buildStayDetailMeta } from '@/worker/utils/detail-ssr-meta'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const O = 'https://urdeal.kr'
const SRC = 'src/worker/utils/detail-ssr-meta.ts'
const code = () => stripComments(readFileSync(SRC, 'utf8'))

const pay = (d: Record<string, unknown>) => JSON.stringify({ data: d })

/** 빌더를 **돌려서** BreadcrumbList 노드를 재귀로 찾는다(모양 검사 아님). */
function crumbOf(jsonLd: string | undefined): Array<Record<string, unknown>> {
  if (!jsonLd) return []
  const parsed = JSON.parse(jsonLd)
  const found: Array<Record<string, unknown>> = []
  const walk = (o: unknown) => {
    if (Array.isArray(o)) { o.forEach(walk); return }
    if (o && typeof o === 'object') {
      const d = o as Record<string, unknown>
      if (d['@type'] === 'BreadcrumbList') found.push(d)
      Object.values(d).forEach(walk)
    }
  }
  walk(parsed)
  return found
}

const SHOP = { id: 2917, name: '프리미엄 무선아이폰', price: 10000, image_url: 'https://i.ibb.co/x.png', category: 'general' }

describe('① 쇼핑 상세가 빵부스러기를 낸다', () => {
  it('3단계 · position 1..3 연속', () => {
    const m = buildProductMeta(pay(SHOP), O, '/products/2917')
    const bc = crumbOf(m?.jsonLd)
    expect(bc.length, '쇼핑 상세에 BreadcrumbList 가 없다 — 검색결과에 생 URL 이 뜬다').toBe(1)
    const items = bc[0].itemListElement as Array<Record<string, unknown>>
    expect(items.length).toBe(3)
    expect(items.map(i => i.position)).toEqual([1, 2, 3])
    expect(items.map(i => i.name)).toEqual(['홈', '쇼핑', SHOP.name])
  })

  it('중간 단계는 `/browse` 를 가리키고 라벨은 그 표의 crumb 와 **같은 값**', () => {
    const m = buildProductMeta(pay(SHOP), O, '/products/2917')
    const items = crumbOf(m?.jsonLd)[0].itemListElement as Array<Record<string, unknown>>
    expect(items[1].name).toBe(CONSUMER_SURFACE_SEO['/browse']?.crumb)
    expect(items[1].item).toBe(`${O}/browse`)
  })

  it('마지막 항목 URL = canonical (pathname 아님)', () => {
    const m = buildProductMeta(pay(SHOP), O, '/products/2917')
    const items = crumbOf(m?.jsonLd)[0].itemListElement as Array<Record<string, unknown>>
    expect(items[2].item).toBe(m?.canonical)
    expect(items[0].item).toBe(`${O}/`)
  })

  /**
   * 🩸 이 하나만 **소스 판정**이다 — 동작으로는 구분할 수 없다.
   *   빵부스러기를 내는 조건이 `canonicalPath == null`(= cross-canonical 아님)이므로, 그 순간
   *   `canonical` 은 **언제나** `${origin}${pathname}` 과 같은 값이다. 즉 마지막 항목을
   *   `pathname` 으로 바꿔도 지금 출력은 1바이트도 안 바뀐다(주입으로 확인했다 — 초록이 떴다).
   *   그런데 **나중에 조건을 넓히면**(예: cross-canonical 표면에도 달기로 하면) 그때부터
   *   빵부스러기가 정본 아닌 URL 을 가리키기 시작하고, 그건 에러 없이 조용히 어긋난다.
   *   ⇒ 둘이 우연히 같은 지금 **의도를 소스에 고정**해 둔다.
   */
  it('마지막 항목은 소스에서도 `canonical` 이다 (pathname 금지)', () => {
    const c = code()
    // 🩸 첫 판은 `indexOf('const jsonLd = …')` 를 **파일 앞에서** 찾아 빈 문자열을 잘랐다
    //   (그 이름은 형제 빌더에도 있다). 블록은 `shopCrumb` **뒤**에서 끝을 찾아야 한다.
    const from = c.indexOf('const shopCrumb')
    const block = c.slice(from, c.indexOf('const jsonLd = escapeScript', from))
    expect(block.length, '빵부스러기 블록을 못 찾았다 — 이 단언이 아무것도 안 지킨다').toBeGreaterThan(80)
    expect(block).toMatch(/position: 3, name, item: canonical/)
    expect(block, '마지막 항목에 pathname 을 쓰면 정본 아닌 URL 을 가리킨다').not.toMatch(/\$\{origin\}\$\{pathname\}/)
  })

  it('라벨을 손으로 적지 않는다 — 표에서 받는다', () => {
    const c = code()
    expect(c, '`/browse` 의 crumb 를 표에서 받아야 한다(두 벌이면 목록 표면과 갈린다)')
      .toMatch(/CONSUMER_SURFACE_SEO\['\/browse'\]\?\.crumb/)
  })
})

describe('② 반대 방향 — 정본이 남이면 빵부스러기를 내지 않는다', () => {
  it('이용권: `/products/2919` 는 canonical 이 `/pass/2919` 라 안 낸다', () => {
    const m = buildProductMeta(pay({ id: 2919, name: '닭도리탕', price: 31000, category: 'meal_voucher' }), O, '/products/2919')
    expect(m?.canonical).toBe(`${O}/pass/2919`)
    expect(crumbOf(m?.jsonLd).length,
      '정본이 `/pass/:id` 인데 여기서 `홈 › 쇼핑 › …` 를 주장하면 같은 항목에 두 URL 이 서로 다른 빵부스러기를 낸다').toBe(0)
  })

  it('숙소: canonical 이 `/stays/:id` 라 안 낸다', () => {
    const m = buildProductMeta(pay({ id: 2887, name: '그랑블루', price: 149000, category: 'stay_voucher' }), O, '/products/2887')
    expect(m?.canonical).toBe(`${O}/stays/2887`)
    expect(crumbOf(m?.jsonLd).length).toBe(0)
  })

  it('교환권: noindex 이고 쇼핑도 아니라 안 낸다', () => {
    const m = buildProductMeta(pay({ id: 2192, name: 'CU 쥬시쿨', price: 600, deal_only: 1, category: '기타' }), O, '/products/2192')
    expect(m?.noindex).toBe(true)
    expect(crumbOf(m?.jsonLd).length).toBe(0)
  })
})

describe('③ 형제 빌더의 빵부스러기는 그대로 (회귀 방지)', () => {
  it('이용권 상세(`/pass/:id`)', () => {
    const m = buildDetailMeta(pay({ id: 2919, name: '닭도리탕', price: 31000, category: 'meal_voucher', restaurant_name: '달빛한스푼' }), O, '/pass/2919')
    const items = crumbOf(m?.jsonLd)[0]?.itemListElement as Array<Record<string, unknown>> | undefined
    expect(items?.map(i => i.name)[1], '이용권 상세의 중간 단계는 동네딜이다').toBe('동네딜')
  })

  it('숙소 상세(`/stays/:id`)', () => {
    const m = buildStayDetailMeta(pay({ data: { product: { id: 2887, name: '그랑블루', region_sido: '강원' }, rooms: [] } }).replace(/^\{"data":/, '{"data":').slice(0), O, '/stays/2887')
      || buildStayDetailMeta(JSON.stringify({ data: { product: { id: 2887, name: '그랑블루', region_sido: '강원' }, rooms: [] } }), O, '/stays/2887')
    const items = crumbOf(m?.jsonLd)[0]?.itemListElement as Array<Record<string, unknown>> | undefined
    expect(items?.map(i => i.name)[1], '숙소 상세의 중간 단계는 숙소다').toBe('숙소')
  })
})
