/**
 * 📱 사업자 유저 가입 폼 개편 (2026-09-15 대표 *"셀러 계정을 만드는 부분이니까 가장 중요해"*).
 *   지키는 것: ① 검증은 순수 함수(칸별 메시지) ② 입력 16px(iOS 확대 방지)·44px ③ 하단 고정 제출 바
 *   ④ 이모지·색깔 상자·초록 0 ⑤ 제출 payload 는 종전과 같다(서버 계약 불변) ⑥ 로그인 게이트는 마운트에서.
 *   ⚠️ 못 보는 것: 실제 픽셀(하네스가 본다) · 서버가 payload 를 어떻게 읽는지(signup-store-channel 이 본다).
 *
 * 🪦 2026-10-12 축소: 옛 가입 폼(`SellerRegisterSupplierPage`)과 `StoreSection` 을 지웠다 — 가입 문은
 *   2026-10-10 부터 `/store/new` 하나이고 그 파일들은 import 하는 곳이 0 이었다. ③④⑤⑥ 은 지킬 화면이
 *   사라져 함께 뺐다. 남은 것은 **아직 쓰이는 입력 부품**(`RegisterFields`)의 ①②와 칩 계약이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { validateSignup, filledRequired, formatBusinessNumber, formatPhone, type SignupForm } from '@/pages/seller-register/RegisterFields'

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
    // 🔀 2026-09-16 재조준 — 대표 확정 **시각 C** 로 입력이 `h-11` 테두리 상자에서
    //   테두리 없는 큰 글자로 바뀌었다(docs/design/seller-signup-documents.md).
    //   **불변식은 그대로다**: 16px 이상 + 44px 터치 타깃. 모양이 아니라 그 둘을 잰다.
    const size = FIELDS.match(/INPUT\s*=[\s\S]{0,500}?text-\[(\d+(?:\.\d+)?)px\]/)
    expect(Number(size?.[1])).toBeGreaterThanOrEqual(16)
    const minh = FIELDS.match(/INPUT\s*=[\s\S]{0,500}?min-h-\[(\d+)px\]/)
    expect(Number(minh?.[1])).toBeGreaterThanOrEqual(30)  // + 라벨 16px = 50px 탭 영역
  })
  it('카테고리는 select 가 아니라 칩(radio) — 선택은 브랜드 옅은 면', () => {
    expect(FIELDS).toMatch(/role="radio"/)
    expect(FIELDS).toMatch(/border-brand bg-brand-tint text-brand-text/)
  })
})
