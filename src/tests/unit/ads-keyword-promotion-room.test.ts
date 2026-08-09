import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

/**
 * 📈 **키워드 신선도 = 무료 발굴량의 마지막 레버** (2026-08-09 — 대표 "1번(키워드 수율)" 지시).
 *
 *   07-21 발굴 스파이크(12,533/일)의 정체 = 07-20 신규 202개 활성화 **다음날**(첫 회차가 백로그를
 *   수확한다 — 고갈 곡선 실측: 회당 저장 5~14회 14.3 → 30회+ 2.4). 그런데 라이브는 cap 60 이 꽉 차
 *   승격 대기 2,981개(hits≥5)가 밖에서 기다렸다. ⇒ cap 120 + "찾는데 안 남는" auto 수율 은퇴.
 */
describe('키워드 신선도 회전 — cap 상향 + 수율 은퇴', () => {
  const src = () => readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-auto-collect.ts'), 'utf8')

  it('🔒 cap 120 — 되돌리면 신선 키워드 유입이 다시 막힌다(승격 대기 수천 개 고착)', async () => {
    const { MAX_AUTO_KEYWORDS } = await import('@/features/marketing/api/influencer-keyword-rotation')
    expect(MAX_AUTO_KEYWORDS).toBe(120)
  })

  it('⚠️ 이 상향은 네이버 호출량을 안 늘린다 — 회차 폭(6)은 별도 상수이고 그대로다(차단 리스크 레버와 분리)', async () => {
    const { COLLECT_KEYWORDS_PER_ROUND } = await import('@/features/marketing/api/influencer-keyword-rotation')
    expect(COLLECT_KEYWORDS_PER_ROUND).toBe(6) // 이 값을 올리는 건 대표의 네이버 리스크 판단 사항이다
  })

  it('🔒 수율 은퇴가 배선돼 있다 — barren 의 사각지대(found 50+ / saved <10)를 슬롯 차원에서 회수', () => {
    const s = src()
    expect(s).toMatch(/source = 'auto' AND active = 1 AND found_total >= 50 AND saved_total < 10/)
    // 회차당 상한 — 한꺼번에 비우면 승격·첫회차 수확이 몰려 요동한다
    expect(s).toMatch(/ORDER BY saved_total ASC, found_total DESC LIMIT 3/)
  })

  it('🔒 수율 은퇴는 auto 전용 — seed(대표 커버리지 축)를 건드리면 커버리지에 구멍이 난다', () => {
    // 은퇴 UPDATE 3종 전부 source='auto' 가드를 갖는다(seed 를 만지는 은퇴문이 하나라도 생기면 실패).
    const stmts = src().match(/UPDATE ad_discovery_keywords SET active = 0[^)]+/g) || []
    expect(stmts.length).toBeGreaterThanOrEqual(3)
    for (const st of stmts) expect(st, st.slice(0, 80)).toContain("source = 'auto'")
  })
})
