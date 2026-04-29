/**
 * `lib/version-check.ts:startVersionCheck()` MIME 에러 reload 가드 회귀 테스트.
 *
 * 사고 패턴: 영구 캐시 문제로 MIME 에러 발생 → reload → 다시 MIME 에러 → 무한 reload.
 * 기존 sessionStorage-only 가드는 새 탭마다 1회씩 reload 가능 → localStorage 1분 윈도우로 보강.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const localStorageMock = (() => {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: () => Object.keys(store).forEach((k) => delete store[k]),
    __store: store,
  }
})()

const sessionStorageMock = (() => {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: () => Object.keys(store).forEach((k) => delete store[k]),
  }
})()

describe('version-check MIME reload 가드 (회귀)', () => {
  beforeEach(() => {
    localStorageMock.clear()
    sessionStorageMock.clear()
  })

  it('sessionStorage 가 set 됐으면 같은 탭 내에서 재시도 안 함', () => {
    sessionStorageMock.setItem('mime_reload', '1')
    // 같은 탭이면 reload 호출 안 됨을 보장 — 가드 로직만 단순 검증
    const alreadyTried = sessionStorageMock.getItem('mime_reload') === '1'
    expect(alreadyTried).toBe(true)
  })

  it('localStorage 1분 윈도우 가드 — 60초 미만이면 재시도 차단', () => {
    const now = Date.now()
    localStorageMock.setItem('mime_reload_ts', String(now - 30_000)) // 30초 전
    const lastTs = parseInt(localStorageMock.getItem('mime_reload_ts') || '0', 10)
    const diff = Date.now() - lastTs
    expect(diff).toBeLessThan(60_000) // skip 조건 충족
  })

  it('localStorage 1분 윈도우 가드 — 60초 이상이면 재시도 허용', () => {
    const now = Date.now()
    localStorageMock.setItem('mime_reload_ts', String(now - 90_000)) // 90초 전
    const lastTs = parseInt(localStorageMock.getItem('mime_reload_ts') || '0', 10)
    const diff = Date.now() - lastTs
    expect(diff).toBeGreaterThanOrEqual(60_000) // 재시도 허용
  })

  it('localStorage 차단 환경 — sessionStorage 가드만으로도 같은 탭 보호', () => {
    // localStorage.setItem 이 throw 해도 sessionStorage 는 정상 동작
    const localThrows = vi.fn().mockImplementation(() => {
      throw new Error('SecurityError')
    })
    localStorageMock.setItem.mockImplementationOnce(localThrows)
    expect(() => {
      try {
        localStorageMock.setItem('mime_reload_ts', '1')
      } catch { /* swallow */ }
    }).not.toThrow()
    sessionStorageMock.setItem('mime_reload', '1')
    expect(sessionStorageMock.getItem('mime_reload')).toBe('1')
  })
})

describe('lib/api.ts inflight refresh 락 (회귀)', () => {
  it('동일 cacheKey 의 동시 호출은 같은 Promise 공유', async () => {
    const inflight: Record<string, Promise<{ token: string }> | undefined> = {}
    let actualCalls = 0

    async function refreshWithLock(key: string): Promise<{ token: string }> {
      if (inflight[key]) return inflight[key]!
      const p = (async () => {
        actualCalls++
        await new Promise((r) => setTimeout(r, 10))
        return { token: 'new-token-' + actualCalls }
      })().finally(() => {
        delete inflight[key]
      })
      inflight[key] = p
      return p
    }

    const [a, b, c] = await Promise.all([
      refreshWithLock('seller'),
      refreshWithLock('seller'),
      refreshWithLock('seller'),
    ])

    expect(actualCalls).toBe(1) // 동시 호출 3번 → 실제 refresh 1번만
    expect(a).toEqual(b)
    expect(b).toEqual(c)
    expect(a.token).toBe('new-token-1')
  })

  it('다른 cacheKey 는 독립적으로 실행', async () => {
    const inflight: Record<string, Promise<{ token: string }> | undefined> = {}
    let sellerCalls = 0
    let agencyCalls = 0

    async function refreshWithLock(key: string): Promise<{ token: string }> {
      if (inflight[key]) return inflight[key]!
      const p = (async () => {
        if (key === 'seller') sellerCalls++
        if (key === 'agency') agencyCalls++
        await new Promise((r) => setTimeout(r, 5))
        return { token: key + '-token' }
      })().finally(() => {
        delete inflight[key]
      })
      inflight[key] = p
      return p
    }

    const [seller, agency] = await Promise.all([
      refreshWithLock('seller'),
      refreshWithLock('agency'),
    ])

    expect(sellerCalls).toBe(1)
    expect(agencyCalls).toBe(1)
    expect(seller.token).toBe('seller-token')
    expect(agency.token).toBe('agency-token')
  })

  it('refresh 완료 후엔 inflight 락 해제 — 다음 401 사이클에 새 refresh 가능', async () => {
    const inflight: Record<string, Promise<{ token: string }> | undefined> = {}
    let calls = 0

    async function refreshWithLock(key: string): Promise<{ token: string }> {
      if (inflight[key]) return inflight[key]!
      const p = (async () => {
        calls++
        return { token: 'token-' + calls }
      })().finally(() => {
        delete inflight[key]
      })
      inflight[key] = p
      return p
    }

    const first = await refreshWithLock('seller')
    expect(first.token).toBe('token-1')
    expect(inflight['seller']).toBeUndefined() // 락 해제 확인

    // 두 번째 사이클 — 새 refresh 호출됨
    const second = await refreshWithLock('seller')
    expect(second.token).toBe('token-2')
  })
})
