/**
 * 🔗 크롤러 문서의 내부 링크 — 2026-10-12
 *
 * 대표 *"다 개선하고 또 개선할 것 있는지 찾아줘"*. 라이브에서 **Googlebot UA 로 서버 HTML 을 받아
 * `<a href>` 를 셌다**(JSON-LD 가 아니라 **링크**를 셌다 — 둘은 다른 것이다):
 *
 *     표면            본문      a태그
 *     /region/서울     364자     0
 *     /vouchers        231자     0
 *     /map             359자     0
 *     /stays           436자     0
 *     /browse           36자     0
 *     ------------------------------------
 *     /pass/:id                  2   (서버 첫 화면의 빵부스러기)
 *     /u/:handle                 4   (첫 화면 진열)
 *     /blog                     21   (글 목록)
 *
 * 즉 **허브 → 상세** 방향이 통째로 비어 있었다. 목록이 가게·메뉴·가격을 *글로는* 말하면서
 * 그 상품으로 가는 길을 하나도 주지 않았다. 상세 → 허브는 빵부스러기가 이미 잇고 있었다.
 *
 * 🔑 **왜 JSON-LD `ItemList` 로는 안 되나**: 그건 "이 목록의 항목" 이라는 *설명*이고, 크롤 발견과
 *    내부 링크 가치는 `<a href>` 가 만든다. JS 를 렌더하는 Googlebot 은 SPA 링크를 보지만
 *    **Yeti(네이버)·AI 검색봇은 이 문서가 전부**다(대표 *"네이버도 해주고"*).
 *
 * ⚠️ **이 시험이 못 보는 것**: 구글·네이버가 그 링크를 실제로 따라가는지(색인 수일~수주 ·
 *    서치콘솔은 대표만 본다) · 사람 화면(그 블록은 `<noscript>` 라 JS 가 돌면 렌더조차 안 된다).
 */
import { describe, it, expect } from 'vitest'
import { buildStaticSurfaceNoscript } from '@/worker/utils/crawler-noscript'
import { canonicalDetailPath, FLOW_CONFIG } from '@/shared/product-flow'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const SRC = 'src/worker/utils/crawler-noscript.ts'
const code = () => stripComments(readFileSync(SRC, 'utf8'))

/** 탐침 시드 — 네 종류 + 링크를 만들 수 없는 행을 **함께** 담는다. */
const PASS = { id: 2919, name: '닭도리탕', restaurant_name: '달빛한스푼', category: 'meal_voucher', price: 31000, original_price: 35000, restaurant_address: '서울 종로구 1길' }
const STAY = { id: 2887, name: '평일 1박', restaurant_name: '그랑블루&펜션', category: 'stay_voucher', price: 209000, restaurant_address: '강원 속초시 2로' }
const DEAL = { id: 2192, name: '쥬시쿨', brand_name: 'CU', category: '기타', deal_only: 1, price: 600 }
const SHOP = { id: 2917, name: '무선충전기', restaurant_name: '구서 우성', category: 'general', price: 10000 }
const NOID = { name: '아이디 없는 행', restaurant_name: 'a&b', category: 'meal_voucher', price: 1000, restaurant_address: '서울 중구 3가' }
const SEED = JSON.stringify({ data: [PASS, STAY, DEAL, SHOP, NOID] })

const html = (path: string, seed = SEED) => buildStaticSurfaceNoscript(path, seed)
const hrefs = (s: string) => [...s.matchAll(/href="([^"]*)"/g)].map(m => m[1])
const lis = (s: string) => (s.match(/<li>/g) || []).length

