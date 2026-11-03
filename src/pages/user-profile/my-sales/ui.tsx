import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

/**
 * 🧾 마이 판매 시트 공용 부품 — 2026-11-03 대표 확정 *"좋다 다 해줘"*(시안 M1~M5 · `docs/design/my-seller-sheets-2026-11-03.md`).
 *   흰 판(16 모서리) 하나에 관련 줄을 묶고, 판 사이 12 · 판 안 20 · 줄 사이 실선. 숫자가 주인공(28·700).
 *   시트 바탕은 `Sheet` 의 유리 면이고 판만 `bg-surface` 다 — 머리와 몸통이 같은 면이라 두 조각으로 안 갈린다.
 */
export const MY_CARD_CLS = 'mx-3 mt-3 rounded-2xl bg-surface'

export function Card({ children, className = 'px-5 py-4', testId }: { children: ReactNode; className?: string; testId?: string }) {
  return <div className={`${MY_CARD_CLS} ${className}`} data-testid={testId}>{children}</div>
}

/** 큰 숫자 한 줄 + 아래 세 칸(판매·사용 대기·정산 예정 같은). 모르는 값은 `—`(0 으로 위장하지 않는다). */
export function BigNumberCard({ caption, value, sub, cells, testId }: {
  caption: string
  value: string
  sub?: ReactNode
  cells?: Array<{ label: string; value: string; hot?: boolean }>
  testId?: string
}) {
  return (
    <Card className="px-5 pt-5 pb-4" testId={testId}>
      <p className="text-[13px] text-gray-500 dark:text-gray-400">{caption}</p>
      <p className="mt-1 text-[28px] font-bold tabular-nums leading-tight tracking-[-0.02em] text-gray-900 dark:text-white">{value}</p>
      {sub}
      {cells && cells.length > 0 && (
        <div className="mt-4 -mx-5 px-5 pt-4 grid border-t border-rule" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
          {cells.map((c, i) => (
            <div key={c.label} className={`text-center ${i > 0 ? 'border-l border-rule' : ''}`}>
              <p className="text-[12px] text-gray-500 dark:text-gray-400">{c.label}</p>
              <p className={`mt-1 text-[16px] font-semibold tabular-nums ${c.hot ? 'text-brand-text' : 'text-gray-900 dark:text-white'}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/** 판매 켜기/끄기 — 켜짐 = 브랜드 면. */
export function SaleSwitch({ on, busy, onChange, label }: { on: boolean; busy?: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} disabled={busy}
      onClick={(e) => { e.stopPropagation(); onChange(!on) }}
      className={`relative h-[26px] w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-brand' : 'bg-gray-300 dark:bg-white/20'}`}
    >
      <span className="absolute top-[3px] left-[3px] h-5 w-5 rounded-full bg-white dark:bg-white" style={{ transition: 'transform .3s cubic-bezier(.3,1.4,.5,1)', transform: on ? 'translateX(18px)' : undefined }} />
    </button>
  )
}

/** 판 안의 한 줄 — [제목 … 값 ›]. 누를 수 없으면 화살표가 없다. */
export function PlateRow({ label, value, onClick, danger, right }: {
  label: string
  value?: ReactNode
  onClick?: () => void
  danger?: boolean
  right?: ReactNode
}) {
  const inner = (
    <>
      <span className={`flex-1 min-w-0 truncate text-[15px] ${danger ? 'text-tone-bad' : 'text-gray-900 dark:text-white'}`}>{label}</span>
      {value != null && <span className="shrink-0 text-[13px] text-gray-500 dark:text-gray-400 tabular-nums">{value}</span>}
      {right}
      {onClick && !right && <ChevronRight className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />}
    </>
  )
  const cls = 'w-full flex items-center gap-2 min-h-[52px] py-3 text-left border-b border-rule last:border-b-0'
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} active:opacity-70`}>{inner}</button>
    : <div className={cls}>{inner}</div>
}

export function PlateLoading() {
  return <div className={`${MY_CARD_CLS} h-[120px] animate-pulse`} aria-hidden="true" />
}
