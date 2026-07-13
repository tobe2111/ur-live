import { describe, it, expect } from 'vitest'
import { extractContacts } from '@/features/marketing/api/influencer-discovery'

/**
 * 🆕 2026-07-13 유어애즈 인플루언서 발굴 — 공개 설명 컨택 추출 순수함수 잠금.
 *   유튜브 채널 설명(API 공식 반환 텍스트)에서 이메일·인스타·틱톡·링크인바이오 추출.
 */
describe('extractContacts', () => {
  it('비즈니스 이메일 추출 + 이미지 URL 오탐 제외', () => {
    const t = '협업문의: brand.deal@example.com\n프로필사진 banner.png@2x 아님\ncontact@myshop.co.kr'
    const r = extractContacts(t)
    expect(r.emails).toContain('brand.deal@example.com')
    expect(r.emails).toContain('contact@myshop.co.kr')
    expect(r.emails.some(e => e.endsWith('.png'))).toBe(false)
  })

  it('인스타/틱톡 핸들 추출 (교차 SNS)', () => {
    const t = '👉 Instagram: https://instagram.com/beauty_guru_kr\nTikTok https://www.tiktok.com/@dance.king\n#reels'
    const r = extractContacts(t)
    expect(r.instagram).toContain('beauty_guru_kr')
    expect(r.tiktok).toContain('dance.king')
    // instagram.com/reel, /p 같은 경로는 핸들 아님
    expect(r.instagram).not.toContain('reels')
  })

  it('링크인바이오(링크트리 등) 추출', () => {
    const r = extractContacts('모든 링크 → https://linktr.ee/creator99 그리고 https://litt.ly/shop')
    expect(r.links.some(l => l.includes('linktr.ee/creator99'))).toBe(true)
    expect(r.links.some(l => l.includes('litt.ly/shop'))).toBe(true)
  })

  it('중복 제거 + 소문자 정규화', () => {
    const r = extractContacts('메일 Deal@X.com deal@x.com DEAL@x.com\nig instagram.com/AA instagram.com/aa')
    expect(r.emails).toEqual(['deal@x.com'])
    expect(r.instagram).toEqual(['aa'])
  })

  it('컨택 없는 설명 → 전부 빈 배열', () => {
    const r = extractContacts('구독과 좋아요 부탁드려요! 매주 화/목 업로드합니다.')
    expect(r.emails).toEqual([])
    expect(r.instagram).toEqual([])
    expect(r.tiktok).toEqual([])
    expect(r.links).toEqual([])
  })

  it('빈/undefined 입력 안전', () => {
    expect(extractContacts('').emails).toEqual([])
    expect(extractContacts(undefined as unknown as string).instagram).toEqual([])
  })
})
