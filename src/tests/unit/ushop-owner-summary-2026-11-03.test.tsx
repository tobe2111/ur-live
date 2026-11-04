/**
 * 🧾 유어샵 B — 주인만 보는 요약 판 (2026-11-03 대표 *"유어샵은 B"* · *"인스타그램, 틱톡 등 연동도 해서 나타날텐데"*).
 * 📍 2026-11-04 대표 *"최근 30일 내 유어샵 부분을 관리 버튼 안에 넣거나 해줘"* — 손님 화면(유어샵)에서 빠지고 관리 화면으로.
 * 지키는 것: ① 유어샵에는 없고 관리 화면 '수익과 정산'에 있다 ② 숫자는 수익 콘솔과 같은 RQ 키 · 모르면 '—'
 * ⚠️ 못 보는 것: 실제 렌더 높이(자리 예약 172/228px 이 실측과 맞는지)는 그려서 볼 것.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/hooks/queries/useApiQuery', () => ({ useApiQuery: () => ({ data: null }) }))
import OwnerSummaryCard from '@/pages/curator-page/OwnerSummaryCard'

const PAGE = readFileSync('src/pages/CuratorPage.tsx', 'utf8')
const MANAGE = readFileSync('src/pages/UShopManagePage.tsx', 'utf8')
const CARD = readFileSync('src/pages/curator-page/OwnerSummaryCard.tsx', 'utf8')

describe('유어샵 주인 요약 판', () => {
  it('① 유어샵에는 없고 관리 화면에 있다', () => {
    expect(PAGE, '요약 판이 손님 화면(유어샵)에 돌아왔다').not.toMatch(/<OwnerSummaryCard/)
    expect(MANAGE).toContain("import OwnerSummaryCard from './curator-page/OwnerSummaryCard'")
    expect(MANAGE.indexOf('<OwnerSummaryCard />')).toBeGreaterThan(MANAGE.indexOf("defaultValue: '수익과 정산'"))
  })
  it('② 수익 콘솔과 같은 요청·키 — 모르면 숫자를 지어내지 않는다', () => {
    expect(CARD).toContain("['curator', 'dashboard'],\n    '/api/curator/me/dashboard',")
    render(<MemoryRouter><OwnerSummaryCard /></MemoryRouter>)
    expect(screen.getAllByText('—').length).toBe(3)
  })
  it('③ 누르면 수익 화면으로', () => {
    render(<MemoryRouter><OwnerSummaryCard /></MemoryRouter>)
    expect(screen.getByTestId('ushop-owner-summary').getAttribute('href')).toBe('/u/me/earnings')
  })
})
