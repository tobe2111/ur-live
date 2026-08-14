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
 *
 * ## 🔴 2026-08-14 — 이 파일의 전제 절반이 폐기됐다 (대표 *"최대한 이상적으로 끝까지"*)
 * 위 08-10 수리는 `none` → `IN ('none','keyword')` 로 **범위를 넓힌** 것이었다. 그런데 실측하니
 * 778건 중 **158건이 `evidence` 라는 이유로 여전히 확인 밖**이었다(`골목상권 분포`). 그리고 그
 * 필터의 전제가 애초에 틀렸다 — **`evidence` 는 "이름에 업종어가 있다"는 뜻이지 "진짜 상호다"가 아니다.**
 * ⇒ webkr 은 이름 출처가 **검색결과 제목**이라 신뢰도로 거를 근거가 처음부터 없다. 필터를 통째로
 *   버리고 **전수 1회**(`name_verified`)로 갔다.
 *
 * ⚠️ 그래서 아래 두 테스트를 **의도 기준으로 다시 썼다.** 예전 형태(`IN ('none','keyword')` 문자열
 *   매칭)를 그대로 뒀다면 하나는 빨간불이 되고, *"evidence 는 넣지 않는다"* 는 **필터가 사라져
 *   무조건 통과**한다 — 설계와 정반대인데 초록이 뜨는, 이 레포가 반복해 만난 '낡은 지도'다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { classifyLead } from '@/features/marketing/api/company-classify'

const SRC = readFileSync(resolve('src/features/marketing/api/enrich-name-heal.ts'), 'utf8')

describe('이름 치유 범위', () => {
  /** 08-10 수리의 **의도**(강등된 keyword 행이 빠지면 안 된다)는 그대로다 — 이제 더 강하게 보장된다. */
  it("🔒 keyword(근거 없음)도 치유 대상 — 08-08 규칙이 거기로 내려보낸다", () => {
    expect(SRC, '신뢰도 필터가 부활하면 강등된 행이 다시 빠진다').not.toMatch(/classify_confidence IN/)
  })

  /**
   * 🔴 08-10 의 *"evidence 는 크롤 낭비"* 판단은 **2026-08-14 에 반증됐다** — 실측 158건이
   *   그 이유로 영영 확인 밖이었다. 이제 evidence 도 확인 대상이다(전수 1회).
   */
  it("🔒 evidence 도 확인 대상 — '업종어가 있다'는 '진짜 상호다'가 아니다", () => {
    expect(SRC).toMatch(/AND COALESCE\(name_verified, 0\) = 0/)
    expect(SRC, '전수 1회를 보장하는 도장이 있어야 무한 재크롤이 안 된다').toMatch(/SET name_verified = 1/)
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
