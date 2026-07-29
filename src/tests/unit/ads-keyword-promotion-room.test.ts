import { describe, it, expect } from 'vitest'
import { autoPromotionRoom } from '@/features/marketing/api/influencer-auto-collect'

/**
 * 🌱 2026-07-29 신규 키워드 승격 자리의 불변식 잠금.
 *
 *   실사고: 자리를 `MAX_ACTIVE_KEYWORDS(200) - 활성전체` 로 셌는데 시드만으로 상한에 닿았다
 *   (라이브 실측 **활성 210 = seed 190 + auto 20**) → `room = 0` 고착 → 신규 키워드가 **영원히**
 *   승격 못 함(`promoted: []`). 수집은 매시간 정상으로 돌면서 고갈된 키워드만 반복 →
 *   `found 332 → saved 3`(99% 중복). "도는데 안 크는" 가장 조용한 실패였다.
 *
 *   여기서 고정하는 것:
 *     ① 자리는 **시드 수와 무관**하다 — 시드가 몇 개든 발굴 쿼터는 남는다(교착 재발 차단).
 *     ② 쿼터를 넘겨 승격하지 않는다 — auto 가 무한 증식하면 검색 예산을 잠식한다.
 *     ③ 음수/NaN 입력에서도 0 이상 유한값(학습 상한이 바닥이거나 카운트 조회가 실패해도 안전).
 */
describe('autoPromotionRoom — 신규 키워드 승격 자리', () => {
  it('① 시드가 아무리 많아도 발굴 자리는 남는다(과거 교착의 직접 재현)', () => {
    // 과거 계산이라면 seed 190 + auto 20 = 210 → room 0. 새 계산은 auto 수만 본다.
    expect(autoPromotionRoom(20, 60)).toBe(40)
    expect(autoPromotionRoom(20, 60)).toBeGreaterThan(0)
  })

  it('② 쿼터를 넘겨 승격하지 않는다(검색 예산 잠식 방지)', () => {
    expect(autoPromotionRoom(60, 60)).toBe(0)
    expect(autoPromotionRoom(120, 60)).toBe(0) // 이미 초과해도 음수 아님
  })

  it('③ 비정상 입력에서도 0 이상 유한값', () => {
    for (const [a, c] of [[Number.NaN, 60], [-5, 60], [10, Number.NaN], [10, -1]] as [number, number][]) {
      const v = autoPromotionRoom(a, c)
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
    }
  })

  it('④ 회수된 자리는 즉시 재사용된다(불모 auto 은퇴 → 다음 승격)', () => {
    const before = autoPromotionRoom(60, 60) // 꽉 참
    const after = autoPromotionRoom(52, 60)  // barren 8개 은퇴 후
    expect(before).toBe(0)
    expect(after).toBe(8)
  })
})
