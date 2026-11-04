/**
 * 🧱 ⑥ 사업자등록증 · ⑦ 정산 계좌 의 공용 틀 — 2026-11-03 대표 *"응 모두 해줘"*(대시보드 밖으로, 다크모드까지).
 * 하단 탭 없는 전체 화면(`consumer-chrome.ts`), 바닥에 붙는 버튼, ← · 진행선 · "판매 시작까지" 머리.
 * 좌석(셀러 토큰)이 없으면 마이로 보낸다 — 이 화면들은 매장 등록 뒤의 다리라 혼자 열릴 일이 없다.
 */
import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import SEO from '@/components/SEO'
import { isSellerAuthenticated } from '@/lib/seller-auth'
import { MY_PATH } from '@/lib/seller-return'
import { useSafeBack } from '@/hooks/useSafeBack'

/** 🎬 이 화면이 처음 열릴 수도 있다(직접 주소·새로고침) — 움직임 CSS 를 등록 화면에 기대지 않고 여기서도 꽂는다(같은 id 면 한 번만). */
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) }
injectMotionCss('ur-m-step', `@keyframes ur-step-fwd { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }@keyframes ur-step-back { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: none; } }.ur-step-fwd { animation: ur-step-fwd .3s cubic-bezier(.2,1,.3,1) backwards; }.ur-step-back { animation: ur-step-back .3s cubic-bezier(.2,1,.3,1) backwards; }@media (prefers-reduced-motion: reduce){.ur-step-fwd,.ur-step-back{animation:none!important}}`)
injectMotionCss('ur-m-busyring', `@keyframes ur-busy-spin { to { transform: rotate(360deg); } }.ur-busy-ring { position: relative; isolation: isolate; overflow: hidden; }.ur-busy-ring::before { content: ''; position: absolute; inset: -60%; z-index: -2; background: conic-gradient(from 0deg, transparent 0 65%, rgba(255,255,255,.95) 82%, transparent 100%); animation: ur-busy-spin 1.1s linear infinite; }.ur-busy-ring::after { content: ''; position: absolute; inset: 2px; z-index: -1; border-radius: inherit; background: var(--brand); }@media (prefers-reduced-motion: reduce){.ur-busy-ring::before{animation:none!important;opacity:0}}`)
injectMotionCss('ur-m-snbar', `.ur-sn-bar { transition: width .4s cubic-bezier(.2,1,.3,1); }@media (prefers-reduced-motion: reduce){.ur-sn-bar{transition:none}}`)

interface Props { step: 1 | 2; title: string; lead: string; seoTitle: string; children: ReactNode; footer: ReactNode }

export default function StoreStepShell({ step, title, lead, seoTitle, children, footer }: Props) {
  const navigate = useNavigate()
  const goBack = useSafeBack(MY_PATH)
  const authed = isSellerAuthenticated()
  useEffect(() => { if (!authed) navigate(MY_PATH, { replace: true }) }, [authed, navigate])
  return (
    <div className="h-dvh lg:h-auto lg:min-h-dvh bg-warm text-gray-900 dark:text-white flex flex-col">
      <SEO title={`${seoTitle} - 유어딜`} description="판매를 시작하려면 남은 일을 마쳐 주세요." noindex />
      <div className="mx-auto w-full max-w-[480px] flex-1 min-h-0 flex flex-col">
        <div className="h-14 shrink-0 flex items-center justify-between px-2">
          <button type="button" aria-label="이전" onClick={goBack} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-wash">
            <ArrowLeft size={22} strokeWidth={1.6} />
          </button>
          <span className="pr-3 text-[12px] text-ink-soft tabular-nums">{step} / 2</span>
        </div>
        <div className="mx-5 h-1 rounded-full bg-wash overflow-hidden" aria-hidden="true">
          <div className="ur-sn-bar h-full rounded-full bg-brand" style={{ width: `${step * 50}%` }} />
        </div>
        <div className="ur-step-fwd flex-1 min-h-0 flex flex-col px-5 pt-5 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
            <p className="text-[13px] font-medium text-brand-text">판매 시작까지</p>
            <h1 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] leading-snug">{title}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{lead}</p>
            {children}
          </div>
          <div className="shrink-0 pt-3">{footer}</div>
        </div>
      </div>
    </div>
  )
}
