/**
 * 🚪 /join — 시안 B "손님 먼저, 사업자는 아래" (2026-11-04 대표 *"딜 사고 소개하기 이게 뭐야 … 에이전시 버튼도 있어야"* → *"B가 낫겠네"*).
 * 지키는 것: ① 손님 시작(로그인) 이 맨 위 주 버튼 ② 사업자 두 길 — 가게 등록 · 에이전시 가입 ③ '딜 사고 소개하기' 문구 없음
 *   ④ 이용권 세 장은 실제 피드에서(교환권·사진 없는 것 제외, 못 받으면 안 그림) ⑤ 사이트 테마를 따른다(검은 바탕 고정 없음)
 * ⚠️ 못 보는 것: 실제 렌더 모양.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { stripComments } from '../helpers/source-text'

vi.mock('@/hooks/usePopularPassFeed', () => ({ usePopularPassFeed: () => null }))
vi.mock('@/components/SEO', () => ({ default: () => null }))
import JoinChoicePage, { pickJoinPasses } from '@/pages/JoinChoicePage'

const SRC = stripComments(readFileSync('src/pages/JoinChoicePage.tsx', 'utf8'))

describe('/join 시안 B', () => {
  it('① 손님 시작 · ② 사업자 두 길', () => {
    render(<MemoryRouter><JoinChoicePage /></MemoryRouter>)
    expect(screen.getByTestId('join-start').getAttribute('href')).toBe('/login?returnUrl=%2F')
    expect(screen.getByTestId('join-store').getAttribute('href')).toBe('/store/new')
    expect(screen.getByTestId('join-agency').getAttribute('href')).toBe('/agency/signup')
    expect(screen.queryByTestId('join-passes'), '피드를 못 받으면 가짜 카드를 안 그린다').toBeNull()
  })
  it('③ 옛 문구 없음 · ⑤ 검은 바탕 고정 없음', () => {
    expect(SRC).not.toContain('딜 사고 소개하기')
    expect(SRC).not.toContain('bg-[#11141C]')
  })
  it('④ 이용권 세 장 — 교환권·사진 없는 것 제외', () => {
    const feed = [
      { id: 1, image_url: '/a.jpg' }, { id: 2, image_url: null }, { id: 3, image_url: '/c.jpg', deal_only: 1 },
      { id: 4, image_url: '/d.jpg' }, { id: 5, image_url: '/e.jpg' }, { id: 6, image_url: '/f.jpg' },
    ]
    expect(pickJoinPasses(feed).map((p) => p.id)).toEqual([1, 4, 5])
    expect(pickJoinPasses(null)).toEqual([])
  })
})
