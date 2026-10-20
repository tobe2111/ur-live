import { describe, it, expect } from 'vitest'
import { pickYtKeywords, ytQuotaDayKey, ytCooldownMs, BARREN_COOLDOWN_MAX_MS, YT_SEARCH_BUDGET_DEFAULT, type YtPickKeyword } from '@/features/marketing/api/influencer-auto-collect'

/**
 * 🎯 2026-07-21 YT 검색 슬롯 성과 가중 선택 + 쿼터 하루 경계 잠금.
 *   실병목 = Search Queries/day 100회 → 희소한 검색을 "잘 무는 키워드 + 신규 탐색"에 배정.
 */
const NOW = Date.parse('2026-07-21T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString().slice(0, 19).replace('T', ' ')
const kw = (id: number, over: Partial<YtPickKeyword> = {}): YtPickKeyword =>
  ({ id, keyword: `kw${id}`, category: null, saved_total: 0, last_saved: 0, last_run_at: hoursAgo(24), ...over })

describe('pickYtKeywords — 성과 가중 + 탐색 보장', () => {
  it('미실행(신규) 키워드 1개는 항상 탐색 슬롯에 포함', () => {
    const kws = [kw(1, { saved_total: 90, last_saved: 30 }), kw(2, { saved_total: 80, last_saved: 20 }), kw(3, { last_run_at: null })]
    const picks = pickYtKeywords(kws, 2, NOW)
    expect(picks.map(k => k.id)).toContain(3)
  })

  it('성과 높은 키워드가 낮은 키워드보다 먼저 뽑힘', () => {
    const kws = [kw(1, { saved_total: 0, last_saved: 0 }), kw(2, { saved_total: 100, last_saved: 40 }), kw(3, { saved_total: 5, last_saved: 1 })]
    const picks = pickYtKeywords(kws, 2, NOW)
    expect(picks.map(k => k.id)).toEqual([2, 3]) // 신규 없음 → 순수 성과순
  })

  it('6시간 쿨다운 — 방금 돈 고성과 키워드는 쉬고 다음 성과자가 뽑힘', () => {
    const kws = [kw(1, { saved_total: 100, last_saved: 50, last_run_at: hoursAgo(1) }), kw(2, { saved_total: 10, last_saved: 2 })]
    const picks = pickYtKeywords(kws, 1, NOW)
    expect(picks[0].id).toBe(2)
  })

  it('우선 카테고리 보너스 — 동급 성과면 우선 카테고리 승', () => {
    const kws = [kw(1, { saved_total: 10, category: '일반' }), kw(2, { saved_total: 10, category: '맛집' })]
    expect(pickYtKeywords(kws, 1, NOW)[0].id).toBe(2)
  })

  it('풀이 작으면 쿨다운 무시 폴백으로 n개 채움 + 중복 없음', () => {
    const kws = [kw(1, { last_run_at: hoursAgo(1) }), kw(2, { last_run_at: hoursAgo(2) })]
    const picks = pickYtKeywords(kws, 4, NOW)
    expect(picks.length).toBe(2)
    expect(new Set(picks.map(k => k.id)).size).toBe(2)
  })

  it('n=0 / 빈 풀 → 빈 배열', () => {
    expect(pickYtKeywords([], 4, NOW)).toEqual([])
    expect(pickYtKeywords([kw(1)], 0, NOW)).toEqual([])
  })
})

/**
 * 🌵 2026-07-29 고갈 키워드 억제 — 라이브 실측 `found 5 → saved 0` 인데 쿼터는 39/90 만 소진.
 *   원인: 누적 성과(`saved_total`)가 큰 옛 성공 키워드가 점수 상위를 지키며 **이미 수확한 채널을 재방문**.
 *   기존 은퇴 조건은 `saved_total = 0` 이라 이 부류를 구조적으로 못 잡는다.
 */
describe('고갈(barren) 키워드 — 누적 성과가 커도 연속 무수확이면 물러난다', () => {
  it('연속 무수확 키워드는 쿨다운이 길어져 같은 시점에 다시 안 뽑힌다', () => {
    // 둘 다 12시간 전 실행. 고갈(streak 3 → 쿨다운 24h)은 아직 못 나오고, 멀쩡한 쪽이 뽑힌다.
    const barren = kw(1, { saved_total: 100, last_saved: 0, barren_streak: 3, last_run_at: hoursAgo(12) })
    const fresh = kw(2, { saved_total: 10, last_saved: 2, last_run_at: hoursAgo(12) })
    const picks = pickYtKeywords([barren, fresh], 1, NOW)
    expect(picks[0].id).toBe(2)
  })

  it('쿨다운은 무한정 늘지 않는다 — 상한(4일) 지나면 다시 기회를 받는다(키워드는 영구히 죽지 않는다)', () => {
    expect(ytCooldownMs({ id: 1, keyword: 'k', category: null, barren_streak: 999 })).toBe(BARREN_COOLDOWN_MAX_MS)
    const veryOld = kw(1, { saved_total: 100, barren_streak: 999, last_run_at: hoursAgo(24 * 5) })
    expect(pickYtKeywords([veryOld], 1, NOW).map(k => k.id)).toEqual([1])
  })

  it('한 명이라도 건지면(streak=0) 즉시 우선순위를 회복한다', () => {
    const recovered = kw(1, { saved_total: 100, last_saved: 5, barren_streak: 0 })
    const other = kw(2, { saved_total: 20, last_saved: 1 })
    expect(pickYtKeywords([recovered, other], 1, NOW)[0].id).toBe(1)
  })

  it('고갈 페널티가 누적 성과 가중을 실제로 이긴다 — 아니면 옛 성공 키워드가 슬롯을 영원히 점유한다', () => {
    const stale = kw(1, { saved_total: 100, last_saved: 0, barren_streak: 5, last_run_at: hoursAgo(24 * 7) })
    const modest = kw(2, { saved_total: 0, last_saved: 0, last_run_at: hoursAgo(24 * 7) })
    expect(pickYtKeywords([stale, modest], 1, NOW)[0].id).toBe(2)
  })
})

describe('ytQuotaDayKey — 구글 쿼터 하루(태평양 자정 = 한국 오후 4~5시) 경계', () => {
  it('리셋 직전/직후가 다른 날로 갈림 (7월 = PDT, UTC-7 → 07:00Z 경계)', () => {
    expect(ytQuotaDayKey(Date.parse('2026-07-21T06:59:00Z'))).toBe('2026-07-20')
    expect(ytQuotaDayKey(Date.parse('2026-07-21T07:01:00Z'))).toBe('2026-07-21')
  })
  it('형식 YYYY-MM-DD', () => {
    expect(ytQuotaDayKey(NOW)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

it('기본 예산 = 90 — 검색 1회=100 units 라 100회면 일일 쿼터(10,000) 전부 소진 → 성과측정이 굶음(2026-07-27 실사고). 90회로 ~1,000 units 측정 예약', () => {
  expect(YT_SEARCH_BUDGET_DEFAULT).toBe(90)
  expect(YT_SEARCH_BUDGET_DEFAULT * 100).toBeLessThan(10_000) // 검색 units 합이 일일 쿼터 미만 = 측정 여력 존재(불변식)
})
