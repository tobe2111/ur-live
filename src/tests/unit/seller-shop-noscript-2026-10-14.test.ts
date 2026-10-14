/**
 * 🏪 2026-10-14 — `/s/:username`(사업자 유어샵)의 크롤러 본문.
 *
 * 근거·실측·왜 2건이 아니라 구조 문제인지는 `src/worker/utils/seller-noscript.ts` 머리말.
 * 요약: Googlebot UA 로 sitemap 제출 유어샵 3건을 재니 **2건이 본문 6자**였고, 그 표면엔 서버
 * 첫 화면 빌더가 **아예 없다**. 그리고 D1 실측 — 승인 셀러 10곳 중 `linked_user_id` 보유 **1곳** ·
 * `/store/new` 가 그 컬럼을 비우므로 **앞으로 모든 매장의 유어샵 URL 이 `/s/`** 다.
 *
 * ⚠️ **이 시험이 못 보는 것**
 *   - 구글·네이버가 그 본문을 실제로 색인하는지(수일~수주 · 서치콘솔은 **대표만** 본다)
 *   - HTMLRewriter 런타임 배선(워커 전용 API 라 유닛 밖) · 엣지 캐시 적중
 *   - 그 가게가 상품을 올렸는지(데이터 사실 — 재료가 없으면 `''` 이고 sitemap 게이트가 짝을 맞춘다)
 */
import { describe, it, expect } from 'vitest'
import { buildSellerNoscript } from '../../worker/utils/seller-noscript'
import { buildSellerPublicPayload } from '../../worker/utils/seller-public-payload'
import { readCode } from '../helpers/source-text'

/** 라이브 응답 모양 그대로 — `/api/products?seller_id=26` 실측(키 30개 중 빌더가 쓰는 것). */
const LIVE_ROW = {
  id: '2919', name: '달빛한스푼 닭도리탕', price: '31000', original_price: '35000',
  discount_rate: '0', image_url: 'https://media.ur-team.com/uploads/seller/26/2026-10/0F9CTfqE',
  category: 'meal_voucher', deal_only: '0', restaurant_name: '달빛한스푼', brand_name: null,
}
const seed = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ success: true, data: { id: '26', name: '달빛한스푼', username: 'store_muxlddtf74b', bio: null, products: [LIVE_ROW], ...over } })

/** 태그를 걷어낸 글자 — 라이브에서 본문을 재는 방식과 같다(엔티티도 되돌린다). */
const textOf = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()

