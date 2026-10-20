import { describe, it, expect } from 'vitest'
import { scoreOpportunities, normKw } from '@/features/marketing/api/keyword-opportunities'
import type { RelatedKeyword } from '@/features/marketing/api/searchad-client'

/**
 * 🆕 2026-07-01 유어애즈 키워드 기회 발굴 — 순수 스코어러 잠금.
 *   점수식(검색량×경쟁가중치)·보유 제외(공백무시)·검색량 하한·중복 제거.
 */
const kw = (keyword: string, monthlyTotal: number, compIdx: string): RelatedKeyword =>
  ({ keyword, monthlyPc: 0, monthlyMobile: 0, monthlyTotal, compIdx, monthlyAvgClick: 10, plAvgDepth: 5 })

describe('normKw', () => {
  it('공백 제거 + 소문자', () => {
    expect(normKw('무선 이어폰')).toBe('무선이어폰')
    expect(normKw('  AirPods Pro ')).toBe('airpodspro')
  })
})

describe('scoreOpportunities', () => {
  it('경쟁 낮음이 같은 검색량의 높음보다 위 (가중치 1.0 vs 0.25)', () => {
    const out = scoreOpportunities([kw('저경쟁', 1000, '낮음'), kw('고경쟁', 1000, '높음')], [])
    expect(out[0].keyword).toBe('저경쟁')
    expect(out[0].score).toBe(1000)
    expect(out[1].score).toBe(250)
  })

  it('검색량 4배 차이면 높음이 낮음을 이길 수 있음 (기회 = 볼륨×경쟁 트레이드오프)', () => {
    const out = scoreOpportunities([kw('빅볼륨고경쟁', 10000, '높음'), kw('스몰저경쟁', 2000, '낮음')], [])
    expect(out[0].keyword).toBe('빅볼륨고경쟁') // 2500 > 2000
  })

  it('보유 키워드는 공백무시로 제외', () => {
    const out = scoreOpportunities([kw('무선 이어폰', 5000, '낮음'), kw('블루투스스피커', 3000, '낮음')], ['무선이어폰'])
    expect(out.map(o => o.keyword)).toEqual(['블루투스스피커'])
  })

  it('검색량 100 미만은 노이즈로 제외', () => {
    const out = scoreOpportunities([kw('틈새', 99, '낮음'), kw('유효', 100, '낮음')], [])
    expect(out.map(o => o.keyword)).toEqual(['유효'])
  })

  it('중복 후보는 1회만 + topN 컷', () => {
    const cands = [kw('중복', 500, '낮음'), kw('중 복', 500, '낮음'), ...Array.from({ length: 30 }, (_, i) => kw(`k${i}`, 1000 + i, '중간'))]
    const out = scoreOpportunities(cands, [], 20)
    expect(out).toHaveLength(20)
    expect(out.filter(o => normKw(o.keyword) === '중복')).toHaveLength(0) // 점수 낮아 top20 밖
  })

  it('미지의 compIdx 는 중간(0.55) 취급', () => {
    const out = scoreOpportunities([kw('언노운', 1000, '')], [])
    expect(out[0].score).toBe(550)
  })
})
