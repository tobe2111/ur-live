import { describe, it, expect } from 'vitest'
import { correctedAboutEmail } from '@/features/marketing/api/influencer-performance'

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
