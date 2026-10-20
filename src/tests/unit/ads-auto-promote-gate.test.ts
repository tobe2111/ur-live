import { describe, it, expect } from 'vitest'
import {
  canAutoPromote, AUTO_PROMOTE_CATEGORIES, CLASSIFIED_CATEGORIES, classifyCategory,
} from '@/features/marketing/api/influencer-classify'
import { SEED } from '@/features/marketing/api/influencer-seed-keywords'

/**
 * 🚪 2026-07-29 — **해시태그 자동승격 적합성 게이트** (대표 승인).
 *
 *   자동확장은 관련성을 안 보고 "서로 다른 채널 5곳이 쓴 태그"면 승격했다. 라이브 실측에서
 *   승격 대기 후보 상위가 이랬다:
 *     주식투자 247 · 재테크 227 · 주식초보 219 · 주식 216 · 주식공부 202 · 주식강의 143
 *   주식 태그는 서로 붙어 다녀 **auto 슬롯 40개를 통째로 먹는다.** 그렇게 들어온 리드는 매장도
 *   이용권 접점도 없어 풀의 '기타'로 남는다.
 *
 *   ⚠️ 여기서 잠그는 핵심은 **"분류 가능 여부로는 못 막는다"** 이다 — `주식투자` 는 분류기가
 *   `IT/재테크` 로 **정확히** 분류한다. 판단 실패가 아니라 정책 문제라서, 정책 목록이 필요했다.
 */
describe('canAutoPromote — 승격해도 되는 축인가', () => {
  it('🔒 매장/공동구매 접점이 있는 축은 통과', () => {
    for (const c of ['맛집', '카페', '뷰티', '네일', '숙소', '골프', '공동구매', '외식창업']) {
      expect(canAutoPromote(c), c).toBe(true)
    }
  })

  it('🔒 라이브에서 실제로 밀려오던 주식 태그 6종이 전부 막힌다', () => {
    for (const tag of ['주식투자', '재테크', '주식초보', '주식', '주식공부', '주식강의']) {
      // 분류는 성공한다 — 그래서 "분류 가능하면 승격" 이라는 게이트로는 못 막는다.
      expect(classifyCategory(tag), tag).toBe('IT/재테크')
      expect(canAutoPromote(classifyCategory(tag)), tag).toBe(false)
    }
  })

  it('🔒 분류 불가 태그(자동/일반 잡음)는 막힌다', () => {
    // 라이브 후보에 실재하던 것들 — 업종 신호가 없어 어느 축으로도 안 붙는다.
    for (const tag of ['내돈내산', 'shorts', '블로그수익화', '일상', 'vlog']) {
      expect(canAutoPromote(classifyCategory(tag)), tag).toBe(false)
    }
    expect(canAutoPromote(null)).toBe(false)
    expect(canAutoPromote('자동')).toBe(false)
    expect(canAutoPromote('')).toBe(false)
  })

  it('🔒 온-타깃 지역 태그(승격 대기 1~7위)는 그대로 통과한다 — 게이트가 본업을 막으면 안 된다', () => {
    for (const tag of ['서울맛집', '서초카페', '서초맛집', '강남맛집', '영등포카페', '방배동맛집', '강남카페']) {
      expect(canAutoPromote(classifyCategory(tag)), tag).toBe(true)
    }
  })

  it('📏 허용 목록은 분류기가 만들 수 있는 축의 부분집합이다(오타 = 영원히 못 여는 축)', () => {
    const unknown = [...AUTO_PROMOTE_CATEGORIES].filter(c => !CLASSIFIED_CATEGORIES.includes(c))
    expect(unknown, `분류기에 없는 축: ${unknown.join(', ')}`).toEqual([])
  })

  it('📏 시드 축은 막아도 되지만(대표가 고른 소수는 그대로 돈다) 그 사실을 명시적으로 고정한다', () => {
    // 시드에는 있는데 자동승격은 막는 축 — 이 목록이 바뀌면 정책이 바뀐 것이므로 테스트가 알려준다.
    const seedOnly = SEED.map(s => s.category).filter(c => !AUTO_PROMOTE_CATEGORIES.has(c))
    expect(seedOnly.sort()).toEqual(['IT/재테크', '취미'])
  })
})

/**
 * 🏌️ 골프 축 신설(2026-07-29 대표 지시) — 골프연습장·스크린골프는 인허가 업종이라 이용권 대상이다.
 *   실측에서 골프장 리뷰 채널(`파쓰리뷰`)이 규칙 부재로 '맛집'에 앉아 있었다.
 */
describe('골프 분류 규칙', () => {
  it('🔒 골프 신호를 잡는다', () => {
    expect(classifyCategory('파쓰리뷰', '전국 골프장 라운딩 후기')).toBe('골프')
    expect(classifyCategory('골린이 일지', '스크린골프 연습 기록')).toBe('골프')
    expect(classifyCategory('Golf with Kim', 'weekly golf lesson')).toBe('골프')
  })

  it('🔒 운동보다 먼저 판정된다(더 구체적인 축)', () => {
    expect(classifyCategory('골프 피트니스', '골프 스윙을 위한 헬스')).toBe('골프')
  })

  it('🐛 오탐 함정 — 운전 드라이버·다리미 아이언·분야 필드는 골프가 아니다', () => {
    expect(classifyCategory('버스 드라이버', '운전 브이로그')).not.toBe('골프')
    expect(classifyCategory('아이언 리뷰', '다리미 비교')).not.toBe('골프')
    expect(classifyCategory('필드 리포트', '현장 취재 기록')).not.toBe('골프')
    // 어깨 라운딩(체형 교정) — bare '라운딩' 을 안 잡는 이유
    expect(classifyCategory('체형교정', '어깨 라운딩 교정 스트레칭')).not.toBe('골프')
  })
})
