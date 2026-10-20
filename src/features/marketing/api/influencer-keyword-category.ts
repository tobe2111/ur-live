/**
 * 🎯 **키워드의 축(category) 지정** — 어드민이 "이 키워드는 중요하다"를 시스템에 전달하는 유일한 통로.
 *
 * ## 왜 필요한가 (2026-08-24 라이브 실측 — 대표 *"당근 인플루언서 키워드도 좀 중요하겠어"*)
 * 해시태그 자동확장이 만든 키워드는 전부 `category = '자동'` 이다. 그런데 축 배분
 * (`AXIS_ROTATION_MULTIPLIER` 3:2:1)은 category 로 갈리므로, **'자동' 은 언제나 가장 느린 일반 축**이다.
 * 어드민 PATCH 는 `active` 만 받았다 ⇒ 대표가 특정 키워드를 중요하다고 판단해도
 * **그 판단을 넣을 자리가 코드에 없었다.** 켜지긴 하는데 제일 늦게 도는, 조용한 반쪽 반영.
 *
 * 실측 배경: 활성 658 중 '자동' 은 15개뿐이고 비활성 후보가 12,981개 쌓여 있다(승격은 `hits` 순이라
 * `hits: 1` 짜리는 순번이 영영 안 온다). 즉 **사람이 직접 지목하는 경로가 실질적인 유일한 입구**다.
 *
 * ## ⚠️ 왜 자유 문자열을 안 받나
 * 오타(`'마케팅대행사 '`·`'맛집 '`)는 **에러가 아니라 존재하지 않는 축**이 된다 → 그 키워드는 조용히
 * 일반 축으로 떨어지고, 화면엔 지정한 대로 찍힌다. 이 레포가 반복해 만난 "조용한 부재" 그대로다.
 * 그래서 화이트리스트로 받고, 모르는 값은 **400 으로 되돌려 준다**(사람이 그 자리에서 알게).
 */
import { FOCUS_CATEGORIES, PRIORITY_CATEGORIES } from './influencer-keyword-rotation'
import { RETIRED_CATEGORIES } from './influencer-classify'

/**
 * 지정 가능한 축. **집중·우선은 SSOT 에서 가져온다** — 목록을 두 벌로 두면 축을 늘렸을 때
 * 한쪽만 늘어나 "왜 그 축으로 지정이 안 되지?" 가 된다.
 * 뒤쪽은 라이브에 실재하는 나머지 축(2026-08-24 실측). `'자동'` 도 포함 — **되돌릴 수 있어야** 하기 때문이다.
 */
export const ASSIGNABLE_KEYWORD_CATEGORIES: readonly string[] = [
  ...FOCUS_CATEGORIES, ...PRIORITY_CATEGORIES,
  '여행', '운동', '반려동물', '패션', '육아', '골프', '리빙', 'IT/재테크', '취미', '자동',
]

/** 은퇴 축은 지정 대상이 아니다 — 지정해 봐야 `runAutoCollect` 가 선택에서 빼므로 **켜도 안 돈다**. */
export function isAssignableKeywordCategory(v: string, retired: ReadonlySet<string> = RETIRED_CATEGORIES): boolean {
  return ASSIGNABLE_KEYWORD_CATEGORIES.includes(v) && !retired.has(v)
}

export interface KeywordPatchPlan { active: 0 | 1; category: string | null }

/**
 * 어드민 PATCH 본문 → UPDATE 인자(순수). `category` 는 **준 경우에만** 바꾼다(`null` = 기존값 유지).
 * 공백만 준 경우도 미지정으로 본다 — 빈 문자열로 축을 지우면 그 키워드가 어느 축에도 안 속한다.
 */
export function planKeywordPatch(body: Record<string, unknown>): KeywordPatchPlan | { error: string } {
  const raw = typeof body.category === 'string' ? body.category.trim() : ''
  if (raw && !isAssignableKeywordCategory(raw)) {
    return { error: `알 수 없는 축: ${raw} (가능: ${ASSIGNABLE_KEYWORD_CATEGORIES.join(', ')})` }
  }
  return { active: body.active ? 1 : 0, category: raw || null }
}
