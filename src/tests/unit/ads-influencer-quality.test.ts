import { describe, it, expect } from 'vitest'
import { looksLikeBrandChannel, scoreLead } from '@/features/marketing/api/influencer-quality'
import { parseIsoDurationSec, medianOf, videoMetrics, SHORTS_MAX_SEC } from '@/features/marketing/api/influencer-performance'

/**
 * 🏅 2026-07-27 인플루언서 풀 품질 레이어 순수부 잠금.
 *   ① 브랜드 공식 채널 판별(보수적 — 개인 크리에이터 오탐 0 이 최우선)
 *   ② 리드 스코어링(연락가능성·규모·활동성·카테고리핏)
 *   ③ 성과 지표(쇼츠 배제 롱폼 중앙값)
 */
describe('looksLikeBrandChannel — 브랜드 공식 채널 판별', () => {
  it('이름의 강한 브랜드 신호를 잡는다', () => {
    expect(looksLikeBrandChannel('스타벅스 코리아 공식 채널', '')).toBe(true)
    expect(looksLikeBrandChannel('(주)유어팀', '')).toBe(true)
    expect(looksLikeBrandChannel('㈜무신사', null)).toBe(true)
    expect(looksLikeBrandChannel('주식회사 오늘식탁', null)).toBe(true)
    expect(looksLikeBrandChannel('ACME Inc.', null)).toBe(true)
    expect(looksLikeBrandChannel('Nike Official Store', null)).toBe(true)
  })
  it('소개글의 "공식 채널" 선언을 잡는다', () => {
    expect(looksLikeBrandChannel('오늘의집', '오늘의집 공식 유튜브 채널입니다')).toBe(true)
    expect(looksLikeBrandChannel('브랜드A', '브랜드 공식 계정')).toBe(true)
  })
  it('🛡️ 개인 크리에이터는 브랜드로 오분류하지 않는다(오탐 0 이 최우선)', () => {
    expect(looksLikeBrandChannel('맛집탐험가 지원', '전국 맛집 리뷰 · 공식 문의는 메일로')).toBe(false)
    expect(looksLikeBrandChannel('먹방하는 남자', '비즈니스 문의: (주)샌드박스네트워크')).toBe(false) // MCN 연락처는 채널=브랜드 아님
    expect(looksLikeBrandChannel('뷰티 유튜버 하나', '협찬 문의 환영')).toBe(false)
    expect(looksLikeBrandChannel('여행하는 부부', null)).toBe(false)
    expect(looksLikeBrandChannel('', '')).toBe(false)
  })
})

describe('scoreLead — 리드 점수', () => {
  const base = { platform: 'youtube', category: '맛집', subscriber_count: 50_000, median_long_views: 20_000 }
  it('개인 이메일 + 스위트스팟 + 핵심 카테고리면 고득점', () => {
    const r = scoreLead({ ...base, email: 'foodie@gmail.com' })
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(r.reasons).toContain('개인 이메일 보유')
    expect(r.reasons).toContain('스위트스팟 규모')
  })
  it('연락처가 없으면 같은 채널이라도 확연히 낮다', () => {
    const withEmail = scoreLead({ ...base, email: 'foodie@gmail.com' }).score
    const without = scoreLead({ ...base, email: null }).score
    expect(without).toBeLessThan(withEmail)
    expect(withEmail - without).toBeGreaterThanOrEqual(25)
  })
  it('대행사 메일은 개인 메일보다 낮게 친다', () => {
    const personal = scoreLead({ ...base, email: 'me@naver.com' }).score
    const agency = scoreLead({ ...base, email: 'contact@sandbox.co.kr' }).score
    expect(agency).toBeLessThan(personal)
  })
  it('브랜드 공식 채널은 큰 감점(인플루언서 아님)', () => {
    const normal = scoreLead({ ...base, email: 'a@gmail.com' }).score
    const brand = scoreLead({ ...base, email: 'a@gmail.com', is_brand: 1 }).score
    expect(brand).toBeLessThan(normal - 20)
    expect(scoreLead({ ...base, is_brand: 1 }).reasons).toContain('브랜드 공식 채널 추정')
  })
  it('사전동의(inbound) 리드는 가산 — 즉시 발송 가능', () => {
    const plain = scoreLead({ ...base, email: 'a@gmail.com' }).score
    const consented = scoreLead({ ...base, email: 'a@gmail.com', consented_at: '2026-07-01' }).score
    expect(consented).toBeGreaterThan(plain)
  })
  it('초대형 채널은 스위트스팟보다 낮은 규모 점수', () => {
    const sweet = scoreLead({ ...base, subscriber_count: 50_000, email: 'a@gmail.com' }).score
    const macro = scoreLead({ ...base, subscriber_count: 3_000_000, email: 'a@gmail.com' }).score
    expect(macro).toBeLessThan(sweet)
  })
  it('네이버 블로그는 30일 포스팅 수로 활동성을 본다', () => {
    const active = scoreLead({ platform: 'naver_blog', category: '맛집', email: 'a@naver.com', recent_posts_30d: 15 }).score
    const dead = scoreLead({ platform: 'naver_blog', category: '맛집', email: 'a@naver.com', recent_posts_30d: 0 }).score
    expect(active).toBeGreaterThan(dead)
    expect(scoreLead({ platform: 'naver_blog', recent_posts_30d: 0 }).reasons).toContain('최근 30일 포스팅 없음')
  })
  it('미분류 카테고리는 핏 점수 0', () => {
    const core = scoreLead({ ...base, email: 'a@gmail.com', category: '맛집' }).score
    const none = scoreLead({ ...base, email: 'a@gmail.com', category: null }).score
    expect(core - none).toBe(20)
  })
  it('점수는 항상 0~100 범위', () => {
    for (const l of [{}, { is_brand: 1 }, { platform: 'youtube', email: 'a@gmail.com', subscriber_count: 50_000, median_long_views: 999_999, category: '맛집', consented_at: 'x' }]) {
      const s = scoreLead(l).score
      expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(100)
    }
  })
})

