/**
 * 🎁 2026-10-18 — 교환권 facet 링크가 **첫 화면 경로에서도** 크롤러에게 간다.
 *
 * 🩸 **이 시험은 실패한 E4 뒤에 생겼다.** PR #1896(머지 `8d40789e1`)이 facet 링크를
 *   `buildListSurfaceNoscript` 안에 넣었는데, `/vouchers` 는 워커가
 *   `vouchersFirst || buildStaticSurfaceNoscript(...)` 로 **둘 중 하나만** 낸다.
 *   서버 첫 화면(2026-10-14)이 성공하는 한 그 함수는 **한 번도 안 불린다**
 *   ⇒ 배포 후 라이브 실측에서 허브 링크가 **0** 이었다(sitemap 쪽 ①은 통과했다).
 *
 * 🧭 **교훈**: 그 PR 의 시험은 함수를 직접 호출해 링크 20개를 확인했다. 그건 *계산*이고,
 *   **그 결과가 응답에 실리는지**는 다른 질문이다(2026-08-02 `goneStatus` 와 같은 클래스 —
 *   같은 PR 안에서 sitemap 축의 같은 함정을 한 번 잡아 놓고 이 축에서 또 밟았다).
 *   ⇒ 여기서는 **두 경로 모두**(첫 화면이 그려질 때 / 안 그려질 때)를 단언한다.
 *
 * ⚠️ **이 가드가 못 보는 것**: HTMLRewriter 런타임 동작(워커 전용 API 라 유닛 밖) ·
 *   구글·네이버가 그 링크를 따라가는지(색인 수일~수주 · 서치콘솔은 대표만 본다).
 */
import { describe, it, expect } from 'vitest'
import { voucherFacetNoscript, buildStaticSurfaceNoscript } from '@/worker/utils/crawler-noscript'
import { voucherFacetPath } from '@/shared/seo/voucher-facet'
import { VOUCHER_FILTER_CATEGORIES } from '@/shared/seo/consumer-surfaces'
import { readCode } from '@/tests/helpers/source-text'

const WORKER = 'src/worker/index.ts'

const seed = JSON.stringify({
  success: true,
  data: [
    { id: 1, name: '아메리카노', price: 1500, category: '커피/음료', brand_name: '컴포즈커피', deal_only: 1 },
    { id: 2, name: '소프트 아이스크림', price: 2000, category: '커피/음료', brand_name: '빽다방', deal_only: 1 },
  ],
})

describe('🎁 facet 링크 — 첫 화면 경로', () => {
  it('① `/vouchers` 에 카테고리 링크 전부가 `<noscript>` 로 나온다', () => {
    const html = voucherFacetNoscript('/vouchers')
    expect(html).toMatch(/^<noscript>/)
    expect(html).toMatch(/<\/noscript>$/)
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1])
    expect(hrefs.length, '카테고리 수만큼 링크가 나와야 한다').toBe(VOUCHER_FILTER_CATEGORIES.length)
    expect(hrefs.length).toBeGreaterThanOrEqual(10) // 0건이면 통과가 아니라 고장
    // 주소는 canonical·sitemap 과 **같은 함수**를 지난다.
    // 🔴 이 비교는 *조립 규칙 자체*는 재지 못한다 — 양쪽이 같은 함수라 함께 바뀐다
    //    (주입 `🎁🖥️ 주소를 손으로 조립한다` 가 실제로 통과했다). 그 불변식(`%20` ↔ `+`)은
    //    `voucher-facet-discovery-2026-10-18.test.ts` 가 리터럴로 지킨다 — 여기서 또 잠그면
    //    **중복 잠금**이 되어 어느 쪽도 출력으로 판정할 수 없다.
    for (const c of VOUCHER_FILTER_CATEGORIES) expect(hrefs).toContain(voucherFacetPath(c))
  })

  it('② 다른 경로에는 아무것도 내지 않는다(반대 방향)', () => {
    for (const p of ['/browse', '/map', '/stays', '/vouchers/2192', '/']) {
      expect(voucherFacetNoscript(p), `${p} 에는 facet 링크를 내지 않는다`).toBe('')
    }
  })

  it('③ 첫 화면이 **안** 그려지는 경로에도 링크가 살아 있다(종전 경로)', () => {
    const ns = buildStaticSurfaceNoscript('/vouchers', seed)
    const hrefs = [...ns.matchAll(/href="([^"]*category[^"]*)"/g)].map(m => m[1])
    expect(hrefs.length, '폴백 경로의 facet 링크도 유지된다').toBe(VOUCHER_FILTER_CATEGORIES.length)
  })

  it('④ 🔴 워커가 **첫 화면과 함께** facet 링크를 낸다 — 이 PR 의 요점', () => {
    const code = readCode(WORKER)
    // 첫 화면이 그려질 때 facet 링크를 덧붙이는 배선이 실재해야 한다
    expect(code, '첫 화면 경로에서 voucherFacetNoscript 를 부르지 않으면 라이브 효과가 0 이다')
      .toMatch(/vouchersFirst\s*\?\s*vouchersFirst\s*\+\s*voucherFacetNoscript\(/)
    // 그리고 종전 폴백(첫 화면 실패)도 그대로 남아야 한다
    expect(code).toContain('buildStaticSurfaceNoscript(url.pathname, crawlerPayload) + urdealLoaderHtml')
  })

  it('⑤ 🔴 상품 요약을 중복해서 내지 않는다 — 첫 화면이 이미 그렸다', () => {
    const html = voucherFacetNoscript('/vouchers')
    expect(html).not.toContain('아메리카노')
    expect(html).not.toContain('딜') // 가격 줄이 섞이면 첫 화면과 같은 말을 두 번 한다
    expect(html.match(/<ul>/g) || []).toHaveLength(1)
  })

  it('⑥ 라벨·주소 둘 다 탈출을 지난다', () => {
    const html = voucherFacetNoscript('/vouchers')
    expect(html).not.toMatch(/<a href="[^"]*[<>]/)
    // `&` 가 든 카테고리가 생기면 `&amp;` 로 나가야 한다(원문 `&` 가 그대로면 마크업이 깨진다)
    const raw = html.replace(/&(amp|lt|gt|quot|#39);/g, '')
    expect(raw).not.toContain('&')
  })
})
