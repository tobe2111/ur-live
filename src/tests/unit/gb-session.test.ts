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

/**
 * 🎟️🏪 **"공동구매"인데 인원이 가격을 안 바꾼다** — 정의 불변식 (2026-08-14)
 *   (대표 *"지금 공동구매 정의도 잘 된거야?"* 에 대한 실측을 코드로 고정)
 *
 * 이 레포에서 "공동구매"는 네 가지를 가리키고, **라이브의 둘은 인원과 무관**하다:
 *   - 🎟️ 유어딜 이용권 공구 = 즉시 단일가(2026-05-30 A2)
 *   - 🏪 공구 서비스 픽업 공구 = **기간 한정 특가** — 세션의 `target` 은 주석 그대로 "표시용"
 *
 * 이름과 경제가 다르다는 것은 대표 결정이라 그대로 두되, **경제가 조용히 바뀌는 것**은 막는다.
 * 누군가 `target` 을 가격 조건으로 쓰기 시작하면 소비자 표시(문구 가드)와 청구가 어긋난다.
 *
 * ⚠️ 이 테스트가 못 막는 것: 인원 조건이 **다른 계층**(주문 API·프로모션)에서 붙는 경우.
 *   그건 이 순수함수 밖이다.
 */
describe('공구 정의 — 가격은 인원에 반응하지 않는다', () => {
  const base = { mode: 'live' as const, price: 7000, deadline: new Date(Date.now() + 864e5).toISOString() }
  const NOW = Date.now()

  it('🔴 목표 인원이 무엇이든 유효가격이 같다 (target 은 표시용)', () => {
    const prices = [null, 0, 1, 5, 999].map((t) =>
      resolveGbPricing({ ...base, target: t }, 10000, 12000, NOW).effectivePrice,
    )
    expect(new Set(prices).size, `target 에 따라 가격이 갈렸다: ${prices.join(',')}`).toBe(1)
    expect(prices[0]).toBe(7000)
  })

  it('🔴 할인율도 인원과 무관하다', () => {
    const a = resolveGbPricing({ ...base, target: 1 }, 10000, 12000, NOW)
    const b = resolveGbPricing({ ...base, target: 500 }, 10000, 12000, NOW)
    expect(a.discountPct).toBe(b.discountPct)
    expect(a.promoPct).toBe(b.promoPct)
  })

  it('🔴 가격을 정하는 것은 **기간**이다 — 마감이 지나면 상시가로 돌아간다', () => {
    const past = { ...base, deadline: new Date(NOW - 1000).toISOString(), target: 3 }
    const r = resolveGbPricing(past, 10000, 12000, NOW)
    expect(r.gbActive).toBe(false)
    expect(r.effectivePrice).toBe(10000)   // 인원이 3이든 300이든 마감이 지나면 상시가
  })

  it('resolveGbPricing 소스가 target 을 읽지 않는다 — 값이 아니라 코드로 확인', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(resolve(process.cwd(), 'src/shared/gb-session.ts'), 'utf8')
    const fn = src.slice(src.indexOf('export function resolveGbPricing'))
    const body = fn.slice(0, fn.indexOf('\n}\n'))
    expect(/\bs\.target\b/.test(body), 'resolveGbPricing 이 target 을 참조한다 — 정의가 바뀌었다').toBe(false)
  })
})
