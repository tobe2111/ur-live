import { describe, it, expect } from 'vitest'
import {
  parseGbSession, gbSessionToMeta, resolveGbStatus, isGbActive,
  resolveGbPricing, validateGbSession, GB_META_KEYS, type GbSession,
} from '../../shared/gb-session'

/**
 * 🎟️ 공구 상태 세션 SSOT 불변식 (docs/design 공구 엔진 §1). 순수 함수 — D1 불필요.
 */

const T0 = Date.parse('2026-07-06T00:00:00Z')
const HOUR = 3600_000

describe('parseGbSession / gbSessionToMeta 라운드트립', () => {
  it('off = 빈 세션', () => {
    expect(parseGbSession(undefined).mode).toBe('off')
    expect(parseGbSession({}).mode).toBe('off')
    expect(parseGbSession({ [GB_META_KEYS.mode]: 'off' }).mode).toBe('off')
  })
  it('live 세션 파싱', () => {
    const rec = {
      [GB_META_KEYS.mode]: 'live', [GB_META_KEYS.deadline]: '2026-07-10T00:00:00Z',
      [GB_META_KEYS.price]: '39000', [GB_META_KEYS.promo]: '20', [GB_META_KEYS.target]: '100',
      [GB_META_KEYS.linkOnly]: '1',
    }
    const s = parseGbSession(rec)
    expect(s.mode).toBe('live'); expect(s.price).toBe(39000); expect(s.promoPct).toBe(20)
    expect(s.target).toBe(100); expect(s.linkOnly).toBe(true)
  })
  it('off 직렬화는 나머지 키를 null 로 청소', () => {
    const meta = gbSessionToMeta({ mode: 'off' })
    expect(meta[GB_META_KEYS.mode]).toBe('off')
    expect(meta[GB_META_KEYS.price]).toBeNull()
    expect(meta[GB_META_KEYS.promo]).toBeNull()
  })
  it('세션 → meta → 세션 라운드트립 보존', () => {
    const s: GbSession = { mode: 'live', deadline: '2026-07-10T00:00:00Z', price: 39000, promoPct: 20, target: 50, linkOnly: false }
    const back = parseGbSession(Object.fromEntries(Object.entries(gbSessionToMeta(s)).map(([k, v]) => [k, v == null ? '' : String(v)])))
    expect(back.mode).toBe('live'); expect(back.price).toBe(39000); expect(back.promoPct).toBe(20); expect(back.linkOnly).toBe(false)
  })
})

describe('resolveGbStatus — 시간창 파생', () => {
  it('scheduled + 시작 도달 → live', () => {
    const s: GbSession = { mode: 'scheduled', startAt: new Date(T0 - HOUR).toISOString(), deadline: new Date(T0 + HOUR).toISOString() }
    expect(resolveGbStatus(s, T0)).toBe('live')
  })
  it('scheduled + 시작 전 → scheduled', () => {
    const s: GbSession = { mode: 'scheduled', startAt: new Date(T0 + HOUR).toISOString() }
    expect(resolveGbStatus(s, T0)).toBe('scheduled')
  })
  it('live + 마감 지남 → ended', () => {
    const s: GbSession = { mode: 'live', deadline: new Date(T0 - HOUR).toISOString() }
    expect(resolveGbStatus(s, T0)).toBe('ended')
  })
  it('off / ended 는 그대로', () => {
    expect(resolveGbStatus({ mode: 'off' }, T0)).toBe('off')
    expect(resolveGbStatus({ mode: 'ended' }, T0)).toBe('ended')
  })
})

describe('resolveGbPricing — 실효 소비자가', () => {
  const live: GbSession = { mode: 'live', deadline: new Date(T0 + HOUR).toISOString(), price: 39000, promoPct: 20 }
  it('공구 live → 공구가 적용(공구가로 통일 기본)', () => {
    const p = resolveGbPricing(live, 50000, 60000, T0)
    expect(p.effectivePrice).toBe(39000); expect(p.gbActive).toBe(true); expect(p.promoPct).toBe(20)
    expect(p.discountPct).toBe(Math.round((1 - 39000 / 60000) * 100))
  })
  it('공구 종료 → 상시가 복귀 + promo 0', () => {
    const ended = { ...live, deadline: new Date(T0 - HOUR).toISOString() }
    const p = resolveGbPricing(ended, 50000, 60000, T0)
    expect(p.effectivePrice).toBe(50000); expect(p.gbActive).toBe(false); expect(p.promoPct).toBe(0)
  })
  it('off → 상시가', () => {
    expect(resolveGbPricing({ mode: 'off' }, 50000, null, T0).effectivePrice).toBe(50000)
  })
  it('링크전용: 링크 경유만 공구가, 일반은 상시가', () => {
    const linkOnly = { ...live, linkOnly: true }
    expect(resolveGbPricing(linkOnly, 50000, null, T0, false).effectivePrice).toBe(50000)
    expect(resolveGbPricing(linkOnly, 50000, null, T0, true).effectivePrice).toBe(39000)
  })
  it('공구가가 상시가 이상이면 무시(음수 할인 방지)', () => {
    const bad = { ...live, price: 55000 }
    expect(resolveGbPricing(bad, 50000, null, T0).effectivePrice).toBe(50000)
  })
})

describe('validateGbSession', () => {
  const base: GbSession = { mode: 'live', price: 39000, promoPct: 20, startAt: '2026-07-06T00:00:00Z', deadline: '2026-07-10T00:00:00Z' }
  it('정상', () => { expect(validateGbSession(base, 50000).ok).toBe(true) })
  it('공구가 ≥ 상시가 거부', () => { expect(validateGbSession({ ...base, price: 50000 }, 50000).ok).toBe(false) })
  it('promo 범위 밖 거부', () => { expect(validateGbSession({ ...base, promoPct: 60 }, 50000).ok).toBe(false) })
  it('마감 ≤ 시작 거부', () => { expect(validateGbSession({ ...base, deadline: '2026-07-05T00:00:00Z' }, 50000).ok).toBe(false) })
  it('마감 없음 거부', () => { expect(validateGbSession({ ...base, deadline: null }, 50000).ok).toBe(false) })
  it('off/ended 는 검증 통과', () => {
    expect(validateGbSession({ mode: 'off' }, 50000).ok).toBe(true)
    expect(validateGbSession({ mode: 'ended' }, 50000).ok).toBe(true)
  })
})

describe('isGbActive', () => {
  it('live 창 안 = true', () => {
    expect(isGbActive({ mode: 'live', deadline: new Date(T0 + HOUR).toISOString() }, T0)).toBe(true)
  })
  it('off = false', () => { expect(isGbActive({ mode: 'off' }, T0)).toBe(false) })
})
