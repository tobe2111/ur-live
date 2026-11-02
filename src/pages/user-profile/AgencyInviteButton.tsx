import { lazy, Suspense, useState } from 'react'
import { useAgencyPresence } from './useAgencyPresence'

/** 시트·카드(카카오 공유 포함)는 누를 때만 받는다 — 에이전시가 아닌 손님은 한 바이트도 안 받는다. */
const AgencyInviteSheet = lazy(() => import('@/pages/agency-console/AgencyInviteSheet'))

/**
 * 🔗 마이 머리 '매장 영입' 버튼 — 2026-11-02 대표 확정 **버튼 ①(옅은 블루 알약)**.
 *   대표: *"안1 처럼 맨 위에 매장 영입 버튼을 넣는 건 맞는데 버튼 디자인이 너무 별로야"* → *"버튼 1 기준으로 해줘"*.
 *   진한 블루 면은 '사용처리' 하나로 남긴다(🎫 규칙 ②) — 그래서 이 버튼은 옅은 블루(`bg-brand-tint`)다.
 *   이모지 대신 선 아이콘(획 1.6). 에이전시 로그인이 있을 때만 선다.
 */
export default function AgencyInviteButton({ className = '' }: { className?: string }) {
  const { on, isAdmin } = useAgencyPresence()
  const [open, setOpen] = useState(false)
  if (!on) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="agency-invite-entry"
        className={`shrink-0 inline-flex items-center gap-1 h-[34px] pl-2 pr-3 rounded-full bg-brand-tint text-brand-text text-[13px] font-medium active:opacity-70 ${className}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        매장 영입
      </button>
      {open && (
        <Suspense fallback={null}>
          <AgencyInviteSheet canManage={isAdmin} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
