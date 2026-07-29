import { describe, it, expect } from 'vitest'
import { PRIORITY_CATEGORIES } from '@/features/marketing/api/influencer-keyword-rotation'
import { CLASSIFIED_CATEGORIES } from '@/features/marketing/api/influencer-classify'
import { SEED, REGION_SEED, BANGBAE_SEED } from '@/features/marketing/api/influencer-seed-keywords'
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

  /**
   * 🔒 2026-07-29 — ②가 **우선 카테고리만** 봐서 놓친 자리를 막는다.
   *   실측: 분류기가 만드는 '카페' 가 필터 목록에 없어 **4,675명(풀의 12%)이 화면에서 통째로 안 보였다**.
   *   우선축이 아니라는 이유로 가드를 통과했다 — "가장 조용한 실패"가 가드 사각지대에서 그대로 재현된 것이다.
   *   ⇒ 검사 범위를 **분류기가 만들 수 있는 전 축**으로 넓힌다(규칙을 늘리면 화면이 따라오도록).
   */
  it('🔒 ④ 분류기가 만드는 모든 카테고리가 목록 필터에 있다', () => {
    const missing = CLASSIFIED_CATEGORIES.filter(c => !POOL_CATEGORIES.includes(c))
    expect(missing, `분류기는 만드는데 화면 필터에 없다 → 그 축으로 수집된 사람이 안 보인다: ${missing.join(', ')}`)
      .toEqual([])
  })

  /**
   * 🔒 시드 카테고리도 같은 계약 — 시드로 *찾아 놓고* 화면에서 못 고르면 같은 반쪽 상태다.
   *   (시드 파일 헤더가 경고하는 "분류 규칙이 없으면 영영 키워드 상속" 과 짝을 이루는 검사.)
   */
  it('🔒 ⑤ 시드 카테고리도 전부 목록 필터에 있다', () => {
    const seedCats = Array.from(new Set([...SEED, ...REGION_SEED, ...BANGBAE_SEED].map(g => g.category)))
    const missing = seedCats.filter(c => !POOL_CATEGORIES.includes(c))
    expect(missing, `시드로 수집하는데 화면 필터에 없다: ${missing.join(', ')}`).toEqual([])
  })
})
