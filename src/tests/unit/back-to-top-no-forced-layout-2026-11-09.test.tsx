/**
 * ⏱️ 맨 위로 버튼이 마운트 순간 레이아웃을 강제하지 않는다 (2026-11-09 폰 흉내 프로파일 1위 110ms).
 *   첫 `scrollY` 확인은 다음 프레임에서 한다 — 마운트한 그 자리에서 읽으면 막 붙은 홈 전체 레이아웃을 먼저 계산시킨다.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import BackToTop from '@/pages/mobile-home/BackToTop'

describe('BackToTop 첫 확인', () => {
  it('마운트 순간엔 scrollY 를 읽지 않는다 — 다음 프레임에 읽는다', () => {
    let reads = 0
    const desc = Object.getOwnPropertyDescriptor(window, 'scrollY')
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => { reads++; return 0 } })
    const frames: FrameRequestCallback[] = []
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { frames.push(cb); return 1 })
    try {
      render(<BackToTop />)
      expect(reads, '마운트 중에 scrollY 를 읽었다(강제 레이아웃)').toBe(0)
      frames.forEach((f) => f(0))
      expect(reads).toBe(1)
    } finally {
      raf.mockRestore()
      if (desc) Object.defineProperty(window, 'scrollY', desc)
    }
  })
})
