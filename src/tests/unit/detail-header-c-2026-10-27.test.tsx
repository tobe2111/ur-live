/**
 * 🌫️ 2026-10-27 (대표 "상단 버튼 붕 떠있어 … 원을 없애는게" → 시안 C 확정):
 *   사진 위(`overPhoto`, 스크롤 전)에서는 버튼 원 없이 흰 아이콘 + 화면 위쪽 그늘.
 *   사진이 안 깔리는 화면(숙소 — 빵부스러기가 먼저)은 종전 흰 원 유지.
 * 못 보는 것: 실제 사진 위 대비(눈 판정).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DetailFloatingHeader from '@/components/deal/DetailFloatingHeader'

vi.mock('@/components/WishlistButton', () => ({ default: () => null }))
vi.mock('@/components/curator/PinButton', () => ({ default: () => null }))
vi.mock('@/components/KakaoShareButton', () => ({ default: () => null }))

const base = { productId: 1, title: 't', shareDescription: '', shareImageUrl: '', shareLink: '', myUserId: '', onBack: () => {} }

describe('상단 버튼 C안', () => {
  it('사진 위: 원(흰 배경·그림자) 없음 + 위쪽 그늘', () => {
    render(<MemoryRouter><DetailFloatingHeader {...base} overPhoto /></MemoryRouter>)
    const back = screen.getByRole('button', { name: '뒤로가기' })
    expect(back.className).toContain('bg-transparent')
    expect(back.className).not.toMatch(/bg-white\/90|(?<!drop-)shadow-\[/)
    expect(document.querySelector('[data-header-scrim]')).not.toBeNull()
  })
  it('사진이 안 깔리는 화면은 종전 흰 원', () => {
    render(<MemoryRouter><DetailFloatingHeader {...base} /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '뒤로가기' }).className).toContain('bg-white/90')
  })
})
