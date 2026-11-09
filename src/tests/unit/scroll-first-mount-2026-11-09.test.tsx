/**
 * 🧷 2026-11-09 대표 신고 *"첫 로딩에 홈 아래부분이 뒤늦게 로딩되는데, 로딩되면 맨 윗페이지로 올라가버려"*.
 * 재현(라이브 · 폰 흉내): 서버 첫 화면에서 506px 내렸는데 앱이 화면을 넘겨받는 순간(2.15s) scrollY 가 0 이 됐다.
 * 원인: `ScrollToTop` 이 하드로드 첫 마운트(POP · 저장된 자리 없음)에도 "새 페이지 → 맨 위로" 를 실행했다.
 * 처방: 문서 첫 마운트엔 올리지 않는다(브라우저가 이미 맨 위에서 연다). 앱 안 이동은 종전처럼 맨 위로.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, Outlet, useNavigate } from 'react-router-dom'

let go: (to: string) => void = () => {}
function Shell({ STT }: { STT: React.ComponentType }) { go = useNavigate(); return <><STT /><Outlet /></> }

describe('ScrollToTop — 첫 마운트', () => {
  beforeEach(() => { vi.resetModules() })
  it('하드로드 첫 마운트엔 맨 위로 올리지 않고, 앱 안 이동은 올린다', async () => {
    const STT = (await import('@/components/ScrollToTop')).default as React.ComponentType
    const spy = vi.fn()
    window.scrollTo = spy as never
    const router = createMemoryRouter([{ path: '/', element: <Shell STT={STT} />, children: [{ index: true, element: <p>홈</p> }, { path: 'pass/1', element: <p>상세</p> }] }], { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)
    expect(spy).not.toHaveBeenCalled()
    await act(async () => { go('/pass/1') })
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
  })
})
