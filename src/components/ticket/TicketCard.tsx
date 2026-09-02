/**
 * 🎫 티켓 카드 — 유어딜 표면 체계의 첫 부품 (2026-09-02, 대표 시안: 코레일톡 다크·화이트)
 *
 * ■ 무엇인가
 *   색 밴드(기한 + D-day) 위에 흰(또는 다크 카드색) 본문이 붙은 **실물 티켓 한 장**.
 *   결제 완료 화면과 내 이용권 지갑이 같은 부품을 쓴다 — 산 것과 가진 것이 같은 모양이어야 한다.
 *
 * ■ 규칙 (docs/design/ticket-completion-reference-2026-09.md §1)
 *   1. 표면 두 톤 · **테두리 0** · 화이트만 `shadow-lift` 한 값(다크는 자동 none)
 *   2. 로즈는 밴드에만. 본문 안 강조는 `text-brand-text` 하나
 *   3. 카드 안 구분선은 `border-rule`(투명 잉크) — 실선 hex 를 그리지 말 것
 *   4. 모서리 16 (`rounded-2xl`), 밴드 높이 44
 *
 * ■ 쓰지 말 것
 *   `border border-*` · `shadow-sm~2xl` · 색깔 정보상자 · 체크 원. 이 부품이 존재하는 이유가 그것들을 없애는 것이다.
 */
import type { ReactNode } from 'react'

export function TicketCard({ bandLeft, bandRight, muted, children, className = '', onClick }: {
  /** 밴드 왼쪽 — 보통 사용 기한 "2026.09.21 (월)까지" */
  bandLeft: ReactNode
  /** 밴드 오른쪽 — 보통 "D-19". 없으면 비운다 */
  bandRight?: ReactNode
  /** 사용 완료·만료: 밴드가 회색이 되고 전체가 흐려진다 */
  muted?: boolean
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  const interactive = typeof onClick === 'function'
  return (
    <div
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      className={`overflow-hidden rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift ${muted ? 'opacity-60' : ''} ${interactive ? 'cursor-pointer active:opacity-90' : ''} ${className}`}
    >
      <div className={`flex items-center justify-between h-11 px-4 text-[14px] text-white tabular-nums ${muted ? 'bg-gray-400 dark:bg-[#3A3D44]' : 'bg-brand'}`}>
        <span className="font-bold">{bandLeft}</span>
        {bandRight !== undefined && <span className="font-medium">{bandRight}</span>}
      </div>
      {children}
    </div>
  )
}

/** 본문 첫 줄 — "식사 이용권 ·· 1매" 처럼 종류와 수량. 아래 헤어라인은 `border-rule`. */
export function TicketRow({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-rule text-[14px]">
      <span className="font-semibold text-gray-900 dark:text-white">{left}</span>
      {right !== undefined && <span className="text-gray-500 dark:text-gray-400">{right}</span>}
    </div>
  )
}

/** 카드 안 outline 버튼 — 테두리는 `rule-strong`, 글자만 로즈. 면을 채우지 않는다(주 버튼은 화면에 하나뿐). */
export function TicketOutlineButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="w-full h-12 rounded-xl border border-rule-strong text-[15px] font-bold text-brand-text active:opacity-70"
    >
      {children}
    </button>
  )
}

/** 안내 줄 — 작은 네모 불릿 + 회색. 색깔 상자로 감싸지 않는다. */
export function TicketNotes({ items }: { items: string[] }) {
  return (
    <ul className="px-1 space-y-1.5 text-[13.5px] leading-[1.55] text-gray-500 dark:text-gray-400">
      {items.map((line) => (
        <li key={line} className="grid grid-cols-[12px_1fr] gap-1.5">
          <span aria-hidden="true" className="mt-[9px] ml-0.5 w-1 h-1 bg-gray-400 dark:bg-gray-500" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  )
}
