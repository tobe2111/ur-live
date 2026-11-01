/**
 * 🎞️ 유어쇼츠 뷰어 — 넘길 때 밀어 올리는 전환 (2026-10-20 대표 *"영상 스와이프할 때 효과? 자연스럽게 넘어간다던지"*).
 *
 * ## 이 테스트가 못 막는 것
 * - 손에 자연스러운지(260ms·곡선·끝에서 1/3) — 폰에서 만져 봐야 안다.
 * - 덮개가 실제로 재생 시작에 맞춰 걷히는지(유튜브 상태 신호가 정한다). 2.5초 백스톱만 고정한다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { readCode } from '../helpers/source-text'
import { useSlideTransition, SLIDE_MS, COVER_MAX_MS } from '@/pages/videos/useSlideTransition'

afterEach(() => { vi.useRealTimers() })

function setup(idx = 0, count = 3) {
  const setIdx = vi.fn()
  const r = renderHook(() => useSlideTransition({ count, idx, setIdx, idOf: (i) => `v${i}` }))
  return { r, setIdx }
}

describe('밀어 올린 뒤에 넘어간다', () => {
  it('go(1) → 화면 높이만큼 위로 밀고, 끝나면 다음 영상 + 덮개', () => {
    vi.useFakeTimers()
    const { r, setIdx } = setup(0)
    act(() => r.result.current.go(1))
    expect(r.result.current.slideStyle.transform).toBe(`translate3d(0, ${-window.innerHeight}px, 0)`)
    expect(setIdx).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(SLIDE_MS) })
    expect(setIdx).toHaveBeenCalledWith(1)
    expect(r.result.current.coverId).toBe('v1')
    expect(r.result.current.slideStyle.transform).toBeUndefined()
  })
  it('전환 중 두 번째 go 는 무시한다 (한 번에 두 칸 금지)', () => {
    vi.useFakeTimers()
    const { r, setIdx } = setup(0)
    act(() => { r.result.current.go(1); r.result.current.go(1) })
    act(() => { vi.advanceTimersByTime(SLIDE_MS * 3) })
    expect(setIdx).toHaveBeenCalledTimes(1)
  })
  it('끝에서는 넘어가지 않고 손가락의 1/3 만 따라간다', () => {
    const { r, setIdx } = setup(0)
    act(() => r.result.current.drag(90))
    expect(r.result.current.slideStyle.transform).toBe('translate3d(0, 30px, 0)')
    act(() => r.result.current.go(-1))
    expect(setIdx).not.toHaveBeenCalled()
  })
  it('덮개는 재생 신호가 없어도 백스톱 뒤에 걷힌다', () => {
    vi.useFakeTimers()
    const { r } = setup(0)
    act(() => r.result.current.go(1))
    act(() => { vi.advanceTimersByTime(SLIDE_MS) })
    expect(r.result.current.coverId).toBe('v1')
    act(() => { vi.advanceTimersByTime(COVER_MAX_MS) })
    expect(r.result.current.coverId).toBeNull()
  })
})

describe('뷰어 배선', () => {
  const V = readCode('src/pages/VideosPage.tsx')
  it('임계 전엔 손가락을 따라가고, 놓으면 제자리로', () => {
    expect(V).toMatch(/go\(dy < 0 \? 1 : -1\) \}\s*\n\s*else drag\(dy\)/)
    expect(V).toMatch(/settle\(\)/)
  })
  it('재생이 시작되면 덮개를 걷는다', () => {
    expect(V).toMatch(/if \(e\.data === \(st\?\.PLAYING \?\? 1\)\) uncover\(\)/)
  })
  it('무대와 구매 바가 같은 transform 으로 함께 밀린다', () => {
    expect(V).toMatch(/<div className="absolute inset-0" style=\{slideStyle\}>/)
    expect(V).toMatch(/style=\{slideStyle\} className="absolute inset-x-2\.5 bottom-2\.5 z-20/)
    expect(V).toMatch(/<NearbyPassesCard[^>]*style=\{slideStyle\}/)
  })
  it('이웃 영상은 재생기가 아니라 썸네일이다 — 재생기는 여전히 하나', () => {
    expect((V.match(/new YT\.Player\(/g) ?? []).length).toBe(1)
    expect(V).toMatch(/top: '100%'/)
    expect(V).toMatch(/top: '-100%'/)
  })
})