describe('성과 지표 — 쇼츠 배제 롱폼 중앙값', () => {
  it('ISO-8601 duration 파싱', () => {
    expect(parseIsoDurationSec('PT45S')).toBe(45)
    expect(parseIsoDurationSec('PT1M30S')).toBe(90)
    expect(parseIsoDurationSec('PT12M')).toBe(720)
    expect(parseIsoDurationSec('PT1H2M3S')).toBe(3723)
    expect(parseIsoDurationSec('')).toBe(0)
    expect(parseIsoDurationSec('garbage')).toBe(0)
    expect(parseIsoDurationSec(null)).toBe(0)
  })
  it('중앙값 — 홀수/짝수/빈 배열', () => {
    expect(medianOf([1, 100, 5])).toBe(5)
    expect(medianOf([2, 4, 6, 8])).toBe(5)
    expect(medianOf([])).toBe(0)
  })
  it('🎯 쇼츠가 터진 채널의 착시를 걷어낸다 — 평균은 높지만 롱폼 중앙값은 낮다', () => {
    const vids = [
      { views: 1_000_000, comments: 100, durationSec: 30 },  // 쇼츠 대박
      { views: 800_000, comments: 90, durationSec: 45 },     // 쇼츠 대박
      { views: 3_000, comments: 10, durationSec: 600 },      // 롱폼
      { views: 5_000, comments: 12, durationSec: 900 },      // 롱폼
      { views: 4_000, comments: 11, durationSec: 720 },      // 롱폼
    ]
    const m = videoMetrics(vids)
    expect(m.avgViews).toBeGreaterThan(300_000)   // 기존 지표는 과대평가
    expect(m.medianLongViews).toBe(4_000)          // 롱폼 중앙값은 현실적
    expect(m.shortsRatio).toBe(40)
  })
  it('길이를 못 잰 배치(전부 0초)는 중앙값 0 — 호출부가 평균으로 폴백', () => {
    const m = videoMetrics([{ views: 100, comments: 1 }, { views: 300, comments: 2 }])
    expect(m.medianLongViews).toBe(0)
    expect(m.shortsRatio).toBe(0)
    expect(m.avgViews).toBe(200)
  })
  it('임계값 경계 — SHORTS_MAX_SEC 이하는 쇼츠, 초과는 롱폼', () => {
    const m = videoMetrics([
      { views: 10, comments: 0, durationSec: SHORTS_MAX_SEC },
      { views: 20, comments: 0, durationSec: SHORTS_MAX_SEC + 1 },
    ])
    expect(m.medianLongViews).toBe(20)
    expect(m.shortsRatio).toBe(50)
  })
  it('영상이 없으면 전부 0', () => {
    expect(videoMetrics([])).toEqual({ avgViews: 0, avgComments: 0, medianLongViews: 0, shortsRatio: 0 })
  })
})

describe('블로거 정보 보강 순수부 (2026-07-27 — "블로그 부정확" 수리)', () => {
  it('naverPostdateToIso — YYYYMMDD → YYYY-MM-DD, 불량은 null', async () => {
    const { naverPostdateToIso } = await import('@/features/marketing/api/influencer-performance')
    expect(naverPostdateToIso('20260725')).toBe('2026-07-25')
    expect(naverPostdateToIso('2026-07-25')).toBeNull()
    expect(naverPostdateToIso('')).toBeNull()
    expect(naverPostdateToIso(null)).toBeNull()
  })
  it('extractRssTitles — <item> 안의 제목만(채널 title 제외), CDATA 지원, max 제한', async () => {
    const { extractRssTitles } = await import('@/features/marketing/api/influencer-performance')
    const xml = `<rss><channel><title>셀리의 요리노트</title>
      <item><title><![CDATA[전주 맛집 베스트 5]]></title></item>
      <item><title>홈베이킹 스콘 레시피</title></item>
      <item><title></title></item>
      <item><title>이수역 카페 추천</title></item></channel></rss>`
    const t = extractRssTitles(xml)
    expect(t).toEqual(['전주 맛집 베스트 5', '홈베이킹 스콘 레시피', '이수역 카페 추천'])
    expect(extractRssTitles(xml, 2)).toHaveLength(2)
    expect(extractRssTitles('')).toEqual([])
  })
})
