import { describe, it, expect } from 'vitest'
import { pickYtKeywords, ytQuotaDayKey, YT_SEARCH_BUDGET_DEFAULT, type YtPickKeyword } from '@/features/marketing/api/influencer-auto-collect'

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

describe('ytQuotaDayKey — 구글 쿼터 하루(태평양 자정 = 한국 오후 4~5시) 경계', () => {
  it('리셋 직전/직후가 다른 날로 갈림 (7월 = PDT, UTC-7 → 07:00Z 경계)', () => {
    expect(ytQuotaDayKey(Date.parse('2026-07-21T06:59:00Z'))).toBe('2026-07-20')
    expect(ytQuotaDayKey(Date.parse('2026-07-21T07:01:00Z'))).toBe('2026-07-21')
  })
  it('형식 YYYY-MM-DD', () => {
    expect(ytQuotaDayKey(NOW)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

it('기본 예산 = 100 (실측 병목 Search Queries per day)', () => {
  expect(YT_SEARCH_BUDGET_DEFAULT).toBe(100)
})
