import { describe, it, expect } from 'vitest'
import { normalizeAdCopy, extractHashtags, extractTitle, systemPrompt, userPrompt, AD_TITLE_MAX, AD_DESC_MAX } from '@/features/marketing/api/content-studio'
import { parseJsonLoose } from '@/features/marketing/api/claude-client'

/**
 * 🆕 2026-07-02 유어애즈 콘텐츠 스튜디오 — 순수 파서/정규화 잠금.
 *   AI 출력 파싱은 견고해야(모델 변형에 안 깨지게) → 관대한 파서 + 길이 규격 검증.
 */
describe('parseJsonLoose', () => {
  it('코드펜스/서두 텍스트 안의 JSON 추출', () => {
    expect(parseJsonLoose<{ a: number }>('설명\n```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJsonLoose<{ a: number }>('여기 결과: {"a":2} 끝')).toEqual({ a: 2 })
  })
  it('JSON 없으면 null', () => { expect(parseJsonLoose('그냥 텍스트')).toBeNull() })
})

describe('normalizeAdCopy — 네이버 소재 규격', () => {
  it('길이 계산 + 규격 통과 플래그(제목 15·설명 45)', () => {
    const out = normalizeAdCopy([
      { title: '무선 이어폰 특가', desc: '고음질 블루투스 이어폰 오늘만 20% 할인 무료배송' },
      { title: '이것은 열다섯글자를 초과하는 아주 긴 제목입니다', desc: '짧은 설명' },
    ])
    expect(out[0].titleOk).toBe(true)
    expect(out[0].titleLen).toBe([...'무선 이어폰 특가'].length)
    expect(out[1].titleOk).toBe(false) // 15자 초과
    expect(out[1].titleLen).toBeGreaterThan(AD_TITLE_MAX)
    expect(out[1].descOk).toBe(true)
  })
  it('빈 변형 제거 + 최대 8개', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ title: `t${i}`, desc: `d${i}` }))
    expect(normalizeAdCopy([...many, { title: '', desc: '' }])).toHaveLength(8)
  })
  it('설명 45자 경계', () => {
    const desc = '가'.repeat(AD_DESC_MAX)
    expect(normalizeAdCopy([{ title: 'ok', desc }])[0].descOk).toBe(true)
    expect(normalizeAdCopy([{ title: 'ok', desc: desc + '가' }])[0].descOk).toBe(false)
  })
})

describe('extractHashtags', () => {
  it('"해시태그:" 줄 분리', () => {
    const { body, hashtags } = extractHashtags('멋진 캡션입니다\n\n해시태그: #무선이어폰 #가성비 이어폰')
    expect(body).toBe('멋진 캡션입니다')
    expect(hashtags).toContain('#무선이어폰')
    expect(hashtags).toContain('#이어폰') // # 없던 것도 보정
  })
  it('해시태그 줄 없으면 본문 내 #태그 수집', () => {
    const { hashtags } = extractHashtags('본문 #할인 중 #특가')
    expect(hashtags).toEqual(['#할인', '#특가'])
  })
})

describe('extractTitle', () => {
  it('첫 # 제목 추출', () => {
    expect(extractTitle('# 무선 이어폰 고르는 법\n본문...').title).toBe('무선 이어폰 고르는 법')
  })
  it('제목 없으면 null', () => { expect(extractTitle('본문만 있음').title).toBeNull() })
})

describe('프롬프트(순수)', () => {
  it('systemPrompt 는 이모지 금지·타입별 지시 포함', () => {
    expect(systemPrompt('ad_copy')).toContain('JSON')
    expect(systemPrompt('blog')).toContain('마크다운')
    expect(systemPrompt('instagram')).toContain('해시태그')
  })
  it('userPrompt 는 빈 필드 생략', () => {
    const p = userPrompt('blog', { topic: '무선이어폰' })
    expect(p).toContain('무선이어폰')
    expect(p).not.toContain('브랜드')
    expect(userPrompt('blog', { topic: 'x', brand: '루미' })).toContain('루미')
  })
})
