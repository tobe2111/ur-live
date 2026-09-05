/**
 * 🪞 재분류 랩 no-op 쓰기 제거 — `company-discovery.ts` 재판정 블록 계약.
 *
 * ## 배경 (2026-09-04 라이브 실측)
 * 이 랩은 규칙 버전이 오를 때마다 업체 41만 행을 다시 판정한다. 그런데 `verdictChanged` 로
 * "실제로 바뀌었는가"를 **이미 계산해 놓고 통계에만 쓰고** 쓰기는 무조건 했다:
 * ```
 *   ads_reclassify_stats.delta   reg_seen 28,777   reg_changed 40   →  0.14%
 * ```
 * 99.86% 가 아무것도 안 바뀐 재기록이었고, 그 쓰기가 D1 월 포함분을 태웠다.
 *
 * ## 이 시험이 지키는 것 — 양쪽 다
 *   ① 안 바뀐 행에 **판정 컬럼 UPDATE 를 만들지 않는다**(절약)
 *   ② 그래도 **재검사 표시(classified_v)는 반드시 남긴다**(안 남기면 그 행이 영영 "미검사"로
 *      되돌아와 매 회차 다시 읽힌다 — 쓰기를 아끼려다 읽기를 무한히 태우는 반대편 사고)
 *   ③ 바뀐 행은 **종전 3분기 그대로** 쓴다(절약이 판정을 삼키면 안 된다)
 *
 * ⚠️ **이 시험이 못 막는 것**: 실제 D1 이 없어 쓰기량 자체는 재지 못한다. 판정은 배포 후
 *   `urads-company-db` 의 rowsWritten 이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = 'src/features/marketing/api/company-discovery.ts'
const src = readFileSync(SRC, 'utf8')

/** 재판정 루프만 잘라서 본다 — 파일의 다른 UPDATE(1회 마이그레이션 등)에 걸리지 않게. */
function reclassifyBlock(): string {
  const start = src.indexOf('const delta = emptyDelta()')
  expect(start, '재판정 블록의 시작 앵커를 못 찾았다 — 코드가 이동했다').toBeGreaterThan(-1)
  const end = src.indexOf('if (housekeeping)', start)
  expect(end, '재판정 블록의 끝 앵커를 못 찾았다').toBeGreaterThan(start)
  return src.slice(start, end)
}

describe('재분류 — 판정이 안 바뀌면 판정 컬럼을 안 쓴다', () => {
  it('① 변화 여부를 쓰기 *전에* 계산해 분기한다 (통계 전용이면 절약이 0이다)', () => {
    const b = reclassifyBlock()
    expect(b).toMatch(/const changed = verdictChanged\(/)
    // 분기의 첫 갈래가 '안 바뀜' 이어야 한다 — 뒤에 붙이면 위 UPDATE 들이 먼저 잡힌다.
    expect(b).toMatch(/if \(!changed\) \{/)
  })

  it('② 안 바뀐 행은 stampOnly 로 모으고, 판정 컬럼 UPDATE 를 만들지 않는다', () => {
    const b = reclassifyBlock()
    const noopArm = b.slice(b.indexOf('if (!changed) {'), b.indexOf('} else if (registry)'))
    expect(noopArm).toContain('stampOnly.push(r.id)')
    expect(noopArm, '안 바뀐 갈래에서 판정 컬럼을 쓰면 절약이 사라진다')
      .not.toMatch(/SET category|classify_confidence = \?|lead_type = \?/)
  })

  it('③ 도장은 반드시 찍는다 — stampOnly 가 실제 UPDATE 로 나간다', () => {
    const b = reclassifyBlock()
    expect(b, 'stampOnly 를 모으기만 하고 안 쓰면 그 행들이 영영 미검사로 남는다')
      .toMatch(/UPDATE ad_company_leads SET classified_v = \? WHERE id IN/)
  })

  it('④ 도장은 한 문장으로 묶는다 — 행당 UPDATE 면 아끼려던 쓰기가 그대로 돌아온다', () => {
    const b = reclassifyBlock()
    const stampSql = b.match(/UPDATE ad_company_leads SET classified_v = \? WHERE id IN \([^)]*\)/)?.[0] || ''
    expect(stampSql).toContain('ids.map')          // IN (...) 다중 바인딩
    expect(stampSql).not.toMatch(/WHERE id = \?/)  // 단건이면 묶음이 아니다
  })

  it('⑤ 이미 현재 규칙 버전이면 도장조차 안 찍는다', () => {
    const b = reclassifyBlock()
    expect(b).toMatch(/if \(r\.classified_v !== CLASSIFY_RULES_VERSION\) stampOnly\.push/)
  })

  it('⑥ 바뀐 행의 세 분기는 종전 그대로 남아 있다 (절약이 판정을 삼키면 안 된다)', () => {
    const b = reclassifyBlock()
    expect(b).toMatch(/classify_confidence = 'registry', classified_v = \?/)            // registry
    expect(b).toMatch(/SET category = \?, subcategory = \?, tier = COALESCE\(tier, \?\)/) // evidence
    expect(b).toMatch(/SET lead_type = \?, classify_confidence = \?, classified_v = \?/)  // 그 외
  })

  it('⑦ 통계는 같은 boolean 을 쓴다 — 계측과 동작이 갈리면 판정 근거를 잃는다', () => {
    const b = reclassifyBlock()
    expect(b).toMatch(/tallyVerdict\(delta, r\.source, r\.classified_v, changed\)/)
  })
})
