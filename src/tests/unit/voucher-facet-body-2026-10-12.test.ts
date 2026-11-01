/**
 * 🎟️ sitemap 이 제출하는 교환권 facet 3건의 **크롤러 본문** (2026-10-12)
 *
 * **왜 있나(라이브 실측 — Googlebot UA 로 받아 본문 글자수를 셌다)**: sitemap 453건 중
 * `/vouchers?category=편의점`·`커피/음료`·`베이커리/도넛` 의 본문이 **8자**(로더 워드마크뿐)였다.
 * `<title>`·description·canonical 은 카테고리별로 멀쩡하고 `index, follow` 인데 본문만 비어 있었다 —
 * 같은 날 유어샵·쇼핑 상세에서 고친 **"제출했으면 본문이 있어야 한다"** 짝 주장이 깨진 세 번째 자리다.
 *
 * ⚠️ **이 시험이 못 보는 것**: 구글·네이버가 그 본문을 실제로 색인하는지(수일~수주 · 서치콘솔은
 * 대표만 본다) · HTMLRewriter 런타임 배선(워커 전용 API 라 유닛 밖) · 예열이 실제로 적중하는지
 * (`caches.default` 는 워커 안에서만 보인다 — 외부 `cf-cache-status` 는 늘 DYNAMIC 이다).
 */
import { describe, it, expect } from 'vitest'
import { readCode, readRaw } from '../helpers/source-text'
import { VOUCHERS_SEED_PATH, voucherFacetSeedPath, voucherFacetsByStock } from '@/shared/seo/voucher-facet'
import { VOUCHER_FILTER_CATEGORIES } from '@/shared/seo/consumer-surfaces'
import { buildStaticSurfaceNoscript } from '../../worker/utils/crawler-noscript'

/**
 * 판정은 **주석을 뺀 실행되는 줄**로 — 설명이 인용한 문자열에 걸려 거짓 통과/빨간불이 난다.
 * 🩸 제거기를 **새로 쓰지 않는다**: 블록 주석을 비탐욕 정규식 한 줄로 걷어내면 문자열·정규식
 *    리터럴 안의 주석-시작 토큰에 물려 소스의 76~81% 가 증발한다(이 레포가 네 번 밟아
 *    `check-comment-stripper` 를 만든 자리다 — 그 가드가 이 파일의 첫 판을 잡았다). SSOT 를 쓴다.
 */
const read = readRaw
const code = readCode
const WORKER = 'src/worker/index.ts'
const PREWARM = 'src/worker/cron/cache-prewarm.ts'
const SITEMAP = 'src/worker/routes/sitemap.routes.ts'

describe('① facet 판정 — 정확히 한 파라미터, 허용값만', () => {
  it('허용 카테고리 하나면 그 카테고리가 걸린 시드 경로', () => {
    expect(voucherFacetSeedPath('?category=%ED%8E%B8%EC%9D%98%EC%A0%90'))
      .toBe(`${VOUCHERS_SEED_PATH}&category=${encodeURIComponent('편의점')}`)
    // 슬래시가 든 값도 `%2F` 로 인코딩돼야 예열 키와 byte-일치한다.
    expect(voucherFacetSeedPath('?category=' + encodeURIComponent('커피/음료')))
      .toContain('&category=%EC%BB%A4%ED%94%BC%2F%EC%9D%8C%EB%A3%8C')
  })

  it('허용목록 밖 값은 facet 이 아니다 — 무한 thin URL 에 본문을 주지 않는다', () => {
    expect(voucherFacetSeedPath('?category=테스트123')).toBeNull()
    expect(voucherFacetSeedPath('?category=general')).toBeNull()
    expect(voucherFacetSeedPath('?category=')).toBeNull()
    expect(voucherFacetSeedPath('')).toBeNull()
  })

  it('🔴 파라미터가 둘 이상이면 받지 않는다 — 시드는 `sort=price_low` 라 화면과 다른 목록이 된다', () => {
    const c = encodeURIComponent('편의점')
    expect(voucherFacetSeedPath(`?category=${c}&sort=price_high`)).toBeNull()
    expect(voucherFacetSeedPath(`?category=${c}&brand=GS25`)).toBeNull()
    expect(voucherFacetSeedPath(`?page=2&category=${c}`)).toBeNull()
  })

  it('허용값은 canonical 이 믿는 SSOT 와 **같은 목록**이다 — 전수로 대조한다', () => {
    // 🩸 3개만 표본으로 보면 **자체 사본**(그 3개만 담은 지역 상수)을 못 잡는다(주입이 잡았다).
    //    canonical 이 통합에 쓰는 그 목록 **전체**가 받아들여져야 두 벌이 구조적으로 불가능하다.
    expect(VOUCHER_FILTER_CATEGORIES.length).toBeGreaterThan(10)
    for (const c of VOUCHER_FILTER_CATEGORIES) {
      expect(voucherFacetSeedPath('?category=' + encodeURIComponent(c)), c).not.toBeNull()
    }
    expect(code('src/shared/seo/consumer-surface-table.ts')) // 🗂️ 2026-11-01 표 분리
      .toContain('canonicalParamValues: { category: VOUCHER_FILTER_CATEGORIES }')
  })
})

