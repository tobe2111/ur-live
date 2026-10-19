/**
 * 🗺️ 지도 시드 새로고침은 첫 화면 뒤로 (2026-10-19 대표 *"지도랑 블로그도 상세히 진행해줘"*).
 *
 * 실측(/map 하드로드): 워커 시드(`__SSR_INITIAL_MAP__`)로 목록을 그린 직후 훅이 **같은 page1 을 다시** 받아(3.6s)
 * 지도 타일 9장(4.0~7.8s)과 회선을 나눠 썼다. 이미 보이는 데이터의 갱신이라 급하지 않다.
 * ⇒ 시드가 있으면 지도는 첫 타일 신호(`ur:map-tiles-loaded`) 뒤, 그 밖은 load·한가할 때 갱신한다.
 *
 * ⚠️ 못 보는 것: 실제 회선 경쟁이 얼마나 줄었는지(브라우저 폭포로만 잰다).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MAP_SEED_SORT } from '@/shared/map-feed-seed'

const get = vi.fn((..._a: unknown[]) => new Promise(() => {}))
// tests/setup.ts 가 window.location 을 고정 객체로 바꿔 둔다 — pushState 가 아니라 직접 쓴다.
const setPath = (p: string) => { (window.location as { pathname: string }).pathname = p }
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }))

function plantSeed() {
  const el = document.createElement('script')
  el.id = '__SSR_INITIAL_MAP__'
  el.type = 'application/json'
  el.textContent = JSON.stringify({ success: true, total: 2, data: [{ id: 1 }, { id: 2 }] })
  document.head.appendChild(el)
  return el
}

describe('시드로 그렸으면 page1 재요청을 미룬다', () => {
  let el: HTMLScriptElement
  beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); get.mockClear(); el = plantSeed() })
  afterEach(() => { el.remove(); vi.useRealTimers(); setPath('/') })

  it('지도: 첫 타일 신호 전엔 요청 0 → 신호 뒤 1', async () => {
    setPath('/map')
    const { useMapProducts } = await import('@/hooks/queries/useMapProducts')
    const { result } = renderHook(() => useMapProducts('all', null, { sort: MAP_SEED_SORT }))
    expect(result.current.data.length).toBe(2)
    await vi.advanceTimersByTimeAsync(3000)
    expect(get, '타일 전인데 목록을 다시 받았다').not.toHaveBeenCalled()
    window.dispatchEvent(new Event('ur:map-tiles-loaded'))
    await vi.advanceTimersByTimeAsync(400)
    expect(get).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('ur:map-tiles-loaded'))
    await vi.advanceTimersByTimeAsync(9000)
    expect(get, '신호·백스톱이 겹쳐 두 번 받았다').toHaveBeenCalledTimes(1)
  })

  it('지도: 타일 신호가 안 와도 백스톱으로 한 번은 갱신한다', async () => {
    setPath('/map')
    const { useMapProducts } = await import('@/hooks/queries/useMapProducts')
    renderHook(() => useMapProducts('all', null, { sort: MAP_SEED_SORT }))
    await vi.advanceTimersByTimeAsync(7000)
    expect(get).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2000)
    expect(get).toHaveBeenCalledTimes(1)
    // 백스톱 뒤에 타일 신호가 늦게 와도 다시 받지 않는다.
    window.dispatchEvent(new Event('ur:map-tiles-loaded'))
    await vi.advanceTimersByTimeAsync(1000)
    expect(get, '백스톱 뒤 늦은 타일 신호로 두 번 받았다').toHaveBeenCalledTimes(1)
  })

  it('시드가 없으면 바로 받는다(빈 화면을 기다리게 하지 않는다)', async () => {
    el.remove()
    setPath('/map')
    const { useMapProducts } = await import('@/hooks/queries/useMapProducts')
    renderHook(() => useMapProducts('all', null, { sort: MAP_SEED_SORT }))
    expect(get).toHaveBeenCalledTimes(1)
  })
})
