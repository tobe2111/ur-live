import { describe, it, expect } from 'vitest'
import { classifyCategory, canAutoPromote, AUTO_PROMOTE_CATEGORIES, CLASSIFIED_CATEGORIES } from '@/features/marketing/api/influencer-classify'
import { promoCategory } from '@/features/marketing/api/influencer-keyword-promote'
import { PRIORITY_CATEGORIES, FOCUS_CATEGORIES } from '@/features/marketing/api/influencer-keyword-rotation'
import { SEED } from '@/features/marketing/api/influencer-seed-keywords'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CLS = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-classify.ts'), 'utf8')

/**
 * 🎁 **체험단 축** (2026-08-17 대표 지시 — "체험단 키워드로도 인플루언서 db 수집 필요해").
 *
 *   ## 이 테스트가 지키는 것 = 대표 요청이 실제로 작동하는가
 *   요청 전 라이브 상태: 체험단 후보가 `category='자동'` 으로 떨어져 **승격 게이트에서 영구 차단**이었다.
 *   `hits` 가 아무리 쌓여도(체험단 78 · 블로그체험단 40 · 협찬플러스 21 · 제품협찬 12) 절대 안 들어간다.
 *   키워드 정원을 늘려도 소용없다 — **게이트가 정원보다 먼저 막는다.**
 *   ⇒ 그래서 이 파일의 핵심 검사는 "분류된다"가 아니라 **"게이트를 통과한다"** 다.
 */
