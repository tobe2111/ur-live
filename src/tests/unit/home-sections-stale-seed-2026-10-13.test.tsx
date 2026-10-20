/**
 * 📍 홈 위치 섹션 — 다른 위치로 만든 시드는 정답으로 쓰지 않되 **화면에서 지우지도 않는다** (2026-10-13 대표 *"여긴 왜이리 로딩 길어?"*).
 *
 * 라이브 재현(폰 UA · localStorage 에 위치만 있고 `ur_loc` 쿠키 없음): 서버가 '위치 없음' 섹션을 그려 보냄 →
 *   화면이 그걸 버리고 회색 자리(aria-hidden 패널) → `/api/sections?near=` 응답 뒤 동네 섹션. 회색 자리는 앱 부팅 + 요청 시간만큼 남는다.
 * 고정하는 것: ① 시드 위치가 다르면 응답 전까지 시드 섹션을 그린다(회색 자리 0) ② 같으면 종전대로 즉시
 *   ③ 위치를 저장하는 곳(지도·PC 위치바)이 쿠키도 함께 쓴다 — 다음 하드로드에서 서버가 동네 섹션을 싣는다
 * ⚠️ 못 보는 것: 실제 폰의 부팅 시간 · 바뀌는 순간의 밀림(브라우저 프레임 캡처의 몫).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'

vi.mock('@/lib/api', () => ({ default: { get: () => new Promise(() => {}) }, api: { get: () => new Promise(() => {}) } }))

import HomeSections from '@/components/home/HomeSections'

const SEC = (title: string) => ({
  id: 1, title, subtitle: '', layout: 'grid', source: 'popular', more_href: null,
  products: [{ id: 2919, name: '닭도리탕', price: 31000, original_price: 35000, image_url: 'https://media.ur-team.com/a.jpg', category: 'meal_voucher', group_buy_status: 'active' }],
})
function seed(near: string | null, title: string) {
  document.getElementById('__SSR_INITIAL_SECTIONS__')?.remove()
  const el = document.createElement('script')
  el.id = '__SSR_INITIAL_SECTIONS__'; el.type = 'application/json'
  el.textContent = JSON.stringify(near ? { success: true, data: [SEC(title)], near } : { success: true, data: [SEC(title)] })
  document.body.appendChild(el)
}
const wrap = (ui: React.ReactNode) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{ui}</MemoryRouter>
  </QueryClientProvider>,
)
afterEach(() => document.getElementById('__SSR_INITIAL_SECTIONS__')?.remove())

const near = { key: '37.20,127.08', label: '동탄5동', kmFrom: null }

describe('홈 위치 섹션 — 시드 위치가 다를 때', () => {
  it('응답 전까지 시드 섹션을 그린다 — 회색 자리 0', () => {
    seed(null, '이런 이용권은 어떠세요?')
    const { container } = wrap(<HomeSections near={near} />)
    expect(container.querySelector('section.ur-home-panel[aria-hidden="true"]'), '회색 자리가 떴다 — 서버가 그린 섹션을 버렸다').toBeNull()
    expect(screen.getByText('이런 이용권은 어떠세요?')).toBeTruthy()
  })
  it('시드 위치가 같으면 종전대로 즉시 그 섹션', () => {
    seed('37.20,127.08', '동탄 가까운 순')
    const { container } = wrap(<HomeSections near={near} />)
    expect(container.querySelector('section.ur-home-panel[aria-hidden="true"]')).toBeNull()
    expect(screen.getAllByText(/닭도리탕/).length).toBeGreaterThan(0)
  })
  it('시드가 아예 없으면 종전대로 자리를 잡아 둔다(밀림 방지)', () => {
    const { container } = wrap(<HomeSections near={near} />)
    expect(container.querySelector('section.ur-home-panel[aria-hidden="true"]')).not.toBeNull()
  })
})

describe('위치를 저장하는 곳이 쿠키도 함께 쓴다', () => {
  it('지도·PC 위치바는 localStorage 를 직접 쓰지 않고 rememberLoc 을 부른다', () => {
    for (const p of ['src/pages/RestaurantMapPage.tsx', 'src/pages/pc-home/PcHomeLocationBar.tsx']) {
      const s = readFileSync(p, 'utf8')
      expect(s, p).not.toMatch(/localStorage\.setItem\('ur_last_loc_v1'/)
      expect(s, p).toMatch(/rememberLoc\(/)
    }
  })
  it('rememberLoc 이 위치 쿠키를 쓴다 — 라벨은 같은 격자면 보존', async () => {
    const { rememberLoc } = await import('@/shared/utils/cached-loc')
    document.cookie = 'ur_loc=; max-age=0; path=/'
    document.cookie = `ur_loc_n=${encodeURIComponent('동탄5동')}; path=/`
    document.cookie = 'ur_loc=37.20_127.08; path=/'
    rememberLoc({ lat: 37.2003, lng: 127.0791 })
    expect(document.cookie).toMatch(/ur_loc=37\.20_127\.08/)
    expect(decodeURIComponent(document.cookie)).toMatch(/ur_loc_n=동탄5동/)
    rememberLoc({ lat: 35.1, lng: 129.04 })
    expect(document.cookie).toMatch(/ur_loc=35\.10_129\.04/)
    expect(document.cookie, '다른 동네로 옮겼는데 옛 동네 이름이 남았다 — 서버가 엉뚱한 소제목을 그린다').not.toMatch(/ur_loc_n=%EB|ur_loc_n=동탄/)
    expect(JSON.parse(localStorage.getItem('ur_last_loc_v1') || 'null')).toEqual({ lat: 35.1, lng: 129.04 })
  })
})
