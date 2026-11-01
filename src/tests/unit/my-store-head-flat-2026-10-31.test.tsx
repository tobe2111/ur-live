/**
 * 🏪 2026-10-31 대표 확정 9번 — 마이 판·구분선 제거 + **B안 가게 머리줄**(*"B로 해줘. 매장이 여러개라면?"* → *"그래 그대로 해줘"*).
 *
 * 지키는 것:
 *  ① 판매 구역은 가게 머리줄로 시작한다 — 사진 · 이름 · 판매 중 N개 · (2곳 이상이면) 매장 N곳 · 가게 보기
 *  ② 머리줄을 누르면 매장 고르기 창 — 매장마다 오늘 매출 · 판매 중 · 다른 매장의 새 주문 표시
 *  ③ 서버 요약이 사진·주소를 싣는다(별도 쿼리, fail-soft)
 *  ④ 판·구분선은 **폰 마이에서만** 걷는다(PC 카드 · 다른 화면의 같은 부품은 그대로)
 *  ⑤ 사진이 없으면 이름 첫 글자(빈 회색 칸 금지)
 *
 * ⚠️ 못 보는 것: 실제 렌더에서 판이 사라졌는지(jsdom 에 미디어쿼리·CSS 가 없다 — 그림으로 확인했다).
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import StoreThumb from '@/pages/user-profile/seller-section/StoreThumb'

const read = (p: string) => readFileSync(p, 'utf8')
const SECTION = read('src/pages/user-profile/SellerSection.tsx')
const SHEET = read('src/pages/user-profile/StoreSwitchSheet.tsx')
const ROUTE = read('src/features/seller/api/seller-operators.routes.ts')
const CSS = read('src/index.css')
const PAGE = read('src/pages/UserProfilePage.tsx')

describe('① 가게 머리줄', () => {
  it('사진 · 이름 · 판매 중 · 매장 N곳 · 가게 보기', () => {
    expect(SECTION).toMatch(/<StoreThumb src=\{store\?\.image \?\? null\}/)
    expect(SECTION).toContain("store?.active_products != null ? `판매 중 ${formatNumber(store.active_products)}개` : ''")
    expect(SECTION).toContain("stores.length >= 2 ? `매장 ${stores.length}곳` : ''")
    expect(SECTION).toMatch(/to=\{`\/s\/\$\{encodeURIComponent\(store\.username \|\| String\(store\.seller_id\)\)\}`\}/)
    expect(SECTION).toContain('가게 보기')
  })
  it('2곳 이상이면 이름 옆 ⌄', () => {
    expect(SECTION).toMatch(/stores\.length >= 2 && <ChevronDown/)
  })
})

describe('② 매장 고르기 창', () => {
  it('마이가 받은 요약을 넘긴다(창이 다시 안 부른다)', () => {
    expect(SECTION).toContain('summaries={stores}')
  })
  it('매장마다 오늘 매출 · 판매 중, 다른 매장의 새 주문 표시', () => {
    expect(SHEET).toContain('`오늘 ${formatNumber(t.today_revenue)}원 · 판매 중 ${formatNumber(t.active_products)}개`')
    expect(SHEET).toMatch(/\(t\?\.pending \?\? 0\) > 0 &&[\s\S]{0,200}새 주문/)
    expect(SHEET).toContain('<StoreThumb')
  })
})

describe('③ 서버 요약', () => {
  it('사진(프로필 → 상품 첫 사진)과 주소를 싣는다, fail-soft', () => {
    expect(ROUTE).toMatch(/s\.profile_image AS img/)
    expect(ROUTE).toMatch(/image: iMap\.get\(s\.seller_id\) \?\? null/)
    expect(ROUTE).toMatch(/username: s\.username \?\? null/)
    expect(ROUTE).toMatch(/AS pimg[\s\S]{0,400}\.catch\(\(\) => \[\]/)
  })
})

describe('④ 판·구분선은 폰 마이에서만', () => {
  it('페이지가 표시를 달고, CSS 는 lg 미만에서만 걷는다', () => {
    expect(PAGE).toContain('<div className="ur-account-pc ur-my-flat">')
    const i = CSS.indexOf('@media (max-width: 1023.98px) {\n  .ur-my-flat')
    expect(i, '폰 전용 규칙이 없다').toBeGreaterThan(0)
    const block = CSS.slice(i, CSS.indexOf('}\n}', i))
    expect(block).toMatch(/\.ur-my-flat \.rounded-2xl\.shadow-lift\.overflow-hidden \{ background: transparent; box-shadow: none/)
    expect(block).toMatch(/\.ur-my-flat \.border-b\.border-rule\.last\\:border-b-0 \{ border-bottom-width: 0/)
  })
  it('공용 부품은 그대로다(유어샵 관리·에이전시 화면이 판을 유지)', () => {
    expect(read('src/pages/user-profile/list-grammar.tsx')).toContain("export const LIST_PLATE_CLS = 'rounded-2xl bg-surface shadow-lift overflow-hidden'")
  })
})

describe('⑤ 사진이 없으면 이름 첫 글자', () => {
  it('src 가 없으면 첫 글자', () => {
    const { container } = render(<StoreThumb src={null} name="홍대돈까스" />)
    expect(container.textContent).toBe('홍')
    expect(container.querySelector('img')).toBeNull()
  })
  it('src 가 있으면 사진', () => {
    const { container } = render(<StoreThumb src="https://media.ur-team.com/a.jpg" name="홍대돈까스" />)
    expect(container.querySelector('img')).not.toBeNull()
  })
})
