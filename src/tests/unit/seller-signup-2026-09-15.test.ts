/**
 * 📱 사업자 유저 가입 폼 개편 (2026-09-15 대표 *"셀러 계정을 만드는 부분이니까 가장 중요해"*).
 *   지키는 것: ① 검증은 순수 함수(칸별 메시지) ② 입력 16px(iOS 확대 방지)·44px ③ 하단 고정 제출 바
 *   ④ 이모지·색깔 상자·초록 0 ⑤ 제출 payload 는 종전과 같다(서버 계약 불변) ⑥ 로그인 게이트는 마운트에서.
 *   ⚠️ 못 보는 것: 실제 픽셀(하네스가 본다) · 서버가 payload 를 어떻게 읽는지(signup-store-channel 이 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { validateSignup, filledRequired, formatBusinessNumber, formatPhone, type SignupForm } from '@/pages/seller-register/RegisterFields'

const PAGE = stripComments(readFileSync('src/pages/SellerRegisterSupplierPage.tsx', 'utf8'))
const FIELDS = stripComments(readFileSync('src/pages/seller-register/RegisterFields.tsx', 'utf8'))
const ok: SignupForm = { business_name: '홍대돈까스', business_number: '123-45-67890', representative_name: '홍길동', business_start_date: '2020-01-02', phone: '010-1234-5678', store_category: '', address: '', description: '' }

describe('검증 — 칸별 메시지', () => {
  it('정상 입력은 오류 0', () => { expect(validateSignup(ok)).toEqual({}) })
  it('필수 5칸이 비면 5칸 전부 메시지를 낸다 (첫 칸만이 아니라)', () => {
    const e = validateSignup({ ...ok, business_name: '', business_number: '', representative_name: '', business_start_date: '', phone: '' })
    expect(Object.keys(e).sort()).toEqual(['business_name', 'business_number', 'business_start_date', 'phone', 'representative_name'])
  })
  it('사업자번호 형식 · 휴대폰 형식 · 미래 개업일을 잡는다', () => {
    expect(validateSignup({ ...ok, business_number: '123-45-678' }).business_number).toMatch(/10자리/)
    expect(validateSignup({ ...ok, phone: '02-123-4567' }).phone).toMatch(/휴대폰/)
    expect(validateSignup({ ...ok, business_start_date: '2999-01-01' }).business_start_date).toMatch(/오늘 이후/)
  })
  it('자동 하이픈', () => {
    expect(formatBusinessNumber('1234567890')).toBe('123-45-67890')
    expect(formatPhone('01012345678')).toBe('010-1234-5678')
    expect(filledRequired(ok)).toBe(5)
    expect(filledRequired({ ...ok, phone: '' })).toBe(4)
  })
})

describe('화면 — 모바일 특화 계약', () => {
  it('입력은 44px·16px (iOS Safari 는 16px 미만 입력을 탭하면 확대한다)', () => {
    expect(FIELDS).toMatch(/h-11 w-full rounded-lg border border-rule-strong bg-white px-3\.5 text-\[16px\]/)
  })
  it('오류는 칸 밑에 적고 첫 오류 칸으로 포커스한다 — 토스트만이 아니다', () => {
    expect(PAGE).toMatch(/const errs = validateSignup\(form\)/)
    expect(PAGE).toMatch(/document\.getElementById\(`f-\$\{first\}`\)/)
    expect(FIELDS).toMatch(/role="alert"/)
  })
  it('제출 바는 하단 고정 + safe-area', () => {
    expect(PAGE).toMatch(/fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-white/)
    expect(PAGE).toContain("paddingBottom: 'env(safe-area-inset-bottom)'")
  })
  it('카테고리는 select 가 아니라 칩(radio) — 선택은 브랜드 옅은 면', () => {
    expect(PAGE).not.toMatch(/<select/)
    expect(FIELDS).toMatch(/role="radio"/)
    expect(FIELDS).toMatch(/border-brand bg-brand-tint text-brand-text/)
  })
  it('이모지 0 · 색깔 정보상자 0 · 초록 0 (🎫 규칙 ⑥)', () => {
    for (const [n, s] of [['page', PAGE], ['fields', FIELDS]] as const) {
      expect(s, `${n}: 이모지`).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
      expect(s, `${n}: 색깔 상자`).not.toMatch(/\bbg-(?:blue|amber|emerald|green|red)-(?:50|100)\b/)
      expect(s, `${n}: emerald`).not.toMatch(/emerald/)
    }
  })
  it('티켓 카드로 3단계 중 어디인지 보여 준다', () => {
    expect(PAGE).toMatch(/<TicketCard[^>]*bandLeft=/)
    expect(PAGE).toContain("'1단계 / 3'")
  })
})

describe('불변 — 서버 계약·게이트', () => {
  it('제출 payload 7필드 + terms_agreed_version 그대로', () => {
    const m = PAGE.match(/api\.post\('\/api\/seller\/register-from-user', \{([\s\S]*?)\}\)/)
    expect(m).not.toBeNull()
    for (const k of ['business_name', 'business_number', 'representative_name', 'business_start_date', 'phone', "seller_type: 'store_owner'", 'description: descWithMeta', 'terms_agreed_version: TERMS_CURRENT_VERSION']) expect(m![1]).toContain(k)
  })
  it('로그인 게이트는 마운트에서(!user_id → /login?returnUrl) · 신청 후 /seller/waiting', () => {
    expect(PAGE).toMatch(/!localStorage\.getItem\('user_id'\)/)
    expect(PAGE).toContain("navigate('/seller/waiting', { replace: true })")
  })
  it('force-light-theme 래퍼(전역 .dark input 규칙 방어) 유지', () => {
    expect(PAGE.match(/force-light-theme/g)?.length).toBeGreaterThanOrEqual(2)
  })
})