describe('🏪 /s/:username 크롤러 본문', () => {
  // ──────────────────── ① 재료가 있으면 본문이 생긴다 (출력 판정)
  it('①-1 라이브 모양 시드 → 가게 이름 h1 + 상품 줄', () => {
    const out = buildSellerNoscript(seed())
    expect(out.startsWith('<noscript>')).toBe(true)
    expect(out).toContain('<h1>')
    const t = textOf(out)
    expect(t).toContain('달빛한스푼 유어샵')
    expect(t).toContain('닭도리탕')
    expect(t).toContain('31,000원')
    // 🔴 라이브 기준선: 6자였다. 이름만 반복하는 수준(20자 미만)이면 고친 게 아니다.
    expect(t.length).toBeGreaterThan(30)
  })

  it('①-2 항목 링크가 정본 주소다 (`/pass/:id` — 손으로 적지 않는다)', () => {
    const out = buildSellerNoscript(seed())
    expect(out).toContain('href="/pass/2919"')
    // 쇼핑 상품(순수)은 `/products/:id` — 같은 SSOT 가 고른다.
    const shop = buildSellerNoscript(seed({ products: [{ ...LIVE_ROW, id: '2917', category: 'lifestyle', name: '프리미엄 무선아이폰', original_price: null }] }))
    expect(shop).toContain('href="/products/2917"')
  })

  it('①-3 사진은 cdn-cgi 리사이저를 지난다 (원본 직링 금지)', () => {
    const out = buildSellerNoscript(seed())
    expect(out).toMatch(/<img src="\/cdn-cgi\/image\/[^"]+"/)
  })

  it('①-4 🩸 행이 가게 이름을 되풀이하지 않는다 (h1 이 이미 말한다)', () => {
    // 빌더를 돌려 눈으로 보고 잡은 결함 — `rowLine` 은 목록·지역 표면용이라 행 머리에
    // `restaurant_name` 을 붙인다. **이 페이지는 그 가게 자신**이라 그게 중복이 된다.
    const out = buildSellerNoscript(seed({
      name: '홍대돈까스',
      products: [{ ...LIVE_ROW, id: '2915', name: '버크셔 프리미엄 돈가스 1인 세트', restaurant_name: '홍대돈까스' }],
    }))
    const t = textOf(out)
    expect(t).toBe('홍대돈까스 유어샵 버크셔 프리미엄 돈가스 1인 세트 판매가 31,000원 (11% 할인)')
    // 가게 이름은 **딱 한 번**(h1) — 종전엔 `홍대돈까스 유어샵 홍대돈까스 — 버크셔 …` 였다.
    expect((t.match(/홍대돈까스/g) ?? []).length).toBe(1)
    // `restaurant_name` 이 가게명과 **다를** 때도 떼는 쪽이다(상품 카드가 안 그리는 말이다).
    const other = textOf(buildSellerNoscript(seed({
      name: '현정', products: [{ ...LIVE_ROW, id: '2917', name: '프리미엄 무선아이폰', original_price: null, category: 'lifestyle', restaurant_name: '구서 우성아파트' }],
    })))
    expect(other).not.toContain('구서 우성아파트')
    expect(other).toContain('프리미엄 무선아이폰')
  })

  // ──────────────────── ② 이름만 남으면 아무것도 내지 않는다
  it('②-1 소개·상품이 둘 다 없으면 빈 문자열 (이름으로 글자수를 늘리지 않는다)', () => {
    expect(buildSellerNoscript(seed({ products: [] }))).toBe('')
    expect(buildSellerNoscript(seed({ products: null }))).toBe('')
  })

  it('②-2 소개만 있어도 본문을 낸다 (상품 전 매장도 재료가 있으면)', () => {
    const out = buildSellerNoscript(seed({ products: [], bio: '합정에서 20년 된 돈가스집입니다.' }))
    expect(textOf(out)).toContain('합정에서 20년 된 돈가스집입니다.')
  })

  it('②-3 시드가 없거나 깨졌으면 빈 문자열 (무회귀)', () => {
    expect(buildSellerNoscript(null)).toBe('')
    expect(buildSellerNoscript('')).toBe('')
    expect(buildSellerNoscript('{깨진 json')).toBe('')
    expect(buildSellerNoscript(JSON.stringify({ success: true }))).toBe('')
  })

  // ──────────────────── ③ 탈출 — 탐침 값으로 **동작**을 잰다
  it('③-1 가게 이름·소개·상품명의 특수문자를 탈출한다', () => {
    const out = buildSellerNoscript(seed({
      name: 'a&b', bio: 'x</script><b>y', products: [{ ...LIVE_ROW, name: '1<2 "곱창"' }],
    }))
    expect(out).not.toContain('<script>')
    expect(out).not.toContain('<b>y')
    expect(out).toContain('a&amp;b')
    // 글자는 보존된다(탈출이 내용을 지우지 않는다)
    expect(textOf(out)).toContain('x</script><b>y')
  })

  // ──────────────────── ④ 상한 — `<noscript>` 는 사람 응답에도 실린다
  it('④-1 항목은 8개까지', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...LIVE_ROW, id: String(3000 + i), name: `상품${i}` }))
    const out = buildSellerNoscript(seed({ products: many }))
    expect((out.match(/<li>/g) ?? []).length).toBe(8)
  })

  // ──────────────────── ⑤ 행 조립을 다시 쓰지 않는다
  it('⑤-1 목록 표면과 같은 조립 함수를 쓴다 (링크·사진·가격이 갈릴 수 없다)', () => {
    const src = readCode('src/worker/utils/seller-noscript.ts')
    expect(src).toContain("from './crawler-noscript-rows'")
    for (const fn of ['rowLine', 'liOf', 'capRowImages']) expect(src, fn).toContain(fn)
    // 자기 사본을 만들지 않는다 — 가격·주소를 직접 조립하면 반드시 갈린다.
    expect(src).not.toContain('canonicalDetailPath')
    expect(src).not.toContain('priceDisplay')
  })

  // ──────────────────── ⑥ 배선
  it('⑥-1 페이로드가 상품을 담고, 그 옵션은 셀러 공개 라우트만 켠다', () => {
    const pay = readCode('src/worker/utils/seller-public-payload.ts')
    expect(pay).toContain('withProducts')
    expect(pay).toContain('loadLinkedSellerProducts')
    const route = readCode('src/worker/routes/seller.routes.ts')
    expect(route).toContain('{ withProducts: true }')
    // 🔴 curator 는 **켜지 않는다** — `linked_seller_products` 를 따로 동봉하므로 두 벌이 된다.
    const cur = readCode('src/worker/routes/curator.routes.ts')
    expect(cur).toContain('buildSellerPublicPayload(c.env, linkedSeller.username)')
    expect(cur).not.toContain('withProducts')
  })

  it('⑥-2 워커가 SELLER 슬롯에서 이 빌더를 쓴다', () => {
    const w = readCode('src/worker/index.ts')
    expect(w).toContain("ssrSlot === 'SELLER' ? buildSellerNoscript(ssrPayload)")
    expect(w).toContain("from './utils/seller-noscript'")
  })

  it('⑥-3 sitemap 의 셀러 상품 EXISTS 가 소비자-가시 술어를 지난다 (짝 주장)', () => {
    const sm = readCode('src/worker/routes/sitemap.routes.ts')
    // 상품 분기·핀 분기 **둘 다** — 2026-10-12 에 핀만 좁혀 이쪽이 남아 있었다.
    expect((sm.match(/consumerVisibleProductSql\('p'\)/g) ?? []).length).toBeGreaterThanOrEqual(1)
    expect((sm.match(/consumerVisibleProductSql\('pq'\)/g) ?? []).length).toBeGreaterThanOrEqual(1)
    // SQL 본문에 JS 주석을 넣지 않는다(처음에 그래서 TS1005 가 났다 — `//` 는 쿼리 텍스트가 된다).
    expect(sm).not.toMatch(/`[^`]*\n\s*\/\/[^\n]*\n[^`]*WHERE s\.status/)
  })

  // ──────────────────── ⑦ 반대 방향 — 기본이 켜지면 안 된다
  it('⑦-1 상품 enrich 가 옵션 뒤에 가둬져 있고 기본값은 꺼짐', () => {
    const pay = readCode('src/worker/utils/seller-public-payload.ts')
    // 기본값 `= {}` ⇒ 옵션 없이 부르면 `opts.withProducts` 가 undefined.
    expect(pay).toMatch(/opts:\s*\{\s*withProducts\?:\s*boolean\s*\}\s*=\s*\{\}/)
    // 로더 호출이 그 게이트 **안**에 있다 — 게이트 뒤로 새면 curator 동봉이 두 벌이 된다.
    const gate = pay.indexOf('if (opts.withProducts)')
    const call = pay.indexOf('loadLinkedSellerProducts(env.DB')
    expect(gate).toBeGreaterThan(-1)
    expect(call).toBeGreaterThan(gate)
  })

  it('⑦-2 상한 인자의 기본값이 100 이다 (curator 동봉은 byte-불변)', () => {
    const l = readCode('src/worker/utils/linkshop-seller-products.ts')
    expect(l).toMatch(/sellerId:\s*number,\s*limit\s*=\s*100/)
    // 셀러 페이로드는 작게 받는다 — `<noscript>` 상한과 같은 8.
    expect(readCode('src/worker/utils/seller-public-payload.ts')).toContain('Number(sid3), 8)')
  })
})
