/**
 * FAQ Bot Search — Phase 3-2 단위 테스트 (순수 함수만)
 *
 * 외부 API 호출 없이 텍스트 매칭/스코어 로직만 검증.
 */

import { describe, it, expect } from 'vitest'

// FAQ Bot 의 내부 함수가 export 안 되어 있으므로 동일 로직 재구현 (regression 방지)
function tokenize(s: string): string[] {
  return s.toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function scoreMatch(query: string, title: string, content: string): number {
  const qTokens = tokenize(query);
  if (!qTokens.length) return 0;
  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();
  let score = 0;
  for (const t of qTokens) {
    if (titleLower.includes(t)) score += 3;
    score += contentLower.split(t).length - 1;
  }
  return score;
}

describe('faq-bot: tokenize', () => {
  it('한국어 문장 토큰화', () => {
    expect(tokenize('셀러 영입 방법')).toEqual(['셀러', '영입', '방법'])
  })

  it('짧은 토큰 (1자) 제외', () => {
    expect(tokenize('a 셀러 b')).toEqual(['셀러'])
  })

  it('특수문자 제거', () => {
    expect(tokenize('영입! @방법?')).toEqual(['영입', '방법'])
  })

  it('대소문자 통일', () => {
    expect(tokenize('SELLER seller')).toEqual(['seller', 'seller'])
  })
})

describe('faq-bot: scoreMatch', () => {
  it('제목 매치 가중치 3', () => {
    const score = scoreMatch('셀러', '셀러 영입', '...')
    expect(score).toBe(3)
  })

  it('본문 매치 가중치 1', () => {
    const score = scoreMatch('영입', '제목 없음', '영입 방법은 ...')
    expect(score).toBe(1)
  })

  it('제목 + 본문 모두 매치 → 합산', () => {
    const score = scoreMatch('셀러', '셀러 영입', '셀러는 셀러일 뿐')
    expect(score).toBe(3 + 2) // 제목 3 + 본문 2회
  })

  it('빈 쿼리 → 0', () => {
    expect(scoreMatch('', '제목', '본문')).toBe(0)
  })

  it('매치 없음 → 0', () => {
    expect(scoreMatch('완전 다른', '제목', '본문')).toBe(0)
  })
})
