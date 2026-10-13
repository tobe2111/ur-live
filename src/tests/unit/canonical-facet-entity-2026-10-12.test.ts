/**
 * 🔗 2026-10-12 (대표 *"다 개선하고 또 개선할 것 있는지 찾아줘"*) — **정본 주소 불변식 셋.**
 *
 * 전부 같은 클래스다: **에러가 안 나고 화면도 안 깨지며, 크롤러만 영향을 받는다.** 그래서 재 본
 * 사람만 알고, 룰만 적어 두면 반드시 다시 생긴다.
 *
 * ## ① 필터 파라미터가 무한 thin URL 을 만들지 않는다
 * 라이브 실측: `?category=`·`?brand=` 의 **임의 값**이 `200 + index, follow + 자기자신 canonical`
 * 이었다(본문 31~48자, `&` 조합은 곱셈). 자기 canonical 이라 *"이 정확한 URL 을 색인해 달라"* 고
 * **능동적으로** 말한다. 게다가 그 값이 `<title>`·`og:title` 에도 박혀
 * `테스트123 기프티콘 교환권…` 처럼 **없는 카테고리의 페이지 정체성을 지어냈다**(공유 카드에도 실린다).
 *
 * ## ② `/products/:id` 가 이용권·숙소의 정본을 가리킨다
 * 같은 상품이 `/pass/2919`·`/products/2919` 로, `/stays/2887`·`/products/2887` 로 각각 **자기 자신**을
 * 정본이라 선언했다. 서로를 가리키지도 않으니 구글은 둘 다 무시하고 자기가 고른다 —
 * 2026-10-12 오전 `/pass`↔`/stays` 수리(머지 `917358044`)의 **세 번째 얼굴**이다.
 *
 * ## ③ 존재할 수 없는 엔티티 id 는 **API 가 404** 를 준다 (술어를 넓히지 않는다)
 * 숫자 id 는 멀쩡한데(`/pass/99999999` → 404+noindex) **숫자가 아닌 id 는 다섯 슬롯 전부
 * `200 + index, follow`** 였다. 기계가 없는 게 아니라 그 API 가 404 대신 **400** 을 준다.
 *
 * 🩸 **처방을 한 번 틀렸고 기존 주입이 잡았다.** `shouldNoindexMissingEntity` 에 `self-fetch-400` 을
 * 더하려 했는데, 그 행동이 이미 결함으로 심어져 있었다(`mutations/ushop-malformed-handle-404.mjs`):
 * *"API 를 고치는 대신 술어를 넓히는 것이 더 쉬워 보인다 — 그 길은 일시적 400 을 영구 noindex 로
 * 바꾼다."* 그 판단이 맞다 ⇒ **고칠 곳은 API** 이고 `/u/:handle` 이 같은 선례다.
 * ⚠️ 그리고 **쓸어버리지 않는다** — 하위 리소스(`/options`·`/participants`·`/reviews`)와 가용성
 * 조회·쓰기 검증의 400 은 **400 그대로**다(일관성을 이유로 몰면 "저장 실패" 를 "없음" 이라 말한다).
 *
 * ## 이 가드가 **못 보는 것**
 * - 구글이 실제로 통합·제외하는지(색인 수일~수주 · 서치콘솔은 대표만 본다)
 * - `VOUCHER_FILTER_CATEGORIES` 가 DB 와 일치하는지 — 손으로 적은 목록이라 갈릴 수 있다.
 *   ⚠️ 다만 **양방향 모두 안전하다**: 새 카테고리가 빠지면 그 URL 이 `/vouchers` 로 통합되고(손실
 *   = thin 한 장), 사라진 값이 남으면 종전과 같다. *멀쩡한 페이지를 막는* 방향이 없다.
 * - HTMLRewriter 런타임 배선(워커 전용 API 라 유닛 밖)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  resolveConsumerSurfaceSeo,
  buildCanonical,
  CONSUMER_SURFACE_SEO,
  VOUCHER_FILTER_CATEGORIES,
} from '@/shared/seo/consumer-surfaces'
import { buildProductMeta } from '@/worker/utils/detail-ssr-meta'
import { shouldNoindexMissingEntity } from '@/worker/utils/surface-ssr-meta'
import { stripComments } from '../helpers/source-text'

const O = 'https://urdeal.kr'
const code = (f: string) => stripComments(readFileSync(f, 'utf-8'))

// 🔬 판정은 **함수를 돌려서** 한다 — 문자열 검사는 "조건이 남아 있다" 만 말하고
//    "그 조건이 결과를 바꾼다" 는 말해 주지 않는다(이 레포가 `goneStatus` 에서 밟은 함정).
const canonOf = (p: string, q = '') => resolveConsumerSurfaceSeo(p, q, O)?.canonical
const titleOf = (p: string, q = '') => resolveConsumerSurfaceSeo(p, q, O)?.pageTitle

describe('🔗 ① 필터 — 모르는 값은 맨 경로로 통합된다', () => {
  it('쓰레기 카테고리·브랜드는 canonical 에서 떨어진다', () => {
    for (const q of ['?category=zzz-no-such', '?category=테스트123', '?category=%ED%85%8C%EC%8A%A4%ED%8A%B8123']) {
      expect(canonOf('/vouchers', q), `${q} 가 자기자신을 정본이라 선언한다`).toBe(`${O}/vouchers`)
    }
    // 브랜드는 DB 에서 오는 82종이라 검증할 목록이 없다 → 축 자체를 보존하지 않는다.
    expect(canonOf('/vouchers', '?brand=스타벅스')).toBe(`${O}/vouchers`)
    expect(canonOf('/vouchers', '?brand=zzz')).toBe(`${O}/vouchers`)
    // 조합은 검증을 통과한 축만 남는다(다중 facet 색인 금지).
    expect(canonOf('/vouchers', '?category=치킨&brand=zzz')).toBe(`${O}/vouchers?category=${encodeURIComponent('치킨')}`)
  })

  it('실재하는 카테고리는 그대로 남는다 (반대 방향 — 과차단 금지)', () => {
    // 🔴 이 방향이 깨지면 **멀쩡한 페이지가 색인에서 빠지고** 돌아오는 데 수주 걸린다.
    for (const c of ['치킨', '커피/음료', '편의점', '베이커리/도넛']) {
      expect(canonOf('/vouchers', `?category=${encodeURIComponent(c)}`), `${c} 가 통합돼 버렸다`)
        .toBe(`${O}/vouchers?category=${encodeURIComponent(c)}`)
    }
  })

  it('색인되는 축(카테고리)은 제목도 허용 값만 믿는다', () => {
    // 🔑 canonical 에 남는 축이므로 검증이 **load-bearing** 이다 — 모르는 값이 제목에 박히면
    //    구글이 색인하는 페이지의 정체성이 거짓이 된다.
    expect(titleOf('/vouchers', '?category=치킨')).toMatch(/^치킨 /)
    expect(titleOf('/vouchers', '?category=zzz-no-such'), '없는 카테고리의 제목을 지어낸다').not.toMatch(/zzz/)
    expect(titleOf('/vouchers', '?category=테스트123')).not.toMatch(/테스트123/)
  })

  it('🔴 브랜드는 canonical 에서만 빠지고 **제목에는 남는다** (살아 있는 딥링크)', () => {
    // 🩸 2026-10-12: 처음엔 brand 축을 통째로 뺐다가 기존 가드에 잡혔다 —
    //    `consumer-surface-seo.test.ts` 가 *"브랜드가 카테고리보다 우선"* 을 일부러 잠가 뒀고,
    //    `?brand=` 는 브랜드 칩이 만드는 **실제 사용자 링크**다(`VouchersPage` 가 그 값으로 필터).
    //    ⇒ 진짜 결함은 `canonicalParams` 하나가 **canonical 보존과 제목 접두를 동시에** 결정한 것.
    //    `titleParams` 로 축을 갈라, 무한 thin URL 은 막고 기능은 그대로 둔다.
    expect(canonOf('/vouchers', '?brand=스타벅스'), 'canonical 에 브랜드가 남으면 무한 thin URL').toBe(`${O}/vouchers`)
    expect(titleOf('/vouchers', '?brand=스타벅스'), '살아 있는 딥링크의 제목이 죽었다').toMatch(/^스타벅스 /)
    // 브랜드가 카테고리보다 우선(기존 불변식 — 더 구체적인 쪽).
    expect(titleOf('/vouchers', '?category=커피/음료&brand=스타벅스')).toMatch(/^스타벅스 /)
    // ⚠️ 브랜드는 검증 목록이 없어 쓰레기도 제목에 들어간다 — **의도**다. canonical 이 `/vouchers`
    //    로 통합하므로 색인되지 않고, 남는 노출은 *일부러 만든* 공유 링크뿐이다(종전과 동일).
  })

  it('/browse 는 canonical 에 필터를 보존하지 않는다 (쇼핑탭 숨김 · sitemap 은 맨 경로 1건)', () => {
    expect(CONSUMER_SURFACE_SEO['/browse'].canonicalParams, 'canonical 축이 되살아났다').toBeUndefined()
    for (const q of ['?category=general', '?category=zzz', '?category=%ED%8C%A8%EC%85%98'])
      expect(canonOf('/browse', q)).toBe(`${O}/browse`)
    // 제목 분화는 유지(종전 동작) — canonical 이 통합하므로 색인 피해가 없다.
    expect(titleOf('/browse', '?category=패션')).toMatch(/^패션 /)
  })

  it('경로 모양이 하나로 모인다 (중복 슬래시 · 끝 슬래시 · 빈 쿼리)', () => {
    // 🔴 `//vouchers` 는 canonical 만 고쳤을 때 **표 조회가 실패해 메타가 통째로 null** 이었다.
    //    정규화를 조회 시점에 걸어야 `/vouchers` 항목을 찾는다 — canonical 과 제목을 함께 본다.
    for (const p of ['/vouchers', '/vouchers/', '//vouchers', '///vouchers']) {
      expect(canonOf(p), `${p} 가 다른 정본을 선언한다`).toBe(`${O}/vouchers`)
      expect(titleOf(p), `${p} 가 메타를 못 받는다`).toMatch(/기프티콘/)
    }
    expect(canonOf('/vouchers', '?sort=price_low')).toBe(`${O}/vouchers`)
    expect(canonOf('/vouchers', '?utm_source=x')).toBe(`${O}/vouchers`)
  })

  it('허용 집합이 비거나 쪼그라들지 않는다 (가드가 스스로 헐거워지는 것 차단)', () => {
    // 목록이 비면 **모든 카테고리 URL 이 `/vouchers` 로 통합**된다 — 조용히 색인을 잃는 방향이다.
    expect(VOUCHER_FILTER_CATEGORIES.length, '허용 집합이 비정상적으로 작다').toBeGreaterThanOrEqual(10)
    // sitemap 이 제출하는 셋은 반드시 들어 있어야 한다(없으면 제출분이 통째로 사라진다).
    for (const c of ['편의점', '커피/음료', '베이커리/도넛']) expect(VOUCHER_FILTER_CATEGORIES).toContain(c)
    expect(new Set(VOUCHER_FILTER_CATEGORIES).size, '중복 값이 있다').toBe(VOUCHER_FILTER_CATEGORIES.length)
  })

  it('sitemap 이 제출하는 값은 허용 집합에서 **골라 온다** (손으로 적지 않는다)', () => {
    const c = code('src/worker/routes/sitemap.routes.ts')
    expect(c, 'sitemap 이 허용 집합을 읽지 않는다 — 둘이 갈리면 제출한 URL 의 정본이 딴 곳을 가리킨다')
      .toMatch(/VOUCHER_FILTER_CATEGORIES\.includes/)
    expect(c, '카테고리 URL 을 손으로 적어 둔 자리가 남아 있다')
      .not.toMatch(/loc:\s*`\/vouchers\?category=\$\{encodeURIComponent\('/)
  })

  it('buildCanonical 은 허용 값 맵을 인자로 받아 실제로 쓴다', () => {
    // 맵을 안 넘기면 종전 동작(아무 값이나 통과) — 호출부가 넘기는지까지 본다.
    expect(buildCanonical(O, '/vouchers', '?category=zzz', ['category'], { category: ['치킨'] })).toBe(`${O}/vouchers`)
    expect(buildCanonical(O, '/vouchers', '?category=치킨', ['category'], { category: ['치킨'] }))
      .toBe(`${O}/vouchers?category=${encodeURIComponent('치킨')}`)
    expect(code('src/shared/seo/consumer-surfaces.ts'), '호출부가 허용 값 맵을 안 넘긴다')
      .toMatch(/buildCanonical\(origin, path, search, entry\.canonicalParams, entry\.canonicalParamValues\)/)
  })
})

describe('🔗 ② /products/:id 의 정본은 SSOT 가 정한다', () => {
  const payloadFor = (id: number, category: string, deal = 0) =>
    JSON.stringify({ data: { id, name: '테스트 상품', category, deal_only: deal, price: 30000 } })

  it('이용권·숙소는 상세 정본을 가리킨다 (같은 상품이 두 URL 로 경쟁하지 않게)', () => {
    expect(buildProductMeta(payloadFor(2919, 'meal_voucher'), O, '/products/2919')?.canonical).toBe(`${O}/pass/2919`)
    expect(buildProductMeta(payloadFor(2887, 'stay_voucher'), O, '/products/2887')?.canonical).toBe(`${O}/stays/2887`)
    expect(buildProductMeta(payloadFor(7, 'beauty_voucher'), O, '/products/7')?.canonical).toBe(`${O}/pass/7`)
  })

  it('교환권은 self-canonical 을 유지한다 (noindex 와 cross-canonical 을 겹치지 않는다)', () => {
    // 🔴 반대 방향. "이 페이지를 X 로 합쳐라" + "색인하지 마라" 는 서로 반대 신호다.
    //    색인 안 하는 URL 은 합칠 것도 없으므로 **종전 그대로** 둔다(교환권 2,260건 byte-동일).
    const m = buildProductMeta(payloadFor(2192, '기타', 1), O, '/products/2192')
    expect(m?.canonical).toBe(`${O}/products/2192`)
    expect(m?.noindex, '교환권 noindex 가 사라졌다').toBe(true)
  })

  it('일반 쇼핑 상품은 자기 자신이 정본이다', () => {
    const m = buildProductMeta(payloadFor(9, 'general'), O, '/products/9')
    expect(m?.canonical).toBe(`${O}/products/9`)
    expect(m?.noindex).toBe(false)
  })

  it('정본 SSOT 를 쓴다 (경로를 손으로 조립하지 않는다)', () => {
    const c = code('src/worker/utils/detail-ssr-meta.ts')
    const fn = c.slice(c.indexOf('export function buildProductMeta'))
    expect(fn, 'buildProductMeta 가 SSOT 를 안 쓴다').toMatch(/canonicalDetailPath\(\{/)
  })
})

describe('🔗 ③ 엔티티 상세 API 는 404, 하위 리소스는 400', () => {
  // 🔬 **실제로 호출해서 판정한다** — 소스에 `404` 가 적혀 있는지가 아니라 그 핸들러가 404 를
  //    돌려주는지를 본다(미들웨어가 앞에서 터지면 소스는 멀쩡한데 500 이 나간다. 실제로 stays 는
  //    `publicCache` 가 `caches` 없이 터져 처음 500 이었고, 그래서 아래 스텁이 필요하다).
  //    유효 id 는 DB 가 없어 500 이 되므로 **쓰레기 id 만** 재는 것이 이 검사의 범위다.
  const stubCaches = () => {
    const g = globalThis as unknown as { caches?: unknown }
    if (!g.caches) g.caches = { default: { match: async () => undefined, put: async () => undefined } }
  }

  /**
   * 공구 라우트는 Hono 인스턴스를 **받아서** 등록하는 팩토리(`registerPublicEndpoints`)라
   * 테스트가 앱을 직접 만든다. `{ Bindings: Env }` 제네릭은 런타임에 아무 역할이 없고
   * 타입만 좁히므로 `unknown` 경유로 맞춘다(그냥 `as` 는 TS2352 — 두 제네릭이 겹치지 않는다).
   */
  const gbApp = async () => {
    const { Hono } = await import('hono')
    const { registerPublicEndpoints } = await import('@/features/group-buy/api/group-buy-public.routes')
    type GbRouter = Parameters<typeof registerPublicEndpoints>[0]
    const app = new Hono() as unknown as GbRouter
    registerPublicEndpoints(app)
    return app as unknown as { request: (p: string, i?: RequestInit, e?: unknown) => Promise<Response> }
  }

  it('상세 셋이 쓰레기 id 에 404 를 준다 (숫자 아닌 세그먼트는 영원히 해석되지 않는다)', async () => {
    stubCaches()
    const env = {} as Record<string, unknown>
    const { productsRoutes } = await import('@/features/products/api/products.routes')
    for (const id of ['abc', '드라마', 'foo-bar'])
      expect((await productsRoutes.request(`/${encodeURIComponent(id)}`, {}, env)).status,
        `/api/products/${id} — 400 이면 워커 soft-404 판정에 안 걸려 색인 가능해진다`).toBe(404)

    const { staysPublicRoutes } = await import('@/features/group-buy/api/stays-public.routes')
    for (const id of ['abc', '드라마'])
      expect((await staysPublicRoutes.request(`/stays/${encodeURIComponent(id)}`, {}, env)).status,
        `/api/group-buy/stays/${id}`).toBe(404)

    const app = await gbApp()
    for (const id of ['abc', '드라마'])
      expect((await app.request(`/products/${encodeURIComponent(id)}`, {}, env)).status,
        `/api/group-buy/products/${id}`).toBe(404)
  })

  it('🔴 하위 리소스·가용성 조회는 400 그대로다 (일관성을 이유로 쓸어버리지 않는다)', async () => {
    // "저장 실패" 를 "없음" 이라 말하는 방향 — `ushop-malformed-handle-404` 의 두 번째·세 번째 주입이
    // 지키는 것과 같은 불변식이다. 세 응답은 **각자 다른 코드**를 지킨다.
    stubCaches()
    const env = {} as Record<string, unknown>
    const { productsRoutes } = await import('@/features/products/api/products.routes')
    expect((await productsRoutes.request('/abc/options', {}, env)).status, '/options 가 404 로 쓸려 갔다').toBe(400)

    const { staysPublicRoutes } = await import('@/features/group-buy/api/stays-public.routes')
    expect((await staysPublicRoutes.request('/stays/abc/reviews', {}, env)).status, '/reviews 가 404 로 쓸려 갔다').toBe(400)

    const app = await gbApp()
    expect((await app.request('/products/abc/participants', {}, env)).status, '/participants 가 404 로 쓸려 갔다').toBe(400)
  })

  it('🔴 워커 술어는 404 만 본다 — 400·타임아웃·5xx 로 넓히지 않는다', () => {
    const E = ['DETAIL', 'PRODUCT', 'STAYDETAIL', 'SELLER', 'CURATOR', 'BLOGPOST', 'MALL']
    for (const s of E) {
      expect(shouldNoindexMissingEntity(s, 'self-fetch-404'), `${s} 404`).toBe(true)
      for (const st of ['self-fetch-400', 'self-fetch-timeout', 'self-fetch-500', 'self-fetch-502', 'edge-hit', 'kv-hit', 'self-fetch-hit'])
        expect(shouldNoindexMissingEntity(s, st), `${s}/${st} 로 noindex 를 내면 살아 있는 엔티티가 색인에서 빠진다`).toBe(false)
    }
    // 엔티티 슬롯 밖으로도 넓히지 않는다(목록의 404 는 페이지 부재가 아니다).
    for (const s of ['MAIN', 'VOUCHERS', 'BROWSE', 'BLOG', 'MAP', ''])
      expect(shouldNoindexMissingEntity(s, 'self-fetch-404'), `${s} 는 엔티티 슬롯이 아니다`).toBe(false)
  })

  it('워커가 그 판정으로 404 응답까지 낸다 (noindex 만으론 soft-404 가 남는다)', () => {
    const c = code('src/worker/index.ts')
    expect(c).toMatch(/const entityGone = shouldNoindexMissingEntity\(ssrSlot, ssrStatus\)/)
    expect(c, 'entityGone 이 상태코드를 가르지 않는다').toMatch(/goneStatus[\s\S]{0,160}?entityGone/)
  })
})
