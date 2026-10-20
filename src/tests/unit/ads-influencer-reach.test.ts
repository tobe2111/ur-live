import { describe, it, expect } from 'vitest'
import { pickReach, igDmHref, parseReachDraft, type ReachLead } from '@/pages/admin/influencer-pool/reach'

/**
 * 📨 2026-07-21 유어애즈 "지금 연락" 채널 선택 순수함수 잠금.
 *   ⚖️ 링크/붙여넣기 텍스트만 만든다 — 자동 발송 없음(정보통신망법). 이메일 없는 블로거도 원클릭 연락.
 */
const base: ReachLead = { name: '방배미식가', platform: 'youtube', url: 'https://youtube.com/@x', email: null, instagram: null, outreach_draft: null }

describe('pickReach — 채널 우선순위', () => {
  it('이메일 있으면 mailto(email 채널), 클립보드는 본문', () => {
    const p = pickReach({ ...base, email: 'biz@shop.co.kr' })!
    expect(p.channel).toBe('email')
    expect(p.href.startsWith('mailto:biz@shop.co.kr?')).toBe(true)
    expect(p.href).toContain('subject=')
  })

  it('이메일 없고 인스타 있으면 인스타 DM(dm 채널)', () => {
    const p = pickReach({ ...base, instagram: 'beauty_kr' })!
    expect(p.channel).toBe('dm')
    expect(p.href).toBe('https://ig.me/m/beauty_kr')
    expect(p.clipboard.length).toBeGreaterThan(10) // 붙여넣기용 DM 초안
  })

  it('이메일·인스타 없으면 블로그 URL 열기(note 채널)', () => {
    const p = pickReach({ ...base, platform: 'naver_blog', url: 'https://blog.naver.com/abc' })!
    expect(p.channel).toBe('note')
    expect(p.href).toBe('https://blog.naver.com/abc')
  })

  it('저장된 초안이 있으면 그 subject/dm 을 사용', () => {
    const draft = JSON.stringify({ subject: '제휴 제안', body: '본문입니다', dm: '안녕하세요 DM' })
    const email = pickReach({ ...base, email: 'a@b.com', outreach_draft: draft })!
    expect(decodeURIComponent(email.href)).toContain('제휴 제안')
    const dm = pickReach({ ...base, instagram: 'x', outreach_draft: draft })!
    expect(dm.clipboard).toBe('안녕하세요 DM')
  })

  it('열 채널이 하나도 없으면 null (URL 도 비어있음)', () => {
    expect(pickReach({ ...base, url: '' })).toBeNull()
  })
})

describe('igDmHref — 핸들 검증(SSRF/오픈리다이렉트 방지)', () => {
  it('유효 핸들 → ig.me DM 링크(@ 제거)', () => {
    expect(igDmHref('@my.handle_1')).toBe('https://ig.me/m/my.handle_1')
  })
  it('공백/슬래시/한글 등 비정상 핸들 → null', () => {
    expect(igDmHref('bad handle')).toBeNull()
    expect(igDmHref('a/b')).toBeNull()
    expect(igDmHref('한글아이디')).toBeNull()
    expect(igDmHref(null)).toBeNull()
  })
})

describe('parseReachDraft', () => {
  it('깨진 JSON/누락 필드는 null', () => {
    expect(parseReachDraft(null)).toBeNull()
    expect(parseReachDraft('{not json')).toBeNull()
    expect(parseReachDraft('{"subject":"only"}')).toBeNull() // body 없음
  })
  it('정상 초안은 파싱(dm 없으면 빈 문자열)', () => {
    expect(parseReachDraft('{"subject":"s","body":"b"}')).toEqual({ subject: 's', body: 'b', dm: '' })
  })
})