/**
 * 탐침 시드 — **라이브 응답에서 확인한 모양**(`/api/products?…&deal_only=1&category=편의점` 실측:
 * `{ data: [{ category, brand_name, name, price, original_price, discount_rate, deal_only, … }] }`).
 * 🔴 픽스처를 외부 파일에 두지 않는다 — CI 에 없으면 그 검사가 **조용히 건너뛰어져** 헛도는 가드가 된다.
 */
function probe(cat: string, rows: Array<{ b: string; n: string; p: number; o?: number }>): string {
  return JSON.stringify({
    success: true,
    data: rows.map((r, i) => ({
      id: 9000 + i, category: cat, brand_name: r.b, name: r.n, price: r.p,
      original_price: r.o ?? null, discount_rate: r.o ? Math.round((1 - r.p / r.o) * 100) : 0,
      deal_only: 1, is_active: 1, image_url: null,
    })),
  })
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

describe('② 본문 — 시드를 먹여 **동작**으로 판정', () => {
  it('카테고리 시드를 주면 그 상품 줄이 생긴다(브랜드 · 상품명 · 판매가)', () => {
    const t = text(buildStaticSurfaceNoscript('/vouchers', probe('편의점', [
      { b: 'GS25', n: '퍼페티)츄파춥스300', p: 300 },
      { b: 'CU', n: '농심)츄파춥스12g', p: 300, o: 500 },
    ])))
    expect(t.length).toBeGreaterThan(40)
    expect(t).toContain('GS25')
    expect(t).toContain('퍼페티)츄파춥스300')
    expect(t).toContain('판매가 300원')
  })

  it('시드가 비면 아무것도 내지 않는다 — 이름만 남기지 않는다', () => {
    expect(buildStaticSurfaceNoscript('/vouchers', JSON.stringify({ data: [] }))).toBe('')
    expect(buildStaticSurfaceNoscript('/vouchers', null)).toBe('')
  })

  it('🔗 교환권 **상세** 줄에는 링크를 달지 않는다 — 그 상세는 noindex 다', () => {
    /* 🔁 2026-10-18 재조준: 불변식은 그대로(상세로 링크하지 않는다). `<a ` 가 **한 개도 없다**로
     *   앵커했는데, 같은 날 허브에 **카테고리 facet 링크**가 생겼다 — 그건 상세가 아니고 index
     *   대상이다. 상세 주소만 세도록 좁힌다(`voucher-facet.ts` 머리말이 두 축을 가른다). */
    const h = buildStaticSurfaceNoscript('/vouchers', probe('커피/음료', [{ b: '메가MGC커피', n: '(HOT)아메리카노', p: 1700 }]))
    expect(h).not.toContain('href="/vouchers/')
    expect(h).not.toContain('href="/pass/')
    expect(h).not.toContain('href="/products/')
  })

  it('🧾 시드 값을 그대로 마크업에 넣지 않는다 — HTML 탈출', () => {
    const t = buildStaticSurfaceNoscript('/vouchers', probe('편의점', [{ b: 'a&b', n: 'x</script><b>y', p: 100 }]))
    expect(t).not.toContain('</script><b>')
    expect(t).toContain('&amp;')
  })
})

describe('③ 배선 — 워커가 facet 시드를 받고 **주입은 제외**한다', () => {
  it('VOUCHERS 슬롯 조건이 facet 을 받는다', () => {
    expect(code(WORKER)).toContain("url.pathname === '/vouchers' && (!url.search || voucherFacetSeedPath(url.search))")
  })

  it('경로는 SSOT 에서 온다 — 리터럴을 손으로 적지 않는다', () => {
    const c = code(WORKER)
    // ☕ 2026-10-14: 맨 경로 시드 = 커피/음료(첫 화면 기본 카테고리 — `VOUCHERS_DEFAULT_SEED_PATH`).
    expect(c).toContain("path: voucherFacetSeedPath(url.search) || VOUCHERS_DEFAULT_SEED_PATH")
    // 종전 인라인 리터럴이 되살아나면 예열 키와 갈린다.
    expect(c).not.toContain("'/api/products?page=1&limit=20&deal_only=1&sort=price_low'")
  })

  it('🔴 facet 시드를 사람 응답에 주입하지 않는다 — 화면은 이 시드를 안 먹는다', () => {
    const c = code(WORKER)
    // 🔁 2026-10-13 재조준: 같은 줄에 `/urshorts` 항이 더해졌다(두 표면이 같은 규율을 쓴다).
    //   불변식은 그대로다 — ① `crawlerPayload` 를 잡은 **직후**에 ② facet 조건으로 주입을 끊는다.
    expect(c).toMatch(/const crawlerPayload = digestRaw \|\| ssrPayload;\s*\n\s*if \([^\n]*url\.pathname === '\/vouchers' && url\.search[^\n]*\) ssrPayload = null;/)
    // 화면의 소비 조건이 `!category` 임을 함께 고정(그 조건이 바뀌면 위 결정의 전제가 사라진다).
    // ☕ 2026-10-14: 소비 조건 = 기본 카테고리(커피/음료). facet 주소는 여전히 주입하지 않으므로
    //   `?category=편의점` 화면은 이 시드를 받지 못한다(받아도 카테고리가 달라 안 먹는다).
    expect(code('src/pages/VouchersPage.tsx')).toContain("(category === VOUCHERS_DEFAULT_CATEGORY && !brand && sort === 'price_low')")
  })

  it('🔥 `커피/음료` 시드 경로는 예열 목록의 항목과 **byte-동일**이다(갈리면 예열이 헛돈다)', () => {
    const path = voucherFacetSeedPath('?category=' + encodeURIComponent('커피/음료'))
    expect(path).not.toBeNull()
    expect(read(PREWARM)).toContain(String(path))
    // 기본 시드 경로도 같은 목록에 있어야 한다(`/vouchers` 맨 경로).
    expect(read(PREWARM)).toContain(VOUCHERS_SEED_PATH)
  })

  it('sitemap 제출분은 **허용분의 부분집합**이다 — 본문을 줄 수 없는 URL 을 제출하지 않는다', () => {
    /* 🔁 2026-10-18 재조준: 불변식은 그대로이고 **더 강해졌다**. 종전엔 하드코딩 상수
     *   `SITEMAP_VOUCHER_CATEGORIES` 의 값 셋을 읽어 각각 시드가 나오는지 봤는데, 그 상수가
     *   **폴백 전용**으로 바뀌고 제출 목록은 재고 집계가 정하게 됐다. 그래서 ① 폴백 값 셋은
     *   그대로 검사하고 ② 집계 경로가 허용목록 밖을 떨어뜨리는지는 **동작으로** 본다. */
    const m = read(SITEMAP).match(/SITEMAP_VOUCHER_FALLBACK[^=]*=\s*\[([^\]]*)\]/)
    expect(m).not.toBeNull()
    const cats = [...String(m![1]).matchAll(/'([^']+)'/g)].map((x) => x[1])
    expect(cats.length).toBeGreaterThan(0)
    for (const c of cats) expect(voucherFacetSeedPath('?category=' + encodeURIComponent(c))).not.toBeNull()

    // 집계 경로: 허용목록 밖 값은 재고가 아무리 많아도 제출 목록에 안 들어간다.
    const picked = voucherFacetsByStock([{ category: '건강/식품/주방', n: 9999 }, { category: '치킨', n: 5 }])
    expect(picked.map(x => x.category)).toEqual(['치킨'])
    for (const f of picked) expect(voucherFacetSeedPath('?category=' + encodeURIComponent(f.category))).not.toBeNull()
  })

  it('📏 워커 파일 래칫(2672)을 넘기지 않았다', () => {
    expect(read(WORKER).trimEnd().split('\n').length).toBeLessThanOrEqual(2672)
  })
})
