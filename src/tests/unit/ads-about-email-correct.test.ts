import { describe, it, expect } from 'vitest'
import { correctedAboutEmail, reextractEmail, topicToCategory } from '@/features/marketing/api/influencer-performance'

/**
 * 🔧 About 이메일 재교정 — 대표 신고(티벳동생: About 에 개인메일 ilsan9924@naver.com 인데 저장값은
 *   영상설명의 대행사 메일 know@fleekers.co.kr). 최신 About 개인메일로 대행사/스테일 메일 정정.
 *   보수적: 이미 개인메일이면 안 건드림(처닝 방지), About 개인메일 없으면 유지(NULL).
 */
describe('correctedAboutEmail', () => {
  const TIBET_ABOUT = 'beauty, health, and styling for men.\ncontact: ilsan9924@naver.com\ninstagram: @juuun_d'

  it('대행사(co.kr) 저장값 → About 개인메일(naver)로 정정 (티벳동생 케이스)', () => {
    expect(correctedAboutEmail(TIBET_ABOUT, 'know@fleekers.co.kr')).toBe('ilsan9924@naver.com')
  })
  it('저장값 NULL → About 개인메일로 채움', () => {
    expect(correctedAboutEmail(TIBET_ABOUT, null)).toBe('ilsan9924@naver.com')
  })
  it('이미 개인메일이면 정정 안 함(처닝 방지)', () => {
    expect(correctedAboutEmail(TIBET_ABOUT, 'someone@gmail.com')).toBeNull()
  })
  it('About 에 개인메일 없으면 대행사값 유지(NULL 반환=변경 없음)', () => {
    expect(correctedAboutEmail('business: know@fleekers.co.kr', 'know@fleekers.co.kr')).toBeNull()
    expect(correctedAboutEmail('소개글에 이메일 없음', 'know@fleekers.co.kr')).toBeNull()
  })
  it('About 없음/동일값 → NULL(변경 없음)', () => {
    expect(correctedAboutEmail(undefined, 'x@daum.net')).toBeNull()
    expect(correctedAboutEmail('contact: x@naver.com', 'x@naver.com')).toBeNull()
  })
})

describe('reextractEmail — 기존 풀 재정리(가짜 제거·교정·채움)', () => {
  it('가짜 이메일(전치사 at) 제거 — 소개글에 진짜 메일 없으면 비움(null)', () => {
    // "out@naver.com" 은 "check it out at naver.com" 의 날조 → 소개글에 문자 그대로 없음 + "out at naver" 흔적.
    expect(reextractEmail('check it out at naver.com daily', 'out@naver.com')).toBeNull()
    expect(reextractEmail('meet me at naver.com for details', 'me@naver.com')).toBeNull()
  })
  it('소개글에 진짜 개인메일이 있으면 그것으로 교체', () => {
    expect(reextractEmail('놀러오세요 blog at naver.com · 문의 real@gmail.com', 'blog@naver.com')).toBe('real@gmail.com')
  })
  it('실제로 소개글에 있는 메일은 유지(변경 없음)', () => {
    expect(reextractEmail('contact: real@naver.com', 'real@naver.com')).toBeUndefined()
  })
  it('빈칸이면 재도출로 채움', () => {
    expect(reextractEmail('문의 hello@gmail.com', null)).toBe('hello@gmail.com')
    expect(reextractEmail('이메일 없음', null)).toBeUndefined()
  })
  it('대행사(비-개인도메인) 저장값 + 소개글 개인메일 → 개인메일로 교정', () => {
    expect(reextractEmail('개인 문의 real@naver.com', 'know@fleekers.co.kr')).toBe('real@naver.com')
  })
})

describe('topicToCategory — YouTube topicDetails 매핑', () => {
  it('Wikipedia 주제 URL → 우리 카테고리', () => {
    expect(topicToCategory(['https://en.wikipedia.org/wiki/Food'])).toBe('맛집')
    expect(topicToCategory(['https://en.wikipedia.org/wiki/Cosmetics', 'https://en.wikipedia.org/wiki/Lifestyle_(sociology)'])).toBe('뷰티')
    expect(topicToCategory(['https://en.wikipedia.org/wiki/Physical_fitness'])).toBe('운동')
  })
  it('매핑 불가/빈값 → null', () => {
    expect(topicToCategory(['https://en.wikipedia.org/wiki/Society'])).toBeNull()
    expect(topicToCategory([])).toBeNull()
    expect(topicToCategory(undefined)).toBeNull()
  })
})
