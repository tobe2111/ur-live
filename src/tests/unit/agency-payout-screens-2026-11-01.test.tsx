/**
 * 💸 에이전시 지급 화면 두 개 (결재 3단계 후속, 2026-11-01 대표 "1번 다 해주고")
 *   ① 에이전시 마이의 '정산' 줄·시트(`AgencyPayoutSheet` + `AgencySection`)
 *   ② 어드민 에이전시 화면의 지급 신청 카드(`AgencyPayoutsCard`)
 *
 * 지키는 것:
 *   - 스위치가 꺼져 있으면 '정산' 줄이 안 뜬다(쓰지 않는 길을 보이지 않는다).
 *   - 화면은 금액을 계산하지 않는다 — 서버가 잰 값만 그린다(원천징수는 서버 `planAgencyPayout`).
 *   - 신청 버튼은 관리자에게만, 최소 금액 미만·처리 중 신청이 있으면 막힌다.
 *   - 어드민 '지급 완료' 는 확인을 두 번 거친다(되돌릴 수 없는 장부 마감).
 * 못 보는 것: 실제 송금(이 화면은 송금하지 않는다) · 서버 판정(`agency-share-payout-2026-11-01.test.ts` 몫).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const agencyRequest = vi.fn()
vi.mock('@/pages/agency-console/agency-api', () => ({ agencyRequest: (...a: unknown[]) => agencyRequest(...a) }))
vi.mock('@/pages/user-profile/seller-section/Sheet', () => ({
  default: ({ title, children }: { title: string; children: unknown }) => <div role="dialog" aria-label={title}>{children as never}</div>,
}))

import AgencyPayoutSheet, { payoutRowHint, type AgencyPayoutsResponse } from '@/pages/agency-console/AgencyPayoutSheet'

const resp = (over: Partial<AgencyPayoutsResponse> = {}): AgencyPayoutsResponse => ({
  enabled: true, minAmount: 10_000,
  balance: { pending: 3_000, available: 12_345, requested: 0, paid: 50_000 },
  payouts: [], ...over,
})

beforeEach(() => { agencyRequest.mockReset() })

describe('정산 줄의 값', () => {
  it('꺼져 있으면 값이 없다', () => {
    expect(payoutRowHint({ enabled: false, balance: null, payouts: [] })).toBeUndefined()
    expect(payoutRowHint(null)).toBeUndefined()
  })
  it('받을 수 있는 금액이 있으면 그 금액, 없고 처리 중이면 처리 중', () => {
    expect(payoutRowHint(resp())).toBe('12,345원')
    expect(payoutRowHint(resp({ balance: { pending: 0, available: 0, requested: 9_000, paid: 0 } }))).toBe('처리 중')
    expect(payoutRowHint(resp({ balance: { pending: 1, available: 0, requested: 0, paid: 0 } }))).toBeUndefined()
  })
})

describe('정산 시트', () => {
  it('서버가 잰 금액을 그대로 그리고, 관리자에게 신청 버튼을 연다', async () => {
    agencyRequest.mockResolvedValue({ ok: true, status: 200, data: resp() })
    render(<AgencyPayoutSheet canManage initial={null} onClose={() => {}} onChanged={() => {}} />)
    await waitFor(() => expect(screen.getByText('12,345')).toBeTruthy())
    const btn = screen.getByRole('button', { name: '지급 신청' }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })
  it('최소 금액 미만이면 막는다', async () => {
    agencyRequest.mockResolvedValue({ ok: true, status: 200, data: resp({ balance: { pending: 0, available: 9_999, requested: 0, paid: 0 } }) })
    render(<AgencyPayoutSheet canManage initial={null} onClose={() => {}} onChanged={() => {}} />)
    const btn = await screen.findByRole('button', { name: '10,000원부터 신청할 수 있어요' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
  it('처리 중 신청이 있으면 막는다', async () => {
    agencyRequest.mockResolvedValue({ ok: true, status: 200, data: resp({
      payouts: [{ id: 1, gross_amount: 20_000, withholding_amount: 0, net_amount: 20_000, tax_mode: 'tax_invoice', status: 'requested', created_at: '2026-11-01 01:00:00', paid_at: null }],
    }) })
    render(<AgencyPayoutSheet canManage initial={null} onClose={() => {}} onChanged={() => {}} />)
    const btn = await screen.findByRole('button', { name: '처리 중인 신청이 있어요' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
  it('직원(관리자 아님)에게는 신청 버튼이 없다', async () => {
    agencyRequest.mockResolvedValue({ ok: true, status: 200, data: resp() })
    render(<AgencyPayoutSheet canManage={false} initial={null} onClose={() => {}} onChanged={() => {}} />)
    await screen.findByText('지급 신청은 관리자가 할 수 있어요.')
    expect(screen.queryByRole('button', { name: '지급 신청' })).toBeNull()
  })
})

const code = (p: string) => stripComments(readFileSync(p, 'utf8'))

describe('배선', () => {
  it('정산 줄은 스위치가 켜졌을 때만 뜬다', () => {
    const s = code('src/pages/agency-console/AgencySection.tsx')
    expect(s).toMatch(/\{payouts\?\.enabled && <FlatRow label="정산"/)
    expect(s).toMatch(/sheet === 'payout' && payouts\?\.enabled &&/)
  })
  it('정산 조회는 다른 조회와 같은 묶음에서 나간다(직렬 왕복 금지)', () => {
    const s = code('src/pages/agency-console/AgencySection.tsx')
    const all = s.slice(s.indexOf('Promise.all(['), s.indexOf('])', s.indexOf('Promise.all([')))
    expect(all).toContain("'/payouts'")
  })
  it('화면은 원천징수를 계산하지 않는다', () => {
    for (const p of ['src/pages/agency-console/AgencyPayoutSheet.tsx', 'src/pages/admin/agency-accounts/AgencyPayoutsCard.tsx']) {
      expect(code(p)).not.toMatch(/0\.033|WITHHOLDING_RATES|\*\s*0\.0/)
    }
  })
  it('어드민 화면에 지급 카드가 달려 있고, 지급 완료는 확인을 두 번 거친다', () => {
    expect(code('src/pages/admin/AdminAgencyAccountsPage.tsx')).toContain('<AgencyPayoutsCard />')
    const c = code('src/pages/admin/agency-accounts/AgencyPayoutsCard.tsx')
    const fn = c.slice(c.indexOf('async function markPaid'), c.indexOf('async function reject'))
    expect(fn).toContain('confirmDialog(')
    expect(fn).toContain('promptDialog(')
    expect(fn.indexOf('confirmDialog(')).toBeLessThan(fn.indexOf('promptDialog('))
  })
  it('반려 사유는 필수다', () => {
    const c = code('src/pages/admin/agency-accounts/AgencyPayoutsCard.tsx')
    const fn = c.slice(c.indexOf('async function reject'), c.indexOf('async function act'))
    expect(fn).toMatch(/required:\s*true/)
  })
  it('어드민 카드는 라이트 고정(dark: 금지)', () => {
    expect(code('src/pages/admin/agency-accounts/AgencyPayoutsCard.tsx')).not.toMatch(/\bdark:/)
  })
})
