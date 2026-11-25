/**
 * 🩸 소개 정산 화면이 열리지 않던 것 (2026-11-25 — 지급 주기를 시험 환경에서 돌리다 화면 코드에서 발견)
 *
 * `InfluencerSettlementPage` 는 로딩 중 로더를 **먼저 반환**하고 그 밑에서 `useSafeBack()` 을 불렀다.
 * 첫 그림(로딩)과 다음 그림의 훅 개수가 달라 React 가 "Rendered more hooks than during the previous render" 로
 * 화면을 통째로 떨어뜨린다 — 정산 화면은 데이터가 도착하는 순간 죽었다. 여기서는 실제로 그려서 본다.
 *
 * 같이 지키는 것(같은 화면의 거짓 문구):
 *   - '딜 +20%' 는 서버 설정값이 0 보다 클 때만 적는다(라이브 설정은 0 인데 상수로 +20% 였다).
 *   - 세금 표시는 지급 경로와 같은 판정 — 기타소득을 고른 사람만 8.8%, 그 밖은 3.3%.
 * 못 보는 것: 실제 브라우저의 모양 · 서버가 내려주는 값 자체(`payout-cycle-full-2026-11-25.test.ts` 몫).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'

const get = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a), put: vi.fn(), post: vi.fn() } }))
vi.mock('@/pages/influencer-settlement/ConditionalDealsSection', () => ({ default: () => null }))
vi.mock('@/pages/influencer-settlement/DealsAndCodesSection', () => ({ default: () => null }))
vi.mock('@/pages/influencer-settlement/PublicProfileSection', () => ({ default: () => null }))
vi.mock('@/pages/user-profile/seller-section/Sheet', () => ({
  default: ({ title, children, footer }: { title: string; children: unknown; footer?: unknown }) => <div role="dialog" aria-label={title}>{children as never}{footer as never}</div>,
}))

import InfluencerSettlementPage from '@/pages/InfluencerSettlementPage'

const me = (balance: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  data: { success: true, data: { balance: { pending_amount: 0, available_amount: 6000, total_paid_out: 0, ...balance }, recent: [], funding_source: 'platform', requires_voucher_use: true, payout_day: 10, ...extra } },
})
const mount = () => render(<HelmetProvider><MemoryRouter><InfluencerSettlementPage /></MemoryRouter></HelmetProvider>)

beforeEach(() => { get.mockReset() })

describe('소개 정산 화면', () => {
  it('데이터가 도착해도 화면이 떨어지지 않는다(훅 개수가 그림마다 같다)', async () => {
    get.mockImplementation(async (url: string) => (url.includes('/me') ? me({ payout_method: 'cash', tax_type: 'other_income' }) : { data: { success: false } }))
    const errors: unknown[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a[0]) })
    mount()
    await waitFor(() => expect(screen.getByTestId('settle-info-open')).toBeTruthy())
    spy.mockRestore()
    expect(errors.map(String).filter((e) => /more hooks|change in the order of Hooks/i.test(e))).toEqual([])
  })

  it("딜 보너스 설정이 0 이면 '+20%' 를 적지 않는다 · 설정이 있으면 그 값을 적는다", async () => {
    get.mockImplementation(async (url: string) => (url.includes('/me') ? me({ payout_method: 'deal' }, { deal_bonus_pct: 0 }) : { data: { success: false } }))
    const a = mount()
    await waitFor(() => expect(screen.getByTestId('settle-info-open')).toBeTruthy())
    expect(a.container.textContent).not.toContain('+20%')
    fireEvent.click(screen.getByTestId('settle-info-open'))
    expect(a.container.textContent).not.toMatch(/\+\d+%/)
    a.unmount()

    get.mockImplementation(async (url: string) => (url.includes('/me') ? me({ payout_method: 'deal' }, { deal_bonus_pct: 15 }) : { data: { success: false } }))
    const b = mount()
    await waitFor(() => expect(b.container.textContent).toContain('딜 +15%'))
  })

  it('세금 표시는 지급 경로와 같다 — 설정한 적 없으면 사업소득 3.3%, 기타소득을 고른 사람만 8.8%', async () => {
    get.mockImplementation(async (url: string) => (url.includes('/me') ? me({ payout_method: 'cash', tax_type: null }) : { data: { success: false } }))
    const a = mount()
    await waitFor(() => expect(a.container.textContent).toContain('사업소득 3.3%'))
    expect(a.container.textContent).not.toContain('8.8%')
    fireEvent.click(screen.getByTestId('settle-info-open'))
    expect(a.container.textContent).not.toContain('원천징수 안 함')
    a.unmount()

    get.mockImplementation(async (url: string) => (url.includes('/me') ? me({ payout_method: 'cash', tax_type: 'other_income' }) : { data: { success: false } }))
    const b = mount()
    await waitFor(() => expect(b.container.textContent).toContain('기타소득 8.8%'))
  })
})
