import { lazy, Suspense } from 'react'
import { useAgencyPresence } from './useAgencyPresence'
import { hasAgencyLogin } from '@/lib/agency-presence'
import { loadAgencySection } from './MyAgencyZone'

/**
 * 🚪 마이의 에이전시 자리 두 개(머리 '매장 영입' 버튼 · 합친 구역 제목)의 **문** — 2026-11-02.
 *   에이전시가 아닌 손님 대다수는 그 코드를 한 바이트도 안 받는다(`check-surface-budgets` dash:my 가
 *   +1.7KB 로 잡았다 — 허용 1.5). 로그인 여부는 의존성 없는 작은 모듈로 묻고, 있을 때만 받는다.
 */
const loadInvite = () => import('./AgencyInviteButton')
const loadTitle = () => import('./AgencyMergedTitle')
const loadHead = () => import('./AgencyHead')
const AgencyInviteButton = lazy(loadInvite)
const AgencyMergedTitle = lazy(loadTitle)
const AgencyHead = lazy(loadHead)

/**
 * 🏃 2026-11-04 대표 *"에이전시 명 그 부분이나 몇몇 부분만 유독 늦게 떠"* — 에이전시 로그인이 있으면 마이의
 *   **첫 렌더에서** 에이전시 화면 코드와 조회를 한꺼번에 출발시킨다(종전엔 그림 → 코드 → 조회 → 매장 판 → 조회의 줄서기).
 *   에이전시가 아닌 손님은 `hasAgencyLogin()` 에서 끝난다 — 받는 것 0.
 */
export function warmAgencyZone(): void {
  if (!hasAgencyLogin()) return
  void import('@/pages/agency-console/agency-warm').then((m) => m.warmAgencyRequests()).catch(() => { /* 화면이 스스로 받는다 */ })
  for (const load of [loadInvite, loadTitle, loadHead, loadAgencySection]) void load().catch(() => { /* lazy 가 다시 시도한다 */ })
}

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

/** 🏢 폰 '에이전시' 탭의 머리(2026-11-03) — 정지원·프로필 편집 자리에 에이전시 이름 · 역할 · 매장 수 + 매장 영입. */
export function AgencyHeadDoor({ storeCount }: { storeCount: number }) {
  const { on } = useAgencyPresence()
  if (!on) return null
  return <Suspense fallback={<div className="h-[80px]" aria-hidden="true" />}><AgencyHead storeCount={storeCount} /></Suspense>
}
