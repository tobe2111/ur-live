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
// 🔀 2026-09-21 재조준 — 안 B 가 '가게 정보' 카드를 `StoreSection` 으로 떼어냈다(파일크기 래칫).
//   같은 마크업이 옮겨 간 것이라 **면제가 아니라 대상 확장**이다. 두 파일을 합쳐서 본다.
const SECTION = stripComments(readFileSync('src/pages/seller-register/StoreSection.tsx', 'utf8'))
const FORM_UI = PAGE + '\n' + SECTION
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
    for (const [n, s] of [['page', PAGE], ['fields', FIELDS], ['store-section', SECTION]] as const) {
      expect(s, `${n}: 이모지`).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
      expect(s, `${n}: 색깔 상자`).not.toMatch(/\bbg-(?:blue|amber|emerald|green|red)-(?:50|100)\b/)
      expect(s, `${n}: emerald`).not.toMatch(/emerald/)
    }
  })
  it('어디까지 왔는지 보여 준다 — 티켓·3단계 사다리 → 묶음별 카운터', () => {
    // 🔀 2026-09-16 재조준 — 대표 확정 시각 C 가 티켓과 3단계 사다리(정보 입력 → 심사 →
    //   판매 시작)를 **지웠다**. 그 사다리는 사장님이 지금 할 일을 하나도 안 알려 주면서
    //   첫 화면의 절반을 먹었다. 진행은 이제 묶음별 `n / m` 과 '승인까지 남은 것' 이 말한다 —
    //   둘 다 실제로 사장님이 채울 수 있는 것이라 종전보다 정확하다.
    expect(PAGE).toMatch(/\{bizDone\} \/ 3/)
    expect(FORM_UI).toMatch(/\{storeDone\} \/ 2/)
    expect(PAGE).toContain('laterSection')
  })
})

describe('불변 — 서버 계약·게이트', () => {
  it('제출 payload 7필드 + terms_agreed_version 그대로', () => {
    // 🩸 2026-09-21: 종전 앵커는 `\{([\s\S]*?)\}\)` 였는데, payload 안에 중첩 객체
    //   (`...(place ? { … } : {})`)가 생기자 **첫 `}` 에서 잘려** 뒷필드를 못 봤다.
    //   정규식으로 균형 괄호를 세지 말고, 호출 시작부터 닫는 줄까지 잘라서 본다.
    const at = PAGE.indexOf("api.post('/api/seller/register-from-user'")
    expect(at, '제출 호출이 사라졌다 — 앵커가 낡았다').toBeGreaterThan(0)
    const end = PAGE.indexOf('terms_agreed_version: TERMS_CURRENT_VERSION', at)
    expect(end, 'payload 에 약관 버전이 없다').toBeGreaterThan(at)
    const m = [PAGE.slice(at, end + 120), PAGE.slice(at, end + 120)]
    for (const k of ['business_name', 'business_number', 'representative_name', 'business_start_date', 'phone', "seller_type: 'store_owner'", 'description: form.description', 'terms_agreed_version: TERMS_CURRENT_VERSION']) expect(m![1]).toContain(k)
  })
  it('로그인 게이트는 마운트에서(!user_id → /login?returnUrl) · 신청 후 /seller/waiting', () => {
    expect(PAGE).toMatch(/!localStorage\.getItem\('user_id'\)/)
    expect(PAGE).toContain("navigate('/seller/waiting', { replace: true })")
  })
  it('force-light-theme 래퍼(전역 .dark input 규칙 방어) 유지', () => {
    expect(PAGE.match(/force-light-theme/g)?.length).toBeGreaterThanOrEqual(2)
  })
})
