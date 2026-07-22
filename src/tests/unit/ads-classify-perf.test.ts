import { describe, it, expect } from 'vitest'
import { classifyCategory, resolveCategory, reconcileCategory } from '@/features/marketing/api/influencer-classify'
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
  it('맛집 오탐 제거 — 캐주얼 "맛있" 은 맛집 아님', () => {
    expect(classifyCategory('일상 기록', '오늘 점심 맛있었어요')).toBeNull() // 과거엔 "맛있" → 맛집 오분류
  })
  it('니치가 맛집보다 우선 — 음식어 스침에 안 뺏김', () => {
    expect(classifyCategory('헬스 브이로그', '다이어트 도시락 레시피')).toBe('운동')   // 다이어트(운동) > 레시피(푸드)
    expect(classifyCategory('멍멍이랑', '강아지 수제간식 만들기')).toBe('반려동물')      // 강아지(반려) > 간식
    expect(classifyCategory('우리 아기', '이유식 레시피 공유')).toBe('육아')            // 이유식(육아) > 레시피
  })
  it('신규 카테고리 분류(과거엔 규칙 없어 맛집/미분류로 샜음)', () => {
    expect(classifyCategory('우리집 냥이', '고양이 일상')).toBe('반려동물')
    expect(classifyCategory('홈트 채널', '매일 홈트레이닝 루틴')).toBe('운동')
    expect(classifyCategory('살림의 여왕', '정리수납 꿀팁')).toBe('리빙')
    expect(classifyCategory('재테크 노트', '주식 투자 기록')).toBe('IT/재테크')
    expect(classifyCategory('자취요리', '간단 레시피')).toBe('푸드')            // 요리/레시피 → 푸드(맛집 아님)
    expect(classifyCategory('예쁜 카페 투어', '디저트 맛집')).toBe('카페')       // 카페 > 맛집
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

describe('reconcileCategory — 우리 규칙 + YouTube topicDetails 종합', () => {
  it('미분류는 우리 규칙 우선, 없으면 유튜브로 채움', () => {
    expect(reconcileCategory(null, '뷰티', null)).toBe('뷰티')
    expect(reconcileCategory(null, null, '운동')).toBe('운동')
    expect(reconcileCategory(null, null, null)).toBeNull()
  })
  it('유튜브가 거친 카테고리에서 불일치 → 교정(오분류 맛집을 실제 운동으로)', () => {
    expect(reconcileCategory('맛집', null, '운동')).toBe('운동')   // 라이브 규칙 지지 없음 → 유튜브 교정
    expect(reconcileCategory('맛집', '맛집', '운동')).toBe('맛집') // 라이브 규칙이 맛집 지지 → 유지
  })
  it('우리가 더 세분이면 유튜브 상위로 안 덮음', () => {
    expect(reconcileCategory('네일', null, '뷰티')).toBe('네일')   // 네일 < 뷰티
    expect(reconcileCategory('카페', null, '맛집')).toBe('카페')   // 카페 < 맛집
  })
  it('유튜브가 못 판단하는 세분 카테고리는 우리값 유지', () => {
    expect(reconcileCategory('육아', null, '맛집')).toBe('육아')   // 육아는 YT 거친셋 아님 → 유지
    expect(reconcileCategory('숙소', null, '여행')).toBe('숙소')
  })
  it('라이브 규칙이 저장값을 교정(키워드 상속 오류 치유)', () => {
    expect(reconcileCategory('맛집', '운동', null)).toBe('운동')   // 라이브 About 이 운동 → 교정
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
