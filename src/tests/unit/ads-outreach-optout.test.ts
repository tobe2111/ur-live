import { describe, it, expect } from 'vitest'
import { declinesOutreach, scoreLead } from '@/features/marketing/api/influencer-quality'
import { buildSendQueueWhere } from '@/features/marketing/api/outreach-queue'

/**
 * 🚫 2026-07-29 — 대표 제보(유튜브 `똘비 ddolbi`: "공동구매 제안은 정중히 사양합니다").
 *
 *   **명시적으로 거부한 사람에게 제안을 보내는 것**은 노이즈(낭비)와 급이 다르다 — 거부 의사 무시다.
 *   하필 공동구매 축을 새로 넣은 참이라 바로 그 키워드로 이런 분들이 대량 유입된다.
 *
 *   이 파일이 잠그는 것: ① 실제 표현을 잡는가 ② **수락 문장을 거부로 오탐하지 않는가**(← 오탐은
 *   좋은 리드를 조용히 잃는다) ③ 점수·발송 큐가 실제로 배제하는가.
 */
describe('declinesOutreach — 아웃리치 거부 명시 판별', () => {
  it('🔒 대표 제보 원문을 잡는다', () => {
    expect(declinesOutreach('똘비 ddolbi', '문의 : ddolbi@example.com\n공동구매 제안은 정중히 사양합니다.')).toBe(true)
  })

  it('실제로 흔한 거부 표현들을 잡는다', () => {
    const bios = [
      '협찬 문의 사절',
      '광고·협찬은 정중히 사양합니다',
      '제휴 제안 받지 않습니다',
      '체험단 제안 안 받아요',
      '공구 제안 사절합니다',
      '브랜디드 콘텐츠는 진행하지 않습니다 · 협찬 사절',
      'DM 사절',
      'No sponsored content — 협찬 사양합니다',
    ]
    for (const b of bios) expect(declinesOutreach('크리에이터', b), b).toBe(true)
  })

  it('🐛 수락·중립 문장을 거부로 오탐하지 않는다(오탐 = 좋은 리드 손실)', () => {
    const bios = [
      '협찬 문의 환영합니다',
      '광고 문의: ad@example.com',
      '비즈니스 문의는 이메일로 받습니다',
      '제품 사양 비교 리뷰 채널',      // ← '사양'(spec). 서술형 어미가 없으면 거부어가 아니다
      '고사양 게임 벤치마크',
      '친선 사절단 활동 기록',          // ← '사절단'
      '맛집 리뷰 · 협찬 받고 솔직 후기',
      '',
    ]
    for (const b of bios) expect(declinesOutreach('크리에이터', b), b).toBe(false)
  })

  it('거부어만 있고 주제어가 없으면 판정하지 않는다(문맥 없는 단독어는 위험)', () => {
    expect(declinesOutreach('채널', '악플은 사양합니다')).toBe(false)
    expect(declinesOutreach('채널', '무단 도용 사절')).toBe(false)
  })

  it('이름에만 써 둔 경우도 잡는다(소개글이 비어도)', () => {
    expect(declinesOutreach('여행하는부부 (협찬 사절)', null)).toBe(true)
  })

  it('입력이 비어도 안전하다', () => {
    expect(declinesOutreach(null, null)).toBe(false)
    expect(declinesOutreach(undefined, undefined)).toBe(false)
  })
})

describe('거부 명시 리드의 취급', () => {
  const base = {
    platform: 'youtube', subscriber_count: 120_000, median_long_views: 60_000,
    email: 'me@gmail.com', category: '맛집', url: 'https://youtube.com/@x',
  }

  it('🔒 점수가 크게 깎인다 — 브랜드 오분류(−35)보다 강하게', () => {
    const open = scoreLead(base).score
    const closed = scoreLead({ ...base, opted_out: 1 }).score
    expect(open).toBeGreaterThan(80)          // 조건상 최상위 리드
    expect(open - closed).toBeGreaterThan(35) // 브랜드 감점보다 커야 상단을 비운다
    expect(scoreLead({ ...base, opted_out: 1 }).reasons.join(' ')).toContain('거부')
  })

  it('🔒 발송 큐 WHERE 가 실제로 배제한다 — 이게 빠지면 태깅만 하고 여전히 보낸다', () => {
    const { where } = buildSendQueueWhere(0)
    expect(where).toContain('COALESCE(opted_out, 0) = 0')
  })
})
