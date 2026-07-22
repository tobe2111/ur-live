import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

/**
 * 🛡️ 2026-07-21 청크 자가복구 관용/유예 잠금 — 배포 전파 창에서 수동 UI 노출 급감.
 *   90초 내 3회까지 자동 재시도(유예 후), 초과 시 false(수동 복구 UI). 인라인 부트가드와 SSOT 미러.
 *   ⚠️ 모듈 레벨 재진입 플래그(_reloadPending) 때문에 테스트마다 모듈을 새로 import 한다.
 */
async function freshModule() {
  vi.resetModules()
  return import('@/utils/chunk-error')
}

describe('isChunkLoadError — MIME 변종 감지', () => {
  it('브라우저별 청크 실패 메시지 감지 / 일반 에러 제외', async () => {
    const { isChunkLoadError } = await freshModule()
    expect(isChunkLoadError('Failed to fetch dynamically imported module: /assets/x.js')).toBe(true)
    expect(isChunkLoadError('Expected a JavaScript-or-Wasm module script but ... MIME type of text/html')).toBe(true)
    expect(isChunkLoadError('Importing a module script failed')).toBe(true)
    expect(isChunkLoadError('Unable to preload CSS for /assets/x.css')).toBe(true)
    expect(isChunkLoadError('TypeError: x is undefined')).toBe(false)
    expect(isChunkLoadError('')).toBe(false)
  })
})

describe('recoverFromChunkError — 90초 3회 관용 + 유예 재시도', () => {
  let store: Record<string, string>
  let replace: ReturnType<typeof vi.fn>
  beforeEach(() => {
    store = {}
    replace = vi.fn()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
    vi.stubGlobal('window', { location: { href: 'https://urdeal.kr/', replace, reload: vi.fn() } })
    vi.useFakeTimers()
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('1회 = true, 유예 후 __cb 캐시버스트 reload', async () => {
    const { recoverFromChunkError } = await freshModule()
    expect(recoverFromChunkError()).toBe(true)
    expect(replace).not.toHaveBeenCalled()          // 유예 전엔 reload 안 함(전파 대기)
    vi.advanceTimersByTime(700)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(String(replace.mock.calls[0][0])).toContain('__cb=')
  })

  it('90초 내 4번째 = false (수동 복구 UI)', async () => {
    const { recoverFromChunkError } = await freshModule()
    store['__ur_chunk_reload__'] = JSON.stringify({ n: 3, t: Date.now() }) // 이미 3회 시도
    expect(recoverFromChunkError()).toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })

  it('재진입 가드 — 유예 중 추가 호출은 카운트 1회만', async () => {
    const { recoverFromChunkError } = await freshModule()
    recoverFromChunkError(); recoverFromChunkError(); recoverFromChunkError() // 버스트
    expect(JSON.parse(store['__ur_chunk_reload__']).n).toBe(1) // 3번 호출해도 카운트는 1
  })
})
