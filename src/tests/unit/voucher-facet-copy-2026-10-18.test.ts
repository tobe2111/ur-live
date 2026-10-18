/**
 * 🏷️ 교환권 카테고리 페이지의 제목·설명이 그 카테고리에 대한 말인가 (2026-10-18)
 *
 * 라이브 실측: `/vouchers?category=편의점` 의 설명이 *"편의점: 스타벅스·메가MGC커피·GS25·투썸 등
 * 인기 브랜드 기프티콘을…"* 이었다 — 기본 페이지 문구 앞에 값만 붙여서 **20개 카테고리가 같은 브랜드
 * 나열**을 냈다(편의점 페이지에 스타벅스). 제목은 *"편의점 기프티콘 교환권 - 카페·편의점·치킨 할인"*
 * 으로 같은 말을 두 번 했다. 같은 날 그 20개를 sitemap·허브 링크에 실었으므로(PR #1901) 이제 거의
 * 같은 설명의 20페이지가 서로 색인을 다툰다.
 *
 * ⚠️ 못 보는 것: 브랜드 이름을 넣지 않았으므로 *"어떤 브랜드가 있나"* 는 이 설명이 말하지 않는다
 *   (지어 넣지 않는 쪽을 골랐다 — 카테고리별 브랜드는 DB 에서 오고 바뀐다).
 */
import { describe, it, expect } from 'vitest'
import { resolveConsumerSurfaceSeo, VOUCHER_FILTER_CATEGORIES } from '@/shared/seo/consumer-surfaces'

const O = 'https://urdeal.kr'
const seo = (search: string) => resolveConsumerSurfaceSeo('/vouchers', search, O)!

describe('교환권 facet 문구', () => {
  it('카테고리 20개의 설명이 전부 다르고, 다른 카테고리의 브랜드를 말하지 않는다', () => {
    expect(VOUCHER_FILTER_CATEGORIES.length).toBeGreaterThanOrEqual(10)
    const descs = VOUCHER_FILTER_CATEGORIES.map(c => seo(`?category=${encodeURIComponent(c)}`).description)
    expect(new Set(descs).size).toBe(descs.length)
    for (const d of descs) expect(d).not.toMatch(/스타벅스|메가MGC|GS25|투썸/)
  })

  it('제목이 같은 말을 두 번 하지 않는다 (편의점 … 카페·편의점·치킨)', () => {
    const t = seo('?category=' + encodeURIComponent('편의점')).title
    expect(t).toBe('편의점 기프티콘 교환권 할인 - 유어딜')
    expect((t.match(/편의점/g) ?? []).length).toBe(1)
  })

  it('브랜드가 카테고리보다 우선 (종전 계약 유지) · 기본 페이지는 그대로', () => {
    expect(seo('?brand=' + encodeURIComponent('스타벅스') + '&category=' + encodeURIComponent('편의점')).title)
      .toBe('스타벅스 기프티콘 교환권 할인 - 유어딜')
    const base = seo('')
    expect(base.title).toBe('기프티콘 교환권 - 카페·편의점·치킨 할인 - 유어딜')
    expect(base.description).toContain('스타벅스')
  })

  it('없는 카테고리는 기본 문구로 (지어내지 않는다 — 2026-10-12 계약)', () => {
    expect(seo('?category=' + encodeURIComponent('테스트123')).title).toBe('기프티콘 교환권 - 카페·편의점·치킨 할인 - 유어딜')
  })
})

describe('클라 SEO 가 서버와 같은 값을 낸다 (VouchersPage — [UNLOCK_LOADING] 2026-10-18 대표 승인)', () => {
  it('두 <SEO> 가 resolveConsumerSurfaceSeo 결과를 쓰고, 정본을 /vouchers 로 박지 않는다', async () => {
    const { readCode } = await import('../helpers/source-text')
    const code = readCode('src/pages/VouchersPage.tsx')
    expect(code).toMatch(/resolveConsumerSurfaceSeo\('\/vouchers', searchParams/)
    expect((code.match(/<SEO \{\.\.\.vouchersSeo\} \/>/g) ?? []).length).toBe(2)
    expect(code).not.toMatch(/url=\{brand \?/)
    // 정본은 서버가 계산한 값 그대로 — 주입이 잡은 구멍(첫 판은 이 줄이 없어 '/vouchers' 를 박아도 통과했다)
    expect(code).toMatch(/url: vSeo\.canonical/)
    expect(code).not.toMatch(/김밥천국 등 인기 브랜드 교환권/)
  })
})
