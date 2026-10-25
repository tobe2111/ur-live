/**
 * 🏠 요청서 바텀시트 — 한 시트에 질문 하나(2026-10-25 대표 공유 오늘의집 흐름).
 * z-index 는 표준 시트 단(10600) — 하단 네비 위로 뜬다(`constants/z-index.ts`).
 */
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Sheet({ title, onClose, children, footer }: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

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
