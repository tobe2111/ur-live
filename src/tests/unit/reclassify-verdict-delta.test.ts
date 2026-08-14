import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  verdictChanged, tallyVerdict, mergeDelta, emptyDelta,
  type VerdictBefore, type VerdictAfter,
} from '@/features/marketing/api/reclassify-verdict-delta'
import { RECLASSIFY_COLS } from '@/features/marketing/api/reclassify-priority'

/**
 * 🔬 **판정 변화율 계측** — 재분류 랩을 30만 행에서 1.2만 행으로 좁혀도 되는지(38일 → 2일)의 근거.
 *
 * ## 이 테스트가 지키는 것
 * 변화율은 **결론을 뒤집는 숫자**다. 부풀면 좁히기가 부당해 보이고, 줄면 위험한 좁히기가 정당해 보인다.
 * 그래서 "각 분기가 실제로 쓰는 컬럼만 비교한다"를 진리표로 못 박는다.
 *
 * ## 못 막는 것
 * - 라이브에서 실제 변화율이 얼마인지 — 그건 계측 결과를 봐야 안다(그게 이 계측의 목적이다).
 * - 계측이 **동작을 안 바꾼다**는 것은 UPDATE 문자열 불변으로만 확인한다(런타임 검증 아님).
 */

const before = (o: Partial<VerdictBefore>): VerdictBefore =>
  ({ category: '광고', subcategory: '대행', tier: 2, lead_type: 'partner', classify_confidence: 'keyword', ...o })
const after = (o: Partial<VerdictAfter>): VerdictAfter =>
  ({ category: '광고', subcategory: '대행', tier: 2, lead_type: 'partner', confidence: 'keyword', ...o })

describe('☑️ registry 분기 — lead_type · confidence 만 본다', () => {
  it('둘 다 그대로면 안 바뀐 것', () => {
    expect(verdictChanged(before({ classify_confidence: 'registry' }), after({}), true)).toBe(false)
  })

  it('lead_type 이 달라지면 바뀐 것', () => {
    expect(verdictChanged(before({ classify_confidence: 'registry' }), after({ lead_type: 'org' }), true)).toBe(true)
  })

  it('confidence 가 registry 가 아니었으면 바뀐 것(이번에 registry 로 찍힌다)', () => {
    expect(verdictChanged(before({ classify_confidence: 'keyword' }), after({}), true)).toBe(true)
  })

  it('🔴 category 가 달라도 안 바뀐 것 — 등록부 업종은 불가침이라 UPDATE 가 안 건드린다', () => {
    expect(verdictChanged(before({ classify_confidence: 'registry', category: '식음료' }), after({ category: '광고' }), true)).toBe(false)
  })
})

describe('☑️ evidence 분기 — 업종까지 덮어쓴다', () => {
  const evd = (o: Partial<VerdictAfter> = {}) => after({ confidence: 'evidence', ...o })

  it('전부 같으면 안 바뀐 것', () => {
    expect(verdictChanged(before({ classify_confidence: 'evidence' }), evd(), false)).toBe(false)
  })

  it('category / subcategory / lead_type / confidence 가 달라지면 바뀐 것', () => {
    const b = before({ classify_confidence: 'evidence' })
    expect(verdictChanged(b, evd({ category: '식음료' }), false)).toBe(true)
    expect(verdictChanged(b, evd({ subcategory: '카페' }), false)).toBe(true)
    expect(verdictChanged(b, evd({ lead_type: 'org' }), false)).toBe(true)
    expect(verdictChanged(before({ classify_confidence: 'keyword' }), evd(), false)).toBe(true)
  })

  it('tier 가 비어 있다가 채워지면 바뀐 것', () => {
    expect(verdictChanged(before({ classify_confidence: 'evidence', tier: null }), evd({ tier: 1 }), false)).toBe(true)
  })

  it('🔴 tier 가 이미 있으면 안 바뀐 것 — UPDATE 가 COALESCE(tier, ?) 라 옛 값이 이긴다', () => {
    expect(verdictChanged(before({ classify_confidence: 'evidence', tier: 3 }), evd({ tier: 1 }), false)).toBe(false)
  })
})

