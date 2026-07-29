import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 🤖 2026-06-19 자동 QA(배포 전): 도매 '뒤로' 버튼 회귀 방지.
//   버그였던 것 — 일부 페이지가 navigate('/wholesale') 로 하드코딩돼 어느 페이지에서든 홈으로 점프.
//   수정 — useWholesaleBack: 앱 내 이력 있으면 navigate(-1)(실제 직전), 직접 진입(location.key==='default')이면 fallback.
const { navigateSpy, locationRef } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  locationRef: { key: 'someKey' } as { key: string },
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateSpy,
  useLocation: () => locationRef,
}))

import { useWholesaleBack } from '@/hooks/useWholesaleBack'

describe('useWholesaleBack — 도매 뒤로가기 회귀 방지', () => {
  beforeEach(() => navigateSpy.mockClear())

  it('앱 내 이동 이력이 있으면 실제 직전 페이지로(navigate(-1))', () => {
    locationRef.key = 'abc123'
    const { result } = renderHook(() => useWholesaleBack())
    result.current()
    expect(navigateSpy).toHaveBeenCalledWith(-1)
  })

  it('직접 진입(이력 없음, key=default)이면 카탈로그 홈으로 폴백', () => {
    locationRef.key = 'default'
    const { result } = renderHook(() => useWholesaleBack())
    result.current()
    expect(navigateSpy).toHaveBeenCalledWith('/wholesale')
  })

  it('커스텀 폴백 경로를 존중한다', () => {
    locationRef.key = 'default'
    const { result } = renderHook(() => useWholesaleBack('/wholesale/dashboard'))
    result.current()
    expect(navigateSpy).toHaveBeenCalledWith('/wholesale/dashboard')
  })
})
