/**
 * 🏠 요청서 질문 틀 — 한 틀에 질문 하나(2026-10-25 대표 공유 오늘의집 흐름).
 *
 * 두 가지로 그린다:
 *  - **단계 화면**(`StepFrameContext` 안 — 요청서): 화면 전체에 질문 하나 · 위에 진행 막대 · 아래 버튼.
 *    대표 "단계별로 쭉쭉 자동으로 · 지금은 너무 세로로 길고"(2026-10-25) — 질문 목록을 늘어놓지 않는다.
 *  - **바텀시트**(그 밖 — 함께 신청 안내 등).
 * z-index 는 표준 시트 단(10600) — 하단 네비 위로 뜬다(`constants/z-index.ts`).
 */
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { ChevronLeft, X } from 'lucide-react'

export interface StepFrame {
  /** 1부터. */
  step: number
  total: number
  /** 머리줄 가운데 작은 글씨(예: "간판 제작·교체 견적"). */
  label: string
  /** 첫 질문 위에만 거는 한 줄(예: 업체 모집 중 안내). */
  notice?: ReactNode
  /** 첫 질문 위 소개 — 이 일이 무엇이고 어떻게 굴러가는지(2026-10-25 대표 "1~3 다 하자"). */
  intro?: ReactNode
}

export const StepFrameContext = createContext<StepFrame | null>(null)

export function Sheet({ title, onClose, children, footer }: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const frame = useContext(StepFrameContext)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  if (frame) {
    const pct = Math.round((frame.step / frame.total) * 100)
    return (
      <div className="fixed inset-0 z-[10600] flex flex-col bg-surface text-ink" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col min-h-0">
          <div className="flex h-14 items-center gap-2 px-3">
            <button type="button" aria-label="이전" onClick={onClose} className="p-2"><ChevronLeft className="h-5 w-5" /></button>
            <span className="min-w-0 flex-1 truncate text-center text-[13px] text-gray-500 dark:text-gray-400">{frame.label}</span>
            <span className="w-9 text-right text-[13px] font-medium tabular-nums text-gray-500 dark:text-gray-400">{frame.step}/{frame.total}</span>
          </div>
          <div className="mx-5 h-1 overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuenow={frame.step} aria-valuemin={1} aria-valuemax={frame.total}>
            <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          {frame.step === 1 && frame.intro && <div className="px-5 pt-5">{frame.intro}</div>}
          {frame.step === 1 && frame.notice && <div className="px-5 pt-4">{frame.notice}</div>}
          <h2 className="px-5 pt-6 pb-5 text-[24px] font-bold leading-snug tracking-tight">{title}</h2>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer && <div className="px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[10600] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[88dvh] w-full max-w-[560px] flex-col rounded-t-3xl bg-surface text-ink">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-rule-strong" />
        <div className="flex items-center justify-between px-5 pt-3 pb-4">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button type="button" aria-label="닫기" onClick={onClose} className="-mr-2 p-2"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-rule px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}
