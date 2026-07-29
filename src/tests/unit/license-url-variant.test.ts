/**
 * 🔬 인허가 요청 형태(변종) + 프로브 — `license-url.ts` 불변식.
 *
 *   배경: 인허가 레인이 `API: HTTP 500 — Unexpected errors` 로 0건. 500 은 본문에 원인 코드가 없고,
 *   이 개발 환경은 `apis.data.go.kr` CONNECT 가 막혀 **직접 호출로 확인할 수 없다.** 그래서 URL 을
 *   추측으로 바꾸는 대신 후보를 라이브가 고르게 했다. 여기서 고정하는 건 그 장치의 안전성이다.
 *
 *   ⚠️ 가장 중요한 건 **키 노출 금지**(이 레포는 public). 나머지는 판정 규칙이 흔들리지 않게 하는 것.
 */
import { describe, it, expect } from 'vitest'
import {
  LICENSE_VARIANTS, DEFAULT_VARIANT_ID, findVariant, buildLicenseUrl, redactServiceKey,
  resolveLicensePageSize, shouldProbe, probeLicenseVariants, PROBE_COOLDOWN_MS,
} from '@/features/marketing/api/license-url'

const V = (id: string) => findVariant(id)
const url = (id: string, size?: number) => buildLicenseUrl({
  base: 'https://apis.data.go.kr/1741000', endpoint: 'general_restaurants', keyParam: 'KEY%2Babc',
  day: '20260728', page: 2, variant: V(id), size: size ?? resolveLicensePageSize(null, V(id)),
})

