/**
 * 🎁 이용권 상세 '이 이용권 팔기' — B안 한 줄 + 창 + 수수료 요청 (2026-11-02 대표 확정)
 *
 * 대표: *"B가 좋을 것 같은데? … 그 적립이란게 처음에 가게 사장님이 인플루언서에게 산정해준 수수료 퍼센트 아니야?
 * 딜 적립이라고 표현해야 할 것 같고, 24시간 유효하다고 해야할 것 같은데? … 통합"* ·
 * *"매장에 알리지만, 인플루언서마다 또 수수료율을 별도로 조정할 수 있나?"*(→ 이미 매장 × 사람마다 따로다)
 *
 * 고정하는 것:
 *   ① 줄 오른쪽 값 — 약정 있음 `딜 N%` · 약정 없음 `수수료 없음` · 로그아웃이면 **묻지도 않고** 안 그린다(옛 배너의 401 수리 승계)
 *   ② 따로 뜨던 배너(`ShareRewardBanner`)는 없다 — 같은 % 를 두 곳에서 말하지 않는다
 *   ③ 창의 조건 문구가 사실과 같다 — 24시간 · 사용하면 확정 · 딜 또는 현금
 *   ④ 약정이 없으면 [사장님께 수수료 요청] → `POST /api/seeding/deal-request/:id`
 *   ⑤ 서버 — 하루 한 번 · 이미 약정이면 거절 · 내 가게 거절 · 알림 링크가 그 사람을 미리 고른다
 * ⚠️ 못 보는 것: 화면이 보기 좋은지(그려서 본다) · 알림이 실제로 사장님께 닿는지(라이브).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const get = vi.fn()
const post = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } }))
vi.mock('@/features/curator/hooks/usePinAction', () => ({ usePinAction: () => ({ togglePin: vi.fn(), isPinning: false }) }))
vi.mock('@/hooks/useToast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import SellThisCard from '@/components/seeding/SellThisCard'
import SellThisSheet from '@/components/seeding/SellThisSheet'

const ROOT = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf-8')

function mockApi(deal: { active: boolean; commission_pct?: number }) {
  get.mockImplementation((url: string) => {
    if (url.startsWith('/api/influencer-settlement/deal-for-seller/')) return Promise.resolve({ data: { success: true, data: deal } })
    return Promise.resolve({ data: { success: true, data: { enabled: false } } })
  })
}

describe('① 줄 오른쪽 값', () => {
  beforeEach(() => { get.mockReset(); post.mockReset(); localStorage.clear() })

  it('로그아웃이면 딜을 묻지 않고 값도 안 그린다', async () => {
    mockApi({ active: false })
    const { container } = render(<MemoryRouter><SellThisCard productId={2919} sellerId={26} /></MemoryRouter>)
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/seeding/offer/2919'))
    expect(get, '로그아웃 상태에서 401 을 받을 요청을 보냈다').not.toHaveBeenCalledWith('/api/influencer-settlement/deal-for-seller/26')
    expect(container.querySelector('[data-sell-value]')).toBeNull()
    expect(screen.getByText('이 이용권 팔기')).toBeTruthy()
  })

  it('약정이 있으면 `딜 N%`', async () => {
    localStorage.setItem('user_id', '3')
    mockApi({ active: true, commission_pct: 10 })
    render(<MemoryRouter><SellThisCard productId={2919} sellerId={26} /></MemoryRouter>)
    expect(get).toHaveBeenCalledWith('/api/influencer-settlement/deal-for-seller/26')
    await waitFor(() => expect(screen.getByText('딜 10%')).toBeTruthy())
  })

  it('약정이 없으면 `수수료 없음`(0 으로 위장하지 않는다)', async () => {
    localStorage.setItem('user_id', '3')
    mockApi({ active: false })
    render(<MemoryRouter><SellThisCard productId={2919} sellerId={26} /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('수수료 없음')).toBeTruthy())
  })

  it('주인 본인에게는 안 그린다', () => {
    localStorage.setItem('user_id', '3')
    mockApi({ active: false })
    const { container } = render(<MemoryRouter><SellThisCard productId={2919} sellerId={26} hideForOwner /></MemoryRouter>)
    expect(container.innerHTML).toBe('')
  })
})

describe('② 배너 통합', () => {
  it('상세에 따로 뜨던 `ShareRewardBanner` 가 없고, 팔아보기 줄이 매장 번호를 받는다', () => {
    const page = read('src/pages/GroupBuyDetailPage.tsx')
    expect(page).not.toContain('ShareRewardBanner')
    expect(page).toMatch(/<SellThisCard [^>]*sellerId=\{detail\.seller_id/)
  })
})

describe('③④ 창', () => {
  beforeEach(() => { post.mockReset(); localStorage.clear() })

  it('약정이 있으면 조건이 사실대로 — 24시간 · 쓰면 확정 · 딜 또는 현금', () => {
    render(<MemoryRouter><SellThisSheet productId={1} sellerId={26} deal={10} offer={{ enabled: false }} applyOnOpen={false} onClose={() => {}} /></MemoryRouter>)
    const terms = document.querySelector('[data-sell-terms]')!.textContent || ''
    expect(terms).toContain('24시간')
    expect(terms).toContain('10%')
    expect(terms).toContain('쓰면 확정')
    expect(terms, '받는 방법은 딜·현금 중 고른다 — "딜로만" 이라 하면 거짓이다').toContain('딜로 받거나 현금으로')
  })

  it('약정이 없으면 [사장님께 수수료 요청] 이 서버로 간다', async () => {
    post.mockResolvedValue({ data: { success: true, data: { already: false } } })
    render(<MemoryRouter><SellThisSheet productId={2919} sellerId={26} deal={0} offer={{ enabled: false }} applyOnOpen={false} onClose={() => {}} /></MemoryRouter>)
    fireEvent.click(screen.getByText('사장님께 수수료 요청'))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/seeding/deal-request/2919'))
    await waitFor(() => expect(screen.getByText('요청을 보냈어요')).toBeTruthy())
  })

  it('약정이 있으면 수수료 요청 버튼이 없다', () => {
    render(<MemoryRouter><SellThisSheet productId={2919} sellerId={26} deal={10} offer={{ enabled: false }} applyOnOpen={false} onClose={() => {}} /></MemoryRouter>)
    expect(screen.queryByText('사장님께 수수료 요청')).toBeNull()
  })

  it('체험단이 꺼져 있으면 (?) 를 눌러야 이유가 펼쳐진다', () => {
    render(<MemoryRouter><SellThisSheet productId={2919} sellerId={26} deal={0} offer={{ enabled: false }} applyOnOpen={false} onClose={() => {}} /></MemoryRouter>)
    expect(screen.queryByText(/체험단을 모집하지 않아요/)).toBeNull()
    fireEvent.click(screen.getByLabelText('체험단 지원 설명'))
    expect(screen.getByText(/체험단을 모집하지 않아요/)).toBeTruthy()
  })
})

describe('⑤ 서버 — 수수료 요청', () => {
  const src = read('src/features/seeding/api/seeding.routes.ts')
  const ep = src.slice(src.indexOf("seedingRoutes.post('/deal-request/:productId'"))
  const body = ep.slice(0, ep.indexOf('\n})\n'))

  it('로그인 · 속도 제한', () => {
    expect(body).toMatch(/requireAuth\(\), rateLimit\(\{ action: 'deal_request'/)
  })
  it('같은 사람 → 같은 매장은 하루 한 번', () => {
    expect(body).toContain("created_at >= datetime('now', '-1 day')")
    expect(body).toContain("type = 'influencer_deal_request'")
  })
  it('이미 약정이 있으면 거절 — 결제와 같은 판정(`findActiveDealPct`)', () => {
    expect(body).toContain('await findActiveDealPct(DB, product.seller_id, String(me))')
  })
  it('내 가게 이용권이면 거절', () => {
    expect(body).toContain('linked_user_id = ?')
  })
  it('알림 링크가 그 사람을 미리 고른 제안 화면이다 — 사장님이 사람마다 % 를 정한다', () => {
    expect(body).toContain('/seller/influencer-deals?influencer=${me}')
    const page = read('src/pages/SellerInfluencerDealsPage.tsx')
    expect(page).toContain(".get('influencer')")
    expect(page).toContain(".has('influencer')")
  })
})
