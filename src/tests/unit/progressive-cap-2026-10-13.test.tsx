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
  it('처음엔 initial 장만, load 뒤 한가할 때마다 step 장씩 — 한 커밋에 전부 넣지 않는다', () => {
    vi.useFakeTimers()
    setReadyState('loading')
    const { result } = renderHook(() => useProgressiveCap(6, 30, 8), { wrapper: wrap(['/']) })
    expect(result.current.cap).toBe(6)
    expect(result.current.capped).toBe(true)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current.cap).toBe(6)               // idle 이 와도 load 전이면 그대로
    act(() => { setReadyState('complete'); window.dispatchEvent(new Event('load')); vi.advanceTimersByTime(400) })
    expect(result.current.cap).toBe(14)              // 한 번에 전부(30)가 아니라 한 걸음(8)
    act(() => { vi.advanceTimersByTime(400) })
    expect(result.current.cap).toBe(22)
    act(() => { vi.advanceTimersByTime(400) })
    expect(result.current.cap).toBeGreaterThanOrEqual(30)
    expect(result.current.capped).toBe(false)
  })

  it('전체가 늘면(다음 페이지) 다시 이어서 그린다', () => {
    vi.useFakeTimers()
    setReadyState('complete')
    const { result, rerender } = renderHook(({ t }) => useProgressiveCap(6, t, 8), { wrapper: wrap(['/']), initialProps: { t: 10 } })
    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current.capped).toBe(false)
    rerender({ t: 60 })
    expect(result.current.capped).toBe(true)
    for (let i = 0; i < 10; i++) act(() => { vi.advanceTimersByTime(400) })
    expect(result.current.capped).toBe(false)
  })

  it('뒤로가기로 돌아오면 처음부터 전부 — 스크롤 복원이 빗나가지 않게', () => {
    setReadyState('loading')
    const { result } = renderHook(() => useProgressiveCap(6, 50), { wrapper: wrap([{ pathname: '/', key: 'k1' }]) })
    expect(result.current.cap).toBe(Infinity)
    expect(result.current.capped).toBe(false)
    expect(result.current.restoring, '복원 중엔 화면 밖 칸 생략(content-visibility)을 꺼야 한다 — 추정 높이로 복원이 빗나간다').toBe(true)
  })
})

describe('홈 피드 배선', () => {
  const src = readFileSync('src/pages/main-home/GroupBuyFeed.tsx', 'utf8')
  it('카드 목록을 상한까지만 그린다', () => {
    expect(src).toMatch(/sorted\.slice\(0, renderCap\)\.map\(/)
    expect(src).toMatch(/useProgressiveCap\(firstScreen \? 12 : 6, sorted\.length\)/)
  })
  it('덜 그린 동안 무한 스크롤 센티넬을 끈다', () => {
    expect(src).toMatch(/const canLoadMore = items\.length >= 50 && !reachedEnd && !capped/)
  })
})

describe('화면 밖 카드는 레이아웃을 건너뛴다(content-visibility)', () => {
  it('홈 피드 카드 그리드에 ur-cv-grid 가 붙고, CSS 가 auto 높이 기억과 함께 정의돼 있다', () => {
    const feed = readFileSync('src/pages/main-home/GroupBuyFeed.tsx', 'utf8')
    // 🧾 2026-10-31 (Y2): 모바일은 한 줄 카드라 추정 높이가 다른 규칙(`ur-cv-deal-rows`, 153px)을 쓴다 — 둘 다 같은 자리.
    expect(feed).toMatch(/<div className=\{restoring \? gridCls : `\$\{gridCls\} \$\{pc \? 'ur-cv-grid' : 'ur-cv-deal-rows'\}`\}>\s*\{\/\* 🛡️ 2026-05-24 \(loading P0\)/)
    expect(readFileSync('src/index.css', 'utf8')).toMatch(/\.ur-cv-deal-rows > \* \{[^}]*content-visibility:\s*auto[^}]*contain-intrinsic-size:\s*auto 153px/)
    const css = readFileSync('src/index.css', 'utf8')
    const rule = css.match(/\.ur-cv-grid > \* \{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/content-visibility:\s*auto/)
    // `auto` 가 빠지면 한 번 그린 칸의 높이를 잊어 스크롤 중 위로 튄다
    expect(rule).toMatch(/contain-intrinsic-size:\s*auto \d+px/)
  })
})

describe('지도 목록 행도 화면 밖은 레이아웃 생략 — 뒤로가기 복원 땐 끈다', () => {
  it('RestaurantList 가 복원 중이 아닐 때만 ur-cv-rows 를 단다 + CSS 정의', () => {
    const src = readFileSync('src/pages/restaurant-map/RestaurantList.tsx', 'utf8')
    expect(src).toMatch(/\$\{restoring \? '' : ' ur-cv-rows'\}/)
    expect(src).toMatch(/const restoring = useIsRestoringNav\(\)/)
    const css = readFileSync('src/index.css', 'utf8')
    expect(css.match(/\.ur-cv-rows > \* \{([^}]*)\}/)?.[1] ?? '').toMatch(/content-visibility:\s*auto[\s\S]*contain-intrinsic-size:\s*auto \d+px/)
  })
})