describe('☑️ 그 외 분기 — 업종은 기존 값 보존(대표 수동 분류 불가침)', () => {
  it('lead_type · confidence 만 본다', () => {
    expect(verdictChanged(before({}), after({}), false)).toBe(false)
    expect(verdictChanged(before({}), after({ confidence: 'none' }), false)).toBe(true)
    expect(verdictChanged(before({}), after({ lead_type: 'org' }), false)).toBe(true)
  })

  it('🔴 category 가 달라도 안 바뀐 것 — 이 분기의 UPDATE 는 category 를 안 쓴다', () => {
    expect(verdictChanged(before({ category: '식음료' }), after({ category: '광고' }), false)).toBe(false)
  })
})

describe('🧮 계수기 — 무엇을 분모에 넣는가', () => {
  it('첫 분류는 분모에서 뺀다(변화가 아니라 최초 판정)', () => {
    const d = emptyDelta()
    tallyVerdict(d, 'commerce', null, true)
    tallyVerdict(d, 'webkr', 0, true)
    expect(d).toMatchObject({ first: 2, reg_seen: 0, guess_seen: 0 })
  })

  it('등록부/추측은 **소스**로 가른다', () => {
    const d = emptyDelta()
    for (const s of ['commerce', 'storeinfo', 'market', 'nara']) tallyVerdict(d, s, 8, false)
    for (const s of ['webkr', 'local']) tallyVerdict(d, s, 8, true)
    expect(d).toMatchObject({ reg_seen: 4, reg_changed: 0, guess_seen: 2, guess_changed: 2 })
  })

  it('바뀐 것만 changed 로 센다', () => {
    const d = emptyDelta()
    tallyVerdict(d, 'commerce', 8, true)
    tallyVerdict(d, 'commerce', 8, false)
    expect(d).toMatchObject({ reg_seen: 2, reg_changed: 1 })
  })
})

describe('➕ 누적 — 회차마다 덮어쓰면 표본이 250건에 갇힌다', () => {
  it('이전 값에 더한다', () => {
    const prev = { reg_seen: 1000, reg_changed: 7, guess_seen: 50, guess_changed: 20, first: 3 }
    const add = { reg_seen: 200, reg_changed: 1, guess_seen: 10, guess_changed: 4, first: 1 }
    expect(mergeDelta(prev, add)).toEqual({ reg_seen: 1200, reg_changed: 8, guess_seen: 60, guess_changed: 24, first: 4 })
  })

  it('이전 값이 없거나 깨졌으면 이번 회차만', () => {
    const add = { reg_seen: 5, reg_changed: 1, guess_seen: 2, guess_changed: 0, first: 0 }
    expect(mergeDelta(null, add)).toEqual(add)
    expect(mergeDelta('깨진값', add)).toEqual(add)
  })
})

describe('🔌 배선 — 계측이 실제로 꽂혀 있고, 동작은 안 바꾼다', () => {
  const disc = readFileSync('src/features/marketing/api/company-discovery.ts', 'utf8')

  it('비교에 필요한 세 컬럼을 읽어 온다', () => {
    for (const col of ['lead_type', 'classify_confidence', 'classified_v']) expect(RECLASSIFY_COLS).toContain(col)
  })

  it('랩이 행마다 계수기를 부른다', () => {
    expect(disc).toMatch(/tallyVerdict\(delta, r\.source, r\.classified_v, verdictChanged\(r, c, registry\)\)/)
  })

  it('회차 통계에 delta 가 실린다', () => {
    expect(disc).toMatch(/writeReclassifyStats\(DB, CLASSIFY_RULES_VERSION, \{[^}]*delta[^}]*\}\)/)
    expect(readFileSync('src/features/marketing/api/reclassify-verdict-delta.ts', 'utf8')).toMatch(/delta: mergeDelta\(prevDelta, s\.delta\)/)
  })

  it('🔴 판정 UPDATE 세 갈래는 그대로다 — 계측은 세기만 한다', () => {
    expect(disc).toContain("UPDATE ad_company_leads SET lead_type = ?, classify_confidence = 'registry', classified_v = ? WHERE id = ?")
    expect(disc).toContain('UPDATE ad_company_leads SET category = ?, subcategory = ?, tier = COALESCE(tier, ?), lead_type = ?, classify_confidence = ?, classified_v = ? WHERE id = ?')
    expect(disc).toContain('UPDATE ad_company_leads SET lead_type = ?, classify_confidence = ?, classified_v = ? WHERE id = ?')
  })
})
