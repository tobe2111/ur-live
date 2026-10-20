/**
 * 🏪 **모바일 홈 판매 진입점 — 대표 확정(2026-09-14, 안 1)을 고정한다**
 *
 * 대표 *"메인페이지에도 urdeal로 판매하세요 이런 버튼이 있어야 하지 않을까?"* → 시안 4안 → 안 1.
 *
 * 지키는 것 셋. 셋 다 **에러 없이 조용히 되돌아갈 수 있는** 것들이다.
 *   ① 자리 — 피드 **뒤**. 위로 올라가면 2026-08-26 에 지도 모달에서 뺀 것과 같은 물건이 된다.
 *   ② 노출 — 이미 사장님이면 안 보인다(마이페이지 타일과 **같은 신호**).
 *   ③ 목적지 — `/store/new`(마이페이지 타일과 같은 문). 규칙이 둘이 되면 언젠가 갈린다.
 *
 * ⚠️ 못 보는 것: 실제로 눌리는지·예뻐 보이는지. 여기서 지키는 것은 구조 셋뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { stripComments } from '../helpers/source-text'

const row = stripComments(readFileSync('src/pages/mobile-home/SellOnUrdealRow.tsx', 'utf8'))
const page = stripComments(readFileSync('src/pages/mobile-home/MobileHomePage.tsx', 'utf8'))

describe('🏪 자리', () => {
  it('🔴 피드 **뒤**에 온다 — 위로 올리면 8/26 에 뺀 것과 같아진다', () => {
    const feedAt = page.indexOf('<GroupBuyFeed')
    const rowAt = page.indexOf('<SellOnUrdealRow')
    expect(feedAt).toBeGreaterThan(-1)
    expect(rowAt).toBeGreaterThan(feedAt)
  })

  it('모바일 홈에만 있다 — PC 홈은 푸터가 이미 문을 갖는다', () => {
    const pc = readFileSync('src/pages/pc-home/PcHomePage.tsx', 'utf8')
    expect(pc).not.toMatch(/SellOnUrdealRow/)
  })

  it('🔴 피드 끝의 문은 **하나**다 — 공유 피드가 자기 판매 진입점을 다시 그리지 않는다', () => {
    // 2026-09-15 대표 *"피드 끝 한줄 안 1로 변경할 수 있나?"* — 09-14 에 안 1 을 넣을 때
    // 08-31 알약(`🏪 유어딜에서 판매하세요`)이 같은 자리에 남아 **둘이 겹쳐** 있었다.
    // 규칙도 갈려 있었다(알약=sellerEntryPath / 안 1=seller_token 미노출 + /store/new).
    // 공유 피드가 자기 문을 다시 그리면 그 중복이 조용히 돌아온다 — 에러가 안 난다.
    const feed = stripComments(readFileSync('src/pages/main-home/GroupBuyFeed.tsx', 'utf8'))
    expect(feed).not.toMatch(/sellerEntryPath/)
    expect(feed).not.toMatch(/판매하세요/)
  })
})

describe('🏪 노출 · 목적지', () => {
  it('🔴 이미 사장님이면 안 그린다', () => {
    expect(row).toMatch(/seller_token/)
    expect(row).toMatch(/if \(isSeller\) return null/)
  })

  it('🔴 localStorage 가 막히면 **안 보이는** 쪽으로 떨어진다 (화면을 막지 않는다)', () => {
    // catch 에서 false 로 떨어지면 셀러에게도 보인다 — 조용히 틀리는 쪽이라 못을 박는다.
    expect(row).toMatch(/catch \{ isSeller = true \}/)
  })

  it('🔴 목적지는 마이페이지 타일과 같은 문이다', () => {
    const m = row.match(/const SELL_PATH = '([^']+)'/)
    expect(m?.[1]).toBe('/store/new')
    const tile = readFileSync('src/pages/user-profile/RoleCtaGrid.tsx', 'utf8')
    expect(tile).toContain("to: '/store/new'")
  })

  it('🔴 라이트에서 문장이 **잉크**다 — 회색으로 흐리면 피드 끝에서 안 읽힌다', () => {
    // 대표 2026-09-14: "화이트 버전에서의 글자는 검정이어야 해."
    // `dark:` 붙은 회색은 다크 전용이라 대상이 아니다 — 라이트 토큰만 본다.
    expect(row).toMatch(/text-gray-900/)
    expect(row).not.toMatch(/(?<!dark:)text-gray-[456]00\b/)
  })

  it('목적지가 실재 라우트다', () => {
    const routes = ['src/App.tsx', 'src/routes/seller.routes.tsx']
      .map((f) => readFileSync(f, 'utf8')).join('\n')
    expect(routes).toContain('path="/store/new"')
  })
})
