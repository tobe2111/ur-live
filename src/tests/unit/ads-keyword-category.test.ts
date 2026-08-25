import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ASSIGNABLE_KEYWORD_CATEGORIES, isAssignableKeywordCategory, planKeywordPatch,
} from '@/features/marketing/api/influencer-keyword-category'
import { FOCUS_CATEGORIES, PRIORITY_CATEGORIES } from '@/features/marketing/api/influencer-keyword-rotation'

const ROUTES = readFileSync(join(process.cwd(), 'src/features/marketing/api/admin-ads-influencers.routes.ts'), 'utf8')

/**
 * 🎯 **키워드 축 지정** (2026-08-24 대표 *"당근 인플루언서 키워드도 좀 중요하겠어"* → 확인 후 승인).
 *
 * ## 이 파일이 지키는 것
 * 해시태그 자동확장 키워드는 전부 `category = '자동'` 이고, 축 배분(3:2:1)은 category 로 갈린다.
 * ⇒ 어드민이 축을 못 주면 **켜도 가장 느린 일반 축**이다. 대표가 "이게 중요하다"고 판단해도
 * 그 판단이 코드에 도달하지 못한다 — 켜지긴 하니 화면상 성공으로 보이는 조용한 반쪽 반영.
 *
 * ⚠️ 이 테스트가 **못** 하는 것: 실제 회전이 빨라지는지는 라이브 `last_run_at` 으로만 보인다.
 *   여기서는 "축을 받을 수 있고 · 오타는 거부되고 · 라우트가 그걸 실제로 쓴다"까지만 고정한다.
 */
describe('키워드 축 지정 — 화이트리스트', () => {
  it('집중·우선 축은 SSOT 에서 가져온다 — 목록이 두 벌이면 축을 늘려도 지정이 안 된다', () => {
    for (const c of [...FOCUS_CATEGORIES, ...PRIORITY_CATEGORIES]) {
      expect(ASSIGNABLE_KEYWORD_CATEGORIES, `${c} 를 지정할 수 없다`).toContain(c)
    }
  })

  it('되돌릴 수 있다 — `자동` 도 지정 가능', () => {
    expect(isAssignableKeywordCategory('자동')).toBe(true)
  })

  /**
   * 오타는 **에러가 아니라 존재하지 않는 축**이 된다(조용히 일반 축으로 떨어짐) — 그래서 거부한다.
   *
   * ⚠️ **두 층을 구분할 것**(2026-08-24 라이브에서 내가 착각한 자리):
   *   · `isAssignableKeywordCategory` 는 **받은 문자열 그대로** 본다 → `'마케팅대행사 '` 는 false.
   *   · `planKeywordPatch`(=라우트가 쓰는 것)는 **`trim()` 후** 검증한다 → 앞뒤 공백은 **통과**한다.
   * 앞뒤 공백은 사람의 입력 실수라 고쳐 주는 게 맞다. 진짜로 막아야 하는 건 `'마케팅 대행사'` 처럼
   * **다른 문자열**이다. 라이브 실측: 뒤 공백 → `{"success":true}` · 중간 공백 → 400 `알 수 없는 축`.
   */
  it('모르는 값은 거부 — 400 사유를 돌려준다 (앞뒤 공백은 trim 으로 구제)', () => {
    expect(isAssignableKeywordCategory('마케팅대행사 '), '검증 함수는 원문 그대로 본다').toBe(false)
    expect(isAssignableKeywordCategory('없는축')).toBe(false)
    for (const bad of ['없는축', '마케팅 대행사', '마케팅대행']) {
      const r = planKeywordPatch({ active: true, category: bad })
      expect('error' in r, `${bad} 가 통과했다`).toBe(true)
      expect((r as { error: string }).error).toContain(bad)
    }
    // 앞뒤 공백은 **통과가 정답**이다 — 라우트 계약을 여기 고정해 둔다(문서와 코드가 갈리지 않게).
    expect(planKeywordPatch({ active: true, category: ' 마케팅대행사 ' })).toEqual({ active: 1, category: '마케팅대행사' })
  })

  /** 은퇴 축은 `runAutoCollect` 가 선택에서 빼므로 지정해 봐야 **켜도 안 돈다**. */
  it('은퇴 축은 지정 불가 — 목록이 비어 있어도 검사가 헛돌지 않게 주입해서 확인', () => {
    const anyAssignable = ASSIGNABLE_KEYWORD_CATEGORIES[0]!
    expect(isAssignableKeywordCategory(anyAssignable, new Set())).toBe(true)
    expect(isAssignableKeywordCategory(anyAssignable, new Set([anyAssignable]))).toBe(false)
  })
})

describe('PATCH 본문 → UPDATE 인자', () => {
  it('축 미지정은 null — 기존값을 지우지 않는다', () => {
    expect(planKeywordPatch({ active: true })).toEqual({ active: 1, category: null })
    expect(planKeywordPatch({ active: true, category: '   ' })).toEqual({ active: 1, category: null })
  })

  it('축 지정은 그대로 · active 는 0/1 로 정규화', () => {
    expect(planKeywordPatch({ active: true, category: '마케팅대행사' })).toEqual({ active: 1, category: '마케팅대행사' })
    expect(planKeywordPatch({ active: false, category: '맛집' })).toEqual({ active: 0, category: '맛집' })
  })

  it('🔌 라우트가 실제로 쓴다 — 검증만 하고 안 쓰면 축이 영영 안 바뀐다', () => {
    expect(ROUTES, 'PATCH 가 planKeywordPatch 를 안 부른다').toMatch(/planKeywordPatch\(await c\.req\.json\(\)/)
    expect(ROUTES, 'UPDATE 에 category 가 없다 — 검증을 통과해도 저장이 안 된다')
      .toMatch(/UPDATE ad_discovery_keywords SET active = \?, category = COALESCE\(\?, category\)/)
    expect(ROUTES, '거부 사유를 400 으로 돌려주지 않는다').toMatch(/'error' in p \? p\.error/)
  })
})
