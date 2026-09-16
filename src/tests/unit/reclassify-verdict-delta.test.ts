import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  verdictChanged, tallyVerdict, mergeDelta, emptyDelta, VERDICT_DELTA_VERSION,
  type VerdictBefore, type VerdictWritten,
} from '@/features/marketing/api/reclassify-verdict-delta'
import { RECLASSIFY_COLS } from '@/features/marketing/api/reclassify-priority'

/**
 * 🔬 **판정 변화율 계측** — 재분류 랩을 30만 행에서 1.2만 행으로 좁혀도 되는지(38일 → 2일)의 근거.
 *
 * ## 이 테스트가 지키는 것
 * 변화율은 **결론을 뒤집는 숫자**다. 부풀면 좁히기가 부당해 보이고, 줄면 위험한 좁히기가 정당해 보인다.
 * 그래서 "**DB 에 실제로 들어가는 값**과 비교한다"를 진리표로 못 박는다.
 *
 * 🩸 v1 이 정확히 여기서 틀렸다 — `classifyLead` 날것을 비교해 등록부 98% 라는 거짓값을 쌓았다.
 *   아래 "라이브에서 잡힌 오계상" 블록이 그 재발을 막는다.
 *
 * ## 못 막는 것
 * - 라이브 변화율이 실제로 얼마인지 — 계측 결과를 봐야 안다(그게 목적이다).
 * - 계측이 동작을 안 바꾼다는 것은 UPDATE 문자열/바인드 불변으로만 확인한다(런타임 검증 아님).
 */

const before = (o: Partial<VerdictBefore>): VerdictBefore =>
  ({ category: '광고', subcategory: '대행', tier: 2, lead_type: 'partner', classify_confidence: 'keyword', ...o })
const written = (o: Partial<VerdictWritten>): VerdictWritten =>
  ({ category: '광고', subcategory: '대행', tier: 2, lead_type: 'partner', confidence: 'keyword', ...o })

describe('🩸 라이브에서 잡힌 오계상 (2026-08-17) — 날것이 아니라 기록값과 비교한다', () => {
  it('등록부 행: classifyLead 가 unknown 이어도 기록값은 partner 라 안 바뀐 것', () => {
    // 실측: 등록부 316,410행이 이미 partner · v9 재판정분도 전부 partner 인데 v1 은 98% 를 "바뀜"으로 셌다.
    const b = before({ lead_type: 'partner', classify_confidence: 'registry' })
    expect(verdictChanged(b, written({ lead_type: 'partner', confidence: 'registry' }), 'registry')).toBe(false)
  })

  it('webkr 강등 행: 기록값은 none 이라 keyword 였으면 바뀐 것 / 이미 none 이면 안 바뀐 것', () => {
    // `conf` 강등(webkr + 의심 이름 → 'none')도 호출부에서 일어난다 — 날것 c.confidence 로 비교하면 놓친다.
    expect(verdictChanged(before({ classify_confidence: 'keyword' }), written({ confidence: 'none' }), 'other')).toBe(true)
    expect(verdictChanged(before({ classify_confidence: 'none' }), written({ confidence: 'none' }), 'other')).toBe(false)
  })
})

describe('☑️ registry 분기 — lead_type · confidence 만 본다', () => {
  it('둘 다 그대로면 안 바뀐 것', () => {
    expect(verdictChanged(before({ classify_confidence: 'registry' }), written({ confidence: 'registry' }), 'registry')).toBe(false)
  })

  it('lead_type 이 달라지면 바뀐 것', () => {
    expect(verdictChanged(before({ classify_confidence: 'registry' }), written({ lead_type: 'org', confidence: 'registry' }), 'registry')).toBe(true)
  })

  it('confidence 가 registry 가 아니었으면 바뀐 것(이번에 registry 로 찍힌다)', () => {
    expect(verdictChanged(before({ classify_confidence: 'keyword' }), written({ confidence: 'registry' }), 'registry')).toBe(true)
  })

  it('🔴 category 가 달라도 안 바뀐 것 — 등록부 업종은 불가침이라 UPDATE 가 안 건드린다', () => {
    expect(verdictChanged(before({ classify_confidence: 'registry', category: '식음료' }), written({ category: '광고', confidence: 'registry' }), 'registry')).toBe(false)
  })
})

describe('☑️ evidence 분기 — 업종까지 덮어쓴다', () => {
  const evd = (o: Partial<VerdictWritten> = {}) => written({ confidence: 'evidence', ...o })

  it('전부 같으면 안 바뀐 것', () => {
    expect(verdictChanged(before({ classify_confidence: 'evidence' }), evd(), 'evidence')).toBe(false)
  })

  it('category / subcategory / lead_type / confidence 가 달라지면 바뀐 것', () => {
    const b = before({ classify_confidence: 'evidence' })
    expect(verdictChanged(b, evd({ category: '식음료' }), 'evidence')).toBe(true)
    expect(verdictChanged(b, evd({ subcategory: '카페' }), 'evidence')).toBe(true)
    expect(verdictChanged(b, evd({ lead_type: 'org' }), 'evidence')).toBe(true)
    expect(verdictChanged(before({ classify_confidence: 'keyword' }), evd(), 'evidence')).toBe(true)
  })

  it('tier 가 비어 있다가 채워지면 바뀐 것', () => {
    expect(verdictChanged(before({ classify_confidence: 'evidence', tier: null }), evd({ tier: 1 }), 'evidence')).toBe(true)
  })

  it('🔴 tier 가 이미 있으면 안 바뀐 것 — UPDATE 가 COALESCE(tier, ?) 라 옛 값이 이긴다', () => {
    expect(verdictChanged(before({ classify_confidence: 'evidence', tier: 3 }), evd({ tier: 1 }), 'evidence')).toBe(false)
  })
})

