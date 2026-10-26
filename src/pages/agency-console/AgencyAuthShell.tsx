/**
 * 🏢 에이전시 로그인·가입·합류 화면의 공용 껍데기.
 *
 * 라이트 고정 standalone 화면이다(레이아웃 밖) — 루트에 `force-light-theme` 를 달아 전역
 * `.dark input` 규칙이 입력 글자를 흰색으로 덮지 못하게 한다(check-light-input-guard).
 * 🎫 디자인 시스템: 바탕 #F8F7FC · 흰 카드 shadow-lift 테두리 0 · 주 버튼 bg-brand ·
 * 글자 24/17/15/13/12 · 4px 격자.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import UrDealLogo from '@/components/brand/UrDealLogo'

/**
 * `aside` 를 주면(로그인 화면) PC 는 [소개 | 로그인] 두 칸, 폰은 로그인 칸 **아래**에 소개가 온다
 * — 돌아온 사람이 소개를 지나 스크롤하지 않게.
 */
export function AgencyAuthShell({ title, lead, children, footer, aside }: {
  title: string
  lead?: ReactNode
  children: ReactNode
  footer?: ReactNode
  aside?: ReactNode
}) {
  const brand = (
    <Link to="/agency/login" className="inline-flex items-baseline gap-2" aria-label="유어딜 에이전시">
      <UrDealLogo size={24} forceLight />
      <span className="text-[15px] font-medium text-gray-600">에이전시</span>
    </Link>
  )
  const form = (
    <div>
      <h1 className="text-[24px] font-bold leading-tight tracking-[-0.01em] text-gray-900">{title}</h1>
      {lead && <p className="mt-2 text-[13px] leading-relaxed text-gray-500">{lead}</p>}
      <div className="mt-6 rounded-2xl bg-white p-6 shadow-lift">{children}</div>
      {footer && <div className="mt-6 text-center text-[13px] text-gray-500">{footer}</div>}
    </div>
  )
  return (
    <div className="force-light-theme agency-light-theme min-h-[100dvh] bg-[#F8F7FC] text-gray-900">
      {aside ? (
        <div className="mx-auto w-full max-w-[1040px] px-4 lg:px-8 pt-12 pb-16">
          {brand}
          <div className="mt-8 flex flex-col gap-12 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-16 lg:pt-6">
            <div className="order-2 lg:order-1">{aside}</div>
            <div className="order-1 w-full max-w-[420px] mx-auto lg:order-2 lg:max-w-none">{form}</div>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[420px] px-4 pt-12 pb-16">
          {brand}
          <div className="mt-8">{form}</div>
        </div>
      )}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-2 block text-[12px] text-gray-500">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full h-12 rounded-xl border border-gray-200 bg-white px-4 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-brand disabled:bg-gray-50 disabled:text-gray-500'

export const primaryBtnCls =
  'w-full h-12 rounded-xl bg-brand text-white text-[15px] font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed'

export function FormError({ message }: { message: string }) {
  if (!message) return null
  return <p role="alert" className="text-[13px] text-tone-bad">{message}</p>
}

export function PasswordRules({ rules }: { rules: Array<{ label: string; ok: boolean }> }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
      {rules.map((r) => (
        <li key={r.label} className={`text-[12px] ${r.ok ? 'text-brand-text font-semibold' : 'text-gray-400'}`}>
          {r.ok ? '✓' : '·'} {r.label}
        </li>
      ))}
    </ul>
  )
}
