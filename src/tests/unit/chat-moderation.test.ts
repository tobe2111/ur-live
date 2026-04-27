/**
 * Chat Moderation — Phase 3-3 단위 테스트
 *
 * moderateChat 의 욕설/스팸/URL 검출 로직 검증.
 */

import { describe, it, expect } from 'vitest'
import { moderateChat } from '../../shared/utils/chat-moderation'

describe('chat-moderation: clean', () => {
  it('정상 한국어 → allow', () => {
    const r = moderateChat('안녕하세요! 잘 보고 있어요')
    expect(r.action).toBe('allow')
    expect(r.category).toBe('clean')
  })

  it('빈 메시지 → allow (clean)', () => {
    const r = moderateChat('')
    expect(r.action).toBe('allow')
  })

  it('공백만 → allow', () => {
    const r = moderateChat('   ')
    expect(r.action).toBe('allow')
  })
})

describe('chat-moderation: 욕설 → block', () => {
  it('한국어 욕설 (시발) → block', () => {
    const r = moderateChat('시발 진짜')
    expect(r.action).toBe('block')
    expect(r.category).toBe('profane')
  })

  it('자음 우회 (ㅅㅂ) → block', () => {
    const r = moderateChat('ㅅㅂ 화나네')
    expect(r.action).toBe('block')
  })

  it('영어 욕설 → block', () => {
    const r = moderateChat('this is fucking terrible')
    expect(r.action).toBe('block')
  })

  it('띄어쓰기 우회 (시 발) → block (정규화 매칭)', () => {
    const r = moderateChat('시 발')
    expect(r.action).toBe('block')
  })
})

describe('chat-moderation: 의심 → warn', () => {
  it('URL 포함 → warn', () => {
    const r = moderateChat('이거 좋아요 https://example.com')
    expect(r.action).toBe('warn')
    expect(r.category).toBe('suspicious')
    expect(r.cleaned_message).toContain('[링크 제거됨]')
  })

  it('전화번호 → warn', () => {
    const r = moderateChat('연락주세요 010-1234-5678')
    expect(r.action).toBe('warn')
    expect(r.cleaned_message).toContain('[연락처 제거됨]')
  })

  it('카카오톡 ID → warn', () => {
    const r = moderateChat('카카오톡 아이디 : abc123')
    expect(r.action).toBe('warn')
    expect(r.cleaned_message).toContain('[ID 제거됨]')
  })

  it('도메인만 (example.com) → warn', () => {
    const r = moderateChat('가서 example.com 확인해')
    expect(r.action).toBe('warn')
  })
})

describe('chat-moderation: 스팸 → warn', () => {
  it('같은 글자 반복 → warn', () => {
    const r = moderateChat('ㅋㅋㅋㅋㅋㅋㅋㅋ')
    expect(r.action).toBe('warn')
    expect(r.category).toBe('spam')
  })

  it('전체 대문자 → warn', () => {
    const r = moderateChat('SALE BUY NOW LIMITED OFFER')
    expect(r.action).toBe('warn')
    expect(r.category).toBe('spam')
  })

  it('짧은 대문자 (10자 이하) → allow', () => {
    const r = moderateChat('OK COOL')
    expect(r.action).toBe('allow')
  })
})

describe('chat-moderation: 우선순위', () => {
  it('욕설 + URL → block (욕설 우선)', () => {
    const r = moderateChat('시발 https://bad.com')
    expect(r.action).toBe('block')
    expect(r.category).toBe('profane')
  })

  it('matched_patterns 배열에 모든 매치 기록', () => {
    const r = moderateChat('시발 https://x.com')
    expect(r.matched_patterns.length).toBeGreaterThanOrEqual(2)
  })
})
