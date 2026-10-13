/**
 * 📜 긴 목록 첫 렌더 상한 (2026-10-13 — 대표 "더 개선할 것 찾아봐 아직 대기업급 빠르진 않잖아").
 *   홈 피드 50장을 첫 렌더에 다 짓던 것을 몇 장으로 줄이고 나머지를 load 뒤에 그린다.
 *   재생(느린 4G·CPU 4배, 5회 중간값): 첫 마운트 4,227 → 3,703ms · 그 순간의 긴 작업 1,080 → 330ms.
 *   ⚠️ 못 보는 것: 실제 폰의 레이아웃 비용(이 컨테이너는 한글 시스템 글꼴이 없어 레이아웃이 부풀려진다).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { useProgressiveCap } from '@/hooks/useProgressiveCap'

function setReadyState(v: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => v })
}
afterEach(() => { setReadyState('complete'); vi.useRealTimers() })

const wrap = (entries: Array<string | { pathname: string; key: string }>) =>
  ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={entries as never}>{children}</MemoryRouter>

describe('useProgressiveCap', () => {
  it('처음엔 initial 장만, load 뒤 한가할 때 전부', () => {
    vi.useFakeTimers()
    setReadyState('loading')
    const { result } = renderHook(() => useProgressiveCap(6), { wrapper: wrap(['/']) })
    expect(result.current.cap).toBe(6)
    expect(result.current.capped).toBe(true)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current.cap).toBe(6)               // idle 이 와도 load 전이면 그대로
    act(() => { setReadyState('complete'); window.dispatchEvent(new Event('load')); vi.advanceTimersByTime(5000) })
    expect(result.current.cap).toBe(Infinity)
    expect(result.current.capped).toBe(false)
  })

  it('뒤로가기로 돌아오면 처음부터 전부 — 스크롤 복원이 빗나가지 않게', () => {
    setReadyState('loading')
    const { result } = renderHook(() => useProgressiveCap(6), { wrapper: wrap([{ pathname: '/', key: 'k1' }]) })
    expect(result.current.cap).toBe(Infinity)
    expect(result.current.capped).toBe(false)
  })
})

describe('홈 피드 배선', () => {
  const src = readFileSync('src/pages/main-home/GroupBuyFeed.tsx', 'utf8')
  it('카드 목록을 상한까지만 그린다', () => {
    expect(src).toMatch(/sorted\.slice\(0, renderCap\)\.map\(/)
    expect(src).toMatch(/useProgressiveCap\(firstScreen \? 12 : 6\)/)
  })
  it('덜 그린 동안 무한 스크롤 센티넬을 끈다', () => {
    expect(src).toMatch(/const canLoadMore = items\.length >= 50 && !reachedEnd && !capped/)
  })
})
