/**
 * 🔖 2026-10-14 — **첫 화면이 없는 유어샵의 크롤러 문서에 제목·링크가 0이었다.**
 *
 * ## 라이브 실측 (Googlebot UA, sitemap 표본 48표면)
 * `h1` 이 0개인 표면이 **정확히 하나**였고 그 한 곳은 **내부 링크도 0개**였다:
 *
 *       /u/user40     h1 0 · a 0 · 본문 58자   ← linked_seller 유어샵(첫 화면 `''`)
 *       /u/jiwon1228  h1 1 · a 5 · 본문 419자
 *       (나머지 46표면)  전부 h1 1
 *
 * 원인·처방·버린 길은 `buildCuratorNoscript` 머리말의 🔖 절에 있다. 요지는 둘이다:
 *   ① 폴백 경로(`withName`)는 이름을 `<p>` 로 쓰고 행을 **링크 없는 `<li>`** 로 냈다.
 *   ② 재료(`product_id`·`category`·`deal_only`)는 **시드에 이미 와 있었고 타입만 안 받았다**.
 *
 * ## ⚠️ 이 시험이 **못 보는 것**
 *  - 구글·네이버가 그 링크를 실제로 따라가는지(외부 판정 · 서치콘솔은 대표만 본다).
 *  - 사람 화면(그 블록은 `<noscript>` 라 JS 가 돌면 렌더조차 안 된다 — byte-동일).
 *  - 사진은 범위 밖이다(이번 실측은 heading·링크였다).
 */
import { describe, it, expect } from 'vitest'
import { buildCuratorNoscript } from '@/worker/utils/crawler-noscript'
import { readCode } from '../helpers/source-text'

/** 라이브 `/u/user40` 시드의 모양 그대로 — linked_seller 유어샵, 핀 1개(쇼핑 상품). */
const USER40 = {
  curator: { name: '현정', bio: null },
  pins: [{ product_name: '프리미엄 무선아이폰', price: 10000, restaurant_name: '구서 우성아파트', product_id: 2917, category: 'lifestyle', deal_only: 0 }],
}
/** 라이브 `/u/jiwon1228` 시드의 모양 — 핀 넷이 숙소·이용권으로 섞여 있다. */
const JIWON = {
  curator: { name: '정지원', bio: '전국의 맛집을 소개합니다.' },
  pins: [
    { product_name: '평일 1박 숙박권', price: 209000, restaurant_name: '그랑블루글램핑&펜션', product_id: 2887, category: 'stay_voucher', deal_only: 0 },
    { product_name: '곱창전골 2인', price: 35100, restaurant_name: '부용한우곱창', product_id: 2835, category: 'meal_voucher', deal_only: 0 },
  ],
}
const SRC = 'src/worker/utils/crawler-noscript.ts'
const hrefs = (s: string) => [...s.matchAll(/<a href="([^"]*)"/g)].map((m) => m[1])
const h1s = (s: string) => (s.match(/<h1>/g) || []).length

describe('① 폴백 경로 — 제목과 링크가 생긴다', () => {
  it('제목이 `h1` 로 정확히 하나 (라이브에서 0개였다)', () => {
    const out = buildCuratorNoscript(USER40, { withName: true })
    expect(h1s(out), '폴백에 h1 이 없다 — 라이브 /u/user40 의 그 결함이다').toBe(1)
    expect(out).toContain('<h1>현정 유어샵</h1>')
    // 🔴 `<p>이름 유어샵</p>` 으로 되돌아가면 안 된다(그게 종전 모양이다).
    expect(out, '이름을 다시 <p> 로 쓴다').not.toContain('<p>현정 유어샵</p>')
  })

  it('행이 정본 주소로 링크된다 — 쇼핑 상품은 `/products/:id`', () => {
    const out = buildCuratorNoscript(USER40, { withName: true })
    expect(hrefs(out), '폴백에 내부 링크가 0 — 라이브 /u/user40 의 그 결함이다').toEqual(['/products/2917'])
  })

  it('카테고리별 정본 주소를 SSOT 가 정한다 (손으로 적지 않는다)', () => {
    const out = buildCuratorNoscript(JIWON, { withName: true })
    // 숙소는 `/stays/:id`, 식사 이용권은 `/pass/:id` — `canonicalDetailPath` 가 말하는 그대로.
    expect(hrefs(out)).toEqual(['/stays/2887', '/pass/2835'])
  })

  it('교환권(`deal_only=1`)은 링크하지 않는다 — 그 상세는 noindex 다', () => {
    const out = buildCuratorNoscript({
      curator: { name: '현정', bio: null },
      pins: [{ product_name: '스타벅스 아메리카노', price: 4500, restaurant_name: null, product_id: 2192, category: 'etc', deal_only: 1 }],
    }, { withName: true })
    expect(hrefs(out), '색인하지 말라고 한 URL 로 크롤 예산이 빠진다').toEqual([])
    // 🔑 글은 그대로 남는다 — 링크만 안 단다(목록 표면과 같은 규율).
    expect(out).toContain('스타벅스 아메리카노')
  })

  it('사업자 진열(`linked_seller_products`)도 같은 규칙 — 그쪽 id 는 `id` 다', () => {
    const out = buildCuratorNoscript({
      curator: { name: '현정', bio: null },
      pins: [],
      linked_seller_products: [{ name: '프리미엄 무선아이폰', price: 10000, restaurant_name: '구서 우성아파트', id: 2917, category: 'lifestyle', deal_only: 0 }],
    }, { withName: true })
    expect(hrefs(out)).toEqual(['/products/2917'])
    expect(h1s(out)).toBe(1)
  })
})

