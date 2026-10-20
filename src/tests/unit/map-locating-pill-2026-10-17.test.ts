import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 📍 2026-10-17 대표 신고 — 지도 칩 줄 '전체'·'식사' 사이에 검은 알약('위…')이 끼어 보였다.
 *   '내 위치 찾는 중…' 알약이 top-[62px] 이었는데 모바일 상단 바는 검색(44) + 칩(30) 두 줄이라 94px 까지 내려온다.
 *   ⚠️ 못 보는 것: 실제 렌더 높이(jsdom 은 레이아웃이 없다) — 상단 바 높이가 바뀌면 이 숫자도 같이 고칠 것.
 */
const PAGE = readFileSync('src/pages/RestaurantMapPage.tsx', 'utf8')
const BAR = readFileSync('src/pages/restaurant-map/MapTopBar.tsx', 'utf8')

describe('지도 측위 알약은 상단 칩 줄과 겹치지 않는다', () => {
  it('알약이 칩 줄(94px) 아래에 있다', () => {
    const m = PAGE.match(/\{locating && \(\s*<div className="absolute top-\[(\d+)px\]/)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBeGreaterThanOrEqual(100)
  })
  it('전제: 상단 바는 pt-3 + 검색 h-11 + space-y-2 + 칩 h-[30px] 이다', () => {
    expect(BAR).toMatch(/absolute top-0 left-0 right-0 z-40 px-3 pt-3/)
    expect(BAR).toMatch(/h-\[30px\] px-2 rounded-full/)
  })
})
