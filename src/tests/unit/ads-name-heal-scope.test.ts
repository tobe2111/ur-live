/**
 * 🏷️ 이름 치유 대상 범위 — **내가 만든 이음매를 내가 막는다** (2026-08-10).
 *
 * ## 무엇이 있었나
 * 08-08 에 "webkr 의 `description`(=페이지 본문)은 업종 근거가 아니다" 규칙을 넣었다. 그 결과
 * 본문에서만 맞던 행들이 `evidence` → **`keyword`** 로 내려갔다. 그런데 이름 치유 쿼리는
 * `classify_confidence = 'none'` 만 봤다 → **방금 강등시킨 그 행들이 영영 치유 대상이 아니었다.**
 *
 * 그게 대표가 신고한 진흥원(`jepa.kr`) 유형이 계속 남는 이유다:
 * ```
 *   도메인   jepa.kr        ← 평범한 .kr — or.kr 규칙이 못 잡는다
 *   저장이름 "[광주"         ← 기관 어휘(진흥원)가 없다
 *   og:site_name "전라남도중소기업일자리경제진흥원"   ← 여기엔 있다
 * ```
 * ⇒ 실명을 얻으면 기존 `classifyLead` 가 `ORG_WORD_STRICT`(진흥원)로 잡는다. **새 규칙이 필요한 게
 * 아니라 그 경로에 도달하게만 하면 됐다.**
 *
 * ⚠️ 이 테스트가 못 막는 것: og:site_name 이 없거나 사이트가 자기 이름을 기관 어휘 없이 적은 경우.
 *   그건 신호 자체가 없어서, 이 층에서는 판정할 방법이 없다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { classifyLead } from '@/features/marketing/api/company-classify'

const SRC = readFileSync(resolve('src/features/marketing/api/enrich-name-heal.ts'), 'utf8')

describe('이름 치유 범위', () => {
  it("🔒 keyword(근거 없음)도 치유 대상 — 08-08 규칙이 거기로 내려보낸다", () => {
    expect(SRC).toMatch(/classify_confidence IN \('none', 'keyword'\)/)
  })

  it("🔒 evidence 는 넣지 않는다 (이미 실명이라 크롤 낭비)", () => {
    expect(SRC).not.toMatch(/classify_confidence IN \([^)]*'evidence'/)
  })

  it('🔒 실명을 얻으면 기존 경로가 기관으로 내려보낸다 (새 규칙 불필요)', () => {
    // 치유 전: 이름에 기관 어휘가 없어 기관으로 안 잡힌다.
    const before = classifyLead({ company_name: '[광주', source: 'local', description: '온라인 마케팅' })
    expect(before.lead_type).not.toBe('org')
    // 치유 후: 사이트가 선언한 실명이면 잡힌다.
    const after = classifyLead({ company_name: '전라남도중소기업일자리경제진흥원', source: 'webkr', description: '온라인 마케팅 지원' })
    expect(after.lead_type).toBe('org')
  })

  it('치유는 사이트가 스스로 선언한 이름만 채택한다 (허위 0)', () => {
    expect(SRC).toMatch(/c\.siteName && c\.siteName !== t\.company_name/)
  })
})