describe('체험단 축 — 참여자를 실제로 수집하는가', () => {
  /** 라이브에서 차단돼 대기 중이던 실제 후보들(hits 포함). 이들이 통과해야 요청이 이행된다. */
  const BLOCKED_LIVE_CANDIDATES = [
    '체험단', '블로그체험단', '맛집체험단', '방문형체험단', '구매평체험단',
    '인스타체험단', '리뷰체험단', '체험단추천', '강남맛집체험단',
    '협찬', '협찬플러스', '협찬깡', '협찬관리', '제품협찬', '리뷰어스',
  ]

  it('🚪 라이브에서 막혀 있던 후보가 전부 승격 게이트를 통과한다', () => {
    const blocked = BLOCKED_LIVE_CANDIDATES.filter(t => !canAutoPromote(promoCategory(t)))
    expect(blocked, `여전히 차단되는 후보: ${blocked.join(', ')}`).toEqual([])
  })

  it('🏷️ 체험단 카테고리가 등록되고 승격 허용목록에 있다', () => {
    expect(CLASSIFIED_CATEGORIES).toContain('체험단')
    expect(AUTO_PROMOTE_CATEGORIES.has('체험단')).toBe(true)
  })

  /**
   * ⚠️ **운영하는 쪽과 참여하는 쪽은 다른 부류다.** `체험단 모집|대행|운영` 은 대행사(집중 축 —
   *   리드 1건이 매장 N건으로 곱해지는 유일한 부류)이고, 그 판정이 더 구체적이며 이미 검증됐다.
   *   🔎 **중복 방어다 — 그리고 그걸 아는 것이 중요하다**(되돌려-검증으로 두 번 정정한 사실):
   *     · 룰이 대행사 **뒤**에 있어서 `체험단 모집` 은 대행사 룰을 먼저 만난다
   *     · 동시에 정규식의 negative lookahead 도 `모집|대행|운영` 을 거른다
   *     둘 중 **하나만 지워도 동작은 그대로**다(그래서 한쪽만 없애는 주입은 빨강이 안 된다).
   *     ⇒ 그러므로 아래에서 **두 방어의 존재를 각각 명시로 고정**한다. 안 그러면 "테스트가 통과하니
   *        안전하다"고 믿으며 둘을 차례로 지울 수 있고, 두 번째를 지우는 순간 집중 축이 조용히 빈다.
   */
  it('🎯 모집·대행·운영은 여전히 마케팅대행사(집중 축) — 순서가 뒤집히면 안 된다', () => {
    for (const t of ['체험단 모집', '체험단 대행', '체험단 운영', '체험단모집']) {
      expect(classifyCategory(t), t).toBe('마케팅대행사')
    }
    expect(FOCUS_CATEGORIES).toContain('마케팅대행사')
    expect(FOCUS_CATEGORIES, '체험단을 집중 축에 넣으면 대행사 전용 슬롯을 잠식한다').not.toContain('체험단')
  })

  /**
   * 🛡️ **중복 방어를 각각 고정** — 위 판정만으로는 한쪽을 지워도 통과한다(다른 쪽이 막으므로).
   *   두 방어가 *존재한다*는 사실 자체를 검사해, 하나씩 지워 나가는 경로를 막는다.
   */
  it('🛡️ 대행사 보호가 두 겹으로 남아 있다 — lookahead + 룰 순서', () => {
    // ① 정규식의 negative lookahead
    expect(CLS, 'lookahead 가 사라지면 순서만 남는다(순서가 바뀌면 즉시 사고)')
      .toMatch(/cat: '체험단', re: \/체험단\(\?!\\s\*\(모집\|대행\|운영\)\)/)
    // ② 룰 순서 — 체험단은 마케팅대행사보다 뒤
    const iAgency = CLS.indexOf("cat: '마케팅대행사'")
    const iExp = CLS.indexOf("cat: '체험단'")
    expect(iAgency).toBeGreaterThan(0)
    expect(iExp, '체험단 룰이 대행사보다 앞이면 순서 방어가 사라진다').toBeGreaterThan(iAgency)
  })

  it('🎁 참여자 표현은 체험단으로 분류된다', () => {
    for (const t of ['체험단 후기', '체험단 신청', '협찬 후기', '제품 협찬', '서포터즈 후기', '리뷰어 모집']) {
      expect(classifyCategory(t), t).toBe('체험단')
    }
  })

  /**
   * ⚠️ **인접 축을 훔치지 않는다** — 룰 순서 실측(뷰티 45 · 운동 53 · 체험단 115 · 맛집 118).
   *   이 셋이 바뀌면 이미 검증된 축의 수율이 조용히 바뀐다.
   */
  it('🚧 인접 축 침범 없음 — 뷰티·운동은 그대로, 맛집체험단만 체험단', () => {
    expect(classifyCategory('뷰티 체험단'), '뷰티 룰이 더 앞').toBe('뷰티')
    expect(classifyCategory('헬스장 무료체험'), '운동 룰이 더 앞').toBe('운동')
    expect(classifyCategory('맛집체험단'), '행위 신호가 주제보다 값지다').toBe('체험단')
    // 맨 '무료 체험' 은 넣지 않았다 — 학원·강좌 무료체험을 끌고 오는 순수 오탐이다.
    expect(classifyCategory('영어학원 무료 체험')).not.toBe('체험단')
  })

  it('🌱 참여자 시드가 등록돼 있다 — 해시태그 승격을 기다리지 않고 즉시 수집한다', () => {
    const g = SEED.find(x => x.category === '체험단')
    expect(g, '체험단 시드 그룹이 없으면 승격될 때까지 수집이 시작되지 않는다').toBeTruthy()
    expect(g!.keywords.length).toBeGreaterThanOrEqual(15)
    for (const kw of ['체험단 후기', '협찬 후기', '블로그 체험단']) expect(g!.keywords).toContain(kw)
    // ⚠️ 대행사 시드와 겹치면 같은 검색어를 두 축이 나눠 갖는다(중복 회차 낭비).
    const agency = SEED.find(x => x.category === '마케팅대행사')!
    expect(g!.keywords.filter(k => agency.keywords.includes(k)), '대행사 시드와 중복').toEqual([])
  })

  /**
   * 실측 근거(2026-08-17): 이미 활성인 체험단 계열 3개의 이메일 수율이 21.5% / 33.1% / 11.8% 로
   * 우선 축 평균(24.4%)과 동급 이상이었다. 그래서 우선 축에 넣는다.
   * ⚠️ 되돌리려면 `PRIORITY_CATEGORIES` 에서 '체험단' 한 항목만 빼면 된다(축 간 영향 0 — 몫 비례 설계).
   */
  it('⭐ 우선 축에 편입 — 이미 협업을 받아 본 층이라 전환 장벽이 낮다', () => {
    expect(PRIORITY_CATEGORIES).toContain('체험단')
    expect(PRIORITY_CATEGORIES).toContain('공동구매') // 같은 논리로 먼저 들어간 축(회귀 방지)
  })
})
