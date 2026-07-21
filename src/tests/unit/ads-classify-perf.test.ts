import { describe, it, expect } from 'vitest'
import { classifyCategory, resolveCategory } from '@/features/marketing/api/influencer-classify'
import { avgStats, countRecentPosts, extractPubDates } from '@/features/marketing/api/influencer-performance'

/**
 * 🏷️📈 2026-07-21 카테고리 콘텐츠 분류 + 성과 계산 순수부 잠금.
 */
describe('classifyCategory — 콘텐츠 신호', () => {
  it('소개글 신호로 분류(키워드 무관)', () => {
    expect(classifyCategory('지원', '뷰티 크리에이터 · 메이크업 리뷰')).toBe('뷰티')
    expect(classifyCategory('먹방하는 남자', null)).toBe('맛집')
    expect(classifyCategory('OO네일샵', '젤네일 아트')).toBe('네일')
  })
  it('네일이 뷰티보다 우선(구체 신호 먼저)', () => {
    expect(classifyCategory('뷰티 네일 아티스트', '')).toBe('네일')
  })
  it('신호 없으면 null', () => {
    expect(classifyCategory('일상 브이로그', '그냥 일상')).toBeNull()
  })
})

describe('resolveCategory — 콘텐츠 우선 + 키워드 폴백', () => {
  it("콘텐츠 신호가 키워드 카테고리를 이김(뷰티 채널이 '맛집' 키워드에 걸려도 뷰티)", () => {
    expect(resolveCategory('메이크업 아티스트', '화장품 리뷰', '맛집')).toBe('뷰티')
  })
  it('신호 없으면 키워드 카테고리 폴백', () => {
    expect(resolveCategory('일상채널', null, '숙소')).toBe('숙소')
  })
  it("'자동'/'일반'은 실제 카테고리 아님 → null", () => {
    expect(resolveCategory('일상채널', null, '자동')).toBeNull()
    expect(resolveCategory('일상채널', null, '일반')).toBeNull()
  })
})

describe('avgStats — YT 최근 영상 평균', () => {
  it('평균 반올림 + 빈 배열 0', () => {
    expect(avgStats([{ views: 100, comments: 3 }, { views: 201, comments: 4 }])).toEqual({ avgViews: 151, avgComments: 4 })
    expect(avgStats([])).toEqual({ avgViews: 0, avgComments: 0 })
  })
})

describe('countRecentPosts + extractPubDates — 네이버 RSS 활동성', () => {
  const NOW = Date.parse('2026-07-21T00:00:00Z')
  it('30일 내 포스팅만 카운트(경계·파싱불가 무시)', () => {
    const dates = [
      'Mon, 20 Jul 2026 10:00:00 +0900', // 1일 전 ✓
      'Mon, 22 Jun 2026 10:00:00 +0900', // 29일 전 ✓
      'Fri, 01 May 2026 10:00:00 +0900', // 81일 전 ✗
      'not-a-date',                      // 무시
    ]
    expect(countRecentPosts(dates, NOW)).toBe(2)
  })
  it('RSS XML 에서 pubDate 추출', () => {
    const xml = '<rss><item><pubDate>Mon, 20 Jul 2026 10:00:00 +0900</pubDate></item><item><pubDate>Sun, 19 Jul 2026 09:00:00 +0900</pubDate></item></rss>'
    expect(extractPubDates(xml)).toHaveLength(2)
  })
})
