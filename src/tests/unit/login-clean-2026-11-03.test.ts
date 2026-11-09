/**
 * 🔐 카카오 로그인 화면 A안 (2026-11-03 대표 *"깔끔하고 군더더기 없이"* → *"A안"*). 시안 `docs/design/login-clean-2026-11-03.md`.
 *
 * 지키는 것:
 *   ① 칩(동네 이용권 · 교환권·기프티콘)이 없다
 *   ② 기본 화면의 이메일 로그인 · 에이전시 로그인은 **한 줄**이다(구분선 아래 에이전시 줄은 이메일 폼일 때만)
 *   ③ 버튼 문구는 '카카오로 시작하기'
 *   ④ 약관 고지 링크(/terms · /privacy)는 그대로 — 법적 고지라 이 디자인 변경이 건드리지 않는다
 *
 * ⚠️ 못 보는 것: 화면이 보기 좋은지(그려서 봐야 한다).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { LOGIN_COPY } from '@/shared/login-page'

const P = readCode('src/pages/LoginPage.tsx')

describe('로그인 A안', () => {
  it('① 칩이 없다', () => {
    expect(P).not.toMatch(/chipPass|chipVoucher|ur-lg-chips/)
  })
  it('② 이메일·에이전시 한 줄 + 에이전시 단독 줄은 폼 화면에서만', () => {
    expect(P).toMatch(/onClick=\{\(\) => setShowEmailLogin\(true\)\}[\s\S]{0,300}?<span aria-hidden="true"[^>]*>\|<\/span>\s*<Link to="\/agency\/login"/)
    expect(P).toContain('{(showEmailLogin || showForgotPassword) && <div className="mt-10 pt-5 border-t')
  })
  it("③ 버튼 문구", () => {
    // 2026-11-09: 문구는 `shared/login-page.ts` LOGIN_COPY 로 옮겼다(서버 첫 화면과 한 벌) — 값은 그대로다.
    expect(P).toContain("t('login.kakaoStart', { defaultValue: LOGIN_COPY.kakaoStart })")
    expect(LOGIN_COPY.kakaoStart).toBe('카카오로 시작하기')
  })
  it('④ 약관 고지 링크 그대로', () => {
    expect(P).toContain('<Link to="/terms"')
    expect(P).toContain('<Link to="/privacy"')
  })
})
