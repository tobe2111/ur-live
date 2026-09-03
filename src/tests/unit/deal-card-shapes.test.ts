/**
 * 🎫 딜 카드의 **형태는 셋뿐** (2026-09-03 — 대표 *"이런 이용권들 디자인이 왜 통합적으로 관리가 안되는거지?"*)
 *
 * ■ 실측한 답
 *   격자만 SSOT(`GroupBuyFeedCard`)였고 나머지는 화면마다 손으로 그려져 있었다. 그래서
 *   **09-02 표면 개편이 격자에만 지나갔다.** 지나가지 않은 자리들:
 *     · `BrowseProductCard`  — 2026-06-04 의 대표색 단색 카드(카드 배경이 상품 색, 사진 하단 42% 번짐)
 *     · `HomeMiniCard`       — 같은 룩의 미니 버전. 홈 '우리 동네딜' 이 이걸 쓰고 있었다
 *     · 자체 카드 7곳         — 검색·상권·마켓·최근본·사용완료 추천 …
 *   같은 화면 위아래에 흰 카드와 색 카드가 같이 놓이니 한 서비스로 안 보였다.
 *
 * ■ 그래서 형태를 셋으로 못 박는다
 *     격자 `GroupBuyFeedCard` · 미니 `DealMiniCard` · 줄 `DealRow`
 *   `BrowseProductCard`·`VoucherRow`·검색 `ProductCard` 는 **이름만 남긴 얇은 어댑터**다
 *   (호출부 props 를 안 바꾸려고). 자체 마크업을 되살리면 이 테스트가 빨간불이 된다.
 *
 * ⚠️ 이 테스트가 **못** 잡는 것
 *   - 실제 렌더 결과(그건 미리보기·대비 워크플로가 본다).
 *   - 넷째 형태가 **새 파일**로 생기는 것 → 그건 `check-deal-card-unify.mjs`(전수 스캔)가 본다.
 *     둘은 짝이다: 이 파일은 "셋이 각자 규칙을 지키는가", 그 가드는 "넷째가 생겼는가".
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf-8')

const GRID = read('pages/main-home/GroupBuyFeedCard.tsx')
const MINI = read('components/deal/DealMiniCard.tsx')
const ROW = read('components/deal/DealRow.tsx')

describe('딜 카드 형태 3종', () => {
  it('① 미니·줄은 09-02 표면 규칙을 쓴다 — 흰 카드 + 들림, 테두리 0', () => {
    for (const [name, src] of [['DealMiniCard', MINI], ['DealRow', ROW]] as const) {
      expect(src, `${name}: 흰 표면`).toMatch(/bg-white dark:bg-\[#1D1F29\]/)
      expect(src, `${name}: 들림 하나`).toContain('shadow-lift')
      // 카드 테두리는 0 — 표면 규칙 ①. (`border-` 가 아예 없어야 한다는 뜻은 아니고
      //  루트 컨테이너에 테두리를 두르지 않는다는 뜻이라 클래스 존재로 본다.)
      expect(src, `${name}: 카드 테두리 금지`).not.toMatch(/rounded-2xl[^"`]*\bborder\b/)
    }
  })

  it('② 대표색 그라데이션 카드는 소비자 카드에서 사라졌다', () => {
    // `cardGradient` 는 카드 배경을 상품 색으로 칠하고 글자색까지 거기서 계산하던 함수다.
    // ⚠️ **import 를 본다.** 처음엔 파일 전체에서 이름을 찾았는데, 왜 지웠는지 설명하는
    //    주석에 그 이름이 들어 있어 빨간불이 났다 — CLAUDE.md 가 경고하는
    //    "주석에만 남아도 판정이 달라진다" 의 정확한 사례다(그 반대 방향).
    for (const [name, src] of [['GroupBuyFeedCard', GRID], ['DealMiniCard', MINI], ['DealRow', ROW]] as const) {
      expect(src, `${name}`).not.toMatch(/^import[^\n]*card-gradient'/m)
    }
  })

  it('③ 이름만 남은 어댑터들은 SSOT 에 위임한다 — 자체 마크업 부활 금지', () => {
    const browse = read('pages/browse/BrowseProductCard.tsx')
    const search = read('components/search/ProductCard.tsx')
    for (const [name, src] of [['BrowseProductCard', browse], ['검색 ProductCard', search]] as const) {
      expect(src, `${name}: SSOT 위임`).toContain('<GroupBuyFeedCard')
      // 자체로 사진 상자를 다시 그리기 시작하면 형태가 넷이 된다.
      expect(src, `${name}: 자체 사진 상자 금지`).not.toMatch(/aspect-square|aspect-\[4\/3\]/)
    }
    const voucherRow = read('pages/vouchers/shared.tsx')
    expect(voucherRow, 'VoucherRow: 줄 SSOT 위임').toContain('<DealRow')
  })

  it('④ 미니·줄을 쓰기로 한 화면이 실제로 그것을 쓴다', () => {
    const uses: Array<[string, string]> = [
      ['components/main/HomeDongneDealSection.tsx', 'DealMiniCard'],
      ['pages/browse/RecentlyViewedSection.tsx', 'DealMiniCard'],
      ['pages/my-vouchers/SameStoreDeals.tsx', 'DealRow'],
      ['pages/GbMarketplacePage.tsx', 'DealRow'],
      ['pages/InfluencerDiscoverPage.tsx', 'DealRow'],
      ['pages/LocalTownPage.tsx', 'DealRow'],
    ]
    for (const [file, comp] of uses) {
      expect(read(file), `${file}`).toContain(`<${comp}`)
    }
    // 상권 페이지의 동네딜 **그리드**는 격자 SSOT 여야 한다(줄만 쓰고 그리드는 자체로 남기면 안 된다).
    expect(read('pages/LocalTownPage.tsx')).toContain('<GroupBuyFeedCard')
  })

  it('⑤ 교환권 카드는 가격 단위를 딜로 찍는다 — 같은 상품이 화면마다 원/딜로 갈리지 않게', () => {
    // 유어샵 핀에 담긴 교환권이 격자에서는 '원' 으로 찍히던 것(카드가 단위를 하드코딩)을 고쳤다.
    expect(GRID).toMatch(/formatPrice\(price, \{ dealOnly: p\.deal_only \}\)/)
    expect(GRID).not.toMatch(/formatNumber\(price\)\}원/)
  })

  it('⑥ 온누리 가맹 표시는 카드 SSOT 가 그린다 — 상권관에서만 뜨던 것', () => {
    expect(GRID).toContain('온누리')
  })
})
