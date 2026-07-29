import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
/**
 * 📝 2026-07-29 — **인바운드 신청 폼**의 세 번째 사본. 서버 검증(`influencer-apply.routes`)과
 *   화면(`CreatorApplyPage`)이 손으로 복제된 같은 배열이라, 한쪽만 고치면 **신청자가 고른 값을
 *   서버가 거부**하거나(400) 반대로 화면에 없는 값이 통과한다. 실제로 둘 다 낡아 있었다 —
 *   서버가 '공동구매' 축을 신설한 뒤에도 신청 폼엔 그 선택지가 없다(아래에서 그 사실을 고정한다).
 *   ⚠️ 이 테스트가 못 보는 것: 목록이 *타당한지*(어떤 축을 신청 폼에 열지)는 정책이라 코드가 모른다.
 */
const APPLY_RE = /const CATEGORIES = \[([^\]]+)\]/
const applyList = (path: string): string[] => {
  const m = APPLY_RE.exec(readFileSync(join(process.cwd(), path), 'utf8'))
  expect(m, `${path} 의 CATEGORIES 리터럴을 못 찾음 — 형태가 바뀌었으면 이 정규식도 함께`).toBeTruthy()
  return [...m![1].matchAll(/'([^']+)'/g)].map(x => x[1]!)
}

describe('인바운드 신청 폼 카테고리 — 서버 검증 ↔ 화면', () => {
  const server = applyList('src/features/marketing/api/influencer-apply.routes.ts')
  const client = applyList('src/pages/CreatorApplyPage.tsx')

  it('🔒 두 사본이 순서까지 동일하다 — 갈리면 신청이 400 으로 막힌다', () => {
    expect(client).toEqual(server)
  })

  it("🔒 '기타'를 뺀 전 항목이 어드민 필터에 있다 — 신청받고 화면에서 못 고르는 축이 없게", () => {
    const missing = server.filter(c => c !== '기타' && !POOL_CATEGORIES.includes(c))
    expect(missing, `신청 폼에만 있고 어드민 필터엔 없는 축: ${missing.join(', ')}`).toEqual([])
  })

  it('📌 신설 축(골프·공동구매)이 신청 폼에도 반영돼 있다', () => {
    // 공동구매: 서버는 그 축으로 분류·수집하고 어드민 필터에도 있는데 **신청자만 못 고르고** 있었다
    //   (2026-07-29 대표 확정으로 개방). 공구 셀러는 이미 자기 팔로워에게 파는 층이라 링크샵 전환 1순위다.
    for (const cat of ['골프', '공동구매']) expect(server, cat).toContain(cat)
  })
})

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
