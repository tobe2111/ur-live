/**
 * 🏠 요청서 질문 틀 — 한 틀에 질문 하나(2026-10-25 대표 공유 오늘의집 흐름).
 *
 * 두 가지로 그린다:
 *  - **단계 화면**(`StepFrameContext` 안 — 요청서): 화면 전체에 질문 하나 · 위에 진행 막대 · 아래 버튼.
 *    대표 "단계별로 쭉쭉 자동으로 · 지금은 너무 세로로 길고"(2026-10-25) — 질문 목록을 늘어놓지 않는다.
 *  - **바텀시트**(그 밖 — 함께 신청 안내 등).
 * z-index 는 표준 시트 단(10600) — 하단 네비 위로 뜬다(`constants/z-index.ts`).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 2026-11-02 10차 ⑥ — 단계마다 시트가 새로 그려져서 막대가 '차오르지' 않고 끝값으로 바로 떴다.
//   막대는 직전 단계 비율(--ls-from)에서 차오르고, 질문은 앞으로 가면 오른쪽에서 · 뒤로 가면 왼쪽에서 들어온다.
injectMotionCss('ur-m-lifestep', `@keyframes ur-ls-bar { from { transform: scaleX(var(--ls-from, 1)); } }@keyframes ur-ls-fwd { from { opacity: 0; transform: translateX(32px); } }@keyframes ur-ls-back { from { opacity: 0; transform: translateX(-32px); } }.ur-ls-bar { transform-origin: left; animation: ur-ls-bar .45s cubic-bezier(.2,.9,.3,1) backwards; }.ur-ls-fwd { animation: ur-ls-fwd .32s cubic-bezier(.2,.9,.3,1) backwards; }.ur-ls-back { animation: ur-ls-back .32s cubic-bezier(.2,.9,.3,1) backwards; }@media (prefers-reduced-motion: reduce){.ur-ls-bar,.ur-ls-fwd,.ur-ls-back{animation:none!important}}`)
/** 직전에 그린 단계 — 시트가 단계마다 새로 그려지므로 모듈에 둔다(한 화면에 단계 시트는 하나뿐이다). */
let lastStep = 0
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
  // 마운트 때 한 번만 '어디서 왔나' 를 정한다 — 렌더마다 다시 재면 입력 중 다시 그려질 때 움직임이 끊긴다.
  const [from] = useState(() => { const prev = lastStep; if (frame) lastStep = frame.step; return prev })
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  if (frame) {
    const pct = Math.round((frame.step / frame.total) * 100)
    const prev = from
    const moved = prev > 0 && prev !== frame.step
    const barFrom = moved ? Math.max(0, Math.min(4, prev / frame.step)) : 1
    return (
      <div className="fixed inset-0 z-[10600] flex flex-col bg-surface text-ink" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col min-h-0">
          <div className="flex h-14 items-center gap-2 px-3">
            <button type="button" aria-label="이전" onClick={onClose} className="p-2"><ChevronLeft className="h-5 w-5" /></button>
            <span className="min-w-0 flex-1 truncate text-center text-[13px] text-gray-500 dark:text-gray-400">{frame.label}</span>
            <span className="w-9 text-right text-[13px] font-medium tabular-nums text-gray-500 dark:text-gray-400">{frame.step}/{frame.total}</span>
          </div>
          <div className="mx-5 h-1 overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuenow={frame.step} aria-valuemin={1} aria-valuemax={frame.total}>
            <div className={`h-full rounded-full bg-brand transition-[width] duration-300${moved ? ' ur-ls-bar' : ''}`} style={{ width: `${pct}%`, '--ls-from': barFrom } as React.CSSProperties} />
          </div>
          {frame.step === 1 && frame.intro && <div className="px-5 pt-5">{frame.intro}</div>}
          {frame.step === 1 && frame.notice && <div className="px-5 pt-4">{frame.notice}</div>}
          <div className={`flex min-h-0 flex-1 flex-col${moved ? (frame.step > prev ? ' ur-ls-fwd' : ' ur-ls-back') : ''}`}>
            <h2 className="px-5 pt-6 pb-5 text-[20px] font-semibold leading-snug tracking-tight">{title}</h2>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          </div>
          {footer && <div className="px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[10600] flex items-end justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="닫기" className="absolute inset-0 ur-veil" onClick={onClose} />
      <div className="relative flex max-h-[88dvh] w-full max-w-[560px] flex-col ur-pop-card ur-glass text-ink ur-dialog-in">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-rule-strong" />
        <div className="flex items-center justify-between px-5 pt-3 pb-4">
          <h2 className="text-[16px] font-semibold">{title}</h2>
          <button type="button" aria-label="닫기" onClick={onClose} className="-mr-2 p-2"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-rule px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}
