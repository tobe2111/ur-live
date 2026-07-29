import { describe, it, expect } from 'vitest'
import { PRIORITY_CATEGORIES } from '@/features/marketing/api/influencer-keyword-rotation'
import { POOL_CATEGORIES } from '@/pages/admin/AdminInfluencerPoolPage'
import { PRIORITY_CATS } from '@/pages/admin/influencer-pool/KeywordManager'

/**
 * 🏷️ 2026-07-29 — 서버가 분류하는 카테고리 축과 어드민 화면 목록이 **갈리지 않게** 묶는다.
 *
 *   실사고: 서버에 '공동구매' 축을 신설(시드 40개 + 분류 규칙 + 우선풀 편입)했는데,
 *   어드민의 두 목록은 **손으로 복제된 사본**이라 그대로였다.
 *     ① `POOL_CATEGORIES`(목록 필터) — 공동구매로 수집된 사람을 **화면에서 고를 수 없다**
 *        (수집은 되는데 안 보이는 반쪽 상태 — 가장 조용한 실패다).
 *     ② `PRIORITY_CATS`(키워드 우선 태깅) — 서버 `PRIORITY_CATEGORIES` 의 두 번째 벌.
 *   서버 모듈 주석은 이미 *"두 벌로 두면 조용히 갈라진다"* 고 경고하고 있었는데 UI 가 정확히 그 두 번째 벌이었다.
 *
 *   ②는 이제 서버 SSOT 를 **재수출**하므로 구조적으로 못 갈라진다(아래는 그 재수출이 유지되는지 확인).
 *   ①은 표시 순서/부가 항목('자동') 때문에 별도 목록이 불가피하므로, **포함 관계**로 강제한다.
 */
describe('카테고리 축 — 서버 SSOT ↔ 어드민 화면', () => {
  it('① 우선 카테고리는 서버 SSOT 를 그대로 쓴다(사본 금지)', () => {
    expect(PRIORITY_CATS).toBe(PRIORITY_CATEGORIES) // 재수출이면 참조 동일 — 복제하면 깨진다
  })

  it('② 목록 필터에 우선 카테고리가 하나도 빠지지 않는다', () => {
    for (const cat of PRIORITY_CATEGORIES) {
      expect(POOL_CATEGORIES, `'${cat}' 이 어드민 필터에 없다 — 그 축으로 수집된 사람을 화면에서 못 고른다`)
        .toContain(cat)
    }
  })

  it('③ 신설 축(공동구매)이 양쪽에 반영돼 있다', () => {
    expect(PRIORITY_CATEGORIES).toContain('공동구매')
    expect(POOL_CATEGORIES).toContain('공동구매')
  })
})