describe('☑️ 그 외 분기 — 업종은 기존 값 보존(대표 수동 분류 불가침)', () => {
  it('lead_type · confidence 만 본다', () => {
    expect(verdictChanged(before({}), written({}), 'other')).toBe(false)
    expect(verdictChanged(before({}), written({ confidence: 'none' }), 'other')).toBe(true)
    expect(verdictChanged(before({}), written({ lead_type: 'org' }), 'other')).toBe(true)
  })

  it('🔴 category 가 달라도 안 바뀐 것 — 이 분기의 UPDATE 는 category 를 안 쓴다', () => {
    expect(verdictChanged(before({ category: '식음료' }), written({ category: '광고' }), 'other')).toBe(false)
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
  it('같은 세대면 더한다', () => {
    const prev = { v: VERDICT_DELTA_VERSION, reg_seen: 1000, reg_changed: 7, guess_seen: 50, guess_changed: 20, first: 3 }
    const add = { v: VERDICT_DELTA_VERSION, reg_seen: 200, reg_changed: 1, guess_seen: 10, guess_changed: 4, first: 1 }
    expect(mergeDelta(prev, add)).toEqual({ v: VERDICT_DELTA_VERSION, reg_seen: 1200, reg_changed: 8, guess_seen: 60, guess_changed: 24, first: 4 })
  })

  it('🔴 세대가 다르면 옛 누계를 버린다 — 오염된 v1 위에 얹으면 영영 안 씻긴다', () => {
    const contaminated = { v: 1, reg_seen: 8500, reg_changed: 8333, guess_seen: 11471, guess_changed: 304, first: 0 }
    const add = { v: VERDICT_DELTA_VERSION, reg_seen: 10, reg_changed: 1, guess_seen: 5, guess_changed: 2, first: 0 }
    expect(mergeDelta(contaminated, add)).toEqual(add)
  })

  it('이전 값이 없거나 깨졌으면 이번 회차만', () => {
    const add = { v: VERDICT_DELTA_VERSION, reg_seen: 5, reg_changed: 1, guess_seen: 2, guess_changed: 0, first: 0 }
    expect(mergeDelta(null, add)).toEqual(add)
    expect(mergeDelta('깨진값', add)).toEqual(add)
  })
})

describe('🔌 배선 — 계측이 실제로 꽂혀 있고, 동작은 안 바꾼다', () => {
  const disc = readFileSync('src/features/marketing/api/company-discovery.ts', 'utf8')

  it('비교에 필요한 세 컬럼을 읽어 온다', () => {
    for (const col of ['lead_type', 'classify_confidence', 'classified_v']) expect(RECLASSIFY_COLS).toContain(col)
  })

  it('🔴 UPDATE 와 비교가 **같은 기록값**을 쓴다 — 두 벌이면 v1 오계상이 재발한다', () => {
    expect(disc).toMatch(/const written = \{/)
    // 🗺️ 2026-09-04: 인라인 호출 문자열을 박아 뒀더니, 그 값을 `changed` 상수로 뽑아 **쓰기 분기에도
    //   쓰게** 하자(no-op UPDATE 제거) 이 검사가 깨졌다 — 계약은 오히려 강해졌는데 지도가 낡은 경우다.
    //   지키려는 것은 "비교와 기록이 같은 값을 쓴다"이지 호출이 한 줄인지가 아니므로, 둘로 나눠 고정한다.
    expect(disc, '비교는 반드시 같은 written 객체로').toMatch(/verdictChanged\(r, written,/)
    expect(disc, '통계는 그 비교 결과를 그대로 받아야 한다(따로 계산하면 두 벌이 된다)')
      .toMatch(/tallyVerdict\(delta, r\.source, r\.classified_v, (changed|verdictChanged\(r, written,)/)
    // 세 갈래 바인드가 전부 written.* 를 쓴다(날것 c.lead_type / c.confidence 직접 바인드 금지).
    expect(disc).toMatch(/\.bind\(written\.lead_type, CLASSIFY_RULES_VERSION/)
    expect(disc).toMatch(/\.bind\(written\.category, written\.subcategory, written\.tier, written\.lead_type, written\.confidence/)
    expect(disc).toMatch(/\.bind\(written\.lead_type, written\.confidence, CLASSIFY_RULES_VERSION/)
  })

  it('기록값 매핑이 보존된다(등록부 unknown→partner · 그 외 강등 conf)', () => {
    expect(disc).toMatch(/lead_type: registry && c\.lead_type === 'unknown' && !suspect \? 'partner' : c\.lead_type/)
    expect(disc).toMatch(/confidence: registry \? 'registry' : conf/)
  })

  it('회차 통계에 delta 가 실린다', () => {
    expect(disc).toMatch(/writeReclassifyStats\(DB, CLASSIFY_RULES_VERSION, \{[^}]*delta[^}]*\}\)/)
    expect(readFileSync('src/features/marketing/api/reclassify-verdict-delta.ts', 'utf8')).toMatch(/delta: mergeDelta\(prevDelta, s\.delta\)/)
  })

  it('🔴 판정 UPDATE 세 갈래 SQL 은 그대로다 — 계측은 세기만 한다', () => {
    expect(disc).toContain("UPDATE ad_company_leads SET lead_type = ?, classify_confidence = 'registry', classified_v = ? WHERE id = ?")
    expect(disc).toContain('UPDATE ad_company_leads SET category = ?, subcategory = ?, tier = COALESCE(tier, ?), lead_type = ?, classify_confidence = ?, classified_v = ? WHERE id = ?')
    expect(disc).toContain('UPDATE ad_company_leads SET lead_type = ?, classify_confidence = ?, classified_v = ? WHERE id = ?')
  })
})
