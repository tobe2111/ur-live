/**
 * 🌐 연결 상태 띠 세 갈래 (2026-11-12 대표 신고 — 와이파이는 되는데 "인터넷 연결이 끊겼습니다" + 사진 무한 로딩).
 *   ① 우리 서버가 한 번 늦은 것으로는 띄우지 않는다 ② 연속 두 번이면 "원활하지 않아요"(끊겼다고 하지 않는다)
 *   ③ 브라우저도 오프라인일 때만 "끊겼어요" ④ 정상으로 돌아오면 못 받은 사진을 다시 부른다.
 *   못 보는 것: 실제 브라우저의 이벤트 타이밍 · 사진을 다시 불러 실제로 받아지는지(배포 뒤 확인).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import OfflineBanner, { CONNECTION_COPY } from '@/components/OfflineBanner'
import { retryBrokenImages } from '@/hooks/useOnlineStatus'

let fails = 0
let onLine = true
beforeEach(() => {
  vi.useFakeTimers()
  fails = 0; onLine = true
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => onLine })
  vi.stubGlobal('fetch', vi.fn(async () => { if (fails > 0) { fails--; throw new Error('net') } return new Response(null) }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

describe('연결 상태 띠', () => {
  it('① 한 번 늦은 것으로는 띄우지 않는다', async () => {
    const { container } = render(<OfflineBanner />)
    fails = 1
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await flush(1000) // 첫 실패 직후 — 아직 띄우면 안 된다(워치독 5초가 돌기 전에 본다: 돌면 결함이 가려진다)
    expect(container.textContent).toBe('')
    await flush(4000) // 4초 뒤 다시 확인 → 성공
    expect(container.textContent).toBe('')
  })
  it('② 브라우저는 온라인인데 연속 두 번 실패 → "원활하지 않아요"', async () => {
    const { container } = render(<OfflineBanner />)
    fails = 2
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await flush(5000)
    expect(container.textContent).toBe(CONNECTION_COPY.unstable)
    expect(container.textContent).not.toContain('끊겼')
  })
  it('③ 브라우저도 오프라인일 때만 "끊겼어요"', async () => {
    const { container } = render(<OfflineBanner />)
    onLine = false; fails = 5
    await act(async () => { window.dispatchEvent(new Event('offline')) })
    await flush(100)
    expect(container.textContent).toBe(CONNECTION_COPY.offline)
  })
  it('④ 끝났는데 크기 0 인 사진만 다시 부른다', () => {
    document.body.innerHTML = '<img id="a" src="/x.jpg"><img id="b" src="/y.jpg">'
    const a = document.getElementById('a') as HTMLImageElement, b = document.getElementById('b') as HTMLImageElement
    Object.defineProperty(a, 'complete', { get: () => true }); Object.defineProperty(a, 'naturalWidth', { get: () => 0 })
    Object.defineProperty(b, 'complete', { get: () => true }); Object.defineProperty(b, 'naturalWidth', { get: () => 300 })
    expect(retryBrokenImages(document)).toBe(1)
  })
})
