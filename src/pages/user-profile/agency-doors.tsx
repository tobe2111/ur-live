import { lazy, Suspense } from 'react'
import { useAgencyPresence } from './useAgencyPresence'

/**
 * 🚪 마이의 에이전시 자리 두 개(머리 '매장 영입' 버튼 · 합친 구역 제목)의 **문** — 2026-11-02.
 *   에이전시가 아닌 손님 대다수는 그 코드를 한 바이트도 안 받는다(`check-surface-budgets` dash:my 가
 *   +1.7KB 로 잡았다 — 허용 1.5). 로그인 여부는 의존성 없는 작은 모듈로 묻고, 있을 때만 받는다.
 */
const AgencyInviteButton = lazy(() => import('./AgencyInviteButton'))
const AgencyMergedTitle = lazy(() => import('./AgencyMergedTitle'))

export function AgencyInviteDoor({ className }: { className?: string }) {
  const { on } = useAgencyPresence()
  if (!on) return null
  return <Suspense fallback={null}><AgencyInviteButton className={className} /></Suspense>
}

export function AgencyTitleDoor({ storeCount }: { storeCount: number }) {
  const { on } = useAgencyPresence()
  if (!on || storeCount <= 0) return null
  return <Suspense fallback={null}><AgencyMergedTitle storeCount={storeCount} /></Suspense>
}
