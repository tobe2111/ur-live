/**
 * 📊 2026-06-12: 네이버 데이터랩 수요 신호 — 순수 분석 함수 단위 테스트.
 */
import { describe, it, expect } from 'vitest'
import { analyzeTrend, analyzeSeasonality, fetchDemandSignal, WHOLESALE_TO_NAVER_CATEGORY } from '../../worker/utils/naver-datalab'
import { seasonLabel } from '../../pages/supplier-dashboard/DemandSignal'

const pt = (period: string, ratio: number) => ({ period, ratio })

describe('analyzeTrend', () => {
  it('최근 2개월 평균이 이전 대비 +10% 이상 → up', () => {
    const r = analyzeTrend([pt('2026-01', 50), pt('2026-02', 50), pt('2026-03', 50), pt('2026-04', 50), pt('2026-05', 70), pt('2026-06', 70)])
    expect(r.trend).toBe('up')
    expect(r.changePct).toBe(40)
  })
  it('-10% 이하 → down', () => {
    const r = analyzeTrend([pt('2026-01', 80), pt('2026-02', 80), pt('2026-03', 80), pt('2026-04', 80), pt('2026-05', 40), pt('2026-06', 40)])
    expect(r.trend).toBe('down')
  })
  it('±10% 미만 → flat', () => {
    const r = analyzeTrend([pt('2026-01', 50), pt('2026-02', 50), pt('2026-03', 50), pt('2026-04', 52)])
    expect(r.trend).toBe('flat')
  })
  it('데이터 4개 미만 → flat (판정 불가)', () => {
    expect(analyzeTrend([pt('2026-05', 10), pt('2026-06', 90)]).trend).toBe('flat')
  })
})

describe('analyzeSeasonality', () => {
  // 24개월 — 6·7·8월만 높은 여름 시즌 상품 (예: 선풍기).
  const summer = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(2024, 5 + i, 1)
    const m = d.getMonth() + 1
    const period = `${d.getFullYear()}-${String(m).padStart(2, '0')}-01`
    return pt(period, [6, 7, 8].includes(m) ? 90 : 20)
  })

  it('여름 피크 상품 → peakMonths [6,7,8], isSeasonal true', () => {
    const r = analyzeSeasonality(summer)
    expect(r.peakMonths).toEqual([6, 7, 8])
    expect(r.isSeasonal).toBe(true)
  })
  it('연중 고른 상품 → isSeasonal false', () => {
    const flat = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(2024, 5 + i, 1)
      return pt(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, 50)
    })
    expect(analyzeSeasonality(flat).isSeasonal).toBe(false)
  })
  it('12개월 미만 데이터 → 판정 안 함', () => {
    expect(analyzeSeasonality(summer.slice(0, 6)).isSeasonal).toBe(false)
  })
})

describe('seasonLabel', () => {
  it('지금이 성수기 달이면 🔥', () => {
    expect(seasonLabel([6, 7, 8], 7)).toContain('지금이 성수기')
  })
  it('성수기 1~2개월 전이면 준비 적기 안내', () => {
    expect(seasonLabel([6, 7, 8], 4)).toContain('2개월 뒤')
  })
  it('성수기가 멀면 월 표기만', () => {
    expect(seasonLabel([6, 7, 8], 11)).toBe('성수기: 6월·7월·8월')
  })
})

describe('fetchDemandSignal — 가드 (네트워크 미호출 경로)', () => {
  it('키 미설정 → configured:false', async () => {
    const r = await fetchDemandSignal(undefined, undefined, '선풍기', 'living')
    expect(r.configured).toBe(false)
  })
  it('검색어 2자 미만 → null 신호 (호출 안 함)', async () => {
    const r = await fetchDemandSignal('id', 'secret', '가', 'food')
    expect(r.configured).toBe(true)
    expect(r.shopping).toBeNull()
    expect(r.season).toBeNull()
  })
  it('도매 카테고리 6종 전부 네이버 카테고리 매핑 존재', () => {
    for (const key of ['food', 'beauty', 'living', 'fashion', 'digital', 'lifestyle']) {
      expect(WHOLESALE_TO_NAVER_CATEGORY[key]?.catId).toMatch(/^\d{8}$/)
    }
  })
})
