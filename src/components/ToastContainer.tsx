import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { OkIcon, AlertIcon, InfoIcon } from '@/components/icons/urdeal-icons'
import { useToast } from '@/hooks/useToast'
import { useTranslation } from '@/lib/i18n-lite'
// 🎬 2026-11-02 시안 9차 "알림 메시지"(대표 "다 해주고") — 사라질 때도 위로 올라가며 빠지고(종전엔 툭 사라졌다), 손가락으로 위로 밀면 바로 닫힌다.
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
injectMotionCss('ur-m-toast', `@keyframes ur-toast-out { to { opacity: 0; transform: translateY(-120%); } }.ur-pop-toast[data-out] { pointer-events: none; animation: ur-toast-out .24s cubic-bezier(.4,0,1,1) both; }@media (prefers-reduced-motion: reduce){.ur-pop-toast[data-out]{animation:none!important;display:none}}`)

type ToastItem = { id: string; message: string; type: 'success' | 'error' | 'info' }

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
  // 사라진 토스트를 0.24초 동안 붙잡아 위로 빠지는 움직임을 보여 준다(원래 자리 그대로).
  const prev = useRef<ToastItem[]>(toasts)
  const [leaving, setLeaving] = useState<{ t: ToastItem; at: number }[]>([])
  useEffect(() => {
    const now = new Set(toasts.map((t) => t.id))
    const gone = prev.current.map((t, at) => ({ t, at })).filter((g) => !now.has(g.t.id))
    prev.current = toasts
    if (!gone.length) return
    setLeaving((l) => [...l, ...gone])
    window.setTimeout(() => setLeaving((l) => l.filter((x) => !gone.some((g) => g.t.id === x.t.id))), 260)
  }, [toasts])
  const drag = useRef<{ id: ToastItem['id']; y0: number } | null>(null)

  const rows: { t: ToastItem; out: boolean }[] = toasts.map((t) => ({ t, out: false }))
  for (const g of [...leaving].sort((a, b) => a.at - b.at)) if (!toasts.some((t) => t.id === g.t.id)) rows.splice(Math.min(g.at, rows.length), 0, { t: g.t, out: true })

  if (rows.length === 0) return null

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
      {rows.map(({ t, out }) => (
        <div
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          aria-hidden={out || undefined}
          data-out={out || undefined}
          className="ur-glass flex items-center gap-2 min-h-12 pl-5 pr-2 py-2 ur-pop-toast text-gray-900 dark:text-white pointer-events-auto animate-slide-down max-w-full touch-pan-x"
          onPointerDown={(e) => { if (!out) drag.current = { id: t.id, y0: e.clientY } }}
          onPointerMove={(e) => { const d = drag.current; if (!d || d.id !== t.id) return; const dy = Math.min(0, e.clientY - d.y0); e.currentTarget.style.transform = dy ? `translateY(${dy}px)` : '' }}
          onPointerUp={(e) => { const d = drag.current; drag.current = null; if (!d || d.id !== t.id) return; const dy = e.clientY - d.y0; e.currentTarget.style.transform = ''; if (dy < -24) remove(t.id) }}
          onPointerCancel={(e) => { drag.current = null; e.currentTarget.style.transform = '' }}
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