describe('① 목록·지역 표면이 상세로 가는 링크를 낸다', () => {
  it('`/browse`·`/map` — 이용권·숙소·쇼핑 세 종류가 각자의 정본으로', () => {
    for (const p of ['/browse', '/map']) {
      const h = hrefs(html(p))
      expect(h.length, `${p} 에 링크가 없다 — 허브에서 상세로 가는 길이 0`).toBeGreaterThanOrEqual(3)
      expect(h).toContain('/pass/2919')
      expect(h).toContain('/stays/2887')
      expect(h, '순수 쇼핑 상품의 정본은 `/products/:id` 다').toContain('/products/2917')
    }
  })

  it('`/stays` — 숙소만', () => {
    const h = hrefs(html('/stays'))
    expect(h).toEqual(['/stays/2887'])
  })

  it('`/region/:sido` — 그 지역 항목만', () => {
    const h = hrefs(html('/region/서울'))
    expect(h, '지역 페이지에 링크가 없다').toContain('/pass/2919')
    expect(h.some(x => x.startsWith('/stays/')), '강원 숙소가 서울에 섞였다').toBe(false)
  })

  it('주소를 손으로 적지 않는다 — 정본 SSOT 와 같은 값', () => {
    const h = hrefs(html('/browse'))
    expect(h).toContain(canonicalDetailPath({ id: PASS.id, category: PASS.category }))
    expect(h).toContain(canonicalDetailPath({ id: STAY.id, category: STAY.category }))
    expect(h).toContain(FLOW_CONFIG.standard_checkout.detailPath(SHOP.id))
    const c = code()
    expect(c, '`canonicalDetailPath` 를 지나야 ItemList·sitemap 과 세 벌이 안 된다').toMatch(/canonicalDetailPath\(/)
    expect(c, '쇼핑 폴백도 SSOT 에서 받는다').toMatch(/FLOW_CONFIG\.standard_checkout\.detailPath/)
  })
})

describe('② 반대 방향 — 링크하면 안 되는 것', () => {
  it('교환권(`deal_only=1`)은 링크 0 · 글은 남는다', () => {
    const s = html('/vouchers')
    expect(lis(s), '`/vouchers` 가 읽을 거리를 잃으면 안 된다').toBeGreaterThanOrEqual(1)
    expect(hrefs(s),
      '교환권 상세는 2026-07-07 결정으로 noindex — 2,260건에 크롤 경로를 열면 색인 말라 한 URL 로 예산이 빠진다').toEqual([])
    expect(s).toContain('쥬시쿨')
  })

  it('교환권은 다른 표면에 섞여도 링크를 안 받는다', () => {
    // `/browse` 는 `deal_only !== 1` 만 남기므로 이 시드에서 교환권 자체가 걸러진다 —
    // 그 필터를 믿지 않고, 교환권만 있는 시드를 `/map` 에 줘서 **링크가 0인지** 직접 본다.
    const only = JSON.stringify({ data: [{ ...DEAL, deal_only: 1, restaurant_address: '서울 중구' }] })
    expect(hrefs(html('/map', only))).toEqual([])
  })

  it('id 가 없는 행은 링크 없이 **글만**', () => {
    const s = html('/region/서울')
    expect(s).toContain('아이디 없는 행')
    // 🩸 첫 판은 `href === '' || endsWith('/')` 만 봤다 — `id` 가 없으면 주소가
    //   `/pass/undefined` 로 나오는데 그 둘 중 아무것도 아니라 **주입이 통과했다**.
    //   ⇒ 모양을 짐작하지 말고 ① 그 행이 `<a>` 밖에 있는지 ② 주소에 빈 자리가 섞였는지 본다.
    expect(s, 'id 없는 행이 링크 안에 들어갔다').toMatch(/<li>[^<]*아이디 없는 행/)
    for (const h of hrefs(s)) {
      expect(h, `빈 자리가 섞인 주소: ${h}`).not.toMatch(/undefined|null|\/$|^$/)
      expect(h).toMatch(/^\/[a-z]+\/\d+$/)
    }
  })
})

describe('③ 탈출과 상한', () => {
  it('글자도 주소도 HTML 탈출한다', () => {
    const nasty = JSON.stringify({ data: [{ id: '1" onmouseover="x', name: '제목', restaurant_name: 'a&b', category: 'meal_voucher', price: 1000, restaurant_address: '서울 중구' }] })
    const s = html('/region/서울', nasty)
    expect(s).toContain('a&amp;b')
    expect(s, 'href 안의 따옴표가 날것으로 나가면 속성이 끊긴다').not.toMatch(/href="[^"]*" onmouseover/)
    expect(s).not.toContain('onmouseover="x"')
  })

  it('상한 8 — `<noscript>` 는 사람이 받는 응답에도 실린다', () => {
    const many = JSON.stringify({ data: Array.from({ length: 12 }, (_, i) => ({ ...PASS, id: 3000 + i, name: `메뉴${i}` })) })
    expect(lis(html('/map', many))).toBe(8)
    expect(lis(html('/region/서울', many))).toBe(8)
  })
})
