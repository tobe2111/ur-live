/**
 * 🧪 로그인 전 이용권·유어샵 탭 — **예시 이용권**만 보여 준다 (2026-11-03 대표 *"로그아웃 시에는 이용권도 이렇게 해야지,
 * 실제 이용권으로 하면 어떡해"*).
 *
 * 이 파일은 원래(2026-10-19) "실제 인기 이용권 응답을 기다리는 동안 자리를 잡는다(CLS 0.39)" 를 지켰다. 예시가 고정값이 되면서
 * 기다릴 응답 자체가 없어졌다 — 그래서 지키는 것을 바꿨다:
 *   ① 두 탭은 실제 상품 요청(`usePopularPasses`)을 부르지 않는다(남의 가게가 "예시" 로 보이지 않게 · 늦게 밀리지 않게)
 *   ② 예시 줄은 첫 렌더에 바로 3줄이다(데이터 없이)
 *   ③ 예시 줄은 누를 수 없다(링크 0 — 예시를 눌러 진짜 상세로 가면 예시가 아니다)
 *   ④ 예시는 SSOT 상수 하나에서 온다
 *
 * ⚠️ 못 보는 것: 색 칸이 보기 좋은지(그려서 봐야 한다).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readCode } from '../helpers/source-text'

vi.mock('@/components/mascot/Udal', () => ({ default: () => null }))
vi.mock('@/components/SEO', () => ({ default: () => null }))
vi.mock('@/pages/guest/GuestKakaoButton', () => ({ default: () => <button>kakao</button> }))
import GuestUrShopPage from '@/pages/guest/GuestUrShopPage'
import GuestPassPage from '@/pages/guest/GuestPassPage'
import { GUEST_EXAMPLE_PASSES } from '@/shared/guest-page'

describe('로그인 전 예시 이용권', () => {
  beforeEach(() => cleanup())

  it.each(['GuestPassPage', 'GuestUrShopPage', 'GuestExampleRows'])('① %s 는 실제 상품 요청을 안 부른다', (f) => {
    expect(readCode(`src/pages/guest/${f}.tsx`)).not.toMatch(/usePopularPasses|DealMiniCard|canonicalDetailPath/)
  })

  it.each([['pass', GuestPassPage], ['shop', GuestUrShopPage]] as const)('②③ %s — 첫 렌더에 예시 3줄, 링크 없음', (_n, Page) => {
    const { container } = render(<MemoryRouter><Page /></MemoryRouter>)
    const rows = container.querySelector('[data-guest-example]')!
    expect(rows, '예시 줄이 없다').not.toBeNull()
    expect(rows.children.length).toBe(3)
    expect(rows.querySelectorAll('a').length).toBe(0)
    for (const p of GUEST_EXAMPLE_PASSES) expect(rows.textContent).toContain(p.name)
  })

  it('④ 예시 문구는 SSOT 에서만 — 부품이 상수를 쓴다', () => {
    expect(readCode('src/pages/guest/GuestExampleRows.tsx')).toContain('GUEST_EXAMPLE_PASSES.map(')
    expect(GUEST_EXAMPLE_PASSES.length).toBe(3)
  })
})
