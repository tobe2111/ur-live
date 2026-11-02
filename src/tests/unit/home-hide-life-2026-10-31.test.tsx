/**
 * 🧪 2026-10-31 (대표 "생활 카테고리의 이용권들은 메인에서는 안보이게 해줘").
 *
 * 메인(홈)의 탭·피드·편성 섹션·서버 첫 화면이 모두 생활(`home_voucher`)을 뺀다.
 * 한쪽만 빼면 마운트 때 탭 줄이 바뀌거나 첫 카드가 갈아끼워진다 — 그래서 넷을 함께 고정한다.
 * 반대 방향: 지역 페이지(`showLife`)와 PC 상단 네비('생활' → `/life`)는 생활을 그대로 보여 준다.
 *
 * 🏠 2026-11-02 정정(대표 *"아예 생활 버튼이 없어진 것 같아. 메인에서 생활 관련 이용권만 나오지 말아달라고 했던건데"*):
 *   빠지는 것은 **이용권**이지 **버튼**이 아니다. 폰 홈 탭 줄은 '생활' 을 그리고 그 탭은 `/life` 링크다.
 *
 * ⚠️ 못 보는 것: 지도·검색·`/life` 화면(범위 밖 — 생활은 거기서 계속 보인다).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { HOME_DEAL_CAT_LABELS, DEAL_CAT_LABELS, HOME_TAB_LINKS, isHomeVisibleProduct } from '@/shared/deal-cats'
import { buildHomeFirstScreen } from '@/worker/utils/home-first-screen'

const LIFE = { id: 1, name: '입주청소', image_url: 'https://media.ur-team.com/a.jpg', price: 90000, category: 'home_voucher', deal_only: 0 }
const MEAL = { id: 2, name: '돈가스 세트', image_url: 'https://media.ur-team.com/b.jpg', price: 7500, category: 'meal_voucher', deal_only: 0 }
const seed = (sections: unknown[][]) =>
  JSON.stringify({ success: true, data: sections.map((products, i) => ({ id: i + 1, title: `줄${i + 1}`, products })) })

describe('메인에서 생활 숨김', () => {
  it('홈 탭 표에 생활이 없고, 전체 표(상단 네비용)에는 있다', () => {
    expect(HOME_DEAL_CAT_LABELS.map(c => c.key)).not.toContain('home_voucher')
    expect(DEAL_CAT_LABELS.map(c => c.key)).toContain('home_voucher')
  })

  it('판정 함수 — 생활만 false', () => {
    expect(isHomeVisibleProduct(LIFE)).toBe(false)
    expect(isHomeVisibleProduct(MEAL)).toBe(true)
    expect(isHomeVisibleProduct({})).toBe(true)
  })

  it('서버 첫 화면 — 생활만 있는 줄은 건너뛰고 다음 줄을 그린다', () => {
    const host = document.createElement('div')
    host.innerHTML = buildHomeFirstScreen(seed([[LIFE], [MEAL]]), '')
    const text = host.textContent || ''
    expect(text).not.toContain('입주청소')
    expect(text).toContain('돈가스 세트')
    expect(text).toContain('줄2')
  })

  it('🏠 생활 버튼은 남는다 — 폰 홈 탭 줄에 있고 `/life` 로 간다(필터 아님)', () => {
    expect(HOME_TAB_LINKS.home_voucher).toBe('/life')
    const host = document.createElement('div')
    host.innerHTML = buildHomeFirstScreen(seed([[MEAL]]), '')
    const tabs = [...(host.querySelector('#ur-first-screen nav')?.children ?? [])].map(c => c.textContent)
    expect(tabs).toContain('생활')
    const home = readCode('src/pages/mobile-home/MobileHomePage.tsx')
    expect(home).toContain('DEAL_CATS.map(')
    expect(home).not.toContain('HOME_DEAL_CATS.map(')
    expect(home).toMatch(/HOME_TAB_LINKS\[key\][\s\S]{0,120}if \(to\) return \([\s\S]{0,40}<Link key=\{key\} to=\{to\}/)
  })

  it('서버 첫 화면 — 섞인 줄에서도 생활 카드는 빠진다', () => {
    const host = document.createElement('div')
    host.innerHTML = buildHomeFirstScreen(seed([[LIFE, MEAL]]), '')
    expect(host.querySelectorAll('#ur-first-screen a[href*="/pass/1"]').length).toBe(0)
    expect(host.textContent).toContain('돈가스 세트')
  })

  it('화면 배선 — 홈 탭 넷이 HOME_DEAL_CATS, 섹션·피드가 같은 판정을 쓴다', () => {
    expect(readCode('src/pages/pc-home/PcFeedSidebar.tsx')).toContain('HOME_DEAL_CATS.map(')
    expect(readCode('src/pages/pc-home/PcHomeRail.tsx')).toMatch(/export default function PcHomeRail[\s\S]*HOME_DEAL_CATS\.map\(/)
    expect(readCode('src/components/home/HomeSections.tsx')).toContain('s.products.filter(isHomeVisibleProduct)')
    expect(readCode('src/pages/main-home/GroupBuyFeed.tsx')).toContain('.filter(p => showLife || isHomeVisibleProduct(p))')
  })

  it('반대 방향 — 지역 페이지는 생활을 보이고, PC 상단 네비는 전체 표를 쓴다', () => {
    expect(readCode('src/pages/region/RegionPage.tsx')).toMatch(/<GroupBuyFeed[\s\S]*?showLife[\s\S]*?\/>/)
    expect(readCode('src/components/main/DesktopTopNav.tsx')).toContain('{!hideDealCats && DEAL_CATS.map(')
  })
})
