import { describe, it, expect } from 'vitest'
import { pickSeedDetail } from '@/pages/group-buy/seed-detail'

/**
 * 🧭 2026-06-22: 공구 상세 첫 paint 시드 선택 단위 테스트 (전수조사 — skeleton/이중로더 회귀 방지).
 *
 * 우선순위: RQ in-memory > SSR inject > localCache. id 불일치 소스는 무시. 없으면 null.
 */
type D = { id: number; name: string }
const ssr = (obj: unknown) => JSON.stringify(obj)

describe('pickSeedDetail', () => {
  it('RQ 캐시가 id 일치하면 최우선 채택', () => {
    const got = pickSeedDetail<D>(25, {
      rqCached: { id: 25, name: 'rq' },
      ssrText: ssr({ success: true, data: { id: 25, name: 'ssr' } }),
      localCached: { id: 25, name: 'local' },
    })
    expect(got?.name).toBe('rq')
  })

  it('RQ 없으면 SSR inject({success,data}) 채택', () => {
    const got = pickSeedDetail<D>(25, {
      ssrText: ssr({ success: true, data: { id: 25, name: 'ssr' } }),
      localCached: { id: 25, name: 'local' },
    })
    expect(got?.name).toBe('ssr')
  })

  it('SSR 가 raw detail 형태({id,...})여도 graceful 채택', () => {
    const got = pickSeedDetail<D>(25, { ssrText: ssr({ id: 25, name: 'raw' }) })
    expect(got?.name).toBe('raw')
  })

  it('RQ·SSR 없으면 localCache 채택', () => {
    const got = pickSeedDetail<D>(25, { localCached: { id: 25, name: 'local' } })
    expect(got?.name).toBe('local')
  })

  it('id 불일치 소스는 무시 (잘못된 상품 잔상 방지)', () => {
    const got = pickSeedDetail<D>(25, {
      rqCached: { id: 99, name: 'wrong' },
      ssrText: ssr({ success: true, data: { id: 30, name: 'wrong2' } }),
      localCached: { id: 25, name: 'local' },
    })
    expect(got?.name).toBe('local')
  })

  it('문자열 id 도 숫자 비교로 일치 처리', () => {
    const got = pickSeedDetail<D>(25, { rqCached: { id: '25', name: 'str' } as unknown as D })
    expect(got?.name).toBe('str')
  })

  it('손상된 SSR JSON 은 무시하고 다음 소스로', () => {
    const got = pickSeedDetail<D>(25, { ssrText: '{not json', localCached: { id: 25, name: 'local' } })
    expect(got?.name).toBe('local')
  })

  it('아무 소스도 없거나 일치 0 이면 null (skeleton fallback)', () => {
    expect(pickSeedDetail<D>(25, {})).toBeNull()
    expect(pickSeedDetail<D>(25, { rqCached: { id: 1 }, localCached: { id: 2 } })).toBeNull()
  })

  it('잘못된 productId(NaN/0/음수)면 null', () => {
    expect(pickSeedDetail<D>(NaN, { rqCached: { id: 25, name: 'x' } })).toBeNull()
    expect(pickSeedDetail<D>(0, { rqCached: { id: 0, name: 'x' } })).toBeNull()
    expect(pickSeedDetail<D>(-1, { rqCached: { id: -1, name: 'x' } })).toBeNull()
  })

  it('null/undefined 소스 값에도 안전', () => {
    expect(pickSeedDetail<D>(25, { rqCached: null, ssrText: null, localCached: undefined })).toBeNull()
  })
})
