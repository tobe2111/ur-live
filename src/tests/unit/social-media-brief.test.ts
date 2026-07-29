import { describe, it, expect } from 'vitest'
import {
  SOCIAL_PLATFORMS, isSocialPlatform, PLATFORM_MEDIA, PLATFORM_LABEL,
  socialSystemPrompt, HUMAN_VOICE_RULES,
} from '@/features/social-media/api/social-brief'
import { findForbidden } from '@/features/blog/api/blog-ai'

/**
 * 🆕 2026-07-15 소셜 자동화 — 순수 로직 잠금.
 *   ① 플랫폼 판별/미디어 요구 ② 프롬프트에 "사람처럼 쓰기"(AI 티 제거) 규칙 포함
 *   ③ 운영정보/폐기어 검증(blog-ai SSOT 재사용)이 소셜 텍스트에도 적용됨.
 */
describe('social platform 판별', () => {
  it('지원 플랫폼만 true', () => {
    expect(isSocialPlatform('threads')).toBe(true)
    expect(isSocialPlatform('instagram')).toBe(true)
    expect(isSocialPlatform('youtube')).toBe(true)
    expect(isSocialPlatform('tiktok')).toBe(false)
    expect(isSocialPlatform('')).toBe(false)
    expect(isSocialPlatform(null)).toBe(false)
  })
  it('플랫폼 3종 정의', () => {
    expect([...SOCIAL_PLATFORMS]).toEqual(['threads', 'instagram', 'youtube'])
  })
  it('미디어 요구: 인스타=image, 유튜브=video, 스레드=none', () => {
    expect(PLATFORM_MEDIA.instagram).toBe('image')
    expect(PLATFORM_MEDIA.youtube).toBe('video')
    expect(PLATFORM_MEDIA.threads).toBe('none')
  })
  it('한국어 라벨', () => {
    expect(PLATFORM_LABEL.threads).toBe('스레드')
    expect(PLATFORM_LABEL.youtube).toBe('유튜브')
  })
})

describe('socialSystemPrompt — AI 티 제거 + 포맷', () => {
  it('사람처럼 쓰기 규칙(이모지 금지 등)을 포함', () => {
    for (const p of SOCIAL_PLATFORMS) {
      const sys = socialSystemPrompt(p)
      expect(sys).toContain('이모지를 절대 쓰지 마라')
      expect(sys).toContain(HUMAN_VOICE_RULES)
    }
  })
  it('플랫폼별 출력 JSON 스펙 안내', () => {
    expect(socialSystemPrompt('threads')).toContain('body')
    expect(socialSystemPrompt('youtube')).toContain('영상 제목')
    expect(socialSystemPrompt('instagram')).toContain('해시태그')
  })
  it('grounding(brief)에 이용권/교환권/동네딜 사실 포함', () => {
    const sys = socialSystemPrompt('threads')
    expect(sys).toContain('이용권')
    expect(sys).toContain('교환권')
  })
})

describe('운영정보/폐기어 검증(소셜 텍스트 동일 적용)', () => {
  it('폐기어/운영정보 감지', () => {
    expect(findForbidden('수수료 5%를 아껴요')).toBeTruthy()
    expect(findForbidden('식사권 특가')).toBeTruthy()      // 폐기어
    expect(findForbidden('인플루언서와 협업')).toBeTruthy() // 사람 지칭 금지
    expect(findForbidden('도매가로 사입')).toBeTruthy()     // 도매 유입
  })
  it('정상 홍보 문구는 통과', () => {
    expect(findForbidden('오늘은 이용권으로 카페 데이트를 즐겨보세요')).toBeNull()
    expect(findForbidden('동네딜에서 우리 동네 혜택을 찾았어요')).toBeNull()
  })
})
