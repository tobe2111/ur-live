/**
 * 🎬 카드 → 상세 사진 전환이 화면을 얼리지 않는다 (2026-11-03, 대표 *"숙소 이용권만 클릭하면 로딩이 상대적으로 길어"*)
 *
 * 전환 도중엔 그리기가 멈춰 `requestAnimationFrame` 이 안 돈다 → 상세 사진이 늦게 생기면 기다림이 안 끝나
 * 브라우저가 ~4초 뒤 `DOM update timed out` 으로 끊었다(그동안 이전 화면에 멈춤). 숙소만 매번 걸렸다(실측).
 * 고정: 기다림은 **타이머**로 세고, 상한(300ms)이 **반드시** 끝을 낸다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'

const src = readFileSync('src/lib/deal-view-transition.ts', 'utf-8')
const fn = src.slice(src.indexOf('function waitForHero'), src.indexOf('/** 카드 사진(img)을'))

describe('전환 기다림', () => {
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = '' })
  it('rAF 를 쓰지 않고 타이머 상한이 있다', () => {
    expect(fn.length).toBeGreaterThan(50)
    expect(fn).not.toContain('requestAnimationFrame')
    expect(fn).toContain('setTimeout(done, HERO_WAIT_MS)')
  })
  it('사진이 끝내 안 생겨도 300ms 뒤 끝난다(rAF 가 멈춰 있어도)', async () => {
    vi.useFakeTimers()
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0) // 전환 중처럼 rAF 정지
    let doneFlag = false
    const go = vi.fn()
    ;(document as unknown as { startViewTransition: (cb: () => Promise<void>) => { finished: Promise<void> } }).startViewTransition = (cb) => {
      const p = cb().then(() => { doneFlag = true })
      return { finished: p }
    }
    const { runDealTransition } = await import('@/lib/deal-view-transition')
    runDealTransition(null, go)
    expect(go).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(350)
    expect(doneFlag).toBe(true)
    raf.mockRestore()
  })
})
