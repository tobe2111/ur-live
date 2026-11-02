/**
 * 🔢 2026-10-18 — 대표 *"응 같은 숫자 하나로 줄여줘. 나머지 다 가장 이상적으로 해줘"*.
 *
 * 마이 폰 화면 한 장에 **같은 숫자가 여러 번** 서 있었다:
 *   · 이용권 장수 — 위 숫자 줄 `이용권 3` · `이용권 현황` 의 `사용가능 3` · 목록 `내 이용권 3` (세 번)
 *   · 쿠폰 장수   — 위 숫자 줄 `쿠폰 0` · 목록 `쿠폰함 0` (두 번)
 *   · PC 는 숫자 줄에 넷째 칸(교환권)이 있어 교환권 장수도 두 번이었고, 폰과 칸 수가 달랐다.
 * 에러가 안 나고 숫자도 (대개) 맞아서 재 본 사람만 안다 — 그리고 술어가 서로 달라
 * **값이 갈릴 수도 있었다**(이용권 현황은 기간 지난 미사용을 빼고, 위 숫자 줄은 지갑과 같이 status 만 본다).
 *
 * ## 숫자마다 자리는 하나
 * | 숫자 | 그 한 곳 |
 * |---|---|
 * | 딜 · 이용권(쓸 수 있는 것) · 쿠폰 | 위 숫자 줄(`MyStats`) — 폰·PC 같은 세 칸 |
 * | 교환권 · 찜 | '내가 산 것' 목록의 그 줄 |
 * | 구매완료 · 사용완료 · 만료·환불 | 이용권 현황 바 |
 *
 * 그리고 개발자용 표시 둘을 걷었다 — 설정의 `현재 OS: 라이트` · 맨 아래 `(빌드번호)` 와 `최신 버전인지 확인`.
 *
 * ⚠️ 이 파일이 못 보는 것: 실제 화면(그림은 `visual-preview` 로 본다) · 다른 화면의 같은 숫자
 *   (지갑 `/my-vouchers` 는 자기 화면이라 장수를 말하는 게 맞다).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const STATS = readCode('src/pages/user-profile/MyStats.tsx')
const SHOP = readCode('src/pages/user-profile/ShoppingGroup.tsx')
const PAGE = readCode('src/pages/UserProfilePage.tsx')
const BAND = readCode('src/pages/user-profile/AccountPcBand.tsx')
const THEME = readCode('src/components/settings/ThemeToggleSection.tsx')

/** 목록에서 그 목적지 줄 하나를 떼어 본다. */
function shopRow(path: string): string {
  const at = SHOP.indexOf(`path: '${path}'`)
  expect(at, `${path} 줄을 못 찾았다 — 이 검사가 헛돌고 있다`).toBeGreaterThan(0)
  return SHOP.slice(SHOP.lastIndexOf('{ Icon:', at), at)
}

describe('① 숫자 줄은 폰·PC 같은 세 칸이다', () => {
  it('칸은 내 딜 · 이용권 · 쿠폰 — 교환권 칸이 없다', () => {
    const labels = [...STATS.matchAll(/<Cell[^>]*?label="([^"]+)"/g)].map(m => m[1])
    expect(labels, `숫자 줄 칸: ${labels.join(' ')}`).toEqual(['내 딜', '이용권', '쿠폰'])
    expect(STATS, '교환권 칸이 돌아오면 교환권 장수가 두 번 선다').not.toContain('/my-gifticons')
  })

  it('PC 에서만 서는 칸이 없다 — 폰과 PC 가 같은 칸 수다', () => {
    expect(STATS, '폭에 따라 칸을 숨기면 폰·PC 가 다른 숫자 줄을 갖는다').not.toMatch(/hidden lg:block/)
  })

  it('두 호출부가 교환권 값을 안 넘긴다', () => {
    expect(PAGE).not.toMatch(/<MyStats[^>]*gifticon=/)
    expect(BAND).not.toMatch(/<MyStats[^>]*gifticon=/)
  })
})

describe('② 목록은 숫자 줄과 같은 숫자를 다시 안 단다', () => {
  // 🔁 2026-11-02 재조준 — 대표 *"중복도 있고"* 로 '내 이용권'·'쿠폰함' 줄 자체를 뺐다. 위 숫자 줄이 **유일한 문**이다.
  it("'내 이용권'·'쿠폰함' 줄이 목록에 다시 서지 않는다 — 위 숫자 줄이 그 한 곳", () => {
    expect(SHOP, '이용권 줄이 목록에 돌아왔다').not.toContain("path: '/my-vouchers'")
    expect(SHOP, '쿠폰함 줄이 목록에 돌아왔다').not.toContain("path: '/my-coupons'")
    const stats = readCode('src/pages/user-profile/MyStats.tsx')
    expect(stats, '숫자 줄의 이용권 문이 사라졌다').toContain("'/my-vouchers'")
    expect(stats, '숫자 줄의 쿠폰 문이 사라졌다').toContain("'/my-coupons'")
  })

  it("반대 방향 — '내 교환권'·'찜한 상품' 은 숫자를 지킨다(그 숫자의 유일한 자리다)", () => {
    expect(shopRow('/my-gifticons')).toContain('count: counts.gifticon')
    expect(shopRow('/wishlist')).toContain('count: counts.wish')
  })
})

describe('③ 이용권 숫자는 숫자 줄 한 곳 (2026-10-19 — 이용권 현황 바를 걷었다)', () => {
  it("'내가 산 것' 구역이 이용권 현황 바를 다시 안 그린다", () => {
    expect(SHOP).not.toContain('OrderStatusBar')
    expect(SHOP).not.toMatch(/voucherStatus\./)
    expect(PAGE).not.toMatch(/statusBar=/)
  })
})

describe('④ 개발자용 표시가 돌아오지 않는다', () => {
  it("설정에 '현재 OS' 줄이 없다", () => {
    expect(THEME).not.toContain('theme.currentlyFollowing')
    expect(THEME).not.toContain('현재 OS')
  })
})
