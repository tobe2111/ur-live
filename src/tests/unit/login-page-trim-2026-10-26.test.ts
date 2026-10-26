/**
 * 🧹 손님 로그인 화면 정리 (2026-10-26 대표 *"내용이 필요없이 많달까?"*)
 *
 * 지키는 것:
 *  ① 약관 고지는 링크 두 개(이용약관 · 개인정보처리방침)로 남는다 — 지우면 약관 제5조 고지 자체가 사라진다.
 *  ② 회원가입 줄 · 서비스 소개 줄 · "복잡한 가입 절차" 안내가 돌아오지 않는다(대표가 뺀 것).
 *  ③ 제목이 없는 기제("같이 사면 더 싸다")를 말하지 않는다 — 이용권은 즉시판매 단일가다(2026-05-30).
 *  ④ 에이전시 입구 · 이메일 로그인은 남는다(반대 방향).
 * ⚠️ 못 보는 것: 생김새(그려서 본다 — `node scripts/visual-preview.mjs --route=/login`).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const page = readCode('src/pages/LoginPage.tsx')

describe('손님 로그인 화면 정리', () => {
  it('① 약관 링크 두 개가 남는다', () => {
    expect(page).toMatch(/<Link to="\/terms"/)
    expect(page).toMatch(/<Link to="\/privacy"/)
  })
  it('② 대표가 뺀 줄이 돌아오지 않는다', () => {
    expect(page).not.toMatch(/to="\/register"/)
    expect(page).not.toMatch(/to="\/about"/)
    expect(page).not.toMatch(/login\.kakaoHint|login\.aboutLink|auth\.noAccount/)
  })
  it('③ 없는 공동구매 기제를 제목에 쓰지 않는다', () => {
    expect(page).not.toMatch(/같이 사면|login\.heroTitle'/)
  })
  it('④ 에이전시 입구와 이메일 로그인은 남는다', () => {
    expect(page).toMatch(/to="\/agency\/login"/)
    expect(page).toMatch(/setShowEmailLogin\(true\)/)
  })
})
