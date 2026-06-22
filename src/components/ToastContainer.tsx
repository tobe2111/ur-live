import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { useTranslation } from 'react-i18next'

// 🎨 2026-06-22 (대표 — "팝업 디자인 촌스러워"): 파스텔 색박스(green-50/red-50/blue-50) → 단일 잉크 토스트.
//   어떤 페이지 배경(라이트/다크) 위에서도 일관되게 보이는 near-black 카드 + 컬러 아이콘만으로 의미 구분.
//   앱 전역 흑백/잉크 방향과 정합. dark: variant 없이 단색 잉크라 라이트 고정 대시보드 위에서도 자연스러움.
export default function ToastContainer() {
  const { toasts, remove } = useToast()
  const { t: tl } = useTranslation()

  if (toasts.length === 0) return null

  const icons = {
    success: <CheckCircle2 className="w-[18px] h-[18px] text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-[18px] h-[18px] text-red-400 shrink-0" />,
    info: <Info className="w-[18px] h-[18px] text-sky-400 shrink-0" />,
  }

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 w-full max-w-sm px-4 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          className="flex items-center gap-2.5 pl-3.5 pr-1.5 py-2.5 rounded-2xl bg-[#18181B]/95 text-white backdrop-blur-md ring-1 ring-white/10 shadow-[0_10px_34px_-8px_rgba(0,0,0,0.45)] pointer-events-auto animate-slide-down max-w-full"
        >
          {icons[t.type]}
          <p className="flex-1 text-[13.5px] font-medium leading-snug line-clamp-2">{t.message}</p>
          <button
            onClick={() => remove(t.id)}
            aria-label={tl('common.close')}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-white/45 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
