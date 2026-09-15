/**
 * 📱 사업자 유저 가입 폼 부품 (2026-09-15 대표 "셀러 계정을 만드는 부분이니까 가장 중요해").
 *   - 입력 높이 44px · 글자 16px: iOS Safari 는 16px 미만 입력을 탭하면 화면을 확대한다. 그 확대가 "폼이 흔들린다"의 실체다.
 *   - 오류는 토스트가 아니라 **그 칸 밑에** 적는다(토스트는 사라지고, 칸은 남는다).
 *   - 카테고리는 `<select>` 대신 칩 — 엄지로 한 번에 고른다. 선택 = 브랜드 옅은 면 + 파란 글자(🎫 규칙 ②).
 */
import type { ReactNode } from 'react'

export const STORE_CATEGORIES = [
  { value: 'restaurant', label: '음식점' },
  { value: 'cafe', label: '카페/베이커리' },
  { value: 'beauty', label: '뷰티/네일' },
  { value: 'fitness', label: '피트니스/요가' },
  { value: 'retail', label: '소매/매장' },
  { value: 'service', label: '서비스 (마사지/세탁 등)' },
  { value: 'stay', label: '숙박' },
  { value: 'etc', label: '기타' },
] as const

export const INPUT =
  'h-11 w-full rounded-lg border border-rule-strong bg-white px-3.5 text-[16px] text-gray-900 placeholder:text-gray-400 ' +
  'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
export const INPUT_BAD = 'border-tone-bad focus:border-tone-bad focus:ring-[var(--tone-bad-bg)]'

export function Field({ id, label, required, hint, error, children }: {
  id: string; label: string; required?: boolean; hint?: string; error?: string; children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-gray-800">
        {label}{required && <span className="ml-0.5 text-brand-text" aria-hidden>*</span>}
      </label>
      {children}
      {error
        ? <p id={`${id}-err`} role="alert" className="mt-1 text-[12px] font-semibold text-tone-bad">{error}</p>
        : hint ? <p className="mt-1 text-[12px] text-gray-500">{hint}</p> : null}
    </div>
  )
}

export function ChipGroup({ value, onChange, options, name }: {
  value: string; onChange: (v: string) => void; options: readonly { value: string; label: string }[]; name: string
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? '' : o.value)}
            className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
              on ? 'border-brand bg-brand-tint text-brand-text' : 'border-rule-strong bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** 사업자번호 000-00-00000 자동 하이픈 */
export const formatBusinessNumber = (input: string) => {
  const d = input.replace(/\D/g, '').slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}
/** 휴대폰 010-0000-0000 자동 하이픈 */
export const formatPhone = (input: string) => {
  const d = input.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

export type SignupForm = {
  business_name: string
  business_number: string
  representative_name: string
  business_start_date: string
  phone: string
  store_category: string
  address: string
  description: string
}

export type SignupErrors = Partial<Record<keyof SignupForm, string>>

/** 제출 전 검증 — 칸별 메시지. 순수 함수라 테스트가 직접 부른다. */
export function validateSignup(f: SignupForm): SignupErrors {
  const e: SignupErrors = {}
  if (!f.business_number.trim()) e.business_number = '사업자번호를 입력해 주세요'
  else if (!/^\d{3}-\d{2}-\d{5}$/.test(f.business_number)) e.business_number = '숫자 10자리예요 (000-00-00000)'
  if (!f.representative_name.trim()) e.representative_name = '사업자등록증의 대표자명을 적어 주세요'
  if (!f.business_start_date) e.business_start_date = '개업일을 골라 주세요'
  else if (f.business_start_date > new Date().toISOString().slice(0, 10)) e.business_start_date = '오늘 이후 날짜는 고를 수 없어요'
  if (!f.business_name.trim()) e.business_name = '가게명을 입력해 주세요'
  if (!f.phone.trim()) e.phone = '연락받을 휴대폰 번호를 입력해 주세요'
  else if (!/^\d{3}-\d{3,4}-\d{4}$/.test(f.phone)) e.phone = '휴대폰 번호 형식이 아니에요'
  return e
}

/** 필수 5칸 중 채워진 개수 — 하단 바의 진행 표시용(검증 아님). */
export function filledRequired(f: SignupForm): number {
  return [f.business_number, f.representative_name, f.business_start_date, f.business_name, f.phone].filter((v) => v.trim()).length
}
