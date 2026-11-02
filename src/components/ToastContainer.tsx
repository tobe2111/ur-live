import { X } from 'lucide-react'
import { OkIcon, AlertIcon, InfoIcon } from '@/components/icons/urdeal-icons'
import { useToast } from '@/hooks/useToast'
import { useTranslation } from '@/lib/i18n-lite'

// 🎨 2026-06-22 (대표 — "팝업 디자인 촌스러워"): 파스텔 색박스(green-50/red-50/blue-50) → 단일 잉크 토스트.
// 🎫 2026-09-02 (대표 — "이 팝업들도 디자인 시스템에 맞게"): 잉크 상자 → 코레일톡 표면 체계.
//   라이트 = 흰 카드 + `shadow-lift` 한 값 / 다크 = surface(#1D1F29) · 테두리 0 · 링 0 · 무거운 그림자 0.
//   의미 구분은 아이콘 하나 — 성공·안내는 브랜드 글자색(강조색 하나), 오류만 빨강(상태색). 초록·하늘색은 쓰지 않는다.
// 🪟 2026-11-02 대표 확정 *"블러 없이 유리로 하자"*: 흰 카드 → **유리 알약**(`.ur-glass` — 반투명 + 판만 흐림).
//   글자 13 → 15(B2 시안 진단: 작고 흐린 글자). 위 가운데 자리는 2026-09-02 확정 그대로.
//   ⚠️ 라이트 고정 대시보드(/seller·/admin·/agency)는 html.dark 가 있어도 `*-light-theme` 래퍼가 색을 고정하지
//   않는다 — 그래서 이 토스트는 다크 variant 를 `dark:` 로만 걸어 대시보드 위에선 늘 흰 카드다.
export default function ToastContainer() {
  const { toasts, remove } = useToast()
  const { t: tl } = useTranslation()

  if (toasts.length === 0) return null

  const icons = {
    success: <OkIcon className="w-[18px] h-[18px] text-brand-text shrink-0" />,
    error: <AlertIcon className="w-[18px] h-[18px] text-red-500 shrink-0" />,
    info: <InfoIcon className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400 shrink-0" />,
  }

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[20000] flex flex-col items-center gap-2 w-full max-w-sm px-4 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          className="ur-glass flex items-center gap-2.5 min-h-12 pl-5 pr-2 py-2 rounded-[24px] text-gray-900 dark:text-white pointer-events-auto animate-slide-down max-w-full"
        >
          {icons[t.type]}
          <p className="flex-1 text-[15px] font-medium leading-snug line-clamp-2">{t.message}</p>
          <button
            onClick={() => remove(t.id)}
            aria-label={tl('common.close')}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
