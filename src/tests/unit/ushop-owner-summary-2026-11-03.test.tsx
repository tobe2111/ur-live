/**
 * 🧾 유어샵 B — 주인만 보는 요약 판 (2026-11-03 대표 *"유어샵은 B"* · *"인스타그램, 틱톡 등 연동도 해서 나타날텐데"*).
 * 지키는 것: ① 주인에게만 · lazy(방문자 0 바이트) ② 숫자는 수익 콘솔과 같은 RQ 키 · 모르면 '—'
 *   ③ SNS 가 없으면 '+ SNS 연결하기'(머리가 아니라 이 판 안 — 머리의 주인 자리는 '관리' 하나)
 * ⚠️ 못 보는 것: 실제 렌더 높이(자리 예약 172/228px 이 실측과 맞는지)는 그려서 볼 것.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/hooks/queries/useApiQuery', () => ({ useApiQuery: () => ({ data: null }) }))
import OwnerSummaryCard from '@/pages/curator-page/OwnerSummaryCard'

const PAGE = readFileSync('src/pages/CuratorPage.tsx', 'utf8')
const CARD = readFileSync('src/pages/curator-page/OwnerSummaryCard.tsx', 'utf8')

describe('유어샵 주인 요약 판', () => {
  it('① 주인에게만, lazy', () => {
    expect(PAGE).toContain("const OwnerSummaryCard = lazy(() => import('./curator-page/OwnerSummaryCard'))")
    expect(PAGE).toMatch(/\{isOwner && <Suspense fallback=\{[^\n]*\}><OwnerSummaryCard onShare=\{shareShop\} hasSns=/)
  })
  it('② 수익 콘솔과 같은 요청·키 — 모르면 숫자를 지어내지 않는다', () => {
    expect(CARD).toContain("['curator', 'dashboard'],\n    '/api/curator/me/dashboard',")
    render(<MemoryRouter><OwnerSummaryCard onShare={vi.fn()} hasSns /></MemoryRouter>)
    expect(screen.getAllByText('—').length).toBe(3)
  })
  it('③ SNS 가 없을 때만 연결 줄', () => {
    const { rerender } = render(<MemoryRouter><OwnerSummaryCard onShare={vi.fn()} hasSns={false} /></MemoryRouter>)
    expect(screen.getByTestId('ushop-sns-connect').getAttribute('href')).toBe('/u/me/manage')
    rerender(<MemoryRouter><OwnerSummaryCard onShare={vi.fn()} hasSns /></MemoryRouter>)
    expect(screen.queryByTestId('ushop-sns-connect')).toBeNull()
  })
})
