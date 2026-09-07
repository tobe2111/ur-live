import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 🏷️ 2026-09-07 (대표 — "할인율도 빨강으로 유지")
 *
 * ## 무엇이 문제였나
 * 할인율 색이 화면마다 갈려 있었다. 실측: **목록은 블루 10곳, 상세는 빨강**.
 * 같은 상품의 같은 할인율인데 목록에서 파랑이던 것이 눌러 들어가면 빨강이 됐다.
 *
 * ## 왜 빨강인가 (색이 둘이어도 규칙이 안 흐려지는 이유)
 * 블루는 **행동**(버튼·선택 칩), 이 빨강은 **가격 이득**이다. 역할이 다르다.
 * 커머스에서 할인은 빨강이 표준이기도 하다.
 *
 * ## 값을 새로 정한 이유
 * 공구 상세가 쓰던 `--gbd-danger`(#F23E4D)를 그대로 쓰지 않았다 — 흰 카드 위 **3.77:1** 이라
 * 본문 크기 글자엔 AA 미달이다(그쪽은 빨강 *면* 위 흰 글자라 기준이 다르다).
 * `--sale` = 라이트 #DC2626(4.83:1) · 다크 #FF5C69(5.46:1). 둘 다 AA.
 *
 * ## 이 테스트가 못 보는 것
 * 실제 렌더 색은 안 잰다(이 환경은 브라우저 CONNECT 터널이 막혀 있다). 대비는 계산으로 확인했고,
 * CI 의 contrast 워크플로가 실제 렌더로 다시 잰다.
 */

const read = (p: string) => readFileSync(p, 'utf8')
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** 할인율(%)을 그리는 소비자 표면 — 전수조사로 확인된 자리. */
const SITES = [
  'src/pages/main-home/GroupBuyFeedCard.tsx',
  'src/pages/vouchers/shared.tsx',
  'src/components/deal/DealRow.tsx',
  'src/pages/restaurant-map/RestaurantRow.tsx',
  'src/pages/restaurant-map/HeroCarousel.tsx',
  'src/pages/restaurant-map/SelectedDealCard.tsx',
  'src/pages/TossWidgetPayPage.tsx',
  'src/pages/VoucherDetailPage.tsx',
]
/** 할인 퍼센트를 렌더하는 줄. */
const PCT = /\{\s*(discount|discountPct|discountRate|dp)\s*\}\s*%/

describe('할인율은 한 색이다', () => {
  it.each(SITES)('%s 의 할인율이 --sale 을 쓴다', (p) => {
    const lines = code(p).split('\n').filter((l) => PCT.test(l))
    expect(lines.length, `${p} 에서 할인율 렌더 줄을 못 찾았다 — 경로가 낡았을 수 있다`)
      .toBeGreaterThan(0)
    for (const l of lines) expect(l, l.trim().slice(0, 90)).toMatch(/text-sale/)
  })

  it('할인율에 브랜드 블루가 남아 있지 않다 (블루는 행동 전용)', () => {
    for (const p of SITES) {
      for (const l of code(p).split('\n').filter((l) => PCT.test(l))) {
        expect(l, `${p}: ${l.trim().slice(0, 80)}`).not.toMatch(/text-brand/)
      }
    }
  })

  it('교환권 상세의 초록이 사라졌다 — 강조색은 블루·할인빨강 둘뿐이다', () => {
    expect(code('src/pages/VoucherDetailPage.tsx')).not.toContain('#0E9F6E')
  })
})

describe('--sale 토큰', () => {
  const CSS = read('src/index.css')

  it('라이트·다크 값이 둘 다 정의돼 있다', () => {
    expect(CSS).toMatch(/--sale:\s*#DC2626/)  // 흰 카드 위 4.83:1
    expect(CSS).toMatch(/--sale:\s*#FF5C69/)  // 다크 카드 위 5.46:1
  })

  it('tailwind 가 그 변수를 가리킨다 (값을 두 벌로 두지 않는다)', () => {
    expect(read('tailwind.config.js')).toMatch(/sale:\s*'var\(--sale\)'/)
  })

  it('AA 를 넘는다 — 값을 바꿀 때 이 계산을 다시 할 것', () => {
    const lum = (hex: string) => {
      const h = hex.replace('#', '')
      const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
        .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
      return (x + 0.05) / (y + 0.05)
    }
    expect(ratio('#DC2626', '#FFFFFF')).toBeGreaterThanOrEqual(4.5) // 흰 카드
    expect(ratio('#FF5C69', '#1D1F29')).toBeGreaterThanOrEqual(4.5) // 다크 카드
  })
})