describe('요청 형태 후보', () => {
  it('후보 id 는 중복되지 않고 첫 번째가 현행(v1)이다', () => {
    const ids = LICENSE_VARIANTS.map(v => v.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(DEFAULT_VARIANT_ID).toBe('v1')
  })

  it('알 수 없는 id 는 현행으로 폴백한다(DB 에 쓰레기가 있어도 레인이 죽지 않게)', () => {
    expect(findVariant('없는거').id).toBe(DEFAULT_VARIANT_ID)
    expect(findVariant(null).id).toBe(DEFAULT_VARIANT_ID)
  })

  it('v1 은 2026-07-22 대표 스펙 그대로다(현행을 조용히 바꾸지 않는다)', () => {
    const u = url('v1')
    expect(u).toContain('pageIndex=2')
    expect(u).toContain('pageSize=500')
    expect(u).toContain('type=json')
    expect(u).toContain('resultType=json')
    expect(u).toContain('lastModTsBgn=20260728')
    expect(u).toContain('lastModTsEnd=20260728')
  })

  it('각 후보는 v1 과 **한 가지만** 다르다(그래야 결과가 원인을 지목한다)', () => {
    const v1 = LICENSE_VARIANTS[0]
    const diffs = (v: typeof v1) => [
      v.pageParam !== v1.pageParam || v.sizeParam !== v1.sizeParam,
      JSON.stringify(v.format) !== JSON.stringify(v1.format),
      v.dateFilter !== v1.dateFilter,
      v.size !== v1.size && v.size === 100 && JSON.stringify(v.format) === JSON.stringify(v1.format) && v.dateFilter === v1.dateFilter,
    ].filter(Boolean).length
    for (const v of LICENSE_VARIANTS.slice(1)) expect(diffs(v), `${v.id} (${v.why})`).toBeGreaterThan(0)
  })

  it('v5 는 날짜 필터를 뺀다(변동일 파라미터가 원인인지 가르기 위함)', () => {
    expect(url('v5')).not.toContain('lastModTs')
  })
})

describe('🔐 서비스키 노출 금지 — 진단에 URL 을 남기는 대가', () => {
  it('serviceKey 값을 남기지 않는다', () => {
    const red = redactServiceKey(url('v1'))
    expect(red).not.toContain('KEY%2Babc')
    expect(red).toContain('serviceKey=***')
  })

  it('authKey/대문자 변형도 가린다', () => {
    expect(redactServiceKey('https://x/y?authKey=SECRET&pageIndex=1')).toBe('https://x/y?authKey=***&pageIndex=1')
    expect(redactServiceKey('https://x/y?ServiceKey=SECRET')).toBe('https://x/y?ServiceKey=***')
  })

  it('키 뒤의 다른 파라미터는 보존한다(가리기가 진단을 무의미하게 만들면 안 된다)', () => {
    const red = redactServiceKey(url('v1'))
    expect(red).toContain('pageSize=500')
    expect(red).toContain('lastModTsBgn=20260728')
  })
})

describe('페이지 크기(무배포 조정 레버)', () => {
  it('env 값이 있으면 후보 기본값을 이긴다', () => {
    expect(resolveLicensePageSize('100', V('v1'))).toBe(100)
    expect(url('v1', resolveLicensePageSize('100', V('v1')))).toContain('pageSize=100')
  })
  it('빈값·쓰레기·0 이하는 후보 기본값으로', () => {
    for (const raw of [null, '', 'abc', '0', '-5']) expect(resolveLicensePageSize(raw, V('v1'))).toBe(500)
  })
  it('상한 1000 으로 클램프(오타로 10만을 넣어도 한 요청이 폭발하지 않게)', () => {
    expect(resolveLicensePageSize('999999', V('v1'))).toBe(1000)
  })
})

describe('프로브 쿨다운', () => {
  const now = 1_700_000_000_000
  it('한 번도 안 해봤으면 한다', () => expect(shouldProbe(null, now)).toBe(true))
  it('쿨다운 안이면 안 한다(실패가 상대편 일시 장애일 때 매 라운드 4발 쏘지 않게)', () => {
    expect(shouldProbe({ id: 'v1', probed_at: now - 60_000 }, now)).toBe(false)
  })
  it('쿨다운이 지나면 다시 한다(대표가 활용신청/스펙을 고치면 스스로 살아나야 한다)', () => {
    expect(shouldProbe({ id: 'v1', probed_at: now - PROBE_COOLDOWN_MS - 1 }, now)).toBe(true)
  })
})

describe('프로브 판정', () => {
  const base = { base: 'https://api', endpoint: 'general_restaurants', keyParam: 'K', day: '20260728' }

  it('행을 준 후보를 승자로 뽑고 거기서 멈춘다(뒤 후보는 쏘지 않는다)', async () => {
    const seen: string[] = []
    const r = await probeLicenseVariants({
      ...base, skip: ['v1'],
      fetchPage: async (u) => { seen.push(u); return u.includes('pageSize=100') && u.includes('type=json') ? { ok: true, rows: 7 } : { ok: false, rows: 0, msg: 'HTTP 500' } },
    })
    expect(r.winner).toBe('v2')
    expect(seen.length).toBe(1) // v1 은 skip, v2 에서 즉시 승부
    expect(r.attempts.map(a => a.id)).toEqual(['v2'])
  })

  it('**200 인데 0행**은 승자가 아니다 — 그날 변동이 없어서일 수 있어 판정 근거가 못 된다', async () => {
    const r = await probeLicenseVariants({ ...base, fetchPage: async () => ({ ok: true, rows: 0 }) })
    expect(r.winner).toBeNull()
    expect(r.attempts).toHaveLength(LICENSE_VARIANTS.length)
  })

  it('아무도 못 주면 null — 형태 문제가 아니라는 정보 자체가 결론이다', async () => {
    const r = await probeLicenseVariants({ ...base, fetchPage: async () => ({ ok: false, rows: 0, msg: 'HTTP 500 — Unexpected errors' }) })
    expect(r.winner).toBeNull()
    expect(r.attempts.every(a => a.msg?.includes('500'))).toBe(true)
  })

  it('예산이 없으면 시작한 만큼만 하고 멈춘다(반쯤 하다 끊겨도 이력은 남는다)', async () => {
    let left = 2
    const r = await probeLicenseVariants({
      ...base, canSpend: () => left > 0,
      fetchPage: async () => { left--; return { ok: false, rows: 0, msg: 'HTTP 500' } },
    })
    expect(r.attempts).toHaveLength(2)
    expect(r.winner).toBeNull()
  })

  it('fetch 가 예외를 던져도 프로브 전체가 죽지 않는다', async () => {
    const r = await probeLicenseVariants({ ...base, fetchPage: async () => { throw new Error('boom') } })
    expect(r.attempts).toHaveLength(LICENSE_VARIANTS.length)
    expect(r.attempts[0].ok).toBe(false)
  })
})