describe('② 첫 화면이 있는 경로 — byte-불변 (반대 방향)', () => {
  it('제목도 링크도 내지 않는다 — `#root` 에 이미 있다', () => {
    const out = buildCuratorNoscript(JIWON)
    expect(h1s(out), '같은 페이지에 h1 이 둘이 된다').toBe(0)
    expect(hrefs(out), '같은 URL 로 가는 링크가 두 벌이 된다').toEqual([])
  })

  it('그 경로의 글자는 종전 그대로', () => {
    const out = buildCuratorNoscript(JIWON)
    expect(out).toBe(
      '<noscript><p>전국의 맛집을 소개합니다.</p><ul>'
      + '<li>평일 1박 숙박권, 그랑블루글램핑&amp;펜션 · 209,000원</li>'
      + '<li>곱창전골 2인, 부용한우곱창 · 35,100원</li>'
      + '</ul></noscript>',
    )
  })
})

describe('③ 규율 — 지어내지 않는다 · 두 벌을 만들지 않는다', () => {
  it('재료가 없으면 아무것도 안 낸다 (이름만으로 본문을 꾸미지 않는다)', () => {
    expect(buildCuratorNoscript({ curator: { name: '현정', bio: null }, pins: [] }, { withName: true })).toBe('')
    expect(buildCuratorNoscript(null, { withName: true })).toBe('')
  })

  it('id 가 없으면 링크 없이 글만 — 빈 `<a>` 를 만들지 않는다', () => {
    const out = buildCuratorNoscript({
      curator: { name: '현정', bio: null },
      pins: [{ product_name: '이름만 있는 핀', price: 0, restaurant_name: null, product_id: null, category: null, deal_only: 0 }],
    }, { withName: true })
    expect(hrefs(out)).toEqual([])
    expect(out).toContain('이름만 있는 핀')
    expect(out).not.toContain('<a ')
  })

  it('HTML 탈출 — 탐침 값으로 **동작**을 잰다', () => {
    const out = buildCuratorNoscript({
      curator: { name: 'a&b', bio: 'x</script><b>y' },
      pins: [{ product_name: 'c&d', price: 100, restaurant_name: '<e>', product_id: 1, category: 'lifestyle', deal_only: 0 }],
    }, { withName: true })
    expect(out).toContain('<h1>a&amp;b 유어샵</h1>')
    expect(out).toContain('x&lt;/script&gt;&lt;b&gt;y')
    expect(out).toContain('c&amp;d, &lt;e&gt;')
    expect(out, '탈출 안 된 원문이 샜다').not.toMatch(/<b>y|<e>/)
  })

  it('주소는 목록 표면과 **같은 함수**(`rowHref`)로 만든다 — 손으로 조립 0', () => {
    const src = readCode(SRC)
    expect(src, 'rowHref 를 안 쓴다 — 주소가 ItemList·sitemap 과 갈릴 수 있다').toContain('rowHref({')
    // 🔴 유어샵 쪽에서 상세 경로를 직접 적는 것 금지(두 벌이 되면 갈린다).
    expect(src).not.toMatch(/`\/products\/\$\{/)
    expect(src).not.toMatch(/`\/pass\/\$\{/)
  })

  it('판정이 `standalone` 한 곳에 모여 있다 (두 분기가 따로 자라지 않게)', () => {
    const src = readCode(SRC)
    expect(src).toMatch(/const standalone = !!opts\.withName/)
    // 제목·링크 둘 다 그 하나를 본다.
    expect(src).toMatch(/standalone \? h1Of\(name/)
    expect(src).toMatch(/standalone\s*\?\s*rowHref\(/)
  })

  /**
   * 🩸 **주입이 이 단언의 첫 판을 잡았다.** 처음엔 인터페이스를 통째로 잘라
   * `toContain('product_id')` 로 봤는데, 그러면 `product_id?: never` 로 바꿔 놓아도 **통과**한다
   * (이름은 그대로 남으니까) — 게다가 `category`·`deal_only` 는 **형제 블록**
   * (`linked_seller_products`)에도 있어서 같은 인터페이스 안이면 늘 걸린다.
   * ⇒ **필드 이름은 선언이 살아 있는지 말해 주지 않는다.** 블록을 나눠 **타입까지** 대조한다.
   * ⚠️ 이 결함은 타입 층이라 런타임 시험으로는 원리상 못 잡는다(vitest 는 타입체크를 안 한다) —
   *    그래서 이 자리만 소스 단언이고, 실제 방어는 CI 의 `tsc` 와 함께 선다.
   */
  it('시드 타입이 링크 재료를 **타입까지** 선언한다 (값은 라이브에 이미 온다)', () => {
    const src = readCode(SRC)
    const i = src.indexOf('export interface NoscriptCuratorSeed {')
    expect(i, '인터페이스가 사라졌다 — 앵커가 낡았다').toBeGreaterThanOrEqual(0)
    const iface = src.slice(i, src.indexOf('\n}', i))
    const sub = (key: string) => {
      const j = iface.indexOf(`${key}?: Array<{`)
      expect(j, `${key} 선언이 사라졌다 — 앵커가 낡았다`).toBeGreaterThanOrEqual(0)
      const end = iface.indexOf('} | null> | null', j)
      expect(end).toBeGreaterThan(j)
      return iface.slice(j, end)
    }
    const pins = sub('pins')
    expect(pins, 'pins 에 product_id 가 살아 있는 선언이 아니다').toContain('product_id?: number | string | null')
    expect(pins).toContain('category?: string | null')
    expect(pins).toContain('deal_only?: number | null')
    const lsp = sub('linked_seller_products')
    expect(lsp, '사업자 진열 쪽 id 선언이 없다').toContain('id?: number | string | null')
    expect(lsp).toContain('category?: string | null')
    expect(lsp).toContain('deal_only?: number | null')
  })
})
