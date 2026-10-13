/**
 * ⏳ runAfterLoad — "첫 화면 뒤" 가 진짜로 `load` 뒤인가 (2026-10-13 대표 승인 — 카드 미리받기 지연).
 *   idle 만으로는 부팅 중 빈틈에 끼어든다(2026-10-12 센트리 실측). 그래서 이 시험은 **load 전엔 안 돈다**를
 *   동작으로 잰다. ⚠️ 못 보는 것: 실제 네트워크 경합(브라우저 검사 `check-surface-chunk-runtime` 몫).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { runAfterLoad } from '@/lib/after-load'

function setReadyState(v: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => v })
}

afterEach(() => { setReadyState('complete'); vi.useRealTimers() })

describe('runAfterLoad', () => {
  it('load 전에는 실행하지 않고, load 뒤 한가할 때 실행한다', () => {
    vi.useFakeTimers()
    setReadyState('loading')
    const fn = vi.fn()
    runAfterLoad(fn)
    vi.advanceTimersByTime(5000)
    expect(fn).not.toHaveBeenCalled()       // idle 이 와도 load 전이면 안 돈다
    setReadyState('complete')
    window.dispatchEvent(new Event('load'))
    vi.advanceTimersByTime(5000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('이미 load 가 지났으면 바로 예약된다', () => {
    vi.useFakeTimers()
    setReadyState('complete')
    const fn = vi.fn()
    runAfterLoad(fn)
    vi.advanceTimersByTime(5000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('취소하면 load 가 와도 실행하지 않는다', () => {
    vi.useFakeTimers()
    setReadyState('loading')
    const fn = vi.fn()
    const cancel = runAfterLoad(fn)
    cancel()
    setReadyState('complete')
    window.dispatchEvent(new Event('load'))
    vi.advanceTimersByTime(5000)
    expect(fn).not.toHaveBeenCalled()
  })
})
