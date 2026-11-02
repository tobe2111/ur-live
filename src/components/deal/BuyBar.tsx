/**
 * 🧾 상세 화면 하단 구매 바의 **틀** — 이용권(`DealBottomBar`)과 숙소(`StayStickyBar`)가 같이 쓴다.
 *
 * 2026-10-27 (대표 *"통일할 건 통일해야하지 않을까? 하나만 수정되고 이런 문제가 계속 발생하는데"*
 * → *"모두 이상적으로 작업해줘"*): 두 바가 각자 마크업을 들고 있어서 크기·글자·버튼이 따로 놀았다
 * (이용권 가격 24px · 버튼 52px ↔ 숙소 가격 17px · 작은 버튼). 한쪽을 고치면 다른 쪽이 그대로 남았다.
 * ⇒ 틀·가격 칸·주 버튼은 여기 하나. 각 바는 **무엇을 넣을지**(문구·동작·담기 상태)만 정한다.
 *
 * - 📱 모바일 전용(`lg:hidden`) — PC 는 오른쪽 구매 상자가 맡는다.
 * - z 10002 = 하단 탭(9999) 위. 낮추면 폰에서 탭 뒤에 깔린다(2026-10-25 숙소 바가 실제로 그랬다).
 * - 색은 전역 토큰(`--surface`·`--line`·`--ink`·`--sale`·`--brand`) — 페이지 스코프 변수(`--gbd-*`)에
 *   기대지 않는다. 그래야 `.gbd` 밖(숙소)에서도 같은 색이 나온다.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { formatNumber } from '@/utils/format'

export function BuyBarFrame({ children }: { children: ReactNode }) {
  return (
    <footer className="fixed bottom-0 inset-x-0 z-[10002] lg:hidden" role="contentinfo" aria-label="결제 영역">
      <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)', padding: '12px 16px calc(12px + env(safe-area-inset-bottom))' }}>
        {children}
      </div>
    </footer>
  )
}

/** 왼쪽 가격 칸 — 위 한 줄(정가 취소선 또는 "2박 총액" 같은 설명) + 큰 금액. */
export function BuyBarPrice({ caption, strike, discountPct = 0, amount, suffix }: {
  caption?: ReactNode
  strike?: number | null
  discountPct?: number
  amount: number
  suffix?: string
}) {
  return (
    <div className="shrink-0 min-w-0">
      {strike ? <div className="text-[12px] line-through" style={{ color: 'var(--ink-faint)' }}>{formatNumber(strike)}원</div> : null}
      {!strike && caption ? <div className="text-[12px] truncate" style={{ color: 'var(--ink-soft)' }}>{caption}</div> : null}
      <div className="text-[24px] font-bold tracking-[-.02em] leading-tight" style={{ color: 'var(--ink)' }}>
        {discountPct > 0 && <span className="mr-1 text-[17px]" style={{ color: 'var(--sale)' }}>{discountPct}%</span>}
        {formatNumber(amount)}원
        {suffix ? <span className="ml-1 text-[13px] font-medium" style={{ color: 'var(--ink-soft)' }}>{suffix}</span> : null}
      </div>
    </div>
  )
}

/** 주 버튼. `on` 이 거짓이면 흐린 색(누를 수 없거나 이미 끝난 상태). */
export function BuyBarCta({ on, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`flex-1 h-[52px] border-0 rounded-xl text-[17px] font-bold flex items-center justify-center text-white ${className}`}
      style={{ background: on ? 'var(--brand)' : 'var(--ink-faint)', cursor: on ? 'pointer' : 'default' }}
    >
      {children}
    </button>
  )
}

/**
 * 🖥️ PC 오른쪽 구매 상자의 틀·주 버튼 — 숫자는 이용권 상자(`DealPurchaseBox`, 반경 16 · 여백 18 · 버튼 50/12 — 모서리 체계 안 값)와 같다.
 * 숙소 예약 패널(`StayBookingPanel`)이 이 상수를 쓴다. 이용권 상자는 인라인 style 로 같은 값을 들고 있고
 * (기존 가드가 그 모양을 고정한다) 시험이 두 쪽 숫자를 대조한다.
 */
export const PURCHASE_BOX_CLS = 'rounded-2xl p-[18px]'
export const PURCHASE_CTA_CLS = 'w-full h-[50px] rounded-xl text-white text-[15px] font-bold flex items-center justify-center gap-2'
